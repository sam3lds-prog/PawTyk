/**
 * Drawn botany (D47 PR 1): butterflies, grass and wildflowers for the illustrated scenes, in SVG. They replace the
 * two-ellipse butterflies, the four-stroke grass tufts and the circle flowers with organic shapes: forewings and
 * hindwings with veins, a border and spots; tapered, curving grass blades shaded from root to tip; seed heads, clover,
 * buttercups, daisies, lavender, dandelions and leaf rosettes. The species and colours come from `art/botany.ts`, as
 * the 3D walk's do.
 *
 * Light by design: a scene is re-drawn on every frame of a camera glide, and the world map draws one per place. So a
 * plant is a handful of elements (all its petals one path, all its blades of a shade one path), a meadow stays near a
 * thousand elements, and map thumbnails leave the meadow out (`stripMeadow`).
 *
 * Coordinates are the scene's (360 × 300). Everything is placed by a seeded generator, so a scene draws the same
 * meadow every time, and densities follow smooth noise: thick patches and sparse ones, never a grid.
 *
 * Animation hooks are the scenes' own: grass is `.sp-grass` (swayed by the ambient director), a butterfly `.sp-birds`
 * (fluttered by it), and a meadow is one part, so a breath of wind moves its nearest clumps together and stirs the
 * butterflies' wings (CSS, not under reduced motion).
 */

import { BUTTERFLIES, FLOWERS, GRASS, meadowNoise, pick, seeded, type ButterflyKind } from '../../art/botany';

const n = (v: number) => String(Math.round(v * 10) / 10);

// ------------------------------------------------------------------ paths

/** A 2D affine transform, as SVG's matrix(a b c d e f). */
export type Affine = [number, number, number, number, number, number];
const T = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
const mul = (p: Affine, q: Affine): Affine => [
  p[0] * q[0] + p[2] * q[1],
  p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3],
  p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4],
  p[1] * q[4] + p[3] * q[5] + p[5],
];
const R = (deg: number): Affine => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
};
const S = (sx: number, sy = sx): Affine => [sx, 0, 0, sy, 0, 0];
/** Transforms combined as in an SVG transform list: the last is applied first. */
const tf = (...ms: Affine[]) => ms.reduce(mul);

/** Path data moved by a transform, still absolute (absolute M, L, C, Q and Z only: every number half an x y pair). */
function xform(d: string, m: Affine): string {
  return d.replace(/(-?\d*\.?\d+(?:e-?\d+)?)[ ,]+(-?\d*\.?\d+(?:e-?\d+)?)/g, (_, xs: string, ys: string) => {
    const x = +xs;
    const y = +ys;
    return `${m[0] * x + m[2] * y + m[4]} ${m[1] * x + m[3] * y + m[5]}`;
  });
}

/**
 * Moves path data by a transform, so many small shapes can share one path element instead of each carrying its own
 * `transform`. Absolute M, L, C, Q and Z commands in; compact path data out (see `compact`).
 */
export function place(d: string, m: Affine): string {
  return compact(xform(d, m));
}

/** A number of tenths, as short as SVG allows (`.5`, `-.5`). */
const tenths = (v: number) => String(v / 10).replace(/^(-?)0\./, '$1.');

/**
 * Absolute path data (M, L, C, Q, Z) rewritten short: relative steps, no repeated command letters, no leading zeros.
 * Every point is rounded to a tenth first and the steps between them are exact, so shapes still close. It starts with
 * an absolute M, so compact paths can be joined end to end.
 */
export function compact(d: string): string {
  const tokens = d.match(/[MLCQZ]|-?\d*\.?\d+(?:e-?\d+)?/g) ?? [];
  let out = '';
  let last = '';
  let prev = '';
  let cmd = '';
  let cx = 0;
  let cy = 0;
  let sx = 0;
  let sy = 0;
  const num = (v: number) => {
    const t = tenths(v);
    // A separator only where the grammar needs one.
    out += last && t[0] !== '-' && !(t[0] === '.' && last.includes('.')) ? ` ${t}` : t;
    last = t;
  };
  const letter = (c: string) => {
    out += c;
    last = '';
    prev = c;
  };
  for (let i = 0; i < tokens.length; ) {
    if (/^[MLCQZ]$/.test(tokens[i])) cmd = tokens[i++];
    if (cmd === 'Z') {
      letter('z');
      cx = sx;
      cy = sy;
      continue;
    }
    const per = cmd === 'C' ? 3 : cmd === 'Q' ? 2 : 1;
    const pts: number[] = [];
    for (let k = 0; k < per * 2; k++) pts.push(Math.round(+tokens[i++] * 10));
    if (!out) letter('M');
    else {
      const c = cmd === 'M' ? 'm' : cmd.toLowerCase();
      if (c === 'm' || c !== prev) letter(c);
    }
    for (let k = 0; k < per; k++) {
      num(pts[k * 2] - cx);
      num(pts[k * 2 + 1] - cy);
    }
    cx = pts[per * 2 - 2];
    cy = pts[per * 2 - 1];
    if (cmd === 'M') {
      sx = cx;
      sy = cy;
    }
  }
  return out;
}

/** An almond (a petal, a bud, a seed) centred on the origin, pointing up: `w` is half its width, `h` its length. */
const lens = (w: number, h: number) => `M0 ${-h / 2}Q${w} 0 0 ${h / 2}Q${-w} 0 0 ${-h / 2}Z`;
/** A rounded petal from the origin outward, pointing up, `len` long. */
const petal = (w: number, len: number) => `M0 0C${-w} ${-len * 0.3} ${-w} ${-len} 0 ${-len}C${w} ${-len} ${w} ${-len * 0.3} 0 0Z`;
/** A circle as path data (not for `place`: it uses arcs). */
const dot = (x: number, y: number, r: number) => `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`;

/**
 * A ring of `k` petals as one closed outline (petals meeting at `rIn`, under the flower's centre), centred on the
 * origin: `narrow` (0–1) is how much of its share of the ring a petal fills toward the tip.
 */
function petalRing(k: number, rIn: number, rOut: number, narrow: number, rot = 0): string {
  const half = Math.PI / k;
  const p = (r: number, a: number) => `${n(Math.sin(a) * r)} ${n(-Math.cos(a) * r)}`;
  let d = '';
  for (let i = 0; i < k; i++) {
    const a = (rot * Math.PI) / 180 + i * 2 * half;
    d += `${i ? '' : `M${p(rIn, a - half)}`}Q${p(rOut, a - half * narrow)} ${p(rOut * 1.06, a)}Q${p(rOut, a + half * narrow)} ${p(rIn, a + half)}`;
  }
  return `${d}Z`;
}

// ------------------------------------------------------------------ butterflies

/** The right forewing and hindwing (the left is the mirror), body along the y axis; about 17 units across at size 1. */
const FORE = 'M0.4 -1C1.6 -3.8 4.8 -6.4 7.6 -6C8.4 -5.8 8.6 -4.9 8.2 -4C7.4 -2.2 5.2 -0.4 0.5 0.4Z';
const HIND = 'M0.5 0.2C3.4 -0.2 6.4 0.8 6.6 2.8C6.8 4.6 5 6.2 3.2 6C1.8 5.9 0.9 4 0.4 1.6Z';
const HIND_TAIL = 'M0.5 0.2C3.4 -0.2 6.4 0.8 6.6 2.8C6.8 4.6 5.6 5.8 4.9 6L4.8 8.6C4.6 9.1 4 9.1 3.9 8.6L3.6 6.2C2.2 6 1 4.2 0.4 1.6Z';
const VEINS =
  'M0.6 -0.4C3 -2.6 5.4 -4.4 7.4 -5.4M0.6 -0.2C3.4 -1.6 6 -3 8 -4.1M0.7 0C3 -0.6 4.8 -1 6.2 -1.5M0.8 0.6C3 1 5 1.8 6.3 2.8M0.7 0.9C2.4 2.4 3.8 4 4.7 5.5M0.6 1.1C1.4 2.6 2.2 4.2 2.8 5.6';
/** Where the border's spots sit, on the right wings. */
const SPOTS: Array<[number, number, number]> = [
  [7.5, -5.2, 0.32],
  [8, -4.3, 0.28],
  [7.3, -3.2, 0.24],
  [6.1, 3.6, 0.3],
  [5.4, 4.9, 0.3],
  [4.2, 5.6, 0.26],
];
const BODY = 'M0 -2.4C0.8 -2.2 0.75 3.4 0 4.8C-0.75 3.4 -0.8 -2.2 0 -2.4Z';
/** A wing shrunk toward the body (its border shows around it). */
const inner = (d: string, s: number) => place(d, tf(T(0.5, 0), S(s), T(-0.5, 0)));

/** One side's wings, coloured as their kind: border, wing, a wash of light, bands, a tip, veins and spots. */
function wings(kind: ButterflyKind, clip: string): string {
  const b = BUTTERFLIES[kind];
  const hind = b.tail ? HIND_TAIL : HIND;
  let out = `<path d="${hind}${FORE}" fill="${b.edge}"/><path d="${inner(hind, 0.84)}${inner(FORE, 0.84)}" fill="${b.fill}"/><path d="${place(FORE, tf(T(2.2, -1.6), S(0.5)))}${place(hind, tf(T(1.6, 1.4), S(0.45)))}" fill="${b.light}" opacity="0.5"/>`;
  if (b.bands.length)
    out += `<path clip-path="url(#${clip})" fill="${b.edge}" d="${b.bands
      .map((t) => {
        const x = 0.4 + t * 8;
        return `M${n(x)} ${n(-1 - t * 5.4)}L${n(x + 1)} ${n(-1.4 - t * 5.4)}L${n(x + 1.8)} ${n(0.6 - t * 4)}L${n(x + 0.6)} ${n(0.8 - t * 3.6)}Z`;
      })
      .join('')}"/>`;
  if (b.tip) out += `<path d="M6.2 -5.9C7 -6.3 8.3 -5.9 8.3 -4.6C7.7 -4.3 6.8 -4.6 6.2 -5.9Z" fill="${b.tip}"/>`;
  out += `<path d="${VEINS}" stroke="${b.vein}" stroke-width="0.22" fill="none" opacity="0.85"/>`;
  if (b.spot) {
    const spots: Array<[number, number, number]> = b.kind === 'white' ? [[5.4, -3.4, 0.55]] : b.kind === 'sulphur' ? [[4.6, -2.6, 0.5]] : SPOTS;
    out += `<path d="${spots.map(([x, y, r]) => dot(x, y, r)).join('')}" fill="${b.spot}"/>`;
  }
  return out;
}

let clipCount = 0;

/**
 * A butterfly at (x, y), seen from above with its wings open, turned by `angle` degrees. `open` (0–1) folds the wings
 * toward the body (a resting butterfly holds them half shut). Its own `.sp-birds` group, for the ambient flutter.
 */
export function butterfly(x: number, y: number, kind: ButterflyKind, o: { scale?: number; angle?: number; open?: number; id?: string } = {}): string {
  const b = BUTTERFLIES[kind];
  const s = (o.scale ?? 0.62) * b.size;
  const sx = n(Math.max(0.22, o.open ?? 1));
  // Its own ids: the band clip, and the right wings (the left are the same, mirrored).
  const clip = `${o.id ?? 'bf'}-bf${clipCount++ % 10000}`;
  const defs = b.bands.length ? `<clipPath id="${clip}"><path d="${FORE}"/></clipPath>` : '';
  const w = wings(kind, clip);
  // The outer group carries no transform of its own: the flutter (CSS) moves it, the inner one places the butterfly.
  const delay = -(((Math.round(x) * 7 + Math.round(y) * 13) % 50) / 10);
  return `<g class="sp-birds sp-bf" data-bf="${kind}" style="--bfd:${n(delay)}s"><g transform="translate(${n(x)} ${n(y)}) rotate(${n(o.angle ?? 0)}) scale(${n(s)})">${defs}<g class="bf-wl"><g transform="scale(-${sx} 1)"><use href="#${clip}w"/></g></g><g class="bf-wr"><g transform="scale(${sx} 1)"><g id="${clip}w">${w}</g></g></g><path d="${BODY}M-0.85 -1.5a0.85 1.3 0 1 0 1.7 0a0.85 1.3 0 1 0 -1.7 0Z${dot(0, -3.2, 0.72)}${dot(-2, -7, 0.32)}${dot(2, -7, 0.32)}" fill="${b.body}"/><path d="M-0.25 -3.7C-0.7 -5.2 -1.4 -6.4 -2 -7M0.25 -3.7C0.7 -5.2 1.4 -6.4 2 -7" stroke="${b.body}" stroke-width="0.24" fill="none"/></g></g>`;
}

// ------------------------------------------------------------------ grass and wildflowers

/** The defs a scene's botany needs (blade shading from root to tip, a buttercup's gloss), once per scene. */
export function botanyDefs(id: string): string {
  const grad = (k: number) =>
    `<linearGradient id="${id}-blade${k}" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="${GRASS.root[k % GRASS.root.length]}"/><stop offset="0.55" stop-color="${GRASS.mid[k]}"/><stop offset="1" stop-color="${GRASS.tip[k]}"/></linearGradient>`;
  return `<defs>${[0, 1, 2, 3].map(grad).join('')}<radialGradient id="${id}-cup" cx="0.4" cy="0.35" r="0.7"><stop offset="0" stop-color="${FLOWERS.buttercup.shine}"/><stop offset="0.5" stop-color="${FLOWERS.buttercup.petal}"/><stop offset="1" stop-color="#f2b20f"/></radialGradient></defs>`;
}

/** One tapered blade from its root at (x, y), upright at the root and curving over toward the tip, as path data. */
function blade(x: number, y: number, len: number, w: number, bend: number): string {
  return compact(
    `M${x - w} ${y}C${x - w * 0.7} ${y - len * 0.38} ${x + bend * 0.45 - w * 0.25} ${y - len * 0.78} ${x + bend} ${y - len + Math.abs(bend) * 0.25}C${x + bend * 0.5 + w * 0.3} ${y - len * 0.72} ${x + w * 0.65} ${y - len * 0.32} ${x + w} ${y}Z`,
  );
}

/** A clump's blades as path data: [the back ones, the front ones]. */
function blades(x: number, y: number, r: () => number, scale: number, k: number): [string, string] {
  const lean = (r() - 0.5) * 6 * scale;
  let back = '';
  let front = '';
  for (let i = 0; i < k; i++) {
    const isBack = i < k / 2;
    const len = (7 + r() * 9) * scale * (isBack ? 0.9 : 1);
    const d = blade(x + (r() - 0.5) * 4 * scale, y - (isBack ? 0.4 : 0), len, (0.55 + r() * 0.45) * scale, lean + (r() - 0.5) * len * 1.1);
    if (isBack) back += d;
    else front += d;
  }
  return [back, front];
}

/** A clump of grass, shaded from root to tip: back blades darker, front ones sunlit, each bending its own way. */
export function grassClump(id: string, x: number, y: number, r: () => number, scale = 1, sway = false): string {
  const [back, front] = blades(x, y, r, scale, 5 + Math.floor(r() * 4));
  const g = Math.floor(r() * 2);
  return `<g${sway ? ' class="sp-grass"' : ''}><path d="${back}" fill="url(#${id}-blade${g})"/><path d="${front}" fill="url(#${id}-blade${g + 2})"/></g>`;
}

/** Tall meadow grass with a seed head nodding at the top. */
export function seedGrass(x: number, y: number, r: () => number, scale = 1): string {
  const h = (15 + r() * 9) * scale;
  const bend = (r() - 0.5) * 7 * scale;
  const tx = x + bend;
  const ty = y - h;
  const c = pick(r, GRASS.mid);
  let seeds = '';
  const k = 6 + Math.floor(r() * 4);
  for (let i = 0; i < k; i++) {
    const t = i / k;
    const side = i % 2 ? 1 : -1;
    seeds += place(lens(0.45, 2.5), tf(T(tx - bend * 0.25 * t + side * 0.7 * scale, ty + t * h * 0.32), R(side * 32), S(scale)));
  }
  return `<g class="sp-grass"><path d="M${n(x)} ${n(y)}Q${n(x + bend * 0.2)} ${n(y - h * 0.6)} ${n(tx)} ${n(ty)}" stroke="${c}" stroke-width="${n(0.5 * scale)}" fill="none"/><path d="${seeds}" fill="${pick(r, GRASS.seed)}"/></g>`;
}

/** Three heart-shaped leaflets (a trefoil), as one outline. */
const TREFOIL = [0, 120, 240].map((a) => xform('M0 0Q-2 -1 -0.8 -2.1Q-0.2 -2.5 0 -1.7Q0.2 -2.5 0.8 -2.1Q2 -1 0 0Z', R(a))).join('');

/** A patch of clover: trefoil leaves in two greens, and now and then a pink-white blossom. */
export function clover(x: number, y: number, r: () => number, scale = 1, bloomChance = 0.4): string {
  const k = 3 + Math.floor(r() * 3);
  const shades = ['', ''];
  for (let i = 0; i < k; i++) {
    const s = (0.75 + r() * 0.35) * scale;
    shades[i % 2] += place(TREFOIL, tf(T(x + (r() - 0.5) * 9 * scale, y + (r() - 0.5) * 2.4 * scale - 1.6 * s), R(r() * 40 - 20), S(s, s * 0.72)));
  }
  let out = `<path d="${shades[0]}" fill="${GRASS.clover[0]}"/><path d="${shades[1]}" fill="${GRASS.clover[1 % GRASS.clover.length]}"/>`;
  if (r() < bloomChance) {
    const bx = x + (r() - 0.5) * 5 * scale;
    const by = y - 4.4 * scale;
    const florets = [-60, -30, 0, 30, 60].map((a) => place(lens(0.35, 1.8), tf(T(bx, by), R(a), T(0, -1.1 * scale), S(scale)))).join('');
    out += `<path d="M${n(bx)} ${n(y)}q${n(0.4 * scale)} ${n(-2 * scale)} 0 ${n(-4 * scale)}" stroke="${FLOWERS.stem}" stroke-width="${n(0.35 * scale)}" fill="none"/><path d="${dot(bx, by, 1.5 * scale)}" fill="${FLOWERS.clover.blossom}"/><path d="${florets}" fill="${FLOWERS.clover.blossomTip}"/>`;
  }
  return `<g>${out}</g>`;
}

/** A gently curving stem from (x, y), `h` tall: its element, and where its top is. */
function stem(x: number, y: number, h: number, bend: number, w: number): [string, number, number] {
  const tx = x + bend;
  const ty = y - h;
  return [`<path d="M${n(x)} ${n(y)}Q${n(x - bend * 0.3)} ${n(y - h * 0.55)} ${n(tx)} ${n(ty)}" stroke="${FLOWERS.stem}" stroke-width="${n(w)}" fill="none"/>`, tx, ty];
}

export function buttercup(id: string | null, x: number, y: number, r: () => number, scale = 1): string {
  const [s, tx, ty] = stem(x, y, (7 + r() * 5) * scale, (r() - 0.5) * 3 * scale, 0.4 * scale);
  const head = tf(T(tx, ty), S(scale, scale * 0.82));
  const petals = [0, 72, 144, 216, 288].map((a) => place(petal(1.35, 2.75), mul(head, R(a)))).join('');
  const leaf = place('M0 -0.2C-2 -0.8 -3 -2.2 -2.2 -3C-1.6 -2.6 -0.6 -2 0 -0.2Z', tf(T(x, y), S(scale)));
  return `<g><path d="${leaf}" fill="${FLOWERS.leaf}"/>${s}<path d="${petals}" fill="${id ? `url(#${id}-cup)` : FLOWERS.buttercup.petal}"/><path d="${dot(tx, ty, 0.8 * scale)}" fill="${FLOWERS.buttercup.center}"/><path d="${place(lens(0.4, 1.4), tf(T(tx - 0.5 * scale, ty - 1.4 * scale), S(scale)))}" fill="#fffbe0" opacity="0.8"/></g>`;
}

export function daisy(x: number, y: number, r: () => number, scale = 1): string {
  const [s, tx, ty] = stem(x, y, (8 + r() * 6) * scale, (r() - 0.5) * 3.6 * scale, 0.38 * scale);
  const head = tf(T(tx, ty), R((r() - 0.5) * 30), S(scale, scale * 0.74));
  return `<g>${s}<path d="${place(petalRing(11, 0.8, 3.6, 0.5, 16), head)}" fill="${FLOWERS.daisy.shade}"/><path d="${place(petalRing(12, 0.8, 3.7, 0.45), head)}" fill="${FLOWERS.daisy.petal}"/><path d="${dot(tx, ty, 1.1 * scale)}" fill="${FLOWERS.daisy.center}"/><path d="${place(lens(0.5, 2), mul(head, tf(T(0, 0.45), R(90))))}" fill="${FLOWERS.daisy.centerDark}" opacity="0.7"/></g>`;
}

export function lavender(x: number, y: number, r: () => number, scale = 1): string {
  let stems = '';
  let spikes = '';
  let tips = '';
  const k = 2 + Math.floor(r() * 3);
  for (let i = 0; i < k; i++) {
    const h = (11 + r() * 7) * scale;
    const bend = (i - (k - 1) / 2) * 2.6 * scale + (r() - 0.5) * 2 * scale;
    const sx = x + (r() - 0.5) * 1.6 * scale;
    const tx = sx + bend;
    const ty = y - h;
    stems += `M${n(sx)} ${n(y)}Q${n(sx - bend * 0.3)} ${n(y - h * 0.55)} ${n(tx)} ${n(ty)}`;
    // The flower spike: whorls of buds up the top of the stem (a dotted stroke), the tip lighter and finer.
    const bx = tx - bend * 0.16;
    const by = ty + h * 0.42;
    spikes += `M${n(bx)} ${n(by)}L${n(tx - bend * 0.05)} ${n(ty + h * 0.12)}`;
    tips += `M${n(tx - bend * 0.05)} ${n(ty + h * 0.14)}L${n(tx)} ${n(ty)}`;
  }
  const bud = n(1.15 * scale);
  // Narrow grey-green leaves at the foot.
  const leaves = [-1, -0.4, 0.5, 1].map((d) => place('M0 0C1.2 -2 2.6 -4 3.6 -5.6C2 -3.6 0.6 -1.6 0 0Z', tf(T(x, y), S(d * scale, scale)))).join('');
  return `<g><path d="${leaves}" fill="${FLOWERS.lavender.leaf}"/><path d="${stems}" stroke="${FLOWERS.stem}" stroke-width="${n(0.32 * scale)}" fill="none"/><path d="${spikes}" stroke="${FLOWERS.lavender.bud}" stroke-width="${bud}" stroke-dasharray="0.01 ${n(0.95 * scale)}" stroke-linecap="round" fill="none"/><path d="${spikes}" stroke="${FLOWERS.lavender.budLight}" stroke-width="${n(0.7 * scale)}" stroke-dasharray="0.01 ${n(0.95 * scale)}" stroke-dashoffset="${n(0.48 * scale)}" stroke-linecap="round" fill="none"/><path d="${tips}" stroke="${FLOWERS.lavender.budLight}" stroke-width="${n(0.75 * scale)}" stroke-dasharray="0.01 ${n(0.7 * scale)}" stroke-linecap="round" fill="none"/></g>`;
}

const TOOTHED = 'M0 0L-1.2 -1.4L-0.6 -1.6L-1.6 -3L-0.8 -3.1L-1.4 -4.6L-0.4 -4.2L0 -5.6L0.4 -4.2L1.4 -4.6L0.8 -3.1L1.6 -3L0.6 -1.6L1.2 -1.4Z';

export function dandelion(x: number, y: number, r: () => number, scale = 1, clock = false): string {
  const leaves = [-50, -20, 15, 45].map((a) => place(TOOTHED, tf(T(x, y), R(a), S(scale * 0.8, scale * 0.62)))).join('');
  const [s, tx, ty] = stem(x, y, (9 + r() * 6) * scale, (r() - 0.5) * 3 * scale, 0.36 * scale);
  let head: string;
  if (clock) {
    let rays = '';
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      rays += `M${n(tx)} ${n(ty)}l${n(Math.cos(a) * 2.5 * scale)} ${n(Math.sin(a) * 2.5 * scale)}`;
    }
    // Seeds round the clock: a dotted ring.
    const rr = 2.7 * scale;
    head = `<circle cx="${n(tx)}" cy="${n(ty)}" r="${n(2.8 * scale)}" fill="${FLOWERS.dandelion.clock}" opacity="0.38"/><path d="${rays}" stroke="${FLOWERS.dandelion.clockShade}" stroke-width="${n(Math.max(0.1, 0.14 * scale))}"/><circle cx="${n(tx)}" cy="${n(ty)}" r="${n(rr)}" fill="none" stroke="${FLOWERS.dandelion.clock}" stroke-width="${n(0.62 * scale)}" stroke-dasharray="0.01 ${n((Math.PI * 2 * rr) / 14)}" stroke-linecap="round"/><circle cx="${n(tx)}" cy="${n(ty)}" r="${n(0.5 * scale)}" fill="#c8b48a"/>`;
  } else {
    const m = tf(T(tx, ty), S(scale, scale * 0.8));
    head = `<path d="${place(petalRing(16, 0.6, 2.4, 0.6), m)}" fill="${FLOWERS.dandelion.petal}"/><path d="${place(petalRing(11, 0.4, 1.5, 0.6, 12), m)}${dot(tx, ty, 0.6 * scale)}" fill="${FLOWERS.dandelion.petalDark}"/>`;
  }
  return `<g><path d="${leaves}" fill="${FLOWERS.leaf}"/>${s}${head}</g>`;
}

/** A small leafy plant flat on the ground. */
export function rosette(x: number, y: number, r: () => number, scale = 1): string {
  const k = 5 + Math.floor(r() * 3);
  const shades = ['', ''];
  for (let i = 0; i < k; i++) {
    const a = -80 + (i / (k - 1)) * 160 + (r() - 0.5) * 12;
    const len = (3 + r() * 2) * scale;
    shades[i % 2] += place(petal(0.9 * scale, len), tf(T(x, y), S(1, 0.62), R(a)));
  }
  return `<g><path d="${shades[0]}" fill="${pick(r, GRASS.root)}"/><path d="${shades[1]}" fill="${pick(r, GRASS.mid)}"/></g>`;
}

// ------------------------------------------------------------------ a meadow

export interface MeadowOptions {
  /** The lawn's top edge at x (its horizon), and its bottom. */
  top: (x: number) => number;
  bottom?: number;
  /** Seed: the home's or the landscape's own (the same place, the same meadow). */
  seed: number;
  /** 0–1: how much of the lawn grows. */
  density?: number;
  /** Places to keep clear (animals' spots, buildings, the sign): [x, y, radius] or [x, y, rx, ry]. */
  avoid?: Array<[number, number, number] | [number, number, number, number]>;
  /** Clear ground, such as a path. */
  clear?: (x: number, y: number) => boolean;
  /** Which flowers grow here, and how much (relative weights). Grass and clover always do. */
  flowers?: Partial<Record<'buttercup' | 'daisy' | 'lavender' | 'dandelion' | 'clock' | 'seedgrass', number>>;
  /** Butterflies to scatter over the flowers. */
  butterflies?: ButterflyKind[];
  /** How many clumps sway in a breath of wind (the nearest few). */
  swaying?: number;
  /** A scale for the whole meadow (sparse landscapes use smaller plants). */
  scale?: number;
}

/** A meadow's markers, so a map thumbnail can leave it out (`stripMeadow`). */
const OPEN = '<!--meadow-->';
const CLOSE = '<!--/meadow-->';

/**
 * A meadow on the lawn: clumps of grass, patches of clover, and flowers that grow together by kind (a drift of daisies
 * here, buttercups there), thick in some places and thin in others, smaller toward the horizon, drawn back to front,
 * kept off paths and clear of where animals stand. Returns the SVG, where the flowers are (butterflies land there),
 * and where every plant is rooted.
 */
export function meadow(id: string, o: MeadowOptions): { svg: string; blooms: Array<[number, number]>; roots: Array<[number, number]> } {
  const r = seeded(o.seed);
  const bottom = o.bottom ?? 300;
  const density = o.density ?? 0.6;
  const items: Array<{ y: number; svg: string }> = [];
  const blooms: Array<[number, number]> = [];
  const roots: Array<[number, number]> = [];
  const weights = Object.entries(o.flowers ?? { buttercup: 1, daisy: 1, lavender: 0.4, dandelion: 0.5, clock: 0.2, seedgrass: 0.8 }).filter(([, w]) => (w ?? 0) > 0) as Array<[string, number]>;
  const total = weights.reduce((a, [, w]) => a + w, 0);
  const kindAt = (x: number, y: number) => {
    // Flowers grow in drifts: a slow noise picks the kind, so neighbours mostly match.
    let t = meadowNoise(x / 46, y / 34, o.seed + 7) * total;
    for (const [k, w] of weights) if ((t -= w) <= 0) return k;
    return weights[weights.length - 1]?.[0] ?? 'daisy';
  };
  const clearOf = (x: number, y: number) =>
    !(o.avoid ?? []).some(([ax, ay, rx, ry]) => ((x - ax) / rx) ** 2 + ((y - ay) / (ry ?? rx / 1.4)) ** 2 < 1) && !o.clear?.(x, y);
  const cell = 17;
  const sway: number[] = [];
  for (let gy = 0; gy < 30; gy++)
    for (let gx = -1; gx < 23; gx++) {
      const x = gx * cell + r() * cell;
      const y0 = o.top(Math.max(0, Math.min(360, x)));
      const y = y0 + 6 + gy * cell * 0.6 + r() * cell * 0.6;
      if (y > bottom + 6 || x < -6 || x > 366) continue;
      const depth = Math.max(0, Math.min(1, (y - y0) / Math.max(40, bottom - y0)));
      // Thick and thin patches; the near meadow a little fuller than the far.
      const lush = meadowNoise(x / 38, y / 26, o.seed) * 0.85 + depth * 0.25;
      if (lush < 1 - density || !clearOf(x, y)) continue;
      const s = (0.5 + depth * 0.75) * (o.scale ?? 1);
      // Far off, flowers would be specks: the far meadow is mostly grass.
      const roll = depth < 0.22 ? r() * 0.7 : r();
      let svg: string;
      if (roll < 0.5) {
        svg = grassClump(id, x, y, r, s);
        if (depth > 0.5) sway.push(items.length);
      } else if (roll < 0.62) svg = clover(x, y, r, s * 0.9);
      else if (roll < 0.68) svg = rosette(x, y, r, s);
      else {
        const k = kindAt(x, y);
        svg =
          k === 'buttercup'
            ? buttercup(id, x, y, r, s)
            : k === 'daisy'
              ? daisy(x, y, r, s)
              : k === 'lavender'
                ? lavender(x, y, r, s)
                : k === 'dandelion'
                  ? dandelion(x, y, r, s)
                  : k === 'clock'
                    ? dandelion(x, y, r, s, true)
                    : seedGrass(x, y, r, s);
        if (k !== 'seedgrass') blooms.push([Math.round(x * 10) / 10, Math.round((y - 10 * s) * 10) / 10]);
        // A few blades in front, so the flower grows in the grass rather than on the lawn.
        if (r() < 0.55) svg += `<path d="${blades(x + (r() - 0.5) * 3, y + 1, r, s * 0.7, 4)[1]}" fill="url(#${id}-blade2)"/>`;
      }
      items.push({ y, svg });
      roots.push([x, y]);
    }
  // The nearest clumps sway in a breath of wind (a few: the rest stay still, so a phone has little to animate).
  sway.sort((a, b) => items[b].y - items[a].y);
  for (const i of sway.slice(0, o.swaying ?? 10)) items[i].svg = items[i].svg.replace('<g>', '<g class="sp-grass">');
  items.sort((a, b) => a.y - b.y);
  const flies = (o.butterflies ?? []).map((kind, i) => {
    const at = blooms.length ? blooms[Math.floor(r() * blooms.length)] : [60 + i * 80, 200];
    return butterfly(at[0], at[1] - 2, kind, { angle: (r() - 0.5) * 50, open: i % 2 ? 0.75 : 1, id });
  });
  // One part for the ambient director (it looks for `.sp-meadow` as for a stage feature): a breath of wind sways the
  // nearest clumps together and stirs the butterflies' wings; a flutter takes them off and brings them back.
  const svg = `${OPEN}<g class="sp-meadow">${items.map((i) => i.svg).join('')}${flies.join('')}</g>${CLOSE}`;
  return { svg, blooms, roots };
}

const memo = new Map<string, string>();

/**
 * A meadow drawn once per key (a place and a scene id): it is the same every time, and a scene is built again on every
 * visit. Kept small (the last few dozen).
 */
export function memoMeadow(key: string, draw: () => string): string {
  let svg = memo.get(key);
  if (svg === undefined) {
    svg = draw();
    memo.set(key, svg);
    if (memo.size > 48) memo.delete(memo.keys().next().value as string);
  }
  return svg;
}

/** Fine detail a map card leaves out (with the meadow): tall grass and scattered flowers. */
export const fineDetail = (svg: string) => `${OPEN}${svg}${CLOSE}`;

/** A scene without its meadows and fine detail (map thumbnails and small cards, where the lawn's colour says enough). */
export function stripMeadow(svg: string): string {
  return svg.replace(/<!--meadow-->[\s\S]*?<!--\/meadow-->/g, '');
}

// ------------------------------------------------------------------ the scenes' old helpers, drawn anew

/** Mixes a hex colour toward white (t > 0) or black (t < 0). */
export function tint(hex: string, t: number): string {
  const v = parseInt(hex.slice(1), 16);
  const ch = [(v >> 16) & 255, (v >> 8) & 255, v & 255].map((c) => Math.round(t >= 0 ? c + (255 - c) * t : c * (1 + t)));
  return `#${ch.map((c) => c.toString(16).padStart(2, '0')).join('')}`;
}

/** A seed from a position: the same spot always grows the same plant. */
const at = (x: number, y: number) => seeded(Math.round(x * 131 + y * 977 + 17));

/**
 * A grass clump in a scene's own grass colour (no gradients, so it needs no defs): back blades a shade darker, front
 * blades a shade lighter, each curving its own way. `.sp-grass`, so the ambient director sways it.
 */
export function tuft(x: number, y: number, c: string, scale = 1): string {
  const [back, front] = blades(x, y, at(x, y), scale * 0.85, 7);
  return `<g class="sp-grass"><path d="${back}" fill="${tint(c, -0.18)}"/><path d="${front}" fill="${tint(c, 0.08)}"/></g>`;
}

/** Tall grass with seed heads, for the scenes' tall grass (`h` units tall). */
export function tallGrassClump(x: number, y: number, h: number, c = '#b9c477'): string {
  const r = at(x, y);
  const s = h / 20;
  const [back, front] = blades(x, y, r, s * 0.8, 6);
  const heads = [0, 1, 2].map((i) => seedGrass(x + (i - 1) * 3 * s, y, r, s).replace(' class="sp-grass"', '')).join('');
  return `<g class="sp-grass"><path d="${back}" fill="${tint(c, -0.22)}"/><path d="${front}" fill="${tint(c, -0.05)}"/>${heads}</g>`;
}

/** The flower a scene's colour stood for: yellow a buttercup, white a daisy, purple lavender, pink clover, else a daisy. */
export function flowerFor(x: number, y: number, c: string, scale = 0.8): string {
  const r = at(x, y);
  const v = parseInt(c.slice(1), 16);
  const [cr, cg, cb] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  if (cr > 200 && cg > 200 && cb > 200) return daisy(x, y, r, scale);
  if (cr > 200 && cg > 150 && cb < 150) return buttercup(null, x, y, r, scale);
  if (cb > cr && cb > 150) return lavender(x, y, r, scale * 0.8);
  if (cr > 200 && cb > 150) return clover(x, y, r, scale, 1);
  return daisy(x, y, r, scale);
}

/** The butterfly kind closest to a scene's old butterfly colour. */
export function kindFor(c: string): ButterflyKind {
  const v = parseInt(c.slice(1), 16);
  const [cr, cg, cb] = [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  if (cr > 220 && cg > 220 && cb > 200) return 'white';
  if (cb > cr && cb > cg) return 'blue';
  if (cr > 200 && cb > 150) return 'rose';
  if (cr > 220 && cg > 190) return 'sulphur';
  if (cg > cr * 0.8 && cr > 200) return 'swallowtail';
  return 'monarch';
}

/** Butterflies at points, in a scene's old colour (as a kind), each its own `.sp-birds`. */
export function butterfliesAt(pts: Array<[number, number]>, c: string, scale = 0.72): string {
  return pts.map(([x, y], i) => butterfly(x, y, kindFor(c), { scale, angle: ((x * 7 + y * 3) % 40) - 20, open: i % 2 ? 0.8 : 1 })).join('');
}
