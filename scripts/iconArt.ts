/**
 * The PawTyk app icon and favicon (D42), drawn in code like the rest of the game's art.
 *
 * Pip, the apricot tabby who "sparkles at every finished row", peeks over a little puzzle board with both paws on its
 * rim and gives a wink: the board is the game's own (a rim with corner posts as in D41, region-colored tiles, a ✕ mark
 * and Cotton the sheep on a tile), the face uses the face rig's geometry and Pip's palette (`ui/art/pets.ts`,
 * `meta/catalogs/pets.ts`), so the icon looks like the animals the player meets.
 *
 * `scripts/make-icons.ts` writes these SVGs to `assets/icon.svg` and `public/favicon.svg` and renders the PNG sizes.
 */

import { PET_BY_ID, type PetPalette } from '../src/meta/catalogs/pets';

export type IconStyle = 'teal' | 'sunny' | 'berry';
export interface IconOptions {
  /** Background color family. Teal is the game's brand color (the default). */
  style?: IconStyle;
  /** Pip winks (the default) or looks out with both sparkly eyes. */
  wink?: boolean;
}

const PIP: PetPalette = PET_BY_ID.pip.palette;
/** One crisp, opaque outline in Pip's own brow color: the rig's translucent outline turns into a dark halo at icon size. */
const LINE = PIP.brow;

const BACKGROUNDS: Record<IconStyle, { from: string; to: string; rays: string; spark: string }> = {
  teal: { from: '#4DAE9F', to: '#1F6E64', rays: 'rgba(255,255,255,0.07)', spark: '#FFE7A8' },
  sunny: { from: '#FFD66B', to: '#F2A93B', rays: 'rgba(255,255,255,0.16)', spark: '#FFFFFF' },
  berry: { from: '#8B7BE0', to: '#4E3FA6', rays: 'rgba(255,255,255,0.08)', spark: '#FFE7A8' },
};

/** The board's region colors (tokens `--r1`…), a step richer so they still read as a puzzle at home-screen size. */
const TILE = {
  mint: '#bfe8cc',
  apricot: '#f8cba9',
  sky: '#b5dceb',
  blush: '#f5c0cd',
  butter: '#f1dc8c',
  lavender: '#d0c2f3',
  sea: '#b2e0d6',
  peri: '#c0cdf4',
};

const r2 = (n: number) => Math.round(n * 100) / 100;
/** Mirrors a path across x = 32 (absolute M/L/C/Q/Z with "x y" pairs only), as the face rig does. */
const mirror = (d: string) => d.replace(/(-?\d+(?:\.\d+)?)[ ,](-?\d+(?:\.\d+)?)/g, (_m, x: string, y: string) => `${r2(64 - Number(x))} ${y}`);
const pair = (d: string, attrs: string) => `<path d="${d}" ${attrs}/><path d="${mirror(d)}" ${attrs}/>`;

function sparkle(x: number, y: number, r: number, color: string, rot = 0): string {
  const t = r2(r * 0.24);
  return `<path transform="translate(${x} ${y}) rotate(${rot})" d="M0 ${-r} Q${t} ${-t} ${r} 0 Q${t} ${t} 0 ${r} Q${-t} ${t} ${-r} 0 Q${-t} ${-t} 0 ${-r} Z" fill="${color}"/>`;
}

/** Pip's face in the rig's 64-unit space: pointed ears, tabby marks, big sparkly eyes (or a wink) and the widest grin. */
function pipFace(wink: boolean): string {
  const P = PIP;
  const line = `stroke="${LINE}" stroke-width="0.95" stroke-linejoin="round"`;
  const ears =
    pair('M11.8 29.6 L13.2 9.4 C13.4 7.6 15 7 16.2 8.1 L29.6 19.4 Z', `fill="${P.ear}" ${line}`) +
    pair('M15.2 25.4 L16 12.6 L25.4 19.8 Z', `fill="${P.innerEar}"`);
  const head = `<path d="M32 18.6 C44.6 18.6 53.8 26.4 54.6 37 C55.4 46.8 46 55.4 32 55.4 C18 55.4 8.6 46.8 9.4 37 C10.2 26.4 19.4 18.6 32 18.6 Z" fill="${P.fur}" ${line}/>`;
  const fluff = pair('M10.4 41.6 C9.4 45.2 11.4 48.6 14.6 50.2 C13 47.4 12.4 44.6 13.4 41.8 Z', `fill="${P.shade}" opacity="0.45"`);
  const tabby =
    `<g stroke="${P.shade}" stroke-width="2.1" stroke-linecap="round" fill="none"><path d="M32 20.8 V25"/><path d="M27.2 21.6 Q28 24 28.8 25"/><path d="M36.8 21.6 Q36 24 35.2 25"/></g>` +
    pair('M10.8 37.4 L14.6 37.4 M11 40.8 L14.2 40.8', `stroke="${P.shade}" stroke-width="1.8" stroke-linecap="round" fill="none"`);
  const cheeks = `<ellipse cx="16.6" cy="43.2" rx="3.9" ry="2.4" fill="${P.cheek}" opacity="0.85"/><ellipse cx="47.4" cy="43.2" rx="3.9" ry="2.4" fill="${P.cheek}" opacity="0.85"/>`;
  const muzzle = `<ellipse cx="32" cy="46.4" rx="9.6" ry="6.8" fill="${P.muzzle}"/>`;
  const whiskers = pair('M8.2 42.4 L16.6 43.6 M8.8 47 L16.8 46.2', `stroke="${P.whisker}" stroke-width="1.1" stroke-linecap="round" opacity="0.7" fill="none"`);
  const nose = `<path d="M29.4 41.4 Q32 40.1 34.6 41.4 Q33.8 43.6 32 44.1 Q30.2 43.6 29.4 41.4 Z" fill="${P.nose}"/>`;
  const eye = (cx: number, cy: number) => {
    const rx = 4.3;
    const ry = 5.1;
    const hx = r2(cx + rx * 0.3);
    const hy = r2(cy - ry * 0.34);
    const s = 2.3;
    const t = 0.42;
    return (
      `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${ry}" fill="${P.eye}"/>` +
      `<path d="M${hx} ${r2(hy - s)} Q${r2(hx + t)} ${r2(hy - t)} ${r2(hx + s)} ${hy} Q${r2(hx + t)} ${r2(hy + t)} ${hx} ${r2(hy + s)} Q${r2(hx - t)} ${r2(hy + t)} ${r2(hx - s)} ${hy} Q${r2(hx - t)} ${r2(hy - t)} ${hx} ${r2(hy - s)} Z" fill="#fff"/>` +
      `<circle cx="${r2(cx - rx * 0.36)}" cy="${r2(cy + ry * 0.44)}" r="0.75" fill="#fff" opacity="0.85"/>`
    );
  };
  const winkEye = (cx: number, cy: number) =>
    `<path d="M${r2(cx - 4.4)} ${cy + 1} Q${cx} ${r2(cy - 4.6)} ${r2(cx + 4.4)} ${cy + 1}" stroke="${P.eye}" stroke-width="2.2" stroke-linecap="round" fill="none"/>`;
  const eyes = eye(22.8, 35.4) + (wink ? winkEye(41.2, 35.4) : eye(41.2, 35.4));
  const brows = `<g stroke="${P.brow}" stroke-width="1.9" stroke-linecap="round" fill="none"><path d="M19.6 27.6 Q22.8 25.2 26 27.2"/><path d="M38 27.2 Q41.2 25.2 44.4 27.6"/></g>`;
  const grin = `<path d="M26.2 45.4 Q32 54.4 37.8 45.4 Q32 48 26.2 45.4 Z" fill="${P.eye}"/><path d="M29.2 49.6 Q32 53 34.8 49.6 Q32 48.5 29.2 49.6 Z" fill="#EC8790"/>`;
  return [ears, head, fluff, tabby, cheeks, muzzle, whiskers, nose, eyes, brows, grin].join('\n    ');
}

/** A front paw resting on the rim, centered on 0,0 (about 128 × 94 units). */
function paw(): string {
  return (
    `<path d="M-64 18 C-66 -22 -36 -46 0 -46 C36 -46 66 -22 64 18 C62 40 40 48 0 48 C-40 48 -62 40 -64 18 Z" fill="${PIP.fur}" stroke="${LINE}" stroke-width="10.5"/>` +
    `<path d="M-20 -6 C-21 10 -20 28 -18 40 M20 -6 C21 10 20 28 18 40" stroke="${PIP.shade}" stroke-width="7" stroke-linecap="round" fill="none" opacity="0.75"/>`
  );
}

/** Cotton, the Farm's first sheep, small enough for one tile; centered on 0,0. */
function cotton(): string {
  const soft = 'stroke="rgba(40,52,52,0.34)" stroke-width="3"';
  return [
    '<ellipse cx="-40" cy="-6" rx="14" ry="9" fill="#5b4a44" transform="rotate(-24 -40 -6)"/>',
    '<ellipse cx="40" cy="-6" rx="14" ry="9" fill="#5b4a44" transform="rotate(24 40 -6)"/>',
    `<g fill="#fffaf2" ${soft}><circle cx="-22" cy="-30" r="15"/><circle cx="0" cy="-36" r="16"/><circle cx="22" cy="-30" r="15"/></g>`,
    `<ellipse cx="0" cy="6" rx="31" ry="34" fill="#6d5a52" ${soft}/>`,
    '<g fill="#fffaf2"><circle cx="-14" cy="-24" r="12"/><circle cx="0" cy="-28" r="13"/><circle cx="14" cy="-24" r="12"/></g>',
    '<circle cx="-11" cy="2" r="5.5" fill="#2f2622"/><circle cx="11" cy="2" r="5.5" fill="#2f2622"/>',
    '<circle cx="-9" cy="0" r="1.8" fill="#fff"/><circle cx="13" cy="0" r="1.8" fill="#fff"/>',
    '<path d="M-8 22 Q0 28 8 22" stroke="#2f2622" stroke-width="3.2" stroke-linecap="round" fill="none"/>',
    '<ellipse cx="-20" cy="16" rx="6" ry="3.6" fill="#ef8572" opacity="0.7"/><ellipse cx="20" cy="16" rx="6" ry="3.6" fill="#ef8572" opacity="0.7"/>',
  ].join('');
}

/**
 * The 1024 × 1024 app icon. Square and fully opaque, as the App Store requires: iOS rounds the corners itself, so
 * nothing important sits in them.
 */
export function iconSvg(o: IconOptions = {}): string {
  const style = o.style ?? 'teal';
  const wink = o.wink ?? true;
  const bg = BACKGROUNDS[style];
  const id = `pt-${style}`;

  // Sunburst rays from behind Pip's head.
  const cx = 512;
  const cy = 470;
  const R = 1100;
  let rays = '';
  for (let i = 0; i < 16; i++) {
    const a0 = (i * 2 * Math.PI) / 16;
    const a1 = a0 + Math.PI / 16;
    rays += `<path d="M${cx} ${cy} L${r2(cx + R * Math.cos(a0))} ${r2(cy + R * Math.sin(a0))} L${r2(cx + R * Math.cos(a1))} ${r2(cy + R * Math.sin(a1))} Z"/>`;
  }
  const sparks = [sparkle(150, 210, 44, bg.spark), sparkle(888, 260, 34, bg.spark, 12), sparkle(846, 120, 20, '#fff'), sparkle(205, 430, 18, '#fff', 8)].join('');

  // Pip: rig units → px.
  const k = 12.4;
  const face = `<g transform="translate(${r2(512 - 32 * k)} 58) scale(${k})">\n    ${pipFace(wink)}\n  </g>`;

  // The board: a rim with a post at each top corner (D41) and two rows of four tiles; it runs off the bottom edge.
  const bx = 150;
  const by = 712;
  const bw = 724;
  const rimW = 30;
  const gap = 10;
  const inX = bx + rimW;
  const inY = by + rimW;
  const inW = bw - 2 * rimW;
  const tw = (inW - 3 * gap) / 4;
  const rows = [
    [TILE.mint, TILE.apricot, TILE.sky, TILE.blush],
    [TILE.butter, TILE.lavender, TILE.sea, TILE.peri],
  ];
  const at = (i: number, r: number) => [inX + i * (tw + gap), inY + r * (tw + gap)] as const;
  const tiles = rows.flatMap((row, r) => row.map((c, i) => `<rect x="${at(i, r)[0]}" y="${at(i, r)[1]}" width="${tw}" height="${tw}" rx="22" fill="${c}"/>`)).join('');
  const [x0, y0] = at(0, 0);
  const [x3, y3] = at(3, 0);
  const mark = `<path transform="translate(${x0 + tw / 2} ${y0 + tw / 2 + 6})" d="M-28 -28 L28 28 M28 -28 L-28 28" stroke="#4f5f59" stroke-width="15" stroke-linecap="round"/>`;
  const sheep = `<g transform="translate(${x3 + tw / 2} ${y3 + tw / 2 + 4}) scale(1.05)">${cotton()}</g>`;
  const posts = [bx + 4, bx + bw - 4]
    .map((x) => `<circle cx="${x}" cy="${by + 4}" r="26" fill="#D9984F" stroke="${LINE}" stroke-width="9"/><circle cx="${x - 7}" cy="${by - 4}" r="7" fill="#fff" opacity="0.45"/>`)
    .join('');
  const board = [
    `<rect x="${bx}" y="${by + 14}" width="${bw}" height="420" rx="54" fill="rgba(20,50,45,0.28)"/>`,
    `<rect x="${bx}" y="${by}" width="${bw}" height="420" rx="54" fill="#F8E9CB" stroke="${LINE}" stroke-width="10"/>`,
    `<rect x="${inX - 6}" y="${inY - 6}" width="${inW + 12}" height="420" rx="30" fill="#FBF8F1"/>`,
    tiles,
    mark,
    sheep,
    posts,
  ].join('\n  ');
  const paws = [512 - 176, 512 + 176].map((x) => `<g transform="translate(${x} ${by + 6}) scale(1.12)">${paw()}</g>`).join('');

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>PawTyk</title>
  <defs>
    <radialGradient id="${id}-bg" cx="50%" cy="42%" r="72%"><stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/></radialGradient>
  </defs>
  <rect width="1024" height="1024" fill="url(#${id}-bg)"/>
  <g fill="${bg.rays}">${rays}</g>
  ${sparks}
  ${face}
  ${board}
  ${paws}
</svg>
`;
}

/** The favicon: Pip's winking face alone on the teal tile, so it still reads at 16 px. */
export function faviconSvg(): string {
  const bg = BACKGROUNDS.teal;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>PawTyk</title>
  <defs>
    <radialGradient id="pt-fav-bg" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${bg.from}"/><stop offset="1" stop-color="${bg.to}"/></radialGradient>
  </defs>
  <rect width="64" height="64" rx="14" fill="url(#pt-fav-bg)"/>
  <g transform="translate(-2.56 -0.7) scale(1.08)">
    ${pipFace(true)}
  </g>
</svg>
`;
}
