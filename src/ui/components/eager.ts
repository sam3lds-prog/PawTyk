/**
 * D49 PR B: an animal one puzzle away from coming home looks it. Wherever the next arrival is pictured (the win sheet,
 * the Journey's goal, a home's "Coming home" row, the next goal), its portrait beams instead of peeking shyly, with a
 * soft pulsing halo and a small *Almost home!* tag. A face and a glow only (the portrait never moves); still under
 * reduced motion.
 */

import type { AnimalId } from '../../meta/animals';
import { animalPortrait } from '../art/animals';

/** Whether an arrival `left` puzzles away is eager (the next puzzle brings it home). */
export const isEager = (left: number): boolean => left === 1;

/**
 * The portrait of the animal on its way: shy while it is still a few puzzles off, eager (beaming, a halo, the tag) when
 * one more puzzle brings it. `cls` is the wrapper's own class (its size and place in the layout).
 */
export function arrivalPortrait(id: AnimalId, left: number, cls: string, extra = ''): string {
  if (!isEager(left)) return `<span class="${cls} is-shy"${extra}>${animalPortrait(id, 'idle')}</span>`;
  return `<span class="${cls} is-eager"${extra}>${animalPortrait(id, 'beam')}<span class="eager-tag" aria-hidden="true">Almost home!</span></span>`;
}
