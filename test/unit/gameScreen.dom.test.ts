// @vitest-environment happy-dom
/**
 * The play screen's input rules, mounted for real in a DOM (D37): a tap marks ✕, a double tap places, a wrong animal
 * costs a heart and leaves a mistake mark, Erase only takes ✕ marks back, Hint shows the player's hint count, and dots
 * appear on Easy boards only. Plus what a solve credits and what the win sheet shows (D36).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen, SPOTLIGHT_AFTER_TRIUMPH_MS } from '../../src/ui/screens/game';
import { cueMs, SCORES } from '../../src/audio/scores';
import { nowPlaying } from '../../src/services/music';
import { startGame } from '../../src/app/gameFlow';
import { CAT, DOG, EMPTY } from '../../src/engine/types';
import { MARK } from '../../src/game/session';
import { setActive } from '../../src/meta/world';
import { setPantry } from '../../src/app/qaTools';
import { defaultSave, type ControlScheme } from '../../src/services/storage';

/** A stand-in screen for every route the game can leave to. */
const blank = { tab: null, title: 'x', mount: () => {} };

function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
  return router;
}

const cell = (r: number, c: number) => document.querySelector<HTMLButtonElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
const toolBtn = (t: string) => document.querySelector<HTMLButtonElement>(`[data-tool="${t}"]`);
const eraseBtn = () => document.querySelector<HTMLButtonElement>('[data-act="erase"]')!;
const coach = () => document.querySelector('[data-coach]')?.textContent ?? '';
const key = (r: number, c: number, k: string) => cell(r, c).dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true }));

/** The clock the double-tap window reads; each tap moves it on, so taps are slow unless a test says otherwise. */
let nowMs = 1_000;

/** A pointer tap on a cell, the way the board listens for it, `gapMs` after the previous one. */
function tap(r: number, c: number, gapMs = 1_000): void {
  nowMs += gapMs;
  const el = cell(r, c);
  const box = { x: 10 + c * 40, y: 10 + r * 40 };
  document.elementFromPoint = () => el;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: box.x, clientY: box.y }));
}

/** Two quick taps on one tile: the place gesture. */
function dblTap(r: number, c: number): void {
  tap(r, c);
  tap(r, c, 60);
}

/** Finger down on one cell, moved across others, lifted. */
function drag(cells: Array<[number, number]>): void {
  nowMs += 1_000;
  const [first, ...rest] = cells;
  const el0 = cell(first[0], first[1]);
  document.elementFromPoint = () => el0;
  el0.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 2, clientX: 5, clientY: 5 }));
  for (const [r, c] of rest) {
    const el = cell(r, c);
    document.elementFromPoint = () => el;
    el0.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, pointerId: 2, clientX: 5 + c, clientY: 5 + r }));
  }
  el0.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 2 }));
}

function find(pred: (r: number, c: number) => boolean, skip: Array<[number, number]> = []): [number, number] {
  const s = app.active!.session;
  for (let r = 0; r < s.size; r++)
    for (let c = 0; c < s.size; c++)
      if (!s.givenMask[r][c] && s.cells[r][c] === EMPTY && !s.errorsAt(r, c).length && pred(r, c) && !skip.some(([a, b]) => a === r && b === c)) return [r, c];
  throw new Error('no such cell');
}

function start(level: number, controls: ControlScheme = 'tap'): void {
  app.settings.controls = controls;
  if (level > 20) app.save.journey.nextLevel = Math.max(app.save.journey.nextLevel, level);
  startGame({ kind: 'level', level });
}

const placeEvents = () => app.active!.session.events.filter((e) => e.type === 'place');

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  // Past the tutorial and the lessons: ordinary boards with hearts.
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true });
  app.active = null;
  nowMs = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  mountRouter();
});
afterEach(() => {
  app.active = null;
  vi.restoreAllMocks();
});

describe('tap marks, double-tap places (D37)', () => {
  it('a one-animal board has Erase and Hint, no ✕ button; a tap marks, a slow second tap clears', () => {
    start(5); // no level tip, so the coach line is the scheme's
    const s = app.active!.session;
    expect(document.querySelectorAll('[data-tool]')).toHaveLength(0);
    expect(eraseBtn()).not.toBeNull();
    expect(coach()).toMatch(/Tap to mark ✕, double-tap to place/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    expect(cell(r, c).querySelector('.cell__mark')).not.toBeNull();
    tap(r, c);
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('a double tap places the animal with exactly one place event, and one Undo empties the tile', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(placeEvents()).toHaveLength(1);
    expect(s.mistakes).toBe(0);
    s.undo();
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('D44: three hearts on a new Journey board, and a touch reported twice (a bounce) never places an animal', () => {
    start(5);
    const s = app.active!.session;
    expect(s.maxHearts).toBe(3);
    expect(document.querySelector<HTMLElement>('[data-hearts]')?.dataset.max).toBe('3');
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r, c);
    tap(r, c, 8); // the same touch again, 8 ms later
    expect(s.cells[r][c]).toBe(MARK);
    expect(placeEvents()).toHaveLength(0);
    expect(s.hearts).toBe(3);
    // A real double tap, a moment later, still places (here a wrong one, which costs its heart as usual).
    tap(r, c);
    tap(r, c, 120);
    expect(placeEvents()).toHaveLength(1);
    expect(s.hearts).toBe(2);
  });

  it('a wrong double tap costs one heart and leaves a red mistake mark; trying it again costs nothing', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.errorsAt(r, c)).toEqual([CAT]);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/a mistake, no animal here$/);
    // D40: kind words, no heart count on screen (the hearts above the board show it); a screen reader still hears it.
    expect(coach()).toMatch(/It's marked for you/);
    expect(document.querySelector('[data-coach]')!.childNodes[0].textContent).not.toMatch(/hearts? left/);
    expect(document.querySelector('[data-coach] .sr-only')?.textContent).toMatch(/\d hearts left\./);
    // The same guess again, on purpose or a double-fired tap: no second heart, no second event.
    const events = s.events.length;
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.events.length).toBe(events);
    expect(coach()).toMatch(/You already tried/);
    // A single tap on a mistake doesn't turn it into a ✕; the mark stays, and survives a re-mount and an Undo.
    tap(r, c);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(coach()).toMatch(/A mistake was marked here/);
    app.router.refresh();
    s.undo();
    app.router.refresh();
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
  });

  it('a mistake on a tile the player had marked ✕ replaces their ✕', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    key(r, c, 'x');
    expect(s.cells[r][c]).toBe(MARK);
    key(r, c, '1');
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__mark')).toBeNull();
  });

  it('two-animal boards: animal buttons, no ✕ button; a wrong cat on a dog tile marks "no cat", and the dog still fits', () => {
    start(30);
    const s = app.active!.session;
    expect(s.rule).toBe('pair');
    expect([...document.querySelectorAll<HTMLElement>('[data-tool]')].map((b) => b.dataset.tool)).toEqual(['cat', 'dog']);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    toolBtn('cat')!.click();
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 1);
    // Not a red ✕: that would say the tile is empty. The struck cat says only "no cat here".
    expect(cell(r, c).querySelector('.cell__err')).toBeNull();
    expect(cell(r, c).querySelector('.cell__tried .pet, .cell__tried svg')).not.toBeNull();
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/: not a [a-z ]+, a mistake$/);
    tap(r, c);
    expect(coach()).toMatch(/^No [a-z ]+ here\. If an? [a-z ]+ lives here, pick it below and double-tap\.$/);
    toolBtn('dog')!.click();
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(DOG);
    expect(cell(r, c).querySelector('.cell__tried')).toBeNull();
    expect(app.settings.lastSpecies).toBe('dog');
  });

  it('two-animal boards: both animals wrong on one tile make it a red ✕ (no animal lives there)', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    toolBtn('cat')!.click();
    dblTap(r, c);
    expect(cell(r, c).querySelector('.cell__tried')).not.toBeNull();
    toolBtn('dog')!.click();
    dblTap(r, c);
    expect(s.hearts).toBe(s.maxHearts - 2);
    expect(cell(r, c).querySelector('.cell__err')).not.toBeNull();
    expect(cell(r, c).querySelector('.cell__tried')).toBeNull();
  });

  it('Erase takes back ✕ marks only: animals and mistakes stay; a drag clears a run of ✕', () => {
    start(5);
    const s = app.active!.session;
    const x = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(x[0], x[1]);
    const a = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(a[0], a[1]);
    const m = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(m[0], m[1]);
    expect([s.cells[x[0]][x[1]], s.cells[a[0]][a[1]], s.errorsAt(m[0], m[1]).length]).toEqual([MARK, CAT, 1]);
    eraseBtn().click();
    expect(eraseBtn().getAttribute('aria-pressed')).toBe('true');
    expect(coach()).toMatch(/Animals and mistakes stay/);
    tap(x[0], x[1]);
    expect(s.cells[x[0]][x[1]]).toBe(EMPTY);
    tap(a[0], a[1]);
    expect(s.cells[a[0]][a[1]]).toBe(CAT);
    expect(coach()).toMatch(/Erase only takes back ✕ marks/);
    tap(m[0], m[1]);
    expect(s.errorsAt(m[0], m[1])).toEqual([CAT]);
    expect(coach()).toMatch(/Mistakes stay marked/);
    // Erase stays on; a drag lifts a run of ✕ and passes over everything else.
    eraseBtn().click();
    const row = [...Array(s.size).keys()].filter((c) => !s.givenMask[s.size - 1][c] && s.cells[s.size - 1][c] === EMPTY && !s.errorsAt(s.size - 1, c).length).slice(0, 3).map((c) => [s.size - 1, c] as [number, number]);
    drag(row);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(MARK);
    eraseBtn().click();
    drag(row);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(EMPTY);
    // Delete on the keyboard follows the same rule.
    eraseBtn().click();
    key(a[0], a[1], 'Delete');
    expect(s.cells[a[0]][a[1]]).toBe(CAT);
  });

  it('a ✕ drag marks exactly the tiles under the finger, passing over mistakes', () => {
    start(5);
    const s = app.active!.session;
    const m = find((r, c) => s.puzzle.solution[r][c] === EMPTY && r === 1);
    dblTap(m[0], m[1]);
    const before = s.cells.map((r) => r.slice());
    const run = [...Array(s.size).keys()].filter((c) => !s.givenMask[1][c] && s.cells[1][c] === EMPTY).map((c) => [1, c] as [number, number]);
    const start0 = run.find(([r, c]) => !s.errorsAt(r, c).length)!;
    drag([start0, ...run.filter((t) => t !== start0)]);
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const touched = run.some(([rr, cc]) => rr === r && cc === c) && !s.errorsAt(r, c).length;
        expect(s.cells[r][c]).toBe(touched ? MARK : before[r][c]);
      }
    expect(s.errorsAt(m[0], m[1])).toEqual([CAT]);
  });

  it('keyboard: Enter places the picked animal, 2 the other; x marks; a wrong guess is marked', () => {
    start(30);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    key(r, c, 'Enter');
    expect(s.cells[r][c]).toBe(CAT);
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === DOG);
    key(r2, c2, '2');
    expect(s.cells[r2][c2]).toBe(DOG);
    const [r3, c3] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    key(r3, c3, 'x');
    expect(s.cells[r3][c3]).toBe(MARK);
    key(r3, c3, '1');
    expect(s.errorsAt(r3, c3)).toEqual([CAT]);
    expect(s.cells[r3][c3]).toBe(EMPTY);
  });

  it('the tap cycle needs no timing: empty → ✕ → animal; a wrong one is marked; animals stay', () => {
    start(5, 'classic');
    const s = app.active!.session;
    expect(coach()).toMatch(/Tap once to mark/);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(MARK);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    const [w, v] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(w, v);
    tap(w, v);
    expect(s.hearts).toBe(s.maxHearts - 1);
    expect(s.cells[w][v]).toBe(EMPTY);
    expect(cell(w, v).querySelector('.cell__err')).not.toBeNull();
  });
});

describe('Hint shows your hints; dots only on Easy boards (D37)', () => {
  const badge = () => document.querySelector('[data-hint-badge]')?.textContent?.trim();
  const label = () => document.querySelector('[data-hint-label]')?.textContent;
  const give = (n: number) => app.save.inventory.items.push({ id: `test:hints:${n}`, item: 'hint', delta: n, at: '2026-10-30T00:00:00.000Z', source: 'gift' });

  it('the badge is always the hint count; the first look is labelled free and costs nothing', () => {
    give(3);
    start(5);
    expect(badge()).toBe('3');
    expect(label()).toBe('Free hint');
    expect(document.querySelector('[data-act="hint"]')?.getAttribute('aria-label')).toMatch(/free this time\. You have 3 hints\./);
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(label()).toBe('Explain');
    expect(badge()).toBe('3');
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(label()).toBe('Place it');
    expect(badge()).toBe('2');
  });

  it('Zen shows the count too (its hints stay free)', () => {
    give(4);
    app.settings.controls = 'tap';
    startGame({ kind: 'zen', size: 6, seed: 7_000_123, rule: 'solo' });
    expect(badge()).toBe('4');
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    (document.querySelector('[data-act="hint"]') as HTMLButtonElement).click();
    expect(badge()).toBe('4');
  });

  it('dots on tiles no animal can reach show on an Easy board, never on a harder one', () => {
    start(4); // 6×6 Easy
    expect(document.querySelector('.chip--board')?.textContent).toMatch(/Easy/);
    let s = app.active!.session;
    let [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(document.querySelectorAll('.cell__dot').length).toBeGreaterThan(0);
    start(5); // 6×6 Medium
    expect(document.querySelector('.chip--board')?.textContent).toMatch(/Medium/);
    s = app.active!.session;
    [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(document.querySelectorAll('.cell__dot')).toHaveLength(0);
    // And the setting still turns them off on Easy boards.
    app.settings.autoMark = false;
    start(4);
    s = app.active!.session;
    [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(document.querySelectorAll('.cell__dot')).toHaveLength(0);
  });
});

describe('a solve credits the sanctuary the board started for (P0)', () => {
  function solve(): void {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        if (!document.querySelector('.cell')) return;
        toolBtn(want === CAT ? 'cat' : 'dog')?.click();
        dblTap(r, c);
        if (s.outcome === 'won') return;
      }
  }

  it('Farm board, then Pet Garden chosen, then the Farm board is finished: the Farm grows, the Garden does not', () => {
    start(4);
    expect(app.active!.cast!.sanctuary).toBe('farm');
    const board = app.active!.boardId;
    expect(board).toBeTruthy();
    // The player goes to the World and decides to build the Pet Garden while this board is still on the table.
    expect(setActive(app.save, 'harmony')).toBe(true);
    app.persist();
    solve();
    expect(app.active).toBeNull();
    expect(app.save.world.growth.farm ?? 0).toBe(1);
    expect(app.save.world.growth.harmony ?? 0).toBe(0);
    expect(app.save.world.active).toBe('harmony');
    expect(app.save.world.credits[board!]).toBe('farm');
    // The next board is for the Pet Garden, as chosen.
    start(5);
    expect(app.active!.cast!.sanctuary).toBe('harmony');
    expect(app.active!.boardId).not.toBe(board);
  });

  it('the status line says which sanctuary the board is for, even after a re-mount', () => {
    start(4);
    expect(document.querySelector('[data-for="farm"]')?.textContent).toContain('Farm');
    setActive(app.save, 'harmony');
    app.router.refresh();
    expect(document.querySelector('[data-for="farm"]')).not.toBeNull();
  });
});

describe('level 21: the bridge, then the lesson', () => {
  it('shows the two-animal rules once, with this board\'s animals, before the guided first pair', () => {
    app.save.onboarding.pairRulesSeen = false;
    app.save.onboarding.pairLessonDone = false;
    app.save.journey.nextLevel = 21;
    startGame({ kind: 'level', level: 21 });
    const sheet = document.querySelector('.rules-bridge');
    expect(sheet).not.toBeNull();
    expect(sheet?.textContent).toMatch(/A second animal joins/);
    expect(sheet?.textContent).toMatch(/Double-tap to place the animal you picked/);
    expect(document.querySelector('.cell.is-guide')).toBeNull();
    (sheet!.querySelector('[data-act="ok"]') as HTMLButtonElement).click();
    expect(document.querySelector('.rules-bridge')).toBeNull();
    expect(document.querySelector('.cell.is-guide')).not.toBeNull();
    expect(coach()).toMatch(/Now two animals/);
    expect(app.save.onboarding.pairRulesSeen).toBe(true);
  });
});

describe('the win sheet: milestones first, ordinary wins quick (PR 4)', () => {
  // The sheet rises a beat after the last placement (the faces celebrate first).
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  function solveBoard(): void {
    placeAll();
    vi.advanceTimersByTime(700);
    // A spotlit win waits for Tiny Triumph to finish before its spotlight (D45 PR B).
    if (!document.querySelector('.win-sheet, .arrival, .spotlight')) vi.advanceTimersByTime(600);
    // A win that brings an animal home opens with its spotlight (D44 PR E): a tap goes on to the results.
    const spot = document.querySelector<HTMLElement>('.spotlight');
    if (spot) {
      spot.click();
      vi.advanceTimersByTime(300);
    }
  }
  function placeAll(): void {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        toolBtn(want === CAT ? 'cat' : 'dog')?.click();
        dblTap(r, c);
        if (s.outcome === 'won') return;
      }
  }
  const sheet = () => document.querySelector('.win-sheet');

  it('an ordinary win: no hero, Play next is the one big button, the visit is quiet, the world line says +1', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    expect(sheet()).not.toBeNull();
    expect(sheet()!.classList.contains('win-sheet--milestone')).toBe(false);
    expect(sheet()!.querySelector('.win-hero')).toBeNull();
    const blocks = [...sheet()!.querySelectorAll<HTMLElement>('.sheet__actions .btn--block')];
    expect(blocks.map((b) => b.textContent)).toEqual(['Play level 5']);
    expect(blocks[0].dataset.act).toBe('next');
    expect(sheet()!.querySelector('.win-secondary [data-act="region"]')?.textContent).toContain('Visit the Farm');
    expect(sheet()!.textContent).toMatch(/Farm \+1/);
  });

  it('an arrival: the newcomer is the hero, Meet is the main action and Play next a full second button', () => {
    app.save.world.growth.farm = 3; // Truffle arrives at 4
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    const sh = sheet()!;
    expect(sh.classList.contains('win-sheet--milestone')).toBe(true);
    // D40: the animal first — its name as the title, what it is to you, and its character.
    expect(sh.querySelector('h2')?.textContent).toBe('Truffle is home!');
    expect(sh.querySelector('[data-hero="arrived"]')?.textContent).toMatch(/Your new piglet/);
    expect(sh.querySelector('[data-hero="arrived"]')?.textContent).toMatch(/A new little friend has arrived/);
    expect(sh.querySelector('[data-hero="arrived"]')?.textContent).toMatch(/Playful.*Truffle is curious about everything/);
    const blocks = [...sh.querySelectorAll<HTMLElement>('.sheet__actions .btn--block')];
    expect(blocks.map((b) => [b.dataset.act, b.textContent])).toEqual([
      ['meet', 'Meet Truffle'],
      ['next', 'Play level 5'],
    ]);
    // The news waits on the World until the Farm is visited.
    expect(app.save.world.unseen.farm?.animals).toEqual(['truffle']);
    (blocks[0] as HTMLButtonElement).click();
    expect(app.router.route).toMatchObject({ screen: 'region', id: 'farm' });
  });

  it('a region opening on the same solve outranks the arrival: Explore is the main action and goes there', () => {
    app.save.journey.nextLevel = 10; // clearing level 10 opens the Outback
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(10);
    solveBoard();
    const sh = sheet()!;
    expect(sh.querySelector('[data-hero="opened"]')).not.toBeNull();
    expect(sh.querySelector('h2')?.textContent).toBe('The Outback Sanctuary is open!');
    // The arrival still shows, below.
    expect(sh.textContent).toMatch(/Truffle the piglet came home to the Farm/);
    const primary = sh.querySelector<HTMLElement>('.sheet__actions .btn--block')!;
    expect(primary.textContent).toBe('Explore the Outback');
    // Both hold news until each is visited (the real sanctuary screens clear it; see navigation.dom.test).
    expect(app.save.world.unseen.outback).toMatchObject({ opened: true });
    expect(app.save.world.unseen.farm?.animals).toEqual(['truffle']);
    primary.click();
    expect(app.router.route).toMatchObject({ screen: 'region', id: 'outback' });
  });

  it('a replay of the level that brought an animal home is an ordinary win: no hero, nothing re-fired, and (D38) no growth', () => {
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    expect(sheet()!.querySelector('.win-hero')).not.toBeNull();
    (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
    // Back to level 4 on purpose: a replay.
    start(4);
    solveBoard();
    expect(sheet()!.querySelector('.win-hero')).toBeNull();
    expect(sheet()!.textContent).not.toMatch(/came home/);
    // The level already grew the Farm once; a replay sharpens stars and times, it doesn't grow the world again.
    expect(app.save.world.growth.farm).toBe(4);
    expect(sheet()!.querySelector('[data-replay-note]')?.textContent).toMatch(/A replay: it already grew the Farm once/);
    expect(sheet()!.textContent).not.toMatch(/\+1/);
  });

  describe('the reward first, the accounting folded (D40 PR C)', () => {
    it("an ordinary win's first view: Puzzle solved!, small stars, Meadow Farm +1, one puzzle closer, Play next", () => {
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(6);
      solveBoard();
      const w = sheet()!;
      expect(w.querySelector('h2')?.textContent).toBe('Puzzle solved!');
      const first = w.querySelector('.win-stage-1')!;
      expect(first.querySelector('.win-stars--small')).not.toBeNull();
      expect(first.querySelector('.win-plus')?.textContent).toBe('Meadow Farm +1');
      expect(first.textContent).toMatch(/One puzzle closer to Truffle!/);
      // Time, badges, points and coins are not in the first view…
      for (const sel of ['.stats', '.win-points', '.win-rewards', '.win-skill', '[data-act="share"]']) expect(first.querySelector(sel), sel).toBeNull();
      // …they are one tap away, and the fold's summary says what it holds.
      const more = w.querySelector<HTMLDetailsElement>('[data-win-more]')!;
      expect(more.open).toBe(false);
      expect(more.querySelector('.stats')).not.toBeNull();
      expect(more.querySelector('.win-points')).not.toBeNull();
      expect(more.querySelector('[data-act="share"]')).not.toBeNull();
      expect(more.querySelector('summary')?.textContent).toMatch(/More rewards.*\+\d+ coins.*Paw Points/);
      // The buttons come before the fold.
      const order = [...w.querySelectorAll('.win-stage-1, .sheet__actions, [data-win-more]')].map((x) => (x.matches('[data-win-more]') ? 'more' : x.matches('.sheet__actions') ? 'actions' : 'first'));
      expect(order).toEqual(['first', 'actions', 'more']);
    });

    it('Zen: no stars, the step the world took up top; a replay: the stars still to earn up top, its note folded', () => {
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      startGame({ kind: 'zen', size: 5, seed: 7_000_321, rule: 'solo' });
      solveBoard();
      let first = sheet()!.querySelector('.win-stage-1')!;
      expect(first.querySelector('.win-stars')).toBeNull();
      expect(first.querySelector('.win-plus')?.textContent).toBe('Meadow Farm +1');
      expect(sheet()!.querySelector('[data-win-more] .stats')).not.toBeNull();
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      // A replay of level 4 (already solved): what's left to earn is the news.
      app.save.journey.clears.L4 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 999, bestMistakes: 2, clean: false, hintFree: true, stars: 2 };
      app.save.world.grown.L4 = 'farm';
      start(4);
      solveBoard();
      first = sheet()!.querySelector('.win-stage-1')!;
      expect(first.querySelector('.win-replay')).not.toBeNull();
      expect(first.querySelector('.win-plus')).toBeNull();
      expect(sheet()!.querySelector('[data-win-more] [data-replay-note]')).not.toBeNull();
    });

    it('an arrival keeps even the stars for the fold: the first view is the animal', () => {
      app.save.world.growth.farm = 3;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(4);
      solveBoard();
      const w = sheet()!;
      const first = w.querySelector('.win-stage-1')!;
      expect(first.querySelector('[data-hero="arrived"]')).not.toBeNull();
      expect(first.querySelector('.win-stars, .stats, .win-points')).toBeNull();
      const more = w.querySelector('[data-win-more]')!;
      expect(more.querySelector('.win-stars')).not.toBeNull();
      // What's next after Truffle is there too, for whoever looks, and the summary says so.
      expect(more.textContent).toMatch(/Buttercup the calf/);
      expect(more.querySelector('summary')?.textContent).toMatch(/More rewards|Stars, time and what's next/);
    });
  });

  describe('a win always says what is next (D39 PR A)', () => {
    const home = (ids: string[]) => {
      for (const id of ids) app.save.inventory.companions[id] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    };
    it('the solve that finishes a sanctuary points at the animal on its way to the home being built now', () => {
      app.save.world.growth.farm = 25; // Hazel arrives at 26, the last stage
      home(['cotton', 'truffle', 'buttercup', 'pepper', 'marigold']);
      start(4);
      solveBoard();
      const w = sheet()!;
      expect(w.querySelector('h2')?.textContent).toBe('Hazel is home!');
      expect(w.textContent).toMatch(/The Meadow Farm is complete!/);
      expect(w.querySelector('[data-up-next]')?.textContent).toMatch(/Up next at the Pet Garden: Juniper the bunny, one more puzzle/);
    });

    it('with every open home finished, it names the next home to open and how many levels away', () => {
      app.save.world.growth.farm = 25;
      home(['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'juniper', 'ember', 'maple']);
      for (const p of ['biscuit', 'mochi', 'pip', 'nori', 'clover', 'peanut'] as const) app.save.inventory.pets[p] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      app.save.world.growth.harmony = 53;
      start(4);
      solveBoard();
      expect(sheet()!.querySelector('[data-up-next]')?.textContent).toMatch(/Next home: the Outback Sanctuary opens after level 10 · 6 levels to go/);
    });

    it('a replay in a finished sanctuary still says what the next puzzle helps', () => {
      app.save.world.growth.farm = 25;
      home(['cotton', 'truffle', 'buttercup', 'pepper', 'marigold']);
      start(4);
      solveBoard();
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      start(4); // a replay, on a board cast for the Pet Garden now
      solveBoard();
      expect(sheet()!.querySelector('[data-replay-note]')).not.toBeNull();
      expect(sheet()!.querySelector('.win-next-friend')?.textContent).toMatch(/Juniper the bunny/);
    });
  });

  describe('growth you can see, and fair (D38 PR D)', () => {
    it('an ordinary win says the step the animal took and moves its bar from before to after', () => {
      app.save.world.growth.farm = 1; // Truffle (at 4) is three puzzles away
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(6);
      solveBoard();
      const w = sheet()!;
      expect(w.querySelector('.win-hero')).toBeNull();
      expect(w.querySelector('.win-plus')?.textContent).toBe('Meadow Farm +1');
      expect(w.querySelector('.win-next-friend')?.textContent).toMatch(/One puzzle closer to Truffle!/);
      expect(w.querySelector('.win-next-friend')?.textContent).toMatch(/Truffle the piglet: 3 → 2 puzzles away/);
      const bar = w.querySelector<HTMLElement>('[data-grow-bar]')!;
      // Starts where it was (0 of 3), settles where it is now (1 of 3) a beat later; a tap settles it at once.
      expect(bar.style.width).toBe('0%');
      expect(bar.dataset.to).toBe('33');
      vi.advanceTimersByTime(700);
      w.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true }));
      expect(bar.style.width).toBe('33%');
      expect(app.save.world.growth.farm).toBe(2);
      expect(app.save.world.grown.L6).toBeDefined();
    });

    it('under reduced motion the bar is already where it is now and the +1 does not animate', () => {
      app.settings.reducedMotion = 'reduce';
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      start(6);
      solveBoard();
      const w = sheet()!;
      expect(w.classList.contains('is-revealed')).toBe(true);
      expect(w.querySelector<HTMLElement>('[data-grow-bar]')!.style.width).toBe('33%');
      app.settings.reducedMotion = 'system';
    });

    it('a restarted Zen board is the same puzzle: it grows the world once; a fresh Zen board counts again', () => {
      app.save.world.growth.farm = 1;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
      const zen = { kind: 'zen' as const, size: 5, seed: 7_000_102, rule: 'solo' as const };
      startGame(zen);
      solveBoard();
      expect(app.save.world.growth.farm).toBe(2);
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      startGame(zen); // the very same board again
      solveBoard();
      expect(app.save.world.growth.farm).toBe(2);
      expect(sheet()!.querySelector('[data-replay-note]')).not.toBeNull();
      (sheet()!.querySelector('[data-act="next"]') as HTMLButtonElement).click();
      startGame({ ...zen, seed: 7_000_199 });
      solveBoard();
      expect(app.save.world.growth.farm).toBe(3);
    });
  });
});

describe('small kindnesses on the board (PR 5)', () => {
  it('a replay says which stars are still to earn; the difficulty chip explains itself on a tap', () => {
    app.save.journey.clears.L5 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 83, bestMistakes: 1, clean: false, hintFree: true, stars: 2 };
    app.save.journey.bestTimes.L5 = 83;
    start(5);
    expect(coach()).toBe('Replay. One star to earn: solve it with no mistakes.');
    (document.querySelector('.chip--board') as HTMLElement).click();
    expect(coach()).toMatch(/^(Easy|Medium|Hard|Expert): /);
    expect(coach()).not.toMatch(/row \d|column \d/i); // the reason never names a move
  });

  it('a fully starred replay offers the best time to beat', () => {
    app.save.journey.clears.L5 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 61, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    app.save.journey.bestTimes.L5 = 61;
    start(5);
    expect(coach()).toBe('Replay. All three stars are yours; your best is 1:01.');
  });

  it('on a one-animal board, placing an animal glows its whole color for a beat (overlay only)', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    const region = s.puzzle.regions[r][c];
    const glowing = [...document.querySelectorAll<HTMLElement>('.cell.is-glow')].map((e) => Number(e.dataset.r) * 100 + Number(e.dataset.c));
    const expected = s.unitCells({ kind: 'region', index: region }).map(([rr, cc]) => rr * 100 + cc);
    expect(glowing.sort()).toEqual(expected.sort());
  });
});

describe('hardening: large boards, assistive tech, no videos (review gaps)', () => {
  it('Large board mode: a finger moving across tiles pans, it never marks or places', () => {
    app.settings.largeBoard = true;
    start(5);
    const s = app.active!.session;
    expect(document.querySelector('.board.is-pannable')).not.toBeNull();
    const row = [...Array(s.size).keys()].filter((c) => !s.givenMask[0][c]).map((c) => [0, c] as [number, number]);
    drag(row);
    expect(s.events.filter((e) => e.type === 'mark' || e.type === 'place')).toHaveLength(0);
    for (const [r, c] of row) expect(s.cells[r][c]).toBe(EMPTY);
    // A click (a real tap, not a pan) still marks.
    cell(0, row[0][1]).click();
    expect(s.cells[0][row[0][1]]).toBe(MARK);
    app.settings.largeBoard = false;
  });

  it('animal buttons tell a screen reader what a double tap places, and cells say what they hold', () => {
    start(30);
    expect(toolBtn('cat')?.getAttribute('aria-label')).toMatch(/^[A-Z][a-z]+: a double tap places an? [a-z ]+$/);
    expect(document.querySelector('.tools')?.getAttribute('role')).toBe('radiogroup');
    expect(toolBtn('cat')?.getAttribute('role')).toBe('radio');
    expect(eraseBtn().getAttribute('aria-pressed')).toBe('false');
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r, c);
    expect(cell(r, c).getAttribute('aria-label')).toMatch(/marked empty$/);
  });

  it('under reduced motion a placement does not glow the color (the overlay flash is skipped)', () => {
    app.settings.reducedMotion = 'reduce';
    expect(app.reducedMotion).toBe(true);
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    expect(document.querySelectorAll('.cell.is-glow')).toHaveLength(0);
    app.settings.reducedMotion = 'system';
  });

  it('with no video network, the hearts sheet never offers a video and the Journey loop still runs', async () => {
    const ads = await import('../../src/services/ads');
    const spy = vi.spyOn(ads.ads, 'available', 'get').mockReturnValue(false);
    try {
      start(5);
      const s = app.active!.session;
      // Lose every heart (a different wrong tile each time): the loss sheet must offer Try again and Back, never a video.
      for (let i = 0; i < s.maxHearts; i++) {
        const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
        dblTap(r, c);
      }
      expect(s.outcome).toBe('lost');
      const sheet = document.querySelector('.sheet')!;
      expect(sheet.textContent).toMatch(/So close!/);
      expect(sheet.querySelector('[data-act="revive"]')).toBeNull();
      expect(sheet.textContent).not.toMatch(/video/i);
      expect(sheet.querySelector('[data-act="restart"]')).not.toBeNull();
      (sheet.querySelector('[data-act="leave"]') as HTMLButtonElement).click();
      expect(app.router.route?.screen).toBe('journey');
    } finally {
      spy.mockRestore();
    }
  });
});

describe('gesture clarity (D38 PR B)', () => {
  it('after the first animal placed on an ordinary board, one line explains the controls, once', () => {
    start(5);
    const s = app.active!.session;
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    // A ✕ alone is not the moment.
    const [er, ec] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(er, ec);
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    const tip = document.querySelector('[data-controls-tip]')!;
    expect(tip).not.toBeNull();
    expect(tip.textContent).toMatch(/Tap marks ✕ · double-tap places/);
    expect(tip.textContent).toMatch(/Controls in Settings/);
    expect(app.save.onboarding.controlsTipSeen).toBe(true);
    // The coach line underneath still says what the move did; the tip takes no input away.
    expect(coach()).toMatch(/Nicely reasoned|Settled in|That one belongs|Good spot|complete/);
    (tip.querySelector('[data-act="tip-close"]') as HTMLButtonElement).click();
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    // Never again on the next board.
    app.active = null;
    start(6);
    const s2 = app.active!.session;
    const [r2, c2] = find((r, c) => s2.puzzle.solution[r][c] === CAT);
    dblTap(r2, c2);
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
  });

  it('the tip names the two-step scheme when that is the setting, and its link opens Settings', () => {
    start(5, 'classic');
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    tap(r, c);
    tap(r, c);
    expect(s.cells[r][c]).toBe(CAT);
    const tip = document.querySelector('[data-controls-tip]')!;
    expect(tip.textContent).toMatch(/Two-step tap/);
    (tip.querySelector('[data-act="tip-controls"]') as HTMLButtonElement).click();
    expect(document.querySelector('[data-controls-tip]')).toBeNull();
    expect(document.querySelector('.sheet')?.textContent).toMatch(/Settings/);
    expect(document.querySelector('.sheet [data-choice="controls"][data-value="classic"]')?.textContent).toBe('Two-step tap (no timing)');
    expect(document.querySelector('.sheet [data-choice="controls"][data-value="tap"]')?.textContent).toBe('Fast double-tap');
    expect(document.querySelector('.sheet .cp-demo')?.getAttribute('data-scheme')).toBe('classic');
    expect(s.paused).toBe(true);
  });

  it('an activation without a pointer (a screen reader, a switch) is two-step under the fast scheme: no timing to beat', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    // The way assistive tech activates a button: a click with no taps behind it (detail 0), seconds apart.
    const activate = () => cell(r, c).dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 0 }));
    activate();
    expect(s.cells[r][c]).toBe(MARK);
    nowMs += 5_000;
    activate();
    expect(s.cells[r][c]).toBe(CAT);
    expect(placeEvents()).toHaveLength(1);
    // A finger still gets the fast scheme: a slow second tap clears the ✕ instead of placing.
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(r2, c2);
    tap(r2, c2);
    expect(s.cells[r2][c2]).toBe(EMPTY);
  });

  it('the pause sheet says what the controls are and offers Settings; How to play says where the other scheme is', () => {
    start(5);
    document.querySelector<HTMLButtonElement>('[data-act="pause"]')!.click();
    expect(document.querySelector('[data-pause-controls]')?.textContent).toMatch(/Tap marks ✕, double-tap places/);
    expect(document.querySelector('.sheet [data-act="settings"]')?.textContent).toMatch(/Settings and controls/);
    document.querySelector<HTMLButtonElement>('.sheet [data-act="rules"]')!.click();
    expect(document.querySelector('.sheet')?.textContent).toMatch(/Prefer no timing\? Settings → Controls → Two-step tap/);
  });
});

describe('polish (D38 PR E)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('each hint step previews the next one and its cost, so a tap is never an accidental purchase', () => {
    setPantry(app.save, 'hint', 3);
    start(5);
    const hintBtn = document.querySelector<HTMLButtonElement>('[data-act="hint"]')!;
    hintBtn.click();
    expect(coach()).toMatch(/Look at .*Next: Explain says why \((free|uses a hint)\)\./);
    hintBtn.click();
    expect(coach()).toMatch(/Next: Place it puts the animal there \((free|uses a hint)\)\./);
  });

  it('a Medium or harder solve says so, and "What made it …?" opens the grader\'s own reason', () => {
    // Cotton is already home (a fresh save's first animal gets its own arrival, D41, instead of this sheet).
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(8); // level 8 is measured Medium
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        dblTap(r, c);
        if (s.outcome === 'won') break;
      }
    vi.advanceTimersByTime(700);
    const sheet = document.querySelector('.win-sheet')!;
    const skill = sheet.querySelector('[data-skill]')!;
    expect(skill.textContent).toMatch(/You solved a Medium 7×7\./);
    (skill.querySelector('[data-act="why"]') as HTMLButtonElement).click();
    expect(skill.textContent).toMatch(/^Medium: /);
    expect(skill.querySelector('[data-act="why"]')).toBeNull();
    // The sheet is still open: the question did not count as a tap to leave.
    expect(document.querySelector('.win-sheet')).not.toBeNull();
  });

  it('an Easy solve keeps the sheet quiet: no skill line', () => {
    start(2); // level 2 is measured Easy
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        dblTap(r, c);
        if (s.outcome === 'won') break;
      }
    vi.advanceTimersByTime(700);
    expect(document.querySelector('.win-sheet [data-skill]')).toBeNull();
  });
});

describe('a little why, and small celebrations (D39 PR C)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    app.save.onboarding.controlsTipSeen = true;
  });
  afterEach(() => {
    vi.useRealTimers();
    app.settings.explainMoves = false;
  });
  const why = () => document.querySelectorAll('.cell.is-why');

  /** Marks ✕ on every other open tile of the solution cell's row, then places the animal: the row left one spot. */
  function forceByRow(skipRows: number[] = []): { r: number; c: number } {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++) {
      if (skipRows.includes(r)) continue;
      const c = s.puzzle.solution[r].findIndex((v) => v !== EMPTY);
      if (c < 0 || s.givenMask[r][c] || s.cells[r][c] !== EMPTY) continue;
      for (let cc = 0; cc < s.size; cc++) if (cc !== c && s.cells[r][cc] === EMPTY && !s.errorsAt(r, cc).length) s.toggleMark(r, cc);
      dblTap(r, c);
      return { r, c };
    }
    throw new Error('no row to force');
  }

  it('the first few moves one line decided say so and ring that line; then only with the setting', () => {
    start(5);
    const done: number[] = [];
    for (let i = 0; i < 3; i++) {
      const { r } = forceByRow(done);
      done.push(r);
      expect(coach()).toMatch(/^Only one spot was left for an? \w+ in (row\u00a0\d|column\u00a0\d|the \w+ region)\.$/);
      expect(why().length).toBeGreaterThan(0);
      vi.advanceTimersByTime(1600);
      expect(why().length).toBe(0);
    }
    expect(app.save.onboarding.whyShown).toBe(3);
    // The fourth is quiet…
    const { r } = forceByRow(done);
    done.push(r);
    expect(coach()).not.toMatch(/Only one spot/);
    expect(why().length).toBe(0);
    // …unless the player asked for it.
    app.settings.explainMoves = true;
    forceByRow(done);
    expect(coach()).toMatch(/Only one spot was left/);
    expect(app.save.onboarding.whyShown).toBe(3);
  });

  it('a lucky or long-reasoned move says nothing about why', () => {
    app.settings.explainMoves = true;
    start(17); // a 9×9: an untouched board leaves no line with a single spot for the first animal placed
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    if (s.whyPlaced(r, c, CAT) !== null) return; // (this tile happened to be forced already; nothing to show)
    dblTap(r, c);
    expect(why().length).toBe(0);
    expect(coach()).not.toMatch(/Only one spot/);
  });

  it('a two-animal line finished by its only spot reads as one sentence, and that line is ringed', () => {
    start(25);
    const s = app.active!.session;
    // Place every animal of row 0 but the last, then leave the last one a single open tile.
    const row = 0;
    const animals = s.puzzle.solution[row].map((v, c) => [v, c] as const).filter(([v]) => v !== EMPTY);
    const [lastKind, lastC] = animals[animals.length - 1];
    for (const [v, c] of animals.slice(0, -1)) if (!s.givenMask[row][c]) s.place(row, c, v as typeof CAT);
    for (let c = 0; c < s.size; c++) if (c !== lastC && s.cells[row][c] === EMPTY) s.toggleMark(row, c);
    if (s.givenMask[row][lastC]) return;
    toolBtn(lastKind === CAT ? 'cat' : 'dog')!.click();
    dblTap(row, lastC);
    expect(coach()).toMatch(/^Row 1 (is complete|and \d more are complete)[.!]? .*(It was the only spot left there for|had one spot left in)/);
    expect([...why()].some((c) => (c as HTMLElement).dataset.r === '0')).toBe(true);
  });

  it('never in the Paw Cup, never on the guided first board', () => {
    app.settings.explainMoves = true;
    expect(app.save.onboarding.tutorialDone).toBe(true);
    app.save.onboarding.tutorialDone = false;
    start(1);
    const s = app.active!.session;
    // The guided board: its own coaching, no rings of ours.
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(why().length).toBe(0);
  });

  it('halfway through a board, a small ripple of smiles and "Halfway there!", once', () => {
    app.save.onboarding.whyShown = 3; // keep the why lines out of the way
    start(5);
    const s = app.active!.session;
    const half = Math.ceil(s.size / 2);
    let placed = 0;
    for (let r = 0; r < s.size && placed < half + 1; r++) {
      const c = s.puzzle.solution[r].findIndex((v) => v !== EMPTY);
      if (s.givenMask[r][c] || s.cells[r][c] !== EMPTY) {
        if (s.cells[r][c] !== EMPTY) placed++;
        continue;
      }
      dblTap(r, c);
      placed++;
      if (placed === half) expect(coach()).toBe('Halfway there!');
      else expect(coach()).not.toBe('Halfway there!');
    }
  });
});

describe('how the board feels (D40 PR A)', () => {
  it('a finger on a tile is acknowledged at once, under either scheme, before the move lands', () => {
    for (const scheme of ['tap', 'classic'] as const) {
      app.active = null;
      mountRouter();
      start(5, scheme);
      const s = app.active!.session;
      const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
      const el = cell(r, c);
      document.elementFromPoint = () => el;
      el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 7, clientX: 4, clientY: 4 }));
      expect(el.classList.contains('is-press'), scheme).toBe(true);
      el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 7 }));
    }
  });

  it('two animals of one kind are told apart by name, and the other may still live on a tile', () => {
    // Level 21+ casts can be two cats; a wrong one reads "Not Mochi's spot", never "a Mochi spot".
    start(25);
    const s = app.active!.session;
    expect(app.active!.cast?.b).toBeTruthy();
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    toolBtn('cat')?.click();
    dblTap(r, c);
    expect(coach()).not.toMatch(/Not a [A-Z]/);
    expect(coach()).toMatch(/no need to try (the \w[\w ’'-]*|[A-Z]\w+) here again/);
  });

  it('a wrong guess is a kind word, and only the last heart is mentioned (take your time)', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(r, c);
    expect(coach()).toMatch(/^Not a .* spot\. It's marked for you/);
    while (s.hearts > 2) {
      const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
      dblTap(r2, c2);
    }
    const [r3, c3] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    dblTap(r3, c3);
    expect(s.hearts).toBe(1);
    expect(coach()).toMatch(/One heart left, so take your time/);
  });

  it('two double taps that came a little slowly offer two-step tap once; one tap switches, and the board carries on', () => {
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    // A slow second tap clears the ✕ (the default stays the fast double tap).
    tap(r, c);
    tap(r, c, 520);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(document.querySelector('[data-two-step-offer]')).toBeNull();
    // A really slow second tap (a change of mind) is not counted.
    tap(r, c);
    tap(r, c, 2_000);
    expect(document.querySelector('[data-two-step-offer]')).toBeNull();
    tap(r, c);
    tap(r, c, 600);
    const offer = document.querySelector('[data-two-step-offer]')!;
    expect(offer.textContent).toMatch(/two-step tap/);
    expect(app.save.onboarding.twoStepOffered).toBe(true);
    expect(app.settings.controls).toBe('tap');
    const [er, ec] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(er, ec);
    expect(s.cells[er][ec]).toBe(MARK);
    (offer.querySelector('[data-act="use-two-step"]') as HTMLButtonElement).click();
    expect(app.settings.controls).toBe('classic');
    // Same board, now two-step: the ✕ is still there, and tapping a ✕ places.
    const s2 = app.active!.session;
    expect(s2.cells[er][ec]).toBe(MARK);
    tap(r, c);
    tap(r, c, 3_000);
    expect(s2.cells[r][c]).toBe(CAT);
    expect(document.querySelector('[data-two-step-offer]')).toBeNull();
  });

  it('the offer is shown once ever, and never on the two-step scheme', () => {
    app.save.onboarding.twoStepOffered = true;
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    for (let i = 0; i < 3; i++) {
      tap(r, c);
      tap(r, c, 500);
    }
    expect(document.querySelector('[data-two-step-offer]')).toBeNull();
  });
});

describe('the first arrival, shown happening (D41 PR A)', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    app.settings.reducedMotion = 'system';
  });
  function placeWin(): void {
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        toolBtn(want === CAT ? 'cat' : 'dog')?.click();
        dblTap(r, c);
        if (s.outcome === 'won') break;
      }
  }
  function solveBoard(): void {
    placeWin();
    vi.advanceTimersByTime(700);
    // A spotlit win waits for Tiny Triumph to finish before its spotlight (D45 PR B).
    if (!document.querySelector('.win-sheet, .arrival, .spotlight')) vi.advanceTimersByTime(600);
  }
  const arrival = () => document.querySelector<HTMLElement>('.arrival');
  const title = () => arrival()?.querySelector('[data-caption-title]')?.textContent;

  it('the first puzzle: no results sheet, the Farm as it was, the change growing in, Cotton settling in, then the goal', () => {
    start(1);
    solveBoard();
    expect(document.querySelector('.win-sheet')).toBeNull();
    expect(arrival()).not.toBeNull();
    expect(title()).toBe('Empty meadow');
    // The new stage and the newcomer start hidden, then appear in turn.
    expect(arrival()!.querySelector('.sp-stage[data-stage="1"]')?.classList.contains('is-waiting')).toBe(true);
    expect(arrival()!.querySelector('[data-friend="cotton"]')?.classList.contains('is-waiting')).toBe(true);
    vi.advanceTimersByTime(950);
    expect(title()).toBe('Your puzzle grew it!');
    expect(arrival()!.querySelector('.sp-stage[data-stage="1"]')?.classList.contains('is-waiting')).toBe(false);
    vi.advanceTimersByTime(1200);
    expect(title()).toBe('Cotton is home!');
    expect(arrival()!.textContent).toMatch(/Your new sheep\. Sleepy/);
    expect(arrival()!.querySelector<HTMLElement>('[data-arrival-goal]')!.hidden).toBe(true);
    vi.advanceTimersByTime(2200);
    const goal = arrival()!.querySelector<HTMLElement>('[data-arrival-goal]')!;
    expect(goal.hidden).toBe(false);
    expect(goal.textContent).toMatch(/Bring Truffle the piglet home/);
    expect(goal.textContent).toMatch(/3 more puzzles, and Truffle moves in/);
    expect(goal.querySelector('[data-act="play"]')?.textContent).toBe('Play level 2');
    // The World's "New" marker is already read: the player has just seen the news.
    expect(app.save.world.unseen.farm).toBeUndefined();
    (goal.querySelector('[data-act="play"]') as HTMLButtonElement).click();
    expect(arrival()).toBeNull();
    expect(app.active?.mode).toMatchObject({ kind: 'level', level: 2 });
  });

  it('Skip goes straight to the goal and stops the steps still to come; Visit opens the Farm', () => {
    start(1);
    solveBoard();
    vi.advanceTimersByTime(200);
    (arrival()!.querySelector('[data-act="skip"]') as HTMLButtonElement).click();
    expect(arrival()!.querySelector<HTMLElement>('[data-arrival-goal]')!.hidden).toBe(false);
    expect(title()).toBe('Cotton is home!');
    expect(arrival()!.querySelector('.is-waiting')).toBeNull();
    const play = arrival()!.querySelector<HTMLElement>('[data-act="play"]')!;
    expect(document.activeElement).toBe(play);
    // Nothing replays behind the goal: no grow-in, no drop-in, the caption stays.
    vi.advanceTimersByTime(5000);
    expect(title()).toBe('Cotton is home!');
    expect(arrival()!.querySelector('.is-new, .is-arriving')).toBeNull();
    expect(document.activeElement).toBe(play);
    (arrival()!.querySelector('[data-act="visit"]') as HTMLButtonElement).click();
    // D45 PR B: the Farm welcomes Cotton with the parade, and is told the introduction has been made.
    expect(app.router.route).toMatchObject({ screen: 'region', id: 'farm', welcome: ['cotton'], met: true });
  });

  it('under reduced motion it is the end at once: the scene as it is now, the news and the goal', () => {
    app.settings.reducedMotion = 'reduce';
    start(1);
    solveBoard();
    expect(title()).toBe('Cotton is home!');
    expect(arrival()!.querySelector<HTMLElement>('[data-arrival-goal]')!.hidden).toBe(false);
    expect(arrival()!.querySelector('.is-waiting')).toBeNull();
    // Focus is inside, on the main button (Skip is hidden: there is nothing to skip).
    expect(document.activeElement).toBe(arrival()!.querySelector('[data-act="play"]'));
  });

  it('is a modal: the game behind it is inert and Tab stays inside', () => {
    start(1);
    solveBoard();
    const screen = arrival()!.parentElement!;
    const behind = [...screen.children].filter((n) => n !== arrival());
    expect(behind.length).toBeGreaterThan(0);
    expect(behind.every((n) => (n as HTMLElement).inert)).toBe(true);
    (arrival()!.querySelector('[data-act="skip"]') as HTMLButtonElement).click();
    const visit = arrival()!.querySelector<HTMLElement>('[data-act="visit"]')!;
    visit.focus();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }));
    expect(document.activeElement).toBe(arrival()!.querySelector('[data-act="play"]'));
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true }));
    expect(document.activeElement).toBe(visit);
  });

  it('a Daily solved first keeps its own results, with Cotton to meet on them', () => {
    startGame({ kind: 'daily', dateKey: '2026-10-31' });
    solveBoard();
    expect(arrival()).toBeNull();
    // Cotton's moment in the light first (D44 PR E), then the Daily's own results.
    (document.querySelector('.spotlight') as HTMLElement).click();
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.win-sheet')).not.toBeNull();
  });

  it('the spotlight waits for Tiny Triumph: Welcome Home answers the win instead of cutting it off (D45 PR B)', () => {
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    placeWin();
    expect(SPOTLIGHT_AFTER_TRIUMPH_MS).toBeGreaterThanOrEqual(Math.round(cueMs(SCORES.triumph)));
    vi.advanceTimersByTime(700);
    // The old moment (0.65 s): the win's own tune is still playing, and nothing has replaced it.
    expect(document.querySelector('.spotlight')).toBeNull();
    expect(nowPlaying()?.id).toBe('triumph');
    vi.advanceTimersByTime(SPOTLIGHT_AFTER_TRIUMPH_MS - 700 + 10);
    expect(document.querySelector('.spotlight')).not.toBeNull();
    expect(nowPlaying()?.id).toBe('welcome');
  });

  it('with music off there is nothing to wait for: the spotlight opens at once', () => {
    app.settings.music = false;
    app.applySettings();
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    placeWin();
    vi.advanceTimersByTime(700);
    expect(document.querySelector('.spotlight')).not.toBeNull();
    app.settings.music = true;
    app.applySettings();
  });

  it('only the first animal ever: a later arrival keeps the win sheet, after its spotlight (D44 PR E)', () => {
    app.save.world.growth.farm = 3;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(4);
    solveBoard();
    expect(arrival()).toBeNull();
    const spot = document.querySelector<HTMLElement>('.spotlight');
    expect(spot?.textContent).toMatch(/is coming home to the Farm/);
    expect(document.querySelector('.win-sheet')).toBeNull();
    spot!.click();
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.spotlight')).toBeNull();
    expect(document.querySelector('.win-sheet [data-hero="arrived"]')).not.toBeNull();
  });
});

describe('a board that belongs to its home (D41 PR B)', () => {
  const plate = () => document.querySelector<HTMLElement>('.board-frame .board-plate');

  it('the board sits in its home’s frame; the nameplate says the home and what this board brings closer', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(2);
    expect(document.querySelector('.board-frame > .board')).not.toBeNull();
    expect(plate()?.querySelector('.status-for__name')?.textContent).toBe('Farm');
    expect(plate()?.querySelector('.board-plate__goal')?.textContent).toBe('Truffle in 3');
    // A screen reader hears it in words (the shown text is hidden from it).
    expect(plate()?.querySelector('.sr-only')?.textContent).toBe('This board helps the Meadow Farm. Truffle the piglet comes home in 3 more puzzles.');
    expect(plate()?.querySelector('.board-plate__show')?.getAttribute('aria-hidden')).toBe('true');
    // The board that brings an animal says so.
    app.active = null;
    app.save.world.growth.farm = 3;
    start(5);
    expect(plate()?.querySelector('.board-plate__goal')?.textContent).toBe('brings Truffle home');
  });

  it('a replay names the home only; a Paw Cup board has a plain frame', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    app.save.journey.clears.L2 = { firstClearAt: 'x', bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    app.save.world.grown.L2 = 'farm';
    start(2);
    expect(plate()?.querySelector('.board-plate__goal')).toBeNull();
    // A replay grows nothing new, and the plate doesn't claim it does.
    expect(plate()?.querySelector('.sr-only')?.textContent).toBe('A Meadow Farm board, solved before.');
    expect(plate()?.textContent).not.toMatch(/helps/);
  });

  it('a pip per animal fills as they come home; a two-animal board counts each kind', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(5);
    const s = app.active!.session;
    const pips = () => [...document.querySelectorAll('.progress-track .pip')];
    expect(pips()).toHaveLength(s.size);
    expect(pips().filter((p) => p.classList.contains('is-on'))).toHaveLength(0);
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r, c);
    expect(pips().filter((p) => p.classList.contains('is-on'))).toHaveLength(1);
    expect(document.querySelector('[data-progress]')?.getAttribute('aria-label')).toBe(`1 of ${s.size} animals placed`);
    app.active = null;
    start(25);
    const s2 = app.active!.session;
    expect(document.querySelectorAll('.progress-track .pcount:not(.pcount--solo)')).toHaveLength(2);
    const [r2, c2] = find((r, c) => s2.puzzle.solution[r][c] === DOG);
    toolBtn('dog')?.click();
    dblTap(r2, c2);
    expect(document.querySelector(`[data-count="${DOG}"]`)?.textContent).toBe(String(s2.cells.flat().filter((v) => v === DOG).length));
  });

  it('a color whose animal is home settles; the others stay as they are', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(5);
    const s = app.active!.session;
    const [r, c] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    const reg = s.puzzle.regions[r][c];
    expect(document.querySelector('.cell.is-settled')).toBeNull();
    dblTap(r, c);
    for (let rr = 0; rr < s.size; rr++)
      for (let cc = 0; cc < s.size; cc++) expect(cell(rr, cc).classList.contains('is-settled'), `${rr},${cc}`).toBe(s.puzzle.regions[rr][cc] === reg);
  });

  it('the tile last touched is marked; keyboard moves it; a solved board lets it go for good', () => {
    app.save.world.growth.farm = 1;
    app.save.inventory.companions.cotton = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    start(5);
    const b = document.querySelector<HTMLElement>('.board')!;
    expect(b.classList.contains('has-sel')).toBe(false);
    tap(2, 3);
    expect(b.classList.contains('has-sel')).toBe(true);
    expect([b.style.getPropertyValue('--sr'), b.style.getPropertyValue('--sc')]).toEqual(['2', '3']);
    cell(2, 3).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    expect([b.style.getPropertyValue('--sr'), b.style.getPropertyValue('--sc')]).toEqual(['3', '3']);
    // The brackets are an overlay: not inside any tile, so nothing on a tile moves.
    expect(b.querySelector('.board__sel')).not.toBeNull();
    expect(b.querySelector('.cell .board__sel')).toBeNull();
    // Solved: the ring goes, so the finished board is clean.
    const s = app.active!.session;
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) if (s.puzzle.solution[r][c] === CAT && !s.givenMask[r][c] && s.cells[r][c] !== CAT) dblTap(r, c);
    expect(s.outcome).toBe('won');
    expect(b.classList.contains('has-sel')).toBe(false);
    // A tap or an arrow key on the finished board brings none back.
    tap(0, 0);
    cell(0, 0).dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    expect(b.classList.contains('has-sel')).toBe(false);
  });
});

describe('losing a board, and the ways back (D47 PR 4)', () => {
  /** Loses every heart on the open board (a different wrong tile each time). */
  function loseBoard(): HTMLElement {
    const s = app.active!.session;
    const hearts = s.hearts;
    for (let i = 0; i < hearts; i++) {
      const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
      dblTap(r, c);
    }
    expect(s.outcome).toBe('lost');
    return document.querySelector('.sheet')!;
  }
  const lifeGrants = () => app.save.inventory.items.filter((e) => e.item === 'life' && e.source === 'ad');
  const lifeBalance = () => app.save.inventory.items.filter((e) => e.item === 'life').reduce((n, e) => n + e.delta, 0);

  async function withVideos(show: (placement: string, onEarned?: () => void) => Promise<boolean>) {
    const ads = await import('../../src/services/ads');
    vi.spyOn(ads.ads, 'available', 'get').mockReturnValue(true);
    return vi.spyOn(ads.ads, 'showRewarded').mockImplementation(show as never);
  }

  it('offers an earned extra life, an optional video, a free retry and the way back, in warm words; never a purchase', async () => {
    await withVideos(async () => false);
    setPantry(app.save, 'life', 2);
    start(5);
    const sheet = loseBoard();
    expect(sheet.textContent).toMatch(/So close!/);
    expect(sheet.textContent).toMatch(/just as you left it/);
    expect(sheet.textContent).not.toMatch(/Out of hearts|failed|game over/i);
    const acts = [...sheet.querySelectorAll<HTMLElement>('[data-act]')].map((b) => b.dataset.act);
    expect(acts).toEqual(['life', 'revive', 'restart', 'leave']);
    expect(sheet.textContent).toMatch(/Try again, free/);
    expect(sheet.textContent).not.toMatch(/gem|buy|purchase|\$/i);
  });

  it('an extra life brings the board back as it was, and the board takes input again (tap ✕, drag ✕, double-tap place)', () => {
    setPantry(app.save, 'life', 1);
    start(5);
    const s = app.active!.session;
    const [pr, pc] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(pr, pc);
    expect(s.cells[pr][pc]).toBe(CAT);
    const sheet = loseBoard();
    (sheet.querySelector('[data-act="life"]') as HTMLButtonElement).click();
    expect(s.outcome).toBe('playing');
    expect(s.hearts).toBe(1);
    expect(s.cells[pr][pc]).toBe(CAT);
    expect(document.querySelector('.sheet')).toBeNull();
    // Input works again: a tap marks, a drag marks a run, a double tap places.
    const [tr, tc] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
    tap(tr, tc);
    expect(s.cells[tr][tc]).toBe(MARK);
    const run = [0, 1, 2, 3, 4, 5].flatMap((c) => [[tr === 0 ? 1 : 0, c] as [number, number]]).filter(([r, c]) => s.cells[r][c] === EMPTY && !s.givenMask[r][c] && s.puzzle.solution[r][c] === EMPTY).slice(0, 2);
    if (run.length === 2) {
      drag(run);
      for (const [r, c] of run) expect(s.cells[r][c]).toBe(MARK);
    }
    const [r2, c2] = find((r, c) => s.puzzle.solution[r][c] === CAT);
    dblTap(r2, c2);
    expect(s.cells[r2][c2]).toBe(CAT);
  });

  it('a watched video grants one extra life exactly once, even when the network reports it twice, and uses it here', async () => {
    const show = await withVideos(async (_p, onEarned) => {
      onEarned?.();
      onEarned?.();
      return true;
    });
    start(5);
    const s = app.active!.session;
    const before = lifeBalance();
    const sheet = loseBoard();
    expect(sheet.querySelector('[data-act="life"]')).toBeNull();
    (sheet.querySelector('[data-act="revive"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(s.outcome).toBe('playing'));
    expect(show).toHaveBeenCalledTimes(1);
    expect(lifeGrants()).toHaveLength(1);
    // Granted and used: the pantry is where it was, the board has its heart.
    expect(lifeBalance()).toBe(before);
    expect(s.hearts).toBe(1);
  });

  it('a second tap while the video plays starts nothing; a reward earned before an interrupted close is kept', async () => {
    let finish: (v: boolean) => void = () => {};
    const show = await withVideos(
      (_p, onEarned) =>
        new Promise<boolean>((res) => {
          // The network reports the reward; the close never comes back (the app was interrupted).
          onEarned?.();
          finish = res;
        }),
    );
    start(5);
    const sheet = loseBoard();
    const btn = sheet.querySelector('[data-act="revive"]') as HTMLButtonElement;
    btn.click();
    btn.click();
    await Promise.resolve();
    expect(show).toHaveBeenCalledTimes(1);
    // Already the player's, and saved, before the video closes.
    expect(lifeGrants()).toHaveLength(1);
    const saved = JSON.parse(localStorage.getItem(Object.keys(localStorage).find((k) => /save/i.test(k)) ?? '') ?? 'null');
    if (saved) expect(JSON.stringify(saved)).toMatch(/ad:life:/);
    // The screen goes meanwhile (the app moved on); when the close finally comes, nothing is granted again and the
    // life waits in the pantry.
    app.router.go({ screen: 'journey' });
    finish(true);
    await new Promise((r) => setTimeout(r, 0));
    expect(lifeGrants()).toHaveLength(1);
    expect(lifeBalance()).toBeGreaterThanOrEqual(1);
  });

  it('a video that was not finished grants nothing, and the sheet stays', async () => {
    await withVideos(async () => false);
    start(5);
    const sheet = loseBoard();
    (sheet.querySelector('[data-act="revive"]') as HTMLButtonElement).click();
    await new Promise((r) => setTimeout(r, 0));
    expect(lifeGrants()).toHaveLength(0);
    expect(app.active!.session.outcome).toBe('lost');
    expect(document.querySelector('.sheet [data-act="restart"]')).not.toBeNull();
  });

  it('try again is free: a fresh board with full hearts, and no setting is switched on for the player (no Auto-X)', () => {
    const before = { ...app.settings };
    start(5);
    loseBoard();
    (document.querySelector('.sheet [data-act="restart"]') as HTMLButtonElement).click();
    const s = app.active!.session;
    expect(s.outcome).toBe('playing');
    expect(s.hearts).toBe(s.maxHearts);
    expect(app.settings.autoMark).toBe(before.autoMark);
    expect(app.settings.controls).toBe(before.controls);
  });

  it('Paw Cup: no extra lives, no videos, no retry; only the way back', async () => {
    await withVideos(async () => true);
    setPantry(app.save, 'life', 3);
    app.save.journey.nextLevel = 60;
    startGame({ kind: 'cup', weekKey: '2026-W44', index: 0 });
    const s = app.active!.session;
    for (let i = 0; i < s.maxHearts; i++) {
      const [r, c] = find((r, c) => s.puzzle.solution[r][c] === EMPTY);
      dblTap(r, c);
    }
    const sheet = document.querySelector('.sheet')!;
    expect([...sheet.querySelectorAll<HTMLElement>('[data-act]')].map((b) => b.dataset.act)).toEqual(['leave']);
    expect(sheet.textContent).not.toMatch(/video|extra life/i);
  });
});

describe('reward videos are granted once per video (D47 PR 4)', () => {
  it('the same video reported twice grants once and counts once toward the day', async () => {
    const { recordVideoReward } = await import('../../src/app/rewarded');
    const now = new Date(2026, 10, 10, 12);
    expect(recordVideoReward(app.save, 'life', now, 'v1')).toBe(true);
    expect(recordVideoReward(app.save, 'life', now, 'v1')).toBe(false);
    expect(app.save.ads.rewarded).toBe(1);
    expect(recordVideoReward(app.save, 'life', now, 'v2')).toBe(true);
    expect(app.save.ads.rewarded).toBe(2);
  });
});
