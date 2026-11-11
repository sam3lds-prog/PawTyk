// M browser checks (monetization, discovery and growth): M1's Featured row and trying a decoration and a trick on in
// the home itself (nothing changes, Back to the item), M2's video token earned from the card of the thing it's for
// (the test video, the new balance on the same card), and M3's spoiler-free Daily result card, the arrival keepsake
// after a welcome and the weekly Photo Memory (once). Called from smoke.mjs; `node test/e2e/m.mjs` runs them alone
// (same dev server, E2E_URL, CHROME_PATH).

const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);

async function page(browser, URL, errors) {
  const qa = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[m] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
  return qa;
}

/** Every home open and built, drawn scenes (quick), the given coins; then `route`. */
async function setUp(qa, o = {}) {
  await qa.evaluate(async (o) => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    const l = await import('/src/meta/ledger.ts');
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
    if ((a.save.journey.nextLevel ?? 1) < 81) tools.skipToLevel(a.save, 81);
    for (let i = 0; i < 4; i++) tools.finishOpenHomes(a.save);
    if (o.coins) l.grant(a.save, `e2e:coins:m:${o.coins}`, o.coins, 'gift');
    for (const id of o.unown ?? []) delete a.save.inventory.decor[id];
    a.save.settings.toys3d = false;
    a.save.settings.reducedMotion = 'full';
    a.save.settings.celebrations = 'full';
    a.applySettings();
    a.persist();
    window.__pt.go(o.route);
  }, o);
}

/** A home's scene at rest: no celebration starting or playing. */
async function atRest(qa) {
  await waitFor(qa, '.region .sanctuary__scene svg', 30000);
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

const coins = (qa) => qa.evaluate(async () => (await import('/src/meta/ledger.ts')).balance(window.__pt.app.save));
const tokens = (qa) => qa.evaluate(async () => (await import('/src/meta/items.ts')).itemBalance(window.__pt.app.save, 'vtoken'));
const owned = (qa) => qa.evaluate(() => JSON.stringify({ decor: window.__pt.app.save.inventory.decor, tricks: window.__pt.app.save.inventory.tricks }));
const route = (qa) => qa.evaluate(() => window.__pt.app.router.route);

/** Places the active board's solution with real double taps, then waits for the win sheet. */
async function solve(qa) {
  const sol = await qa.evaluate(() => window.__pt.app.active.session.puzzle.solution);
  for (let r = 0; r < sol.length; r++)
    for (let c = 0; c < sol.length; c++) {
      const cells = await qa.evaluate(() => window.__pt.app.active?.session.cells);
      if (!cells || !sol[r][c] || cells[r][c] === sol[r][c]) continue;
      const tool = `[data-tool="${sol[r][c] === 1 ? 'cat' : 'dog'}"]`;
      if (await qa.$(tool)) await qa.click(tool);
      await qa.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 70 });
    }
  await qa.waitForSelector('.win-sheet, .spotlight', { timeout: 8000 });
  if (await qa.$('.spotlight')) {
    await qa.click('.spotlight');
    await qa.waitForSelector('.win-sheet', { timeout: 8000 });
  }
}

export async function mChecks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- M1: Featured, try a decoration on, Back to it
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { coins: 300, route: { screen: 'shop', sanctuary: 'farm', tab: 'decor' } });
    await waitFor(qa, '.shop-featured [data-featured]', 20000);
    const featured = await qa.evaluate(() => {
      const inv = window.__pt.app.save.inventory.decor;
      const cards = [...document.querySelectorAll('.shop-featured [data-featured]')];
      return {
        n: cards.length,
        title: document.querySelector('#featured-title')?.textContent?.trim() ?? '',
        named: cards.every((c) => /\d/.test(c.getAttribute('aria-label') ?? '')),
        ownedShown: cards.filter((c) => c.dataset.decor && inv[c.dataset.decor]).map((c) => c.dataset.decor),
        decor: cards.find((c) => c.dataset.decor)?.dataset.decor ?? null,
      };
    });
    check(
      'M1: the Farm’s Shop shows “Featured for your Farm”, 1–3 picks (D49: one large, two small), each with its price in its name, nothing owned',
      featured.n >= 1 && featured.n <= 3 && /Featured for your/.test(featured.title) && featured.named && !featured.ownedShown.length,
      JSON.stringify(featured),
    );

    let roundTrip = { skipped: true };
    if (featured.decor) {
      const id = featured.decor;
      const before = { coins: await coins(qa), owned: await owned(qa) };
      await qa.evaluate((id) => document.querySelector(`.shop-featured [data-decor="${id}"]`).click(), id);
      await waitFor(qa, '.decor-sheet [data-act="try"]');
      const name = await qa.evaluate(() => document.querySelector('.decor-sheet h2, .decor-sheet .sheet__title')?.textContent?.trim() ?? '');
      const price = await qa.evaluate(() => document.querySelector('.decor-sheet [data-price-line]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
      await qa.evaluate(() => document.querySelector('.decor-sheet [data-act="try"]').click());
      const banner = await waitFor(qa, '.try-banner', 20000);
      await atRest(qa);
      const trying = await qa.evaluate(() => ({
        text: document.querySelector('.try-banner')?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        cls: !!document.querySelector('.sanctuary__scene.is-trying'),
        back: document.querySelector('[data-act="try-back"]')?.textContent?.trim() ?? '',
      }));
      const during = { coins: await coins(qa), owned: await owned(qa) };
      await qa.evaluate(() => document.querySelector('[data-act="try-back"]').click());
      const reopened = await waitFor(qa, '.decor-sheet', 15000);
      const after = await qa.evaluate(() => document.querySelector('.decor-sheet h2, .decor-sheet .sheet__title')?.textContent?.trim() ?? '');
      const r = await route(qa);
      roundTrip = { id, name, price, banner, trying, reopened, after, r, same: JSON.stringify(before) === JSON.stringify(during) };
      check(
        'M1: a featured decoration → Try it in my Farm (D49): the real scene with a “Not yours yet” banner; Back to it reopens the same card; coins and inventory unchanged',
        banner && trying.cls && /Not yours yet/.test(trying.text) && /^Back to/.test(trying.back) && reopened && after === name && r.screen === 'shop' && roundTrip.same && /you have/.test(price),
        JSON.stringify(roundTrip),
      );
    } else check('M1: a featured decoration to try on', false, JSON.stringify(featured));
    await qa.close();
  }

  // ---------------------------------------------------------------- M1: try a trick on in the home, Again, Back
  {
    const qa = await page(browser, URL, errors);
    const trick = await qa.evaluate(async () => {
      const cat = await import('/src/meta/catalogs/tricks.ts');
      const t = await import('/src/meta/tricks.ts');
      return cat.TRICKS.find((x) => x.tier === 'coins' && x.kind === 'trick' && !t.ownsTrick(window.__pt.app.save, x.id))?.id ?? null;
    });
    await setUp(qa, { coins: 50, route: { screen: 'shop', sanctuary: 'farm', tab: 'tricks', trick } });
    const sheet = await waitFor(qa, '.trick-sheet [data-act="try-in"]', 20000);
    const before = await owned(qa);
    const c0 = await coins(qa);
    await qa.evaluate(() => document.querySelector('.trick-sheet [data-act="try-in"]').click());
    const banner = await waitFor(qa, '.try-banner [data-act="try-again"]', 30000);
    const played = await until(qa, (id) => [...document.querySelectorAll('.sanctuary__scene [data-friend]')].some((e) => (e.dataset.trick ?? '').includes(id)), trick, 15000);
    await qa.waitForTimeout(400);
    const again = await qa.evaluate(() => (document.querySelector('[data-act="try-again"]').click(), true));
    const still = (await owned(qa)) === before && (await coins(qa)) === c0;
    await qa.evaluate(() => document.querySelector('[data-act="try-back"]').click());
    const back = await waitFor(qa, '.trick-sheet', 15000);
    check(
      'M1: an unlearned coin trick → Try it in your home: an animal plays it, Again works, Back reopens its card; still unlearned, coins unchanged',
      !!trick && sheet && banner && played && again && still && back,
      JSON.stringify({ trick, sheet, banner, played, still, back }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- M2: earn a video token from the item's own card
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { unown: ['tireswing'], route: { screen: 'shop', sanctuary: 'farm', tab: 'decor', decor: 'tireswing' } });
    const offered = await waitFor(qa, '.decor-sheet [data-token-need] [data-act="earn-token"]', 20000);
    const t0 = await tokens(qa);
    const need = await qa.evaluate(() => document.querySelector('.decor-sheet .token-need')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    await qa.evaluate(() => document.querySelector('.decor-sheet [data-act="earn-token"]').click());
    const video = await waitFor(qa, '.fake-ad', 5000);
    const done = await until(qa, () => !document.querySelector('.fake-ad'), null, 10000);
    const updated = await until(qa, (n) => new RegExp(`You have ${n} video token`).test(document.querySelector('.decor-sheet')?.textContent ?? ''), t0 + 1, 5000);
    const t1 = await tokens(qa);
    const stillCard = await qa.evaluate(() => !!document.querySelector('.decor-sheet') && /Tire Swing/.test(document.querySelector('.decor-sheet')?.textContent ?? ''));
    check(
      'M2: a token decoration with too few tokens: the card says how many; Watch a video (test video) → +1 token on the same card',
      offered && /this needs 3/.test(need) && video && done && updated && t1 === t0 + 1 && stillCard,
      JSON.stringify({ offered, need, video, done, updated, t0, t1, stillCard }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- M3: the Daily's spoiler-free result card
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { route: { screen: 'home' } });
    const dk = await qa.evaluate(() => {
      const d = new Date();
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    });
    await qa.evaluate((k) => window.__pt.start({ kind: 'daily', dateKey: k }), dk);
    await waitFor(qa, '.cell', 15000);
    await solve(qa);
    await qa.evaluate(() => {
      const f = document.querySelector('[data-win-more]');
      if (f) f.open = true;
    });
    await waitFor(qa, '.win-sheet [data-act="share"]', 10000);
    await qa.evaluate(() => document.querySelector('.win-sheet [data-act="share"]').click());
    const card = await waitFor(qa, '.result-sheet', 10000);
    const shown = await qa.evaluate(() => {
      const s = document.querySelector('.result-sheet');
      return {
        text: s?.textContent?.replace(/\s+/g, ' ').trim() ?? '',
        img: !!s?.querySelector('img, canvas'),
        alt: s?.querySelector('img')?.getAttribute('alt') ?? '',
        board: !!s?.querySelector('.cell, .board'),
        share: !!s?.querySelector('[data-act="rc-share"]'),
      };
    });
    await qa.evaluate(() => document.querySelector('.result-sheet [data-act="rc-done"]')?.click());
    const closed = await until(qa, () => !document.querySelector('.result-sheet'), null, 5000);
    check(
      'M3: a solved Daily → Share opens the result card: an image of the day’s result, never the board; Done closes it',
      card && shown.img && !shown.board && shown.share && /Daily Puzzle result for/.test(shown.alt) && /never the puzzle/.test(shown.text) && closed,
      JSON.stringify(shown).slice(0, 400),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- M3: the arrival keepsake and the weekly Photo Memory
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { route: { screen: 'region', id: 'farm', welcome: ['cotton'] } });
    await atRest(qa);
    const offered = await waitFor(qa, '[data-act="share-arrival"]', 20000);
    const label = await qa.evaluate(() => document.querySelector('[data-act="share-arrival"]')?.textContent?.trim() ?? '');
    const winSheet = await qa.evaluate(() => !!document.querySelector('.win-sheet [data-act="share-arrival"]'));
    const fits = await qa.evaluate(() => {
      const b = document.querySelector('[data-act="share-arrival"]').getBoundingClientRect();
      return document.documentElement.scrollWidth <= innerWidth && b.left >= 0 && b.right <= innerWidth;
    });
    await qa.evaluate(() => document.querySelector('[data-act="share-arrival"]').click());
    const mode = await waitFor(qa, '.photo-mode', 15000);
    const framed = await qa.evaluate(() => document.querySelector('[data-frame][aria-checked="true"]')?.dataset.frame ?? '');
    const memoryLine = await qa.evaluate(() => document.querySelector('[data-photo-memory]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const c0 = await coins(qa);
    await qa.evaluate(() => document.querySelector('[data-act="photo-take"]').click());
    const first = await waitFor(qa, '.postcard-sheet__img', 20000);
    const memo = await qa.evaluate(() => document.querySelector('.postcard-sheet__memory')?.textContent?.replace(/\s+/g, ' ').trim() ?? '');
    const c1 = await coins(qa);
    await qa.evaluate(() => document.querySelector('[data-act="pc-again"]').click());
    await until(qa, () => !document.querySelector('.postcard-sheet'), null);
    await qa.evaluate(() => document.querySelector('[data-act="photo-take"]').click());
    const second = await waitFor(qa, '.postcard-sheet__img', 20000);
    const memo2 = await qa.evaluate(() => !!document.querySelector('.postcard-sheet__memory'));
    const c2 = await coins(qa);
    // A reload: the week's memory is still claimed.
    await qa.reload();
    await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
    const entries = await qa.evaluate(() => window.__pt.app.save.inventory.ledger.filter((e) => String(e.id).startsWith('photo-memory:')).length);
    check(
      'M3: after a welcome, “Share <name>’s arrival” sits under the scene (not on a win sheet, within the phone’s width) and opens photo mode framed on them',
      offered && /arrival/.test(label) && !winSheet && fits && mode && framed.startsWith('a:'),
      JSON.stringify({ offered, label, winSheet, fits, mode, framed }),
    );
    check(
      'M3: the week’s first postcard earns 30 Paw Coins, shown on it; a second postcard and a reload earn nothing more',
      first && /30/.test(memoryLine + memo) && c1 === c0 + 30 && second && !memo2 && c2 === c1 && entries === 1,
      JSON.stringify({ memoryLine, memo, c0, c1, c2, entries, memo2 }),
    );
    await qa.close();
  }
}

// Run alone: `node test/e2e/m.mjs`.
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
    await mChecks({ browser, URL, check, errors });
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
