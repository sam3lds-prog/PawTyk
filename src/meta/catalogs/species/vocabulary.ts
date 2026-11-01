/**
 * The kit's vocabulary as runtime lists (D39 PR E), and the checks every species list must pass
 * (`scripts/species-check.ts`, `test/unit/species.test.ts`).
 */

import type { SpeciesDef } from './types';

export const VOCAB = {
  biome: ['farm', 'outback', 'savanna', 'arctic', 'amazon', 'antarctic', 'jungle', 'bamboo', 'mountain', 'desert', 'woodland', 'wetland', 'coast', 'island', 'grassland'],
  form: ['beast', 'fish', 'ray', 'whale', 'crab', 'octopus', 'jelly', 'star', 'snail', 'butterfly', 'bee', 'ladybug', 'beetle'],
  body: ['sit', 'big', 'tall', 'upright', 'bird', 'wader', 'seal', 'low', 'shell', 'coil', 'frog', 'bat'],
  head: ['round', 'wide', 'tall', 'small'],
  ears: ['none', 'pointed', 'round', 'tufted', 'long', 'floppy', 'small', 'mouse', 'fan', 'giant', 'side'],
  crown: ['none', 'horns', 'curved', 'ram', 'straight', 'spiral', 'antlers', 'moose', 'ossicones', 'crest', 'tufts', 'mane', 'topknot', 'quills', 'frill', 'comb', 'casque', 'plume'],
  snout: ['cat', 'dog', 'fox', 'bear', 'koala', 'pig', 'muzzle', 'long', 'ape', 'beak', 'hook', 'longbeak', 'duck', 'bigbeak', 'trunk', 'croc', 'smile', 'flat'],
  eyes: ['dot', 'big', 'owl', 'side', 'bulge'],
  mark: ['none', 'mask', 'panda', 'stripes', 'spots', 'rosettes', 'blaze', 'badger', 'cheeks', 'cap', 'bib', 'eyeline', 'hood', 'muzzle'],
  extras: ['whiskers', 'beard', 'tusks', 'teeth', 'horn', 'wattle', 'pouch', 'spikes', 'gills', 'antennae', 'fluff', 'darkears', 'hump', 'humps'],
  tail: ['none', 'stub', 'cat', 'dog', 'bushy', 'ringed', 'long', 'kangaroo', 'horse', 'tuft', 'puff', 'curl', 'paddle', 'fan', 'feather', 'lizard', 'fin'],
  size: ['tiny', 'small', 'medium', 'large', 'huge'],
  eats: [
    'cat', 'dog', 'fox', 'redpanda', 'koala', 'kangaroo', 'wombat', 'elephant', 'giraffe', 'meerkat', 'polarbear', 'seal', 'owl', 'sloth', 'capybara', 'toucan', 'sheep', 'pig', 'cow', 'goat', 'chicken', 'horse', 'rabbit',
  ],
} as const;

/**
 * Kinds the hand-drawn animals already are (the regions' own, and the Pet Garden's): the catalog lists them once, with
 * their own art (`drawn`), so a kit species must not be one of them again.
 */
export const DRAWN_KINDS = [
  'sheep', 'pig', 'cow', 'calf', 'goat', 'chicken', 'chick', 'horse', 'pony', 'koala', 'kangaroo', 'wombat', 'giraffe', 'meerkat', 'elephant',
  'african elephant', 'snowy owl', 'polar bear', 'harp seal', 'seal', 'toucan', 'toco toucan', 'sloth', 'capybara', 'rabbit', 'bunny', 'red fox',
  'fox', 'red panda', 'arctic fox', 'arctic hare', 'bat-eared fox', 'cat', 'dog',
];

const HEX = /^#[0-9A-F]{6}$/;
const ID = /^[a-z0-9]+(-[a-z0-9]+)*$/;

/** Everything wrong with a list of species, as readable lines (empty when all is well). */
export function speciesProblems(list: readonly SpeciesDef[]): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const names = new Set<string>();
  for (const s of list) {
    const at = `${s.id ?? '?'}:`;
    if (!ID.test(s.id)) out.push(`${at} id must be lowercase words joined by hyphens`);
    if (ids.has(s.id)) out.push(`${at} duplicate id`);
    ids.add(s.id);
    const nm = s.name.toLowerCase();
    if (names.has(nm)) out.push(`${at} duplicate name "${s.name}"`);
    names.add(nm);
    if (!s.drawn && DRAWN_KINDS.includes(nm)) out.push(`${at} "${s.name}" is already a hand-drawn animal`);
    const unknown = (s as unknown as { unknownParts?: string[] }).unknownParts;
    if (unknown?.length) out.push(`${at} unknown part keys ${unknown.join(', ')}`);
    for (const k of ['biome', 'form', 'body', 'head', 'ears', 'crown', 'snout', 'eyes', 'mark', 'tail', 'size', 'eats'] as const)
      if (!(VOCAB[k] as readonly string[]).includes(s[k] as string)) out.push(`${at} ${k} "${s[k]}" is not in the vocabulary`);
    for (const x of s.extras) if (!(VOCAB.extras as readonly string[]).includes(x)) out.push(`${at} extra "${x}" is not in the vocabulary`);
    for (const [k, v] of Object.entries(s.colors)) if (!HEX.test(v)) out.push(`${at} color ${k} "${v}" is not a 6-digit hex`);
    for (const c of s.coats ?? []) {
      if (!c.name) out.push(`${at} a coat needs a name`);
      for (const [k, v] of Object.entries(c)) if (k !== 'name' && !HEX.test(v as string)) out.push(`${at} coat "${c.name}" color ${k} "${v}" is not a 6-digit hex`);
    }
    if (!s.name || s.name.length > 28) out.push(`${at} name must be 1–28 characters`);
    if (s.name[0] !== s.name[0].toUpperCase()) out.push(`${at} name starts with a capital`);
    if (!s.from || s.from.length > 48) out.push(`${at} "from" must be 1–48 characters`);
    if (!s.fact || s.fact.length > 110) out.push(`${at} fact must be 1–110 characters (is ${s.fact?.length ?? 0})`);
    if (s.fact && !/[.!]$/.test(s.fact)) out.push(`${at} fact ends with a full stop`);
    if (/[<>]/.test(s.name + s.from + s.fact)) out.push(`${at} no angle brackets in text`);
    if (s.form !== 'beast' && s.body !== 'sit') out.push(`${at} a "${s.form}" is drawn whole: leave body out`);
  }
  return out;
}
