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
      'top:41%;left:50%;transform:translate(-50%,-50%);text-align:center;' +
      'color:#fff;display:none;background:rgba(7,11,20,.42);padding:20px 46px;' +
      'border-radius:16px',
    );
    this.titleEl.innerHTML =
      `<div style="font-size:64px;font-weight:900;letter-spacing:.06em;` +
      `background:linear-gradient(180deg,#fff,#7be8ff);-webkit-background-clip:text;` +
      `-webkit-text-fill-color:transparent">GROK KART</div>` +
      `<div style="font-size:15px;color:#c9d8ec;margin-top:6px">a grok bots racing game</div>` +
      `<div style="font-size:26px;font-weight:800;margin-top:26px;color:#ffe28a">` +
      `PRESS ENTER</div>` +
      `<div style="font-size:16px;font-weight:800;margin-top:12px;color:#7be8ff"></div>` +
      `<div style="font-size:13px;color:#9fb4d0;margin-top:14px;line-height:1.8">` +
      `<span style="white-space:nowrap">WASD / arrows — drive</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">SHIFT — drift</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">SPACE — item</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">P — pause</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">R — restart</span><br>` +
      `<span style="white-space:nowrap">Q — quit</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">⌫ — respawn</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">M — reduce motion</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">O — options</span> &nbsp;·&nbsp; ` +
      `<span style="white-space:nowrap">T — track</span></div>`;
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
    // reads instantly without touching the renderer. Organic splats, not
    // flat discs (critic9): each blot is 2-3 overlapping ellipses with a
    // hot core + feathered edge, plus droplet specks and two drip runs.
    this.inkEl = mk(
      'inset:0;display:none;background:' +
        // main blots — irregular overlapping ellipses, dark core → soft rim
        'radial-gradient(ellipse 15% 11% at 24% 29%, rgba(9,7,15,.94) 0 55%, rgba(9,7,15,.6) 72%, transparent 95%),' +
        'radial-gradient(ellipse 9% 13% at 17% 37%, rgba(9,7,15,.9) 0 58%, transparent 92%),' +
        'radial-gradient(ellipse 7% 5% at 32% 23%, rgba(9,7,15,.85) 0 62%, transparent 94%),' +
        'radial-gradient(ellipse 16% 12% at 67% 20%, rgba(9,7,15,.92) 0 55%, rgba(9,7,15,.55) 74%, transparent 96%),' +
        'radial-gradient(ellipse 8% 9% at 76% 28%, rgba(9,7,15,.88) 0 60%, transparent 93%),' +
        'radial-gradient(ellipse 18% 13% at 50% 60%, rgba(8,6,14,.94) 0 55%, rgba(8,6,14,.55) 75%, transparent 96%),' +
        'radial-gradient(ellipse 9% 8% at 41% 69%, rgba(9,7,15,.88) 0 60%, transparent 93%),' +
        'radial-gradient(ellipse 12% 9% at 84% 63%, rgba(9,7,15,.88) 0 58%, transparent 93%),' +
        'radial-gradient(ellipse 6% 7% at 89% 55%, rgba(9,7,15,.8) 0 60%, transparent 92%),' +
        'radial-gradient(ellipse 13% 10% at 13% 74%, rgba(9,7,15,.9) 0 58%, transparent 93%),' +
        'radial-gradient(ellipse 5% 6% at 23% 82%, rgba(9,7,15,.8) 0 60%, transparent 92%),' +
        // drips running off the two biggest blots
        'radial-gradient(ellipse 2.2% 9% at 51% 74%, rgba(9,7,15,.7) 0 55%, transparent 95%),' +
        'radial-gradient(ellipse 1.8% 7% at 68% 31%, rgba(9,7,15,.65) 0 55%, transparent 95%),' +
        'radial-gradient(ellipse 1.6% 6% at 25% 41%, rgba(9,7,15,.6) 0 55%, transparent 95%),' +
        // satellite droplets (ellipse, not circle — % radii aren't valid
        // for circle and would drop the whole layer)
        'radial-gradient(ellipse 1.5% 1.5% at 38% 33%, rgba(9,7,15,.85) 0 65%, transparent 97%),' +
        'radial-gradient(ellipse 1.2% 1.2% at 59% 30%, rgba(9,7,15,.8) 0 65%, transparent 97%),' +
        'radial-gradient(ellipse 1.4% 1.4% at 58% 75%, rgba(9,7,15,.8) 0 65%, transparent 97%),' +
        'radial-gradient(ellipse 1.1% 1.1% at 30% 65%, rgba(9,7,15,.75) 0 65%, transparent 97%),' +
        'radial-gradient(ellipse 1.3% 1.3% at 78% 45%, rgba(9,7,15,.75) 0 65%, transparent 97%),' +
        'radial-gradient(ellipse 1% 1% at 45% 46%, rgba(9,7,15,.7) 0 65%, transparent 97%);' +
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
      // Cleared bindings are omitted rather than rendered as "—AJD"
      // cryptic glyphs (critic5 D7); arrows remain fixed alternates.
      const driveKeys = [
        bindings.throttle,
        bindings.left,
        bindings.brake,
        bindings.right,
      ]
        .map((b) => keyName(b))
        .filter((k) => k !== '—')
        .join('');
      const driveHint = driveKeys ? `${driveKeys} / arrows` : 'arrows';
      // Each "key — action" pair gets a nowrap span so the line can only
      // break at a separator — pairs like "Q — quit" never split mid-item
      // (critic9: "quit" orphaned onto its own line, "⌫ — respawn" split).
      const pair = (s: string) => `<span style="white-space:nowrap">${s}</span>`;
      const sep = ' &nbsp;·&nbsp; ';
      const hint =
        [
          pair(`${driveHint} — drive`),
          pair(bindings.drift ? `${keyName(bindings.drift)} — drift` : 'drift unbound'),
          pair(bindings.item ? `${keyName(bindings.item)} — item` : 'item unbound'),
          pair('P — pause'),
          pair('R — restart'),
        ].join(sep) +
        '<br>' +
        [pair('Q — quit'), pair('⌫ — respawn'), pair('M — reduce motion'), pair('O — options'), pair('T — track')].join(sep) +
        (padConnected()
          ? `<br>${pair('🎮 stick / RT·LT drive')}${sep}${pair('A go')}${sep}${pair('Y item')}${sep}${pair('Start pause')}`
          : '');
      const hintEl = this.titleEl.children[4] as HTMLElement;
      if (hintEl.innerHTML !== hint) hintEl.innerHTML = hint;
      // Gentle pulse on PRESS ENTER — cheap DOM animation, no rAF needed.
      // Floor at 0.7 — the old 0.55+0.45 sin dipped near-illegible against
      // bright title backgrounds (critic9).
      if (simTime - this.titlePulseAt > 0.06) {
        this.titlePulseAt = simTime;
        const a = 0.85 + 0.15 * Math.sin(simTime * 3.2); // floor 0.70
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
      // Ink overlay lives past this early return — quitting to title while
      // inked left it stuck 'block' over the menu (spotted post-critic11).
      this.inkEl.style.display = 'none';
      return;
    }
    // PAUSED hides under the options panel and under the results table —
    // translucent overlays stacked read untidy (critic4 / critic5 D6).
    this.pauseEl.style.display =
      paused && !opts?.open && race.phase !== 'finished' ? 'block' : 'none';
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
          ? [...race.racers.keys()].sort(
              // Cup tiebreak: better final-leg result decides — MK-style
              // climactic decider, not array order (critic16 D4).
              (a, b) =>
                gp.points[b] - gp.points[a] ||
                race.positionOf(a) - race.positionOf(b),
            )
          : order;
        // Points are awarded on the N-press, so a leg's results screen
        // shows "earned this leg → running total" (critic D5: leg-1 read
        // "0 pts"). Table mirrors Game.GP_POINTS.
        const GP_PTS = [10, 7, 5, 3];
        const rows = dispOrder
          .map((r, i) => {
            const rr = race.racers[r];
            // Unfinished rows are provisional (critic10 D6): the table used
            // to print a concrete "P#  +N → M pts" off live score order,
            // then the racer's real finish reordered it — the displayed
            // delta contradicted what the N-press actually awarded.
            // Finished rows show positionOf — same-tick finishers share a
            // place (P1,P1,P3), matching the award (critic16 D5). On final
            // standings every row is concrete by definition.
            const pos =
              rr.finished || gpFinal ? `P${gpFinal ? i + 1 : race.positionOf(r)}` : '…';
            const time = rr.finished ? fmt(rr.finishTime - race.raceStart) : '…';
            const best =
              fmt(rr.bestLapTime) +
              (r === 0 && record?.setThisRace ? ' ★REC' : '');
            const cls = r === 0 ? ';color:#7be8ff' : '';
            let pts = '';
            if (gp?.mode) {
              if (gp.done) {
                pts = `   ${gp.points[r]} pts`;
              } else if (rr.finished) {
                // Game.ts awards position points to EVERY racer incl. DNFs
                // (GP_POINTS[pos], P4 still gets +3) — the delta must match
                // what the N-press will actually add (critic9: a DNF showed
                // "+0 → 13" then totaled 16). Use the ROW index i — the same
                // sorted order the award loop uses — so a same-tick finish
                // tie can't display +10 to a row the award scores +7
                // (critic10: positionOf ties on equal finishTime).
                const earned = GP_PTS[race.positionOf(r) - 1] ?? 0;
                pts = `   +${earned} → ${gp.points[r] + earned} pts`;
              } else {
                pts = '   …pts provisional';
              }
            }
            const crown = gpFinal && i === 0 ? ' ★' : '';
            return `<div style="white-space:nowrap${cls}">${pos}${crown}  ${names[r] ?? 'BOT-' + r}   ${time}   best ${best}${pts}</div>`;
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
