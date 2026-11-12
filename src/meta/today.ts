/**
 * Today on the Journey (D49 PR D): for a player back for a few minutes, the hub shows one goal (the hero: the home
 * being built, who is on the way, and Play or Resume) and, under it, **at most two** optional things worth doing today,
 * picked from what the save already holds:
 *
 *  1. a Daily or Zen board left in progress (the player's own work comes first);
 *  2. today's Daily Puzzle, if it isn't solved yet;
 *  3. an animal close to what friendship brings next (a warmer hello, a beaming smile…) that hasn't had today's hello;
 *  4. something new in a home other than the one the hero shows.
 *
 * Nothing here is a chore: there is no "you missed", no countdown, no streak warning and nothing that expires. Skipping
 * all of it costs nothing (hearts never decay, D40). Pure: the hub draws what this returns.
 */

import type { SaveV2 } from '../services/storage';
import type { ModeRef } from '../game/modes';
import { localDateKey } from '../game/dates';
import { animalInfo, homeAnimals, type AnimalId } from './animals';
import { nextUnlock } from './bonds';
import { friendship } from './feeding';
import { pattedToday } from './sanctuary';
import { isOpen, unseenIn, worldIds } from './world';
import type { SanctuaryId } from './catalogs/sanctuaries';

/** At most this many optional things, under the one goal. */
export const TODAY_MAX = 2;
/** An animal this close (in hearts) to its next unlock is worth a hello today: one hello and one pat cover it. */
export const NEAR_HEARTS = 2;

export type TodayItem =
  | { kind: 'resume'; mode: ModeRef }
  | { kind: 'daily' }
  | {
      kind: 'friend';
      animal: AnimalId;
      home: SanctuaryId;
      unlock: string;
      hearts: number;
      /** D50 PR C: the friendship level it reaches ("Friend", "Good friend"…). */
      level: string;
      /** D50 PR C: what today takes, in the order to do it: a hello in the scene, then a pat on its card. */
      needs: ReadonlyArray<'hello' | 'pat'>;
    }
  | { kind: 'news'; home: SanctuaryId };

export interface TodayInput {
  /** Daily or Zen boards in progress (the Journey's own is the hero's Resume). */
  saved: ModeRef[];
  dailyDone: boolean;
  /** The home the hero shows (its news is there already). */
  heroHome: SanctuaryId | null;
  now?: Date;
}

/**
 * An animal at home that hasn't had today's hello, closest to what friendship brings next, **and close enough that today
 * gets it there**: a hello in the scene is one heart and a pat on its card another (each once a day, D40), so the row
 * only promises what the player can actually do now. D50 PR C: it says which of the two it takes.
 */
export function friendToGreet(save: SaveV2, now = new Date()): Extract<TodayItem, { kind: 'friend' }> | null {
  const today = localDateKey(now);
  let best: Extract<TodayItem, { kind: 'friend' }> | null = null;
  for (const home of worldIds(save)) {
    if (!isOpen(save, home)) continue;
    for (const a of homeAnimals(save, home)) {
      if (save.sanctuary.greeted[a] === today) continue;
      const n = nextUnlock(save, a);
      if (!n || n.hearts > NEAR_HEARTS) continue;
      const canPat = !pattedToday(save, a, now);
      const needs: Array<'hello' | 'pat'> = n.hearts === 1 ? ['hello'] : canPat ? ['hello', 'pat'] : [];
      if (needs.length < n.hearts) continue;
      const level = friendship((save.sanctuary.affection[a] ?? 0) + n.hearts).name;
      if (!best || n.hearts < best.hearts) best = { kind: 'friend', animal: a, home: animalInfo(a).sanctuary, unlock: n.name, hearts: n.hearts, level, needs };
    }
  }
  return best;
}

/**
 * D50 PR C: the friend row's words, saying what the next thing to do accomplishes:
 * "Say hello to Truffle" / "One hello at the Farm and you're Friends: a warmer hello."
 */
export function friendRowText(it: Extract<TodayItem, { kind: 'friend' }>, place: string): { title: string; sub: string } {
  const a = animalInfo(it.animal);
  const what = it.unlock.charAt(0).toLowerCase() + it.unlock.slice(1);
  const takes = it.needs.length === 1 ? `One hello at the ${place}` : `A hello at the ${place} and a pat on ${a.name}’s card`;
  const level = it.level === 'Family' ? 'family' : `${it.level.toLowerCase()}s`;
  return { title: `Say hello to ${a.name}`, sub: `${takes} and you’re ${level}: ${what}.` };
}

export function todayItems(save: SaveV2, o: TodayInput): TodayItem[] {
  const now = o.now ?? new Date();
  const out: TodayItem[] = o.saved.map((mode) => ({ kind: 'resume', mode }) as const);
  // A Daily already in progress is its own Resume line.
  if (!o.dailyDone && !o.saved.some((m) => m.kind === 'daily')) out.push({ kind: 'daily' });
  const friend = friendToGreet(save, now);
  if (friend) out.push(friend);
  const news = worldIds(save).find((id) => id !== o.heroHome && isOpen(save, id) && !!unseenIn(save, id));
  if (news) out.push({ kind: 'news', home: news });
  return out.slice(0, TODAY_MAX);
}
