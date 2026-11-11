/**
 * The drawn Farm's things, made finer (D47 PR 2), where they always stood: sunflowers with pointed petals in two
 * rings round a seed spiral; apple trees with a branching trunk and foliage in layers; a round bale rolled in a
 * spiral, square bales tied with twine; boards, shingles and stones on the barn and the hen house; posts with grain and
 * caps; the pond's bank of stones and its lily pads; pebbles along the path. Light, like the meadow: a few merged
 * paths per thing. Colours are the 3D walk's (`farmProps.ts`), so the two Farms match.
 */

import { place } from './botany';
import { OUT, SHADOW } from './sceneKit';

const n = (v: number) => String(Math.round(v * 10) / 10);
const R = (deg: number): [number, number, number, number, number, number] => {
  const a = (deg * Math.PI) / 180;
  return [Math.cos(a), Math.sin(a), -Math.sin(a), Math.cos(a), 0, 0];
};
const T = (x: number, y: number, s = 1, sy = s): [number, number, number, number, number, number] => [s, 0, 0, sy, x, y];
const mul = (p: number[], q: number[]): [number, number, number, number, number, number] => [
  p[0] * q[0] + p[2] * q[1],
  p[1] * q[0] + p[3] * q[1],
  p[0] * q[2] + p[2] * q[3],
  p[1] * q[2] + p[3] * q[3],
  p[0] * q[4] + p[2] * q[5] + p[4],
  p[1] * q[4] + p[3] * q[5] + p[5],
];
const dot = (x: number, y: number, r: number) => `M${n(x - r)} ${n(y)}a${n(r)} ${n(r)} 0 1 0 ${n(r * 2)} 0a${n(r)} ${n(r)} 0 1 0 ${n(-r * 2)} 0Z`;

/** A pointed petal from the origin, pointing up (-y), `len` long. */
const PETAL = (len: number, w: number) => `M0 0Q${w} ${-len * 0.45} 0 ${-len}Q${-w} ${-len * 0.45} 0 0Z`;

/**
 * A sunflower `h` tall at (x, y): a stem that bends a little, two broad leaves with a midrib, a ring of darker petals
 * behind a ring of golden ones, and a seed head of spiralling florets.
 */
export function sunflower(x: number, y: number, h = 30, turn = 0): string {
  const bend = ((x * 7) % 5) - 2.5;
  const tx = x + bend;
  const ty = y - h;
  const head = T(tx, ty, 1, 0.92);
  const ring = (k: number, len: number, w: number, off: number) =>
    Array.from({ length: k }, (_, i) => place(PETAL(len, w), mul(head, mul(R((i / k) * 360 + off + turn), T(0, -3.2))))).join('');
  const leaf = (t: number, side: number) => {
    const lx = x + bend * t * t;
    const ly = y - h * t;
    return `M${n(lx)} ${n(ly)}c${n(side * 3)} ${-4} ${n(side * 9)} ${-4} ${n(side * 11)} ${1}c${n(-side * 3)} ${3} ${n(-side * 8)} ${3} ${n(-side * 11)} ${-1}Z`;
  };
  const rib = (t: number, side: number) => {
    const lx = x + bend * t * t;
    const ly = y - h * t;
    return `M${n(lx)} ${n(ly)}q${n(side * 5)} -2 ${n(side * 10)} 0.6`;
  };
  // The florets: golden-angle spiral dots on the dark disc.
  let seeds = '';
  for (let i = 3; i < 40; i++) {
    const rr = 0.55 * Math.sqrt(i);
    const a = i * 2.39996;
    seeds += dot(tx + Math.cos(a) * rr, ty + Math.sin(a) * rr * 0.92, 0.32);
  }
  return `<g><ellipse cx="${n(x)}" cy="${n(y + 0.4)}" rx="5" ry="1.2" fill="${SHADOW}"/><path d="M${n(x)} ${n(y)}Q${n(x + bend * 0.2)} ${n(y - h * 0.55)} ${n(tx)} ${n(ty)}" stroke="#6f8a4e" stroke-width="1.9" fill="none"/><path d="${leaf(0.38, -1)}${leaf(0.6, 1)}" fill="#6a9a48"/><path d="${rib(0.38, -1)}${rib(0.6, 1)}" stroke="#4f7a38" stroke-width="0.5" fill="none"/><path d="${ring(13, 6.6, 1.9, 14)}" fill="#e2a41c"/><path d="${ring(13, 7.2, 2, 0)}" fill="#f6c430"/><path d="${dot(tx, ty, 4)}" fill="#5a3418"/><path d="${seeds}" fill="#8a5a2a"/></g>`;
}

/**
 * An apple tree at (x, y), scale `s`: its shadow, a trunk flaring at the root and splitting into branches, foliage in
 * three layers (shade at the back, sunlit at the front, a few highlights), and apples with a glint.
 */
export function appleTree(x: number, y: number, s = 1): string {
  const P = (dx: number, dy: number) => `${n(x + dx * s)} ${n(y + dy * s)}`;
  const trunk = `M${P(-2.4, 0)}C${P(-1.4, -4)} ${P(-1.6, -8)} ${P(-1.2, -12)}L${P(-6, -17)}L${P(-4.6, -18)}L${P(-0.4, -14)}L${P(0.6, -20)}L${P(2, -20)}L${P(1.4, -13)}L${P(5.6, -17.5)}L${P(6.6, -16.4)}L${P(1.4, -11)}C${P(1.6, -7)} ${P(1.4, -3)} ${P(2.6, 0)}Z`;
  const blob = (pts: Array<[number, number, number]>) => pts.map(([dx, dy, r]) => dot(x + dx * s, y + dy * s, r * s)).join('');
  const back = blob([
    [-8, -20, 6.5],
    [7.5, -20, 6.5],
    [0, -27, 7.5],
    [-4, -25, 6],
    [5, -26, 6],
  ]);
  const mid = blob([
    [-5.5, -19, 6],
    [5.5, -19.5, 6],
    [0, -23, 7],
  ]);
  const front = blob([
    [-3, -18, 4.6],
    [3.4, -18.5, 4.4],
    [0, -26.5, 4.6],
  ]);
  const lights = blob([
    [-4, -24, 2.2],
    [2.6, -29, 2],
    [5.5, -22, 1.6],
  ]);
  const apples: Array<[number, number]> = [
    [-5, -16],
    [4, -22],
    [7, -15],
    [-1, -21],
    [-7.5, -22],
  ];
  return `<g><ellipse cx="${n(x)}" cy="${n(y + 0.5)}" rx="${n(11 * s)}" ry="${n(2.2 * s)}" fill="${SHADOW}"/><path d="${trunk}" fill="#7e5c40"/><path d="M${P(0.4, -1)}C${P(0.8, -5)} ${P(0.6, -9)} ${P(1, -12)}" stroke="#5e4330" stroke-width="${n(0.7 * s)}" fill="none"/><path d="${back}" fill="#5f9a45"/><path d="${mid}" fill="#72ae52"/><path d="${front}" fill="#86bd62"/><path d="${lights}" fill="#a2d27c" opacity="0.8"/><path d="${apples.map(([dx, dy]) => dot(x + dx * s, y + dy * s, 1.5 * s)).join('')}" fill="#d8342c"/><path d="${apples.map(([dx, dy]) => dot(x + (dx - 0.5) * s, y + (dy - 0.5) * s, 0.5 * s)).join('')}" fill="#ffd9b8" opacity="0.85"/></g>`;
}

/** The Farm's round bale at (cx, cy): rolled straw in a spiral, strands, loose straw at its foot. */
export function roundBale(cx: number, cy: number): string {
  let spiral = `M${cx} ${cy}`;
  for (let a = 0.3; a < Math.PI * 7; a += 0.35) {
    const r = a * 0.55;
    spiral += `L${n(cx + Math.cos(a) * r * 1.1)} ${n(cy + Math.sin(a) * r)}`;
  }
  const strands = [-9, -5, 4, 8, -2]
    .map((dx, i) => `M${n(cx + dx)} ${n(cy - 8 + (i % 3) * 5)}l${n(2 + (i % 2))} ${n(-1.2 + (i % 2) * 2)}`)
    .join('');
  return `<ellipse cx="${cx}" cy="${cy + 10}" rx="16" ry="3.2" fill="${SHADOW}"/><ellipse cx="${cx}" cy="${cy}" rx="13" ry="11" fill="#e8c76a" stroke="${OUT}" stroke-width="0.9"/><path d="${spiral}" stroke="#c99c44" stroke-width="0.9" fill="none" opacity="0.85"/><path d="${strands}" stroke="#fff3c4" stroke-width="0.7" fill="none"/><path d="M${cx - 12} ${cy + 10}l3 -2 1 2 2 -2.4 1.4 2.4M${cx + 6} ${cy + 10}l2 -2.2 1 2 2 -2.4" stroke="#d9b45a" stroke-width="0.8" fill="none"/>`;
}

/** Square bales stacked at the barn's side, tied with twine, straw showing. */
export function squareBales(): string {
  const bales: Array<[number, number, number, number]> = [
    [194, 174, 20, 14],
    [214, 174, 20, 14],
    [204, 161, 20, 13],
  ];
  const straw = bales
    .map(([x, y, w, h]) =>
      Array.from({ length: 5 }, (_, i) => `M${n(x + 2 + ((i * 7) % (w - 4)))} ${n(y + 2.5 + ((i * 5) % (h - 4)))}h${n(3 + (i % 3))}`).join(''),
    )
    .join('');
  const twine = bales.map(([x, y, w, h]) => `M${n(x + w * 0.28)} ${y}v${h}M${n(x + w * 0.72)} ${y}v${h}`).join('');
  return `<ellipse cx="214" cy="189" rx="22" ry="3" fill="${SHADOW}"/><g fill="#e8c76a" stroke="${OUT}" stroke-width="0.8">${bales.map(([x, y, w, h]) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2"/>`).join('')}</g><path d="${straw}" stroke="#c99c44" stroke-width="0.6" fill="none"/><path d="${twine}" stroke="#a07a48" stroke-width="0.9" fill="none"/>`;
}

/** Boards on the barn's front (seams between them), the shingled gable, a stone footing and shade on its far side. */
export function barnDetail(): string {
  const boards = Array.from({ length: 11 }, (_, i) => 242 + i * 8)
    .filter((x) => x < 264 || x > 308)
    .map((x) => `M${x} ${x < 286 ? 130 - (x - 240) * 0.6 + 6 : 130 - (332 - x) * 0.6 + 6}V181`)
    .join('');
  const shingles = [104, 110, 116, 122]
    .map((y) => {
      const half = (y - 100) * 1.75;
      return `M${n(286 - half)} ${y}H${n(286 + half)}`;
    })
    .join('');
  const footing = Array.from({ length: 9 }, (_, i) => dot(246 + i * 10.6, 180.5, 1.6)).join('');
  return `<path d="${boards}" stroke="#a83a2f" stroke-width="0.8" opacity="0.75"/><path d="${shingles}" stroke="#a83a2f" stroke-width="0.7" opacity="0.6"/><path d="M314 128 L332 128 V182 H314Z" fill="#000" opacity="0.08"/><path d="${footing}" fill="#b7b0a2" stroke="${OUT}" stroke-width="0.5"/><path d="M280 116h12v10h-12z" fill="#e8c76a" opacity="0.9"/>`;
}

/** Grain down each fence post, and a pointed cap. */
export function fenceDetail(posts: number[], y: (x: number) => number): string {
  const grain = posts.map((x) => `M${x - 0.6} ${n(y(x) - 24)}v22`).join('');
  const caps = posts.map((x) => `M${x - 2.3} ${n(y(x) - 25.6)}L${x} ${n(y(x) - 28.4)}L${x + 2.3} ${n(y(x) - 25.6)}Z`).join('');
  return `<path d="${grain}" stroke="#9a6e46" stroke-width="0.5" opacity="0.8"/><path d="${caps}" fill="#a77a50" stroke="${OUT}" stroke-width="0.6"/>`;
}

/** The pond's bank: damp earth and stones round the water, lily pads, one lily in flower. */
/** Under the water (the damp bank), and over it (stones, pads, the lily). */
export function pondBank(cx: number, cy: number, rx: number, ry: number): { under: string; over: string } {
  let stones = '';
  for (let i = 0; i < 22; i++) {
    const a = (i / 22) * Math.PI * 2 + ((i * 37) % 7) * 0.02;
    const r = 1.2 + ((i * 13) % 5) * 0.35;
    const sx = cx + Math.cos(a) * (rx + 1.5);
    const sy = cy + Math.sin(a) * (ry + 1);
    stones += `M${n(sx - r * 1.3)} ${n(sy)}a${n(r * 1.3)} ${n(r * 0.8)} 0 1 0 ${n(r * 2.6)} 0a${n(r * 1.3)} ${n(r * 0.8)} 0 1 0 ${n(-r * 2.6)} 0Z`;
  }
  const pad = (x: number, y: number, r: number, turn: number) => {
    const a0 = turn + 0.35;
    const a1 = turn - 0.35 + Math.PI * 2;
    return `M${n(x)} ${n(y)}L${n(x + Math.cos(a0) * r)} ${n(y + Math.sin(a0) * r * 0.5)}A${n(r)} ${n(r * 0.5)} 0 1 1 ${n(x + Math.cos(a1) * r)} ${n(y + Math.sin(a1) * r * 0.5)}Z`;
  };
  const pads = pad(cx + rx * 0.45, cy + ry * 0.2, 4, 0.4) + pad(cx + rx * 0.62, cy - ry * 0.25, 3, 2.2) + pad(cx - rx * 0.55, cy + ry * 0.3, 3.4, 4.2);
  const lx = cx + rx * 0.45;
  const ly = cy + ry * 0.2 - 1;
  const lily = [-50, -20, 20, 50, 0].map((a) => place(PETAL(2.6, 1), mul(T(lx, ly), R(a)))).join('');
  return {
    under: `<ellipse cx="${cx}" cy="${cy}" rx="${n(rx + 2.6)}" ry="${n(ry + 2)}" fill="#9a8460" opacity="0.55"/>`,
    over: `<path d="${stones}" fill="#b7b0a2" stroke="${OUT}" stroke-width="0.4"/><path d="${pads}" fill="#5c9a48"/><path d="${lily}" fill="#f6b6cf"/><path d="${dot(lx, ly - 0.6, 0.8)}" fill="#ffd84a"/>`,
  };
}

/** Pebbles along both edges of a path (its middle line as points). */
export function pathPebbles(path: Array<[number, number]>, width: (y: number) => number): string {
  let d = '';
  let k = 0;
  for (let i = 1; i < path.length; i++) {
    const [ax, ay] = path[i - 1];
    const [bx, by] = path[i];
    const len = Math.hypot(bx - ax, by - ay);
    const nx = -(by - ay) / len;
    const ny = (bx - ax) / len;
    for (let t = 0; t < 1; t += 5 / len) {
      k++;
      if (k % 3 === 0) continue;
      const x = ax + (bx - ax) * t;
      const y = ay + (by - ay) * t;
      const w = width(y) + 1 + (k % 4) * 0.6;
      const side = k % 2 ? 1 : -1;
      const r = 0.7 + ((k * 7) % 5) * 0.18;
      d += `M${n(x + nx * w * side - r * 1.4)} ${n(y + ny * w * side)}a${n(r * 1.4)} ${n(r)} 0 1 0 ${n(r * 2.8)} 0a${n(r * 1.4)} ${n(r)} 0 1 0 ${n(-r * 2.8)} 0Z`;
    }
  }
  return `<path d="${d}" fill="#c2b9a8" stroke="#9c927f" stroke-width="0.35"/>`;
}

/** Boards and shingles on the hen house. */
export function henHouseDetail(): string {
  const boards = [98, 104, 110, 116, 122].map((x) => `M${x} 203V225`).join('');
  return `<path d="${boards}" stroke="#d8b886" stroke-width="0.7"/><path d="M96 198 H120 M100 194 H116" stroke="#a83a2f" stroke-width="0.7" opacity="0.7"/>`;
}
