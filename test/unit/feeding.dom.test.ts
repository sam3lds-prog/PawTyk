// @vitest-environment happy-dom
/**
 * D48 PR B, feeding: thirty foods sold more than one way, charged and granted exactly once; feasts for a whole home;
 * bowls kept for good (even through a rollback); coins enough to befriend anyone; and a meal played out in the scene
 * (a bowl, three bites, hearts, the bar moving), cleaned up whether it ends or is stopped, still under reduced motion.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { balance, grant } from '../../src/meta/ledger';
import { grantItem, itemBalance } from '../../src/meta/items';
import { BOWLS, BUNDLE_QTY, FOODS, FOOD_BY_ID, foodOffers, isFeast } from '../../src/meta/catalogs/foods';
import {
  animalKindOf,
  bowlInUse,
  buyBowl,
  buyFood,
  favoriteFoods,
  feedAnimal,
  foodCount,
  FOOD_AFFECTION_PER_DAY,
  FOOD_CAP_EACH,
  fedToday,
  ownsBowl,
  serveFeast,
  suggestedFood,
} from '../../src/meta/feeding';
import { PETS } from '../../src/meta/catalogs/pets';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { FEED_MS, FEED_STILL_MS, bowlSpot, canFeedInScene, playFeeding } from '../../src/ui/components/feeding';
import { isFavorite } from '../../src/meta/catalogs/foods';

const NOW = new Date(2026, 10, 10, 15, 0, 0);
const rich = () => {
  const s = defaultSave(NOW);
  grant(s, 'test:coins', 5000, 'gift', NOW);
  grantItem(s, 'test:gems', 'gem', 500, 'test', NOW);
  grantItem(s, 'test:tokens', 'vtoken', 40, 'gift', NOW);
  return s;
};

describe('the pantry: thirty foods, several ways to buy', () => {
  it('thirty foods, each with a way to buy it; every coin food also comes five at a time, for less', () => {
    expect(FOODS).toHaveLength(30);
    for (const f of FOODS) {
      const offers = foodOffers(f);
      expect(offers.length, f.id).toBeGreaterThan(0);
      if (f.coins && !isFeast(f)) {
        const five = offers.find((o) => o.id === 'five')!;
        expect(five.qty).toBe(BUNDLE_QTY);
        expect(five.currency).toBe('coins');
        expect(five.amount, f.id).toBeLessThan(f.coins * BUNDLE_QTY);
      }
    }
  });

  it('a gem treat gives nothing a coin treat or a favorite can’t: the same daily limit, and no gem food beats it per day', () => {
    for (const f of FOODS.filter((x) => x.gems)) expect(f.affection, f.id).toBeLessThanOrEqual(FOOD_AFFECTION_PER_DAY);
    // The coin treat everyone loves exists, so "loved by all" never needs a video or gems.
    expect(FOODS.some((f) => f.coins && f.favorites === 'all')).toBe(true);
  });

  it('every animal can reach its daily friendship from food with coins alone (a favorite, or the coin treat)', () => {
    const ids = [...PETS.map((p) => p.id as string), ...COMPANIONS.map((c) => c.id as string)];
    for (const id of ids) {
      const kind = animalKindOf(id)!;
      const best = Math.max(...FOODS.filter((f) => f.coins && !isFeast(f)).map((f) => (f.favorites === 'all' ? f.affection : f.affection * (isFavorite(f, kind) ? 2 : 1))));
      expect(best * 3, id).toBeGreaterThanOrEqual(FOOD_AFFECTION_PER_DAY);
      // And "Get food" always has something sold for coins to suggest.
      expect(FOOD_BY_ID[suggestedFood(id)].coins, id).toBeGreaterThan(0);
    }
  });

  it('a bundle charges once and puts five in the pantry; a gem offer spends gems; nothing changes when it can’t be bought', () => {
    const s = rich();
    const coins = balance(s);
    expect(buyFood(s, 'hay', { offer: 'five', now: NOW })).toBe('ok');
    const five = foodOffers(FOOD_BY_ID.hay).find((o) => o.id === 'five')!;
    expect(balance(s)).toBe(coins - five.amount);
    expect(foodCount(s, 'hay')).toBe(5);
    const gems = itemBalance(s, 'gem');
    expect(buyFood(s, 'honeycake', { offer: 'gem', now: NOW })).toBe('ok');
    expect(itemBalance(s, 'gem')).toBe(gems - FOOD_BY_ID.honeycake.gems!);
    expect(foodCount(s, 'honeycake')).toBe(1);
    // An offer that doesn't exist for that food, and one the wallet can't pay: nothing written.
    const ledger = s.inventory.ledger.length + s.inventory.items.length;
    expect(buyFood(s, 'hay', { offer: 'gem', now: NOW })).toBe('not-for-sale');
    const poor = defaultSave(NOW);
    expect(buyFood(poor, 'goldenpicnic', { offer: 'gem', now: NOW })).toBe('insufficient');
    expect(s.inventory.ledger.length + s.inventory.items.length).toBe(ledger);
    expect(poor.inventory.items.filter((e) => e.item === 'food')).toHaveLength(0);
  });

  it('a bundle that wouldn’t fit isn’t sold (no charge for food that can’t be kept); one at a time still fits', () => {
    const s = rich();
    while (foodCount(s, 'oats') < FOOD_CAP_EACH - 2) buyFood(s, 'oats', NOW);
    const coins = balance(s);
    expect(buyFood(s, 'oats', { offer: 'five', now: NOW })).toBe('full');
    expect(balance(s)).toBe(coins);
    expect(buyFood(s, 'oats', NOW)).toBe('ok');
  });

  it('quick taps buy as many times as tapped, each charged once and granted once (the ledgers always agree)', () => {
    const s = rich();
    const coins = balance(s);
    for (let i = 0; i < 7; i++) expect(buyFood(s, 'corn', NOW)).toBe('ok');
    expect(foodCount(s, 'corn')).toBe(7);
    expect(coins - balance(s)).toBe(7 * FOOD_BY_ID.corn.coins!);
    const ids = [...s.inventory.ledger.map((e) => e.id), ...s.inventory.items.map((e) => e.id)];
    expect(new Set(ids).size).toBe(ids.length);
    // Every grant has its own spend.
    for (const g of s.inventory.items.filter((e) => e.item === 'food' && e.delta > 0)) expect(s.inventory.ledger.some((e) => `${e.id}:got` === g.id), g.id).toBe(true);
  });

  it('pre-D48 calls still work: buyFood(save, food, date) buys one the main way', () => {
    const s = rich();
    expect(buyFood(s, 'kibble', NOW)).toBe('ok');
    expect(foodCount(s, 'kibble')).toBe(1);
  });
});

describe('feasts: a whole home eats together', () => {
  function farmWithResidents() {
    const s = rich();
    s.inventory.companions.cotton = { unlockedAt: NOW.toISOString() };
    s.inventory.companions.truffle = { unlockedAt: NOW.toISOString() };
    return s;
  }

  it('one serving feeds everyone at home, each within their own daily limit; a feast can’t be fed to one', () => {
    const s = farmWithResidents();
    buyFood(s, 'festivalfeast', { offer: 'gem', now: NOW });
    expect(feedAnimal(s, 'cotton', 'festivalfeast', NOW)).toEqual({ ok: false, reason: 'feast' });
    // Truffle has nearly had her fill already.
    s.sanctuary.fed.truffle = { day: '2026-11-10', n: FOOD_AFFECTION_PER_DAY };
    const r = serveFeast(s, 'farm', 'festivalfeast', NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    const byAnimal = Object.fromEntries(r.fed.map((x) => [x.animal, x.gained]));
    expect(byAnimal.cotton).toBe(FOOD_BY_ID.festivalfeast.affection);
    expect(byAnimal.truffle).toBe(0);
    expect(foodCount(s, 'festivalfeast')).toBe(0);
  });

  it('nothing is used up when nobody lives there, or everyone has had plenty', () => {
    const s = rich();
    buyFood(s, 'festivalfeast', { offer: 'gem', now: NOW });
    expect(serveFeast(s, 'farm', 'festivalfeast', NOW)).toEqual({ ok: false, reason: 'nobody' });
    s.inventory.companions.cotton = { unlockedAt: NOW.toISOString() };
    s.sanctuary.fed.cotton = { day: '2026-11-10', n: FOOD_AFFECTION_PER_DAY };
    expect(serveFeast(s, 'farm', 'festivalfeast', NOW)).toEqual({ ok: false, reason: 'full' });
    expect(foodCount(s, 'festivalfeast')).toBe(1);
    expect(fedToday(s, 'cotton', NOW)).toBe(FOOD_AFFECTION_PER_DAY);
  });
});

describe('feeding bowls: bought once, kept for good', () => {
  it('a bowl is charged once and put to use; a second buy says owned', () => {
    const s = rich();
    expect(bowlInUse(s)).toBe('classic');
    const gems = itemBalance(s, 'gem');
    expect(buyBowl(s, 'flower', NOW)).toBe('ok');
    expect(buyBowl(s, 'flower', NOW)).toBe('owned');
    expect(itemBalance(s, 'gem')).toBe(gems - BOWLS.find((b) => b.id === 'flower')!.gems!);
    expect(bowlInUse(s)).toBe('flower');
    expect(buyBowl(s, 'patchwork', NOW)).toBe('ok');
    expect(bowlInUse(s)).toBe('patchwork');
  });

  it('survives a rollback: an older build drops the bowl record, but the purchase in the ledger is the proof', () => {
    const s = rich();
    buyBowl(s, 'golden', NOW);
    const old = JSON.parse(JSON.stringify(s));
    // What a build from before D48 writes back: it doesn't know bowls.
    delete old.inventory.bowls;
    delete old.sanctuary.bowl;
    const back = normalizeSave(old, NOW);
    expect(ownsBowl(back, 'golden')).toBe(true);
    expect(bowlInUse(back)).toBe('classic');
    // And a bowl never bought isn't in use, whatever the save says.
    back.sanctuary.bowl = 'flower';
    expect(bowlInUse(back)).toBe('classic');
  });

  it('normalizes: a damaged bowl choice falls back to the wooden bowl; owned bowls round-trip', () => {
    const s = rich();
    buyBowl(s, 'patchwork', NOW);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(back.inventory.bowls?.patchwork).toBeTruthy();
    expect(bowlInUse(back)).toBe('patchwork');
    const bad = JSON.parse(JSON.stringify(s));
    bad.sanctuary.bowl = 42;
    expect(bowlInUse(normalizeSave(bad, NOW))).toBe('classic');
  });
});

describe('favorites', () => {
  it('a sheep loves hay and oats; a piglet pumpkin; a dog biscuits; and “Get food” suggests a coin favorite', () => {
    expect(favoriteFoods('cotton')).toEqual(expect.arrayContaining(['hay', 'oats']));
    expect(favoriteFoods('truffle')).toEqual(expect.arrayContaining(['pumpkin']));
    expect(favoriteFoods('biscuit')).toEqual(expect.arrayContaining(['kibble', 'biscuits']));
    for (const id of ['cotton', 'truffle', 'biscuit']) expect(FOOD_BY_ID[suggestedFood(id)].coins).toBeGreaterThan(0);
  });
});

// ------------------------------------------------------------------ the meal in the scene

function scene(): { svg: SVGSVGElement; host: HTMLElement; fig: SVGGElement } {
  document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300"><g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="240" data-gh="30" data-name="Cotton"><rect x="65" y="210" width="30" height="30"/></g></svg></figure>`;
  return { svg: document.querySelector('svg')!, host: document.querySelector('figure')!, fig: document.querySelector('[data-friend]')! };
}
const meal = (o: Partial<Parameters<typeof playFeeding>[0]> = {}) => {
  const { svg, host } = scene();
  return playFeeding({ svg, host, camera: null, animal: 'cotton', name: 'Cotton', food: 'hay', bowl: 'flower', favorite: true, before: 3, after: 5, reducedMotion: false, ...o });
};

describe('a meal, played out in the scene', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('puts a bowl beside the animal toward the middle, plays the meal on the figure, and clears everything after', async () => {
    expect(bowlSpot(80, 240, 30, 360).dir).toBe(1);
    expect(bowlSpot(300, 240, 30, 360).dir).toBe(-1);
    const h = meal();
    const fig = document.querySelector<SVGGElement>('[data-friend="cotton"]')!;
    expect(fig.dataset.trick).toBe('feed');
    expect(fig.classList.contains('is-trick-feed')).toBe(true);
    expect(document.querySelector('.sp-feed .sp-bowl')).not.toBeNull();
    expect(document.querySelector('.feed-bond')?.textContent).toMatch(/Cotton loved it \+2/);
    // While it eats, nobody else can start a meal (or a trick) on it.
    expect(canFeedInScene(document.querySelector('svg'), 'cotton')).toBe(false);
    vi.advanceTimersByTime(1300);
    expect(document.querySelector('.sp-feed-food')?.getAttribute('data-bites')).toBe('1');
    vi.advanceTimersByTime(1500);
    expect(document.querySelector('.sp-feed-hearts.is-on')).not.toBeNull();
    vi.advanceTimersByTime(FEED_MS);
    expect(await h.done).toBe(true);
    expect(fig.dataset.trick).toBeUndefined();
    expect(fig.classList.contains('is-trick-feed')).toBe(false);
    expect(document.querySelector('.sp-feed, .sp-feed-hearts')).toBeNull();
    vi.advanceTimersByTime(1000);
    expect(document.querySelector('.feed-bond')).toBeNull();
  });

  it('stopping it (the player started something else, or left) clears it at once', async () => {
    const h = meal();
    h.stop();
    expect(await h.done).toBe(false);
    expect(document.querySelector('.sp-feed, .sp-feed-hearts, .feed-bond')).toBeNull();
    expect(document.querySelector<SVGGElement>('[data-friend]')!.dataset.trick).toBeUndefined();
  });

  it('reduced motion: nothing moves; the bowl, the hearts and the card show still, then go', async () => {
    const h = meal({ reducedMotion: true });
    const fig = document.querySelector<SVGGElement>('[data-friend="cotton"]')!;
    expect(fig.classList.contains('is-trick-feed')).toBe(false);
    expect(document.querySelector('.sp-feed.is-still')).not.toBeNull();
    expect(document.querySelector('.sp-feed-hearts.is-still')).not.toBeNull();
    vi.advanceTimersByTime(FEED_STILL_MS + 10);
    expect(await h.done).toBe(true);
    expect(document.querySelector('.sp-feed')).toBeNull();
  });

  it('an animal mid-trick or away on a decoration isn’t interrupted: the meal doesn’t start', async () => {
    const { svg, host, fig } = scene();
    fig.dataset.trick = 'wave';
    const h = playFeeding({ svg, host, camera: null, animal: 'cotton', name: 'Cotton', food: 'hay', bowl: 'classic', favorite: false, before: 0, after: 1, reducedMotion: false });
    expect(await h.done).toBe(false);
    expect(document.querySelector('.sp-feed')).toBeNull();
    expect(fig.dataset.trick).toBe('wave');
  });
});

// ------------------------------------------------------------------ on the Farm's screen

import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { shopScreen } from '../../src/ui/screens/shop';
import { feedReturn, setFeedReturn } from '../../src/ui/components/feedPanel';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
function mountApp(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, shop: shopScreen });
  app.router = router;
  return router;
}

describe('feeding on the Farm', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 10, 10, 12));
    localStorage.clear();
    app.replaceSave(defaultSave(new Date(2026, 10, 10, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, decorTipSeen: true, sceneTapTipSeen: true });
    app.save.world.growth.farm = 4;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    grant(app.save, 'test:coins', 500, 'gift', NOW);
    setFeedReturn(null);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
  });

  it('the card shows what Cotton loves, her favorites first; feeding closes the card and the meal plays in the scene', () => {
    buyFood(app.save, 'corn', NOW);
    buyFood(app.save, 'hay', NOW);
    mountApp().go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="cotton"]') as HTMLElement).click();
    const panel = document.querySelector('.friend-panel')!;
    expect(panel.querySelector('.friend-panel__favs')?.textContent).toMatch(/Cotton loves/);
    const chips = [...panel.querySelectorAll<HTMLElement>('[data-feed]')].map((b) => b.dataset.feed);
    expect(chips[0]).toBe('hay');
    (panel.querySelector('[data-feed="hay"]') as HTMLElement).click();
    // The card makes way; the scene has the meal.
    expect(document.querySelector('.friend-panel')).toBeNull();
    expect(document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.getAttribute('data-trick')).toBe('feed');
    expect(document.querySelector('.sanctuary__scene .sp-feed')).not.toBeNull();
    expect(app.save.sanctuary.affection.cotton).toBe(2);
    expect(foodCount(app.save, 'hay')).toBe(0);
    vi.advanceTimersByTime(FEED_MS + 1200);
    expect(document.querySelector('.sanctuary__scene .sp-feed')).toBeNull();
    expect(document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.getAttribute('data-trick')).toBeNull();
  });

  it('Get food: the Shop opens on the Farm’s food with her favorite picked out; buying it and going back reopens her card', () => {
    const router = mountApp();
    router.go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="cotton"]') as HTMLElement).click();
    (document.querySelector('[data-act="get-food"]') as HTMLElement).click();
    expect(feedReturn()).toBe('cotton');
    expect(document.querySelector('.shop [data-feed-return]')?.textContent).toMatch(/Shopping for Cotton/);
    const wanted = document.querySelector<HTMLElement>('.food-card.is-wanted')!;
    expect(wanted.dataset.food).toBe('hay');
    wanted.click();
    (document.querySelector('.decor-sheet [data-offer="one"]') as HTMLElement).click();
    expect(foodCount(app.save, 'hay')).toBe(1);
    (document.querySelector('.decor-sheet [data-act="close"]') as HTMLElement).click();
    vi.advanceTimersByTime(400);
    const back = document.querySelector<HTMLElement>('[data-act="feed-back"]')!;
    expect(back.textContent).toMatch(/Feed Cotton/);
    back.click();
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.region')).not.toBeNull();
    expect(document.querySelector('.friend-panel[data-friend-panel="cotton"]')).not.toBeNull();
    expect(feedReturn()).toBeNull();
  });

  it('leaving the Shop another way forgets the errand (no card pops up on a later visit)', () => {
    const router = mountApp();
    router.go({ screen: 'region', id: 'farm' });
    (document.querySelector('[data-friend-card="cotton"]') as HTMLElement).click();
    (document.querySelector('[data-act="get-food"]') as HTMLElement).click();
    router.go({ screen: 'world' });
    expect(feedReturn()).toBeNull();
    router.go({ screen: 'region', id: 'farm' });
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.friend-panel')).toBeNull();
  });

  it('the trick tray has a Feed button that opens the animal’s card', () => {
    mountApp().go({ screen: 'region', id: 'farm' });
    document.querySelector('.sanctuary__scene [data-friend="truffle"]')!.querySelector('path, ellipse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    (document.querySelector('[data-act="tray-feed"]') as HTMLElement).click();
    expect(document.querySelector('.friend-panel[data-friend-panel="truffle"]')).not.toBeNull();
  });
});
