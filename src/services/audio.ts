/**
 * Sound effects, synthesized with Web Audio so every sound is original and ships with no asset licenses.
 * The context is created on first use after a user gesture (iOS requirement) and every call is guarded.
 *
 * D40: one small sound family, quiet by default (the master level sits well under full scale). Which event plays which
 * sound is decided in `services/feel.ts`; this file only knows how each sound is made.
 *  - tick / untick: marking and clearing a ✕, a soft wooden tick
 *  - pop: an animal placed, a gentle bright pop (a quick upward blip)
 *  - line / lines: a row, column or color finished, a short rising tone (three notes when several finish at once)
 *  - miss: a wrong guess, one muted soft note (never a buzzer)
 *  - solved: the puzzle is done, the game's own little melody (C–E–G, then a ringing high C)
 *  - arrival: a new animal comes home, a warm chime over a soft chord, unlike any other sound in the game
 *  - hello: an animal tapped, a tiny cue in its temperament's rhythm, pitched by its size
 *  - coin / treat / tap: a purchase, a treat eaten, a plain button tick
 */

export type Sfx =
  | "tick"
  | "untick"
  | "pop"
  | "line"
  | "lines"
  | "miss"
  | "solved"
  | "arrival"
  | "hello"
  | "coin"
  | "treat"
  | "tap";

/** How an animal says hello (D40 PR B gives every animal one). */
export type HelloStyle =
  "playful" | "sleepy" | "shy" | "proud" | "energetic" | "gentle";
export type HelloSize = "tiny" | "small" | "medium" | "large" | "huge";
export interface SfxOptions {
  style?: HelloStyle;
  size?: HelloSize;
  /** A close friend's hello ends with one extra, warmer note (D40 PR B). */
  warm?: boolean;
}

/** The master level: restrained, so the game sits quietly under whatever else is playing. */
export const MASTER_GAIN = 0.42;

/** The shortest gap between two of the same sound, so a drag across many tiles never becomes a buzz. */
const MIN_GAP_MS: Partial<Record<Sfx, number>> = {
  tick: 45,
  untick: 45,
  pop: 40,
  hello: 140,
  tap: 40,
};

let enabled = true;
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const lastAt = new Map<Sfx, number>();

/** Sound on or off. Off also silences anything still ringing (a long chime), at once. */
export function setSoundEnabled(on: boolean): void {
  enabled = on;
  if (ctx && master) {
    try {
      master.gain.cancelScheduledValues(ctx.currentTime);
      master.gain.setTargetAtTime(on ? MASTER_GAIN : 0, ctx.currentTime, 0.015);
    } catch {
      /* audio unavailable */
    }
  }
}
export function soundEnabled(): boolean {
  return enabled;
}

/**
 * The game's one audio context, shared by sound effects and music (D44 PR B), created on first use. On iOS 17+ the
 * audio session is "ambient": PawTyk follows the silent switch and mixes with whatever else is playing.
 */
export function audioContext(): AudioContext | null {
  try {
    if (!ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Ctor) return null;
      try {
        const session = (
          navigator as unknown as { audioSession?: { type: string } }
        ).audioSession;
        if (session) session.type = "ambient";
      } catch {
        /* no audio session API */
      }
      ctx = new Ctor();
      master = ctx.createGain();
      master.gain.value = enabled ? MASTER_GAIN : 0;
      master.connect(ctx.destination);
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function audio(): AudioContext | null {
  return enabled ? audioContext() : null;
}

interface Tone {
  freq: number;
  /** Where the pitch glides to by the end (default: a slight droop, like a plucked string). */
  to?: number;
  /** Seconds after `at` the glide reaches `to` (default: the whole note). */
  glide?: number;
  dur: number;
  gain: number;
  type?: OscillatorType;
  attack?: number;
  /** Lowpass cutoff as a multiple of the pitch (default 3.2: soft, woody). */
  bright?: number;
}

function tone(a: AudioContext, at: number, t: Tone): void {
  const o = a.createOscillator();
  const g = a.createGain();
  const f = a.createBiquadFilter();
  o.type = t.type ?? "triangle";
  o.frequency.setValueAtTime(t.freq, at);
  o.frequency.exponentialRampToValueAtTime(
    t.to ?? t.freq * 0.86,
    at + (t.glide ?? t.dur),
  );
  f.type = "lowpass";
  f.frequency.value = Math.min(16000, t.freq * (t.bright ?? 3.2));
  const atk = t.attack ?? 0.006;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(t.gain, at + atk);
  g.gain.exponentialRampToValueAtTime(0.0001, at + Math.max(atk + 0.01, t.dur));
  o.connect(f).connect(g).connect(master!);
  o.start(at);
  o.stop(at + t.dur + 0.03);
}

/** A soft bell: a sine with two quiet overtones. */
function bell(
  a: AudioContext,
  freq: number,
  at: number,
  dur: number,
  gain: number,
  attack = 0.01,
): void {
  for (const [mult, g] of [
    [1, gain],
    [2.01, gain * 0.26],
    [3.02, gain * 0.08],
  ] as const) {
    const o = a.createOscillator();
    const env = a.createGain();
    o.type = "sine";
    o.frequency.value = freq * mult;
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(g, at + attack);
    env.gain.exponentialRampToValueAtTime(0.0001, at + dur);
    o.connect(env).connect(master!);
    o.start(at);
    o.stop(at + dur + 0.05);
  }
}

/** A soft held chord under the arrival chime: slow in, slow out. */
function pad(
  a: AudioContext,
  freqs: number[],
  at: number,
  dur: number,
  gain: number,
): void {
  for (const fr of freqs)
    tone(a, at, {
      freq: fr,
      to: fr,
      dur,
      gain,
      type: "sine",
      attack: 0.14,
      bright: 2,
    });
}

/** Hello pitches: little animals squeak a little higher, big ones speak lower. */
export const HELLO_PITCH: Record<HelloSize, number> = {
  tiny: 1046,
  small: 880,
  medium: 698,
  large: 587,
  huge: 466,
};

/** The note pattern of each hello: [semitones above the base, start (s), length (s), level]. */
export const HELLO_NOTES: Record<
  HelloStyle,
  Array<[number, number, number, number]>
> = {
  // Two quick rising chirps: "oh, hi!"
  playful: [
    [0, 0, 0.07, 0.13],
    [5, 0.08, 0.1, 0.13],
  ],
  // One slow, soft, drooping note: a drowsy "mm".
  sleepy: [[0, 0, 0.32, 0.08]],
  // A pause (it looks away first), then one small, high note.
  shy: [[7, 0.16, 0.08, 0.07]],
  // Two steady notes a fourth apart, the second held: confident.
  proud: [
    [0, 0, 0.09, 0.12],
    [5, 0.11, 0.2, 0.12],
  ],
  // Three bouncing notes, fast.
  energetic: [
    [0, 0, 0.05, 0.12],
    [4, 0.06, 0.05, 0.12],
    [7, 0.12, 0.08, 0.12],
  ],
  // One warm, rounded note.
  gentle: [[0, 0, 0.2, 0.1]],
};

const semis = (base: number, n: number) => base * 2 ** (n / 12);

export function sfx(kind: Sfx, o: SfxOptions = {}): void {
  const now =
    typeof performance !== "undefined" ? performance.now() : Date.now();
  const gap = MIN_GAP_MS[kind];
  if (gap && now - (lastAt.get(kind) ?? -Infinity) < gap) return;
  const a = audio();
  if (!a || !master) return;
  lastAt.set(kind, now);
  try {
    const t = a.currentTime + 0.005;
    switch (kind) {
      case "tick":
      case "tap":
        tone(a, t, { freq: 1320, to: 1080, dur: 0.035, gain: 0.06 });
        break;
      case "untick":
        tone(a, t, { freq: 1080, to: 900, dur: 0.03, gain: 0.045 });
        break;
      case "pop":
        tone(a, t, {
          freq: 540,
          to: 900,
          glide: 0.035,
          dur: 0.1,
          gain: 0.2,
          type: "sine",
          bright: 4,
        });
        tone(a, t + 0.012, { freq: 1350, dur: 0.05, gain: 0.04, type: "sine" });
        break;
      case "line":
        bell(a, 784, t, 0.32, 0.1);
        bell(a, 1047, t + 0.07, 0.38, 0.085);
        break;
      case "lines":
        bell(a, 784, t, 0.3, 0.1);
        bell(a, 1047, t + 0.07, 0.32, 0.09);
        bell(a, 1319, t + 0.14, 0.42, 0.08);
        break;
      case "miss":
        tone(a, t, {
          freq: 247,
          to: 220,
          dur: 0.18,
          gain: 0.11,
          type: "sine",
          bright: 2.4,
          attack: 0.012,
        });
        break;
      case "solved":
        bell(a, 523, t, 0.45, 0.12);
        bell(a, 659, t + 0.1, 0.45, 0.115);
        bell(a, 784, t + 0.2, 0.5, 0.11);
        bell(a, 1047, t + 0.34, 0.95, 0.12);
        bell(a, 1319, t + 0.34, 0.8, 0.04);
        tone(a, t + 0.34, {
          freq: 262,
          to: 262,
          dur: 0.6,
          gain: 0.07,
          type: "sine",
          bright: 2,
        });
        break;
      case "arrival":
        pad(a, [349, 440, 523], t, 1.5, 0.04);
        bell(a, 1047, t + 0.06, 0.7, 0.085, 0.02);
        bell(a, 880, t + 0.24, 0.7, 0.08, 0.02);
        bell(a, 1397, t + 0.42, 0.9, 0.075, 0.02);
        bell(a, 1760, t + 0.62, 1.1, 0.05, 0.02);
        break;
      case "hello": {
        const base = HELLO_PITCH[o.size ?? "medium"];
        const style = o.style ?? "gentle";
        for (const [n, at, len, g] of HELLO_NOTES[style]) {
          const f = semis(base, n);
          if (style === "sleepy")
            tone(a, t + at, {
              freq: f,
              to: f * 0.84,
              dur: len,
              gain: g,
              type: "sine",
              attack: 0.04,
              bright: 2.2,
            });
          else if (style === "gentle") bell(a, f, t + at, len + 0.1, g, 0.015);
          else
            tone(a, t + at, {
              freq: f,
              to: f * 1.04,
              dur: len,
              gain: g,
              type: "triangle",
              bright: 3.6,
            });
        }
        if (o.warm) {
          const last = HELLO_NOTES[style].reduce(
            (m, x) => Math.max(m, x[1] + x[2]),
            0,
          );
          bell(a, semis(base, 12), t + last + 0.05, 0.3, 0.05);
        }
        break;
      }
      case "coin":
        bell(a, 1318, t, 0.25, 0.07);
        bell(a, 1568, t + 0.06, 0.3, 0.06);
        break;
      case "treat":
        tone(a, t, { freq: 392, to: 340, dur: 0.06, gain: 0.1 });
        tone(a, t + 0.09, { freq: 440, to: 380, dur: 0.06, gain: 0.09 });
        bell(a, 988, t + 0.18, 0.28, 0.05);
        break;
    }
  } catch {
    /* audio unavailable */
  }
}
