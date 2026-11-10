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

import { audioContext } from "./audio";
import {
  beatSec,
  cueMs,
  hz,
  scoreFor,
  type CueId,
  type Instrument,
  type Note,
  type Score,
} from "../audio/scores";

/** The music channel's level: under the sound effects, so a tap or a pop always reads through. */
export const MUSIC_GAIN = 0.34;

let enabled = false;
let bus: GainNode | null = null;
let current: Playback | null = null;
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
  if (!on) stopMusic(120);
}

export function musicEnabled(): boolean {
  return enabled;
}

function musicBus(a: AudioContext): GainNode {
  if (!bus || bus.context !== a) {
    bus = a.createGain();
    bus.gain.value = MUSIC_GAIN;
    bus.connect(a.destination);
  }
  return bus;
}

/** Stops whatever is playing, with a short fade. */
export function stopMusic(fadeMs = 150): void {
  current?.stop(fadeMs);
  current = null;
}

/** The cue playing now, if any. */
export function nowPlaying(): Playback | null {
  return current && !current.stopped ? current : null;
}

const perfNow = () =>
  typeof performance !== "undefined" ? performance.now() : Date.now();

/**
 * Plays a cue and returns its clock. With music off (or no audio), the clock runs silently, so a dance that follows it
 * keeps the same timing. Unknown cues return null.
 */
export function playCue(
  id: CueId,
  opts: { silent?: boolean } = {},
): Playback | null {
  const score = scoreFor(id);
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
      if (out && a) {
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
      }
      finish();
    },
  };
  // The cue's beats, plus the last notes' ring.
  endTimer = setTimeout(
    () => {
      if (current === pb) current = null;
      finish();
      if (out) setTimeout(() => out?.disconnect(), 1200);
    },
    durationMs + lead * 1000,
  );
  current = pb;
  return pb;
}

/** Replaces a cue's synthesized score with a recorded track (an audio file at the score's tempo). */
export async function useRecordedTrack(
  id: CueId,
  url: string,
): Promise<boolean> {
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

// Leaving the app: the music fades out at once and doesn't come back by itself.
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopMusic(100);
  });
}

// ------------------------------------------------------------------ the instruments

/**
 * Schedules a whole score on `ctx` into `out`, starting at `t0` (seconds on the context's clock). Works on an
 * OfflineAudioContext too (the music check renders every cue to measure it).
 */
export function renderScore(
  ctx: BaseAudioContext,
  out: AudioNode,
  score: Score,
  t0: number,
  sources: AudioScheduledSourceNode[] = [],
): void {
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

function play(
  ctx: BaseAudioContext,
  out: AudioNode,
  inst: Instrument,
  n: Note,
  at: number,
  dur: number,
  src: AudioScheduledSourceNode[],
): void {
  const v = n.v;
  switch (inst) {
    case "bass":
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: "triangle",
          dur: Math.min(dur, 0.9),
          gain: 0.32 * v,
          attack: 0.008,
          cutoff: 900,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: hz(p) / 2,
          type: "sine",
          dur: Math.min(dur, 0.9),
          gain: 0.18 * v,
          attack: 0.01,
          decay: true,
        });
      }
      break;
    case "pluck":
      n.p.forEach((p, i) =>
        voice(ctx, out, src, at + i * 0.012, {
          f: hz(p),
          type: "sawtooth",
          dur: Math.min(dur, 0.6),
          gain: (0.07 * v) / Math.sqrt(n.p.length),
          attack: 0.004,
          cutoff: hz(p) * 4,
          cutoffTo: hz(p) * 1.3,
          decay: true,
        }),
      );
      break;
    case "marimba":
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: "sine",
          dur: Math.min(dur + 0.15, 0.7),
          gain: 0.2 * v,
          attack: 0.003,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: hz(p) * 4,
          type: "sine",
          dur: 0.06,
          gain: 0.035 * v,
          attack: 0.002,
          decay: true,
        });
      }
      break;
    case "bell":
      for (const p of n.p) {
        const f = hz(p);
        voice(ctx, out, src, at, {
          f,
          type: "sine",
          dur: dur + 0.3,
          gain: 0.12 * v,
          attack: 0.01,
          decay: true,
        });
        voice(ctx, out, src, at, {
          f: f * 2.01,
          type: "sine",
          dur: (dur + 0.3) * 0.6,
          gain: 0.035 * v,
          attack: 0.01,
          decay: true,
        });
      }
      break;
    case "brass":
      for (const p of n.p) {
        const f = hz(p);
        const g = (0.075 * v) / Math.sqrt(n.p.length);
        voice(ctx, out, src, at, {
          f,
          type: "sawtooth",
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
          type: "sawtooth",
          dur,
          gain: g * 0.6,
          attack: 0.04,
          cutoff: f * 2,
          release: 0.12,
        });
      }
      break;
    case "whistle":
      for (const p of n.p)
        voice(ctx, out, src, at, {
          f: hz(p),
          type: "sine",
          dur,
          gain: 0.09 * v,
          attack: 0.05,
          release: 0.1,
          vibrato: 0.006,
        });
      break;
    case "pad":
      for (const p of n.p) {
        voice(ctx, out, src, at, {
          f: hz(p),
          type: "triangle",
          dur,
          gain: (0.06 * v) / Math.sqrt(n.p.length),
          attack: Math.min(0.25, dur / 3),
          release: 0.35,
          cutoff: hz(p) * 2.5,
        });
      }
      break;
    case "swoop": {
      const from = hz(n.p[0] ?? 72);
      const to = hz(n.to ?? (n.p[0] ?? 72) + 7);
      voice(ctx, out, src, at, {
        f: from,
        fTo: to,
        type: "sine",
        dur,
        gain: 0.14 * v,
        attack: 0.01,
        release: 0.08,
      });
      voice(ctx, out, src, at, {
        f: from * 2,
        fTo: to * 2,
        type: "triangle",
        dur,
        gain: 0.03 * v,
        attack: 0.01,
        release: 0.08,
      });
      break;
    }
    case "clap":
      for (let i = 0; i < 3; i++)
        noise(ctx, out, src, at + i * 0.011, {
          dur: i < 2 ? 0.02 : 0.13,
          gain: 0.26 * v,
          band: 1300,
          q: 0.9,
        });
      break;
    case "stomp":
      voice(ctx, out, src, at, {
        f: 120,
        fTo: 44,
        type: "sine",
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
      break;
    case "shaker":
      noise(ctx, out, src, at, { dur: 0.05, gain: 0.08 * v, high: 6000 });
      break;
    case "block":
      voice(ctx, out, src, at, {
        f: 1150,
        fTo: 920,
        type: "sine",
        dur: 0.05,
        gain: 0.16 * v,
        attack: 0.001,
        decay: true,
      });
      voice(ctx, out, src, at, {
        f: 2600,
        type: "triangle",
        dur: 0.02,
        gain: 0.04 * v,
        attack: 0.001,
        decay: true,
      });
      break;
    case "cymbal":
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

function voice(
  ctx: BaseAudioContext,
  out: AudioNode,
  src: AudioScheduledSourceNode[],
  at: number,
  o: VoiceOpts,
): void {
  const osc = ctx.createOscillator();
  const env = ctx.createGain();
  osc.type = o.type;
  osc.frequency.setValueAtTime(o.f, at);
  if (o.fTo) osc.frequency.exponentialRampToValueAtTime(o.fTo, at + o.dur);
  let node: AudioNode = osc;
  if (o.cutoff) {
    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(16000, o.cutoff), at);
    if (o.cutoffTo)
      lp.frequency.exponentialRampToValueAtTime(
        Math.min(16000, o.cutoffTo),
        at + Math.min(o.dur, 0.25),
      );
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
    f.type = "bandpass";
    f.frequency.value = o.band;
    f.Q.value = o.q ?? 1;
  } else {
    f.type = "highpass";
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
