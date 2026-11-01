/**
 * Every animal in one place (D35): the six cat and dog residents (`PetId`) and every other friend (`CompanionId`).
 * The two catalogs keep their own shapes (residents have personality rigs; friends have kinds and habitats); this is
 * the common view the world, the boards and the cards use: who an animal is, where it lives, whether it's home yet,
 * and who arrives next.
 */

import type { SaveV2 } from '../services/storage';
import { COMPANION_BY_ID, isCompanionId, type CompanionId } from './catalogs/companions';
import type { AnimalKind } from './catalogs/foods';
import { PET_BY_ID, isPetId, type PetId } from './catalogs/pets';
import { isWildId, wildDef } from './catalogs/places';
import { DRAWN_SPECIES } from './catalogs/species/drawn';
import { SPECIES } from './catalogs/species/index';
import type { SpeciesId } from './catalogs/species/types';
import { sanctuaryDef, SANCTUARY_BY_ID, arrivalOf, homeOf, type AnimalId, type Arrival, type SanctuaryId } from './catalogs/sanctuaries';

export type { AnimalId } from './catalogs/sanctuaries';

export interface AnimalInfo {
  id: AnimalId;
  name: string;
  /** What kind of animal, capitalized for cards ("Goat kid"). */
  kind: string;
  /** The kind as a plain noun for sentences ("goat kid"). */
  noun: string;
  /** For food favorites. */
  animal: AnimalKind;
  trait: string;
  bio: string;
  sanctuary: SanctuaryId;
  /** A cat or dog resident (with a personality face rig). */
  resident: boolean;
}

export function isAnimalId(x: unknown): x is AnimalId {
  return isPetId(x) || isCompanionId(x) || isWildId(x);
}

export function animalInfo(id: AnimalId): AnimalInfo {
  if (isPetId(id)) {
    const p = PET_BY_ID[id];
    const kind = p.species === 'cat' ? 'Cat' : 'Dog';
    return { id, name: p.name, kind, noun: kind.toLowerCase(), animal: p.species, trait: p.trait, bio: p.bio, sanctuary: 'harmony', resident: true };
  }
  if (isWildId(id)) {
    // The endless world's animals (D39): one of its landscape's species, with its own name.
    const w = wildDef(id);
    return { id, name: w.name, kind: w.kind, noun: kindNoun(w.kind), animal: w.animal, trait: w.trait, bio: w.bio, sanctuary: w.place, resident: false };
  }
  const c = COMPANION_BY_ID[id as CompanionId];
  return { id, name: c.name, kind: c.kind, noun: c.kind.toLowerCase(), animal: c.animal, trait: c.trait, bio: c.bio, sanctuary: c.sanctuary, resident: false };
}

/**
 * A kind as a noun in a sentence: "Snow leopard" → "snow leopard", but a kind named for a place or a person keeps its
 * capital ("Galápagos tortoise", "Przewalski's horse").
 */
export function kindNoun(kind: string): string {
  const words = kind.split(' ');
  const first = words[0];
  // A name of a place or a person keeps its capital: "Galápagos tortoise", "Przewalski's horse", and a two-word name
  // whose second word is capitalized too ("North American river otter", "Christmas Island red crab").
  if (PROPER.test(first) || (/['’]s$/.test(first) && !/^lion['’]s$/i.test(first)) || (/^(North|South|East|West|New|Christmas|Rajah|Saint|Great)$/.test(first) && /^[A-Z]/.test(words[1] ?? ''))) return kind;
  return kind.charAt(0).toLowerCase() + kind.slice(1);
}
const PROPER =
  /^(African|American|Amazon|Andean|Antarctic|Arabian|Asian|Asiatic|Atlantic|Australian|Bactrian|Barbary|Bengal|Bornean|Brazilian|Californian?|Canadian|Caribbean|Chinese|Eurasian|European|Egyptian|Ethiopian|Galápagos|Hawaiian|Himalayan|Humboldt|Indian|Japanese|Javan|Komodo|Madagascar|Malagasy|Malayan|Mexican|Mongolian|Nile|Pacific|Patagonian|Philippine|Siberian|Sumatran|Tasmanian|Tibetan|Amur|Adélie|Gila|Pallas|Bennett|Goodfellow|Darwin|Hector|Grevy|Thomson|Rothschild|Sri|Iberian|Scottish|Cape|Nubian|Alaskan|Hermann|Spix|Victoria|Patas|Diana|Norway|Senegal|Congo|Kalahari|Sahara|Steller|Atlas|Andes)$/;

/** "sheep", "piglets", "calves", "ponies", "foxes": the plural of an animal noun. */
export function pluralNoun(noun: string): string {
  // The same in the plural: sheep, deer, moose, bison, fish (and kinds named for them: "red deer", "zebrafish").
  if (/(sheep|deer|moose|bison|fish|salmon|trout|squid|krill|buffalo|elk|aphid)$/i.test(noun)) return noun;
  if (/(calf|wolf)$/i.test(noun)) return noun.replace(/f$/i, 'ves');
  if (/(^| )ox$/i.test(noun)) return noun + 'en';
  if (/mouse$/i.test(noun)) return noun.replace(/mouse$/i, 'mice');
  if (/goose$/i.test(noun)) return noun.replace(/goose$/i, 'geese');
  if (/[^aeiou]y$/i.test(noun)) return noun.slice(0, -1) + 'ies';
  if (/(s|x|z|ch|sh)$/i.test(noun)) return noun + 'es';
  return noun + 's';
}

/** "a sheep", "an elephant calf", "a European robin" (an "eu", "uni" or "one" sound starts with a y or a w). */
export function withArticle(noun: string): string {
  return `${/^[aeiou]/i.test(noun) && !/^(eu|uni|use|usu|one)/i.test(noun) ? 'an' : 'a'} ${noun}`;
}

export function isHome(save: Pick<SaveV2, 'inventory'>, id: AnimalId): boolean {
  return isPetId(id) ? !!save.inventory.pets[id] : !!save.inventory.companions[id as CompanionId];
}

/** When the animal moved in (ISO), or null. */
export function homeSince(save: Pick<SaveV2, 'inventory'>, id: AnimalId): string | null {
  const e = isPetId(id) ? save.inventory.pets[id] : save.inventory.companions[id as CompanionId];
  return e?.unlockedAt ?? null;
}

/** Records an arrival. Idempotent: returns false when the animal was already home. */
export function welcomeAnimal(save: Pick<SaveV2, 'inventory'>, id: AnimalId, now = new Date()): boolean {
  if (isHome(save, id)) return false;
  if (isPetId(id)) save.inventory.pets[id as PetId] = { unlockedAt: now.toISOString() };
  else save.inventory.companions[id as CompanionId] = { unlockedAt: now.toISOString() };
  return true;
}

/** A sanctuary's animals in arrival order. */
export function animalsOf(sanctuary: SanctuaryId): AnimalId[] {
  return sanctuaryDef(sanctuary).arrivals.map((a) => a.id);
}

/** Animals already living in a sanctuary, in arrival order. */
export function homeAnimals(save: Pick<SaveV2, 'inventory'>, sanctuary: SanctuaryId): AnimalId[] {
  return animalsOf(sanctuary).filter((id) => isHome(save, id));
}

/** Every animal that has moved in anywhere, sanctuary by sanctuary (the hand-made ones, then the endless world's in order). */
export function allHomeAnimals(save: Pick<SaveV2, 'inventory'>): AnimalId[] {
  const wild = Object.keys(save.inventory.companions)
    .filter(isWildId)
    .sort((a, b) => {
      const [pa, sa] = a.slice(1).split('-').map(Number);
      const [pb, sb] = b.slice(1).split('-').map(Number);
      return pa - pb || sa - sb;
    });
  return [...(Object.keys(SANCTUARY_BY_ID) as SanctuaryId[]).flatMap((s) => homeAnimals(save, s)), ...wild];
}

/** The next animal still to arrive in a sanctuary (the one boards show while you build it), or null when all are home. */
export function nextArrivalIn(save: Pick<SaveV2, 'inventory'>, sanctuary: SanctuaryId): Arrival | null {
  return sanctuaryDef(sanctuary).arrivals.find((a) => !isHome(save, a.id)) ?? null;
}

export { arrivalOf, homeOf };

// ------------------------------------------------------------------ kinds (D39 PR E)

/** How many kinds of animal the world has (the hand-drawn kinds and every landscape's species). */
export const KINDS_TOTAL = SPECIES.length;

/** The kind a friend is (a place's animal's species, a hand-made friend's kind), or null for the cat and dog residents. */
export function speciesOfAnimal(id: AnimalId): SpeciesId | null {
  if (isPetId(id)) return null;
  if (isWildId(id)) return wildDef(id).species;
  const own = DRAWN_SPECIES.find((s) => s.drawn === id && !s.guest) ?? DRAWN_SPECIES.find((s) => s.drawn === id);
  return own?.id ?? null;
}

/** How many different kinds of animal have come home anywhere. */
export function kindsMet(save: Pick<SaveV2, 'inventory'>): number {
  const kinds = new Set<SpeciesId>();
  for (const id of Object.keys(save.inventory.companions)) {
    if (!isAnimalId(id)) continue;
    const k = speciesOfAnimal(id);
    if (k) kinds.add(k);
  }
  return kinds.size;
}
