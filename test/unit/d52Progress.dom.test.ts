// @vitest-environment happy-dom
/**
 * D52 PR A: one sentence for how far the next animal is. The win says "Hazel the pony comes home in 6 more puzzles."
 * (her kind the first time), then "Hazel comes home in 4 more puzzles.", then "One more puzzle and Hazel is home!", and
 * her arrival is the arrival's own moment ("Hazel is home!"), never "0 puzzles". No before → after step and no "one
 * puzzle closer" beside a countdown; a replay counts *new* puzzles and never shows a +1. The Journey and the World say
 * the same "comes home". A one-time note says which puzzles grow a home. A screen reader reads the sentence once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { journeyScreen } from '../../src/ui/screens/journey';
import { worldScreen } from '../../src/ui/screens/world';
import { startGame } from '../../src/app/gameFlow';
import { CAT, EMPTY } from '../../src/engine/types';
import { comesHome, stageCountdown, GROWTH_NOTE } from '../../src/ui/components/comesHome';
import { defaultSave, normalizeSave } from '../../src/services/storage';

const blank = { tab: null, title: 'x', mount: () => {} };
function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen, journey: journeyScreen, world: worldScreen } as never);
  app.router = router;
  return router;
}

let nowMs = 1_000;
function dblTap(r: number, c: number): void {
  for (const gap of [1_000, 60]) {
    nowMs += gap;
    const el = document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
    document.elementFromPoint = () => el;
    el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 }));
    el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: 10, clientY: 10 }));
  }
}
function solveBoard(): void {
  const s = app.active!.session;
  for (let r = 0; r < s.size; r++)
    for (let c = 0; c < s.size; c++) {
      const want = s.puzzle.solution[r][c];
      if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
      document.querySelector<HTMLElement>(`[data-tool="${want === CAT ? 'cat' : 'dog'}"]`)?.click();
      dblTap(r, c);
      if (s.outcome === 'won') break;
    }
  vi.advanceTimersByTime(700);
  if (!document.querySelector('.win-sheet, .arrival, .spotlight')) vi.advanceTimersByTime(600);
  const spot = document.querySelector<HTMLElement>('.spotlight');
  if (spot) {
    spot.click();
    vi.advanceTimersByTime(300);
  }
}
const sheet = () => document.querySelector('.win-sheet');
const line = () => sheet()?.querySelector('.win-next-friend .win-comes-home')?.textContent ?? '';
const leave = () => sheet()?.querySelector<HTMLElement>('[data-act="next"]')?.click();

/** Every Farm animal before Hazel is home; the Farm has grown `g` puzzles. */
function farmAt(g: number): void {
  for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-30T00:00:00.000Z' };
  app.save.world.growth.farm = g;
  app.save.world.active = 'farm';
}

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 11, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, seenLoopCoach: true, loopTipSeen: true, worldTipSeen: true });
  app.save.journey.nextLevel = 30;
  app.active = null;
  app.settings.controls = 'tap';
  nowMs = 1_000;
  vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
  vi.useFakeTimers();
  mountRouter();
});
afterEach(() => {
  app.active = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the sentence (D52 PR A)', () => {
  const hazel = { name: 'Hazel', noun: 'pony' };
  it('says comes home, with the kind the first time, and one more puzzle when the next brings her', () => {
    expect(comesHome(hazel, 6, { full: true }).text).toBe('Hazel the pony comes home in 6 more puzzles.');
    expect(comesHome(hazel, 4).text).toBe('Hazel comes home in 4 more puzzles.');
    expect(comesHome(hazel, 1).text).toBe('One more puzzle and Hazel is home!');
    expect(comesHome(hazel, 1, { full: true }).text).toBe('One more puzzle and Hazel is home!');
    expect(comesHome(hazel, 4, { replay: true }).text).toBe('Hazel comes home in 4 more new puzzles.');
    expect(comesHome(hazel, 1, { replay: true }).text).toBe('Hazel comes home in one more new puzzle.');
    // Never zero, never an arrow.
    expect(comesHome(hazel, 0).text).toBe('One more puzzle and Hazel is home!');
    for (const n of [1, 2, 6]) expect(comesHome(hazel, n).text).not.toMatch(/→|closer|away/);
  });

  it('a stage countdown is one sentence too; the markup escapes and bolds the name', () => {
    expect(stageCountdown('Duck pond', 3)).toBe('3 more puzzles until the next stage: Duck pond.');
    expect(stageCountdown('Thriving', 1)).toBe('One more puzzle until the next stage: Thriving.');
    expect(comesHome({ name: 'A<b>', noun: 'x' }, 3, { full: true }).html).toBe('<b>A&lt;b&gt; the x</b> comes home in 3 more puzzles.');
  });
});

describe('the win sheet counts Hazel down in one sentence', () => {
  it('6 → 4 → 1 → home: right at each step, no arrows, no "one puzzle closer"', () => {
    farmAt(19); // Marigold came home at 19; Hazel arrives at 26
    startGame({ kind: 'level', level: 19 });
    solveBoard();
    expect(sheet()!.querySelector('.win-plus')?.textContent).toBe('Meadow Farm +1');
    expect(line()).toBe('Hazel the pony comes home in 6 more puzzles.');
    expect(sheet()!.querySelector('.win-next-friend')!.textContent).not.toMatch(/→|closer|puzzles away/);
    leave();

    app.save.world.growth.farm = 21;
    startGame({ kind: 'level', level: 20 });
    solveBoard();
    expect(line()).toBe('Hazel comes home in 4 more puzzles.');
    leave();

    app.save.world.growth.farm = 24;
    startGame({ kind: 'level', level: 21 });
    solveBoard();
    expect(line()).toBe('One more puzzle and Hazel is home!');
    leave();

    startGame({ kind: 'level', level: 22 });
    solveBoard();
    expect(sheet()!.querySelector('h2')?.textContent).toBe('Hazel is home!');
    expect(sheet()!.textContent).not.toMatch(/\b0 (more )?puzzles?\b/);
  });

  it('the line fits a single sentence for a screen reader: the bar is a picture of it', () => {
    farmAt(21);
    startGame({ kind: 'level', level: 19 });
    solveBoard();
    const row = sheet()!.querySelector('.win-next-friend')!;
    expect(row.querySelector('[role="progressbar"]')).toBeNull();
    expect(row.querySelector('.progress')?.getAttribute('aria-hidden')).toBe('true');
    expect(row.querySelectorAll('.win-comes-home')).toHaveLength(1);
  });

  it('a replay never reads as progress: no +1, and the count is of new puzzles, with its own explanation', () => {
    farmAt(21);
    app.save.journey.clears.L19 = { firstClearAt: '2026-10-30T00:00:00.000Z', bestSeconds: 99, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    app.save.world.grown.L19 = 'farm';
    startGame({ kind: 'level', level: 19 });
    solveBoard();
    expect(app.save.world.growth.farm).toBe(21);
    expect(sheet()!.querySelector('.win-plus')).toBeNull();
    expect(sheet()!.querySelector('[data-replay-note]')).not.toBeNull();
    expect(line()).toBe('Hazel comes home in 5 more new puzzles.');
  });

  it('a home with no animal left but a stage to reach counts the stage', () => {
    // Everyone home at the Farm; its last stage still to reach.
    farmAt(24);
    app.save.inventory.companions.hazel = { unlockedAt: '2026-10-30T00:00:00.000Z' };
    startGame({ kind: 'level', level: 19 });
    solveBoard();
    expect(sheet()!.querySelector('[data-comes-home]')?.textContent).toMatch(/^One more puzzle until the next stage: Thriving\.$/);
  });

  it('says once which puzzles grow a home', () => {
    farmAt(20);
    startGame({ kind: 'level', level: 19 });
    solveBoard();
    expect(sheet()!.querySelector('[data-growth-note]')?.textContent).toBe(GROWTH_NOTE);
    expect(app.save.onboarding.growthNoteSeen).toBe(true);
    leave();
    startGame({ kind: 'level', level: 20 });
    solveBoard();
    expect(sheet()!.querySelector('[data-growth-note]')).toBeNull();
  });
});

describe('the Journey and the World say the same', () => {
  it('the Journey: "comes home in N more puzzles", then "One more puzzle and … is home!"', () => {
    farmAt(21);
    app.router.go({ screen: 'journey' });
    expect(document.querySelector('.hero__next')?.textContent?.trim()).toBe('Hazel the pony comes home in 5 more puzzles.');
    app.save.world.growth.farm = 25;
    app.router.go({ screen: 'world' });
    app.router.go({ screen: 'journey' });
    expect(document.querySelector('.hero__next')?.textContent).toMatch(/One more puzzle and Hazel is home!/);
  });

  it('the World: the focus card and the status line', () => {
    farmAt(21);
    app.router.go({ screen: 'world' });
    expect(document.querySelector('.world-focus [data-comes-home]')?.textContent).toBe('Hazel the pony comes home in 5 more puzzles.');
    expect(document.querySelector('.world-card[data-go="farm"] .world-card__status')?.textContent).toMatch(/Building here · Hazel comes home in 5 more puzzles$/);
    expect(document.querySelector('.world')!.textContent).not.toMatch(/arrives in|joins in/);
  });
});

describe('saves', () => {
  it('a save from before D52 loads with the note unseen, and keeps it once seen', () => {
    const old = JSON.parse(JSON.stringify(defaultSave(new Date(2026, 10, 1))));
    delete old.onboarding.growthNoteSeen;
    expect(normalizeSave(old).onboarding.growthNoteSeen).toBe(false);
    old.onboarding.growthNoteSeen = true;
    expect(normalizeSave(JSON.parse(JSON.stringify(normalizeSave(old)))).onboarding.growthNoteSeen).toBe(true);
  });
});
