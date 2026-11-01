// @vitest-environment happy-dom
/**
 * The endless world (D39 PRs D and E): generated places and their animals, pinned so a shipped place never changes, and the
 * world logic that opens them (by level, and as soon as every home before is complete), grows them, and draws them.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  BIOMES,
  FIRST_PLACE_AFTER,
  LEVELS_PER_PLACE,
  biomeOf,
  isPlaceId,
  isWildId,
  placeDef,
  slotsOf,
  wildDef,
} from '../../src/meta/catalogs/places';
import { placesSnapshot } from '../../src/meta/catalogs/placesSnapshot';
import { SANCTUARIES, arrivalOf, homeOf, isSanctuaryId, sanctuaryDef } from '../../src/meta/catalogs/sanctuaries';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { PETS } from '../../src/meta/catalogs/pets';
import { animalInfo, allHomeAnimals, isAnimalId, isHome } from '../../src/meta/animals';
import {
  activeSanctuary,
  creditSolve,
  isComplete,
  isOpen,
  nextToOpen,
  openPlaceCount,
  openRegions,
  reconcileWorld,
  worldIds,
} from '../../src/meta/world';
import { castFor, parseCast } from '../../src/meta/cast';
import { chapterAt, placeAfterChapter } from '../../src/meta/chapters';
import { animalKindOf } from '../../src/meta/feeding';
import { defaultSave, normalizeSave, type SaveV2 } from '../../src/services/storage';
import { regionScene } from '../../src/ui/art/regions';
import { companionSvg, friendRigBody, wearsNeckerchief } from '../../src/ui/art/companions';
import { toySpec } from '../../src/three/species';
import { speciesById } from '../../src/meta/catalogs/species/index';
import { kitHasToy } from '../../src/ui/art/kit';
import { finishOpenHomes, skipToLevel } from '../../src/app/qaTools';

const fresh = (): SaveV2 => defaultSave(new Date(2026, 9, 31, 12));
const at = '2026-10-31T12:00:00.000Z';

/** Every hand-made home finished: all their growth reached and everyone home. */
function finishBase(s: SaveV2): void {
  for (const d of SANCTUARIES) {
    s.world.growth[d.id] = Math.max(d.stages[d.stages.length - 1]?.at ?? 0, d.arrivals[d.arrivals.length - 1].at);
    for (const a of d.arrivals) {
      if (PETS.some((p) => p.id === a.id)) s.inventory.pets[a.id as never] = { unlockedAt: at };
      else s.inventory.companions[a.id] = { unlockedAt: at };
    }
  }
}

describe('places are pinned: a shipped place never changes (D39)', () => {
  it('the first forty places match the fixture exactly', () => {
    const fixture = JSON.parse(readFileSync('test/unit/fixtures/places-v1.json', 'utf8'));
    expect(JSON.parse(JSON.stringify(placesSnapshot(40)))).toEqual(fixture);
  });

  it('hundreds of places are well formed: names unique in a biome, animals unique by name, stages and arrivals in order', () => {
    const placeNames = new Set<string>();
    const animalNames = new Set<string>();
    const reserved = new Set([...COMPANIONS.map((c) => c.name), ...PETS.map((p) => p.name)]);
    let prev: string | null = null;
    for (let k = 1; k <= 300; k++) {
      const p = placeDef(k);
      expect(p.id).toBe(`p${k}`);
      expect(isPlaceId(p.id)).toBe(true);
      expect(placeNames.has(p.name), p.name).toBe(false);
      placeNames.add(p.name);
      expect(p.biome).not.toBe(prev);
      prev = p.biome;
      expect(p.opensAfterLevel).toBe(FIRST_PLACE_AFTER + LEVELS_PER_PLACE * (k - 1));
      expect(p.stages.map((s) => s.at)).toEqual([0, 3, 8, 15, 25]);
      expect(p.animals.length).toBe(slotsOf(k));
      expect(p.arrivals.map((a) => a.at)).toEqual(p.animals.length === 4 ? [3, 8, 15, 21] : [3, 8, 15]);
      const b = BIOMES[p.biome];
      // Pins sit in the biome's part of the world.
      expect(b.zones.some(([a, z, lo, hi]) => p.lon >= a && p.lon <= z && p.lat >= lo && p.lat <= hi)).toBe(true);
      for (const [slot, w] of p.animals.entries()) {
        expect(w.id).toBe(`w${k}-${slot}`);
        expect(isWildId(w.id)).toBe(true);
        expect(reserved.has(w.name)).toBe(false);
        if (k <= 60) {
          expect(animalNames.has(w.name), w.name).toBe(false);
          animalNames.add(w.name);
        }
        // Each is one of its landscape's species; a hand-drawn kind's story names it, a kit kind's is its true fact.
        const sp = speciesById(w.species)!;
        expect(sp.biome).toBe(p.biome);
        expect(w.kind).toBe(sp.name);
        expect(w.base).toBe(sp.drawn ?? null);
        if (w.base) expect(w.bio).toContain(w.name);
        else expect(w.bio).toBe(sp.fact);
      }
    }
  });

  it('two places of one biome in a row never look alike: the look or the mirroring changes', () => {
    const last = new Map<string, { look: string; mirror: boolean }>();
    for (let k = 1; k <= 120; k++) {
      const p = placeDef(k);
      const was = last.get(p.biome);
      if (was) expect(was.look !== p.look || was.mirror !== p.mirror).toBe(true);
      last.set(p.biome, { look: p.look, mirror: p.mirror });
    }
  });

  it('ids are validated: no place 0, no slot past the place, nothing that merely looks like one', () => {
    expect(isPlaceId('p0')).toBe(false);
    expect(isPlaceId('p01')).toBe(false);
    expect(isPlaceId('p12')).toBe(true);
    expect(isSanctuaryId('p12')).toBe(true);
    expect(isSanctuaryId('farm')).toBe(true);
    expect(isSanctuaryId('toString')).toBe(false);
    expect(isWildId('w1-2')).toBe(true);
    expect(isWildId(`w1-${slotsOf(1)}`)).toBe(false);
    expect(isWildId('w0-0')).toBe(false);
    expect(isAnimalId('w3-0')).toBe(true);
  });
});

describe("who the endless world's animals are", () => {
  it("an animal is one of its landscape's species, with its own name, trait and story", () => {
    const w = wildDef('w5-0');
    const sp = speciesById(w.species)!;
    const info = animalInfo('w5-0');
    expect(info.name).toBe(w.name);
    expect(info.kind).toBe(sp.name);
    expect(info.sanctuary).toBe('p5');
    expect(homeOf('w5-0')).toBe('p5');
    expect(arrivalOf('w5-0')).toMatchObject({ sanctuary: 'p5', at: 3, index: 0 });
    expect(animalKindOf('w5-0')).toBe(sp.eats);
  });

  it('a hand-drawn kind in a place keeps its drawing, in a coat of its own (an arctic fox, a rabbit)', () => {
    let guest = null as ReturnType<typeof wildDef> | null;
    for (let k = 1; k <= 120 && !guest; k++) guest = placeDef(k).animals.find((a) => a.base && speciesById(a.species)!.guest) ?? null;
    expect(guest).not.toBeNull();
    const info = animalInfo(guest!.id);
    expect(info.kind).toBe(guest!.kind);
    expect(['rabbit', 'fox']).toContain(info.animal);
    expect(animalKindOf(guest!.id)).toBe(info.animal);
    expect(guest!.coat.name).not.toBe('');
  });
});

describe('the world never runs out (D39)', () => {
  it('nothing new appears until every hand-made home is open; then the next place shows, locked', () => {
    const s = fresh();
    s.journey.nextLevel = 30;
    expect(worldIds(s)).toEqual(SANCTUARIES.map((d) => d.id));
    s.journey.nextLevel = 61;
    expect(worldIds(s)).toEqual([...SANCTUARIES.map((d) => d.id), 'p1']);
    expect(isOpen(s, 'p1')).toBe(false);
    expect(nextToOpen(s)).toMatchObject({ id: 'p1', left: 20, orSooner: true });
  });

  it('place k opens after its level, whatever else is finished', () => {
    const s = fresh();
    s.journey.nextLevel = FIRST_PLACE_AFTER + 1;
    expect(isOpen(s, 'p1')).toBe(true);
    expect(isOpen(s, 'p2')).toBe(false);
    expect(openPlaceCount(s)).toBe(1);
    s.journey.nextLevel = FIRST_PLACE_AFTER + 2 * LEVELS_PER_PLACE + 1;
    expect(openPlaceCount(s)).toBe(3);
    expect(openRegions(s).slice(-3)).toEqual(['p1', 'p2', 'p3']);
    // Still the hand-made homes first: they are what is being built.
    expect(activeSanctuary(s)).toBe('farm');
  });

  it('with every home before it complete, the next place opens at once, and finishing it opens the one after', () => {
    const s = fresh();
    s.journey.nextLevel = 61; // the Amazon is open
    finishBase(s);
    expect(isOpen(s, 'p1')).toBe(true);
    expect(activeSanctuary(s)).toBe('p1');
    const p1 = placeDef(1);
    let arrived: string[] = [];
    let opened: string[] = [];
    for (let i = 0; i < 25; i++) {
      const n = creditSolve(s, { boardSanctuary: activeSanctuary(s), openedBefore: openRegions(s), receipt: `b${i}`, puzzle: `Z5-${i}s` });
      arrived = [...arrived, ...(n?.arrived ?? [])];
      opened = [...opened, ...(n?.opened ?? [])];
    }
    expect(arrived).toEqual(p1.animals.map((a) => a.id));
    expect(isComplete(s, 'p1')).toBe(true);
    // The solve that finished it announced the next place, and the boards move there.
    expect(opened).toEqual(['p2']);
    expect(activeSanctuary(s)).toBe('p2');
    expect(s.world.unseen.p2?.opened).toBe(true);
    // Finished homes pay their gift once.
    expect(s.inventory.ledger.filter((e) => e.id === 'world:complete:p1')).toHaveLength(1);
  });

  it("a board for a place shows that place's next animal, and its cast survives a save", () => {
    const s = fresh();
    s.journey.nextLevel = 61;
    finishBase(s);
    const cast = castFor(s, 'pair', 7);
    expect(cast.sanctuary).toBe('p1');
    expect(cast.a).toBe('w1-0');
    expect(isAnimalId(cast.b)).toBe(true);
    expect(parseCast(JSON.parse(JSON.stringify(cast)), 'pair')).toEqual(cast);
  });

  it('a reload keeps every place and animal (ids are plain keys), and the startup reconcile welcomes anyone due', () => {
    const s = fresh();
    s.journey.nextLevel = 61;
    finishBase(s);
    s.world.growth.p1 = 9; // two arrivals due, not recorded (an interrupted write)
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.world.growth.p1).toBe(9);
    const came = reconcileWorld(back);
    expect(came).toEqual(['w1-0', 'w1-1']);
    expect(isHome(back, 'w1-1')).toBe(true);
    expect(allHomeAnimals(back).slice(-2)).toEqual(['w1-0', 'w1-1']);
    expect(reconcileWorld(back)).toEqual([]);
  });

  it('the tester shortcut finishes every open home, and a new place opens', () => {
    const s = fresh();
    skipToLevel(s, 81);
    const before = openPlaceCount(s);
    finishOpenHomes(s);
    expect(openPlaceCount(s)).toBe(before + 1);
    expect(worldIds(s).filter((id) => isOpen(s, id) && !isComplete(s, id))).toEqual([`p${before + 1}`]);
  });
});

describe('chapters that never end', () => {
  it('chapters past the fifth have names (never "Far Fields"), and each from the fourth opens a place', () => {
    expect(chapterAt(5).name).not.toMatch(/Far Fields/);
    expect(new Set(Array.from({ length: 150 }, (_, i) => chapterAt(5 + i).name)).size).toBe(150);
    expect(placeAfterChapter(2)).toBeNull();
    expect(placeAfterChapter(3)).toBe(1);
    expect(placeAfterChapter(4)).toBe(2);
    expect(placeDef(placeAfterChapter(9)!).opensAfterLevel).toBe(chapterAt(9).last);
  });
});

describe('drawing the endless world', () => {
  it('a place is drawn from its biome, with its animals at their spots and no decorations', () => {
    const p = placeDef(7);
    const svg = regionScene(p.id, { stage: 4, companions: p.animals.map((a) => a.id), decor: ['scarecrow', 'tractor'] }, 't');
    for (const a of p.animals) expect(svg).toContain(`data-friend="${a.id}"`);
    expect(svg).not.toContain('data-decor=');
    expect(svg).toMatch(/data-stage="4"/);
    // A hand-made region draws exactly as before.
    expect(regionScene('farm', { stage: 1, companions: ['cotton'], decor: [] }, 'f')).toContain('data-friend="cotton"');
  });

  it('looks and mirroring show up in the drawing', () => {
    const mirrored = Array.from({ length: 20 }, (_, i) => placeDef(i + 1)).find((p) => p.mirror)!;
    expect(regionScene(mirrored.id, { stage: 2, companions: [], decor: [] }, 'm')).toContain('matrix(-1 0 0 1 360 0)');
    const misty = Array.from({ length: 40 }, (_, i) => placeDef(i + 1)).find((p) => p.look === 'misty')!;
    expect(regionScene(misty.id, { stage: 0, companions: [], decor: [] }, 'x')).toContain('x-mist');
    const golden = Array.from({ length: 40 }, (_, i) => placeDef(i + 1)).find((p) => p.look === 'golden')!;
    expect(regionScene(golden.id, { stage: 0, companions: [], decor: [] }, 'g')).toContain('filter="url(#g-sky-look)"');
  });

  it('an animal wears its coat (and its neckerchief) on its portrait, its board face and its 3D toy', () => {
    const all = Array.from({ length: 200 }, (_, i) => placeDef(i + 1).animals).flat();
    // A hand-drawn kind in a coat.
    const drawn = all.find((a) => a.base && a.neckerchief && wearsNeckerchief(a.id))!;
    expect(drawn).toBeDefined();
    expect(companionSvg(drawn.id)).toContain(drawn.coat.fur);
    expect(companionSvg(drawn.id)).toContain('class="sp-neck"');
    expect(friendRigBody(drawn.id)).toContain('class="sp-neck"');
    const toy = toySpec(drawn.id)!;
    expect(toy.id).toBe(drawn.base); // built as its species
    expect(toy.fur).toBe(drawn.coat.fur);
    // A kit kind with a neckerchief, and its toy.
    const kit = all.find((a) => !a.base && a.neckerchief && wearsNeckerchief(a.id) && kitHasToy(speciesById(a.species)!))!;
    expect(kit).toBeDefined();
    expect(companionSvg(kit.id)).toContain('class="sp-neck"');
    expect(companionSvg(kit.id)).toContain(kit.coat.fur);
    expect(toySpec(kit.id)?.fur).toBe(kit.coat.fur);
  });

  it("an animal's card says it wears a neckerchief only when one is drawn", () => {
    const all = Array.from({ length: 40 }, (_, i) => placeDef(i + 1).animals).flat();
    const drawn = all.filter((a) => a.neckerchief && wearsNeckerchief(a.id));
    const undrawn = all.filter((a) => a.neckerchief && !wearsNeckerchief(a.id));
    expect(drawn.length).toBeGreaterThan(0);
    expect(undrawn.length).toBeGreaterThan(0); // a toucan, say: no chin to tie it under
    for (const a of undrawn) expect(companionSvg(a.id)).not.toContain('class="sp-neck"');
    for (const a of drawn) expect(companionSvg(a.id)).toContain('class="sp-neck"');
    expect(all.filter((a) => !a.neckerchief).every((a) => !wearsNeckerchief(a.id))).toBe(true);
  });

  it("a kangaroo of the endless world keeps the kangaroo's big feet as a toy", () => {
    const roo = Array.from({ length: 400 }, (_, i) => placeDef(i + 1).animals).flat().find((a) => a.base === 'skipper');
    expect(roo).toBeDefined();
    expect(toySpec(roo!.id)!.id).toBe('skipper');
  });

  it('every place in the first hundred draws without throwing', () => {
    for (let k = 1; k <= 100; k++) {
      const p = placeDef(k);
      expect(() => regionScene(p.id, { stage: 4, companions: p.animals.map((a) => a.id), decor: [], evening: k % 2 === 0 }, `z${k}`)).not.toThrow();
      expect(sanctuaryDef(p.id)).toBe(p);
      expect(biomeOf(k)).toBe(p.biome);
    }
  });
});
