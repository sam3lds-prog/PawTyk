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

  // ---------------------------------------------------------------- D46 PR C: visual acceptance
  // Every frame of a Welcome Parade on the smallest iPhone, toys and drawn: every animal stays wholly inside the
  // picture and clear of the Skip button (the dance's framing used to cut the Farm's sheep and horse in half, and Skip
  // sat on the horse's legs at the finish).
  const watchParade = async (toys3d) => {
    await qa.evaluate((toys3d) => {
      const a = window.__pt.app;
      a.save.settings.toys3d = toys3d;
      a.applySettings();
      a.persist();
    }, toys3d);
    await openFarm(qa, { welcome: true, toys3d });
    await waitFor(qa, '.sanctuary__scene.is-parading', 8000);
    return qa.evaluate(
      () =>
        new Promise((done) => {
          const scene = document.querySelector('.sanctuary__scene');
          const bad = new Map();
          let frames = 0;
          const inside = (r, o, pad) => r.left >= o.left - pad && r.right <= o.right + pad && r.top >= o.top - pad && r.bottom <= o.bottom + pad;
          const meet = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
          let lastZoom = 0;
          const look = () => {
            if (!scene.classList.contains('is-parading')) return done({ frames, bad: [...bad.entries()] });
            // The dance and the finish, once the camera has settled: the intro is a close-up on the newcomer by design,
            // and a frame mid-glide is between two framings.
            const zoom = window.__cam?.zoom ?? 1;
            const steady = Math.abs(zoom - lastZoom) < 0.002 && zoom <= 1.46;
            lastZoom = zoom;
            if (!steady) return requestAnimationFrame(look);
            frames++;
            const box = scene.getBoundingClientRect();
            const skip = scene.querySelector('.parade-skip')?.getBoundingClientRect();
            for (const f of scene.querySelectorAll('.sanctuary__pet')) {
              // The animal (the toy stands where its drawn twin stands), less a tenth each side for its shadow.
              const o = f.getBoundingClientRect();
              const r = { left: o.left + o.width * 0.1, right: o.right - o.width * 0.1, top: o.top + o.height * 0.1, bottom: o.bottom - o.height * 0.1, width: o.width };
              const who = f.dataset.friend ?? f.dataset.pet ?? '?';
              if (!r.width) continue;
              if (!inside(r, box, 2)) bad.set(who, `out@${zoom.toFixed(2)}`);
              if (skip && meet(r, skip)) bad.set(who, `skip@${zoom.toFixed(2)}`);
            }
            requestAnimationFrame(look);
          };
          look();
        }),
    );
  };
  const p3d = await watchParade(true);
  const pDrawn = await watchParade(false);
  await qa.evaluate(() => {
    window.__pt.app.save.settings.toys3d = true;
    window.__pt.app.applySettings();
  });
  check(
    'a small iPhone: through a whole Welcome Parade (3D and drawn) every animal stays in the picture and clear of Skip (D46)',
    p3d.frames > 10 && pDrawn.frames > 10 && p3d.bad.length === 0 && pDrawn.bad.length === 0,
    JSON.stringify({ p3d: { frames: p3d.frames, bad: p3d.bad.slice(0, 4) }, drawn: { frames: pDrawn.frames, bad: pDrawn.bad.slice(0, 4) } }),
  );
  // The walk's Go-to buttons on a 320-wide phone: one row, below the scene's middle, clear of the map and the pad.
  await openFarm(qa);
  await qa.waitForTimeout(1500);
  await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
  await waitFor(qa, '.walk canvas.walk__canvas');
  await qa.waitForTimeout(400);
  const chips = await qa.evaluate(() => {
    const cs = [...document.querySelectorAll('.walk [data-goto]')].map((c) => c.getBoundingClientRect());
    const tops = new Set(cs.map((r) => Math.round(r.top)));
    const map = document.querySelector('.walk__map').getBoundingClientRect();
    return { n: cs.length, rows: tops.size, minH: Math.min(...cs.map((r) => r.height)), lowHalf: cs.every((r) => r.top > window.innerHeight / 2), aboveMap: cs.every((r) => r.bottom <= map.top) };
  });
  await tapAt(qa, '.walk [data-act="walk-close"]');
  await qa.waitForTimeout(600);
  check('a 320-wide phone: the walk’s Go-to buttons fit one row (44 pt tall), in the lower half, above the map (D46)', chips.n === 4 && chips.rows === 1 && chips.minH >= 44 && chips.lowHalf && chips.aboveMap, JSON.stringify(chips));

  // The tester's device checks (D46 PR C): Settings → Performance check plays the Farm by itself and reports each
  // step; the frame-rate counter shows; Listen to every tune lists them all and plays one.
  await qa.evaluate(() => window.__pt.go({ screen: 'journey' }));
  await waitFor(qa, '[data-act="settings"]');
  await tapAt(qa, '[data-act="settings"]');
  await waitFor(qa, '[data-qa="perf"]');
  await qa.evaluate(() => document.querySelector('[data-qa="perf"]').scrollIntoView());
  await tapAt(qa, '[data-qa="perf"]');
  const ranReport = await waitFor(qa, '.qa-report', 120000);
  const report = await qa.evaluate(() => ({
    rows: [...document.querySelectorAll('.qa-table tbody tr')].map((r) => r.querySelector('th').textContent),
    text: document.querySelector('.qa-text')?.textContent ?? '',
    bar: !!document.querySelector('.qa-run'),
  }));
  await qa.keyboard.press('Escape');
  await qa.waitForTimeout(400);
  const afterCheck = await sceneState(qa);
  check(
    'the tester’s Performance check plays the Farm by itself (rest, tour, three walks, a parade) and reports every step (D46)',
    ranReport && report.rows.join('|') === 'The Farm at rest|The tour|Walk 1|Walk 2|Walk 3|A Welcome Parade|The Farm at rest again' && /3D renderers alive at the end: 1\b/.test(report.text) && !report.bar && atRest(afterCheck),
    JSON.stringify({ ranReport, report: { ...report, text: report.text.slice(0, 600) }, afterCheck }),
  );
  await qa.evaluate(() => window.__pt.go({ screen: 'journey' }));
  await waitFor(qa, '[data-act="settings"]');
  await tapAt(qa, '[data-act="settings"]');
  await waitFor(qa, '[data-qa="fps"]');
  await qa.evaluate(() => document.querySelector('[data-qa="fps"]').click());
  await qa.waitForTimeout(1300);
  const fps = await qa.evaluate(() => document.querySelector('.qa-fps')?.textContent ?? '');
  await qa.evaluate(() => document.querySelector('[data-qa="fps"]').click());
  const fpsOff = await qa.evaluate(() => !document.querySelector('.qa-fps'));
  await qa.evaluate(() => document.querySelector('[data-qa="listen"]').click());
  await waitFor(qa, '.qa-listen [data-listen]');
  const listen = await qa.evaluate(async () => {
    document.querySelector('.qa-listen [data-listen="0"]').click();
    const playing = (await import('/src/services/music.ts')).nowPlaying()?.id ?? null;
    return { rows: document.querySelectorAll('.qa-listen [data-listen]').length, playing };
  });
  await qa.keyboard.press('Escape');
  await qa.keyboard.press('Escape');
  check('the frame-rate counter counts and turns off; Listen to every tune lists every tune and plays one (D46)', /^\d+ fps · p95 \d+ ms/.test(fps) && fpsOff && listen.rows >= 29 && listen.playing === 'triumph', JSON.stringify({ fps, fpsOff, listen }));

  await qa.close();
}

/**
 * D46 PR D: a force-close (the app swiped away, or killed by iOS) never runs pagehide. Crashing the page's renderer is
 * the closest a browser gets: nothing of the page runs after it. The same browser profile is reopened after each.
 */
export async function forceCloseChecks({ browser, URL, check, errors }) {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  const open = async () => {
    const p = await ctx.newPage();
    p.on('pageerror', (e) => errors.push(`[d46 kill] ${e}`));
    await p.goto(URL);
    await p.waitForFunction(() => window.__pt).then((h) => h.dispose());
    return p;
  };
  const kill = async (p) => {
    const cdp = await ctx.newCDPSession(p);
    const crashed = p.waitForEvent('crash', { timeout: 5000 }).catch(() => null);
    // No answer comes back from a renderer that's gone: don't wait for one.
    void cdp.send('Page.crash').catch(() => {});
    await crashed;
    await Promise.race([p.close().catch(() => {}), new Promise((r) => setTimeout(r, 2000))]);
  };
  const rewards = (p) => p.evaluate(() => JSON.stringify({ c: window.__pt.app.coins(), inv: window.__pt.app.save.inventory, growth: window.__pt.app.save.world.growth, aff: window.__pt.app.save.sanctuary.affection, next: window.__pt.app.save.journey.nextLevel }));

  // Mid-board: two animals placed and a ✕, then killed. Reopened: Resume, with exactly those moves.
  let p = await open();
  await p.evaluate(async () => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
    tools.skipToLevel(a.save, 12);
    a.persist();
    window.__pt.start({ kind: 'level', level: 12 });
  });
  await waitFor(p, '.board .cell');
  await p.waitForTimeout(400);
  const moves = await p.evaluate(() => {
    const sol = window.__pt.app.active.session.puzzle.solution;
    const cells = [];
    for (let r = 0; r < sol.length && cells.length < 3; r++)
      for (let c = 0; c < sol.length && cells.length < 3; c++) {
        const done = window.__pt.app.active.session.cells[r][c];
        if (sol[r][c] && !done && cells.filter((x) => x.place).length < 2) cells.push({ r, c, place: true });
        else if (!sol[r][c] && !done && !cells.some((x) => !x.place)) cells.push({ r, c, place: false });
      }
    return cells;
  });
  for (const m of moves) {
    if (m.place) await p.dblclick(`.cell[data-r="${m.r}"][data-c="${m.c}"]`, { delay: 70 });
    else await p.click(`.cell[data-r="${m.r}"][data-c="${m.c}"]`);
    await p.waitForTimeout(250);
  }
  const before = await p.evaluate(() => JSON.stringify(window.__pt.app.active.session.cells));
  await kill(p);
  p = await open();
  await waitFor(p, '[data-act="continue"]');
  const resumeLabel = await p.textContent('[data-act="continue"]');
  await p.click('[data-act="continue"]');
  await waitFor(p, '.board .cell');
  await p.waitForTimeout(300);
  const after = await p.evaluate(() => JSON.stringify(window.__pt.app.active?.session.cells ?? null));
  check('force-closed mid-board (two animals and a ✕): reopened, Resume brings back exactly those moves (D46)', moves.length === 3 && /Resume/i.test(resumeLabel ?? '') && after === before, JSON.stringify({ moves, resumeLabel, same: after === before }));

  // Killed the moment a board is solved: reopened, the win's coins and the level are there
  // once: not lost, not paid again, and the solved board isn't offered to resume.
  const solved = await p.evaluate(() => {
    const sol = window.__pt.app.active.session.puzzle.solution;
    const todo = [];
    for (let r = 0; r < sol.length; r++) for (let c = 0; c < sol.length; c++) if (sol[r][c] && window.__pt.app.active.session.cells[r][c] !== sol[r][c]) todo.push([r, c]);
    return todo;
  });
  for (const [r, c] of solved) {
    await p.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 70 });
    await p.waitForTimeout(120);
  }
  // The instant the solve is recorded (an ordinary win's Next, or an arrival's Meet, may not even be drawn yet).
  const won = await p.waitForFunction(() => window.__pt.app.save.journey.nextLevel === 13, null, { timeout: 8000, polling: 'raf' }).then((h) => (h.dispose(), true), () => false);
  const atWin = await p.evaluate(() => ({ coins: window.__pt.app.coins(), next: window.__pt.app.save.journey.nextLevel, paid: window.__pt.app.save.inventory.ledger.filter((e) => e.source === 'journey').length }));
  await kill(p);
  p = await open();
  await p.waitForTimeout(600);
  const reopened = await p.evaluate(() => ({ coins: window.__pt.app.coins(), next: window.__pt.app.save.journey.nextLevel, paid: window.__pt.app.save.inventory.ledger.filter((e) => e.source === 'journey').length }));
  const resumeAfterWin = await p.evaluate(() => document.querySelector('[data-act="continue"]')?.textContent ?? '');
  check(
    'force-closed the moment a board is solved: reopened, its coins and the next level are there once, and it isn’t offered to resume (D46)',
    won && atWin.next === 13 && JSON.stringify(reopened) === JSON.stringify(atWin) && !/Resume/i.test(resumeAfterWin),
    JSON.stringify({ won, atWin, reopened, resumeAfterWin }),
  );

  // Killed during a Welcome Parade, and during the walk: the save is whole and pays nothing twice; the Farm opens.
  await p.evaluate(async () => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    tools.skipToLevel(a.save, 40);
    tools.finishOpenHomes(a.save);
    a.save.settings.toys3d = true;
    a.save.settings.celebrations = 'full';
    a.applySettings();
    a.persist();
  });
  // One ordinary relaunch first: the startup catch-up hands out the skipped levels' gifts (as the tester shortcut does).
  await p.reload();
  await p.waitForFunction(() => window.__pt).then((h) => h.dispose());
  await p.waitForTimeout(500);
  const r0 = await rewards(p);
  await p.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm', welcome: ['cotton'] }));
  await waitFor(p, '.sanctuary__scene.is-parading', 8000);
  await p.waitForTimeout(1500);
  await kill(p);
  p = await open();
  const r1 = await rewards(p);
  await p.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await waitFor(p, '.region .sanctuary__scene svg');
  await p.waitForTimeout(2200);
  await tapAt(p, '.sanctuary__scene [data-act="walk"]');
  await waitFor(p, '.walk canvas.walk__canvas');
  await p.waitForTimeout(600);
  await kill(p);
  p = await open();
  const r2 = await rewards(p);
  await p.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  const farm = await waitFor(p, '.region .sanctuary__scene.has-3d', 10000);
  const parading = await p.evaluate(() => !!document.querySelector('.is-parading, .walk'));
  check('force-closed during a parade and during the walk: the save is unchanged, and the Farm opens plainly with its toys (D46)', r1 === r0 && r2 === r0 && farm && !parading, JSON.stringify({ same1: r1 === r0, same2: r2 === r0, farm, parading }));
  await ctx.close();
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
    if (process.env.D46_ONLY !== 'kill') await d46Checks({ browser, URL, check, errors });
    await forceCloseChecks({ browser, URL, check, errors });
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
