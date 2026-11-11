// @vitest-environment happy-dom
/**
 * D49 PR A, attention first: the Shop's Featured row is one large pick and two small ones (what the player can have
 * today first, the trick and food for the home's newest animal), with See all; a decoration's card has one way to see
 * it (Try it in my Farm), where the animals use it and Buy is right there; and an arrival ends with one card: a welcome
 * snack for the newcomer (the first one free, once), then the Journey.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave, type SaveV2 } from '../../src/services/storage';
import { balance, grant } from '../../src/meta/ledger';
import { featuredFor, FEATURED_MAX, type Currency } from '../../src/meta/featured';
import { isShown, owns } from '../../src/meta/sanctuary';
import { ownsTrick } from '../../src/meta/tricks';
import { foodCount, FOOD_AFFECTION_PER_DAY } from '../../src/meta/feeding';
import { grantItem } from '../../src/meta/items';
import { giveWelcomeSnack, welcomeSnack, WELCOME_SNACK_ID } from '../../src/meta/welcomeSnack';
import { welcomeCardMarkup } from '../../src/ui/components/welcomeCard';
import { cueMs, SCORES } from '../../src/audio/scores';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
const all = (_c: Currency) => true;

function farmSave(coins = 0): SaveV2 {
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

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  app.replaceSave(farmSave(300));
  app.settings.toys3d = false;
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
});

describe('Featured: one large, two small, affordable first', () => {
  it('three at most; what the player has the price of comes first', () => {
    expect(FEATURED_MAX).toBe(3);
    const picks = featuredFor(farmSave(300), 'farm', all);
    expect(picks.length).toBeLessThanOrEqual(3);
    expect(picks[0].afford).toBe(true);
    // Never an unaffordable pick ahead of an affordable one.
    const firstShort = picks.findIndex((p) => !p.afford);
    if (firstShort >= 0) expect(picks.slice(firstShort).every((p) => !p.afford)).toBe(true);
  });

  it('the trick and the food are for the home’s newest animal, by name', () => {
    const picks = featuredFor(farmSave(300), 'farm', all);
    const named = picks.filter((p) => p.kind !== 'decor');
    expect(named.length).toBeGreaterThan(0);
    // Truffle came home after Cotton.
    for (const p of named) expect(p.reason).toMatch(/Truffle/);
  });

  it('with no coins at all, the picks still show (nearest first), none marked affordable', () => {
    const picks = featuredFor(farmSave(0), 'farm', all);
    expect(picks.length).toBeGreaterThan(0);
    expect(picks.every((p) => !p.afford)).toBe(true);
  });

  it('the Shop: one large card, up to two small ones, real prices; See all goes to the catalog', () => {
    mount().go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' });
    expect(document.querySelectorAll('.shop-featured .featured-card--lead')).toHaveLength(1);
    const minis = document.querySelectorAll('.shop-featured .featured-mini');
    expect(minis.length).toBeLessThanOrEqual(2);
    for (const c of document.querySelectorAll<HTMLElement>('[data-featured]')) expect(c.getAttribute('aria-label')).toMatch(/\d+ (Paw Coins|video tokens|gems)\./);
    (document.querySelector('[data-act="see-all"]') as HTMLElement).click();
    const focused = document.activeElement as HTMLElement;
    expect(focused.tagName).toBe('H2');
    expect(focused.closest('.shop-section')?.classList.contains('shop-featured')).toBe(false);
    expect(focused.textContent).toMatch(/Farm decor/);
  });
});

describe('a decoration’s card: one way to see it, then buy it where it stands', () => {
  it('a piece that can be tried on: Try it in my Farm, and no second "Show me" beside it', () => {
    mount().go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' });
    const sheet = document.querySelector('.decor-sheet')!;
    expect(sheet.querySelector('[data-act="try"]')?.textContent).toMatch(/Try it in my Farm/);
    expect(sheet.querySelector<HTMLElement>('[data-act="preview-play"]')?.hidden ?? true).toBe(true);
    expect(sheet.querySelector('[data-act="buy"]')?.textContent).toMatch(/Buy for/);
  });

  it('an owned piece (nothing to try on) keeps the card’s own Show me', () => {
    app.save.inventory.decor.tireswing = { ownedAt: NOW.toISOString() };
    mount().go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'tireswing' });
    const sheet = document.querySelector('.decor-sheet')!;
    expect(sheet.querySelector('[data-act="try"]')).toBeNull();
    const showMe = sheet.querySelector<HTMLElement>('[data-act="preview-play"]');
    if (showMe) expect(showMe.hidden).toBe(false);
  });

  it('tried on in the Farm: the animals use it, and Buy is right there; bought once, it stays out and the banner goes', async () => {
    const router = mount();
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: 'flowerarch' });
    (document.querySelector('.decor-sheet [data-act="try"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(2600);
    const banner = document.querySelector('[data-try-banner]')!;
    expect(banner.querySelector('[data-act="try-again"]')).not.toBeNull();
    const buy = banner.querySelector<HTMLElement>('[data-act="try-buy"]')!;
    expect(buy.textContent).toMatch(/Buy\s*180/);
    buy.click();
    buy.click();
    expect(owns(app.save, 'flowerarch')).toBe(true);
    expect(isShown(app.save, 'flowerarch')).toBe(true);
    // Charged exactly once, by the Shop's own purchase id.
    expect(balance(app.save)).toBe(120);
    expect(document.querySelector('[data-try-banner]')).toBeNull();
    expect(document.querySelector('.sanctuary__scene.is-trying')).toBeNull();
    expect(document.querySelector('.sanctuary__scene [data-decor="flowerarch"]')).not.toBeNull();
    expect(router.route).toEqual({ screen: 'region', id: 'farm' });
  });

  it('not enough to buy it: the banner shows the price, and no Buy', async () => {
    app.replaceSave(farmSave(20));
    mount().go({ screen: 'region', id: 'farm', tryDecor: 'flowerarch' });
    await vi.advanceTimersByTimeAsync(100);
    const banner = document.querySelector('[data-try-banner]')!;
    expect(banner.querySelector('[data-act="try-buy"]')).toBeNull();
    expect(banner.querySelector('.price.is-short')).not.toBeNull();
  });

  it('a trick tried on can be learned from the banner (Learn), once', async () => {
    mount().go({ screen: 'region', id: 'farm', tryTrick: 'headtilt' });
    await vi.advanceTimersByTimeAsync(2600);
    const learn = document.querySelector<HTMLElement>('[data-try-banner] [data-act="try-buy"]')!;
    expect(learn.textContent).toMatch(/Learn/);
    learn.click();
    expect(ownsTrick(app.save, 'headtilt')).toBe(true);
    expect(balance(app.save)).toBe(240);
    expect(document.querySelector('[data-try-banner]')).toBeNull();
  });
});

describe('the welcome snack', () => {
  it('the first is free (one portion of a favorite, once per player); then the pantry; never a feast', () => {
    const s = farmSave();
    const first = welcomeSnack(s, 'truffle')!;
    expect(first.gift).toBe(true);
    const r = giveWelcomeSnack(s, 'truffle')!;
    expect(r.ok).toBe(true);
    expect(r.gift).toBe(true);
    expect(s.inventory.items.filter((e) => e.id === WELCOME_SNACK_ID)).toHaveLength(1);
    expect(foodCount(s, r.food)).toBe(0);
    // Nothing in the pantry and the gift had: no snack to offer.
    expect(welcomeSnack(s, 'cotton')).toBeNull();
    // A feast in the pantry is not a snack; a favorite is, ahead of the treats everyone loves.
    grantItem(s, 'test:feast', 'food', 1, 'gift', NOW, 'Feast', 'festivalfeast');
    grantItem(s, 'test:basket', 'food', 1, 'gift', NOW, 'Basket', 'harvestbasket');
    grantItem(s, 'test:hay', 'food', 1, 'gift', NOW, 'Hay', 'hay');
    expect(welcomeSnack(s, 'cotton')).toEqual({ food: 'hay', gift: false });
  });

  it('an animal that has eaten its fill today has no snack offered', () => {
    const s = farmSave();
    s.sanctuary.fed.cotton = { day: '2026-11-11', n: FOOD_AFFECTION_PER_DAY };
    expect(welcomeSnack(s, 'cotton', NOW)).toBeNull();
  });

  it('with nothing to give, the card leads with Continue and offers a hello instead', () => {
    grantItem(app.save, WELCOME_SNACK_ID, 'food', 1, 'gift', NOW, 'x', 'hay');
    app.save.inventory.items = app.save.inventory.items.map((e) => (e.id === WELCOME_SNACK_ID ? { ...e, delta: 0 } : e));
    document.body.innerHTML = welcomeCardMarkup('truffle', 'farm', 'offer');
    expect(document.querySelector('[data-act="welcome-snack"]')).toBeNull();
    expect(document.querySelector('[data-act="welcome-play"]')?.hasAttribute('data-autofocus')).toBe(true);
    expect(document.querySelector('[data-act="welcome-hello"]')?.textContent).toMatch(/Say hello to Truffle/);
  });

  it('Meet → the parade → the card: the snack plays in the scene, then Continue is the one button', async () => {
    app.settings.reducedMotion = 'reduce';
    app.save.inventory.decor.flowerarch = { ownedAt: NOW.toISOString() };
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(400 + cueMs(SCORES.bounce) + 600);
    const card = document.querySelector('[data-welcome-card="offer"]')!;
    expect(card.querySelector('.welcome-card__who small')?.textContent).toBe('Your second friend at the Farm');
    (card.querySelector('[data-act="welcome-snack"]') as HTMLElement).click();
    expect(document.querySelector('[data-friend="truffle"]')?.getAttribute('data-trick')).toBe('feed');
    expect(document.querySelector('[data-welcome-card] .welcome-card__actions')?.getAttribute('aria-busy')).toBe('true');
    await vi.advanceTimersByTimeAsync(3000);
    const fed = document.querySelector('[data-welcome-card="fed"]')!;
    expect(fed.querySelectorAll('.btn')).toHaveLength(1);
    expect(fed.textContent).toMatch(/Truffle (loved|enjoyed) the/);
    // A re-render (a decoration toggled) keeps the card as it is.
    (document.querySelector('[data-toggle="flowerarch"]') as HTMLElement).click();
    expect(document.querySelector('[data-welcome-card="fed"]')).not.toBeNull();
    // Coming back later opens the Farm plainly.
    router.refresh();
    expect(document.querySelector('[data-welcome-card]')).toBeNull();
  });
});
