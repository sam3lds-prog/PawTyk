// D46 browser checks: every farm interaction can be started, stopped, skipped, replayed and switched without getting
// stuck (D46 PR A), and the 3D layer's lifecycle (D46 PR B). Called from smoke.mjs; `node test/e2e/d46.mjs` runs them
// alone (same dev server, E2E_URL, CHROME_PATH).

/** Waits for a selector without holding on to the element (a held handle keeps a canvas and its renderer alive). */
const waitFor = (qa, sel, timeout = 15000) => qa.waitForFunction((s) => !!document.querySelector(s), sel, { timeout }).then((h) => (h.dispose(), true), () => false);

/** A 320 × 568 page (the smallest iPhone) on the Farm, set up like the D44 QA list. */
async function farmPage(browser, URL, errors) {
  const qa = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d46] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt);
  return qa;
}

/** Opens the Farm. `welcome`: straight from a win's Meet (the Welcome Parade's lead-in starts). Doesn't wait. */
async function openFarm(qa, o = {}) {
  await qa.evaluate(async (o) => {
    window.__d46 = null;
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
    if ((a.save.journey.nextLevel ?? 1) < 40) tools.skipToLevel(a.save, 40);
    tools.finishOpenHomes(a.save);
    a.save.settings.toys3d = o.toys3d ?? true;
    a.save.settings.reducedMotion = 'full';
    a.save.settings.celebrations = 'full';
    a.applySettings();
    a.persist();
    window.__pt.go({ screen: 'region', id: 'farm', ...(o.welcome ? { welcome: ['cotton'] } : {}) });
    if (o.then)
      setTimeout(() => {
        if (o.then.what === 'leave') window.__pt.go({ screen: 'journey' });
        else document.querySelector(`.sanctuary__scene [data-act="${o.then.what}"]`)?.click();
        window.__d46 = { did: o.then.what, parading: !!document.querySelector('.is-parading'), waiting: window.__director?.waiting ?? 0 };
      }, o.then.ms);
  }, o);
  if (o.then?.what !== 'leave') await waitFor(qa, '.region .sanctuary__scene svg', 30000);
}

/**
 * A real tap: scrolled into view and hit-tested (an overlay on top gets it, an inert or covered element doesn't, and
 * then this returns false). Playwright's own actionability checks, with a short timeout.
 */
async function tapAt(qa, selector) {
  // Where a finger would land: nothing there, hidden, or under something else (an overlay, an inert screen) → that tap
  // doesn't reach it, at once. Otherwise a real click, with room for a slow software-rendered frame (CI).
  const reachable = await qa.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.hidden) return false;
    el.scrollIntoView({ block: 'nearest' });
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  }, selector);
  if (!reachable) return false;
  try {
    await qa.click(selector, { timeout: 10000, noWaitAfter: true });
    return true;
  } catch {
    return false;
  }
}

/**
 * Opens the Farm straight from Meet and, `ms` into the welcome's lead-in, does what a quick player does (in the page,
 * on its own clock, so a busy main thread can't reorder it against the lead-in).
 */
async function arriveThen(qa, what, ms = 120) {
  await openFarm(qa, { welcome: true, then: { what, ms } });
  await qa.waitForFunction(() => window.__d46, null, { timeout: 10000 }).catch(() => {});
  await qa.waitForTimeout(100);
}

/** Everything the D46 acceptance test cares about, in one look. */
const sceneState = (qa) =>
  qa.evaluate(async () => {
    const { nowPlaying } = await import('/src/services/music.ts');
    const b = document.querySelector('[data-act="parade-replay"]');
    return {
      region: !!document.querySelector('.region .sanctuary__scene'),
      owner: window.__director?.owner ?? null,
      paused: window.__director?.paused ?? null,
      waiting: window.__director?.waiting ?? 0,
      parading: !!document.querySelector('.is-parading'),
      touring: !!document.querySelector('.is-touring'),
      closeup: !!document.querySelector('.is-closeup'),
      walk: !!document.querySelector('.walk'),
      inert: !!document.getElementById('app')?.inert,
      offered: b && !b.hidden ? b.textContent.trim() : null,
      goal: !!document.querySelector('[data-next-goal]'),
      overlay: !!document.querySelector('.overlay'),
      music: nowPlaying()?.id ?? null,
      canvases: document.querySelectorAll('canvas').length,
      toys: !!document.querySelector('.sanctuary__scene.has-3d'),
      stuck: document.querySelectorAll('.sanctuary__scene [data-trick], .sanctuary__scene .is-dancing, .sanctuary__scene [class*="is-dance-"]').length,
      skips: document.querySelectorAll('.parade-skip').length,
    };
  });

/** A scene at rest: nobody owns the camera, nothing holds or waits, nobody mid-trick, no tune, one canvas at most. */
const atRest = (s) => s.region && s.owner === null && s.paused === false && s.waiting === 0 && !s.parading && !s.touring && !s.closeup && !s.walk && !s.inert && s.stuck === 0 && s.skips === 0 && s.music === null && s.canvases <= 1;

export async function d46Checks({ browser, URL, check, errors }) {
  const qa = await farmPage(browser, URL, errors);

  // ---------------------------------------------------------------- D46 PR A: what the player chose wins
  // Walk tapped during the welcome's lead-in: the walk stays open (the parade used to cut in and close it), the
  // welcome is offered, and the next goal waits for the walk to close.
  await arriveThen(qa, 'walk');
  const tappedWalk = await qa.evaluate(() => window.__d46?.did === 'walk' && !window.__d46.parading && window.__d46.waiting === 0);
  await qa.waitForTimeout(3500);
  const w1 = await sceneState(qa);
  await tapAt(qa, '.walk [data-act="walk-close"]');
  await qa.waitForTimeout(1600);
  const w2 = await sceneState(qa);
  check(
    'Walk tapped during the welcome’s lead-in stays open; the parade is offered, never cuts in; the goal waits until the walk closes (D46)',
    tappedWalk && w1.walk && !w1.parading && w1.offered === 'Watch Cotton’s welcome' && !w1.goal && atRest(w2) && w2.goal && w2.toys && w2.offered === 'Watch Cotton’s welcome',
    JSON.stringify({ tappedWalk, w1, w2 }),
  );
  // The offered welcome plays when asked, in full, and becomes a replay.
  await tapAt(qa, '[data-act="parade-replay"]');
  // It may wait (briefly) for the toys being rebuilt after the walk (D46 PR B), then glides in before the tune starts.
  await qa.waitForFunction(async () => !!(await import('/src/services/music.ts')).nowPlaying(), null, { timeout: 4000, polling: 100 }).then((h) => h.dispose(), () => {});
  const watching = await sceneState(qa);
  await tapAt(qa, '.parade-skip');
  await qa.waitForTimeout(900);
  const watched = await sceneState(qa);
  check('the offered welcome plays when the player asks for it, then offers a replay (D46)', watching.parading && watching.music === 'bounce' && atRest(watched) && watched.offered === 'Replay the parade', JSON.stringify({ watching, watched }));

  // Tour tapped during the lead-in: the tour keeps its stops.
  await arriveThen(qa, 'tour');
  const tappedTour = await qa.evaluate(() => window.__d46?.did === 'tour' && !window.__d46.parading);
  await qa.waitForTimeout(3000);
  const t1 = await sceneState(qa);
  await tapAt(qa, '.sanctuary__scene [data-act="tour-stop"]');
  await qa.waitForTimeout(1200);
  const t2 = await sceneState(qa);
  check('Tour tapped during the welcome’s lead-in keeps touring; the parade is offered instead (D46)', tappedTour && t1.touring && t1.owner === 'tour' && !t1.parading && t1.offered === 'Watch Cotton’s welcome' && atRest(t2) && t2.goal, JSON.stringify({ tappedTour, t1, t2 }));

  // Leaving during the lead-in: nothing plays later, no tune; straight back, the welcome is offered (not played).
  await arriveThen(qa, 'leave', 200);
  await qa.waitForTimeout(2800);
  const away = await qa.evaluate(async () => ({ music: (await import('/src/services/music.ts')).nowPlaying()?.id ?? null, parading: !!document.querySelector('.is-parading'), journey: !!document.querySelector('.journey, [data-screen="journey"]') || !document.querySelector('.region') }));
  await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await waitFor(qa, '.region .sanctuary__scene svg', 30000);
  await qa.waitForTimeout(3000);
  const back = await sceneState(qa);
  check('leaving during the lead-in plays nothing later; back on the Farm, the welcome is offered and nothing starts by itself (D46)', !away.music && !away.parading && away.journey && atRest(back) && back.offered === 'Watch Cotton’s welcome', JSON.stringify({ away, back }));

  // Rapid re-entry while each visit is still in its lead-in.
  for (let i = 0; i < 4; i++) await arriveThen(qa, 'leave', 90 + i * 60);
  await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await waitFor(qa, '.region .sanctuary__scene svg', 30000);
  await qa.waitForTimeout(3500);
  const rapid = await sceneState(qa);
  const scenes = await qa.evaluate(() => document.querySelectorAll('.sanctuary__scene').length);
  check('rapid re-entry during the lead-in leaves one scene at rest, the welcome offered, one canvas (D46)', scenes === 1 && atRest(rapid) && rapid.offered === 'Watch Cotton’s welcome', JSON.stringify({ scenes, rapid }));

  // The acceptance matrix: every farm interaction started, then every other started straight after it, then everything
  // ended the way a player ends it. After each pair the scene is at rest: nobody stuck mid-trick, no tune left playing,
  // still on the Farm, one 3D canvas, the toys back. (A tap that the running moment doesn't allow simply doesn't start.)
  await openFarm(qa, { welcome: true });
  await waitFor(qa, '.sanctuary__scene.is-parading', 8000);
  await tapAt(qa, '.parade-skip');
  await qa.waitForTimeout(800);
  const start = {
    parade: () => tapAt(qa, '[data-act="parade-replay"]'),
    trick: async () => {
      if (!(await tapAt(qa, '.sanctuary__scene .sanctuary__pet[data-friend="truffle"], .sanctuary__scene .sanctuary__pet'))) return false;
      await qa.waitForTimeout(250);
      return tapAt(qa, '.trick-chip[data-trick="wave"]');
    },
    tour: () => tapAt(qa, '.sanctuary__scene [data-act="tour"]'),
    walk: () => tapAt(qa, '.sanctuary__scene [data-act="walk"]'),
    barn: () => tapAt(qa, '.sanctuary__scene [data-landmark]'),
  };
  const endAll = async () => {
    // The way a player gets out of each: Overview, Stop, Skip, Escape; then a moment for a trick to finish.
    await tapAt(qa, '.walk [data-act="walk-close"]');
    await tapAt(qa, '.sanctuary__scene [data-act="tour-stop"]');
    await tapAt(qa, '.parade-skip');
    if (await qa.$('.trick-tray')) await qa.keyboard.press('Escape');
    await qa.waitForFunction(() => !document.querySelector('.sanctuary__scene [data-trick], .is-closeup'), null, { timeout: 6000 }).catch(() => {});
    await qa.waitForTimeout(1300);
  };
  const bad = [];
  const kinds = Object.keys(start);
  const save0 = await qa.evaluate(() => JSON.stringify({ c: window.__pt.app.coins(), inv: window.__pt.app.save.inventory, growth: window.__pt.app.save.world.growth }));
  for (const a of kinds)
    for (const b of kinds) {
      if (a === b) continue;
      await start[a]();
      await qa.waitForTimeout(a === 'walk' ? 900 : 350);
      await start[b]();
      await qa.waitForTimeout(b === 'walk' ? 900 : 500);
      await endAll();
      const s = await sceneState(qa);
      if (!atRest(s) || !s.toys) bad.push({ pair: `${a}→${b}`, s });
    }
  const save1 = await qa.evaluate(() => JSON.stringify({ c: window.__pt.app.coins(), inv: window.__pt.app.save.inventory, growth: window.__pt.app.save.world.growth }));
  check(`every farm interaction started straight after every other ends at rest: ${kinds.length * (kinds.length - 1)} pairs (D46)`, bad.length === 0, JSON.stringify(bad).slice(0, 900));
  check('switching between farm interactions pays nothing (coins, inventory, growth unchanged) (D46)', save0 === save1);

  // ---------------------------------------------------------------- D46 PR B: the 3D layer's lifecycle
  const stats = () => qa.evaluate(() => window.__scene3dStats?.() ?? null);
  const heap = async () => {
    const cdp = await qa.context().newCDPSession(qa);
    await cdp.send('HeapProfiler.collectGarbage');
    const { usedSize } = await cdp.send('Runtime.getHeapUsage');
    await cdp.detach();
    return usedSize;
  };
  const toysBack = () => qa.waitForFunction(() => !!document.querySelector('.sanctuary__scene.has-3d') && !document.querySelector('.walk'), null, { timeout: 8000 }).then((h) => (h.dispose(), true), () => false);
  /** WebGL renderers alive after a garbage collection (three.js r186 kept every one ever made: D46 PR B). */
  const renderers = async () => {
    const cdp = await qa.context().newCDPSession(qa);
    await cdp.send('HeapProfiler.collectGarbage');
    const { result } = await cdp.send('Runtime.evaluate', { expression: 'Object.getPrototypeOf(window.__stage3d.renderer)', objectGroup: 'd46' });
    const { objects } = await cdp.send('Runtime.queryObjects', { prototypeObjectId: result.objectId, objectGroup: 'd46' });
    const { result: n } = await cdp.send('Runtime.callFunctionOn', { objectId: objects.objectId, functionDeclaration: 'function () { return this.length; }', returnByValue: true });
    await cdp.send('Runtime.releaseObjectGroup', { objectGroup: 'd46' });
    await cdp.detach();
    return n.value;
  };
  await openFarm(qa);
  await qa.waitForTimeout(2500);
  // Walk → Overview, again and again: one renderer at a time, every earlier one released, toys back each time, and no
  // memory that keeps growing.
  const cycle = async () => {
    await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
    await waitFor(qa, '.walk canvas.walk__canvas');
    await qa.waitForTimeout(500);
    const during = await qa.evaluate(() => document.querySelectorAll('canvas').length);
    await tapAt(qa, '.walk [data-act="walk-close"]');
    return { during, back: await toysBack() };
  };
  const s0 = await stats();
  const first = await cycle();
  const h1 = await heap();
  const runs = [first];
  for (let i = 0; i < 6; i++) runs.push(await cycle());
  const h7 = await heap();
  const s7 = await stats();
  const one = await qa.evaluate(() => document.querySelectorAll('canvas').length);
  const alive = await renderers();
  check(
    'Walk → Overview seven times: one WebGL canvas at a time, the toys back after each, one renderer left alive, memory steady (D46)',
    runs.every((r) => r.during === 1 && r.back) && one === 1 && s7.live === s0.live && s7.created - s0.created === 7 && alive === 1 && h7 - h1 < 3e6,
    JSON.stringify({ runs, s0, s7, one, alive, grewMB: ((h7 - h1) / 1e6).toFixed(2) }),
  );

  // The review's handoff: Overview, then straight away a celebration. It waits for the toys being rebuilt, so it
  // dances in 3D from its first beat (before, the old "ready" let it start drawn and the toys popped in mid-dance).
  await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
  await waitFor(qa, '.walk canvas.walk__canvas');
  await qa.waitForTimeout(400);
  await qa.evaluate(() => {
    document.querySelector('.walk [data-act="walk-close"]').click();
    document.querySelector('[data-act="parade-replay"]').click();
    window.__firstBeat = null;
    const scene = document.querySelector('.sanctuary__scene');
    const seen = () => {
      if (scene.classList.contains('is-parading') && window.__firstBeat === null) window.__firstBeat = { toys: scene.classList.contains('has-3d'), at: performance.now() };
      else if (window.__firstBeat === null) requestAnimationFrame(seen);
    };
    seen();
  });
  await qa.waitForFunction(() => window.__firstBeat, null, { timeout: 6000 }).catch(() => {});
  const handoff = await qa.evaluate(() => window.__firstBeat);
  await tapAt(qa, '.parade-skip');
  await qa.waitForTimeout(800);
  check('a celebration started the moment the walk closes dances with the 3D toys from its first beat (D46)', !!handoff?.toys, JSON.stringify(handoff));

  // The OS takes the scene's WebGL context back (memory pressure, the background): the drawn animals show at once;
  // when it comes back, the toys do. If it doesn't come back, the scene rebuilds its renderer with a new context.
  const lose = (sel, restoreAfter) =>
    qa.evaluate(
      ([sel, restoreAfter]) => {
        const c = document.querySelector(sel);
        const gl = c?.getContext('webgl2') ?? c?.getContext('webgl');
        const ext = gl?.getExtension('WEBGL_lose_context');
        if (!ext) return false;
        ext.loseContext();
        if (restoreAfter >= 0) setTimeout(() => ext.restoreContext(), restoreAfter);
        return true;
      },
      [sel, restoreAfter],
    );
  const lost = await lose('.sanctuary__scene canvas.scene3d', 800);
  await qa.waitForTimeout(300);
  const whileLost = await qa.evaluate(() => ({ toys: !!document.querySelector('.sanctuary__scene.has-3d'), drawn: document.querySelectorAll('.sanctuary__scene .sanctuary__pet').length }));
  const restored = await toysBack();
  const r0 = await stats();
  await lose('.sanctuary__scene canvas.scene3d', -1);
  await qa.waitForTimeout(400);
  const gone = await qa.evaluate(() => !!document.querySelector('.sanctuary__scene.has-3d'));
  await qa.waitForTimeout(3600);
  const rebuilt = await toysBack();
  const r1 = await stats();
  // A celebration during all this still plays (drawn or in 3D), and the scene ends at rest.
  await tapAt(qa, '[data-act="parade-replay"]');
  await qa.waitForTimeout(900);
  const dancing = await sceneState(qa);
  await tapAt(qa, '.parade-skip');
  await qa.waitForTimeout(900);
  const settled = await sceneState(qa);
  check(
    'a lost scene context: drawn animals at once, toys back when it returns; never returned, the renderer is rebuilt (D46)',
    lost && !whileLost.toys && whileLost.drawn >= 2 && restored && !gone && rebuilt && r1.rebuilds === r0.rebuilds + 1 && r1.live === r0.live,
    JSON.stringify({ lost, whileLost, restored, gone, rebuilt, r0, r1 }),
  );
  check('celebrations still play after the scene’s renderer was rebuilt, and end at rest (D46)', dancing.parading && atRest(settled) && settled.toys, JSON.stringify({ dancing, settled }));

  // The walk's own context: a note while it comes back; if it doesn't, the walk says so and Overview still works.
  await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
  await waitFor(qa, '.walk canvas.walk__canvas');
  await qa.waitForTimeout(600);
  await lose('.walk canvas.walk__canvas', 900);
  await qa.waitForTimeout(300);
  const wNote = await qa.evaluate(() => document.querySelector('.walk__note')?.textContent ?? '');
  await qa.waitForTimeout(1300);
  const wBack = await qa.evaluate(() => ({ note: !!document.querySelector('.walk__note'), lost: window.__walk?.contextLost ?? null, d: window.__walk?.drawn ?? 0 }));
  await qa.waitForTimeout(400);
  const wDraws = await qa.evaluate(() => window.__walk?.drawn ?? 0);
  await lose('.walk canvas.walk__canvas', -1);
  await qa.waitForTimeout(3500);
  const wGone = await qa.evaluate(() => ({ note: document.querySelector('.walk__note')?.textContent ?? '', focus: document.activeElement?.dataset?.act ?? '' }));
  await tapAt(qa, '.walk [data-act="walk-close"]');
  const wHome = await toysBack();
  const wRest = await sceneState(qa);
  check(
    'a lost walk context: “Getting the Farm back…”, then it draws again; never returned, it says so and Overview returns to the Farm (D46)',
    wNote === 'Getting the Farm back…' && !wBack.note && wBack.lost === false && wDraws > wBack.d && /3D paused/.test(wGone.note) && wGone.focus === 'walk-close' && wHome && atRest(wRest),
    JSON.stringify({ wNote, wBack, wDraws, wGone, wHome }),
  );

  await qa.close();
}

// Run alone: `node test/e2e/d46.mjs`.
if (import.meta.url === `file://${process.argv[1]}`) {
  const { chromium } = await import('playwright');
  const URL = process.env.E2E_URL ?? 'http://localhost:5173/';
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const results = [];
  const errors = [];
  let failed = 0;
  const check = (name, cond, detail = '') => {
    results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? `  (${detail})` : ''}`);
    if (!cond) failed++;
  };
  try {
    await d46Checks({ browser, URL, check, errors });
    check('no page errors', errors.length === 0, errors.join(' | '));
  } catch (e) {
    check('suite ran to completion', false, String(e).slice(0, 400));
  } finally {
    await browser.close();
  }
  console.log(results.join('\n'));
  console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`);
  process.exit(failed ? 1 : 0);
}
