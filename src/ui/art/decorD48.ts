/**
 * D48 PR C: the new decorations' drawings (original art, drawn in code), in the scenes' 360 × 300 frame and the same
 * storybook style as the others: soft fills, one fine outline, a shadow on the ground.
 *
 * The Farm's new pieces stand in four **spots**, each drawn to fit its spot's box, so whichever piece the player puts
 * out, it never overlaps the animals, the barn or another piece:
 *  - the meadow by the path: ground y 232, x 199–247 (mid-ground, beside Truffle);
 *  - the hill by the orchard: ground y 140, x 168–232 (in the distance: drawn smaller);
 *  - the corner by the big tree: ground y 258, x 2–38 (left, in front: tall and narrow pieces);
 *  - the pond: in the water at x 98 (once the pond is dug).
 * Each other home has one new piece in a free place of its own.
 *
 * Moving parts carry the class their activity (`art/activities.ts`) or their idle motion
 * (`styles/decor-d48.css`) animates: `.sp-carousel-ride`, `.sp-whirl`, `.sp-bell`, `.sp-vine`, `.sp-sled`,
 * `.sp-bubbles`, `.sp-stage-lights`, `.sp-bflies`, `.sp-glow`, `.sp-water`.
 */

import type { DecorId } from '../../meta/catalogs/decor';
import { OUT, SHADOW, type DecorArt } from './sceneKit';

export type D48DecorId = Extract<
  DecorId,
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
  | 'duckfountain'
  | 'windchimes'
  | 'redrockslide'
  | 'drumcircle'
  | 'sledhill'
  | 'vineswing'
>;

const f = (n: number) => n.toFixed(1);
const flower = (x: number, y: number, c: string, r = 1.6) =>
  `<g fill="${c}"><circle cx="${f(x - r * 0.7)}" cy="${f(y)}" r="${f(r * 0.6)}"/><circle cx="${f(x + r * 0.7)}" cy="${f(y)}" r="${f(r * 0.6)}"/><circle cx="${f(x)}" cy="${f(y - r * 0.7)}" r="${f(r * 0.6)}"/><circle cx="${f(x)}" cy="${f(y + r * 0.7)}" r="${f(r * 0.6)}"/></g><circle cx="${f(x)}" cy="${f(y)}" r="${f(r * 0.45)}" fill="#F6C430"/>`;
const leaf = (x: number, y: number, rot: number, s = 1, c = '#7FB35D') =>
  `<ellipse cx="${f(x)}" cy="${f(y)}" rx="${f(2.4 * s)}" ry="${f(1.2 * s)}" fill="${c}" transform="rotate(${rot} ${f(x)} ${f(y)})"/>`;
const star = (x: number, y: number, r: number, c: string, extra = '') => {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${f(x + Math.cos(a) * rr)} ${f(y + Math.sin(a) * rr)}`);
  }
  return `<path d="M${p.join(' L')} Z" fill="${c}" ${extra}/>`;
};
const butterfly = (x: number, y: number, c: string, i: number) =>
  `<g class="sp-bfly sp-bfly--${i}"><path d="M${f(x)} ${f(y)} q-2.6 -2.8 -3.6 -0.4 q0.6 2 3.6 0.4 Z M${f(x)} ${f(y)} q2.6 -2.8 3.6 -0.4 q-0.6 2 -3.6 0.4 Z" fill="${c}"/><path d="M${f(x)} ${f(y - 1)} v2" stroke="#3f3a36" stroke-width="0.5"/></g>`;
const pumpkin = (x: number, y: number, s: number) =>
  `<g><ellipse cx="${f(x)}" cy="${f(y - 2.6 * s)}" rx="${f(4.4 * s)}" ry="${f(3 * s)}" fill="#F0913A" stroke="${OUT}" stroke-width="0.5"/>
   <path d="M${f(x - 1.6 * s)} ${f(y - 5.4 * s)} q-0.8 2.8 0 5.4 M${f(x + 1.6 * s)} ${f(y - 5.4 * s)} q0.8 2.8 0 5.4" stroke="#C96A28" stroke-width="0.5" fill="none"/>
   <path d="M${f(x)} ${f(y - 5.4 * s)} q0.2 -1.4 1.2 -2" stroke="#6F8A3E" stroke-width="${f(0.9 * s)}" fill="none" stroke-linecap="round"/></g>`;

export const D48_DECOR_ART: Record<D48DecorId, DecorArt> = {
  // ---------------------------------------------------------------- the meadow by the path (ground 232)
  flowerarch: {
    base: 232,
    box: [198, 188, 50, 46],
    draw: () => `
      <ellipse cx="223" cy="232.5" rx="24" ry="2.6" fill="${SHADOW}"/>
      <path d="M205 232 V207 Q205 191 223 191 Q241 191 241 207 V232" fill="none" stroke="#9a7352" stroke-width="3.2" stroke-linecap="round"/>
      <path d="M205 232 V207 Q205 191 223 191 Q241 191 241 207 V232" fill="none" stroke="#b98a5e" stroke-width="1.2" stroke-linecap="round"/>
      <path d="M205 222 h4 M205 212 h4 M237 222 h4 M237 212 h4" stroke="#8a6a4f" stroke-width="0.8"/>
      <g>${[
        [205, 226, 80],
        [204, 216, 100],
        [206, 204, 60],
        [212, 194, 20],
        [223, 190, 0],
        [234, 194, -20],
        [240, 204, -60],
        [242, 216, -100],
        [241, 226, -80],
      ]
        .map(([x, y, r], i) => leaf(x, y, r, 1.2, i % 2 ? '#7FB35D' : '#6FA34E'))
        .join('')}</g>
      <g class="sp-sway">${[
        [206, 220, '#F4A6C4'],
        [204, 209, '#ffffff'],
        [209, 198, '#E5546C'],
        [217, 192, '#F4A6C4'],
        [229, 192, '#ffffff'],
        [237, 198, '#E5546C'],
        [242, 209, '#F4A6C4'],
        [240, 220, '#B49AE0'],
        [223, 189, '#F6D27A'],
      ]
        .map(([x, y, c]) => flower(x as number, y as number, c as string, 2))
        .join('')}</g>`,
  },
  applecart: {
    base: 232,
    box: [198, 196, 50, 40],
    draw: () => `
      <ellipse cx="223" cy="232.5" rx="23" ry="2.6" fill="${SHADOW}"/>
      <path d="M202 214 L194 208" stroke="#8a6a4f" stroke-width="1.6" stroke-linecap="round"/><path d="M202 220 L194 214" stroke="#8a6a4f" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M202 210 H244 L242 224 H204 Z" fill="#5f9e8f" stroke="${OUT}" stroke-width="0.8"/>
      <path d="M206 210 v14 M213 210 v14 M220 210 v14 M227 210 v14 M234 210 v14 M241 210 v14" stroke="#4e8a7b" stroke-width="0.6"/>
      <path d="M202 210 H244" stroke="#f6e8cc" stroke-width="1.4"/>
      <g>${[
        [208, 207, '#E5546C'],
        [214, 205, '#9BC27A'],
        [220, 204.5, '#E5546C'],
        [226, 204, '#E5546C'],
        [232, 205, '#9BC27A'],
        [238, 207, '#E5546C'],
        [211, 202, '#E5546C'],
        [217, 200.5, '#E5546C'],
        [223, 200, '#9BC27A'],
        [229, 200.5, '#E5546C'],
        [235, 202, '#E5546C'],
        [220, 197, '#E5546C'],
        [226, 197, '#E5546C'],
      ]
        .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="3" fill="${c}" stroke="${OUT}" stroke-width="0.4"/><path d="M${x} ${(y as number) - 2.6} v-1.2" stroke="#6b4a34" stroke-width="0.5"/>`)
        .join('')}</g>
      <circle cx="210" cy="226" r="6" fill="#5b4a3a" stroke="${OUT}" stroke-width="0.7"/><circle cx="210" cy="226" r="2" fill="#F6C430"/>
      <path d="M210 220 v12 M204 226 h12 M205.8 221.8 l8.4 8.4 M214.2 221.8 l-8.4 8.4" stroke="#8a6a4f" stroke-width="0.6"/>
      <circle cx="236" cy="226" r="6" fill="#5b4a3a" stroke="${OUT}" stroke-width="0.7"/><circle cx="236" cy="226" r="2" fill="#F6C430"/>
      <path d="M236 220 v12 M230 226 h12 M231.8 221.8 l8.4 8.4 M240.2 221.8 l-8.4 8.4" stroke="#8a6a4f" stroke-width="0.6"/>`,
  },
  bench: {
    base: 232,
    box: [198, 198, 50, 36],
    draw: () => `
      <ellipse cx="223" cy="232.5" rx="23" ry="2.4" fill="${SHADOW}"/>
      <path d="M206 219 V232 M240 219 V232" stroke="#7a5a40" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M208 204 V219 M238 204 V219" stroke="#8a6a4f" stroke-width="2" stroke-linecap="round"/>
      <rect x="203" y="203" width="40" height="4" rx="1.4" fill="#b98a5e" stroke="${OUT}" stroke-width="0.6"/>
      <rect x="203" y="209" width="40" height="3.4" rx="1.2" fill="#a87a50" stroke="${OUT}" stroke-width="0.6"/>
      <rect x="201" y="216.5" width="44" height="4.4" rx="1.6" fill="#c99a6a" stroke="${OUT}" stroke-width="0.7"/>
      <path d="M201 218.6 h44" stroke="#e8c49a" stroke-width="0.6"/>
      <path d="M205 216.6 q0 -3.6 4 -3.6 h8 q4 0 4 3.6 Z" fill="#F4A6C4" stroke="${OUT}" stroke-width="0.6"/>
      <path d="M209 215.2 h8" stroke="#fff" stroke-width="0.6" opacity="0.6"/>`,
  },
  festivalstage: {
    base: 232,
    box: [196, 186, 54, 50],
    draw: () => `
      <ellipse cx="223" cy="233" rx="27" ry="3" fill="${SHADOW}"/>
      <path d="M199 222 H247 V231 H199 Z" fill="#9a6a8e" stroke="${OUT}" stroke-width="0.8"/>
      <path d="M199 222 q8 4 12 0 q4 4 12 0 q4 4 12 0 q8 4 12 0" fill="#C9628E" stroke="${OUT}" stroke-width="0.5"/>
      <ellipse cx="223" cy="221.5" rx="24.5" ry="3" fill="#d9b48a" stroke="${OUT}" stroke-width="0.7"/>
      <path d="M203 221 V190 M243 221 V190" stroke="#8a6a4f" stroke-width="2" stroke-linecap="round"/>
      <path d="M203 191 Q223 199 243 191" stroke="#6b4a34" stroke-width="0.6" fill="none"/>
      <g>${[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 205.5 + i * 6.5;
        const y = 191.6 + Math.sin(((i + 0.5) / 6) * Math.PI) * 3.4;
        const c = ['#E5546C', '#F6C430', '#5B9BC4', '#6FB07C', '#9B7FD0', '#F08A3C'][i];
        return `<path d="M${f(x - 2.4)} ${f(y)} L${f(x + 2.4)} ${f(y)} L${f(x)} ${f(y + 4.6)} Z" fill="${c}"/>`;
      }).join('')}</g>
      <g class="sp-stage-lights">${[205, 211, 217, 223, 229, 235, 241].map((x, i) => `<circle class="sp-stage-light sp-stage-light--${i % 3}" cx="${x}" cy="${f(217.6 - (i === 3 ? 0.4 : 0))}" r="1.2" fill="#FFF3B0"/>`).join('')}</g>
      ${star(203, 188, 2.2, '#F6C430')}${star(243, 188, 2.2, '#F6C430')}`,
  },
  carousel: {
    base: 232,
    box: [196, 182, 54, 54],
    draw: () => `
      <ellipse cx="223" cy="232.5" rx="25" ry="3" fill="${SHADOW}"/>
      <ellipse cx="223" cy="228" rx="23" ry="4.6" fill="#e9d7b8" stroke="${OUT}" stroke-width="0.7"/>
      <path d="M200 228 v2.6 q23 7 46 0 V228" fill="#C9628E" stroke="${OUT}" stroke-width="0.6"/>
      <path d="M223 228 V194" stroke="#C9962A" stroke-width="2.4"/>
      <g class="sp-carousel-ride">
        ${[
          [208, 0],
          [238, 1],
          [223, 2],
        ]
          .map(([x, i]) => {
            const y = 214 + (i === 2 ? 2 : 0);
            const c = ['#ffffff', '#F6D27A', '#AFC9E8'][i];
            return `<g class="sp-pony sp-pony--${i}"><path d="M${x} 197 V226" stroke="#C9962A" stroke-width="0.9"/>
              <path d="M${x - 5} ${y} q0 -4 5 -4 h3 l2 -3 q2 0 2 2 l-1 3 q0 3 -3 3 h-6 q-2 0 -2 -1 Z" fill="${c}" stroke="${OUT}" stroke-width="0.6"/>
              <path d="M${x - 4} ${y} v3 M${x + 3} ${y} v3" stroke="${OUT}" stroke-width="0.9" stroke-linecap="round"/>
              <path d="M${x + 4} ${y - 7} q-1.6 -1 -2.6 0.6" stroke="#C9628E" stroke-width="0.9" fill="none"/></g>`;
          })
          .join('')}
      </g>
      <path d="M199 199 L223 184 L247 199 Z" fill="#E5546C" stroke="${OUT}" stroke-width="0.8"/>
      <path d="M207 194 L223 184 L215 199 Z M223 184 L231 199 L239 194 Z" fill="#fff6ea"/>
      <path d="M199 199 q4 3 8 0 q4 3 8 0 q4 3 8 0 q4 3 8 0 q4 3 8 0 q4 3 8 0" fill="#F6C430" stroke="${OUT}" stroke-width="0.5"/>
      ${star(223, 182.5, 2.2, '#F6C430')}`,
  },
  rainbowslide: {
    base: 232,
    box: [198, 194, 50, 40],
    draw: () => `
      <ellipse cx="223" cy="232.5" rx="24" ry="2.6" fill="${SHADOW}"/>
      <path d="M240 232 V200 M246 232 V200" stroke="#8a6a4f" stroke-width="1.6" stroke-linecap="round"/>
      <path d="M240 206 h6 M240 212 h6 M240 218 h6 M240 224 h6" stroke="#a87a50" stroke-width="1.1"/>
      <path d="M238 201 h9 v3 h-9 Z" fill="#b98a5e" stroke="${OUT}" stroke-width="0.6"/>
      ${['#E5546C', '#F08A3C', '#F6C430', '#6FB07C', '#5B9BC4', '#9B7FD0']
        .map((c, i) => `<path d="M${238.5} ${f(201.6 + i * 0.9)} C228 ${f(205 + i * 0.9)} 222 ${f(222 + i * 0.9)} ${f(202 - i * 0.2)} ${f(226.6 + i * 0.9)}" stroke="${c}" stroke-width="1.2" fill="none"/>`)
        .join('')}
      <path d="M238.5 201 C228 204.4 222 221.4 202 226" stroke="${OUT}" stroke-width="0.5" fill="none"/>
      <path d="M238.5 207 C228 210 222 227 201.6 231.8" stroke="${OUT}" stroke-width="0.5" fill="none"/>
      <path d="M204 231 V228 M216 229 v3" stroke="#8a6a4f" stroke-width="1.2"/>`,
  },
  // ---------------------------------------------------------------- the hill by the orchard (ground 140, far away)
  butterflygarden: {
    base: 140,
    box: [166, 108, 68, 36],
    draw: () => `
      <ellipse cx="200" cy="140" rx="31" ry="3.6" fill="#8a6a4f" opacity="0.55"/>
      <ellipse cx="200" cy="139" rx="30" ry="3" fill="#7a5a40" opacity="0.5"/>
      <g class="sp-sway">${Array.from({ length: 13 }, (_, i) => {
        const x = 173 + i * 4.4;
        const h = 9 + ((i * 7) % 5);
        const lav = i % 3 === 0;
        return lav
          ? `<path d="M${f(x)} 139 v-${h}" stroke="#6f9a4a" stroke-width="0.6"/><path d="M${f(x)} ${139 - h} v-4" stroke="#9B7FD0" stroke-width="1.6" stroke-linecap="round"/>`
          : `<path d="M${f(x)} 139 q0.6 -${h / 2} 0 -${h}" stroke="#6f9a4a" stroke-width="0.5" fill="none"/>${flower(x, 139 - h, ['#F4A6C4', '#ffffff', '#E5546C', '#F6D27A'][i % 4], 1.4)}`;
      }).join('')}</g>
      <g class="sp-bflies">${butterfly(184, 122, '#F08A3C', 0)}${butterfly(204, 116, '#5B9BC4', 1)}${butterfly(220, 123, '#F4A6C4', 2)}</g>`,
  },
  pumpkinpatch: {
    base: 140,
    box: [166, 116, 68, 28],
    draw: () => `
      <ellipse cx="200" cy="140.5" rx="31" ry="3" fill="${SHADOW}"/>
      <path d="M170 139 q8 -6 16 -1 q8 5 16 -1 q8 -5 16 0 q6 3 12 -1" stroke="#6F8A3E" stroke-width="0.9" fill="none"/>
      ${[
        [176, 134, 0],
        [196, 133, 25],
        [214, 134, -20],
        [228, 136, 40],
      ]
        .map(([x, y, r]) => leaf(x, y, r, 1.6, '#7FA34E'))
        .join('')}
      ${pumpkin(178, 140, 1.1)}${pumpkin(196, 140, 1.5)}${pumpkin(213, 140, 1.2)}${pumpkin(227, 140, 0.9)}`,
  },
  camptent: {
    base: 140,
    box: [170, 104, 60, 40],
    draw: () => `
      <ellipse cx="200" cy="140.5" rx="22" ry="2.6" fill="${SHADOW}"/>
      <path d="M180 140 L200 113 L220 140 Z" fill="#E8D5B0" stroke="${OUT}" stroke-width="0.8"/>
      <path d="M200 113 L192 140 H208 Z" fill="#5B7FB8" stroke="${OUT}" stroke-width="0.6"/>
      <path d="M200 113 L195 140 M200 113 L205 140" stroke="#4a6a9e" stroke-width="0.5"/>
      <path d="M200 140 L200 124" stroke="#2f3a52" stroke-width="2.4" opacity="0.35"/>
      <path d="M180 140 l-4 0.6 M220 140 l4 0.6" stroke="#8a6a4f" stroke-width="0.7"/>
      <path d="M200 113 V106" stroke="#8a6a4f" stroke-width="0.7"/>
      <g class="sp-sway"><path d="M200 106 L206 107.6 L200 109.2 Z" fill="#E5546C"/></g>
      <path d="M184 136 l6 -8 M216 136 l-6 -8" stroke="#d9c49a" stroke-width="0.5"/>`,
  },
  partytable: {
    base: 140,
    box: [168, 108, 64, 36],
    draw: () => `
      <ellipse cx="200" cy="140.5" rx="26" ry="2.6" fill="${SHADOW}"/>
      <path d="M176 113 V140 M224 113 V140" stroke="#8a6a4f" stroke-width="0.9"/>
      <path d="M176 114 Q200 122 224 114" stroke="#6b4a34" stroke-width="0.4" fill="none"/>
      ${[0, 1, 2, 3, 4, 5].map((i) => {
        const x = 179 + i * 8;
        const y = 115 + Math.sin(((i + 0.5) / 6) * Math.PI) * 3.2;
        return `<path d="M${f(x - 2)} ${f(y)} L${f(x + 2)} ${f(y)} L${f(x)} ${f(y + 3.6)} Z" fill="${['#E5546C', '#F6C430', '#5B9BC4', '#6FB07C', '#9B7FD0', '#F08A3C'][i]}"/>`;
      }).join('')}
      <path d="M184 133 V140 M216 133 V140" stroke="#7a5a40" stroke-width="1.2"/>
      <path d="M181 129 H219 V134 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 q-2.4 2 -4.8 0 Z" fill="#fff" stroke="${OUT}" stroke-width="0.5"/>
      <path d="M185 129 v4 M193 129 v4 M201 129 v4 M209 129 v4" stroke="#F4A6C4" stroke-width="1.6" opacity="0.7"/>
      <path d="M196 129 v-5 h8 v5 Z" fill="#F4A6C4" stroke="${OUT}" stroke-width="0.5"/><path d="M196 124 q4 2 8 0" stroke="#fff" stroke-width="0.8" fill="none"/>
      <path d="M200 124 v-2.6" stroke="#9DD6F0" stroke-width="0.7"/><path d="M200 121.4 q-0.8 -0.9 0 -2 q0.8 1.1 0 2 Z" fill="#F6A23A"/>
      <rect x="187" y="125.6" width="2.6" height="3.4" rx="0.5" fill="#5B9BC4"/><rect x="210" y="125.6" width="2.6" height="3.4" rx="0.5" fill="#6FB07C"/>`,
  },
  // ---------------------------------------------------------------- the corner by the big tree (ground 258, narrow)
  whirligig: {
    base: 258,
    box: [2, 204, 38, 56],
    draw: () => `
      <ellipse cx="20" cy="258.5" rx="9" ry="2" fill="${SHADOW}"/>
      <path d="M20 258 V222" stroke="#8a6a4f" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M14 258 l6 -10 l6 10" stroke="#a87a50" stroke-width="1" fill="none"/>
      <path d="M17 219 h7 l2 3 h-11 Z" fill="#E5546C" stroke="${OUT}" stroke-width="0.5"/>
      <path d="M24 219.6 l6 -1.6 v4 Z" fill="#F6C430" stroke="${OUT}" stroke-width="0.4"/>
      <g class="sp-whirl" style="transform-origin: 16px 220px">${['#F4A6C4', '#5B9BC4', '#F6C430', '#6FB07C']
        .map((c, i) => `<path d="M16 220 L${f(16 + Math.cos((i * Math.PI) / 2) * 9)} ${f(220 + Math.sin((i * Math.PI) / 2) * 9)} L${f(16 + Math.cos((i * Math.PI) / 2 + 0.5) * 8)} ${f(220 + Math.sin((i * Math.PI) / 2 + 0.5) * 8)} Z" fill="${c}" stroke="${OUT}" stroke-width="0.4"/>`)
        .join('')}<circle cx="16" cy="220" r="1.4" fill="#fff" stroke="${OUT}" stroke-width="0.4"/></g>
      <g class="sp-whirl-notes" opacity="0"><path d="M30 212 v-6 q2 1 2.6 2.6" stroke="#287b70" stroke-width="0.7" fill="none"/><ellipse cx="29.4" cy="212.4" rx="1.3" ry="1" fill="#287b70"/></g>`,
  },
  cornshocks: {
    base: 258,
    box: [2, 210, 38, 50],
    draw: () => `
      <ellipse cx="20" cy="258.5" rx="16" ry="2.2" fill="${SHADOW}"/>
      ${[
        [11, 216, 258, 7],
        [28, 222, 258, 7],
      ]
        .map(
          ([x, top, bot, w]) => `<g>${Array.from({ length: 7 }, (_, i) => {
            const bx = x - w + (i * 2 * w) / 6;
            return `<path d="M${f(bx)} ${bot} L${f(x + (i - 3) * 0.6)} ${top}" stroke="${i % 2 ? '#D9B46A' : '#C9A04A'}" stroke-width="1.4"/>`;
          }).join('')}
          <path d="M${x - 3} ${top + 12} h6" stroke="#8a6a4f" stroke-width="1.1"/>
          <path d="M${x} ${top} q-3 -3 -5 -2 M${x} ${top} q3 -4 5 -2" stroke="#D9B46A" stroke-width="0.9" fill="none"/></g>`,
        )
        .join('')}
      <ellipse cx="34" cy="255" rx="3" ry="2" fill="#F0913A" stroke="${OUT}" stroke-width="0.4"/>`,
  },
  starlanterns: {
    base: 258,
    box: [2, 206, 38, 54],
    draw: () => `
      <ellipse cx="16" cy="258.5" rx="8" ry="2" fill="${SHADOW}"/>
      <path d="M14 258 V218 Q14 211 22 210 Q30 210 34 214" stroke="#8a6a4f" stroke-width="1.8" fill="none" stroke-linecap="round"/>
      <path d="M22 210.4 v6 M30 211.4 v10 M35 214.4 v4" stroke="#6b4a34" stroke-width="0.4"/>
      <g class="sp-glow">${[
        [22, 220, '#FFE08A'],
        [30, 225, '#F4A6C4'],
        [35, 222, '#AFC9E8'],
      ]
        .map(([x, y, c]) => `<circle cx="${x}" cy="${y}" r="5.4" fill="${c}" opacity="0.25"/>${star(x as number, y as number, 3.6, c as string, `stroke="${OUT}" stroke-width="0.4"`)}`)
        .join('')}</g>`,
  },
  barnbell: {
    base: 258,
    box: [2, 208, 38, 52],
    draw: () => `
      <ellipse cx="20" cy="258.5" rx="9" ry="2" fill="${SHADOW}"/>
      <path d="M12 258 V214 M28 258 V214" stroke="#8a6a4f" stroke-width="1.8" stroke-linecap="round"/>
      <path d="M10 214 H30" stroke="#7a5a40" stroke-width="2.4" stroke-linecap="round"/>
      <path d="M12 212 L20 207 L28 212" stroke="#9a7352" stroke-width="1.2" fill="none"/>
      <g class="sp-bell" style="transform-origin: 20px 215px">
        <path d="M20 215 v2" stroke="#6b4a34" stroke-width="0.6"/>
        <path d="M14.4 228 q0 -11 5.6 -11 q5.6 0 5.6 11 Z" fill="#E2B046" stroke="#9A6F1E" stroke-width="0.7"/>
        <path d="M13.6 228 h12.8" stroke="#C9962A" stroke-width="1.4" stroke-linecap="round"/>
        <circle cx="20" cy="229.6" r="1.4" fill="#9A6F1E"/>
        <path d="M17 221 q0.4 -2.6 2 -3" stroke="#FFF3B0" stroke-width="0.8" fill="none" stroke-linecap="round"/>
      </g>
      <path d="M20 230 q1 8 -1 14" stroke="#e8dcc0" stroke-width="0.6" fill="none"/>`,
  },
  bubblemachine: {
    base: 258,
    box: [2, 214, 38, 46],
    draw: () => `
      <ellipse cx="18" cy="258.5" rx="12" ry="2" fill="${SHADOW}"/>
      <rect x="8" y="245" width="20" height="13" rx="2.4" fill="#7FB0D8" stroke="${OUT}" stroke-width="0.7"/>
      <path d="M8 249 h20" stroke="#5b8fbd" stroke-width="0.6"/>
      <circle cx="13" cy="253.5" r="2" fill="#F6C430" stroke="${OUT}" stroke-width="0.4"/><circle cx="20" cy="253.5" r="1.2" fill="#E5546C"/>
      <path d="M26 246 l5 -5" stroke="#9aa3a8" stroke-width="1.2" stroke-linecap="round"/>
      <circle cx="32.4" cy="239.6" r="2.4" fill="none" stroke="#9aa3a8" stroke-width="0.8"/>
      <g class="sp-bubbles">${[
        [30, 232, 2.6],
        [24, 226, 2],
        [34, 222, 1.6],
        [27, 216, 2.2],
      ]
        .map(([x, y, r], i) => `<g class="sp-bubble sp-bubble--${i}"><circle cx="${x}" cy="${y}" r="${r}" fill="#cfeaf7" fill-opacity="0.35" stroke="#ffffff" stroke-width="0.6"/><circle cx="${(x as number) - (r as number) * 0.35}" cy="${(y as number) - (r as number) * 0.35}" r="${f((r as number) * 0.25)}" fill="#fff"/></g>`)
        .join('')}</g>`,
  },
  // ---------------------------------------------------------------- the pond (stage 3 on)
  duckfountain: {
    base: 278,
    box: [84, 246, 30, 34],
    draw: () => `
      <ellipse cx="98" cy="277" rx="11" ry="2.6" fill="#7fb7cf" opacity="0.6"/>
      <path d="M88 274 q10 5 20 0 v2 q-10 5 -20 0 Z" fill="#b8b2a8" stroke="${OUT}" stroke-width="0.6"/>
      <ellipse cx="98" cy="274" rx="10" ry="2.4" fill="#cfc9be" stroke="${OUT}" stroke-width="0.6"/>
      <ellipse cx="98" cy="274" rx="8" ry="1.6" fill="#a7d3e4"/>
      <path d="M96 274 V262 h4 V274" fill="#cfc9be" stroke="${OUT}" stroke-width="0.6"/>
      <ellipse cx="98" cy="262" rx="5" ry="1.4" fill="#cfc9be" stroke="${OUT}" stroke-width="0.6"/>
      <path d="M95.4 260.6 q0 -3.6 3.6 -3.6 q2.6 0 2.6 2.4 l2 0.4 l-2 1 q-0.6 1.8 -3 1.8 h-2.6 Z" fill="#fff8e6" stroke="${OUT}" stroke-width="0.5"/>
      <circle cx="99.6" cy="258.6" r="0.5" fill="#2f2a27"/>
      <g class="sp-water" stroke="#ffffff" stroke-width="0.8" fill="none" stroke-linecap="round" opacity="0.85"><path d="M93 263 q-3 4 -3 10"/><path d="M103 263 q3 4 3 10"/><path d="M96 258 q-1 -3 -2 -4"/><path d="M100 258 q1 -3 2 -4"/></g>`,
  },
  // ---------------------------------------------------------------- one more in each other home
  windchimes: {
    // The Pet Garden: hung from the cottage's right eave, above everyone.
    base: 141,
    box: [280, 90, 24, 40],
    draw: () => `
      <path d="M291 92 v4" stroke="#8a6a4f" stroke-width="0.6"/>
      <g class="sp-chimes" style="transform-origin: 291px 95px">
        <ellipse cx="291" cy="97" rx="6" ry="1.6" fill="#b98a5e" stroke="${OUT}" stroke-width="0.5"/>
        ${[
          [286.5, 12],
          [289, 16],
          [291.5, 19],
          [294, 15],
          [296, 11],
        ]
          .map(([x, l]) => `<path d="M${x} 97.6 v3" stroke="#9aa3a8" stroke-width="0.3"/><rect x="${f(x - 0.7)}" y="100.6" width="1.4" height="${l}" rx="0.6" fill="#dfe6ea" stroke="#9aa3a8" stroke-width="0.4"/>`)
          .join('')}
        <path d="M291 97.6 v24" stroke="#9aa3a8" stroke-width="0.3"/>
        <circle cx="291" cy="112" r="1.6" fill="#b98a5e"/>
        <path d="M291 122 q-3 3 0 7 q3 -4 0 -7 Z" fill="#9BD27A" stroke="#5E9C4A" stroke-width="0.4"/>
      </g>`,
  },
  redrockslide: {
    // The Outback: on the open sand at the right.
    base: 246,
    box: [290, 190, 66, 60],
    draw: () => `
      <ellipse cx="322" cy="246.5" rx="30" ry="3" fill="${SHADOW}"/>
      <path d="M296 246 C306 240 322 220 338 200 C344 194 350 196 352 204 L354 246 Z" fill="#C8643E" stroke="${OUT}" stroke-width="0.8"/>
      <path d="M300 243 C310 237 324 219 339 202" stroke="#E08A5E" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.9"/>
      <path d="M340 214 l6 3 M336 226 l9 2 M330 236 l10 1" stroke="#A84E2E" stroke-width="0.7" opacity="0.7"/>
      <path d="M346 200 l4 -2 M348 203 l4 -1" stroke="#8a6a4f" stroke-width="0.6"/>`,
  },
  drumcircle: {
    // The Savanna: in the shade between the rocks and the pavilion.
    base: 236,
    box: [108, 204, 68, 36],
    draw: () => {
      const drum = (x: number, y: number, w: number, h: number, c: string, i: number) => `<g class="sp-drum sp-drum--${i}">
        <path d="M${x - w / 2} ${y - h} L${x - w / 2 + 2} ${y} H${x + w / 2 - 2} L${x + w / 2} ${y - h} Z" fill="${c}" stroke="${OUT}" stroke-width="0.7"/>
        <path d="M${x - w / 2 + 1} ${y - h + 2} L${x} ${y - 2} L${x + w / 2 - 1} ${y - h + 2}" stroke="#f6e8cc" stroke-width="0.7" fill="none"/>
        <ellipse cx="${x}" cy="${y - h}" rx="${w / 2}" ry="2" fill="#f2e2c4" stroke="${OUT}" stroke-width="0.7"/></g>`;
      return `<ellipse cx="141" cy="236.5" rx="30" ry="2.8" fill="${SHADOW}"/>
        ${drum(122, 235, 12, 14, '#C9763E', 0)}${drum(141, 236, 14, 18, '#9a5a3a', 1)}${drum(160, 235, 11, 12, '#D99A4E', 2)}`;
    },
  },
  sledhill: {
    // The Arctic: a slope between the owl's rock and the frozen pond.
    base: 250,
    box: [100, 196, 92, 58],
    draw: () => `
      <path d="M104 250 C118 242 132 214 146 206 C152 203 158 206 166 216 C174 228 182 242 190 250 Z" fill="#f3f8fc" stroke="#c7d6e4" stroke-width="0.9"/>
      <path d="M146 210 C158 214 170 232 186 248" stroke="#dde9f3" stroke-width="2.4" fill="none"/>
      <path d="M150 212 l4 6 M160 222 l3 4" stroke="#c7d6e4" stroke-width="0.6"/>
      <g class="sp-sled"><path d="M139 204 h14 l2 3 h-16 Z" fill="#E5546C" stroke="${OUT}" stroke-width="0.6"/><path d="M138 208 h18 q2 0 3 -2" stroke="#8a6a4f" stroke-width="0.9" fill="none"/><path d="M143 207 v1.4 M151 207 v1.4" stroke="#8a6a4f" stroke-width="0.7"/></g>`,
  },
  vineswing: {
    // The Amazon: hanging from the rope bridge, above the path.
    base: 196,
    box: [100, 100, 46, 100],
    draw: () => `
      <ellipse cx="122" cy="196" rx="10" ry="1.8" fill="${SHADOW}"/>
      <g class="sp-vine" style="transform-origin: 122px 108px">
        <path d="M112 110 Q110 150 114 186 M132 108 Q134 150 130 186" stroke="#5E8A3E" stroke-width="1.2" fill="none"/>
        ${[120, 136, 152, 168].map((y, i) => leaf(i % 2 ? 112.6 : 131.6, y, i % 2 ? -30 : 30, 1.2, '#7DBF6A')).join('')}
        <path d="M111 186 h22 q-2 4 -11 4 q-9 0 -11 -4 Z" fill="#9BD27A" stroke="${OUT}" stroke-width="0.6"/>
        <path d="M113 187 q9 3 18 0" stroke="#5E9C4A" stroke-width="0.5" fill="none"/>
        ${flower(112, 112, '#F4A6C4', 1.6)}${flower(132, 110, '#ffffff', 1.4)}
      </g>`,
  },
};

export function isD48Decor(id: string): id is D48DecorId {
  return id in D48_DECOR_ART;
}
