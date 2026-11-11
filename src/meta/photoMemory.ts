/**
 * Photo Memory (M3): "Capture a memory this week." The first postcard the player makes in a week earns 30 Paw Coins.
 *
 *  - Earned by making the postcard, not by sharing it: saving it, sharing it or keeping it to themselves are all the
 *    same, and no social post, tag or review is ever asked for or rewarded.
 *  - Once per local week (Monday to Sunday on the player's own calendar, the same weeks as the weekly errand), by one
 *    coin-ledger entry named for the week: a second postcard, a repeated tap, a retried callback or a reload can never
 *    grant it twice.
 *  - Optional: a week without a postcard costs nothing, and there is no streak to keep.
 *  - Coins only: nothing in a puzzle, a ranking or the Paw Cup changes.
 */

import { localDateKey, localWeekStart } from '../game/dates';
import { grant, hasEntry } from './ledger';
import type { SaveV2 } from '../services/storage';

export const PHOTO_MEMORY_COINS = 30;

/** The week a moment falls in: its Monday's local date. */
export function photoMemoryWeek(now = new Date()): string {
  return localWeekStart(localDateKey(now));
}

const entryId = (week: string) => `photo-memory:${week}`;

/** Whether this week's Photo Memory has been earned. */
export function photoMemoryDone(save: Pick<SaveV2, 'inventory'>, now = new Date()): boolean {
  return hasEntry(save, entryId(photoMemoryWeek(now)));
}

/**
 * Called when a postcard has been made: grants this week's coins if they haven't been. Returns the coins granted (0 if
 * already earned this week).
 */
export function claimPhotoMemory(save: Pick<SaveV2, 'inventory'>, now = new Date()): number {
  return grant(save, entryId(photoMemoryWeek(now)), PHOTO_MEMORY_COINS, 'mission', now, 'Photo Memory') ? PHOTO_MEMORY_COINS : 0;
}
