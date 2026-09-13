// Minimal /__gauntlet scaffold. Reads machine-readable gauntlet state from the
// dev-server middleware (see vite.config.ts -> gauntletState plugin).

interface GauntletProgress {
  project?: {
    name?: string;
    phase?: string;
    status?: string;
    currentWave?: number;
    lastUpdated?: string | null;
  };
  blockers?: string[];
  [key: string]: unknown;
}

async function load(): Promise<void> {
  const summary = document.getElementById('summary');
  const raw = document.getElementById('raw');
  if (!summary || !raw) return;

  try {
    const res = await fetch('/__gauntlet-state/progress.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = (await res.json()) as GauntletProgress;
    const p = data.project ?? {};
    summary.innerHTML = [
      `<div><span class="key">Project:</span> ${p.name ?? 'unknown'}</div>`,
      `<div><span class="key">Phase:</span> ${p.phase ?? 'unknown'}</div>`,
      `<div><span class="key">Status:</span> ${p.status ?? 'unknown'}</div>`,
      `<div><span class="key">Wave:</span> ${p.currentWave ?? 'n/a'}</div>`,
      `<div><span class="key">Last updated:</span> ${p.lastUpdated ?? 'never'}</div>`,
      `<div><span class="key">Blockers:</span> ${(data.blockers ?? []).length}</div>`,
    ].join('');
    raw.textContent = JSON.stringify(data, null, 2);
  } catch (err) {
    summary.textContent = `Could not load gauntlet state: ${String(err)}`;
  }
}

void load();
