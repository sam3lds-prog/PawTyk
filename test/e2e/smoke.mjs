// End-to-end smoke tests in a real browser (iPhone-sized viewport).
//
//   npm run dev            # in one terminal (the dev-only window.__pt hook is needed)
//   npm run e2e            # in another; E2E_URL overrides http://localhost:5173
//
// Needs Playwright once: `npm i -D playwright && npx playwright install chromium`.
// Covers the spec's critical regressions: first-run flow, "Next level" advances, progress survives reload,
// in-progress boards resume, decor is charged exactly once, reset keeps unrelated data, faces are facial-only.

import { createRequire } from 'node:module';

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
  await page.waitForSelector('.cell.is-guide');
  check('tutorial highlights exactly one tile', (await page.$$('.cell.is-guide')).length === 1);
  check('tutorial board is forgiving (no hearts shown)', !(await page.$('[data-hearts]')));
  check('the first board is a one-animal board', await page.evaluate(() => window.__pt.app.active.session.rule === 'solo'));
  check('a fresh install plays tap ✕ / double-tap', (await scheme()) === 'tap');
  check('a one-animal board has only Erase and Hint below it (no ✕ button)', !(await page.$('[data-tool]')) && (await page.$$('.controls--solo .act')).length === 2 && !(await page.$('.controls [data-act="undo"]')));
  check('the coach says to double-tap the tile', /double-tap it/i.test((await page.textContent('[data-coach]')) ?? ''));

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
    'it ends with a clear goal: Truffle, how many puzzles away, and Play level 2 (D41)',
    await page.evaluate(() => {
      const g = document.querySelector('.arrival [data-arrival-goal]');
      return !!g && !g.hidden && /Bring Truffle the piglet home/.test(g.textContent) && /3 more puzzles/.test(g.textContent) && g.querySelector('[data-act="play"]')?.textContent === 'Play level 2';
    }),
  );
  const afterFirst = await coins();
  check('first clear pays coins', afterFirst >= 45, String(afterFirst));
  await page.click('.arrival [data-act="visit"]');
  await page.waitForSelector('.region');
  await page.waitForSelector('.sheet [data-choose="wheelbarrow"]');
  check('visiting opens the Farm, with Farm starter gifts', !!(await page.$('[data-choose="trough"]')));
  check('the first visit names an animal to tap, and rings it (D40)', !!(await page.$('.sanctuary__scene .sp-cue-ring')) && /^Tap Cotton to say hello\.$/.test((await page.textContent('[data-scene-cue="tap"]').catch(() => '')) ?? ''));
  await page.click('[data-choose="wheelbarrow"]');
  await page.click('.sheet [data-act="play"]');
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
  await page.click('[data-feed="hay"]');
  check('feeding a favorite food adds two hearts of affection', (await page.evaluate(() => window.__pt.app.save.sanctuary.affection.cotton)) === 2);
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
  await page.waitForSelector('.sanctuary__scene.has-3d > canvas.scene3d', { timeout: 15000 }).catch(() => {});
  check('the Farm animals appear as 3D toys over the drawn scene', await page.evaluate(() => !!document.querySelector('.sanctuary__scene.has-3d > canvas.scene3d') && getComputedStyle(document.querySelector('.sanctuary__scene .sanctuary__pet')).opacity === '0'));
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
  check('the Shop lists every trick and emote', (await page.$$('.trick-card')).length === 18);

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

  // D44 PR B: the music. Every cue renders in a real browser, never clips, and is loud enough to hear; Settings has
  // a Music switch, on.
  const levels = await page.evaluate(async () => {
    const m = await import('/src/services/music.ts');
    const sc = await import('/src/audio/scores.ts');
    const out = [];
    for (const id of Object.keys(sc.SCORES)) {
      const s = sc.SCORES[id];
      const ctx = new OfflineAudioContext(1, Math.ceil(22050 * (sc.cueMs(s) / 1000 + 1.2)), 22050);
      const g = ctx.createGain();
      g.gain.value = m.MUSIC_GAIN;
      g.connect(ctx.destination);
      m.renderScore(ctx, g, s, 0.01);
      const d = (await ctx.startRendering()).getChannelData(0);
      let peak = 0;
      let sum = 0;
      const n = Math.ceil((22050 * sc.cueMs(s)) / 1000);
      for (let i = 0; i < d.length; i++) {
        peak = Math.max(peak, Math.abs(d[i]));
        if (i < n) sum += d[i] * d[i];
      }
      out.push({ id, peak, rms: Math.sqrt(sum / n) });
    }
    return out;
  });
  const badLevels = levels.filter((l) => !(l.peak < 0.9) || !(l.rms > 0.006));
  check(`every music cue renders, never clips and can be heard (${levels.length} cues, D44)`, levels.length === 22 && badLevels.length === 0, JSON.stringify(badLevels));
  await page.evaluate(() => window.__pt.go({ screen: 'journey' }));
  await page.evaluate(() => document.querySelector('[data-act="settings"]')?.click());
  const musicSwitch = await page.$('.sheet [data-switch="music"]');
  check('Settings has a Music switch, on by default (D44)', !!musicSwitch && (await musicSwitch.getAttribute('aria-checked')) === 'true');
  await page.keyboard.press('Escape');

  check('no page errors', errors.length === 0, errors.join(' | '));
} catch (e) {
  check('suite ran to completion', false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

console.log(results.join('\n'));
console.log(failed ? `\n${failed} failed` : `\nall ${results.length} passed`);
process.exit(failed ? 1 : 0);
