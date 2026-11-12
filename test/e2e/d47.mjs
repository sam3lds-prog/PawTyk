// D47 browser checks: the meadow and the Farm's things in 3D, photo mode and postcards, and what D47 changed about
// losing a board. Called from smoke.mjs; `node test/e2e/d47.mjs` runs them alone (same dev server, E2E_URL,
// CHROME_PATH).

/** Waits for a condition in the page without holding on to anything (a held handle keeps a canvas alive). */
const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);

/** A 320 × 568 page (the smallest iPhone). */
async function page(browser, URL, errors, size = { width: 320, height: 568 }) {
  const qa = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d47] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
  // D49/D50: the scene's own moments (a hello, an animal moment) come by themselves; these checks need the Farm
  // exactly at rest after each thing the player does (a postcard session can outlast the first moment's wait), so they
  // are off here, as in D46's checks. Their own checks are in d49.mjs and d50.mjs.
  await qa.evaluate(async () => (await import('/src/ui/components/animalMoments.ts')).setMomentsEnabled(false));
  return qa;
}

/** The Farm, everyone home, every stage built. */
async function openFarm(qa, o = {}) {
  await qa.evaluate(async (o) => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
    if ((a.save.journey.nextLevel ?? 1) < 81) tools.skipToLevel(a.save, 81);
    for (let i = 0; i < 4; i++) tools.finishOpenHomes(a.save);
    a.save.settings.toys3d = o.toys3d ?? true;
    a.save.settings.reducedMotion = o.motion ?? 'full';
    a.applySettings();
    a.persist();
    window.__pt.go({ screen: 'region', id: 'farm' });
  }, o);
  await waitFor(qa, '.region .sanctuary__scene [data-act="photo"]:not([hidden])', 30000);
  if (o.toys3d ?? true) await until(qa, () => !!document.querySelector('.sanctuary__scene.has-3d'), null, 20000);
  // A new stage's celebration may start by itself: let it go by (Skip), so the scene is at rest.
  await until(
    qa,
    () => {
      document.querySelector('.parade-skip')?.click();
      return !document.querySelector('.is-parading, .is-starting') && (window.__director?.waiting ?? 0) === 0;
    },
    null,
    30000,
  );
}

/** A real tap, as d46's: scrolled to the middle and hit-tested first. */
async function tapAt(qa, selector) {
  const reachable = await qa.evaluate((s) => {
    const el = document.querySelector(s);
    if (!el || el.hidden) return false;
    el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) return false;
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return !!hit && (hit === el || el.contains(hit));
  }, selector);
  if (!reachable) {
    if (process.env.D47_DEBUG) console.log('unreachable', selector, await qa.evaluate((s) => { const el = document.querySelector(s); if (!el) return 'missing'; const r = el.getBoundingClientRect(); const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return `${el.hidden} ${r.width}x${r.height} hit=${hit?.parentElement?.outerHTML.slice(0, 200)}`; }, selector));
    return false;
  }
  try {
    await qa.click(selector, { timeout: 10000, noWaitAfter: true });
    return true;
  } catch (e) {
    if (process.env.D47_DEBUG) console.log('click failed', selector, String(e).slice(0, 300));
    return false;
  }
}

/** The postcard on show: its size in pixels. */
const shownCard = (qa) =>
  qa.evaluate(async () => {
    const img = document.querySelector('.postcard-sheet__img');
    if (!img) return null;
    await img.decode().catch(() => {});
    return { w: img.naturalWidth, h: img.naturalHeight };
  });

export async function d47Checks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- photo mode on a home (PR 5)
  {
    const qa = await page(browser, URL, errors);
    await openFarm(qa);
    const opened = await tapAt(qa, '.sanctuary__scene [data-act="photo"]');
    await waitFor(qa, '.photo-mode');
    const inMode = await qa.evaluate(() => ({
      owner: window.__director?.owner ?? null,
      tour: getComputedStyle(document.querySelector('.sanctuary__scene .scene-tour')).display,
      walk: getComputedStyle(document.querySelector('.sanctuary__scene .scene-walk')).display,
      frames: [...document.querySelectorAll('[data-frame]')].map((b) => b.textContent),
      docked: !!document.querySelector('.photo-dock .photo-mode__panel'),
    }));
    // Three postcards in a row (landscape, portrait, unsigned), each shown, then Take another.
    const cards = [];
    for (const step of ['landscape', 'portrait', 'unsigned']) {
      if (step === 'portrait') await tapAt(qa, '[data-orient="portrait"]');
      if (step === 'unsigned') await qa.evaluate(() => document.querySelector('[data-photo-sign]').click());
      await tapAt(qa, '[data-act="photo-take"]');
      await waitFor(qa, '.postcard-sheet__img', 20000);
      cards.push(await shownCard(qa));
      await tapAt(qa, '[data-act="pc-again"]');
      await until(qa, () => !document.querySelector('.postcard-sheet'), null);
    }
    await tapAt(qa, '[data-act="photo-done"]');
    await until(qa, () => !document.querySelector('.photo-mode'), null);
    await qa.waitForTimeout(700);
    const after = await qa.evaluate(() => ({
      owner: window.__director?.owner ?? null,
      photo: !!document.querySelector('.photo-mode, .photo-dock, .postcard-sheet'),
      button: !document.querySelector('.sanctuary__scene [data-act="photo"]').hidden,
      canvases: document.querySelectorAll('canvas').length,
      stats: window.__photoStats,
    }));
    check(
      'photo mode on the Farm: the camera is its own, the scene’s buttons step aside, framings for the home, everyone and each animal (D47)',
      opened && inMode.owner === 'photo' && inMode.tour === 'none' && inMode.walk === 'none' && inMode.docked && inMode.frames[0] === 'Whole home' && inMode.frames.length >= 3,
      JSON.stringify(inMode),
    );
    check(
      'three postcards in a row: landscape 1500 × 1000, portrait 1080 × 1350, unsigned; Done puts the Farm back with nothing kept (D47)',
      cards[0]?.w === 1500 && cards[0]?.h === 1000 && cards[1]?.w === 1080 && cards[1]?.h === 1350 && cards[2]?.w === 1080 && after.owner === null && !after.photo && after.button && after.canvases <= 1 && after.stats.urls === after.stats.revoked && after.stats.made === after.stats.freed,
      JSON.stringify({ cards, after }),
    );

    // Leaving the screen the instant the shutter is pressed: nothing shows afterwards, nothing breaks.
    await tapAt(qa, '.sanctuary__scene [data-act="photo"]');
    await waitFor(qa, '.photo-mode');
    await qa.evaluate(() => {
      document.querySelector('[data-act="photo-take"]').click();
      window.__pt.go({ screen: 'journey' });
    });
    await qa.waitForTimeout(2500);
    const gone = await qa.evaluate(() => ({ sheet: !!document.querySelector('.postcard-sheet'), photo: !!document.querySelector('.photo-mode'), screen: window.__pt.app.router.route?.screen }));
    check('leaving during a capture: no postcard appears afterwards, the app is where the player went (D47)', !gone.sheet && !gone.photo && gone.screen === 'journey', JSON.stringify(gone));
    await qa.close();
  }

  // ---------------------------------------------------------------- without 3D toys: the drawn animals are in the picture
  {
    const qa = await page(browser, URL, errors);
    await openFarm(qa, { toys3d: false });
    await tapAt(qa, '.sanctuary__scene [data-act="photo"]');
    await waitFor(qa, '.photo-mode');
    await tapAt(qa, '[data-act="photo-take"]');
    const ok = await waitFor(qa, '.postcard-sheet__img', 20000);
    const card = ok ? await shownCard(qa) : null;
    // The picture has the drawn animals: the frozen copy keeps them visible (they aren't hidden behind toys).
    const drawn = await qa.evaluate(async () => {
      const { freezeSvg } = await import('/src/ui/components/sceneCapture.ts');
      const m = freezeSvg(document.querySelector('.sanctuary__scene svg'), 600, 500);
      return /sanctuary__pet/.test(m) && !/sanctuary__pet[^>]*style="[^"]*opacity:\s*0[;"]/.test(m);
    });
    check('with 3D off (or no WebGL), postcards are made from the drawn Farm, animals and all (D47)', card?.w === 1500 && drawn, JSON.stringify({ card, drawn }));
    await qa.close();
  }

  // ---------------------------------------------------------------- photo mode on the walk
  {
    const qa = await page(browser, URL, errors);
    await openFarm(qa);
    const walked = await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
    const drew = await until(qa, () => window.__walk?.drawn > 2 && !!document.querySelector('[data-act="walk-photo"]:not([hidden])'), null, 30000);
    const tapped = await tapAt(qa, '[data-act="walk-photo"]');
    const inPhoto = await waitFor(qa, '.walk .photo-mode');
    if (!inPhoto) throw new Error(`walk photo mode didn't open: ${JSON.stringify({ walked, drew, tapped })}`);
    const hidden = await qa.evaluate(() => ({ pad: getComputedStyle(document.querySelector('.walk__pad')).display, top: getComputedStyle(document.querySelector('.walk__top')).display }));
    await tapAt(qa, '[data-orient="portrait"]');
    await tapAt(qa, '[data-act="photo-take"]');
    await waitFor(qa, '.postcard-sheet__img', 20000);
    const card = await shownCard(qa);
    await tapAt(qa, '[data-act="pc-done"]');
    await until(qa, () => !document.querySelector('.photo-mode'), null);
    // Escape leaves photo mode first, and only then the walk.
    await tapAt(qa, '[data-act="walk-photo"]');
    await waitFor(qa, '.walk .photo-mode');
    await qa.keyboard.press('Escape');
    await qa.waitForTimeout(300);
    const esc1 = await qa.evaluate(() => ({ photo: !!document.querySelector('.photo-mode'), walk: !!document.querySelector('.walk') }));
    const back = await qa.evaluate(() => ({ pad: getComputedStyle(document.querySelector('.walk__pad')).display, canvases: document.querySelectorAll('.walk canvas').length }));
    await qa.keyboard.press('Escape');
    await until(qa, () => !document.querySelector('.walk'), null);
    check(
      'photo mode on the 3D walk: its controls step aside, a portrait postcard of what the player sees, then the walk is as it was; Escape leaves photo mode before the walk (D47)',
      hidden.pad === 'none' && hidden.top === 'none' && card?.w === 1080 && card?.h === 1350 && !esc1.photo && esc1.walk && back.pad !== 'none' && back.canvases === 1,
      JSON.stringify({ hidden, card, esc1, back }),
    );
    await qa.close();
  }
}

/** A Journey board on the page, everything about it known, at level `level`. */
async function startLevel(qa, level, pantry = {}) {
  await qa.evaluate(
    async ({ level, pantry }) => {
      const a = window.__pt.app;
      const tools = await import('/src/app/qaTools.ts');
      Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
      tools.skipToLevel(a.save, level);
      for (const [k, n] of Object.entries(pantry)) tools.setPantry(a.save, k, n);
      a.persist();
      window.__pt.start({ kind: 'level', level });
    },
    { level, pantry },
  );
  await waitFor(qa, '.board .cell');
  await qa.waitForTimeout(500);
}

/** Cells of the board: the empty tiles with no animal in the solution, and the empty ones with one. */
const boardCells = (qa) =>
  qa.evaluate(() => {
    const s = window.__pt.app.active.session;
    const sol = s.puzzle.solution;
    const wrong = [];
    const right = [];
    for (let r = 0; r < sol.length; r++)
      for (let c = 0; c < sol.length; c++) {
        // Empty, and without a mistake mark (a drag passes over those).
        if (s.cells[r][c] || s.errorsAt(r, c).length || s.givenMask[r][c]) continue;
        (sol[r][c] ? right : wrong).push([r, c]);
      }
    return { wrong, right, n: sol.length };
  });
const cellSel = (r, c) => `.cell[data-r="${r}"][data-c="${c}"]`;
const cellAt = (qa, r, c) => qa.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], [r, c]);

/** Three wrong animals, on three different tiles: the board is lost. */
async function loseBoard(qa) {
  const { wrong } = await boardCells(qa);
  for (const [r, c] of wrong.slice(0, 3)) {
    await qa.dblclick(cellSel(r, c), { delay: 70 });
    await qa.waitForTimeout(700);
  }
  return waitFor(qa, '.sheet [data-act="restart"]', 8000);
}

export async function d47IntegratedChecks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- the meadow and the walk's frame budget (PR 1–3)
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await openFarm(qa);
    await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
    await until(qa, () => window.__walk?.drawn > 4, null, 30000);
    const high = await qa.evaluate(() => ({ ...window.__walk.meadowStats, tier: window.__walk.tier }));
    // Idle: the walk draws less often (half rate; twice a second under reduced motion, where nothing moves). A headless
    // browser's own frames are slow, so this is measured under reduced motion, where the gap is long enough to show.
    await qa.evaluate(() => {
      window.__pt.app.save.settings.reducedMotion = 'reduce';
      window.__pt.app.applySettings();
    });
    await qa.waitForTimeout(2000);
    const f0 = await qa.evaluate(() => window.__walk.frameStats);
    await qa.waitForTimeout(2500);
    const f1 = await qa.evaluate(() => window.__walk.frameStats);
    await qa.evaluate(() => {
      window.__pt.app.save.settings.reducedMotion = 'full';
      window.__pt.app.applySettings();
    });
    await qa.evaluate(() => window.__walk.setQuality('lite'));
    await qa.waitForTimeout(400);
    const lite = await qa.evaluate(() => ({ ...window.__walk.meadowStats, tier: window.__walk.tier }));
    await qa.evaluate(() => window.__walk.setQuality('high'));
    await qa.waitForTimeout(300);
    const back = await qa.evaluate(() => window.__walk.meadowStats);
    check(
      'the 3D meadow: a full field of grass, clumps, flowers, clover and butterflies in a few dozen draw calls; the lite tier draws fewer and switching back restores them (D47)',
      high.tier === 'high' && high.field >= 3000 && high.clumps >= 1000 && high.blooms >= 500 && high.butterflies >= 6 && high.drawCalls <= 80 && lite.field < high.field && lite.blooms < high.blooms && lite.butterflies < high.butterflies && back.field === high.field,
      JSON.stringify({ high, lite, back }),
    );
    check(
      // (On a machine whose own frames already come slower than twice a second there is nothing to pass over: then the
      // rate itself is checked.)
      'an idle walk under reduced motion draws about twice a second, passing over the frames in between, and keeps drawing (D47)',
      f1.drawn > f0.drawn && f1.drawn - f0.drawn <= 8 && (f1.skipped > f0.skipped || f1.drawn - f0.drawn <= 7),
      JSON.stringify({ f0, f1 }),
    );
    // Opened and closed five times: one canvas, no errors, the director free.
    for (let i = 0; i < 5; i++) {
      await qa.evaluate(() => document.querySelector('[data-act="walk-close"]')?.click());
      await until(qa, () => !document.querySelector('.walk'), null);
      await tapAt(qa, '.sanctuary__scene [data-act="walk"]');
      await until(qa, () => window.__walk?.drawn > 2, null, 30000);
    }
    const fiveTimes = await qa.evaluate(() => ({ canvases: document.querySelectorAll('.walk canvas').length, walks: document.querySelectorAll('.walk').length }));
    await qa.evaluate(() => document.querySelector('[data-act="walk-close"]')?.click());
    await until(qa, () => !document.querySelector('.walk'), null);
    const closed = await qa.evaluate(() => ({ walkCanvases: document.querySelectorAll('.walk canvas').length, owner: window.__director?.owner ?? null }));
    check('the walk opened and closed five times: one walk, one canvas, all gone after (D47)', fiveTimes.canvases === 1 && fiveTimes.walks === 1 && closed.walkCanvases === 0 && closed.owner === null, JSON.stringify({ fiveTimes, closed }));
    await qa.close();
  }

  // ---------------------------------------------------------------- losing a board on the smallest iPhone (PR 4)
  {
    const qa = await page(browser, URL, errors);
    await startLevel(qa, 12, { life: 0 });
    const lost = await loseBoard(qa);
    const sheet = await qa.evaluate(() => {
      const el = document.querySelector('.sheet');
      const acts = [...el.querySelectorAll('[data-act]')].map((b) => b.dataset.act);
      // Every button fits on screen and is the one a finger would hit.
      const fits = [...el.querySelectorAll('button[data-act]')].every((b) => {
        b.scrollIntoView({ block: 'center' });
        const r = b.getBoundingClientRect();
        const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return r.width >= 200 && r.height >= 40 && r.right <= innerWidth && (hit === b || b.contains(hit));
      });
      return { title: el.querySelector('h2, .sheet__title')?.textContent ?? '', acts, fits, text: el.textContent, buy: !!el.querySelector('[data-buy], .price--gem') };
    });
    check(
      'a lost board on a 320 × 568 screen: "So close!", a short optional video, Try again free and Back to Journey, all within reach; nothing to buy (D47)',
      lost && /So close/.test(sheet.title) && sheet.acts.join() === 'revive,restart,leave' && sheet.fits && !sheet.buy && /Back to Journey/.test(sheet.text) && !/gem|buy|\$/i.test(sheet.text),
      JSON.stringify(sheet),
    );
    // The video, tapped twice: one heart back, granted once, and the board just as it was.
    const before = await qa.evaluate(() => ({ cells: JSON.stringify(window.__pt.app.active.session.cells), grants: window.__pt.app.save.inventory.items.filter((e) => e.id.startsWith('ad:')).length }));
    await qa.evaluate(() => {
      const b = document.querySelector('.sheet [data-act="revive"]');
      b.click();
      b.click();
    });
    await until(qa, () => !document.querySelector('.sheet [data-act="revive"]') && !document.querySelector('.fake-ad'), null, 10000);
    await qa.waitForTimeout(300);
    const revived = await qa.evaluate(() => ({
      hearts: window.__pt.app.active.session.hearts,
      cells: JSON.stringify(window.__pt.app.active.session.cells),
      grants: window.__pt.app.save.inventory.items.filter((e) => e.id.startsWith('ad:')).length,
      lives: window.__pt.app.save.inventory.items.filter((e) => e.item === 'life').reduce((a, e) => a + e.delta, 0),
    }));
    check(
      'a reward video brings back one heart, once, however often it is tapped, with the board as it was (D47)',
      revived.hearts === 1 && revived.cells === before.cells && revived.grants === before.grants + 1 && revived.lives === 0,
      JSON.stringify({ before, revived }),
    );

    // Playing on after it, on the small screen: a drag marks a run of ✕, a tap marks and a slow second tap clears, a
    // double tap places.
    const { wrong, right } = await boardCells(qa);
    const row = wrong[0][0];
    const run = wrong.filter(([r]) => r === row).slice(0, 3);
    const box = (r, c) =>
      qa.$eval(cellSel(r, c), (el) => {
        const b = el.getBoundingClientRect();
        return [b.x + b.width / 2, b.y + b.height / 2];
      });
    let dragged = false;
    if (run.length >= 2 && run.every(([, c], i) => i === 0 || c === run[i - 1][1] + 1)) {
      const a0 = await box(...run[0]);
      const a1 = await box(...run[run.length - 1]);
      await qa.mouse.move(a0[0], a0[1]);
      await qa.mouse.down();
      await qa.mouse.move((a0[0] + a1[0]) / 2, a0[1], { steps: 6 });
      await qa.mouse.move(a1[0], a1[1], { steps: 6 });
      await qa.mouse.up();
      await qa.waitForTimeout(300);
      dragged = (await Promise.all(run.map(([r, c]) => cellAt(qa, r, c)))).every((v) => v === 3);
    } else dragged = 'skipped';
    const t = wrong.find(([r, c]) => !run.some(([a, b]) => a === r && b === c));
    await qa.click(cellSel(...t));
    await qa.waitForTimeout(80);
    const marked = await cellAt(qa, ...t);
    await qa.waitForTimeout(600);
    await qa.click(cellSel(...t));
    await qa.waitForTimeout(80);
    const cleared = await cellAt(qa, ...t);
    await qa.waitForTimeout(600);
    await qa.dblclick(cellSel(...right[0]), { delay: 70 });
    await qa.waitForTimeout(300);
    const placed = await cellAt(qa, ...right[0]);
    check(
      'after the revive, on 320 × 568: a drag marks a run of ✕, a tap marks ✕ and a slow second tap clears it, a double tap places (D47)',
      (dragged === true || dragged === 'skipped') && marked === 3 && cleared === 0 && placed > 0 && placed !== 3,
      JSON.stringify({ run, dragged, marked, cleared, placed }),
    );
    await qa.close();
  }
  {
    // Out of videos and lives: Try again, free, gives the same board fresh with three hearts. Never Auto-✕.
    const qa = await page(browser, URL, errors);
    await startLevel(qa, 14, { life: 0 });
    const id0 = await qa.evaluate(() => window.__pt.app.active.session.puzzle.id ?? JSON.stringify(window.__pt.app.active.session.puzzle.solution));
    const autoBefore = await qa.evaluate(() => JSON.stringify(window.__pt.app.save.settings));
    await loseBoard(qa);
    await tapAt(qa, '.sheet [data-act="restart"]');
    await until(qa, () => !document.querySelector('.sheet') && window.__pt.app.active?.session.hearts === 3, null, 8000);
    const fresh = await qa.evaluate(() => {
      const s = window.__pt.app.active.session;
      return { hearts: s.hearts, id: s.puzzle.id ?? JSON.stringify(s.puzzle.solution), marks: s.cells.flat().filter((v) => v).length };
    });
    const autoAfter = await qa.evaluate(() => JSON.stringify(window.__pt.app.save.settings));
    check(
      'Try again, free: the same board, fresh, three hearts; no setting (Auto-✕ or any other) is switched on (D47)',
      fresh.hearts === 3 && fresh.id === id0 && fresh.marks === 0 && autoAfter === autoBefore,
      JSON.stringify({ fresh, same: fresh.id === id0, settingsSame: autoAfter === autoBefore }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- the Welcome Rescue Pack in the test store (PR 7)
  {
    const qa = await page(browser, URL, errors);
    await qa.evaluate(async () => {
      const a = window.__pt.app;
      const tools = await import('/src/app/qaTools.ts');
      Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
      tools.skipToLevel(a.save, 30);
      tools.finishOpenHomes(a.save);
      a.save.sanctuary.visits = Math.max(1, a.save.sanctuary.visits);
      a.persist();
      window.__pt.go({ screen: 'shop', sanctuary: 'farm' });
    });
    const hl = await waitFor(qa, '[data-pack-highlight]', 8000);
    await tapAt(qa, '[data-act="pack-look"]');
    await waitFor(qa, '[data-buy="welcome_pack"]', 8000);
    const card = await qa.evaluate(() => document.querySelector('[data-welcome-pack]')?.textContent.replace(/\s+/g, ' ').trim());
    const gems0 = await qa.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'gem').reduce((a, e) => a + e.delta, 0));
    await qa.evaluate(() => {
      const b = document.querySelector('[data-buy="welcome_pack"]');
      b.click();
      b.click();
      b.click();
    });
    await until(qa, () => !!document.querySelector('[data-welcome-pack].is-owned'), null, 8000);
    const got = await qa.evaluate(() => {
      const s = window.__pt.app.save;
      return { gems: s.inventory.items.filter((e) => e.item === 'gem').reduce((a, e) => a + e.delta, 0), wagon: !!s.inventory.decor.rescuewagon, shown: !s.sanctuary.hidden.rescuewagon, pack: !!s.purchases.packs?.welcome };
    });
    // The wagon is out on the Farm, drawn and in the walk.
    await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
    const onFarm = await waitFor(qa, '.sanctuary__scene [data-decor="rescuewagon"]', 15000);
    check(
      'Welcome Rescue Pack (test store): offered with the Farm decorations, its contents and price shown; three taps buy it once: +180 gems and the Rescue Wagon out on the Farm (D47)',
      hl && /Rescue Wagon/.test(card) && /180 gems/.test(card) && got.gems - gems0 === 180 && got.wagon && got.shown && got.pack && onFarm,
      JSON.stringify({ hl, card, gems0, got, onFarm }),
    );
    await qa.close();
  }
}

// Run alone: node test/e2e/d47.mjs
if (import.meta.url === `file://${process.argv[1]}`) {
  const { createRequire } = await import('node:module');
  const { chromium } = createRequire(import.meta.url)('playwright');
  const URL = process.env.E2E_URL ?? 'http://localhost:5173/';
  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  const errors = [];
  let failed = 0;
  const check = (name, ok, detail = '') => {
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : `  (${detail})`}`);
  };
  try {
    await d47Checks({ browser, URL, check, errors });
    await d47IntegratedChecks({ browser, URL, check, errors });
  } catch (e) {
    check('d47 ran to completion', false, String(e));
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  process.exit(failed ? 1 : 0);
}
