// @vitest-environment happy-dom
/**
 * D44 PR H: the guided tour. The camera visits the landmark (which opens), every animal left to right (each says
 * hello), the party spot (its lights come on) and comes back to the whole scene; a caption names each stop. Stop,
 * Escape, a tap on the scene or leaving the app end it at once. Reduced motion: cuts, held longer. It grants nothing.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { sceneTour, TOUR_GLIDE_MS, TOUR_HOLD_MS, TOUR_HOLD_STILL_MS, tourButtonMarkup, tourStops } from '../../src/ui/components/tour';
import { viewAt, type SceneCamera, type View } from '../../src/ui/components/camera';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave } from '../../src/services/storage';

const FULL: View = { x: 0, y: 0, w: 360, h: 300 };

function scene(): HTMLElement {
  document.body.innerHTML = `<div id="root"><figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
    <g class="sp-landmark" data-landmark="barn" data-name="the barn"><rect x="266" y="140" width="40" height="42"/></g>
    <g class="sanctuary__pet" data-friend="truffle" data-gx="170" data-gy="240" data-gh="34"></g>
    <g class="sanctuary__pet" data-friend="cotton" data-gx="80" data-gy="230" data-gh="40"></g>
    <g class="sanctuary__pet is-away" data-friend="hazel" data-gx="300" data-gy="236" data-gh="30"></g>
    <g class="sp-party"><circle cx="200" cy="150" r="4"/></g>
  </svg>${tourButtonMarkup(true)}</figure></div>`;
  // happy-dom has no layout: give SVG boxes a size.
  for (const g of document.querySelectorAll('.sp-landmark, .sp-party'))
    (g as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 190, y: 140, width: 40, height: 40 }) as DOMRect;
  return document.getElementById('root')!;
}

function rig(reduced = false) {
  const el = scene();
  const moves: Array<{ v: View; ms: number }> = [];
  const resets: number[] = [];
  const cam = {
    full: FULL,
    viewOf: (e: Element, zoom: number, o: { dy?: number } = {}) => {
      const g = e as SVGGElement;
      const x = g.dataset.gx ? Number(g.dataset.gx) : 210;
      const y = g.dataset.gy ? Number(g.dataset.gy) : 160;
      return viewAt(FULL, x, y + (o.dy ?? 0), zoom);
    },
    moveTo: vi.fn(async (v: View, ms: number) => (moves.push({ v, ms }), true)),
    reset: vi.fn(async (ms: number) => (resets.push(ms), true)),
  } as unknown as SceneCamera;
  const greet = vi.fn();
  const openLandmark = vi.fn();
  const pause = vi.fn();
  const onEnd = vi.fn();
  const scope = new Scope();
  const tour = sceneTour(scope, { el, camera: cam, reducedMotion: () => reduced, pause, greet, openLandmark, onEnd });
  const caption = () => el.querySelector('.tour-caption')?.textContent ?? null;
  return { el, tour, moves, resets, greet, openLandmark, pause, onEnd, caption, scope };
}

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
});

describe('the tour', () => {
  it('visits the landmark, every animal at home left to right, and the party spot', () => {
    const { el } = rig();
    const stops = tourStops(el.querySelector('svg')!);
    expect(stops.map((s) => s.kind)).toEqual(['landmark', 'animal', 'animal', 'party']);
    expect(stops.map((s) => s.name)).toEqual(['The barn', 'Cotton the sheep', 'Truffle the piglet', 'The party lights']);
  });

  it('plays stop by stop: caption, glide, the landmark opens, each animal says hello, lights on, then the whole scene', () => {
    const r = rig();
    r.el.querySelector<HTMLElement>('[data-act="tour"]')!.click();
    expect(r.tour.onClick(r.el.querySelector<HTMLElement>('[data-act="tour"]')!)).toBe(true);
    expect(r.tour.active).toBe(true);
    expect(r.pause).toHaveBeenLastCalledWith(true);
    expect(r.el.querySelector<HTMLElement>('[data-act="tour"]')!.hidden).toBe(true);
    expect(r.el.querySelector('[data-act="tour-stop"]')).not.toBeNull();
    expect(r.caption()).toBe('The barn');
    expect(r.moves[0].ms).toBe(TOUR_GLIDE_MS);
    vi.advanceTimersByTime(TOUR_GLIDE_MS);
    expect(r.openLandmark).toHaveBeenCalledTimes(1);
    const step = TOUR_GLIDE_MS + TOUR_HOLD_MS;
    vi.advanceTimersByTime(step - TOUR_GLIDE_MS);
    expect(r.caption()).toBe('Cotton the sheep');
    vi.advanceTimersByTime(step);
    expect(r.greet.mock.calls.map(([f]) => (f as SVGGElement).dataset.friend)).toEqual(['cotton']);
    expect(r.caption()).toBe('Truffle the piglet');
    vi.advanceTimersByTime(step);
    expect(r.greet).toHaveBeenCalledTimes(2);
    expect(r.caption()).toBe('The party lights');
    vi.advanceTimersByTime(TOUR_GLIDE_MS);
    expect(r.el.querySelector('.sp-party.is-tour-lit')).not.toBeNull();
    vi.advanceTimersByTime(step);
    expect(r.tour.active).toBe(false);
    expect(r.onEnd).toHaveBeenCalledWith('ended');
    expect(r.resets).toEqual([800]);
    expect(r.caption()).toBeNull();
    expect(r.el.querySelector('.sp-party.is-tour-lit, [data-act="tour-stop"]')).toBeNull();
    expect(r.el.querySelector<HTMLElement>('[data-act="tour"]')!.hidden).toBe(false);
    expect(r.pause).toHaveBeenLastCalledWith(false);
  });

  it('Stop, Escape, a tap on the scene and leaving the app each end it at once, back on the whole scene', () => {
    const ends: Array<() => void> = [
      () => void 0,
      () => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })),
      () => 0,
      () => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
      },
    ];
    for (const [i, end] of ends.entries()) {
      const r = rig();
      r.tour.start();
      vi.advanceTimersByTime(1200);
      if (i === 0) expect(r.tour.onClick(r.el.querySelector<HTMLElement>('[data-act="tour-stop"]')!)).toBe(true);
      else if (i === 2) expect(r.tour.onClick(r.el.querySelector<HTMLElement>('[data-friend="cotton"]')!)).toBe(true);
      else end();
      expect(r.tour.active, `way ${i}`).toBe(false);
      expect(r.resets, `way ${i}`).toEqual([350]);
      expect(r.onEnd).toHaveBeenCalledWith('stopped');
      vi.advanceTimersByTime(20000);
      expect(r.greet.mock.calls.length, `way ${i}`).toBeLessThanOrEqual(1);
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
      r.scope.dispose();
    }
  });

  it('reduced motion: cuts from stop to stop, each held longer', () => {
    const r = rig(true);
    r.tour.start();
    expect(r.moves[0].ms).toBe(0);
    vi.advanceTimersByTime(TOUR_HOLD_STILL_MS);
    expect(r.caption()).toBe('Cotton the sheep');
  });

  it('nothing to visit: it does not start', () => {
    document.body.innerHTML = `<div id="r"><figure class="sanctuary__scene"><svg viewBox="0 0 360 300"></svg></figure></div>`;
    const t = sceneTour(new Scope(), {
      el: document.getElementById('r')!,
      camera: {} as SceneCamera,
      reducedMotion: () => false,
      pause: () => {},
      greet: () => {},
      openLandmark: () => {},
    });
    expect(t.start()).toBe(false);
  });
});

describe('the tour on a home', () => {
  const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
  it('the Tour button runs it over the Farm and it grants nothing', () => {
    localStorage.clear();
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    app.save.world.growth.farm = 12;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    document.body.innerHTML = '<div id="app"></div>';
    const router = new Router(document.getElementById('app')!);
    const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
    for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
    router.register({ ...reg, region: regionScreen });
    app.router = router;
    router.go({ screen: 'region', id: 'farm' });
    vi.advanceTimersByTime(3000);
    const before = JSON.stringify(app.save.inventory) + app.coins();
    const btn = document.querySelector<HTMLElement>('.sanctuary__scene [data-act="tour"]')!;
    expect(btn.hidden).toBe(false);
    btn.click();
    expect(document.querySelector('.sanctuary__scene.is-touring')).not.toBeNull();
    expect(document.querySelector('.tour-caption')?.textContent).toBe('The barn');
    vi.advanceTimersByTime(30000);
    expect(document.querySelector('.sanctuary__scene.is-touring, .tour-caption')).toBeNull();
    expect(JSON.stringify(app.save.inventory) + app.coins()).toBe(before);
  });
});
