/**
 * A hello at the start of a visit (D50 PR B). A visit to a home is often a few seconds long: a look in after a win, on
 * the way to the next puzzle. D49's animal moments are lovely but come after a quiet quarter-minute, so a short visit
 * rarely saw anyone do anything of their own. Now, a couple of seconds into a calm visit, **one** animal comes over to
 * say hello, in its own way and for a reason the player can read:
 *
 *  1. one hello away from what friendship brings next, and not greeted today: "Truffle is hoping you'll say hello."
 *     (a tap is that hello: one heart, D40);
 *  2. a newcomer, home within the last day: "Buttercup is still settling in, and says hi.";
 *  3. right after a win: "Cotton heard you solved a puzzle!";
 *  4. in the evening: "Cotton says a sleepy good evening.";
 *  5. otherwise its temperament's hello: "Truffle bounds over to say hi!".
 *
 * The animal does a short trick of its temperament (a playful wiggle, a shy peekaboo, a gentle heart…), never longer
 * than a moment. Who it is rotates through the residents (never the same one twice running, when there is a choice).
 * Nothing is granted, saved or owed: no claim, no currency, no chore. Pure: `components/animalMoments.ts` plays it.
 */

import type { TrickId } from './catalogs/tricks';
import type { Temperament } from './temperament';

export type GreetReason = 'unlock' | 'newcomer' | 'solved' | 'evening' | 'hello';

/** An animal in the scene that could come and say hello. */
export interface GreetCast {
  id: string;
  name: string;
  temper: Temperament;
  /** When it came home (ISO), for "still settling in". */
  since?: string;
  /** It has had today's hello (a heart) already. */
  greetedToday: boolean;
  /** Hearts until what friendship brings next (null: nothing more to unlock). */
  heartsToNext: number | null;
}

export interface GreetContext {
  now: Date;
  evening: boolean;
  /** The player solved a puzzle a moment ago. */
  justSolved: boolean;
  /** Who said hello last (this session), so it rotates. */
  last?: string;
  /** How many hellos this session so far: picks among equals without randomness. */
  turn: number;
}

export interface Greeting {
  who: GreetCast;
  trick: TrickId;
  line: string;
  reason: GreetReason;
}

/** "Still settling in" for this long after coming home. */
export const NEWCOMER_MS = 24 * 60 * 60 * 1000;

/** Each temperament's way of coming over: short, friendly tricks every animal can do (the free and emote set). */
export const GREET_TRICK: Record<Temperament, TrickId> = {
  playful: 'wiggle',
  sleepy: 'wave',
  shy: 'peekaboo',
  proud: 'wave',
  energetic: 'highfive',
  gentle: 'love',
};

const HELLO_LINE: Record<Temperament, (n: string) => string> = {
  playful: (n) => `${n} bounds over to say hi!`,
  sleepy: (n) => `${n} blinks a slow hello.`,
  shy: (n) => `${n} peeks out to say hi.`,
  proud: (n) => `${n} stands tall to greet you.`,
  energetic: (n) => `${n} can hardly keep still: hi!`,
  gentle: (n) => `${n} wanders over to say hello.`,
};

const LINES: Record<Exclude<GreetReason, 'hello'>, (n: string) => string> = {
  unlock: (n) => `${n} is hoping you’ll say hello.`,
  newcomer: (n) => `${n} is still settling in, and says hi.`,
  solved: (n) => `${n} heard you solved a puzzle!`,
  evening: (n) => `${n} says a sleepy good evening.`,
};

/** The hello to play at the start of a visit, or null when nobody is there to give it. */
export function pickGreeting(cast: readonly GreetCast[], ctx: GreetContext): Greeting | null {
  if (!cast.length) return null;
  const others = cast.length > 1 ? cast.filter((c) => c.id !== ctx.last) : [...cast];
  const of = (who: GreetCast, reason: GreetReason): Greeting => ({
    who,
    reason,
    trick: GREET_TRICK[who.temper],
    line: reason === 'hello' ? HELLO_LINE[who.temper](who.name) : LINES[reason](who.name),
  });
  // 1. Someone a single hello from what friendship brings next (and that hello still to give today).
  const near = others.filter((c) => !c.greetedToday && c.heartsToNext === 1);
  if (near.length) return of(near[0], 'unlock');
  // 2. The newest arrival, while it is still new.
  const fresh = others
    .filter((c) => c.since && ctx.now.getTime() - Date.parse(c.since) >= 0 && ctx.now.getTime() - Date.parse(c.since) < NEWCOMER_MS)
    .sort((a, b) => Date.parse(b.since!) - Date.parse(a.since!));
  if (fresh.length) return of(fresh[0], 'newcomer');
  // 3–5. Anyone else, taking turns round the whole cast (stepping past whoever said hello last), so every animal gets
  // its turn. (Counting through `others`, whose order shifts with each pick, would skip one of three for ever.)
  let i = ((ctx.turn % cast.length) + cast.length) % cast.length;
  if (cast.length > 1 && cast[i].id === ctx.last) i = (i + 1) % cast.length;
  return of(cast[i], ctx.justSolved ? 'solved' : ctx.evening ? 'evening' : 'hello');
}
