import type { Race } from '../game/Race';
import type { Kart } from '../game/Kart';

export interface OptionsState {
  open: boolean;
  sel: number;
  masterVol: number;
  musicVol: number;
  reducedMotion: boolean;
  minimap: boolean;
}

// Player-facing race HUD: countdown numbers, lap counter, running/best lap
// times, wrong-way warning, finish banner. DOM overlay (cheap, accessible).
// Separate from DebugHud — this is part of the game UI, not dev tooling.

function fmt(t: number): string {
  if (t <= 0) return '--:--.--';
  const m = Math.floor(t / 60);
  const s = t - m * 60;
  return `${m}:${s.toFixed(2).padStart(5, '0')}`;
}

export class RaceHud {
  private readonly center: HTMLDivElement;
  private readonly lapEl: HTMLDivElement;
  private readonly timesEl: HTMLDivElement;
  private readonly warnEl: HTMLDivElement;

  constructor() {
    const mk = (css: string) => {
      const el = document.createElement('div');
      el.style.cssText = css + ';pointer-events:none;z-index:11;position:fixed;' +
        'font-family:ui-monospace,monospace;text-shadow:0 2px 6px rgba(0,0,0,.55)';
      document.body.appendChild(el);
      return el;
    };
    this.center = mk(
      'top:32%;left:50%;transform:translate(-50%,-50%);font-size:110px;' +
      'font-weight:900;color:#fff;letter-spacing:.04em',
    );
    this.lapEl = mk(
      'top:14px;right:18px;font-size:30px;font-weight:800;color:#fff',
    );
    this.timesEl = mk(
      'top:56px;right:18px;font-size:15px;color:#dfeeff;text-align:right;line-height:1.6',
    );
    this.warnEl = mk(
      'top:58%;left:50%;transform:translateX(-50%);font-size:30px;' +
      'font-weight:800;color:#ff5a3c;display:none',
    );
    this.warnEl.textContent = 'WRONG WAY';
    this.itemEl = mk(
      'bottom:24px;right:18px;font-size:22px;font-weight:800;color:#7be8ff',
    );
    this.resultsEl = mk(
      'top:50%;left:50%;transform:translate(-50%,-50%);font-size:22px;' +
      'font-weight:700;color:#fff;background:rgba(10,16,28,.82);padding:22px 34px;' +
      'border-radius:10px;display:none;text-align:left;line-height:1.9;min-width:320px',
    );
    this.titleEl = mk(
      'top:50%;left:50%;transform:translate(-50%,-50%);text-align:center;' +
      'color:#fff;display:none',
    );
    this.titleEl.innerHTML =
      `<div style="font-size:64px;font-weight:900;letter-spacing:.06em;` +
      `background:linear-gradient(180deg,#fff,#7be8ff);-webkit-background-clip:text;` +
      `-webkit-text-fill-color:transparent">GROK KART</div>` +
      `<div style="font-size:15px;color:#9fb4d0;margin-top:6px">a grok bots racing game</div>` +
      `<div style="font-size:26px;font-weight:800;margin-top:26px;color:#ffe28a">` +
      `PRESS ENTER</div>` +
      `<div style="font-size:16px;font-weight:800;margin-top:12px;color:#7be8ff"></div>` +
      `<div style="font-size:13px;color:#9fb4d0;margin-top:14px;line-height:1.8">` +
      `WASD / arrows — drive &nbsp;·&nbsp; SHIFT — drift &nbsp;·&nbsp; ` +
      `SPACE — item &nbsp;·&nbsp; P — pause &nbsp;·&nbsp; R — restart &nbsp;·&nbsp; ` +
      `M — reduce motion &nbsp;·&nbsp; O — options &nbsp;·&nbsp; T — track</div>`;
    this.pauseEl = mk(
      'top:50%;left:50%;transform:translate(-50%,-50%);font-size:42px;' +
      'font-weight:900;color:#fff;display:none;text-align:center',
    );
    this.pauseEl.innerHTML =
      'PAUSED<div style="font-size:15px;color:#9fb4d0;margin-top:8px">P / Esc to resume</div>';
    this.optionsEl = mk(
      'top:50%;left:50%;transform:translate(-50%,-50%);font-size:19px;' +
      'font-weight:700;color:#fff;background:rgba(10,16,28,.85);padding:20px 30px;' +
      'border-radius:10px;display:none;line-height:2.1;min-width:340px',
    );
    // Ink splat: fullscreen blobs while the player is inked — vision denial
    // reads instantly without touching the renderer.
    this.inkEl = mk(
      'inset:0;display:none;background:' +
        'radial-gradient(circle at 24% 30%, rgba(12,10,20,.88) 0 9%, transparent 12%),' +
        'radial-gradient(circle at 68% 22%, rgba(12,10,20,.85) 0 12%, transparent 15%),' +
        'radial-gradient(circle at 48% 62%, rgba(12,10,20,.9) 0 14%, transparent 17%),' +
        'radial-gradient(circle at 82% 66%, rgba(12,10,20,.8) 0 8%, transparent 11%),' +
        'radial-gradient(circle at 14% 74%, rgba(12,10,20,.82) 0 10%, transparent 13%);' +
        'transition:opacity .3s',
    );
  }

  private readonly itemEl: HTMLDivElement;
  private readonly resultsEl: HTMLDivElement;
  private readonly titleEl: HTMLDivElement;
  private readonly pauseEl: HTMLDivElement;
  private readonly inkEl: HTMLDivElement;
  private readonly optionsEl: HTMLDivElement;
  private resultsRenderedAt = -1;
  private titlePulseAt = 0;

  update(
    race: Race,
    kart: Kart,
    simTime: number,
    heldItem?: string | null,
    paused = false,
    opts?: OptionsState,
    trackName?: string,
  ): void {
    // Options overlay renders in every phase (openable from pause or title).
    if (opts?.open) {
      const bar = (v: number) =>
        '█'.repeat(Math.round(v * 10)).padEnd(10, '░');
      const rows = [
        `MASTER VOL  ${bar(opts.masterVol)} ${Math.round(opts.masterVol * 10)}`,
        `MUSIC VOL   ${bar(opts.musicVol)} ${Math.round(opts.musicVol * 10)}`,
        `REDUCED MOTION        ${opts.reducedMotion ? 'ON' : 'OFF'}`,
        `MINIMAP               ${opts.minimap ? 'ON' : 'OFF'}`,
      ];
      this.optionsEl.innerHTML =
        `<div style="font-size:24px;font-weight:900;margin-bottom:8px">OPTIONS</div>` +
        rows
          .map(
            (r, i) =>
              `<div style="${i === opts.sel ? 'color:#7be8ff' : 'color:#fff'}">` +
              `${i === opts.sel ? '▸ ' : '&nbsp;&nbsp;'}${r}</div>`,
          )
          .join('') +
        `<div style="margin-top:10px;font-size:13px;color:#9fb4d0">` +
        `↑↓ select · ←→ adjust · O close</div>`;
      this.optionsEl.style.display = 'block';
    } else {
      this.optionsEl.style.display = 'none';
    }
    this.titleEl.style.display = race.phase === 'title' ? 'block' : 'none';
    if (race.phase === 'title') {
      // Track line under PRESS ENTER (children[3]).
      (this.titleEl.children[3] as HTMLElement).textContent =
        trackName ? `◂ ${trackName} ▸   [T]` : '';
      // Gentle pulse on PRESS ENTER — cheap DOM animation, no rAF needed.
      if (simTime - this.titlePulseAt > 0.06) {
        this.titlePulseAt = simTime;
        const a = 0.55 + 0.45 * Math.sin(simTime * 3.2);
        const press = this.titleEl.children[2] as HTMLElement;
        press.style.opacity = a.toFixed(2);
      }
      this.center.textContent = '';
      this.lapEl.textContent = '';
      this.timesEl.innerHTML = '';
      this.itemEl.textContent = '';
      this.warnEl.style.display = 'none';
      this.resultsEl.style.display = 'none';
      this.pauseEl.style.display = 'none';
      return;
    }
    this.pauseEl.style.display = paused ? 'block' : 'none';
    const justFinished =
      race.phase === 'finished' && simTime - race.player.finishTime < 1.5;
    this.center.textContent =
      race.phase === 'finished'
        ? justFinished
          ? 'FINISH'
          : ''
        : race.countdownLabel;
    const pos = race.positionOf(0);
    this.lapEl.textContent =
      race.phase === 'countdown'
        ? ''
        : `LAP ${Math.min(race.lap, race.totalLaps)}/${race.totalLaps}   P${pos}/${race.racers.length}`;

    const cur =
      race.phase === 'finished'
        ? race.lastLapTime
        : race.phase === 'racing'
          ? simTime - race.lapStart
          : 0;
    this.timesEl.innerHTML =
      `TIME ${fmt(race.raceTime)}<br>` +
      `LAP&nbsp;&nbsp;${fmt(cur)}<br>` +
      `LAST&nbsp;${fmt(race.lastLapTime)}<br>` +
      `BEST&nbsp;${fmt(race.bestLapTime)}`;

    this.warnEl.style.display =
      !paused && race.wrongWay && race.phase === 'racing' ? 'block' : 'none';
    this.itemEl.textContent =
      race.phase === 'racing' && heldItem ? `${heldItem.toUpperCase()} [space]` : '';

    // Results table: re-renders at 2 Hz while finished so late finishers
    // update — the one-shot latch froze still-racing rivals as "DNF"
    // (critic: winning showed all rivals DNF forever).
    if (race.phase === 'finished') {
      this.resultsEl.style.display = 'block';
      if (simTime - this.resultsRenderedAt > 0.5) {
        this.resultsRenderedAt = simTime;
        const order = [...race.racers.keys()].sort(
          (a, b) => race.positionOf(a) - race.positionOf(b),
        );
        const names = ['YOU', 'BOT-B', 'BOT-C', 'BOT-A2'];
        const rows = order
          .map((r, i) => {
            const rr = race.racers[r];
            const time = rr.finished ? fmt(rr.finishTime - race.raceStart) : '…';
            const best = fmt(rr.bestLapTime);
            const cls = r === 0 ? ' style="color:#7be8ff"' : '';
            return `<div${cls}>P${i + 1}  ${names[r] ?? 'BOT-' + r}   ${time}   best ${best}</div>`;
          })
          .join('');
        this.resultsEl.innerHTML =
          `<div style="font-size:30px;font-weight:900;margin-bottom:10px">RESULTS</div>` +
          rows +
          `<div style="margin-top:12px;font-size:15px;color:#9fb4d0">[R] restart</div>`;
      }
    } else {
      this.resultsEl.style.display = 'none';
    }
    this.inkEl.style.display =
      kart.inked && race.phase === 'racing' && !paused ? 'block' : 'none';
  }
}
