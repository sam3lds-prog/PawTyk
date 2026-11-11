// D50 browser checks (reward clarity, short-visit delight, a focused return), in a real browser at iPhone sizes:
// a win's one coin headline matches the wallet; the welcome card holds the focus, and while the snack is eaten no
// tap or key can leave or feed twice; a calm Farm visit says hello once (and not again straight after); two ordinary
// wins smile differently; the Journey says the Daily once; Featured brings back what was tried on; and a save from
// before D50 loads and keeps working. Called from smoke.mjs; `node test/e2e/d50.mjs` runs them alone (same dev
// server, E2E_URL, CHROME_PATH). Before/after pictures: docs/screenshots/d50/.

const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);

async function page(browser, URL, errors, size = { width: 320, height: 568 }) {
  const qa = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d50] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
  return qa;
}

/** A player past the tutorial: level `level`, the Farm grown `grow` puzzles, `coins`; then `route`. */
async function setUp(qa, o = {}) {
  await qa.evaluate(async (o) => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    const l = await import('/src/meta/ledger.ts');
    const m = await import('/src/ui/components/animalMoments.ts');
    m.forgetGreetings();
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, loopTipSeen: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true, controlsTipSeen: true, seenPantryIntro: true, usageAsked: true });
    tools.skipToLevel(a.save, o.level ?? 14);
    if (o.grow) tools.growActive(a.save, o.grow);
    if (o.coins) l.grant(a.save, `e2e:coins:d50:${o.coins}`, o.coins, 'gift');
    for (const [k, v] of Object.entries(o.affection ?? {})) a.save.sanctuary.affection[k] = v;
    a.save.settings.toys3d = false;
    a.save.settings.reducedMotion = o.motion ?? 'full';
    a.save.settings.celebrations = 'short';
    a.applySettings();
    a.persist();
    if (o.route) window.__pt.go(o.route);
  }, o);
}

const sideways = (qa) => qa.evaluate(() => document.scrollingElement.scrollWidth > window.innerWidth + 1);
const coins = (qa) => qa.evaluate(async () => (await import('/src/meta/ledger.ts')).balance(window.__pt.app.save));

/** A home's scene at rest: no celebration starting or playing (Skip pressed if one is). */
async function atRest(qa) {
  await waitFor(qa, '.sanctuary__scene svg', 30000);
  return until(
    qa,
    () => {
      document.querySelector('.parade-skip')?.click();
      return !document.querySelector('.is-parading, .is-starting') && (window.__director?.waiting ?? 0) === 0;
    },
    null,
    30000,
  );
}

/** Solves the board on screen with real double taps; returns once the win sheet is up (past any spotlight). */
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

export async function d50Checks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- PR A: one coin headline, the wallet's own number
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 6, grow: 1 });
    const c0 = await coins(qa);
    await qa.evaluate(() => window.__pt.start({ kind: 'level', level: 6 }));
    await solve(qa);
    const c1 = await coins(qa);
    const win = await qa.evaluate(() => {
      const w = document.querySelector('.win-sheet');
      const head = w.querySelector('[data-win-coins]');
      const play = w.querySelector('[data-act="next"]')?.getBoundingClientRect();
      return {
        total: Number(head?.dataset.total ?? NaN),
        head: w.querySelector('.win-coins__total')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        parts: w.querySelector('[data-win-coin-parts]')?.textContent ?? '',
        errand: w.querySelector('[data-win-errand]')?.textContent ?? '',
        mentions: (w.querySelector('.win-stage-1')?.textContent.match(/Paw Coins/g) ?? []).length,
        playInView: !!play && play.bottom <= window.innerHeight && play.top >= 0,
        mood: w.querySelector('[data-win-mood]')?.dataset.winMood ?? '',
      };
    });
    check(
      'D50 PR A: a win says "+N Paw Coins" once, N is exactly what the wallet rose by, where it came from in one line, the errand without a second figure; Play next on screen at 320×568',
      win.total === c1 - c0 && win.head === `+${win.total} Paw Coins` && win.mentions === 1 && (!win.errand || !/Paw Coins/.test(win.errand)) && (win.parts === '' || /for the puzzle/.test(win.parts)) && win.playInView && !(await sideways(qa)),
      JSON.stringify({ c0, c1, win }),
    );

    // ---------------------------------------------------------------- PR B: the next ordinary win smiles differently
    await qa.evaluate(() => document.querySelector('.win-sheet [data-act="next"]').click());
    await solve(qa);
    const mood2 = await qa.evaluate(() => document.querySelector('.win-sheet [data-win-mood]')?.dataset.winMood ?? '');
    check('D50 PR B: two ordinary wins in a row: a different smile (and a different turn of Tiny Triumph)', !!win.mood && !!mood2 && win.mood !== mood2, JSON.stringify({ first: win.mood, second: mood2 }));
    await qa.close();
  }

  // ---------------------------------------------------------------- PR A: the welcome card in focus, guarded meal
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, grow: 6 });
    const who = await qa.evaluate(() => {
      const ids = Object.keys(window.__pt.app.save.inventory.companions);
      const w = ids[ids.length - 1];
      window.__pt.go({ screen: 'region', id: 'farm', welcome: [w] });
      return w;
    });
    await atRest(qa);
    await waitFor(qa, '[data-welcome-card="offer"]', 20000);
    await qa.waitForTimeout(500);
    const shown = (qa) =>
      qa.evaluate(() => {
        const vis = (sel) => {
          const el = document.querySelector(sel);
          return !!el && !el.hidden && getComputedStyle(el).display !== 'none';
        };
        return { tricks: vis('.scene-tricks'), replay: vis('.scene-replay'), share: vis('.scene-share'), photo: vis('.scene-photo'), tour: vis('.scene-tour'), look: vis('[data-act="welcome-look"]') };
      });
    const focused = await shown(qa);
    await qa.evaluate(() => document.querySelector('[data-welcome-card]')?.scrollIntoView({ block: 'center' }));
    await qa.click('[data-act="welcome-look"]');
    const looked = await shown(qa);
    check(
      'D50 PR A: while the welcome card offers the snack, Replay, Share, Tricks, Photo and Tour step back; Look around first brings them back',
      !focused.replay && !focused.share && !focused.photo && !focused.tour && focused.look && looked.replay && looked.photo && looked.tour && !looked.look,
      JSON.stringify({ focused, looked }),
    );
    // The snack, then every way a player might try to leave or feed again while it is eaten.
    const aff0 = await qa.evaluate((w) => window.__pt.app.save.sanctuary.affection[w] ?? 0, who);
    // From the keyboard: Enter on the snack, then everything a quick (or repeating) key press would do next.
    await qa.focus('[data-act="welcome-snack"]');
    await qa.keyboard.press('Enter');
    await qa.waitForTimeout(150);
    const during = await qa.evaluate(() => ({
      snack: document.querySelector('[data-act="welcome-snack"]')?.disabled,
      cont: document.querySelector('[data-act="welcome-play"]')?.disabled,
      status: document.querySelector('[data-welcome-status]')?.textContent ?? '',
      focus: document.activeElement?.hasAttribute('data-welcome-status') ?? false,
    }));
    const aff1 = await qa.evaluate((w) => window.__pt.app.save.sanctuary.affection[w] ?? 0, who);
    for (const k of ['Enter', 'Enter', ' ', 'Tab', 'Enter']) await qa.keyboard.press(k);
    await qa.evaluate(() => document.querySelector('[data-act="welcome-play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    const stayed = await qa.evaluate(() => !!document.querySelector('.region') && !document.querySelector('.game'));
    const aff2 = await qa.evaluate((w) => window.__pt.app.save.sanctuary.affection[w] ?? 0, who);
    const fed = await waitFor(qa, '[data-welcome-card="fed"]', 10000);
    const ready = await qa.evaluate(() => ({ enabled: document.querySelector('[data-act="welcome-play"]')?.disabled === false, focus: document.activeElement?.dataset.act ?? '' }));
    await qa.keyboard.press('Enter');
    const left = await waitFor(qa, '.game, .board', 8000);
    check(
      'D50 PR A: Enter starts the snack; while it is eaten its buttons are disabled, say so and hold focus; more keys and clicks change nothing (still on the Farm, fed once); then Enter on Continue goes on',
      during.snack === true && during.cont === true && /having the snack/.test(during.status) && during.focus && aff1 > aff0 && aff2 === aff1 && stayed && fed && ready.enabled && ready.focus === 'welcome-play' && left,
      JSON.stringify({ during, aff0, aff1, aff2, stayed, fed, ready, left }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR B: a calm visit says hello, once
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, grow: 6, affection: { truffle: 4 } });
    // The first visit after growing is the newcomers' (their own hello); then a calm visit.
    await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
    await atRest(qa);
    await qa.evaluate(async () => {
      window.__pt.go({ screen: 'journey' });
      (await import('/src/ui/components/animalMoments.ts')).forgetGreetings();
      window.__pt.go({ screen: 'region', id: 'farm' });
    });
    await atRest(qa);
    const t0 = Date.now();
    const greeted = await waitFor(qa, '.sanctuary__chat.is-greeting', 6000);
    const took = Date.now() - t0;
    const hello = await qa.evaluate(() => ({ line: document.querySelector('.sanctuary__chat span')?.textContent ?? '', tricks: [...document.querySelectorAll('.sanctuary__scene [data-trick]')].map((g) => `${g.dataset.friend ?? g.dataset.pet}:${g.dataset.trick}`) }));
    // Away and straight back: no second hello from the Farm for a while.
    await qa.evaluate(() => window.__pt.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' }));
    await qa.waitForTimeout(300);
    await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
    await atRest(qa);
    const again = await waitFor(qa, '.sanctuary__chat.is-greeting', 6500);
    check(
      'D50 PR B: a calm Farm visit: one animal says hello within a few seconds (a friend one hello from a warmer hello comes first), and not again straight after',
      greeted && took < 5000 && hello.line === 'Truffle is hoping you’ll say hello.' && hello.tricks.length === 1 && !again,
      JSON.stringify({ greeted, took, hello, again }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR C: the Journey says the Daily once
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 14, grow: 6, affection: { cotton: 4 }, route: { screen: 'journey' } });
    await waitFor(qa, '.hero .continue__go', 20000);
    const hub = await qa.evaluate(() => {
      const fold = document.querySelector('[data-more-play]');
      fold.open = true;
      return {
        dailies: document.querySelectorAll('.daily-card').length,
        note: !!fold.querySelector('[data-daily-above]'),
        friend: document.querySelector('.today [data-today="friend"]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        playBottom: document.querySelector('.continue__go').getBoundingClientRect().bottom,
        vh: window.innerHeight,
      };
    });
    check(
      'D50 PR C: the Journey offers today’s Daily once (the fold keeps the week); the friend row says what a hello does; Play above the fold at 320×568',
      hub.dailies === 1 && hub.note && /Say hello to Cotton/.test(hub.friend) && /One hello at the Farm and you’re friends: a warmer hello/.test(hub.friend) && hub.playBottom <= hub.vh && !(await sideways(qa)),
      JSON.stringify(hub),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR C + D: Featured remembers a try, across a reload
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, grow: 6, coins: 400, route: { screen: 'shop', tab: 'decor', sanctuary: 'farm' } });
    await waitFor(qa, '.featured-card--lead', 15000);
    const lead0 = await qa.evaluate(() => ({ id: document.querySelector('.featured-card--lead')?.dataset.decor ?? '', reason: document.querySelector('.featured-card--lead small')?.textContent ?? '' }));
    const pick = await qa.evaluate(async (lead) => {
      const d = await import('/src/meta/catalogs/decor.ts');
      const s = await import('/src/meta/sanctuary.ts');
      const x = d.DECOR.find((p) => d.decorHome(p) === 'farm' && p.id !== lead && s.decorPrice(p.id)?.currency === 'coins' && s.decorPrice(p.id).amount <= 400 && !p.slot && !s.owns(window.__pt.app.save, p.id));
      return x?.id ?? '';
    }, lead0.id);
    await qa.evaluate((id) => window.__pt.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: id }), pick);
    await waitFor(qa, '.decor-sheet [data-act="try"]');
    await qa.click('.decor-sheet [data-act="try"]');
    await waitFor(qa, '.region .sanctuary__scene svg', 15000);
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    await qa.evaluate(() => window.__pt.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' }));
    await waitFor(qa, '.featured-card--lead', 15000);
    const lead1 = await qa.evaluate(() => ({ id: document.querySelector('.featured-card--lead')?.dataset.decor ?? '', reason: document.querySelector('.featured-card--lead small')?.textContent ?? '', tried: window.__pt.app.save.offers?.tried ?? [] }));
    check(
      'D50 PR C: Featured leads with what the animals would use; after Try it in my Farm (and a reload) the tried piece leads, saying so',
      /will play with it|tried it on|set/.test(lead0.reason) && lead1.id === pick && lead1.reason === 'You tried it on in your Farm' && lead1.tried[0] === `decor:${pick}`,
      JSON.stringify({ lead0, pick, lead1 }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR D: a save from before D50 keeps working
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 30, grow: 9, coins: 250 });
    // (The first launch after skipping levels pays them in, as any older save's would: settle that first.)
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    // As D49 wrote it: no `offers.tried`, a welcome offer counter.
    await qa.evaluate(() => {
      const a = window.__pt.app;
      a.save.offers = { welcome: { shown: 1, lastAt: new Date().toISOString(), dismissed: false } };
      delete a.save.offers.tried;
      a.persist();
    });
    const before = await qa.evaluate(() => ({ coins: window.__pt.app.coins(), level: window.__pt.app.save.journey.nextLevel, homes: Object.keys(window.__pt.app.save.inventory.companions).length }));
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    const after = await qa.evaluate(() => ({ coins: window.__pt.app.coins(), level: window.__pt.app.save.journey.nextLevel, homes: Object.keys(window.__pt.app.save.inventory.companions).length, offers: window.__pt.app.save.offers }));
    await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
    const farm = await atRest(qa);
    await qa.evaluate(() => window.__pt.go({ screen: 'journey' }));
    const hub = await waitFor(qa, '.hero .continue__go', 15000);
    check(
      'D50 PR D: a save from before D50 reloads as it was (coins, level, animals, offers; no new record), and the Farm and Journey open',
      after.coins === before.coins && after.level === before.level && after.homes === before.homes && after.offers?.welcome?.shown === 1 && after.offers?.tried === undefined && farm && hub,
      JSON.stringify({ before, after, farm, hub }),
    );
    await qa.close();
  }
}

// Run alone: `node test/e2e/d50.mjs`.
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
    await d50Checks({ browser, URL, check, errors });
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
