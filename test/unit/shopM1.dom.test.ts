// @vitest-environment happy-dom
/**
 * M1, Shop discovery: "Featured for your <home>" (honest picks from the existing catalog, the same for the same save,
 * never something this build can't sell or the player owns), trying a decoration or a trick on in the home itself
 * (nothing bought, owned, shown or learned by looking), **Back to <item>** landing on that item's card, and prices
 * spelled out with what the player has toward them.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave } from '../../src/services/storage';
import { balance, grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { featuredFor, FEATURED_MAX, type Currency } from '../../src/meta/featured';
import { DECOR_BY_ID, decorHome, spotMates } from '../../src/meta/catalogs/decor';
import { isShown, owns, shownDecorIds } from '../../src/meta/sanctuary';
import { ownsTrick } from '../../src/meta/tricks';
import { tryDecorList, tryOnOf, trickHome } from '../../src/ui/components/tryOn';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
const all = (_c: Currency) => true;
const coinsOnly = (c: Currency) => c === 'coins';

function farmSave(coins = 0) {
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  s.journey.nextLevel = 41;
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  if (coins) grant(s, 'test:coins', coins, 'gift', NOW);
  return s;
}

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, sanctuary: sanctuaryScreen, shop: shopScreen });
  app.router = router;
  return router;
}

describe('Featured for your home', () => {
  it('a few honest picks: a decoration for this home, a trick its animals could learn, a favorite food not in the pantry', () => {
    const s = farmSave(300);
    const picks = featuredFor(s, 'farm', all);
    expect(picks.length).toBeGreaterThan(1);
    expect(picks.length).toBeLessThanOrEqual(FEATURED_MAX);
    const d = picks.find((p) => p.kind === 'decor')!;
    expect(decorHome(DECOR_BY_ID[d.id as never])).toBe('farm');
    expect(picks.some((p) => p.kind === 'trick')).toBe(true);
    expect(picks.some((p) => p.kind === 'food')).toBe(true);
    for (const p of picks) {
      expect(p.reason.length).toBeGreaterThan(5);
      // No made-up urgency or popularity.
      expect(p.reason).not.toMatch(/popular|only today|hurry|left!|limited|everyone is/i);
    }
  });

  it('the same for the same save; never something owned or something this build can’t sell', () => {
    const s = farmSave(300);
    expect(featuredFor(s, 'farm', all)).toEqual(featuredFor(s, 'farm', all));
    const first = featuredFor(s, 'farm', all).find((p) => p.kind === 'decor')!;
    s.inventory.decor[first.id] = { ownedAt: NOW.toISOString() };
    expect(featuredFor(s, 'farm', all).map((p) => p.id)).not.toContain(first.id);
    grantItem(s, 'test:gems', 'gem', 500, 'test', NOW);
    grantItem(s, 'test:tokens', 'vtoken', 10, 'gift', NOW);
    // A release build without the App Store or videos: coins only.
    for (const p of featuredFor(s, 'farm', coinsOnly)) {
      if (p.kind === 'decor') expect(DECOR_BY_ID[p.id].cost, p.id).not.toBeNull();
    }
    // With them, a special piece can be featured for a currency the player already has (D49 PR A: after the
    // decoration, trick and food, so where nobody lives yet to suggest those for).
    const nobody = defaultSave(NOW);
    nobody.journey.nextLevel = 41;
    grantItem(nobody, 'test:gems', 'gem', 500, 'test', NOW);
    grantItem(nobody, 'test:tokens', 'vtoken', 10, 'gift', NOW);
    expect(featuredFor(nobody, 'farm', all).some((p) => p.kind === 'decor' && (DECOR_BY_ID[p.id].gems || DECOR_BY_ID[p.id].tokens))).toBe(true);
  });

  it('a set already started comes first; with nobody home there are no tricks or foods to suggest', () => {
    const s = farmSave(50);
    s.inventory.decor.flowerarch = { ownedAt: NOW.toISOString() };
    const d = featuredFor(s, 'farm', all).find((p) => p.kind === 'decor')!;
    expect(DECOR_BY_ID[d.id].set).toBe(DECOR_BY_ID.flowerarch.set);
    expect(d.reason).toMatch(/set \(1 of \d\)/);
    const empty = defaultSave(NOW);
    empty.journey.nextLevel = 41;
    expect(featuredFor(empty, 'farm', all).every((p) => p.kind === 'decor')).toBe(true);
  });
});

describe('trying on: the save never changes', () => {
  it('the piece is out where it would stand, whatever shares its spot set aside', () => {
    const mate = spotMates('flowerarch')[0].id;
    expect(tryDecorList([mate, 'scarecrow'], { kind: 'decor', id: 'flowerarch' })).toEqual(['scarecrow', 'flowerarch']);
    expect(tryDecorList(['scarecrow'], null)).toEqual(['scarecrow']);
  });

  it('only what isn’t owned, and a decoration only in its own home; a trick in the home the player builds, if someone lives there', () => {
    app.replaceSave(farmSave());
    expect(tryOnOf({ tryDecor: 'flowerarch' }, 'farm')).toEqual({ kind: 'decor', id: 'flowerarch' });
    expect(tryOnOf({ tryDecor: 'flowerarch' }, 'harmony')).toBeNull();
    expect(tryOnOf({ tryDecor: 'nonsense' }, 'farm')).toBeNull();
    // The Welcome Pack's piece is only ever shown in the Shop, with its pack.
    expect(tryOnOf({ tryDecor: 'rescuewagon' }, 'farm')).toBeNull();
    app.save.inventory.decor.flowerarch = { ownedAt: NOW.toISOString() };
    expect(tryOnOf({ tryDecor: 'flowerarch' }, 'farm')).toBeNull();
    expect(tryOnOf({ tryTrick: 'tailchase' }, 'farm')).toEqual({ kind: 'trick', id: 'tailchase' });
    expect(tryOnOf({ tryTrick: 'wave' }, 'farm')).toBeNull();
    expect(trickHome([{ id: 'harmony', residents: 0 }, { id: 'farm', residents: 2 }], 'harmony')).toBe('farm');
    expect(trickHome([{ id: 'harmony', residents: 1 }, { id: 'farm', residents: 2 }], 'farm')).toBe('farm');
    expect(trickHome([{ id: 'farm', residents: 0 }], 'farm')).toBeNull();
  });
});

describe('in the app', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    app.replaceSave(farmSave(300));
    app.settings.reducedMotion = 'reduce';
  });
  afterEach(() => {
    app.settings.reducedMotion = 'system';
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    vi.useRealTimers();
  });

  it('the Shop shows "Featured for your Farm" with real prices; a pick opens its card', async () => {
    mount().go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' });
    expect(document.querySelector('#featured-title')?.textContent).toBe('Featured for your Farm');
    const cards = [...document.querySelectorAll<HTMLElement>('[data-featured]')];
    expect(cards.length).toBeGreaterThan(1);
    for (const c of cards) expect(c.getAttribute('aria-label')).toMatch(/\d+ (Paw Coins|video tokens|gems)\./);
    cards.find((c) => c.dataset.featured === 'trick')!.click();
    expect(document.querySelector('.trick-sheet')).not.toBeNull();
    expect(document.querySelector('.trick-sheet .price-line')?.textContent).toMatch(/you have 300/);
  });

  it('See it in your Farm: the piece is out in the real scene, the walk and photos step aside, and Back opens its card again', async () => {
    const router = mount();
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' });
    // What a purchase or putting something out would change (a visit itself notes the visit and the time).
    const kept = () => JSON.stringify({ inv: app.save.inventory, sanctuary: app.save.sanctuary, ledger: (app.save as unknown as { ledger?: unknown }).ledger });
    const before = kept();
    expect(document.querySelector('.decor-sheet .price-line')?.textContent).toMatch(/180 Paw Coins · you have 300/);
    (document.querySelector('.decor-sheet [data-act="try"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(router.route).toMatchObject({ screen: 'region', id: 'farm', tryDecor: 'flowerarch' });
    const scene = document.querySelector('.sanctuary__scene')!;
    expect(scene.classList.contains('is-trying')).toBe(true);
    expect(scene.querySelector('[data-decor="flowerarch"]')).not.toBeNull();
    expect(document.querySelector('[data-try-banner]')?.textContent).toMatch(/Not yours yet · 180 Paw Coins \(you have 300\)/);
    expect(scene.querySelector('[data-act="walk"]:not([hidden])')).toBeNull();
    expect(scene.querySelector('[data-act="photo"]:not([hidden])')).toBeNull();
    // Nothing owned, shown or spent.
    expect(owns(app.save, 'flowerarch')).toBe(false);
    expect(isShown(app.save, 'flowerarch')).toBe(false);
    expect(shownDecorIds(app.save, 'farm')).not.toContain('flowerarch');
    expect(balance(app.save)).toBe(300);
    (document.querySelector('[data-act="try-back"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(router.route).toMatchObject({ screen: 'shop', decor: 'flowerarch' });
    expect(document.querySelector('.decor-sheet')).not.toBeNull();
    expect(document.querySelector('.decor-sheet .sheet__title, .decor-sheet h2')?.textContent).toBe('Flower Arch');
    expect(kept()).toBe(before);
  });

  it('Try it in your Farm (a trick): one of the Farm’s animals plays it, Again plays it again, and it is never learned', async () => {
    const router = mount();
    router.go({ screen: 'shop', tab: 'tricks', trick: 'tailchase' });
    expect(document.querySelector('.trick-sheet')).not.toBeNull();
    (document.querySelector('.trick-sheet [data-act="try-in"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1000);
    expect(router.route).toMatchObject({ screen: 'region', id: 'farm', tryTrick: 'tailchase' });
    expect(document.querySelector('.sanctuary__scene [data-trick="tailchase"]')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    expect(document.querySelector('.sanctuary__scene [data-trick="tailchase"]')).toBeNull();
    (document.querySelector('[data-act="try-again"]') as HTMLElement).click();
    expect(document.querySelector('.sanctuary__scene [data-trick="tailchase"]')).not.toBeNull();
    expect(ownsTrick(app.save, 'tailchase')).toBe(false);
    expect(balance(app.save)).toBe(300);
    await vi.advanceTimersByTimeAsync(4000);
    (document.querySelector('[data-act="try-back"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(50);
    expect(router.route).toMatchObject({ screen: 'shop', tab: 'tricks', trick: 'tailchase' });
    expect(document.querySelector('.trick-sheet')).not.toBeNull();
  });

  it('in a home’s tray, a trick not learned yet: "Try it on Cotton" plays it there, and Cotton still hasn’t learned it', async () => {
    mount().go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(2000);
    (document.querySelector('[data-act="tricks"]') as HTMLElement).click();
    (document.querySelector('[data-tray-tab="trick"]') as HTMLElement | null)?.click();
    (document.querySelector('.trick-tray__list [data-trick="tailchase"]') as HTMLElement).click();
    const btn = document.querySelector<HTMLElement>('.trick-sheet [data-act="try-here"]')!;
    expect(btn.textContent).toMatch(/Try it on \w+/);
    btn.click();
    expect(document.querySelector('.trick-sheet')).toBeNull();
    expect(document.querySelector('.sanctuary__scene [data-trick="tailchase"]')).not.toBeNull();
    expect(ownsTrick(app.save, 'tailchase')).toBe(false);
  });
});
