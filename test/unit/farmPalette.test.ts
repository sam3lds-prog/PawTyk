/**
 * D47 PR 3: one Farm, two ways of drawing it. The drawn Farm's things and the 3D walk's take their colours from the
 * same palette, so the barn, the straw, the sunflowers and the apples match; the meadow's come from the same botany.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { FARM } from '../../src/art/farmPalette';
import { appleTreeGeometry, sunflowerHeadGeometry } from '../../src/three/farmProps';
import { appleTree, barnDetail, roundBale, squareBales, sunflower } from '../../src/ui/art/farmArt';

const colours = (g: THREE.BufferGeometry) => {
  const c = g.attributes.color as THREE.BufferAttribute;
  const out = new Set<string>();
  const k = new THREE.Color();
  for (let i = 0; i < c.count; i++) out.add(k.setRGB(c.getX(i), c.getY(i), c.getZ(i)).getHexString());
  return out;
};
const hex = (c: string) => new THREE.Color(c).getHexString();

describe('the Farm’s shared palette', () => {
  it('the drawn sunflower, tree, bales and barn use it', () => {
    expect(sunflower(40, 190, 28)).toContain(FARM.sunflower.petal);
    expect(sunflower(40, 190, 28)).toContain(FARM.sunflower.disc);
    expect(appleTree(170, 118)).toContain(FARM.tree.apple);
    expect(appleTree(170, 118)).toContain(FARM.tree.leaves[0]);
    expect(roundBale(160, 194)).toContain(FARM.straw.bale);
    expect(squareBales()).toContain(FARM.straw.twine);
    expect(barnDetail()).toContain(FARM.barn.seam);
  });

  it('the 3D sunflower and tree are coloured from it too', () => {
    expect(colours(sunflowerHeadGeometry(1)).has(hex(FARM.sunflower.petal))).toBe(true);
    const tree = colours(appleTreeGeometry(1).geo);
    expect(tree.has(hex(FARM.tree.bark))).toBe(true);
    expect(FARM.tree.leaves.some((c) => tree.has(hex(c)))).toBe(true);
  });

  it('the drawn Farm pieces and the walk’s farm code hold no colours of their own for these things', () => {
    const drawn = readFileSync('src/ui/art/farmArt.ts', 'utf8');
    expect(drawn.match(/#[0-9a-f]{6}/gi) ?? []).toEqual([]);
    const walk = readFileSync('src/three/walk.ts', 'utf8');
    // The barn, the bales, the pond and the sunflowers come from the palette.
    for (const fn of ['buildBarn', 'buildBales', 'buildSunflowers', 'buildHenHouse']) {
      const body = walk.slice(walk.indexOf(`private ${fn}(`), walk.indexOf('\n  }\n', walk.indexOf(`private ${fn}(`)));
      expect(body, fn).toMatch(/FARM\./);
    }
  });
});
