/**
 * D47 PR 1: the 3D Farm's meadow. The same Farm grows the same meadow every time; nothing grows on the path, in the mud
 * or the pond, inside a building or a decoration, or where an animal stands; flowers grow in drifts; the lite tier
 * grows less. The meadow builds without a renderer (no NaN anywhere), thins at once when a walk drops to lite, its
 * butterflies rest under reduced motion, take off when the player walks up, and the pasture's discovery sends the
 * pasture's butterflies up together.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { BLOOM_HEIGHT, FIELD_TILE, MEADOW_COUNTS, PASTURE_CLOVER, PASTURE_HOME, bareGround, fieldMask, meadowLayout } from '../../src/three/meadowLayout';
import { bloomGeometry, buildMeadow, clumpGeometry, cloverGeometry } from '../../src/three/meadow';
import { ANIMAL_SPOTS, PLACES, groundY, obstaclesAt, pathOffset, pathX } from '../../src/three/walkMath';

const finite = (g: THREE.BufferGeometry) => [...(g.attributes.position.array as Float32Array)].every(Number.isFinite);

describe('where the meadow grows', () => {
  const all = meadowLayout(4, ['scarecrow', 'tractor', 'trough']);

  it('is the same every time', () => {
    expect(meadowLayout(4, ['scarecrow', 'tractor', 'trough'])).toEqual(all);
  });

  it('keeps off the path, the mud, the pond, buildings, decorations and the animals', () => {
    const obstacles = obstaclesAt(4, ['scarecrow', 'tractor', 'trough']);
    for (const p of [...all.clumps, ...all.blooms]) {
      expect(pathOffset(p.x, p.z)).toBeGreaterThanOrEqual(1);
      expect(Math.hypot(p.x - PLACES.pond.x, p.z - PLACES.pond.z)).toBeGreaterThan(PLACES.pond.r);
      for (const [ax, az] of ANIMAL_SPOTS) expect(Math.hypot(p.x - ax, p.z - az)).toBeGreaterThanOrEqual(0.75);
      for (const o of obstacles) if (o.r !== undefined) expect(Math.hypot(p.x - o.x, p.z - o.z)).toBeGreaterThanOrEqual(o.r);
    }
    // The barn (a turned box): nothing inside it.
    const bare = bareGround(4, []);
    expect(bare(PLACES.barn.x, PLACES.barn.z, 0)).toBe(true);
    expect(bare(PLACES.henhouse.x, PLACES.henhouse.z, 0)).toBe(true);
    expect(bare(pathX(20), 20, 0)).toBe(true); // the path at the gate
    expect(bare(-4, 14, 0)).toBe(false); // open grass
  });

  it('grows less in the lite tier, and grows the pasture clover where its butterflies rest', () => {
    const lite = meadowLayout(4, [], 'lite');
    expect(all.clumps.length).toBeGreaterThan(lite.clumps.length);
    expect(all.blooms.length).toBeGreaterThan(lite.blooms.length);
    expect(all.blooms.length).toBeLessThanOrEqual(MEADOW_COUNTS.high.blooms);
    for (const [x, z] of PASTURE_CLOVER) expect(all.blooms.some((b) => b.kind === 'clover' && b.x === x && b.z === z)).toBe(true);
    expect(all.flies).toHaveLength(MEADOW_COUNTS.high.flies);
    expect(lite.flies).toHaveLength(MEADOW_COUNTS.lite.flies);
    for (const f of all.flies) expect(all.perches[f.perch]).toBeDefined();
  });

  it('grows flowers in drifts: most flowers have a neighbour of their own kind close by', () => {
    const near = all.blooms.filter((b) => all.blooms.some((o) => o !== b && o.kind === b.kind && Math.hypot(o.x - b.x, o.z - b.z) < 1.5));
    expect(near.length / all.blooms.length).toBeGreaterThan(0.6);
  });

  it('puts every perch on its flower’s head', () => {
    all.blooms.forEach((b, i) => expect(all.perches[i].y).toBeCloseTo(groundY(b.x, b.z) + BLOOM_HEIGHT[b.kind] * b.s, 5));
  });

  it('maps the traveling grass: none on the path or in the barn, some on open ground', () => {
    const m = fieldMask(4, []);
    const at = (x: number, z: number) => m.data[Math.floor((z / m.extent + 0.5) * m.size) * m.size + Math.floor((x / m.extent + 0.5) * m.size)];
    expect(at(pathX(20), 20)).toBe(0);
    expect(at(PLACES.barn.x, PLACES.barn.z)).toBe(0);
    expect(at(PLACES.pond.x, PLACES.pond.z)).toBe(0);
    const open = [-4, -6, -8, 6, 8].map((x) => at(x, 16));
    expect(Math.max(...open)).toBeGreaterThan(60);
    expect(FIELD_TILE).toBeGreaterThan(20);
  });
});

describe('the meadow in three.js', () => {
  it('builds clumps, flowers and clover with no NaN', () => {
    for (const g of [clumpGeometry(1, 9, 0.36), cloverGeometry(2), ...(['buttercup', 'daisy', 'lavender', 'dandelion', 'clock', 'clover'] as const).map(bloomGeometry)]) {
      expect(g.attributes.position.count).toBeGreaterThan(0);
      expect(finite(g)).toBe(true);
      expect(g.attributes.aSway.count).toBe(g.attributes.position.count);
      expect(g.attributes.color.count).toBe(g.attributes.position.count);
      g.dispose();
    }
  });

  it('a flower’s head is where its butterflies land', () => {
    for (const k of ['daisy', 'buttercup', 'clover'] as const) {
      const g = bloomGeometry(k);
      g.computeBoundingBox();
      expect(g.boundingBox!.max.y).toBeGreaterThan(BLOOM_HEIGHT[k] * 0.85);
      expect(g.boundingBox!.max.y).toBeLessThan(BLOOM_HEIGHT[k] * 1.35);
      g.dispose();
    }
  });

  it('thins at once in the lite tier, and frees everything it made', () => {
    const made: Array<{ dispose(): void }> = [];
    const m = buildMeadow(4, [], 'high', groundY, (d) => made.push(d));
    const high = m.stats();
    expect(high.field).toBeGreaterThanOrEqual(MEADOW_COUNTS.high.field);
    expect(high.butterflies).toBe(MEADOW_COUNTS.high.flies);
    m.setTier('lite');
    const lite = m.stats();
    expect(lite.field).toBeLessThan(high.field / 2);
    expect(lite.clumps).toBeLessThan(high.clumps);
    expect(lite.blooms).toBeLessThan(high.blooms);
    expect(lite.butterflies).toBe(MEADOW_COUNTS.lite.flies);
    expect(made.length).toBeGreaterThan(10);
    for (const d of made) d.dispose();
  });

  it('butterflies rest under reduced motion, and take off when the player walks up (not under reduced motion)', () => {
    const m = buildMeadow(4, [], 'high', groundY, () => {});
    const f = m.butterflies.flies[0];
    const at = f.g.position.clone();
    for (let i = 0; i < 300; i++) m.update(0.05, true, { x: at.x, z: at.z });
    expect(f.state).toBe('rest');
    expect(f.g.position.distanceTo(at)).toBeLessThan(1e-6);
    m.update(0.05, false, { x: at.x + 0.3, z: at.z });
    expect(f.state).toBe('fly');
    // It flies away from the player and lands on another flower (in a few seconds).
    for (let i = 0; i < 200 && f.state === 'fly'; i++) m.update(0.05, false, { x: at.x + 0.3, z: at.z });
    expect(f.state).toBe('rest');
    expect(Math.hypot(f.g.position.x - at.x - 0.3, f.g.position.z - at.z)).toBeGreaterThan(1.3);
    expect([f.g.position.x, f.g.position.y, f.g.position.z].every(Number.isFinite)).toBe(true);
  });

  it('the pasture’s discovery sends its butterflies up together, once per arrival', () => {
    const m = buildMeadow(4, [], 'high', groundY, () => {});
    const pasture = m.butterflies.flies.filter((f) => Math.hypot(f.g.position.x - PASTURE_HOME.x, f.g.position.z - PASTURE_HOME.z) < PASTURE_HOME.r);
    expect(pasture.length).toBeGreaterThanOrEqual(3);
    const far = { x: 25, z: 25 };
    m.update(0.01, false, far);
    m.butterflies.scatter(1000);
    expect(pasture.every((f) => f.state === 'fly')).toBe(true);
    // Up they go.
    const y0 = pasture.map((f) => f.g.position.y);
    for (let i = 0; i < 10; i++) m.update(0.05, false, far);
    expect(pasture.some((f, i) => f.g.position.y > y0[i] + 0.3)).toBe(true);
  });
});
