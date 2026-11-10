/**
 * How long a new animal's celebration runs (D45 PR B).
 *
 * The full version (a 3.3 s spotlight after the win, then the ~7 s Welcome Parade on Meet) is a treat the first few
 * times and a wait the fortieth. So by default ("smart") the first animals home, and the first animal in each home,
 * get the full celebration; after that the spotlight is brief and the parade is the short one, with the full parade
 * one tap away on Replay. The player can also ask for always full or always short in Settings.
 *
 * Nothing here grants anything: it only chooses a length.
 */

import type { SanctuaryId } from './catalogs/sanctuaries';
import { sanctuaryDef } from './catalogs/sanctuaries';

export type CelebrationPref = 'smart' | 'full' | 'short';
export type CelebrationLength = 'full' | 'short';

/** In smart pacing, this many animals (anywhere) get the full celebration. */
export const FULL_CELEBRATIONS = 3;

interface Homes {
  inventory: { companions: Record<string, unknown>; pets: Record<string, unknown> };
}

/** Everyone at home, anywhere. */
const homeCount = (save: Homes) => Object.keys(save.inventory.companions).length + Object.keys(save.inventory.pets).length;

/**
 * The length for `animal`'s celebration in `where`, the animal already at home (it is counted). Full for the first
 * `FULL_CELEBRATIONS` animals and for the first animal to move into a home; short otherwise.
 */
export function celebrationLength(save: Homes, pref: CelebrationPref, animal: string, where: SanctuaryId): CelebrationLength {
  if (pref !== 'smart') return pref;
  if (homeCount(save) <= FULL_CELEBRATIONS) return 'full';
  const here = sanctuaryDef(where).arrivals.map((a) => a.id as string).filter((id) => id in save.inventory.companions || id in save.inventory.pets);
  return here.length <= 1 && (here.length === 0 || here[0] === animal) ? 'full' : 'short';
}
