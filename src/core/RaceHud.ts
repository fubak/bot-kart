import type { Race } from '../game/Race';
import type { Kart } from '../game/Kart';
import { BIND_ACTIONS, BIND_LABELS, bindings, keyName, padConnected } from './Input';

export interface OptionsState {
  open: boolean;
  sel: number;
  masterVol: number;
  musicVol: number;
  difficulty: number;
  reducedMotion: boolean;
  minimap: boolean;
  // Key-rebind rows (Game.MENU_ROWS): current codes + armed capture.
  binds?: Record<string, string>;
  capture?: string | null;
  // True briefly after a reserved key was pressed during capture.
  denied?: boolean;
}

export interface GpState {
  mode: boolean;
  leg: number;
  total: number;
  points: readonly number[];
  done: boolean;
}

export interface RecordInfo {
  time?: number; // standing best-lap record for this track (s)
  flash: boolean; // record was just beaten — show the toast
  setThisRace: boolean; // record was set during this race — star results
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
    this.stuckEl = mk(
      'bottom:96px;left:50%;transform:translateX(-50%);font-size:17px;' +
      'font-weight:800;color:#ffe28a;display:none;text-align:center',
    );
    this.recordEl = mk(
      'bottom:64px;left:50%;transform:translateX(-50%);font-size:24px;' +
      'font-weight:900;color:#ffd454;display:none;text-align:center',
    );
    this.recordEl.textContent = '★ NEW LAP RECORD!';
    this.stuckEl.innerHTML =
      'STUCK? &nbsp;⌫ respawn &nbsp;·&nbsp; S reverse';
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
      `Q — quit &nbsp;·&nbsp; ⌫ — respawn<br>` +
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
  private readonly stuckEl: HTMLDivElement;
  private readonly recordEl: HTMLDivElement;
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
    gp?: GpState,
    stuckHint = false,
    record?: RecordInfo,
  ): void {
    // Options overlay renders in every phase (openable from pause or title).
    if (opts?.open) {
      const bar = (v: number) =>
        '█'.repeat(Math.round(v * 10)).padEnd(10, '░');
      const DIFFS = ['EASY', 'NORMAL', 'HARD'];
      const rows = [
        `MASTER VOL  ${bar(opts.masterVol)} ${Math.round(opts.masterVol * 10)}`,
        `MUSIC VOL   ${bar(opts.musicVol)} ${Math.round(opts.musicVol * 10)}`,
        `DIFFICULTY            ${DIFFS[opts.difficulty] ?? 'NORMAL'}`,
        `REDUCED MOTION        ${opts.reducedMotion ? 'ON' : 'OFF'}`,
        `MINIMAP               ${opts.minimap ? 'ON' : 'OFF'}`,
        ...BIND_ACTIONS.map(
          (a) =>
            `${BIND_LABELS[a].padEnd(20)}${
              opts.capture === a
                ? opts.denied
                  ? 'NOT A DRIVE KEY'
                  : 'PRESS KEY…'
                : keyName(opts.binds?.[a] ?? '')
            }`,
        ),
        'RESET BINDINGS',
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
        (opts.capture
          ? `press a key — Esc cancels`
          : `↑↓ select · ←→ adjust · →/Enter rebind · O close`) +
        `</div>`;
      this.optionsEl.style.display = 'block';
    } else {
      this.optionsEl.style.display = 'none';
    }
    this.titleEl.style.display = race.phase === 'title' ? 'block' : 'none';
    if (race.phase === 'title') {
      // Track + mode line under PRESS ENTER (children[3]) — plus the
      // standing lap record for the selected circuit.
      (this.titleEl.children[3] as HTMLElement).textContent =
        trackName
          ? `◂ ${trackName} ▸  [T]      ${gp?.mode ? `GRAND PRIX — leg ${Math.min(gp.leg + 1, gp.total)}/${gp.total}` : '1 RACE'}  [G]` +
            (record?.time ? `    rec ${fmt(record.time)}` : '')
          : '';
      // Controls hint (children[4]) follows the live bindings — a remapped
      // drive key must not leave the title advertising WASD (critic4).
      const hint =
        `${keyName(bindings.throttle)}${keyName(bindings.left)}` +
        `${keyName(bindings.brake)}${keyName(bindings.right)} / arrows — drive ` +
        `&nbsp;·&nbsp; ${keyName(bindings.drift)} — drift &nbsp;·&nbsp; ` +
        `${keyName(bindings.item)} — item &nbsp;·&nbsp; P — pause &nbsp;·&nbsp; ` +
        `R — restart &nbsp;·&nbsp; Q — quit &nbsp;·&nbsp; ⌫ — respawn<br>` +
        `M — reduce motion &nbsp;·&nbsp; O — options &nbsp;·&nbsp; T — track` +
        (padConnected()
          ? `<br>🎮 stick / RT·LT drive &nbsp;·&nbsp; A go &nbsp;·&nbsp; Y item &nbsp;·&nbsp; Start pause`
          : '');
      const hintEl = this.titleEl.children[4] as HTMLElement;
      if (hintEl.innerHTML !== hint) hintEl.innerHTML = hint;
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
      this.recordEl.style.display = 'none';
      return;
    }
    // PAUSED hides under the options panel — both translucent overlays
    // stacked read untidy (critic4).
    this.pauseEl.style.display = paused && !opts?.open ? 'block' : 'none';
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
        : `${gp?.mode && !gp.done ? `GP ${gp.leg + 1}/${gp.total} · ` : ''}` +
          `LAP ${Math.min(race.lap, race.totalLaps)}/${race.totalLaps}   P${pos}/${race.racers.length}`;

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
    // Hint text follows the live bindings — a remapped brake key must not
    // leave the hint telling the player to hold S (critic4).
    this.stuckEl.innerHTML =
      `STUCK? &nbsp;⌫ respawn &nbsp;·&nbsp; ${keyName(bindings.brake)} reverse`;
    this.stuckEl.style.display =
      !paused && stuckHint && race.phase === 'racing' ? 'block' : 'none';
    this.recordEl.style.display =
      !paused && record?.flash && race.phase !== 'countdown' ? 'block' : 'none';
    // Held-item readout: colored glyph badge + name — readable at a glance.
    const ITEM_GLYPHS: Record<string, [string, string]> = {
      boost: ['⚡', '#ffd454'],
      missile: ['✹', '#ff5a3c'],
      slick: ['◍', '#8a8f96'],
      shield: ['◯', '#7be8ff'],
      ink: ['✦', '#c070ff'],
      swap: ['⇄', '#7dff8a'],
    };
    if (race.phase === 'racing' && heldItem) {
      const [glyph, color] = ITEM_GLYPHS[heldItem] ?? ['●', '#fff'];
      this.itemEl.innerHTML =
        `<span style="color:${color};font-size:26px">${glyph}</span> ` +
        `${heldItem.toUpperCase()} <span style="color:#9fb4d0;font-size:14px">` +
        `[${keyName(bindings.item)}]</span>`;
    } else {
      this.itemEl.textContent = '';
    }

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
        // Grand Prix final leg: rank by cup points, crown the champion.
        const gpFinal = gp?.mode && gp.done;
        const dispOrder = gpFinal
          ? [...race.racers.keys()].sort((a, b) => gp.points[b] - gp.points[a])
          : order;
        // Points are awarded on the N-press, so a leg's results screen
        // shows "earned this leg → running total" (critic D5: leg-1 read
        // "0 pts"). Table mirrors Game.GP_POINTS.
        const GP_PTS = [10, 7, 5, 3];
        const rows = dispOrder
          .map((r, i) => {
            const rr = race.racers[r];
            const time = rr.finished ? fmt(rr.finishTime - race.raceStart) : '…';
            const best =
              fmt(rr.bestLapTime) +
              (r === 0 && record?.setThisRace ? ' ★REC' : '');
            const cls = r === 0 ? ' style="color:#7be8ff"' : '';
            let pts = '';
            if (gp?.mode) {
              if (gp.done) {
                pts = `   ${gp.points[r]} pts`;
              } else {
                const earned = rr.finished
                  ? (GP_PTS[race.positionOf(r) - 1] ?? 0)
                  : 0;
                pts = `   +${earned} → ${gp.points[r] + earned} pts`;
              }
            }
            const crown = gpFinal && i === 0 ? ' ★' : '';
            return `<div${cls}>P${i + 1}${crown}  ${names[r] ?? 'BOT-' + r}   ${time}   best ${best}${pts}</div>`;
          })
          .join('');
        const footer = gp?.mode
          ? gp.done
            ? `[R] restart &nbsp;·&nbsp; [Q] title`
            : `[N] next race &nbsp;·&nbsp; [Q] abandon cup`
          : `[R] restart &nbsp;·&nbsp; [Q] title`;
        this.resultsEl.innerHTML =
          `<div style="font-size:30px;font-weight:900;margin-bottom:10px">` +
          `${gpFinal ? 'FINAL STANDINGS' : 'RESULTS'}${gp?.mode && !gp.done ? ` — leg ${gp.leg + 1}/${gp.total}` : ''}</div>` +
          rows +
          `<div style="margin-top:12px;font-size:15px;color:#9fb4d0">${footer}</div>`;
      }
    } else {
      this.resultsEl.style.display = 'none';
    }
    this.inkEl.style.display =
      kart.inked && race.phase === 'racing' && !paused ? 'block' : 'none';
  }
}
