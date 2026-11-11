// D49 browser checks (attention, delight and retention): a returning player's Journey on the smallest phone (one goal,
// Play above the fold, at most two things, the rest folded), the Shop's Featured row and Try it in my Farm with Buy (a
// purchase that arrives in the scene, charged once), an arrival's one card and its welcome snack, a quick repeat meal
// in a real browser, an animal moment that steps aside for the Tour, a win whose next action is on screen, and rapid
// navigation leaving every scene at rest. Called from smoke.mjs; `node test/e2e/d49.mjs` runs them alone (same dev
// server, E2E_URL, CHROME_PATH).

const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);

async function page(browser, URL, errors, size = { width: 320, height: 568 }) {
  const qa = await browser.newPage({ viewport: size, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d49] ${e}`));
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
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, loopTipSeen: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true, controlsTipSeen: true, seenPantryIntro: true, usageAsked: true });
    tools.skipToLevel(a.save, o.level ?? 14);
    if (o.grow) tools.growActive(a.save, o.grow);
    if (o.coins) l.grant(a.save, `e2e:coins:d49:${o.coins}`, o.coins, 'gift');
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
  await waitFor(qa, '.region .sanctuary__scene svg', 30000);
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

export async function d49Checks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- PR D: a returning player on a 320×568 phone
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 14, grow: 6, affection: { cotton: 4 }, route: { screen: 'journey' } });
    await waitFor(qa, '.hero .continue__go', 20000);
    const hub = await qa.evaluate(() => {
      const play = document.querySelector('.continue__go').getBoundingClientRect();
      const rows = [...document.querySelectorAll('.today .today-row')].map((r) => r.dataset.today);
      const fold = document.querySelector('[data-more-play]');
      return { playBottom: play.bottom, vh: window.innerHeight, rows, eyebrow: document.querySelector('.hero__eyebrow')?.textContent ?? '', foldClosed: !!fold && !fold.open, summary: fold?.querySelector('summary')?.textContent?.replace(/\s+/g, ' ').trim() ?? '' };
    });
    check(
      'D49 PR D: a returning player sees one goal (Today at your Farm) with Play above the fold at 320×568, at most two things under it, the rest folded',
      hub.playBottom <= hub.vh && /Today at your Farm/.test(hub.eyebrow) && hub.rows.length >= 1 && hub.rows.length <= 2 && hub.foldClosed && /Zen Garden/.test(hub.summary) && !(await sideways(qa)),
      JSON.stringify(hub),
    );
    // The friend nudge leads to the Farm; a hello there, and it's gone from Today.
    let friend = { skipped: true };
    if (hub.rows.includes('friend')) {
      await qa.evaluate(() => document.querySelector('.today [data-today="friend"]').click());
      await atRest(qa);
      await qa.evaluate(() => document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
      await qa.waitForTimeout(400);
      const greeted = await qa.evaluate(() => window.__pt.app.save.sanctuary.greeted.cotton === (window.__pt.app.save.world.visited.farm ?? ''));
      await qa.evaluate(() => window.__pt.go({ screen: 'journey' }));
      await waitFor(qa, '.hero');
      const after = await qa.evaluate(() => [...document.querySelectorAll('.today .today-row')].map((r) => r.dataset.today));
      friend = { greeted, after };
      check('D49 PR D: "Cotton has a warmer hello to share" opens the Farm; after the hello it leaves Today', greeted && !after.includes('friend'), JSON.stringify(friend));
    } else check('D49 PR D: a friend close to a gift is suggested', false, JSON.stringify(hub));
    await qa.close();
  }

  // ---------------------------------------------------------------- PR A: Featured at 320, Try it in my Farm, Buy
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 14, grow: 6, coins: 300, route: { screen: 'shop', sanctuary: 'farm', tab: 'decor' } });
    await waitFor(qa, '.shop-featured .featured-card--lead', 20000);
    const featured = await qa.evaluate(() => ({ lead: document.querySelectorAll('.shop-featured .featured-card--lead').length, minis: document.querySelectorAll('.shop-featured .featured-mini').length }));
    await qa.evaluate(() => document.querySelector('[data-act="see-all"]').click());
    await qa.waitForTimeout(700);
    const seeAll = await qa.evaluate(() => {
      const h = document.activeElement;
      const r = h?.getBoundingClientRect();
      return { tag: h?.tagName, text: h?.textContent ?? '', inView: !!r && r.top >= 0 && r.top < window.innerHeight };
    });
    check('D49 PR A: Featured is one large pick and up to two small ones at 320; See all brings the catalog into view', featured.lead === 1 && featured.minis <= 2 && seeAll.tag === 'H2' && seeAll.inView && !(await sideways(qa)), JSON.stringify({ featured, seeAll }));

    // Try it in my Farm, then Buy from the banner: charged once, it arrives with sparkles and an animal uses it.
    const c0 = await coins(qa);
    await qa.evaluate(() => window.__pt.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' }));
    await waitFor(qa, '.decor-sheet [data-act="try"]');
    const card = await qa.evaluate(() => ({ tryIt: document.querySelector('.decor-sheet [data-act="try"]')?.textContent?.trim() ?? '', showMe: document.querySelector('.decor-sheet [data-act="preview-play"]')?.hidden === false }));
    await qa.evaluate(() => document.querySelector('.decor-sheet [data-act="try"]').click());
    await waitFor(qa, '[data-try-banner] [data-act="try-buy"]', 20000);
    await atRest(qa);
    await qa.evaluate(() => document.querySelector('[data-try-banner] [data-act="try-buy"]').click());
    await qa.evaluate(() => document.querySelector('[data-try-banner] [data-act="try-buy"]')?.click());
    const revealed = await waitFor(qa, '.sanctuary__scene .sp-reveal', 4000);
    const used = await until(qa, () => !!document.querySelector('.sanctuary__scene .is-away, .sanctuary__chat.is-activity'), null, 4000);
    const after = { coins: await coins(qa), owned: await qa.evaluate(() => !!window.__pt.app.save.inventory.decor.flowerarch), banner: await qa.evaluate(() => !!document.querySelector('[data-try-banner]')) };
    check(
      'D49 PR A/B: a decoration has one way to see it (Try it in my Farm); bought from the banner it is charged once, stays out, sparkles in, and an animal uses it',
      /Try it in my Farm/.test(card.tryIt) && !card.showMe && after.owned && !after.banner && after.coins === c0 - 180 && revealed && used,
      JSON.stringify({ card, c0, after, revealed, used }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR A: an arrival's one card, its snack, at 320
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 14, grow: 6 });
    const who = await qa.evaluate(() => {
      const ids = Object.keys(window.__pt.app.save.inventory.companions);
      const w = ids[ids.length - 1];
      window.__pt.go({ screen: 'region', id: 'farm', welcome: [w] });
      return w;
    });
    await atRest(qa);
    await waitFor(qa, '[data-welcome-card="offer"]', 20000);
    const offer = await qa.evaluate(() => {
      const c = document.querySelector('[data-welcome-card]');
      const btns = [...c.querySelectorAll('.btn')].map((b) => b.getBoundingClientRect());
      const chat = document.querySelector('.sanctuary__chat');
      const under = document.querySelector('.sanctuary__under');
      return {
        n: btns.length,
        inWidth: btns.every((b) => b.left >= 0 && b.right <= window.innerWidth),
        snack: /welcome snack/.test(c.querySelector('[data-act="welcome-snack"]')?.textContent ?? ''),
        cont: /Continue to level/.test(c.querySelector('[data-act="welcome-play"]')?.textContent ?? ''),
        chatOwnLine: !chat || chat.hidden || chat.getBoundingClientRect().width >= under.getBoundingClientRect().width - 12,
        goalCards: document.querySelectorAll('[data-next-goal]').length,
      };
    });
    await qa.evaluate(() => document.querySelector('[data-act="welcome-snack"]').click());
    const eating = await waitFor(qa, '.sanctuary__scene [data-trick="feed"], .sanctuary__scene [data-trick="nibble"]', 4000);
    const fed = await waitFor(qa, '[data-welcome-card="fed"]', 10000);
    const one = await qa.evaluate(() => document.querySelectorAll('[data-welcome-card="fed"] .btn').length);
    check(
      'D49 PR A: after a welcome, one card: a snack for the newcomer and Continue, in the phone’s width, the line under the scene on its own; the snack plays, then Continue alone',
      offer.n === 2 && offer.inWidth && offer.snack && offer.cont && offer.chatOwnLine && offer.goalCards === 0 && eating && fed && one === 1 && !(await sideways(qa)),
      JSON.stringify({ who, offer, eating, fed, one }),
    );

    // ---------------------------------------------------------------- PR C: a repeat meal is quick
    await qa.evaluate(async () => {
      const f = await import('/src/meta/feeding.ts');
      const l = await import('/src/meta/ledger.ts');
      const a = window.__pt.app;
      l.grant(a.save, 'e2e:coins:d49:meal', 200, 'gift');
      f.buyFood(a.save, 'hay', { offer: 'five' });
      a.save.sanctuary.tasted = { ...(a.save.sanctuary.tasted ?? {}), cotton: ['hay'] };
      a.save.sanctuary.fed = {};
      a.persist();
    });
    await qa.evaluate(() => document.querySelector('.resident-row [data-friend-card="cotton"]').click());
    await waitFor(qa, '.friend-panel [data-feed="hay"]');
    const t0 = Date.now();
    await qa.evaluate(() => document.querySelector('.friend-panel [data-feed="hay"]').click());
    const nibbled = await waitFor(qa, '.sanctuary__scene [data-friend="cotton"][data-trick="nibble"]', 2000);
    await until(qa, () => !document.querySelector('.sanctuary__scene .sp-feed'), null, 5000);
    const took = Date.now() - t0;
    check('D49 PR C: an ordinary repeat meal is quick (about a second, the toy nibbles), not the 3.6 s first meal', nibbled && took < 2000, JSON.stringify({ nibbled, took }));
    await qa.close();
  }

  // ---------------------------------------------------------------- PR C: an animal moment, then the Tour
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, grow: 6 });
    await qa.evaluate(async () => {
      (await import('/src/ui/components/animalMoments.ts')).requestMomentSoon();
      window.__pt.go({ screen: 'region', id: 'farm' });
    });
    await atRest(qa);
    const moment = await waitFor(qa, '.sanctuary__chat.is-moment', 9000);
    const line = await qa.evaluate(() => document.querySelector('.sanctuary__chat')?.textContent?.trim() ?? '');
    const noted = await qa.evaluate(() => Object.keys(window.__pt.app.save.sanctuary.moments ?? {}).length);
    await qa.evaluate(() => document.querySelector('[data-act="tour"]')?.click());
    await qa.waitForTimeout(300);
    const during = await qa.evaluate(() => ({ owner: window.__director?.owner ?? null, moment: window.__moments?.active ?? null }));
    await qa.evaluate(() => document.querySelector('[data-act="tour-stop"], .tour-stop')?.click());
    await qa.waitForTimeout(600);
    await until(qa, () => window.__director?.owner === null && !document.querySelector('.is-touring'), null, 15000);
    const stuck = await qa.evaluate(() => document.querySelectorAll('.sanctuary__scene [data-trick]').length);
    check(
      'D49 PR C: an animal moment comes by itself (its line, New the first time), and the Tour takes over at once; afterwards nobody is stuck mid-trick',
      moment && /New/.test(line) && noted >= 1 && during.owner === 'tour' && during.moment === false && stuck === 0,
      JSON.stringify({ moment, line, noted, during, stuck }),
    );
    await qa.close();
  }

  // ---------------------------------------------------------------- PR B: a win, its coins and its next action
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { level: 6, grow: 1 });
    await qa.evaluate(() => window.__pt.start({ kind: 'level', level: 6 }));
    await waitFor(qa, '.cell');
    const sol = await qa.evaluate(() => window.__pt.app.active.session.puzzle.solution);
    for (let r = 0; r < sol.length; r++)
      for (let c = 0; c < sol.length; c++) {
        if (!sol[r][c]) continue;
        const cells = await qa.evaluate(() => window.__pt.app.active?.session.cells);
        if (!cells || cells[r][c] === sol[r][c]) continue;
        await qa.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 70 });
      }
    await waitFor(qa, '.win-sheet, .spotlight', 10000);
    if (await qa.$('.spotlight')) await qa.click('.spotlight');
    await waitFor(qa, '.win-sheet', 10000);
    await qa.waitForTimeout(900);
    const win = await qa.evaluate(() => {
      const play = document.querySelector('.win-sheet [data-act="next"]')?.getBoundingClientRect();
      return { coins: document.querySelector('.win-sheet [data-win-coins]')?.textContent?.replace(/\s+/g, ' ').trim() ?? '', playInView: !!play && play.bottom <= window.innerHeight && play.top >= 0, errand: document.querySelector('.win-sheet [data-win-errand]')?.textContent ?? '' };
    });
    check('D49 PR B/D: a win shows its coins beside the success, its errand already paid, and Play next is on screen at 320×568', /\+\d+ Paw Coins/.test(win.coins.replace(/\s+/g, ' ')) && win.playInView && (/Paw Coins/.test(win.errand) || win.errand === ''), JSON.stringify(win));
    await qa.close();
  }

  // ---------------------------------------------------------------- rapid navigation leaves every scene at rest
  {
    const qa = await page(browser, URL, errors, { width: 390, height: 844 });
    await setUp(qa, { level: 14, grow: 6, route: { screen: 'journey' } });
    for (let i = 0; i < 3; i++)
      for (const r of [{ screen: 'region', id: 'farm' }, { screen: 'shop', tab: 'decor', sanctuary: 'farm' }, { screen: 'region', id: 'farm' }, { screen: 'journey' }]) {
        await qa.evaluate((r) => window.__pt.go(r), r);
        await qa.waitForTimeout(120);
      }
    await qa.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
    await atRest(qa);
    await qa.waitForTimeout(1500);
    // D50 PR B: a calm visit's hello may be playing (a live moment, not something left behind): let it finish.
    await until(qa, () => !window.__moments?.active, null, 6000);
    const rest = await qa.evaluate(() => ({ owner: window.__director?.owner ?? null, waiting: window.__director?.waiting ?? 0, stuck: document.querySelectorAll('.sanctuary__scene [data-trick]:not([data-trick^="dance"])').length, sheets: document.querySelectorAll('.overlay').length }));
    check('D49: quick back-and-forth between Journey, the Farm and the Shop leaves the scene at rest (no moment, meal or trick left behind)', rest.owner === null && rest.waiting === 0 && rest.stuck === 0, JSON.stringify(rest));
    await qa.close();
  }
}

// Run alone: `node test/e2e/d49.mjs`.
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
    await d49Checks({ browser, URL, check, errors });
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
