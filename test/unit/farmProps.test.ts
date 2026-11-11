/**
 * D47 PR 2: the Farm's finer things. The 3D pieces build with no NaN (trees with apples hanging off their foliage,
 * sunflower heads round their seed disc, stones, lily pads); textures fall back to plain without a canvas; the drawn
 * pieces stay light and well formed, and stand where they always stood.
 */
import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { appleGeometry, appleTreeGeometry, lilyPadGeometry, plankTexture, stoneGeometry, sunflowerHeadGeometry, sunflowerLeafGeometry } from '../../src/three/farmProps';
import { appleTree, barnDetail, fenceDetail, henHouseDetail, pathPebbles, pondBank, roundBale, squareBales, sunflower } from '../../src/ui/art/farmArt';
import { regionScene, regionThumb } from '../../src/ui/art/regions';

const finite = (g: THREE.BufferGeometry) => [...(g.attributes.position.array as Float32Array)].every(Number.isFinite);
const elements = (svg: string) => (svg.match(/<(path|g|circle|use|clipPath|ellipse|rect|polygon)\b/g) ?? []).length;

describe('3D farm pieces', () => {
  it('an apple tree: a trunk, branches and foliage, apples on the foliage’s outside, the same for the same seed', () => {
    const a = appleTreeGeometry(7);
    const b = appleTreeGeometry(7);
    expect(finite(a.geo)).toBe(true);
    expect(a.geo.attributes.color.count).toBe(a.geo.attributes.position.count);
    expect(a.apples.length).toBeGreaterThanOrEqual(12);
    expect(a.apples.map((p) => p.toArray())).toEqual(b.apples.map((p) => p.toArray()));
    a.geo.computeBoundingBox();
    // Apples hang among the leaves (above the trunk's split, below the crown's top).
    for (const p of a.apples) expect(p.y).toBeGreaterThan(1.8);
    expect(a.geo.boundingBox!.max.y).toBeGreaterThan(3.2);
    expect(a.geo.boundingBox!.max.y).toBeLessThan(5.5);
  });

  it('sunflower heads, leaves, apples, stones and lily pads build cleanly', () => {
    for (const g of [sunflowerHeadGeometry(3), sunflowerLeafGeometry(), appleGeometry(), stoneGeometry(5), lilyPadGeometry()]) {
      expect(g.attributes.position.count).toBeGreaterThan(8);
      expect(finite(g)).toBe(true);
    }
    const head = sunflowerHeadGeometry(3);
    head.computeBoundingSphere();
    expect(head.boundingSphere!.radius).toBeGreaterThan(0.35);
    expect(head.boundingSphere!.radius).toBeLessThan(0.6);
  });

  it('a painted texture without a canvas is a plain one (tests, odd devices)', () => {
    const t = plankTexture(1);
    expect(t).toBeInstanceOf(THREE.Texture);
    t.dispose();
  });
});

describe('the drawn Farm’s pieces', () => {
  it('draw without NaN, in a few elements each', () => {
    const pond = pondBank(62, 274, 50, 11);
    const parts = [sunflower(40, 190, 28), appleTree(170, 118, 0.8), roundBale(160, 194), squareBales(), barnDetail(), fenceDetail([8, 36], (x) => 186 - x * 0.02), pond.under, pond.over, pathPebbles([[143, 300], [287, 186]], () => 9), henHouseDetail()];
    for (const p of parts) {
      expect(p).not.toMatch(/NaN|undefined|Infinity/);
      expect(elements(p)).toBeLessThan(16);
    }
  });

  it('the Farm stays light, and its map card lighter', () => {
    const scene = regionScene('farm', { stage: 4, companions: [], decor: [] }, 'f');
    expect(elements(scene)).toBeLessThan(1600);
    expect(scene.length).toBeLessThan(220_000);
    expect(elements(regionThumb('farm', 4, 't'))).toBeLessThan(420);
  });
});
