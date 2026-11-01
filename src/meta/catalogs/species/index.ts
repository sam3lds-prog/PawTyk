/**
 * Every species of the endless world (D39 PR E): the hand-drawn kinds, and one file per landscape of kit species.
 * Order within a file is the order its species are first met in that landscape's places.
 */

import { DRAWN_SPECIES } from './drawn';
import type { BiomeId, SpeciesDef, SpeciesId } from './types';

/** Each landscape's file: its species, names for its animals, and (for the new landscapes) words for place names. */
interface BiomeFile {
  species: readonly SpeciesDef[];
  names?: readonly string[];
  placeWords?: { readonly adjectives: readonly string[]; readonly nouns: readonly string[] };
}

const FILES: Partial<Record<BiomeId, BiomeFile>> = {};

export const SPECIES: readonly SpeciesDef[] = [...DRAWN_SPECIES, ...Object.values(FILES).flatMap((f) => f!.species)];

export const SPECIES_BY_ID: ReadonlyMap<SpeciesId, SpeciesDef> = new Map(SPECIES.map((s) => [s.id, s]));

export function speciesById(id: SpeciesId): SpeciesDef | undefined {
  return SPECIES_BY_ID.get(id);
}

/** A landscape's species in file order (kit species), with its hand-drawn kinds after them. */
export function speciesOfBiome(b: BiomeId): readonly SpeciesDef[] {
  return [...(FILES[b]?.species ?? []), ...DRAWN_SPECIES.filter((s) => s.biome === b)];
}

export const NAMES_BY_BIOME: Partial<Record<BiomeId, readonly string[]>> = Object.fromEntries(
  Object.entries(FILES).map(([b, f]) => [b, f!.names ?? []]),
);

export const PLACE_WORDS_BY_BIOME: Partial<Record<BiomeId, { adjectives: readonly string[]; nouns: readonly string[] }>> = Object.fromEntries(
  Object.entries(FILES)
    .filter(([, f]) => f!.placeWords)
    .map(([b, f]) => [b, f!.placeWords!]),
);
