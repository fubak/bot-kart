import type { Race } from '../game/Race';
import type { Kart } from '../game/Kart';

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
  }

  private readonly itemEl: HTMLDivElement;
  private readonly resultsEl: HTMLDivElement;
  private resultsShown = false;

  update(race: Race, kart: Kart, simTime: number, heldItem?: string | null): void {
    if (race.phase !== 'finished') this.resultsShown = false;
    this.center.textContent =
      race.phase === 'finished'
        ? 'FINISH'
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

    this.warnEl.style.display = race.wrongWay && race.phase === 'racing' ? 'block' : 'none';
    this.itemEl.textContent =
      race.phase === 'racing' && heldItem ? `${heldItem.toUpperCase()} [space]` : '';

    // Results table: ranks everyone — finishers by time, unfinished by score.
    if (race.phase === 'finished' && !this.resultsShown) {
      this.resultsShown = true;
      const order = [...race.racers.keys()].sort(
        (a, b) => race.positionOf(a) - race.positionOf(b),
      );
      const names = ['YOU', 'BOT-B', 'BOT-C', 'BOT-A2'];
      const rows = order
        .map((r, i) => {
          const rr = race.racers[r];
          const time = rr.finished ? fmt(rr.finishTime - race.raceStart) : 'DNF';
          const best = fmt(rr.bestLapTime);
          const cls = r === 0 ? ' style="color:#7be8ff"' : '';
          return `<div${cls}>P${i + 1}  ${names[r] ?? 'BOT-' + r}   ${time}   best ${best}</div>`;
        })
        .join('');
      this.resultsEl.innerHTML =
        `<div style="font-size:30px;font-weight:900;margin-bottom:10px">RESULTS</div>` +
        rows +
        `<div style="margin-top:12px;font-size:15px;color:#9fb4d0">[R] restart</div>`;
      this.resultsEl.style.display = 'block';
    }
    if (race.phase !== 'finished') this.resultsEl.style.display = 'none';
    void kart;
  }
}
