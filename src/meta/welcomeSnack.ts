/**
 * A newcomer's welcome snack (D49 PR A): right after an animal comes home, the player can give it something to eat
 * from the arrival's own card, in one tap, instead of finding feeding through the animal's card later.
 *
 * - What it eats: something already in the pantry that it can have (its favorites first, then the treats everyone
 *   loves, then anything else; never a feast, which is for a whole home).
 * - With nothing in the pantry, the very first snack is on the house: one portion of its favorite (or the treat
 *   everyone loves), granted once per player through the item ledger (`gift:welcome-snack`), so a double tap, a
 *   reload or a second arrival can never grant it twice. After that, a welcome with an empty pantry offers a hello.
 * - The meal itself is an ordinary meal (`feedAnimal`): the same daily limit, the same hearts.
 */

import type { SaveV2 } from '../services/storage';
import { FOODS, FOOD_BY_ID, isFavorite, isFeast, type FoodId } from './catalogs/foods';
import { animalKindOf, feedAnimal, fedToday, foodCount, FOOD_AFFECTION_PER_DAY, suggestedFood, type FeedResult } from './feeding';
import { grantItem, hasItemEntry } from './items';

/** The one item-ledger entry for the free first snack. */
export const WELCOME_SNACK_ID = 'gift:welcome-snack';

export interface WelcomeSnack {
  food: FoodId;
  /** The free first snack (nothing in the pantry yet). */
  gift: boolean;
}

/** Whether the free first snack is still to come for this player. */
export function welcomeGiftLeft(save: Pick<SaveV2, 'inventory'>): boolean {
  return !hasItemEntry(save, WELCOME_SNACK_ID);
}

/** What `animal`'s welcome snack would be now, or null (it has had plenty today, or there is nothing to give). */
export function welcomeSnack(save: SaveV2, animal: string, now = new Date()): WelcomeSnack | null {
  const kind = animalKindOf(animal);
  if (!kind) return null;
  if (fedToday(save, animal, now) >= FOOD_AFFECTION_PER_DAY) return null;
  const rank = (id: FoodId) => {
    const f = FOOD_BY_ID[id];
    return f.favorites === 'all' ? 1 : isFavorite(f, kind) ? 0 : 2;
  };
  const pantry = FOODS.filter((f) => !isFeast(f) && foodCount(save, f.id) > 0)
    .map((f) => f.id)
    .sort((a, b) => rank(a) - rank(b));
  if (pantry.length) return { food: pantry[0], gift: false };
  if (!welcomeGiftLeft(save)) return null;
  return { food: suggestedFood(animal), gift: true };
}

export type WelcomeSnackResult = (FeedResult & { food: FoodId; gift: boolean }) | null;

/** Gives the welcome snack: the free portion first if it is the gift (once), then an ordinary meal. */
export function giveWelcomeSnack(save: SaveV2, animal: string, now = new Date()): WelcomeSnackResult {
  const s = welcomeSnack(save, animal, now);
  if (!s) return null;
  if (s.gift) grantItem(save, WELCOME_SNACK_ID, 'food', 1, 'gift', now, FOOD_BY_ID[s.food].name, s.food);
  return { ...feedAnimal(save, animal, s.food, now), food: s.food, gift: s.gift };
}
