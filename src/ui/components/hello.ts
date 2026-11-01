/**
 * An animal says hello (D40): the tiny sound an animal makes when the player taps it, pitched by its size (a mouse
 * squeaks higher than a bison), in its temperament's rhythm (PR B), with one more warm note once it is a friend.
 */

import { app } from '../../app/app';
import { isAnimalId, speciesOfAnimal, type AnimalId } from '../../meta/animals';
import { hasUnlock } from '../../meta/bonds';
import { temperamentOf } from '../../meta/temperament';
import { speciesById } from '../../meta/catalogs/species/index';
import { isPetId } from '../../meta/catalogs/pets';
import type { SfxOptions } from '../../services/audio';
import { feel } from '../../services/feel';

/** The hello an animal makes. */
export function helloOf(id: AnimalId): SfxOptions {
  const style = temperamentOf(id);
  const warm = hasUnlock(app.save, id, 'greeting');
  if (isPetId(id)) return { size: 'small', style, warm };
  const sp = speciesOfAnimal(id);
  return { size: (sp && speciesById(sp)?.size) || 'medium', style, warm };
}

/** Plays an animal's hello (sound and a light haptic, each behind its own switch). */
export function sayHello(id: string): void {
  if (isAnimalId(id)) feel('hello', helloOf(id));
}
