// End-to-end smoke tests in a real browser (iPhone-sized viewport).
//
//   npm run dev            # in one terminal (the dev-only window.__pt hook is needed)
//   npm run e2e            # in another; E2E_URL overrides http://localhost:5173
//
// Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
// Covers the spec's critical regressions: first-run flow, "Next level" advances, progress survives reload,
// in-progress boards resume, decor is charged exactly once, reset keeps unrelated data, faces are facial-only.

import { createRequire } from 'node:module';
import { d46Checks, forceCloseChecks } from './d46.mjs';
import { d47Checks, d47IntegratedChecks } from './d47.mjs';
import { d48Checks } from './d48.mjs';
import { mChecks } from './m.mjs';

let chromium;
try {
  ({ chromium } = await import('playwright'));
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)('playwright'));
  } catch {
    /* handled below */
  }
}
if (!chromium) {
  console.error('Playwright is not installed. Run: npm i -D playwright && npx playwright install chromium');
  process.exit(2);
}

const URL = process.env.E2E_URL ?? 'http://localhost:5173/';
const results = [];
let failed = 0;

function check(name, cond, detail = '') {
  results.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${!cond && detail ? `  (${detail})` : ''}`);
  if (!cond) failed++;
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true });
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

async function reload() {
  await page.reload();
  await page.waitForFunction(() => !!window.__pt);
}

const coins = () => page.evaluate(() => window.__pt.app.coins());
const title = () => page.textContent('.game-title h1').catch(() => null);

/** One tap on a tile: marks ✕ (D37). */
async function tapCell(r, c) {
  await page.click(`.cell[data-r="${r}"][data-c="${c}"]`);
}

/** Double-taps a tile: places the picked animal (D37). */
async function dblTap(r, c) {
  // A human pace (D44): presses closer than TAP_BOUNCE_MS (50 ms) are one touch reported twice and never place.
  await page.dblclick(`.cell[data-r="${r}"][data-c="${c}"]`, { delay: 70 });
}

/** Presses the animal tool for a species (every board has one under the place scheme; two-animal boards under the others). */
async function pick(species) {
  const sel = `[data-tool="${species === 1 ? 'cat' : 'dog'}"]`;
  if (await page.$(sel)) await page.click(sel);
}

const scheme = () => page.evaluate(() => window.__pt.app.settings.controls);

/** Places an animal: pick it (two-animal boards), then double-tap. */
async function place(r, c, species) {
  await pick(species);
  await dblTap(r, c);
}

async function solveActive({ stopAfter = Infinity, pace = 0 } = {}) {
  const sol = await page.evaluate(() => window.__pt.app.active.session.puzzle.solution);
  let placed = 0;
  for (let r = 0; r < sol.length; r++)
    for (let c = 0; c < sol.length; c++) {
      const cells = await page.evaluate(() => window.__pt.app.active?.session.cells);
      if (!cells || !sol[r][c] || cells[r][c] === sol[r][c]) continue;
      if (placed >= stopAfter) return;
      if (pace) await page.waitForTimeout(pace);
      await place(r, c, sol[r][c]);
      placed++;
    }
  // D44 PR E: every win sparkles over the board for about a second.
  lastSparkle = await page.evaluate(() => !!document.querySelector('.board-frame .win-burst'));
  // The very first animal's board ends in its arrival (D41), every other in the win sheet; a new animal first gets its
  // spotlight (D44 PR E), which a tap moves on from.
  await page.waitForSelector('.win-sheet, .arrival, .spotlight', { timeout: 5000 });
  lastSpotlight = await page.evaluate(() => document.querySelector('.spotlight')?.textContent?.replace(/\s+/g, ' ').trim() ?? null);
  if (lastSpotlight) {
    await page.click('.spotlight');
    await page.waitForSelector('.win-sheet', { timeout: 5000 });
  }
}
let lastSparkle = false;
let lastSpotlight = null;

/** A tile that can't hold an animal on the active board, still empty. */
const emptyTile = () =>
  page.evaluate(() => {
    const s = window.__pt.app.active.session;
    for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === 0 && s.puzzle.solution[r][c] === 0 && !s.errorsAt(r, c).length) return [r, c];
    return null;
  });

/** Puts the player past the two-animal lesson (D35), as if they had played that far. */
async function reachPairs(level = 25) {
  await page.evaluate((L) => {
    const s = window.__pt.app.save;
    for (let i = 1; i < L; i++) s.journey.clears['L' + i] ??= { firstClearAt: new Date().toISOString(), bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    if (s.journey.nextLevel < L) s.journey.nextLevel = L;
    Object.assign(s.onboarding, { soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, seenRules: true });
    window.__pt.app.persist();
  }, level);
}

try {
  await page.goto(URL);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('someone.else', 'keep me');
  });
  await reload();
  await page.waitForSelector('.welcome');
  check('first run shows the welcome screen', true);
  check('the welcome shows the Farm and Cotton, the animal on the first board', !!(await page.$('.welcome__tile .pet[data-pet="cotton"]')) && !(await page.$('.welcome [data-pet="mochi"]')) && (await page.textContent('.welcome [data-act="start"]'))?.trim() === 'Meet Cotton');

  // Guided tutorial: a one-animal board with the sheep (D35)
  await page.click('[data-act="start"]');
  await page.waitForSelector('.game.is-guided [data-coach]');
  // D48 PR A: the two moves one at a time: first a single tap for ✕, on any tile, before any tile glows.
  check('the first board starts with one move: tap any tile once for ✕ (D48)', /tap any tile once/i.test((await page.textContent('[data-coach]')) ?? '') && !(await page.$('.cell.is-guide')));
  check('tutorial board is forgiving (no hearts shown)', !(await page.$('[data-hearts]')));
  check('the first board is a one-animal board', await page.evaluate(() => window.__pt.app.active.session.rule === 'solo'));
  check('a fresh install plays tap ✕ / double-tap', (await scheme()) === 'tap');
  check('a one-animal board has only Erase and Hint below it (no ✕ button)', !(await page.$('[data-tool]')) && (await page.$$('.controls--solo .act')).length === 2 && !(await page.$('.controls [data-act="undo"]')));

  // A tap marks ✕ and a second, slow tap clears it again; animals only come with a double tap.
  const free0 = await emptyTile();
  // D40: the finger is acknowledged the moment it lands (a soft glow), and the ✕ comes with it.
  const at0 = await page.$eval(`.cell[data-r="${free0[0]}"][data-c="${free0[1]}"]`, (el) => {
    const b = el.getBoundingClientRect();
    return [b.x + b.width / 2, b.y + b.height / 2];
  });
  await page.mouse.move(at0[0], at0[1]);
  await page.mouse.down();
  check('a finger on a tile is acknowledged at once (D40)', await page.$eval(`.cell[data-r="${free0[0]}"][data-c="${free0[1]}"]`, (el) => el.classList.contains('is-press')));
  await page.mouse.up();
  check('a tap marks ✕', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], free0)) === 3);
  // Then the second move: one tile glows, and the coach says to double-tap it.
  await page.waitForSelector('.cell.is-guide');
  check('then the tutorial highlights exactly one tile', (await page.$$('.cell.is-guide')).length === 1);
  check('the coach says to double-tap the tile', /double-tap it/i.test((await page.textContent('[data-coach]')) ?? ''));
  await page.waitForTimeout(500);
  await tapCell(free0[0], free0[1]);
  check('a second tap later clears the ✕', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], free0)) === 0);
  await page.waitForTimeout(500);

  // Facial-only: placing an animal never transforms its element, and its face reacts. A double tap places.
  const g = await page.$('.cell.is-guide');
  const box0 = await g.boundingBox();
  const placesBefore = await page.evaluate(() => window.__pt.app.active.session.events.filter((e) => e.type === 'place').length);
  await g.dblclick({ delay: 70 }); // a human pace (D44's bounce guard)
  await page.waitForTimeout(60);
  check('a double tap places the animal with exactly one place event', (await page.evaluate(() => window.__pt.app.active.session.events.filter((e) => e.type === 'place').length)) === placesBefore + 1);
  check('the first board is Easy, so tiles no sheep can reach get a dot', (await page.textContent('.chip--board'))?.includes('Easy') && (await page.$$('.board .cell__dot')).length > 0);
  check('the board shows the animal being brought home (Cotton the sheep)', !!(await page.$('.board .pet[data-pet="cotton"]')));
  const moods = await page.$$eval('.board .pet', (els) => els.map((e) => e.dataset.mood));
  check('a correct placement makes a face react', moods.some((m) => m === 'happy' || m === 'proud'), moods.join(','));
  const transforms = await page.$$eval('.board .cell__pet', (els) => els.map((e) => getComputedStyle(e).transform));
  check('pet tiles are never transformed', transforms.every((t) => t === 'none'), transforms.join(','));
  const box1 = await (await page.$(`.cell[data-r="${await g.getAttribute('data-r')}"][data-c="${await g.getAttribute('data-c')}"]`)).boundingBox();
  check('the tile never moves or resizes', box0.x === box1.x && box0.y === box1.y && box0.width === box1.width, JSON.stringify([box0, box1]));

  await solveActive();
  // D41: the first puzzle's newcomer is shown happening, not reported: the Farm as it was, the change, Cotton, the goal.
  const caption = () => page.textContent('.arrival [data-caption-title]').catch(() => null);
  check('the first puzzle shows the Farm as it was, before its change grows in (D41)', !(await page.$('.win-sheet')) && (await caption()) === 'Empty meadow' && (await page.$$('.arrival .sp-stage[data-stage="1"].is-waiting')).length > 0);
  await page.waitForFunction(() => document.querySelector('.arrival [data-caption-title]')?.textContent === 'Your puzzle grew it!', null, { timeout: 4000 }).catch(() => {});
  check('then the change the puzzle made grows in (D41)', (await page.$$('.arrival .sp-stage[data-stage="1"].is-waiting')).length === 0);
  await page.waitForFunction(() => document.querySelector('.arrival [data-caption-title]')?.textContent === 'Cotton is home!', null, { timeout: 4000 }).catch(() => {});
  check('then Cotton settles in, with her kind and character (D41)', /Your new sheep\. Sleepy/.test((await page.textContent('.arrival')) ?? '') && !(await page.$('.arrival [data-friend="cotton"].is-waiting')));
  await page.click('.arrival [data-act="skip"]');
  check(
    'it ends with a clear goal: Truffle, how many puzzles away; then a welcome snack for Cotton and Continue to level 2 (D41, D49)',
    await page.evaluate(() => {
      const g = document.querySelector('.arrival [data-arrival-goal]');
      return (
        !!g &&
        !g.hidden &&
        /Bring Truffle the piglet home/.test(g.textContent) &&
        /3 more puzzles/.test(g.textContent) &&
        /Give Cotton a welcome snack/.test(g.querySelector('[data-act="snack"]')?.textContent ?? '') &&
        /Your first treat is on us/.test(g.textContent) &&
        g.querySelector('[data-act="play"]')?.textContent === 'Continue to level 2'
      );
    }),
  );
  const afterFirst = await coins();
  check('first clear pays coins', afterFirst >= 45, String(afterFirst));
  await page.click('.arrival [data-act="snack"]');
  await page.waitForSelector('.region');
  // D49 PR A: the Farm opens and Cotton eats her (free) welcome snack at once, with no second "came home"
  // announcement; her Welcome Parade waits under the scene.
  const firstToast = await page.evaluate(() => document.querySelector('.toast')?.textContent ?? '');
  const firstMeal = await page.waitForSelector('.sanctuary__scene [data-friend="cotton"][data-trick="feed"]', { timeout: 8000, state: 'attached' }).then(() => true, () => false);
  const offered = await page.evaluate(() => document.querySelector('[data-act="parade-replay"]:not([hidden])')?.textContent ?? '');
  check('the snack from the arrival plays at once in the Farm; Cotton isn’t announced twice; her parade is offered, not forced (D49)', firstMeal && !/came home/.test(firstToast) && /Cotton/.test(offered), JSON.stringify({ firstMeal, firstToast, offered }));
  await page.waitForSelector('[data-welcome-card="fed"]', { timeout: 10000 });
  check('then the card says she loved it, with Continue as its one button (D49)', await page.evaluate(() => { const c = document.querySelector('[data-welcome-card="fed"]'); return /Cotton (loved|enjoyed) the/.test(c?.textContent ?? '') && c.querySelectorAll('.btn').length === 1; }));
  await page.waitForSelector('.sheet [data-choose="wheelbarrow"]');
  check('visiting opens the Farm, with Farm starter gifts (after the snack)', !!(await page.$('[data-choose="trough"]')));
  check('the first visit names an animal to tap, and rings it (D40)', !!(await page.$('.sanctuary__scene .sp-cue-ring')) && /^Tap Cotton to say hello\.$/.test((await page.textContent('[data-scene-cue="tap"]').catch(() => '')) ?? ''));
  await page.click('[data-choose="wheelbarrow"]');
  check('no second "Ready for the next puzzle?" after the gift: the card has Continue (D49)', !(await page.$('.sheet [data-act="play"]')));
  await page.click('[data-welcome-card] [data-act="welcome-play"]');
  check('starter flow continues to level 2', (await title()) === 'Level 2');
  check('level 2 shows the next animal on its way (Truffle)', await page.evaluate(() => window.__pt.app.active.cast.a === 'truffle'));
  // D41: the board sits in the Farm's frame; its nameplate says the goal; a pip per animal.
  check(
    'the board is framed by its home, with the goal on its nameplate and a pip per animal (D41)',
    await page.evaluate(() => {
      const plate = document.querySelector('.board-frame .board-plate');
      const n = window.__pt.app.active.session.size;
      const box = plate?.getBoundingClientRect();
      return !!document.querySelector('.board-frame > .board') && /Farm/.test(plate?.textContent ?? '') && /Truffle in 3/.test(plate?.textContent ?? '') && box.width > 0 && box.left >= 0 && box.right <= window.innerWidth && document.querySelectorAll('.progress-track .pip').length === n;
    }),
  );

  // Next level advances (v1 regression); an ordinary win is quick: one big button, no hero
  await solveActive();
  const nextLabel = await page.textContent('[data-act="next"]');
  check('win sheet offers the NEXT level', nextLabel?.includes('level 3'), nextLabel ?? '');
  check('a win sparkles over the board, and an ordinary one has no spotlight (D44)', lastSparkle && lastSpotlight === null);
  check('an ordinary win has one big button and no milestone hero', (await page.$$('.win-sheet .sheet__actions .btn--block')).length === 1 && !(await page.$('.win-sheet .win-hero')) && /Farm \+1/.test((await page.textContent('.win-sheet')) ?? ''));
  await page.click('[data-act="next"]');
  await page.waitForTimeout(200);
  check('"Next level" opens level 3', (await title()) === 'Level 3');

  // Replay pays nothing
  const journeyEntries = () => page.evaluate(() => window.__pt.app.save.inventory.ledger.filter((e) => e.source === 'journey').length);
  const before = await journeyEntries();
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 2 }));
  await page.waitForTimeout(200);
  await solveActive();
  check('replaying a solved level mints no journey coins', (await journeyEntries()) === before, `${before} → ${await journeyEntries()}`);
  await page.click('[data-act="next"]');

  // Resume after reload
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 3 }));
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await reload();
  await page.waitForSelector('.journey');
  check('the app opens on the Journey tab, with four tabs', (await page.$$eval('.nav [data-tab]', (els) => els.map((e) => e.dataset.tab))).join(',') === 'journey,world,challenges,shop' && (await page.getAttribute('.nav [data-tab="journey"]', 'aria-current')) === 'page');
  check('the Journey shows the goal (sanctuary and next animal), the level and Continue in its first screen', !!(await page.$('.hero__goal')) && /Truffle/.test((await page.textContent('.hero__goal')) ?? '') && (await page.evaluate(() => document.querySelector('.continue__go').getBoundingClientRect().bottom <= window.innerHeight)));
  // D38: the same on the smallest phone, with the tab bar in the way.
  await page.setViewportSize({ width: 320, height: 568 });
  await page.waitForTimeout(150);
  check('at 320×568 the Play/Resume button is still on the first screen, above the tab bar', await page.evaluate(() => document.querySelector('.continue__go').getBoundingClientRect().bottom <= window.innerHeight - 64));
  await page.setViewportSize({ width: 390, height: 844 });
  await page.waitForTimeout(150);
  const cont = await page.textContent('[data-act="continue"]');
  check('the Journey offers to resume the board in progress', /Resume/i.test(cont ?? ''), cont ?? '');
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(300);
  const placedCount = await page.evaluate(() => window.__pt.app.active.session.placedCount());
  const givens = await page.evaluate(() => window.__pt.app.active.session.puzzle.givens.length);
  check('the resumed board keeps its placements', placedCount === givens + 1, `${placedCount} vs ${givens + 1}`);

  // Three hearts on casual boards (D44); a wrong animal is a fading ghost with a strike, then a red mistake mark that stays
  check('Journey boards show three hearts (D44)', (await page.$$('[data-hearts] .ico')).length === 3);
  check('a Medium board shows no dots: marking is up to the player', (await page.textContent('.chip--board'))?.includes('Medium') && (await page.$$('.board .cell__dot')).length === 0);
  const wrongCell = await emptyTile();
  await dblTap(wrongCell[0], wrongCell[1]);
  const afterWrong = await page.evaluate(([r, c]) => {
    const s = window.__pt.app.active.session;
    return { hearts: s.hearts, cell: s.cells[r][c], errs: s.errorsAt(r, c).length };
  }, wrongCell);
  const wrongSel = `.cell[data-r="${wrongCell[0]}"][data-c="${wrongCell[1]}"]`;
  check('a wrong double tap costs one heart and leaves a mistake on the tile', afterWrong.hearts === 2 && afterWrong.cell === 0 && afterWrong.errs === 1, JSON.stringify(afterWrong));
  check('the mistake shows a fading ghost with a strike', !!(await page.$(`${wrongSel} .cell__strike`)));
  await page.waitForTimeout(800);
  check('the ghost and strike fade; a red mistake mark stays', !(await page.$('.cell__strike')) && !(await page.$('.cell__ghost')) && !!(await page.$(`${wrongSel} .cell__err`)));
  await dblTap(wrongCell[0], wrongCell[1]);
  check('the same wrong guess again costs nothing', (await page.evaluate(() => window.__pt.app.active.session.hearts)) === 2 && /already tried/.test((await page.textContent('[data-coach]')) ?? ''));
  await page.waitForTimeout(450);
  // The board says which sanctuary it is for.
  check('the board header names the sanctuary the board helps', (await page.textContent('[data-for]'))?.includes('Farm'));
  check('regions are separated by soft seams, not dark lines', await page.evaluate(() => getComputedStyle(document.querySelector('.board__lines .div')).stroke !== 'rgb(52, 67, 63)'));

  // Erase is a mode that stays on, and it only takes ✕ marks back: animals and mistakes stay
  const xTile = await emptyTile();
  await tapCell(xTile[0], xTile[1]);
  await page.waitForTimeout(450);
  const animalTile = await page.evaluate(() => {
    const s = window.__pt.app.active.session;
    for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === 1) return [r, c];
    return null;
  });
  await page.click('[data-act="erase"]');
  check('Erase stays on until it is tapped again', (await page.getAttribute('[data-act="erase"]', 'aria-pressed')) === 'true');
  await tapCell(xTile[0], xTile[1]);
  check('with Erase on, a tap takes the ✕ back', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], xTile)) === 0);
  await tapCell(animalTile[0], animalTile[1]);
  check('Erase leaves a placed animal where it is', (await page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], animalTile)) === 1);
  await tapCell(wrongCell[0], wrongCell[1]);
  check('Erase leaves a mistake mark where it is', !!(await page.$(`${wrongSel} .cell__err`)) && /Mistakes stay marked/.test((await page.textContent('[data-coach]')) ?? ''));
  await page.click('[data-act="erase"]');
  await page.click('[data-act="pause"]');
  check('the pause sheet has undo, redo and How to play', !!(await page.$('.sheet [data-act="undo"]')) && !!(await page.$('.sheet [data-act="rules"]')));
  await page.click('.sheet [data-act="rules"]');
  check('How to play explains the one-animal rule with the board animal', /One piglet/.test((await page.textContent('.rules')) ?? ''));
  check('How to play uses real plurals', /Piglets never touch/.test((await page.textContent('.rules')) ?? ''));
  check('How to play describes tap ✕ and double-tap to place, and red mistakes', /Double-tap<\/b> to place/.test((await page.innerHTML('.rules')) ?? '') && /marked in red/.test((await page.textContent('.rules')) ?? ''));
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(200);

  // One Undo after a double-tap empties the tile (the first tap's ✕ goes with it); a tap or Space never takes an animal away
  const right = await page.evaluate(() => {
    const s = window.__pt.app.active.session;
    for (let r = 0; r < s.size; r++) for (let c = 0; c < s.size; c++) if (!s.givenMask[r][c] && s.cells[r][c] === 0 && s.puzzle.solution[r][c] === 1) return [r, c];
    return null;
  });
  const cellAt = () => page.evaluate(([r, c]) => window.__pt.app.active.session.cells[r][c], right);
  await dblTap(right[0], right[1]);
  check('a double-tap on the right tile places the animal', (await cellAt()) === 1);
  await page.waitForTimeout(450);
  await tapCell(right[0], right[1]);
  check('a tap on a placed animal leaves it', (await cellAt()) === 1);
  await page.click('[data-act="pause"]');
  await page.click('.sheet [data-act="undo"]');
  await page.waitForTimeout(150);
  check('one Undo after a double-tap empties the tile', (await cellAt()) === 0);
  await page.waitForTimeout(450);
  await dblTap(right[0], right[1]);
  await page.focus(`.cell[data-r="${right[0]}"][data-c="${right[1]}"]`);
  await page.keyboard.press('Space');
  check('Space never takes an animal away', (await cellAt()) === 1);

  // Hints: the board's first look is free, the exact cell costs one hint, placing that cell costs nothing more
  const hintCount = () => page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'hint').reduce((a, e) => a + e.delta, 0));
  const t0 = await hintCount();
  check('Hint shows how many hints you have, and says the first look is free', (await page.textContent('[data-hint-badge]'))?.trim() === String(t0) && (await page.textContent('[data-hint-label]'))?.trim() === 'Free hint');
  await page.click('[data-act="hint"]');
  check('the first look costs no ticket', (await hintCount()) === t0, `${t0} → ${await hintCount()}`);
  check('after the look, the button offers to explain', (await page.textContent('[data-hint-label]'))?.trim() === 'Explain');
  await page.click('[data-act="hint"]');
  check('the exact cell costs one ticket, and the count on Hint goes down', (await hintCount()) === t0 - 1 && (await page.textContent('[data-hint-badge]'))?.trim() === String(t0 - 1), `${t0} → ${await hintCount()}`);
  await page.click('[data-act="hint"]');
  check('placing that same cell costs nothing more', (await hintCount()) === t0 - 1, `${t0} → ${await hintCount()}`);

  // Extra lives: one heart back from the hearts button, kept with the board
  const wc = await emptyTile();
  await dblTap(wc[0], wc[1]);
  const heartsBefore = await page.evaluate(() => window.__pt.app.active.session.hearts);
  const treatsBefore = await page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'life').reduce((a, e) => a + e.delta, 0));
  await page.click('[data-act="hearts"]');
  await page.click('[data-act="life"]');
  await page.waitForTimeout(150);
  const afterTreat = await page.evaluate(() => ({
    hearts: window.__pt.app.active.session.hearts,
    treats: window.__pt.app.save.inventory.items.filter((e) => e.item === 'life').reduce((a, e) => a + e.delta, 0),
  }));
  check('an extra life gives one heart back and is used once', afterTreat.hearts === heartsBefore + 1 && afterTreat.treats === treatsBefore - 1, JSON.stringify({ heartsBefore, treatsBefore, ...afterTreat }));
  await solveActive();
  check('the win sheet shows Paw Points', /Paw Points/.test((await page.textContent('.win-sheet')) ?? ''));
  await page.click('[data-act="next"]');
  await page.waitForTimeout(200);

  // Decor charged exactly once
  await page.evaluate(() => {
    window.__pt.app.save.inventory.ledger.push({ id: 'e2e:seed', delta: 500, at: new Date().toISOString(), source: 'gift' });
    window.__pt.app.persist();
    window.__pt.go({ screen: 'shop', sanctuary: 'harmony' });
  });
  const c0 = await coins();
  await page.click('[data-decor="rug"]');
  await page.click('[data-act="buy"]');
  await page.waitForTimeout(200);
  await page.click('[data-decor="rug"]');
  const buyAgain = await page.$('[data-act="buy"]');
  check('decor costs exactly its price, once', (await coins()) === c0 - 110 && !buyAgain, `${c0} → ${await coins()}`);
  await page.keyboard.press('Escape');
  await reload();
  check('purchased decor survives reload', await page.evaluate(() => !!window.__pt.app.save.inventory.decor.rug));

  // Video tokens come only from a (test) reward video; each sanctuary has its own treats, fed from an animal's card
  await page.evaluate(() => window.__pt.go({ screen: 'shop' }));
  await page.waitForSelector('[data-act="watch-token"]');
  const vt = () => page.evaluate(() => window.__pt.app.save.inventory.items.filter((e) => e.item === 'vtoken').reduce((a, e) => a + e.delta, 0));
  const vt0 = await vt();
  await page.click('[data-act="watch-token"]');
  await page.waitForTimeout(1900);
  check('a watched test video grants one video token', (await vt()) === vt0 + 1, `${vt0} → ${await vt()}`);
  await page.click('[data-tab="food"]');
  await page.click('[data-place="farm"]');
  check('the Farm sells its own treats', !!(await page.$('[data-food="hay"]')) && !(await page.$('[data-food="kibble"]')));
  await page.click('[data-food="hay"]');
  await page.click('[data-act="buy"]');
  await page.click('[data-act="close"]');
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.click('.resident-row [data-friend-card="cotton"]');
  // (D49: Cotton has had her welcome snack already, so the hearts are counted from here.)
  const aff0 = await page.evaluate(() => window.__pt.app.save.sanctuary.affection.cotton ?? 0);
  await page.click('[data-feed="hay"]');
  check('feeding a favorite food adds two hearts of affection', (await page.evaluate(() => window.__pt.app.save.sanctuary.affection.cotton)) === aff0 + 2, String(aff0));
  await page.keyboard.press('Escape');

  // Sanctuary life: a tap on an animal gets a small reaction; ambient actions come and go on their own
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.waitForSelector('.sanctuary__scene.is-live .sanctuary__pet');
  const greeted = await page
    .waitForFunction(() => document.querySelector('.sanctuary__scene .sanctuary__pet:is(.is-greet, .is-hop, .is-wag)'), null, { timeout: 3000 })
    .then(
      () => true,
      () => false,
    );
  check('the animals say hello when you arrive', greeted);
  // The drawn animals fade out (260 ms) as the toys arrive: wait for the fade to finish, not just for the canvas (on a
  // slow CI runner the check used to land mid-fade).
  const toysShown = await page
    .waitForFunction(() => !!document.querySelector('.sanctuary__scene.has-3d > canvas.scene3d') && getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity === '0', null, { timeout: 15000 })
    .then(
      () => true,
      () => false,
    );
  check(
    'the Farm animals appear as 3D toys over the drawn scene',
    toysShown,
    await page.evaluate(() => JSON.stringify({ has3d: !!document.querySelector('.sanctuary__scene.has-3d > canvas.scene3d'), opacity: getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity })),
  );
  // D44 PR C: the camera moves the drawing and the toys together. A figure's ground point, drawn (through the SVG) and
  // in 3D (through the stage's camera), lands on the same screen pixel at the whole scene and in a 2× close-up.
  const aligned = await page.evaluate(() => {
    const st = window.__stage3d;
    const cam = window.__cam;
    const svg = document.querySelector('.sanctuary__scene svg');
    const fig = svg.querySelector('.sanctuary__pet[data-gx]');
    if (!st || !cam || !fig) return null;
    const key = fig.dataset.pet ?? `friend:${fig.dataset.friend}`;
    const gx = Number(fig.dataset.gx);
    const gy = Number(fig.dataset.gy);
    const off = () => {
      const z = (gy - 150) * 0.35;
      const k = (900 - z) / 900;
      const v = st.actor(key).toy.root.position.clone().set((gx - 180) * k, (150 - gy) * k, z).project(st.camera);
      const r = st.canvas.getBoundingClientRect();
      const pt = svg.createSVGPoint();
      pt.x = gx;
      pt.y = gy;
      const sp = pt.matrixTransform(svg.getScreenCTM());
      return Math.hypot(r.left + ((v.x + 1) / 2) * r.width - sp.x, r.top + ((1 - v.y) / 2) * r.height - sp.y);
    };
    const whole = off();
    cam.cut(cam.viewOf(fig, 2));
    const close = off();
    const zoomed = cam.zoom;
    cam.cut(cam.full);
    return { whole, close, zoomed, back: svg.getAttribute('viewBox') };
  });
  check(
    'the camera keeps every toy on its drawn spot, at the whole scene and in a 2× close-up (D44)',
    !!aligned && aligned.whole < 2 && aligned.close < 2 && aligned.zoomed > 1.9 && aligned.back === '0 0 360 300',
    JSON.stringify(aligned),
  );
  // D44 PR D: a group dance plays on every toy at once, on the music's beat clock, and a skip stops them all.
  const danced = await page.evaluate(async () => {
    const { planDance, startDance } = await import('/src/ui/components/dance.ts');
    const { playCue } = await import('/src/services/music.ts');
    const svg = document.querySelector('.sanctuary__scene svg');
    const st = window.__stage3d;
    const key = (d) => d.fig.dataset.pet ?? `friend:${d.fig.dataset.friend}`;
    const pb = playCue('bounce', { silent: true });
    const plan = planDance(svg, { bpm: pb.score.bpm, beats: pb.score.beats });
    const h = startDance(svg, plan, pb, { reducedMotion: false });
    await new Promise((r) => setTimeout(r, 700));
    const during = plan.map((d) => st?.actor(key(d))?.performing(performance.now()) ?? null);
    h.stop();
    pb.stop(0);
    await new Promise((r) => setTimeout(r, 300));
    const after = plan.map((d) => st?.actor(key(d))?.performing(performance.now()) ?? null);
    const busy = plan.filter((d) => d.fig.dataset.trick).length;
    return { n: plan.length, during, after, busy };
  });
  check(
    'a group dance plays on every toy at once, and a skip stops them all (D44)',
    danced.n >= 1 && danced.during.every((p) => p?.startsWith('dance:')) && danced.after.every((p) => !p) && danced.busy === 0,
    JSON.stringify(danced),
  );
  // D44 PR G: the Farm's landmark: tapping the barn opens its doors and a chick peeks out (in 3D too).
  const grownBefore = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  await page.evaluate(() => {
    window.__pt.app.save.world.growth.farm = Math.max(window.__pt.app.save.world.growth.farm ?? 0, 8);
    window.__pt.go({ screen: 'region', id: 'farm' });
  });
  await page.waitForSelector('.sanctuary__scene [data-landmark="barn"]', { timeout: 5000 }).catch(() => {});
  await page.waitForTimeout(400);
  const barn = await page.evaluate(async () => {
    const lm = document.querySelector('.sanctuary__scene [data-landmark="barn"]');
    if (!lm) return null;
    lm.querySelector('.sp-door--l').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await new Promise((r) => setTimeout(r, 1000));
    const door = lm.querySelector('.sp-door--l').getBoundingClientRect().width;
    const peek = getComputedStyle(lm.querySelector('.sp-peek')).transform;
    return { open: lm.classList.contains('is-open'), door, peek, line: document.querySelector('[data-chat] span')?.textContent ?? '' };
  });
  check('tapping the barn opens its doors and a chick peeks out (D44)', !!barn && barn.open && barn.door < 8 && /none|matrix\(1, 0, 0, 1, 0, 0\)/.test(barn.peek) && /chick/.test(barn.line), JSON.stringify(barn));
  // D44 PR H: the guided tour: the camera visits the barn first (captioned), and Stop gives the whole scene back.
  await page.waitForTimeout(2000);
  await page.click('.sanctuary__scene [data-act="tour"]');
  await page.waitForTimeout(1300);
  const touring = await page.evaluate(() => ({ zoom: window.__cam?.zoom ?? 0, caption: document.querySelector('.tour-caption')?.textContent ?? '', open: !!document.querySelector('[data-landmark="barn"].is-open') }));
  check('the Tour button takes the camera round the home, starting at the barn (D44)', touring.zoom > 1.5 && touring.caption === 'The barn' && touring.open, JSON.stringify(touring));
  await page.click('.sanctuary__scene [data-act="tour-stop"]');
  await page.waitForTimeout(700);
  const toured = await page.evaluate(() => ({ zoom: window.__cam?.zoom ?? 0, caption: !!document.querySelector('.tour-caption'), btn: !document.querySelector('.sanctuary__scene [data-act="tour"]')?.hidden }));
  check('Stop ends the tour on the whole scene (D44)', toured.zoom === 1 && !toured.caption && toured.btn, JSON.stringify(toured));
  // D45 PR A: the scene director. A trick's close-up, then the tour: the close-up ends, the scene stays held for the
  // whole tour (the close-up's ending must not wake it), and Stop gives back a live scene with nobody owning the camera.
  await page.click('.sanctuary__scene .sanctuary__pet');
  await page.waitForSelector('.trick-tray');
  await page.click('.trick-chip[data-trick="wave"]');
  await page.waitForTimeout(300);
  const sceneDir = () => page.evaluate(() => ({ owner: window.__director?.owner ?? null, paused: window.__director?.paused ?? null, closeup: !!document.querySelector('.sanctuary__scene.is-closeup'), touring: !!document.querySelector('.sanctuary__scene.is-touring'), tray: !!document.querySelector('.trick-tray') }));
  const sd1 = await sceneDir();
  await page.evaluate(() => document.querySelector('.sanctuary__scene [data-act="tour"]').click());
  const sd2 = await sceneDir();
  await page.waitForTimeout(2200);
  const sd3 = await sceneDir();
  check('a tour started during a trick takes the camera over, and the scene stays held throughout (D45)', sd1.owner === 'closeup' && sd1.paused && sd2.owner === 'tour' && sd2.paused && !sd2.closeup && !sd2.tray && sd3.owner === 'tour' && sd3.paused && sd3.touring, JSON.stringify({ sd1, sd2, sd3 }));
  await page.click('.sanctuary__scene [data-act="tour-stop"]');
  await page.waitForTimeout(700);
  const sd4 = await sceneDir();
  check('after Stop nobody owns the camera and the scene is live again (D45)', sd4.owner === null && sd4.paused === false && !sd4.touring && (await page.evaluate(() => window.__cam?.zoom)) === 1, JSON.stringify(sd4));
  await page.waitForTimeout(1500);
  // D44 PR I: walk round the Farm in 3D: it opens with its animals, draws, the arrows walk, a tap walks there, and
  // closing releases its WebGL context and gives focus back.
  await page.click('.sanctuary__scene [data-act="walk"]');
  await page.waitForSelector('.walk canvas.walk__canvas', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(800);
  const w0 = await page.evaluate(() => {
    const w = window.__walk;
    return w ? { x: w.walker.x, z: w.walker.z, drawn: w.drawn, animals: w.animals.length } : null;
  });
  const fwd = await page.$('.walk__btn--up');
  const fb = await fwd?.boundingBox();
  if (fb) {
    await page.mouse.move(fb.x + fb.width / 2, fb.y + fb.height / 2);
    await page.mouse.down();
    await page.waitForTimeout(900);
    await page.mouse.up();
  }
  const w1 = await page.evaluate(() => ({ z: window.__walk?.walker.z ?? 0, drawn: window.__walk?.drawn ?? 0 }));
  const vb = await page.$('.walk__view');
  const vbb = await vb?.boundingBox();
  if (vbb) await page.mouse.click(vbb.x + vbb.width * 0.5, vbb.y + vbb.height * 0.62);
  await page.waitForTimeout(400);
  const w2 = await page.evaluate(() => ({ target: !!window.__walk?.walker.target || (window.__walk?.walker.z ?? 0) < 0 }));
  check(
    'the Walk button opens the 3D Farm with its animals; it draws, the arrows walk and a tap sets off (D44)',
    !!w0 && w0.animals >= 1 && w0.drawn > 0 && w1.z < w0.z - 0.3 && w1.drawn > w0.drawn && w2.target,
    JSON.stringify({ w0, w1, w2 }),
  );
  // D45 PR C: the walk shows the same Farm (the decorations that are out), the scene's own 3D layer has let go of its
  // WebGL context meanwhile (one canvas), and there is a map, "Go to" buttons and a way back by name.
  const walk45 = await page.evaluate(() => ({
    canvases: document.querySelectorAll('canvas').length,
    decor: [...(window.__walk?.decor ?? [])].sort(),
    drawn: [...document.querySelectorAll('.sanctuary__scene [data-decor]')].map((g) => g.dataset.decor).sort(),
    mapDecor: [...document.querySelectorAll('.walk__map [data-map-decor]')].map((g) => g.dataset.mapDecor).sort(),
    me: !!document.querySelector('.walk__map [data-map-me]')?.getAttribute('transform'),
    chips: document.querySelectorAll('.walk [data-goto]').length,
    back: document.querySelector('.walk__back')?.textContent?.trim() ?? '',
  }));
  check(
    'the 3D Farm has the decorations the drawn Farm has, a map, Go-to buttons and Overview; only one WebGL canvas is alive (D45)',
    walk45.canvases === 1 && walk45.decor.length >= 1 && walk45.decor.join() === walk45.drawn.join() && walk45.mapDecor.join() === walk45.decor.join() && walk45.me && walk45.chips >= 1 && walk45.back === 'Overview',
    JSON.stringify(walk45),
  );
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  const closedWalk = await page.evaluate(() => ({ open: !!document.querySelector('.walk'), canvases: document.querySelectorAll('canvas').length, focus: document.activeElement?.dataset?.act ?? '' }));
  check('closing the walk releases it and returns focus to the Walk button (D44)', !closedWalk.open && closedWalk.canvases === 1 && closedWalk.focus === 'walk', JSON.stringify(closedWalk));
  await page.evaluate((g) => {
    window.__pt.app.save.world.growth.farm = g;
    window.__pt.go({ screen: 'region', id: 'farm' });
  }, grownBefore);
  await page.waitForSelector('.sanctuary__scene.has-3d > canvas.scene3d', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1500);
  // D44 PR E: Meet opens the Welcome Parade: the camera comes in on the newcomer, then every toy dances; Skip gives the
  // whole scene back with nobody mid-dance, and Replay is offered.
  const newcomer = await page.evaluate(() => document.querySelector('.sanctuary__scene .sanctuary__pet[data-friend]')?.dataset.friend);
  await page.evaluate((who) => window.__pt.go({ screen: 'region', id: 'farm', welcome: [who] }), newcomer);
  await page.waitForSelector('.sanctuary__scene.has-3d.is-parading', { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(1600);
  const parade = await page.evaluate(() => {
    const st = window.__stage3d;
    const figs = [...document.querySelectorAll('.sanctuary__scene .sanctuary__pet[data-gx]')];
    const key = (f) => f.dataset.pet ?? `friend:${f.dataset.friend}`;
    const now = performance.now();
    return {
      skip: !!document.querySelector('.sanctuary__scene .parade-skip'),
      roles: figs.map((f) => (f.dataset.trick ?? '').split(':')[1] ?? ''),
      toys: figs.map((f) => st?.actor(key(f))?.performing(now)?.split(':')[1] ?? null),
      zoom: window.__cam?.zoom ?? 0,
    };
  });
  check(
    'Meet plays the Welcome Parade: the newcomer leads, every toy dances, the camera comes in close (D44)',
    parade.skip && parade.roles.filter((r) => r === 'newcomer').length === 1 && parade.toys.every((t) => t === 'newcomer' || t === 'guest') && parade.zoom > 1.2,
    JSON.stringify(parade),
  );
  await page.click('.sanctuary__scene .parade-skip');
  await page.waitForTimeout(600);
  const afterSkip = await page.evaluate(() => {
    const st = window.__stage3d;
    const figs = [...document.querySelectorAll('.sanctuary__scene .sanctuary__pet[data-gx]')];
    const key = (f) => f.dataset.pet ?? `friend:${f.dataset.friend}`;
    return {
      dancing: figs.filter((f) => f.dataset.trick?.startsWith('dance:')).length,
      toys: figs.filter((f) => st?.actor(key(f))?.performing(performance.now())?.startsWith('dance:')).length,
      vb: document.querySelector('.sanctuary__scene svg').getAttribute('viewBox'),
      replay: !document.querySelector('[data-act="parade-replay"]')?.hidden,
    };
  });
  check('Skip ends the parade: nobody mid-dance, the whole scene back, Replay offered (D44)', afterSkip.dancing === 0 && afterSkip.toys === 0 && afterSkip.vb === '0 0 360 300' && afterSkip.replay, JSON.stringify(afterSkip));
  await page.waitForTimeout(3000);
  await page.evaluate(() => {
    window.__seen = new Set();
    new MutationObserver((ms) => {
      for (const m of ms) for (const c of m.target.classList) if (c.startsWith('is-') && c !== 'is-live') window.__seen.add(c);
    }).observe(document.querySelector('.sanctuary__scene svg'), { subtree: true, attributes: true, attributeFilter: ['class'] });
  });
  await page.click('.sanctuary__scene .sanctuary__pet');
  check('tapping an animal in the scene makes it react', await page.evaluate(() => window.__seen.has('is-greet') || window.__seen.has('is-love')));
  check('tapping an animal is what dismisses the cue, for good', !(await page.$('[data-scene-cue="tap"]')) && (await page.evaluate(() => window.__pt.app.save.onboarding.sceneTapTipSeen)));
  await page.waitForTimeout(10_000);
  const seen = await page.evaluate(() => [...window.__seen]);
  check('the garden comes alive by itself within 10 seconds', seen.some((c) => c !== 'is-love' && c !== 'is-greet'), seen.join(','));
  check('no more than three figures move at once', await page.evaluate(() => document.querySelectorAll('.sanctuary__scene [class*="is-"]:not(.is-live)').length <= 3));

  // Decoration activities: tapping the little red tractor sends someone for a ride, then brings them back
  await page.evaluate(() => {
    window.__pt.app.save.inventory.decor.tractor = { ownedAt: new Date().toISOString() };
    window.__pt.app.persist();
    window.__pt.go({ screen: 'region', id: 'farm' });
  });
  await page.waitForSelector('.sanctuary__scene [data-decor="tractor"].has-act');
  await page.waitForTimeout(2500);
  await page.evaluate(() => document.querySelector('.sanctuary__scene [data-decor="tractor"]').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await page.waitForTimeout(300);
  const ride = await page.evaluate(() => ({
    rider: !!document.querySelector('.sp-tractor .sp-act .sp-rider-fig'),
    away: document.querySelectorAll('.sanctuary__scene .sanctuary__pet.is-away').length,
    caption: document.querySelector('[data-chat] span')?.textContent ?? '',
  }));
  check('tapping the tractor sends an animal for a ride', ride.rider && ride.away === 1 && /tractor/.test(ride.caption), JSON.stringify(ride));
  check('in 3D, the toy itself rides the tractor', await page.evaluate(() => (window.__stage3d?.riders() ?? []).some((r) => r.decor === 'tractor')));
  await page.waitForTimeout(6800);
  check('the ride ends and the animal comes back', await page.evaluate(() => !document.querySelector('.sp-act') && !document.querySelector('.is-away')));

  // Tricks: tap an animal, ask for a free trick; a locked one opens its card instead
  await page.click('.sanctuary__scene .sanctuary__pet');
  await page.waitForSelector('.trick-tray');
  check('tapping an animal offers its tricks', /^Ask .+ to…$/.test((await page.textContent('.trick-tray__head b'))?.trim() ?? ''));
  await page.click('.trick-chip[data-trick="wave"]');
  const trick = await page.evaluate(() => {
    const fig = document.querySelector('.sanctuary__scene .sanctuary__pet[data-trick]');
    const key = fig?.dataset.pet ?? `friend:${fig?.dataset.friend}`;
    // Drawn animals get a drawn emote; 3D toys perform it on the stage (D34).
    const shown = !!document.querySelector('.sanctuary__scene .sp-trick .sp-trick-emote') || window.__stage3d?.actor(key)?.performing(performance.now()) === 'wave';
    return { on: fig?.dataset.trick, shown };
  });
  check('a free trick plays with its emote', trick.on === 'wave' && trick.shown, JSON.stringify(trick));
  // D44 PR F: the trick gets a close-up (the scene quiets around it) and the whole scene comes back after.
  await page.waitForTimeout(550);
  const close = await page.evaluate(() => ({ zoom: window.__cam?.zoom ?? 0, quiet: !!document.querySelector('.sanctuary__scene.is-closeup') }));
  check('a trick gets a close-up, and the rest of the scene quiets (D44)', close.zoom > 1.8 && close.quiet, JSON.stringify(close));
  await page.waitForTimeout(1250);
  check('the trick ends by itself', await page.evaluate(() => !document.querySelector('.sp-trick') && !document.querySelector('.sanctuary__scene [data-trick]')));
  await page.waitForTimeout(700);
  const back = await page.evaluate(() => ({ zoom: window.__cam?.zoom ?? 0, quiet: !!document.querySelector('.sanctuary__scene.is-closeup'), vb: document.querySelector('.sanctuary__scene svg').getAttribute('viewBox') }));
  check('after the trick, the camera gives the whole scene back (D44)', back.zoom === 1 && !back.quiet && back.vb === '0 0 360 300', JSON.stringify(back));
  await page.click('[data-tray-tab="emote"]');
  await page.click('.trick-chip[data-trick="love"]');
  check('a free emote plays from the Emotes tab', await page.evaluate(() => document.querySelector('.sanctuary__scene .sanctuary__pet[data-trick]')?.dataset.trick === 'love'));
  await page.waitForTimeout(1900);
  await page.click('[data-tray-tab="trick"]');
  await page.click('.trick-chip[data-trick="backflip"]');
  await page.waitForSelector('.trick-sheet');
  await page.waitForSelector('.trick-sheet__stage.has-3d', { timeout: 10000 }).catch(() => {});
  check('the card previews the trick with a 3D toy', await page.evaluate(() => !!document.querySelector('.trick-sheet__stage.has-3d > canvas.scene3d')));
  check('a premium trick opens its card, bought with gems only', /gem/i.test(await page.textContent('.trick-sheet')) && !(await page.$('.trick-sheet [data-act="watch"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  const spent = await page.evaluate(() => {
    const s = window.__pt.app.save;
    return s.inventory.items.length;
  });
  await page.click('.trick-chip[data-trick="spin"]');
  await page.waitForSelector('.trick-sheet');
  check('a video-token trick can’t be bought without tokens', !!(await page.$('.trick-sheet button[disabled]')) && !(await page.$('.trick-sheet [data-act="buy"]')));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
  check('closing a card releases its 3D preview', await page.evaluate(() => document.querySelectorAll('canvas.scene3d').length === 1));
  check('looking at tricks charges nothing', (await page.evaluate(() => window.__pt.app.save.inventory.items.length)) === spent);
  // Without a pointer: the Tricks button opens the same tray, focus goes into it and comes back when it closes
  await page.click('[data-act="tray-close"]');
  check('closing the tray returns focus to the Tricks button', await page.evaluate(() => document.activeElement?.dataset?.act === 'tricks' && document.querySelector('.trick-tray-slot').hidden));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.trick-tray');
  check('the Tricks button opens the tray from the keyboard', await page.evaluate(() => !!document.activeElement?.closest('.trick-tray') && document.querySelector('[data-act="tricks"]').getAttribute('aria-expanded') === 'true'));
  await page.evaluate(() => window.__pt.go({ screen: 'shop', tab: 'tricks' }));
  await page.waitForSelector('.trick-card');
  check('the Shop lists every trick and emote, in four groups (D48)', (await page.$$('.trick-card')).length === 36 && (await page.$$('.shop__group')).length === 4);

  // Paw Cup waits for the two-animal lesson; then an open attempt survives other play, resumes, and scores from its log
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="week"]');
  await page.click('[data-act="ok"]').catch(() => {});
  check('Paw Cup boards stay closed before two animals', !(await page.$('[data-board="0"]')));

  // Level 21: the two-animal lesson, a guided board with an animal button for each
  await page.evaluate(() => {
    const s = window.__pt.app.save;
    for (let i = 1; i < 21; i++) s.journey.clears['L' + i] ??= { firstClearAt: new Date().toISOString(), bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    s.journey.nextLevel = 21;
    s.onboarding.pairLessonDone = false;
    window.__pt.app.persist();
    window.__pt.start({ kind: 'level', level: 21 });
  });
  await page.waitForSelector('.rules-bridge');
  check('level 21 opens with a short bridge: the two-animal rules drawn with the board\'s animals', /A second animal joins/.test((await page.textContent('.rules-bridge')) ?? '') && (await page.$$('.rules-bridge .rule-fig')).length >= 2 && !(await page.$('.cell.is-guide')));
  await page.click('.rules-bridge [data-act="ok"]');
  await page.waitForSelector('.game.is-guided .cell.is-guide');
  const lesson = await page.evaluate(() => ({
    rule: window.__pt.app.active.session.rule ?? 'pair',
    tools: document.querySelectorAll('.controls--pair [data-tool]').length,
    animals: document.querySelectorAll('.controls--pair [data-tool="cat"], .controls--pair [data-tool="dog"]').length,
    coach: document.querySelector('[data-coach]')?.textContent ?? '',
    cast: window.__pt.app.active.cast,
  }));
  check('level 21 teaches two animals on a guided board', lesson.rule === 'pair' && lesson.animals === 2 && lesson.tools === 2 && /two animals/i.test(lesson.coach), JSON.stringify(lesson));
  check('the lesson pairs the animal coming home with a different kind already home', !!lesson.cast.b && lesson.cast.a !== lesson.cast.b, JSON.stringify(lesson.cast));
  await reachPairs(25);
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="week"]');
  await page.click('[data-board="0"]');
  await page.click('[data-act="go"]');
  await page.waitForTimeout(200);
  check('two-animal boards have two animal tools', (await page.$$('.controls--pair [data-tool="cat"], .controls--pair [data-tool="dog"]')).length === 2);
  await solveActive({ stopAfter: 2 }).catch(() => {});
  await page.click('[data-act="pause"]');
  check('Paw Cup hides the board while paused', !!(await page.$('.board-veil')));
  await page.click('.sheet [data-act="rules"]');
  check('…and while the rules are open', !!(await page.$('.board-veil')));
  await page.click('[data-act="ok"]');
  await page.waitForTimeout(150);
  check('the board comes back after the rules', !(await page.$('.board-veil')));
  await page.click('[data-act="leave"]');
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 4 }));
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  check('the open Cup attempt is still resumable after playing another board', !!(await page.$('[data-resume="0"]')));
  await page.click('[data-resume="0"]');
  await page.waitForTimeout(200);
  await solveActive();
  const pts = Number((await page.textContent('.score-card__total .num')) ?? 0);
  check('a resumed Cup attempt scores from its whole log', pts > 550, String(pts));
  await page.click('[data-act="next"]');

  // Two-animal boards remember the animal picked last
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 23 }));
  await page.waitForTimeout(300);
  await page.click('[data-tool="dog"]');
  await page.evaluate(() => window.__pt.app.saveActive());
  await reload();
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 24 }));
  await page.waitForTimeout(300);
  check('the next two-animal board opens with the last animal picked', (await page.getAttribute('[data-tool="dog"]', 'aria-checked')) === 'true');
  const castNames = await page.$$eval('.controls [data-tool="cat"] .tool__label, .controls [data-tool="dog"] .tool__label', (els) => els.map((e) => e.textContent));
  check('the animal buttons are named for the board’s animals', castNames.length === 2 && castNames.every((n) => n && n !== 'Cat' && n !== 'Dog'), castNames.join(','));

  // Re-entering a mode resumes its saved board instead of wiping it
  const dk = await page.evaluate(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  await page.evaluate((k) => window.__pt.start({ kind: 'daily', dateKey: k }), dk);
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="daily"]');
  await page.waitForTimeout(200);
  const dPlaced = await page.evaluate(() => window.__pt.app.active.session.placedCount());
  const dGivens = await page.evaluate(() => window.__pt.app.active.session.puzzle.givens.length);
  check('tapping the Daily again continues the saved daily', dPlaced === dGivens + 1, `${dPlaced} vs ${dGivens + 1}`);

  // World map: the goal first, then a pin for every sanctuary; the Farm is built first; every solve grows the sanctuary being built
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('.nav [data-tab="world"]');
  await page.waitForSelector('.world-map');
  check('the World shows what you are building and a Play button before the map', await page.evaluate(() => {
    const f = document.querySelector('.world-focus');
    const m = document.querySelector('.world-map');
    return !!f && !!m && f.getBoundingClientRect().top < m.getBoundingClientRect().top && f.querySelector('[data-act="play"]').getBoundingClientRect().bottom <= window.innerHeight;
  }));
  check('the World tab shows a pin for every sanctuary', (await page.$$('.world-pin')).length === 6);
  check('the Farm is being built', !!(await page.$('.world-pin.is-building[data-go="farm"]')));
  check('the Outback is open by level 25', !(await page.$('.world-pin.is-locked[data-go="outback"]')));
  check('later sanctuaries stay locked until their level', !!(await page.$('.world-pin.is-locked[data-go="amazon"]')));
  check('open sanctuaries say "Build here", never "Paused"', /^Build here/.test((await page.textContent('.world-card[data-go="outback"] .world-card__status'))?.trim() ?? '') && !/Paused/.test((await page.textContent('.world')) ?? ''));
  // Back from a sanctuary returns to the World where you were, not Home.
  await page.evaluate(() => window.scrollTo(0, 420));
  await page.waitForTimeout(100);
  const scrollBefore = await page.evaluate(() => window.scrollY);
  await page.click('.world-card[data-go="farm"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  await page.click('.region [data-act="back"]');
  await page.waitForSelector('.world-map');
  await page.waitForTimeout(100);
  check('Back from the Farm returns to the World at the same scroll position', Math.abs((await page.evaluate(() => window.scrollY)) - scrollBefore) < 4 && (await page.getAttribute('.nav [data-tab="world"]', 'aria-current')) === 'page', `${scrollBefore} → ${await page.evaluate(() => window.scrollY)}`);
  await page.click('.world-card[data-go="farm"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  // The Shop opened from the Farm comes back to the Farm.
  await page.click('.region [data-act="shop"]');
  await page.waitForSelector('.shop');
  check('the Shop opened from the Farm has a Back to the Farm action', (await page.getAttribute('[data-act="back-from"]', 'aria-label')) === 'Back to the Farm');
  await page.click('[data-act="back-from"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  check('…which returns to the Farm', await page.evaluate(() => window.__pt.app.router.route.screen === 'region' && window.__pt.app.router.route.id === 'farm'));
  // The Pet Garden goes back the same way.
  await page.evaluate(() => window.__pt.go({ screen: 'world' }));
  await page.click('.world-card[data-go="harmony"]');
  await page.waitForSelector('.sanctuary [data-act="back"]');
  await page.click('.sanctuary [data-act="back"]');
  check('Back from the Pet Garden returns to the World too', await page.evaluate(() => window.__pt.app.router.route.screen === 'world'));
  await page.click('.world-card[data-go="farm"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  const g0 = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  await page.click('.region-progress [data-act="play"]');
  await page.waitForSelector('.board');
  await page.waitForTimeout(500);
  if (await page.$('.overlay')) await page.evaluate(() => document.querySelector('.overlay [data-act]')?.click());
  await page.waitForTimeout(300);
  await solveActive();
  const g1 = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  check('solving a puzzle grows the sanctuary being built by one', g1 === g0 + 1, `${g0} → ${g1}`);
  check('the win sheet says who is coming home next', /is on the way/.test((await page.textContent('.win-sheet')) ?? ''));
  check('the win sheet credits the sanctuary by name (+1)', /Farm \+1/.test((await page.textContent('.win-sheet')) ?? ''));
  await page.click('[data-act="next"]');
  await page.waitForTimeout(200);

  // A milestone the player skips waits as "New" on the World until the sanctuary is visited
  await page.evaluate(() => {
    const s = window.__pt.app.save;
    s.world.growth.farm = 3; // Truffle arrives on the next solve
    delete s.inventory.companions.truffle;
    window.__pt.app.persist();
    window.__pt.start({ kind: 'level', level: 6 });
  });
  await page.waitForTimeout(200);
  await solveActive();
  check('a new animal gets its spotlight before the results (D44)', /Truffle the piglet is coming home to the Farm/.test(lastSpotlight ?? ''), String(lastSpotlight));
  check('an arrival makes the newcomer the hero of the win sheet', (await page.textContent('.win-sheet h2'))?.trim() === 'Truffle is home!' && /Your new piglet/.test((await page.textContent('.win-sheet [data-hero="arrived"]')) ?? ''));
  await page.click('.win-sheet [data-act="next"]');
  await page.waitForTimeout(200);
  await page.evaluate(() => window.__pt.go({ screen: 'world' }));
  await page.waitForSelector('.world-map');
  check('skipping the visit leaves a "New" marker on the Farm and the World tab', !!(await page.$('.world-card[data-go="farm"] .chip--news')) && !!(await page.$('.world-pin[data-go="farm"] .news-dot')) && !!(await page.$('.nav [data-tab="world"].has-news')));
  await page.click('.world-card[data-go="farm"]');
  await page.waitForSelector('.region .sanctuary__scene svg');
  await page.waitForTimeout(300);
  check('visiting greets the newcomer and clears the marker', /Truffle the piglet came home/.test((await page.textContent('.toast')) ?? '') && (await page.evaluate(() => !window.__pt.app.save.world.unseen.farm)));
  await page.click('.region [data-act="back"]');
  await page.waitForSelector('.world-map');
  check('the marker is gone after the visit', !(await page.$('.world-card[data-go="farm"] .chip--news')) && (await page.evaluate(() => !window.__pt.app.save.world.unseen.farm)));
  // The Savanna opened when level 25 was cleared a moment ago and nobody has been: it says so.
  check('a region that opened unvisited says "New: just opened"', /New: just opened/.test((await page.textContent('.world-card[data-go="savanna"] .chip--news').catch(() => '')) ?? ''));

  // A board helps the sanctuary it started for: start a Farm board, choose to build the Pet Garden, come back and finish it
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 5 }));
  await page.waitForTimeout(200);
  await solveActive({ stopAfter: 1 }).catch(() => {});
  const heldId = await page.evaluate(() => window.__pt.app.active.boardId);
  check('a board has an id of its own, saved with it', typeof heldId === 'string' && heldId.startsWith('L5:'), String(heldId));
  await page.evaluate(() => window.__pt.go({ screen: 'sanctuary' }));
  await page.waitForSelector('.region-progress [data-act="build"]');
  await page.click('.region-progress [data-act="build"]');
  await page.waitForTimeout(150);
  check('choosing the Pet Garden says the saved Farm board still helps the Farm', /saved Farm board still helps the Farm/.test((await page.textContent('.toast')) ?? ''));
  const gFarm0 = await page.evaluate(() => window.__pt.app.save.world.growth.farm ?? 0);
  const gGarden0 = await page.evaluate(() => window.__pt.app.save.world.growth.harmony ?? 0);
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="continue"]');
  await page.waitForTimeout(300);
  check('the resumed Farm board keeps its id and its sanctuary', await page.evaluate((id) => window.__pt.app.active.boardId === id && window.__pt.app.active.cast.sanctuary === 'farm', heldId));
  await solveActive();
  const gAfter = await page.evaluate(() => ({ farm: window.__pt.app.save.world.growth.farm ?? 0, garden: window.__pt.app.save.world.growth.harmony ?? 0, active: window.__pt.app.save.world.active }));
  check('finishing it grows the Farm, not the Pet Garden', gAfter.farm === gFarm0 + 1 && gAfter.garden === gGarden0 && gAfter.active === 'harmony', JSON.stringify(gAfter));
  check('the credit is recorded once under the board id', await page.evaluate((id) => window.__pt.app.save.world.credits[id] === 'farm', heldId));
  await page.click('[data-act="next"]');
  await page.waitForTimeout(300);
  check('the next fresh board is for the Pet Garden', await page.evaluate(() => window.__pt.app.active.cast.sanctuary === 'harmony'));
  await page.evaluate(() => window.__pt.go({ screen: 'shop', sanctuary: 'amazon' }));
  check('a locked sanctuary’s decorations cannot be bought yet', !!(await page.$('.shop-card.is-locked[data-decor="waterfall"]')));

  // Leaderboard (on-device in development builds): opt-in, points only from server-checked solves, leaving deletes all
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.click('.segmented [data-tab="leaderboard"]');
  await page.waitForSelector('.lb-join');
  check('the leaderboard is opt-in and starts with a suggested name', ((await page.inputValue('input[name="nickname"]')) ?? '').length >= 3);
  await page.fill('input[name="nickname"]', 'no');
  await page.click('[data-act="join"]');
  await page.waitForTimeout(300);
  check('a too-short name is refused with a reason', /characters/.test((await page.textContent('.lb-field__error')) ?? ''));
  await page.fill('input[name="nickname"]', 'Cozy Otter 77');
  await page.click('[data-act="join"]');
  await page.waitForSelector('.lb-me');
  check('joining shows you on the leaderboard', /Cozy Otter 77/.test((await page.textContent('.lb-me')) ?? ''));
  await page.evaluate(() => window.__pt.start({ kind: 'level', level: 2 }));
  await page.waitForSelector('.board');
  await page.waitForTimeout(400);
  if (await page.$('.overlay')) await page.evaluate(() => document.querySelector('.overlay [data-act]')?.click());
  // At a person's pace: the server doesn't count boards solved faster than a person can place animals.
  await solveActive({ pace: 320 });
  const lbTotal = await page
    .waitForFunction(() => {
      const l = window.__pt.app.save.leaderboard;
      return l.pending.length === 0 && (l.last?.total ?? 0) > 0 && l.last.total;
    }, null, { timeout: 8000 })
    .then((h) => h.jsonValue(), () => 0);
  check('a solved level adds server-checked points to the leaderboard', lbTotal > 100, String(lbTotal));
  await page.evaluate(() => window.__pt.go({ screen: 'league' }));
  await page.waitForSelector('.lb-row.is-you');
  check('the table shows your points', Number(((await page.textContent('.lb-row.is-you .lb-pts')) ?? '0').replace(/\D/g, '')) === lbTotal);
  await page.click('.lb-actions [data-act="leave"]');
  await page.click('.overlay [data-act="leave"]');
  await page.waitForSelector('.lb-join');
  check('leaving the leaderboard deletes your entry', await page.evaluate(() => !window.__pt.app.save.leaderboard.joined && !(localStorage.getItem('pawtopia.lb.device') ?? '').includes('Cozy Otter 77')));

  // The endless world's animals (D39 PR E): a place shows its kinds, drawn by the kit; as 3D toys when every one of them
  // can be a toy, and all drawn when one can't (a snake, a fish).
  const places = await page.evaluate(async () => {
    const pl = await import('/src/meta/catalogs/places.ts');
    const kit = await import('/src/ui/art/kit.ts');
    const sp = await import('/src/meta/catalogs/species/index.ts');
    const world = await import('/src/meta/world.ts');
    const qa = await import('/src/app/qaTools.ts');
    const { app } = window.__pt;
    const toyable = (a) => !!a.base || kit.kitHasToy(sp.speciesById(a.species));
    let all = 0;
    let some = 0;
    for (let k = 1; k <= 60 && !(all && some); k++) {
      const animals = pl.placeDef(k).animals;
      if (!all && animals.every(toyable) && animals.some((a) => !a.base)) all = k;
      if (!some && animals.some((a) => !toyable(a))) some = k;
    }
    qa.skipToLevel(app.save, 80 + 20 * Math.max(all, some));
    for (const k of [all, some]) app.save.world.growth[`p${k}`] = 25;
    world.reconcileWorld(app.save);
    app.persist();
    return { all, some, kits: [all, some].map((k) => pl.placeDef(k).animals.filter((a) => !a.base).length) };
  });
  await page.evaluate((k) => window.__pt.go({ screen: 'region', id: `p${k}` }), places.all);
  await page.waitForSelector('.sanctuary__scene .sanctuary__friend', { timeout: 8000 }).catch(() => {});
  check(
    'a place of the endless world shows its kinds of animal, drawn by the kit',
    (await page.evaluate(() => document.querySelectorAll('.sanctuary__scene .sanctuary__friend[data-kit]').length)) === places.kits[0],
  );
  await page.waitForSelector('.sanctuary__scene.has-3d > canvas.scene3d', { timeout: 15000 }).catch(() => {});
  check('a place whose animals can all be toys shows them in 3D', await page.evaluate(() => !!document.querySelector('.sanctuary__scene.has-3d > canvas.scene3d')));
  await page.evaluate((k) => window.__pt.go({ screen: 'region', id: `p${k}` }), places.some);
  await page.waitForSelector('.sanctuary__scene .sanctuary__friend', { timeout: 8000 }).catch(() => {});
  await page.waitForTimeout(1500);
  check(
    'a place with an animal that has no toy yet stays drawn, every animal visible',
    await page.evaluate(
      () =>
        !document.querySelector('.sanctuary__scene.has-3d') &&
        !!document.querySelector('.sanctuary__scene [data-no-toy]') &&
        [...document.querySelectorAll('.sanctuary__scene .sanctuary__pet')].every((g) => getComputedStyle(g).opacity === '1'),
    ),
  );

  // D40 PR B: every figure greets in its temperament's way; a hello counts a heart once a day; a best friend's portrait.
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.waitForSelector('.sanctuary__scene [data-friend="cotton"]', { timeout: 8000 }).catch(() => {});
  const bond = await page.evaluate(async () => {
    const s = window.__pt.app.save;
    const temper = document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.getAttribute('data-temper');
    const before = s.sanctuary.affection.cotton ?? 0;
    s.sanctuary.greeted = {};
    const tapIt = () => document.querySelector('.sanctuary__scene [data-friend="cotton"] path').dispatchEvent(new MouseEvent('click', { bubbles: true }));
    tapIt();
    await new Promise((r) => setTimeout(r, 1600));
    tapIt();
    return { temper, gained: (s.sanctuary.affection.cotton ?? 0) - before };
  });
  check('a tapped animal greets its own way (Cotton is sleepy) and a hello counts one heart a day (D40)', bond.temper === 'sleepy' && bond.gained === 1, JSON.stringify(bond));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  // D40 PR D: a tap just above an animal's head (on the sky, not the animal) still reaches it, and it is named.
  const above = await page.evaluate(() => {
    const g = document.querySelector('.sanctuary__scene [data-friend="truffle"]') ?? document.querySelector('.sanctuary__scene .sanctuary__pet');
    g.scrollIntoView({ block: 'center' });
    const b = g.getBoundingClientRect();
    return { x: b.left + b.width / 2, y: b.top - 3, id: g.dataset.friend ?? g.dataset.pet };
  });
  await page.mouse.click(above.x, above.y);
  await page.waitForTimeout(150);
  check(
    'a tap just above a small animal reaches it, and it is ringed and named for a moment (D40)',
    await page.evaluate((id) => !!document.querySelector(`.sanctuary__scene [data-friend="${id}"].is-selected, .sanctuary__scene [data-pet="${id}"].is-selected`) && !!document.querySelector(`[data-scene-tag="${id}"]`), above.id),
  );
  await page.keyboard.press('Escape');

  // D40 PR A: every moment's sound plays in a real browser without a fault, and Sound off makes none.
  const sound = await page.evaluate(async () => {
    const f = await import('/src/services/feel.ts');
    const a = await import('/src/services/audio.ts');
    let ok = true;
    for (const e of Object.keys(f.FEEL)) {
      try {
        f.feel(e, { style: 'playful', size: 'tiny' });
      } catch {
        ok = false;
      }
    }
    a.setSoundEnabled(false);
    const off = !a.soundEnabled();
    a.setSoundEnabled(window.__pt.app.settings.sound);
    return { ok, off };
  });
  check('every sound and haptic in the feel table plays without a fault; Sound off is off (D40)', sound.ok && sound.off);

  // Scoped reset
  // Settings → 3D animals off: the drawn animals come back, and no 3D layer is made.
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="settings"]');
  await page.click('[data-switch="toys3d"]');
  await page.keyboard.press('Escape');
  await page.evaluate(() => window.__pt.go({ screen: 'region', id: 'farm' }));
  await page.waitForTimeout(1200);
  check('with 3D animals off, the drawn animals show and no 3D layer is made', await page.evaluate(() => !window.__pt.app.settings.toys3d && !document.querySelector('canvas.scene3d') && getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity === '1'));
  await page.evaluate(() => window.__pt.go({ screen: 'home' }));
  await page.click('[data-act="settings"]');
  await page.click('[data-act="reset"]');
  await page.click('[data-act="erase"]');
  await page.waitForTimeout(200);
  const other = await page.evaluate(() => localStorage.getItem('someone.else'));
  check('erasing progress keeps unrelated storage', other === 'keep me');
  check('erasing progress resets the journey', (await page.evaluate(() => window.__pt.app.save.journey.nextLevel)) === 1);

  // D43: the App Store build (the tester page's switch): nothing unfinished shows, and Settings has the privacy policy.
  await page.evaluate(() => localStorage.setItem('pawtyk.qa.releaseView', '1'));
  await reload();
  await page.evaluate(() => window.__pt.go({ screen: 'shop' }));
  const relShop = await page.$$eval('.seg__btn', (b) => b.map((x) => x.dataset.tab));
  const relShopText = await page.textContent('.shop');
  check('App Store build: the Shop has no Gems tab and nothing "coming soon" (D43)', JSON.stringify(relShop) === '["decor","food","tricks"]' && !/coming soon|video token/i.test(relShopText ?? ''), JSON.stringify(relShop));
  await page.evaluate(() => window.__pt.go({ screen: 'challenges' }));
  const relTabs = await page.$$eval('.league .segmented [data-tab]', (b) => b.map((x) => x.dataset.tab));
  check('App Store build: Challenges has no Leaderboard tab and previews no leagues (D43)', JSON.stringify(relTabs) === '["week","daily"]' && !(await page.$('.division, .tiers')), JSON.stringify(relTabs));
  await page.evaluate(() => window.__pt.go({ screen: 'journey' }));
  await page.evaluate(() => document.querySelector('[data-act="settings"]')?.click());
  await page.click('[data-act="privacy"]');
  const policyHeads = await page.$$eval('.policy-sheet .policy h3', (h) => h.length);
  check('App Store build: Settings opens the full privacy policy (D43)', policyHeads === 8 && !(await page.$('.sheet [data-act="leaderboard"]')), String(policyHeads));
  await page.evaluate(() => localStorage.removeItem('pawtyk.qa.releaseView'));

  // D44 PR B / D45 PR D: the music. Every cue renders in a real browser through the music channel's own chain, never
  // clips, and can be heard; and **as a phone plays it** (everything under ~300 Hz gone) the loudest moment of every
  // trick tune sits within a few dB of the others, the signature cues likewise, and the ambient tune well under both.
  const levels = await page.evaluate(async () => {
    const m = await import('/src/services/music.ts');
    const sc = await import('/src/audio/scores.ts');
    const SR = 44100;
    const measure = async (s, phone) => {
      const ctx = new OfflineAudioContext(1, Math.ceil(SR * (sc.cueMs(s) / 1000 + 1.2)), SR);
      let dest = ctx.destination;
      if (phone) {
        const h1 = ctx.createBiquadFilter();
        h1.type = 'highpass';
        h1.frequency.value = 320;
        const h2 = ctx.createBiquadFilter();
        h2.type = 'highpass';
        h2.frequency.value = 320;
        h1.connect(h2).connect(ctx.destination);
        dest = h1;
      }
      m.renderScore(ctx, m.musicChain(ctx, dest), s, 0.01);
      const d = (await ctx.startRendering()).getChannelData(0);
      const n = Math.ceil((SR * sc.cueMs(s)) / 1000);
      const win = Math.floor(SR * 0.4);
      let peak = 0;
      let sum = 0;
      let acc = 0;
      let best = 0;
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        if (i < n) sum += d[i] * d[i];
        acc += d[i] * d[i];
        if (i >= win) acc -= d[i - win] * d[i - win];
        best = Math.max(best, acc / win);
      }
      return { peak, rms: Math.sqrt(sum / n), loud: 20 * Math.log10(Math.sqrt(best)) };
    };
    const out = [];
    for (const id of Object.keys(sc.SCORES)) {
      const full = await measure(sc.SCORES[id], false);
      const phone = await measure(sc.SCORES[id], true);
      out.push({ id, peak: full.peak, rms: full.rms, phone: phone.loud, low: full.loud - phone.loud });
    }
    // The arranged forms too: every home's parade, and the busiest rhythm under the busiest trick tune.
    const arranged = [];
    for (const h of sc.THEME_HOMES) arranged.push({ id: `bounce@${h}`, ...(await measure(sc.themeVariation(sc.SCORES.bounce, h), false)) });
    for (const f of sc.RHYTHM_FEELS) arranged.push({ id: `party+${f}`, ...(await measure(sc.withRhythm(sc.SCORES['trick:party'], f), false)) });
    return { out, arranged };
  });
  const badLevels = [...levels.out, ...levels.arranged].filter((l) => !(l.peak < 0.9) || !(l.rms > 0.006));
  check(`every music cue renders, never clips and can be heard (${levels.out.length} cues and ${levels.arranged.length} arrangements, D44/D45)`, levels.out.length === 44 && levels.arranged.length === 13 && badLevels.length === 0, JSON.stringify(badLevels));
  const span = (ls) => Math.max(...ls.map((l) => l.phone)) - Math.min(...ls.map((l) => l.phone));
  const trickLv = levels.out.filter((l) => l.id.startsWith('trick:') && l.id !== 'trick:party');
  // D48 PR E: the three new welcomes are signature cues too.
  const bigLv = levels.out.filter((l) => ['triumph', 'welcome', 'bounce', 'jig', 'trick:party', 'hopalong', 'sparkle', 'circle'].includes(l.id));
  const meadowLv = levels.out.find((l) => l.id === 'meadow');
  const avg = (ls) => ls.reduce((a, l) => a + l.phone, 0) / ls.length;
  check(
    'on a phone speaker the trick tunes sit within 3 dB of each other, the signature cues within 2.5 dB, and the ambient tune 3–8 dB under the tricks (D45)',
    span(trickLv) < 3 && span(bigLv) < 2.5 && avg(trickLv) - meadowLv.phone > 3 && avg(trickLv) - meadowLv.phone < 8 && avg(bigLv) > avg(trickLv),
    JSON.stringify({ tricks: span(trickLv).toFixed(1), big: span(bigLv).toFixed(1), meadow: (avg(trickLv) - meadowLv.phone).toFixed(1) }),
  );
  // Nothing relies on bass a phone can't play: no cue loses more than 5 dB of its loudest moment to the speaker.
  const bassy = levels.out.filter((l) => l.low > 5);
  check('no cue leans on bass a phone speaker cannot play (D45)', bassy.length === 0, JSON.stringify(bassy.map((l) => [l.id, l.low.toFixed(1)])));
  await page.evaluate(() => window.__pt.go({ screen: 'journey' }));
  await page.evaluate(() => document.querySelector('[data-act="settings"]')?.click());
  const musicSwitch = await page.$('.sheet [data-switch="music"]');
  check('Settings has a Music switch, on by default (D44)', !!musicSwitch && (await musicSwitch.getAttribute('aria-checked')) === 'true');
  const homeMusic = await page.$('.sheet [data-switch="ambientMusic"]');
  const celebrations = await page.$$eval('.sheet [data-choice="celebrations"]', (bs) => bs.map((b) => `${b.dataset.value}:${b.getAttribute('aria-pressed')}`).join(' '));
  check('Settings has Home music (off until chosen) and Celebrations (Smart) (D45)', !!homeMusic && (await homeMusic.getAttribute('aria-checked')) === 'false' && celebrations === 'smart:true full:false short:false', celebrations);
  await page.keyboard.press('Escape');

  // ---------------------------------------------------------------- D44 QA: the regression list
  // A small iPhone (320 × 568): everything frames, nothing overflows, every moment ends cleanly, with 3D on and off,
  // under reduced motion, in the lite tier, and when the app goes to the background.
  const qa = await browser.newPage({ viewport: { width: 320, height: 568 }, deviceScaleFactor: 2, hasTouch: true });
  qa.on('pageerror', (e) => errors.push(`[qa] ${e}`));
  await qa.goto(URL);
  await qa.waitForFunction(() => window.__pt);
  const qaHome = async (opts = {}) => {
    await qa.evaluate(async (o) => {
      const a = window.__pt.app;
      const tools = await import('/src/app/qaTools.ts');
      Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
      if ((a.save.journey.nextLevel ?? 1) < 40) tools.skipToLevel(a.save, 40);
      tools.finishOpenHomes(a.save);
      a.save.settings.toys3d = o.toys3d ?? true;
      a.save.settings.reducedMotion = o.reduced ? 'reduce' : 'full';
      // The full parade unless a check asks for smart pacing (D45 PR B): this save has every animal home.
      a.save.settings.celebrations = o.smart ? 'smart' : 'full';
      a.applySettings();
      a.persist();
      window.__pt.go({ screen: 'region', id: 'farm', ...(o.welcome ? { welcome: ['cotton'] } : {}) });
    }, opts);
    await qa.waitForSelector('.region .sanctuary__scene svg');
    await qa.waitForTimeout(opts.toys3d === false ? 500 : 2500);
    for (let i = 0; i < 3; i++)
      if (await qa.$('.overlay')) {
        await qa.keyboard.press('Escape');
        await qa.waitForTimeout(250);
      }
  };
  const hidden = (on) =>
    qa.evaluate((h) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => h });
      document.dispatchEvent(new Event('visibilitychange'));
    }, on);

  await qaHome();
  const frame = await qa.evaluate(() => {
    const sc = document.querySelector('.sanctuary__scene').getBoundingClientRect();
    const inside = (el) => {
      const r = el?.getBoundingClientRect();
      return !!r && r.left >= sc.left - 0.5 && r.right <= sc.right + 0.5 && r.top >= sc.top - 0.5 && r.bottom <= sc.bottom + 0.5;
    };
    const tour = document.querySelector('[data-act="tour"]');
    const walk = document.querySelector('[data-act="walk"]');
    const a = tour?.getBoundingClientRect();
    const b = walk?.getBoundingClientRect();
    const apart = !a || !b || a.left >= b.right || b.left >= a.right;
    return { overflow: document.documentElement.scrollWidth - window.innerWidth, tour: inside(tour), walk: !walk || walk.hidden || inside(walk), apart };
  });
  check('a small iPhone: the Farm frames, its Tour and Walk buttons sit inside the scene, apart, and nothing overflows (D44)', frame.overflow <= 0 && frame.tour && frame.walk && frame.apart, JSON.stringify(frame));

  // The parade on a small screen; leaving the app ends it and its music.
  await qaHome({ welcome: true });
  await qa.waitForSelector('.sanctuary__scene.is-parading', { timeout: 8000 }).catch(() => {});
  const p320 = await qa.evaluate(() => {
    const sc = document.querySelector('.sanctuary__scene').getBoundingClientRect();
    const sk = document.querySelector('.parade-skip')?.getBoundingClientRect();
    return { skip: !!sk && sk.right <= sc.right && sk.bottom <= sc.bottom, overflow: document.documentElement.scrollWidth - window.innerWidth };
  });
  await qa.waitForTimeout(1200);
  await hidden(true);
  await qa.waitForTimeout(400);
  const bg = await qa.evaluate(async () => {
    const { nowPlaying } = await import('/src/services/music.ts');
    return { dancing: document.querySelectorAll('[data-trick^="dance:"]').length, parading: !!document.querySelector('.is-parading'), music: !!nowPlaying() };
  });
  await hidden(false);
  check('the parade frames on a small screen, and leaving the app ends it: nobody mid-dance, no music (D44)', p320.skip && p320.overflow <= 0 && bg.dancing === 0 && !bg.parading && !bg.music, JSON.stringify({ p320, bg }));

  // No reward twice: replaying the parade and the tour changes nothing in the save.
  await qa.waitForTimeout(500);
  const save0 = await qa.evaluate(() => JSON.stringify({ c: window.__pt.app.coins(), inv: window.__pt.app.save.inventory, affection: window.__pt.app.save.sanctuary.affection, growth: window.__pt.app.save.world.growth }));
  await qa.evaluate(() => document.querySelector('[data-act="parade-replay"]')?.click());
  await qa.waitForTimeout(1500);
  await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
  await qa.waitForTimeout(400);
  await qa.evaluate(() => document.querySelector('[data-act="tour"]')?.click());
  await qa.waitForTimeout(1500);
  await qa.evaluate(() => document.querySelector('[data-act="tour-stop"]')?.click());
  await qa.waitForTimeout(600);
  const save1 = await qa.evaluate(() => JSON.stringify({ c: window.__pt.app.coins(), inv: window.__pt.app.save.inventory, affection: window.__pt.app.save.sanctuary.affection, growth: window.__pt.app.save.world.growth }));
  const stuck = await qa.evaluate(() => document.querySelectorAll('.sanctuary__scene [data-trick], .sanctuary__scene .is-dancing').length);
  check(
    'replaying the parade and the tour pays nothing twice (coins, inventory, affection, growth), and nobody is left mid-trick (D44)',
    save0 === save1 && stuck === 0 && /"affection":\{/.test(save0),
    `${stuck} stuck`,
  );

  // 3D off: the drawn animals dance, tour and open the barn; no Walk button, no WebGL.
  await qaHome({ toys3d: false, welcome: true });
  await qa.waitForSelector('.sanctuary__scene.is-parading', { timeout: 8000 }).catch(() => {});
  await qa.waitForTimeout(900);
  const off = await qa.evaluate(() => ({
    canvas: document.querySelectorAll('canvas').length,
    drawn: document.querySelectorAll('.sanctuary__scene .sanctuary__pet[class*="is-dance-"]').length,
    walk: !!document.querySelector('[data-act="walk"]:not([hidden])'),
  }));
  await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
  await qa.waitForTimeout(300);
  await qa.evaluate(() => document.querySelector('[data-act="tour"]')?.click());
  await qa.waitForTimeout(1300);
  const offTour = await qa.evaluate(() => ({ caption: document.querySelector('.tour-caption')?.textContent ?? '', vb: document.querySelector('.sanctuary__scene svg').getAttribute('viewBox') }));
  await qa.evaluate(() => document.querySelector('[data-act="tour-stop"]')?.click());
  await qa.waitForTimeout(600);
  check('with 3D off the drawn animals dance, the tour runs, and no Walk button is offered (D44)', off.canvas === 0 && off.drawn >= 1 && !off.walk && offTour.caption === 'The barn' && offTour.vb !== '0 0 360 300', JSON.stringify({ off, offTour }));

  // D45 PR B: smart pacing. With many animals home the welcome is the short parade; the button then offers the full one.
  await qaHome({ welcome: true, smart: true });
  await qa.waitForFunction(() => { const b = document.querySelector('[data-act="parade-replay"]'); return b && !b.hidden; }, null, { timeout: 9000 }).catch(() => {});
  const shortParade = await qa.evaluate(() => ({ label: document.querySelector('[data-act="parade-replay"]')?.textContent?.trim() ?? '', dancing: document.querySelectorAll('.sanctuary__pet[data-trick^="dance:"]').length }));
  await qa.evaluate(() => document.querySelector('[data-act="parade-replay"]')?.click());
  await qa.waitForTimeout(900);
  const fullReplay = await qa.evaluate(() => (document.querySelector('.sanctuary__pet[data-trick^="dance:newcomer:"]')?.dataset.trick ?? '').split(':').pop());
  await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
  await qa.waitForTimeout(300);
  check('smart pacing: a later arrival gets the short parade, and the button plays the full one (D45)', shortParade.label === 'Play the full parade' && shortParade.dancing === 0 && fullReplay === '16', JSON.stringify({ shortParade, fullReplay }));

  // Reduced motion: still presentations: the parade's dancers just smile (no moving classes), no close-up on a trick.
  await qaHome({ reduced: true, welcome: true });
  await qa.waitForSelector('.sanctuary__scene.is-parading', { timeout: 8000 }).catch(() => {});
  await qa.waitForTimeout(600);
  const still = await qa.evaluate(() => ({
    still: document.querySelectorAll('.sanctuary__pet.is-dance-still').length,
    moving: document.querySelectorAll('.sanctuary__pet[class*="is-trick-dance"]').length,
    vb: document.querySelector('.sanctuary__scene svg').getAttribute('viewBox'),
  }));
  await qa.evaluate(() => document.querySelector('.parade-skip')?.click());
  await qa.waitForTimeout(300);
  await qa.evaluate(() => document.querySelector('.sanctuary__scene .sanctuary__pet').dispatchEvent(new MouseEvent('click', { bubbles: true })));
  await qa.waitForSelector('.trick-chip[data-trick="wave"]', { timeout: 3000 }).catch(() => {});
  await qa.evaluate(() => document.querySelector('.trick-chip[data-trick="wave"]')?.click());
  await qa.waitForTimeout(600);
  const stillTrick = await qa.evaluate(() => ({ zoom: window.__cam?.zoom ?? 1, on: !!document.querySelector('.sanctuary__scene [data-trick="wave"]') }));
  check('reduced motion: the parade is a still celebration and a trick gets no close-up (D44)', still.still >= 1 && still.moving === 0 && still.vb === '0 0 360 300' && stillTrick.on && stillTrick.zoom === 1, JSON.stringify({ still, stillTrick }));

  // The lite tier: the 3D walk draws at 1× and pauses in the background.
  await qaHome();
  await qa.evaluate(async () => (await import('/src/ui/components/camera.ts')).setCameraQuality('lite'));
  await qa.evaluate(() => document.querySelector('[data-act="walk"]')?.click());
  await qa.waitForSelector('.walk canvas.walk__canvas', { timeout: 15000 }).catch(() => {});
  await qa.waitForTimeout(700);
  const lite = await qa.evaluate(() => {
    const w = window.__walk;
    const c = document.querySelector('.walk__canvas');
    return w ? { tier: w.tier, ratio: c.width / c.clientWidth, pad: document.querySelector('.walk__pad').getBoundingClientRect().right <= window.innerWidth } : null;
  });
  await hidden(true);
  const d0 = await qa.evaluate(() => window.__walk?.drawn ?? -1);
  await qa.waitForTimeout(600);
  const d1 = await qa.evaluate(() => window.__walk?.drawn ?? -1);
  await hidden(false);
  await qa.waitForTimeout(400);
  const d2 = await qa.evaluate(() => window.__walk?.drawn ?? -1);
  await qa.keyboard.press('Escape');
  await qa.evaluate(async () => (await import('/src/ui/components/camera.ts')).setCameraQuality('high'));
  check('the lite tier walks at 1× pixels on a small screen, and the walk pauses in the background (D44)', !!lite && lite.tier === 'lite' && Math.abs(lite.ratio - 1) < 0.05 && lite.pad && d1 === d0 && d2 > d1, JSON.stringify({ lite, d0, d1, d2 }));
  // Every home's critter is wholly hidden until its landmark opens, and shows when it does.
  const peeks = await qa.evaluate(async () => {
    const { regionScene } = await import('/src/ui/art/regions.ts');
    const out = {};
    for (const h of ['farm', 'outback', 'savanna', 'arctic', 'amazon']) {
      const d = document.createElement('div');
      d.innerHTML = `<figure class="sanctuary__scene"><svg viewBox="0 0 360 300">${regionScene(h, { stage: 4, companions: [], decor: [] }, `pk-${h}`)}</svg></figure>`;
      document.body.appendChild(d);
      const cb = d.querySelector(`#pk-${h}-lm`).firstElementChild.getBBox();
      const box = () => {
        const p = d.querySelector('.sp-peek');
        const b = p.getBBox();
        const t = getComputedStyle(p).transform;
        const m = new DOMMatrix(t === 'none' ? undefined : t);
        return { l: b.x + m.e, r: b.x + b.width + m.e, t: b.y + m.f, b: b.y + b.height + m.f };
      };
      const area = (a) => Math.max(0, Math.min(a.r, cb.x + cb.width) - Math.max(a.l, cb.x)) * Math.max(0, Math.min(a.b, cb.y + cb.height) - Math.max(a.t, cb.y));
      const closed = area(box());
      d.querySelector('[data-landmark]').classList.add('is-open');
      await new Promise((r) => setTimeout(r, 1100));
      out[h] = [Math.round(closed), Math.round(area(box()))];
      d.remove();
    }
    return out;
  });
  check('every home’s critter is hidden until its landmark opens, then peeks out (D44)', Object.values(peeks).every(([c, o]) => c === 0 && o > 50), JSON.stringify(peeks));
  // The walk is modal: Tab stays inside it.
  await qaHome();
  await qa.evaluate(() => document.querySelector('[data-act="walk"]')?.click());
  await qa.waitForSelector('.walk canvas.walk__canvas', { timeout: 15000 }).catch(() => {});
  for (let i = 0; i < 7; i++) await qa.keyboard.press('Tab');
  const modal = await qa.evaluate(() => ({ inside: !!document.activeElement?.closest('.walk'), inert: !!document.getElementById('app')?.inert }));
  await qa.keyboard.press('Escape');
  await qa.waitForTimeout(200);
  const after = await qa.evaluate(() => !!document.getElementById('app')?.inert);
  check('the 3D walk is modal: focus stays inside, the screen underneath is inert until it closes (D44)', modal.inside && modal.inert && !after, JSON.stringify({ modal, after }));
  // D45 PR C: destinations. "Go to" the pond: the player arrives, the place is named with its discovery, the map marks
  // it; coming back to it later only names it; Overview returns to the drawn Farm, whose 3D toys come back.
  await qaHome({ reduced: true });
  await qa.evaluate(() => document.querySelector('[data-act="walk"]')?.click());
  await qa.waitForSelector('.walk canvas.walk__canvas', { timeout: 15000 }).catch(() => {});
  await qa.waitForTimeout(400);
  const fit = await qa.evaluate(() => {
    const r = (q) => document.querySelector(q).getBoundingClientRect();
    const map = r('.walk__map');
    const pad = r('.walk__pad');
    const go = r('.walk__goto');
    return { apart: map.right < pad.left, above: go.bottom <= Math.min(map.top, pad.top) + 1, overflow: document.documentElement.scrollWidth - window.innerWidth, chips: document.querySelectorAll('[data-goto]').length };
  });
  const place = async () => qa.evaluate(() => ({ where: window.__walk?.where ?? null, found: window.__walk?.found.size ?? 0, text: document.querySelector('[data-walk-place]')?.textContent ?? '', shown: !document.querySelector('[data-walk-place]')?.hidden, here: document.querySelector('.walk__map .is-here')?.dataset.mapPlace ?? null, current: document.querySelector('[data-goto][aria-current="true"]')?.dataset.goto ?? null, said: document.querySelector('[data-walk-status]')?.textContent ?? '' }));
  await qa.evaluate(() => document.querySelector('[data-goto="pond"]').click());
  await qa.waitForTimeout(700);
  const atPond = await place();
  await qa.evaluate(() => document.querySelector('[data-goto="barn"]').click());
  await qa.waitForTimeout(700);
  const atBarn = await place();
  await qa.evaluate(() => document.querySelector('[data-goto="pond"]').click());
  await qa.waitForTimeout(700);
  const again = await place();
  check('a small iPhone: the walk’s map, Go-to row and arrow pad sit apart, nothing overflows (D45)', fit.apart && fit.above && fit.overflow <= 0 && fit.chips === 4, JSON.stringify(fit));
  check(
    'Go to the pond: the player arrives, the place is named with its discovery, the map marks it; a second visit just names it (D45)',
    atPond.where === 'pond' && atPond.shown && /The pond.*ducks splash.*1 of 4/.test(atPond.text) && atPond.here === 'pond' && atPond.current === 'pond' && /ducks/.test(atPond.said) && atBarn.where === 'barn' && atBarn.found === 2 && again.where === 'pond' && again.text === 'The pond' && again.found === 2,
    JSON.stringify({ atPond, atBarn, again }),
  );
  // A discovery that runs out while the app is away still comes to rest (no duck left mid-hop): start one with
  // motion on, leave at once, come back after it would have ended.
  await qa.evaluate(() => {
    window.__pt.app.save.settings.reducedMotion = 'full';
    window.__pt.app.applySettings();
    const w = window.__walk;
    Object.assign(w.walker, { x: 0, z: 20, target: null });
  });
  await qa.waitForTimeout(500);
  await qa.evaluate(async () => {
    const m = await import('/src/three/walkMath.ts');
    const l = m.LANDMARKS.find((x) => x.id === 'orchard');
    Object.assign(window.__walk.walker, { x: l.stand.x, z: l.stand.z, target: null });
  });
  await qa.waitForFunction(() => window.__walk?.where === 'orchard' && !window.__walk.settled, null, { timeout: 5000 }).catch(() => {});
  const midway = await qa.evaluate(() => ({ where: window.__walk?.where, settled: window.__walk?.settled }));
  await hidden(true);
  await qa.waitForTimeout(3600);
  await hidden(false);
  await qa.waitForFunction(() => window.__walk?.settled, null, { timeout: 5000 }).catch(() => {});
  const rested = await qa.evaluate(() => window.__walk?.settled);
  check('a discovery that ran out while the app was away comes to rest on return (D45)', midway.where === 'orchard' && midway.settled === false && rested === true, JSON.stringify({ midway, rested }));
  await qa.click('.walk__back');
  await qa.waitForTimeout(1500);
  const overview = await qa.evaluate(() => ({ walk: !!document.querySelector('.walk'), canvases: document.querySelectorAll('canvas').length, toys: !!document.querySelector('.sanctuary__scene.has-3d'), focus: document.activeElement?.dataset?.act ?? '' }));
  check('Overview returns to the drawn Farm: the walk is gone, the scene’s 3D toys are back, focus on Walk (D45)', !overview.walk && overview.canvases === 1 && overview.toys && overview.focus === 'walk', JSON.stringify(overview));
  await qa.close();

  // D46: transitions between farm interactions, and the 3D layer's lifecycle.
  await d46Checks({ browser, URL, check, errors });
  await forceCloseChecks({ browser, URL, check, errors });
  await d47Checks({ browser, URL, check, errors });
  await d47IntegratedChecks({ browser, URL, check, errors });
  await d48Checks({ browser, URL, check, errors });
  await mChecks({ browser, URL, check, errors });

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('suite ran to completion', false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
