/**
 * D48 PR F: the release checks for everything D48 added. The economy (what each new thing costs in levels played,
 * tokens and gems, and that coins stay the main way), and saves (a save from before D48 loads untouched and gains
 * nothing it didn't have; a save with everything D48 round-trips; ids from a newer build are kept, never used).
 */
import { describe, expect, it } from 'vitest';
import { ECONOMY } from '../../src/config/economy';
import { BOWLS, BUNDLE_QTY, FOODS, foodOffers, isFavorite, isFeast } from '../../src/meta/catalogs/foods';
import { DECOR, PRE_D48_DECOR, setPieces } from '../../src/meta/catalogs/decor';
import { TRICKS, trickCurrency } from '../../src/meta/catalogs/tricks';
import { REWARDED_DAILY_CAP } from '../../src/app/rewarded';
import { GEM_PACKS } from '../../src/services/iap';
import { FOOD_AFFECTION_PER_DAY, buyBowl, buyFood, chooseBowl, foodCount, ownsBowl } from '../../src/meta/feeding';
import { buyDecor, setProgress, showSet } from '../../src/meta/sanctuary';
import { buyTrick, ownsTrick } from '../../src/meta/tricks';
import { assignCelebration, celebrationOf } from '../../src/meta/celebrations';
import { balance, grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { PETS } from '../../src/meta/catalogs/pets';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { animalKindOf } from '../../src/meta/feeding';

const NOW = new Date(2026, 10, 10, 12);
const LEVEL = ECONOMY.journeyFirstClear;
const NEW_DECOR = DECOR.filter((d) => !PRE_D48_DECOR.includes(d.id));
const NEW_TRICKS = TRICKS.slice(TRICKS.findIndex((t) => t.id === 'wiggle'));
const roundTrip = <T>(s: T) => normalizeSave(JSON.parse(JSON.stringify(s)));

describe('the D48 economy', () => {
  it('coins are the main way: most foods, most new decorations and the everyday tricks are for coins', () => {
    expect(FOODS.filter((f) => f.coins).length).toBeGreaterThanOrEqual(20);
    expect(NEW_DECOR.filter((d) => d.cost !== null).length).toBeGreaterThan(NEW_DECOR.length / 2);
    expect(NEW_TRICKS.filter((t) => t.tier === 'coins' || t.tier === 'free').length).toBeGreaterThanOrEqual(7);
    // A gem price never replaces a coin or token way to the same affection.
    for (const f of FOODS.filter((x) => x.gems && !x.coins && !x.tokens)) expect(FOODS.some((g) => g !== f && (g.coins || g.tokens) && g.affection >= f.affection && g.favorites === 'all'), f.id).toBe(true);
  });

  it('in levels played: a day’s meals for an animal ≤ 2 levels, a trick ≤ 3, a decoration 2–8, the patchwork bowl ≤ 5', () => {
    // Every kind of animal can be fed to the day's limit with its cheapest coin favorite (doubled affection).
    const kinds = new Set<string>([...PETS.map((p) => animalKindOf(p.id)), ...COMPANIONS.map((c) => animalKindOf(c.id))].filter((k): k is NonNullable<typeof k> => !!k));
    for (const k of kinds) {
      const favs = FOODS.filter((f) => f.coins && !isFeast(f) && f.favorites !== 'all' && isFavorite(f, k as never));
      expect(favs.length, k).toBeGreaterThan(0);
      const cheapest = Math.min(...favs.map((f) => f.coins! / (f.affection * 2)));
      expect(cheapest * FOOD_AFFECTION_PER_DAY, k).toBeLessThanOrEqual(2 * LEVEL);
    }
    for (const t of NEW_TRICKS.filter((x) => trickCurrency(x) === 'coins')) expect(t.price, t.id).toBeLessThanOrEqual(3 * LEVEL);
    for (const d of NEW_DECOR.filter((x) => x.cost !== null)) {
      expect(d.cost!, d.id).toBeGreaterThanOrEqual(2 * LEVEL);
      expect(d.cost!, d.id).toBeLessThanOrEqual(8 * LEVEL);
    }
    expect(BOWLS.find((b) => b.id === 'patchwork')!.coins!).toBeLessThanOrEqual(5 * LEVEL);
  });

  it('all of D48’s coin things together are a long goal, not a wall: 40–100 levels of first clears', () => {
    const total = NEW_DECOR.reduce((n, d) => n + (d.cost ?? 0), 0) + NEW_TRICKS.filter((t) => trickCurrency(t) === 'coins').reduce((n, t) => n + t.price, 0) + BOWLS.reduce((n, b) => n + (b.coins ?? 0), 0);
    expect(total / LEVEL).toBeGreaterThanOrEqual(40);
    expect(total / LEVEL).toBeLessThanOrEqual(100);
  });

  it('video tokens: nothing costs more than 4 (under half a day’s videos); gems: nothing more than the middle pack', () => {
    const tokenPrices = [...NEW_DECOR.filter((d) => d.tokens).map((d) => d.tokens!), ...NEW_TRICKS.filter((t) => trickCurrency(t) === 'vtoken').map((t) => t.price), ...FOODS.filter((f) => f.tokens).map((f) => f.tokens!)];
    for (const p of tokenPrices) expect(p).toBeLessThanOrEqual(Math.min(4, REWARDED_DAILY_CAP / 2));
    const gemPrices = [...NEW_DECOR.filter((d) => d.gems).map((d) => d.gems!), ...NEW_TRICKS.filter((t) => trickCurrency(t) === 'gem').map((t) => t.price), ...FOODS.filter((f) => f.gems).map((f) => f.gems!), ...BOWLS.filter((b) => b.gems).map((b) => b.gems!)];
    for (const p of gemPrices) expect(p).toBeLessThanOrEqual(GEM_PACKS.gems_160);
    // The smallest pack buys a premium trick, a premium bowl and a premium treat.
    expect(Math.min(...NEW_TRICKS.filter((t) => trickCurrency(t) === 'gem').map((t) => t.price))).toBeLessThanOrEqual(GEM_PACKS.gems_60);
    expect(Math.min(...BOWLS.filter((b) => b.gems).map((b) => b.gems!))).toBeLessThanOrEqual(GEM_PACKS.gems_60);
  });

  it('five at once cost a little less than five, never less than four', () => {
    for (const f of FOODS) {
      const one = foodOffers(f).find((o) => o.id === 'one' && o.currency === 'coins');
      const five = foodOffers(f).find((o) => o.id === 'five');
      if (!one || !five) continue;
      expect(five.qty).toBe(BUNDLE_QTY);
      expect(five.amount, f.id).toBeLessThan(one.amount * 5);
      expect(five.amount, f.id).toBeGreaterThanOrEqual(one.amount * 4);
    }
  });
});

describe('D48 saves', () => {
  /** A player from before D48: decorations out and hidden, food in the pantry, a learned trick, coins. */
  function oldSave() {
    const s = defaultSave(new Date(2026, 9, 1, 12));
    grant(s, 'test:coins', 900, 'gift', NOW);
    s.inventory.decor.scarecrow = { ownedAt: '2026-10-02T10:00:00.000Z' };
    s.inventory.decor.tractor = { ownedAt: '2026-10-02T10:00:00.000Z' };
    s.inventory.companions.cotton = { unlockedAt: '2026-10-01T11:00:00.000Z' };
    grantItem(s, 'test:hay', 'food', 3, 'gift', NOW, undefined, 'hay');
    s.inventory.tricks.spin = { ownedAt: '2026-10-03T10:00:00.000Z' };
    return s;
  }

  it('a save from before D48 loads untouched and gains none of D48’s records', () => {
    const s = oldSave();
    const back = roundTrip(s);
    expect(JSON.stringify(back)).toBe(JSON.stringify(roundTrip(back)));
    expect(back.inventory.bowls).toBeUndefined();
    expect(back.sanctuary.bowl).toBeUndefined();
    expect(back.world.celebrations).toBeUndefined();
    expect(back.inventory.decor.scarecrow).toEqual(s.inventory.decor.scarecrow);
    expect(foodCount(back, 'hay')).toBe(3);
    expect(ownsTrick(back, 'spin')).toBe(true);
    // The two free D48 ones are known straight away; nothing else new is owned.
    expect(ownsTrick(back, 'wiggle')).toBe(true);
    expect(ownsTrick(back, 'tailchase')).toBe(false);
    expect(balance(back)).toBe(900);
  });

  it('a save with everything D48 round-trips exactly, and each purchase was charged once', () => {
    const s = oldSave();
    expect(buyFood(s, 'oats', { offer: 'five', now: NOW })).toBe('ok');
    expect(buyBowl(s, 'patchwork', NOW)).toBe('ok');
    expect(chooseBowl(s, 'patchwork')).toBe(true);
    expect(buyDecor(s, 'flowerarch', NOW)).toBe('ok');
    expect(buyTrick(s, 'tailchase', NOW)).toBe('ok');
    assignCelebration(s, 'cotton');
    const spent = 900 - balance(s);
    expect(spent).toBe(45 + 150 + 180 + 100);
    const back = roundTrip(s);
    expect(JSON.stringify(back)).toBe(JSON.stringify(roundTrip(back)));
    expect(foodCount(back, 'oats')).toBe(5);
    expect(ownsBowl(back, 'patchwork')).toBe(true);
    expect(back.sanctuary.bowl).toBe('patchwork');
    expect(back.inventory.decor.flowerarch).toBeTruthy();
    expect(ownsTrick(back, 'tailchase')).toBe(true);
    expect(celebrationOf(back, 'cotton')).toBe(celebrationOf(s, 'cotton'));
    expect(balance(back)).toBe(900 - spent);
    // Retried purchases (a double tap, a crash mid-write) never charge twice.
    buyBowl(back, 'patchwork', NOW);
    buyTrick(back, 'tailchase', NOW);
    expect(balance(back)).toBe(900 - spent);
  });

  it('ids a newer build might write are kept as they are and never used', () => {
    const s = oldSave() as ReturnType<typeof oldSave> & { inventory: Record<string, unknown> };
    s.inventory.decor.hotairballoon = { ownedAt: '2027-01-01T00:00:00.000Z' };
    s.inventory.tricks.cartwheel = { ownedAt: '2027-01-01T00:00:00.000Z' };
    s.inventory.bowls = { crystal: { ownedAt: '2027-01-01T00:00:00.000Z' } };
    s.sanctuary.bowl = 'crystal';
    s.world.celebrations = { last: 'fireworks', by: { cotton: 'fireworks' } };
    const back = roundTrip(s);
    expect(back.inventory.decor.hotairballoon).toBeTruthy();
    expect(back.inventory.tricks.cartwheel).toBeTruthy();
    expect(back.inventory.bowls?.crystal).toBeTruthy();
    expect(back.world.celebrations?.by.cotton).toBe('fireworks');
    expect(celebrationOf(back, 'cotton')).toBeNull();
    // A whole themed set still goes out together, whatever else is owned.
    for (const d of setPieces('camp')) back.inventory.decor[d.id] = { ownedAt: '2026-11-01T00:00:00.000Z' };
    showSet(back, 'camp');
    expect(setProgress(back, 'camp')).toMatchObject({ complete: true, together: true });
  });
});
