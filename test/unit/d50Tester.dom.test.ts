// @vitest-environment happy-dom
/**
 * D50 follow-up: the tester's **Say hello again** opens a calm Farm (its news counted as seen) where someone says
 * hello, and with nobody home says so. In a file of its own: the scene modules keep a little state for an app run (a
 * welcome still owed, the last hello), and this check needs a fresh run.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { showSettings } from '../../src/ui/screens/settings';
import { defaultSave } from '../../src/services/storage';
import { forgetGreetings, GREET_AFTER_MS } from '../../src/ui/components/animalMoments';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'sanctuary', 'game', 'shop'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen });
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
  s.world.growth.farm = 6;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-01T11:00:00.000Z' };
  app.replaceSave(s);
  app.settings.toys3d = false;
  app.settings.reducedMotion = 'full';
  forgetGreetings();
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
});

describe('tester shortcut: Say hello again', () => {
  it('opens a calm Farm (its news counted as seen) where someone says hello; with nobody home it says so', async () => {
    const router = mount();
    // Someone came home while the player was away: that visit would be the newcomer's own hello.
    app.save.world.unseen = { farm: { animals: ['truffle'] } } as never;
    router.go({ screen: 'journey' });
    showSettings(new Scope());
    (document.querySelector('[data-qa="greet"]') as HTMLElement).click();
    expect(router.route).toMatchObject({ screen: 'region', id: 'farm' });
    expect(app.save.world.unseen?.farm).toBeUndefined();
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 300);
    expect(document.querySelector('.sanctuary__chat.is-greeting')).not.toBeNull();
    // Nobody home: a word instead of an empty Farm.
    app.replaceSave(defaultSave(NOW));
    router.go({ screen: 'journey' });
    showSettings(new Scope());
    (document.querySelector('[data-qa="greet"]') as HTMLElement).click();
    expect(router.route).toMatchObject({ screen: 'journey' });
    expect(document.querySelector('.toast')?.textContent).toMatch(/Nobody is home on the Farm yet/);
  });
});

describe('a tap in the first seconds is the player’s own start', () => {
  it('tapping the barn before the hello: the barn’s moment keeps its line, and no hello lands on top of it', async () => {
    app.save.world.growth.farm = 9; // the barn is up
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(800);
    const barn = document.querySelector('.sanctuary__scene [data-landmark]')!;
    expect(barn).not.toBeNull();
    barn.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    const line = document.querySelector('[data-chat] span')?.textContent ?? '';
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(document.querySelector('.sanctuary__chat.is-greeting')).toBeNull();
    expect(document.querySelector('[data-chat] span')?.textContent).not.toMatch(/say hello|says hi|bounds over|blinks a slow hello/);
    expect(line.length).toBeGreaterThan(0);
  });

  it('without a tap, the same calm visit gets its hello', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 300);
    expect(document.querySelector('.sanctuary__chat.is-greeting')).not.toBeNull();
  });
});

describe('the player’s pick wins over the hello', () => {
  it('a decoration tapped while the hello plays: the hello ends and an animal goes to use it', async () => {
    app.save.inventory.decor.tractor = { ownedAt: NOW.toISOString() };
    app.save.inventory.companions = { cotton: { unlockedAt: '2026-10-01T11:00:00.000Z' } };
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 300);
    // Cotton, the only one home, is saying hello…
    expect(document.querySelector('.sanctuary__scene [data-friend="cotton"][data-trick]')).not.toBeNull();
    // …and the tractor is tapped: she goes for a ride.
    document.querySelector('.sanctuary__scene [data-decor="tractor"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(300);
    expect(document.querySelector('.sanctuary__scene .sanctuary__pet.is-away')).not.toBeNull();
    expect(document.querySelector('[data-chat] span')?.textContent).toMatch(/tractor/);
  });
});
