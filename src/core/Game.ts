import * as THREE from 'three';
import { SIM } from '../config/tuning';
import { initInput, pollInput } from './Input';
import { DebugHud } from './DebugHud';
import { Kart } from '../game/Kart';
import { Track } from '../game/Track';
import { ChaseCamera } from '../game/ChaseCamera';

// Game root: renderer + scene + fixed-timestep sim loop (ADR-003).
// Sim steps at SIM.fixedDt; render happens once per rAF.

export class Game {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly chaseCam: ChaseCamera;
  private readonly hud: DebugHud;
  private readonly track = new Track();
  private readonly kart = new Kart();
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

    this.scene.add(this.track.group, this.kart.group);

    const spawn = this.track.spawn();
    this.kart.reset(spawn.position, spawn.heading);

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
    this.accumulator += frameDt;
    while (this.accumulator >= SIM.fixedDt) {
      this.kart.update(SIM.fixedDt, input, this.track, this.simTime);
      this.simTime += SIM.fixedDt;
      this.accumulator -= SIM.fixedDt;
    }

    this.chaseCam.update(frameDt, this.kart);
    this.hud.tick(frameDt * 1000);
    this.hud.update(this.kart);
    this.renderer.render(this.scene, this.chaseCam.camera);
  }
}
