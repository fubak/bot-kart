import * as THREE from 'three';
import { AI, SIM } from '../config/tuning';
import { initInput, pollInput } from './Input';
import { DebugHud } from './DebugHud';
import { Kart } from '../game/Kart';
import { Track } from '../game/Track';
import { ChaseCamera } from '../game/ChaseCamera';
import { Race } from '../game/Race';
import { RaceHud } from './RaceHud';
import { Audio } from './Audio';
import { AiDriver } from '../game/AiDriver';
import { Items } from '../game/Items';
import { Minimap } from './Minimap';
import botBUrl from '../../assets/exported/characters/grokbot-b-seated.glb?url';
import botCUrl from '../../assets/exported/characters/grokbot-c-seated.glb?url';
import kartBUrl from '../../assets/exported/karts/kart-b.glb?url';
import kartCUrl from '../../assets/exported/karts/kart-c.glb?url';
import type { ControlState } from './Input';

const IDLE: ControlState = { throttle: 0, brake: 0, steer: 0, drift: false };
const AI_COUNT = 3; // rival bots on the grid
const KART_RADIUS = 1.35; // m — collision circle for kart-vs-kart
const RESTITUTION = 0.35; // bounciness of kart contact

// Game root: renderer + scene + fixed-timestep sim loop (ADR-003).
// Sim steps at SIM.fixedDt; render happens once per rAF.

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly chaseCam: ChaseCamera;
  private readonly hud: DebugHud;
  private readonly track = new Track();
  private readonly kart = new Kart();
  private readonly aiKarts: Kart[] = [];
  private readonly aiDrivers: AiDriver[] = [];
  private items!: Items;
  private minimap!: Minimap;
  private readonly race: Race;
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
    reducedMotion: false,
    minimap: true,
  };

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
      s.reducedMotion = !s.reducedMotion;
      this.chaseCam.reducedMotion = s.reducedMotion;
    } else {
      s.minimap = !s.minimap;
    }
  }
  private readonly celebrated: boolean[] = []; // per-racer finish confetti fired

  constructor() {
    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    document.body.appendChild(this.renderer.domElement);

    this.scene.background = new THREE.Color(0x87b7e8);
    this.scene.fog = new THREE.Fog(0x87b7e8, 90, 320);

    this.scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x3a5f3a, 0.9));
    const sun = new THREE.DirectionalLight(0xfff3dd, 1.6);
    sun.position.set(60, 90, 40);
    this.scene.add(sun);

    this.scene.add(this.track.group, this.kart.group, this.kart.vfx.object);

    // Grid: player at the spawn slot; AI bots staggered behind, alternating
    // lateral offset. Different skills → visibly different pace/personality.
    const spawn = this.track.spawn();
    this.kart.reset(spawn.position, spawn.heading);
    const spawnPositions = [spawn.position.clone()];
    // Skill maps to archetype: Bot B heavy = slower, Bot C speed = fastest.
    const skills = [0.95, 1.05, 1.0];
    const tints = [0xff9040, 0xc070ff, 0xffd454]; // orange / violet / yellow rivals
    const bots = [botBUrl, botCUrl, undefined]; // Bot B heavy, Bot C speed, Bot A
    const karts = [kartBUrl, kartCUrl, undefined]; // matching chassis
    const lines = [-1.8, 0.8, 2.2]; // each bot takes its own line
    for (let i = 0; i < AI_COUNT; i++) {
      const slot = this.track.gridSlot(10 + i * 7, i % 2 === 0 ? 2.2 : -2.2);
      const aiKart = new Kart(tints[i], bots[i], karts[i]);
      aiKart.reset(slot.position, slot.heading);
      this.aiKarts.push(aiKart);
      // Bot C (index 1, speed archetype) is the shortcut-taker — it dives
      // onto the gravel aprons through the cut zones every lap.
      this.aiDrivers.push(new AiDriver(skills[i], lines[i], i === 1));
      this.scene.add(aiKart.group, aiKart.vfx.object);
      spawnPositions.push(slot.position.clone());
    }
    this.race = new Race(this.track, undefined, 1 + AI_COUNT);
    this.race.restart(spawnPositions, 0, 'title');
    this.items = new Items(this.track, [this.kart, ...this.aiKarts]);
    this.scene.add(this.items.group);
    this.minimap = new Minimap(this.track);

    // Input edges handled here (not in ControlState): title→start, pause,
    // item fire, restart.
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      if (this.race.phase === 'title' && e.code !== 'Backquote') {
        this.race.beginCountdown(this.simTime);
        return;
      }
      // Pause works in any play phase (not title — nothing to freeze there).
      // Critic: gating to 'racing' + paused surviving restart = P→R soft-lock.
      if ((e.code === 'KeyP' || e.code === 'Escape') && this.race.phase !== 'title') {
        this.paused = !this.paused;
      }
      if (e.code === 'KeyM') {
        this.chaseCam.reducedMotion = !this.chaseCam.reducedMotion;
        this.settings.reducedMotion = this.chaseCam.reducedMotion;
      }
      // Options menu: O opens/closes; arrows navigate/adjust while open.
      // Opening mid-race pauses the sim (genre-standard pause submenu).
      if (e.code === 'KeyO') {
        this.settings.open = !this.settings.open;
        if (this.settings.open && this.race.phase === 'racing') this.paused = true;
      }
      if (this.settings.open) {
        if (e.code === 'ArrowUp') this.settings.sel = (this.settings.sel + 3) % 4;
        if (e.code === 'ArrowDown') this.settings.sel = (this.settings.sel + 1) % 4;
        const dir = e.code === 'ArrowLeft' ? -1 : e.code === 'ArrowRight' ? 1 : 0;
        if (dir !== 0) this.adjustSetting(dir);
      }
      if (e.code === 'Space' && !this.paused) {
        this.items.use(0, this.simTime, this.race.racers.map((r) => r.score));
      }
      if (e.code === 'KeyR') {
        this.celebrated.length = 0;
        this.paused = false; // restart always unfreezes (kills P→R soft-lock)
        const s = this.track.spawn();
        this.kart.reset(s.position, s.heading);
        const positions = [s.position.clone()];
        for (let i = 0; i < AI_COUNT; i++) {
          const slot = this.track.gridSlot(10 + i * 7, i % 2 === 0 ? 2.2 : -2.2);
          this.aiKarts[i].reset(slot.position, slot.heading);
          this.aiDrivers[i].reset();
          positions.push(slot.position.clone());
        }
        this.race.restart(positions, this.simTime);
      }
    });

    this.chaseCam = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.hud = new DebugHud(this.renderer);

    initInput();
    // AudioContext unlocks on first trusted gesture.
    const unlock = () => this.audio.unlock();
    window.addEventListener('keydown', unlock, { once: false });
    window.addEventListener('pointerdown', unlock, { once: false });
    window.addEventListener('resize', () => {
      this.renderer.setSize(window.innerWidth, window.innerHeight);
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
      items: this.items,
      track: this.track,
      race: this.race,
      camera: this.chaseCam.camera,
      chaseCam: this.chaseCam,
      audio: this.audio,
      sim: {
        fixedDt: SIM.fixedDt,
        get time() {
          return game.simTime;
        },
      },
    };
  }

  start(): void {
    this.renderer.setAnimationLoop((ms) => this.frame(ms));
  }

  private frame(ms: number): void {
    const frameDt = this.lastMs === 0 ? 0 : Math.min((ms - this.lastMs) / 1000, SIM.maxFrameDt);
    this.lastMs = ms;

    const input = pollInput();
    if (!this.paused) this.accumulator += frameDt;
    const canDrive = this.race.allowsDrive && !this.paused;
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
          this.items.use(i + 1, this.simTime, scores);
        }
      }
      this.collideKarts();
      this.items.update(this.simTime, SIM.fixedDt, scores);
      const positions = [this.kart.position, ...this.aiKarts.map((k) => k.position)];
      this.race.update(positions, this.simTime, SIM.fixedDt);
      // Finish celebration: confetti fountain the moment each racer crosses.
      const karts = [this.kart, ...this.aiKarts];
      for (let i = 0; i < this.race.racers.length; i++) {
        if (this.race.racers[i].finished && !this.celebrated[i]) {
          this.celebrated[i] = true;
          karts[i].celebrating = true;
          karts[i].vfx.confetti(karts[i].position);
        }
      }
      this.simTime += SIM.fixedDt;
      this.accumulator -= SIM.fixedDt;
    }

    this.chaseCam.update(frameDt, this.kart, this.race);
    this.hud.tick(frameDt * 1000);
    this.hud.update(this.kart);
    this.raceHud.update(
      this.race,
      this.kart,
      this.simTime,
      this.items.held[0],
      this.paused,
      this.settings,
    );
    this.minimap.update(
      [this.kart, ...this.aiKarts],
      this.race.phase !== 'title' && this.settings.minimap,
    );
    this.audio.update(this.kart, this.race, this.simTime, this.aiKarts);
    this.renderer.render(this.scene, this.chaseCam.camera);
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
        this.track.constrain(a.position);
        this.track.constrain(b.position);
      }
    }
  }
}
