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
 */

import { sfx, type Sfx, type SfxOptions } from './audio';
import { haptic, type HapticKind } from './haptics';

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

export const FEEL: Record<FeelEvent, { sound: Sfx | null; haptic: HapticKind | null }> = {
  mark: { sound: 'tick', haptic: 'light' },
  unmark: { sound: 'untick', haptic: null },
  drag: { sound: null, haptic: 'select' },
  place: { sound: 'pop', haptic: 'medium' },
  line: { sound: 'line', haptic: 'medium' },
  lines: { sound: 'lines', haptic: 'medium' },
  miss: { sound: 'miss', haptic: 'warning' },
  solved: { sound: 'solved', haptic: 'success' },
  arrival: { sound: 'arrival', haptic: 'pulse' },
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

/** Plays an event's sound and haptic (each only if its switch is on). */
export function feel(event: FeelEvent, o?: SfxOptions): void {
  const f = FEEL[event];
  if (f.sound) sfx(f.sound, o);
  if (f.haptic) haptic(f.haptic);
}
