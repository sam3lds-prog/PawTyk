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
 *  - `meadow` (Meadow Morning, D45): the optional ambient tune for a visit: the theme slowed down, about 27 s.
 *
 * D45 PR D: the trick tunes each have their own chords and band; an animal's kind lays its own rhythm under its
 * tricks (`withRhythm`); and each home plays the theme in its own voicing (`themeVariation`). See the end of the file.
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
  | 'tuba' // oom-pah: a short round low brass note (D45)
  | 'accordion' // two reeds, a little apart: the barn-dance voice (D45)
  | 'kalimba' // a thumb piano: soft, woody, quick to fade (D45)
  | 'glock' // a glockenspiel: glassy shine (D45)
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

export type CueId = 'triumph' | 'welcome' | 'bounce' | 'jig' | 'meadow' | 'hopalong' | 'sparkle' | 'circle' | `trick:${TrickId}`;

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
// D45 PR D: the rest of the key's chords, so the trick tunes don't all sit on C, F and G.
const Am = ['A3', 'C4', 'E4'];
const Dm = ['A3', 'D4', 'F4'];
const Fmaj7 = ['F3', 'A3', 'C4', 'E4'];
const Cmaj7 = ['C4', 'E4', 'G4', 'B4'];
const Am7 = ['A3', 'C4', 'E4', 'G4'];

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
  level: 1.12,
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

// ------------------------------------------------------------------ the welcome celebrations (D48 PR E)

/*
 * Three more welcomes beside Barnyard Bounce, each 16 beats with the same parts (a 4-beat entrance, the dance, the
 * finish from beat 12, the poses on 14), so the choreographer and the camera treat them alike. Each has its own band
 * and feel, and each carries PawTyk's motif (C–E–G, up to the C) in its entrance and its finish.
 */

/** Meadow Hop: a skipping kalimba tune over an oom-pah tuba, a wood block on every hop. */
const hopalong: Score = {
  id: 'hopalong',
  title: 'Meadow Hop',
  bpm: 138,
  beats: 16,
  accents: [0, 4, 14],
  sections: { intro: [0, 4], dance: [4, 12], finish: [12, 16] },
  parts: [
    // The three hops in, and every hop after: a block on the landing.
    hits('block', [0.75, 1.75, 2.75, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13], 0.55),
    hits('shaker', [4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5, 11.5], 0.35),
    hits('clap', [7, 11, 13.5], 0.6),
    part('swoop', [
      [0, 'C5', 0.7, 0.4, 'G5'],
      [1, 'D5', 0.7, 0.4, 'A5'],
      [2, 'E5', 0.7, 0.4, 'B5'],
    ]),
    part('tuba', [
      [4, 'C3', 0.4],
      [5, 'G2', 0.4],
      [6, 'C3', 0.4],
      [7, 'G2', 0.4],
      [8, 'F2', 0.4],
      [9, 'C3', 0.4],
      [10, 'G2', 0.4],
      [11, 'D3', 0.4],
      [12, 'C3', 0.4],
      [13, 'G2', 0.4],
      [14, 'C3', 1.6, 0.85],
    ]),
    part('kalimba', [
      // The motif, skipping: the entrance.
      [2.5, 'C5', 0.25],
      [2.75, 'E5', 0.25],
      [3, 'G5', 0.5],
      [3.5, 'C6', 0.5],
      // The tune: a skip up and a skip down, twice, then higher.
      [4, 'E5', 0.33],
      [4.33, 'G5', 0.17],
      [4.5, 'A5', 0.5],
      [5, 'G5', 0.33],
      [5.33, 'E5', 0.17],
      [5.5, 'D5', 0.5],
      [6, 'C5', 0.33],
      [6.33, 'D5', 0.17],
      [6.5, 'E5', 0.5],
      [7, 'G5', 1],
      [8, 'F5', 0.33],
      [8.33, 'A5', 0.17],
      [8.5, 'C6', 0.5],
      [9, 'A5', 0.33],
      [9.33, 'F5', 0.17],
      [9.5, 'E5', 0.5],
      [10, 'D5', 0.33],
      [10.33, 'E5', 0.17],
      [10.5, 'F5', 0.5],
      [11, 'G5', 1],
      [12, 'C5', 0.5, 0.85],
      [12.5, 'E5', 0.5, 0.85],
      [13, 'G5', 0.5, 0.9],
      [13.5, 'B5', 0.5, 0.9],
      [14, 'C6', 1.8, 1],
    ]),
    part('whistle', [
      [8, 'C6', 1, 0.3],
      [9, 'A5', 1, 0.3],
      [10, 'B5', 1, 0.3],
      [11, 'D6', 1, 0.3],
    ]),
    part('glock', [
      [14, 'E6', 1.4, 0.35],
      [14.25, 'G6', 1.4, 0.3],
      [14.5, 'C7', 1.4, 0.28],
    ]),
  ],
};

/** Sparkle Surprise: a hush, a glittering rise and a pop; glockenspiel arpeggios over held chords. */
const sparkle: Score = {
  id: 'sparkle',
  title: 'Sparkle Surprise',
  bpm: 124,
  beats: 16,
  accents: [0, 4, 14],
  sections: { intro: [0, 4], dance: [4, 12], finish: [12, 16] },
  parts: [
    // The hush and the rise (the newcomer crouches, springs and twirls).
    part('swoop', [[0.5, 'G4', 2.5, 0.4, 'G6']]),
    part('bell', [
      [0, 'C6', 0.5, 0.35],
      [0.5, 'E6', 0.5, 0.35],
      [1, 'G6', 0.5, 0.38],
      [1.5, 'C7', 1.5, 0.4],
      [14, ['C6', 'E6', 'G6', 'C7'], 2, 0.45],
    ]),
    part('cymbal', [
      [3, null, 1, 0.35],
      [14, null, 2, 0.4],
    ]),
    part('pad', [
      [4, Cmaj7, 2, 0.4],
      [6, Am7, 2, 0.4],
      [8, Fmaj7, 2, 0.4],
      [10, G, 2, 0.42],
      [12, Cmaj7, 2, 0.42],
    ]),
    part('bass', [
      [4, 'C3', 1.5, 0.5],
      [6, 'A2', 1.5, 0.5],
      [8, 'F2', 1.5, 0.5],
      [10, 'G2', 1.5, 0.5],
      [12, 'C3', 1, 0.5],
      [14, 'C3', 1.8, 0.6],
    ]),
    hits('shaker', [4, 4.5, 5, 5.5, 6, 6.5, 7, 7.5, 8, 8.5, 9, 9.5, 10, 10.5, 11, 11.5], 0.3),
    hits('clap', [5, 7, 9, 11, 13], 0.5),
    part('glock', [
      // Rising arpeggios, one per chord, each a little higher.
      [4, 'C6', 0.25],
      [4.25, 'E6', 0.25],
      [4.5, 'G6', 0.25],
      [4.75, 'B6', 0.75],
      [6, 'A5', 0.25],
      [6.25, 'C6', 0.25],
      [6.5, 'E6', 0.25],
      [6.75, 'G6', 0.75],
      [8, 'F5', 0.25],
      [8.25, 'A5', 0.25],
      [8.5, 'C6', 0.25],
      [8.75, 'E6', 0.75],
      [10, 'G5', 0.25],
      [10.25, 'B5', 0.25],
      [10.5, 'D6', 0.25],
      [10.75, 'G6', 0.75],
      // The motif, sparkling, into the pop.
      [12, 'C6', 0.5, 0.85],
      [12.5, 'E6', 0.5, 0.85],
      [13, 'G6', 0.5, 0.9],
      [13.5, 'B6', 0.5, 0.9],
      [14, 'C7', 1.8, 1],
    ]),
  ],
};

/** Friendship Circle: a warm sway on accordion and whistle, everyone together. */
const circle: Score = {
  id: 'circle',
  title: 'Friendship Circle',
  bpm: 116,
  beats: 16,
  level: 1.15,
  accents: [0, 4, 14],
  sections: { intro: [0, 4], dance: [4, 12], finish: [12, 16] },
  parts: [
    // A shy hello: the motif alone, softly, on whistle.
    part('whistle', [
      [0, 'C5', 0.5, 0.4],
      [0.5, 'E5', 0.5, 0.4],
      [1, 'G5', 1, 0.42],
      [2.5, 'E5', 0.5, 0.4],
      [3, 'G5', 0.5, 0.42],
      [3.5, 'C6', 0.5, 0.45],
      // Then the tune, warm and swaying.
      [4, 'E5', 1, 0.5],
      [5, 'D5', 0.5, 0.48],
      [5.5, 'C5', 0.5, 0.48],
      [6, 'A4', 1.5, 0.5],
      [7.5, 'C5', 0.5, 0.48],
      [8, 'F5', 1, 0.5],
      [9, 'E5', 0.5, 0.48],
      [9.5, 'D5', 0.5, 0.48],
      [10, 'G5', 1.5, 0.52],
      [11.5, 'F5', 0.5, 0.48],
      [12, 'E5', 0.5, 0.5],
      [12.5, 'G5', 0.5, 0.5],
      [13, 'C6', 1, 0.55],
      [14, 'E6', 1.8, 0.55],
    ]),
    part('accordion', [
      [4, C, 0.9, 0.5],
      [5, C, 0.9, 0.42],
      [6, Am, 0.9, 0.5],
      [7, Am, 0.9, 0.42],
      [8, F, 0.9, 0.5],
      [9, F, 0.9, 0.42],
      [10, G, 0.9, 0.5],
      [11, G, 0.9, 0.42],
      [12, F, 0.9, 0.5],
      [13, G, 0.9, 0.5],
      [14, ['C4', 'E4', 'G4', 'C5'], 1.8, 0.55],
    ]),
    part('bass', [
      [4, 'C3', 1, 0.55],
      [6, 'A2', 1, 0.55],
      [8, 'F2', 1, 0.55],
      [10, 'G2', 1, 0.55],
      [12, 'F2', 1, 0.55],
      [13, 'G2', 1, 0.55],
      [14, 'C3', 1.8, 0.65],
    ]),
    hits('clap', [5, 7, 9, 11, 13], 0.45),
    part('kalimba', [
      [14, 'G5', 0.5, 0.45],
      [14.5, 'C6', 1.4, 0.45],
    ]),
  ],
};

// ------------------------------------------------------------------ trick tunes

/**
 * Loudness trims for the trick tunes (D45 PR D), set from the music check's measurements **as a phone plays them**
 * (everything under ~300 Hz gone): the loudest moment of every trick tune within a few dB of the others, so a quiet
 * whistle tune and a brass shout sit at the same level on a small speaker.
 */
const TRICK_LEVEL: Partial<Record<TrickId, number>> = {
  wave: 1.25,
  spin: 1.15,
  bow: 1.4,
  bubble: 1.15,
  love: 1.28,
  laugh: 1.3,
  cheer: 1.4,
  surprised: 2.7,
  sleepy: 1.45,
  shy: 2.4,
  starstruck: 1.65,
  // D48 PR D
  wiggle: 1.12,
  headtilt: 0.91,
  stretch: 1.4,
  confetti: 1.43,
  tailchase: 1.28,
  somersault: 0.89,
  moonwalk: 1.27,
  startwirl: 1.14,
  duet: 0.95,
  drumsolo: 1.4,
  disco: 1.5,
};

/** A trick tune: `beats` long, its tempo set so it lasts exactly as long as the trick. */
function trickTune(id: TrickId, title: string, beats: number, parts: Part[], accents: number[]): Score {
  const t = TRICKS.find((x) => x.id === id)!;
  const level = TRICK_LEVEL[id] ?? 1;
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
  // D45 PR D: each tune has its own colour. They share the key (so any two can follow each other) but not the chords
  // or the band: a kalimba hello, a tuba under the hops, a glockenspiel twirl, a plagal "ta-daa", an accordion roll,
  // a minor-key shuffle, a floating major-seventh bubble, a lullaby on the fourth, a shy A minor that peeks into C.
  trickTune(
    'wave',
    'Hello There',
    4,
    [
      part('kalimba', [
        [0, 'G5', 0.5],
        [0.5, 'E5', 0.5],
        [1.5, 'G5', 0.5],
        [2, 'C6', 1.6, 0.9],
      ]),
      part('glock', [[2.5, 'E6', 1, 0.35]]),
      part('pluck', [[2, C, 0.8, 0.45]]),
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
      // Each landing: oom.
      part('tuba', [
        [0.75, 'C3', 0.4, 0.7],
        [2.25, 'G2', 0.4, 0.7],
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
      // A turn round G, landing high, then the same turn a step up (D46 PR C: it used to open C-E-G-C in sixteenths,
      // note for note Tiny Triumph, so a spin sounded like a solved puzzle).
      part('glock', [
        [0, 'G5', 0.25, 0.7],
        [0.25, 'A5', 0.25, 0.75],
        [0.5, 'G5', 0.25, 0.8],
        [0.75, 'E5', 0.25, 0.75],
        [1, 'C6', 0.4, 0.85],
        [1.5, 'A5', 0.25, 0.7],
        [1.75, 'B5', 0.25, 0.75],
        [2, 'A5', 0.25, 0.8],
        [2.25, 'F5', 0.25, 0.75],
        [2.5, 'D6', 0.4, 0.85],
      ]),
      part('pad', [
        [0, C, 1.5, 0.4],
        [1.5, Dm, 1.5, 0.4],
        [3, C, 1.2, 0.45],
      ]),
      part('swoop', [[2.75, 'G5', 0.5, 0.45, 'C7']]),
      part('bell', [[3, ['C6', 'E6'], 1.2, 0.5]]),
    ],
    [0, 1.5, 3],
  ),
  trickTune(
    'bow',
    'Ta-Daa',
    4,
    [
      // Two pickup notes, then the fourth falling home to the first: ta-daa.
      part('brass', [
        [0, 'G4', 0.25, 0.55],
        [0.25, 'G4', 0.25, 0.55],
        [0.5, ['A4', 'C5', 'F5'], 1, 0.7],
        [1.5, ['G4', 'C5', 'E5'], 1.4, 0.72],
      ]),
      part('bass', [
        [0.5, 'F2', 1, 0.8],
        [1.5, 'C2', 1.4, 0.85],
      ]),
      hits('cymbal', [0.5], 0.3, 2),
      part('glock', [
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
      part('accordion', [
        [0, 'G5', 0.5],
        [0.5, 'E5', 0.5],
        [1, 'C5', 0.5],
        [1.5, 'G4', 0.5],
        [2, 'C5', 0.33],
        [2.33, 'E5', 0.33],
        [2.66, 'G5', 0.34],
        [3, 'C6', 1, 0.9],
      ]),
      part('tuba', [
        [0, 'C3', 0.5, 0.6],
        [1, 'E3', 0.5, 0.55],
        [2, 'G2', 0.5, 0.6],
        [3, 'C3', 0.8, 0.7],
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
      // A minor, down to F, round by G and home: a shuffle with a little mischief in it.
      part('bass', [
        [0, 'A2', 0.5],
        [1, 'E3', 0.5],
        [2, 'F2', 0.5],
        [3, 'C3', 0.5],
        [4, 'G2', 0.5],
        [5, 'C2', 1],
      ]),
      part('pluck', [
        [0.5, Am, 0.4, 0.5],
        [1.5, Am, 0.4, 0.5],
        [2.5, F, 0.4, 0.5],
        [3.5, F, 0.4, 0.5],
        [4.5, G, 0.4, 0.5],
        [5, C, 0.8, 0.55],
      ]),
      part('accordion', [
        [0, 'E5', 0.5],
        [0.5, 'A5', 0.5],
        [1, 'C6', 0.5],
        [1.5, 'A5', 0.5],
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
      part('tuba', [
        [0, 'G2', 0.8, 0.5],
        [1, 'G2', 0.8, 0.6],
        [2, 'G2', 0.8, 0.7],
      ]),
      part('swoop', [[2.5, 'G4', 0.9, 0.5, 'G6']]),
      part('brass', [[3, ['C5', 'E5', 'G5', 'C6'], 2, 0.75]]),
      part('bass', [[3, 'C2', 2, 0.9]]),
      hits('cymbal', [3], 0.45, 2.2),
      part('glock', [
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
      // Major sevenths: nothing lands, everything floats, until the pop.
      part('pad', [
        [0, Cmaj7, 2, 0.5],
        [2, Am7, 2, 0.5],
        [4, Fmaj7, 2.5, 0.55],
      ]),
      part('swoop', [[1, 'C5', 3, 0.35, 'C6']]),
      part('glock', [
        [0, 'G5', 1, 0.45],
        [1, 'B5', 1, 0.45],
        [2, 'E6', 1, 0.45],
        [3, 'G6', 1, 0.45],
        [4, 'A6', 1, 0.4],
        [5, 'E6', 1, 0.4],
      ]),
      hits('block', [6.5], 0.6),
      part('pluck', [[6.5, C, 0.8, 0.45]]),
      part('glock', [[6.5, 'C7', 1.2, 0.4]]),
    ],
    [1, 6.5],
  ),
  trickTune(
    'juggle',
    'Star Catch',
    8,
    [
      // A star caught on each beat, over a walk round the key: A minor, F, C, G and home.
      part('glock', [
        [1, 'A5', 0.5, 0.5],
        [2, 'C6', 0.5, 0.5],
        [3, 'E6', 0.5, 0.5],
        [4, 'C6', 0.5, 0.5],
        [5, 'G5', 0.5, 0.5],
        [6, 'B5', 0.5, 0.5],
        [7, ['C6', 'E6', 'G6'], 1, 0.55],
      ]),
      part('bass', [
        [0, 'A2', 0.5],
        [1, 'E3', 0.5],
        [2, 'F2', 0.5],
        [3, 'C3', 0.5],
        [4, 'C3', 0.5],
        [5, 'G2', 0.5],
        [6, 'G2', 0.5],
        [7, 'C2', 1, 0.9],
      ]),
      part('kalimba', [
        [0.5, 'E4', 0.4, 0.4],
        [1.5, 'E4', 0.4, 0.4],
        [2.5, 'F4', 0.4, 0.4],
        [3.5, 'F4', 0.4, 0.4],
        [4.5, 'E4', 0.4, 0.4],
        [5.5, 'D4', 0.4, 0.4],
        [6.5, 'D4', 0.4, 0.4],
      ]),
      hits('block', [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5], 0.3),
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
        [2.5, 'A5', 0.5],
        [3, 'C6', 0.5],
        [3.5, 'E6', 0.5],
        [4, 'G6', 1, 0.9],
      ]),
      part('whistle', [
        [2, 'A5', 2, 0.35],
        [4, 'A5', 1, 0.35],
        [5, 'G5', 2.5, 0.4],
      ]),
      // Up through A minor to the top of the arc on F, and down home.
      part('pad', [
        [0, C, 2, 0.45],
        [2, Am, 2, 0.45],
        [4, F, 1, 0.45],
        [5, C, 3, 0.5],
      ]),
      part('bass', [
        [0, 'C2', 2, 0.6],
        [2, 'A2', 2, 0.6],
        [4, 'F2', 1, 0.6],
        [5, 'C2', 3, 0.7],
      ]),
      hits('cymbal', [5], 0.4, 2.5),
      part('glock', [[5, ['E6', 'G6', 'C7'], 2, 0.3]]),
    ],
    [0, 4, 5],
  ),
  trickTune(
    'love',
    'Heart Sway',
    4,
    [
      part('pad', [
        [0, Fmaj7, 2, 0.5],
        [2, G, 1, 0.5],
        [3, C, 1.5, 0.5],
      ]),
      part('whistle', [
        [0, 'A5', 1, 0.45],
        [1, 'G5', 0.5, 0.45],
        [1.5, 'F5', 0.5, 0.45],
        [2, 'G5', 1, 0.48],
        [3, 'E5', 1.5, 0.5],
      ]),
      part('glock', [
        [0.5, 'C6', 0.8, 0.3],
        [2.5, 'D6', 0.6, 0.3],
        [3.25, 'G6', 1, 0.3],
      ]),
      part('bass', [
        [0, 'F2', 2, 0.5],
        [2, 'G2', 1, 0.5],
        [3, 'C3', 1.4, 0.5],
      ]),
    ],
    [0, 2],
  ),
  trickTune(
    'laugh',
    'Giggle Fit',
    6,
    [
      part('kalimba', [
        [0, 'G5', 0.25, 0.7],
        [0.5, 'G5', 0.25, 0.7],
        [1, 'A5', 0.25, 0.75],
        [1.5, 'G5', 0.25, 0.7],
        [2, 'F5', 0.25, 0.7],
        [2.5, 'A5', 0.25, 0.7],
        [3, 'F5', 0.25, 0.7],
        [3.5, 'D5', 0.25, 0.7],
        [4, 'D5', 0.25, 0.75],
        [4.5, 'G5', 0.25, 0.75],
        [5, 'C6', 0.8, 0.85],
      ]),
      // Oom-pah underneath, a step up for the second giggle and round to home.
      part('tuba', [
        [0, 'C3', 0.4, 0.5],
        [2, 'D3', 0.4, 0.5],
        [4, 'G2', 0.4, 0.5],
        [5, 'C3', 0.6, 0.55],
      ]),
      hits('block', [0.25, 1.25, 2.25, 3.25, 4.25], 0.35),
    ],
    [0, 5],
  ),
  trickTune(
    'cheer',
    'Hooray',
    4,
    [
      // "Hoo-" on the fourth, "-ray!" at home.
      part('brass', [
        [0.5, ['A4', 'C5', 'F5'], 0.5, 0.65],
        [2, ['C5', 'E5', 'G5', 'C6'], 1.8, 0.75],
      ]),
      part('tuba', [
        [0.5, 'F2', 0.5, 0.6],
        [2, 'C3', 0.8, 0.65],
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
      // It ends on the fifth, like a question: "…oh?"
      part('glock', [
        [1.5, 'D6', 0.5, 0.4],
        [2, 'B5', 1.5, 0.45],
      ]),
      part('pluck', [[2, G, 0.8, 0.4]]),
    ],
    [0, 2],
  ),
  trickTune(
    'sleepy',
    'Little Doze',
    6,
    [
      part('swoop', [[0, 'A5', 1.2, 0.3, 'F5']]),
      // A lullaby: the fourth, rocking down to home.
      part('whistle', [
        [1.5, 'A5', 1, 0.35],
        [2.5, 'G5', 1, 0.35],
        [3.5, 'E5', 1, 0.33],
        [4.5, 'C5', 1.5, 0.3],
      ]),
      part('pad', [
        [0, Fmaj7, 3, 0.45],
        [3, C, 3, 0.45],
      ]),
      part('bass', [
        [0, 'F2', 3, 0.45],
        [3, 'C2', 3, 0.45],
      ]),
      part('kalimba', [
        [0.5, 'C5', 0.5, 0.25],
        [2, 'A4', 0.5, 0.25],
        [3.5, 'G4', 0.5, 0.25],
      ]),
    ],
    [0, 4.5],
  ),
  trickTune(
    'shy',
    'Peekaboo',
    4,
    [
      // Looks away in A minor; peeks back in C.
      part('kalimba', [
        [0, 'E5', 0.5, 0.5],
        [0.5, 'C5', 0.5, 0.45],
        [1.5, 'A4', 0.25, 0.45],
      ]),
      part('pad', [
        [0, Am, 2.4, 0.3],
        [2.5, C, 1.5, 0.35],
      ]),
      part('glock', [[3, 'C6', 1, 0.4]]),
    ],
    [0, 3],
  ),
  trickTune(
    'starstruck',
    'Ring of Stars',
    8,
    [
      part('bell', [
        [0, 'A5', 0.5, 0.4],
        [0.5, 'C6', 0.5, 0.4],
        [1, 'E6', 0.5, 0.4],
        [1.5, 'A6', 0.5, 0.4],
        [2, 'C7', 0.5, 0.4],
        [2.5, 'A6', 0.5, 0.4],
        [3, 'F6', 0.5, 0.4],
        [3.5, 'C6', 0.5, 0.4],
        [4, 'B5', 0.5, 0.4],
        [4.5, 'D6', 0.5, 0.4],
        [5, 'G6', 0.5, 0.4],
        [5.5, 'B6', 0.5, 0.4],
      ]),
      part('whistle', [
        [0, 'E5', 2, 0.32],
        [2, 'F5', 2, 0.32],
        [4, 'G5', 2, 0.34],
        [6, 'G5', 2, 0.36],
      ]),
      // Wonder: A minor, F, G, and the stars come out on C.
      part('pad', [
        [0, Am, 2, 0.4],
        [2, F, 2, 0.4],
        [4, G, 2, 0.4],
        [6, C, 2, 0.45],
      ]),
      hits('cymbal', [6], 0.35, 2),
      part('glock', [[6, ['E6', 'C7'], 1.6, 0.35]]),
    ],
    [0, 6],
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
      // The barn-dance band joins in.
      part('accordion', [
        [1.5, C, 0.4, 0.5],
        [2.5, G, 0.4, 0.5],
        [3.5, F, 0.4, 0.5],
        [4.5, C, 0.4, 0.5],
        [5.5, G, 0.4, 0.5],
        [6.5, G, 0.4, 0.5],
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
  // D48 PR D: eighteen more, each with a band of its own. A wiggle on kalimba and shaker, a whistled peek and a bell
  // "boo", a question that ends on the second, a sneeze that builds on accordion, a slow major-seventh stretch, a
  // glockenspiel pop, a clap for the high five, an accordion running in circles, a tumble that lands on marimba, a
  // whistle floating up on a bell, a drum roll with a brass crash, a minor-key glide, a four-on-the-floor glitter ball,
  // a clucking oom-pah, a kalimba swirl, a boogie bass, two voices in thirds and a little glockenspiel march. All in
  // C major, so any two can follow each other, and the march and the boogie end on the farm's C–E–G.
  trickTune(
    'wiggle',
    'Wiggle Waggle',
    4,
    [
      part('kalimba', [
        [0, 'E5', 0.25],
        [0.25, 'D5', 0.25],
        [0.5, 'E5', 0.25],
        [0.75, 'D5', 0.25],
        [1, 'E5', 0.5],
        [1.5, 'G5', 0.5],
        [2, 'A5', 1.4, 0.9],
      ]),
      part('bass', [
        [0, 'C3', 1, 0.6],
        [2, 'F2', 1.5, 0.65],
      ]),
      hits('shaker', [0, 0.5, 1, 1.5, 2, 2.5, 3], 0.4),
    ],
    [0, 2],
  ),
  trickTune(
    'peekaboo',
    'Peek-a-Boo',
    4,
    [
      // Hushed while the paws are up; then the bell: boo!
      part('whistle', [
        [0, 'G4', 0.5, 0.35],
        [1, 'G4', 0.5, 0.35],
        [1.5, 'A4', 0.25, 0.4],
        [2.25, 'E5', 1, 0.6],
        [3.25, 'D5', 0.6, 0.45],
      ]),
      part('bell', [[2.25, ['C6', 'E6'], 1.4, 0.6]]),
      part('pluck', [[2.25, C, 0.6, 0.55]]),
      hits('block', [0, 1], 0.35),
    ],
    [2.25],
  ),
  trickTune(
    'headtilt',
    'Hmm?',
    4,
    [
      // It never gets home: it ends on the second, like a question.
      part('marimba', [
        [0, 'C5', 0.5],
        [0.5, 'D5', 0.5],
        [2, 'E5', 0.5],
        [2.5, 'D5', 1.2, 0.85],
      ]),
      part('pad', [
        [0, C, 2, 0.35],
        [2, G, 2, 0.38],
      ]),
      hits('block', [0.3, 2.1], 0.45),
    ],
    [0.3, 2.1],
  ),
  trickTune(
    'sneeze',
    'Ah-Ah-Choo',
    4,
    [
      part('accordion', [
        [0, 'E5', 0.5, 0.5],
        [0.75, 'F5', 0.5, 0.55],
        [1.5, 'G5', 0.4, 0.62],
        [2, 'C5', 0.25, 0.9],
        [2.5, F, 0.5, 0.45],
        [3, C, 0.9, 0.5],
      ]),
      part('swoop', [
        [0, 'C5', 1.9, 0.4, 'G5'],
        [2.1, 'G5', 0.6, 0.45, 'C5'],
      ]),
      hits('clap', [2], 0.85),
    ],
    [2],
  ),
  trickTune(
    'stretch',
    'Big Stretch',
    4,
    [
      part('whistle', [
        [0, 'C5', 1, 0.45],
        [1, 'E5', 1, 0.45],
        [2, 'A5', 1.5, 0.5],
        [3.5, 'G5', 0.45, 0.4],
      ]),
      part('pad', [
        [0, Fmaj7, 2, 0.4],
        [2, Am7, 2, 0.4],
      ]),
      part('bass', [
        [0, 'F2', 2, 0.5],
        [2, 'A2', 2, 0.5],
      ]),
    ],
    [0, 2],
  ),
  trickTune(
    'confetti',
    'Hooray Pop',
    4,
    [
      part('brass', [
        [0, 'G4', 0.25, 0.6],
        [0.5, ['C5', 'E5', 'G5'], 1, 0.75],
      ]),
      part('glock', [
        [0.5, 'G6', 0.25, 0.4],
        [0.75, 'E6', 0.25, 0.4],
        [1, 'C7', 0.25, 0.4],
        [1.25, 'G6', 0.25, 0.35],
        [1.5, 'E6', 0.25, 0.35],
        [2, 'C6', 1, 0.4],
      ]),
      hits('shaker', [0.5, 1, 1.5, 2, 2.5, 3], 0.35),
      part('cymbal', [[0.5, null, 2, 0.3]]),
    ],
    [0.5],
  ),
  trickTune(
    'highfive',
    'Up High',
    4,
    [
      part('marimba', [
        [0, 'E5', 0.25],
        [0.25, 'G5', 0.25],
        [0.5, 'A5', 0.5],
        [1.5, 'C6', 0.25, 0.9],
        [2, 'A5', 0.25],
        [2.25, 'C6', 1.2, 0.85],
      ]),
      part('bass', [
        [1.5, 'F2', 0.5, 0.7],
        [2.25, 'C3', 1, 0.7],
      ]),
      // The slap.
      hits('clap', [1.5], 0.9),
    ],
    [1.5],
  ),
  trickTune(
    'tailchase',
    'Round and Round',
    4,
    [
      part('accordion', [
        [0, 'C5', 0.25],
        [0.25, 'D5', 0.25],
        [0.5, 'E5', 0.25],
        [0.75, 'C5', 0.25],
        [1, 'D5', 0.25],
        [1.25, 'E5', 0.25],
        [1.5, 'F5', 0.25],
        [1.75, 'D5', 0.25],
        [2, 'E5', 0.25],
        [2.25, 'F5', 0.25],
        [2.5, 'G5', 0.4],
        // Dizzy.
        [3, 'A4', 0.5, 0.6],
        [3.5, 'G4', 0.45, 0.55],
      ]),
      part('tuba', [
        [0, 'C3', 0.4, 0.65],
        [1, 'C3', 0.4, 0.65],
        [2, 'G2', 0.4, 0.65],
        [3, 'A2', 0.8, 0.7],
      ]),
      hits('block', [0, 1, 2], 0.45),
    ],
    [0, 3],
  ),
  trickTune(
    'somersault',
    'Tumble',
    4,
    [
      part('marimba', [
        [0, 'G4', 0.25, 0.6],
        [0.25, 'C5', 0.25, 0.65],
        [2.6, 'E6', 0.25, 0.8],
        [2.85, 'C6', 1, 0.9],
      ]),
      part('swoop', [[0.6, 'C5', 1.6, 0.5, 'C6']]),
      hits('stomp', [0.6, 2.6], 0.6),
      part('cymbal', [[2.6, null, 1.3, 0.25]]),
    ],
    [0.6, 2.6],
  ),
  trickTune(
    'balloon',
    'Up, Up and Away',
    8,
    [
      part('whistle', [
        [0, 'E5', 1, 0.45],
        [1, 'G5', 1, 0.45],
        [2, 'A5', 1, 0.5],
        [3, 'C6', 2, 0.5],
        [5, 'B5', 1, 0.45],
        [6, 'G5', 1.9, 0.45],
      ]),
      part('pad', [
        [0, C, 2, 0.4],
        [2, F, 2, 0.4],
        [4, Am, 2, 0.4],
        [6, G, 2, 0.4],
      ]),
      part('swoop', [[1, 'C5', 3, 0.35, 'C6']]),
      part('bell', [
        [3, 'E6', 2, 0.3],
        [7, 'G6', 1, 0.28],
      ]),
    ],
    [0, 3],
  ),
  trickTune(
    'drumsolo',
    'Drum Roll, Please',
    8,
    [
      hits('stomp', [0, 1, 2, 3, 4, 5], 0.45),
      // Faster and faster, then the crash.
      hits('block', [0.5, 1.5, 2.5, 3.5, 4, 4.5, 5, 5.25, 5.5, 5.75, 6, 6.125, 6.25, 6.375], 0.7, 0.125),
      part('brass', [
        [5.5, 'G4', 0.25, 0.5],
        [5.75, 'A4', 0.25, 0.52],
        [6, 'B4', 0.25, 0.55],
        [6.5, ['C4', 'G4', 'C5'], 1.4, 0.75],
      ]),
      part('bass', [
        [0, 'C3', 0.5, 0.5],
        [2, 'G2', 0.5, 0.5],
        [4, 'A2', 0.5, 0.5],
        [6.5, 'C3', 1.4, 0.65],
      ]),
      part('cymbal', [[6.5, null, 1.5, 0.45]]),
    ],
    [0, 6.5],
  ),
  trickTune(
    'moonwalk',
    'Smooth Glide',
    6,
    [
      part('whistle', [
        [0, 'A4', 0.5, 0.45],
        [0.5, 'C5', 0.5, 0.45],
        [1, 'E5', 1, 0.5],
        [2, 'D5', 0.5, 0.45],
        [2.5, 'C5', 0.5, 0.45],
        [3, 'A4', 1, 0.45],
        [4, 'G4', 0.5, 0.42],
        [4.5, 'A4', 1.4, 0.48],
      ]),
      part('bass', [
        [0, 'A2', 0.5, 0.65],
        [1, 'C3', 0.5, 0.6],
        [2, 'D3', 0.5, 0.6],
        [3, 'E3', 0.5, 0.6],
        [4, 'D3', 0.5, 0.6],
        [4.5, 'A2', 1.2, 0.7],
      ]),
      hits('clap', [1, 3, 5], 0.55),
    ],
    [0, 4.5],
  ),
  trickTune(
    'disco',
    'Glitter Ball',
    6,
    [
      hits('stomp', [0, 1, 2, 3, 4, 5], 0.35),
      hits('shaker', [0.5, 1.5, 2.5, 3.5, 4.5, 5.5], 0.5),
      part('bass', [
        [0, 'C3', 0.25, 0.4],
        [0.5, 'C4', 0.25, 0.38],
        [1, 'C3', 0.25, 0.4],
        [1.5, 'C4', 0.25, 0.38],
        [2, 'A2', 0.25, 0.4],
        [2.5, 'A3', 0.25, 0.38],
        [3, 'A2', 0.25, 0.4],
        [3.5, 'A3', 0.25, 0.38],
        [4, 'F2', 0.25, 0.4],
        [4.5, 'F3', 0.25, 0.38],
        [5, 'G2', 0.25, 0.4],
        [5.5, 'G3', 0.4, 0.38],
      ]),
      part('pluck', [
        [0.5, C, 0.25, 0.65],
        [1.5, C, 0.25, 0.65],
        [2.5, Am, 0.25, 0.65],
        [3.5, Am, 0.25, 0.65],
        [4.5, F, 0.25, 0.65],
        [5.5, G, 0.4, 0.7],
      ]),
      part('glock', [
        [0, 'E6', 0.5, 0.8],
        [0.5, 'D6', 0.25, 0.7],
        [0.75, 'E6', 0.25, 0.75],
        [1, 'G6', 0.5, 0.8],
        [1.5, 'E6', 0.5, 0.75],
        [2, 'E6', 0.5, 0.8],
        [2.5, 'C6', 0.25, 0.7],
        [2.75, 'D6', 0.25, 0.75],
        [3, 'C6', 0.5, 0.8],
        [3.5, 'A5', 0.5, 0.75],
        [4, 'A6', 0.5, 0.8],
        [4.5, 'G6', 0.25, 0.7],
        [4.75, 'F6', 0.25, 0.75],
        [5, 'G6', 1, 0.85],
      ]),
    ],
    [0, 5],
  ),
  trickTune(
    'chickendance',
    'Cluck Cluck Clap',
    8,
    [
      // Pecking, a wiggle, the claps, a turn: an oom-pah under all of it.
      part('accordion', [
        [0, 'C5', 0.25],
        [0.25, 'E5', 0.25],
        [0.5, 'C5', 0.25],
        [0.75, 'E5', 0.25],
        [1, 'D5', 0.25],
        [1.25, 'F5', 0.25],
        [1.5, 'D5', 0.5],
        [2.5, 'F5', 0.5],
        [3, 'D5', 0.5],
        [3.5, 'B4', 0.5],
        [5.5, 'G4', 0.5],
        [6, 'C5', 0.5],
        [6.5, 'E5', 0.5],
        [7, 'G5', 0.9, 0.9],
      ]),
      part('tuba', [
        [0, 'C3', 0.4],
        [1, 'G2', 0.4],
        [2, 'G2', 0.4],
        [3, 'G2', 0.4],
        [4, 'C3', 0.4],
        [6, 'C3', 0.4],
        [7, 'C3', 0.8],
      ]),
      hits('block', [0, 0.25, 0.5, 0.75, 1, 1.25], 0.45),
      hits('clap', [4.5, 4.75, 5, 5.25], 0.8),
    ],
    [0, 4.5, 7],
  ),
  trickTune(
    'startwirl',
    'Starlight Spin',
    8,
    [
      part('kalimba', [
        [0, 'C5', 0.25],
        [0.25, 'G5', 0.25],
        [0.5, 'E5', 0.25],
        [0.75, 'C6', 0.25],
        [1, 'G5', 0.25],
        [1.25, 'E6', 0.25],
        [1.5, 'C6', 0.25],
        [1.75, 'G6', 0.5],
        [2.5, 'A5', 0.25],
        [2.75, 'F5', 0.25],
        [3, 'C6', 0.25],
        [3.25, 'A6', 0.5],
        [4, 'B5', 0.25],
        [4.25, 'G5', 0.25],
        [4.5, 'D6', 0.25],
        [4.75, 'B6', 0.5],
        [6, 'E6', 1.6, 0.85],
      ]),
      part('pad', [
        [0, C, 2.5, 0.4],
        [2.5, F, 1.5, 0.4],
        [4, G, 2, 0.4],
        [6, Cmaj7, 2, 0.42],
      ]),
      part('bell', [[6, 'G6', 2, 0.35]]),
      part('cymbal', [[6, null, 2, 0.25]]),
    ],
    [0, 6],
  ),
  trickTune(
    'boogie',
    'Barnyard Boogie-Woogie',
    8,
    [
      part('marimba', [
        [0, 'C5', 0.33],
        [0.33, 'C5', 0.17],
        [0.5, 'E5', 0.5],
        [1, 'G5', 0.33],
        [1.33, 'G5', 0.17],
        [1.5, 'A5', 0.5],
        [2, 'A5', 0.33],
        [2.33, 'G5', 0.17],
        [2.5, 'E5', 0.5],
        [3, 'D5', 0.5],
        [4.5, 'C6', 0.5, 0.9],
        [5, 'A5', 0.5],
        [5.5, 'G5', 0.5],
      ]),
      part('bass', [
        [0, 'C2', 0.5],
        [0.5, 'E2', 0.5],
        [1, 'G2', 0.5],
        [1.5, 'A2', 0.5],
        [2, 'C3', 0.5],
        [2.5, 'A2', 0.5],
        [3, 'G2', 0.5],
        [3.5, 'E2', 0.5],
        [4, 'F2', 0.5],
        [4.5, 'A2', 0.5],
        [5, 'G2', 0.5],
        [6, 'C2', 0.5],
        [7, 'C2', 1, 0.9],
      ]),
      // The big finish, on the farm's C–E–G.
      part('brass', [
        [6.25, ['C5', 'E5', 'G5'], 0.5, 0.7],
        [7, ['C5', 'E5', 'G5', 'C6'], 1, 0.75],
      ]),
      hits('clap', [1, 3, 5, 7], 0.6),
      hits('stomp', [0, 2, 4, 6, 7], 0.7),
    ],
    [0, 4.5, 7],
  ),
  trickTune(
    'duet',
    'Two Together',
    8,
    [
      // One sings, the other answers; then both together, a third apart.
      part('kalimba', [
        [0, 'E5', 0.5],
        [0.5, 'F5', 0.5],
        [1, 'G5', 1],
        [2, 'E5', 0.5],
        [2.5, 'D5', 0.5],
        [3, 'C5', 1],
        [4.5, 'A5', 0.5],
        [5, 'G5', 0.5],
        [5.5, 'F5', 0.5],
        [6, 'E5', 1.6, 0.85],
      ]),
      part('whistle', [
        [1, 'C5', 0.5, 0.4],
        [1.5, 'D5', 0.5, 0.4],
        [2, 'E5', 1, 0.4],
        [3, 'C5', 0.5, 0.4],
        [3.5, 'B4', 0.5, 0.4],
        [4, 'A4', 0.5, 0.4],
        [4.5, 'F5', 0.5, 0.42],
        [5, 'E5', 0.5, 0.42],
        [5.5, 'D5', 0.5, 0.42],
        [6, 'C5', 1.6, 0.45],
      ]),
      part('pluck', [
        [0, C, 1, 0.4],
        [2, C, 1, 0.4],
        [4, F, 1, 0.4],
        [6, C, 1.2, 0.45],
      ]),
      part('bass', [
        [0, 'C3', 1, 0.55],
        [4, 'F2', 1, 0.55],
        [6, 'C3', 1.5, 0.6],
      ]),
    ],
    [0, 6],
  ),
  trickTune(
    'miniparade',
    'Little March',
    8,
    [
      part('glock', [
        [0, 'C6', 0.5],
        [0.5, 'C6', 0.25],
        [0.75, 'D6', 0.25],
        [1, 'E6', 0.5],
        [1.5, 'C6', 0.5],
        [2, 'G6', 1],
        [3, 'E6', 0.5],
        [3.5, 'D6', 0.5],
        [4, 'F6', 0.5],
        [4.5, 'E6', 0.5],
        [5, 'D6', 0.5],
        [5.5, 'B5', 0.5],
        [6, 'C6', 1.6, 0.9],
      ]),
      part('tuba', [
        [0, 'C3', 0.4],
        [1, 'G2', 0.4],
        [2, 'C3', 0.4],
        [3, 'G2', 0.4],
        [4, 'F2', 0.4],
        [5, 'G2', 0.4],
        [6, 'C3', 1.2, 0.8],
      ]),
      hits('block', [0.5, 1.5, 2.5, 3.5, 4.5, 5.5], 0.4),
      part('whistle', [
        [2, 'E5', 1, 0.35],
        [6, 'E5', 1.6, 0.35],
      ]),
    ],
    [0, 6],
  ),
];

// ------------------------------------------------------------------ Meadow Morning: the homes' ambient tune, ~27 s

/**
 * The ambient tune (D45 PR D, optional: Settings → Home music). The Welcome Parade's theme, slowed right down and
 * thinned out: its motif opens and closes it, and its tune's turns (A–C–F, B–D–G) come by in the middle. Quiet, no
 * drums, long rests: it sits under a visit, it doesn't ask for attention.
 */
const meadow: Score = {
  id: 'meadow',
  title: 'Meadow Morning',
  bpm: 72,
  beats: 32,
  accents: [0, 28],
  parts: [
    part('pad', [
      [0, C, 4, 0.4],
      [4, F, 4, 0.4],
      [8, G, 4, 0.4],
      [12, C, 4, 0.4],
      [16, Am, 4, 0.4],
      [20, F, 4, 0.4],
      [24, G, 4, 0.4],
      [28, C, 4.5, 0.42],
    ]),
    part('bass', [
      [0, 'C3', 3, 0.4],
      [4, 'F2', 3, 0.4],
      [8, 'G2', 3, 0.4],
      [12, 'C3', 3, 0.4],
      [16, 'A2', 3, 0.4],
      [20, 'F2', 3, 0.4],
      [24, 'G2', 3, 0.4],
      [28, 'C3', 4, 0.42],
    ]),
    part('kalimba', [
      // The motif, unhurried.
      [0, 'C5', 1, 0.6],
      [1, 'E5', 1, 0.6],
      [2, 'G5', 2, 0.65],
      // The theme's first turn.
      [4, 'A4', 1, 0.55],
      [5, 'C5', 1, 0.55],
      [6, 'F5', 1.5, 0.6],
      [7.5, 'E5', 0.5, 0.5],
      // Its second.
      [8, 'B4', 1, 0.55],
      [9, 'D5', 1, 0.55],
      [10, 'G5', 1.5, 0.6],
      [11.5, 'F5', 0.5, 0.5],
      [12, 'E5', 3, 0.6],
      [20, 'F5', 1, 0.5],
      [21, 'A5', 1, 0.5],
      [22, 'C6', 2, 0.55],
      // And the motif again, to close.
      [28, 'C5', 1, 0.55],
      [29, 'E5', 1, 0.55],
      [30, 'G5', 1, 0.6],
      [31, 'C6', 1.9, 0.6],
    ]),
    part('whistle', [
      [16, 'A5', 2, 0.3],
      [18, 'E5', 2, 0.3],
      [24, 'B5', 1, 0.3],
      [25, 'G5', 1, 0.3],
      [26, 'D5', 2, 0.3],
    ]),
    part('glock', [
      [3, 'G6', 1, 0.2],
      [14, 'C7', 1, 0.18],
      [15, 'G6', 1, 0.18],
      [23, 'E6', 1, 0.2],
      [31.5, 'G6', 1.4, 0.2],
    ]),
  ],
};

export const SCORES: Record<CueId, Score> = Object.fromEntries([triumph, welcome, bounce, jig, meadow, hopalong, sparkle, circle, ...tricks].map((s) => [s.id, s])) as Record<CueId, Score>;

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

// ------------------------------------------------------------------ rhythm: who is performing (D45 PR D)

/**
 * A rhythmic personality: a small figure laid under a trick's tune (or the parade's intro) for the animal performing
 * it, so a sheep's wave and a piglet's wave don't sound the same. Mostly unpitched; where it has notes they are the
 * key's first and fifth, quiet, so it sits under any of the tunes.
 *
 *  - `lilt`: a soft two-note sway and a brush of shaker (sheep, koalas, sloths, capybaras, seals).
 *  - `oompah`: tuba on the beat, a wood block off it (pigs).
 *  - `plod`: a heavy step every other beat with a low tuba (cows, elephants, wombats, polar bears).
 *  - `peck`: quick double taps on the wood block (chickens, toucans, owls, meerkats).
 *  - `clipclop`: a gallop, da–da-dum (horses, goats, giraffes).
 *  - `bounce`: a stomp and a late kick, dotted (kangaroos, rabbits, dogs).
 *  - `prowl`: off-beat kalimba, light on its feet (cats, foxes, red pandas).
 */
export type RhythmFeel = 'lilt' | 'oompah' | 'plod' | 'peck' | 'clipclop' | 'bounce' | 'prowl';
export const RHYTHM_FEELS: readonly RhythmFeel[] = ['lilt', 'oompah', 'plod', 'peck', 'clipclop', 'bounce', 'prowl'];

const FEEL_BY_KIND: Record<string, RhythmFeel> = {
  sheep: 'lilt',
  koala: 'lilt',
  sloth: 'lilt',
  capybara: 'lilt',
  seal: 'lilt',
  pig: 'oompah',
  cow: 'plod',
  elephant: 'plod',
  wombat: 'plod',
  polarbear: 'plod',
  chicken: 'peck',
  toucan: 'peck',
  owl: 'peck',
  meerkat: 'peck',
  horse: 'clipclop',
  goat: 'clipclop',
  giraffe: 'clipclop',
  kangaroo: 'bounce',
  rabbit: 'bounce',
  dog: 'bounce',
  cat: 'prowl',
  fox: 'prowl',
  redpanda: 'prowl',
};

/** The rhythm for a kind of animal ('sheep', 'pig'…); the soft lilt for one not listed. */
export function rhythmFor(kind: string | undefined): RhythmFeel {
  return (kind && FEEL_BY_KIND[kind]) || 'lilt';
}

/** The figure for `feel`, on every beat from `from` up to (not including) `to`. */
export function rhythmParts(feel: RhythmFeel, from: number, to: number): Part[] {
  const beats: number[] = [];
  for (let b = Math.ceil(from); b < to; b++) beats.push(b);
  const each = (f: (b: number, i: number) => Raw[]): Raw[] => beats.flatMap((b, i) => f(b, i).filter((r) => r[0] < to));
  switch (feel) {
    case 'lilt':
      return [part('kalimba', each((b, i) => [[b + 0.5, i % 2 ? 'E4' : 'G4', 0.4, 0.3]])), hits('shaker', beats, 0.22)];
    case 'oompah':
      return [part('tuba', each((b, i) => [[b, i % 2 ? 'G2' : 'C3', 0.35, 0.5]])), part('block', each((b) => [[b + 0.5, null, 0.2, 0.32]]))];
    case 'plod':
      return [
        part(
          'tuba',
          each((b, i) => (i % 2 ? [] : [[b, 'C2', 0.7, 0.5]])),
        ),
        part(
          'stomp',
          each((b, i) => (i % 2 ? [] : [[b, null, 0.25, 0.5]])),
        ),
      ];
    case 'peck':
      return [
        part(
          'block',
          each((b) => [
            [b, null, 0.12, 0.34],
            [b + 0.25, null, 0.12, 0.24],
          ]),
        ),
        part('shaker', each((b) => [[b + 0.75, null, 0.12, 0.2]])),
      ];
    case 'clipclop':
      return [
        part(
          'block',
          each((b) => [
            [b, null, 0.12, 0.36],
            [b + 0.5, null, 0.12, 0.26],
            [b + 0.75, null, 0.12, 0.3],
          ]),
        ),
      ];
    case 'bounce':
      return [part('stomp', each((b) => [[b, null, 0.2, 0.42]])), part('block', each((b) => [[b + 0.75, null, 0.12, 0.34]]))];
    case 'prowl':
      return [
        part(
          'kalimba',
          each((b, i) => [
            [b + 0.25, i % 2 ? 'G4' : 'E4', 0.25, 0.28],
            [b + 0.75, 'C5', 0.25, 0.24],
          ]),
        ),
        part('shaker', each((b) => [[b + 0.5, null, 0.12, 0.18]])),
      ];
  }
}

const withFeelCache = new Map<string, Score>();
/** `score` with an animal's rhythm under it: the whole tune, or only the beats `[from, to)` (the parade's intro). */
export function withRhythm(score: Score, feel: RhythmFeel, span?: [number, number]): Score {
  const [from, to] = span ?? [0, score.beats];
  const key = `${score.id}|${score.title}|${feel}|${from}|${to}`;
  let out = withFeelCache.get(key);
  if (!out) {
    out = { ...score, parts: [...score.parts, ...rhythmParts(feel, from, Math.min(to, score.beats))] };
    withFeelCache.set(key, out);
  }
  return out;
}

// ------------------------------------------------------------------ the theme, and its variations by home (D45 PR D)

/**
 * **The PawTyk theme** is Barnyard Bounce's tune (A–C–F… B–D–G… and the motif up to the top C). Every home plays the
 * same notes at the same tempo, so the dances fit them all, with its own band:
 *
 *  - Farm: the original (marimba, banjo strums, brass).
 *  - Pet Garden: a toy box (glockenspiel over the marimba).
 *  - Outback: thumb piano and a low tuba drone.
 *  - Savanna: marimba over hand-drum patter (wood blocks between the beats).
 *  - Arctic: glockenspiel and bells, the brass swapped for a whistle.
 *  - Amazon: a whistled tune over thumb piano, shakers all the way.
 *
 * The Jig (the short parade) and Meadow Morning (the ambient tune) take the same variation.
 */
export type ThemeHome = 'farm' | 'harmony' | 'outback' | 'savanna' | 'arctic' | 'amazon';
export const THEME_HOMES: readonly ThemeHome[] = ['farm', 'harmony', 'outback', 'savanna', 'arctic', 'amazon'];
export const isThemeHome = (h: string | undefined): h is ThemeHome => !!h && (THEME_HOMES as readonly string[]).includes(h);

const VOICING: Record<ThemeHome, Partial<Record<Instrument, Instrument>>> = {
  farm: {},
  harmony: {},
  outback: { marimba: 'kalimba', brass: 'accordion' },
  savanna: { pluck: 'kalimba' },
  arctic: { marimba: 'glock', pluck: 'bell', brass: 'whistle' },
  amazon: { marimba: 'whistle', pluck: 'kalimba', brass: 'accordion' },
};

/** What a home adds to the theme, over the beats of its dance (or the whole of a tune with no sections). */
function colour(home: ThemeHome, score: Score): Part[] {
  const [from, to] = score.sections?.dance ?? [0, score.beats];
  const beats: number[] = [];
  for (let b = from; b < to; b++) beats.push(b);
  const lead = score.parts.find((p) => p.inst === 'marimba' || p.inst === 'kalimba');
  switch (home) {
    case 'harmony':
      // The tune doubled an octave up on the glockenspiel, softly.
      return lead ? [{ inst: 'glock', notes: lead.notes.filter((n) => n.p.every((m) => m + 12 <= midi('C7'))).map((n) => ({ ...n, p: n.p.map((m) => m + 12), v: n.v * 0.35 })) }] : [];
    case 'outback':
      return score.id === 'meadow' ? [] : [part('tuba', beats.filter((_, i) => i % 4 === 0).map((b) => [b, 'C2', 2, 0.35] as Raw))];
    case 'savanna':
      return score.id === 'meadow'
        ? []
        : [
            part(
              'block',
              beats.flatMap((b) => [
                [b + 0.25, null, 0.12, 0.26],
                [b + 0.75, null, 0.12, 0.3],
              ]),
            ),
          ];
    case 'arctic':
      return [part('bell', beats.filter((_, i) => i % 2 === 0).map((b) => [b, 'G6', 0.6, 0.16] as Raw))];
    case 'amazon':
      return score.id === 'meadow' ? [] : [hits('shaker', beats.flatMap((b) => [b, b + 0.25, b + 0.75]), 0.22, 0.12)];
    default:
      return [];
  }
}

const variationCache = new Map<string, Score>();
/** A cue as `home` plays it: the theme's cues (the parade, the jig, the ambient tune) re-voiced; any other, as written. */
export function themeVariation(score: Score, home: string | undefined): Score {
  if (!isThemeHome(home) || home === 'farm' || !['bounce', 'jig', 'meadow'].includes(score.id)) return score;
  const key = `${score.id}|${home}`;
  let out = variationCache.get(key);
  if (!out) {
    const map = VOICING[home];
    out = { ...score, title: `${score.title} (${home})`, parts: [...score.parts.map((p) => (map[p.inst] ? { ...p, inst: map[p.inst]! } : p)), ...colour(home, score)] };
    variationCache.set(key, out);
  }
  return out;
}

/** The theme's tune: the pitches of the lead voice, in order (tests check every variation keeps them). */
export function leadLine(score: Score): number[] {
  const leads: Instrument[] = ['marimba', 'kalimba', 'glock', 'whistle'];
  // The busiest of the melody voices carries the tune (a strummed part re-voiced for a home may be a melody voice too).
  let lead: Part | undefined;
  for (const p of score.parts) if (leads.includes(p.inst) && p.notes.length > (lead?.notes.length ?? 4)) lead = p;
  return lead ? [...lead.notes].sort((a, b) => a.b - b.b).map((n) => n.p[0]) : [];
}
