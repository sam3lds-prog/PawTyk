// @vitest-environment happy-dom
/**
 * D50 PR D: release checks for D50, and the D51-B economy model.
 *  - Saves: a save from before D50 loads untouched and gains nothing; D50's one new record (the Shop's last few tries)
 *    round-trips; the purchase ids, the bundle id and the no-interstitials rule are as they were.
 *  - The economy model reads the game's real numbers, is ordered sensibly across its three play patterns, and says
 *    what the plan expects of today's economy (a piece the animals use within a day's play; coins a long goal, not a
 *    wall; lives and hints earned faster than used; food a small share).
 */
import { describe, expect, it } from 'vitest';
import { defaultSave, normalizeSave, TRIED_MAX } from '../../src/services/storage';
import { noteTried } from '../../src/meta/featured';
import { SCENARIOS, daysToSave, errandYield, gameCatalog, runScenario } from '../../src/meta/economyModel';
import { ITEM_CAP, OVERFLOW_COINS, STARTER_ITEMS } from '../../src/meta/items';
import { DAILY_POOL } from '../../src/meta/missions';
import { ECONOMY } from '../../src/config/economy';
import { activityFor } from '../../src/ui/art/activities';
import { PRODUCT_CATALOG } from '../../src/services/iap';
import { INTERSTITIALS_ENABLED } from '../../src/services/ads';
import capacitor from '../../capacitor.config';

const NOW = new Date(2026, 10, 11, 12);
const roundTrip = <T>(s: T) => normalizeSave(JSON.parse(JSON.stringify(s)), NOW);

describe('D50 saves', () => {
  it('a save from before D50 loads untouched and gains no new record', () => {
    const s = defaultSave(NOW);
    s.offers = { welcome: { shown: 2, lastAt: NOW.toISOString(), dismissed: false } };
    const back = roundTrip(s);
    expect(back.offers).toEqual({ welcome: { shown: 2, lastAt: NOW.toISOString(), dismissed: false } });
    expect(back.offers?.tried).toBeUndefined();
    expect(roundTrip(back)).toEqual(back);
  });

  it('the Shop’s tries (the one thing D50 keeps) round-trip, capped, newest first', () => {
    const s = defaultSave(NOW);
    for (const id of ['a1', 'b2', 'c3', 'd4', 'e5', 'f6', 'g7']) noteTried(s, 'decor', id);
    expect(s.offers?.tried).toHaveLength(TRIED_MAX);
    expect(roundTrip(s).offers?.tried).toEqual(s.offers?.tried);
  });

  it('nothing D50 did touches what ships: product ids, the bundle id, no interstitials', () => {
    expect(PRODUCT_CATALOG.map((p) => p.id)).toEqual(expect.arrayContaining(['gems_60', 'gems_160', 'gems_420']));
    expect(capacitor.appId).toBe('com.sam3lds.catsvsdogs');
    expect(INTERSTITIALS_ENABLED).toBe(false);
  });
});

describe('the economy model (D51-B)', () => {
  const cat = gameCatalog((id) => !!activityFor(id));
  const [low, base, high] = SCENARIOS.map((s) => runScenario(s, cat));

  it('reads the game’s own numbers: the Farm’s coin pieces, the ones the animals use, prices for every currency', () => {
    expect(cat.farmDecor.length).toBeGreaterThan(5);
    expect(cat.farmDecor.some((d) => d.interactive)).toBe(true);
    expect(cat.coinTricks.length).toBeGreaterThan(0);
    expect(cat.tokenPrices.every((p) => p > 0)).toBe(true);
    expect(cat.gemPrices.every((p) => p > 0)).toBe(true);
    expect(cat.typicalMeal).toBeGreaterThan(0);
    // A first clear is the model's main source, at exactly the configured amount.
    expect(base.coins.firstClears).toBeCloseTo(SCENARIOS[1].sessionsPerDay * SCENARIOS[1].newLevelsPerSession * ECONOMY.journeyFirstClear, 5);
  });

  it('errands: "Solve any board" first, then the average of the rest', () => {
    const rest = DAILY_POOL.filter((m) => m.id !== 'solve1');
    const avg = rest.reduce((a, m) => a + m.coins, 0) / rest.length;
    expect(errandYield(0).coins).toBe(0);
    expect(errandYield(1).coins).toBe(DAILY_POOL[0].coins);
    expect(errandYield(3).coins).toBeCloseTo(DAILY_POOL[0].coins + 2 * avg, 5);
  });

  it('a full pantry pays its overflow as coins, from the day it fills (Codex review on #76)', () => {
    for (const r of [low, base, high]) {
      const n = r.scenario.name;
      expect(r.pantry.overflowPerDay, n).toBeCloseTo(Math.max(0, r.lives.net) * OVERFLOW_COINS + Math.max(0, r.hints.net) * OVERFLOW_COINS, 0);
      expect(r.pantry.coinsPerDayOnceFull, n).toBeCloseTo(r.coins.total + r.pantry.overflowPerDay, 0);
      expect(r.pantry.livesFullInDays, n).toBeCloseTo((ITEM_CAP.life - STARTER_ITEMS.life) / r.lives.net, 0);
    }
    // Saving up: the slower rate until the switch, the faster one after.
    expect(daysToSave(100, 10, 20, 5)).toBe(7.5);
    expect(daysToSave(40, 10, 20, 5)).toBe(4);
    expect(daysToSave(100, 10, 20, null)).toBe(10);
    expect(daysToSave(100, 0, 0, null)).toBe(Infinity);
  });

  it('three patterns, in order: more play earns more and gets there sooner', () => {
    expect(low.coins.total).toBeLessThan(base.coins.total);
    expect(base.coins.total).toBeLessThan(high.coins.total);
    expect(low.daysTo.everythingForCoins).toBeGreaterThan(base.daysTo.everythingForCoins);
    expect(base.daysTo.everythingForCoins).toBeGreaterThan(high.daysTo.everythingForCoins);
  });

  it('what today’s economy looks like (the plan’s premises, as numbers)', () => {
    for (const r of [low, base, high]) {
      const n = r.scenario.name;
      // The first piece the animals use is within a couple of days' play, even for a light player.
      expect(r.daysTo.firstInteractiveFarmPiece, n).toBeLessThanOrEqual(2);
      // Everything for coins is a long goal (over a week), never a wall (under four months).
      expect(r.daysTo.everythingForCoins, n).toBeGreaterThan(7);
      expect(r.daysTo.everythingForCoins, n).toBeLessThan(120);
      // Lives and hints are earned faster than used: no case for selling revives.
      expect(r.lives.net, n).toBeGreaterThan(0);
      expect(r.hints.net, n).toBeGreaterThan(0);
      // Feeding is a small share of what a player earns.
      expect(r.food.share, n).toBeLessThan(0.15);
    }
    // Without videos, nothing for tokens is reachable (the tier stays optional).
    expect(low.tokens.daysToDearest).toBeNull();
  });
});
