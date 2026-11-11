// @vitest-environment happy-dom
/**
 * D49 PR E, opt-in measurement: a visit to a home is counted and saved with the visit itself (closing the app right
 * after keeps it), and the player's first meal is recorded once, with how many visits it took, whether it was one
 * animal's dinner or a feast for the whole home.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave, loadSave } from '../../src/services/storage';
import { grantItem } from '../../src/meta/items';
import { addSink, setAnalyticsEnabled, type AnalyticsSink } from '../../src/services/analytics';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mountApp(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary', 'shop'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen });
  app.router = router;
  return router;
}

let events: Array<{ name: string; props: Record<string, unknown> }> = [];
let off: () => void = () => {};

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, decorTipSeen: true, sceneTapTipSeen: true });
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  app.replaceSave(s);
  app.settings.toys3d = false;
  events = [];
  setAnalyticsEnabled(true);
  const sink: AnalyticsSink = { send: (name, props) => void events.push({ name, props }) };
  off = addSink(sink);
});
afterEach(() => {
  off();
  setAnalyticsEnabled(false);
  vi.useRealTimers();
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
});

describe('D49 PR E measurement', () => {
  it('a home visit is counted and already saved when the scene opens', () => {
    mountApp().go({ screen: 'region', id: 'farm' });
    expect(app.save.usage?.homeVisits).toBe(1);
    // What a fresh launch would read back, with nothing else saved since.
    expect(loadSave().save.usage?.homeVisits).toBe(1);
  });

  it('a feast as the very first meal records first_meal once, with the visits it took', () => {
    grantItem(app.save, 'test:feast', 'food', 2, 'gift', NOW, 'Feast', 'festivalfeast');
    const router = mountApp();
    router.go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="cotton"]') as HTMLElement).click();
    (document.querySelector('.friend-panel [data-feed="festivalfeast"]') as HTMLElement).click();
    const firsts = events.filter((e) => e.name === 'first_meal');
    expect(firsts).toEqual([{ name: 'first_meal', props: { from: 'card', visits: 1 } }]);
    vi.advanceTimersByTime(8000);
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    // The next feast is just a meal.
    router.go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="truffle"]') as HTMLElement)?.click();
    (document.querySelector('.friend-panel [data-feed="festivalfeast"]') as HTMLElement)?.click();
    expect(events.filter((e) => e.name === 'first_meal')).toHaveLength(1);
  });
});
