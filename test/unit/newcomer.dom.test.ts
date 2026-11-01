// @vitest-environment happy-dom
/**
 * Meeting the newcomer (D39 PR A): a win's *Meet* (or the "New" marker) opens the sanctuary with the animal who just
 * came home easy to find: a soft ring under its figure for a moment, and *New* on its card for the whole visit.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { SPOTLIGHT_MS } from '../../src/ui/components/newcomer';
import { defaultSave } from '../../src/services/storage';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, sanctuary: sanctuaryScreen });
  app.router = router;
  return router;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.settings.reducedMotion = 'reduce';
  app.save.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
});

describe('the newcomer is easy to find (D39)', () => {
  it('Meet opens the Farm with Truffle ringed in the scene and marked New in the Animals row', () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    const ring = document.querySelector('.sanctuary__scene .sp-spotlight[data-for="truffle"]');
    expect(ring).not.toBeNull();
    // It is not inside the figure's group, which the 3D toys hide (D34): it sits just before it, so it stays visible.
    expect(ring!.closest('.sanctuary__pet')).toBeNull();
    expect(ring!.nextElementSibling?.getAttribute('data-friend')).toBe('truffle');
    const card = document.querySelector<HTMLElement>('.resident.is-new');
    expect(card?.dataset.friendCard).toBe('truffle');
    expect(card?.textContent).toContain('New');
    expect(card?.getAttribute('aria-label')).toMatch(/just came home/);
    // Cotton was already home: no chip.
    expect(document.querySelector('[data-friend-card="cotton"]')!.classList.contains('is-new')).toBe(false);
    // The ring is a moment; the chip stays for the visit.
    vi.advanceTimersByTime(SPOTLIGHT_MS + 10);
    expect(document.querySelector('.sp-spotlight')).toBeNull();
    expect(document.querySelector('.resident.is-new')).not.toBeNull();
  });

  it('the "New" marker does the same when the player comes by later', () => {
    app.save.world.unseen.farm = { animals: ['truffle'], stage: null, opened: false, at: '2026-10-31T11:00:00.000Z' };
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    expect(document.querySelector<HTMLElement>('.resident.is-new')?.dataset.friendCard).toBe('truffle');
    expect(document.querySelector('.sp-spotlight[data-for="truffle"]')).not.toBeNull();
  });

  it('an ordinary visit marks nobody', () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('.resident.is-new')).toBeNull();
    expect(document.querySelector('.sp-spotlight')).toBeNull();
  });

  it('the Pet Garden rings its newcomer once the "came home" card is closed', () => {
    app.save.world.growth.harmony = 1;
    app.save.inventory.companions.juniper = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    const router = mount();
    router.go({ screen: 'sanctuary', welcome: ['juniper'] });
    expect(document.querySelector<HTMLElement>('.resident.is-new')?.dataset.friendCard).toBe('juniper');
    expect(document.querySelector('.sp-spotlight')).toBeNull();
    (document.querySelector('.intro-sheet [data-act="ok"]') as HTMLButtonElement).click();
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.sanctuary__scene .sp-spotlight[data-for="juniper"]')).not.toBeNull();
  });
});

describe('the arrival ends with the next goal (D40 PR C)', () => {
  it('after Meet, once the newcomer has said hello, a card says what the next puzzles bring closer', () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    // Reduced motion (set above): it comes at once; with motion, after the hello.
    vi.advanceTimersByTime(10);
    const goal = document.querySelector('[data-next-goal]')!;
    expect(goal).not.toBeNull();
    expect(goal.textContent).toMatch(/Next goal/);
    expect(goal.textContent).toMatch(/Buttercup the calf comes home in \d+ more puzzles/);
    expect(goal.querySelector('[data-act="play"]')?.textContent).toMatch(/Play level \d+/);
    // An ordinary visit has none.
    router.go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('[data-next-goal]')).toBeNull();
  });

  it('with every animal home, the goal is the next stage, else the next home', async () => {
    const { nextGoal } = await import('../../src/meta/world');
    for (const id of ['buttercup', 'pepper', 'marigold']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    app.save.world.growth.farm = 20;
    const g = nextGoal(app.save, 'farm')!;
    expect(['animal', 'stage', 'home']).toContain(g.kind);
    app.save.inventory.companions.hazel = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    app.save.world.growth.farm = 26;
    // The Farm is finished: the goal moves to the home being built now (the Pet Garden).
    expect(nextGoal(app.save, 'farm')?.where).toBe('harmony');
  });

  it('the Pet Garden shows it too, once its "came home" card is closed', () => {
    app.save.world.growth.harmony = 1;
    app.save.inventory.companions.juniper = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    const router = mount();
    router.go({ screen: 'sanctuary', welcome: ['juniper'] });
    expect(document.querySelector('[data-next-goal]')).toBeNull();
    (document.querySelector('.intro-sheet [data-act="ok"]') as HTMLButtonElement).click();
    vi.advanceTimersByTime(50);
    expect(document.querySelector('[data-next-goal]')?.textContent).toMatch(/Next goal/);
  });
});
