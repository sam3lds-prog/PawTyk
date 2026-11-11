/**
 * Tester shortcuts, so a tester on a phone can reach later content without playing every level first.
 * Only in development builds and in the tester preview (`npm run artifact -- --qa`); never in a release build
 * (`featureFlags.qaTools`). Everything here edits the local save the same way real play would; rewards for the skipped
 * levels then arrive through the normal startup catch-up (chapter gifts, Paw Points), once. Animals come home through
 * sanctuary growth (D35), so `growActive` solves puzzles for the sanctuary being built.
 */

import type { SaveV2 } from '../services/storage';
import { itemBalance, type PantryItem } from '../meta/items';
import { FIRST_PAIR_LEVEL } from '../game/modes';
import { creditSolve, growOnSolve, isComplete, isOpen, openRegions, worldIds } from '../meta/world';
import type { AnimalId } from '../meta/animals';
import { grant } from '../meta/ledger';
import { COMPANIONS } from '../meta/catalogs/companions';
import { CELEBRATIONS, celebrationOf, type CelebrationId } from '../meta/celebrations';

/**
 * Marks levels 1..(next-1) solved (clean, three stars, one minute each) and makes `next` the next level. The skipped
 * levels count as having grown the world (growth policy 2, D38), so replaying them grows nothing — as if they were played.
 */
export function skipToLevel(save: SaveV2, next: number, now = new Date()): void {
  const at = now.toISOString();
  for (let L = 1; L < next; L++) {
    const key = `L${L}`;
    (save.world.grown ??= {})[key] ??= at;
    if (save.journey.clears[key]) continue;
    save.journey.clears[key] = { firstClearAt: at, bestSeconds: 60, bestMistakes: 0, clean: true, hintFree: true, stars: 3 };
    save.journey.bestTimes[key] ??= 60;
  }
  save.journey.nextLevel = Math.max(save.journey.nextLevel, next);
  Object.assign(save.onboarding, { seenRules: true, tutorialDone: true, starterDecorChosen: true, soloRulesSeen: true });
  // Skipping past the two-animal lesson counts as having had it; skipping to it leaves it to play.
  if (save.journey.nextLevel > FIRST_PAIR_LEVEL) Object.assign(save.onboarding, { pairRulesSeen: true, pairLessonDone: true });
}

/** Counts `n` solved puzzles for the sanctuary being built (as real solves would); returns who came home. */
export function growActive(save: SaveV2, n: number, now = new Date()): AnimalId[] {
  const out: AnimalId[] = [];
  for (let i = 0; i < n; i++) out.push(...(growOnSolve(save, openRegions(save), now)?.arrived ?? []));
  return out;
}

/**
 * Finishes every home that is open (as if enough puzzles had been solved for each), which opens the next place of the
 * endless world at once (D39). Returns who came home.
 */
export function finishOpenHomes(save: SaveV2, now = new Date()): AnimalId[] {
  const out: AnimalId[] = [];
  const todo = worldIds(save).filter((id) => isOpen(save, id) && !isComplete(save, id));
  for (const id of todo)
    for (let g = 0; g < 200 && !isComplete(save, id); g++) out.push(...(creditSolve(save, { boardSanctuary: id, openedBefore: openRegions(save) }, now)?.arrived ?? []));
  return out;
}

/** Sets a pantry item to exactly `n` (recorded as a tester entry, so the ledger stays the source of truth). */
export function setPantry(save: SaveV2, item: PantryItem, n: number, now = new Date()): void {
  const delta = n - itemBalance(save, item);
  if (!delta) return;
  save.inventory.items.push({
    id: `qa:${item}:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`,
    item,
    delta,
    at: now.toISOString(),
    source: 'gift',
    note: 'Tester shortcut',
  });
}

/** D48: Paw Coins for trying the new tricks, foods and decorations (a tester gift in the coin ledger). */
export function giveCoins(save: SaveV2, n: number, now = new Date()): void {
  grant(save, `qa:coins:${now.getTime()}:${Math.random().toString(36).slice(2, 8)}`, n, 'gift', now, 'Tester shortcut');
}

/**
 * D48 PR E: a Farm animal at home, its welcome set to the next of the four celebrations in turn (Boogie, Meadow Hop,
 * Sparkle Surprise, Friendship Circle), so a tester can watch each one. Changes only that animal's record (never which
 * came last), as a replay would. Null if nobody is home on the Farm yet.
 */
export function nextWelcome(save: SaveV2): { animal: AnimalId; celebration: CelebrationId } | null {
  const animal = COMPANIONS.find((c) => c.sanctuary === 'farm' && save.inventory.companions[c.id])?.id;
  if (!animal) return null;
  const now = celebrationOf(save, animal);
  const i = now ? CELEBRATIONS.findIndex((c) => c.id === now) : -1;
  const celebration = CELEBRATIONS[(i + 1) % CELEBRATIONS.length].id;
  (save.world.celebrations ??= { by: {} }).by[animal] = celebration;
  return { animal: animal as AnimalId, celebration };
}
