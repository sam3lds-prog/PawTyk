// D48 browser checks (PR F): feeding played out on the Farm and the Get food round trip, a decoration's preview in
// the Shop, the new tricks (tray groups, Again, a group act's preview, learning one with coins once), the welcome
// celebrations (each its own tune and finish, Skip, replay from the card, nothing paid), that every new control has a
// name, and that a celebration keeps the frame rate. Called from smoke.mjs; `node test/e2e/d48.mjs` runs them alone
// (same dev server, E2E_URL, CHROME_PATH).

const until = (qa, fn, arg, timeout = 15000) => qa.waitForFunction(fn, arg, { timeout }).then((h) => (h.dispose(), true), () => false);
const waitFor = (qa, sel, timeout = 15000) => until(qa, (s) => !!document.querySelector(s), sel, timeout);

async function page(browser, URL, errors) {
  const qa = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[d48] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt).then((h) => h.dispose());
  return qa;
}

/** Every home open and built, settings as given; then `route`. */
async function setUp(qa, o = {}) {
  await qa.evaluate(async (o) => {
    const a = window.__pt.app;
    const tools = await import('/src/app/qaTools.ts');
    Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
    if ((a.save.journey.nextLevel ?? 1) < 81) tools.skipToLevel(a.save, 81);
    for (let i = 0; i < 4; i++) tools.finishOpenHomes(a.save);
    a.save.settings.toys3d = o.toys3d ?? true;
    a.save.settings.reducedMotion = 'full';
    a.save.settings.celebrations = 'full';
    if (o.celebration) a.save.world.celebrations = { by: { cotton: o.celebration } };
    a.applySettings();
    a.persist();
    window.__pt.go(o.route ?? { screen: 'region', id: 'farm' });
  }, o);
}

/** The Farm at rest: its scene up, no celebration starting or playing. */
async function farmAtRest(qa) {
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

/** Buttons and tabs inside `root` that a screen reader couldn't name. */
const unnamed = (qa, root) =>
  qa.evaluate(
    (root) =>
      [...document.querySelectorAll(`${root} button, ${root} [role="tab"]`)]
        .filter((b) => !b.hidden && !(b.getAttribute('aria-label') ?? '').trim() && !(b.textContent ?? '').trim())
        .map((b) => b.outerHTML.slice(0, 120)),
    root,
  );

export async function d48Checks({ browser, URL, check, errors }) {
  // ---------------------------------------------------------------- feeding (PR B)
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa);
    await farmAtRest(qa);
    await qa.evaluate(async () => {
      const f = await import('/src/meta/feeding.ts');
      const l = await import('/src/meta/ledger.ts');
      l.grant(window.__pt.app.save, 'e2e:coins:d48feed', 400, 'gift');
      f.buyFood(window.__pt.app.save, 'hay', { offer: 'five' });
      window.__pt.app.persist();
    });
    await qa.evaluate(() => document.querySelector('[data-friend-card="cotton"]')?.click());
    await waitFor(qa, '.friend-panel [data-feed="hay"]');
    const named = await unnamed(qa, '.pet-sheet');
    await qa.evaluate(() => document.querySelector('.friend-panel [data-feed="hay"]').click());
    await qa.waitForTimeout(400);
    const meal = await qa.evaluate(() => ({ card: !!document.querySelector('.pet-sheet'), eating: document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dataset.trick ?? null, bowl: !!document.querySelector('.sanctuary__scene .sp-feed') }));
    await qa.waitForTimeout(4500);
    const after = await qa.evaluate(async () => ({
      eating: document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dataset.trick ?? null,
      bowl: !!document.querySelector('.sanctuary__scene .sp-feed'),
      left: (await import('/src/meta/feeding.ts')).foodCount(window.__pt.app.save, 'hay'),
      owner: window.__director?.owner ?? null,
    }));
    check(
      'feeding on the Farm: the card makes way, Cotton eats from a bowl in the scene, then all of it clears; one hay used (D48)',
      !meal.card && meal.eating === 'feed' && meal.bowl && !after.eating && !after.bowl && after.left === 4 && after.owner === null && named.length === 0,
      JSON.stringify({ meal, after, named }),
    );
    // Get food: the Shop on the Farm's food with her favorite picked out, and back to her card.
    await qa.evaluate(() => document.querySelector('[data-friend-card="cotton"]')?.click());
    await waitFor(qa, '[data-act="get-food"]');
    await qa.evaluate(() => document.querySelector('[data-act="get-food"]').click());
    await waitFor(qa, '.shop .food-card.is-wanted');
    const shop = await qa.evaluate(() => ({ wanted: document.querySelector('.food-card.is-wanted')?.dataset.food, banner: document.querySelector('[data-feed-return]')?.textContent ?? '' }));
    await qa.evaluate(() => document.querySelector('[data-act="feed-back"]')?.click());
    await waitFor(qa, '.friend-panel[data-friend-panel="cotton"]', 20000);
    const back = await qa.evaluate(() => !!document.querySelector('.region') && !!document.querySelector('.friend-panel[data-friend-panel="cotton"]'));
    check('Get food: the Shop opens on the Farm’s food with Cotton’s favorite picked out, and goes back to her card (D48)', /Cotton/.test(shop.banner) && !!shop.wanted && back, JSON.stringify({ shop, back }));
    await qa.close();
  }

  // ---------------------------------------------------------------- a decoration's card (PR C)
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { route: { screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' } });
    await waitFor(qa, '.decor-sheet [data-decor-preview="flowerarch"]', 20000);
    const card = await qa.evaluate(() => ({
      preview: !!document.querySelector('.decor-sheet .decor-preview svg [data-decor="flowerarch"]'),
      ring: !!document.querySelector('.decor-sheet .sp-preview-ring'),
      // D49 PR A: a piece that can be tried on has one way to see it, Try it in my Farm.
      tryIt: /Try it in my Farm/.test(document.querySelector('.decor-sheet [data-act="try"]')?.textContent ?? ''),
      noShowMe: document.querySelector('.decor-sheet [data-act="preview-play"]')?.hidden !== false,
      text: document.querySelector('.decor-sheet')?.textContent ?? '',
    }));
    // Owned (nothing to try on): the card's own Show me plays it with a Farm animal.
    await qa.evaluate(() => {
      document.querySelector('.decor-sheet [data-act="close"]')?.click();
      window.__pt.app.save.inventory.decor.flowerarch = { ownedAt: new Date().toISOString() };
      window.__pt.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' });
    });
    card.showMe = await waitFor(qa, '.decor-sheet [data-act="preview-play"]:not([hidden])', 20000);
    await qa.evaluate(() => document.querySelector('.decor-sheet [data-act="preview-play"]')?.click());
    await qa.waitForTimeout(500);
    const playing = await qa.evaluate(() => !!document.querySelector('.decor-sheet .decor-preview .sp-act, .decor-sheet .decor-preview .is-away'));
    const named = await unnamed(qa, '.decor-sheet');
    check('a decoration’s card previews it in the player’s own Farm, in its spot; Try it in my Farm when it can be tried on, Show me when owned (D48, D49)', card.preview && card.ring && card.tryIt && card.noShowMe && card.showMe && /meadow/i.test(card.text) && playing && named.length === 0, JSON.stringify({ ...card, text: card.text.slice(0, 160), playing, named }));
    await qa.close();
  }

  // ---------------------------------------------------------------- tricks (PR D)
  {
    const qa = await page(browser, URL, errors);
    await setUp(qa);
    await farmAtRest(qa);
    await qa.evaluate(() => document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true })));
    await waitFor(qa, '.trick-tray');
    const tabs = await qa.evaluate(() => [...document.querySelectorAll('.trick-tray [data-tray-tab]')].map((b) => `${b.getAttribute('role')}:${b.textContent}`));
    await qa.evaluate(() => document.querySelector('[data-tray-tab="emote"]').click());
    await qa.evaluate(() => document.querySelector('.trick-tray__list [data-trick="wiggle"]').click());
    await qa.waitForTimeout(200);
    const played = await qa.evaluate(() => ({ on: document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dataset.trick ?? null, again: [...document.querySelectorAll('.trick-tray__recent [data-trick]')].map((b) => b.dataset.trick) }));
    const trayNames = await unnamed(qa, '.trick-tray');
    check('the tray: Emotes, Tricks, Dances, Group acts as tabs; Happy Wiggle plays and comes back under Again (D48)', tabs.join('|') === 'tab:Emotes|tab:Tricks|tab:Dances|tab:Group acts' && played.on === 'wiggle' && played.again[0] === 'wiggle' && trayNames.length === 0, JSON.stringify({ tabs, played, trayNames }));
    await qa.waitForTimeout(1800);
    await qa.evaluate(() => document.querySelector('[data-tray-tab="group"]').click());
    await qa.evaluate(() => document.querySelector('.trick-tray__list [data-trick="duet"]').click());
    await waitFor(qa, '.trick-sheet');
    const sheet = await qa.evaluate(() => ({ dancers: document.querySelectorAll('.trick-sheet__stage .sanctuary__pet').length, gem: /gem/i.test(document.querySelector('.trick-sheet')?.textContent ?? '') }));
    await qa.keyboard.press('Escape');
    await qa.waitForTimeout(400);
    const canvases = await qa.evaluate(() => document.querySelectorAll('canvas.scene3d').length);
    check('a group act’s card previews it with a partner, for gems; closing it releases its 3D stage (D48)', sheet.dancers === 2 && sheet.gem && canvases <= 1, JSON.stringify({ sheet, canvases }));
    // Learning one with coins, from the Shop: charged once, however fast the taps.
    await qa.evaluate(async () => {
      (await import('/src/meta/ledger.ts')).grant(window.__pt.app.save, 'e2e:coins:d48trick', 300, 'gift');
      window.__pt.go({ screen: 'shop', tab: 'tricks' });
    });
    await waitFor(qa, '[data-trick-card="tailchase"]');
    const groups = await qa.evaluate(() => [...document.querySelectorAll('.shop__group')].map((h) => h.textContent).join('|'));
    const before = await coins(qa);
    await qa.evaluate(() => document.querySelector('[data-trick-card="tailchase"]').click());
    await waitFor(qa, '.trick-sheet [data-act="buy"]');
    await qa.evaluate(() => {
      const b = document.querySelector('.trick-sheet [data-act="buy"]');
      b.click();
      b.click();
      b.click();
    });
    await qa.waitForTimeout(400);
    const bought = await qa.evaluate(async () => (await import('/src/meta/tricks.ts')).ownsTrick(window.__pt.app.save, 'tailchase'));
    const spent = before - (await coins(qa));
    const shopNames = await unnamed(qa, '.shop__body');
    check('Shop → Tricks in four groups; Tail Chase learned with 100 coins, once, for three quick taps (D48)', groups === 'Emotes|Tricks|Dances|Group acts' && bought && spent === 100 && shopNames.length === 0, JSON.stringify({ groups, bought, spent, shopNames }));
    await qa.close();
  }

  // ---------------------------------------------------------------- the welcome celebrations (PR E)
  for (const preset of ['meadowhop', 'sparkle', 'circle']) {
    const qa = await page(browser, URL, errors);
    await setUp(qa, { celebration: preset, toys3d: preset !== 'sparkle', route: { screen: 'region', id: 'farm', welcome: ['cotton'] } });
    const started = await until(qa, () => !!document.querySelector('.sanctuary__scene [data-trick^="dance:newcomer"]'), null, 30000);
    // The frame rate while everyone dances, drawn (a stall is a failure). With 3D toys this browser renders in
    // software at a few frames a second whatever the scene does, so there it is only reported.
    const frames = await qa.evaluate(
      () =>
        new Promise((resolve) => {
          const ts = [];
          const t0 = performance.now();
          const step = (t) => {
            ts.push(t);
            if (t - t0 < 2000) requestAnimationFrame(step);
            else {
              const d = ts.slice(1).map((x, i) => x - ts[i]).sort((a, b) => a - b);
              resolve({ n: d.length, p95: Math.round(d[Math.floor(d.length * 0.95)] ?? 0) });
            }
          };
          requestAnimationFrame(step);
        }),
    );
    const mid = await qa.evaluate(async () => ({
      id: document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.dataset.trick ?? '',
      music: (await import('/src/services/music.ts')).nowPlaying()?.id ?? null,
      ring: document.querySelectorAll('.sanctuary__scene .sp-dance-ring path').length,
      skip: !!document.querySelector('.parade-skip'),
    }));
    const want = { meadowhop: 'hopalong', sparkle: 'sparkle', circle: 'circle' }[preset];
    check(
      `the ${preset} welcome: Cotton’s own celebration, its own tune, ${preset === 'circle' ? 'a ring of hearts, ' : ''}skippable${preset === 'sparkle' ? ', no stalls (drawn)' : ' (3D)'} (D48)`,
      started && mid.id.endsWith(`:${preset}`) && mid.music === want && (preset !== 'circle' || mid.ring >= 10) && mid.skip && (preset !== 'sparkle' || frames.p95 < 150),
      JSON.stringify({ mid, frames }),
    );
    // Skip, then replay it from Cotton's card: the same one, and nothing is paid.
    const before = await qa.evaluate(() => JSON.stringify({ ...window.__pt.app.save, usage: null, world: { ...window.__pt.app.save.world, visited: null } }));
    await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
    await until(qa, () => !document.querySelector('.is-parading, [data-trick^="dance:"]'), null, 5000);
    await qa.evaluate(() => document.querySelector('[data-friend-card="cotton"]')?.click());
    await waitFor(qa, '.pet-sheet [data-act="replay-welcome"]');
    const label = await qa.evaluate(() => document.querySelector('.pet-sheet [data-act="replay-welcome"]').textContent.trim());
    await qa.evaluate(() => document.querySelector('.pet-sheet [data-act="replay-welcome"]').click());
    const again = await until(qa, (p) => !!document.querySelector(`.sanctuary__scene [data-trick$=":${p}"]`), preset, 15000);
    await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
    await until(qa, () => !document.querySelector('.is-parading, [data-trick^="dance:"]'), null, 5000);
    const after = await qa.evaluate(() => JSON.stringify({ ...window.__pt.app.save, usage: null, world: { ...window.__pt.app.save.world, visited: null } }));
    const names = { meadowhop: 'Meadow Hop', sparkle: 'Sparkle Surprise', circle: 'Friendship Circle' };
    check(`Cotton’s card replays the ${names[preset]}; Skip ends it; nothing in the save changes (D48)`, label.includes(names[preset]) && again && after === before, JSON.stringify({ label, again, same: after === before }));
    await qa.close();
  }
}

// Run alone: `node test/e2e/d48.mjs`.
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
    await d48Checks({ browser, URL, check, errors });
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
