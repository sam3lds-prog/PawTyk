/**
 * How the game feels (D40): every moment that makes a sound or a buzz goes through here, so the sound and the haptic
 * of each event are chosen together, in one table, and stay consistent wherever the event happens. Sound and haptics
 * each obey their own switch in Settings (`setSoundEnabled`, `setHapticsEnabled`): muting one never mutes the other.
 *
 * | event    | sound                                  | haptic                 |
 * |----------|----------------------------------------|------------------------|
 * | mark     | a quiet soft tick                      | light                  |
 * | unmark   | a softer tick                          | none                   |
 * | drag     | none (the ✕ marks are enough)          | the lightest tick      |
 * | place    | a gentle bright pop                    | firm (medium)          |
 * | line     | a short rising tone                    | subtle success (medium)|
 * | lines    | a longer rising tone                   | subtle success (medium)|
 * | miss     | one muted soft note                    | gentle warning         |
 * | solved   | the game's success melody              | success                |
 * | arrival  | a warm chime, its own sound            | one celebratory pulse  |
 * | hello    | a tiny cue, the animal's temperament   | light                  |
 * | treat    | a little munch                         | light                  |
 * | coin     | a bright coin chime                    | light                  |
 * | buy      | a bright coin chime                    | success                |
 * | tap      | a plain tick                           | the lightest tick      |
 * | trick    | a gentle bright pop                    | light                  |
 * | tool     | none                                   | the lightest tick      |
 * | undo     | none                                   | the lightest tick      |
 * | lost     | none (the last miss already sounded)   | gentle warning         |
 *
 * D48 PR A: a drag across tiles ticks once for each tile that changes, but never more often than every
 * `DRAG_TICK_MS` (a fast swipe changing three tiles in one frame is one tick, not a buzz). Nothing ticks for a tile the
 * finger only passes over without changing it (the board only reports changes), and a drag makes no sound.
 *
 * D44 PR B: with Music on, three moments play a music cue instead of their sound effect (never both): a solve plays
 * *Tiny Triumph*, an arrival *Welcome Home*, a trick its own tune (`feel('trick', { cue: 'trick:<id>' })`). With Music
 * off they keep their sound effects. The haptic is the same either way.
 */

import { sfx, type Sfx, type SfxOptions } from './audio';
import { haptic, type HapticKind } from './haptics';
import { musicEnabled, playCue } from './music';
import type { CueId, RhythmFeel } from '../audio/scores';

export type FeelEvent =
  | 'mark'
  | 'unmark'
  | 'drag'
  | 'place'
  | 'line'
  | 'lines'
  | 'miss'
  | 'solved'
  | 'arrival'
  | 'hello'
  | 'treat'
  | 'coin'
  | 'buy'
  | 'tap'
  | 'trick'
  | 'tool'
  | 'undo'
  | 'lost';

export const FEEL: Record<FeelEvent, { sound: Sfx | null; haptic: HapticKind | null; cue?: CueId }> = {
  mark: { sound: 'tick', haptic: 'light' },
  unmark: { sound: 'untick', haptic: null },
  drag: { sound: null, haptic: 'select' },
  place: { sound: 'pop', haptic: 'medium' },
  line: { sound: 'line', haptic: 'medium' },
  lines: { sound: 'lines', haptic: 'medium' },
  miss: { sound: 'miss', haptic: 'warning' },
  solved: { sound: 'solved', haptic: 'success', cue: 'triumph' },
  arrival: { sound: 'arrival', haptic: 'pulse', cue: 'welcome' },
  hello: { sound: 'hello', haptic: 'light' },
  treat: { sound: 'treat', haptic: 'light' },
  coin: { sound: 'coin', haptic: 'light' },
  buy: { sound: 'coin', haptic: 'success' },
  tap: { sound: 'tap', haptic: 'select' },
  trick: { sound: 'pop', haptic: 'light' },
  tool: { sound: null, haptic: 'select' },
  undo: { sound: null, haptic: 'select' },
  lost: { sound: null, haptic: 'warning' },
};

/** The least time between two drag ticks (D48 PR A): restrained, never a continuous buzz. */
export const DRAG_TICK_MS = 40;
let lastDragTick = -Infinity;
const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/** Tests: forget the last drag tick. */
export function resetDragTick(): void {
  lastDragTick = -Infinity;
}

/** Plays an event's sound (or, with Music on, its music cue) and haptic, each only if its switch is on. */
export function feel(event: FeelEvent, o?: SfxOptions & { cue?: CueId; rhythm?: RhythmFeel }): void {
  const f = FEEL[event];
  const cue = o?.cue ?? f.cue;
  if (cue && musicEnabled() && playCue(cue, { rhythm: o?.rhythm })) {
    /* the cue replaces the sound effect */
  } else if (f.sound) sfx(f.sound, o);
  if (!f.haptic) return;
  if (event === 'drag') {
    const t = clock();
    if (t - lastDragTick < DRAG_TICK_MS) return;
    lastDragTick = t;
  }
  haptic(f.haptic);
}
