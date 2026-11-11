// @vitest-environment happy-dom
/**
 * D49 PR B, small rewards said at once: a finished line ripples out from the tile just placed (about 0.4 s, overlay
 * only); a win shows its coins, an errand done and (after a Daily) tomorrow's board beside the success; the animal one
 * puzzle away beams; and a new decoration arrives in its home with sparkles and an animal that uses it, once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { Board, RIPPLE_GLOW_MS, RIPPLE_MAX_DELAY_MS, RIPPLE_STEP_MS } from '../../src/ui/components/board';
import { puzzleFor } from '../../src/game/puzzles';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave } from '../../src/services/storage';
import { grant } from '../../src/meta/ledger';
import { arrivalProgress } from '../../src/meta/world';
import { arrivalPortrait, isEager } from '../../src/ui/components/eager';
import { clearReveals, noteReveal, playReveals, revealWaiting, waitingReveals, REVEAL_MS } from '../../src/ui/components/decorReveal';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, sanctuary: sanctuaryScreen, shop: shopScreen });
  app.router = router;
  return router;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  s.journey.nextLevel = 41;
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  grant(s, 'test:coins', 500, 'gift', NOW);
  app.replaceSave(s);
  app.settings.toys3d = false;
  clearReveals();
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
});

describe('a finished line ripples', () => {
  function board(): Board {
    document.body.innerHTML = '';
    const b = new Board(puzzleFor({ kind: 'level', level: 5 }), new Scope(), {} as never, { pannable: false, pet: () => document.createElement('span') } as never);
    document.body.appendChild(b.el);
    return b;
  }
  const delayOf = (r: number, c: number) => document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!.style.getPropertyValue('--ripple-delay');

  it('from the tile just placed outward, a beat per tile, the farthest starting by 150 ms; gone after its glow', () => {
    const b = board();
    const row: Array<[number, number]> = Array.from({ length: b.n }, (_, c) => [2, c]);
    b.ripple(row, [2, 0], false);
    expect(document.querySelectorAll('.cell.is-ripple')).toHaveLength(b.n);
    expect(delayOf(2, 0)).toBe('0ms');
    expect(delayOf(2, 1)).toBe(`${RIPPLE_STEP_MS}ms`);
    expect(delayOf(2, b.n - 1)).toBe(`${Math.min(RIPPLE_MAX_DELAY_MS, (b.n - 1) * RIPPLE_STEP_MS)}ms`);
    // The whole line is done in about 0.4 s.
    expect(RIPPLE_MAX_DELAY_MS + RIPPLE_GLOW_MS).toBeLessThanOrEqual(450);
    vi.advanceTimersByTime(RIPPLE_MAX_DELAY_MS + RIPPLE_GLOW_MS + 50);
    expect(document.querySelectorAll('.cell.is-ripple')).toHaveLength(0);
    expect(delayOf(2, 1)).toBe('');
  });

  it('under reduced motion, every tile at once (no spread)', () => {
    const b = board();
    b.ripple([[0, 0], [0, 1], [0, 2]], [0, 0], true);
    expect([delayOf(0, 0), delayOf(0, 1), delayOf(0, 2)]).toEqual(['0ms', '0ms', '0ms']);
  });

  it('the ring and the ripple are the tiles’ overlay: board.css never moves a tile or an animal for them', async () => {
    const css = (await import('node:fs')).readFileSync('src/ui/styles/board.css', 'utf8');
    const rule = (sel: string) => css.slice(css.indexOf(sel), css.indexOf('}', css.indexOf(sel)));
    expect(rule('.cell.is-ripple::before')).toMatch(/animation: ripple-glow/);
    expect(css).not.toMatch(/\.cell\.is-(ripple|fresh)\s*(>|\.cell__pet|\{)[^}]*transform/);
  });
});

describe('the animal one puzzle away beams', () => {
  it('shy with a few puzzles to go; eager (beaming, a halo, Almost home!) with one', () => {
    expect(isEager(1)).toBe(true);
    expect(isEager(2)).toBe(false);
    expect(arrivalPortrait('truffle' as never, 3, 'x')).toMatch(/class="x is-shy"/);
    const eager = arrivalPortrait('truffle' as never, 1, 'x');
    expect(eager).toMatch(/class="x is-eager"/);
    expect(eager).toMatch(/Almost home!/);
  });

  it('the home’s Coming home row and the Journey say so', () => {
    app.save.inventory.companions.buttercup = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    // Buttercup home; the next (Pepper) one puzzle away.
    let p = arrivalProgress(app.save, 'farm');
    while (p && p.left > 1) {
      app.save.world.growth.farm++;
      p = arrivalProgress(app.save, 'farm');
    }
    expect(p?.left).toBe(1);
    mount().go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('.coming-home .is-eager .eager-tag')?.textContent).toBe('Almost home!');
  });
});

describe('a new decoration arrives', () => {
  it('bought on its card: it says so, offers See it in your Farm, and the Farm plays the arrival once', async () => {
    const router = mount();
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' });
    (document.querySelector('.decor-sheet [data-act="buy"]') as HTMLElement).click();
    const sheet = document.querySelector('.decor-sheet')!;
    expect(sheet.querySelector('.bought-line')?.textContent).toMatch(/It’s yours!/);
    expect(sheet.querySelector('[data-act="visit"]')?.textContent).toMatch(/See it in the Meadow Farm/);
    expect(sheet.querySelectorAll('[data-act="close"]')).toHaveLength(1);
    expect(revealWaiting('farm')).toBe(true);
    (sheet.querySelector('[data-act="visit"]') as HTMLElement).click();
    expect(router.route).toMatchObject({ screen: 'region', id: 'farm' });
    // Once the scene has settled (the toys, or 1.5 s without them), then a beat.
    for (let t = 0; t < 2500 && !document.querySelector('.sp-reveal'); t += 50) await vi.advanceTimersByTimeAsync(50);
    expect(document.querySelector('.sanctuary__scene [data-decor="flowerarch"].is-revealing')).not.toBeNull();
    expect(document.querySelector('.sanctuary__scene .sp-reveal[data-reveal-for="flowerarch"]')).not.toBeNull();
    expect(revealWaiting('farm')).toBe(false);
    await vi.advanceTimersByTimeAsync(REVEAL_MS + 200);
    expect(document.querySelector('.is-revealing, .sp-reveal')).toBeNull();
    // A second visit: nothing replays.
    router.go({ screen: 'shop' });
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(2500);
    expect(document.querySelector('.is-revealing, .sp-reveal')).toBeNull();
  });

  it('a piece not drawn yet (or a busy scene) keeps its arrival for a later visit; it plays once when it is out', () => {
    const host = (svg: SVGSVGElement) => ({ svg: () => svg, reducedMotion: () => true, playActivity: () => true, notice: () => {}, timeout: (fn: () => void, ms: number) => void setTimeout(fn, ms) });
    noteReveal('flowerarch');
    noteReveal('tireswing');
    document.body.innerHTML = '<svg><g data-decor="tireswing"></g></svg>';
    expect(playReveals(host(document.querySelector('svg') as unknown as SVGSVGElement), waitingReveals('farm'))).toEqual(['tireswing']);
    // The arch wasn't out: it is still waiting; the Tire Swing has had its arrival.
    expect(waitingReveals('farm')).toEqual(['flowerarch']);
    document.body.innerHTML = '<svg><g data-decor="tireswing"></g><g data-decor="flowerarch"></g></svg>';
    expect(playReveals(host(document.querySelector('svg') as unknown as SVGSVGElement), waitingReveals('farm'))).toEqual(['flowerarch']);
    expect(revealWaiting('farm')).toBe(false);
  });

  it('under reduced motion: the sparkles only, nobody runs over', () => {
    document.body.innerHTML = '<svg><g data-decor="flowerarch"></g><g class="sanctuary__pet" data-friend="cotton" data-gx="10" data-gy="10"></g></svg>';
    const played: string[] = [];
    const noticed: string[] = [];
    const svg = document.querySelector('svg') as unknown as SVGSVGElement;
    noteReveal('flowerarch');
    const ids = waitingReveals('farm');
    playReveals({ svg: () => svg, reducedMotion: () => true, playActivity: (d) => (played.push(d), true), notice: (f) => noticed.push(f), timeout: (fn, ms) => void setTimeout(fn, ms) }, ids);
    vi.advanceTimersByTime(10);
    expect(document.querySelector('.sp-reveal.is-still')).not.toBeNull();
    vi.advanceTimersByTime(REVEAL_MS + 300);
    expect(played).toEqual([]);
    expect(noticed).toEqual([]);
  });
});
