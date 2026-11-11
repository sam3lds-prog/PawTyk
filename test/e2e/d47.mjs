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
  } catch (e) {
    check('d47 ran to completion', false, String(e));
  }
  check('no page errors', errors.length === 0, errors.join(' | '));
  await browser.close();
  process.exit(failed ? 1 : 0);
}
