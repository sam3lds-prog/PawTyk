/**
 * D52 PR A: how far the next arrival is, said one way everywhere. A win, the Journey, the World and the first arrival
 * all say an animal *comes home*, in one sentence, with the count of puzzles still to go (never a before → after step,
 * never "one puzzle closer" beside a countdown):
 *
 *   Hazel the pony comes home in 6 more puzzles.     (the first time she is named, with her kind)
 *   Hazel comes home in 4 more puzzles.               (after that, her name)
 *   One more puzzle and Hazel is home!                (the next one brings her)
 *   Hazel comes home in 4 more new puzzles.           (a replay, which grows nothing: only new puzzles count)
 *
 * The count is `arrivalProgress(…).left` (the underlying progression is unchanged); an arrival itself is the arrival's
 * own celebration ("Hazel is home!"), never "0 puzzles". A home with no animal left to come but a stage to reach says
 * the stage the same way: "3 more puzzles until the next stage: Duck pond."
 */

import { esc } from '../dom';

export interface Arriving {
  name: string;
  /** The kind as a noun ("pony", "snow leopard"). */
  noun: string;
}

export interface ComesHomeOptions {
  /** Name the kind too ("Hazel the pony"), for the first time an animal is presented. */
  full?: boolean;
  /** A replay that grew nothing: the count is of *new* puzzles. */
  replay?: boolean;
}

/** "6 more puzzles", "one more puzzle"; with `fresh`, "4 more new puzzles". */
export function morePuzzles(left: number, fresh = false): string {
  const kind = fresh ? 'new puzzle' : 'puzzle';
  return left === 1 ? `one more ${kind}` : `${left} more ${kind}s`;
}

/** The sentence, as text and as markup (the animal's name in bold, everything escaped). */
export function comesHome(a: Arriving, left: number, o: ComesHomeOptions = {}): { text: string; html: string } {
  const who = o.full ? `${a.name} the ${a.noun}` : a.name;
  const b = (s: string) => `<b>${esc(s)}</b>`;
  if (!o.replay && left <= 1) return { text: `One more puzzle and ${a.name} is home!`, html: `One more puzzle and ${b(a.name)} is home!` };
  const tail = ` comes home in ${morePuzzles(Math.max(1, left), !!o.replay)}.`;
  return { text: `${who}${tail}`, html: `${b(who)}${esc(tail)}` };
}

/** A home's next stage, when no animal is left to come: "3 more puzzles until the next stage: Duck pond." */
export function stageCountdown(stage: string, left: number, o: { replay?: boolean } = {}): string {
  const n = morePuzzles(Math.max(1, left), !!o.replay);
  return `${n.charAt(0).toUpperCase()}${n.slice(1)} until the next stage: ${stage}.`;
}

/** The sentence without its closing mark, for a status line ("Building here · Hazel comes home in 6 more puzzles"). */
export const bare = (s: string): string => s.replace(/[.!]$/, '');

/** The sentence after a colon: "Up next at the Pet Garden: one more puzzle and Juniper is home!" */
export const afterColon = (s: string): string => (s.startsWith('One more puzzle') ? `o${s.slice(1)}` : s);

/** The one-time help note on growth (D52 PR A): which puzzles grow a home. */
export const GROWTH_NOTE = "New Journey, Daily and Zen puzzles grow your homes. Replays and Paw Cup don't.";
