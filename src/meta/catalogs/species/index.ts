/**
 * Every species of the endless world (D39 PR E), one file per landscape. Order within a file is the order its species
 * are first met in that landscape's places (shuffled per landscape by the place recipe, so the first is a headliner).
 */

import type { SpeciesDef, SpeciesId } from './types';

export const SPECIES: readonly SpeciesDef[] = [];

export const SPECIES_BY_ID: ReadonlyMap<SpeciesId, SpeciesDef> = new Map(SPECIES.map((s) => [s.id, s]));
