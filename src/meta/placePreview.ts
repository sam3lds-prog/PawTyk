/**
 * D52 PR B: what a tester needs to see of a place of the endless world without reaching it: its name, landscape,
 * residents (name, kind, coat, where the kind lives and its fact), each growth stage and who is home by then, and when
 * it opens. Read-only and one place at a time: everything comes from `placeDef(k)` (the same generated place every
 * phone gets), nothing is renamed, regenerated or written, and no list of all 9,999 places is ever built.
 */

import { BIOMES, MAX_PLACE, placeDef, type PlaceDef, type WildDef } from './catalogs/places';
import { SPECIES_BY_ID } from './catalogs/species/index';
import { kindNoun } from './animals';

export interface PlaceResident {
  w: WildDef;
  /** "silver koala" (the coat's name, when it has one, then the kind). */
  coatKind: string;
  /** Where the kind lives in the wild ("Eastern Australia"). */
  from: string;
  /** Its kind's true fact. */
  fact: string;
}

export interface PlaceStagePreview {
  index: number;
  name: string;
  change: string;
  /** The place's growth count when this stage is reached. */
  at: number;
  /** Who lives there by then. */
  home: readonly WildDef[];
}

export interface PlacePreview {
  def: PlaceDef;
  /** "Farmland", "Bamboo forest". */
  landscape: string;
  residents: readonly PlaceResident[];
  stages: readonly PlaceStagePreview[];
  /** "Opens after level 300, or sooner, once every home before it is complete." */
  opens: string;
}

/** A place number in range (1–9999), from whatever was typed. */
export function clampPlace(n: unknown): number {
  const k = Math.round(Number(n));
  if (!Number.isFinite(k)) return 1;
  return Math.min(MAX_PLACE, Math.max(1, k));
}

/** The preview of place k (1–9999). */
export function placePreview(k: number): PlacePreview {
  const def = placeDef(clampPlace(k));
  const residents = def.animals.map((w) => {
    const sp = SPECIES_BY_ID.get(w.species);
    const noun = kindNoun(w.kind);
    return { w, coatKind: w.coat.name ? `${w.coat.name} ${noun}` : noun, from: sp?.from ?? '', fact: sp?.fact ?? w.bio };
  });
  const stages = def.stages.map((s, index) => ({ index, name: s.name, change: s.change, at: s.at, home: def.animals.filter((w) => w.at <= s.at) }));
  return {
    def,
    landscape: BIOMES[def.biome].label,
    residents,
    stages,
    opens: `Opens after level ${def.opensAfterLevel}, or sooner, once every home before it is complete.`,
  };
}
