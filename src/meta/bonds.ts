/**
 * Bonding (D40 PR B): what each friendship level gives. Hearts of affection come from a hello in the scene, a pat on
 * the card and food, each counting once a day (food up to its own daily amount), and they never go down: there is no
 * decay, no penalty and nothing to keep up. Missing a day only means the next heart comes later.
 *
 *  - Friend (5 hearts): a warmer hello, with a heart and one more note in its sound
 *  - Good friend (15): a new expression, a beaming smile when it sees you
 *  - Best friend (35): its portrait in the album
 *  - Family (70): a golden frame for that portrait
 *
 * Cosmetic only: nothing here touches puzzles, coins or rewards.
 */

import type { SaveV2 } from '../services/storage';
import { localDateKey } from '../game/dates';
import { friendship, type Friendship } from './feeding';

export type BondUnlock = 'greeting' | 'expression' | 'portrait' | 'frame';

/** What each level adds (index = friendship level). */
export const BOND_UNLOCKS: ReadonlyArray<{ unlock: BondUnlock; name: string; short: string; line: (name: string) => string } | null> = [
  null,
  { unlock: 'greeting', name: 'A warmer hello', short: 'Warmer hello', line: (n) => `${n} has a warmer hello for you now.` },
  { unlock: 'expression', name: 'A beaming smile', short: 'Beaming smile', line: (n) => `${n} beams whenever you say hello.` },
  { unlock: 'portrait', name: 'A portrait for your album', short: 'Album portrait', line: (n) => `${n}’s portrait is in your album.` },
  { unlock: 'frame', name: 'A golden frame', short: 'Golden frame', line: (n) => `${n}’s portrait has a golden frame.` },
];

export const BEST_FRIEND_LEVEL = 3;

export function affectionOf(save: Pick<SaveV2, 'sanctuary'>, id: string): number {
  return save.sanctuary.affection[id] ?? 0;
}

/** An animal's friendship level (0 = new friend). */
export function bondLevel(save: Pick<SaveV2, 'sanctuary'>, id: string): number {
  return friendship(affectionOf(save, id)).level;
}

/** Whether a level's unlock is already the animal's. */
export function hasUnlock(save: Pick<SaveV2, 'sanctuary'>, id: string, u: BondUnlock): boolean {
  const lvl = BOND_UNLOCKS.findIndex((x) => x?.unlock === u);
  return lvl > 0 && bondLevel(save, id) >= lvl;
}

/** The next thing a friendship will bring, and the hearts still to go (null at the top). */
export function nextUnlock(save: Pick<SaveV2, 'sanctuary'>, id: string): { name: string; level: string; hearts: number } | null {
  const f = friendship(affectionOf(save, id));
  const u = BOND_UNLOCKS[f.level + 1];
  if (!u || f.next === null) return null;
  return { name: u.name, level: friendship(f.next).name, hearts: f.next - affectionOf(save, id) };
}

export interface BondNews {
  id: string;
  level: Friendship;
  unlock: BondUnlock;
  line: string;
}

/**
 * Called after any change to an animal's hearts, with the hearts it had before: when that crossed a level, says what
 * it unlocked (and remembers the day it became a best friend, for its portrait). Null otherwise.
 */
export function bondNews(save: SaveV2, id: string, before: number, name: string, now = new Date()): BondNews | null {
  const was = friendship(before).level;
  const f = friendship(affectionOf(save, id));
  if (f.level <= was) return null;
  if (f.level >= BEST_FRIEND_LEVEL && !save.sanctuary.bestSince[id]) save.sanctuary.bestSince[id] = now.toISOString();
  const u = BOND_UNLOCKS[f.level]!;
  return { id, level: f, unlock: u.unlock, line: u.line(name) };
}

/** A hello in a scene: one heart, once a day per animal. Returns whether it counted. */
export function helloFriend(save: SaveV2, id: string, now = new Date()): boolean {
  const day = localDateKey(now);
  if (save.sanctuary.greeted[id] === day) return false;
  save.sanctuary.greeted[id] = day;
  save.sanctuary.affection[id] = affectionOf(save, id) + 1;
  return true;
}

/**
 * Best friends' portraits for the album, in the order they became best friends. A friendship that got there before
 * portraits existed (no date) still has its portrait, listed first.
 */
export function portraits(save: Pick<SaveV2, 'sanctuary'>, isHome: (id: string) => boolean): Array<{ id: string; since: string; golden: boolean }> {
  return Object.keys(save.sanctuary.affection)
    .filter((id) => isHome(id) && bondLevel(save, id) >= BEST_FRIEND_LEVEL)
    .map((id) => ({ id, since: save.sanctuary.bestSince[id] ?? '', golden: bondLevel(save, id) >= BEST_FRIEND_LEVEL + 1 }))
    .sort((a, b) => a.since.localeCompare(b.since));
}
