/**
 * Personalities and bonding (D40 PR B): every animal has one of six temperaments that shapes its face, its greeting and
 * its hello, and friendship levels unlock a warmer hello, a beaming smile and a portrait, with nothing that ever decays.
 */
import { describe, expect, it } from 'vitest';
import { SPECIES } from '../../src/meta/catalogs/species/index';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { PETS } from '../../src/meta/catalogs/pets';
import { placeDef } from '../../src/meta/catalogs/places';
import { speciesTemperament, temperamentOf, TEMPERAMENTS, TEMPERAMENT_INFO } from '../../src/meta/temperament';
import { BOND_UNLOCKS, bondLevel, bondNews, hasUnlock, helloFriend, nextUnlock, portraits } from '../../src/meta/bonds';
import { patFriend } from '../../src/meta/sanctuary';
import { friendship } from '../../src/meta/feeding';
import { poseFor } from '../../src/ui/art/pets';
import { companionSvg, face } from '../../src/ui/art/companions';
import { defaultSave, normalizeSave } from '../../src/services/storage';

const day = (d: number) => new Date(2026, 10, d, 12);

describe('temperaments (D40 PR B)', () => {
  it('every animal has one: the residents, the hand-made friends, every kind and every animal of a place', () => {
    for (const p of PETS) expect(TEMPERAMENTS).toContain(temperamentOf(p.id));
    for (const c of COMPANIONS) expect(TEMPERAMENTS).toContain(temperamentOf(c.id));
    for (const s of SPECIES) expect(TEMPERAMENTS).toContain(speciesTemperament(s));
    for (let k = 1; k <= 40; k++) for (const a of placeDef(k).animals) expect(TEMPERAMENTS).toContain(temperamentOf(a.id));
    for (const t of TEMPERAMENTS) expect(TEMPERAMENT_INFO[t].greets.length).toBeGreaterThan(10);
  });

  it('the characters the design names: a playful piglet, a sleepy sheep, a shy bunny, a proud cat, a bouncy puppy', () => {
    expect(temperamentOf('truffle')).toBe('playful');
    expect(temperamentOf('cotton')).toBe('sleepy');
    expect(temperamentOf('juniper')).toBe('shy');
    expect(temperamentOf('clover')).toBe('proud');
    expect(temperamentOf('biscuit')).toBe('energetic');
    // And kinds keep the character they are known for.
    const of = (name: string) => speciesTemperament(SPECIES.find((s) => s.name === name)!);
    expect(of('Sea otter')).toBe('playful');
    expect(of('Giant panda')).toBe('sleepy');
    expect(of('Lion')).toBe('proud');
    expect(of('Red squirrel')).toBe('energetic');
    expect(of('Blue whale')).toBe('gentle');
    expect(of('Leopard tortoise')).toBe('gentle');
    expect(of('Fennec fox')).toBe('shy');
  });

  it('the six are spread across the kinds: none is rare, none takes over', () => {
    const n = new Map<string, number>();
    for (const s of SPECIES) n.set(speciesTemperament(s), (n.get(speciesTemperament(s)) ?? 0) + 1);
    for (const t of TEMPERAMENTS) {
      expect(n.get(t) ?? 0, t).toBeGreaterThanOrEqual(40);
      expect(n.get(t) ?? 0, t).toBeLessThan(SPECIES.length * 0.3);
    }
  });

  it("a friend's board face follows its temperament; the residents keep their hand-made faces", () => {
    const happy = (id: string) => JSON.stringify(poseFor(id, 'happy'));
    // Different temperaments smile differently.
    expect(new Set(['truffle', 'cotton', 'juniper', 'marigold', 'skipper', 'hazel'].map(happy)).size).toBe(6);
    // A shy one glances away as it smiles; a sleepy one smiles with its eyes shut.
    expect(poseFor('juniper', 'happy').px).toBeGreaterThan(0);
    expect(poseFor('cotton', 'happy').eyes).toBe('closed');
    // Pupils always stay inside the eye.
    for (const id of ['juniper', 'truffle', 'cotton']) for (const m of ['happy', 'curious', 'proud'] as const) expect(Math.abs(poseFor(id, m).px)).toBeLessThanOrEqual(1.6);
    // Residents: unchanged by temperament (Mochi's serene closed-eye smile is her own).
    expect(poseFor('mochi', 'happy').eyes).toBe('closed');
  });
});

describe('bonding (D40 PR B)', () => {
  it('a hello in a scene, a pat and food each count, the hello once a day', () => {
    const s = defaultSave(day(1));
    expect(helloFriend(s, 'truffle', day(1))).toBe(true);
    expect(helloFriend(s, 'truffle', day(1))).toBe(false);
    expect(patFriend(s, 'truffle', day(1))).toBe(true);
    expect(s.sanctuary.affection.truffle).toBe(2);
    expect(helloFriend(s, 'truffle', day(2))).toBe(true);
    expect(s.sanctuary.affection.truffle).toBe(3);
    // Another animal has its own hello.
    expect(helloFriend(s, 'cotton', day(2))).toBe(true);
  });

  it('levels unlock a warmer hello, a beaming smile, a portrait and a golden frame, in that order', () => {
    expect(BOND_UNLOCKS.map((u) => u?.unlock ?? null)).toEqual([null, 'greeting', 'expression', 'portrait', 'frame']);
    const s = defaultSave(day(1));
    expect(nextUnlock(s, 'truffle')).toEqual({ name: 'A warmer hello', level: 'Friend', hearts: 5 });
    s.sanctuary.affection.truffle = 4;
    helloFriend(s, 'truffle', day(3));
    const news = bondNews(s, 'truffle', 4, 'Truffle', day(3))!;
    expect(news.unlock).toBe('greeting');
    expect(news.line).toMatch(/Truffle has a warmer hello/);
    expect(hasUnlock(s, 'truffle', 'greeting')).toBe(true);
    expect(hasUnlock(s, 'truffle', 'expression')).toBe(false);
    // Nothing more until the next level.
    expect(bondNews(s, 'truffle', 5, 'Truffle', day(3))).toBeNull();
    s.sanctuary.affection.truffle = 35;
    const best = bondNews(s, 'truffle', 34, 'Truffle', day(9))!;
    expect(best.unlock).toBe('portrait');
    expect(s.sanctuary.bestSince.truffle).toBe(day(9).toISOString());
  });

  it('nothing decays: days away never take a heart or a level back', () => {
    const s = defaultSave(day(1));
    s.sanctuary.affection.cotton = 16;
    expect(bondLevel(s, 'cotton')).toBe(2);
    // A month later, the same.
    helloFriend(s, 'cotton', new Date(2026, 11, 20));
    expect(s.sanctuary.affection.cotton).toBe(17);
    expect(friendship(17).name).toBe('Good friend');
  });

  it("portraits: every best friend who lives here, the newest last, earlier best friends included; and saves keep it", () => {
    const s = defaultSave(day(1));
    s.sanctuary.affection = { truffle: 40, cotton: 80, hazel: 10 };
    s.sanctuary.bestSince = { truffle: day(5).toISOString() };
    const home = (id: string) => id !== 'nobody';
    expect(portraits(s, home).map((p) => [p.id, p.golden])).toEqual([
      ['cotton', true],
      ['truffle', false],
    ]);
    s.sanctuary.greeted.truffle = '2026-11-05';
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.sanctuary.bestSince.truffle).toBe(day(5).toISOString());
    expect(back.sanctuary.greeted.truffle).toBe('2026-11-05');
    // An old save without the new fields loads with them empty.
    const old = JSON.parse(JSON.stringify(s));
    delete old.sanctuary.greeted;
    delete old.sanctuary.bestSince;
    expect(normalizeSave(old).sanctuary.greeted).toEqual({});
  });

  it("a shy good friend keeps its own eyes while it looks away; the beaming eyes come with the smile", async () => {
    const { readFileSync } = await import('node:fs');
    const css = readFileSync('src/ui/styles/sanctuary-life.css', 'utf8');
    const rule = css.match(/([^{}]*)\{\s*transition-delay:\s*480ms;\s*\}/)!;
    expect(rule[1]).toContain(`[data-temper='shy']`);
    for (const part of ['sp-eyes-open', 'sp-eyes-closed', 'sp-eyes-beam', 'sp-mouth--happy']) expect(rule[1], part).toContain(part);
    // A Kākāpō is playful: names with letters like ā and ō are matched as whole words too.
    expect(speciesTemperament(SPECIES.find((s) => s.name === 'Kākāpō')!)).toBe('playful');
  });

  it('the beaming smile: every friend face can show it, and nothing else shows it by default', () => {
    const beam = face('beam');
    expect(beam).toMatch(/class="sp-eyes-beam" style="opacity:1"/);
    expect(beam).toMatch(/class="sp-eyes-open" style="opacity:0"/);
    expect(face('happy')).toMatch(/class="sp-eyes-beam" style="opacity:0"/);
    for (const id of ['truffle', 'luna', 'rio', placeDef(2).animals[0].id]) expect(companionSvg(id as never, 'beam'), id).toMatch(/sp-eyes-beam" style="opacity:1"/);
  });
});
