/**
 * PawTyk's music player (D44 PR B). It plays the scores in `audio/scores.ts` with synthesized instruments on their own
 * channel (so Music and Sound effects each keep their own switch), and gives every cue a **beat clock** that the
 * dances and celebrations follow. The clock runs even when music is off or audio is unavailable: the choreography
 * keeps its timing in silence.
 *
 *  - One cue at a time: a new one fades out whatever was playing.
 *  - Leaving the app (the page is hidden) fades the music out at once.
 *  - Any cue can be replaced by a recorded track later: `useRecordedTrack(id, url)` loads it, and from then on that
 *    cue plays the recording at the score's tempo (its beat clock still follows the score).
 */

import { audioContext } from './audio';
import { beatSec, cueMs, hz, scoreFor, themeVariation, withRhythm, type CueId, type Instrument, type Note, type RhythmFeel, type Score } from '../audio/scores';

/** The music channel's level: under the sound effects, so a tap or a pop always reads through. */
export const MUSIC_GAIN = 0.34;

let enabled = false;
let bus: GainNode | null = null;
let current: Playback | null = null;
/** Cues past their last beat whose final notes are still ringing: a stop or a new cue fades these too. */
const ringing = new Set<(fadeMs: number) => void>();
const recorded = new Map<CueId, AudioBuffer>();
const noiseFor = new WeakMap<BaseAudioContext, AudioBuffer>();

export interface Playback {
  readonly id: CueId;
  readonly score: Score;
  /** Whether it can be heard (music on and audio available). The clock runs either way. */
  readonly audible: boolean;
  /** `performance.now()` at beat 0. */
  readonly startMs: number;
  readonly durationMs: number;
  /** The beat at `nowMs` (negative before the start). */
  beatAt(nowMs?: number): number;
  /** `performance.now()` at a given beat. */
  msAt(beat: number): number;
  /** Fades out (or stops at once with 0) and settles `done`. Safe to call more than once. */
  stop(fadeMs?: number): void;
  /** Settles when the cue ends or is stopped. */
  readonly done: Promise<void>;
  readonly stopped: boolean;
}

export function setMusicEnabled(on: boolean): void {
  enabled = on;
  if (!on) {
    stopMusic(120);
    stopAmbient(120);
  }
}

export function musicEnabled(): boolean {
  return enabled;
}

/**
 * The music channel's master chain (D45 PR D), for small speakers: a high-pass takes out the rumble no phone can play
 * (it only eats headroom), and a gentle compressor holds the loud moments (a full finish chord, a cue over an ambient
 * tune) under clipping while the quiet tunes keep their level. Returns the node to play into. Works on an
 * OfflineAudioContext too (the music check measures cues through it); on a context without these nodes it is a plain
 * gain.
 */
export function musicChain(ctx: BaseAudioContext, dest: AudioNode, gain = MUSIC_GAIN): GainNode {
  const input = ctx.createGain();
  input.gain.value = gain;
  try {
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 55;
    hp.Q.value = 0.7;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -20;
    comp.knee.value = 12;
    comp.ratio.value = 3.5;
    comp.attack.value = 0.006;
    comp.release.value = 0.18;
    // Make-up: what the compressor takes off the peaks comes back as level for everything else.
    const makeup = ctx.createGain();
    makeup.gain.value = 1.25;
    input.connect(hp).connect(comp).connect(makeup).connect(dest);
  } catch {
    input.connect(dest);
  }
  return input;
}

function musicBus(a: AudioContext): GainNode {
  if (!bus || bus.context !== a) bus = musicChain(a, a.destination);
  return bus;
}

/** Stops whatever is playing (and any last notes still ringing), with a short fade. */
export function stopMusic(fadeMs = 150): void {
  current?.stop(fadeMs);
  current = null;
  for (const hush of [...ringing]) hush(fadeMs);
  // A cue ended early (skipped): the ambient tune needn't wait for its scheduled end.
  if (ambient?.ducked) restoreWhenQuiet(ambient);
}

/** The cue playing now, if any. */
export function nowPlaying(): Playback | null {
  return current && !current.stopped ? current : null;
}

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

/**
 * Plays a cue and returns its clock. With music off (or no audio), the clock runs silently, so a dance that follows it
 * keeps the same timing. Unknown cues return null.
 */
export interface CueOptions {
  silent?: boolean;
  /** The home it plays in (D45 PR D): the theme's cues are voiced by each home's own band. */
  home?: string;
  /** The performing animal's rhythm, laid under the tune; `rhythmSpan` keeps it to some beats (the parade's intro). */
  rhythm?: RhythmFeel;
  rhythmSpan?: [number, number];
}

/** A cue as these options ask for it: its home's variation, the animal's rhythm under it. Same beats, same tempo. */
export function arrange(id: CueId, opts: CueOptions = {}): Score | undefined {
  let score = scoreFor(id);
  if (!score) return undefined;
  score = themeVariation(score, opts.home);
  if (opts.rhythm) score = withRhythm(score, opts.rhythm, opts.rhythmSpan);
  return score;
}

export function playCue(id: CueId, opts: CueOptions = {}): Playback | null {
  const score = arrange(id, opts);
  if (!score) return null;
  stopMusic(80);
  const a = enabled && !opts.silent ? audioContext() : null;
  const lead = 0.04;
  const startMs = perfNow() + lead * 1000;
  const durationMs = cueMs(score);
  const spb = beatSec(score);
  let out: GainNode | null = null;
  const sources: AudioScheduledSourceNode[] = [];
  if (a) {
    try {
      out = a.createGain();
      out.gain.value = 1;
      out.connect(musicBus(a));
      const t0 = a.currentTime + lead;
      const rec = recorded.get(id);
      if (rec) {
        const src = a.createBufferSource();
        src.buffer = rec;
        src.connect(out);
        src.start(t0);
        sources.push(src);
      } else {
        renderScore(a, out, score, t0, sources);
      }
    } catch {
      out = null;
    }
  }
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  let stopped = false;
  let endTimer: ReturnType<typeof setTimeout> | null = null;
  const finish = () => {
    if (stopped) return;
    stopped = true;
    if (endTimer) clearTimeout(endTimer);
    resolve();
  };
  /** Fades this cue's output and stops its sources (the playback's own stop, or a ring cut short). */
  const silence = (fadeMs: number) => {
    if (!out || !a) return;
    try {
      const now = a.currentTime;
      out.gain.cancelScheduledValues(now);
      out.gain.setValueAtTime(out.gain.value, now);
      if (fadeMs <= 0) out.gain.setValueAtTime(0, now);
      else out.gain.linearRampToValueAtTime(0, now + fadeMs / 1000);
      const end = now + Math.max(0, fadeMs) / 1000 + 0.02;
      for (const s of sources) {
        try {
          s.stop(end);
        } catch {
          /* already stopped */
        }
      }
      const o = out;
      setTimeout(() => o.disconnect(), fadeMs + 60);
    } catch {
      /* audio gone */
    }
  };
  const pb: Playback = {
    id,
    score,
    audible: !!out,
    startMs,
    durationMs,
    beatAt: (now = perfNow()) => (now - startMs) / 1000 / spb,
    msAt: (beat) => startMs + beat * spb * 1000,
    get stopped() {
      return stopped;
    },
    done,
    stop(fadeMs = 150) {
      if (stopped) return;
      silence(fadeMs);
      finish();
    },
  };
  // The cue's beats, plus the last notes' ring. While they ring, a stop (music off, the app hidden) or the next cue
  // still fades them (D44 PR B review).
  endTimer = setTimeout(
    () => {
      if (current === pb) current = null;
      finish();
      if (!out) return;
      let hushed = false;
      const hush = (fadeMs: number) => {
        if (hushed) return;
        hushed = true;
        ringing.delete(hush);
        silence(fadeMs);
      };
      ringing.add(hush);
      setTimeout(() => {
        if (hushed) return;
        hushed = true;
        ringing.delete(hush);
        out?.disconnect();
      }, 1200);
    },
    durationMs + lead * 1000,
  );
  current = pb;
  // An ambient tune steps back while a cue plays, and comes up again when it's over.
  duckAmbient();
  return pb;
}

/** Replaces a cue's synthesized score with a recorded track (an audio file at the score's tempo). */
export async function useRecordedTrack(id: CueId, url: string): Promise<boolean> {
  const a = audioContext();
  if (!a) return false;
  try {
    const res = await fetch(url);
    if (!res.ok) return false;
    recorded.set(id, await a.decodeAudioData(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

// ------------------------------------------------------------------ the ambient tune (D45 PR D)

/** Under the cues: an ambient tune is half a cue's level, and drops to a third of that while a cue plays. */
export const AMBIENT_LEVEL = 0.5;
export const AMBIENT_DUCK = 0.3;
/** Quiet between plays, and how many times it plays in one visit before it leaves the place in peace. */
export const AMBIENT_REST_MS = 9000;
export const AMBIENT_PLAYS = 4;

interface Ambient {
  home: string | undefined;
  score: Score;
  plays: number;
  out: GainNode | null;
  ctx: AudioContext | null;
  sources: AudioScheduledSourceNode[];
  timer: ReturnType<typeof setTimeout> | null;
  duckTimer: ReturnType<typeof setTimeout> | null;
  /** Stepped back under a cue (also tracked without audio, for tests). */
  ducked: boolean;
}
let ambient: Ambient | null = null;

/**
 * Starts the ambient tune for a home (Meadow Morning in that home's voicing): it plays, rests, and plays again, up
 * to `AMBIENT_PLAYS` times, quietly. False with music off or the app hidden. One at a time; a cue ducks it.
 */
export function startAmbient(home?: string): boolean {
  stopAmbient(200);
  const score = arrange('meadow', { home });
  if (!enabled || !score || (typeof document !== 'undefined' && document.hidden)) return false;
  const am: Ambient = { home, score, plays: 0, out: null, ctx: null, sources: [], timer: null, duckTimer: null, ducked: false };
  ambient = am;
  const a = audioContext();
  if (a) {
    try {
      am.ctx = a;
      am.out = a.createGain();
      am.out.gain.value = 0.0001;
      am.out.connect(musicBus(a));
    } catch {
      am.out = null;
    }
  }
  const play = () => {
    if (ambient !== am) return;
    am.plays++;
    // Started (or started again) while a cue is playing: in under it, and up when the cue is over (D45 PR D review:
    // started during the parade, it used to stay stepped back for its whole first play).
    const under = !!current && !current.stopped;
    setLevel(am, under ? AMBIENT_LEVEL * AMBIENT_DUCK : AMBIENT_LEVEL, 1.2);
    if (under) restoreWhenQuiet(am);
    if (am.out && am.ctx) {
      try {
        am.sources = [];
        renderScore(am.ctx, am.out, score, am.ctx.currentTime + 0.1, am.sources);
      } catch {
        /* audio gone: the visit goes on in silence */
      }
    }
    am.timer = setTimeout(() => {
      am.timer = null;
      if (ambient !== am) return;
      if (am.plays >= AMBIENT_PLAYS) stopAmbient(0);
      else play();
    }, cueMs(score) + AMBIENT_REST_MS);
  };
  play();
  return true;
}

export function stopAmbient(fadeMs = 600): void {
  const am = ambient;
  if (!am) return;
  ambient = null;
  if (am.timer) clearTimeout(am.timer);
  if (am.duckTimer) clearTimeout(am.duckTimer);
  if (!am.out || !am.ctx) return;
  try {
    const now = am.ctx.currentTime;
    am.out.gain.cancelScheduledValues(now);
    am.out.gain.setValueAtTime(am.out.gain.value, now);
    am.out.gain.linearRampToValueAtTime(0, now + Math.max(0.01, fadeMs / 1000));
    const end = now + fadeMs / 1000 + 0.05;
    for (const s of am.sources) {
      try {
        s.stop(end);
      } catch {
        /* already stopped */
      }
    }
    const o = am.out;
    setTimeout(() => o.disconnect(), fadeMs + 120);
  } catch {
    /* audio gone */
  }
}

/** The ambient tune playing now (its home, and how many times it has played this visit), if any. */
export function ambientPlaying(): { home: string | undefined; plays: number; title: string; ducked: boolean } | null {
  return ambient ? { home: ambient.home, plays: ambient.plays, title: ambient.score.title, ducked: ambient.ducked } : null;
}

/** Ramps the ambient tune to `level` over `over` seconds. */
function setLevel(am: Ambient, level: number, over: number): void {
  am.ducked = level < AMBIENT_LEVEL;
  if (!am.out || !am.ctx) return;
  try {
    const now = am.ctx.currentTime;
    am.out.gain.cancelScheduledValues(now);
    am.out.gain.setValueAtTime(Math.max(0.0001, am.out.gain.value), now);
    am.out.gain.linearRampToValueAtTime(level, now + over);
  } catch {
    /* audio gone */
  }
}

/**
 * Brings the ambient tune back up once no cue is playing: when the cue playing now is due to end (its ring included),
 * or at once if there is none. If another cue has started by then, it waits for that one in turn.
 */
function restoreWhenQuiet(am: Ambient): void {
  if (am.duckTimer) clearTimeout(am.duckTimer);
  const cue = current && !current.stopped ? current : null;
  const wait = cue ? Math.max(0, cue.startMs + cue.durationMs - perfNow()) + 400 : 0;
  am.duckTimer = setTimeout(() => {
    am.duckTimer = null;
    if (ambient !== am) return;
    if (current && !current.stopped) restoreWhenQuiet(am);
    else setLevel(am, AMBIENT_LEVEL, 0.8);
  }, wait);
}

/** Steps the ambient tune back while the cue now playing plays, then brings it up again. */
function duckAmbient(): void {
  const am = ambient;
  if (!am) return;
  setLevel(am, AMBIENT_LEVEL * AMBIENT_DUCK, 0.15);
  restoreWhenQuiet(am);
}

// Leaving the app: the music fades out at once and doesn't come back by itself.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      stopMusic(100);
      stopAmbient(100);
    }
  });
}

// ------------------------------------------------------------------ the instruments

/**
 * Schedules a whole score on `ctx` into `out`, starting at `t0` (seconds on the context's clock). Works on an
 * OfflineAudioContext too (the music check renders every cue to measure it).
 */
export function renderScore(ctx: BaseAudioContext, out: AudioNode, score: Score, t0: number, sources: AudioScheduledSourceNode[] = []): void {
  const spb = beatSec(score);
  if (score.level && score.level !== 1) {
    const trim = ctx.createGain();
    trim.gain.value = score.level;
    trim.connect(out);
    out = trim;
  }
  for (const part of score.parts) {
    for (const n of part.notes) {
      const at = t0 + n.b * spb;
      const dur = Math.max(0.03, n.len * spb);
      play(ctx, out, part.inst, n, at, dur, sources);
    }
  }
}

function play(ctx: BaseAudioContext, out: AudioNode, inst: Instrument, n: Note, at: number, dur: number, src: AudioScheduledSourceNode[]): void {
  const v = n.v;
  switch (inst) {
    case 'bass':
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: 'triangle',
          dur: Math.min(dur, 0.9),
          gain: 0.32 * v,
          attack: 0.008,
          cutoff: 900,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: hz(p) / 2,
          type: 'sine',
          dur: Math.min(dur, 0.9),
          gain: 0.18 * v,
          attack: 0.01,
          decay: true,
        });
        // D45 PR D: a phone's speaker plays almost nothing under 300 Hz, where a bass note's body is. Its upper
        // harmonics (a soft saw, up to ~900 Hz) are what carry the bass line there.
        voice(ctx, out, src, at, {
          f: hz(p) * 2,
          type: 'sawtooth',
          dur: Math.min(dur, 0.5),
          gain: 0.06 * v,
          attack: 0.006,
          cutoff: 950,
          cutoffTo: 520,
          decay: true,
        });
      }
      break;
    case 'tuba':
      // Oom-pah: round and a little buzzy, short.
      for (const p of n.p) {
        const f = hz(p);
        voice(ctx, out, src, at, { f, type: 'sawtooth', dur: Math.min(dur, 0.55), gain: 0.13 * v, attack: 0.02, cutoff: f * 3, cutoffTo: f * 5, release: 0.07 });
        voice(ctx, out, src, at, { f: f * 2, type: 'triangle', dur: Math.min(dur, 0.45), gain: 0.07 * v, attack: 0.02, release: 0.06 });
      }
      break;
    case 'accordion':
      // Two reeds a few cents apart, squeezed in and out.
      for (const p of n.p) {
        const f = hz(p);
        const g = (0.05 * v) / Math.sqrt(n.p.length);
        for (const [k, gg] of [
          [1, 1],
          [1.006, 0.8],
          [2.003, 0.35],
        ])
          voice(ctx, out, src, at, { f: f * k, type: 'square', dur, gain: g * gg, attack: 0.03, cutoff: f * 5, release: 0.07 });
      }
      break;
    case 'kalimba':
      // A thumb piano: a soft tine with a quick bright knock.
      for (const p of n.p) {
        const f = hz(p);
        voice(ctx, out, src, at, { f, type: 'triangle', dur: Math.min(dur + 0.25, 0.9), gain: 0.17 * v, attack: 0.002, decay: true });
        voice(ctx, out, src, at, { f: f * 5.4, type: 'sine', dur: 0.04, gain: 0.05 * v, attack: 0.001, decay: true });
        voice(ctx, out, src, at, { f: f * 2, type: 'sine', dur: 0.25, gain: 0.035 * v, attack: 0.002, decay: true });
      }
      break;
    case 'glock':
      // A glockenspiel: glassy, an octave of shine over a toy-box tune.
      for (const p of n.p) {
        const f = hz(p);
        voice(ctx, out, src, at, { f, type: 'sine', dur: Math.min(dur + 0.4, 1.4), gain: 0.11 * v, attack: 0.002, decay: true });
        voice(ctx, out, src, at, { f: f * 2.76, type: 'sine', dur: 0.3, gain: 0.04 * v, attack: 0.001, decay: true });
        voice(ctx, out, src, at, { f: f * 5.4, type: 'sine', dur: 0.12, gain: 0.02 * v, attack: 0.001, decay: true });
      }
      break;
    case 'pluck':
      n.p.forEach((p, i) =>
        voice(ctx, out, src, at + i * 0.012, {
          f: hz(p),
          type: 'sawtooth',
          dur: Math.min(dur, 0.6),
          gain: (0.07 * v) / Math.sqrt(n.p.length),
          attack: 0.004,
          cutoff: hz(p) * 4,
          cutoffTo: hz(p) * 1.3,
          decay: true,
        }),
      );
      break;
    case 'marimba':
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: 'sine',
          dur: Math.min(dur + 0.15, 0.7),
          gain: 0.2 * v,
          attack: 0.003,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: hz(p) * 4,
          type: 'sine',
          dur: 0.06,
          gain: 0.035 * v,
          attack: 0.002,
          decay: true,
        });
      }
      break;
    case 'bell':
      for (const p of n.p) {
        const f = hz(p);
        voice(ctx, out, src, at, {
          f,
          type: 'sine',
          dur: dur + 0.3,
          gain: 0.12 * v,
          attack: 0.01,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: f * 2.01,
          type: 'sine',
          dur: (dur + 0.3) * 0.6,
          gain: 0.035 * v,
          attack: 0.01,
          decay: true,
        });
      }
      break;
    case 'brass':
      for (const p of n.p) {
        const f = hz(p);
        const g = (0.075 * v) / Math.sqrt(n.p.length);
        voice(ctx, out, src, at, {
          f,
          type: 'sawtooth',
          dur,
          gain: g,
          attack: 0.035,
          cutoff: f * 2.2,
          cutoffTo: f * 4,
          release: 0.12,
          vibrato: 0.004,
        });
        voice(ctx, out, src, at, {
          f: f * 1.004,
          type: 'sawtooth',
          dur,
          gain: g * 0.6,
          attack: 0.04,
          cutoff: f * 2,
          release: 0.12,
        });
      }
      break;
    case 'whistle':
      for (const p of n.p)
        voice(ctx, out, src, at, {
          f: hz(p),
          type: 'sine',
          dur,
          gain: 0.09 * v,
          attack: 0.05,
          release: 0.1,
          vibrato: 0.006,
        });
      break;
    case 'pad':
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: 'triangle',
          dur,
          gain: (0.06 * v) / Math.sqrt(n.p.length),
          attack: Math.min(0.25, dur / 3),
          release: 0.35,
          cutoff: hz(p) * 2.5,
        });
      }
      break;
    case 'swoop': {
      const from = hz(n.p[0] ?? 72);
      const to = hz(n.to ?? (n.p[0] ?? 72) + 7);
      voice(ctx, out, src, at, {
        f: from,
        fTo: to,
        type: 'sine',
        dur,
        gain: 0.14 * v,
        attack: 0.01,
        release: 0.08,
      });
      voice(ctx, out, src, at, {
        f: from * 2,
        fTo: to * 2,
        type: 'triangle',
        dur,
        gain: 0.03 * v,
        attack: 0.01,
        release: 0.08,
      });
      break;
    }
    case 'clap':
      for (let i = 0; i < 3; i++)
        noise(ctx, out, src, at + i * 0.011, {
          dur: i < 2 ? 0.02 : 0.13,
          gain: 0.26 * v,
          band: 1300,
          q: 0.9,
        });
      break;
    case 'stomp':
      voice(ctx, out, src, at, {
        f: 120,
        fTo: 44,
        type: 'sine',
        dur: 0.2,
        gain: 0.55 * v,
        attack: 0.002,
        decay: true,
      });
      noise(ctx, out, src, at, {
        dur: 0.03,
        gain: 0.08 * v,
        band: 400,
        q: 0.7,
      });
      // D45 PR D: the thump a phone can play (the 44 Hz body is for headphones): a knock around 300 Hz.
      voice(ctx, out, src, at, { f: 330, fTo: 190, type: 'triangle', dur: 0.09, gain: 0.2 * v, attack: 0.002, decay: true });
      noise(ctx, out, src, at, { dur: 0.045, gain: 0.1 * v, band: 900, q: 0.8 });
      break;
    case 'shaker':
      noise(ctx, out, src, at, { dur: 0.05, gain: 0.08 * v, high: 6000 });
      break;
    case 'block':
      voice(ctx, out, src, at, {
        f: 1150,
        fTo: 920,
        type: 'sine',
        dur: 0.05,
        gain: 0.16 * v,
        attack: 0.001,
        decay: true,
      });
      voice(ctx, out, src, at, {
        f: 2600,
        type: 'triangle',
        dur: 0.02,
        gain: 0.04 * v,
        attack: 0.001,
        decay: true,
      });
      break;
    case 'cymbal':
      noise(ctx, out, src, at, {
        dur: Math.max(0.6, dur),
        gain: 0.06 * v,
        high: 7500,
        decay: true,
      });
      break;
  }
}

interface VoiceOpts {
  f: number;
  fTo?: number;
  type: OscillatorType;
  dur: number;
  gain: number;
  attack: number;
  /** Falls away from the start (plucked, struck) rather than holding and releasing. */
  decay?: boolean;
  release?: number;
  cutoff?: number;
  cutoffTo?: number;
  /** Vibrato depth as a share of the pitch. */
  vibrato?: number;
}

function voice(ctx: BaseAudioContext, out: AudioNode, src: AudioScheduledSourceNode[], at: number, o: VoiceOpts): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f, at);
  if (o.fTo) osc.frequency.exponentialRampToValueAtTime(o.fTo, at + o.dur);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(Math.min(16000, o.cutoff), at);
    if (o.cutoffTo) lp.frequency.exponentialRampToValueAtTime(Math.min(16000, o.cutoffTo), at + Math.min(o.dur, 0.25));
    osc.connect(lp);
    node = lp;
  }
  if (o.vibrato) {
    const lfo = ctx.createOscillator();
    const depth = ctx.createGain();
    lfo.frequency.value = 5.5;
    depth.gain.value = o.f * o.vibrato;
    lfo.connect(depth).connect(osc.frequency);
    lfo.start(at + 0.12);
    lfo.stop(at + o.dur + 0.2);
    src.push(lfo);
  }
  const g = Math.max(0.0002, o.gain);
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(g, at + o.attack);
  const end = at + o.dur;
  if (o.decay) {
    env.gain.exponentialRampToValueAtTime(0.0001, end);
  } else {
    const rel = o.release ?? 0.08;
    env.gain.setValueAtTime(g, Math.max(at + o.attack, end - rel));
    env.gain.exponentialRampToValueAtTime(0.0001, end + rel);
  }
  node.connect(env).connect(out);
  osc.start(at);
  osc.stop(end + (o.release ?? 0.08) + 0.05);
  src.push(osc);
}

function noiseBuffer(ctx: BaseAudioContext): AudioBuffer {
  let b = noiseFor.get(ctx);
  if (!b) {
    b = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.5), ctx.sampleRate);
    const d = b.getChannelData(0);
    // A fixed seed: every cue sounds the same each time (and in tests).
    let x = 0x2f6b1;
    for (let i = 0; i < d.length; i++) {
      x = (x * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (x / 0x3fffffff - 1) * 0.9;
    }
    noiseFor.set(ctx, b);
  }
  return b;
}

function noise(
  ctx: BaseAudioContext,
  out: AudioNode,
  src: AudioScheduledSourceNode[],
  at: number,
  o: {
    dur: number;
    gain: number;
    band?: number;
    q?: number;
    high?: number;
    decay?: boolean;
  },
): void {
  const s = ctx.createBufferSource();
  s.buffer = noiseBuffer(ctx);
  const f = ctx.createBiquadFilter();
  if (o.band) {
    f.type = 'bandpass';
    f.frequency.value = o.band;
    f.Q.value = o.q ?? 1;
  } else {
    f.type = 'highpass';
    f.frequency.value = o.high ?? 5000;
  }
  const env = ctx.createGain();
  env.gain.setValueAtTime(0.0001, at);
  env.gain.exponentialRampToValueAtTime(Math.max(0.0002, o.gain), at + 0.002);
  env.gain.exponentialRampToValueAtTime(0.0001, at + o.dur);
  s.connect(f).connect(env).connect(out);
  s.start(at);
  s.stop(at + o.dur + 0.05);
  src.push(s);
}
