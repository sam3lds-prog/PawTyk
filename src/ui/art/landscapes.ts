/**
 * The endless world's eight new landscapes (D39), drawn in code in the same 360×300 storybook frame as the regional
 * sanctuaries (`regions.ts`): a sky, a land, and four stages of features the place grows into, painted back to front
 * by their ground line (`base`; a negative base is a sky item, drawn behind the land).
 *
 * Every landscape keeps its foreground open for its animals (`LANDSCAPE_SPOTS`): four ground spots clear of the
 * features of every stage and of the sign, and for the watery ones, spots where swimmers float. Lively parts use the
 * shared ambient classes (`.sp-water`, `.sp-sway`, `.sp-birds`, `.sp-glow`, `.sp-blades`, `.sp-petals`, `.sp-kite`,
 * `.sp-balloon`), played only by `AmbientDirector`.
 */

import type { Feature, RegionArt, Spot } from './regions';
import { OUT, SHADOW } from './sceneKit';

export type NewBiome = 'bamboo' | 'mountain' | 'desert' | 'woodland' | 'wetland' | 'coast' | 'island' | 'grassland';

// ------------------------------------------------------------------ small shared pieces

const n = (v: number) => +v.toFixed(1);
const ol = (w = 1) => `stroke="${OUT}" stroke-width="${w}"`;
const shade = (cx: number, cy: number, rx: number, ry: number) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${SHADOW}"/>`;
const rad = (deg: number) => (deg * Math.PI) / 180;

/** A soft white band that fades out above and below (mist, haze). */
const hazeDef = (id: string, o = 0.75) =>
  `<linearGradient id="${id}-haze" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.5" stop-color="#fff" stop-opacity="${o}"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>`;

/**
 * Small ground things (flowers, shells, mushrooms) as features banded by their ground line, so an animal standing in
 * front of one covers it and one standing behind is covered by it.
 */
function scatter(items: Array<[number, number, string]>, band = 14): Feature[] {
  const bands = new Map<number, { base: number; svg: string[] }>();
  for (const [, y, svg] of items) {
    const k = Math.floor(y / band);
    const b = bands.get(k) ?? { base: 0, svg: [] };
    b.base = Math.max(b.base, y);
    b.svg.push(svg);
    bands.set(k, b);
  }
  return [...bands.values()].map((b) => ({ base: b.base, svg: b.svg.join('') }));
}

const tuft = (x: number, y: number, c: string) =>
  `<g stroke="${c}" stroke-width="1.5" stroke-linecap="round"><path d="M${x} ${y} l-6 -7 M${x} ${y} l-2 -9 M${x} ${y} l2.5 -9 M${x} ${y} l6.5 -6"/></g>`;

const wildflower = (x: number, y: number, c: string) =>
  `<g><path d="M${x} ${y} v-7" stroke="#8aa25a" stroke-width="1.1"/><circle cx="${x}" cy="${y - 8}" r="2.4" fill="${c}"/><circle cx="${x}" cy="${y - 8}" r="0.8" fill="#fff6d8"/></g>`;

/** A five-petal bloom on a short stem. */
const bloom = (x: number, y: number, c: string, r = 1.6, stem = 6) =>
  `<g><path d="M${x} ${y} v-${stem}" stroke="#7fa85a" stroke-width="1"/><g fill="${c}">${[0, 72, 144, 216, 288]
    .map((a) => `<circle cx="${n(x + Math.cos(rad(a - 90)) * r * 1.1)}" cy="${n(y - stem - 1.6 + Math.sin(rad(a - 90)) * r * 1.1)}" r="${r}"/>`)
    .join('')}</g><circle cx="${x}" cy="${y - stem - 1.6}" r="${n(r * 0.7)}" fill="#f6d27a"/></g>`;

const birdFlock = (pts: Array<[number, number]>, c = '#5b4a3a') =>
  `<g class="sp-birds">${pts.map(([x, y]) => `<path d="M${x - 5} ${y} q2.5 -3 5 0 q2.5 -3 5 0" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round"/>`).join('')}</g>`;

const butterflies = (pts: Array<[number, number]>, c = '#f2a65a') =>
  `<g class="sp-birds">${pts
    .map(
      ([x, y]) =>
        `<g><ellipse cx="${x - 2.6}" cy="${y}" rx="3" ry="4" fill="${c}" transform="rotate(-20 ${x - 2.6} ${y})"/><ellipse cx="${x + 2.6}" cy="${y}" rx="3" ry="4" fill="${c}" transform="rotate(20 ${x + 2.6} ${y})"/><path d="M${x} ${y - 3} v6" stroke="#2f2a27" stroke-width="1"/></g>`,
    )
    .join('')}</g>`;

/** White ripple strokes on water ([x, y, width] each). */
const ripples = (lines: Array<[number, number, number]>, c = '#fff', o = 0.8) =>
  `<g class="sp-water" stroke="${c}" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="${o}">${lines.map(([x, y, w]) => `<path d="M${x} ${y} q${n(w / 2)} ${n(w * 0.16)} ${w} 0"/>`).join('')}</g>`;

/** Scalloped foam along a shore line y = f(x), from x0 to x1. */
const foam = (f: (x: number) => number, x0: number, x1: number, step = 12, lift = 3.4) => {
  let d = `M${x0} ${n(f(x0))}`;
  for (let x = x0; x < x1; x += step) d += ` Q${n(x + step / 2)} ${n(f(x + step / 2) - lift)} ${n(x + step)} ${n(f(x + step))}`;
  return d;
};

/** A pointed leaf from (x, y), `len` long, at `deg` degrees (0 = right, 90 = down); no `c` takes the group's fill. */
function leaf(x: number, y: number, len: number, deg: number, c: string, w = 0.17): string {
  const a = rad(deg);
  const tx = x + len * Math.cos(a);
  const ty = y + len * Math.sin(a);
  const mx = (x + tx) / 2;
  const my = (y + ty) / 2;
  const px = -Math.sin(a) * len * w;
  const py = Math.cos(a) * len * w;
  return `<path d="M${n(x)} ${n(y)} Q${n(mx + px)} ${n(my + py)} ${n(tx)} ${n(ty)} Q${n(mx - px)} ${n(my - py)} ${n(x)} ${n(y)}Z"${c ? ` fill="${c}"` : ''}/>`;
}

/** A conifer standing at (x, y), h tall (no `hi`: a flat far-off one). */
function pine(x: number, y: number, h: number, c = '#5f9a74', hi = '#78b08a', outline = true): string {
  const w = h * 0.52;
  let s = `<rect x="${n(x - h * 0.035)}" y="${n(y - h * 0.16)}" width="${n(h * 0.07)}" height="${n(h * 0.16)}" fill="#8a6a4f"/>`;
  for (let i = 0; i < 3; i++) {
    const yb = y - h * 0.1 - i * h * 0.24;
    const ww = w * (1 - i * 0.26);
    const th = h * 0.42;
    s += `<path d="M${n(x - ww / 2)} ${n(yb)} Q${x} ${n(yb + h * 0.05)} ${n(x + ww / 2)} ${n(yb)} L${x} ${n(yb - th)} Z" fill="${c}" ${outline ? ol(0.8) : ''} stroke-linejoin="round"/>`;
    if (hi) s += `<path d="M${x} ${n(yb - th)} L${n(x - ww / 2)} ${n(yb)} Q${n(x - ww / 4)} ${n(yb + h * 0.03)} ${x} ${n(yb + h * 0.02)} Z" fill="${hi}" opacity="0.6"/>`;
  }
  return s;
}

/** A round-crowned tree: trunk at (x, y), crown scale s. */
function roundTree(x: number, y: number, s: number, c: string, hi: string, trunk = '#8a6a4f'): string {
  return `${shade(x, y + 0.5, 12 * s, 2.4 * s)}<path d="M${n(x - 2 * s)} ${y} C${n(x - 1.5 * s)} ${n(y - 10 * s)} ${n(x - 1.6 * s)} ${n(y - 16 * s)} ${n(x - 1 * s)} ${n(y - 22 * s)} L${n(x + 1.2 * s)} ${n(y - 22 * s)} C${n(x + 1.6 * s)} ${n(y - 16 * s)} ${n(x + 1.6 * s)} ${n(y - 10 * s)} ${n(x + 2.2 * s)} ${y} Z" fill="${trunk}"/>
    <g fill="${c}"><circle cx="${n(x - 8 * s)}" cy="${n(y - 24 * s)}" r="${n(9 * s)}"/><circle cx="${n(x + 8 * s)}" cy="${n(y - 25 * s)}" r="${n(9 * s)}"/><circle cx="${x}" cy="${n(y - 33 * s)}" r="${n(11 * s)}"/></g>
    <g fill="${hi}"><circle cx="${n(x - 4 * s)}" cy="${n(y - 37 * s)}" r="${n(5 * s)}"/><circle cx="${n(x - 10 * s)}" cy="${n(y - 27 * s)}" r="${n(3.6 * s)}"/></g>`;
}

/** Cattails: a stem and its brown head. */
const cattail = (x: number, y: number, h: number, lean = 0) =>
  `<path d="M${x} ${y} q${n(lean * 0.4)} ${n(-h * 0.5)} ${lean} ${-h}" stroke="#7d9a5a" stroke-width="1.3" fill="none"/><rect x="${n(x + lean - 1.7)}" y="${n(y - h - 3)}" width="3.4" height="9" rx="1.7" fill="#8a5a3a"/>`;

/** A clump of reeds and cattails standing at (x, y). */
const reeds = (x: number, y: number, s = 1) =>
  `<g class="sp-sway">${[-7, -3, 2, 6, 9]
    .map((d, i) => `<path d="M${x + d * s} ${y} q${n(d * 0.5 * s)} ${n(-12 * s)} ${n(d * 1.2 * s)} ${n((-22 - (i % 3) * 5) * s)}" stroke="${i % 2 ? '#8db86a' : '#74a65a'}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`)
    .join('')}${cattail(x - 2 * s, y, 26 * s, -2 * s)}${cattail(x + 4 * s, y, 32 * s, 2 * s)}${cattail(x + 8 * s, y, 22 * s, 4 * s)}</g>`;

/** A rounded boulder at (x, y), scale s. */
const boulder = (x: number, y: number, s: number, c = '#b7bcc1', hi = '#d2d6da') =>
  `${shade(x, y + 0.5, 14 * s, 2.6 * s)}<path d="M${n(x - 13 * s)} ${y} C${n(x - 15 * s)} ${n(y - 10 * s)} ${n(x - 6 * s)} ${n(y - 17 * s)} ${n(x + 2 * s)} ${n(y - 16 * s)} C${n(x + 11 * s)} ${n(y - 15 * s)} ${n(x + 15 * s)} ${n(y - 7 * s)} ${n(x + 13 * s)} ${y} Z" fill="${c}" ${ol(0.9)}/><path d="M${n(x - 9 * s)} ${n(y - 9 * s)} C${n(x - 6 * s)} ${n(y - 14 * s)} ${n(x + 2 * s)} ${n(y - 15 * s)} ${n(x + 7 * s)} ${n(y - 12 * s)} C${n(x + 2 * s)} ${n(y - 11 * s)} ${n(x - 4 * s)} ${n(y - 10 * s)} ${n(x - 9 * s)} ${n(y - 9 * s)} Z" fill="${hi}"/>`;

/** One drooping palm frond from the crown (tx, ty), with a saw-toothed lower edge. */
function frond(tx: number, ty: number, deg: number, len: number, c: string): string {
  const ux = Math.cos(rad(deg));
  const uy = Math.sin(rad(deg));
  const ex = tx + ux * len;
  const ey = ty + uy * len * 0.6 + len * 0.42;
  const c1x = tx + ux * len * 0.5;
  const c1y = ty + uy * len * 0.3 - len * 0.34;
  const c2x = tx + ux * len * 0.55;
  const c2y = ty + uy * len * 0.3 + len * 0.02;
  const q = (t: number, a: number, b: number, e: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * e;
  let back = '';
  for (let i = 6; i >= 0; i--) {
    const t = i / 7;
    const tooth = i % 2 ? len * 0.07 : 0;
    back += ` L${n(q(t, tx, c2x, ex))} ${n(q(t, ty, c2y, ey) + tooth)}`;
  }
  return `<path d="M${tx} ${ty} Q${n(c1x)} ${n(c1y)} ${n(ex)} ${n(ey)}${back} Z" fill="${c}" ${ol(0.7)} stroke-linejoin="round"/><path d="M${tx} ${ty} Q${n((c1x + c2x) / 2)} ${n((c1y + c2y) / 2)} ${n(ex)} ${n(ey)}" stroke="#4f8a4a" stroke-width="0.6" fill="none" opacity="0.6"/>`;
}

/** A palm: a curving trunk from (x, y) to a crown h above, leaning by `lean`. */
function palm(x: number, y: number, h: number, lean: number, c = '#5fa65a', c2 = '#7fc06c', trunk = '#b48a5e', nuts = '#8a6038'): string {
  const tx = x + lean;
  const ty = y - h;
  const d = `M${x} ${y} Q${n(x + lean * 0.05)} ${n(y - h * 0.55)} ${tx} ${ty}`;
  return `${shade(x, y + 0.5, 10, 2.2)}<path d="${d}" stroke="${OUT}" stroke-width="7.4" fill="none" stroke-linecap="round"/><path d="${d}" stroke="${trunk}" stroke-width="6" fill="none" stroke-linecap="round"/><path d="${d}" stroke="#94704a" stroke-width="6" stroke-dasharray="1.1 5" fill="none"/>
    <g class="sp-sway">${frond(tx, ty, 250, 22, c2)}${frond(tx, ty, -70, 22, c2)}${frond(tx, ty, 200, 32, c)}${frond(tx, ty, -20, 32, c)}${frond(tx, ty, 160, 28, c2)}${frond(tx, ty, 20, 28, c2)}${frond(tx, ty, 228, 28, c)}${frond(tx, ty, -48, 28, c)}<g fill="${nuts}"><circle cx="${tx - 2.4}" cy="${ty + 3}" r="2.4"/><circle cx="${tx + 2.4}" cy="${ty + 3.4}" r="2.4"/><circle cx="${tx}" cy="${ty + 5.2}" r="2.4"/></g></g>`;
}

/** A floating lily pad (with a flower when `flower` is given). */
const lily = (x: number, y: number, r: number, flower?: string) => {
  const ry = r * 0.4;
  const p1 = [x + r * Math.cos(-0.32), y + ry * Math.sin(-0.32)];
  const p2 = [x + r * Math.cos(0.32), y + ry * Math.sin(0.32)];
  return `<g><path d="M${x} ${y} L${n(p1[0])} ${n(p1[1])} A${r} ${n(ry)} 0 1 0 ${n(p2[0])} ${n(p2[1])} Z" fill="#7fb86e" stroke="#5e9a52" stroke-width="0.8"/>${
    flower
      ? `<g><ellipse cx="${x - 2.4}" cy="${y - 1.4}" rx="2.6" ry="1.6" fill="${flower}"/><ellipse cx="${x + 2.4}" cy="${y - 1.4}" rx="2.6" ry="1.6" fill="${flower}"/><ellipse cx="${x}" cy="${y - 3}" rx="1.8" ry="2.8" fill="#fde6ee"/><circle cx="${x}" cy="${y - 1.6}" r="0.9" fill="#f6d27a"/></g>`
      : ''
  }</g>`;
};

const starfish = (x: number, y: number, c = '#f2a65a', r = 4) =>
  `<path d="${Array.from({ length: 10 }, (_, i) => {
    const a = rad(i * 36 - 90);
    const rr = i % 2 ? r * 0.42 : r;
    return `${i ? 'L' : 'M'}${n(x + Math.cos(a) * rr)} ${n(y + Math.sin(a) * rr * 0.7)}`;
  }).join(' ')} Z" fill="${c}" ${ol(0.5)} stroke-linejoin="round"/>`;

const shell = (x: number, y: number, c = '#f6c9b8') =>
  `<g><path d="M${x - 3.4} ${y} Q${x} ${y - 6} ${x + 3.4} ${y} Z" fill="${c}" ${ol(0.5)}/><path d="M${x} ${y} l0 -4 M${x} ${y} l-1.8 -3.4 M${x} ${y} l1.8 -3.4" stroke="#d9a090" stroke-width="0.5"/></g>`;

// ------------------------------------------------------------------ bamboo forest

/** A bamboo cane from the ground (x, y) up to `top`, w wide. */
function cane(x: number, y: number, top: number, w: number, c: string, node: string, hi: string): string {
  const nodes: string[] = [];
  for (let ny = y - 16; ny > top + 8; ny -= 18) nodes.push(`M${n(x - w / 2)} ${n(ny)} h${n(w)}`);
  return `<rect x="${n(x - w / 2)}" y="${top}" width="${n(w)}" height="${n(y - top)}" rx="${n(w / 2)}" fill="${c}" ${ol(0.8)}/><path d="M${n(x - w * 0.18)} ${n(y - 3)} V${n(top + 3)}" stroke="${hi}" stroke-width="${n(w * 0.26)}" stroke-linecap="round"/><path d="${nodes.join(' ')}" stroke="${node}" stroke-width="${n(Math.max(0.8, w * 0.2))}"/>`;
}

/** A swaying spray of three bamboo leaves from a node, drooping to the right (dir 1) or left (dir -1). */
const spray = (x: number, y: number, dir: number, c: string, s = 1) =>
  `<g class="sp-sway"><path d="M${x} ${y} l${dir * 4 * s} ${-2 * s}" stroke="${c}" stroke-width="1"/>${(dir > 0 ? [-6, 20, 44] : [186, 160, 136]).map((a, i) => leaf(x + dir * 3 * s, y - 1.5 * s, [18, 22, 16][i] * s, a, c, 0.15)).join('')}</g>`;

const BAMBOO_BACK: Array<[number, number]> = [
  [4, 50],
  [16, 74],
  [30, 40],
  [44, 82],
  [58, 58],
  [72, 92],
  [86, 70],
  [238, 92],
  [252, 58],
  [266, 80],
  [280, 44],
  [294, 72],
  [308, 52],
  [322, 86],
  [336, 46],
  [350, 68],
];

/** The pale grove behind the mist: canes, their nodes and leaves, each drawn with one shared fill. */
const BAMBOO_GROVE = (() => {
  const canes = BAMBOO_BACK.map(([x, top]) => `<rect x="${n(x - 1.8)}" y="${top}" width="3.6" height="${140 - top}" rx="1.8"/>`).join('');
  const nodes = BAMBOO_BACK.map(([x, top]) => {
    let d = '';
    for (let ny = 124; ny > top + 8; ny -= 18) d += `M${n(x - 1.8)} ${ny}h3.6`;
    return d;
  }).join('');
  const sprayAt = (x: number, y: number, dir: number, s: number) =>
    (dir > 0 ? [-6, 20, 44] : [186, 160, 136]).map((a, i) => leaf(x + dir * 3 * s, y - 1.5 * s, [18, 22, 16][i] * s, a, '', 0.15)).join('');
  const leaves = BAMBOO_BACK.map(([x, top], i) => sprayAt(x, top + 12 + (i % 3) * 9, i % 2 ? 1 : -1, 0.8) + sprayAt(x, top + 40 + (i % 2) * 10, i % 2 ? -1 : 1, 0.65)).join('');
  return `<g fill="#a6cf9f">${canes}</g><path d="${nodes}" stroke="#90bd8b" stroke-width="0.8"/><g fill="#9fca99">${leaves}</g>`;
})();

const BAMBOO_FRONT = (() => {
  const c = '#7db866';
  const node = '#5a944c';
  const hi = '#a5d488';
  const lc = ['#6aab5c', '#8cc474'];
  return `${shade(28, 294, 34, 4)}
    ${cane(42, 292, 70, 6, c, node, hi)}${cane(10, 298, -6, 8.4, c, node, hi)}${cane(26, 290, 24, 7, '#8cc274', node, hi)}
    ${spray(42, 92, 1, lc[1])}${spray(42, 128, 1, lc[0], 1.1)}${spray(26, 52, 1, lc[0], 1.1)}${spray(26, 88, -1, lc[1])}
    ${spray(10, 30, 1, lc[1], 1.2)}${spray(10, 66, 1, lc[0])}${spray(42, 164, 1, lc[1], 0.9)}${spray(26, 146, 1, lc[1], 0.9)}`;
})();

const shoot = (x: number, y: number, h: number) =>
  `<g><path d="M${n(x - h * 0.24)} ${y} Q${n(x - h * 0.2)} ${n(y - h * 0.6)} ${x} ${y - h} Q${n(x + h * 0.2)} ${n(y - h * 0.6)} ${n(x + h * 0.24)} ${y} Z" fill="#b8c87a" ${ol(0.6)}/><path d="M${n(x - h * 0.2)} ${n(y - h * 0.3)} Q${x} ${n(y - h * 0.4)} ${n(x + h * 0.2)} ${n(y - h * 0.26)} M${n(x - h * 0.12)} ${n(y - h * 0.62)} Q${x} ${n(y - h * 0.7)} ${n(x + h * 0.12)} ${n(y - h * 0.58)}" stroke="#93a85a" stroke-width="0.9" fill="none"/>${leaf(x, y - h, h * 0.5, -60, '#8cc474')}</g>`;

const lantern = (x: number, y: number) =>
  `<path d="M${x} ${y - 8} v4" stroke="#7a5a3f" stroke-width="0.8"/><circle class="sp-glow" cx="${x}" cy="${y + 3}" r="9" fill="#ffd9a0" opacity="0.35"/><ellipse cx="${x}" cy="${y + 3}" rx="4.6" ry="5.8" fill="#f2a65a" ${ol(0.7)}/><path d="M${x - 4} ${y + 1} h8 M${x - 4} ${y + 5} h8" stroke="#d98a44" stroke-width="0.7"/><rect x="${x - 2.4}" y="${y - 3.6}" width="4.8" height="1.6" rx="0.6" fill="#7a5a3f"/><rect x="${x - 2.4}" y="${y + 8.4}" width="4.8" height="1.4" rx="0.6" fill="#7a5a3f"/>`;

const BAMBOO: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#cbe5da"/><stop offset="0.72" stop-color="#e5f0e3"/><stop offset="1" stop-color="#f1f5e7"/></linearGradient>
      <linearGradient id="${id}-ground" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#acd5a4"/><stop offset="1" stop-color="#88bd8a"/></linearGradient>
      ${hazeDef(id, 0.8)}
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="186" cy="54" r="30" fill="#fff8dc" opacity="0.5"/><circle cx="186" cy="54" r="17" fill="#fcf0cc"/>
    <g fill="#fff" opacity="0.6"><ellipse cx="96" cy="34" rx="38" ry="4"/><ellipse cx="290" cy="24" rx="26" ry="3.4"/></g>`,
  land: (id) => `
    <path d="M0 112 C10 82 32 62 52 70 C66 76 70 94 78 100 C88 72 100 50 118 52 C134 54 140 86 150 100 C170 90 194 66 212 68 C230 70 238 94 248 104 C262 80 282 48 302 50 C322 52 336 84 360 96 V140 H0Z" fill="#c3dccf"/>
    <path d="M0 86 C60 78 120 94 180 88 C240 82 300 92 360 84 V120 C300 126 240 114 180 120 C120 126 60 114 0 118Z" fill="url(#${id}-haze)"/>
    <path d="M0 126 C30 108 62 104 92 116 C122 102 160 100 190 114 C220 104 258 100 290 112 C320 104 344 106 360 110 V150 H0Z" fill="#aacfb6"/>
    ${BAMBOO_GROVE}
    <path d="M0 110 C80 104 160 116 240 108 C300 102 340 110 360 108 V140 C300 136 240 142 160 138 C90 134 40 140 0 138Z" fill="url(#${id}-haze)"/>
    <path d="M0 132 C80 126 180 132 260 128 C300 126 330 130 360 128 V300 H0Z" fill="url(#${id}-ground)"/>
    <g stroke="#c4e3b8" stroke-width="10" opacity="0.3" fill="none"><path d="M0 238 C120 230 240 236 360 228"/><path d="M0 282 C120 274 250 280 360 272"/></g>
    <path d="M196 132 C190 142 170 152 140 164 C100 178 52 190 0 200 V226 C52 216 112 198 154 182 C184 170 206 152 212 132 Z" fill="#d9d6be"/>
    <g fill="#c2bea2" ${ol(0.5)}><ellipse cx="30" cy="212" rx="4" ry="2.2"/><ellipse cx="72" cy="200" rx="3.4" ry="2"/><ellipse cx="108" cy="188" rx="4" ry="2.2"/><ellipse cx="146" cy="174" rx="3" ry="1.8"/><ellipse cx="176" cy="158" rx="3.4" ry="2"/><ellipse cx="196" cy="144" rx="2.6" ry="1.5"/><ellipse cx="54" cy="214" rx="2.4" ry="1.4"/><ellipse cx="128" cy="186" rx="2.4" ry="1.4"/><ellipse cx="90" cy="198" rx="2" ry="1.2"/><ellipse cx="162" cy="168" rx="2" ry="1.2"/></g>
    <g fill="#9cc896" opacity="0.8"><ellipse cx="226" cy="236" rx="16" ry="3"/><ellipse cx="60" cy="262" rx="20" ry="3.4"/><ellipse cx="320" cy="252" rx="14" ry="2.6"/></g>
    ${[
      [96, 296],
      [214, 246],
      [300, 232],
      [348, 296],
      [140, 228],
      [230, 300],
      [270, 212],
    ]
      .map(([x, y]) => tuft(x, y, '#6aa565'))
      .join('')}`,
  stages: {
    1: [
      { base: 292, svg: BAMBOO_FRONT },
      { base: 210, svg: `${shade(194, 210, 18, 2.4)}${shoot(184, 210, 14)}${shoot(198, 206, 18)}${shoot(208, 211, 11)}` },
    ],
    2: [
      {
        base: 198,
        svg: `
        ${shade(282, 198, 52, 4.6)}
        <path d="M236 198 L328 198 L322 189 L242 189 Z" fill="#cfc8b6" ${ol(0.9)}/>
        <path d="M244 192 h12 M262 194 h14 M284 192 h16 M306 194 h12" stroke="#b7ae98" stroke-width="0.9"/>
        <g fill="#a95f43"><rect x="266" y="150" width="3.4" height="40"/><rect x="295" y="150" width="3.4" height="40"/></g>
        <path d="M251 172 H313 M251 179 H313" stroke="#c98a5e" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M262 172 v7 M282 172 v7 M302 172 v7" stroke="#c98a5e" stroke-width="1.2"/>
        <g fill="#bf6e4e" ${ol(0.8)}><rect x="246" y="150" width="5.4" height="40" rx="1"/><rect x="313" y="150" width="5.4" height="40" rx="1"/></g>
        <path d="M222 148 Q240 152 252 136 L312 136 Q324 152 342 148 Q338 158 326 158 L238 158 Q226 158 222 148 Z" fill="#6f9e8f" ${ol(1)}/>
        <path d="M232 151 Q246 152 256 140 M332 151 Q318 152 308 140 M268 139 v17 M282 139 v17 M296 139 v17" stroke="#86b4a4" stroke-width="1.2" fill="none"/>
        <path d="M238 158 H326" stroke="#577f72" stroke-width="2"/>
        <path d="M252 136 Q266 126 282 120 Q298 126 312 136 Z" fill="#82b0a0" ${ol(0.9)}/>
        <circle cx="282" cy="118" r="2.6" fill="#e6b85c" ${ol(0.6)}/>
        <g fill="#d8cfbc" ${ol(0.6)}><ellipse cx="270" cy="206" rx="6" ry="2.2"/><ellipse cx="258" cy="214" rx="6.4" ry="2.4"/></g>`,
      },
    ],
    3: [
      {
        base: 133,
        svg: `
        <path d="M199 133 C193 143 172 153 142 165 C102 179 54 191 0 202 V223 C54 213 112 196 152 180 C182 168 204 152 209 133 Z" fill="#a6d6d4"/>
        <path d="M200 138 C188 150 166 158 140 168 C110 180 70 190 30 198" stroke="#c9ece6" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        ${ripples([
          [26, 210, 12],
          [92, 192, 12],
          [160, 168, 9],
          [188, 150, 7],
        ])}`,
      },
      {
        base: 188,
        svg: (() => {
          const q = (t: number, a: number, b: number, c: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * c;
          const posts = [0, 0.2, 0.4, 0.6, 0.8, 1]
            .map((t) => `<path d="M${n(q(t, 78, 118, 160))} ${n(q(t, 183, 147, 187))} v-10" stroke="#a55d42" stroke-width="2" stroke-linecap="round"/>`)
            .join('');
          return `
          ${shade(80, 186, 8, 1.6)}${shade(160, 190, 8, 1.6)}
          <path d="M74 188 Q118 146 164 192 L164 185 Q118 139 74 181 Z" fill="#c9905e" ${ol(0.9)}/>
          <path d="M78 183 Q118 144 160 186" stroke="#e0b07c" stroke-width="1.2" fill="none"/>
          ${posts}
          <path d="M78 173 Q118 136 160 177" stroke="#bf6e4e" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
        })(),
      },
      { base: 216, svg: `${lily(58, 207, 6)}${lily(18, 217, 5)}${lily(38, 211, 7, '#f2a8bd')}` },
    ],
    4: [
      {
        base: 150,
        svg: `
        ${shade(222, 150, 18, 2.8)}
        <path d="M217 150 C220 138 215 126 221 110 L227 110 C224 126 229 138 229 150 Z" fill="#8a5e48" ${ol(0.8)}/>
        <path d="M222 120 C214 112 204 108 194 106 M224 116 C232 106 242 102 252 100" stroke="#8a5e48" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        <g fill="#f4bccb"><circle cx="194" cy="100" r="12"/><circle cx="212" cy="88" r="15"/><circle cx="236" cy="90" r="14"/><circle cx="254" cy="102" r="10"/><circle cx="208" cy="108" r="10"/><circle cx="234" cy="106" r="9"/></g>
        <g fill="#f9d6df"><circle cx="208" cy="80" r="7"/><circle cx="232" cy="82" r="6"/><circle cx="192" cy="94" r="4.6"/><circle cx="252" cy="96" r="4"/></g>
        <g fill="#ea9fb5"><circle cx="202" cy="104" r="1.6"/><circle cx="224" cy="96" r="1.6"/><circle cx="246" cy="104" r="1.4"/><circle cx="216" cy="90" r="1.4"/><circle cx="238" cy="88" r="1.4"/></g>
        <g class="sp-petals" fill="#f4bccb"><ellipse cx="188" cy="124" rx="2.4" ry="1.4" transform="rotate(30 188 124)"/><ellipse cx="248" cy="126" rx="2.4" ry="1.4" transform="rotate(-20 248 126)"/><ellipse cx="214" cy="132" rx="2.2" ry="1.3"/></g>`,
      },
      { base: 199, svg: `${lantern(244, 166)}${lantern(320, 166)}` },
      ...scatter([
        [160, 232, bloom(160, 232, '#f4bccb', 1.5, 5)],
        [232, 230, bloom(232, 230, '#fff', 1.5, 5)],
        [80, 284, bloom(80, 284, '#f2a8bd', 1.5, 5)],
        [212, 300, bloom(212, 300, '#fff', 1.5, 5)],
        [344, 250, bloom(344, 250, '#f4bccb', 1.5, 5)],
        [278, 298, bloom(278, 298, '#f2a8bd', 1.5, 5)],
        [62, 236, bloom(62, 236, '#fff', 1.4, 5)],
        [190, 222, `${shoot(222, 222, 10)}${shoot(214, 224, 7)}`],
      ]),
      {
        base: 230,
        svg: butterflies(
          [
            [150, 214],
            [340, 214],
          ],
          '#f2c45a',
        ),
      },
      {
        base: 12,
        svg: birdFlock([
          [120, 52],
          [134, 44],
          [148, 54],
        ]),
      },
    ],
  },
  sign: [68, 298],
  evening: [
    [80, 150],
    [150, 200],
    [200, 120],
    [300, 220],
    [340, 160],
    [120, 260],
  ],
};

// ------------------------------------------------------------------ mountains

const edelweiss = (x: number, y: number) =>
  `<g><path d="M${x} ${y} v-5" stroke="#8aa25a" stroke-width="1"/><g fill="#fbfbf6" stroke="#d6d9cf" stroke-width="0.4">${[0, 60, 120, 180, 240, 300].map((a) => `<ellipse cx="${x}" cy="${y - 8.6}" rx="1.1" ry="2.4" transform="rotate(${a} ${x} ${y - 6.4})"/>`).join('')}</g><circle cx="${x}" cy="${y - 6.4}" r="1.2" fill="#e9d27a"/></g>`;
const gentian = (x: number, y: number) =>
  `<g><path d="M${x} ${y} v-5" stroke="#6f9a4a" stroke-width="1"/><path d="M${x - 2.8} ${y - 11.6} Q${x} ${y - 4} ${x + 2.8} ${y - 11.6} L${x + 1.4} ${y - 9.4} L${x} ${y - 12} L${x - 1.4} ${y - 9.4} Z" fill="#4f7fd0"/></g>`;

const MOUNTAIN: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b2d4ee"/><stop offset="0.7" stop-color="#dbeaf4"/><stop offset="1" stop-color="#edf4f1"/></linearGradient>
      <linearGradient id="${id}-meadow" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c3dd95"/><stop offset="1" stop-color="#9fc879"/></linearGradient>
      ${hazeDef(id, 0.7)}
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="44" cy="40" r="26" fill="#fffbe6" opacity="0.5"/><circle cx="44" cy="40" r="15" fill="#fff3c4"/>
    <g fill="#fff" opacity="0.85"><ellipse cx="318" cy="30" rx="22" ry="5.4"/><ellipse cx="332" cy="25" rx="11" ry="5.4"/><ellipse cx="190" cy="16" rx="18" ry="3.6"/></g>`,
  land: (id) => `
    <path d="M0 126 V92 L40 64 L78 96 L196 60 L236 90 L330 52 L360 70 V130 Z" fill="#cad3e6" stroke="#cad3e6" stroke-width="3" stroke-linejoin="round"/>
    <path d="M156 128 L212 76 L240 56 L262 40 L284 54 L310 76 L360 108 V128 Z" fill="#b4c3d7" stroke="#b4c3d7" stroke-width="3" stroke-linejoin="round"/>
    <path d="M262 40 L284 54 L310 76 L360 108 V128 L292 128 L272 78 Z" fill="#a2b3c9"/>
    <path d="M262 40 L284 54 L298 66 L288 64 L280 74 L270 64 L260 72 L252 62 L242 66 L240 56 Z" fill="#fbfdff" stroke="#fbfdff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M262 40 L284 54 L298 66 L288 64 L280 74 L272 60 Z" fill="#e1e8f2"/>
    <path d="M6 130 L58 80 L82 62 L104 36 L120 22 L136 34 L160 60 L188 86 L240 130 Z" fill="#a9b9cf" stroke="#a9b9cf" stroke-width="3" stroke-linejoin="round"/>
    <path d="M120 22 L136 34 L160 60 L188 86 L240 130 L152 130 L132 70 Z" fill="#97a8c0"/>
    <path d="M120 22 L136 34 L152 52 L142 50 L134 62 L124 52 L114 62 L106 50 L96 56 L104 36 Z" fill="#fbfdff" stroke="#fbfdff" stroke-width="1.6" stroke-linejoin="round"/>
    <path d="M120 22 L136 34 L152 52 L142 50 L134 62 L128 40 Z" fill="#e1e8f2"/>
    <path d="M60 96 L76 82 L90 92 L80 94 Z M200 104 L214 92 L226 102 Z" fill="#b9c7da" opacity="0.8"/>
    <path d="M0 90 C60 82 120 100 200 92 C260 86 310 96 360 90 V124 C300 128 240 116 180 122 C110 128 60 116 0 122Z" fill="url(#${id}-haze)"/>
    <path d="M0 134 C40 120 80 122 120 128 C170 120 230 116 280 124 C320 118 340 120 360 122 V146 H0Z" fill="#8fb88f"/>
    <g>${[8, 22, 36, 64, 86, 100, 146, 168, 196, 212, 236, 262, 300, 318, 342, 356].map((x, i) => pine(x, 134 - ((i * 5) % 4), 16 + ((i * 7) % 4) * 3, '#78a585', '', false)).join('')}</g>
    <path d="M0 140 C80 134 180 140 260 136 C300 134 330 138 360 136 V300 H0Z" fill="url(#${id}-meadow)"/>
    <g stroke="#d3e8a8" stroke-width="10" opacity="0.32" fill="none"><path d="M0 196 C120 188 240 194 360 186"/><path d="M0 252 C120 244 250 250 360 242"/></g>
    <path d="M182 300 C186 276 204 254 176 232 C156 216 128 206 108 198 L118 196 C140 202 168 212 188 226 C220 248 206 276 204 300 Z" fill="#e6dab6" opacity="0.85"/>
    ${boulder(156, 168, 0.6)}${boulder(342, 236, 0.7)}${boulder(14, 214, 0.5)}${boulder(250, 160, 0.4)}
    ${[
      [130, 160],
      [214, 156],
      [40, 266],
      [250, 230],
      [330, 296],
      [120, 296],
      [290, 214],
    ]
      .map(([x, y]) => tuft(x, y, '#7fab58'))
      .join('')}
    ${[
      [60, 170, '#fff'],
      [224, 176, '#f6d27a'],
      [276, 300, '#fff'],
      [12, 290, '#f6d27a'],
    ]
      .map(([x, y, c]) => wildflower(x as number, y as number, c as string))
      .join('')}`,
  stages: {
    1: [
      {
        base: 214,
        svg: `
        ${shade(316, 214, 52, 5)}
        <path d="M262 214 L266 190 L282 178 L298 180 L304 164 L324 150 L346 152 L360 158 V214 Z" fill="#a8b0b8" ${ol(1)}/>
        <path d="M266 190 L282 178 L298 180 L304 164 L324 150 L346 152 L360 158 L360 166 L344 160 L324 162 L310 178 L292 188 Z" fill="#c6ccd2"/>
        <path d="M268 200 L292 194 L312 182 L330 178 L360 176" stroke="#98a1aa" stroke-width="1.2" fill="none"/>
        <path d="M288 204 l6 8 M322 190 l-3 12 M342 196 l5 10" stroke="#959ea7" stroke-width="1" fill="none"/>
        <g fill="#8fbf6a"><ellipse cx="286" cy="179" rx="6" ry="2"/><ellipse cx="318" cy="156" rx="5" ry="1.8"/></g>
        ${pine(346, 156, 36, '#5f9a74', '#78b08a')}${pine(330, 154, 26, '#6aa37c', '#82b893')}`,
      },
      { base: 186, svg: boulder(212, 186, 0.9) },
    ],
    2: [
      {
        base: 194,
        svg: `
        ${shade(80, 194, 46, 4.6)}
        <rect x="95" y="112" width="8" height="18" fill="#a9a29a" ${ol(0.8)}/>
        <path d="M48 194 V150 L80 120 L112 150 V194 Z" fill="#d49b65" ${ol(1)}/>
        <path d="M48 160 H112 M48 168 H112 M48 176 H112 M48 184 H112 M58 141 H102 M66 133 H94" stroke="#bd8452" stroke-width="1" />
        <rect x="46" y="187" width="68" height="7" rx="1.4" fill="#bdb7ae" ${ol(0.8)}/>
        <path d="M38 156 L80 112 L122 156 L115 159 L80 122 L45 159 Z" fill="#8b5544" ${ol(1)}/>
        <path d="M72 194 V178 Q80 170 88 178 V194 Z" fill="#7a4a32" ${ol(0.8)}/><circle cx="85" cy="186" r="0.9" fill="#f6d27a"/>
        <rect x="74" y="132" width="12" height="10" rx="1" fill="#fbe7b0" ${ol(0.7)}/><path d="M80 132 v10 M74 137 h12" stroke="#a8734a" stroke-width="0.9"/>
        <g fill="#fbe7b0" ${ol(0.7)}><rect x="53" y="160" width="11" height="10" rx="1"/><rect x="96" y="160" width="11" height="10" rx="1"/></g>
        <g fill="#8a5a3a"><rect x="52" y="170" width="13" height="3" rx="1"/><rect x="95" y="170" width="13" height="3" rx="1"/></g>
        <g fill="#e5546c"><circle cx="55" cy="169" r="1.6"/><circle cx="59" cy="168.6" r="1.6"/><circle cx="63" cy="169" r="1.6"/><circle cx="98" cy="169" r="1.6"/><circle cx="102" cy="168.6" r="1.6"/><circle cx="106" cy="169" r="1.6"/></g>
        <g fill="#7fb35d"><circle cx="57" cy="170.6" r="1"/><circle cx="61" cy="170.6" r="1"/><circle cx="100" cy="170.6" r="1"/><circle cx="104" cy="170.6" r="1"/></g>`,
      },
    ],
    3: [
      {
        base: 202,
        svg: `
        <path d="M194 137 C190 146 199 154 196 162 C194 168 197 174 199 178 L211 178 C207 172 203 167 205 161 C208 153 200 145 198 137 Z" fill="#a9d4ea"/><path d="M196 140 C194 148 201 155 199 163" stroke="#d6eef8" stroke-width="1" fill="none"/>
        <ellipse cx="198" cy="192" rx="64" ry="15" fill="#a6c99a"/>
        <path d="M140 190 C142 179 174 174 200 175 C230 176 256 181 256 192 C256 202 228 206 196 206 C164 206 138 200 140 190 Z" fill="#8fc6df"/>
        <path d="M156 186 C180 180 220 180 244 186" stroke="#b9def0" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <path d="M186 184 h20 M212 190 h14" stroke="#fff" stroke-width="1.2" opacity="0.7" stroke-linecap="round"/>
        ${ripples([
          [160, 196, 12],
          [214, 200, 12],
          [236, 192, 8],
        ])}
        <g fill="#b7bcc1" ${ol(0.6)}><ellipse cx="142" cy="198" rx="4" ry="2.2"/><ellipse cx="252" cy="198" rx="4.4" ry="2.4"/><ellipse cx="246" cy="203" rx="2.6" ry="1.6"/></g>`,
      },
      { base: 186, svg: `${shade(28, 186, 12, 2.4)}${pine(28, 186, 78, '#5a9470', '#72aa86')}${pine(132, 176, 54, '#62997a', '#7ab08d')}` },
    ],
    4: [
      ...scatter([
        ...([
          [30, 252],
          [126, 232],
          [270, 228],
          [346, 270],
          [236, 298],
          [140, 300],
          [52, 244],
          [190, 226],
          [16, 268],
        ] as Array<[number, number]>).map(([x, y]): [number, number, string] => [x, y, edelweiss(x, y)]),
        ...([
          [44, 238],
          [198, 222],
          [262, 244],
          [118, 268],
          [342, 292],
          [24, 244],
          [276, 230],
          [132, 236],
        ] as Array<[number, number]>).map(([x, y]): [number, number, string] => [x, y, gentian(x, y)]),
        [18, 248, wildflower(18, 248, '#f4a6c4')],
        [210, 232, wildflower(210, 232, '#f4a6c4')],
        [356, 254, wildflower(356, 254, '#f6d27a')],
        [100, 296, wildflower(100, 296, '#f4a6c4')],
      ]),
      {
        base: 12,
        svg: birdFlock(
          [
            [204, 44],
            [222, 34],
            [236, 46],
          ],
          '#5a5560',
        ),
      },
      { base: 220, svg: butterflies([[150, 222]], '#f6d27a') },
    ],
  },
  sign: [22, 294],
  evening: [
    [60, 30],
    [180, 40],
    [330, 90],
    [210, 160],
    [300, 230],
    [100, 240],
  ],
};

// ------------------------------------------------------------------ desert

const saguaro = (x: number, y: number, h: number, flowers = false) => {
  const g = '#7fae6a';
  const arm = (d: string) => `<path d="${d}" stroke="${OUT}" stroke-width="10.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="${d}" stroke="${g}" stroke-width="8.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  const left = `M${x - 4} ${y - h * 0.38} H${x - 13} Q${x - 18} ${y - h * 0.38} ${x - 18} ${y - h * 0.44} V${y - h * 0.68}`;
  const right = `M${x + 4} ${y - h * 0.55} H${x + 12} Q${x + 17} ${y - h * 0.55} ${x + 17} ${y - h * 0.61} V${y - h * 0.82}`;
  const tips: Array<[number, number]> = [
    [x - 3, y - h - 1],
    [x + 3, y - h],
    [x - 18, y - h * 0.68 - 4],
    [x + 17, y - h * 0.82 - 4],
  ];
  return `${shade(x, y + 0.5, 14, 2.6)}${arm(left)}${arm(right)}<rect x="${x - 6.5}" y="${y - h}" width="13" height="${h}" rx="6.5" fill="${g}" ${ol(1)}/>
    <path d="M${x - 2.4} ${y - 3} V${y - h + 6} M${x + 2.4} ${y - 3} V${y - h + 6} M${x - 18} ${n(y - h * 0.44)} V${n(y - h * 0.66)} M${x + 17} ${n(y - h * 0.62)} V${n(y - h * 0.8)}" stroke="#6a9a58" stroke-width="1" fill="none"/>
    ${flowers ? `<g fill="#f28fb0">${tips.map(([bx, by]) => `<circle cx="${bx}" cy="${n(by)}" r="2.6"/>`).join('')}</g><g fill="#fde3a0">${tips.map(([bx, by]) => `<circle cx="${bx}" cy="${n(by)}" r="0.9"/>`).join('')}</g>` : ''}`;
};

const pear = (x: number, y: number, flowers = false) =>
  `${shade(x, y + 0.5, 14, 2.4)}<g fill="#8ab872" ${ol(0.8)}><ellipse cx="${x}" cy="${y - 9}" rx="7" ry="9.5"/><ellipse cx="${x - 9}" cy="${y - 18}" rx="5.4" ry="7.4" transform="rotate(-24 ${x - 9} ${y - 18})"/><ellipse cx="${x + 8}" cy="${y - 20}" rx="5.6" ry="7.6" transform="rotate(20 ${x + 8} ${y - 20})"/></g>
   <g fill="#5f8a4c">${[
     [x - 2, y - 12],
     [x + 3, y - 6],
     [x - 10, y - 19],
     [x + 8, y - 22],
   ]
     .map(([a, b]) => `<circle cx="${a}" cy="${b}" r="0.6"/>`)
     .join('')}</g>${flowers ? `<g fill="#f6c94e"><circle cx="${x - 12}" cy="${y - 26}" r="2.6"/><circle cx="${x + 11}" cy="${y - 28}" r="2.6"/><circle cx="${x + 2}" cy="${y - 19}" r="2.2"/></g>` : ''}`;

const DESERT: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c6e4e8"/><stop offset="0.68" stop-color="#f3ebd5"/><stop offset="1" stop-color="#fbefda"/></linearGradient>
      <linearGradient id="${id}-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f5dca8"/><stop offset="1" stop-color="#eac487"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="276" cy="52" r="36" fill="#fff4d0" opacity="0.5"/><circle cx="276" cy="52" r="21" fill="#ffe7a8"/>
    <g fill="#fff" opacity="0.65"><ellipse cx="80" cy="30" rx="30" ry="3.6"/><ellipse cx="160" cy="44" rx="18" ry="2.8"/></g>`,
  land: (id) => `
    <path d="M18 124 L32 98 Q34 92 40 92 L92 92 Q98 92 100 98 L114 124 Z" fill="#e3b49c"/>
    <path d="M28 106 H104" stroke="#d6a28a" stroke-width="3"/><path d="M92 92 Q98 92 100 98 L114 124 L96 124 L88 98 Z" fill="#d6a28a"/>
    <path d="M232 124 L242 106 L288 106 L298 124 Z" fill="#ebc4ae"/><path d="M288 106 L298 124 L286 124 L280 108 Z" fill="#e0b39d"/>
    <path d="M314 124 L320 94 Q321 90 325 90 L333 90 Q337 90 338 94 L344 124 Z" fill="#e3b49c"/><path d="M333 90 Q337 90 338 94 L344 124 L336 124 L332 92 Z" fill="#d6a28a"/>
    <path d="M0 130 C40 118 90 118 130 126 C170 114 220 112 260 122 C300 114 336 116 360 120 V146 H0Z" fill="#f1d6a2"/>
    <path d="M0 136 C80 130 180 136 260 132 C300 130 330 134 360 132 V300 H0Z" fill="url(#${id}-sand)"/>
    <path d="M120 180 C170 156 230 150 300 160 C330 164 350 170 360 172 V184 C330 178 290 172 250 174 C200 176 160 182 120 180 Z" fill="#f8e5ba" opacity="0.9"/>
    <path d="M246 156 C290 156 330 164 360 172 V184 C330 178 300 174 276 174 C268 166 258 160 246 156 Z" fill="#e7c084" opacity="0.7"/>
    <path d="M0 236 C40 218 90 212 140 220 C110 226 60 236 0 252 Z" fill="#f8e5ba" opacity="0.9"/>
    <path d="M90 214 C110 214 130 216 140 220 C110 226 80 232 60 236 C76 228 86 222 90 214 Z" fill="#e7c084" opacity="0.6"/>
    <g stroke="#e2b877" stroke-width="1.1" fill="none" stroke-linecap="round" opacity="0.8"><path d="M150 214 q20 -5 40 0"/><path d="M168 222 q16 -4 32 0"/><path d="M260 214 q18 -4 36 0"/><path d="M30 274 q20 -5 40 0"/><path d="M200 278 q22 -5 44 0"/><path d="M290 246 q16 -4 32 0"/><path d="M60 164 q14 -3 28 0"/></g>
    <g fill="#d9a882" ${ol(0.5)}><ellipse cx="150" cy="150" rx="3" ry="1.6"/><ellipse cx="236" cy="292" rx="3.4" ry="1.8"/><ellipse cx="118" cy="296" rx="2.6" ry="1.4"/></g>
    ${[
      [196, 146],
      [26, 186],
      [338, 230],
      [150, 262],
    ]
      .map(([x, y]) => tuft(x, y, '#c4b06a'))
      .join('')}`,
  stages: {
    1: [
      { base: 204, svg: saguaro(306, 204, 78) },
      { base: 272, svg: pear(22, 272) },
    ],
    2: [
      {
        base: 198,
        svg: `
        ${shade(76, 198, 50, 4.6)}
        <path d="M52 152 V134 Q52 128 58 128 H96 Q102 128 102 134 V152 Z" fill="#e9b48c" ${ol(1)}/>
        <g fill="#8a5a3a">${[56, 66, 76, 86, 96].map((x) => `<rect x="${x}" y="131" width="3.2" height="2.6" rx="0.6"/>`).join('')}</g>
        <rect x="71" y="137" width="10" height="9" rx="2" fill="#5f9fa6" ${ol(0.7)}/>
        <path d="M32 198 V160 Q32 150 42 150 H108 Q118 150 118 160 V198 Z" fill="#e3a57c" ${ol(1)}/>
        <path d="M36 154 Q40 151 46 151 H104" stroke="#efc19c" stroke-width="2" fill="none" stroke-linecap="round"/>
        <g fill="#8a5a3a">${[40, 54, 68, 82, 96, 110].map((x) => `<rect x="${x - 1.6}" y="153" width="3.2" height="2.6" rx="0.6"/>`).join('')}</g>
        <path d="M66 198 V180 Q74 168 82 180 V198 Z" fill="#8a5a3a" ${ol(0.8)}/>
        <g fill="#7fc0c4" ${ol(0.7)}><rect x="42" y="168" width="12" height="11" rx="2"/><rect x="94" y="168" width="12" height="11" rx="2"/></g>
        <path d="M48 168 v11 M100 168 v11" stroke="#5f9fa6" stroke-width="0.8"/>
        <g stroke="#9a7352" stroke-width="1.8" stroke-linecap="round"><path d="M112 198 L118 140 M122 198 L128 140"/></g>
        <path d="M113 188 h10 M114 178 h10 M115 168 h10 M116 158 h10 M117 148 h10" stroke="#9a7352" stroke-width="1.4" stroke-linecap="round"/>
        <path d="M24 198 C22 190 24 184 30 184 C36 184 38 190 36 198 Z" fill="#c9774f" ${ol(0.7)}/>
        <g fill="#7fae6a"><ellipse cx="30" cy="181" rx="2.4" ry="5"/></g>`,
      },
    ],
    3: [
      {
        base: 206,
        svg: `
        <ellipse cx="200" cy="198" rx="66" ry="14" fill="#bcd08a"/>
        <ellipse cx="200" cy="197" rx="56" ry="10.4" fill="#8fd0cc"/>
        <path d="M156 194 C176 189 222 189 244 194" stroke="#b9e6e0" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${ripples([
          [170, 199, 12],
          [214, 202, 12],
          [234, 196, 7],
        ])}
        <g>${[138, 142, 258, 262].map((x, i) => `<path d="M${x} ${198 - (i % 2) * 2} V${182 - (i % 2) * 4}" stroke="#7d9a5a" stroke-width="1.4"/><rect x="${x - 1.6}" y="${180 - (i % 2) * 4}" width="3.2" height="8" rx="1.6" fill="#8a5a3a"/>`).join('')}</g>`,
      },
      { base: 186, svg: `${palm(178, 186, 70, -14, '#5fa65a', '#7fc06c', '#b48a5e', '#b0703a')}${palm(226, 184, 80, 12, '#57a058', '#78bc68', '#b48a5e', '#b0703a')}` },
    ],
    4: [
      {
        base: -6,
        svg: `<g class="sp-balloon">
          <path d="M148 64 L152 76 M168 64 L164 76" stroke="#8a6a4f" stroke-width="0.8"/>
          <path d="M138 44 C138 26 178 26 178 44 C178 54 168 62 158 66 C148 62 138 54 138 44 Z" fill="#ef8a6a" ${ol(0.9)}/>
          <path d="M152 30 C146 40 148 56 158 66 C168 56 170 40 164 30 C160 28 156 28 152 30 Z" fill="#f6d27a"/>
          <path d="M158 28 C156 40 156 54 158 66 C160 54 160 40 158 28 Z" fill="#7fc4c9"/>
          <rect x="151" y="75" width="14" height="9" rx="2" fill="#b98a5e" ${ol(0.8)}/>
        </g>`,
      },
      { base: 205, svg: saguaro(306, 204, 78, true) },
      { base: 273, svg: pear(22, 272, true) },
      ...scatter([
        [130, 226, bloom(130, 226, '#f6c94e', 1.7, 5)],
        [254, 232, bloom(254, 232, '#f28fb0', 1.7, 5)],
        [52, 226, bloom(52, 226, '#f6c94e', 1.7, 5)],
        [212, 298, bloom(212, 298, '#f28fb0', 1.7, 5)],
        [334, 262, bloom(334, 262, '#f6c94e', 1.7, 5)],
        [116, 300, bloom(116, 300, '#f28fb0', 1.7, 5)],
        [268, 300, bloom(268, 300, '#f6c94e', 1.6, 4)],
        [150, 214, bloom(150, 214, '#f28fb0', 1.5, 4)],
      ]),
      { base: 240, svg: butterflies([[150, 236]], '#f2a65a') },
    ],
  },
  sign: [346, 296],
  evening: [
    [40, 40],
    [120, 20],
    [200, 50],
    [320, 30],
    [250, 150],
    [80, 170],
  ],
};

// ------------------------------------------------------------------ woodland

/** A fern clump: arching fronds of little leaflets from (x, y). */
function fern(x: number, y: number, s = 1, c = '#6fa864'): string {
  const fronds: Array<[number, number]> = [
    [-26, -6],
    [-14, -24],
    [4, -28],
    [22, -16],
    [28, -2],
  ];
  return `<g>${fronds
    .map(([dx, dy]) => {
      const ex = x + dx * s;
      const ey = y + dy * s;
      const cx = x + dx * 0.4 * s;
      const cy = y + dy * 1.25 * s - 8 * s;
      const q = (t: number, a: number, b: number, e: number) => (1 - t) * (1 - t) * a + 2 * (1 - t) * t * b + t * t * e;
      const dq = (t: number, a: number, b: number, e: number) => 2 * (1 - t) * (b - a) + 2 * t * (e - b);
      let d = '';
      for (let t = 0.22; t < 0.96; t += 0.13) {
        const px = q(t, x, cx, ex);
        const py = q(t, y, cy, ey);
        let tx = dq(t, x, cx, ex);
        let ty = dq(t, y, cy, ey);
        const l = Math.hypot(tx, ty) || 1;
        tx /= l;
        ty /= l;
        const L = 6 * s * (1 - t * 0.7);
        const r = Math.round;
        d += `M${r(px - ty * L + tx * L * 0.5)} ${r(py + tx * L + ty * L * 0.5)} L${r(px)} ${r(py)} L${r(px + ty * L + tx * L * 0.5)} ${r(py - tx * L + ty * L * 0.5)} `;
      }
      return `<path d="M${x} ${y} Q${n(cx)} ${n(cy)} ${n(ex)} ${n(ey)}" stroke="#5f9656" stroke-width="1.1" fill="none"/><path d="${d}" stroke="${c}" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
    })
    .join('')}</g>`;
}

const toadstool = (x: number, y: number, s = 1) =>
  `<g><rect x="${n(x - 2 * s)}" y="${n(y - 8 * s)}" width="${n(4 * s)}" height="${n(8 * s)}" rx="${n(1.6 * s)}" fill="#f6ecd8" ${ol(0.6)}/><path d="M${n(x - 7 * s)} ${n(y - 7 * s)} C${n(x - 7 * s)} ${n(y - 15 * s)} ${n(x + 7 * s)} ${n(y - 15 * s)} ${n(x + 7 * s)} ${n(y - 7 * s)} Z" fill="#e0574a" ${ol(0.7)}/><g fill="#fff"><circle cx="${n(x - 3 * s)}" cy="${n(y - 10 * s)}" r="${n(1.2 * s)}"/><circle cx="${n(x + 2.4 * s)}" cy="${n(y - 11.4 * s)}" r="${n(1 * s)}"/><circle cx="${n(x + 4.6 * s)}" cy="${n(y - 8.6 * s)}" r="${n(0.8 * s)}"/></g></g>`;

const bluebell = (x: number, y: number) =>
  `<g><path d="M${x} ${y} C${x} ${y - 6} ${x + 2} ${y - 10} ${x + 5} ${y - 11}" stroke="#6f9a4a" stroke-width="1" fill="none"/><g fill="#8a9be0"><path d="M${x + 1} ${y - 7} q-2.4 0 -2.4 3.4 l1.2 -0.6 l1.2 0.8 l1.2 -0.8 l1.2 0.6 q0 -3.4 -2.4 -3.4z"/><path d="M${x + 4.4} ${y - 10} q-2.4 0 -2.4 3.4 l1.2 -0.6 l1.2 0.8 l1.2 -0.8 l1.2 0.6 q0 -3.4 -2.4 -3.4z"/></g></g>`;

/** A slim birch: white trunk with dark marks and a small airy crown. */
const birch = (x: number, y: number, h: number) =>
  `${shade(x, y + 0.5, 8, 1.6)}<rect x="${x - 2}" y="${y - h}" width="4" height="${h}" rx="1.6" fill="#f4f1ea" ${ol(0.7)}/><path d="M${x - 2} ${y - h * 0.3} h2.4 M${x} ${y - h * 0.5} h2 M${x - 2} ${y - h * 0.68} h2.6 M${x} ${y - h * 0.16} h2" stroke="#4a4440" stroke-width="1.1"/>
   <g fill="#a9cf7a"><circle cx="${x - 6}" cy="${y - h + 2}" r="8"/><circle cx="${x + 6}" cy="${y - h}" r="8"/><circle cx="${x}" cy="${y - h - 8}" r="9"/></g><g fill="#bfdc90"><circle cx="${x - 2}" cy="${y - h - 11}" r="4"/></g>`;

const WOODLAND: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c9e1ec"/><stop offset="0.7" stop-color="#e5eee8"/><stop offset="1" stop-color="#eff3e3"/></linearGradient>
      <linearGradient id="${id}-moss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3cf87"/><stop offset="1" stop-color="#93b86c"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="300" cy="42" r="26" fill="#fff8dc" opacity="0.5"/><circle cx="300" cy="42" r="15" fill="#ffefb8"/>
    <g fill="#fff" opacity="0.75"><ellipse cx="160" cy="30" rx="30" ry="5"/><ellipse cx="176" cy="25" rx="14" ry="5"/><ellipse cx="60" cy="52" rx="18" ry="3.4"/></g>`,
  land: (id) => `
    <g fill="#bed4c0">${Array.from({ length: 17 }, (_, i) => `<circle cx="${i * 23}" cy="${110 + ((i * 7) % 3) * 4}" r="${14 + ((i * 5) % 3) * 3}"/>`).join('')}</g>
    <g>${[14, 60, 120, 168, 214, 256, 304, 346].map((x, i) => pine(x, 128, 44 + ((i * 3) % 4) * 6, '#a9c7ae', '', false)).join('')}</g>
    <g fill="#9fc39c">${Array.from({ length: 16 }, (_, i) => `<circle cx="${10 + i * 24}" cy="${124 + ((i * 3) % 4) * 3}" r="${13 + ((i * 7) % 3) * 3}"/>`).join('')}</g>
    <g>${[36, 96, 190, 280, 330].map((x, i) => pine(x, 136, 34 + (i % 2) * 8, '#87b28a', '', false)).join('')}</g>
    <path d="M0 136 C80 130 180 136 260 132 C300 130 330 134 360 132 V300 H0Z" fill="url(#${id}-moss)"/>
    <g fill="#8fb878"><circle cx="112" cy="140" r="9"/><circle cx="124" cy="138" r="7"/><circle cx="236" cy="138" r="8"/><circle cx="248" cy="140" r="6"/><circle cx="350" cy="140" r="8"/></g>
    ${birch(150, 152, 44)}${birch(168, 148, 34)}
    <g stroke="#c9e0a4" stroke-width="10" opacity="0.32" fill="none"><path d="M0 200 C120 192 240 198 360 190"/><path d="M0 256 C120 248 250 254 360 246"/></g>
    <path d="M118 300 C126 270 152 248 182 228 C208 210 218 186 214 150 L222 150 C230 186 222 210 196 232 C168 254 150 276 152 300 Z" fill="#dcc89f" opacity="0.85"/>
    ${fern(338, 232, 1)}${fern(114, 226, 0.8)}${fern(350, 300, 1.1)}
    ${[
      [96, 296],
      [214, 246],
      [278, 232],
      [20, 250],
      [250, 298],
    ]
      .map(([x, y]) => tuft(x, y, '#76a85a'))
      .join('')}
    <g fill="#d98a4e" opacity="0.7"><ellipse cx="160" cy="172" rx="2.4" ry="1.2" transform="rotate(20 160 172)"/><ellipse cx="300" cy="290" rx="2.4" ry="1.2" transform="rotate(-30 300 290)"/><ellipse cx="60" cy="282" rx="2.4" ry="1.2"/><ellipse cx="236" cy="268" rx="2.2" ry="1.1" transform="rotate(40 236 268)"/></g>`,
  stages: {
    1: [
      {
        base: 200,
        svg: `
        ${shade(48, 200, 36, 5)}
        <path d="M28 200 C36 178 34 152 38 126 L58 126 C60 152 60 178 70 200 C62 196 56 198 48 196 C40 198 34 196 28 200 Z" fill="#9a7352" ${ol(1)}/>
        <path d="M44 190 C45 168 44 148 47 132 M54 186 C54 170 54 152 55 136" stroke="#86613f" stroke-width="1.1" fill="none"/>
        <ellipse cx="48" cy="160" rx="5" ry="7" fill="#5e4430"/>
        <g stroke="#9a7352" stroke-width="5" stroke-linecap="round" fill="none"><path d="M42 130 C32 116 20 108 8 104"/><path d="M54 128 C66 112 82 104 98 100"/><path d="M48 128 V96"/></g>
        <g fill="#6f9f58"><circle cx="16" cy="92" r="22"/><circle cx="46" cy="68" r="30"/><circle cx="84" cy="84" r="24"/><circle cx="104" cy="102" r="12"/><circle cx="0" cy="110" r="14"/><circle cx="64" cy="100" r="16"/><circle cx="28" cy="108" r="14"/></g>
        <g fill="#86b66a"><circle cx="38" cy="58" r="14"/><circle cx="74" cy="72" r="11"/><circle cx="12" cy="82" r="10"/><circle cx="92" cy="88" r="7"/></g>
        <g fill="#9cc77c"><circle cx="34" cy="52" r="6"/><circle cx="70" cy="66" r="4.4"/></g>
        <g fill="#b98a5e"><ellipse cx="22" cy="96" rx="2.2" ry="2.6"/><ellipse cx="76" cy="92" rx="2.2" ry="2.6"/><ellipse cx="54" cy="80" rx="2.2" ry="2.6"/></g>`,
      },
    ],
    2: [
      {
        base: 204,
        svg: `
        ${shade(284, 204, 44, 5)}
        <path d="M244 204 C252 200 252 192 254 184 L314 184 C316 192 316 200 324 204 Z" fill="#9a6c46" ${ol(0.9)}/>
        <path d="M252 202 C254 184 252 164 256 146 L312 146 C316 164 314 184 316 202 Z" fill="#a8784f" ${ol(1)}/>
        <path d="M262 198 C263 182 262 166 264 152 M302 198 C303 182 302 166 304 152" stroke="#8f6440" stroke-width="1.1" fill="none"/>
        <ellipse cx="284" cy="146" rx="28" ry="6.4" fill="#e2bd8c" ${ol(0.9)}/><ellipse cx="284" cy="146" rx="17" ry="3.8" fill="none" stroke="#c99e6c" stroke-width="1"/>
        <path d="M246 146 Q284 98 322 146 Q284 156 246 146 Z" fill="#d9574a" ${ol(1)}/>
        <g fill="#fff"><ellipse cx="270" cy="132" rx="3.4" ry="2.4"/><ellipse cx="292" cy="122" rx="4" ry="2.8"/><ellipse cx="306" cy="138" rx="2.8" ry="2"/><ellipse cx="282" cy="140" rx="2.4" ry="1.6"/></g>
        <rect x="304" y="112" width="5" height="16" fill="#8b8f94" ${ol(0.7)}/><rect x="302" y="110" width="9" height="3" rx="1" fill="#6f7378"/>
        <path d="M276 204 V186 Q284 176 292 186 V204 Z" fill="#5f8f5a" ${ol(0.9)}/><circle cx="289" cy="195" r="1" fill="#f6d27a"/>
        <circle cx="266" cy="168" r="6.4" fill="#fbe3a0" ${ol(0.8)}/><path d="M266 161.6 v12.8 M259.6 168 h12.8" stroke="#a8784f" stroke-width="1.1"/>
        <g fill="#8fbf6a"><ellipse cx="258" cy="149" rx="5" ry="2"/><ellipse cx="312" cy="149" rx="4" ry="1.8"/></g>
        <g fill="#d8cdb2" ${ol(0.5)}><ellipse cx="286" cy="210" rx="5" ry="2"/><ellipse cx="292" cy="218" rx="5.4" ry="2.2"/></g>`,
      },
    ],
    3: [
      {
        base: 212,
        svg: `
        <ellipse cx="176" cy="200" rx="56" ry="13" fill="#8fbb7a"/>
        <ellipse cx="176" cy="199" rx="48" ry="9.6" fill="#93cbd8"/>
        <path d="M140 197 C156 192 196 192 214 196" stroke="#bfe2ea" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${ripples([
          [150, 202, 12],
          [190, 204, 12],
        ])}
        <rect x="156" y="183" width="54" height="9" rx="4.5" fill="#9a7352" ${ol(0.9)}/><ellipse cx="208" cy="187.5" rx="3" ry="4.5" fill="#d9b07f" ${ol(0.7)}/>
        <path d="M160 184 q10 -3 22 0 q8 -2 16 0" stroke="#86b866" stroke-width="2.6" stroke-linecap="round" fill="none"/>
        ${lily(148, 203, 5)}${lily(200, 206, 4.4)}
        ${fern(126, 208, 0.6, '#79b06c')}${fern(228, 206, 0.6, '#79b06c')}`,
      },
      { base: 170, svg: `${pine(334, 172, 80, '#5a9470', '#72aa86')}${pine(354, 180, 58, '#62997a', '#7ab08d')}${pine(232, 164, 52, '#62997a', '#7ab08d')}` },
    ],
    4: [
      ...scatter([
        [142, 226, `${toadstool(136, 226, 1)}${toadstool(146, 228, 0.7)}`],
        [336, 252, toadstool(336, 252, 0.9)],
        [214, 296, `${toadstool(214, 296, 0.8)}${toadstool(222, 298, 0.55)}`],
        [20, 236, bluebell(20, 236)],
        [118, 244, bluebell(118, 244)],
        [226, 236, bluebell(226, 236)],
        [276, 296, bluebell(276, 296)],
        [80, 296, bluebell(80, 296)],
        [352, 272, bluebell(352, 272)],
        [36, 266, bluebell(36, 266)],
        [262, 234, bluebell(262, 234)],
      ]),
      {
        base: 220,
        svg: butterflies(
          [
            [150, 160],
            [236, 214],
          ],
          '#f2b45a',
        ),
      },
      {
        base: 201,
        svg: `<path d="M70 120 v10" stroke="#8a6a4f" stroke-width="1"/><path d="M62 132 L70 124 L78 132 Z" fill="#c9483b" ${ol(0.7)}/><rect x="63.6" y="131" width="12.8" height="12" fill="#e9c27a" ${ol(0.7)}/><circle cx="70" cy="137" r="2.2" fill="#5e4430"/>`,
      },
      {
        base: 12,
        svg: birdFlock([
          [180, 56],
          [196, 48],
          [210, 58],
        ]),
      },
    ],
  },
  sign: [24, 292],
  evening: [
    [60, 150],
    [140, 120],
    [200, 170],
    [300, 230],
    [340, 160],
    [120, 260],
  ],
};

// ------------------------------------------------------------------ wetland

const iris = (x: number, y: number) =>
  `<g><path d="M${x} ${y} V${y - 12}" stroke="#6f9a4a" stroke-width="1.1"/><path d="M${x - 1} ${y} q-3 -6 -2 -11 M${x + 1} ${y} q3 -6 2 -10" stroke="#7fae62" stroke-width="1.2" fill="none"/><g fill="#9a84d8"><ellipse cx="${x - 2.4}" cy="${y - 13}" rx="2" ry="3" transform="rotate(-30 ${x - 2.4} ${y - 13})"/><ellipse cx="${x + 2.4}" cy="${y - 13}" rx="2" ry="3" transform="rotate(30 ${x + 2.4} ${y - 13})"/><ellipse cx="${x}" cy="${y - 15.4}" rx="1.6" ry="3"/></g><circle cx="${x}" cy="${y - 12.6}" r="0.9" fill="#f6d27a"/></g>`;

const dragonflies = (pts: Array<[number, number]>) =>
  `<g class="sp-birds">${pts
    .map(
      ([x, y]) =>
        `<g><g fill="#dff2f6" opacity="0.9" stroke="#9ccbd8" stroke-width="0.4"><ellipse cx="${x - 4}" cy="${y - 1.6}" rx="4" ry="1.4" transform="rotate(-12 ${x - 4} ${y - 1.6})"/><ellipse cx="${x + 4}" cy="${y - 1.6}" rx="4" ry="1.4" transform="rotate(12 ${x + 4} ${y - 1.6})"/><ellipse cx="${x - 3.6}" cy="${y + 1}" rx="3.4" ry="1.2" transform="rotate(10 ${x - 3.6} ${y + 1})"/><ellipse cx="${x + 3.6}" cy="${y + 1}" rx="3.4" ry="1.2" transform="rotate(-10 ${x + 3.6} ${y + 1})"/></g><path d="M${x} ${y - 3} V${y + 7}" stroke="#3f8fb0" stroke-width="1.4" stroke-linecap="round"/></g>`,
    )
    .join('')}</g>`;

const WETLAND: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#c4dbe8"/><stop offset="0.7" stop-color="#e2ece8"/><stop offset="1" stop-color="#edf2e2"/></linearGradient>
      <linearGradient id="${id}-bank" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b7d39a"/><stop offset="1" stop-color="#97bd7e"/></linearGradient>
      <linearGradient id="${id}-water" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b4dcdc"/><stop offset="1" stop-color="#97cbd0"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="96" cy="70" r="30" fill="#fff6dc" opacity="0.5"/><circle cx="96" cy="70" r="18" fill="#fde9bc"/>
    <g fill="#fff" opacity="0.7"><ellipse cx="236" cy="36" rx="40" ry="5"/><ellipse cx="256" cy="30" rx="18" ry="5"/><ellipse cx="320" cy="62" rx="20" ry="3.4"/></g>`,
  land: (id) => `
    <g fill="#b2cdb2">${Array.from({ length: 20 }, (_, i) => `<ellipse cx="${i * 19}" cy="${118 + ((i * 7) % 3) * 2}" rx="${12 + ((i * 5) % 3) * 2}" ry="${9 + ((i * 3) % 3) * 2}"/>`).join('')}</g>
    <g fill="#a3c3a6"><ellipse cx="40" cy="120" rx="16" ry="12"/><ellipse cx="150" cy="122" rx="14" ry="10"/><ellipse cx="320" cy="120" rx="18" ry="12"/></g>
    <path d="M0 128 C80 122 180 128 260 124 C300 122 330 126 360 124 V300 H0Z" fill="url(#${id}-bank)"/>
    <path d="M118 188 C128 168 172 160 210 158 C216 150 212 138 204 125 L238 125 C244 140 256 152 276 157 C306 158 334 154 360 154 V256 C330 262 292 258 254 262 C214 266 172 260 150 248 C124 236 110 210 118 188 Z" fill="url(#${id}-water)"/>
    <path d="M204 125 C212 138 216 150 210 158 C172 160 128 168 118 188 C110 210 124 236 150 248 C172 260 214 266 254 262 C292 258 330 262 360 256 M238 125 C244 140 256 152 276 157 C306 158 334 154 360 154" stroke="#86b073" stroke-width="3" fill="none"/>
    <path d="M140 180 C160 170 200 166 240 166 C290 166 320 162 360 162" stroke="#cdeae6" stroke-width="3" fill="none" stroke-linecap="round" opacity="0.8"/>
    <g fill="#b9dcd4" opacity="0.7"><ellipse cx="232" cy="226" rx="30" ry="3"/><ellipse cx="320" cy="200" rx="24" ry="2.6"/></g>
    ${ripples([
      [176, 200, 12],
      [262, 186, 14],
      [320, 244, 12],
      [214, 244, 10],
      [216, 140, 8],
    ])}
    <g stroke="#cfe6c0" stroke-width="10" opacity="0.32" fill="none"><path d="M0 196 C40 192 80 196 110 192"/><path d="M0 284 C120 276 250 282 360 276"/></g>
    <g stroke-linecap="round" fill="none">${[
      [190, 146],
      [286, 148],
      [330, 146],
      [96, 152],
      [16, 160],
    ]
      .map(([x, y], i) => `<path d="M${x - 4} ${y} q-1 -8 -4 -12 M${x} ${y} q0 -9 1 -14 M${x + 4} ${y} q1 -7 5 -11" stroke="${i % 2 ? '#8db86a' : '#7fae62'}" stroke-width="1.4"/>`)
      .join('')}</g>
    ${[
      [20, 178],
      [180, 286],
      [240, 296],
      [340, 286],
      [130, 270],
    ]
      .map(([x, y]) => tuft(x, y, '#6f9f58'))
      .join('')}`,
  stages: {
    1: [
      { base: 192, svg: reeds(124, 192, 1) },
      { base: 166, svg: reeds(348, 166, 0.9) },
      { base: 264, svg: reeds(262, 264, 1.1) },
      { base: 230, svg: `${lily(286, 214, 6)}${lily(184, 252, 5)}` },
    ],
    2: [
      {
        base: 176,
        svg: `
        ${shade(306, 176, 34, 3)}
        <g stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"><path d="M282 176 V150 M330 176 V150 M300 178 V152 M314 178 V152"/></g>
        <g class="sp-water" stroke="#fff" stroke-width="1.1" fill="none" opacity="0.8"><path d="M276 177 q6 1.4 12 0 M324 177 q6 1.4 12 0"/></g>
        <rect x="274" y="148" width="64" height="6" rx="1.4" fill="#c99a6c" ${ol(0.9)}/>
        <rect x="282" y="124" width="48" height="25" fill="#d9b483" ${ol(0.9)}/>
        <path d="M282 130 H330 M282 136 H330 M282 142 H330" stroke="#c49e6c" stroke-width="0.9"/>
        <path d="M298 148 V134 Q306 128 314 134 V148 Z" fill="#7a5a3a"/>
        <rect x="318" y="131" width="8" height="7" rx="1" fill="#fbe7b0" ${ol(0.6)}/>
        <path d="M270 128 L306 100 L342 128 Q306 132 270 128 Z" fill="#e2c27a" ${ol(1)}/>
        <path d="M280 124 L306 104 M292 127 L306 106 M320 127 L306 106 M332 124 L306 104" stroke="#c9a65e" stroke-width="1" fill="none"/>
        <g stroke="#8a6a4f" stroke-width="2" stroke-linecap="round">${[112, 152, 192, 232, 266].map((x) => `<path d="M${x} ${n(196 - (x - 90) * 0.157)} v8"/>`).join('')}</g>
        <path d="M90 186 L272 157 L276 165 L94 195 Z" fill="#c99a6c" ${ol(0.8)}/>
        <g stroke="#a87b4f" stroke-width="0.9">${Array.from({ length: 15 }, (_, i) => `<path d="M${n(102 + i * 11.6)} ${n(184.6 - i * 1.84)} l1.8 8"/>`).join('')}</g>
        <g stroke="#9a7352" stroke-width="1.6" stroke-linecap="round"><path d="M92 176 L272 147"/>${[96, 136, 176, 216, 256].map((x) => `<path d="M${x} ${n(176 - (x - 92) * 0.161)} v10"/>`).join('')}</g>`,
      },
    ],
    3: [
      {
        base: 186,
        svg: `
        ${shade(30, 186, 26, 3.6)}
        <path d="M22 186 C26 168 24 150 28 132 L36 132 C34 150 36 168 40 186 Z" fill="#8f7a5c" ${ol(0.9)}/>
        <g fill="#8fbf78"><ellipse cx="32" cy="112" rx="34" ry="22"/><ellipse cx="14" cy="122" rx="16" ry="12"/><ellipse cx="54" cy="120" rx="18" ry="12"/></g>
        <g class="sp-sway" stroke-linecap="round" fill="none">${[-24, -16, -8, 2, 12, 22, 32, 42, 50]
          .map((d, i) => `<path d="M${32 + d} ${n(112 + Math.abs(d) * 0.1)} C${n(32 + d * 1.1)} ${128 + (i % 3) * 4} ${n(32 + d * 1.2)} ${142 + (i % 2) * 6} ${n(32 + d * 1.18)} ${150 + (i % 3) * 8}" stroke="${i % 2 ? '#a3cc8a' : '#86b870'}" stroke-width="3"/>`)
          .join('')}</g>
        <g fill="#a9d08f"><ellipse cx="26" cy="102" rx="12" ry="7"/><ellipse cx="44" cy="106" rx="8" ry="5"/></g>`,
      },
      {
        base: 255,
        svg: `${lily(196, 252, 7, '#f4a6c4')}${lily(252, 246, 6)}${lily(344, 196, 7, '#fbe3f0')}${lily(260, 176, 5, '#f4a6c4')}${lily(146, 206, 5)}`,
      },
    ],
    4: [
      ...scatter([
        [110, 196, `${iris(108, 194)}${iris(116, 198)}`],
        [72, 268, iris(72, 268)],
        [228, 292, iris(228, 292)],
        [340, 296, iris(340, 296)],
        [10, 222, iris(10, 222)],
        [160, 290, iris(160, 290)],
        [40, 280, iris(40, 280)],
      ]),
      {
        base: 230,
        svg: dragonflies([
          [210, 184],
          [330, 236],
        ]),
      },
      {
        base: 12,
        svg: birdFlock([
          [200, 70],
          [216, 62],
          [230, 72],
        ]),
      },
    ],
  },
  sign: [24, 294],
  evening: [
    [60, 150],
    [150, 140],
    [220, 190],
    [300, 210],
    [340, 270],
    [100, 240],
  ],
};

// ------------------------------------------------------------------ coast

/** Where the coast's sand meets the sea. */
const shoreAt = (x: number) => 170 + 0.155 * x + 6 * Math.sin((x / 360) * Math.PI * 2);
const SHORE = Array.from({ length: 31 }, (_, i) => `${i * 12} ${n(shoreAt(i * 12))}`).join(' L');

const COAST: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b6d9ee"/><stop offset="0.7" stop-color="#dbedf4"/><stop offset="1" stop-color="#edf6f3"/></linearGradient>
      <linearGradient id="${id}-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#7fb7d2"/><stop offset="1" stop-color="#a4d3de"/></linearGradient>
      <linearGradient id="${id}-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f1e1bd"/><stop offset="1" stop-color="#e6cd9e"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="232" cy="50" r="28" fill="#fffbe6" opacity="0.5"/><circle cx="232" cy="50" r="16" fill="#fff1c0"/>
    <g fill="#fff" opacity="0.85"><ellipse cx="100" cy="36" rx="30" ry="6"/><ellipse cx="118" cy="30" rx="15" ry="6"/><ellipse cx="320" cy="72" rx="22" ry="4"/></g>`,
  land: (id) => `
    <path d="M0 116 H360 V240 H0 Z" fill="url(#${id}-sea)"/>
    <path d="M286 116 C294 108 312 106 326 112 L330 116 Z" fill="#9fbccc"/>
    <path d="M0 116 H360" stroke="#d2eaf2" stroke-width="1.4"/>
    <g stroke="#fff" stroke-width="1.3" fill="none" stroke-linecap="round" opacity="0.75"><path d="M150 130 q6 -2 12 0"/><path d="M230 138 q7 -2 14 0"/><path d="M300 128 q6 -2 12 0"/><path d="M196 152 q8 -2.4 16 0"/><path d="M330 160 q7 -2 14 0"/><path d="M262 182 q8 -2.4 16 0"/><path d="M180 172 q6 -2 12 0"/></g>
    <path d="M0 98 C22 90 54 88 78 96 C92 102 100 118 106 138 C110 150 116 164 126 176 L126 210 L0 210 Z" fill="#c9b49c" ${ol(0.8)}/>
    <path d="M78 96 C92 102 100 118 106 138 C110 150 116 164 126 176 L126 210 L104 210 C98 170 94 132 84 110 Z" fill="#b8a189"/>
    <path d="M10 130 l14 4 M40 120 l18 2 M64 140 l14 6 M30 152 l20 2 M50 170 l16 3" stroke="#b39d86" stroke-width="1.1"/>
    <path d="M0 98 C22 90 54 88 78 96 C86 100 90 104 93 110 C70 104 40 104 0 108 Z" fill="#9dc785"/>
    <g fill="#a9a49c" ${ol(0.6)}><ellipse cx="120" cy="182" rx="7" ry="4"/><ellipse cx="132" cy="186" rx="4" ry="2.6"/></g>
    <path d="M${foam(shoreAt, 0, 360, 12, 3)}" stroke="#fff" stroke-width="5" fill="none" opacity="0.55" transform="translate(0 -3)"/>
    <path d="M0 ${n(shoreAt(0))} L${SHORE} V300 H0 Z" fill="url(#${id}-sand)"/>
    <path d="M0 ${n(shoreAt(0) + 3)} L${Array.from({ length: 31 }, (_, i) => `${i * 12} ${n(shoreAt(i * 12) + 3)}`).join(' L')}" stroke="#e1caa0" stroke-width="6" fill="none" opacity="0.7"/>
    <path d="${foam(shoreAt, 0, 360, 12, 3)}" stroke="#fff" stroke-width="1.8" fill="none" stroke-linecap="round"/>
    <g stroke="#ecd9b2" stroke-width="9" opacity="0.6" fill="none"><path d="M0 256 C120 248 250 256 360 258"/></g>
    <path d="M0 214 C20 206 44 206 66 214 C50 216 24 218 0 224 Z" fill="#e9d6ae"/>
    ${[
      [12, 214],
      [34, 210],
      [8, 250],
      [52, 212],
    ]
      .map(([x, y]) => tuft(x, y, '#a3b878'))
      .join('')}
    <g fill="#d9c4a0">${[
      [96, 274],
      [180, 230],
      [250, 280],
      [320, 258],
      [30, 290],
    ]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2"/><circle cx="${x + 4}" cy="${y + 2}" r="0.9"/>`)
      .join('')}</g>
    ${shell(130, 238)}${shell(262, 290, '#fbe3c8')}${shell(46, 286)}`,
  stages: {
    1: [
      {
        base: 236,
        svg: `
        ${shade(330, 236, 34, 4)}
        <path d="M300 236 C298 222 308 212 320 214 C326 206 340 204 348 212 C356 208 362 214 360 222 V236 Z" fill="#a9a49c" ${ol(0.9)}/>
        <path d="M306 222 C312 216 320 216 326 220 M330 212 C336 208 344 210 348 214" stroke="#c6c1b8" stroke-width="2.4" fill="none" stroke-linecap="round"/>
        <g fill="#7a9a5a"><path d="M304 236 q-2 -6 2 -10 q-1 5 2 10z"/><path d="M344 236 q2 -6 -2 -9 q3 4 4 9z"/></g>
        <g class="sp-water" stroke="#fff" stroke-width="1.2" fill="none" opacity="0.8"><path d="M292 226 q4 -2 8 0"/><path d="M312 208 q4 -2 8 0"/></g>`,
      },
      {
        base: 214,
        svg: `${shade(150, 214, 26, 2.4)}<path d="M126 212 C140 206 162 208 176 210 C178 214 176 216 172 216 C158 214 140 214 128 218 C124 216 124 214 126 212 Z" fill="#b8a48a" ${ol(0.8)}/><path d="M136 211 q8 -2 16 0" stroke="#d2c0a6" stroke-width="1" fill="none"/><path d="M168 210 l6 -6" stroke="#b8a48a" stroke-width="2" stroke-linecap="round"/>`,
      },
    ],
    2: [
      {
        base: 212,
        svg: `
        ${shade(52, 212, 34, 3.6)}
        <path d="M30 212 v-6 M74 212 v-6" stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"/>
        <rect x="24" y="202" width="56" height="5" rx="1.2" fill="#c99a6c" ${ol(0.8)}/>
        <rect x="28" y="168" width="48" height="35" fill="#fbf6ec" ${ol(1)}/>
        <g fill="#6aa3c9">${[28, 40, 52, 64].map((x) => `<rect x="${x}" y="168" width="6" height="35"/>`).join('')}</g>
        <path d="M20 170 L52 146 L84 170 Z" fill="#e6735f" ${ol(1)}/>
        <path d="M26 170 L52 151 L78 170" stroke="#f3a08e" stroke-width="1.4" fill="none"/>
        <path d="M44 203 V184 Q52 178 60 184 V203 Z" fill="#f6d27a" ${ol(0.8)}/>
        <circle cx="52" cy="160" r="3.4" fill="#bfe3f2" ${ol(0.6)}/>
        <path d="M80 212 l8 4 M82 208 l6 3" stroke="#c99a6c" stroke-width="1.6" stroke-linecap="round"/>`,
      },
    ],
    3: [
      {
        base: 240,
        svg: `
        <ellipse cx="258" cy="236" rx="24" ry="6.4" fill="#b8b1a4" ${ol(0.8)}/>
        <ellipse cx="258" cy="235.4" rx="19.4" ry="4.4" fill="#9fd3dd"/>
        ${starfish(250, 236, '#f2a65a', 3.4)}
        <g fill="#e98aa0"><circle cx="267" cy="235" r="1.6"/><circle cx="269.6" cy="234" r="1.2"/><circle cx="265" cy="233.6" r="1.1"/></g>
        ${ripples([[254, 233, 8]])}
        <g fill="#b8b1a4" ${ol(0.6)}><ellipse cx="234" cy="238" rx="4.4" ry="2.8"/><ellipse cx="284" cy="236" rx="3.6" ry="2.4"/></g>`,
      },
      {
        base: 226,
        svg: `
        ${shade(174, 226, 20, 3)}
        <path d="M172 226 L176 186" stroke="#8a6a4f" stroke-width="1.8" stroke-linecap="round"/>
        <path d="M150 192 C156 176 196 174 204 190 Z" fill="#fbf6ec" ${ol(1)}/>
        <path d="M164 191 C166 180 178 176 177 177 C176 180 176 186 177 190 Z M190 189 C190 180 184 177 177 177 C180 179 184 184 186 190 Z" fill="#e6735f"/>
        <path d="M150 192 q4 3 9 0 q4 3 9 0 q4 3 9 0 q4 3 9 0 q4 3 9 0 q4 3 9 -2" stroke="${OUT}" stroke-width="0.6" fill="none"/>
        <circle cx="177" cy="176" r="1.6" fill="#e6735f"/>
        <rect x="148" y="217" width="18" height="7" rx="2" fill="#6aa3c9" opacity="0.85"/>`,
      },
    ],
    4: [
      {
        base: 108,
        svg: `
        ${shade(48, 106, 14, 2)}
        <path d="M40 106 L43 52 L53 52 L56 106 Z" fill="#fbf6ec" ${ol(1)}/>
        <path d="M41.6 82 L54.4 82 L55 94 L41 94 Z M42.8 60 L53.2 60 L53.6 70 L42.4 70 Z" fill="#e6735f"/>
        <rect x="41" y="44" width="14" height="9" rx="1" fill="#fff4c8" ${ol(0.8)}/>
        <circle class="sp-glow" cx="48" cy="48" r="13" fill="#ffe9a0" opacity="0.4"/>
        <path d="M39 44 L48 36 L57 44 Z" fill="#e6735f" ${ol(0.8)}/>
        <path d="M38 53 H58" stroke="#8a8f94" stroke-width="1.6"/>
        <path d="M46 106 V98 Q48 95 50 98 V106 Z" fill="#7a5a3a"/>`,
      },
      {
        base: 140,
        svg: `<g class="sp-sway"><path d="M244 150 L276 150 L270 157 L250 157 Z" fill="#c9805a" ${ol(0.8)}/><path d="M260 150 V122" stroke="#8a6a4f" stroke-width="1.2"/><path d="M261 124 L274 147 L261 147 Z" fill="#fbf6ec" ${ol(0.7)}/><path d="M259 128 L249 147 L259 147 Z" fill="#f6d27a" ${ol(0.7)}/></g>`,
      },
      ...scatter([
        [110, 294, starfish(110, 292, '#f2a65a', 4)],
        [330, 262, starfish(330, 260, '#e98a7a', 3.6)],
        [222, 238, shell(222, 238, '#fbe3f0')],
        [18, 272, shell(18, 272, '#f6d2b8')],
        [196, 300, shell(196, 300, '#f6c9d0')],
      ]),
      {
        base: 12,
        svg: birdFlock(
          [
            [150, 70],
            [166, 62],
            [312, 96],
          ],
          '#6a7c88',
        ),
      },
    ],
  },
  sign: [112, 236],
  evening: [
    [40, 30],
    [150, 40],
    [300, 30],
    [200, 230],
    [320, 280],
    [80, 270],
  ],
};

// ------------------------------------------------------------------ island

const hibiscus = (x: number, y: number, c = '#ef6f72') =>
  `<g><path d="M${x} ${y + 2} v4" stroke="#6f9a4a" stroke-width="1"/><g fill="${c}">${[0, 72, 144, 216, 288]
    .map((a) => {
      const px = n(x + Math.cos(rad(a - 90)) * 2.6);
      const py = n(y + Math.sin(rad(a - 90)) * 2.6);
      return `<ellipse cx="${px}" cy="${py}" rx="2.6" ry="1.9" transform="rotate(${a} ${px} ${py})"/>`;
    })
    .join('')}</g><circle cx="${x}" cy="${y}" r="1.1" fill="#f6d27a"/></g>`;

const ISLAND: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#a2dbe8"/><stop offset="0.68" stop-color="#d4efec"/><stop offset="1" stop-color="#f4f0dc"/></linearGradient>
      <linearGradient id="${id}-sand" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8ecd0"/><stop offset="1" stop-color="#f0d9ae"/></linearGradient>
      <linearGradient id="${id}-lagoon" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6fcbd0"/><stop offset="1" stop-color="#a6e6dc"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="70" cy="46" r="30" fill="#fff6d0" opacity="0.5"/><circle cx="70" cy="46" r="18" fill="#ffe9a6"/>
    <g fill="#fff" opacity="0.8"><ellipse cx="170" cy="28" rx="30" ry="5"/><ellipse cx="186" cy="23" rx="13" ry="5"/></g>`,
  land: (id) => `
    <path d="M0 110 H360 V160 H0 Z" fill="#6fc4d0"/>
    <path d="M0 110 H360" stroke="#c9eef0" stroke-width="1.4"/>
    <path d="M38 112 C44 104 58 102 66 110 Z" fill="#7dbb78"/><path d="M52 104 q2 -8 6 -12" stroke="#8a6a4f" stroke-width="1.4" fill="none"/><g fill="#6aa968"><path d="M58 92 q-8 -2 -12 3 q6 -1 12 -3z"/><path d="M58 92 q8 -3 12 2 q-6 -1 -12 -2z"/><path d="M58 92 q-2 -6 2 -9 q0 5 -2 9z"/></g>
    <path d="M168 136 C188 112 212 86 232 64 C248 46 262 34 276 36 C290 38 300 50 312 66 C330 88 348 104 360 110 V140 H168 Z" fill="#7dbb78"/>
    <path d="M276 36 C290 38 300 50 312 66 C330 88 348 104 360 110 V140 H300 C306 118 296 84 280 56 Z" fill="#6aa96a"/>
    <path d="M232 64 C226 80 214 100 204 120 M256 46 C250 70 242 100 238 128 M300 60 C306 84 316 110 324 132" stroke="#93cc88" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.8"/>
    <g fill="#6aa96a"><circle cx="196" cy="128" r="7"/><circle cx="208" cy="124" r="6"/><circle cx="288" cy="126" r="7"/><circle cx="342" cy="124" r="6"/></g>
    <path d="M266 38 Q276 44 288 40" stroke="#5f9a5f" stroke-width="2" fill="none" stroke-linecap="round"/>
    <g fill="#fff" opacity="0.9"><ellipse cx="270" cy="30" rx="18" ry="5"/><ellipse cx="284" cy="26" rx="10" ry="5"/></g>
    <path d="M0 132 C60 128 120 134 180 132 C240 128 300 134 360 132 V300 H0 Z" fill="url(#${id}-sand)"/>
    <path d="M0 136 C60 132 140 138 190 136 C212 144 236 160 238 184 C240 208 212 230 170 238 C120 246 60 240 0 246 Z" fill="url(#${id}-lagoon)"/>
    <path d="${foam(() => 136, 0, 192, 12, 2.6)}" stroke="#fff" stroke-width="2" fill="none" opacity="0.85" stroke-linecap="round"/>
    <path d="M190 136 C212 144 236 160 238 184 C240 208 212 230 170 238 C120 246 60 240 0 246" stroke="#c6efe4" stroke-width="5" fill="none" opacity="0.9"/>
    <path d="M190 136 C212 144 236 160 238 184 C240 208 212 230 170 238 C120 246 60 240 0 246" stroke="#fff" stroke-width="1.4" fill="none" opacity="0.8" transform="translate(-3 -2)"/>
    ${ripples([
      [40, 170, 14],
      [120, 160, 12],
      [176, 196, 12],
      [70, 222, 12],
    ])}
    ${shell(206, 272, '#f6c9d0')}${shell(330, 296, '#fbe3c8')}${shell(130, 262)}
    ${[
      [262, 146],
      [20, 286],
      [282, 190],
    ]
      .map(([x, y]) => tuft(x, y, '#8cb86a'))
      .join('')}`,
  stages: {
    1: [
      { base: 196, svg: `${palm(322, 196, 92, -24)}${palm(348, 182, 64, -6, '#57a058', '#78bc68')}` },
      { base: 150, svg: `<g fill="#79b36a" ${ol(0.7)}><ellipse cx="262" cy="142" rx="12" ry="7"/><ellipse cx="276" cy="146" rx="9" ry="6"/></g><g fill="#93c97f"><ellipse cx="260" cy="139" rx="6" ry="3"/></g>` },
    ],
    2: [
      {
        base: 178,
        svg: `
        <g stroke="#8a6a4f" stroke-width="2.6" stroke-linecap="round"><path d="M36 178 V150 M92 178 V150 M52 182 V152 M76 182 V152"/></g>
        <g class="sp-water" stroke="#fff" stroke-width="1.1" fill="none" opacity="0.85"><path d="M30 179 q6 1.4 12 0 M86 179 q6 1.4 12 0 M46 183 q6 1.4 12 0"/></g>
        <rect x="26" y="146" width="78" height="6" rx="1.4" fill="#c99a6c" ${ol(0.9)}/>
        <rect x="38" y="118" width="54" height="29" fill="#e9cf9e" ${ol(0.9)}/>
        <path d="M44 118 V147 M86 118 V147" stroke="#c9a66e" stroke-width="1.6"/>
        <path d="M56 147 V130 Q65 124 74 130 V147 Z" fill="#8a5a3a"/>
        <path d="M24 122 L65 88 L106 122 Q65 128 24 122 Z" fill="#d8b46a" ${ol(1)}/>
        <path d="M24 122 q6 4 10 0 q6 4 10 0 q6 4 10 0 q6 4 10 0 q6 4 10 0 q6 4 10 0 q6 4 10 0 q6 4 10 0" stroke="#c49a52" stroke-width="1.2" fill="none"/>
        <path d="M36 114 L65 92 L94 114" stroke="#e8cc8a" stroke-width="1.4" fill="none"/>
        <path d="M104 150 L122 150" stroke="#c99a6c" stroke-width="3"/>`,
      },
    ],
    3: [
      {
        base: 140,
        svg: `
        <path d="M250 70 C248 90 247 110 246 132 L260 132 C259 110 259 90 260 72 Z" fill="#cfeef0"/>
        <g class="sp-water" stroke="#fff" stroke-width="1.4" stroke-linecap="round" fill="none" opacity="0.9"><path d="M252 78 C251 96 250 114 250 128"/><path d="M257 80 C256 98 256 116 256 130"/></g>
        <path d="M242 134 C236 140 228 144 220 150 L232 152 C240 146 250 140 262 136 Z" fill="#a6e6dc"/>
        <ellipse cx="253" cy="134" rx="13" ry="3.4" fill="#fff" opacity="0.85"/>
        <g fill="#6aa96a"><circle cx="246" cy="72" r="6"/><circle cx="264" cy="70" r="5"/></g>`,
      },
      {
        base: 298,
        svg: `
        ${shade(16, 298, 20, 3)}
        <path d="M14 298 C16 280 14 262 18 246" stroke="#7a9a5a" stroke-width="3" fill="none"/>
        <path d="M18 250 C4 238 -6 236 -14 238 C-4 250 6 256 18 254 Z M18 250 C30 230 44 224 54 226 C48 242 34 252 18 252 Z M17 262 C30 254 42 254 50 258 C42 268 28 270 17 266 Z" fill="#5fa65a" ${ol(0.8)}/>
        <path d="M18 250 L-6 240 M18 250 L48 228 M17 263 L44 258" stroke="#8cc87a" stroke-width="1" fill="none"/>`,
      },
    ],
    4: [
      ...scatter([
        [270, 182, hibiscus(270, 178)],
        [356, 216, hibiscus(354, 212, '#f49a62')],
        [266, 298, hibiscus(266, 292)],
        [148, 296, hibiscus(148, 290, '#f49a62')],
        [36, 262, hibiscus(36, 256)],
        [300, 238, starfish(300, 236, '#f2a65a', 3.6)],
        [116, 270, starfish(116, 268, '#e98a7a', 3.2)],
      ]),
      {
        base: 12,
        svg: birdFlock(
          [
            [130, 60],
            [146, 52],
            [160, 64],
          ],
          '#5d7480',
        ),
      },
      {
        base: 214,
        svg: `${shade(292, 214, 28, 2.6)}<path d="M266 208 C272 215 312 215 320 208 L316 203 L270 203 Z" fill="#c9805a" ${ol(0.9)}/><path d="M274 203 C282 205 304 205 312 203" stroke="#e8a77e" stroke-width="1.4" fill="none"/><path d="M270 203 L276 196 L308 196 L316 203" stroke="#8a6a4f" stroke-width="1.2" fill="none"/><path d="M284 212 L304 194" stroke="#b48a5e" stroke-width="2" stroke-linecap="round"/><ellipse cx="305" cy="193" rx="2.4" ry="4" fill="#b48a5e" transform="rotate(40 305 193)"/>`,
      },
    ],
  },
  sign: [232, 296],
  evening: [
    [40, 60],
    [130, 40],
    [220, 30],
    [300, 200],
    [190, 270],
    [80, 270],
  ],
};

// ------------------------------------------------------------------ grassland

const cloud = (x: number, y: number, s: number) =>
  `<g fill="#fff"><ellipse cx="${x}" cy="${y + 8 * s}" rx="${n(34 * s)}" ry="${n(8 * s)}"/><circle cx="${n(x - 16 * s)}" cy="${n(y + 2 * s)}" r="${n(11 * s)}"/><circle cx="${n(x + 2 * s)}" cy="${n(y - 6 * s)}" r="${n(15 * s)}"/><circle cx="${n(x + 20 * s)}" cy="${n(y + 2 * s)}" r="${n(11 * s)}"/></g><ellipse cx="${x}" cy="${n(y + 12 * s)}" rx="${n(30 * s)}" ry="${n(3 * s)}" fill="#e3eef4" opacity="0.8"/>`;

/** A clump of tall prairie grass, some blades carrying seed heads. */
const tallGrass = (x: number, y: number, h: number, c = '#a2b45e', c2 = '#c9c27a') =>
  `<g stroke-linecap="round" fill="none">${[-6, -3, 0, 3, 6, 8]
    .map((d, i) => {
      const ex = n(x + d * 1.6 + (i % 2 ? 3 : -2));
      const ey = n(y - h * (0.8 + (i % 3) * 0.12));
      const blade = `<path d="M${n(x + d * 0.6)} ${y} Q${n(x + d * 0.9)} ${n(y - h * 0.6)} ${ex} ${ey}" stroke="${i % 2 ? c : c2}" stroke-width="1.4"/>`;
      return i % 3 === 1 ? `${blade}<ellipse cx="${ex}" cy="${n(ey - 2.4)}" rx="1.3" ry="3" fill="#d9c27a" stroke="none" transform="rotate(${d * 2} ${ex} ${n(ey - 2.4)})"/>` : blade;
    })
    .join('')}</g>`;

/** A patch of meadow flowers: little dots of color around (x, y). */
const meadow = (x: number, y: number, w: number, colors: readonly string[], k = 11) =>
  `<g>${Array.from({ length: k }, (_, i) => {
    const px = n(x + (((i * 37) % 17) / 16 - 0.5) * w);
    const py = n(y - ((i * 23) % 7) * 1.3);
    return `<path d="M${px} ${py} v3.6" stroke="#8aa25a" stroke-width="0.8"/><circle cx="${px}" cy="${py}" r="2.1" fill="${colors[i % colors.length]}"/>`;
  }).join('')}</g>`;

const GRASSLAND: RegionArt = {
  sky: (id) => `
    <defs>
      <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#9fcdee"/><stop offset="0.66" stop-color="#d3e9f3"/><stop offset="1" stop-color="#eef5eb"/></linearGradient>
      <linearGradient id="${id}-grass" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d0dc9a"/><stop offset="1" stop-color="#afc479"/></linearGradient>
    </defs>
    <rect width="360" height="300" fill="url(#${id}-sky)"/>
    <circle cx="322" cy="40" r="26" fill="#fffbe0" opacity="0.5"/><circle cx="322" cy="40" r="15" fill="#fff0b4"/>
    ${cloud(84, 44, 1.2)}${cloud(232, 70, 0.8)}${cloud(176, 24, 0.5)}`,
  land: (id) => `
    <path d="M0 140 C60 126 120 130 180 136 C240 128 300 126 360 134 V156 H0Z" fill="#c2d4b2"/>
    <path d="M0 150 C70 138 140 140 200 150 C250 142 300 128 360 136 V176 H0Z" fill="#c8d898"/>
    <path d="M200 150 C250 142 300 128 360 136 V146 C320 140 270 146 230 154 Z" fill="#d9e2a6"/>
    <path d="M0 158 C80 150 180 160 260 154 C300 150 330 154 360 152 V300 H0Z" fill="url(#${id}-grass)"/>
    <g stroke="#e3d891" stroke-width="12" opacity="0.5" fill="none"><path d="M0 196 C120 186 240 194 360 184"/><path d="M0 248 C120 238 250 246 360 236"/></g>
    <g stroke="#bccd84" stroke-width="8" opacity="0.4" fill="none"><path d="M0 222 C120 214 240 220 360 212"/><path d="M0 284 C120 276 250 282 360 274"/></g>
    <g stroke="#b9c477" stroke-width="1" fill="none" opacity="0.7" stroke-linecap="round">${[
      [40, 168],
      [110, 176],
      [180, 172],
      [250, 170],
      [320, 166],
      [70, 204],
      [200, 206],
      [290, 200],
    ]
      .map(([x, y]) => `<path d="M${x} ${y} q3 -5 8 -6 M${x + 6} ${y + 1} q3 -5 8 -6 M${x + 12} ${y} q3 -5 8 -6"/>`)
      .join('')}</g>
    ${tallGrass(8, 300, 40)}${tallGrass(22, 298, 32)}${tallGrass(36, 300, 24)}${tallGrass(352, 300, 38)}${tallGrass(338, 298, 28)}${tallGrass(346, 232, 24)}${tallGrass(132, 172, 16)}${tallGrass(204, 168, 14)}${tallGrass(124, 236, 22)}${tallGrass(60, 186, 18)}${tallGrass(230, 214, 18)}
    ${[
      [60, 176, '#b49ae0'],
      [240, 172, '#f6d27a'],
      [300, 240, '#b49ae0'],
      [214, 300, '#f6d27a'],
      [150, 196, '#f6d27a'],
      [280, 186, '#b49ae0'],
    ]
      .map(([x, y, c]) => wildflower(x as number, y as number, c as string))
      .join('')}`,
  stages: {
    1: [
      {
        base: 160,
        svg: `
        ${shade(290, 160, 30, 4)}
        <path d="M284 160 C287 146 286 132 288 118 L295 118 C295 132 296 146 299 160 Z" fill="#8a6a4f" ${ol(0.9)}/>
        <path d="M289 128 C282 120 274 116 266 114 M294 124 C302 116 310 112 318 110" stroke="#8a6a4f" stroke-width="3" stroke-linecap="round" fill="none"/>
        <g fill="#7fae62"><circle cx="268" cy="104" r="17"/><circle cx="292" cy="88" r="22"/><circle cx="316" cy="102" r="17"/><circle cx="292" cy="112" r="14"/><circle cx="254" cy="114" r="9"/><circle cx="330" cy="114" r="9"/></g>
        <g fill="#97c27a"><circle cx="284" cy="80" r="10"/><circle cx="306" cy="94" r="7"/><circle cx="264" cy="98" r="7"/></g>
        ${tallGrass(274, 162, 14)}${tallGrass(306, 162, 12)}`,
      },
    ],
    2: [
      {
        base: 196,
        svg: `
        ${shade(64, 196, 22, 3)}
        <g stroke="#9a7352" stroke-width="2.4" stroke-linecap="round"><path d="M48 196 L60 108 M80 196 L68 108"/></g>
        <g stroke="#b58a5e" stroke-width="1.2"><path d="M51 176 L77 160 M77 176 L51 160 M54 152 L74 138 M74 152 L54 138 M57 130 L71 118 M71 130 L57 118"/></g>
        <rect x="56" y="106" width="16" height="4" rx="1" fill="#8a6a4f"/>
        <path d="M66 100 L92 96 L92 106 L66 104 Z" fill="#e9e4da" ${ol(0.8)}/><path d="M86 96 L96 92 L96 110 L86 106 Z" fill="#d9533f" ${ol(0.8)}/>
        <g class="sp-blades">${Array.from({ length: 12 }, (_, k) => `<path d="M64 100 L62 81 Q64 79 66 81 Z" fill="${k % 2 ? '#e9e4da' : '#d9533f'}" ${ol(0.6)} transform="rotate(${k * 30} 64 100)"/>`).join('')}<circle cx="64" cy="100" r="3.4" fill="#8b8f94" ${ol(0.6)}/></g>
        <g><rect x="84" y="182" width="26" height="12" rx="3" fill="#9aa3a8" ${ol(0.8)}/><ellipse cx="97" cy="183" rx="12" ry="2" fill="#a7d3e4"/></g>`,
      },
    ],
    3: [
      {
        base: 214,
        svg: `
        <ellipse cx="166" cy="204" rx="54" ry="13" fill="#a3bf74"/>
        <ellipse cx="166" cy="203" rx="46" ry="9.6" fill="#9fd0de"/>
        <path d="M130 200 C146 196 186 196 202 200" stroke="#c4e6ee" stroke-width="2" fill="none" stroke-linecap="round"/>
        ${ripples([
          [144, 206, 12],
          [180, 208, 12],
        ])}
        ${[120, 125, 210, 215].map((x, i) => `<path d="M${x} ${206 - (i % 2) * 2} V${188 - (i % 2) * 4}" stroke="#7d9a5a" stroke-width="1.4"/><rect x="${x - 1.6}" y="${186 - (i % 2) * 4}" width="3.2" height="8" rx="1.6" fill="#8a5a3a"/>`).join('')}`,
      },
      { base: 180, svg: `${roundTree(226, 180, 1.1, '#8fb86a', '#a6c983')}${roundTree(244, 176, 0.8, '#86b064', '#9fc47e')}` },
    ],
    4: [
      {
        base: -6,
        svg: `<g class="sp-kite"><path d="M160 74 C150 90 156 104 144 116 C136 124 140 136 130 146" stroke="#8a6a4f" stroke-width="0.7" fill="none" stroke-dasharray="2 2"/><path d="M160 50 L174 64 L160 82 L148 64 Z" fill="#ef8a6a" ${ol(0.9)}/><path d="M160 50 L160 82 M148 64 L174 64" stroke="#fbe3c8" stroke-width="1"/><g fill="#f6d27a"><path d="M158 88 l3 3 l-3 3 l-3 -3z"/><path d="M154 98 l3 3 l-3 3 l-3 -3z"/></g><path d="M160 82 C158 88 156 94 154 104" stroke="#8a6a4f" stroke-width="0.7" fill="none"/></g>`,
      },
      ...scatter([
        [36, 234, meadow(36, 234, 34, ['#b49ae0', '#f6d27a', '#fff'])],
        [138, 234, meadow(138, 234, 28, ['#e98aa6', '#b49ae0', '#f6d27a'])],
        [214, 232, meadow(214, 232, 26, ['#f6d27a', '#fff', '#b49ae0'])],
        [276, 300, meadow(276, 300, 34, ['#b49ae0', '#e98aa6', '#f6d27a'])],
        [100, 298, meadow(100, 298, 30, ['#f6d27a', '#b49ae0', '#fff'])],
        [350, 268, meadow(348, 268, 20, ['#f6d27a', '#e98aa6'], 6)],
        [12, 268, wildflower(12, 268, '#e98aa6')],
        [234, 296, wildflower(234, 296, '#f6d27a')],
        [262, 186, meadow(262, 186, 30, ['#b49ae0', '#f6d27a'], 7)],
        [18, 212, meadow(18, 212, 26, ['#f6d27a', '#e98aa6'], 7)],
      ]),
      {
        base: 236,
        svg: butterflies(
          [
            [124, 214],
            [300, 214],
          ],
          '#f2a65a',
        ),
      },
      {
        base: 12,
        svg: birdFlock([
          [250, 40],
          [266, 32],
          [280, 44],
        ]),
      },
    ],
  },
  sign: [22, 294],
  evening: [
    [40, 180],
    [130, 160],
    [210, 230],
    [300, 200],
    [340, 270],
    [100, 260],
  ],
};

// ------------------------------------------------------------------ exports

export const LANDSCAPE_ART: Record<NewBiome, RegionArt> = {
  bamboo: BAMBOO,
  mountain: MOUNTAIN,
  desert: DESERT,
  woodland: WOODLAND,
  wetland: WETLAND,
  coast: COAST,
  island: ISLAND,
  grassland: GRASSLAND,
};

const spot = (x: number, y: number, H: number, mood: Spot['mood']): Spot => ({ x, y, H, mood });

/** Where a place's animals stand, by arrival slot (0–3), and where swimmers (fish, whales, rays, jellies, octopuses) float. */
export const LANDSCAPE_SPOTS: Record<NewBiome, { ground: readonly [Spot, Spot, Spot, Spot]; water: readonly Spot[] }> = {
  bamboo: { ground: [spot(114, 254, 34, 'happy'), spot(250, 262, 34, 'idle'), spot(178, 288, 32, 'happy'), spot(318, 280, 30, 'sleepy')], water: [] },
  mountain: { ground: [spot(88, 250, 34, 'happy'), spot(236, 260, 34, 'idle'), spot(160, 288, 32, 'happy'), spot(304, 280, 30, 'sleepy')], water: [] },
  desert: { ground: [spot(96, 258, 34, 'happy'), spot(236, 264, 34, 'idle'), spot(170, 290, 32, 'happy'), spot(298, 282, 30, 'sleepy')], water: [spot(200, 202, 24, 'happy')] },
  woodland: { ground: [spot(92, 256, 34, 'happy'), spot(244, 262, 34, 'idle'), spot(170, 288, 32, 'happy'), spot(312, 280, 30, 'sleepy')], water: [] },
  wetland: {
    ground: [spot(66, 236, 34, 'happy'), spot(110, 286, 32, 'idle'), spot(200, 290, 32, 'happy'), spot(300, 292, 30, 'sleepy')],
    water: [spot(222, 216, 32, 'happy'), spot(306, 234, 32, 'idle'), spot(160, 228, 30, 'happy')],
  },
  coast: {
    ground: [spot(66, 264, 34, 'happy'), spot(206, 266, 34, 'idle'), spot(140, 290, 32, 'happy'), spot(312, 286, 30, 'sleepy')],
    water: [spot(222, 166, 30, 'happy'), spot(312, 184, 30, 'idle'), spot(150, 156, 28, 'happy')],
  },
  island: {
    ground: [spot(244, 238, 34, 'happy'), spot(170, 280, 34, 'idle'), spot(80, 290, 32, 'happy'), spot(320, 282, 30, 'sleepy')],
    water: [spot(150, 200, 32, 'happy'), spot(80, 222, 30, 'idle'), spot(196, 172, 28, 'happy')],
  },
  grassland: { ground: [spot(92, 256, 34, 'happy'), spot(244, 262, 34, 'idle'), spot(168, 288, 32, 'happy'), spot(306, 280, 30, 'sleepy')], water: [] },
};
