import * as THREE from 'three';
import { SIM } from '../config/tuning';
import { initInput, pollInput } from './Input';
import { DebugHud } from './DebugHud';
import { Kart } from '../game/Kart';
import { Track } from '../game/Track';
import { ChaseCamera } from '../game/ChaseCamera';
import { Race } from '../game/Race';
import { RaceHud } from './RaceHud';
import type { ControlState } from './Input';

// Game root: renderer + scene + fixed-timestep sim loop (ADR-003).
// Sim steps at SIM.fixedDt; render happens once per rAF.

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly chaseCam: ChaseCamera;
  private readonly hud: DebugHud;
  private readonly track = new Track();
  private readonly kart = new Kart();
  private readonly race: Race;
  private readonly raceHud = new RaceHud();
  private accumulator = 0;
  private lastMs = 0;
  private simTime = 0;

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

    const spawn = this.track.spawn();
    this.kart.reset(spawn.position, spawn.heading);
    this.race = new Race(this.track);
    this.race.restart(spawn.position, 0);

    // R = restart race (input-edge handled here, not in ControlState).
    window.addEventListener('keydown', (e) => {
      if (e.code === 'KeyR' && !e.repeat) {
        const s = this.track.spawn();
        this.kart.reset(s.position, s.heading);
        this.race.restart(s.position, this.simTime);
      }
    });

    this.chaseCam = new ChaseCamera(window.innerWidth / window.innerHeight);
    this.hud = new DebugHud(this.renderer);

    initInput();
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
      track: this.track,
      race: this.race,
      camera: this.chaseCam.camera,
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
    const driveInput: ControlState = this.race.allowsDrive
      ? input
      : { throttle: 0, brake: 0, steer: 0, drift: false };
    this.accumulator += frameDt;
    while (this.accumulator >= SIM.fixedDt) {
      this.kart.update(SIM.fixedDt, driveInput, this.track, this.simTime);
      this.race.update(this.kart.position, this.simTime, SIM.fixedDt);
      this.simTime += SIM.fixedDt;
      this.accumulator -= SIM.fixedDt;
    }

    this.chaseCam.update(frameDt, this.kart);
    this.hud.tick(frameDt * 1000);
    this.hud.update(this.kart);
    this.raceHud.update(this.race, this.kart, this.simTime);
    this.renderer.render(this.scene, this.chaseCam.camera);
  }
}
