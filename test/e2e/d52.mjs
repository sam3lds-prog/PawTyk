// D52 browser checks (player clarity, the world ahead, animal questions, honest videos), in a real browser at iPhone
// sizes: a win counts Hazel down in one sentence that fits 320 points; the World says the six homes aren't the end;
// the tester's place browser reaches place 9999 without touching the save (also across a reload), and a sandbox visit
// hands the own save back; an Animal question from the album answers kindly and pays nothing; the out-of-hints offer
// says what a video earns, and a test video closed early earns nothing while the board plays on. Called from
// smoke.mjs; `node test/e2e/d52.mjs` runs them alone (same dev server, E2E_URL, CHROME_PATH). With SHOTS=<dir>, saves
// the pictures in docs/screenshots/d52/.

const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);
const shot = async (qa, name) => {
  if (process.env.SHOTS) await qa.screenshot({ path: `${process.env.SHOTS}/${name}.png` });
};

async function page(browser, URL, errors, size = { width: 320, height: 568 }) {
  const qa = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d52] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
  return qa;
}

/** A player past the tutorial at `level`; the Farm's animals before Hazel home, grown `farm`; then `route`. */
async function setUp(qa, o = {}) {
  await qa.evaluate(async (o) => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    const m = await import('/src/ui/components/animalMoments.ts');
    m.forgetGreetings();
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, loopTipSeen: true, worldTipSeen: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true, controlsTipSeen: true, seenPantryIntro: true, usageAsked: true, growthNoteSeen: !!o.noteSeen });
    tools.skipToLevel(a.save, o.level ?? 14);
    if (o.farm !== undefined) {
      for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold']) a.save.inventory.companions[id] ??= { unlockedAt: '2026-11-01T00:00:00.000Z' };
      a.save.world.growth.farm = o.farm;
      a.save.world.active = 'farm';
    }
    a.save.settings.toys3d = false;
    a.save.settings.celebrations = 'short';
    a.applySettings();
    a.persist();
    if (o.route) window.__pt.go(o.route);
  }, o);
}

const sideways = (qa) => qa.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth + 1);
const saveJson = (qa) => qa.evaluate(() => JSON.stringify(window.__pt.app.save));
const stored = (qa) => qa.evaluate(() => localStorage.getItem('pawtopia.save.v2'));

async function solve(qa) {
  await waitFor(qa, '.cell');
  const sol = await qa.evaluate(() => window.__pt.app.active.session.puzzle.solution);
  for (let r = 0; r < sol.length; r++)
    for (let c = 0; c < sol.length; c++) {
      if (!sol[r][c]) continue;
      const cells = await qa.evaluate(() => window.__pt.app.active?.session.cells);
      if (!cells || cells[r][c] === sol[r][c]) continue;
      const pick = await qa.$(`[data-tool="${sol[r][c] === 1 ? 'cat' : 'dog'}"]`);
      if (pick) await pick.click();
      await qa.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 70 });
    }
  await waitFor(qa, '.win-sheet, .spotlight', 10000);
  if (await qa.$('.spotlight')) await qa.click('.spotlight');
  await waitFor(qa, '.win-sheet', 10000);
  await qa.waitForTimeout(900);
}

/** The win's sentence, whether it fits its row, and what a screen reader gets. */
const winLine = (qa) =>
  qa.evaluate(() => {
    const w = document.querySelector('.win-sheet');
    const line = w?.querySelector('.win-next-friend .win-comes-home');
    const row = line?.closest('.win-next-friend');
    const r = line?.getBoundingClientRect();
    const rr = row?.getBoundingClientRect();
    return {
      text: line?.textContent ?? '',
      fits: !!r && !!rr && r.right <= rr.right + 1 && r.left >= rr.left - 1 && rr.right <= window.innerWidth,
      bars: row?.querySelectorAll('[role="progressbar"]').length ?? -1,
      arrows: /→|closer/.test(w?.querySelector('.win-stage-1')?.textContent ?? ''),
    };
  });

export async function d52Checks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- PR A: Hazel, counted down in one sentence
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 19, farm: 19 });
    await qa.evaluate(() => window.__pt.start({ kind: 'level', level: 19 }));
    await solve(qa);
    const six = await winLine(qa);
    const note = await qa.evaluate(() => document.querySelector('[data-growth-note]')?.textContent ?? '');
    await shot(qa, 'after-win-320');
    await qa.evaluate(() => document.querySelector('.win-sheet [data-act="next"]').click());
    await qa.evaluate(() => (window.__pt.app.save.world.growth.farm = 21));
    await solve(qa);
    const four = await winLine(qa);
    await qa.evaluate(() => document.querySelector('.win-sheet [data-act="next"]').click());
    await qa.evaluate(() => (window.__pt.app.save.world.growth.farm = 24));
    await solve(qa);
    const one = await winLine(qa);
    check(
      'D52 PR A: at 320 points a win says "Hazel the pony comes home in 6 more puzzles.", then "Hazel comes home in 4 more puzzles.", then "One more puzzle and Hazel is home!"; one sentence that fits, no arrow, no "closer", the bar silent',
      six.text === 'Hazel the pony comes home in 6 more puzzles.' &&
        four.text === 'Hazel comes home in 4 more puzzles.' &&
        one.text === 'One more puzzle and Hazel is home!' &&
        [six, four, one].every((l) => l.fits && l.bars === 0 && !l.arrows) &&
        !(await sideways(qa)),
      JSON.stringify({ six, four, one }),
    );
    check('D52 PR A: the first ordinary win says once which puzzles grow a home', /New Journey, Daily and Zen puzzles grow your homes/.test(note), note);
    await qa.close();
  }

  // ---------------------------------------------------------------- PR B: the six homes are only the beginning
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 5, route: { screen: 'world' } });
    await waitFor(qa, '[data-world-ahead]');
    const early = await qa.textContent('[data-world-ahead]');
    await qa.evaluate(() => document.querySelector('[data-world-ahead]').scrollIntoView({ block: 'center' }));
    await shot(qa, 'after-world-ahead-390');
    await setUp(qa, { level: 61, route: { screen: 'journey' } });
    await qa.evaluate(() => window.__pt.go({ screen: 'world' }));
    await waitFor(qa, '[data-world-ahead]');
    const sixth = await qa.textContent('[data-world-ahead]');
    check(
      'D52 PR B: the World says the first six homes are just the beginning, then when the first new place opens (level 80, or sooner)',
      /^Your first six homes are just the beginning\./.test(early ?? '') && /^A new place opens after level 80 — or sooner if you finish your current homes\.$/.test(sixth ?? ''),
      JSON.stringify({ early, sixth }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR B: Browse future places, read-only; the sandbox
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, route: { screen: 'journey' } });
    // The skipped levels' gifts arrive with the next launch (startup catch-up): let them, then look.
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    const before = await saveJson(qa);
    const was = await stored(qa);
    await qa.evaluate(async () => {
      const { showPlaceBrowser } = await import('/src/ui/components/placeBrowser.ts');
      showPlaceBrowser(window.__pt.app.router.scope);
    });
    await waitFor(qa, '.qa-places-sheet [data-place-name]');
    await qa.click('[data-place-go="9999"]');
    const name9999 = await qa.textContent('[data-place-name]');
    await qa.fill('[data-place-input]', '12');
    await qa.press('[data-place-input]', 'Enter');
    await qa.click('[data-place-stage="3"]');
    const stage = await qa.textContent('[data-stage-line]');
    await shot(qa, 'after-place-browser-390');
    const scenes = await qa.evaluate(() => document.querySelectorAll('.qa-place__scene svg').length);
    const same = (await saveJson(qa)) === before && (await stored(qa)) === was;
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    // A launch writes its own bookkeeping (sessions, the day); what browsing could have touched is unchanged.
    const core = (j) => {
      const x = JSON.parse(j);
      return JSON.stringify([x.journey, x.world, x.inventory, x.sanctuary, x.trivia ?? null]);
    };
    const sameAfterReload = core(await stored(qa)) === core(was);
    check(
      'D52 PR B: Browse future places reaches place 9999 and place 12 at stage 3, one place drawn at a time; the save and storage are untouched, also after a reload',
      !!name9999 && /^Stage 3: /.test(stage ?? '') && scenes === 1 && same && sameAfterReload,
      JSON.stringify({ name9999, stage, scenes, same, sameAfterReload }),
    );
    // A sandbox visit, then a tab: the own save back, nothing written.
    const before2 = await saveJson(qa);
    const was2 = await stored(qa);
    await qa.evaluate(async () => {
      const { enterSandbox } = await import('/src/app/qaSandbox.ts');
      enterSandbox(12, 'growing');
    });
    await waitFor(qa, '[data-qa-sandbox]');
    await waitFor(qa, '.region .sanctuary__scene svg', 20000);
    const inside = await qa.evaluate(() => ({ route: window.__pt.app.router.route, banner: document.querySelector('[data-qa-sandbox]')?.textContent ?? '' }));
    await shot(qa, 'after-sandbox-390');
    await qa.evaluate(() => {
      window.__pt.app.save.journey.nextLevel = 9000;
      window.__pt.app.persist();
    });
    const whileIn = await stored(qa);
    await qa.click('[data-act="leave-sandbox"]');
    await qa.waitForTimeout(200);
    const after2 = await saveJson(qa);
    check(
      'D52 PR B: a sandbox visit opens place 12 with its banner, writes nothing while in front, and Leave preview gives the own save back unchanged',
      inside.route?.screen === 'region' && inside.route?.id === 'p12' && /Sandbox preview · Place 12/.test(inside.banner) && whileIn === was2 && after2 === before2 && !(await qa.$('[data-qa-sandbox]')),
      JSON.stringify({ inside, wrote: whileIn !== was2, same: after2 === before2 }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR C: an Animal question from the album
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, farm: 13, route: { screen: 'pets' } });
    await waitFor(qa, '[data-act="trivia"]');
    const coins0 = await qa.evaluate(async () => (await import('/src/meta/ledger.ts')).balance(window.__pt.app.save));
    await qa.click('[data-act="trivia"]');
    await waitFor(qa, '.trivia-sheet [data-choice]');
    const id = await qa.evaluate(() => document.querySelector('[data-trivia]').dataset.trivia);
    const answer = await qa.evaluate(async (id) => (await import('/src/meta/trivia.ts')).triviaQuestions().find((q) => q.id === id).answer, id);
    await qa.click(`[data-choice="${(answer + 1) % 3}"]`);
    const wrong = await qa.textContent('[data-trivia-result]');
    await shot(qa, 'after-animal-question-390');
    await qa.click('[data-act="another"]');
    const id2 = await qa.evaluate(() => document.querySelector('[data-trivia]').dataset.trivia);
    const coins1 = await qa.evaluate(async () => (await import('/src/meta/ledger.ts')).balance(window.__pt.app.save));
    check(
      'D52 PR C: an Animal question from the album: a wrong answer gets "Good guess!" and the fact, Another question asks a different one, and nothing is paid',
      /^Good guess! /.test(wrong ?? '') && id2 !== id && coins1 === coins0 && !(await sideways(qa)),
      JSON.stringify({ id, id2, wrong, coins0, coins1 }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR D: the offer says what it earns; closed early
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 14 });
    await qa.evaluate(async () => {
      const tools = await import('/src/app/qaTools.ts');
      tools.setPantry(window.__pt.app.save, 'hint', 0);
      window.__pt.start({ kind: 'level', level: 6 });
    });
    await waitFor(qa, '.cell');
    for (let i = 0; i < 6 && !(await qa.$('[data-video-offer]')); i++) {
      await qa.click('[data-act="hint"]');
      await qa.waitForTimeout(250);
    }
    const offer = await qa.evaluate(() => ({ text: document.querySelector('[data-video-offer]')?.textContent ?? '', watch: document.querySelector('.sheet [data-act="watch"]')?.textContent ?? '', video: !!document.querySelector('.fake-ad') }));
    await shot(qa, 'after-video-offer-320');
    await qa.click('.sheet [data-act="watch"]');
    await waitFor(qa, '.fake-ad__close');
    await qa.click('.fake-ad__close');
    await waitFor(qa, '.toast');
    const toast = await qa.textContent('.toast');
    const after = await qa.evaluate(async () => ({ hints: (await import('/src/meta/items.ts')).itemBalance(window.__pt.app.save, 'hint'), paused: window.__pt.app.active.session.paused, sheet: !!document.querySelector('.sheet') }));
    check(
      'D52 PR D: out of hints, the offer says "Need one more hint? Watch an optional video to earn +1 hint." before anything plays; a test video closed early earns nothing, says so, and the board plays on',
      offer.text === 'Need one more hint? Watch an optional video to earn +1 hint.' && offer.watch === 'Watch video' && !offer.video && /ended early/.test(toast ?? '') && after.hints === 0 && !after.paused && !after.sheet,
      JSON.stringify({ offer, toast, after }),
    );
    await qa.close();
  }
}

// Run alone: `node test/e2e/d52.mjs`.
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
    await d52Checks({ browser, URL, check, errors });
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
