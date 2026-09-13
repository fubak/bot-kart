import type { WebGLRenderer } from 'three';
import type { Kart } from '../game/Kart';

// Dev instrumentation overlay: FPS, frame time, speed, drive state, renderer
// stats. Toggled with Backquote. Always exposed via window.__game regardless
// of overlay visibility — that handle is the QA contract (ADR-003).

export class DebugHud {
  private readonly el: HTMLDivElement;
  private visible = true;
  private frames = 0;
  private acc = 0;
  private fps = 0;
  private frameMs = 0;
  private worstMs = 0;

  constructor(private readonly renderer: WebGLRenderer) {
    this.el = document.createElement('div');
    this.el.style.cssText =
      'position:fixed;top:10px;left:10px;color:#8ef;background:rgba(10,14,26,.72);' +
      'font:12px/1.5 ui-monospace,monospace;padding:8px 10px;border-radius:6px;' +
      'pointer-events:none;white-space:pre;z-index:10';
    document.body.appendChild(this.el);
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Backquote') {
        this.visible = !this.visible;
        this.el.style.display = this.visible ? 'block' : 'none';
      }
    });
  }

  /** Call once per rendered frame with the frame's wall-clock delta. */
  tick(frameDtMs: number): void {
    this.frames++;
    this.acc += frameDtMs;
    this.worstMs = Math.max(this.worstMs, frameDtMs);
    if (this.acc >= 500) {
      this.fps = (this.frames * 1000) / this.acc;
      this.frameMs = this.acc / this.frames;
      this.frames = 0;
      this.acc = 0;
      this.worstMs = 0;
    }
  }

  update(kart: Kart): void {
    if (!this.visible) return;
    const info = this.renderer.info;
    this.el.textContent =
      `fps ${this.fps.toFixed(0)}  ms ${this.frameMs.toFixed(1)} (worst ${this.worstMs.toFixed(1)})\n` +
      `speed ${(kart.forwardSpeed * 3.6).toFixed(0)} km/h   state ${kart.state}\n` +
      `drift ${kart.driftCharge.toFixed(2)}s   boost ${kart.boostTimer.toFixed(2)}s\n` +
      `draws ${info.render.calls}   tris ${info.render.triangles}\n` +
      `[WASD/arrows] drive   [shift] drift   [\`] hud`;
  }
}
