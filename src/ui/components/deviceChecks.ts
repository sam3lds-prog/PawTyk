/**
 * Device checks for testers (D46 PR C). The outside review of D45 asked for frame rate, memory and slowdown measured
 * on real iPhones, and every major tune heard through a phone's own speaker. Neither can be done from a desktop
 * browser, so the tester build carries the tools to do it on the phone, from Settings → Tester shortcuts:
 *
 *  - **Performance check**: about a minute on the Farm, played by itself: the scene at rest, the tour, three walks
 *    (Go to the pond, the barn, the orchard, then Overview), a Welcome Parade, the scene at rest again. Each step's
 *    frame rate (median), slow frames (95th percentile, and how many took over 33 ms), the walk's quality tier, the
 *    3D renderers alive at the end, and whether the third walk ran slower than the first (a slowdown that builds up).
 *    The results can be copied and pasted anywhere.
 *  - **Frame rate**: a small counter in the corner while playing (on until turned off; this device only).
 *  - **Listen to every tune**: each cue, the theme in every home's voicing, and every trick tune, one tap each or all
 *    in a row.
 *
 * None of this exists in a release build (`featureFlags.qaTools`), and none of it changes the save.
 */

import { app } from '../../app/app';
import { featureFlags } from '../../config/featureFlags';
import { SCORES, THEME_HOMES, type CueId } from '../../audio/scores';
import { TRICKS } from '../../meta/catalogs/tricks';
import { musicEnabled, nowPlaying, playCue, stopMusic } from '../../services/music';
import { Scope } from '../router';
import { esc } from '../dom';
import { openSheet, toast } from './sheet';
import { openWalk } from './walk';
import { scene3dStats } from './scene3d';

// ---------------------------------------------------------------- frame meter

export interface FrameStats {
  frames: number;
  /** Median frames per second. */
  fps: number;
  /** 95th-percentile frame time, ms. */
  p95: number;
  /** Frames that took longer than 33 ms (a dropped frame at 30 fps), as a share of all. */
  slow: number;
  worst: number;
}

/** Summarises frame intervals (ms). */
export function frameStats(intervals: readonly number[]): FrameStats {
  const xs = intervals.filter((x) => x > 0 && x < 1000).sort((a, b) => a - b);
  if (!xs.length) return { frames: 0, fps: 0, p95: 0, slow: 0, worst: 0 };
  const at = (q: number) => xs[Math.min(xs.length - 1, Math.floor(q * xs.length))];
  return {
    frames: xs.length,
    fps: Math.round(1000 / at(0.5)),
    p95: Math.round(at(0.95)),
    slow: xs.filter((x) => x > 33.4).length / xs.length,
    worst: Math.round(xs[xs.length - 1]),
  };
}

/** Measures frame intervals until stopped. */
export function meterFrames(): { stop(): number[] } {
  const out: number[] = [];
  let last = 0;
  let raf = 0;
  const tick = (t: number) => {
    if (last) out.push(t - last);
    last = t;
    raf = requestAnimationFrame(tick);
  };
  raf = requestAnimationFrame(tick);
  return {
    stop() {
      cancelAnimationFrame(raf);
      return out;
    },
  };
}

/** A plain-words verdict for a step: Smooth, Fine, or Slow. */
export function verdict(s: FrameStats): 'Smooth' | 'Fine' | 'Slow' {
  if (s.fps >= 55 && s.p95 <= 25) return 'Smooth';
  if (s.fps >= 40 && s.slow <= 0.1) return 'Fine';
  return 'Slow';
}

// ---------------------------------------------------------------- the frame-rate counter

const FPS_KEY = 'pawtyk.qa.fps';
let hud: { el: HTMLElement; stop(): void } | null = null;

export function fpsCounterOn(): boolean {
  try {
    return localStorage.getItem(FPS_KEY) === '1';
  } catch {
    return false;
  }
}

/** Shows (or hides) the frame-rate counter, and remembers it on this device. */
export function setFpsCounter(on: boolean): void {
  try {
    if (on) localStorage.setItem(FPS_KEY, '1');
    else localStorage.removeItem(FPS_KEY);
  } catch {
    /* this browser keeps nothing: on for now only */
  }
  showFpsCounter(on);
}

function showFpsCounter(on: boolean): void {
  hud?.stop();
  hud = null;
  if (!on) return;
  const el = document.createElement('div');
  el.className = 'qa-fps';
  el.setAttribute('aria-hidden', 'true');
  document.body.appendChild(el);
  let meter = meterFrames();
  const every = window.setInterval(() => {
    const s = frameStats(meter.stop());
    meter = meterFrames();
    const tier = openWalk()?.tier;
    el.textContent = `${s.fps} fps · p95 ${s.p95} ms${tier ? ` · ${tier}` : ''}`;
    el.dataset.state = verdict(s).toLowerCase();
  }, 1000);
  hud = {
    el,
    stop() {
      clearInterval(every);
      meter.stop();
      el.remove();
    },
  };
}

/** At startup in a tester build: the counter comes back if it was left on. */
export function restoreDeviceChecks(): void {
  if (featureFlags.qaTools && fpsCounterOn()) showFpsCounter(true);
}

// ---------------------------------------------------------------- the performance check

export interface StepResult {
  step: string;
  stats: FrameStats;
  tier?: string;
}

export interface PerfReport {
  steps: StepResult[];
  renderers: number;
  /** The third walk's frame rate against the first's (1 = the same). Below 0.85 is a slowdown that builds up. */
  walkTrend: number | null;
  heapMB: number | null;
  device: string;
  when: string;
}

const sleep = (ms: number, alive: () => boolean) => new Promise<boolean>((r) => setTimeout(() => r(alive()), ms));
const until = async (test: () => boolean, ms: number, alive: () => boolean) => {
  const end = performance.now() + ms;
  while (performance.now() < end) {
    if (!alive()) return false;
    if (test()) return true;
    await sleep(100, alive);
  }
  return test();
};
const click = (sel: string) => {
  const b = document.querySelector<HTMLElement>(sel);
  if (!b || b.hidden) return false;
  b.click();
  return true;
};

/**
 * Plays the Farm by itself for about a minute and measures it. `onStep` says what it is doing (for the overlay);
 * `alive()` false stops it between steps. Needs 3D toys on for the walks (they are skipped otherwise).
 */
export async function runFarmCheck(onStep: (label: string, i: number, n: number) => void, alive: () => boolean): Promise<PerfReport | null> {
  app.router.go({ screen: 'region', id: 'farm' });
  if (!(await until(() => !!document.querySelector('.region .sanctuary__scene svg'), 8000, alive))) return null;
  await sleep(1500, alive);
  const steps: StepResult[] = [];
  const canWalk = !!document.querySelector('.sanctuary__scene [data-act="walk"]:not([hidden])');
  const plan = ['rest', 'tour', ...(canWalk ? ['walk 1', 'walk 2', 'walk 3'] : []), 'parade', 'rest again'];
  let i = 0;
  const measure = async (label: string, run: () => Promise<string | undefined | void>) => {
    if (!alive()) return;
    onStep(label, ++i, plan.length);
    const m = meterFrames();
    const tier = await run();
    steps.push({ step: label, stats: frameStats(m.stop()), tier: tier || undefined });
  };
  await measure('The Farm at rest', () => sleep(5000, alive).then(() => undefined));
  await measure('The tour', async () => {
    click('.sanctuary__scene [data-act="tour"]');
    await sleep(7000, alive);
    click('.sanctuary__scene [data-act="tour-stop"]');
    await sleep(800, alive);
  });
  if (canWalk)
    for (const n of [1, 2, 3])
      await measure(`Walk ${n}`, async () => {
        click('.sanctuary__scene [data-act="walk"]');
        if (!(await until(() => !!openWalk(), 10000, alive))) return;
        await sleep(1000, alive);
        for (const place of ['pond', 'barn', 'orchard']) {
          click(`.walk [data-goto="${place}"]`);
          await sleep(3000, alive);
        }
        const tier = openWalk()?.tier;
        click('.walk [data-act="walk-close"]');
        await until(() => !document.querySelector('.walk') && !!document.querySelector('.sanctuary__scene.has-3d, .sanctuary__scene:not(.has-3d)'), 4000, alive);
        await sleep(1200, alive);
        return tier;
      });
  await measure('A Welcome Parade', async () => {
    // The Replay button is there once any celebration has played here; otherwise the scene's group dance.
    if (!click('[data-act="parade-replay"]')) {
      app.router.go({ screen: 'region', id: 'farm', welcome: [firstFarmResident()].filter(Boolean) as never });
    }
    await until(() => !!document.querySelector('.is-parading'), 5000, alive);
    await until(() => !document.querySelector('.is-parading'), 14000, alive);
    await sleep(500, alive);
  });
  await measure('The Farm at rest again', () => sleep(5000, alive).then(() => undefined));
  if (!alive()) return null;
  const walks = steps.filter((s) => s.step.startsWith('Walk'));
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number } }).memory;
  return {
    steps,
    renderers: scene3dStats().live,
    walkTrend: walks.length >= 2 && walks[0].stats.fps ? Math.round((walks[walks.length - 1].stats.fps / walks[0].stats.fps) * 100) / 100 : null,
    heapMB: mem ? Math.round(mem.usedJSHeapSize / 1e5) / 10 : null,
    device: `${navigator.userAgent.match(/\(([^)]+)\)/)?.[1] ?? 'unknown'} · ${window.screen.width}×${window.screen.height} @${window.devicePixelRatio}x`,
    when: new Date().toISOString().slice(0, 16).replace('T', ' '),
  };
}

function firstFarmResident(): string | undefined {
  return Object.keys(app.save.inventory.companions)[0];
}

/** The report as plain text, to paste into a message or an issue. */
export function reportText(r: PerfReport): string {
  const lines = [
    `PawTyk performance check · ${r.when}`,
    r.device,
    ...r.steps.map((s) => `${s.step}: ${verdict(s.stats)} · ${s.stats.fps} fps · p95 ${s.stats.p95} ms · slow ${Math.round(s.stats.slow * 100)}% · worst ${s.stats.worst} ms${s.tier ? ` · ${s.tier} tier` : ''}`),
    `Walk 3 vs walk 1: ${r.walkTrend === null ? 'n/a' : `${Math.round(r.walkTrend * 100)}%${r.walkTrend < 0.85 ? ' (slowing down)' : ''}`}`,
    `3D renderers alive at the end: ${r.renderers}${r.renderers > 1 ? ' (expected 1)' : ''}`,
    `JS memory: ${r.heapMB === null ? 'not reported by this browser' : `${r.heapMB} MB`}`,
  ];
  return lines.join('\n');
}

/** Runs the check with a small overlay (Stop), then shows the results. */
export function startFarmCheck(): void {
  const scope = new Scope();
  const bar = document.createElement('div');
  bar.className = 'qa-run';
  bar.setAttribute('role', 'status');
  bar.innerHTML = `<span data-qa-step>Performance check…</span><button type="button" data-qa-stop>Stop</button>`;
  document.body.appendChild(bar);
  let stopped = false;
  scope.on(bar, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-qa-stop]')) stopped = true;
  });
  const label = bar.querySelector<HTMLElement>('[data-qa-step]')!;
  void runFarmCheck(
    (text, i, n) => (label.textContent = `Performance check · ${i} of ${n} · ${text}`),
    () => !stopped,
  ).then((r) => {
    bar.remove();
    if (!r) {
      scope.dispose();
      toast('Performance check stopped.');
      return;
    }
    showReport(scope, r);
  });
}

function showReport(scope: Scope, r: PerfReport): void {
  const text = reportText(r);
  const rows = r.steps
    .map(
      (s) => `<tr><th scope="row">${esc(s.step)}</th><td data-verdict="${verdict(s.stats).toLowerCase()}">${verdict(s.stats)}</td><td class="num">${s.stats.fps}</td><td class="num">${s.stats.p95}</td><td class="num">${Math.round(s.stats.slow * 100)}%</td></tr>`,
    )
    .join('');
  const sh = openSheet(scope, {
    title: 'Performance check',
    className: 'qa-report',
    onClose: () => scope.dispose(),
    body: `
      <p class="sheet__lead">${esc(r.device)}</p>
      <table class="qa-table"><thead><tr><th scope="col">Step</th><th scope="col"></th><th scope="col">fps</th><th scope="col">p95 ms</th><th scope="col">slow</th></tr></thead><tbody>${rows}</tbody></table>
      <p>${r.walkTrend === null ? 'No walks (3D toys are off).' : `Third walk vs first: <b>${Math.round(r.walkTrend * 100)}%</b>${r.walkTrend < 0.85 ? ' — it slowed down.' : '.'}`}
      3D renderers alive: <b>${r.renderers}</b>. Memory: ${r.heapMB === null ? 'not reported on this browser (iOS never does; use Xcode → Debug Navigator → Memory).' : `<b>${r.heapMB} MB</b>.`}</p>
      <pre class="qa-text" tabindex="0">${esc(text)}</pre>
      <button class="btn btn--block" data-qa-copy>Copy results</button>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-qa-copy]')) return;
    if (!navigator.clipboard) return toast('Copy isn’t available here: select the text above instead.');
    void navigator.clipboard.writeText(text).then(
      () => toast('Results copied.'),
      () => toast('Copy didn’t work here: select the text above instead.'),
    );
  });
}

// ---------------------------------------------------------------- listen to every tune

interface Listen {
  id: CueId;
  home?: string;
  label: string;
}

/** Every tune worth hearing on a phone speaker: the signature cues, the theme in each home, every trick tune. */
export function listeningList(): { title: string; items: Listen[] }[] {
  const homeName: Record<string, string> = { farm: 'Farm', harmony: 'Pet Garden', outback: 'Outback', savanna: 'Savanna', arctic: 'Arctic', amazon: 'Rainforest' };
  return [
    {
      title: 'The big moments',
      items: (['triumph', 'welcome', 'bounce', 'jig', 'meadow'] as const).map((id) => ({ id, label: SCORES[id].title })),
    },
    { title: 'The parade in every home', items: THEME_HOMES.map((h) => ({ id: 'bounce' as CueId, home: h, label: `Barnyard Bounce · ${homeName[h] ?? h}` })) },
    { title: 'Trick tunes', items: TRICKS.map((t) => ({ id: `trick:${t.id}` as CueId, label: `${t.name} · ${SCORES[`trick:${t.id}`]?.title ?? ''}` })) },
  ];
}

export function showListeningCheck(parent: Scope): void {
  const groups = listeningList();
  const all = groups.flatMap((g) => g.items);
  let queue: number | null = null;
  const sh = openSheet(parent, {
    title: 'Listen to every tune',
    className: 'qa-listen',
    body: `
      <p class="sheet__lead">${musicEnabled() ? 'Through the phone’s own speaker, ringer on, at a normal volume. Each should sound clear, never harsh or buzzy, and about as loud as the others.' : 'Music is off in Settings: turn it on to hear these.'}</p>
      <button class="btn btn--block" data-listen-all>Play all in order (about two minutes)</button>
      ${groups
        .map(
          (g) => `<div class="rows-title">${esc(g.title)}</div><div class="rows">${g.items
            .map((it) => `<button class="row" data-listen="${all.indexOf(it)}"><span class="row__label">${esc(it.label)}</span><span class="num muted">${((SCORES[it.id].beats * 60) / SCORES[it.id].bpm).toFixed(1)} s</span></button>`)
            .join('')}</div>`,
        )
        .join('')}`,
    onClose: () => {
      if (queue !== null) clearTimeout(queue);
      queue = null;
      stopMusic(150);
    },
  });
  const play = (i: number) => {
    const it = all[i];
    for (const b of sh.el.querySelectorAll('[data-listen]')) b.classList.toggle('is-playing', (b as HTMLElement).dataset.listen === String(i));
    return playCue(it.id, { home: it.home });
  };
  const playFrom = (i: number) => {
    if (i >= all.length || !sh.scope.alive) {
      queue = null;
      return;
    }
    const pb = play(i);
    const ms = (pb?.durationMs ?? 2000) + 700;
    queue = window.setTimeout(() => playFrom(i + 1), ms);
  };
  sh.scope.on(sh.el, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-listen-all]')) {
      if (queue !== null) clearTimeout(queue);
      playFrom(0);
      return;
    }
    const b = t.closest<HTMLElement>('[data-listen]');
    if (!b) return;
    if (queue !== null) clearTimeout(queue);
    queue = null;
    if (nowPlaying()) stopMusic(80);
    play(Number(b.dataset.listen));
  });
}
