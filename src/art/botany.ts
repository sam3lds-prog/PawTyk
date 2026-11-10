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
