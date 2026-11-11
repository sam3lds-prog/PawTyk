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
  /** `rot`: its turn about the vertical (three.js `rotation.y`), the same for the model and its collider. */
  barn: { x: 11, z: -12, w: 9, d: 11, rot: -0.35 },
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

/**
 * Where the Farm's decorations stand when the player has them out (D45 PR C): the same five as the drawn Farm. Each
 * is solid (a circle's `r`, or a box's half sizes).
 */
export type FarmDecor =
  | 'scarecrow'
  | 'wheelbarrow'
  | 'trough'
  | 'tireswing'
  | 'tractor'
  | 'rescuewagon'
  // D48 PR C: the four spots' pieces
  | 'flowerarch'
  | 'applecart'
  | 'bench'
  | 'festivalstage'
  | 'carousel'
  | 'rainbowslide'
  | 'butterflygarden'
  | 'pumpkinpatch'
  | 'camptent'
  | 'partytable'
  | 'whirligig'
  | 'cornshocks'
  | 'starlanterns'
  | 'barnbell'
  | 'bubblemachine'
  | 'duckfountain';

/**
 * D48 PR C: the Farm's four spots in 3D. A spot holds one piece at a time (the player picks which), so its pieces
 * share a place: the meadow east of the pasture, the hill behind it, the corner by the tire-swing tree, the pond.
 */
export const SPOTS_3D = {
  'farm-meadow': { x: 12.5, z: 8.5 },
  'farm-hill': { x: -3.5, z: -18.5 },
  'farm-corner': { x: -13.5, z: 18.5 },
  'farm-pond': { x: -12, z: 6 },
} as const;
const at = (spot: keyof typeof SPOTS_3D, rot: number, size: { r?: number; hw?: number; hd?: number; solid?: false }) => ({ ...SPOTS_3D[spot], rot, ...size, spot });

export interface DecorPlace {
  x: number;
  z: number;
  rot: number;
  /** A circle's radius, or a box's half sizes. */
  r?: number;
  hw?: number;
  hd?: number;
  /** D48 PR C: false for a piece standing in something solid already (the pond's fountain). */
  solid?: false;
  /** D48 PR C: the spot it shares with its alternatives. */
  spot?: keyof typeof SPOTS_3D;
}

export const DECOR_PLACES: Record<FarmDecor, DecorPlace> = {
  scarecrow: { x: -6.2, z: -9.5, rot: 0.5, r: 0.45 },
  wheelbarrow: { x: 8.6, z: 10.2, rot: -0.7, r: 0.95 },
  trough: { x: 11.5, z: 2.6, rot: 0.25, hw: 1.3, hd: 0.55 },
  tireswing: { x: -8.5, z: 16.5, rot: 0, r: 0.6 },
  tractor: { x: -2.2, z: -12.5, rot: 0.9, hw: 1.5, hd: 1.0 },
  // D47 PR 7: the Welcome Rescue Pack's wagon, up by the orchard (as in the drawn Farm).
  rescuewagon: { x: -15.5, z: -13.5, rot: 0.6, hw: 1.1, hd: 0.7 },
  // D48 PR C. The meadow by the path.
  flowerarch: at('farm-meadow', -0.5, { hw: 1.3, hd: 0.35 }),
  applecart: at('farm-meadow', -0.4, { hw: 1.3, hd: 0.8 }),
  bench: at('farm-meadow', -0.6, { hw: 1.2, hd: 0.45 }),
  festivalstage: at('farm-meadow', -0.5, { hw: 1.7, hd: 1.2 }),
  carousel: at('farm-meadow', 0, { r: 1.7 }),
  rainbowslide: at('farm-meadow', -0.7, { hw: 1.5, hd: 0.6 }),
  // The hill behind the pasture.
  butterflygarden: at('farm-hill', 0.2, { r: 1.7 }),
  pumpkinpatch: at('farm-hill', 0.2, { r: 1.7 }),
  camptent: at('farm-hill', 0.3, { hw: 1.2, hd: 1.3 }),
  partytable: at('farm-hill', 0.2, { hw: 1.5, hd: 0.7 }),
  // The corner by the tire-swing tree.
  whirligig: at('farm-corner', 0.4, { r: 0.6 }),
  cornshocks: at('farm-corner', 0.4, { r: 0.9 }),
  starlanterns: at('farm-corner', 0.4, { r: 0.6 }),
  barnbell: at('farm-corner', 0.4, { hw: 0.7, hd: 0.3 }),
  bubblemachine: at('farm-corner', 0.4, { r: 0.6 }),
  // In the pond: the pond is solid already.
  duckfountain: at('farm-pond', 0, { r: 0.8, solid: false }),
};
export const isFarmDecor = (id: string): id is FarmDecor => id in DECOR_PLACES;

/**
 * The Farm's destinations (D45 PR C): places with a name, somewhere to stand and look, and a small discovery when the
 * player first arrives. `at` is the place itself, `stand` where a "Go to" takes the player, `range` how close counts
 * as there.
 */
export type LandmarkId = 'barn' | 'pond' | 'orchard' | 'pasture';
export interface Landmark {
  id: LandmarkId;
  name: string;
  /** What happens there, said once on arrival. */
  discovery: string;
  /** Built from this stage. */
  stage: 1 | 2 | 3 | 4;
  at: { x: number; z: number };
  stand: { x: number; z: number };
  range: number;
}
export const LANDMARKS: Landmark[] = [
  { id: 'pasture', name: 'the pasture', discovery: 'Butterflies rise from the clover.', stage: 1, at: { x: 0, z: 2 }, stand: { x: -0.5, z: 6 }, range: 5.5 },
  { id: 'barn', name: 'the barn', discovery: 'The doors swing open, and a chick peeks out.', stage: 2, at: { x: 9.1, z: -6.8 }, stand: { x: 8.8, z: 1.2 }, range: 9.5 },
  { id: 'pond', name: 'the pond', discovery: 'The ducks splash hello.', stage: 3, at: { x: PLACES.pond.x, z: PLACES.pond.z }, stand: { x: -11, z: 13.4 }, range: PLACES.pond.r + 3.4 },
  { id: 'orchard', name: 'the orchard', discovery: 'An apple drops, and the birds fly up.', stage: 4, at: { x: -17.5, z: -16 }, stand: { x: -13, z: -9.5 }, range: 8.5 },
];
export const landmarksAt = (stage: number): Landmark[] => LANDMARKS.filter((l) => stage >= l.stage);

/** The destination the player is at (the nearest within its range), if any. The pasture gives way to anything closer. */
export function landmarkNear(x: number, z: number, stage: number): Landmark | null {
  let best: Landmark | null = null;
  let bestD = Infinity;
  for (const l of landmarksAt(stage)) {
    const d = Math.hypot(x - l.at.x, z - l.at.z);
    if (d > l.range) continue;
    // Relative closeness, so the wide pasture doesn't swallow the pond's bank.
    const k = d / l.range;
    if (k < bestD) {
      best = l;
      bestD = k;
    }
  }
  return best;
}

/** A point on the mini-map: 0–1 each way, x to the right, the gate at the bottom. */
export const mapPoint = (x: number, z: number): { u: number; v: number } => ({
  u: Math.max(0, Math.min(1, (x + BOUNDS) / (2 * BOUNDS))),
  v: Math.max(0, Math.min(1, (z + BOUNDS) / (2 * BOUNDS))),
});

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
  /** A box's turn about the vertical (as three.js `rotation.y`). */
  rot?: number;
}

/** The solid things on the Farm at a stage: the player walks round them, never through. */
export function obstaclesAt(stage: number, decor: readonly string[] = []): Obstacle[] {
  const f = new Set(featuresAt(stage));
  const out: Obstacle[] = [];
  if (f.has('barn')) out.push({ x: PLACES.barn.x, z: PLACES.barn.z, hw: PLACES.barn.w / 2 + 0.4, hd: PLACES.barn.d / 2 + 0.4, rot: PLACES.barn.rot });
  if (f.has('pond')) out.push({ x: PLACES.pond.x, z: PLACES.pond.z, r: PLACES.pond.r + 0.3 });
  if (f.has('henhouse')) out.push({ x: PLACES.henhouse.x, z: PLACES.henhouse.z, hw: 1.9, hd: 1.9 });
  if (f.has('hay')) out.push({ x: PLACES.hay.x, z: PLACES.hay.z, r: PLACES.hay.r + 0.3 });
  if (f.has('bales')) out.push({ x: PLACES.bales.x, z: PLACES.bales.z, hw: 1.9, hd: 1.4 });
  if (f.has('orchard')) for (const [x, z] of PLACES.orchard) out.push({ x, z, r: 0.8 });
  if (f.has('windmill')) out.push({ x: PLACES.windmill.x, z: PLACES.windmill.z, r: 1.6 });
  // The player's decorations are solid too.
  for (const id of decor) {
    if (!isFarmDecor(id)) continue;
    const p = DECOR_PLACES[id];
    if (p.solid === false) continue;
    out.push(p.r !== undefined ? { x: p.x, z: p.z, r: p.r } : { x: p.x, z: p.z, hw: p.hw, hd: p.hd, rot: p.rot });
  }
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
      // Into the box's own frame (undoing its turn), out by the nearest side, and back (D44 PR I review).
      const c = Math.cos(o.rot ?? 0);
      const sn = Math.sin(o.rot ?? 0);
      const wx = x - o.x;
      const wz = z - o.z;
      let lx = wx * c - wz * sn;
      let lz = wx * sn + wz * c;
      if (Math.abs(lx) < hw && Math.abs(lz) < hd) {
        const px = hw - Math.abs(lx);
        const pz = hd - Math.abs(lz);
        if (px < pz) lx = Math.sign(lx || 1) * hw;
        else lz = Math.sign(lz || 1) * hd;
        x = o.x + lx * c + lz * sn;
        z = o.z - lx * sn + lz * c;
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

/** The dirt path's middle at z: from the gate to the barn, a gentle S (D47: shared by the ground and the meadow). */
export function pathX(z: number): number {
  return Math.sin((z + 20) * 0.09) * 3 + (z < 0 ? (-z / 12) * 8 : 0);
}

/** How far a point is from the path's middle across it, or Infinity off its length (it runs from the gate to the barn). */
export function pathOffset(x: number, z: number): number {
  return z < 24 && z > -10 ? Math.abs(x - pathX(z)) : Infinity;
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
 *
 * `pivot` (following a route): turn on the spot first and set off once facing the way. Walking while turning cuts the
 * corner in an arc, and a route's legs are only known to be clear along the straight line (D45 PR C review).
 */
export function stepWalker(w: Walker, dt: number, obstacles: Obstacle[], pivot = false): boolean {
  if (!w.target) return false;
  const want = yawTo(w.x, w.z, w.target.x, w.target.z);
  w.yaw = turnToward(w.yaw, want, TURN * 1.6 * dt);
  const dist = Math.hypot(w.target.x - w.x, w.target.z - w.z);
  if (dist < 0.08) {
    w.target = null;
    return false;
  }
  const facing = Math.abs(Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw)));
  const go = pivot && facing > 0.12 ? 0 : Math.min(dist, SPEED * dt * Math.max(0, 1 - facing / 1.2));
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

/** Whether a point is free to stand on (inside the bounds, outside every obstacle and its margin). */
export function isFree(x: number, z: number, obstacles: Obstacle[], margin = 0.5): boolean {
  const s = settle(x, z, obstacles, margin);
  return Math.abs(s.x - x) < 1e-6 && Math.abs(s.z - z) < 1e-6;
}

/** Whether the straight line between two points is free all the way (sampled every 0.4 m). */
export function clearLine(a: { x: number; z: number }, b: { x: number; z: number }, obstacles: Obstacle[], margin = 0.5): boolean {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(1, Math.ceil(d / 0.4));
  for (let i = 1; i < n; i++) if (!isFree(a.x + ((b.x - a.x) * i) / n, a.z + ((b.z - a.z) * i) / n, obstacles, margin)) return false;
  return true;
}

/**
 * A way from `from` to `to` round the obstacles (D45 PR C): the points to walk through in order, ending at `to`
 * (settled out of any obstacle). A straight line when nothing is in the way; otherwise the shortest way over a 1 m
 * grid, with the corners it doesn't need taken out. Never empty.
 */
export function route(from: { x: number; z: number }, to: { x: number; z: number }, obstacles: Obstacle[]): Array<{ x: number; z: number }> {
  const goal = settle(to.x, to.z, obstacles, 0.55);
  if (clearLine(from, goal, obstacles)) return [goal];
  const N = 2 * BOUNDS + 1;
  const cell = (x: number, z: number) => (Math.round(z) + BOUNDS) * N + (Math.round(x) + BOUNDS);
  const free = (i: number) => isFree((i % N) - BOUNDS, Math.floor(i / N) - BOUNDS, obstacles);
  const clampCell = (v: number) => Math.max(-BOUNDS, Math.min(BOUNDS, Math.round(v)));
  const start = cell(clampCell(from.x), clampCell(from.z));
  const end = cell(clampCell(goal.x), clampCell(goal.z));
  // Breadth-first over the grid with diagonal steps costing more (a small Dijkstra: the grid is 61 × 61).
  const dist = new Float32Array(N * N).fill(Infinity);
  const prev = new Int32Array(N * N).fill(-1);
  const open: number[] = [start];
  dist[start] = 0;
  const steps = [
    [1, 0, 1],
    [-1, 0, 1],
    [0, 1, 1],
    [0, -1, 1],
    [1, 1, 1.414],
    [1, -1, 1.414],
    [-1, 1, 1.414],
    [-1, -1, 1.414],
  ];
  while (open.length) {
    let bi = 0;
    for (let i = 1; i < open.length; i++) if (dist[open[i]] < dist[open[bi]]) bi = i;
    const cur = open.splice(bi, 1)[0];
    if (cur === end) break;
    const cx = cur % N;
    const cz = Math.floor(cur / N);
    for (const [dx, dz, c] of steps) {
      const nx = cx + dx;
      const nz = cz + dz;
      if (nx < 0 || nz < 0 || nx >= N || nz >= N) continue;
      const ni = nz * N + nx;
      // The start and end cells count as free (the player may be standing right against something).
      if (ni !== end && !free(ni)) continue;
      const nd = dist[cur] + c;
      if (nd < dist[ni]) {
        if (dist[ni] === Infinity) open.push(ni);
        dist[ni] = nd;
        prev[ni] = cur;
      }
    }
  }
  if (prev[end] === -1) return [goal];
  const pts: Array<{ x: number; z: number }> = [];
  for (let i = end; i !== -1 && i !== start; i = prev[i]) pts.unshift({ x: (i % N) - BOUNDS, z: Math.floor(i / N) - BOUNDS });
  pts[pts.length - 1] = goal;
  // Take out every corner that can be walked past in a straight line.
  const out: Array<{ x: number; z: number }> = [];
  let at = from;
  let i = 0;
  while (i < pts.length) {
    let j = pts.length - 1;
    while (j > i && !clearLine(at, pts[j], obstacles)) j--;
    out.push(pts[j]);
    at = pts[j];
    i = j + 1;
  }
  return out;
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
