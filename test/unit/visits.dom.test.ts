// @vitest-environment happy-dom
/**
 * Sanctuary visits worth making (D40 PR D): the first-visit cue names an animal and rings it, a tap near a small
 * animal still reaches it, the tapped animal is ringed and named for a moment, and a stage that just appeared glows
 * and says what changed.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { MIN_TARGET, nearestFigure, SELECT_MS } from '../../src/ui/components/selection';
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
const fig = (id: string) => document.querySelector<HTMLElement>(`.sanctuary__scene [data-friend="${id}"]`)!;

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 1, 12));
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 1, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, decorTipSeen: true });
  app.save.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
});
afterEach(() => vi.useRealTimers());

describe('finding an animal (D40 PR D)', () => {
  it('a tap near a small animal reaches it; the padded target is at least 44 units; the nearest one wins', () => {
    const mouse = { gx: 100, gy: 200, gh: 14 };
    // The art is 14 units tall, the target 44: a tap 20 units off to the side still counts.
    expect(nearestFigure([mouse], 120, 193)).toBe(0);
    expect(nearestFigure([mouse], 100 + MIN_TARGET / 2 + 2, 193)).toBe(-1);
    const cow = { gx: 150, gy: 200, gh: 60 };
    expect(nearestFigure([mouse, cow], 128, 190)).toBe(1);
    expect(nearestFigure([mouse, cow], 112, 195)).toBe(0);
  });

  it('the first visit names an animal to tap and rings it; tapping it says hello, and the cue and ring are done', () => {
    mount().go({ screen: 'region', id: 'farm' });
    const cue = document.querySelector('[data-scene-cue="tap"]')!;
    expect(cue.textContent).toMatch(/^Tap (Cotton|Truffle) to say hello\.$/);
    const name = /Tap (\w+)/.exec(cue.textContent!)![1].toLowerCase();
    expect(document.querySelector('.sanctuary__scene .sp-cue-ring')).not.toBeNull();
    expect(fig(name).classList.contains('is-cued')).toBe(true);
    fig(name).querySelector('path, ellipse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('[data-scene-cue]')).toBeNull();
    expect(document.querySelector('.sp-cue-ring')).toBeNull();
    expect(app.save.onboarding.sceneTapTipSeen).toBe(true);
    // The reaction: its hello counted, and it is ringed and named for a moment.
    expect(app.save.sanctuary.affection[name]).toBe(1);
    expect(document.querySelector('.sanctuary__scene .sp-select')).not.toBeNull();
    expect(document.querySelector('[data-scene-tag]')?.textContent).toMatch(/^(Cotton · Sleepy|Truffle · Playful)$/);
    vi.advanceTimersByTime(SELECT_MS + 10);
    expect(document.querySelector('.sp-select, [data-scene-tag]')).toBeNull();
  });

  it('a newcomer is the one the cue names', () => {
    mount().go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    expect(document.querySelector('[data-scene-cue="tap"]')?.textContent).toBe('Tap Truffle to say hello.');
  });

  it('tapping another animal moves the ring and the tag', () => {
    app.save.onboarding.sceneTapTipSeen = true;
    mount().go({ screen: 'region', id: 'farm' });
    fig('cotton').querySelector('path, ellipse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    fig('truffle').querySelector('path, ellipse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelectorAll('.sp-select')).toHaveLength(1);
    expect(document.querySelectorAll('[data-scene-tag]')).toHaveLength(1);
    expect(fig('truffle').classList.contains('is-selected')).toBe(true);
    expect(fig('cotton').classList.contains('is-selected')).toBe(false);
  });
});

describe('every growth milestone is visible (D40 PR D)', () => {
  it('a stage reached by the solve glows for a moment and a line says what changed', () => {
    app.save.world.growth.farm = 8; // the barn
    app.save.onboarding.sceneTapTipSeen = true;
    mount().go({ screen: 'region', id: 'farm', fresh: 2 });
    const news = document.querySelector('[data-stage-news]')!;
    expect(news.textContent).toMatch(/New at the Farm: Barn raising/);
    expect(news.textContent).toMatch(/A red barn goes up beside the pasture/);
    const fresh = document.querySelectorAll('.sanctuary__scene .sp-stage[data-stage="2"].is-fresh');
    expect(fresh.length).toBeGreaterThan(0);
    vi.advanceTimersByTime(2700);
    expect(document.querySelector('.sp-stage.is-fresh')).toBeNull();
  });

  it('a stage reached while the player was elsewhere is shown the same way on the next visit', () => {
    app.save.world.growth.farm = 8;
    app.save.onboarding.sceneTapTipSeen = true;
    app.save.world.unseen.farm = { animals: [], stage: 2, opened: false, at: '2026-11-01T10:00:00.000Z' };
    mount().go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('[data-stage-news]')?.textContent).toMatch(/Barn raising/);
    // Once seen, an ordinary visit is quiet.
    mount().go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('[data-stage-news]')).toBeNull();
  });
});
