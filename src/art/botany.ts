/**
 * The meadow's living things, shared by the drawn scenes and the 3D walk (D47 PR 1): butterfly species, grass and
 * wildflower colours, and the seeded randomness both use to scatter them. One source, so the butterfly a player sees
 * in the drawn Farm is the same species, in the same colours, as the one that lands on a daisy in the walk.
 *
 * Everything here is original: the species are drawn from life in general terms (the shape of a forewing and a
 * hindwing, a vein pattern, an edge band, a few spots), not from any game's or film's art.
 */

export type ButterflyKind = 'monarch' | 'swallowtail' | 'blue' | 'white' | 'rose' | 'sulphur';

export interface ButterflyLook {
  kind: ButterflyKind;
  /** The wing's main colour, and a lighter wash near the outer edge. */
  fill: string;
  light: string;
  /** The dark border along the outer edge (or the wing colour itself, for an unbordered wing). */
  edge: string;
  /** Veins. */
  vein: string;
  /** Small spots along the border (none for some). */
  spot: string | null;
  /** Dark bands across the forewing (swallowtail), as fractions along the wing. */
  bands: number[];
  /** A tail on the hindwing. */
  tail: boolean;
  /** A dark tip at the forewing's apex (whites). */
  tip: string | null;
  /** Body. */
  body: string;
  /** Relative size. */
  size: number;
}

export const BUTTERFLIES: Record<ButterflyKind, ButterflyLook> = {
  monarch: { kind: 'monarch', fill: '#f08a24', light: '#f9b35a', edge: '#2b2420', vein: '#2b2420', spot: '#fff8ec', bands: [], tail: false, tip: null, body: '#2b2420', size: 1.1 },
  swallowtail: { kind: 'swallowtail', fill: '#f6d965', light: '#fbe9a0', edge: '#2a2622', vein: '#3a342c', spot: '#9fc9ef', bands: [0.32, 0.62], tail: true, tip: null, body: '#2a2622', size: 1.2 },
  blue: { kind: 'blue', fill: '#5ca8ea', light: '#a8d6fb', edge: '#2a4f80', vein: '#3a6fa8', spot: null, bands: [], tail: false, tip: null, body: '#33302d', size: 0.85 },
  white: { kind: 'white', fill: '#fbf9f0', light: '#ffffff', edge: '#e4e0d2', vein: '#c9c4b2', spot: '#3a3631', bands: [], tail: false, tip: '#3a3631', body: '#4a4540', size: 0.9 },
  rose: { kind: 'rose', fill: '#f2a2c0', light: '#fcd9e7', edge: '#a8466e', vein: '#c06a90', spot: '#fff4f8', bands: [], tail: false, tip: null, body: '#3b2c30', size: 0.95 },
  sulphur: { kind: 'sulphur', fill: '#f2e35c', light: '#faf2a8', edge: '#d8c63a', vein: '#cbb83a', spot: '#f29a3a', bands: [], tail: false, tip: null, body: '#4a4236', size: 0.95 },
};

export const BUTTERFLY_KINDS = Object.keys(BUTTERFLIES) as ButterflyKind[];

/**
 * A butterfly's right wings (the left are the mirror), as SVG path data: the drawn scenes draw them, the 3D walk paints
 * its wing textures from them. Body along the y axis, head toward −y; about 17 units across both wings at size 1.
 * Absolute M, L, C and Z only.
 */
export const WING = {
  fore: 'M0.4 -1C1.6 -3.8 4.8 -6.4 7.6 -6C8.4 -5.8 8.6 -4.9 8.2 -4C7.4 -2.2 5.2 -0.4 0.5 0.4Z',
  hind: 'M0.5 0.2C3.4 -0.2 6.4 0.8 6.6 2.8C6.8 4.6 5 6.2 3.2 6C1.8 5.9 0.9 4 0.4 1.6Z',
  hindTail: 'M0.5 0.2C3.4 -0.2 6.4 0.8 6.6 2.8C6.8 4.6 5.6 5.8 4.9 6L4.8 8.6C4.6 9.1 4 9.1 3.9 8.6L3.6 6.2C2.2 6 1 4.2 0.4 1.6Z',
  veins:
    'M0.6 -0.4C3 -2.6 5.4 -4.4 7.4 -5.4M0.6 -0.2C3.4 -1.6 6 -3 8 -4.1M0.7 0C3 -0.6 4.8 -1 6.2 -1.5M0.8 0.6C3 1 5 1.8 6.3 2.8M0.7 0.9C2.4 2.4 3.8 4 4.7 5.5M0.6 1.1C1.4 2.6 2.2 4.2 2.8 5.6',
  /** A dark tip at the forewing's apex. */
  tip: 'M6.2 -5.9C7 -6.3 8.3 -5.9 8.3 -4.6C7.7 -4.3 6.8 -4.6 6.2 -5.9Z',
  body: 'M0 -2.4C0.8 -2.2 0.75 3.4 0 4.8C-0.75 3.4 -0.8 -2.2 0 -2.4Z',
  /** Where a species' spots sit on the right wings: [x, y, radius]. */
  spots(kind: ButterflyKind): Array<[number, number, number]> {
    if (kind === 'white') return [[5.4, -3.4, 0.55]];
    if (kind === 'sulphur') return [[4.6, -2.6, 0.5]];
    return [
      [7.5, -5.2, 0.32],
      [8, -4.3, 0.28],
      [7.3, -3.2, 0.24],
      [6.1, 3.6, 0.3],
      [5.4, 4.9, 0.3],
      [4.2, 5.6, 0.26],
    ];
  },
  /** A dark band across the forewing at `t` (0–1 along it), clipped to the wing where it is drawn. */
  band(t: number): string {
    const r = (v: number) => Math.round(v * 10) / 10;
    const x = 0.4 + t * 8;
    return `M${r(x)} ${r(-1 - t * 5.4)}L${r(x + 1)} ${r(-1.4 - t * 5.4)}L${r(x + 1.8)} ${r(0.6 - t * 4)}L${r(x + 0.6)} ${r(0.8 - t * 3.6)}Z`;
  },
  /** The wings' extent: x from the body out, y from the forewing's apex to the tail's tip. */
  bounds: { x0: 0, x1: 8.8, y0: -6.6, y1: 9.4 },
};

/** Grass from the shaded root to the sunlit tip, in a few hues so a meadow is never one green. */
export const GRASS = {
  root: ['#4f8a3c', '#5a9442', '#4a7f3a'],
  mid: ['#76b04f', '#82bb58', '#6ea84b', '#8cc062'],
  tip: ['#a9d27a', '#b7da86', '#c4e092', '#9ccb6c'],
  /** Seed heads of tall meadow grass. */
  seed: ['#d8c38a', '#cdb57a', '#e2d29c'],
  /** Clover leaves. */
  clover: ['#4f9446', '#5aa04f'],
};

export type FlowerKind = 'buttercup' | 'daisy' | 'lavender' | 'dandelion' | 'clover' | 'seedhead';

export const FLOWERS = {
  buttercup: { petal: '#ffd21f', shine: '#fff2a0', center: '#e8a21a' },
  daisy: { petal: '#ffffff', shade: '#e6e8ee', center: '#f6c21c', centerDark: '#d99a12' },
  lavender: { bud: '#9d7fd0', budLight: '#c2a8ec', leaf: '#8fa98a' },
  dandelion: { petal: '#ffcf1f', petalDark: '#f0a81a', clock: '#ffffff', clockShade: '#e9eef2' },
  clover: { blossom: '#f2b8d0', blossomTip: '#fde6ef' },
  stem: '#6f9a4a',
  leaf: '#5e9446',
};

// ------------------------------------------------------------------ seeded randomness

/** A small, fast, seeded generator (mulberry32): the same seed always scatters the same meadow. */
export function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A seed from a string (a scene's id, a place's name). */
export function seedOf(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** Smooth value noise in 0–1: dense meadow here, a sparse patch there, never a grid. */
export function meadowNoise(x: number, y: number, seed = 0): number {
  const hash = (i: number, j: number) => {
    let h = Math.imul(i, 374761393) + Math.imul(j, 668265263) + Math.imul(seed, 2147483647);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  };
  const xi = Math.floor(x);
  const yi = Math.floor(y);
  const fx = x - xi;
  const fy = y - yi;
  const s = (t: number) => t * t * (3 - 2 * t);
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  return a + (b - a) * s(fx) + (c - a) * s(fy) + (a - b - c + d) * s(fx) * s(fy);
}

export const pick = <T,>(r: () => number, xs: readonly T[]): T => xs[Math.floor(r() * xs.length) % xs.length];
