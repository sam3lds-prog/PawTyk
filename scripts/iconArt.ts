/**
 * The PawTyk app icon and favicon (D42), drawn in code like the rest of the game's art.
 *
 * Meadow Farm, where every player starts: the Farm's red barn (as drawn in `ui/art/regions.ts`, white trim and a white
 * cross-braced door, which is also the game's ✕ mark), Cotton the sheep leaning out of the hayloft, Truffle the piglet
 * sitting out front, a hay bale, and fields laid out like a puzzle board: a patchwork of region-colored plots with
 * light seams between them, the way the board's colors sit on its mat. A paw-print weathervane tops the roof.
 * Cotton's and Truffle's heads are the companion rigs' own shapes and colors (`ui/art/companions.ts`).
 *
 * `scripts/make-icons.ts` writes these SVGs to `assets/icon.svg` and `public/favicon.svg` and renders the PNG sizes.
 */

export type IconStyle = 'day' | 'golden' | 'dusk';
export interface IconOptions {
  /** The sky. A clear summer day is the default. */
  style?: IconStyle;
}

const SKIES: Record<IconStyle, { top: string; bottom: string; sun: string; halo: string; cloud: string }> = {
  day: { top: '#6FC2EA', bottom: '#C9ECF7', sun: '#FFD45C', halo: '#FFFFFF', cloud: '#FFFFFF' },
  golden: { top: '#F6B65C', bottom: '#FCE3A6', sun: '#FFF1C4', halo: '#FFF8E0', cloud: '#FFF4DE' },
  dusk: { top: '#6E6BC9', bottom: '#F2B6A6', sun: '#FFD9A0', halo: '#FFE9C9', cloud: '#F9E3E8' },
};

/** Barn colors from the Farm's stage-2 barn. */
const BARN = { wall: '#C9483B', board: '#B13D31', door: '#A9372C', loft: '#7A2F26', trim: '#F3EFE6', pane: '#F8E6B8' };
/** One opaque outline for the whole icon: the scenes' translucent outline turns into a dark halo at icon size. */
const LINE = '#5E2F26';
/** Companion palettes (`ui/art/companions.ts`). */
const COTTON = { fur: '#F6F1E7', light: '#ECD9C3', dark: '#5A4A40', accent: '#F2B8B5' };
const TRUFFLE = { fur: '#F5B9BB', light: '#FBD7D7', dark: '#A65E66', accent: '#EE9AA2' };
/** Field plots in the board's color families (mint, butter, sage, apricot, sea glass), deepened so they read as crops. */
const PLOTS = ['#9ED68A', '#F2D06A', '#BBD67C', '#F3B27E', '#86CDB8'];
const SEAM = '#FBF8F1';

const r2 = (n: number) => Math.round(n * 100) / 100;

/** A face in the companion rigs' style: open eyes with a shine, rosy cheeks and a small smile, in 64-unit space. */
function face(eyes: [number, number, number, number], r: [number, number], mouthY: number, blushY: number, ink: string): string {
  const [lx, ly, rx, ry] = eyes;
  const eye = (x: number, y: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="${r[0]}" ry="${r[1]}" fill="${ink}"/><circle cx="${r2(x + 0.8)}" cy="${r2(y - 1)}" r="0.95" fill="#fff"/>`;
  return (
    `<ellipse cx="${lx - 4.5}" cy="${blushY}" rx="3.2" ry="1.9" fill="#F09C98" opacity="0.75"/><ellipse cx="${rx + 4.5}" cy="${blushY}" rx="3.2" ry="1.9" fill="#F09C98" opacity="0.75"/>` +
    eye(lx, ly) +
    eye(rx, ry) +
    `<path d="M28.4 ${mouthY - 0.6} Q30.2 ${mouthY + 1.8} 32 ${mouthY} Q33.8 ${mouthY + 1.8} 35.6 ${mouthY - 0.6}" stroke="${ink}" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`
  );
}

/** Cotton's head (the companion rig's shapes), 64-unit space. */
function cottonHead(): string {
  const p = COTTON;
  const o = `stroke="${LINE}" stroke-width="1.1"`;
  return `
    <ellipse cx="11.5" cy="33" rx="8" ry="4" transform="rotate(18 11.5 33)" fill="${p.light}" ${o}/>
    <ellipse cx="12.5" cy="33" rx="4.6" ry="2" transform="rotate(18 12.5 33)" fill="${p.accent}"/>
    <ellipse cx="52.5" cy="33" rx="8" ry="4" transform="rotate(-18 52.5 33)" fill="${p.light}" ${o}/>
    <ellipse cx="51.5" cy="33" rx="4.6" ry="2" transform="rotate(-18 51.5 33)" fill="${p.accent}"/>
    <g fill="${p.fur}" ${o}><circle cx="19" cy="24" r="8"/><circle cx="45" cy="24" r="8"/><circle cx="25" cy="16.5" r="8"/><circle cx="39" cy="16.5" r="8"/><circle cx="32" cy="14" r="8.5"/></g>
    <path d="M32 22 C42 22 47.5 30 47 38.5 C46.5 47 40 53.5 32 53.5 C24 53.5 17.5 47 17 38.5 C16.5 30 22 22 32 22 Z" fill="${p.light}" ${o}/>
    <g fill="${p.fur}"><circle cx="25.5" cy="24" r="5.4"/><circle cx="32" cy="22" r="6"/><circle cx="38.5" cy="24" r="5.4"/></g>
    <ellipse cx="32" cy="45" rx="8.5" ry="6.2" fill="#F6E9DA"/>
    <path d="M29.6 42.2 h4.8 q-.4 2.2 -2.4 2.6 q-2 -.4 -2.4 -2.6z" fill="#C98F8A"/>
    ${face([25.5, 36.5, 38.5, 36.5], [2.4, 2.9], 47.6, 41.8, p.dark)}`;
}

/** Truffle sitting: the companion rig's head over a round body with two front trotters, 64-unit space. */
function truffleSitting(): string {
  const p = TRUFFLE;
  const o = `stroke="${LINE}" stroke-width="1.1"`;
  return `
    <ellipse cx="32" cy="62" rx="20" ry="15.5" fill="${p.fur}" ${o}/>
    <ellipse cx="32" cy="65" rx="11" ry="8.5" fill="${p.light}"/>
    <rect x="22" y="66" width="7.4" height="11" rx="3.7" fill="${p.fur}" ${o}/><rect x="34.6" y="66" width="7.4" height="11" rx="3.7" fill="${p.fur}" ${o}/>
    <path d="M23.6 75.4 h4.2 M36.2 75.4 h4.2" stroke="${p.dark}" stroke-width="1.2" stroke-linecap="round"/>
    <path d="M14 24 L12 9 L27 17 Z" fill="${p.fur}" ${o} stroke-linejoin="round"/><path d="M16 20 L15.2 12.6 L23.6 17.4 Z" fill="${p.accent}"/>
    <path d="M50 24 L52 9 L37 17 Z" fill="${p.fur}" ${o} stroke-linejoin="round"/><path d="M48 20 L48.8 12.6 L40.4 17.4 Z" fill="${p.accent}"/>
    <ellipse cx="32" cy="35" rx="21" ry="18.5" fill="${p.fur}" ${o}/>
    <path d="M29 17.6 q2 -3.6 4 -.4 q1.6 -2.6 3.2 .2" stroke="${p.dark}" stroke-width="1.1" fill="none" stroke-linecap="round" opacity=".6"/>
    <ellipse cx="32" cy="43" rx="9" ry="6.4" fill="${p.accent}" stroke="${p.dark}" stroke-width=".9"/>
    <ellipse cx="29" cy="43" rx="1.5" ry="2.2" fill="${p.dark}"/><ellipse cx="35" cy="43" rx="1.5" ry="2.2" fill="${p.dark}"/>
    ${face([23.5, 33, 40.5, 33], [2.4, 2.9], 51.3, 40, '#4A2F33')}`;
}

/** A paw print centered on 0,0 (pad plus four toes), about 60 units across. */
function pawPrint(fill: string): string {
  return `<g fill="${fill}" stroke="${LINE}" stroke-width="5"><path d="M0 2 C-14 2 -24 13 -24 22 C-24 29 -18 32 -11 32 C-6 32 -3 30 0 30 C3 30 6 32 11 32 C18 32 24 29 24 22 C24 13 14 2 0 2 Z"/>
    <ellipse cx="-24" cy="-6" rx="7.5" ry="9.5" transform="rotate(-20 -24 -6)"/><ellipse cx="-9" cy="-17" rx="7.5" ry="10"/><ellipse cx="9" cy="-17" rx="7.5" ry="10"/><ellipse cx="24" cy="-6" rx="7.5" ry="9.5" transform="rotate(20 24 -6)"/></g>`;
}

/** The fields in front of the barn: two rows of plots fanning out toward the viewer, with light seams. */
function fields(): string {
  const top = 806;
  const mid = 890;
  const bottom = 1040;
  const xsTop = [-60, 196, 410, 614, 828, 1084];
  const at = (x: number, y: number) => r2(512 + (x - 512) * (1 + ((y - top) / (bottom - top)) * 0.75));
  const rowColors = [
    [2, 1, 0, 1, 2],
    [0, 3, 4, 1, 0],
  ];
  let out = '';
  [
    [top, mid],
    [mid, bottom],
  ].forEach(([y0, y1], row) => {
    for (let i = 0; i < xsTop.length - 1; i++) {
      const a = xsTop[i];
      const b = xsTop[i + 1];
      const pts = `${at(a, y0)},${y0} ${at(b, y0)},${y0} ${at(b, y1)},${y1} ${at(a, y1)},${y1}`;
      const fill = PLOTS[rowColors[row][i]];
      out += `<polygon points="${pts}" fill="${fill}" stroke="${SEAM}" stroke-width="12" stroke-linejoin="round"/>`;
      // A few crop rows, so a plot reads as a field.
      const lines = row === 0 ? 2 : 3;
      for (let k = 1; k <= lines; k++) {
        const y = r2(y0 + ((y1 - y0) * k) / (lines + 1));
        out += `<path d="M${r2(at(a, y) + 26)} ${y} L${r2(at(b, y) - 26)} ${y}" stroke="#ffffff" stroke-opacity="0.32" stroke-width="${row === 0 ? 5 : 7}" stroke-linecap="round"/>`;
      }
    }
  });
  return out;
}

/**
 * The 1024 × 1024 app icon. Square and fully opaque, as the App Store requires: iOS rounds the corners itself, so
 * nothing important sits in them.
 */
export function iconSvg(o: IconOptions = {}): string {
  const style = o.style ?? 'day';
  const sky = SKIES[style];
  const id = `pt-${style}`;

  const backdrop = `
  <rect width="1024" height="1024" fill="url(#${id}-sky)"/>
  <circle cx="184" cy="190" r="112" fill="${sky.halo}" opacity="0.35"/>
  <circle cx="184" cy="190" r="76" fill="${sky.sun}"/>
  <g fill="${sky.cloud}" opacity="0.92"><ellipse cx="808" cy="196" rx="96" ry="30"/><ellipse cx="770" cy="176" rx="52" ry="34"/><ellipse cx="836" cy="168" rx="40" ry="28"/><ellipse cx="640" cy="104" rx="54" ry="16"/></g>
  <path d="M0 640 C120 566 260 560 380 600 C520 552 700 548 820 590 C900 566 970 570 1024 588 V840 H0 Z" fill="#B9DE95"/>
  <g fill="#93C774">${[54, 112, 166, 860, 916, 970].map((x, i) => `<circle cx="${x}" cy="${612 - (i % 2) * 10}" r="${30 + (i % 3) * 6}"/>`).join('')}</g>
  <path d="M0 720 C200 690 420 700 620 712 C800 704 940 694 1024 700 V860 H0 Z" fill="#9CCF78"/>`;

  // The barn: a gable with white trim, wall boards, the hayloft, two windows and the cross-braced door.
  const L = 262;
  const R = 762;
  const eave = 432;
  const peak = 262;
  const base = 808;
  const wall = `<path d="M${L} ${base} V${eave} L512 ${peak} L${R} ${eave} V${base} Z" fill="${BARN.wall}" stroke="${LINE}" stroke-width="12" stroke-linejoin="round"/>`;
  const boards = `<g stroke="${BARN.board}" stroke-width="6" opacity="0.75">${[488, 548, 608, 668, 728].map((y) => `<path d="M${L + 8} ${y} H${R - 8}"/>`).join('')}</g>`;
  const trim =
    `<path d="M${L - 34} ${eave + 16} L512 ${peak - 22} L${R + 34} ${eave + 16}" stroke="${LINE}" stroke-width="50" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<path d="M${L - 34} ${eave + 16} L512 ${peak - 22} L${R + 34} ${eave + 16}" stroke="${BARN.trim}" stroke-width="30" stroke-linecap="round" stroke-linejoin="round" fill="none"/>`;
  const vane =
    `<path d="M512 ${peak - 40} V146" stroke="${LINE}" stroke-width="10" stroke-linecap="round"/>` +
    `<path d="M468 182 H556 M556 182 l-17 -11 M556 182 l-17 11" stroke="${LINE}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round" fill="none"/>` +
    `<g transform="translate(512 130) scale(0.92)">${pawPrint('#F2B84B')}</g>`;
  const pane = (x: number) =>
    `<rect x="${x}" y="566" width="76" height="76" rx="4" fill="${BARN.pane}" stroke="${BARN.trim}" stroke-width="13"/><path d="M${x + 38} 566 V642 M${x} 604 H${x + 76}" stroke="${BARN.trim}" stroke-width="7"/><rect x="${x - 6.5}" y="559.5" width="89" height="89" rx="8" fill="none" stroke="${LINE}" stroke-width="5"/>`;
  const windows = pane(300) + pane(648);
  // The door: one panel with a white frame and a white cross brace, the game's ✕.
  const dx = 392;
  const dy = 548;
  const dw = 240;
  const dh = base - dy;
  const door =
    `<rect x="${dx - 9}" y="${dy - 9}" width="${dw + 18}" height="${dh + 9}" fill="${LINE}"/>` +
    `<rect x="${dx}" y="${dy}" width="${dw}" height="${dh}" fill="${BARN.door}" stroke="${BARN.trim}" stroke-width="20"/>` +
    `<path d="M${dx + 10} ${dy + 10} L${dx + dw - 10} ${base - 10} M${dx + dw - 10} ${dy + 10} L${dx + 10} ${base - 10}" stroke="${BARN.trim}" stroke-width="22" stroke-linecap="butt"/>`;
  // The hayloft, with Cotton leaning out on the sill.
  const lx = 410;
  const ly = 300;
  const lw = 204;
  const lh = 182;
  const loft = `<rect x="${lx - 9}" y="${ly - 9}" width="${lw + 18}" height="${lh + 18}" rx="8" fill="${LINE}"/><rect x="${lx}" y="${ly}" width="${lw}" height="${lh}" fill="${BARN.loft}" stroke="${BARN.trim}" stroke-width="16"/>`;
  const k = 3.75;
  const cotton = `<g transform="translate(${r2(512 - 32 * k)} ${r2(ly + 14 - 5.5 * k)}) scale(${k})">${cottonHead()}</g>`;
  const sillY = ly + lh;
  const sill =
    `<rect x="${lx - 22}" y="${sillY - 10}" width="${lw + 44}" height="26" rx="10" fill="${BARN.trim}" stroke="${LINE}" stroke-width="7"/>` +
    [468, 556].map((x) => `<ellipse cx="${x}" cy="${sillY - 8}" rx="19" ry="13" fill="${COTTON.dark}" stroke="${LINE}" stroke-width="5"/>`).join('');
  const barnShadow = `<ellipse cx="512" cy="${base + 6}" rx="320" ry="22" fill="rgba(40,70,30,0.25)"/>`;

  const bale =
    `<g transform="translate(218 856) scale(1.05)"><ellipse cx="0" cy="66" rx="78" ry="14" fill="rgba(40,70,30,0.25)"/><circle r="74" fill="#E8C76A" stroke="${LINE}" stroke-width="9"/>` +
    `<circle r="46" fill="none" stroke="#C99F45" stroke-width="9"/><circle r="18" fill="#C99F45"/></g>`;
  const kt = 3.35;
  const truffle = `<g transform="translate(${r2(782 - 32 * kt)} ${r2(712)}) scale(${kt})">${truffleSitting()}</g>`;
  const truffleShadow = `<ellipse cx="782" cy="976" rx="82" ry="14" fill="rgba(40,70,30,0.25)"/>`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <title>PawTyk</title>
  <defs>
    <linearGradient id="${id}-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="0.7" stop-color="${sky.bottom}"/></linearGradient>
  </defs>
  ${backdrop}
  ${fields()}
  ${barnShadow}
  <g transform="translate(512 ${base}) scale(1.1) translate(-512 -${base})">
  ${vane}
  ${wall}
  ${boards}
  ${trim}
  ${windows}
  ${door}
  ${loft}
  ${cotton}
  ${sill}
  </g>
  ${bale}
  ${truffleShadow}
  ${truffle}
</svg>
`;
}

/** The favicon: the red barn with its white ✕ door on a blue sky, which still reads at 16 px. */
export function faviconSvg(): string {
  const sky = SKIES.day;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <title>PawTyk</title>
  <defs><linearGradient id="pt-fav-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${sky.top}"/><stop offset="1" stop-color="${sky.bottom}"/></linearGradient></defs>
  <rect width="64" height="64" rx="14" fill="url(#pt-fav-sky)"/>
  <path d="M0 50 H64 V50 A14 14 0 0 1 50 64 H14 A14 14 0 0 1 0 50 Z" fill="#9CCF78"/>
  <path d="M12 54 V28 L32 13 L52 28 V54 Z" fill="${BARN.wall}" stroke="${LINE}" stroke-width="2" stroke-linejoin="round"/>
  <path d="M9 30 L32 12 L55 30" stroke="${BARN.trim}" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" fill="none"/>
  <rect x="22" y="36" width="20" height="18" fill="${BARN.door}" stroke="${BARN.trim}" stroke-width="2.4"/>
  <path d="M23.2 37.2 L40.8 52.8 M40.8 37.2 L23.2 52.8" stroke="${BARN.trim}" stroke-width="2.6"/>
  <rect x="27" y="23" width="10" height="8" fill="${BARN.loft}" stroke="${BARN.trim}" stroke-width="1.8"/>
</svg>
`;
}
