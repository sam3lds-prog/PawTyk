/**
 * The five hand-made homes, dressed up (D44 PR G): what each region scene adds on top of its stages.
 *
 *  - **Depth**: the sky and far features sit on layers the scene camera moves less (`data-depth` below 1), and a
 *    foreground layer at each bottom corner moves more, so a close-up or the tour has parallax.
 *  - **Light**: warm sunlight falls from each home's sun (cool on the ice); in the evening its windows, lanterns and
 *    the snow den glow.
 *  - **A landmark to tap**: the Farm's barn doors swing open and a chick peeks out; a bilby pops up from the Outback
 *    burrow, a rock hyrax over the Savanna lookout, an arctic fox kit from the snow den, a golden tamarin round the
 *    Rainforest tree.
 *  - **A party spot**: a string of lights (or lanterns) by where the animals gather, lit in the evening and whenever
 *    the home celebrates (the Welcome Parade, a group dance).
 *  - **Ambient life**: butterflies, swaying grass, drifting leaves and snow, a windmill on the Farm's hill, sunbeams
 *    in the Rainforest. Like everything in these scenes they move only when `AmbientDirector` plays them (D24).
 *
 * Everything here is original art drawn in code, in the scenes' 360×300 frame.
 */

import type { BaseRegionId } from '../../meta/catalogs/sanctuaries';
import { OUT, SHADOW } from './sceneKit';

export interface ExtraFeature {
  stage: 1 | 2 | 3 | 4;
  base: number;
  svg: (id: string) => string;
}

export interface Landmark {
  name: string;
  /** What the chat line says when it's tapped. */
  line: string;
  stage: 1 | 2 | 3 | 4;
  base: number;
  svg: (id: string, evening: boolean) => string;
}

export interface HomeScenery {
  /** Where the light comes from, and its colour. */
  sun: [number, number, string];
  features: ExtraFeature[];
  landmark: Landmark;
  /** The party spot's lights, from this stage. */
  party: ExtraFeature;
  /** Windows and lamps that glow in the evening: [x, y, radius, stage, soft (a halo only, no lamp)]. */
  lights: Array<[number, number, number, 1 | 2 | 3 | 4, boolean?]>;
  /** The foreground corners. */
  front: string;
}

// ------------------------------------------------------------------ small pieces

const butterfly = (x: number, y: number, c: string, c2 = '#fff') =>
  `<g class="sp-birds"><path d="M${x} ${y} c-4 -5 -8 -3 -6 1 c1 2 4 2 6 -1z" fill="${c}"/><path d="M${x} ${y} c4 -5 8 -3 6 1 c-1 2 -4 2 -6 -1z" fill="${c}"/><path d="M${x} ${y} c-3 2 -4 5 -1 5 c1 0 1 -2 1 -5z M${x} ${y} c3 2 4 5 1 5 c-1 0 -1 -2 -1 -5z" fill="${c}" opacity="0.8"/><circle cx="${x - 3.4}" cy="${y - 1.6}" r="0.8" fill="${c2}"/><circle cx="${x + 3.4}" cy="${y - 1.6}" r="0.8" fill="${c2}"/><path d="M${x} ${y - 1} v3" stroke="#3d3229" stroke-width="0.8" stroke-linecap="round"/></g>`;

/** A tuft that sways from its root. */
const grass = (x: number, y: number, c: string, h = 1) =>
  `<g class="sp-grass" stroke="${c}" stroke-width="1.5" stroke-linecap="round" fill="none"><path d="M${x} ${y} q-3 ${-6 * h} -7 ${-9 * h} M${x} ${y} q0 ${-7 * h} -2 ${-12 * h} M${x} ${y} q1 ${-7 * h} 3 ${-12 * h} M${x} ${y} q4 ${-5 * h} 8 ${-8 * h}"/></g>`;

/** Leaves (or petals, or snow) that drift down a little way. */
const drift = (pts: Array<[number, number]>, c: string, shape: 'leaf' | 'dot' = 'leaf') =>
  `<g class="sp-petals" pointer-events="none">${pts
    .map(([x, y], i) => (shape === 'dot' ? `<circle cx="${x}" cy="${y}" r="${1.2 + (i % 2) * 0.5}" fill="${c}" opacity="0.9"/>` : `<ellipse cx="${x}" cy="${y}" rx="2.6" ry="1.3" transform="rotate(${(i * 47) % 180} ${x} ${y})" fill="${c}" opacity="0.9"/>`))
    .join('')}</g>`;

/** A string of lights along a sagging curve (negative `sag` arches it up). */
function festoon(x1: number, y1: number, x2: number, y2: number, sag: number, n: number, kind: 'bulb' | 'lantern' | 'ice' = 'bulb'): string {
  const cx = (x1 + x2) / 2;
  const cy = (y1 + y2) / 2 + sag * 2;
  const at = (t: number): [number, number] => [(1 - t) ** 2 * x1 + 2 * (1 - t) * t * cx + t ** 2 * x2, (1 - t) ** 2 * y1 + 2 * (1 - t) * t * cy + t ** 2 * y2];
  const cols = kind === 'ice' ? ['#d9f1ff', '#bfe6ff', '#e8f7ff'] : ['#f6c430', '#f4a6c4', '#9fd3e0', '#ffe08a', '#b8e08a'];
  const bulbs = Array.from({ length: n }, (_, i) => {
    const [x, y] = at((i + 0.5) / n);
    const c = cols[i % cols.length];
    const body =
      kind === 'lantern'
        ? `<path d="M${x} ${y} v2" stroke="#5b4a3a" stroke-width="0.6"/><rect x="${x - 2.2}" y="${y + 2}" width="4.4" height="5.4" rx="1.6" fill="${c}" stroke="${OUT}" stroke-width="0.5"/>`
        : `<circle cx="${x}" cy="${y + 1.8}" r="1.7" fill="${c}" stroke="${OUT}" stroke-width="0.4"/>`;
    return `<g class="sp-bulb"><circle class="sp-bulb-halo" opacity="0" cx="${x}" cy="${y + (kind === 'lantern' ? 4.6 : 1.8)}" r="${kind === 'lantern' ? 7 : 5}" fill="${c}"/>${body}</g>`;
  }).join('');
  return `<g class="sp-festoon"><path d="M${x1} ${y1} Q${cx} ${cy} ${x2} ${y2}" stroke="#5b4a3a" stroke-width="0.8" fill="none"/>${bulbs}</g>`;
}

const post = (x: number, top: number, bottom: number) =>
  `<ellipse cx="${x}" cy="${bottom}" rx="4" ry="1.2" fill="${SHADOW}"/><path d="M${x} ${bottom} V${top}" stroke="#8a6a4f" stroke-width="2.4" stroke-linecap="round"/>`;

/** A landmark's group: tappable, with a clip the peeking critter rises (or slides) out of. */
const landmark = (name: string, label: string, inner: string) => `<g class="sp-landmark" data-landmark="${name}" data-name="${label}">${inner}</g>`;
// Hidden by its own transform (so a scene shown without the screen's styles, a world-map card, keeps it hidden too).
const peek = (clip: string, dx: number, dy: number, critter: string) =>
  `<g clip-path="url(#${clip})"><g class="sp-peek" transform="translate(${dx} ${dy})" style="--px:${dx}px;--py:${dy}px">${critter}</g></g>`;

// ------------------------------------------------------------------ the critters who peek

const chick = (x: number, y: number) =>
  `<ellipse cx="${x}" cy="${y + 4}" rx="7" ry="6" fill="#f6d65a" stroke="${OUT}" stroke-width="0.6"/><circle cx="${x}" cy="${y - 4}" r="5.4" fill="#f9df6e" stroke="${OUT}" stroke-width="0.6"/><path d="M${x - 1.6} ${y - 9} q1.6 -3 3.2 0" fill="#e2483e"/><circle cx="${x - 2}" cy="${y - 4.6}" r="0.9" fill="#2f2a27"/><circle cx="${x + 2}" cy="${y - 4.6}" r="0.9" fill="#2f2a27"/><path d="M${x - 1.4} ${y - 2.6} L${x + 1.4} ${y - 2.6} L${x} ${y - 0.6} Z" fill="#f2a23a"/><ellipse cx="${x - 3.6}" cy="${y - 2.8}" rx="1.1" ry="0.7" fill="#f6a0a0" opacity="0.7"/><ellipse cx="${x + 3.6}" cy="${y - 2.8}" rx="1.1" ry="0.7" fill="#f6a0a0" opacity="0.7"/>`;

const bilby = (x: number, y: number) =>
  `<g transform="rotate(-14 ${x - 4} ${y - 8})"><ellipse cx="${x - 4}" cy="${y - 9}" rx="2.6" ry="7.4" fill="#a7a3a6" stroke="${OUT}" stroke-width="0.5"/><ellipse cx="${x - 4}" cy="${y - 9}" rx="1.3" ry="5.6" fill="#f2c2c6"/></g><g transform="rotate(14 ${x + 4} ${y - 8})"><ellipse cx="${x + 4}" cy="${y - 9}" rx="2.6" ry="7.4" fill="#a7a3a6" stroke="${OUT}" stroke-width="0.5"/><ellipse cx="${x + 4}" cy="${y - 9}" rx="1.3" ry="5.6" fill="#f2c2c6"/></g><ellipse cx="${x}" cy="${y}" rx="6.4" ry="5.6" fill="#b9b5b8" stroke="${OUT}" stroke-width="0.6"/><path d="M${x - 3} ${y + 1} Q${x} ${y + 9} ${x + 3} ${y + 1} Z" fill="#cfcbce"/><circle cx="${x}" cy="${y + 6.4}" r="1.3" fill="#e58a9a"/><circle cx="${x - 2.4}" cy="${y - 1}" r="1" fill="#2f2a27"/><circle cx="${x + 2.4}" cy="${y - 1}" r="1" fill="#2f2a27"/>`;

const hyrax = (x: number, y: number) =>
  `<circle cx="${x - 5.4}" cy="${y - 4.6}" r="2.2" fill="#8a6a50" stroke="${OUT}" stroke-width="0.5"/><circle cx="${x + 5.4}" cy="${y - 4.6}" r="2.2" fill="#8a6a50" stroke="${OUT}" stroke-width="0.5"/><ellipse cx="${x}" cy="${y}" rx="7.4" ry="6.4" fill="#9c7a5c" stroke="${OUT}" stroke-width="0.6"/><ellipse cx="${x}" cy="${y + 2.6}" rx="3.6" ry="2.6" fill="#c4a283"/><ellipse cx="${x}" cy="${y + 1.6}" rx="1.4" ry="1" fill="#3d3229"/><circle cx="${x - 2.8}" cy="${y - 1.4}" r="1" fill="#2f2a27"/><circle cx="${x + 2.8}" cy="${y - 1.4}" r="1" fill="#2f2a27"/>`;

const foxKit = (x: number, y: number) =>
  `<path d="M${x - 7} ${y - 2} L${x - 6} ${y - 11} L${x - 1.6} ${y - 5} Z M${x + 7} ${y - 2} L${x + 6} ${y - 11} L${x + 1.6} ${y - 5} Z" fill="#f7fbff" stroke="#c3d4e4" stroke-width="0.7"/><path d="M${x - 5.6} ${y - 4} L${x - 5.4} ${y - 8.6} L${x - 3} ${y - 5.4} Z M${x + 5.6} ${y - 4} L${x + 5.4} ${y - 8.6} L${x + 3} ${y - 5.4} Z" fill="#dfe8f2"/><ellipse cx="${x}" cy="${y}" rx="7.6" ry="6.4" fill="#fbfdff" stroke="#c3d4e4" stroke-width="0.7"/><circle cx="${x}" cy="${y + 2.8}" r="1.2" fill="#2f3a46"/><circle cx="${x - 2.8}" cy="${y - 0.8}" r="1" fill="#2f3a46"/><circle cx="${x + 2.8}" cy="${y - 0.8}" r="1" fill="#2f3a46"/>`;

const tamarin = (x: number, y: number) =>
  `<g fill="#f29a2e">${Array.from({ length: 10 }, (_, i) => {
    const a = (i / 10) * Math.PI * 2;
    return `<circle cx="${(x + Math.cos(a) * 6.6).toFixed(1)}" cy="${(y + Math.sin(a) * 6.6).toFixed(1)}" r="3"/>`;
  }).join('')}</g><circle cx="${x}" cy="${y}" r="6.6" fill="#f6b04a"/><ellipse cx="${x}" cy="${y + 0.6}" rx="3.8" ry="4.4" fill="#6b4a32"/><circle cx="${x - 1.6}" cy="${y - 0.6}" r="0.9" fill="#fff"/><circle cx="${x + 1.6}" cy="${y - 0.6}" r="0.9" fill="#fff"/><path d="M${x - 1} ${y + 2.6} q1 0.8 2 0" stroke="#2f2a27" stroke-width="0.6" fill="none"/><path d="M${x + 7} ${y + 6} q4 -2 3 -6" stroke="#f29a2e" stroke-width="2" fill="none" stroke-linecap="round"/>`;

// ------------------------------------------------------------------ the homes

export const HOME_SCENERY: Record<BaseRegionId, HomeScenery> = {
  farm: {
    sun: [62, 42, '#fff1c4'],
    features: [
      { stage: 1, base: 236, svg: () => `${grass(210, 236, '#6fa54e')}${grass(330, 266, '#6fa54e', 1.2)}` },
      { stage: 1, base: 168, svg: () => `${butterfly(132, 160, '#f4a6c4')}${butterfly(150, 150, '#f6c430')}` },
      // A little windmill on the far hill, its sails turning now and then.
      {
        stage: 4,
        base: 113,
        svg: () => `<path d="M114 113 L117 84 H121 L124 113 Z" fill="#f3efe6" stroke="${OUT}" stroke-width="0.7"/><path d="M116 84 L119 78 L122 84 Z" fill="#c9483b"/><g class="sp-blades">${Array.from({ length: 4 }, (_, k) => `<path d="M119 81 L117.6 66 H120.4 Z" fill="#fffaf0" stroke="${OUT}" stroke-width="0.5" transform="rotate(${k * 90 + 20} 119 81)"/>`).join('')}<circle cx="119" cy="81" r="1.4" fill="#8a6a4f"/></g>`,
      },
      { stage: 4, base: 140, svg: () => drift([[178, 128], [204, 126], [222, 130]], '#9cc77a') },
    ],
    landmark: {
      name: 'barn',
      line: 'The barn doors swing open, and a chick peeks out!',
      stage: 2,
      base: 182.2,
      svg: (id) =>
        landmark(
          'barn',
          'the barn',
          `<defs><clipPath id="${id}-lm"><rect x="268" y="141.5" width="36" height="39.5"/></clipPath></defs>
          <rect x="267.5" y="141.5" width="37" height="39.5" fill="#3a2320"/><rect x="267.5" y="172" width="37" height="9" fill="#5a3a2a" opacity="0.6"/>
          ${peek(`${id}-lm`, 0, 22, chick(286, 172))}
          <g class="sp-door sp-door--l"><rect x="266" y="140" width="20" height="42" fill="#a9372c" stroke="#f3efe6" stroke-width="2.6"/><path d="M267.6 141.6 L284.4 180.4" stroke="#f3efe6" stroke-width="2.2"/></g>
          <g class="sp-door sp-door--r"><rect x="286" y="140" width="20" height="42" fill="#a9372c" stroke="#f3efe6" stroke-width="2.6"/><path d="M304.4 141.6 L287.6 180.4" stroke="#f3efe6" stroke-width="2.2"/></g>`,
        ),
    },
    party: { stage: 2, base: 200, svg: () => `${post(176, 150, 200)}${festoon(176, 152, 241, 131, 9, 7)}` },
    lights: [
      [252, 152, 6, 2],
      [320, 152, 6, 2],
      [286, 120, 8, 2],
      [100, 210, 3, 3],
    ],
    front: `<g fill="#5f9a46"><path d="M0 300 V276 q6 6 8 14 q2 -16 8 -22 q-1 14 2 24 q4 -12 10 -16 q-3 10 -2 24 Z"/><path d="M360 300 V272 q-5 8 -7 16 q-2 -14 -8 -20 q1 14 -2 24 q-4 -10 -9 -12 q3 10 2 20 Z"/></g>`,
  },
  outback: {
    sun: [292, 44, '#ffe9c0'],
    features: [
      { stage: 1, base: 150, svg: () => `${grass(196, 150, '#b9b46a')}${grass(330, 252, '#b9b46a', 1.1)}${grass(150, 214, '#b9b46a', 0.9)}` },
      { stage: 3, base: 246, svg: () => `${butterfly(130, 240, '#5b9bc4', '#d9f1ff')}${butterfly(176, 236, '#6fb07c', '#e8f7e0')}` },
      { stage: 4, base: 300, svg: () => drift([[60, 260], [250, 280], [300, 232]], '#d8342c') },
    ],
    landmark: {
      name: 'burrow',
      line: 'A bilby pops up from the burrow to say hello!',
      stage: 3,
      base: 240.2,
      svg: (id) =>
        landmark(
          'burrow',
          'the burrow',
          `<defs><clipPath id="${id}-lm"><rect x="14" y="200" width="40" height="41.6"/></clipPath></defs>
          <rect x="4" y="218" width="66" height="26" fill="transparent"/>
          ${peek(`${id}-lm`, 0, 18, bilby(34, 234))}`,
        ),
    },
    party: { stage: 2, base: 214, svg: () => festoon(214, 180, 280, 170, 6, 6) },
    lights: [],
    front: `<g stroke="#a99a54" stroke-width="1.6" stroke-linecap="round" fill="none"><path d="M6 300 l-6 -18 M10 300 l-2 -22 M14 300 l4 -20 M18 300 l9 -14"/><path d="M350 300 l-8 -16 M354 300 l-3 -22 M358 300 l3 -18"/></g>`,
  },
  savanna: {
    sun: [95, 92, '#ffe7b8'],
    features: [
      { stage: 1, base: 152, svg: () => `${grass(24, 152, '#c9a46e')}${grass(330, 148, '#c9a46e', 1.1)}${grass(226, 232, '#c9a46e', 0.9)}` },
      { stage: 4, base: 240, svg: () => `${butterfly(198, 206, '#f6a23a', '#fff3d8')}${butterfly(130, 230, '#e8707a')}` },
      { stage: 4, base: 180, svg: () => drift([[270, 116], [300, 112], [322, 120]], '#8fb36a') },
    ],
    landmark: {
      name: 'lookout',
      line: 'A rock hyrax peeks over the lookout!',
      stage: 2,
      base: 202.2,
      svg: (id) =>
        landmark(
          'lookout',
          'the rocky lookout',
          `<defs><clipPath id="${id}-lm"><rect x="24" y="140" width="24" height="31"/></clipPath></defs>
          <rect x="22" y="150" width="76" height="50" fill="transparent"/>
          ${peek(`${id}-lm`, 0, 14, hyrax(36, 164))}`,
        ),
    },
    party: { stage: 1, base: 172, svg: () => festoon(252, 104, 338, 100, 8, 5, 'lantern') },
    lights: [],
    front: `<g stroke="#b8935a" stroke-width="1.5" stroke-linecap="round" fill="none"><path d="M4 300 l-4 -14 M8 300 l0 -20 M12 300 l5 -16 M16 300 l10 -10"/><path d="M346 300 l-9 -12 M351 300 l-2 -20 M356 300 l4 -16"/></g>`,
  },
  arctic: {
    sun: [284, 64, '#eef6ff'],
    features: [
      { stage: 1, base: 300, svg: () => drift([[40, 120], [120, 96], [200, 130], [260, 104], [330, 140], [90, 160]], '#ffffff', 'dot') },
      { stage: 4, base: 236, svg: () => `${grass(210, 236, '#9fb79a', 0.9)}${grass(330, 236, '#9fb79a', 0.8)}` },
    ],
    landmark: {
      name: 'den',
      line: 'An arctic fox kit peeks out of the snow den!',
      stage: 2,
      base: 218.2,
      svg: (id, evening) =>
        landmark(
          'den',
          'the snow den',
          `<defs><clipPath id="${id}-lm"><path d="M278 218 C278 200 304 200 304 218 Z"/></clipPath></defs>
          <rect x="250" y="186" width="84" height="32" fill="transparent"/>
          ${evening ? `<path d="M282 218 C282 206 300 206 300 218 Z" fill="#ffd27a" opacity="0.9"/>` : ''}
          ${peek(`${id}-lm`, 0, 16, foxKit(291, 211))}`,
        ),
    },
    party: { stage: 2, base: 218.4, svg: () => festoon(252, 206, 332, 206, -14, 7, 'ice') },
    lights: [[291, 210, 10, 2, true]],
    front: `<g fill="#fbfdff" stroke="#c3d4e4" stroke-width="1"><path d="M0 300 V280 C10 270 30 272 40 284 C44 290 46 296 48 300 Z"/><path d="M360 300 V276 C348 268 330 272 322 286 C320 292 318 296 318 300 Z"/></g>`,
  },
  amazon: {
    sun: [300, 20, '#fff8d8'],
    features: [
      // Sunbeams through the canopy, brightening now and then.
      {
        stage: 1,
        base: 1,
        svg: () => `<g class="sp-glow" pointer-events="none" opacity="0.5"><path d="M268 0 L296 0 L208 200 L178 200 Z" fill="#fffbe0" opacity="0.28"/><path d="M318 0 L334 0 L262 180 L244 180 Z" fill="#fffbe0" opacity="0.22"/><path d="M196 0 L208 0 L130 190 L116 190 Z" fill="#fffbe0" opacity="0.16"/></g>`,
      },
      { stage: 1, base: 160, svg: () => `${butterfly(90, 150, '#3f7fd6', '#bfe0ff')}${butterfly(150, 138, '#3f7fd6', '#bfe0ff')}` },
      { stage: 1, base: 300, svg: () => drift([[200, 90], [250, 70], [280, 100]], '#6faa66') },
      { stage: 4, base: 230, svg: () => `${grass(60, 230, '#4f8a4a')}${grass(320, 236, '#4f8a4a', 1.1)}` },
    ],
    landmark: {
      name: 'tree',
      line: 'A golden tamarin peeks round the tree!',
      stage: 2,
      base: 216.2,
      svg: (id) =>
        landmark(
          'tree',
          'the big tree',
          `<defs><clipPath id="${id}-lm"><rect x="190" y="100" width="31" height="36"/></clipPath></defs>
          <rect x="196" y="96" width="50" height="60" fill="transparent"/>
          ${peek(`${id}-lm`, 16, 0, tamarin(212, 118))}`,
        ),
    },
    party: { stage: 2, base: 216.4, svg: () => festoon(198, 154, 268, 154, 5, 6, 'lantern') },
    lights: [[231, 160, 5, 2]],
    front: `<g fill="#3f7a46"><path d="M0 300 V262 C14 266 26 278 30 300 Z"/><path d="M0 300 C8 286 22 280 40 282 C30 288 24 294 22 300 Z" fill="#4f8a4a"/><path d="M360 300 V268 C346 272 336 284 334 300 Z"/></g>`,
  },
};

/** The warm (or cool) sunlight over a home's land, as defs and a layer. */
export function sunlight(id: string, [x, y, c]: [number, number, string]): string {
  return `<defs><radialGradient id="${id}-sun" cx="${(x / 360).toFixed(3)}" cy="${(y / 300).toFixed(3)}" r="0.95"><stop offset="0" stop-color="${c}" stop-opacity="0.5"/><stop offset="0.45" stop-color="${c}" stop-opacity="0.16"/><stop offset="1" stop-color="${c}" stop-opacity="0"/></radialGradient></defs><rect class="sp-sunlight" width="360" height="300" fill="url(#${id}-sun)" pointer-events="none"/>`;
}

/** The evening's lit windows and lamps. */
export function eveningLights(id: string, lights: HomeScenery['lights'], stage: number): string {
  const on = lights.filter(([, , , s]) => stage >= s);
  if (!on.length) return '';
  return `<defs><radialGradient id="${id}-lamp"><stop offset="0" stop-color="#ffe6a6" stop-opacity="0.95"/><stop offset="0.35" stop-color="#ffd27a" stop-opacity="0.45"/><stop offset="1" stop-color="#ffc35a" stop-opacity="0"/></radialGradient></defs><g class="sp-lamps" pointer-events="none">${on
    .map(([x, y, r, , soft]) =>
      soft
        ? `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="url(#${id}-lamp)" opacity="0.5"/>`
        : `<circle cx="${x}" cy="${y}" r="${r * 2.6}" fill="url(#${id}-lamp)"/><circle cx="${x}" cy="${y}" r="${r * 0.62}" fill="#ffe6a6" opacity="0.9"/>`,
    )
    .join('')}</g>`;
}
