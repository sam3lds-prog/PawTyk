// @vitest-environment happy-dom
/**
 * D45 PR A: the scene director. One moment owns the camera at a time (a parade, a trick's close-up, the tour, the 3D
 * walk); pausing the scene's ambient life is a set of holds, so one moment ending never switches life back on under
 * another; and leaving ends everything together.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSceneDirector } from '../../src/ui/components/sceneDirector';
import { sceneCloseUps } from '../../src/ui/components/closeup';
import { sceneParades } from '../../src/ui/components/parade';
import { sceneTour, TOUR_GLIDE_MS, TOUR_HOLD_MS, tourButtonMarkup } from '../../src/ui/components/tour';
import { viewAt, type SceneCamera, type View } from '../../src/ui/components/camera';
import { TRICK_BY_ID } from '../../src/meta/catalogs/tricks';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { defaultSave } from '../../src/services/storage';

const lifeCalls = vi.hoisted(() => [] as boolean[]);
vi.mock('../../src/ui/components/sceneLife', async (orig) => {
  const m = await orig<typeof import('../../src/ui/components/sceneLife')>();
  return {
    ...m,
    startSceneLife: (...a: Parameters<typeof m.startSceneLife>) => {
      const life = m.startSceneLife(...a);
      return { ...life, setLive: (on: boolean) => (lifeCalls.push(on), life.setLive(on)) };
    },
  };
});

const FULL: View = { x: 0, y: 0, w: 360, h: 300 };
const hide = (on: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  hide(false);
});

describe('the director', () => {
  it('ambient life runs only while nobody holds it: one hold ending leaves the others in place', () => {
    const apply = vi.fn();
    const d = createSceneDirector(apply);
    d.hold('closeup', true);
    expect(apply).toHaveBeenLastCalledWith(false);
    d.hold('tour', true);
    d.hold('closeup', false);
    // The tour still holds the scene.
    expect(d.paused).toBe(true);
    expect(apply).toHaveBeenLastCalledWith(false);
    d.hold('tour', false);
    expect(d.paused).toBe(false);
    expect(apply).toHaveBeenLastCalledWith(true);
  });

  it('holds are not counted: on twice then off once is off, and off without on does nothing', () => {
    const apply = vi.fn();
    const d = createSceneDirector(apply);
    d.hold('parade', false);
    expect(apply).not.toHaveBeenCalled();
    d.hold('parade', true);
    d.hold('parade', true);
    d.hold('parade', false);
    expect(d.paused).toBe(false);
    expect(apply.mock.calls.map((c) => c[0])).toEqual([false, true]);
  });

  it('nothing runs while the app is hidden, whatever the holds; refresh applies it again on return', () => {
    const apply = vi.fn();
    const d = createSceneDirector(apply);
    hide(true);
    d.refresh();
    expect(apply).toHaveBeenLastCalledWith(false);
    d.hold('tour', true);
    hide(false);
    d.refresh();
    expect(apply).toHaveBeenLastCalledWith(false);
    d.hold('tour', false);
    expect(apply).toHaveBeenLastCalledWith(true);
  });

  it('claiming the camera ends every other moment, never the claimant; cancelAll ends them all', () => {
    const d = createSceneDirector(() => {});
    const on = { parade: true, closeup: true, tour: true, walk: true };
    for (const k of ['parade', 'closeup', 'tour', 'walk'] as const) d.register(k, { cancel: () => (on[k] = false), active: () => on[k] });
    d.claim('tour');
    expect(on).toEqual({ parade: false, closeup: false, tour: true, walk: false });
    expect(d.owner).toBe('tour');
    d.cancelAll();
    expect(d.owner).toBeNull();
  });
});

/** The real close-ups, tour and parades, wired through a director the way the sanctuary screens wire them. */
function stage(o: { toysReady?: () => Promise<unknown> } = {}) {
  document.body.innerHTML = `<div id="root"><figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
    <g class="sp-landmark" data-landmark="barn" data-name="the barn"><rect x="266" y="140" width="40" height="42"/></g>
    <g class="sanctuary__pet" data-friend="cotton" data-gx="80" data-gy="230" data-gh="40"></g>
    <g class="sanctuary__pet" data-friend="truffle" data-gx="170" data-gy="240" data-gh="34"></g>
    <g class="sp-party"><circle cx="200" cy="150" r="4"/></g>
  </svg>${tourButtonMarkup(true)}</figure></div>`;
  for (const g of document.querySelectorAll('.sp-landmark, .sp-party'))
    (g as unknown as { getBBox: () => DOMRect }).getBBox = () => ({ x: 190, y: 140, width: 40, height: 40 }) as DOMRect;
  const el = document.getElementById('root')!;
  const svg = el.querySelector('svg')!;
  const log: string[] = [];
  const camera = {
    full: FULL,
    viewOf: (e: Element, zoom: number) => viewAt(FULL, Number((e as SVGGElement).dataset.gx ?? 210), Number((e as SVGGElement).dataset.gy ?? 160), zoom),
    moveTo: vi.fn(async () => (log.push('move'), true)),
    focus: vi.fn(async () => true),
    reset: vi.fn(async () => (log.push('reset'), true)),
    setOffset: vi.fn(),
    clearOffset: vi.fn(),
  } as unknown as SceneCamera;
  const live: boolean[] = [];
  const director = createSceneDirector((on) => live.push(on));
  const scope = new Scope();
  const closeups = sceneCloseUps({ host: () => el.querySelector<HTMLElement>('.sanctuary__scene'), svg: () => svg, camera, reducedMotion: () => false, pause: (on) => director.hold('closeup', on) });
  const tour = sceneTour(scope, { el, camera, reducedMotion: () => false, pause: (on) => director.hold('tour', on), greet: () => {}, openLandmark: () => {}, onStart: () => director.claim('tour') });
  const parades = sceneParades(scope, { el, camera, pause: (on) => director.hold('parade', on), closeTray: () => director.claim('parade'), reducedMotion: () => true, toysReady: o.toysReady });
  director.register('parade', { cancel: () => parades.skip(), active: () => parades.active });
  director.register('closeup', { cancel: () => closeups.cancel(), active: () => closeups.active });
  director.register('tour', { cancel: () => tour.stop(), active: () => tour.active });
  const fig = (id: string) => svg.querySelector<SVGGElement>(`[data-friend="${id}"]`)!;
  const trick = (id: string) => {
    director.claim('closeup');
    closeups.play(fig(id), 'wave');
  };
  return { el, director, closeups, tour, parades, live, log, trick, scope, isLive: () => live[live.length - 1] };
}

describe('moments handing over to each other', () => {
  it('trick, then the tour, then Stop: the scene stays quiet through the tour and comes back to life after', () => {
    const s = stage();
    s.trick('truffle');
    expect(s.director.owner).toBe('closeup');
    expect(s.isLive()).toBe(false);
    // The tour starts mid close-up: the close-up ends, and its ending does not wake the scene under the tour.
    expect(s.tour.start()).toBe(true);
    expect(s.closeups.active).toBe(false);
    expect(s.director.owner).toBe('tour');
    expect(s.isLive()).toBe(false);
    expect(s.live).not.toContain(true);
    // The close-up's own end time passes: still the tour's scene.
    vi.advanceTimersByTime(TRICK_BY_ID.wave.ms + 50);
    expect(s.isLive()).toBe(false);
    expect(s.director.paused).toBe(true);
    s.tour.stop();
    expect(s.director.owner).toBeNull();
    expect(s.director.paused).toBe(false);
    expect(s.isLive()).toBe(true);
    expect(s.el.querySelector('.is-touring, .is-closeup, .tour-caption, .tour-stop')).toBeNull();
  });

  it('a trick during the tour ends the tour; the scene wakes only when the trick is over', () => {
    const s = stage();
    s.tour.start();
    vi.advanceTimersByTime(TOUR_GLIDE_MS + 200);
    s.trick('cotton');
    expect(s.tour.active).toBe(false);
    expect(s.director.owner).toBe('closeup');
    expect(s.isLive()).toBe(false);
    // None of the tour's later stops arrive.
    vi.advanceTimersByTime(TRICK_BY_ID.wave.ms - 100);
    expect(s.el.querySelector('.tour-caption')).toBeNull();
    expect(s.isLive()).toBe(false);
    vi.advanceTimersByTime(200);
    expect(s.director.owner).toBeNull();
    expect(s.isLive()).toBe(true);
  });

  it('a parade takes the scene from the tour, and the tour takes it from a parade, with no wake-up in between', async () => {
    const s = stage();
    s.tour.start();
    const played = s.parades.play();
    expect(s.tour.active).toBe(false);
    expect(s.director.paused).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    await played;
    expect(s.director.paused).toBe(false);
    expect(s.isLive()).toBe(true);

    const again = s.parades.play();
    await vi.advanceTimersByTimeAsync(100);
    const before = s.live.length;
    s.tour.start();
    await vi.advanceTimersByTimeAsync(0);
    await again;
    // The parade ended under the tour: nothing woke.
    expect(s.live.slice(before)).not.toContain(true);
    expect(s.director.owner).toBe('tour');
    s.tour.stop();
    expect(s.isLive()).toBe(true);
  });

  it('a parade replayed before it ends keeps the scene held for the new one', async () => {
    const s = stage();
    const first = s.parades.play();
    await vi.advanceTimersByTimeAsync(100);
    const second = s.parades.play();
    await first;
    await vi.advanceTimersByTimeAsync(0);
    // The first one's ending did not let go of the second one's hold.
    expect(s.director.paused).toBe(s.parades.active);
    await vi.advanceTimersByTimeAsync(60000);
    await second;
    expect(s.director.paused).toBe(false);
  });

  it('rapid switching leaves nothing behind: one owner at a time, and a live scene at the end', () => {
    const s = stage();
    for (let i = 0; i < 6; i++) {
      s.trick(i % 2 ? 'cotton' : 'truffle');
      expect(s.director.owner).toBe('closeup');
      s.tour.start();
      expect(s.director.owner).toBe('tour');
      vi.advanceTimersByTime(137 * (i + 1));
      expect(s.isLive()).toBe(false);
    }
    vi.advanceTimersByTime((TOUR_GLIDE_MS + TOUR_HOLD_MS) * 5);
    expect(s.director.owner).toBeNull();
    expect(s.director.paused).toBe(false);
    expect(s.isLive()).toBe(true);
    expect(s.el.querySelector('.is-touring, .is-closeup, .tour-caption, .tour-stop')).toBeNull();
  });

  it('leaving the app ends the moment and nothing runs unseen; coming back, the scene is live again', () => {
    const s = stage();
    s.tour.start();
    hide(true);
    document.dispatchEvent(new Event('visibilitychange'));
    s.director.refresh();
    expect(s.director.owner).toBeNull();
    expect(s.isLive()).toBe(false);
    hide(false);
    s.director.refresh();
    expect(s.isLive()).toBe(true);
  });

  it('leaving the screen ends everything together', () => {
    const s = stage();
    s.trick('truffle');
    s.director.cancelAll();
    s.scope.dispose();
    expect(s.director.owner).toBeNull();
    expect(s.director.paused).toBe(false);
    const n = s.log.length;
    vi.advanceTimersByTime(30000);
    // No camera move arrives late.
    expect(s.log.length).toBe(n);
  });
});

describe('on the Farm screen', () => {
  const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
  beforeEach(() => {
    localStorage.clear();
    lifeCalls.length = 0;
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    app.save.world.growth.farm = 12;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  });

  it('a trick, then the tour, then Stop: ambient life is off for the whole tour and back on after', async () => {
    const { regionScreen } = await import('../../src/ui/screens/region');
    document.body.innerHTML = '<div id="app"></div>';
    const router = new Router(document.getElementById('app')!);
    const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
    for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
    router.register({ ...reg, region: regionScreen });
    app.router = router;
    router.go({ screen: 'region', id: 'farm' });
    vi.advanceTimersByTime(3000);
    const scene = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    scene.querySelector('.sanctuary__pet')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector<HTMLElement>('.trick-chip[data-trick="wave"]')!.click();
    expect(scene.classList.contains('is-closeup')).toBe(true);
    expect(lifeCalls[lifeCalls.length - 1]).toBe(false);
    const from = lifeCalls.length;
    scene.querySelector<HTMLElement>('[data-act="tour"]')!.click();
    expect(scene.classList.contains('is-touring')).toBe(true);
    expect(scene.classList.contains('is-closeup')).toBe(false);
    vi.advanceTimersByTime(TOUR_GLIDE_MS + TOUR_HOLD_MS);
    // The bug this fixes: the close-up ending used to switch life back on under the tour.
    expect(lifeCalls.slice(from)).not.toContain(true);
    scene.querySelector<HTMLElement>('[data-act="tour-stop"]')!.click();
    expect(scene.classList.contains('is-touring')).toBe(false);
    expect(lifeCalls[lifeCalls.length - 1]).toBe(true);
    // Leaving the screen: nothing left running.
    router.go({ screen: 'journey' });
    vi.advanceTimersByTime(30000);
    expect(document.querySelector('.is-touring, .is-closeup, .tour-caption')).toBeNull();
  });
});

/**
 * D46 PR A: a celebration the screen starts by itself (the Welcome Parade after Meet, a new stage's dance) waits for a
 * lead-in. Whatever the player starts in that window wins: the celebration never starts by itself afterwards and is
 * offered under the scene instead; leaving during the lead-in owes it to the next visit.
 */
describe('pending moments', () => {
  it('any claim before it begins misses it, saying who took the scene; it then never begins', () => {
    const d = createSceneDirector(() => {});
    const missed: unknown[] = [];
    const p = d.pending('parade', (by) => missed.push(by));
    expect(p.waiting).toBe(true);
    expect(d.waiting).toBe(1);
    d.claim('walk');
    expect(missed).toEqual(['walk']);
    expect(p.waiting).toBe(false);
    expect(p.begin()).toBe(false);
    // Missed once, however many claims come after.
    d.claim('tour');
    expect(missed).toEqual(['walk']);
  });

  it('cancelAll (a re-render, leaving) misses it with no one to blame; begin() takes it out of the waiting set', () => {
    const d = createSceneDirector(() => {});
    const missed: unknown[] = [];
    d.pending('parade', (by) => missed.push(by));
    d.cancelAll();
    expect(missed).toEqual([null]);
    const p2 = d.pending('parade', (by) => missed.push(by));
    expect(p2.begin()).toBe(true);
    // Its own claim, once begun, misses nothing.
    d.claim('parade');
    expect(missed).toEqual([null]);
    expect(d.waiting).toBe(0);
  });

  it('drop() gives it up quietly', () => {
    const d = createSceneDirector(() => {});
    const missed = vi.fn();
    const p = d.pending('parade', missed);
    p.drop();
    d.claim('tour');
    expect(missed).not.toHaveBeenCalled();
    expect(p.begin()).toBe(false);
  });
});

describe('a welcome on the Farm screen, and what the player does first (D46 PR A)', () => {
  const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
  let router: Router;
  beforeEach(async () => {
    localStorage.clear();
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, seenLoopCoach: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    app.save.world.growth.farm = 12;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    app.save.settings.celebrations = 'full';
    const { regionScreen } = await import('../../src/ui/screens/region');
    document.body.innerHTML = '<div id="app"></div>';
    router = new Router(document.getElementById('app')!);
    const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
    for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
    router.register({ ...reg, region: regionScreen });
    app.router = router;
  });
  const scene = () => document.querySelector<HTMLElement>('.sanctuary__scene')!;
  const offered = () => {
    const b = document.querySelector<HTMLElement>('[data-act="parade-replay"]');
    return b && !b.hidden ? b.textContent!.trim() : null;
  };
  const parading = () => scene().classList.contains('is-parading');
  /** Past the lead-in (600 ms) and the longest wait for the toys (1.5 s). */
  const pastLeadIn = () => vi.advanceTimersByTimeAsync(2600);

  it('left alone, the parade plays straight from Meet, then the next goal (as before)', async () => {
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await pastLeadIn();
    expect(parading()).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(parading()).toBe(false);
    expect(offered()).toBe('Replay the parade');
    expect(document.querySelector('[data-next-goal]')).not.toBeNull();
  });

  it('the Tour tapped during the lead-in keeps going; the parade never cuts in, and is offered instead', async () => {
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await vi.advanceTimersByTimeAsync(200);
    scene().querySelector<HTMLElement>('[data-act="tour"]')!.click();
    expect(scene().classList.contains('is-touring')).toBe(true);
    await pastLeadIn();
    // The bug: the pending parade used to claim the camera here and stop the tour.
    expect(scene().classList.contains('is-touring')).toBe(true);
    expect(parading()).toBe(false);
    expect(offered()).toBe('Watch Cotton’s welcome');
    // The next goal waits until the scene is free (it never lands mid-tour).
    expect(document.querySelector('[data-next-goal]')).toBeNull();
    scene().querySelector<HTMLElement>('[data-act="tour-stop"]')!.click();
    await vi.advanceTimersByTimeAsync(600);
    expect(document.querySelector('[data-next-goal]')).not.toBeNull();
    // The offered welcome plays in full when the player asks for it, and is a replay after that.
    document.querySelector<HTMLElement>('[data-act="parade-replay"]')!.click();
    await vi.advanceTimersByTimeAsync(100);
    expect(parading()).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(offered()).toBe('Replay the parade');
  });

  it('a trick played during the lead-in keeps its close-up; the parade is offered', async () => {
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await vi.advanceTimersByTimeAsync(150);
    scene().querySelector('.sanctuary__pet')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector<HTMLElement>('.trick-chip[data-trick="wave"]')!.click();
    expect(scene().classList.contains('is-closeup')).toBe(true);
    await vi.advanceTimersByTimeAsync(700);
    expect(parading()).toBe(false);
    expect(offered()).toBe('Watch Cotton’s welcome');
    await vi.advanceTimersByTimeAsync(5000);
    expect(parading()).toBe(false);
  });

  it('leaving during the lead-in plays nothing later; the next visit offers the welcome (and never plays it by itself)', async () => {
    const { missedWelcome } = await import('../../src/ui/components/parade');
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await vi.advanceTimersByTimeAsync(300);
    router.go({ screen: 'journey' });
    await pastLeadIn();
    expect(document.querySelector('.is-parading, .parade-skip')).toBeNull();
    expect(missedWelcome('farm')).toBe('cotton');
    // Straight back (the route was settled, so this is a plain visit).
    router.go({ screen: 'region', id: 'farm' });
    await pastLeadIn();
    expect(parading()).toBe(false);
    expect(offered()).toBe('Watch Cotton’s welcome');
    document.querySelector<HTMLElement>('[data-act="parade-replay"]')!.click();
    await vi.advanceTimersByTimeAsync(100);
    expect(parading()).toBe(true);
    // Seen: nothing is owed any more.
    expect(missedWelcome('farm')).toBeUndefined();
    router.go({ screen: 'journey' });
  });

  it('the app hidden during the lead-in: it doesn’t play unseen, and is offered on return', async () => {
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await vi.advanceTimersByTimeAsync(200);
    hide(true);
    document.dispatchEvent(new Event('visibilitychange'));
    await pastLeadIn();
    hide(false);
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(300);
    expect(parading()).toBe(false);
    expect(offered()).toBe('Watch Cotton’s welcome');
    router.go({ screen: 'journey' });
  });

  it('an owed welcome waits for a new stage’s dance on the same visit, then is offered (review: they shared one button)', async () => {
    const { missedWelcome } = await import('../../src/ui/components/parade');
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
    await vi.advanceTimersByTimeAsync(200);
    router.go({ screen: 'journey' });
    expect(missedWelcome('farm')).toBe('cotton');
    // Back, straight to a stage that just appeared: the group dance plays first, the welcome is offered after it.
    router.go({ screen: 'region', id: 'farm', fresh: 2 });
    await vi.advanceTimersByTimeAsync(300);
    expect(offered()).toBeNull();
    await vi.advanceTimersByTimeAsync(3000);
    expect(parading()).toBe(true);
    await vi.advanceTimersByTimeAsync(60000);
    expect(offered()).toBe('Watch Cotton’s welcome');
    router.go({ screen: 'journey' });
  });

  it('rapid re-entry while the first visit was still in its lead-in leaves one scene and no stray parade', async () => {
    for (let i = 0; i < 4; i++) {
      router.go({ screen: 'region', id: 'farm', welcome: ['cotton'] });
      await vi.advanceTimersByTimeAsync(120);
      router.go({ screen: 'journey' });
      await vi.advanceTimersByTimeAsync(40);
    }
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(8000);
    expect(document.querySelectorAll('.sanctuary__scene').length).toBe(1);
    expect(parading()).toBe(false);
    expect(document.querySelectorAll('.parade-skip').length).toBe(0);
    expect(offered()).toBe('Watch Cotton’s welcome');
    router.go({ screen: 'journey' });
  });
});

describe('a parade and the toys of the renderer there is now (D46 PR B)', () => {
  it('waits for toys being rebuilt before its first beat, owning the scene meanwhile; then dances', async () => {
    let toys!: (ok: boolean) => void;
    const s = stage({ toysReady: () => new Promise<boolean>((r) => (toys = r)) });
    const played = s.parades.play();
    await vi.advanceTimersByTimeAsync(300);
    // Not dancing yet, but it owns the scene: a tap waits, ambient life is held.
    expect(s.el.querySelector('.is-parading')).toBeNull();
    expect(s.parades.active).toBe(true);
    expect(s.director.owner).toBe('parade');
    expect(s.director.paused).toBe(true);
    toys(true);
    await vi.advanceTimersByTimeAsync(10);
    expect(s.el.querySelector('.is-parading')).not.toBeNull();
    s.parades.skip();
    expect(await played).toBe(true);
    expect(s.director.paused).toBe(false);
  });

  it('never waits long: toys that don’t come in time are left out and everyone dances drawn', async () => {
    const s = stage({ toysReady: () => new Promise<boolean>(() => {}) });
    void s.parades.play();
    await vi.advanceTimersByTimeAsync(1300);
    expect(s.el.querySelector('.is-parading')).not.toBeNull();
    s.parades.skip();
  });

  it('a tour (or Skip) during the wait cancels it: no parade starts later, and the scene isn’t left held', async () => {
    const s = stage({ toysReady: () => new Promise<boolean>(() => {}) });
    const played = s.parades.play();
    await vi.advanceTimersByTimeAsync(200);
    expect(s.tour.start()).toBe(true);
    expect(s.director.owner).toBe('tour');
    expect(await played).toBe(false);
    await vi.advanceTimersByTimeAsync(2000);
    expect(s.el.querySelector('.is-parading')).toBeNull();
    s.tour.stop();
    expect(s.director.paused).toBe(false);
  });
});
