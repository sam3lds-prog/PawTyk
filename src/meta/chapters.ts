/** Journey chapters: 20 levels each. The first three are the curated, verified launch pack. */

import { hashString, mulberry32, shuffle } from '../engine/rng';
import { FIRST_PLACE_AFTER, LEVELS_PER_PLACE } from './catalogs/places';

export interface Chapter {
  index: number; // 0-based
  name: string;
  first: number;
  last: number;
  blurb: string;
}

const NAMES: Array<[string, string]> = [
  ['Meadow Gate', 'Learn the rules on small boards and welcome the first residents.'],
  ['Willow Lane', 'Six-by-six and seven-by-seven boards with trickier regions.'],
  ['Lantern Hill', 'Eight-by-eight boards for patient, careful thinkers.'],
  ['Starlit Orchard', 'Eight-by-eight boards, then every size mixed: small can be hard, big can be gentle.'],
  ['Moonpond Glade', 'Every size from 5×5 to 8×8, with longer chains of reasoning.'],
];

export const LEVELS_PER_CHAPTER = 20;
/** Levels shipped as a frozen, verified pack (see src/data/levelPack.ts). */
export const CURATED_LEVELS = 60;

/**
 * Names for the chapters after the hand-written five (D39): the Journey never ends, so neither do its chapters. A fixed
 * shuffle of these words, the same on every device; after all two hundred, they come round again with a number.
 */
const MORE_FIRST = ['Thistle', 'Firefly', 'Bramble', 'Comet', 'Juniper', 'Clover', 'Saffron', 'Hollyhock', 'Moss', 'Amber', 'Larkspur', 'Cedar', 'Heather', 'Primrose', 'Starling', 'Rowan', 'Pebble', 'Teasel', 'Honeysuckle', 'Kestrel'];
const MORE_SECOND = ['Path', 'Hollow', 'Bend', 'Ridge', 'Brook', 'Steps', 'Crossing', 'Rise', 'Trail', 'Dell'];
const MORE_BLURBS = [
  'Big boards and long chains of reasoning.',
  'Every size, with the hardest tricks you know.',
  'Nine by nine, mostly. Take it one color at a time.',
  'Small boards that bite and big ones that breathe.',
];
let moreNames: string[] | null = null;
function moreName(i: number): string {
  if (!moreNames) {
    const all: string[] = [];
    for (const a of MORE_FIRST) for (const b of MORE_SECOND) all.push(`${a} ${b}`);
    // The seed keeps the game's earlier name (D42): changing it would rename every chapter past the hand-named ones.
    moreNames = shuffle(mulberry32(hashString('pawtopia-chapters-v1')), all);
  }
  const lap = Math.floor(i / moreNames.length);
  return `${moreNames[i % moreNames.length]}${lap ? ` ${lap + 1}` : ''}`;
}

/** The place of the endless world that opens when a chapter is finished (chapter 4, levels 61–80, opens place 1), or null. */
export function placeAfterChapter(index: number): number | null {
  const k = (index + 1) * LEVELS_PER_CHAPTER >= FIRST_PLACE_AFTER ? ((index + 1) * LEVELS_PER_CHAPTER - FIRST_PLACE_AFTER) / LEVELS_PER_PLACE + 1 : 0;
  return Number.isInteger(k) && k >= 1 ? k : null;
}

export function chapterAt(index: number): Chapter {
  const [name, blurb] = NAMES[index] ?? [moreName(index - NAMES.length), MORE_BLURBS[(index - NAMES.length) % MORE_BLURBS.length]];
  const first = index * LEVELS_PER_CHAPTER + 1;
  return { index, name, first, last: first + LEVELS_PER_CHAPTER - 1, blurb };
}

export function chapterOf(level: number): Chapter {
  return chapterAt(Math.floor((Math.max(1, level) - 1) / LEVELS_PER_CHAPTER));
}

/** Chapters the player can browse: all reached ones plus the next. */
export function visibleChapters(nextLevel: number): Chapter[] {
  const reached = chapterOf(nextLevel).index;
  return Array.from({ length: Math.max(3, reached + 1) }, (_, i) => chapterAt(i));
}
