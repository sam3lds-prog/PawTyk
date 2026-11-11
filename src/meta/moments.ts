/**
 * Animal moments (D49 PR C): now and then, while the player is in a home and nothing else is happening, one of the
 * animals does something small on its own: spots a butterfly, sneezes in the flowers, dozes off, says hello to a
 * neighbour. A handful of curated moments, each made of an existing trick or emote, never a reward and never a chore:
 * the first time a player sees one is a little discovery about that animal ("New"), and that is all it gives.
 *
 * Pure: which moment, for which animal, is chosen here from what is in the scene; `components/animalMoments.ts`
 * plays it.
 */

import type { TrickId } from './catalogs/tricks';
import type { Temperament } from './temperament';
import type { SaveV2 } from '../services/storage';
import { localDateKey } from '../game/dates';

export type MomentId = 'butterfly' | 'sneeze' | 'doze' | 'hello' | 'stretch' | 'wiggle' | 'chase' | 'peekaboo';

export interface MomentDef {
  id: MomentId;
  /** The trick or emote the animal plays (its motion, its bubble). */
  trick: TrickId;
  /** Who does it best: an animal of these temperaments is picked first, if one is there. */
  prefer?: readonly Temperament[];
  /** Two animals: the first plays `trick`, its nearest neighbour answers with `answer`. */
  answer?: TrickId;
  /** The line under the scene. */
  line: (a: string, b?: string) => string;
}

export const MOMENTS: readonly MomentDef[] = [
  { id: 'butterfly', trick: 'headtilt', prefer: ['shy', 'gentle'], line: (a) => `${a} is watching a butterfly.` },
  { id: 'sneeze', trick: 'sneeze', line: (a) => `${a} sneezed in the flowers!` },
  { id: 'doze', trick: 'sleepy', prefer: ['sleepy', 'gentle'], line: (a) => `${a} dozed off for a moment.` },
  { id: 'hello', trick: 'wave', answer: 'love', line: (a, b) => `${a} and ${b} said hello to each other.` },
  { id: 'stretch', trick: 'stretch', prefer: ['sleepy', 'proud'], line: (a) => `${a} had a big stretch.` },
  { id: 'wiggle', trick: 'wiggle', prefer: ['playful', 'energetic'], line: (a) => `${a} did a happy wiggle.` },
  { id: 'chase', trick: 'tailchase', prefer: ['playful', 'energetic'], line: (a) => `${a} chased its own tail!` },
  { id: 'peekaboo', trick: 'peekaboo', prefer: ['shy'], line: (a) => `${a} played peekaboo in the grass.` },
];

export const MOMENT_BY_ID: Record<MomentId, MomentDef> = Object.fromEntries(MOMENTS.map((m) => [m.id, m])) as Record<MomentId, MomentDef>;

/** An animal in the scene that could take part: its id, name and temperament, and where it stands. */
export interface MomentCast {
  id: string;
  name: string;
  temper: Temperament;
  x: number;
  y: number;
}

export interface MomentPick {
  moment: MomentDef;
  who: MomentCast;
  /** The neighbour who answers (a two-animal moment). */
  with?: MomentCast;
}

/**
 * The next moment to play. Moments the player hasn't seen yet come first (in catalog order, so the first few visits
 * show different ones), then any but the one just played; the animal is one of the preferred temperaments if any is
 * there, else anyone, never the one who did the last moment if someone else can. `rand` is in [0, 1).
 */
export function pickMoment(cast: readonly MomentCast[], o: { seen: ReadonlySet<string>; last?: { moment: MomentId; who: string }; rand: () => number }): MomentPick | null {
  if (!cast.length) return null;
  const possible = MOMENTS.filter((m) => !m.answer || cast.length >= 2);
  const unseen = possible.filter((m) => !o.seen.has(m.id));
  const pool = unseen.length ? unseen.slice(0, 1) : possible.filter((m) => m.id !== o.last?.moment);
  const moment = pool[Math.floor(o.rand() * pool.length)] ?? possible[0];
  if (!moment) return null;
  const others = cast.length > 1 ? cast.filter((c) => c.id !== o.last?.who) : cast;
  const fitting = moment.prefer ? others.filter((c) => moment.prefer!.includes(c.temper)) : [];
  const from = fitting.length ? fitting : others;
  const who = from[Math.floor(o.rand() * from.length)] ?? from[0];
  if (!moment.answer) return { moment, who };
  const near = cast
    .filter((c) => c.id !== who.id)
    .sort((a, b) => Math.hypot(a.x - who.x, a.y - who.y) - Math.hypot(b.x - who.x, b.y - who.y))[0];
  return near ? { moment, who, with: near } : null;
}

/** The moments this player has seen. */
export function seenMoments(save: Pick<SaveV2, 'sanctuary'>): Set<string> {
  return new Set(Object.keys(save.sanctuary.moments ?? {}));
}

/** Notes a moment as seen; true if it was the first time. */
export function noteMoment(save: Pick<SaveV2, 'sanctuary'>, id: MomentId, now = new Date()): boolean {
  const seen = (save.sanctuary.moments ??= {});
  if (seen[id]) return false;
  seen[id] = localDateKey(now);
  return true;
}
