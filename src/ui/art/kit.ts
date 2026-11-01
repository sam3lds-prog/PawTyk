/**
 * The animal kit (D39 PR E): draws any species of the endless world from its parts (`meta/catalogs/species/types.ts`)
 * in the storybook style of the hand-drawn animals: a 64×64 head with the same face rig (so a kit animal's board tile
 * blinks, glances and grins like everyone else's), and a scene figure on one of a dozen bodies.
 *
 * Colors: `fur` is the coat, `light` the belly, muzzle and inner ears, `dark` the nose, hooves and fine details, and
 * `accent` every marking (stripes, spots, a mask, a crest). `head` colors a head unlike its body.
 */

import type { FaceOpts, HeadDef, Pal } from './companions';
import type { KitColors, KitTail, SpeciesDef } from '../../meta/catalogs/species/types';

const OUT = 'rgba(40,52,52,0.32)';
const SHADOW = 'rgba(40,52,52,0.13)';
const INK = '#2F2A27';
const HORN = '#EADFC8';
const ANTLER = '#B98B5E';
const BEAK = '#F2A23A';

const f1 = (n: number) => n.toFixed(1);

/** Relative luminance of a #RRGGBB color (0 black … 1 white). */
function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const c = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
const ol = (w = 1) => `stroke="${OUT}" stroke-width="${w}"`;

export type KitPal = Pal & { head?: string };

/** The palette a kit animal is drawn in (its species' colors or one of its coats). */
export function kitPal(c: KitColors): KitPal {
  return { fur: c.fur, light: c.light, dark: c.dark, accent: c.accent, ...(c.head ? { head: c.head } : {}) };
}

/** The head's own fur: its head color when it has one (a bald eagle's white head). */
const headFur = (p: KitPal) => p.head ?? p.fur;

interface Geo {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  top: number;
  bottom: number;
}

function geo(s: SpeciesDef): Geo {
  const [cy, rx, ry] =
    s.head === 'wide' ? [36, 22.5, 17.5] : s.head === 'tall' ? [34, 17.5, 20] : s.head === 'small' ? [36, 16.5, 15.5] : [35, 20, 18.5];
  return { cx: 32, cy, rx, ry, top: cy - ry, bottom: cy + ry };
}

const isBeaked = (s: SpeciesDef) => ['beak', 'hook', 'longbeak', 'duck', 'bigbeak'].includes(s.snout);
const HORNED = ['horns', 'curved', 'straight', 'spiral', 'antlers', 'moose', 'ossicones'];

/** Eye line: higher for long faces and snouts. */
function eyeY(s: SpeciesDef, g: Geo): number {
  if (s.eyes === 'bulge') return g.top + 1.5;
  const up = ['fox', 'muzzle', 'long', 'trunk', 'croc', 'longbeak', 'duck', 'hook', 'pig'].includes(s.snout) ? 2.4 : 0;
  return g.cy - g.ry * 0.12 - up;
}

// ------------------------------------------------------------------ ears

function ears(s: SpeciesDef, p0: KitPal, g: Geo): string {
  const { cx, cy, rx, top } = g;
  const p = { ...p0, fur: s.extras.includes('darkears') ? p0.accent : headFur(p0) };
  const both = (draw: (side: -1 | 1) => string) => draw(-1) + draw(1);
  switch (s.ears) {
    case 'pointed':
    case 'tufted':
    case 'fan': {
      const fan = s.ears === 'fan';
      return both((d) => {
        const b1 = [cx + d * rx * 0.92, cy - g.ry * (fan ? 0.15 : 0.3)];
        const b2 = [cx + d * rx * 0.22, top + 1.5];
        const tip = [cx + d * rx * (fan ? 1.2 : 0.8), top - (fan ? 17 : 10)];
        const i1 = [b1[0] * 0.75 + tip[0] * 0.25 - d * 1.5, b1[1] * 0.7 + tip[1] * 0.3];
        const i2 = [b2[0] * 0.75 + tip[0] * 0.25 + d * 1, b2[1] * 0.75 + tip[1] * 0.25];
        const it = [tip[0] * 0.85 + (b1[0] + b2[0]) * 0.075, tip[1] * 0.8 + (b1[1] + b2[1]) * 0.1];
        const tuft =
          s.ears === 'tufted'
            ? `<path d="M${f1(tip[0])} ${f1(tip[1] + 1)} l${f1(d * 0.6)} -6" stroke="${p.dark}" stroke-width="2" stroke-linecap="round"/>`
            : '';
        return `<path d="M${f1(b1[0])} ${f1(b1[1])} L${f1(tip[0])} ${f1(tip[1])} L${f1(b2[0])} ${f1(b2[1])} Z" fill="${p.fur}" ${ol()} stroke-linejoin="round"/><path d="M${f1(i1[0])} ${f1(i1[1])} L${f1(it[0])} ${f1(it[1])} L${f1(i2[0])} ${f1(i2[1])} Z" fill="${p.light}" opacity=".9"/>${tuft}`;
      });
    }
    case 'round':
    case 'small':
    case 'mouse': {
      const r = s.ears === 'mouse' ? 10.5 : s.ears === 'small' ? 4 : 6.8;
      const dx = s.ears === 'mouse' ? rx * 0.82 : s.ears === 'small' ? rx * 0.62 : rx * 0.74;
      const y = top + (s.ears === 'mouse' ? 3 : s.ears === 'small' ? 2.5 : 3.5);
      return both(
        (d) =>
          `<circle cx="${f1(cx + d * dx)}" cy="${f1(y)}" r="${r}" fill="${p.fur}" ${ol()}/><circle cx="${f1(cx + d * dx * 1.02)}" cy="${f1(y + 0.4)}" r="${f1(r * 0.52)}" fill="${s.extras.includes('darkears') ? p.dark : p.light}"/>`,
      );
    }
    case 'long':
      return both(
        (d) =>
          `<ellipse cx="${f1(cx + d * 9)}" cy="${f1(top - 7)}" rx="5.4" ry="13" transform="rotate(${d * 11} ${f1(cx + d * 9)} ${f1(top - 7)})" fill="${p.fur}" ${ol()}/><ellipse cx="${f1(cx + d * 9.1)}" cy="${f1(top - 6)}" rx="2.6" ry="9.4" transform="rotate(${d * 11} ${f1(cx + d * 9.1)} ${f1(top - 6)})" fill="${p.light}"/>`,
      );
    case 'floppy':
      return both(
        (d) =>
          `<ellipse cx="${f1(cx + d * rx * 0.92)}" cy="${f1(cy - 2)}" rx="6.2" ry="12.5" transform="rotate(${d * -16} ${f1(cx + d * rx * 0.92)} ${f1(cy - 2)})" fill="${p.dark}" opacity=".92" ${ol()}/>`,
      );
    case 'giant':
      return both(
        (d) =>
          `<ellipse cx="${f1(cx + d * (rx + 1))}" cy="${f1(cy - 2)}" rx="11" ry="14.5" fill="${p.fur}" ${ol()}/><ellipse cx="${f1(cx + d * (rx + 0.2))}" cy="${f1(cy - 2)}" rx="7" ry="10" fill="${p.light}" opacity=".8"/>`,
      );
    case 'side':
      return both(
        (d) =>
          `<ellipse cx="${f1(cx + d * (rx + 1.5))}" cy="${f1(cy - 4)}" rx="8" ry="4" transform="rotate(${d * 18} ${f1(cx + d * (rx + 1.5))} ${f1(cy - 4)})" fill="${p.fur}" ${ol()}/><ellipse cx="${f1(cx + d * (rx + 0.8))}" cy="${f1(cy - 4)}" rx="4.6" ry="2" transform="rotate(${d * 18} ${f1(cx + d * (rx + 0.8))} ${f1(cy - 4)})" fill="${p.light}"/>`,
      );
    default:
      return '';
  }
}

// ------------------------------------------------------------------ crowns (behind or on top of the head)

/** Parts drawn behind the head (a mane, quills, a frill). */
function crownBehind(s: SpeciesDef, p: KitPal, g: Geo): string {
  const { cx, cy, rx, ry } = g;
  if (s.crown === 'mane') {
    const pts: string[] = [];
    const R = Math.max(rx, ry) + 7.5;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      pts.push(`<circle cx="${f1(cx + Math.cos(a) * R * 0.92)}" cy="${f1(cy + 1 + Math.sin(a) * R * 0.88)}" r="6.4"/>`);
    }
    return `<g fill="${p.accent}" ${ol(0.8)}>${pts.join('')}</g><ellipse cx="${cx}" cy="${cy + 1}" rx="${f1(R * 0.9)}" ry="${f1(R * 0.86)}" fill="${p.accent}"/>`;
  }
  if (s.crown === 'quills') {
    const out: string[] = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (1.02 + (i / 10) * 0.96);
      const x1 = cx + Math.cos(a) * rx * 0.85;
      const y1 = cy + Math.sin(a) * ry * 0.85;
      const x2 = cx + Math.cos(a) * (rx + 9);
      const y2 = cy + Math.sin(a) * (ry + 9);
      const xa = cx + Math.cos(a - 0.12) * rx * 0.9;
      const ya = cy + Math.sin(a - 0.12) * ry * 0.9;
      out.push(`<path d="M${f1(xa)} ${f1(ya)} L${f1(x2)} ${f1(y2)} L${f1(x1)} ${f1(y1)} Z"/>`);
    }
    return `<g fill="${p.accent}" ${ol(0.7)} stroke-linejoin="round">${out.join('')}</g>`;
  }
  if (s.crown === 'frill') {
    const R = rx + 11;
    const ribs: string[] = [];
    for (let i = 0; i <= 8; i++) {
      const a = Math.PI * (1.05 + (i / 8) * 0.9);
      ribs.push(`<path d="M${cx} ${cy} L${f1(cx + Math.cos(a) * R)} ${f1(cy + Math.sin(a) * R)}"/>`);
    }
    return `<path d="M${f1(cx - R)} ${f1(cy + 6)} A${R} ${R} 0 0 1 ${f1(cx + R)} ${f1(cy + 6)} Z" fill="${p.accent}" ${ol()}/><g stroke="${p.dark}" stroke-width="1" opacity=".45">${ribs.join('')}</g>`;
  }
  return '';
}

/** Parts drawn on top of the head (horns, antlers, a crest). */
function crownOn(s: SpeciesDef, p: KitPal, g: Geo): string {
  const { cx, rx, top } = g;
  const both = (draw: (d: -1 | 1) => string) => draw(-1) + draw(1);
  switch (s.crown) {
    case 'horns':
      return both(
        (d) =>
          `<path d="M${f1(cx + d * 7)} ${f1(top + 4)} C${f1(cx + d * 9)} ${f1(top - 3)} ${f1(cx + d * 14)} ${f1(top - 5)} ${f1(cx + d * 16)} ${f1(top - 8)} C${f1(cx + d * 15)} ${f1(top - 2)} ${f1(cx + d * 13)} ${f1(top + 3)} ${f1(cx + d * 12)} ${f1(top + 5)} Z" fill="${HORN}" ${ol(0.9)}/>`,
      );
    case 'curved':
      return both(
        (d) =>
          `<path d="M${f1(cx + d * 4)} ${f1(top + 3)} C${f1(cx + d * 3)} ${f1(top - 8)} ${f1(cx + d * 9)} ${f1(top - 16)} ${f1(cx + d * 17)} ${f1(top - 15)} C${f1(cx + d * 11)} ${f1(top - 11)} ${f1(cx + d * 9)} ${f1(top - 4)} ${f1(cx + d * 9.5)} ${f1(top + 4)} Z" fill="#CDBB9C" ${ol(0.9)}/><path d="M${f1(cx + d * 5.5)} ${f1(top - 3)} l${d * 3} -1 M${f1(cx + d * 6.5)} ${f1(top - 8)} l${d * 3} -1.5" stroke="${OUT}" stroke-width=".8"/>`,
      );
    case 'ram':
      return both(
        (d) =>
          `<g transform="translate(${f1(cx + d * (rx - 1))} ${f1(top + 9)})"><circle r="8.4" fill="#D8C7A8" ${ol(0.9)}/><path d="M0 -5.4 A5.4 5.4 0 1 ${d > 0 ? 1 : 0} ${f1(d * 5)} 2 A3 3 0 1 ${d > 0 ? 1 : 0} ${f1(d * 1)} -1" fill="none" stroke="#A8916E" stroke-width="1.6" stroke-linecap="round"/></g>`,
      );
    case 'straight':
    case 'spiral':
      return both((d) => {
        const x0 = cx + d * 5;
        const x1 = cx + d * 11;
        const y1 = top - 22;
        const rings =
          s.crown === 'spiral'
            ? [0.25, 0.45, 0.65, 0.82].map((t) => `<path d="M${f1(x0 + (x1 - x0) * t - 1.8)} ${f1(top + 2 + (y1 - top - 2) * t + 0.8)} l3.6 -1.4" stroke="${OUT}" stroke-width=".9"/>`).join('')
            : '';
        return `<path d="M${f1(x0 - d * 1.8)} ${f1(top + 3)} L${f1(x1)} ${f1(y1)} L${f1(x0 + d * 1.8)} ${f1(top + 3)} Z" fill="${s.crown === 'spiral' ? '#4E3E33' : '#3E3833'}" ${ol(0.8)} stroke-linejoin="round"/>${rings}`;
      });
    case 'antlers':
      return both(
        (d) =>
          `<g fill="none" stroke="${ANTLER}" stroke-width="2.4" stroke-linecap="round"><path d="M${f1(cx + d * 8)} ${f1(top + 3)} C${f1(cx + d * 10)} ${f1(top - 6)} ${f1(cx + d * 15)} ${f1(top - 11)} ${f1(cx + d * 19)} ${f1(top - 17)}"/><path d="M${f1(cx + d * 11)} ${f1(top - 4)} l${d * -2} -6"/><path d="M${f1(cx + d * 15)} ${f1(top - 10)} l${d * -1} -6"/><path d="M${f1(cx + d * 13.5)} ${f1(top - 8)} l${d * 5} 1"/></g>`,
      );
    case 'moose':
      return both(
        (d) =>
          `<path d="M${f1(cx + d * 9)} ${f1(top + 3)} C${f1(cx + d * 12)} ${f1(top - 2)} ${f1(cx + d * 16)} ${f1(top - 4)} ${f1(cx + d * 20)} ${f1(top - 3)} L${f1(cx + d * 24)} ${f1(top - 13)} L${f1(cx + d * 21)} ${f1(top - 10)} L${f1(cx + d * 20)} ${f1(top - 16)} L${f1(cx + d * 17)} ${f1(top - 11)} L${f1(cx + d * 14.5)} ${f1(top - 15)} L${f1(cx + d * 13)} ${f1(top - 7)} C${f1(cx + d * 12)} ${f1(top - 3)} ${f1(cx + d * 10)} ${f1(top)} ${f1(cx + d * 8)} ${f1(top + 2)} Z" fill="#C9A67C" ${ol(0.9)} stroke-linejoin="round"/>`,
      );
    case 'ossicones':
      return both(
        (d) =>
          `<path d="M${f1(cx + d * 6)} ${f1(top + 3)} L${f1(cx + d * 7.5)} ${f1(top - 7)}" stroke="${headFur(p)}" stroke-width="3.2" stroke-linecap="round"/><circle cx="${f1(cx + d * 7.7)}" cy="${f1(top - 7.6)}" r="2.6" fill="${p.dark}"/>`,
      );
    case 'crest': {
      const fs = [-2, -1, 0, 1, 2].map((i) => {
        const a = -Math.PI / 2 + i * 0.32;
        const x2 = cx + Math.cos(a) * 15 + i * 0.5;
        const y2 = top + 4 + Math.sin(a) * 15;
        return `<path d="M${f1(cx + i * 2)} ${f1(top + 4)} Q${f1((cx + x2) / 2 + i * 1.5)} ${f1((top + 4 + y2) / 2 - 2)} ${f1(x2)} ${f1(y2)} Q${f1((cx + x2) / 2 - i * 0.5 + 1.6)} ${f1((top + 4 + y2) / 2 + 1)} ${f1(cx + i * 2 + 2.4)} ${f1(top + 5)} Z"/>`;
      });
      return `<g fill="${p.accent}" ${ol(0.7)}>${fs.join('')}</g>`;
    }
    case 'tufts':
      return both(
        (d) =>
          `<path d="M${f1(cx + d * rx * 0.55)} ${f1(top + 3.5)} L${f1(cx + d * rx * 0.78)} ${f1(top - 8)} L${f1(cx + d * rx * 0.95)} ${f1(top + 6)} Z" fill="${headFur(p)}" ${ol()} stroke-linejoin="round"/><path d="M${f1(cx + d * rx * 0.68)} ${f1(top + 3)} L${f1(cx + d * rx * 0.78)} ${f1(top - 4)} L${f1(cx + d * rx * 0.86)} ${f1(top + 4)} Z" fill="${p.dark}" opacity=".55"/>`,
      );
    case 'topknot':
      return `<g fill="${p.accent}" ${ol(0.8)}><circle cx="${cx - 4}" cy="${f1(top + 1.5)}" r="4.4"/><circle cx="${cx + 4}" cy="${f1(top + 1.5)}" r="4.4"/><circle cx="${cx}" cy="${f1(top - 1.5)}" r="5"/></g>`;
    case 'comb':
      return `<path d="M${cx - 6} ${f1(top + 3)} q-1 -6 3 -6 q0 -4 3.6 -2.6 q2 -4 4.6 -.4 q4 -.6 2.4 4.6 q2.4 1.4 -.6 4.4 Z" fill="#E2463F" ${ol(0.8)}/>`;
    case 'casque':
      return `<path d="M${cx - 7} ${f1(top + 4)} C${cx - 6} ${f1(top - 7)} ${cx + 6} ${f1(top - 9)} ${cx + 7} ${f1(top + 4)} Z" fill="${p.accent}" ${ol(0.9)}/>`;
    case 'plume':
      return `<path d="M${cx} ${f1(top + 3)} C${cx - 1} ${f1(top - 6)} ${cx + 6} ${f1(top - 11)} ${cx + 10} ${f1(top - 8)} C${cx + 6} ${f1(top - 8)} ${cx + 3} ${f1(top - 4)} ${cx + 2} ${f1(top + 3)} Z" fill="${p.accent}" ${ol(0.8)}/><circle cx="${cx + 10}" cy="${f1(top - 8)}" r="2.4" fill="${p.accent}" ${ol(0.6)}/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ markings (on the head, under the face)

function marks(s: SpeciesDef, p: KitPal, g: Geo, ey: number): string {
  const { cx, cy, rx, ry, top } = g;
  const ex = rx * 0.37;
  const a = p.accent;
  switch (s.mark) {
    case 'mask':
      return `<path d="M${f1(cx - rx * 0.92)} ${f1(ey - 1)} C${f1(cx - rx * 0.6)} ${f1(ey - 7)} ${f1(cx - 3)} ${f1(ey - 5)} ${cx} ${f1(ey - 1)} C${f1(cx + 3)} ${f1(ey - 5)} ${f1(cx + rx * 0.6)} ${f1(ey - 7)} ${f1(cx + rx * 0.92)} ${f1(ey - 1)} C${f1(cx + rx * 0.7)} ${f1(ey + 6)} ${f1(cx + 3)} ${f1(ey + 5)} ${cx} ${f1(ey + 3)} C${f1(cx - 3)} ${f1(ey + 5)} ${f1(cx - rx * 0.7)} ${f1(ey + 6)} ${f1(cx - rx * 0.92)} ${f1(ey - 1)} Z" fill="${a}"/><path d="M${f1(cx - ex - 4)} ${f1(ey - 7)} q4 -2.4 8 0 M${f1(cx + ex - 4)} ${f1(ey - 7)} q4 -2.4 8 0" stroke="${p.light}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 'panda':
      return `<ellipse cx="${f1(cx - ex)}" cy="${f1(ey + 0.5)}" rx="5.4" ry="4.4" transform="rotate(22 ${f1(cx - ex)} ${f1(ey + 0.5)})" fill="${a}"/><ellipse cx="${f1(cx + ex)}" cy="${f1(ey + 0.5)}" rx="5.4" ry="4.4" transform="rotate(-22 ${f1(cx + ex)} ${f1(ey + 0.5)})" fill="${a}"/>`;
    case 'stripes': {
      const st = (x: number, y: number, r: number, l = 6) =>
        `<path d="M${f1(x)} ${f1(y)} q${f1(r * 1.2)} ${f1(l * 0.5)} ${f1(r * 0.4)} ${f1(l)}" stroke="${a}" stroke-width="1.9" fill="none" stroke-linecap="round"/>`;
      return [
        `<path d="M${cx - 3} ${f1(top + 2.5)} l1.4 5 M${cx} ${f1(top + 1.6)} v6.4 M${cx + 3} ${f1(top + 2.5)} l-1.4 5" stroke="${a}" stroke-width="1.8" stroke-linecap="round"/>`,
        st(cx - rx + 2.5, cy - 2, 1.4),
        st(cx - rx + 3.5, cy + 4, 1.6),
        st(cx + rx - 2.5, cy - 2, -1.4),
        st(cx + rx - 3.5, cy + 4, -1.6),
      ].join('');
    }
    case 'spots':
      return `<g fill="${a}" opacity=".85">${[
        [-0.5, -0.62, 1.6],
        [0.25, -0.7, 1.3],
        [0.55, -0.45, 1.5],
        [-0.72, 0.05, 1.4],
        [0.74, 0.1, 1.3],
        [-0.1, -0.85, 1.1],
      ]
        .map(([dx, dy, r]) => `<circle cx="${f1(cx + dx * rx)}" cy="${f1(cy + dy * ry)}" r="${r}"/>`)
        .join('')}</g>`;
    case 'rosettes':
      return `<g fill="none" stroke="${a}" stroke-width="1.2" opacity=".85">${[
        [-0.5, -0.6],
        [0.3, -0.72],
        [0.6, -0.38],
        [-0.74, 0.08],
        [0.76, 0.14],
      ]
        .map(([dx, dy]) => `<circle cx="${f1(cx + dx * rx)}" cy="${f1(cy + dy * ry)}" r="2" stroke-dasharray="3 1.2"/>`)
        .join('')}</g>`;
    case 'blaze':
      return `<path d="M${cx} ${f1(top + 2)} C${cx + 2.6} ${f1(top + 2)} ${cx + 2.8} ${f1(ey)} ${cx + 2.2} ${f1(cy + 5)} L${cx - 2.2} ${f1(cy + 5)} C${cx - 2.8} ${f1(ey)} ${cx - 2.6} ${f1(top + 2)} ${cx} ${f1(top + 2)} Z" fill="${p.light}"/>`;
    case 'badger':
      return `<path d="M${f1(cx - ex - 2.5)} ${f1(top + 1.5)} C${f1(cx - ex - 4.5)} ${f1(ey - 4)} ${f1(cx - ex - 3.5)} ${f1(ey + 4)} ${f1(cx - 4)} ${f1(cy + 7)} L${f1(cx - 2)} ${f1(cy + 7)} C${f1(cx - ex + 1.5)} ${f1(ey + 2)} ${f1(cx - ex + 2.5)} ${f1(ey - 5)} ${f1(cx - ex + 2.5)} ${f1(top + 0.8)} Z" fill="${a}"/><path d="M${f1(cx + ex + 2.5)} ${f1(top + 1.5)} C${f1(cx + ex + 4.5)} ${f1(ey - 4)} ${f1(cx + ex + 3.5)} ${f1(ey + 4)} ${f1(cx + 4)} ${f1(cy + 7)} L${f1(cx + 2)} ${f1(cy + 7)} C${f1(cx + ex - 1.5)} ${f1(ey + 2)} ${f1(cx + ex - 2.5)} ${f1(ey - 5)} ${f1(cx + ex - 2.5)} ${f1(top + 0.8)} Z" fill="${a}"/>`;
    case 'cheeks':
      return `<circle cx="${f1(cx - rx * 0.62)}" cy="${f1(ey + 6)}" r="4.2" fill="${a}"/><circle cx="${f1(cx + rx * 0.62)}" cy="${f1(ey + 6)}" r="4.2" fill="${a}"/>`;
    case 'cap':
      return `<path d="M${f1(cx - rx * 0.86)} ${f1(ey - 4)} C${f1(cx - rx * 0.8)} ${f1(top - 0.5)} ${f1(cx + rx * 0.8)} ${f1(top - 0.5)} ${f1(cx + rx * 0.86)} ${f1(ey - 4)} C${f1(cx + rx * 0.4)} ${f1(ey - 7)} ${f1(cx - rx * 0.4)} ${f1(ey - 7)} ${f1(cx - rx * 0.86)} ${f1(ey - 4)} Z" fill="${a}"/>`;
    case 'bib':
      return `<path d="M${f1(cx - rx * 0.98)} ${f1(cy + 1)} C${f1(cx - rx * 0.6)} ${f1(cy + ry * 0.75)} ${f1(cx - 4)} ${f1(cy + ry)} ${cx} ${f1(cy + ry)} C${f1(cx + 4)} ${f1(cy + ry)} ${f1(cx + rx * 0.6)} ${f1(cy + ry * 0.75)} ${f1(cx + rx * 0.98)} ${f1(cy + 1)} C${f1(cx + rx * 0.5)} ${f1(cy + 7)} ${f1(cx - rx * 0.5)} ${f1(cy + 7)} ${f1(cx - rx * 0.98)} ${f1(cy + 1)} Z" fill="${p.light}"/>`;
    case 'eyeline':
      return isBeaked(s)
        ? `<path d="M${f1(cx - ex - 2.6)} ${f1(ey + 0.6)} L${f1(cx - rx * 0.92)} ${f1(ey + 1.6)} M${f1(cx + ex + 2.6)} ${f1(ey + 0.6)} L${f1(cx + rx * 0.92)} ${f1(ey + 1.6)}" stroke="${a}" stroke-width="1.8" stroke-linecap="round"/>`
        : `<path d="M${f1(cx - ex + 1)} ${f1(ey + 3)} q-1.2 4 -3.8 8 M${f1(cx + ex - 1)} ${f1(ey + 3)} q1.2 4 3.8 8" stroke="${a}" stroke-width="1.8" fill="none" stroke-linecap="round"/>`;
    case 'hood':
      return `<path d="M${f1(cx - rx)} ${f1(cy + 2)} C${f1(cx - rx)} ${f1(top - 0.5)} ${f1(cx + rx)} ${f1(top - 0.5)} ${f1(cx + rx)} ${f1(cy + 2)} C${f1(cx + rx * 0.6)} ${f1(ey - 3)} ${f1(cx + 3)} ${f1(ey - 4)} ${cx} ${f1(ey - 1)} C${f1(cx - 3)} ${f1(ey - 4)} ${f1(cx - rx * 0.6)} ${f1(ey - 3)} ${f1(cx - rx)} ${f1(cy + 2)} Z" fill="${a}"/>`;
    case 'muzzle':
      return s.snout === 'ape' ? '' : `<ellipse cx="${cx}" cy="${f1(cy + ry * 0.45)}" rx="${f1(rx * 0.55)}" ry="${f1(ry * 0.42)}" fill="${a}"/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ snouts, noses and the face's own positions

interface SnoutOut {
  art: string; // drawn with the head
  nose: string; // part of the face's static layer
  mouthY: number | null;
  blushY: number;
}

function snout(s: SpeciesDef, p: KitPal, g: Geo, ey: number, beakColor: string): SnoutOut {
  const { cx, cy, rx, ry } = g;
  const by = ey + 6.5;
  switch (s.snout) {
    case 'cat':
      return {
        art: `<ellipse cx="${cx - 3.2}" cy="${f1(ey + 9.5)}" rx="4" ry="3.2" fill="${p.light}"/><ellipse cx="${cx + 3.2}" cy="${f1(ey + 9.5)}" rx="4" ry="3.2" fill="${p.light}"/>`,
        nose: `<path d="M${cx - 2.2} ${f1(ey + 6.2)} h4.4 q-.6 2 -2.2 2.4 q-1.6 -.4 -2.2 -2.4z" fill="${p.dark}"/>`,
        mouthY: ey + 11.4,
        blushY: by,
      };
    case 'dog':
    case 'bear': {
      const bear = s.snout === 'bear';
      return {
        art: `<ellipse cx="${cx}" cy="${f1(ey + 10.5)}" rx="${bear ? 9.5 : 8.4}" ry="${bear ? 7.2 : 6.6}" fill="${p.light}"/>`,
        nose: bear
          ? `<path d="M${cx - 3.8} ${f1(ey + 6.4)} h7.6 q-.8 3.6 -3.8 4.2 q-3 -.6 -3.8 -4.2z" fill="${p.dark}"/>`
          : `<ellipse cx="${cx}" cy="${f1(ey + 7.4)}" rx="3" ry="2.2" fill="${p.dark}"/>`,
        mouthY: ey + 13.2,
        blushY: by,
      };
    }
    case 'fox':
      return {
        art: `<path d="M${f1(cx - rx * 0.95)} ${f1(cy - 1)} C${f1(cx - rx * 0.55)} ${f1(cy + 8)} ${cx - 6} ${f1(cy + 11)} ${cx} ${f1(cy + ry - 0.5)} C${cx + 6} ${f1(cy + 11)} ${f1(cx + rx * 0.55)} ${f1(cy + 8)} ${f1(cx + rx * 0.95)} ${f1(cy - 1)} C${f1(cx + rx * 0.4)} ${f1(cy + 5)} ${f1(cx - rx * 0.4)} ${f1(cy + 5)} ${f1(cx - rx * 0.95)} ${f1(cy - 1)} Z" fill="${p.light}"/>`,
        nose: `<ellipse cx="${cx}" cy="${f1(ey + 9.6)}" rx="2.5" ry="1.8" fill="${p.dark}"/>`,
        mouthY: ey + 13,
        blushY: by,
      };
    case 'koala':
      return {
        art: '',
        nose: `<ellipse cx="${cx}" cy="${f1(ey + 7.5)}" rx="4.6" ry="5.8" fill="${p.dark}"/><ellipse cx="${cx - 1.4}" cy="${f1(ey + 5.4)}" rx="1.2" ry="1.7" fill="#fff" opacity=".35"/>`,
        mouthY: ey + 16,
        blushY: by,
      };
    case 'pig':
      return {
        art: `<ellipse cx="${cx}" cy="${f1(ey + 10)}" rx="7.6" ry="5.6" fill="${p.light}" stroke="${p.dark}" stroke-width=".9"/>`,
        nose: `<ellipse cx="${cx - 2.7}" cy="${f1(ey + 10)}" rx="1.4" ry="2" fill="${p.dark}"/><ellipse cx="${cx + 2.7}" cy="${f1(ey + 10)}" rx="1.4" ry="2" fill="${p.dark}"/>`,
        mouthY: ey + 17.5,
        blushY: by - 1,
      };
    case 'muzzle':
      return {
        art: `<rect x="${cx - 11.5}" y="${f1(ey + 5.5)}" width="23" height="${f1(Math.min(15, cy + ry + 1 - ey - 5.5))}" rx="7.5" fill="${p.light}" ${ol(0.7)}/>`,
        nose: `<ellipse cx="${cx - 4.4}" cy="${f1(ey + 11)}" rx="1.6" ry="1.2" fill="${p.dark}" opacity=".8"/><ellipse cx="${cx + 4.4}" cy="${f1(ey + 11)}" rx="1.6" ry="1.2" fill="${p.dark}" opacity=".8"/>`,
        mouthY: ey + 15.6,
        blushY: by - 1,
      };
    case 'long':
      return {
        art: `<path d="M${cx - 5} ${f1(ey + 4)} C${cx - 4.5} ${f1(ey + 12)} ${cx - 2.6} ${f1(ey + 19)} ${cx - 2} ${f1(ey + 23)} L${cx + 2} ${f1(ey + 23)} C${cx + 2.6} ${f1(ey + 19)} ${cx + 4.5} ${f1(ey + 12)} ${cx + 5} ${f1(ey + 4)} Z" fill="${headFur(p)}" ${ol(0.9)}/><path d="M${cx - 2.6} ${f1(ey + 10)} C${cx - 2} ${f1(ey + 15)} ${cx - 1.4} ${f1(ey + 19)} ${cx - 1.2} ${f1(ey + 22)} L${cx + 1.2} ${f1(ey + 22)} C${cx + 1.4} ${f1(ey + 19)} ${cx + 2} ${f1(ey + 15)} ${cx + 2.6} ${f1(ey + 10)} Z" fill="${p.light}" opacity=".7"/>`,
        nose: `<ellipse cx="${cx}" cy="${f1(ey + 23)}" rx="2.6" ry="1.7" fill="${p.dark}"/>`,
        mouthY: null,
        blushY: by,
      };
    case 'ape': {
      const skin = s.colors.face ?? p.light;
      // A dark muzzle sits on the bare face (drawn on top of it, not under it).
      const muzzle = s.mark === 'muzzle' ? `<ellipse cx="${cx}" cy="${f1(ey + 9.5)}" rx="7" ry="5.6" fill="${p.accent}"/>` : '';
      return {
        art: `<path d="M${cx} ${f1(ey - 7)} C${cx + 4} ${f1(ey - 9)} ${f1(cx + rx * 0.82)} ${f1(ey - 8)} ${f1(cx + rx * 0.8)} ${f1(ey + 1)} C${f1(cx + rx * 0.82)} ${f1(ey + 8)} ${cx + 9} ${f1(cy + ry - 1)} ${cx} ${f1(cy + ry - 1)} C${cx - 9} ${f1(cy + ry - 1)} ${f1(cx - rx * 0.82)} ${f1(ey + 8)} ${f1(cx - rx * 0.8)} ${f1(ey + 1)} C${f1(cx - rx * 0.82)} ${f1(ey - 8)} ${cx - 4} ${f1(ey - 9)} ${cx} ${f1(ey - 7)} Z" fill="${skin}"/>${muzzle}`,
        nose: `<ellipse cx="${cx - 1.6}" cy="${f1(ey + 7)}" rx="1" ry="1.4" fill="${p.dark}"/><ellipse cx="${cx + 1.6}" cy="${f1(ey + 7)}" rx="1" ry="1.4" fill="${p.dark}"/>`,
        mouthY: ey + 11.5,
        blushY: by,
      };
    }
    case 'beak':
      return {
        art: '',
        nose: `<path d="M${cx - 4} ${f1(ey + 4.6)} C${cx - 2} ${f1(ey + 3.4)} ${cx + 2} ${f1(ey + 3.4)} ${cx + 4} ${f1(ey + 4.6)} L${cx} ${f1(ey + 11)} Z" fill="${beakColor}" ${ol(0.7)} stroke-linejoin="round"/><path d="M${cx - 3} ${f1(ey + 6)} q3 1.2 6 0" stroke="${OUT}" stroke-width=".6" fill="none"/>`,
        mouthY: null,
        blushY: by,
      };
    case 'hook':
      return {
        art: '',
        nose: `<path d="M${cx - 4.6} ${f1(ey + 3.4)} C${cx - 2} ${f1(ey + 1.6)} ${cx + 4} ${f1(ey + 1.8)} ${cx + 5} ${f1(ey + 5.6)} C${cx + 5.4} ${f1(ey + 9)} ${cx + 3} ${f1(ey + 12.4)} ${cx + 0.6} ${f1(ey + 13)} C${cx + 1.6} ${f1(ey + 10.5)} ${cx + 1} ${f1(ey + 8.4)} ${cx - 1} ${f1(ey + 8)} C${cx - 3} ${f1(ey + 7.6)} ${cx - 4.8} ${f1(ey + 6)} ${cx - 4.6} ${f1(ey + 3.4)} Z" fill="${beakColor}" ${ol(0.7)}/>`,
        mouthY: null,
        blushY: by,
      };
    case 'longbeak':
      return {
        art: '',
        nose: `<path d="M${cx - 4} ${f1(ey + 4.2)} C${cx - 1.4} ${f1(ey + 3.2)} ${cx + 1.4} ${f1(ey + 3.2)} ${cx + 4} ${f1(ey + 4.2)} C${cx + 3} ${f1(ey + 12)} ${cx + 2.6} ${f1(ey + 18)} ${cx + 3.6} ${f1(ey + 24)} C${cx + 2.4} ${f1(ey + 24.8)} ${cx + 0.8} ${f1(ey + 24.4)} ${cx + 0.2} ${f1(ey + 23.2)} C${cx - 1} ${f1(ey + 18)} ${cx - 2.6} ${f1(ey + 11)} ${cx - 4} ${f1(ey + 4.2)} Z" fill="${beakColor}" ${ol(0.8)}/><path d="M${cx - 2.2} ${f1(ey + 6)} q2.2 .8 4.4 0" stroke="${OUT}" stroke-width=".6" fill="none"/>`,
        mouthY: null,
        blushY: by,
      };
    case 'duck':
      return {
        art: '',
        nose: `<path d="M${cx - 7.5} ${f1(ey + 5)} C${cx - 4} ${f1(ey + 3)} ${cx + 4} ${f1(ey + 3)} ${cx + 7.5} ${f1(ey + 5)} C${cx + 9} ${f1(ey + 10)} ${cx + 6} ${f1(ey + 13.5)} ${cx} ${f1(ey + 13.5)} C${cx - 6} ${f1(ey + 13.5)} ${cx - 9} ${f1(ey + 10)} ${cx - 7.5} ${f1(ey + 5)} Z" fill="${beakColor}" ${ol(0.7)}/><circle cx="${cx - 2}" cy="${f1(ey + 6.4)}" r=".7" fill="${OUT}"/><circle cx="${cx + 2}" cy="${f1(ey + 6.4)}" r=".7" fill="${OUT}"/><path d="M${cx - 6} ${f1(ey + 9.6)} q6 2.4 12 0" stroke="${OUT}" stroke-width=".6" fill="none"/>`,
        mouthY: null,
        blushY: by - 1,
      };
    case 'trunk':
      return {
        art: `<path d="M${cx - 4.5} ${f1(ey + 6)} C${cx - 5} ${f1(ey + 14)} ${cx - 4} ${f1(ey + 21)} ${cx - 1} ${f1(ey + 25)} C${cx + 1} ${f1(ey + 27.6)} ${cx + 5.2} ${f1(ey + 26.6)} ${cx + 4.6} ${f1(ey + 24)} C${cx + 3.2} ${f1(ey + 20)} ${cx + 3.6} ${f1(ey + 14)} ${cx + 4.6} ${f1(ey + 6)} Z" fill="${headFur(p)}" ${ol()}/><path d="M${cx - 3.6} ${f1(ey + 13)}h7M${cx - 3.2} ${f1(ey + 17)}h6.6M${cx - 2.2} ${f1(ey + 21)}h5.4" stroke="${p.dark}" stroke-width=".7" opacity=".45"/>`,
        nose: '',
        mouthY: null,
        blushY: by,
      };
    case 'croc': {
      const y0 = ey + 4;
      const y1 = Math.min(62, cy + ry + 6);
      const teeth: string[] = [];
      for (let y = y0 + 4; y < y1 - 3; y += 3.4) teeth.push(`<path d="M${cx - 8.6} ${f1(y)} l-1.6 1.4 1.6 1.2 M${cx + 8.6} ${f1(y)} l1.6 1.4 -1.6 1.2"/>`);
      return {
        art: `<path d="M${cx - 9} ${f1(y0)} C${cx - 9.5} ${f1(y0 + 8)} ${cx - 9} ${f1(y1 - 4)} ${cx - 6} ${f1(y1)} C${cx - 3} ${f1(y1 + 1.6)} ${cx + 3} ${f1(y1 + 1.6)} ${cx + 6} ${f1(y1)} C${cx + 9} ${f1(y1 - 4)} ${cx + 9.5} ${f1(y0 + 8)} ${cx + 9} ${f1(y0)} Z" fill="${headFur(p)}" ${ol()}/><g fill="#fff" stroke="${OUT}" stroke-width=".5">${teeth.join('')}</g><path d="M${cx - 6} ${f1(y0 + 6)} q6 -2 12 0" stroke="${p.accent}" stroke-width="1.2" fill="none" opacity=".7"/>`,
        nose: `<circle cx="${cx - 2.4}" cy="${f1(y1 - 3)}" r="1.1" fill="${p.dark}"/><circle cx="${cx + 2.4}" cy="${f1(y1 - 3)}" r="1.1" fill="${p.dark}"/>`,
        mouthY: null,
        blushY: by,
      };
    }
    case 'smile':
      return {
        art: '',
        nose: `<circle cx="${cx - 2.6}" cy="${f1(ey + 6)}" r=".9" fill="${p.dark}"/><circle cx="${cx + 2.6}" cy="${f1(ey + 6)}" r=".9" fill="${p.dark}"/>`,
        mouthY: ey + 10,
        blushY: by,
      };
    case 'flat':
    default:
      return {
        art: '',
        nose: `<ellipse cx="${cx}" cy="${f1(ey + 6.4)}" rx="2.2" ry="1.6" fill="${p.dark}"/>`,
        mouthY: ey + 10.4,
        blushY: by,
      };
  }
}

function extrasOnFace(s: SpeciesDef, p: KitPal, g: Geo, ey: number, mouthY: number | null, beakColor: string, only?: 'gills'): string {
  const { cx, cy, rx, ry } = g;
  const out: string[] = [];
  for (const x of s.extras) {
    if (only ? x !== only : x === 'gills') continue;
    if (x === 'whiskers')
      out.push(
        `<g stroke="${p.dark}" stroke-width=".7" opacity=".45" stroke-linecap="round"><path d="M${cx - 7} ${f1(ey + 9)} l-9 -1.6M${cx - 7} ${f1(ey + 10.6)} l-9 1.2M${cx + 7} ${f1(ey + 9)} l9 -1.6M${cx + 7} ${f1(ey + 10.6)} l9 1.2"/></g>`,
      );
    else if (x === 'beard') out.push(`<path d="M${cx - 3.2} ${f1(cy + ry - 2)} C${cx - 2} ${f1(cy + ry + 6)} ${cx} ${f1(cy + ry + 9)} ${cx} ${f1(cy + ry + 9)} C${cx} ${f1(cy + ry + 9)} ${cx + 2} ${f1(cy + ry + 6)} ${cx + 3.2} ${f1(cy + ry - 2)} Z" fill="${p.accent}" ${ol(0.7)}/>`);
    else if (x === 'tusks')
      out.push(
        `<path d="M${cx - 5} ${f1(ey + 12)} C${cx - 6} ${f1(ey + 18)} ${cx - 9} ${f1(ey + 21)} ${cx - 11} ${f1(ey + 21)} C${cx - 9} ${f1(ey + 18)} ${cx - 8} ${f1(ey + 15)} ${cx - 8} ${f1(ey + 12)} Z" fill="#FBF6EA" ${ol(0.8)}/><path d="M${cx + 5} ${f1(ey + 12)} C${cx + 6} ${f1(ey + 18)} ${cx + 9} ${f1(ey + 21)} ${cx + 11} ${f1(ey + 21)} C${cx + 9} ${f1(ey + 18)} ${cx + 8} ${f1(ey + 15)} ${cx + 8} ${f1(ey + 12)} Z" fill="#FBF6EA" ${ol(0.8)}/>`,
      );
    else if (x === 'teeth' && mouthY !== null) out.push(`<rect x="${cx - 2.6}" y="${f1(mouthY + 0.6)}" width="2.5" height="3.6" rx=".6" fill="#FFFBF2" ${ol(0.6)}/><rect x="${cx + 0.1}" y="${f1(mouthY + 0.6)}" width="2.5" height="3.6" rx=".6" fill="#FFFBF2" ${ol(0.6)}/>`);
    else if (x === 'horn') out.push(`<path d="M${cx - 3.6} ${f1(ey + 4.6)} C${cx - 3} ${f1(ey - 2)} ${cx - 1} ${f1(ey - 8)} ${cx + 1} ${f1(ey - 11)} C${cx + 2} ${f1(ey - 6)} ${cx + 3.4} ${f1(ey - 1)} ${cx + 3.6} ${f1(ey + 4.6)} Z" fill="${HORN}" ${ol(0.9)}/>`);
    else if (x === 'wattle') out.push(`<path d="M${cx - 2} ${f1(ey + 10)} C${cx - 4} ${f1(ey + 15)} ${cx - 1} ${f1(ey + 18)} ${cx} ${f1(ey + 17)} C${cx + 1} ${f1(ey + 18)} ${cx + 4} ${f1(ey + 15)} ${cx + 2} ${f1(ey + 10)} Z" fill="#E2463F" ${ol(0.7)}/>`);
    else if (x === 'pouch') out.push(`<path d="M${cx - 4} ${f1(ey + 8)} C${cx - 6} ${f1(ey + 16)} ${cx - 2} ${f1(ey + 22)} ${cx + 2} ${f1(ey + 21)} C${cx + 4} ${f1(ey + 18)} ${cx + 3} ${f1(ey + 12)} ${cx + 3} ${f1(ey + 8)} Z" fill="${beakColor}" opacity=".75" ${ol(0.7)}/>`);
    else if (x === 'gills')
      for (const d of [-1, 1])
        out.push(
          `<g fill="${p.accent}" ${ol(0.6)}>${[0, 1, 2].map((i) => `<ellipse cx="${f1(cx + d * (rx + 2.5))}" cy="${f1(cy - 8 + i * 6)}" rx="5.6" ry="1.9" transform="rotate(${d * (-28 + i * 26)} ${f1(cx + d * (rx + 2.5))} ${f1(cy - 8 + i * 6)})"/>`).join('')}</g>`,
        );
    else if (x === 'antennae')
      out.push(
        `<g stroke="${p.dark}" stroke-width="1.3" fill="none" stroke-linecap="round"><path d="M${cx - 4} ${f1(g.top + 2)} C${cx - 6} ${f1(g.top - 6)} ${cx - 10} ${f1(g.top - 8)} ${cx - 12} ${f1(g.top - 7)}"/><path d="M${cx + 4} ${f1(g.top + 2)} C${cx + 6} ${f1(g.top - 6)} ${cx + 10} ${f1(g.top - 8)} ${cx + 12} ${f1(g.top - 7)}"/></g><circle cx="${cx - 12}" cy="${f1(g.top - 7)}" r="1.8" fill="${p.dark}"/><circle cx="${cx + 12}" cy="${f1(g.top - 7)}" r="1.8" fill="${p.dark}"/>`,
      );
    else if (x === 'spikes')
      out.push(`<g fill="${p.accent}" ${ol(0.6)}>${[-6, -2, 2, 6].map((dx) => `<path d="M${cx + dx - 1.8} ${f1(g.top + 2.4)} L${cx + dx} ${f1(g.top - 3)} L${cx + dx + 1.8} ${f1(g.top + 2.4)} Z"/>`).join('')}</g>`);
    else if (x === 'fluff')
      for (const d of [-1, 1])
        out.push(
          `<path d="M${f1(cx + d * rx * 0.6)} ${f1(cy - 2)} C${f1(cx + d * (rx + 4))} ${f1(cy)} ${f1(cx + d * (rx + 3))} ${f1(cy + 8)} ${f1(cx + d * (rx + 4.5))} ${f1(cy + 11)} C${f1(cx + d * rx * 0.8)} ${f1(cy + 12)} ${f1(cx + d * rx * 0.5)} ${f1(cy + 9)} ${f1(cx + d * rx * 0.45)} ${f1(cy + 4)} Z" fill="${p.light}"/>`,
        );
  }
  return out.join('');
}

// ------------------------------------------------------------------ the head

function beakOf(s: SpeciesDef): string {
  return s.colors.beak ?? BEAK;
}

type KitHeadDef = HeadDef & { neck: [number, number, number] | null };

/** A beast's head as a head definition (the hand-drawn heads' shape), so the face rig and the portrait just work. */
function beastHead(s: SpeciesDef): KitHeadDef {
  const g = geo(s);
  const ey = eyeY(s, g);
  const ex = g.rx * 0.37;
  const sideOn = s.snout === 'bigbeak';
  const horned = HORNED.includes(s.crown);
  return {
    neck: isBeaked(s) || ['trunk', 'croc', 'long'].includes(s.snout) || s.extras.includes('beard') ? null : [32, g.bottom - 0.5, Math.min(11, g.rx * 0.5)],
    art: (p0) => {
      const p = p0 as KitPal;
      if (sideOn) {
        // A huge beak, side-on (a toucan, a hornbill): the head turns to show it.
        const b = beakOf(s);
        return `${crownOn(s, p, { ...g, cx: 24, top: 15 })}<circle cx="26" cy="32" r="18" fill="${headFur(p)}" ${ol()}/><path d="M12 38 C14 50 25 55 34 50 C30 46 28.5 42 28.5 37 Z" fill="${p.light}"/>${s.mark !== 'none' ? `<circle cx="22" cy="28.5" r="7.6" fill="${p.accent}"/>` : ''}<path d="M33 25.5 C44 21 58 25 61.5 33.5 C58 40.5 46 44 33 41 C35 36 35 30.5 33 25.5Z" fill="${b}" ${ol()}/><path d="M34.5 27 C44 23.5 55.5 26.5 60 31.5" stroke="#fff" stroke-opacity=".45" stroke-width="2.6" fill="none" stroke-linecap="round"/><path d="M34 34.5 C42 35.5 50 35 58 33.5" stroke="${OUT}" stroke-width=".9" fill="none"/>`;
      }
      const sn = snout(s, p, g, ey, beakOf(s));
      const bulge =
        s.eyes === 'bulge'
          ? `<circle cx="${f1(32 - ex - 1)}" cy="${f1(ey)}" r="6.6" fill="${headFur(p)}" ${ol()}/><circle cx="${f1(32 + ex + 1)}" cy="${f1(ey)}" r="6.6" fill="${headFur(p)}" ${ol()}/>`
          : '';
      const owlDisc = s.eyes === 'owl' ? `<circle cx="${f1(32 - ex - 1)}" cy="${f1(ey)}" r="8.6" fill="${p.light}"/><circle cx="${f1(32 + ex + 1)}" cy="${f1(ey)}" r="8.6" fill="${p.light}"/>` : '';
      // Dark eyes vanish on a dark head (or a dark mask): a soft pale ring behind each keeps them readable.
      const around = s.mark === 'panda' || s.mark === 'mask' || s.mark === 'hood' ? p.accent : headFur(p);
      const ring =
        s.eyes !== 'owl' && luminance(around) < 0.09
          ? `<g fill="#F3EEE6" opacity=".9"><circle cx="${f1(32 - ex - (s.eyes === 'bulge' ? 1 : 0))}" cy="${f1(ey)}" r="${s.eyes === 'big' ? 5.2 : 4}"/><circle cx="${f1(32 + ex + (s.eyes === 'bulge' ? 1 : 0))}" cy="${f1(ey)}" r="${s.eyes === 'big' ? 5.2 : 4}"/></g>`
          : '';
      return (
        crownBehind(s, p, g) +
        extrasOnFace(s, p, g, ey, null, beakOf(s), 'gills') +
        ears(s, p, g) +
        (horned ? crownOn(s, p, g) : '') +
        `<ellipse cx="32" cy="${g.cy}" rx="${g.rx}" ry="${g.ry}" fill="${headFur(p)}" ${ol()}/>` +
        bulge +
        marks(s, p, g, ey) +
        owlDisc +
        ring +
        sn.art +
        (horned ? '' : crownOn(s, p, g)) +
        extrasOnFace(s, p, g, ey, sn.mouthY, beakOf(s))
      );
    },
    face: (p0) => {
      const p = p0 as KitPal;
      if (sideOn) return { kind: 'side', eyes: [22, 28.5, 0, 0], mouthY: null, brows: false };
      const sn = snout(s, p, g, ey, beakOf(s));
      const big = s.eyes === 'big';
      const wide = s.eyes === 'owl' || s.eyes === 'bulge' ? 1 : 0;
      const o: FaceOpts = {
        eyes: [32 - ex - wide, ey, 32 + ex + wide, ey],
        eyeR: big ? [3.6, 4.2] : s.eyes === 'bulge' ? [2.6, 3] : [2.4, 2.9],
        nose: sn.nose,
        mouthY: sn.mouthY,
        blushY: sn.blushY,
      };
      if (s.colors.eye && (big || s.eyes === 'owl' || s.eyes === 'bulge')) o.eyeFill = s.colors.eye;
      if (p.head) o.lid = p.head;
      if (s.eyes === 'owl') {
        o.kind = 'owl';
        o.lid = p.light;
        o.brows = false;
      }
      if (isBeaked(s)) o.brows = false;
      if (s.mark === 'panda' || s.mark === 'mask' || s.mark === 'hood') o.lid = p.accent;
      return o;
    },
  };
}

// ------------------------------------------------------------------ whole animals (fish, crabs, bugs…)

function wholeArt(s: SpeciesDef, p: KitPal): { art: string; face: FaceOpts } {
  const a = p.accent;
  switch (s.form) {
    case 'fish': {
      const stripes =
        s.mark === 'stripes'
          ? `<g fill="${a}" ${ol(0.5)}><path d="M24 15 C21 22 21 42 24 49 L28 49 C25.5 42 25.5 22 28 15 Z"/><path d="M37 18 C35 25 35 39 37 46 L40.5 45 C38.8 38 38.8 26 40.5 19 Z"/></g>`
          : s.mark === 'spots'
            ? `<g fill="${a}" opacity=".85"><circle cx="30" cy="26" r="2"/><circle cx="38" cy="30" r="1.6"/><circle cx="34" cy="39" r="2"/><circle cx="42" cy="38" r="1.4"/><circle cx="26" cy="36" r="1.5"/></g>`
            : '';
      const puffer = s.extras.includes('spikes')
        ? `<g fill="${a}" ${ol(0.5)}>${[0, 1, 2, 3, 4, 5, 6, 7].map((i) => {
            const ang = (i / 8) * Math.PI * 2;
            return `<path d="M${f1(31 + Math.cos(ang) * 19)} ${f1(32 + Math.sin(ang) * 16)} l${f1(Math.cos(ang) * 4)} ${f1(Math.sin(ang) * 4)} l${f1(-Math.sin(ang) * 1.6)} ${f1(Math.cos(ang) * 1.6)} Z"/>`;
          }).join('')}</g>`
        : '';
      return {
        art: `<path d="M48 32 L61 21 C62.5 28 62.5 36 61 43 Z" fill="${a}" ${ol()} stroke-linejoin="round"/><path d="M24 15 C30 7 40 8 44 15 Z" fill="${a}" ${ol(0.8)}/><path d="M28 49 C32 56 38 56 41 49 Z" fill="${a}" ${ol(0.8)}/>${puffer}<ellipse cx="31" cy="32" rx="20" ry="17" fill="${p.fur}" ${ol()}/><path d="M13 36 C18 46 34 50 46 41 C36 44 22 43 13 36 Z" fill="${p.light}" opacity=".85"/>${stripes}<ellipse cx="33" cy="36" rx="4.5" ry="2.6" transform="rotate(-20 33 36)" fill="${a}" opacity=".8"/>`,
        face: { kind: 'side', eyes: [20, 28, 0, 0], mouthY: null, brows: false, nose: `<path d="M11.6 34 q2 1.6 4 .6" stroke="${INK}" stroke-width="1.3" fill="none" stroke-linecap="round"/>` },
      };
    }
    case 'whale': {
      const rostrum = s.snout === 'beak';
      return {
        art: `<path d="M50 30 C54 24 58 20 62 18 C61 23 60 26 57 29 C60 30 62 33 62 36 C58 35 54 33 50 34 Z" fill="${p.fur}" ${ol()} stroke-linejoin="round"/><path d="M6 36 C6 22 20 14 34 15 C46 16 53 25 53 33 C53 42 44 47 30 47 C16 47 6 44 6 36 Z" fill="${p.fur}" ${ol()}/>${rostrum ? `<path d="M7 35 C3 35 1 37 1.6 38.6 C3 40 6 39.4 8 38.6 Z" fill="${p.fur}" ${ol(0.8)}/>` : ''}<path d="M7 39 C14 46 32 49 46 41 C36 43 18 43 7 39 Z" fill="${p.light}"/>${s.mark === 'cap' || s.mark === 'spots' ? `<ellipse cx="18" cy="28" rx="5" ry="2.6" fill="${p.light}"/>` : ''}${s.mark === 'spots' ? `<g fill="${p.light}" opacity=".8"><circle cx="30" cy="22" r="1.4"/><circle cx="38" cy="25" r="1.2"/><circle cx="44" cy="30" r="1.3"/><circle cx="26" cy="27" r="1.1"/></g>` : ''}<path d="M24 44 C22 49 24 53 28 54 C28 50 29 47 30 45 Z" fill="${p.fur}" ${ol(0.8)}/>${s.crown === 'crest' ? `<path d="M30 16 C30 10 34 6 37 5 C36 9 37 13 40 16.4 Z" fill="${p.fur}" ${ol(0.8)}/>` : ''}${s.extras.includes('horn') ? `<path d="M6 34 L-2 31 L6 36.4 Z" fill="${HORN}" ${ol(0.6)}/>` : ''}`,
        face: { kind: 'side', eyes: [17, 33, 0, 0], mouthY: null, brows: false, nose: `<path d="M8 38.4 q5 2 9 .4" stroke="${INK}" stroke-width="1.2" fill="none" stroke-linecap="round"/>` },
      };
    }
    case 'ray':
      return {
        art: `<path d="M32 50 C33 56 36 61 40 63" stroke="${p.fur}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M32 14 C40 14 48 22 61 30 C52 38 42 48 32 50 C22 48 12 38 3 30 C16 22 24 14 32 14 Z" fill="${p.fur}" ${ol()} stroke-linejoin="round"/>${s.mark === 'spots' ? `<g fill="${a}"><circle cx="22" cy="28" r="1.6"/><circle cx="42" cy="28" r="1.6"/><circle cx="32" cy="40" r="1.6"/><circle cx="16" cy="32" r="1.2"/><circle cx="48" cy="32" r="1.2"/></g>` : `<path d="M32 20 C36 24 38 30 36 40 L28 40 C26 30 28 24 32 20 Z" fill="${a}" opacity=".35"/>`}`,
        face: { eyes: [27, 27, 37, 27], eyeR: [2.2, 2.6], mouthY: 34, blushY: 32, brows: false },
      };
    case 'crab':
      return {
        art: `<g stroke="${p.fur}" stroke-width="2.6" stroke-linecap="round" fill="none"><path d="M16 40 l-8 4 -3 6M18 44 l-7 6 -1 6M46 44 l7 6 1 6M48 40 l8 4 3 6"/></g><g fill="${p.fur}" ${ol()}><path d="M14 31 C6 30 3 22 7 16 C9 20 12 21 14 19 C12 24 13 28 17 30 Z"/><path d="M50 31 C58 30 61 22 57 16 C55 20 52 21 50 19 C52 24 51 28 47 30 Z"/></g><path d="M22 26 L20 15 M42 26 L44 15" stroke="${p.fur}" stroke-width="2.6" stroke-linecap="round"/><circle cx="20" cy="14.5" r="5" fill="#fff" ${ol(0.8)}/><circle cx="44" cy="14.5" r="5" fill="#fff" ${ol(0.8)}/><ellipse cx="32" cy="36" rx="20" ry="14" fill="${p.fur}" ${ol()}/><ellipse cx="32" cy="42" rx="12" ry="5" fill="${p.light}" opacity=".7"/>${s.mark === 'spots' ? `<g fill="${a}"><circle cx="24" cy="30" r="1.4"/><circle cx="40" cy="30" r="1.4"/><circle cx="32" cy="27" r="1.2"/></g>` : ''}`,
        face: { eyes: [20, 14.5, 44, 14.5], eyeR: [2.2, 2.6], mouthY: 38, blushY: 36, brows: false, lid: '#fff' },
      };
    case 'octopus':
      return {
        art: `<g fill="${p.fur}" ${ol()}>${[-15, -9, -3, 3, 9, 15].map((dx, i) => `<path d="M${32 + dx - 3} 40 C${32 + dx * 1.15 - 3} 50 ${32 + dx * 1.35 - (i % 2 ? 4 : -2)} 56 ${32 + dx * 1.3} 60 C${32 + dx * 1.3 + 3} 58 ${32 + dx * 1.1 + 3} 50 ${32 + dx + 3} 40 Z"/>`).join('')}</g><path d="M32 8 C46 8 52 18 52 28 C52 38 44 44 32 44 C20 44 12 38 12 28 C12 18 18 8 32 8 Z" fill="${p.fur}" ${ol()}/><g fill="${p.light}" opacity=".7"><circle cx="22" cy="16" r="2"/><circle cx="40" cy="14" r="1.5"/><circle cx="44" cy="22" r="1.8"/></g>${s.mark === 'rosettes' || s.mark === 'spots' ? `<g fill="none" stroke="${a}" stroke-width="1.4"><circle cx="20" cy="22" r="2.4"/><circle cx="44" cy="18" r="2"/><circle cx="34" cy="13" r="1.8"/></g>` : ''}`,
        face: { eyes: [25, 30, 39, 30], eyeR: [3, 3.6], mouthY: 37, blushY: 35 },
      };
    case 'jelly':
      return {
        art: `<g stroke="${p.accent}" stroke-width="1.6" fill="none" stroke-linecap="round" opacity=".85"><path d="M20 38 C18 46 22 52 19 60"/><path d="M27 40 C29 48 25 54 28 62"/><path d="M37 40 C35 48 39 54 36 62"/><path d="M44 38 C46 46 42 52 45 60"/></g><path d="M10 36 C10 18 20 10 32 10 C44 10 54 18 54 36 C50 38 46 36 43 38 C40 36 36 38 32 37 C28 38 24 36 21 38 C18 36 14 38 10 36 Z" fill="${p.fur}" opacity=".9" ${ol()}/><path d="M18 22 C20 17 25 14 30 14" stroke="#fff" stroke-width="2.4" fill="none" stroke-linecap="round" opacity=".6"/>`,
        face: { eyes: [26, 27, 38, 27], eyeR: [2.2, 2.6], mouthY: 32, blushY: 31 },
      };
    case 'star': {
      const pts: string[] = [];
      for (let i = 0; i < 10; i++) {
        const ang = -Math.PI / 2 + (i * Math.PI) / 5;
        const r = i % 2 ? 11 : 28;
        pts.push(`${f1(32 + Math.cos(ang) * r)} ${f1(35 + Math.sin(ang) * r)}`);
      }
      return {
        art: `<path d="M${pts.join(' L')} Z" fill="${p.fur}" ${ol()} stroke-linejoin="round"/><g fill="${p.accent}"><circle cx="32" cy="16" r="1.4"/><circle cx="14" cy="30" r="1.4"/><circle cx="50" cy="30" r="1.4"/><circle cx="21" cy="52" r="1.4"/><circle cx="43" cy="52" r="1.4"/></g>`,
        face: { eyes: [27.5, 33, 36.5, 33], eyeR: [2, 2.4], mouthY: 39, blushY: 37 },
      };
    }
    case 'snail':
      return {
        art: `<path d="M8 52 C8 46 14 44 22 44 L54 44 C60 44 62 48 60 52 Z" fill="${p.light}" ${ol()}/><path d="M50 44 L52 30 M56 44 L60 31" stroke="${p.light}" stroke-width="3" stroke-linecap="round"/><circle cx="52" cy="29" r="2.4" fill="${p.light}" ${ol(0.7)}/><circle cx="60" cy="30" r="2.4" fill="${p.light}" ${ol(0.7)}/><circle cx="30" cy="30" r="17" fill="${p.fur}" ${ol()}/><path d="M30 30 m0 -11 a11 11 0 1 1 -10.5 7.6 a7 7 0 1 1 8.4 9.2 a3.4 3.4 0 1 1 3.6 -4.2" fill="none" stroke="${p.accent}" stroke-width="2.4" stroke-linecap="round"/>`,
        face: { eyes: [51, 40, 58, 40], eyeR: [1.7, 2.1], mouthY: 47.5, blushY: 46, brows: false, lid: p.light },
      };
    case 'butterfly':
    case 'bee': {
      const bee = s.form === 'bee';
      const wings = bee
        ? `<g fill="#EAF6FB" opacity=".85" ${ol(0.7)}><ellipse cx="18" cy="20" rx="11" ry="8" transform="rotate(-20 18 20)"/><ellipse cx="46" cy="20" rx="11" ry="8" transform="rotate(20 46 20)"/></g>`
        : `<g ${ol()}><path d="M30 30 C20 10 4 8 4 20 C4 30 14 34 30 34 Z" fill="${p.fur}"/><path d="M34 30 C44 10 60 8 60 20 C60 30 50 34 34 34 Z" fill="${p.fur}"/><path d="M30 36 C16 36 8 44 12 52 C16 58 26 50 30 40 Z" fill="${p.fur}"/><path d="M34 36 C48 36 56 44 52 52 C48 58 38 50 34 40 Z" fill="${p.fur}"/></g><g fill="${p.accent}"><circle cx="14" cy="20" r="4"/><circle cx="50" cy="20" r="4"/><circle cx="18" cy="47" r="2.6"/><circle cx="46" cy="47" r="2.6"/></g>`;
      const body = bee
        ? `<ellipse cx="32" cy="38" rx="15" ry="13" fill="${p.fur}" ${ol()}/><g fill="${p.accent}"><path d="M21 31 C24 29 40 29 43 31 L45 35 C40 33 24 33 19 35 Z"/><path d="M18 42 C24 40 40 40 46 42 L45 46 C40 44 24 44 19 46 Z"/></g>`
        : `<ellipse cx="32" cy="40" rx="3.6" ry="14" fill="${p.dark}"/>`;
      const headY = bee ? 26 : 24;
      return {
        art: `${wings}${body}<g stroke="${p.dark}" stroke-width="1.2" fill="none" stroke-linecap="round"><path d="M29 ${headY - 6} C27 ${headY - 12} 24 ${headY - 14} 22 ${headY - 14}"/><path d="M35 ${headY - 6} C37 ${headY - 12} 40 ${headY - 14} 42 ${headY - 14}"/></g><circle cx="32" cy="${headY}" r="${bee ? 9 : 7}" fill="${bee ? p.fur : p.dark}" ${ol()}/>`,
        face: bee
          ? { eyes: [28.5, headY - 1, 35.5, headY - 1], eyeR: [1.8, 2.2], mouthY: headY + 4, blushY: headY + 3, brows: false }
          : { eyes: [29.4, headY - 0.5, 34.6, headY - 0.5], eyeR: [1.6, 1.9], eyeFill: '#fff', mouthY: null, blushY: headY + 3.4, brows: false, lid: p.dark },
      };
    }
    case 'ladybug':
    case 'beetle': {
      const lady = s.form === 'ladybug';
      return {
        art: `<g stroke="${p.dark}" stroke-width="2" stroke-linecap="round"><path d="M14 36 l-6 -2M14 44 l-7 3M16 51 l-5 6M50 36 l6 -2M50 44 l7 3M48 51 l5 6"/></g><ellipse cx="32" cy="40" rx="20" ry="17" fill="${p.fur}" ${ol()}/><path d="M32 24 V57" stroke="${p.dark}" stroke-width="1.2" opacity=".6"/>${lady ? `<g fill="${p.accent}"><circle cx="23" cy="36" r="3"/><circle cx="41" cy="36" r="3"/><circle cx="25" cy="48" r="2.6"/><circle cx="39" cy="48" r="2.6"/></g>` : `<path d="M20 30 C24 27 28 27 30 30" stroke="#fff" stroke-width="2" fill="none" opacity=".5" stroke-linecap="round"/>`}${s.crown === 'horns' ? `<path d="M30 14 C29 8 31 2 34 1 C33 6 34 10 35 14 Z" fill="${p.dark}" ${ol(0.7)}/>` : ''}<ellipse cx="32" cy="22" rx="11" ry="8.5" fill="${p.dark}" ${ol()}/>`,
        face: { eyes: [27.5, 21, 36.5, 21], eyeR: [1.9, 2.2], eyeFill: '#fff', mouthY: null, blushY: 25, brows: false, lid: p.dark },
      };
    }
    default:
      return { art: '', face: {} };
  }
}

const headCache = new Map<string, KitHeadDef>();

/** A species' head (its whole self, for fish and bugs) as a head definition. */
export function kitHead(s: SpeciesDef): KitHeadDef {
  const hit = headCache.get(s.id);
  if (hit) return hit;
  const def: KitHeadDef =
    s.form === 'beast'
      ? beastHead(s)
      : {
          neck: null,
          art: (p) => wholeArt(s, p as KitPal).art,
          face: (p) => wholeArt(s, p as KitPal).face,
        };
  headCache.set(s.id, def);
  return def;
}

// ------------------------------------------------------------------ 3D

/**
 * Whether the 3D toy builder has the parts for a species (`three/species.ts::kitToy`): a seated, big, tall, upright,
 * perched or lying animal. Snakes, crocodiles, turtles, frogs, waders, bats, fish and bugs stay drawn, and so does any
 * scene they are in (`ui/components/scene3d.ts`).
 */
export function kitHasToy(s: SpeciesDef): boolean {
  return s.form === 'beast' && ['sit', 'big', 'tall', 'upright', 'bird', 'seal'].includes(s.body) && s.snout !== 'croc' && s.eyes !== 'bulge';
}

// ------------------------------------------------------------------ scene figures

const SIZE_K: Record<SpeciesDef['size'], number> = { tiny: 0.62, small: 0.8, medium: 1, large: 1.14, huge: 1.28 };

/** How big a species stands in its scene, relative to the spot's own height. */
export function kitScale(s: SpeciesDef): number {
  return SIZE_K[s.size];
}

function tailSvg(kind: KitTail, p: KitPal, x: number, y: number, bw: number, H: number): string {
  const P = (dx: number, dy: number) => `${f1(x + dx * H)} ${f1(y + dy * H)}`;
  const w = (k: number) => f1(H * k);
  switch (kind) {
    case 'cat':
      return `<path d="M${P(0.2, -0.08)} C${P(0.46, -0.06)} ${P(0.5, -0.3)} ${P(0.4, -0.46)}" stroke="${p.fur}" stroke-width="${w(0.07)}" stroke-linecap="round" fill="none"/>`;
    case 'dog':
      return `<path d="M${P(0.22, -0.14)} C${P(0.34, -0.2)} ${P(0.38, -0.3)} ${P(0.36, -0.4)}" stroke="${p.fur}" stroke-width="${w(0.08)}" stroke-linecap="round" fill="none"/>`;
    case 'bushy':
      return `<path d="M${P(0.16, -0.06)} C${P(0.6, -0.02)} ${P(0.7, -0.4)} ${P(0.46, -0.58)} C${P(0.42, -0.4)} ${P(0.36, -0.22)} ${P(0.14, -0.2)} Z" fill="${p.fur}" ${ol()}/><path d="M${P(0.4, -0.5)} C${P(0.44, -0.55)} ${P(0.47, -0.58)} ${P(0.46, -0.58)} C${P(0.56, -0.5)} ${P(0.54, -0.42)} ${P(0.5, -0.4)} Z" fill="${p.light}"/>`;
    case 'ringed':
      return `<path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.fur}" stroke-width="${w(0.11)}" stroke-linecap="round" fill="none"/><path d="M${P(0.16, -0.1)} C${P(0.5, -0.06)} ${P(0.62, -0.32)} ${P(0.5, -0.56)}" stroke="${p.accent}" stroke-width="${w(0.11)}" stroke-dasharray="${w(0.06)} ${w(0.07)}" fill="none"/>`;
    case 'long':
      return `<path d="M${P(0.2, -0.06)} C${P(0.52, -0.04)} ${P(0.56, -0.42)} ${P(0.42, -0.5)} C${P(0.34, -0.54)} ${P(0.32, -0.44)} ${P(0.38, -0.42)}" stroke="${p.fur}" stroke-width="${w(0.045)}" stroke-linecap="round" fill="none"/>`;
    case 'kangaroo':
      return `<path d="M${P(0.14, -0.06)} C${P(0.4, -0.02)} ${P(0.56, 0)} ${P(0.66, -0.03)}" stroke="${p.fur}" stroke-width="${w(0.11)}" stroke-linecap="round" fill="none"/>`;
    case 'horse':
      return `<path d="M${P(0.22, -0.2)} C${P(0.42, -0.22)} ${P(0.46, -0.06)} ${P(0.4, 0)} C${P(0.34, -0.06)} ${P(0.3, -0.12)} ${P(0.2, -0.12)} Z" fill="${p.dark}" ${ol(0.8)}/>`;
    case 'tuft':
      return `<path d="M${P(0.24, -0.14)} C${P(0.36, -0.1)} ${P(0.38, -0.02)} ${P(0.36, 0)}" stroke="${p.fur}" stroke-width="${w(0.03)}" stroke-linecap="round" fill="none"/><ellipse cx="${f1(x + H * 0.36)}" cy="${f1(y - H * 0.01)}" rx="${w(0.035)}" ry="${w(0.05)}" fill="${p.dark}"/>`;
    case 'puff':
      return `<circle cx="${f1(x + bw * 0.98)}" cy="${f1(y - H * 0.1)}" r="${w(0.075)}" fill="${p.light}" ${ol(0.8)}/>`;
    case 'curl':
      return `<path d="M${P(0.24, -0.12)} c${w(0.08)} ${w(-0.02)} ${w(0.1)} ${w(-0.1)} ${w(0.04)} ${w(-0.12)} c${w(-0.05)} ${w(-0.01)} ${w(-0.05)} ${w(0.06)} 0 ${w(0.06)}" stroke="${p.dark}" stroke-width="${w(0.035)}" stroke-linecap="round" fill="none"/>`;
    case 'paddle':
      return `<ellipse cx="${f1(x + H * 0.34)}" cy="${f1(y - H * 0.04)}" rx="${w(0.16)}" ry="${w(0.06)}" fill="${p.dark}" ${ol(0.8)}/><path d="M${P(0.22, -0.06)} l${w(0.22)} ${w(0.03)}" stroke="${OUT}" stroke-width=".6"/>`;
    case 'fan': {
      const fs: string[] = [];
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (1.05 + (i / 8) * 0.9);
        const fx = x + Math.cos(a) * H * 0.4;
        const fy = y - H * 0.3 + Math.sin(a) * H * 0.42;
        fs.push(`<ellipse cx="${f1(fx)}" cy="${f1(fy)}" rx="${w(0.075)}" ry="${w(0.2)}" transform="rotate(${f1((a * 180) / Math.PI + 90)} ${f1(fx)} ${f1(fy)})"/>`);
      }
      const eyes = [0.2, 0.5, 0.8].map((t) => {
        const a = Math.PI * (1.05 + t * 0.9);
        return `<circle cx="${f1(x + Math.cos(a) * H * 0.5)}" cy="${f1(y - H * 0.3 + Math.sin(a) * H * 0.54)}" r="${w(0.035)}" fill="${p.light}"/>`;
      });
      return `<g fill="${p.accent}" ${ol(0.7)}>${fs.join('')}</g>${eyes.join('')}`;
    }
    case 'feather':
      return `<path d="M${P(0.14, -0.14)} L${P(0.38, -0.04)} L${P(0.34, -0.16)} Z" fill="${p.accent}" ${ol(0.8)} stroke-linejoin="round"/>`;
    case 'lizard':
      return `<path d="M${P(0.2, -0.06)} C${P(0.5, -0.02)} ${P(0.66, -0.04)} ${P(0.78, -0.12)}" stroke="${p.fur}" stroke-width="${w(0.06)}" stroke-linecap="round" fill="none"/>`;
    case 'fin':
      return `<path d="M${P(0.26, -0.06)} l${w(0.14)} ${w(-0.08)} l${w(-0.02)} ${w(0.12)} z" fill="${p.fur}" ${ol(0.8)}/>`;
    case 'stub':
      return `<ellipse cx="${f1(x + bw * 0.95)}" cy="${f1(y - H * 0.08)}" rx="${w(0.06)}" ry="${w(0.04)}" fill="${p.fur}" ${ol(0.8)}/>`;
    default:
      return '';
  }
}

export interface KitFigure {
  /** Everything but the head and the tail. */
  body: string;
  tail: string;
  /** A tail drawn behind the body (a peacock's fan). */
  behind: string;
  /** Where the head's 64×64 box goes, and its scale. */
  headX: number;
  headTop: number;
  k: number;
}

/**
 * A kit animal's body in its scene, ground contact at (x, y), figure scale H (already sized for the species). The head
 * is placed by the caller (the shared figure code), so the rig, the hearts and the 3D twins line up as for any friend.
 */
export function kitBody(s: SpeciesDef, p: KitPal, x: number, y: number, H: number): KitFigure {
  const P = (dx: number, dy: number) => `${f1(x + dx * H)} ${f1(y + dy * H)}`;
  const k = H / 64;
  const shadow = (rx: number, dx = 0) => `<ellipse cx="${f1(x + dx * H)}" cy="${f1(y + 0.5)}" rx="${f1(rx * H)}" ry="${f1(H * 0.05)}" fill="${SHADOW}"/>`;
  const beak = beakOf(s);
  const feet = (c: string, dx = 0.07) =>
    `<path d="M${P(-dx, 0)} v${f1(-H * 0.05)} M${P(dx, 0)} v${f1(-H * 0.05)}" stroke="${c}" stroke-width="${f1(Math.max(1.6, H * 0.04))}" stroke-linecap="round"/>`;
  let body = '';
  let headX = x - H / 2;
  let headTop = y - H * 1.2;
  const bw = H * (s.body === 'big' ? 0.33 : 0.27);
  const bh = H * (s.body === 'big' ? 0.27 : 0.24);
  const tail = tailSvg(s.tail, p, x, y, bw, H);

  if (s.form !== 'beast') {
    // A whole animal stands (or floats) in its own 64×64 drawing: the caller draws it as the head.
    const water = ['fish', 'whale', 'ray', 'jelly', 'octopus'].includes(s.form);
    const flying = s.form === 'butterfly' || s.form === 'bee';
    body = water
      ? `<ellipse cx="${f1(x)}" cy="${f1(y - H * 0.02)}" rx="${f1(H * 0.56)}" ry="${f1(H * 0.12)}" fill="#8CCBE0" opacity=".75"/><path d="M${P(-0.46, -0.03)} q${f1(H * 0.08)} ${f1(-H * 0.06)} ${f1(H * 0.16)} 0 M${P(0.24, -0.04)} q${f1(H * 0.08)} ${f1(-H * 0.06)} ${f1(H * 0.16)} 0" stroke="#fff" stroke-width="1.2" fill="none" opacity=".8" stroke-linecap="round"/>`
      : flying
        ? `${shadow(0.18)}<path d="M${P(0, 0)} C${P(0.02, -0.2)} ${P(-0.03, -0.3)} ${P(0, -0.38)}" stroke="#6E9E5E" stroke-width="1.6" fill="none"/><g fill="#F6B6C8">${[0, 1, 2, 3, 4].map((i) => `<circle cx="${f1(x + Math.cos((i * Math.PI * 2) / 5) * H * 0.05)}" cy="${f1(y - H * 0.4 + Math.sin((i * Math.PI * 2) / 5) * H * 0.05)}" r="${f1(H * 0.045)}"/>`).join('')}</g><circle cx="${f1(x)}" cy="${f1(y - H * 0.4)}" r="${f1(H * 0.035)}" fill="#F2C230"/>`
        : shadow(0.42);
    return { body, tail: '', behind: '', headX: x - H / 2, headTop: flying ? y - H * 1.32 : water ? y - H * 0.78 : y - H * 0.92, k };
  }

  switch (s.body) {
    case 'bird':
    case 'wader': {
      const lift = s.body === 'wader' ? H * 0.42 : 0;
      const L = lift / H;
      const egg = `<ellipse cx="${x}" cy="${f1(y - lift - H * 0.3)}" rx="${f1(H * 0.26)}" ry="${f1(H * 0.31)}" fill="${p.fur}" ${ol()}/>`;
      const chest = `<ellipse cx="${x}" cy="${f1(y - lift - H * 0.26)}" rx="${f1(H * 0.15)}" ry="${f1(H * 0.19)}" fill="${p.light}"/>`;
      const wc = s.colors.wing ?? p.accent;
      const wings = `<path d="M${P(-0.24, -0.42 - L)} C${P(-0.36, -0.26 - L)} ${P(-0.3, -0.08 - L)} ${P(-0.17, -0.06 - L)}" stroke="${wc}" stroke-width="2" fill="none" stroke-linecap="round"/><path d="M${P(0.24, -0.42 - L)} C${P(0.36, -0.26 - L)} ${P(0.3, -0.08 - L)} ${P(0.17, -0.06 - L)}" stroke="${wc}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
      const legs =
        s.body === 'wader'
          ? `<path d="M${P(-0.06, 0)} L${P(-0.05, -0.46)} M${P(0.06, 0)} L${P(0.05, -0.46)}" stroke="${beak}" stroke-width="${f1(Math.max(1.4, H * 0.03))}" stroke-linecap="round"/>`
          : feet(beak);
      body = `${shadow(0.24)}${legs}${egg}${chest}${wings}`;
      headTop = y - lift - H * 0.5 - H * 0.82;
      break;
    }
    case 'upright': {
      const cy = y - H * 0.3;
      const foot = isBeaked(s) ? beak : p.fur;
      body = `${shadow(0.24)}<ellipse cx="${x}" cy="${f1(cy)}" rx="${f1(H * 0.22)}" ry="${f1(H * 0.3)}" fill="${p.fur}" ${ol()}/><ellipse cx="${x}" cy="${f1(cy + H * 0.04)}" rx="${f1(H * 0.13)}" ry="${f1(H * 0.21)}" fill="${p.light}"/><ellipse cx="${f1(x - H * 0.13)}" cy="${f1(cy - H * 0.02)}" rx="${f1(H * 0.06)}" ry="${f1(H * 0.12)}" transform="rotate(18 ${f1(x - H * 0.13)} ${f1(cy - H * 0.02)})" fill="${s.mark === 'panda' ? p.accent : p.fur}" ${ol(0.8)}/><ellipse cx="${f1(x + H * 0.13)}" cy="${f1(cy - H * 0.02)}" rx="${f1(H * 0.06)}" ry="${f1(H * 0.12)}" transform="rotate(-18 ${f1(x + H * 0.13)} ${f1(cy - H * 0.02)})" fill="${s.mark === 'panda' ? p.accent : p.fur}" ${ol(0.8)}/><ellipse cx="${f1(x - H * 0.1)}" cy="${f1(y - H * 0.03)}" rx="${f1(H * 0.08)}" ry="${f1(H * 0.045)}" fill="${foot}" ${ol(0.8)}/><ellipse cx="${f1(x + H * 0.1)}" cy="${f1(y - H * 0.03)}" rx="${f1(H * 0.08)}" ry="${f1(H * 0.045)}" fill="${foot}" ${ol(0.8)}/>`;
      headTop = y - H * 0.56 - H * 0.82;
      break;
    }
    case 'seal':
    case 'low': {
      const low = s.body === 'low';
      const spikes = s.extras.includes('spikes')
        ? `<g fill="${p.accent}" ${ol(0.6)}>${[0, 0.12, 0.24].map((d) => `<path d="M${P(-0.04 + d, -0.24 + d * 0.3)} l${f1(H * 0.04)} ${f1(-H * 0.07)} l${f1(H * 0.04)} ${f1(H * 0.07)} Z"/>`).join('')}</g>`
        : '';
      body = `${shadow(0.46, 0.1)}${spikes}<path d="M${P(-0.28, -0.02)} C${P(-0.3, -0.3)} ${P(0.2, -0.32)} ${P(0.44, -0.1)} C${P(0.56, -0.02)} ${P(0.6, 0)} ${P(0.52, 0)} Z" fill="${p.fur}" ${ol()}/>${
        low
          ? `<g fill="${p.fur}" ${ol(0.8)}><ellipse cx="${f1(x - H * 0.14)}" cy="${f1(y - H * 0.02)}" rx="${f1(H * 0.06)}" ry="${f1(H * 0.035)}"/><ellipse cx="${f1(x + H * 0.32)}" cy="${f1(y - H * 0.02)}" rx="${f1(H * 0.06)}" ry="${f1(H * 0.035)}"/></g>${s.mark === 'stripes' || s.mark === 'spots' ? `<g fill="${p.accent}" opacity=".8"><circle cx="${f1(x + H * 0.02)}" cy="${f1(y - H * 0.16)}" r="${f1(H * 0.03)}"/><circle cx="${f1(x + H * 0.18)}" cy="${f1(y - H * 0.14)}" r="${f1(H * 0.03)}"/><circle cx="${f1(x + H * 0.32)}" cy="${f1(y - H * 0.09)}" r="${f1(H * 0.025)}"/></g>` : ''}`
          : `<ellipse cx="${f1(x - H * 0.06)}" cy="${f1(y - H * 0.05)}" rx="${f1(H * 0.1)}" ry="${f1(H * 0.04)}" fill="${p.accent}" transform="rotate(-20 ${f1(x - H * 0.06)} ${f1(y - H * 0.05)})"/>`
      }`;
      headTop = y - H * 0.88;
      headX = x - H * 0.62;
      break;
    }
    case 'shell': {
      const sh = `<path d="M${P(-0.34, -0.06)} C${P(-0.34, -0.48)} ${P(0.38, -0.48)} ${P(0.38, -0.06)} Z" fill="${s.colors.shell ?? p.accent}" ${ol()}/><g fill="none" stroke="${p.dark}" stroke-width="1" opacity=".45"><path d="M${P(-0.12, -0.08)} L${P(-0.1, -0.3)} L${P(0.12, -0.3)} L${P(0.14, -0.08)}"/><path d="M${P(-0.1, -0.3)} L${P(-0.24, -0.2)} M${P(0.12, -0.3)} L${P(0.28, -0.2)}"/></g><rect x="${f1(x - H * 0.36)}" y="${f1(y - H * 0.09)}" width="${f1(H * 0.76)}" height="${f1(H * 0.06)}" rx="${f1(H * 0.03)}" fill="${p.light}" ${ol(0.8)}/>`;
      body = `${shadow(0.42)}<g fill="${p.fur}" ${ol(0.8)}><ellipse cx="${f1(x - H * 0.24)}" cy="${f1(y - H * 0.03)}" rx="${f1(H * 0.07)}" ry="${f1(H * 0.045)}"/><ellipse cx="${f1(x + H * 0.28)}" cy="${f1(y - H * 0.03)}" rx="${f1(H * 0.07)}" ry="${f1(H * 0.045)}"/></g>${sh}`;
      headTop = y - H * 0.92;
      headX = x - H * 0.82;
      break;
    }
    case 'coil': {
      const c = (cy: number, rx: number, ry: number) => `<ellipse cx="${x}" cy="${f1(y - cy * H)}" rx="${f1(rx * H)}" ry="${f1(ry * H)}" fill="${p.fur}" ${ol()}/>`;
      const stripes =
        s.mark === 'stripes' || s.mark === 'spots'
          ? `<g fill="none" stroke="${p.accent}" stroke-width="${f1(H * 0.04)}" opacity=".8"><path d="M${P(-0.3, -0.07)} q${f1(H * 0.3)} ${f1(H * 0.06)} ${f1(H * 0.6)} 0"/><path d="M${P(-0.22, -0.2)} q${f1(H * 0.22)} ${f1(H * 0.05)} ${f1(H * 0.44)} 0"/></g>`
          : '';
      body = `${shadow(0.38)}${c(0.08, 0.38, 0.1)}${c(0.2, 0.3, 0.09)}${stripes}${c(0.31, 0.2, 0.08)}`;
      headTop = y - H * 0.38 - H * 0.82;
      break;
    }
    case 'frog':
      body = `${shadow(0.34)}<g fill="${p.fur}" ${ol()}><ellipse cx="${f1(x - H * 0.24)}" cy="${f1(y - H * 0.07)}" rx="${f1(H * 0.14)}" ry="${f1(H * 0.08)}"/><ellipse cx="${f1(x + H * 0.24)}" cy="${f1(y - H * 0.07)}" rx="${f1(H * 0.14)}" ry="${f1(H * 0.08)}"/></g><ellipse cx="${x}" cy="${f1(y - H * 0.14)}" rx="${f1(H * 0.24)}" ry="${f1(H * 0.15)}" fill="${p.fur}" ${ol()}/><ellipse cx="${x}" cy="${f1(y - H * 0.12)}" rx="${f1(H * 0.14)}" ry="${f1(H * 0.09)}" fill="${p.light}"/>`;
      headTop = y - H * 0.24 - H * 0.82;
      break;
    case 'bat':
      body = `${shadow(0.3)}<path d="M${P(-0.08, -0.36)} C${P(-0.3, -0.5)} ${P(-0.5, -0.42)} ${P(-0.56, -0.26)} C${P(-0.46, -0.3)} ${P(-0.4, -0.22)} ${P(-0.36, -0.16)} C${P(-0.3, -0.22)} ${P(-0.22, -0.2)} ${P(-0.16, -0.12)} Z" fill="${s.colors.wing ?? p.dark}" ${ol(0.8)}/><path d="M${P(0.08, -0.36)} C${P(0.3, -0.5)} ${P(0.5, -0.42)} ${P(0.56, -0.26)} C${P(0.46, -0.3)} ${P(0.4, -0.22)} ${P(0.36, -0.16)} C${P(0.3, -0.22)} ${P(0.22, -0.2)} ${P(0.16, -0.12)} Z" fill="${s.colors.wing ?? p.dark}" ${ol(0.8)}/><ellipse cx="${x}" cy="${f1(y - H * 0.2)}" rx="${f1(H * 0.15)}" ry="${f1(H * 0.2)}" fill="${p.fur}" ${ol()}/>`;
      headTop = y - H * 0.36 - H * 0.82;
      break;
    default: {
      const by = y - bh;
      const neck =
        s.body === 'tall'
          ? `<rect x="${f1(x - H * 0.09)}" y="${f1(by - H * 0.56)}" width="${f1(H * 0.18)}" height="${f1(H * 0.64)}" rx="${f1(H * 0.07)}" fill="${p.fur}" ${ol()}/>${s.mark === 'spots' || s.mark === 'rosettes' ? `<g fill="${p.accent}" opacity=".85"><rect x="${f1(x - H * 0.06)}" y="${f1(by - H * 0.3)}" width="${f1(H * 0.08)}" height="${f1(H * 0.07)}" rx="1.5"/><rect x="${f1(x + H * 0.01)}" y="${f1(by - H * 0.14)}" width="${f1(H * 0.06)}" height="${f1(H * 0.06)}" rx="1.5"/></g>` : ''}`
          : '';
      const coat =
        s.mark === 'stripes'
          ? `<g stroke="${p.accent}" stroke-width="${f1(H * 0.035)}" stroke-linecap="round" fill="none" opacity=".9"><path d="M${f1(x - bw * 0.7)} ${f1(by - bh * 0.6)} q${f1(bw * 0.15)} ${f1(bh * 0.5)} 0 ${f1(bh * 1.1)}"/><path d="M${f1(x + bw * 0.7)} ${f1(by - bh * 0.6)} q${f1(-bw * 0.15)} ${f1(bh * 0.5)} 0 ${f1(bh * 1.1)}"/></g>`
          : s.mark === 'spots' || s.mark === 'rosettes'
            ? `<g fill="${p.accent}" opacity=".85"><circle cx="${f1(x - bw * 0.6)}" cy="${f1(by - bh * 0.2)}" r="${f1(H * 0.035)}"/><circle cx="${f1(x + bw * 0.62)}" cy="${f1(by + bh * 0.1)}" r="${f1(H * 0.035)}"/><circle cx="${f1(x - bw * 0.5)}" cy="${f1(by + bh * 0.45)}" r="${f1(H * 0.03)}"/><circle cx="${f1(x + bw * 0.5)}" cy="${f1(by - bh * 0.55)}" r="${f1(H * 0.028)}"/></g>`
            : '';
      const hooves = ['muzzle', 'pig'].includes(s.snout) || HORNED.includes(s.crown) || s.crown === 'ram';
      const footColor = s.mark === 'panda' ? p.accent : hooves ? p.dark : p.fur;
      const quills =
        s.crown === 'quills'
          ? `<g fill="${p.accent}" ${ol(0.6)}>${[-0.7, -0.35, 0, 0.35, 0.7].map((d) => `<path d="M${f1(x + d * bw - H * 0.03)} ${f1(by - bh * 0.85)} L${f1(x + d * bw * 1.2)} ${f1(by - bh * 1.35)} L${f1(x + d * bw + H * 0.03)} ${f1(by - bh * 0.85)} Z"/>`).join('')}</g>`
          : '';
      const humps = (s.extras.includes('humps') ? [-0.35, 0.35] : s.extras.includes('hump') ? [0] : [])
        .map((d) => `<ellipse cx="${f1(x + d * bw)}" cy="${f1(by - bh * 0.85)}" rx="${f1(bw * 0.38)}" ry="${f1(bh * 0.5)}" fill="${p.fur}" ${ol()}/>`)
        .join('');
      const pandaBand =
        s.mark === 'panda'
          ? `<path d="M${f1(x - bw * 0.98)} ${f1(by - bh * 0.1)} C${f1(x - bw * 0.6)} ${f1(by - bh * 0.6)} ${f1(x + bw * 0.6)} ${f1(by - bh * 0.6)} ${f1(x + bw * 0.98)} ${f1(by - bh * 0.1)} C${f1(x + bw * 0.9)} ${f1(by + bh * 0.3)} ${f1(x - bw * 0.9)} ${f1(by + bh * 0.3)} ${f1(x - bw * 0.98)} ${f1(by - bh * 0.1)} Z" fill="${p.accent}"/>`
          : '';
      const footW = f1(H * (s.tail === 'kangaroo' ? 0.1 : 0.07));
      body = `${shadow((bw * 1.3) / H)}${neck}${humps}${quills}<ellipse cx="${x}" cy="${f1(by)}" rx="${f1(bw)}" ry="${f1(bh)}" fill="${p.fur}" ${ol()}/>${pandaBand}${coat}<ellipse cx="${x}" cy="${f1(by + bh * 0.12)}" rx="${f1(bw * 0.5)}" ry="${f1(bh * 0.72)}" fill="${p.light}" opacity=".95"/><ellipse cx="${f1(x - bw * 0.45)}" cy="${f1(y - H * 0.03)}" rx="${footW}" ry="${f1(H * 0.05)}" fill="${footColor}" ${ol(0.8)}/><ellipse cx="${f1(x + bw * 0.45)}" cy="${f1(y - H * 0.03)}" rx="${footW}" ry="${f1(H * 0.05)}" fill="${footColor}" ${ol(0.8)}/>`;
      headTop = by - bh * 0.55 - H * 0.82 - (s.body === 'tall' ? H * 0.4 : 0);
    }
  }
  return s.tail === 'fan' ? { body, tail: '', behind: tail, headX, headTop, k } : { body, tail, behind: '', headX, headTop, k };
}
