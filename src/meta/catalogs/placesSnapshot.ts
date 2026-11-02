/**
 * A compact, stable summary of the endless world, for the fixture that pins it (D39). A place is a pure function of its
 * number and of the lists it is made from, so the fixture pins both: the first places and a sample of later ones in
 * full, and every list that decides a place (each landscape's species in order, its names, its words, its zones, looks,
 * accents and stages, and the shared names). Changing any of them changes places that may already be in a save.
 */
import { BIOME_IDS, BIOMES, biomeSpecies, placeDef } from './places';
import { NAMES_BY_BIOME } from './species/index';

function placeSummary(k: number): unknown {
  const p = placeDef(k);
  return {
    id: p.id,
    name: p.name,
    biome: p.biome,
    look: p.look,
    mirror: p.mirror,
    place: p.place,
    pin: [p.lon, p.lat],
    opens: p.opensAfterLevel,
    accent: p.accent,
    animals: p.animals.map((a) => [a.id, a.at, a.species, a.base, a.name, a.coat.name, a.neckerchief, a.trait]),
  };
}

export function placesSnapshot(n: number): unknown[] {
  return Array.from({ length: n }, (_, i) => placeSummary(i + 1));
}

/** Every list a place is made from, by landscape (the species by id, in the order the landscape meets them). */
export function recipeInputs(): Record<string, unknown> {
  return Object.fromEntries(
    BIOME_IDS.map((b) => {
      const d = BIOMES[b];
      return [
        b,
        {
          species: biomeSpecies(b).map((s) => s.id),
          names: NAMES_BY_BIOME[b] ?? [],
          words: [d.adjectives, d.nouns],
          zones: d.zones,
          looks: d.looks,
          accents: d.accents,
          stages: [d.stageNames, d.stageLines],
          label: d.label,
          scenery: d.scenery,
          art: d.art,
        },
      ];
    }),
  );
}

/** What the fixture holds: the first forty places, every 25th place to 1000, and the recipe's inputs. */
export function worldFixture(): unknown {
  return {
    first: placesSnapshot(40),
    sampled: Array.from({ length: 40 }, (_, i) => placeSummary(25 * (i + 1))),
    inputs: recipeInputs(),
  };
}
