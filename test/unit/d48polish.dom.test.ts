// @vitest-environment happy-dom
/**
 * D48 PR A, UX and haptic polish: a fast swipe marks every tile it passes (none skipped), the drag's haptic ticks are
 * spaced (never a buzz) and silent, postcards keep every animal inside the card's own shape with room to spare, and
 * the first board meets its two moves one at a time (tap for ✕, then double-tap to place).
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const hapticCalls: string[] = [];
vi.mock('../../src/services/haptics', async (orig) => {
  const real = await orig<typeof import('../../src/services/haptics')>();
  return { ...real, haptic: (k: string) => hapticCalls.push(k) };
});
const sfxCalls: string[] = [];
vi.mock('../../src/services/audio', async (orig) => {
  const real = await orig<typeof import('../../src/services/audio')>();
  return { ...real, sfx: (k: string) => sfxCalls.push(k) };
});

import { cellsBetween } from '../../src/ui/components/board';
import { DRAG_TICK_MS, feel, resetDragTick } from '../../src/services/feel';
import { figureBox, focusIn, groupFrame, SAFE_MARGIN } from '../../src/ui/components/photoFrames';
import { postcardLayout } from '../../src/ui/components/postcard';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { startGame } from '../../src/app/gameFlow';
import { EMPTY } from '../../src/engine/types';
import { MARK } from '../../src/game/session';
import { defaultSave } from '../../src/services/storage';

describe('a fast swipe never skips a tile', () => {
  it('walks every tile between two tiles, one step at a time, ending on the second', () => {
    expect(cellsBetween([0, 0], [0, 4])).toEqual([
      [0, 1],
      [0, 2],
      [0, 3],
      [0, 4],
    ]);
    expect(cellsBetween([3, 2], [0, 2])).toEqual([
      [2, 2],
      [1, 2],
      [0, 2],
    ]);
    expect(cellsBetween([2, 2], [2, 2])).toEqual([]);
    for (const [a, b] of [
      [
        [0, 0],
        [3, 5],
      ],
      [
        [6, 1],
        [0, 4],
      ],
      [
        [4, 4],
        [0, 0],
      ],
    ] as Array<[[number, number], [number, number]]>) {
      const path = cellsBetween(a, b);
      expect(path[path.length - 1]).toEqual(b);
      // Every step moves to a tile beside the last one (never through a corner gap, never jumping).
      let prev = a;
      for (const p of path) {
        expect(Math.abs(p[0] - prev[0]) + Math.abs(p[1] - prev[1])).toBe(1);
        prev = p;
      }
      expect(path).toHaveLength(Math.abs(b[0] - a[0]) + Math.abs(b[1] - a[1]));
    }
  });
});

describe('drag haptics: restrained ticks', () => {
  let t = 0;
  beforeEach(() => {
    hapticCalls.length = 0;
    sfxCalls.length = 0;
    resetDragTick();
    t = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
  });
  afterEach(() => vi.restoreAllMocks());

  it(`ticks once per changed tile, never closer than ${DRAG_TICK_MS} ms, with no sound`, () => {
    // Three tiles changed in one frame (a fast swipe): one tick.
    feel('drag');
    feel('drag');
    feel('drag');
    expect(hapticCalls).toEqual(['select']);
    t += DRAG_TICK_MS - 1;
    feel('drag');
    expect(hapticCalls).toHaveLength(1);
    t += 2;
    feel('drag');
    expect(hapticCalls).toHaveLength(2);
    expect(sfxCalls).toEqual([]);
  });

  it('only the drag is spaced: marks and placements always answer', () => {
    feel('drag');
    feel('mark');
    feel('place');
    expect(hapticCalls).toEqual(['select', 'light', 'medium']);
  });
});

describe('postcards keep every animal on the card (safe framing)', () => {
  const full = { x: 0, y: 0, w: 360, h: 300 };
  /** The postcard window's share of a 360 × 300 scene. */
  const shapeOf = (o: 'landscape' | 'portrait') => {
    const L = postcardLayout(o, 360, 300, true);
    return { w: L.crop.w / 360, h: L.crop.h / 300 };
  };
  /** Whether a figure sits wholly inside the card's window, with the margin, once the crop follows the focus. */
  function onCard(o: 'landscape' | 'portrait', view: { x: number; y: number; w: number; h: number }, figs: Array<{ x: number; y: number; h: number }>, margin = 0.05) {
    const L = postcardLayout(o, view.w, view.h, true, focusIn(view, figs));
    return figs.every((f) => {
      const b = figureBox(f);
      const x0 = (b.x0 - view.x - L.crop.x) / L.crop.w;
      const x1 = (b.x1 - view.x - L.crop.x) / L.crop.w;
      const y0 = (b.y0 - view.y - L.crop.y) / L.crop.h;
      const y1 = (b.y1 - view.y - L.crop.y) / L.crop.h;
      return x0 >= margin && x1 <= 1 - margin && y0 >= margin && y1 <= 1 - margin;
    });
  }

  for (const o of ['landscape', 'portrait'] as const) {
    it(`${o}: "Everyone" fits a group, a tall animal included, inside the card with ${Math.round(SAFE_MARGIN * 100)}% to spare`, () => {
      const figs = [
        { x: 150, y: 250, h: 30 },
        { x: 205, y: 262, h: 54 }, // a horse: tall
        { x: 240, y: 244, h: 24 },
      ];
      const v = groupFrame(full, figs, shapeOf(o));
      expect(v.w).toBeLessThan(full.w);
      expect(onCard(o, v, figs, SAFE_MARGIN * 0.8)).toBe(true);
    });

    it(`${o}: one animal close stays whole, ears to feet, even a tall one by the scene's edge`, () => {
      for (const f of [
        { x: 180, y: 240, h: 30 },
        // A tall horse in the far corner, and a small one up at the left edge: the view widens until they fit.
        { x: 300, y: 272, h: 56 },
        { x: 46, y: 130, h: 40 },
      ]) {
        const v = groupFrame(full, [f], shapeOf(o), 2.3);
        expect(onCard(o, v, [f])).toBe(true);
      }
    });
  }

  it('the whole home leans its crop toward the animals: a group low in the scene isn’t cut off at the bottom', () => {
    const figs = [
      { x: 60, y: 292, h: 30 },
      { x: 300, y: 290, h: 30 },
    ];
    // A centred crop of a 3:2 card from a 360 × 300 scene drops 30 units off the bottom: feet and all.
    const centred = postcardLayout('landscape', 360, 300, true);
    expect(centred.crop.y + centred.crop.h).toBeLessThan(292);
    const L = postcardLayout('landscape', 360, 300, true, focusIn(full, figs));
    expect(L.crop.y + L.crop.h).toBeGreaterThanOrEqual(292);
  });
});

// ------------------------------------------------------------------ the first board's two moves

const blank = { tab: null, title: 'x', mount: () => {} };
function mountRouter(): void {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
}
const cell = (r: number, c: number) => document.querySelector<HTMLButtonElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
const coach = () => document.querySelector('[data-coach]')?.textContent ?? '';
let nowMs = 1_000;
function tap(r: number, c: number, gapMs = 1_000): void {
  nowMs += gapMs;
  const el = cell(r, c);
  document.elementFromPoint = () => el;
  el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
  el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
}

describe('the first board: tap for ✕, then double-tap to place', () => {
  beforeEach(() => {
    localStorage.clear();
    app.replaceSave(defaultSave(new Date(2026, 10, 10, 12)));
    app.active = null;
    nowMs = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => nowMs);
    mountRouter();
  });
  afterEach(() => {
    app.active = null;
    vi.restoreAllMocks();
  });

  it('starts with one move (tap any tile for ✕) and no glowing tile; the ✕ brings the second move', () => {
    app.settings.controls = 'tap';
    startGame({ kind: 'level', level: 1 });
    expect(coach()).toMatch(/tap any tile once/i);
    expect(document.querySelector('.cell.is-guide')).toBeNull();
    const s = app.active!.session;
    let spot: [number, number] | null = null;
    for (let r = 0; r < s.size && !spot; r++) for (let c = 0; c < s.size && !spot; c++) if (s.puzzle.solution[r][c] === EMPTY && !s.givenMask[r][c]) spot = [r, c];
    tap(spot![0], spot![1]);
    expect(s.cells[spot![0]][spot![1]]).toBe(MARK);
    expect(document.querySelector('.cell.is-guide')).not.toBeNull();
    expect(coach()).toMatch(/double-tap it/i);
  });

  it('two-step tap has no timing to learn: it starts on the first placement, as before', () => {
    app.settings.controls = 'classic';
    startGame({ kind: 'level', level: 1 });
    expect(document.querySelector('.cell.is-guide')).not.toBeNull();
    expect(coach()).not.toMatch(/tap any tile once/i);
  });
});
