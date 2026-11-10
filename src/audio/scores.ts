/**
 * PawTyk's own music (D44 PR B), written as data: every cue is a short score in C major for the game's synthesized
 * instruments (`services/music.ts` plays them). All of it is original: the melodies, the arrangement and the motif.
 * Nothing here quotes or imitates an existing song.
 *
 * **The PawTyk motif** is a rising C–E–G that turns up to A or C: the win sting opens with it, Welcome Home is built on
 * it, and Barnyard Bounce ends its dance with it, so the three sound like one family.
 *
 * Cues:
 *  - `triumph` (Tiny Triumph): every solved puzzle, about 1 s.
 *  - `welcome` (Welcome Home): a new animal's spotlight, about 3.6 s, warm and slower.
 *  - `bounce` (Barnyard Bounce): the Welcome Parade, 132 BPM, 16 beats (about 7.3 s): an intro while the newcomer
 *    arrives, eight beats of dance, a big finish on beat 14.
 *  - `jig` (Barnyard Jig): a home's group celebration when it reaches a new stage (D44 PR E), 132 BPM, 8 beats (about
 *    3.6 s): the Bounce's groove, a quick turn of its tune, and the motif's finish on beat 6.
 *  - `trick:<id>`: a tune for every trick and emote, exactly as long as the trick (see `meta/catalogs/tricks.ts`).
 *
 * A score is beats, not seconds: `bpm` sets the speed, and the dances (D44 PR D) follow the same beats.
 */

import { TRICKS, type TrickId } from '../meta/catalogs/tricks';

export type Instrument =
  | 'bass' // a round plucked bass
  | 'pluck' // a bright strummed chord (banjo-ish)
  | 'marimba' // the main melody voice: wooden, toy-like
  | 'bell' // sparkles and ringing tops
  | 'brass' // warm accents and stabs
  | 'whistle' // a soft whistled line, with a little vibrato
  | 'pad' // a held chord, slow in and out
  | 'swoop' // a gliding note (leaps, spins, floats); goes from `p` to `to`
  | 'clap'
  | 'stomp'
  | 'shaker'
  | 'block' // a wood block: toy percussion
  | 'cymbal'; // a soft shimmer for big finishes

export interface Note {
  /** Start, in beats from the cue's start. */
  b: number;
  /** Length, in beats. */
  len: number;
  /** MIDI pitch, or several for a chord. Percussion ignores it. */
  p: number[];
  /** Where a swoop glides to (MIDI). */
  to?: number;
  /** Loudness, 0–1. */
  v: number;
}

export interface Part {
  inst: Instrument;
  notes: Note[];
}

export interface Score {
  id: CueId;
  title: string;
  bpm: number;
  /** The cue's length in beats (notes may ring a little past it). */
  beats: number;
  parts: Part[];
  /** Beats the choreography lands on (an entrance, the start of the dance, the big finish). */
  accents: number[];
  /** Named stretches of beats the choreography follows (Barnyard Bounce: intro, dance, finish). */
  sections?: Record<string, [number, number]>;
  /** A loudness trim, so quiet, sparse tunes sit level with busy ones (measured by the music check; default 1). */
  level?: number;
}

export type CueId = 'triumph' | 'welcome' | 'bounce' | 'jig' | `trick:${TrickId}`;

const NAMES: Record<string, number> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};

/** 'C4' → 60, 'F#5' → 78, 'Bb3' → 58. */
export function midi(name: string): number {
  const m = /^([A-G])([#b]?)(-?\d)$/.exec(name);
  if (!m) throw new Error(`bad note ${name}`);
  return 12 * (Number(m[3]) + 1) + NAMES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

export function hz(m: number): number {
  return 440 * 2 ** ((m - 69) / 12);
}

type Raw = [number, string | string[] | null, number, number?, string?];

/** A part from compact rows: [beat, note or chord (null for percussion), length, loudness = 0.8, swoop target]. */
function part(inst: Instrument, rows: Raw[]): Part {
  return {
    inst,
    notes: rows.map(([b, p, len, v = 0.8, to]) => ({
      b,
      len,
      p: p === null ? [] : (Array.isArray(p) ? p : [p]).map(midi),
      v,
      ...(to ? { to: midi(to) } : {}),
    })),
  };
}

/** Percussion hits at these beats. */
function hits(inst: Instrument, beats: number[], v = 0.8, len = 0.25): Part {
  return part(
    inst,
    beats.map((b) => [b, null, len, v]),
  );
}

const C = ['C4', 'E4', 'G4'];
const F = ['A3', 'C4', 'F4'];
const G = ['B3', 'D4', 'G4'];

// ------------------------------------------------------------------ Tiny Triumph: every solve, ~1 s

const triumph: Score = {
  id: 'triumph',
  title: 'Tiny Triumph',
  bpm: 160,
  beats: 3,
  accents: [0.75],
  parts: [
    part('marimba', [
      [0, 'C5', 0.25, 0.85],
      [0.25, 'E5', 0.25, 0.85],
      [0.5, 'G5', 0.25, 0.9],
      [0.75, 'C6', 0.9, 1],
    ]),
    part('bell', [
      [0.75, 'E6', 1.6, 0.45],
      [0.75, 'G5', 1.6, 0.3],
    ]),
    part('pluck', [[0.75, C, 0.6, 0.55]]),
    part('bass', [[0.75, 'C3', 0.9, 0.9]]),
    hits('shaker', [0, 0.25, 0.5], 0.45),
    hits('clap', [0.75], 0.7),
    part('cymbal', [[0.75, null, 1.6, 0.3]]),
  ],
};

// ------------------------------------------------------------------ Welcome Home: a new animal, ~3.6 s

const welcome: Score = {
  id: 'welcome',
  title: 'Welcome Home',
  bpm: 100,
  beats: 6,
  // The animal's entrance lands on 1, its name on 3.
  accents: [1, 3],
  parts: [
    part('pad', [
      [0, ['F3', 'A3', 'C4'], 2, 0.7],
      [2, ['G3', 'B3', 'D4'], 1, 0.7],
      [3, ['C4', 'E4', 'G4'], 3, 0.8],
    ]),
    part('bell', [
      [0, 'C5', 0.5, 0.75],
      [0.5, 'E5', 0.5, 0.75],
      [1, 'G5', 1, 0.85],
      [2, 'A5', 0.5, 0.75],
      [2.5, 'B5', 0.5, 0.75],
      [3, 'C6', 2.6, 0.9],
    ]),
    part('whistle', [
      [1, 'E5', 1, 0.4],
      [2, 'F5', 1, 0.4],
      [3, 'E5', 2.5, 0.45],
    ]),
    part('bass', [
      [0, 'F2', 2, 0.7],
      [2, 'G2', 1, 0.7],
      [3, 'C2', 3, 0.8],
    ]),
    part('brass', [[3, ['C4', 'G4', 'C5'], 2, 0.45]]),
    hits('block', [2.5, 2.75], 0.4),
    part('cymbal', [[3, null, 2.2, 0.28]]),
  ],
};

// ------------------------------------------------------------------ Barnyard Bounce: the Welcome Parade, ~7.3 s

const bounce: Score = {
  id: 'bounce',
  title: 'Barnyard Bounce',
  bpm: 132,
  beats: 16,
  accents: [0, 4, 14],
  sections: { intro: [0, 4], dance: [4, 12], finish: [12, 16] },
  parts: [
    // The groove: stomps on the beat, claps on the backbeat, a shaker on the off-beats.
    hits('stomp', [0, 2, 4, 6, 8, 10, 12, 13, 14], 0.85),
    hits('clap', [3, 5, 7, 9, 11, 13, 14], 0.7),
    hits('shaker', [4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5, 12.5], 0.4),
    hits('block', [6.75, 7.25, 10.75, 11.25], 0.45),
    // A bouncing root–fifth bass: C | F | G | C.
    part('bass', [
      [0, 'C2', 0.5],
      [1, 'G2', 0.5],
      [2, 'C2', 0.5],
      [3, 'G2', 0.5],
      [4, 'F2', 0.5],
      [5, 'C3', 0.5],
      [6, 'F2', 0.5],
      [7, 'A2', 0.5],
      [8, 'G2', 0.5],
      [9, 'D3', 0.5],
      [10, 'G2', 0.5],
      [11, 'B2', 0.5],
      [12, 'C3', 0.5],
      [13, 'G2', 0.5],
      [14, 'C2', 2, 0.95],
    ]),
    // Off-beat strums.
    part('pluck', [
      [1, C, 0.4, 0.5],
      [3, C, 0.4, 0.5],
      [4.5, F, 0.4, 0.55],
      [5.5, F, 0.4, 0.55],
      [6.5, F, 0.4, 0.55],
      [7.5, F, 0.4, 0.55],
      [8.5, G, 0.4, 0.55],
      [9.5, G, 0.4, 0.55],
      [10.5, G, 0.4, 0.55],
      [11.5, G, 0.4, 0.55],
      [12.5, C, 0.4, 0.55],
      [14, C, 1.8, 0.6],
    ]),
    // Brass: the motif as the intro's pickup, pushes into each bar, and the big finish.
    part('brass', [
      [2, 'G4', 0.5, 0.6],
      [2.5, 'C5', 0.5, 0.65],
      [3, 'E5', 0.5, 0.7],
      [3.5, 'G5', 0.5, 0.75],
      [7.5, ['A4', 'C5', 'F5'], 0.5, 0.55],
      [11.5, ['B4', 'D5', 'G5'], 0.5, 0.55],
      [14, ['C5', 'E5', 'G5', 'C6'], 2, 0.75],
    ]),
    // The tune.
    part('marimba', [
      [4, 'A4', 0.5],
      [4.5, 'C5', 0.5],
      [5, 'F5', 0.75],
      [5.75, 'E5', 0.25],
      [6, 'D5', 0.5],
      [6.5, 'C5', 0.5],
      [7, 'A4', 1],
      [8, 'B4', 0.5],
      [8.5, 'D5', 0.5],
      [9, 'G5', 0.75],
      [9.75, 'F5', 0.25],
      [10, 'E5', 0.5],
      [10.5, 'D5', 0.5],
      [11, 'B4', 0.5],
      [11.5, 'D5', 0.5],
      [12, 'C5', 0.5, 0.85],
      [12.5, 'E5', 0.5, 0.85],
      [13, 'G5', 0.5, 0.9],
      [13.5, 'A5', 0.5, 0.9],
      [14, 'C6', 1.8, 1],
    ]),
    part('whistle', [
      [8, 'G5', 1, 0.3],
      [9, 'B5', 1, 0.3],
      [10, 'C6', 1, 0.3],
      [11, 'D6', 1, 0.3],
      [12, 'E6', 2, 0.32],
    ]),
    part('bell', [
      [14, 'G6', 1.6, 0.3],
      [14.25, 'C7', 1.5, 0.22],
    ]),
    part('cymbal', [[14, null, 2, 0.45]]),
  ],
};

const jig: Score = {
  id: 'jig',
  title: 'Barnyard Jig',
  bpm: 132,
  beats: 8,
  accents: [0, 6],
  sections: { dance: [0, 6], finish: [6, 8] },
  parts: [
    hits('stomp', [0, 1, 2, 3, 4, 5, 6], 0.8),
    hits('clap', [1, 3, 5, 5.5], 0.7),
    hits('shaker', [0.5, 1.5, 2.5, 3.5, 4.5], 0.4),
    part('bass', [
      [0, 'C2', 0.5],
      [1, 'G2', 0.5],
      [2, 'F2', 0.5],
      [3, 'C3', 0.5],
      [4, 'G2', 0.5],
      [5, 'D3', 0.5],
      [6, 'C2', 2, 0.95],
    ]),
    part('pluck', [
      [0.5, C, 0.4, 0.5],
      [1.5, C, 0.4, 0.5],
      [2.5, F, 0.4, 0.55],
      [3.5, F, 0.4, 0.55],
      [4.5, G, 0.4, 0.55],
      [5.5, G, 0.4, 0.55],
      [6, C, 1.8, 0.6],
    ]),
    part('marimba', [
      [0, 'E5', 0.5],
      [0.5, 'G5', 0.5],
      [1, 'E5', 0.5],
      [1.5, 'C5', 0.5],
      [2, 'F5', 0.5],
      [2.5, 'A5', 0.5],
      [3, 'F5', 0.5],
      [3.5, 'C5', 0.5],
      [4, 'D5', 0.5],
      [4.5, 'G5', 0.5],
      [5, 'B4', 0.5],
      [5.5, 'D5', 0.5],
    ]),
    // The motif rises into the finish.
    part('brass', [
      [4, 'C5', 0.5, 0.6],
      [4.5, 'E5', 0.5, 0.65],
      [5, 'G5', 0.5, 0.7],
      [5.5, 'A5', 0.5, 0.75],
      [6, ['C5', 'E5', 'G5', 'C6'], 2, 0.75],
    ]),
    part('bell', [
      [6, 'G6', 1.6, 0.3],
      [6.25, 'C7', 1.5, 0.22],
    ]),
    part('cymbal', [[6, null, 2, 0.45]]),
  ],
};

// ------------------------------------------------------------------ trick tunes

/** A trick tune: `beats` long, its tempo set so it lasts exactly as long as the trick. */
function trickTune(id: TrickId, title: string, beats: number, parts: Part[], accents: number[], level = 1): Score {
  const t = TRICKS.find((x) => x.id === id)!;
  return {
    id: `trick:${id}`,
    title,
    bpm: Math.round(((beats * 60000) / t.ms) * 10) / 10,
    beats,
    parts,
    accents,
    ...(level !== 1 ? { level } : {}),
  };
}

const tricks: Score[] = [
  trickTune(
    'wave',
    'Hello There',
    4,
    [
      part('marimba', [
        [0, 'G5', 0.5],
        [0.5, 'E5', 0.5],
        [1.5, 'G5', 0.5],
        [2, 'C6', 1.6, 0.9],
      ]),
      part('bass', [[2, 'C3', 1, 0.6]]),
      hits('block', [0, 1.5], 0.4),
    ],
    [0, 1.5],
  ),
  trickTune(
    'hop',
    'Boing Boing',
    4,
    [
      part('swoop', [
        [0, 'C5', 0.6, 0.6, 'G5'],
        [1.5, 'D5', 0.6, 0.6, 'A5'],
      ]),
      part('marimba', [[2.6, 'C6', 1.2, 0.85]]),
      hits('block', [0, 1.5], 0.5),
      hits('stomp', [0.75, 2.25], 0.5),
    ],
    [0, 1.5],
  ),
  trickTune(
    'spin',
    'Twirl and Twirl',
    4,
    [
      part('marimba', [
        [0, 'C5', 0.25, 0.7],
        [0.25, 'E5', 0.25, 0.75],
        [0.5, 'G5', 0.25, 0.8],
        [0.75, 'C6', 0.4, 0.85],
        [1.5, 'D5', 0.25, 0.7],
        [1.75, 'F5', 0.25, 0.75],
        [2, 'A5', 0.25, 0.8],
        [2.25, 'D6', 0.4, 0.85],
      ]),
      part('swoop', [[2.75, 'G5', 0.5, 0.45, 'C7']]),
      part('bell', [[3, ['C6', 'E6'], 1.2, 0.5]]),
    ],
    [0, 1.5, 3],
    1.15,
  ),
  trickTune(
    'bow',
    'Ta-Daa',
    4,
    [
      part('brass', [
        [0, 'G4', 0.25, 0.55],
        [0.25, 'G4', 0.25, 0.55],
        [0.5, ['C5', 'E5', 'G5'], 2.2, 0.7],
      ]),
      part('bass', [[0.5, 'C2', 2, 0.8]]),
      hits('cymbal', [0.5], 0.3, 2),
      part('bell', [
        [2.75, 'G6', 1, 0.3],
        [3, 'C7', 1, 0.25],
      ]),
    ],
    [0.5],
  ),
  trickTune(
    'rollover',
    'Roly-Poly',
    4,
    [
      part('marimba', [
        [0, 'G5', 0.5],
        [0.5, 'E5', 0.5],
        [1, 'C5', 0.5],
        [1.5, 'G4', 0.5],
        [2, 'C5', 0.33],
        [2.33, 'E5', 0.33],
        [2.66, 'G5', 0.34],
        [3, 'C6', 1, 0.9],
      ]),
      part('bass', [
        [0, 'C3', 1, 0.6],
        [2, 'G2', 1, 0.6],
        [3, 'C3', 1, 0.7],
      ]),
      hits('shaker', [0.5, 1.5, 2.5], 0.35),
    ],
    [0, 3],
  ),
  trickTune(
    'dance',
    'Little Shuffle',
    6,
    [
      hits('stomp', [0, 2, 4], 0.75),
      hits('clap', [1, 3, 5], 0.6),
      hits('shaker', [0.5, 1.5, 2.5, 3.5, 4.5], 0.35),
      part('bass', [
        [0, 'C2', 0.5],
        [1, 'G2', 0.5],
        [2, 'F2', 0.5],
        [3, 'C3', 0.5],
        [4, 'G2', 0.5],
        [5, 'C2', 1],
      ]),
      part('marimba', [
        [0, 'E5', 0.5],
        [0.5, 'G5', 0.5],
        [1, 'A5', 0.5],
        [1.5, 'G5', 0.5],
        [2, 'F5', 0.5],
        [2.5, 'A5', 0.5],
        [3, 'G5', 1],
        [4, 'E5', 0.5],
        [4.5, 'D5', 0.5],
        [5, 'C5', 1, 0.9],
      ]),
    ],
    [0, 2, 4],
  ),
  trickTune(
    'backflip',
    'Big Leap',
    6,
    [
      hits('shaker', [0, 0.25, 0.5, 0.75, 1, 1.25, 1.5, 1.75, 2, 2.125, 2.25, 2.375, 2.5, 2.625, 2.75, 2.875], 0.4, 0.125),
      part('bass', [
        [0, 'G2', 1, 0.5],
        [1, 'G2', 1, 0.6],
        [2, 'G2', 1, 0.7],
      ]),
      part('swoop', [[2.5, 'G4', 0.9, 0.5, 'G6']]),
      part('brass', [[3, ['C5', 'E5', 'G5', 'C6'], 2, 0.75]]),
      part('bass', [[3, 'C2', 2, 0.9]]),
      hits('cymbal', [3], 0.45, 2.2),
      part('bell', [
        [3.5, 'E6', 1, 0.35],
        [4, 'G6', 1, 0.3],
        [4.5, 'C7', 1, 0.25],
      ]),
    ],
    [2.5, 3],
  ),
  trickTune(
    'bubble',
    'Bubble Drift',
    8,
    [
      part('pad', [
        [0, ['C4', 'E4', 'G4'], 4, 0.55],
        [4, ['F3', 'A3', 'C4'], 4, 0.55],
      ]),
      part('swoop', [[1, 'C5', 3, 0.35, 'C6']]),
      part('bell', [
        [0, 'G5', 1, 0.45],
        [1, 'C6', 1, 0.45],
        [2, 'E6', 1, 0.45],
        [3, 'G6', 1, 0.45],
        [4, 'F6', 1, 0.4],
        [5, 'A6', 1, 0.4],
      ]),
      hits('block', [6.5], 0.6),
      part('bell', [[6.5, 'C7', 1.2, 0.4]]),
    ],
    [1, 6.5],
    1.25,
  ),
  trickTune(
    'juggle',
    'Star Catch',
    8,
    [
      part('bell', [
        [1, 'C6', 0.5, 0.5],
        [2, 'E6', 0.5, 0.5],
        [3, 'G6', 0.5, 0.5],
        [4, 'E6', 0.5, 0.5],
        [5, 'C6', 0.5, 0.5],
        [6, 'G6', 0.5, 0.5],
        [7, ['C6', 'E6', 'G6'], 1, 0.55],
      ]),
      part('bass', [
        [0, 'C3', 0.5],
        [1, 'G2', 0.5],
        [2, 'C3', 0.5],
        [3, 'G2', 0.5],
        [4, 'F2', 0.5],
        [5, 'C3', 0.5],
        [6, 'G2', 0.5],
        [7, 'C2', 1, 0.9],
      ]),
      hits('block', [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5], 0.35),
      part('marimba', [[7, 'C6', 1, 0.85]]),
    ],
    [1, 2, 3, 7],
  ),
  trickTune(
    'rainbow',
    'Over the Hill',
    8,
    [
      part('marimba', [
        [0, 'C4', 0.5],
        [0.5, 'E4', 0.5],
        [1, 'G4', 0.5],
        [1.5, 'C5', 0.5],
        [2, 'E5', 0.5],
        [2.5, 'G5', 0.5],
        [3, 'C6', 0.5],
        [3.5, 'E6', 0.5],
        [4, 'G6', 1, 0.9],
      ]),
      part('whistle', [
        [2, 'G5', 2, 0.35],
        [4, 'A5', 1, 0.35],
        [5, 'G5', 2.5, 0.4],
      ]),
      part('pad', [
        [0, ['C4', 'E4', 'G4'], 4, 0.45],
        [4, ['F3', 'A3', 'C4'], 1, 0.45],
        [5, ['C4', 'E4', 'G4'], 3, 0.5],
      ]),
      part('bass', [
        [0, 'C2', 4, 0.6],
        [4, 'F2', 1, 0.6],
        [5, 'C2', 3, 0.7],
      ]),
      hits('cymbal', [5], 0.4, 2.5),
      part('bell', [[5, ['E6', 'G6', 'C7'], 2, 0.3]]),
    ],
    [0, 4, 5],
  ),
  trickTune(
    'love',
    'Heart Sway',
    4,
    [
      part('pad', [[0, ['F3', 'A3', 'C4'], 4, 0.5]]),
      part('whistle', [
        [0, 'A5', 1, 0.45],
        [1, 'G5', 0.5, 0.45],
        [1.5, 'F5', 0.5, 0.45],
        [2, 'A5', 1.8, 0.5],
      ]),
      part('bell', [
        [0.5, 'C6', 0.8, 0.3],
        [2.5, 'F6', 1.2, 0.3],
      ]),
      part('bass', [[0, 'F2', 4, 0.5]]),
    ],
    [0, 2],
    1.1,
  ),
  trickTune(
    'laugh',
    'Giggle Fit',
    6,
    [
      part('marimba', [
        [0, 'G5', 0.25, 0.7],
        [0.5, 'G5', 0.25, 0.7],
        [1, 'A5', 0.25, 0.75],
        [1.5, 'G5', 0.25, 0.7],
        [2, 'E5', 0.25, 0.7],
        [2.5, 'G5', 0.25, 0.7],
        [3, 'E5', 0.25, 0.7],
        [3.5, 'C5', 0.25, 0.7],
        [4, 'E5', 0.25, 0.75],
        [4.5, 'G5', 0.25, 0.75],
        [5, 'C6', 0.8, 0.85],
      ]),
      hits('block', [0.25, 1.25, 2.25, 3.25, 4.25], 0.35),
    ],
    [0, 5],
    1.15,
  ),
  trickTune(
    'cheer',
    'Hooray',
    4,
    [
      part('brass', [
        [0.5, ['C5', 'E5', 'G5'], 0.5, 0.65],
        [2, ['C5', 'E5', 'G5', 'C6'], 1.8, 0.75],
      ]),
      hits('clap', [1, 1.5, 2, 2.5, 3], 0.6),
      hits('stomp', [0.5, 2], 0.7),
      part('swoop', [[1.25, 'G5', 0.6, 0.35, 'C6']]),
      hits('cymbal', [2], 0.4, 1.8),
    ],
    [0.5, 2],
  ),
  trickTune(
    'surprised',
    'Oh!',
    4,
    [
      hits('block', [0], 0.7),
      part('swoop', [[0, 'C5', 0.3, 0.55, 'C6']]),
      part('bell', [
        [1.5, 'G5', 0.5, 0.4],
        [2, 'C6', 1.5, 0.45],
      ]),
      part('pluck', [[2, C, 0.8, 0.4]]),
    ],
    [0, 2],
    2.4,
  ),
  trickTune(
    'sleepy',
    'Little Doze',
    6,
    [
      part('swoop', [[0, 'G5', 1.2, 0.3, 'D5']]),
      part('whistle', [
        [1.5, 'G5', 1, 0.35],
        [2.5, 'E5', 1, 0.35],
        [3.5, 'D5', 1, 0.33],
        [4.5, 'C5', 1.5, 0.3],
      ]),
      part('pad', [[0, ['C4', 'E4', 'G4'], 6, 0.45]]),
      part('bass', [[0, 'C2', 6, 0.45]]),
    ],
    [0, 4.5],
    1.25,
  ),
  trickTune(
    'shy',
    'Peekaboo',
    4,
    [
      part('marimba', [
        [0, 'E5', 0.5, 0.5],
        [1.5, 'G5', 0.25, 0.45],
      ]),
      part('bell', [[3, 'C6', 1, 0.4]]),
      part('pad', [[2.5, ['C4', 'E4', 'G4'], 1.5, 0.35]]),
    ],
    [0, 3],
    2.2,
  ),
  trickTune(
    'starstruck',
    'Ring of Stars',
    8,
    [
      part('bell', [
        [0, 'C6', 0.5, 0.4],
        [0.5, 'E6', 0.5, 0.4],
        [1, 'G6', 0.5, 0.4],
        [1.5, 'B6', 0.5, 0.4],
        [2, 'C7', 0.5, 0.4],
        [2.5, 'B6', 0.5, 0.4],
        [3, 'G6', 0.5, 0.4],
        [3.5, 'E6', 0.5, 0.4],
        [4, 'C6', 0.5, 0.4],
        [4.5, 'E6', 0.5, 0.4],
        [5, 'G6', 0.5, 0.4],
        [5.5, 'C7', 0.5, 0.4],
      ]),
      part('whistle', [
        [0, 'E5', 2, 0.32],
        [2, 'G5', 2, 0.32],
        [4, 'A5', 2, 0.34],
        [6, 'G5', 2, 0.36],
      ]),
      part('pad', [
        [0, ['C4', 'E4', 'G4'], 4, 0.4],
        [4, ['F3', 'A3', 'C4'], 2, 0.4],
        [6, ['C4', 'E4', 'G4'], 2, 0.45],
      ]),
      hits('cymbal', [6], 0.35, 2),
    ],
    [0, 6],
    1.4,
  ),
  trickTune(
    'party',
    'Party Pop',
    8,
    [
      hits('block', [0], 0.75),
      hits('cymbal', [0.5], 0.45, 1.5),
      hits('stomp', [1, 2, 3, 4, 5, 6, 7], 0.75),
      hits('clap', [2, 4, 6], 0.65),
      hits('shaker', [1.5, 2.5, 3.5, 4.5, 5.5, 6.5], 0.35),
      part('bass', [
        [1, 'C2', 0.5],
        [2, 'G2', 0.5],
        [3, 'F2', 0.5],
        [4, 'C3', 0.5],
        [5, 'G2', 0.5],
        [6, 'G2', 0.5],
        [7, 'C2', 1, 0.9],
      ]),
      // Barnyard Bounce's finish, quicker: the party is the farm's tune.
      part('marimba', [
        [3, 'C5', 0.5],
        [3.5, 'E5', 0.5],
        [4, 'G5', 0.5],
        [4.5, 'A5', 0.5],
        [5, 'G5', 0.5],
        [5.5, 'E5', 0.5],
        [6, 'G5', 0.5],
        [6.5, 'A5', 0.5],
        [7, 'C6', 1, 1],
      ]),
      part('brass', [[7, ['C5', 'E5', 'G5', 'C6'], 1, 0.7]]),
    ],
    [0, 1, 7],
  ),
];

export const SCORES: Record<CueId, Score> = Object.fromEntries([triumph, welcome, bounce, jig, ...tricks].map((s) => [s.id, s])) as Record<CueId, Score>;

export function scoreFor(id: CueId): Score | undefined {
  return SCORES[id];
}

/** Seconds per beat. */
export function beatSec(s: Pick<Score, 'bpm'>): number {
  return 60 / s.bpm;
}

/** How long a cue plays, in ms (its beats; ringing notes fade within the last beat). */
export function cueMs(s: Pick<Score, 'bpm' | 'beats'>): number {
  return Math.round(s.beats * beatSec(s) * 1000);
}
