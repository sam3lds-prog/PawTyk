// @vitest-environment happy-dom
/**
 * Bonding in the scenes and on the cards (D40 PR B): a tapped animal greets in its own way and counts a heart once a
 * day; a new level says what it unlocked; a best friend's portrait goes in the album; the card says what's next.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { petsScreen } from '../../src/ui/screens/pets';
import { defaultSave } from '../../src/services/storage';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, pets: petsScreen });
  app.router = router;
  return router;
}
const fig = (id: string) => document.querySelector<HTMLElement>(`.sanctuary__scene [data-friend="${id}"]`)!;
const tapFig = (id: string) => fig(id).querySelector('path, ellipse, circle')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
const toastText = () => document.querySelector('.toast-host')?.textContent ?? '';

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(2026, 10, 1, 12));
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 1, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.save.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle', 'juniper']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
});
afterEach(() => vi.useRealTimers());

describe('bonding in the scenes (D40 PR B)', () => {
  it('every figure carries its temperament; a tap counts a heart once a day', () => {
    mount().go({ screen: 'region', id: 'farm' });
    expect(fig('truffle').dataset.temper).toBe('playful');
    expect(fig('cotton').dataset.temper).toBe('sleepy');
    tapFig('truffle');
    expect(app.save.sanctuary.affection.truffle).toBe(1);
    vi.advanceTimersByTime(2000);
    tapFig('truffle');
    expect(app.save.sanctuary.affection.truffle).toBe(1);
  });

  it('a hello that makes a friend says what it unlocked, and the figure greets warmer from then on', () => {
    app.save.sanctuary.affection.truffle = 4;
    mount().go({ screen: 'region', id: 'farm' });
    expect(fig('truffle').hasAttribute('data-warm')).toBe(false);
    tapFig('truffle');
    expect(toastText()).toMatch(/Truffle is your friend now! Truffle has a warmer hello for you/);
    expect(fig('truffle').hasAttribute('data-warm')).toBe(true);
    expect(fig('truffle').hasAttribute('data-beam')).toBe(false);
  });

  it('a best friend gets a portrait: a small card says so, and the album shows it', () => {
    app.save.sanctuary.affection.cotton = 34;
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    tapFig('cotton');
    const card = document.querySelector('.bond-sheet');
    expect(card?.textContent).toMatch(/Best friends!/);
    expect(card?.querySelector('.sp-eyes-beam[style="opacity:1"]')).not.toBeNull();
    (card!.querySelector('[data-act="album"]') as HTMLButtonElement).click();
    const portraits = document.querySelector('.album__portraits');
    expect(portraits?.textContent).toMatch(/Cotton/);
    expect(portraits?.textContent).toMatch(/Since /);
  });

  it("the card says the animal's temperament, the hearts to the next level and what it brings", () => {
    app.save.sanctuary.affection.truffle = 12;
    mount().go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="truffle"]') as HTMLElement).click();
    const panel = document.querySelector('.friend-panel')!;
    expect(panel.textContent).toMatch(/Playful/);
    expect(panel.textContent).toMatch(/Truffle is curious about everything and delighted to see you\./);
    expect(panel.textContent).toMatch(/3 hearts to Good friend: a beaming smile/);
    expect(panel.querySelectorAll('.friend-panel__unlocks li.is-on')).toHaveLength(1);
    // A pat that crosses a level is celebrated too.
    app.save.sanctuary.affection.truffle = 14;
    (panel.closest('.sheet')!.querySelector('[data-act="pat"]') as HTMLButtonElement).click();
    expect(toastText()).toMatch(/Truffle is your good friend now! Truffle beams whenever you say hello/);
  });
});
