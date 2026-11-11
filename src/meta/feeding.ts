/**
 * Buying food and feeding residents and wildlife friends. Cosmetic only: feeding adds affection (a friendship level on
 * the animal's card) and makes the animal happy in the garden. Nothing here touches puzzles, rewards or rankings.
 *
 * Food is kept in the item ledger (`food` entries with a `ref`), bought with Paw Coins or video tokens, and every buy
 * and every meal has its own id, so a double tap can't charge or feed twice by accident.
 */

import type { SaveV2 } from '../services/storage';
import { localDateKey } from '../game/dates';
import { BOWLS, BOWL_BY_ID, FOODS, FOOD_BY_ID, foodOffers, isBowlId, isFavorite, isFeast, type AnimalKind, type BowlId, type FoodId, type FoodOffer } from './catalogs/foods';
import { sanctuaryDef, type SanctuaryId } from './catalogs/sanctuaries';
import { isHome, type AnimalId } from './animals';
import { hasItemEntry } from './items';
import { hasEntry } from './ledger';
import { PET_BY_ID, isPetId } from './catalogs/pets';
import { COMPANION_BY_ID, isCompanionId } from './catalogs/companions';
import { isWildId, wildDef } from './catalogs/places';
import { balance, spend } from './ledger';
import { grantItem, itemBalance, refBalance, spendItem } from './items';

/** At most this many of one food in the pantry. */
export const FOOD_CAP_EACH = 30;
/** Affection an animal can gain from food per day (pats are separate, one a day). */
export const FOOD_AFFECTION_PER_DAY = 6;

let seq = 0;
const uid = (now: Date) => `${now.getTime().toString(36)}${(seq++).toString(36)}`;

export function foodCount(save: Pick<SaveV2, 'inventory'>, food: FoodId): number {
  return refBalance(save, 'food', food);
}

export type BuyFoodResult = 'ok' | 'insufficient' | 'full' | 'not-for-sale';

/** How much room is left for a food in the pantry. */
export function foodRoom(save: Pick<SaveV2, 'inventory'>, food: FoodId): number {
  return Math.max(0, FOOD_CAP_EACH - foodCount(save, food));
}

/**
 * Buys a food (D48 PR B: by one of its offers: one portion, a bundle of five, or for gems). `o` may be the date, as
 * before D48, which buys one portion the main way.
 *
 * Exactly once: the spend and the grant share one purchase id (`buy:food:<food>:<offer>:<n>`), in the coin or item
 * ledger, so a double tap is two purchases only if the player tapped twice, never one charge granted twice, and a
 * crash between the two writes can't grant without charging (the grant is written right after its own spend, in the
 * same save). A bundle that wouldn't fit in the pantry isn't sold (nothing is charged for food that can't be kept).
 */
export function buyFood(save: SaveV2, food: FoodId, o: Date | { offer?: FoodOffer['id']; now?: Date } = {}): BuyFoodResult {
  const { offer: which = undefined, now = new Date() } = o instanceof Date ? { now: o } : o;
  const f = FOOD_BY_ID[food];
  if (!f) return 'not-for-sale';
  const offers = foodOffers(f);
  const offer = which ? offers.find((x) => x.id === which) : offers[0];
  if (!offer) return 'not-for-sale';
  if (foodRoom(save, food) < offer.qty) return 'full';
  const id = `buy:food:${food}:${offer.id}:${uid(now)}`;
  if (offer.currency === 'coins') {
    if (balance(save) < offer.amount) return 'insufficient';
    if (spend(save, id, offer.amount, 'shop', now, f.name) !== 'ok') return 'insufficient';
  } else {
    if (itemBalance(save, offer.currency) < offer.amount) return 'insufficient';
    if (spendItem(save, id, offer.currency, offer.amount, now, f.name) !== 'ok') return 'insufficient';
  }
  grantItem(save, `${id}:got`, 'food', offer.qty, 'shop', now, f.name, food);
  return 'ok';
}

/** Whether a food can be bought now with this offer (in stock room and in the wallet). */
export function canBuyFood(save: Pick<SaveV2, 'inventory'>, food: FoodId, offer: FoodOffer): boolean {
  const have = offer.currency === 'coins' ? balance(save) : itemBalance(save, offer.currency);
  return have >= offer.amount && foodRoom(save, food) >= offer.qty;
}

/** The kind of animal a resident or companion is, for food favorites. */
export function animalKindOf(id: string): AnimalKind | null {
  if (isPetId(id)) return PET_BY_ID[id].species;
  if (isCompanionId(id)) return COMPANION_BY_ID[id].animal;
  if (isWildId(id)) return wildDef(id).animal;
  return null;
}

/**
 * D49 PR C: `firstMeal`: the animal had never eaten before (since D49 kept track); `firstTaste`: never this food.
 */
export type FeedResult = { ok: true; gained: number; favorite: boolean; firstMeal: boolean; firstTaste: boolean } | { ok: false; reason: 'no-food' | 'full' | 'unknown' | 'feast' };

/** D49 PR C: notes that `animal` has eaten `food`; returns whether that was its first meal, and its first of this food. */
function noteTaste(save: SaveV2, animal: string, food: FoodId): { firstMeal: boolean; firstTaste: boolean } {
  const tasted = (save.sanctuary.tasted ??= {});
  const had = tasted[animal];
  const firstMeal = !had?.length;
  const firstTaste = !had?.includes(food);
  if (firstTaste) tasted[animal] = [...(had ?? []), food];
  return { firstMeal, firstTaste };
}

export type MealStyle = 'full' | 'quick';

/**
 * D49 PR C, smart feeding: how a meal plays. In full (about 3.6 s: the camera comes close, three bites, the reaction)
 * when it means something: an animal's first meal, its first taste of a favorite, or a meal that lifts the friendship
 * a level; a quick one (about a second: the bowl, a bite, hearts) for an ordinary repeat. `pref` 'full' (Settings →
 * Meals) always plays it in full.
 */
export function mealStyle(pref: 'smart' | 'full', m: { firstMeal: boolean; firstTaste: boolean; favorite: boolean; levelUp: boolean }): MealStyle {
  if (pref === 'full') return 'full';
  return m.firstMeal || m.levelUp || (m.favorite && m.firstTaste) ? 'full' : 'quick';
}

/** Affection gained from food today by one animal. */
export function fedToday(save: Pick<SaveV2, 'sanctuary'>, animal: string, now = new Date()): number {
  const f = save.sanctuary.fed[animal];
  return f && f.day === localDateKey(now) ? f.n : 0;
}

/**
 * Gives one portion to an animal. A favorite counts double; special treats are everyone's favorite. Once an animal has
 * had its fill for the day it politely declines and the food stays in the pantry.
 */
export function feedAnimal(save: SaveV2, animal: string, food: FoodId, now = new Date()): FeedResult {
  const kind = animalKindOf(animal);
  if (!kind) return { ok: false, reason: 'unknown' };
  const f = FOOD_BY_ID[food];
  // A feast is served to a whole home (`serveFeast`), not to one animal.
  if (isFeast(f)) return { ok: false, reason: 'feast' };
  const left = FOOD_AFFECTION_PER_DAY - fedToday(save, animal, now);
  if (left <= 0) return { ok: false, reason: 'full' };
  if (foodCount(save, food) < 1) return { ok: false, reason: 'no-food' };
  if (spendItem(save, `feed:${animal}:${uid(now)}`, 'food', 1, now, f.name, food) !== 'ok') return { ok: false, reason: 'no-food' };
  const favorite = isFavorite(f, kind);
  const gained = Math.min(left, f.favorites === 'all' ? f.affection : f.affection * (favorite ? 2 : 1));
  const day = localDateKey(now);
  const prev = save.sanctuary.fed[animal];
  save.sanctuary.fed[animal] = { day, n: (prev && prev.day === day ? prev.n : 0) + gained };
  save.sanctuary.affection[animal] = (save.sanctuary.affection[animal] ?? 0) + gained;
  return { ok: true, gained, favorite, ...noteTaste(save, animal, food) };
}

/** Adds food affection for today, within the daily limit. Returns what was added. */
function addFoodAffection(save: SaveV2, animal: string, want: number, now: Date): number {
  const left = FOOD_AFFECTION_PER_DAY - fedToday(save, animal, now);
  const gained = Math.max(0, Math.min(left, want));
  if (!gained) return 0;
  const day = localDateKey(now);
  const prev = save.sanctuary.fed[animal];
  save.sanctuary.fed[animal] = { day, n: (prev && prev.day === day ? prev.n : 0) + gained };
  save.sanctuary.affection[animal] = (save.sanctuary.affection[animal] ?? 0) + gained;
  return gained;
}

export type FeastResult =
  | { ok: true; fed: Array<{ animal: string; gained: number }> }
  | { ok: false; reason: 'no-food' | 'nobody' | 'full' | 'not-a-feast' };

/** Who a feast in `home` would feed: everyone living there now. */
export function feastGuests(save: SaveV2, home: SanctuaryId): string[] {
  return sanctuaryDef(home)
    .arrivals.map((a) => a.id as string)
    .filter((id) => isHome(save, id as AnimalId) && animalKindOf(id));
}

/**
 * Serves a feast to a whole home (D48 PR B): one portion, everyone living there gets its affection (each within its
 * own daily limit). Nothing is used up if nobody there has room for more today, or nobody lives there yet.
 */
export function serveFeast(save: SaveV2, home: SanctuaryId, food: FoodId, now = new Date()): FeastResult {
  const f = FOOD_BY_ID[food];
  if (!f || !isFeast(f)) return { ok: false, reason: 'not-a-feast' };
  const guests = feastGuests(save, home);
  if (!guests.length) return { ok: false, reason: 'nobody' };
  if (guests.every((g) => fedToday(save, g, now) >= FOOD_AFFECTION_PER_DAY)) return { ok: false, reason: 'full' };
  if (foodCount(save, food) < 1) return { ok: false, reason: 'no-food' };
  if (spendItem(save, `feast:${home}:${uid(now)}`, 'food', 1, now, f.name, food) !== 'ok') return { ok: false, reason: 'no-food' };
  return {
    ok: true,
    fed: guests.map((g) => {
      noteTaste(save, g, food);
      return { animal: g, gained: addFoodAffection(save, g, f.affection, now) };
    }),
  };
}

/** An animal's favorite foods (not the treats everyone loves), in catalog order. */
export function favoriteFoods(animal: string): FoodId[] {
  const kind = animalKindOf(animal);
  if (!kind) return [];
  return FOODS.filter((f) => f.favorites !== 'all' && isFavorite(f, kind)).map((f) => f.id);
}

/**
 * The food to suggest for an animal when the pantry has nothing for it (D48 PR B, "Get more food"): its first favorite
 * sold for coins, else the coin treat everyone loves.
 */
export function suggestedFood(animal: string): FoodId {
  return favoriteFoods(animal).find((id) => FOOD_BY_ID[id].coins) ?? 'harvestbasket';
}

// ------------------------------------------------------------------ bowls (D48 PR B)

/**
 * A bowl is owned once bought, for good. Ownership is read from the purchase in the coin or item ledger (both are kept
 * by every build), so a bowl survives a rollback to a build that doesn't know bowls; `inventory.bowls` is a cache.
 */
export function ownsBowl(save: Pick<SaveV2, 'inventory'>, id: BowlId): boolean {
  if (id === 'classic') return true;
  return !!save.inventory.bowls?.[id] || hasEntry(save, `buy:bowl:${id}`) || hasItemEntry(save, `buy:bowl:${id}`);
}

export type BuyBowlResult = 'ok' | 'owned' | 'insufficient' | 'not-for-sale';

/** Buys a bowl, once (`buy:bowl:<id>`), and puts it to use. */
export function buyBowl(save: SaveV2, id: BowlId, now = new Date()): BuyBowlResult {
  const b = BOWL_BY_ID[id];
  if (!b) return 'not-for-sale';
  if (ownsBowl(save, id)) return 'owned';
  const spendId = `buy:bowl:${id}`;
  const r = b.coins ? spend(save, spendId, b.coins, 'shop', now, b.name) : b.gems ? spendItem(save, spendId, 'gem', b.gems, now, b.name) : 'none';
  if (r === 'insufficient' || r === 'none') return 'insufficient';
  save.inventory.bowls = { ...(save.inventory.bowls ?? {}), [id]: { ownedAt: now.toISOString() } };
  save.sanctuary.bowl = id;
  return 'ok';
}

/** The bowl meals are served in: the one chosen, if still owned; the wooden bowl otherwise. */
export function bowlInUse(save: Pick<SaveV2, 'inventory' | 'sanctuary'>): BowlId {
  const b = save.sanctuary.bowl;
  return isBowlId(b) && ownsBowl(save, b) ? b : 'classic';
}

export function chooseBowl(save: SaveV2, id: BowlId): boolean {
  if (!ownsBowl(save, id)) return false;
  save.sanctuary.bowl = id;
  return true;
}

export const ALL_BOWLS = BOWLS;

export interface Friendship {
  level: number;
  name: string;
  /** Affection where the next level starts (null at the top). */
  next: number | null;
  from: number;
}

const LEVELS: Array<[string, number]> = [
  ['New friend', 0],
  ['Friend', 5],
  ['Good friend', 15],
  ['Best friend', 35],
  ['Family', 70],
];

export function friendship(affection: number): Friendship {
  let i = 0;
  while (i + 1 < LEVELS.length && affection >= LEVELS[i + 1][1]) i++;
  return { level: i, name: LEVELS[i][0], from: LEVELS[i][1], next: i + 1 < LEVELS.length ? LEVELS[i + 1][1] : null };
}
