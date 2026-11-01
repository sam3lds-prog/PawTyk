/**
 * The animal kit and its catalog (D39 PR E): every species is well formed and drawable, there are hundreds of them in
 * every landscape, each landscape's places meet new kinds, and the scenes know which animals can be 3D toys.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES, speciesById, speciesOfBiome } from '../../src/meta/catalogs/species/index';
import { speciesProblems, VOCAB } from '../../src/meta/catalogs/species/vocabulary';
import { DRAWN_SPECIES } from '../../src/meta/catalogs/species/drawn';
import { BIOME_IDS, COATS, biomeSpecies, placeDef } from '../../src/meta/catalogs/places';
import { kitBody, kitHasToy, kitHead, kitPal, kitScale } from '../../src/ui/art/kit';
import { face, companionFigure, companionSvg, friendRigBody, kitSpeciesOf } from '../../src/ui/art/companions';
import { kitToy, toySpec } from '../../src/three/species';
import { animalInfo, kindNoun, kindsMet, KINDS_TOTAL, pluralNoun, speciesOfAnimal, withArticle } from '../../src/meta/animals';
import { animalTint } from '../../src/ui/art/animals';
import { defaultSave } from '../../src/services/storage';
import { regionScene } from '../../src/ui/art/regions';
import type { BiomeId } from '../../src/meta/catalogs/species/types';

describe('the species catalog (D39 PR E)', () => {
  it('has at least five hundred kinds, every one well formed against the kit vocabulary', () => {
    expect(SPECIES.length).toBeGreaterThanOrEqual(500);
    expect(speciesProblems(SPECIES)).toEqual([]);
    expect(KINDS_TOTAL).toBe(SPECIES.length);
  });

  it('every landscape has kinds of its own, and its order starts with new kinds (the hand-drawn ones come last)', () => {
    for (const b of BIOME_IDS) {
      const list = biomeSpecies(b);
      expect(list.length, b).toBeGreaterThanOrEqual(12);
      expect(new Set(list.map((s) => s.id)).size).toBe(list.length);
      expect(list.every((s) => s.biome === b)).toBe(true);
      expect(list[0].drawn, `${b} starts with a new kind`).toBeUndefined();
      expect(list.length).toBe(speciesOfBiome(b).length);
    }
    // Every hand-drawn kind is in the catalog once, in a landscape.
    expect(DRAWN_SPECIES.every((d) => speciesById(d.id) === d)).toBe(true);
  });

  it("a landscape's places meet every one of its kinds before any comes round again", () => {
    const seen = new Map<string, Set<string>>();
    let met = 0;
    for (let k = 1; k <= 600; k++) {
      const p = placeDef(k);
      const set = seen.get(p.biome) ?? new Set<string>();
      seen.set(p.biome, set);
      // Within one place the swimmers may arrive last (review of D39 PR E): look at its new kinds first.
      for (const a of [...p.animals].sort((x, y) => Number(set.has(x.species)) - Number(set.has(y.species)))) {
        if (set.has(a.species)) {
          expect(set.size, `${a.id}: ${p.biome} came round before meeting all its kinds`).toBe(biomeSpecies(p.biome).length);
          set.clear();
        }
        set.add(a.species);
        if (k <= 100) met++;
      }
    }
    // The first hundred places alone bring well over three hundred animals.
    expect(met).toBeGreaterThan(300);
  });

  it('every species draws: a portrait in three moods, a board rig, and a scene figure', () => {
    for (const s of SPECIES) {
      if (s.drawn) continue;
      const d = kitHead(s);
      const p = kitPal(s.colors);
      for (const mood of ['idle', 'happy', 'sleepy'] as const) {
        const svg = d.art(p) + face(mood, d.face(p));
        expect(svg, s.id).not.toMatch(/NaN|undefined/);
      }
      const f = kitBody(s, p, 100, 260, 34 * kitScale(s));
      expect(f.body + f.tail + f.behind, s.id).not.toMatch(/NaN|undefined/);
      expect(Number.isFinite(f.headTop)).toBe(true);
    }
  });

  it('every hand-drawn kind has coats of its own (a place draws it in one)', () => {
    for (const d of DRAWN_SPECIES) if (!d.guest) expect(COATS[d.drawn!]?.length, d.id).toBeGreaterThan(0);
  });

  it('every place animal over a full lap of every landscape draws through every renderer (review of D39 PR E)', () => {
    const bases = new Set<string>();
    for (let k = 1; k <= 300; k++)
      for (const a of placeDef(k).animals) {
        if (a.base) bases.add(a.base);
        const out = [companionSvg(a.id, 'happy'), friendRigBody(a.id), companionFigure(a.id, 120, 260, 34, 'idle'), animalTint(a.id) ?? ''].join('');
        expect(out, a.id).not.toMatch(/NaN|undefined|Infinity/);
        const toy = toySpec(a.id);
        if (toy) expect(JSON.stringify(toy), a.id).not.toMatch(/null|NaN/);
        expect(animalInfo(a.id).kind).toBe(a.kind);
      }
    // The Pet Garden's fox and red panda are among them (their coats were once missing).
    expect(bases.has('ember')).toBe(true);
    expect(bases.has('maple')).toBe(true);
  });

  it('a kit animal of a place is drawn by the kit, rigged for its board tile, and sized for its kind', () => {
    const a = placeDef(1).animals.find((w) => !w.base)!;
    expect(kitSpeciesOf(a.id)?.id).toBe(a.species);
    expect(companionSvg(a.id)).toContain(`data-friend="${a.id}"`);
    expect(friendRigBody(a.id)).toContain('data-layer="eyes"');
    const fig = companionFigure(a.id, 100, 260, 34, 'idle');
    expect(fig).toContain(`data-kit=`);
    expect(Number(/data-gh="([\d.]+)"/.exec(fig)![1])).toBeCloseTo(34 * kitScale(speciesById(a.species)!), 1);
  });

  it('3D toys: kinds the toy builder can make get one; the rest keep their scene drawn', () => {
    const toyable = SPECIES.filter((s) => !s.drawn && kitHasToy(s));
    const not = SPECIES.filter((s) => !s.drawn && !kitHasToy(s));
    expect(toyable.length).toBeGreaterThan(150);
    expect(not.length).toBeGreaterThan(20);
    for (const s of toyable) expect(kitToy(s), s.id).not.toBeNull();
    for (const s of not) expect(kitToy(s), s.id).toBeNull();
    // In a place: an animal without a toy marks its figure, so the whole scene stays drawn.
    let found = false;
    for (let k = 1; k <= 200 && !found; k++) {
      const p = placeDef(k);
      const w = p.animals.find((x) => !x.base && !kitHasToy(speciesById(x.species)!));
      if (!w) continue;
      found = true;
      expect(toySpec(w.id)).toBeNull();
      expect(regionScene(p.id, { stage: 4, companions: [w.id], decor: [] }, 'n')).toContain('data-no-toy');
    }
    expect(found).toBe(true);
  });

  it('a place animal is its species: its kind, what it eats, its story, and where it lives in the wild', () => {
    const w = placeDef(2).animals.find((x) => !x.base)!;
    const s = speciesById(w.species)!;
    const info = animalInfo(w.id);
    expect(info.kind).toBe(s.name);
    expect(info.noun).toBe(kindNoun(s.name));
    expect(info.animal).toBe(s.eats);
    expect(info.bio).toBe(s.fact);
    expect(VOCAB.eats as readonly string[]).toContain(info.animal);
  });

  it('nouns keep a capital only for names of places and people; articles and plurals read right', () => {
    expect(kindNoun('Snow leopard')).toBe('snow leopard');
    expect(kindNoun('Galápagos tortoise')).toBe('Galápagos tortoise');
    expect(kindNoun("Przewalski's horse")).toBe("Przewalski's horse");
    expect(kindNoun('Bactrian camel')).toBe('Bactrian camel');
    expect(kindNoun('North American river otter')).toBe('North American river otter');
    expect(kindNoun('Christmas Island red crab')).toBe('Christmas Island red crab');
    expect(kindNoun('Giant Pacific octopus')).toBe('giant Pacific octopus');
    expect(kindNoun('Lion’s mane jellyfish')).toBe('lion’s mane jellyfish');
    expect(kindNoun('Gentoo penguin')).toBe('gentoo penguin');
    expect(withArticle('European robin')).toBe('a European robin');
    expect(withArticle('Eurasian lynx')).toBe('a Eurasian lynx');
    expect(withArticle('emu')).toBe('an emu');
    expect(['grey wolf', 'moose', 'wood mouse', 'red deer', 'musk ox', 'snow goose', 'fox', 'calf'].map(pluralNoun)).toEqual([
      'grey wolves', 'moose', 'wood mice', 'red deer', 'musk oxen', 'snow geese', 'foxes', 'calves',
    ]);
    // Every kind's noun starts lowercase unless its first word names a place or a person.
    for (const sp of SPECIES) expect(kindNoun(sp.name), sp.name).toMatch(/^([a-zʻ]|[A-Z][\wáé’'-]*( [A-Z][\w’'-]*)? )/);
  });

  it('kinds met counts each kind once, hand-made friends included', () => {
    const s = defaultSave(new Date(2026, 10, 1));
    s.inventory.companions = {};
    expect(kindsMet(s)).toBe(0);
    s.inventory.companions.cotton = { unlockedAt: 'x' };
    expect(speciesOfAnimal('cotton')).toBe('sheep');
    const w = placeDef(1).animals[0];
    s.inventory.companions[w.id] = { unlockedAt: 'x' };
    expect(kindsMet(s)).toBe(2);
  });

  it('every landscape has names for its animals and words for its places', () => {
    for (const b of BIOME_IDS as readonly BiomeId[]) {
      const p = Array.from({ length: 60 }, (_, i) => placeDef(i + 1)).find((x) => x.biome === b)!;
      expect(p, b).toBeDefined();
      expect(p.name).toMatch(/^[A-Z][\w’'-]*( [\w’'-]+)+$/);
    }
  });
});
