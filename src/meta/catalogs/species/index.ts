/**
 * Every species of the endless world (D39 PR E): the hand-drawn kinds, and one file per landscape of kit species.
 * Order within a file is the order its species are first met in that landscape's places.
 */

import { DRAWN_SPECIES } from './drawn';
import { NAMES_AMAZON, SPECIES_AMAZON } from './amazon';
import { NAMES_BAMBOO, PLACE_WORDS_BAMBOO, SPECIES_BAMBOO } from './bamboo';
import { NAMES_COAST, PLACE_WORDS_COAST, SPECIES_COAST } from './coast';
import { NAMES_DESERT, PLACE_WORDS_DESERT, SPECIES_DESERT } from './desert';
import { NAMES_ISLAND, PLACE_WORDS_ISLAND, SPECIES_ISLAND } from './island';
import { NAMES_JUNGLE, PLACE_WORDS_JUNGLE, SPECIES_JUNGLE } from './jungle';
import { NAMES_SAVANNA, SPECIES_SAVANNA } from './savanna';
import { NAMES_WETLAND, PLACE_WORDS_WETLAND, SPECIES_WETLAND } from './wetland';
import type { BiomeId, SpeciesDef, SpeciesId } from './types';

/** Each landscape's file: its species, names for its animals, and (for the new landscapes) words for place names. */
interface BiomeFile {
  species: readonly SpeciesDef[];
  names?: readonly string[];
  placeWords?: { readonly adjectives: readonly string[]; readonly nouns: readonly string[] };
}

const FILES: Partial<Record<BiomeId, BiomeFile>> = {
  wetland: { species: SPECIES_WETLAND, names: NAMES_WETLAND, placeWords: PLACE_WORDS_WETLAND },
  coast: { species: SPECIES_COAST, names: NAMES_COAST, placeWords: PLACE_WORDS_COAST },
  savanna: { species: SPECIES_SAVANNA, names: NAMES_SAVANNA },
  desert: { species: SPECIES_DESERT, names: NAMES_DESERT, placeWords: PLACE_WORDS_DESERT },
  island: { species: SPECIES_ISLAND, names: NAMES_ISLAND, placeWords: PLACE_WORDS_ISLAND },
  amazon: { species: SPECIES_AMAZON, names: NAMES_AMAZON },
  jungle: { species: SPECIES_JUNGLE, names: NAMES_JUNGLE, placeWords: PLACE_WORDS_JUNGLE },
  bamboo: { species: SPECIES_BAMBOO, names: NAMES_BAMBOO, placeWords: PLACE_WORDS_BAMBOO },
};

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
