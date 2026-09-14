import * as THREE from 'three';
import { AI, KART, SIM } from '../config/tuning';
import {
  initInput,
  pollInput,
  pollPadCodes,
  bindings,
  bindKey,
  resetBindings,
  BIND_ACTIONS,
  UNIVERSAL_ALTERNATES,
} from './Input';
import type { BindAction, ControlState } from './Input';
import { DebugHud } from './DebugHud';
import { Kart } from '../game/Kart';
import { Track } from '../game/Track';
import { ChaseCamera } from '../game/ChaseCamera';
import { Race } from '../game/Race';
import { RaceHud } from './RaceHud';
import { Audio } from './Audio';
import { AiDriver } from '../game/AiDriver';
import { Items } from '../game/Items';
import { Fx } from '../game/Fx';
import { Sky } from '../game/Sky';
import { Minimap } from './Minimap';
import { PostFX } from './PostFX';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { TRACKS } from '../game/Track';
import botBUrl from '../../assets/exported/characters/grokbot-b-seated.glb?url';
import botCUrl from '../../assets/exported/characters/grokbot-c-seated.glb?url';
import kartBUrl from '../../assets/exported/karts/kart-b.glb?url';
import kartCUrl from '../../assets/exported/karts/kart-c.glb?url';

const IDLE: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false };
const AI_COUNT = 3; // rival bots on the grid
const KART_RADIUS = 1.35; // m — collision circle for kart-vs-kart
const RESTITUTION = 0.35; // bounciness of kart contact

// Game root: renderer + scene + fixed-timestep sim loop (ADR-003).
// Sim steps at SIM.fixedDt; render happens once per rAF.

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private postfx!: PostFX; // built in ctor once chaseCam's camera exists
  private readonly scene = new THREE.Scene();
  private hemi!: THREE.HemisphereLight;
  private sun!: THREE.DirectionalLight;
  /** PMREM result — kept alive for the app's lifetime: scene.environment
   *  samples this RT's texture (disposing the RT frees the texture). */
  private envRT!: THREE.WebGLRenderTarget;
  private readonly chaseCam: ChaseCamera;
  private readonly hud: DebugHud;
  private track!: Track;
  // Shared world systems — one particle pool set + one sky, themed per
  // track in buildWorld. Karts/items emit into fx (replaces per-kart VFX).
  private readonly fx = new Fx();
  private readonly sky = new Sky();
  private readonly sunDir = new THREE.Vector3(60, 90, 40).normalize();
  private readonly kart = new Kart(undefined, undefined, undefined, this.fx);
  private readonly aiKarts: Kart[] = [];
  private readonly aiDrivers: AiDriver[] = [];
  private items!: Items;
  private minimap!: Minimap;
  private race!: Race;
  private trackIdx = 0;
  private readonly raceHud = new RaceHud();
  private readonly audio = new Audio();
  private accumulator = 0;
  private lastMs = 0;
  private simTime = 0;
  private paused = false;
  /** Options-menu state — O toggles; arrows navigate/adjust. */
  private readonly settings = {
    open: false,
    sel: 0,
    masterVol: 1,
    musicVol: 0.8,
    difficulty: 1, // 0 easy / 1 normal / 2 hard
    reducedMotion: false,
    minimap: true,
  };
  private readonly baseSkills = [0.95, 1.05, 1.0];

  private applyDifficulty(): void {
    const delta = [-0.13, 0, 0.05][this.settings.difficulty] ?? 0;
    for (let i = 0; i < this.aiDrivers.length; i++) {
      this.aiDrivers[i].setSkill(this.baseSkills[i] + delta);
    }
  }

  private adjustSetting(dir: number): void {
    const s = this.settings;
    const clamp01 = (v: number) => THREE.MathUtils.clamp(v, 0, 1);
    if (s.sel === 0) {
      s.masterVol = clamp01(s.masterVol + dir * 0.1);
      this.audio.setMasterVolume(s.masterVol);
    } else if (s.sel === 1) {
      s.musicVol = clamp01(s.musicVol + dir * 0.1);
      this.audio.setMusicVolume(s.musicVol);
    } else if (s.sel === 2) {
      s.difficulty = THREE.MathUtils.clamp(s.difficulty + dir, 0, 2);
      this.applyDifficulty();
    } else if (s.sel === 3) {
      s.reducedMotion = !s.reducedMotion;
      this.chaseCam.reducedMotion = s.reducedMotion;
    } else {
      s.minimap = !s.minimap;
    }
    this.saveSettings();
  }

  // Options menu navigation shared by the title-phase and modal paths:
  // rows 0-4 adjust values; rows 5-10 arm the key-capture; row 11 resets.
  private toggleMotion(): void {
    this.chaseCam.reducedMotion = !this.chaseCam.reducedMotion;
    this.settings.reducedMotion = this.chaseCam.reducedMotion;
    this.saveSettings(); // same persistence as the options row (critic5 D5)
  }

  private menuKey(code: string): void {
    const s = this.settings;
    if (code === 'ArrowUp') {
      s.sel = (s.sel + Game.MENU_ROWS - 1) % Game.MENU_ROWS;
    } else if (code === 'ArrowDown') {
      s.sel = (s.sel + 1) % Game.MENU_ROWS;
    } else if (s.sel >= 5 && s.sel <= 10) {
      if (code === 'ArrowRight' || code === 'Enter' || code === 'Space') {
        this.bindingCapture = BIND_ACTIONS[s.sel - 5];
      }
    } else if (s.sel === 11) {
      if (code === 'ArrowRight' || code === 'Enter' || code === 'Space') {
        resetBindings();
      }
    } else {
      const dir = code === 'ArrowLeft' ? -1 : code === 'ArrowRight' ? 1 : 0;
      if (dir !== 0) this.adjustSetting(dir);
    }
  }

  private saveSettings(): void {
    localStorage.setItem(
      'grok-kart-settings',
      JSON.stringify({ ...this.settings, open: false, track: this.trackIdx }),
    );
  }
  private readonly celebrated: boolean[] = []; // per-racer finish confetti fired
  private stuckFor = 0;
  private readonly stuckPrevPos = new THREE.Vector3(); // seconds throttle-held below 1.5 m/s (D4 hint)
  // Options key-rebind: while armed, the next keydown becomes the action's
  // code (Escape cancels). Meta/game-command keys are reserved so a drive
  // bind can never shadow pause/quit/menu.
  private bindingCapture: BindAction | null = null;
  private captureDeniedAt = -10; // simTime of last reserved-key denial
  private padPrev = new Set<string>(); // pad codes held last frame
  // Per-track best-lap records (seconds) — persisted; a beaten record
  // flashes mid-race and stars the results screen.
  private readonly records: Record<number, number> = {};
  private recordFlashAt = -10;
  private recordSetThisRace = false;
  private static readonly RESERVED_CODES = new Set([
    'Escape', 'KeyP', 'KeyO', 'KeyQ', 'KeyR', 'KeyN', 'KeyM', 'KeyT',
    'KeyG', 'Backquote', 'Backspace', 'Enter', 'Tab',
    'F5', 'F11', 'F12', 'MetaLeft', 'MetaRight', 'OSLeft', 'OSRight',
    // Universal alternates (arrows drive, RShift drifts) — binding one
    // would dual-fire with its hardcoded fallback (critic4: ↑ as brake
    // still throttled).
    ...UNIVERSAL_ALTERNATES,
  ]);
  // Options rows: 5 settings + 6 bind rows + RESET — keep in sync with
  // RaceHud's options render.
  private static readonly MENU_ROWS = 12;
  // Grand Prix cup: race all tracks in order for championship points.
  private gpMode = false;
  private gpLeg = 0;
  private readonly gpPoints: number[] = [0, 0, 0, 0];
  private gpDone = false;
  private static readonly GP_POINTS = [10, 7, 5, 3];

  /** Cup progress only exists while racing it — title returns and restarts
   *  from final standings always present a fresh cup (critic: the title
   *  showed "leg 4/3" and a post-cup race rendered the old standings). */
  private resetCup(): void {
    this.gpLeg = 0;
    this.gpDone = false;
    this.gpPoints.fill(0);
  }

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    // Filmic grade + shadow-mapped sun — the production-lighting pass.
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap; // PCFSoft deprecated in r185+
    // info resets per render() call — the composer issues several per frame,
    // so accumulate manually and reset once before the composer runs; the
    // debug HUD + QA probes then see the FULL frame (scene + post quads).
    this.renderer.info.autoReset = false;
    // The physical-material shaders emit benign ANGLE/D3D X4122 constant-
    // precision warnings in their program info logs; three.js dumps any
    // non-empty log to console when checkShaderErrors is on. Off per the
    // production recommendation — real breakage still shows as failed
    // renders, and CI smoke/typecheck cover the code paths.
    this.renderer.debug.checkShaderErrors = false;
    document.body.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x87b7e8);
    this.scene.fog = new THREE.Fog(0x87b7e8, 90, 320);

    this.hemi = new THREE.HemisphereLight(0xbfd9ff, 0x3a5f3a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff3dd, 1.6);
    this.sun.position.set(60, 90, 40);
    // Player-following shadow box: the sun hovers 160 m along the theme's
    // light direction so casters stay inside a tight ~140 m ortho window.
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera;
    sc.left = -70; sc.right = 70; sc.top = 70; sc.bottom = -70;
    sc.near = 40; sc.far = 300;
    this.sun.shadow.bias = -0.0004;
    this.sun.shadow.normalBias = 0.03;
    this.scene.add(this.sun, this.sun.target);

    // WS-MAT: subtle image-based lighting — a PMREM-processed
    // RoomEnvironment gives clearcoat/metal materials gentle reflections so
    // kart paint + trim read as glossy at chase distance. Intensity stays
    // low: enough to open up speculars, not enough to wash the flat-shaded
    // art direction or lift the night circuit's darkness. envRT must stay
    // alive — the env texture lives inside it (RT.dispose would free the
    // texture's GPU object); the one-shot generator + room scene are
    // disposed instead.
    const pmrem = new THREE.PMREMGenerator(this.renderer);
    const roomEnv = new RoomEnvironment();
    this.envRT = pmrem.fromScene(roomEnv, 0.04);
    this.scene.environment = this.envRT.texture;
    this.scene.environmentIntensity = 0.3;
    pmrem.dispose();
    roomEnv.dispose();

    // Build the kart field once (karts persist across track swaps — only
    // the world geometry/race/items/minimap are rebuilt by buildWorld).
    this.scene.add(this.kart.group, this.fx.object, this.sky.group);
    const tints = [0xff9040, 0xc070ff, 0xffd454]; // orange / violet / yellow rivals
    const bots = [botBUrl, botCUrl, undefined]; // Bot B heavy, Bot C speed, Bot A
    const karts = [kartBUrl, kartCUrl, undefined]; // matching chassis
    const lines = [-1.8, 0.8, 2.2]; // each bot takes its own line
    for (let i = 0; i < AI_COUNT; i++) {
      const aiKart = new Kart(tints[i], bots[i], karts[i], this.fx);
      this.aiKarts.push(aiKart);
      // Bot C (index 1, speed archetype) is the shortcut-taker — it dives
      // onto the gravel aprons through the cut zones every lap.
      this.aiDrivers.push(new AiDriver(this.baseSkills[i], lines[i], i === 1));
      this.scene.add(aiKart.group);
    }
    // Restore persisted settings + last-played track.
    try {
      const s = JSON.parse(localStorage.getItem('grok-kart-settings') ?? '{}');
      Object.assign(this.settings, { open: false }, s);
      if (typeof s.track === 'number' && s.track >= 0 && s.track < TRACKS.length) {
        this.trackIdx = s.track;
      }
    } catch {
      /* corrupt/absent storage — defaults stand */
    }
    try {
      const parsed = JSON.parse(
        localStorage.getItem('grok-kart-records') ?? '{}',
      );
      // Per-value validation (critic5 D3): well-formed JSON holding
      // non-numbers ("garbage", -5, null) rendered `rec NaN:00NaN`
      // and bricked the track — `bt < bad` is never true.
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'number' && Number.isFinite(v) && v > 0) {
          this.records[+k] = v;
        }
      }
    } catch {
      /* corrupt/absent — no records yet */
    }
    this.buildWorld(this.trackIdx);
    this.applyDifficulty();

    // Input edges handled here (not in ControlState): title→start, pause,
    // item fire, restart.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      // Key-bind capture: armed from an options key row, the next
      // non-reserved keydown becomes the action's code; Escape cancels.
      // Swallows every key while armed so the captured key can't also
      // fire a game action.
      if (this.bindingCapture) {
        e.preventDefault();
        if (e.code === 'Escape') {
          this.bindingCapture = null;
        } else if (!Game.RESERVED_CODES.has(e.code)) {
          bindKey(this.bindingCapture, e.code);
          this.bindingCapture = null;
        } else {
          // Reserved key — flash a denial so the wait doesn't read as a
          // hang (critic4: rejection was silent).
          this.captureDeniedAt = this.simTime;
        }
        return;
      }
      if (this.race.phase === 'title' && e.code !== 'Backquote') {
        // Title-phase keys: T cycles the track (rebuilds the world), O
        // opens options — everything else starts the race.
        // T cycles the track for single races — no-op while a cup is
        // armed since its circuit order is fixed (PG → SR → NN).
        if (e.code === 'KeyT' && !this.settings.open && !this.gpMode) {
          this.buildWorld((this.trackIdx + 1) % TRACKS.length);
          return;
        }
        // G toggles Grand Prix: the cup always starts at leg 0 on the
        // first circuit; single-race mode uses the selected track.
        if (e.code === 'KeyG' && !this.settings.open) {
          this.gpMode = !this.gpMode;
          this.resetCup();
          if (this.gpMode) this.buildWorld(0);
          return;
        }
        if (e.code === 'KeyO' || (e.code === 'Escape' && this.settings.open)) {
          this.settings.open = !this.settings.open;
        }
        // M toggles reduced motion on the title too — the hint lists it
        // (critic4: advertised but dead there).
        if (e.code === 'KeyM' && !this.settings.open) {
          this.toggleMotion();
          return;
        }
        if (this.settings.open) {
          this.menuKey(e.code);
          return;
        }
        // Only drive/start keys begin the race — Escape/O/T are handled
        // above; a stray Backquote shouldn't skip the title. Bound drive
        // keys count (a remapped throttle still starts the race).
        const START_KEYS = new Set([
          'Enter', 'Space',
          'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight',
          ...BIND_ACTIONS.map((a) => bindings[a]),
        ]);
        if (START_KEYS.has(e.code)) this.race.beginCountdown(this.simTime);
        return;
      }
      // Options menu is MODAL in every play phase (critic D1: it opened
      // during countdown without pausing, and P unpaused under it). While
      // open it consumes all keys; O/Esc/P close back to the paused state.
      if (this.settings.open) {
        if (e.code === 'KeyO' || e.code === 'Escape' || e.code === 'KeyP') {
          this.settings.open = false;
        } else {
          this.menuKey(e.code);
        }
        return;
      }
      if (e.code === 'KeyO') {
        this.settings.open = true;
        this.paused = true; // opening pauses in ANY play phase
        return;
      }
      // Pause works in any play phase (not title — nothing to freeze there).
      // Critic: gating to 'racing' + paused surviving restart = P→R soft-lock.
      if ((e.code === 'KeyP' || e.code === 'Escape') && this.race.phase !== 'title') {
        this.paused = !this.paused;
      }
      if (e.code === 'KeyM') this.toggleMotion();
      if (e.code === bindings.item && !this.paused && this.race.phase === 'racing') {
        this.items.use(
          0,
          this.simTime,
          this.race.racers.map((r) => r.score),
          this.race.racers,
        );
      }
      // Respawn (Backspace): lakitu-style reset onto the racing line at the
      // nearest sample — recovers wall-pinned karts (critic D3).
      if (e.code === 'Backspace' && this.race.phase === 'racing' && !this.paused) {
        const i = this.track.nearestIndexNear(this.kart.position, this.kart.trackIdx);
        const t = this.track.tangentAt(i);
        this.kart.reset(this.track.pointAt(i), Math.atan2(-t.x, -t.z));
      }
      // Quit to title (Q): regrid + title phase, no reload needed (D3).
      if (e.code === 'KeyQ') {
        this.restartRace('title');
      }
      // Grand Prix advance: N on the results screen scores the leg and
      // loads the next circuit (last leg → final standings shown). Gated
      // on !paused — an advance under the PAUSED overlay carried it into
      // the next leg (critic D3: countdown froze behind PAUSED).
      if (e.code === 'KeyN' && this.gpMode && this.race.phase === 'finished' && !this.gpDone && !this.paused) {
        const order = [...this.race.racers.keys()].sort(
          (a, b) => this.race.positionOf(a) - this.race.positionOf(b),
        );
        order.forEach((r, pos) => {
          this.gpPoints[r] += Game.GP_POINTS[pos] ?? 0;
        });
        this.gpLeg++;
        if (this.gpLeg >= TRACKS.length) {
          this.gpDone = true; // stay on results — final standings
          this.paused = false;
        } else {
          this.buildWorld(this.gpLeg);
          this.race.beginCountdown(this.simTime);
        }
        this.paused = false; // a phase transition never carries pause over
      }
      if (e.code === 'KeyR') {
        if (this.gpDone) {
          // Final standings: restart = a fresh cup from leg 1 — replaying
          // a phantom "leg 4" kept the old points frozen on screen.
          this.resetCup();
          this.buildWorld(0);
          this.paused = false;
          this.race.beginCountdown(this.simTime);
        } else {
          this.restartRace();
        }
      }
    });

    this.chaseCam = new ChaseCamera(window.innerWidth / window.innerHeight);
    // Post chain lives in PostFX (bloom/vignette/speed-CA) — render-side
    // only. Needs the live chase camera, so it builds here (WS-POST).
    this.postfx = new PostFX(this.renderer, this.scene, this.chaseCam.camera);
    this.hud = new DebugHud(this.renderer);
    // Apply persisted settings to live systems (loaded pre-buildWorld).
    this.audio.setMasterVolume(this.settings.masterVol);
    this.audio.setMusicVolume(this.settings.musicVol);
    this.chaseCam.reducedMotion = this.settings.reducedMotion;

    initInput();
    // AudioContext unlocks on first trusted gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
      this.postfx.setSize(window.innerWidth, window.innerHeight);
      this.chaseCam.resize(window.innerWidth / window.innerHeight);
    });

    // QA/debug contract (ADR-003): stable introspection for Playwright,
    // chrome-devtools MCP, and critics.
    const game = this;
    (window as unknown as { __game: unknown }).__game = {
      renderer: this.renderer,
      scene: this.scene,
      kart: this.kart,
      aiKarts: this.aiKarts,
      get items() {
        return game.items;
      },
      get track() {
        return game.track;
      },
      get race() {
        return game.race;
      },
      camera: this.chaseCam.camera,
      chaseCam: this.chaseCam,
      postfx: this.postfx,
      audio: this.audio,
      sim: {
        fixedDt: SIM.fixedDt,
        get time() {
          return game.simTime;
        },
      },
    };
  }

  // Rebuild the world for a different track layout: disposes the old track,
  // items, and minimap; re-grids the karts; resets the race to title.
  private buildWorld(idx: number): void {
    this.trackIdx = idx;
    if (this.track) {
      this.scene.remove(this.track.group);
      this.track.dispose();
      this.scene.remove(this.items.group);
      this.minimap.dispose();
    }
    this.track = new Track(TRACKS[idx]);
    this.scene.add(this.track.group);
    // Per-track ambience: sky dome/fog + lighting rig recolor per theme.
    const th = this.track.theme;
    this.sky.applyTheme(th);
    (this.scene.background as THREE.Color).set(th.sky);
    (this.scene.fog as THREE.Fog).color.set(th.sky);
    if (th.sunPos) this.sunDir.set(...th.sunPos).normalize();
    else this.sunDir.set(60, 90, 40).normalize();
    this.sun.color.set(th.sunColor ?? 0xfff3dd);
    this.sun.intensity = th.sunIntensity ?? 1.6;
    this.hemi.color.set(th.hemiSky ?? 0xbfd9ff);
    this.hemi.groundColor.set(th.hemiGround ?? 0x3a5f3a);
    this.hemi.intensity = th.hemiIntensity ?? 0.9;
    // Env lift: slightly lower on night circuits so the dark mood and neon
    // contrast hold — clearcoat still reads via headlights/neon speculars.
    this.scene.environmentIntensity = th.night ? 0.22 : 0.3;
    // Night circuits run headlights: lamp quads on every kart, a real
    // beam only on the player (one extra light stays cheap).
    this.kart.setNight(!!th.night, true);
    for (const k of this.aiKarts) k.setNight(!!th.night);

    const spawn = this.track.spawn();
    this.kart.reset(spawn.position, spawn.heading);
    const spawnPositions = [spawn.position.clone()];
    for (let i = 0; i < AI_COUNT; i++) {
      const slot = this.track.gridSlot(10 + i * 7, i % 2 === 0 ? 2.2 : -2.2);
      this.aiKarts[i].reset(slot.position, slot.heading);
      this.aiDrivers[i].reset();
      spawnPositions.push(slot.position.clone());
    }
    this.race = new Race(this.track, undefined, 1 + AI_COUNT);
    this.race.restart(spawnPositions, 0, 'title');
    this.items = new Items(this.track, [this.kart, ...this.aiKarts], this.fx);
    this.scene.add(this.items.group);
    this.minimap = new Minimap(this.track);
    this.celebrated.length = 0;
    // A rebuilt world is a new race context — the ★REC badge must not
    // leak across GP legs / cup abandons (critic5 D2).
    this.recordSetThisRace = false;
    this.saveSettings();
  }

  // Shared regrid: restart (fresh countdown) or quit-to-title. Always
  // unfreezes (kills P→R soft-lock) and clears in-flight item state.
  private restartRace(phase?: 'title'): void {
    this.celebrated.length = 0;
    this.paused = false;
    this.settings.open = false;
    if (phase === 'title' && this.gpMode) {
      // Abandoning/finishing a cup → title always re-arms a fresh cup on
      // its first circuit (the G-toggle state itself persists).
      this.resetCup();
      this.buildWorld(0);
      return;
    }
    this.items.reset();
    const s = this.track.spawn();
    this.kart.reset(s.position, s.heading);
    const positions = [s.position.clone()];
    for (let i = 0; i < AI_COUNT; i++) {
      const slot = this.track.gridSlot(10 + i * 7, i % 2 === 0 ? 2.2 : -2.2);
      this.aiKarts[i].reset(slot.position, slot.heading);
      this.aiDrivers[i].reset();
      positions.push(slot.position.clone());
    }
    this.race.restart(positions, this.simTime, phase);
    this.recordSetThisRace = false;
  }

  start(): void {
    this.renderer.setAnimationLoop((ms) => this.frame(ms));
  }

  private frame(ms: number): void {
    const frameDt = this.lastMs === 0 ? 0 : Math.min((ms - this.lastMs) / 1000, SIM.maxFrameDt);
    this.lastMs = ms;

    const input = pollInput();
    // Gamepad buttons → the keyboard action pipeline: held-set diffing
    // dispatches real keydown/keyup so item/pause/menu/GP/respawn all
    // work from a pad with zero parallel handling (critic-adjacent gap:
    // "gamepad support is a later unit").
    const padCodes = pollPadCodes();
    for (const c of padCodes) {
      if (!this.padPrev.has(c)) {
        window.dispatchEvent(new KeyboardEvent('keydown', { code: c }));
      }
    }
    for (const c of this.padPrev) {
      if (!padCodes.has(c)) {
        window.dispatchEvent(new KeyboardEvent('keyup', { code: c }));
      }
    }
    this.padPrev = padCodes;
    if (!this.paused) this.accumulator += frameDt;
    const canDrive = this.race.allowsDrive && !this.paused;
    // Wall-pin discovery aid: throttle held but no real displacement for
    // ~2 s → the HUD points at ⌫/S recovery (critic D4: new players think
    // they're hard-stuck when they never discover the respawn key).
    // Displacement-based (critic5 D4): a fully pinned kart can still
    // *report* ~1.6 m/s against the wall scrub, so speed thresholds
    // defeat the hint exactly when it's needed.
    const moved = this.kart.position.distanceTo(this.stuckPrevPos);
    this.stuckPrevPos.copy(this.kart.position);
    if (canDrive && input.throttle > 0 && !this.kart.isSpinning && moved < 0.02) {
      this.stuckFor += frameDt;
    } else {
      this.stuckFor = 0;
    }
    while (!this.paused && this.accumulator >= SIM.fixedDt) {
      this.kart.update(SIM.fixedDt, canDrive ? input : IDLE, this.track, this.simTime);
      const allKarts = [this.kart, ...this.aiKarts];
      const scores = this.race.racers.map((r) => r.score);
      const racing = this.race.phase === 'racing';
      for (let i = 0; i < this.aiKarts.length; i++) {
        // Rubber-band: trailing AI get a small real pace edge vs the player,
        // runaway leaders ease off — keeps the pack close (critic:
        // processional field, positions rarely swapped).
        const gap = racing ? scores[0] - scores[i + 1] : 0;
        this.aiKarts[i].paceAssist = THREE.MathUtils.clamp(
          gap * AI.rubberBandGain,
          -AI.rubberBandDown,
          AI.rubberBandUp,
        );
        const cs = canDrive ? this.aiDrivers[i].update(this.aiKarts[i], this.track, SIM.fixedDt, allKarts) : IDLE;
        this.aiKarts[i].update(SIM.fixedDt, cs, this.track, this.simTime);
        // AI uses held items on straights at speed — keeps the field lively.
        if (this.items.held[i + 1] && this.aiKarts[i].speed > 18 && Math.random() < 0.4 * SIM.fixedDt) {
          this.items.use(i + 1, this.simTime, scores, this.race.racers);
        }
      }
      this.collideKarts();
      this.items.update(this.simTime, SIM.fixedDt, scores);
      const positions = [this.kart.position, ...this.aiKarts.map((k) => k.position)];
      this.race.update(positions, this.simTime, SIM.fixedDt);
      // Lap record: the player's bestLapTime improves on lap completion —
      // beating the stored record flashes a toast and stars the results.
      const bt = this.race.bestLapTime;
      if (bt > 0 && bt < (this.records[this.trackIdx] ?? Infinity)) {
        this.records[this.trackIdx] = bt;
        this.recordFlashAt = this.simTime;
        this.recordSetThisRace = true;
        localStorage.setItem('grok-kart-records', JSON.stringify(this.records));
      }
      // Finish celebration: confetti fountain the moment each racer crosses.
      const karts = [this.kart, ...this.aiKarts];
      for (let i = 0; i < this.race.racers.length; i++) {
        if (this.race.racers[i].finished && !this.celebrated[i]) {
          this.celebrated[i] = true;
          karts[i].celebrating = true;
          karts[i].finishRank = this.race.positionOf(i);
          karts[i].vfx.confetti(karts[i].position);
        }
      }
      this.simTime += SIM.fixedDt;
      this.accumulator -= SIM.fixedDt;
    }

    // World ambience + feedback: particles/clouds tick on render time,
    // countdown engine revs puff exhaust, the shadow box tracks the player.
    this.fx.update(frameDt);
    this.sky.update(frameDt);
    this.track.tick(this.simTime);
    if (this.race.phase === 'countdown' && Math.random() < 26 * frameDt) {
      const k = [this.kart, ...this.aiKarts][Math.floor(Math.random() * 4)];
      const rear = k.position
        .clone()
        .addScaledVector(k.forward(), -1.4)
        .setY(k.position.y + 0.45);
      this.fx.exhaustPuff(rear, k.velocity);
    }
    this.sun.position
      .copy(this.kart.position)
      .addScaledVector(this.sunDir, 160);
    this.sun.target.position.copy(this.kart.position);

    this.chaseCam.update(frameDt, this.kart, this.race);
    this.hud.tick(frameDt * 1000);
    this.hud.update(this.kart);
    this.raceHud.update(
      this.race,
      this.kart,
      this.simTime,
      this.items.held[0],
      this.paused,
      {
        ...this.settings,
        binds: bindings,
        capture: this.bindingCapture,
        denied: this.simTime - this.captureDeniedAt < 1.2,
      },
      this.track.name,
      {
        mode: this.gpMode,
        leg: this.gpLeg,
        total: TRACKS.length,
        points: this.gpPoints,
        done: this.gpDone,
      },
      this.stuckFor > 2,
      {
        time: this.records[this.trackIdx],
        flash: this.simTime - this.recordFlashAt < 2.5,
        setThisRace: this.recordSetThisRace,
      },
    );
    this.minimap.update(
      [this.kart, ...this.aiKarts],
      this.race.phase !== 'title' && this.settings.minimap,
    );
    this.audio.update(this.kart, this.race, this.simTime, this.aiKarts);
    // Post chain: bloom + grade pass — speed factor drives the top-speed
    // chromatic edge, reducedMotion keeps it fully disengaged (WS-POST).
    this.renderer.info.reset(); // autoReset=false → one count for the whole frame
    this.postfx.render(
      frameDt,
      this.kart.speed / KART.maxSpeed,
      this.chaseCam.reducedMotion,
    );
  }

  // Pairwise circle collision: separate overlap, exchange normal velocity
  // with restitution, light scrub so contact costs momentum. Positions are
  // re-constrained to the track afterwards so a shove can't tunnel a wall.
  private collideKarts(): void {
    const karts = [this.kart, ...this.aiKarts];
    const minDist = KART_RADIUS * 2;
    for (let i = 0; i < karts.length; i++) {
      for (let j = i + 1; j < karts.length; j++) {
        const a = karts[i];
        const b = karts[j];
        const dx = b.position.x - a.position.x;
        const dz = b.position.z - a.position.z;
        const distSq = dx * dx + dz * dz;
        if (distSq >= minDist * minDist || distSq < 1e-9) continue;
        const dist = Math.sqrt(distSq);
        const nx = dx / dist;
        const nz = dz / dist;
        const push = (minDist - dist) * 0.5;
        a.position.x -= nx * push;
        a.position.z -= nz * push;
        b.position.x += nx * push;
        b.position.z += nz * push;
        const rel = (b.velocity.x - a.velocity.x) * nx + (b.velocity.z - a.velocity.z) * nz;
        if (rel < 0) {
          const impulse = (-rel * (1 + RESTITUTION)) / 2;
          a.velocity.x -= nx * impulse;
          a.velocity.z -= nz * impulse;
          b.velocity.x += nx * impulse;
          b.velocity.z += nz * impulse;
          a.velocity.multiplyScalar(0.98);
          b.velocity.multiplyScalar(0.98);
          if (a === this.kart || b === this.kart) this.kart.lastWallHit = this.simTime;
        }
        a.trackIdx = this.track.constrain(a.position, a.trackIdx).index;
        b.trackIdx = this.track.constrain(b.position, b.trackIdx).index;
      }
    }
  }
}
