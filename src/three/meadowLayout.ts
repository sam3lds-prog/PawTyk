/**
 * Where the 3D Farm's meadow grows (D47 PR 1), free of three.js so it can be tested on its own: grass clumps over the
 * whole Farm, thick in patches and thin in others; wildflowers in drifts (a run of daisies, then buttercups); clover
 * in the pasture; and where the butterflies start. Nothing grows on the path, in the mud or the pond, inside a
 * building, or where an animal stands. The same Farm grows the same meadow every time (seeded), and the lite tier
 * grows fewer of everything.
 */

import { BUTTERFLY_KINDS, meadowNoise, seedOf, seeded, type ButterflyKind } from '../art/botany';
import { ANIMAL_SPOTS, PLACES, featuresAt, groundY, obstaclesAt, pathOffset, type Obstacle } from './walkMath';

export type BloomKind = 'buttercup' | 'daisy' | 'lavender' | 'dandelion' | 'clock' | 'clover';
export const BLOOM_KINDS: BloomKind[] = ['buttercup', 'daisy', 'lavender', 'dandelion', 'clock', 'clover'];

/** Flowers are a little larger than life, like the toys that live among them. */
export const FLOWER_SCALE = 1.6;
/** How tall each flower stands at scale 1 (metres): where its head is, and where a butterfly lands. */
export const BLOOM_HEIGHT: Record<BloomKind, number> = {
  buttercup: 0.34 * FLOWER_SCALE,
  daisy: 0.3 * FLOWER_SCALE,
  lavender: 0.44 * FLOWER_SCALE,
  dandelion: 0.24 * FLOWER_SCALE,
  clock: 0.32 * FLOWER_SCALE,
  clover: 0.13 * FLOWER_SCALE,
};

export interface Clump {
  x: number;
  z: number;
  /** Scale (about 1). */
  s: number;
  yaw: number;
  /** Which of the clump shapes. */
  v: number;
}
export interface Bloom {
  x: number;
  z: number;
  kind: BloomKind;
  s: number;
  yaw: number;
}
export interface Perch {
  x: number;
  y: number;
  z: number;
}
export interface MeadowLayout {
  clumps: Clump[];
  blooms: Bloom[];
  /** Low clover leaves, in patches. */
  clover: Clump[];
  /** Where butterflies land: every flower's head. */
  perches: Perch[];
  /** The butterflies: their species and the perch each starts on. */
  flies: Array<{ kind: ButterflyKind; perch: number }>;
}

export type MeadowTier = 'high' | 'lite';
/**
 * How much grows. `field`: the grass that travels with the player (dense wherever they walk); `clumps`: the grass
 * scattered over the whole Farm, seen from afar.
 */
export const MEADOW_COUNTS: Record<MeadowTier, { field: number; clumps: number; blooms: number; clover: number; flies: number }> = {
  high: { field: 3600, clumps: 1400, blooms: 620, clover: 170, flies: 7 },
  lite: { field: 1400, clumps: 500, blooms: 240, clover: 60, flies: 4 },
};

/** The traveling grass: a square this wide (metres) round the player, fading out toward its edge. */
export const FIELD_TILE = 28;

/** How far out the meadow grows (the fog takes over beyond), and how far out the flowers do. */
export const MEADOW_RADIUS = 46;
const BLOOM_RADIUS = 30;

/** The pasture's clover, where its butterflies rest (the D45 discovery: they rise from it), beside the path. */
export const PASTURE_CLOVER: Array<[number, number]> = [
  [-3.6, 4.8],
  [-2.4, 6.6],
  [-1.2, 4.6],
  [-0.2, 6.8],
  [-4.4, 6.4],
];
/** Where the pasture's butterflies live (they wander among the flowers within reach of it). */
export const PASTURE_HOME = { x: -1.8, z: 5.6, r: 5.5 };

/** Whether a point is inside an obstacle (plus `margin`). */
function inside(o: Obstacle, x: number, z: number, margin: number): boolean {
  if (o.r !== undefined) return Math.hypot(x - o.x, z - o.z) < o.r + margin;
  const c = Math.cos(o.rot ?? 0);
  const s = Math.sin(o.rot ?? 0);
  // Into the box's own frame (its turn about the vertical, as three.js rotation.y).
  const dx = x - o.x;
  const dz = z - o.z;
  const lx = dx * c - dz * s;
  const lz = dx * s + dz * c;
  return Math.abs(lx) < (o.hw ?? 0) + margin && Math.abs(lz) < (o.hd ?? 0) + margin;
}

/** Where nothing grows on a Farm at a stage: the path, the mud, the pond, buildings, decorations, animals' spots. */
export function bareGround(stage: number, decor: readonly string[] = []): (x: number, z: number, margin: number) => boolean {
  const obstacles = obstaclesAt(stage, decor);
  const f = new Set(featuresAt(stage));
  return (x, z, margin) => {
    if (pathOffset(x, z) < 1 + margin) return true;
    if (f.has('mud') && ((x - PLACES.mud.x) / (PLACES.mud.r * 1.3 + margin)) ** 2 + ((z - PLACES.mud.z) / (PLACES.mud.r * 0.8 + margin)) ** 2 < 1) return true;
    if (obstacles.some((o) => inside(o, x, z, margin))) return true;
    return ANIMAL_SPOTS.some(([ax, az]) => Math.hypot(x - ax, z - az) < 0.75 + margin);
  };
}

const NOISE = seedOf('walk-meadow-noise');

/** How thick the grass grows at a point (0–1): thick and thin patches from a slow noise, thinner far out. */
export function lushness(x: number, z: number): number {
  const d = Math.hypot(x, z);
  return Math.min(1, (0.25 + meadowNoise(x / 9, z / 9, NOISE) * 0.95) * (d > 32 ? 0.65 : 1));
}

/** The traveling grass's map: how thick it grows (0–255) over the Farm, bare where nothing grows. */
export interface FieldMask {
  data: Uint8Array;
  /** Pixels each way, and the square it covers (metres, centred on the Farm's middle). */
  size: number;
  extent: number;
}

export function fieldMask(stage: number, decor: readonly string[] = [], size = 256): FieldMask {
  const extent = MEADOW_RADIUS * 2;
  const bare = bareGround(stage, decor);
  const data = new Uint8Array(size * size);
  for (let j = 0; j < size; j++)
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size - 0.5) * extent;
      const z = ((j + 0.5) / size - 0.5) * extent;
      data[j * size + i] = bare(x, z, 0.05) ? 0 : Math.round(lushness(x, z) * 255);
    }
  return { data, size, extent };
}

export function meadowLayout(stage: number, decor: readonly string[] = [], tier: MeadowTier = 'high'): MeadowLayout {
  const want = MEADOW_COUNTS[tier];
  const r = seeded(seedOf('walk-meadow'));
  const bare = bareGround(stage, decor);
  const seed = NOISE;
  const lush = lushness;
  const scatter = (n: number, radius: number, margin: number, keep: (x: number, z: number) => boolean): Array<[number, number]> => {
    const out: Array<[number, number]> = [];
    for (let tries = 0; out.length < n && tries < n * 12; tries++) {
      // Even over the disc's area (not bunched at its middle).
      const a = r() * Math.PI * 2;
      const d = Math.sqrt(r()) * radius;
      const x = Math.cos(a) * d;
      const z = Math.sin(a) * d;
      if (r() > lush(x, z) || bare(x, z, margin) || !keep(x, z)) continue;
      out.push([x, z]);
    }
    return out;
  };

  const clumps: Clump[] = scatter(want.clumps, MEADOW_RADIUS, 0.05, () => true).map(([x, z]) => ({
    x,
    z,
    s: 0.75 + r() * 0.6 + (Math.hypot(x, z) > 30 ? 0.3 : 0),
    yaw: r() * Math.PI * 2,
    v: Math.floor(r() * 3),
  }));

  // Flowers grow in drifts: a slow noise picks the kind, so neighbours mostly match.
  const weights: Array<[BloomKind, number]> = [
    ['buttercup', 1.1],
    ['daisy', 1.2],
    ['dandelion', 0.55],
    ['clock', 0.25],
    ['lavender', 0.45],
    ['clover', 0.6],
  ];
  const total = weights.reduce((a, [, w]) => a + w, 0);
  const kindAt = (x: number, z: number): BloomKind => {
    let t = meadowNoise(x / 7, z / 7, seed + 7) * total;
    for (const [k, w] of weights) if ((t -= w) <= 0) return k;
    return 'daisy';
  };
  const blooms: Bloom[] = [];
  // The pasture's clover first (its butterflies rest there).
  for (const [x, z] of PASTURE_CLOVER) {
    blooms.push({ x, z, kind: 'clover', s: 1.1, yaw: r() * 6.28 });
    blooms.push({ x: x + 0.22, z: z + 0.16, kind: 'clover', s: 0.9, yaw: r() * 6.28 });
  }
  // Then drifts: a run of one kind round a middle, thick in the middle and thinning out, and a few strays between.
  const strays = Math.round(want.blooms * 0.12);
  const centres = scatter(Math.round((want.blooms - strays) / 11), BLOOM_RADIUS, 0.4, () => true);
  for (const [cx, cz] of centres) {
    const kind = kindAt(cx, cz);
    const n = 6 + Math.floor(r() * 10);
    const spread = 0.7 + r() * 1.6;
    for (let i = 0; i < n && blooms.length < want.blooms - strays; i++) {
      const a = r() * Math.PI * 2;
      const d = spread * Math.sqrt(r()) * (0.4 + r() * 0.6);
      const x = cx + Math.cos(a) * d;
      const z = cz + Math.sin(a) * d;
      if (bare(x, z, 0.25)) continue;
      blooms.push({ x, z, kind, s: 0.8 + r() * 0.4, yaw: r() * Math.PI * 2 });
    }
  }
  for (const [x, z] of scatter(want.blooms - blooms.length, BLOOM_RADIUS, 0.25, () => true))
    blooms.push({ x, z, kind: kindAt(x, z), s: 0.85 + r() * 0.35, yaw: r() * Math.PI * 2 });

  // Clover leaves: under the pasture's blossoms, and in patches where clover grows.
  const clover: Clump[] = [];
  for (const b of blooms) if (b.kind === 'clover' && clover.length < want.clover) clover.push({ x: b.x + (r() - 0.5) * 0.3, z: b.z + (r() - 0.5) * 0.3, s: 0.9 + r() * 0.4, yaw: r() * 6.28, v: 0 });
  for (const [x, z] of scatter(want.clover - clover.length, BLOOM_RADIUS, 0.1, (x, z) => kindAt(x, z) === 'clover' || r() < 0.3))
    clover.push({ x, z, s: 0.8 + r() * 0.5, yaw: r() * 6.28, v: 0 });

  const perches = blooms.map((b) => ({ x: b.x, y: groundY(b.x, b.z) + BLOOM_HEIGHT[b.kind] * b.s, z: b.z }));
  // The butterflies: the first ones on the pasture's clover, the rest on flowers about the Farm.
  const flies: MeadowLayout['flies'] = [];
  const near = blooms.map((b, i) => [b, i] as const).filter(([b]) => b.kind !== 'clover' && Math.hypot(b.x, b.z) < 18);
  for (let i = 0; i < want.flies; i++) {
    const kind = BUTTERFLY_KINDS[i % BUTTERFLY_KINDS.length];
    const perch = i < Math.min(4, want.flies - 1) ? i * 2 : near.length ? near[Math.floor(r() * near.length)][1] : i;
    flies.push({ kind, perch: Math.min(perch, perches.length - 1) });
  }
  return { clumps, blooms, clover, perches, flies };
}
