/**
 * The welcome celebrations (D48 PR E). A new animal's arrival is played out as one of four presets, each with its own
 * music, choreography and finish: Barnyard Boogie (the D44 Welcome Parade), Meadow Hop, Sparkle Surprise and
 * Friendship Circle.
 *
 * Which one an animal gets is decided once, the first time its welcome plays, and kept: a replay (under the scene, or
 * from the animal's card) is the same celebration. The choice is deterministic (from the animal's id) and never the
 * same as the welcome before it, so two arrivals in a row always look and sound different.
 *
 * A celebration grants nothing: playing it, replaying it or skipping it changes nothing but this record.
 */

import type { SaveV2 } from '../services/storage';

export type CelebrationId = 'boogie' | 'meadowhop' | 'sparkle' | 'circle';

export interface CelebrationDef {
  id: CelebrationId;
  name: string;
  /** One line for the card's Replay button and the QA list. */
  blurb: string;
}

export const CELEBRATIONS: readonly CelebrationDef[] = [
  { id: 'boogie', name: 'Barnyard Boogie', blurb: 'The newcomer leaps in and everyone dances their own dance.' },
  { id: 'meadowhop', name: 'Meadow Hop', blurb: 'The newcomer hops in and everyone hops along, ending in one big leap.' },
  { id: 'sparkle', name: 'Sparkle Surprise', blurb: 'A twirl in a shower of stars, and everyone cheers.' },
  { id: 'circle', name: 'Friendship Circle', blurb: 'Everyone gathers round the newcomer and sways, with hearts.' },
];

export const CELEBRATION_BY_ID = Object.fromEntries(CELEBRATIONS.map((c) => [c.id, c])) as Record<CelebrationId, CelebrationDef>;

export function isCelebrationId(x: unknown): x is CelebrationId {
  return typeof x === 'string' && x in CELEBRATION_BY_ID;
}

/** FNV-1a, then mixed, so the four come round evenly across the game's animals (plain FNV-1a's low bits don't). */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  h ^= h >>> 16;
  h = Math.imul(h, 0x45d9f3b);
  h ^= h >>> 16;
  return h >>> 0;
}

/** The one this animal has had, if any (an id a newer build added and this one doesn't know counts as none). */
export function celebrationOf(save: Pick<SaveV2, 'world'>, animal: string): CelebrationId | null {
  const id = save.world.celebrations?.by[animal];
  return isCelebrationId(id) ? id : null;
}

/** The one its welcome would be now: its own if it has had one, else from its id, never the same as the last. */
export function celebrationFor(save: Pick<SaveV2, 'world'>, animal: string): CelebrationId {
  const kept = celebrationOf(save, animal);
  if (kept) return kept;
  const n = CELEBRATIONS.length;
  const first = hash(animal) % n;
  const last = save.world.celebrations?.last;
  const pick = CELEBRATIONS[first].id === last ? CELEBRATIONS[(first + 1) % n] : CELEBRATIONS[first];
  return pick.id;
}

/**
 * Settles this animal's celebration (the first time its welcome plays) and returns it. Idempotent: an animal keeps
 * its own, and a replay never moves `last`, so replays can't make the next newcomer's welcome repeat.
 */
export function assignCelebration(save: Pick<SaveV2, 'world'>, animal: string): CelebrationId {
  const kept = celebrationOf(save, animal);
  if (kept) return kept;
  const id = celebrationFor(save, animal);
  const rec = (save.world.celebrations ??= { by: {} });
  rec.by[animal] = id;
  rec.last = id;
  return id;
}
