/**
 * An animal says hello (D40): the tiny sound an animal makes when the player taps it, pitched by its size (a mouse
 * squeaks higher than a bison) and, from D40 PR B, in its temperament's rhythm.
 */

import { isAnimalId, speciesOfAnimal, type AnimalId } from '../../meta/animals';
import { speciesById } from '../../meta/catalogs/species/index';
import { isPetId } from '../../meta/catalogs/pets';
import type { SfxOptions } from '../../services/audio';
import { feel } from '../../services/feel';

/** The hello an animal makes. */
export function helloOf(id: AnimalId): SfxOptions {
  if (isPetId(id)) return { size: 'small' };
  const sp = speciesOfAnimal(id);
  return { size: (sp && speciesById(sp)?.size) || 'medium' };
}

/** Plays an animal's hello (sound and a light haptic, each behind its own switch). */
export function sayHello(id: string): void {
  if (isAnimalId(id)) feel('hello', helloOf(id));
}
