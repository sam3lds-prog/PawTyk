/**
 * A compact way to write a species (D39 PR E): the parts as `key:value` words, the colors as hex words.
 *
 *   sp('snow-leopard', 'Snow leopard', 'mountain', 'The Himalayas', 'Its long tail doubles as a scarf in the cold.', 'cat',
 *      'medium', 'ears:round snout:cat mark:rosettes tail:bushy x:whiskers', 'E8E4DC FBF8F2 3B3A3C 6B6A6E')
 *
 * Parts not given take the defaults below; `x:` adds an extra (repeatable). Colors are fur, light, dark, accent, then
 * optionally `beak:HEX`, `eye:HEX`, `head:HEX` (a head colored unlike the body), `wing:HEX`, `shell:HEX` and `face:HEX` (a monkey's bare face). `test/unit/species.test.ts` checks every word against the vocabulary.
 */

import type { AnimalKind } from '../foods';
import type { CompanionId } from '../companions';
import type { BiomeId, KitColors, KitExtra, KitSize, SpeciesDef } from './types';

export const KIT_DEFAULTS = {
  form: 'beast',
  body: 'sit',
  head: 'round',
  ears: 'none',
  crown: 'none',
  snout: 'dog',
  eyes: 'dot',
  mark: 'none',
  tail: 'stub',
} as const;

const KEYS = ['form', 'body', 'head', 'ears', 'crown', 'snout', 'eyes', 'mark', 'tail'] as const;

/** Parses "D9692F FFF3E2 3A2A24 F4B07C beak:E5A23C" into colors. */
export function colorsOf(words: string): KitColors {
  const ws = words.trim().split(/\s+/);
  const hex = (w: string) => `#${w.replace(/^#/, '').toUpperCase()}`;
  const plain = ws.filter((w) => !w.includes(':'));
  const named = Object.fromEntries(ws.filter((w) => w.includes(':')).map((w) => w.split(':') as [string, string]));
  const c: KitColors = { fur: hex(plain[0] ?? 'C8B49A'), light: hex(plain[1] ?? 'F3E9DA'), dark: hex(plain[2] ?? '4A3B32'), accent: hex(plain[3] ?? plain[2] ?? '4A3B32') };
  if (named.beak) c.beak = hex(named.beak);
  if (named.eye) c.eye = hex(named.eye);
  if (named.head) c.head = hex(named.head);
  if (named.wing) c.wing = hex(named.wing);
  if (named.shell) c.shell = hex(named.shell);
  if (named.face) c.face = hex(named.face);
  return c;
}

export interface SpOptions {
  /** A hand-drawn species (its art and toy). */
  drawn?: CompanionId;
  /** A hand-drawn species in a new role, with its own coats. */
  guest?: SpeciesDef['guest'];
  /** Real color forms: "Silver: C9CCD1 F4F5F7 3B3F45 9AA4AE". */
  coats?: readonly string[];
}

export function sp(
  id: string,
  name: string,
  biome: BiomeId,
  from: string,
  fact: string,
  eats: AnimalKind,
  size: KitSize,
  parts: string,
  colors: string,
  opts: SpOptions = {},
): SpeciesDef {
  const got: Record<string, string> = {};
  const extras: KitExtra[] = [];
  for (const w of parts.trim().split(/\s+/).filter(Boolean)) {
    const [k, v] = w.split(':');
    if (k === 'x') extras.push(v as KitExtra);
    else got[k] = v;
  }
  const def = { ...KIT_DEFAULTS } as Record<(typeof KEYS)[number], string>;
  for (const k of KEYS) if (got[k]) def[k] = got[k];
  return {
    id,
    name,
    biome,
    from,
    fact,
    eats,
    size,
    ...(opts.drawn ? { drawn: opts.drawn } : {}),
    ...(opts.guest ? { guest: opts.guest } : {}),
    ...(def as unknown as Pick<SpeciesDef, (typeof KEYS)[number]>),
    extras,
    colors: colorsOf(colors),
    ...(opts.coats
      ? {
          coats: opts.coats.map((s) => {
            // "Silver: C9CCD1 F4F5F7 3B3F45 9AA4AE beak:F2C230": the name is everything before the first colon.
            const i = s.indexOf(':');
            return { name: s.slice(0, i).trim(), ...colorsOf(s.slice(i + 1)) };
          }),
        }
      : {}),
    // Unknown keys are kept for the vocabulary test to report.
    ...(Object.keys(got).some((k) => !(KEYS as readonly string[]).includes(k)) ? { unknownParts: Object.keys(got).filter((k) => !(KEYS as readonly string[]).includes(k)) } : {}),
  } as SpeciesDef;
}
