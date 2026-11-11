/**
 * Three restrained turns of an ordinary win (D50 PR B). A short session can be four or five quick solves in a row; the
 * same face and the same jingle every time starts to feel like a machine. So an ordinary win takes one of three
 * flavors, in turn (never the same twice running): the win sheet's animal wears a different smile, and with Music on
 * Tiny Triumph lands a little differently. Nothing else changes: same length, same loudness, same haptic, same sheet.
 *
 * A milestone win (an animal home, a new stage or home) always plays the original: its spotlight's Welcome Home answers
 * Tiny Triumph (D45 PR B), and the big moments stay big by contrast. Pure.
 */

import type { CueId } from '../audio/scores';

export interface WinFlavor {
  /** Which Tiny Triumph plays (with Music on). */
  cue: Extract<CueId, 'triumph' | 'triumph2' | 'triumph3'>;
  /** The win sheet's animal's face. */
  mood: 'proud' | 'happy' | 'celebrate';
}

export const WIN_FLAVORS: readonly WinFlavor[] = [
  { cue: 'triumph', mood: 'proud' },
  { cue: 'triumph2', mood: 'happy' },
  { cue: 'triumph3', mood: 'celebrate' },
];

/** The flavor of a win: the original for a milestone; otherwise by how many boards have been solved (it rotates). */
export function winFlavor(solved: number, milestone: boolean): WinFlavor {
  if (milestone) return WIN_FLAVORS[0];
  const i = ((Math.floor(solved) % WIN_FLAVORS.length) + WIN_FLAVORS.length) % WIN_FLAVORS.length;
  return WIN_FLAVORS[i];
}
