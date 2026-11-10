/**
 * The walkable 3D Farm's layout and movement (D44 PR I), free of three.js so it can be tested on its own. Units are
 * metres on the ground plane: x to the right, z toward the gate (the player starts at the gate looking at the barn).
 */

export type FarmFeature = 'fence' | 'hay' | 'mud' | 'barn' | 'bales' | 'party' | 'pond' | 'henhouse' | 'sunflowers' | 'orchard' | 'windmill' | 'bunting';

/** What stands on the Farm at each stage (the same growth as its drawn scene). */
export const FEATURES_BY_STAGE: Record<1 | 2 | 3 | 4, FarmFeature[]> = {
  1: ['fence', 'hay', 'mud'],
  2: ['barn', 'bales', 'party'],
  3: ['pond', 'henhouse'],
  4: ['sunflowers', 'orchard', 'windmill', 'bunting'],
};

export function featuresAt(stage: number): FarmFeature[] {
  const out: FarmFeature[] = [];
  for (const s of [1, 2, 3, 4] as const) if (stage >= s) out.push(...FEATURES_BY_STAGE[s]);
  return out;
}

/** Where things stand. */
export const PLACES = {
  start: { x: 0, z: 20, yaw: 0 },
  barn: { x: 11, z: -12, w: 9, d: 11 },
  pond: { x: -12, z: 6, r: 4.6 },
  henhouse: { x: -11, z: -5, w: 3, d: 3 },
  hay: { x: 3, z: 3.5, r: 0.9 },
  bales: { x: 5.5, z: -5, w: 3, d: 2 },
  mud: { x: 1.5, z: 9, r: 2 },
  pasture: { x0: -7, x1: 7, z0: -7, z1: 12 },
  orchard: [
    [-22, -16],
    [-17, -20],
    [-12, -18],
    [-20, -11],
  ] as Array<[number, number]>,
  windmill: { x: -26, z: -32 },
  party: { x: 3, z: -8 },
};

/** How far the player can wander from the middle (beyond it the hills rise). */
export const BOUNDS = 30;
/** Eye height. */
export const EYE = 1.45;

export interface Obstacle {
  x: number;
  z: number;
  /** A circle's radius, or a box's half sizes. */
  r?: number;
  hw?: number;
  hd?: number;
}

/** The solid things on the Farm at a stage: the player walks round them, never through. */
export function obstaclesAt(stage: number): Obstacle[] {
  const f = new Set(featuresAt(stage));
  const out: Obstacle[] = [];
  if (f.has('barn')) out.push({ x: PLACES.barn.x, z: PLACES.barn.z, hw: PLACES.barn.w / 2 + 0.4, hd: PLACES.barn.d / 2 + 0.4 });
  if (f.has('pond')) out.push({ x: PLACES.pond.x, z: PLACES.pond.z, r: PLACES.pond.r + 0.3 });
  if (f.has('henhouse')) out.push({ x: PLACES.henhouse.x, z: PLACES.henhouse.z, hw: 1.9, hd: 1.9 });
  if (f.has('hay')) out.push({ x: PLACES.hay.x, z: PLACES.hay.z, r: PLACES.hay.r + 0.3 });
  if (f.has('bales')) out.push({ x: PLACES.bales.x, z: PLACES.bales.z, hw: 1.9, hd: 1.4 });
  if (f.has('orchard')) for (const [x, z] of PLACES.orchard) out.push({ x, z, r: 0.8 });
  if (f.has('windmill')) out.push({ x: PLACES.windmill.x, z: PLACES.windmill.z, r: 1.6 });
  return out;
}

/** Keeps a point inside the bounds and out of every obstacle (pushed to its nearest edge). */
export function settle(x: number, z: number, obstacles: Obstacle[], margin = 0.35): { x: number; z: number } {
  x = Math.max(-BOUNDS, Math.min(BOUNDS, x));
  z = Math.max(-BOUNDS, Math.min(BOUNDS, z));
  for (const o of obstacles) {
    if (o.r !== undefined) {
      const dx = x - o.x;
      const dz = z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + margin;
      if (d < min) {
        const k = d > 1e-6 ? min / d : 1;
        x = o.x + (d > 1e-6 ? dx * k : min);
        z = o.z + (d > 1e-6 ? dz * k : 0);
      }
    } else if (o.hw !== undefined && o.hd !== undefined) {
      const hw = o.hw + margin;
      const hd = o.hd + margin;
      const dx = x - o.x;
      const dz = z - o.z;
      if (Math.abs(dx) < hw && Math.abs(dz) < hd) {
        // Out by the nearest side.
        const px = hw - Math.abs(dx);
        const pz = hd - Math.abs(dz);
        if (px < pz) x = o.x + Math.sign(dx || 1) * hw;
        else z = o.z + Math.sign(dz || 1) * hd;
      }
    }
  }
  return { x, z };
}

/** The ground's height at a point: flat in the middle, rising into soft hills past the bounds. */
export function groundY(x: number, z: number): number {
  const r = Math.hypot(x, z);
  const rise = Math.max(0, r - BOUNDS + 2) ** 1.3 * 0.06;
  return rise + Math.sin(x * 0.21) * Math.cos(z * 0.17) * 0.12 * Math.min(1, r / 12);
}

/** Turns `from` toward `to` by at most `max` radians (the short way round). */
export function turnToward(from: number, to: number, max: number): number {
  let d = to - from;
  d = Math.atan2(Math.sin(d), Math.cos(d));
  return from + Math.max(-max, Math.min(max, d));
}

/** The yaw that looks from (x, z) toward (tx, tz); 0 looks toward -z (the barn from the gate). */
export const yawTo = (x: number, z: number, tx: number, tz: number) => Math.atan2(-(tx - x), -(tz - z));

export interface Walker {
  x: number;
  z: number;
  yaw: number;
  /** Where it's walking to, if anywhere. */
  target: { x: number; z: number } | null;
}

/** Walking speed (m/s) and turning speed (rad/s). */
export const SPEED = 4;
export const TURN = 2.4;

/**
 * One step of walking toward the target: turn to face it, then go, stopping round obstacles. Returns true while
 * still on the way.
 */
export function stepWalker(w: Walker, dt: number, obstacles: Obstacle[]): boolean {
  if (!w.target) return false;
  const want = yawTo(w.x, w.z, w.target.x, w.target.z);
  w.yaw = turnToward(w.yaw, want, TURN * 1.6 * dt);
  const dist = Math.hypot(w.target.x - w.x, w.target.z - w.z);
  if (dist < 0.08) {
    w.target = null;
    return false;
  }
  const facing = Math.abs(Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)));
  const go = Math.min(dist, SPEED * dt * Math.max(0, 1 - facing / 1.2));
  const nx = w.x - Math.sin(w.yaw) * go;
  const nz = w.z - Math.cos(w.yaw) * go;
  const s = settle(nx, nz, obstacles);
  // Blocked (an obstacle in the way): stop rather than slide forever.
  if (go > 0 && Math.hypot(s.x - w.x, s.z - w.z) < go * 0.2) {
    w.target = null;
    return false;
  }
  w.x = s.x;
  w.z = s.z;
  return true;
}

/** Moves the walker by a step forward (or back, negative) along its yaw, settled. */
export function nudge(w: Walker, metres: number, obstacles: Obstacle[]): void {
  const s = settle(w.x - Math.sin(w.yaw) * metres, w.z - Math.cos(w.yaw) * metres, obstacles);
  w.x = s.x;
  w.z = s.z;
}

/** Where each resident stands, in arrival order (the Farm's six friends, and room for more). */
export const ANIMAL_SPOTS: Array<[number, number]> = [
  [-3, 3],
  [1.5, 7.5],
  [5, 0.5],
  [5.5, -3.2],
  [-2.5, -3],
  [8, 6],
  [-6, 14],
  [9, 13],
];

/** Close enough for an animal to notice the player and say hello. */
export const HELLO_RANGE = 4;
