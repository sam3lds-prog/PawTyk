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
