/**
 * Everything a 3D toy can act out (D34): small everyday moves (a look round, a yawn, a stroll), the tricks and the
 * emotes. A clip is a pure function of normalized time t (0–1) returning pose offsets and, optionally, a face. Every
 * clip starts and ends at rest (offsets 0), so clips can follow one another without a jump. Props (stars, a bubble, a
 * rainbow) are drawn by the stage on the same clock; see `effects.ts`.
 *
 * Good toy motion: anticipation before a jump, squash on landing, overshoot when something pops, and turns that show
 * the animal's side and back.
 */

import type { BodyKind } from './species';
import type { Expr } from './face';
import { arc, bump, easeInOut, easeOut, easeOutBack, hold, seg, wiggle, type PoseDelta } from './pose';
import { danceClip } from './dance';
import { DECOR_MOTIONS, type Motion } from './motions';

export interface ClipCtx {
  body: BodyKind;
  /** Which way a travelling clip goes (+1 = to the viewer's right): toward the middle of the scene. */
  dir: 1 | -1;
  /** Varies small things (which way to look) from one play to the next. */
  seed: number;
}

export interface Frame {
  pose: PoseDelta;
  face?: Expr;
}

export interface Clip {
  ms: number;
  frame(t: number, c: ClipCtx): Frame;
}

const TAU = Math.PI * 2;

/** A squash–stretch jump: crouch over [a, a+0.1], fly until b, land and settle. */
function jump(t: number, a: number, b: number, h: number): PoseDelta {
  const crouch = bump(t, Math.max(0, a - 0.08), a, a + 0.04) * 0.16;
  const fly = arc(t, a, b, h);
  const stretch = bump(t, a, a + (b - a) * 0.3, b - (b - a) * 0.2) * -0.1;
  const land = bump(t, b - 0.02, b + 0.05, b + 0.16) * 0.14;
  return { py: fly, squash: crouch + stretch + land };
}

function sum(...ds: PoseDelta[]): PoseDelta {
  const out: PoseDelta = {};
  for (const d of ds) for (const k in d) (out as Record<string, number>)[k] = ((out as Record<string, number>)[k] ?? 0) + (d as Record<string, number>)[k];
  return out;
}

/** Little hops along the way while walking (a toy's walk), with the legs paddling. */
function steps(t: number, a: number, b: number, n: number): PoseDelta {
  if (t <= a || t >= b) return {};
  const x = (t - a) / (b - a);
  const s = Math.abs(Math.sin(x * n * Math.PI));
  const p = Math.sin(x * n * Math.PI);
  return { py: s * 0.05, squash: (1 - s) * 0.03, armL: p * 0.5, armR: -p * 0.5, legL: -p * 0.4, legR: p * 0.4, tilt: p * 0.06, tail: p * 0.3 };
}

// ------------------------------------------------------------------ everyday moves (driven by the ambient director)

export const AMBIENT: Record<string, Clip> = {
  blink: { ms: 180, frame: () => ({ pose: {}, face: 'blink' }) },
  look: {
    ms: 1400,
    frame: (t, c) => {
      const s = c.seed % 2 ? 1 : -1;
      const w = hold(t, 0, 1, 0.25);
      return { pose: { headYaw: 0.55 * s * w, headTilt: 0.08 * s * w, ears: 0.15 * w }, face: w > 0.3 ? (s > 0 ? 'lookR' : 'lookL') : undefined };
    },
  },
  yawn: {
    ms: 1600,
    frame: (t) => {
      const w = hold(t, 0.05, 0.85, 0.25);
      return {
        pose: { headPitch: -0.28 * w, squash: -0.05 * w, armL: 0.25 * w, armR: 0.25 * w, mouth: w, ears: -0.2 * w },
        face: w > 0.2 ? 'yawn' : undefined,
      };
    },
  },
  wag: {
    ms: 1100,
    frame: (t) => ({ pose: { tail: wiggle(t, 0, 1, 4, 0.7), tailUp: 0.3 * hold(t, 0, 1), tilt: wiggle(t, 0, 1, 4, -0.03) }, face: 'happy' }),
  },
  stretch: {
    ms: 1400,
    frame: (t, c) => {
      const w = hold(t, 0.05, 0.9, 0.3);
      if (c.body === 'bird')
        return { pose: { armL: 1.4 * w, armR: 1.4 * w, armLOut: 0.4 * w, armROut: 0.4 * w, squash: -0.06 * w }, face: w > 0.4 ? 'happy' : undefined };
      return {
        pose: { lean: 0.38 * w, armL: 1.0 * w, armR: 1.0 * w, py: -0.02 * w, tailUp: 0.5 * w, headPitch: -0.3 * w },
        face: w > 0.4 ? 'sleepy' : undefined,
      };
    },
  },
  hop: { ms: 700, frame: (t) => ({ pose: { ...jump(t, 0.15, 0.62, 0.2), ears: bump(t, 0.2, 0.45, 0.8) * 0.3 }, face: 'happy' }) },
  love: {
    ms: 1300,
    frame: (t) => {
      const w = hold(t, 0, 1, 0.2);
      return { pose: { headTilt: 0.22 * w, squash: bump(t, 0.05, 0.2, 0.4) * 0.06, tail: wiggle(t, 0, 1, 3, 0.4) }, face: 'love' };
    },
  },
  greet: {
    ms: 1500,
    frame: (t) => ({
      pose: sum(jump(t, 0.1, 0.38, 0.16), {
        armR: 0.45 * hold(t, 0.3, 0.95, 0.15),
        armROut: 2.3 * hold(t, 0.3, 0.95, 0.15) + wiggle(t, 0.4, 0.92, 3, 0.4),
        headTilt: -0.15 * hold(t, 0.3, 0.95),
        tail: wiggle(t, 0, 1, 4, 0.5),
      }),
      face: 'happy',
    }),
  },
  stroll: {
    // A wander: turn to one side (showing its profile), walk a few hops, turn round through its back, walk home, face you.
    ms: 3400,
    frame: (t, c) => {
      const s = c.seed % 2 ? 1 : -1;
      const away = easeInOut(seg(t, 0.12, 0.44)) - easeInOut(seg(t, 0.58, 0.9));
      let yaw = 0;
      if (t < 0.12) yaw = ((s * Math.PI) / 2) * easeInOut(t / 0.12);
      else if (t < 0.44) yaw = (s * Math.PI) / 2;
      else if (t < 0.58) yaw = (s * Math.PI) / 2 + s * Math.PI * easeInOut((t - 0.44) / 0.14);
      else if (t < 0.9) yaw = (s * 3 * Math.PI) / 2;
      else yaw = (s * 3 * Math.PI) / 2 + ((s * Math.PI) / 2) * easeInOut((t - 0.9) / 0.1);
      return { pose: sum({ px: away * 0.75 * s, yaw }, steps(t, 0.12, 0.44, 4), steps(t, 0.58, 0.9, 4)), face: t > 0.4 && t < 0.62 ? 'lookR' : undefined };
    },
  },
  flutter: {
    ms: 1500,
    frame: (t) => ({ pose: { armL: 0.6 + wiggle(t, 0, 1, 5, 0.6), armR: 0.6 + wiggle(t, 0, 1, 5, 0.6), py: bump(t, 0.1, 0.5, 0.9) * 0.08 }, face: 'happy' }),
  },
};
// `flutter` starts and ends with wings partly open: fade it.
const flutterBase = AMBIENT.flutter.frame;
AMBIENT.flutter = { ms: 1500, frame: (t, c) => scaleFrame(flutterBase(t, c), hold(t, 0, 1, 0.2)) };

function scaleFrame(f: Frame, w: number): Frame {
  const pose: PoseDelta = {};
  for (const k in f.pose) (pose as Record<string, number>)[k] = (f.pose as Record<string, number>)[k] * w;
  return { pose, face: w > 0.3 ? f.face : undefined };
}

// ------------------------------------------------------------------ tricks (D33, now in 3D)

export const TRICK_CLIPS: Record<string, Clip> = {
  wave: {
    ms: 1600,
    frame: (t) => {
      const up = hold(t, 0.05, 0.95, 0.18);
      return {
        pose: { armR: 0.45 * up, armROut: 2.45 * up + wiggle(t, 0.2, 0.85, 3, 0.45), headTilt: -0.16 * up, tilt: -0.06 * up, tail: wiggle(t, 0, 1, 3, 0.4) },
        face: 'happy',
      };
    },
  },
  hop: {
    ms: 1300,
    frame: (t) => ({
      pose: sum(jump(t, 0.1, 0.4, 0.22), jump(t, 0.52, 0.86, 0.32), {
        yaw: wiggle(t, 0.5, 0.9, 1, 0.35),
        ears: bump(t, 0.1, 0.3, 0.9) * 0.3,
        armLOut: arc(t, 0.52, 0.86, 1.6),
        armROut: arc(t, 0.52, 0.86, 1.6),
        armL: arc(t, 0.52, 0.86, 0.3),
        armR: arc(t, 0.52, 0.86, 0.3),
      }),
      face: 'happy',
    }),
  },
  spin: {
    ms: 1700,
    frame: (t) => {
      const turn = easeInOut(seg(t, 0.1, 0.5)) + easeInOut(seg(t, 0.5, 0.92));
      const out = hold(t, 0.08, 0.95, 0.12);
      return {
        pose: sum(jump(t, 0.12, 0.44, 0.08), jump(t, 0.52, 0.86, 0.08), {
          yaw: turn * TAU,
          armLOut: 1.35 * out,
          armROut: 1.35 * out,
          armL: 0.2 * out,
          armR: 0.2 * out,
          tailUp: 0.4 * out,
        }),
        face: 'happy',
      };
    },
  },
  bow: {
    ms: 1900,
    frame: (t) => {
      const down = hold(t, 0.08, 0.78, 0.2);
      return {
        pose: {
          lean: 0.55 * down,
          headPitch: 0.45 * down,
          armR: 1.1 * down,
          armROut: -0.3 * down,
          armL: 0.3 * down,
          tailUp: 0.6 * down,
          ears: -0.25 * down,
          squash: bump(t, 0.75, 0.86, 0.98) * -0.05,
        },
        face: t > 0.78 ? 'proud' : down > 0.4 ? 'blink' : undefined,
      };
    },
  },
  rollover: {
    ms: 1900,
    frame: (t, c) => {
      const d = c.dir;
      const roll = easeInOut(seg(t, 0.12, 0.62)) * TAU * d;
      const over = easeInOut(seg(t, 0.12, 0.62)) - easeInOut(seg(t, 0.66, 0.94));
      return {
        pose: sum(
          {
            roll,
            px: over * 0.6 * d,
            py: bump(t, 0.12, 0.37, 0.62) * 0.12,
            armL: 1.2 * hold(t, 0.1, 0.65),
            armR: 1.2 * hold(t, 0.1, 0.65),
            legL: 0.6 * hold(t, 0.1, 0.65),
            legR: 0.6 * hold(t, 0.1, 0.65),
          },
          steps(t, 0.66, 0.94, 3),
          { squash: bump(t, 0.02, 0.1, 0.16) * 0.12 },
        ),
        face: t < 0.62 ? 'laugh' : 'happy',
      };
    },
  },
  dance: {
    ms: 2400,
    frame: (t) => {
      const beat = Math.sin(seg(t, 0.05, 0.95) * 4 * Math.PI);
      const w = hold(t, 0.03, 0.97, 0.1);
      const bounce = Math.abs(Math.sin(seg(t, 0.05, 0.95) * 8 * Math.PI)) * 0.06 * w;
      return {
        pose: {
          px: beat * 0.12 * w,
          py: bounce,
          tilt: beat * 0.16 * w,
          headTilt: -beat * 0.2 * w,
          yaw: beat * 0.35 * w,
          armL: 0.35 * w,
          armR: 0.35 * w,
          armLOut: (1.7 + beat * 0.7) * w,
          armROut: (1.7 - beat * 0.7) * w,
          tail: beat * 0.6 * w,
          squash: -bounce * 0.5,
        },
        face: 'laugh',
      };
    },
  },
  backflip: {
    ms: 2200,
    frame: (t) => {
      const flip = easeInOut(seg(t, 0.26, 0.62));
      return {
        pose: sum(jump(t, 0.22, 0.66, 0.95), {
          pitch: -flip * TAU,
          armL: 0.4 * hold(t, 0.22, 0.64),
          armR: 0.4 * hold(t, 0.22, 0.64),
          armLOut: 2.2 * hold(t, 0.22, 0.64),
          armROut: 2.2 * hold(t, 0.22, 0.64),
          legL: 0.5 * hold(t, 0.26, 0.62),
          legR: 0.5 * hold(t, 0.26, 0.62),
          lean: bump(t, 0.06, 0.18, 0.24) * -0.12,
          tailUp: hold(t, 0.22, 0.7) * 0.7,
        }),
        face: t < 0.2 ? 'focused' : t < 0.66 ? 'surprised' : 'proud',
      };
    },
  },
  bubble: {
    ms: 3400,
    frame: (t) => {
      const up = easeInOut(seg(t, 0.12, 0.42)) * (1 - easeOut(seg(t, 0.86, 0.95)));
      const drift = wiggle(t, 0.3, 0.86, 2, 0.08);
      return {
        pose: sum(
          {
            py: up * 0.75 + bump(t, 0.4, 0.62, 0.86) * 0.08,
            px: drift,
            yaw: easeInOut(seg(t, 0.3, 0.84)) * TAU,
            armL: hold(t, 0.14, 0.88) * 0.5,
            armR: hold(t, 0.14, 0.88) * 0.5,
            armLOut: hold(t, 0.14, 0.88) * 1.1 + wiggle(t, 0.2, 0.84, 6, 0.4),
            armROut: hold(t, 0.14, 0.88) * 1.1 - wiggle(t, 0.2, 0.84, 6, 0.4),
            legL: hold(t, 0.14, 0.88) * 0.4,
            legR: hold(t, 0.14, 0.88) * 0.4,
          },
          { squash: bump(t, 0.93, 0.96, 1) * 0.16 },
        ),
        face: t < 0.84 ? 'happy' : 'surprised',
      };
    },
  },
  juggle: {
    ms: 3200,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.1);
      const p = Math.sin(seg(t, 0.08, 0.92) * 6 * Math.PI);
      return {
        pose: {
          lean: -0.1 * w,
          armL: 0.9 * w,
          armR: 0.9 * w,
          armLOut: (1.2 + p * 0.5) * w,
          armROut: (1.2 - p * 0.5) * w,
          headPitch: -0.32 * w + p * 0.05,
          headYaw: p * 0.12 * w,
          py: Math.abs(p) * 0.02 * w,
          tail: p * 0.4 * w,
        },
        face: t > 0.9 ? 'proud' : 'focused',
      };
    },
  },
  rainbow: {
    ms: 3400,
    frame: (t, c) => {
      const d = c.dir;
      const there = easeInOut(seg(t, 0.2, 0.6));
      const back = easeInOut(seg(t, 0.74, 0.95));
      // Turns toward the leap (three-quarter view), turns round through its back at the far side, faces you at home.
      const a = 0.7;
      let yaw = 0;
      if (t < 0.12) yaw = 0;
      else if (t < 0.2) yaw = a * easeInOut(seg(t, 0.12, 0.2));
      else if (t < 0.62) yaw = a;
      else if (t < 0.74) yaw = a + (TAU - 2 * a) * easeInOut(seg(t, 0.62, 0.74));
      else if (t < 0.95) yaw = TAU - a;
      else yaw = TAU - a + a * easeInOut(seg(t, 0.95, 1));
      return {
        pose: sum(jump(t, 0.2, 0.6, 0.85), steps(t, 0.74, 0.95, 3), {
          px: (there - back) * 0.95 * d,
          yaw: yaw * d,
          armL: hold(t, 0.2, 0.6) * 1.4,
          armR: hold(t, 0.2, 0.6) * 1.4,
          legL: hold(t, 0.2, 0.6) * -0.6,
          legR: hold(t, 0.2, 0.6) * -0.6,
          tailUp: hold(t, 0.2, 0.6) * 0.6,
        }),
        face: t < 0.62 ? 'happy' : t < 0.74 ? 'proud' : 'happy',
      };
    },
  },
};

// ------------------------------------------------------------------ emotes (D34): acted out with the face and the body

export const EMOTE_CLIPS: Record<string, Clip> = {
  love: {
    ms: 1800,
    frame: (t) => {
      const w = hold(t, 0.02, 0.98, 0.15);
      return {
        pose: {
          headTilt: wiggle(t, 0.05, 0.95, 2, 0.22),
          tilt: wiggle(t, 0.05, 0.95, 2, 0.06),
          armL: 0.9 * w,
          armR: 0.9 * w,
          armLOut: -0.35 * w,
          armROut: -0.35 * w,
          py: Math.abs(Math.sin(t * 4 * Math.PI)) * 0.04 * w,
          tail: wiggle(t, 0, 1, 4, 0.5),
        },
        face: 'love',
      };
    },
  },
  laugh: {
    ms: 1800,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.15);
      return {
        pose: {
          headPitch: -0.22 * w,
          tilt: wiggle(t, 0.05, 0.95, 7, 0.07),
          py: Math.abs(Math.sin(t * 7 * Math.PI)) * 0.035 * w,
          armL: 0.7 * w,
          armR: 0.7 * w,
          armLOut: -0.45 * w,
          armROut: -0.45 * w,
          squash: wiggle(t, 0.05, 0.95, 7, 0.03),
          mouth: w,
        },
        face: 'laugh',
      };
    },
  },
  cheer: {
    ms: 2000,
    frame: (t) => {
      const up = hold(t, 0.08, 0.92, 0.12);
      const pump = Math.sin(seg(t, 0.15, 0.85) * 4 * Math.PI) * 0.35 * up;
      return {
        pose: sum(jump(t, 0.18, 0.44, 0.28), jump(t, 0.54, 0.8, 0.28), {
          armL: 0.3 * up,
          armR: 0.3 * up,
          armLOut: (2.55 + pump) * up,
          armROut: (2.55 - pump) * up,
          ears: 0.3 * up,
          tail: wiggle(t, 0, 1, 5, 0.6),
        }),
        face: 'laugh',
      };
    },
  },
  surprised: {
    ms: 1600,
    frame: (t) => {
      const w = hold(t, 0.05, 0.9, 0.08);
      return {
        pose: sum(jump(t, 0.06, 0.32, 0.18), {
          pz: -0.18 * w,
          armL: 0.5 * w,
          armR: 0.5 * w,
          armLOut: 1.6 * w,
          armROut: 1.6 * w,
          ears: 0.45 * w,
          tailUp: 0.8 * w,
          headPitch: -0.12 * w,
        }),
        face: t < 0.9 ? 'surprised' : undefined,
      };
    },
  },
  sleepy: {
    ms: 3000,
    frame: (t) => {
      const yawn = hold(t, 0.02, 0.3, 0.1);
      const doze = hold(t, 0.3, 0.92, 0.12);
      const nod = Math.max(0, Math.sin(seg(t, 0.32, 0.9) * 2 * Math.PI)) * 0.25 * doze;
      return {
        pose: {
          headPitch: -0.28 * yawn + (0.25 + nod) * doze,
          squash: -0.05 * yawn + 0.04 * doze,
          armL: 0.3 * yawn,
          armR: 0.3 * yawn,
          ears: -0.4 * doze,
          lean: 0.06 * doze,
          mouth: yawn,
        },
        face: yawn > 0.3 ? 'yawn' : doze > 0.2 ? 'sleepy' : t > 0.92 ? 'blink' : undefined,
      };
    },
  },
  shy: {
    ms: 2200,
    frame: (t) => {
      const w = hold(t, 0.05, 0.85, 0.15);
      const peek = bump(t, 0.6, 0.72, 0.84);
      return {
        pose: {
          headYaw: (-0.6 + peek * 0.5) * w,
          headPitch: 0.3 * w,
          armR: 1.9 * w,
          armROut: -0.55 * w,
          tilt: wiggle(t, 0.1, 0.85, 2, 0.06),
          ears: -0.3 * w,
          tail: wiggle(t, 0, 1, 3, 0.3),
        },
        face: t > 0.86 ? 'happy' : 'shy',
      };
    },
  },
  starstruck: {
    ms: 3000,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.1);
      return {
        pose: sum(jump(t, 0.25, 0.65, 0.5), {
          yaw: easeInOut(seg(t, 0.27, 0.63)) * TAU,
          armL: 0.3 * w,
          armR: 0.3 * w,
          armLOut: 2.5 * w,
          armROut: 2.5 * w,
          headPitch: -0.2 * w,
          ears: 0.3 * w,
        }),
        face: 'stars',
      };
    },
  },
  party: {
    ms: 3400,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      const beat = Math.sin(seg(t, 0.25, 0.95) * 6 * Math.PI);
      const dancing = hold(t, 0.25, 0.95, 0.06);
      return {
        pose: sum(jump(t, 0.06, 0.24, 0.2), {
          px: beat * 0.1 * dancing,
          tilt: beat * 0.14 * dancing,
          yaw: beat * 0.3 * dancing,
          py: Math.abs(beat) * 0.05 * dancing,
          armL: 0.3 * w,
          armR: 0.3 * w,
          armLOut: (2.2 + beat * 0.5) * w,
          armROut: (2.2 - beat * 0.5) * w,
          headTilt: -beat * 0.2 * dancing,
          tail: beat * 0.6,
        }),
        face: t < 0.24 ? 'surprised' : 'laugh',
      };
    },
  },
};

// ------------------------------------------------------------------ decoration activities (D32), as the rider acts them

/** How the rider acts on each decoration; the path it travels is the decoration's own (the drawn rider's). */
export const ACTIVITY_CLIPS: Record<string, Clip> = {
  tireswing: {
    ms: 5600,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      const swing = Math.sin(seg(t, 0, 1) * 4 * TAU);
      // Holding the rope with both paws, legs out, leaning into each swing.
      return {
        pose: {
          armL: 2.4 * w,
          armR: 2.4 * w,
          armLOut: 0.25 * w,
          armROut: 0.25 * w,
          legL: 0.9 * w,
          legR: 0.9 * w,
          roll: swing * 0.18 * w,
          lean: -swing * 0.12 * w,
          tail: swing * 0.4,
        },
        face: Math.abs(swing) > 0.8 ? 'laugh' : 'happy',
      };
    },
  },
  tractor: {
    ms: 6200,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      // Paws on the wheel, a little bounce over the bumps, a wave halfway round.
      const wave = hold(t, 0.44, 0.56, 0.04);
      return {
        pose: {
          armL: 1.25 * w,
          armR: (1.25 - 1.25 * wave) * w,
          armROut: 2.3 * wave,
          py: wiggle(t, 0, 1, 14, 0.012) * w,
          headYaw: wiggle(t, 0.1, 0.9, 2, 0.25),
          tail: wiggle(t, 0, 1, 6, 0.4),
        },
        face: wave > 0.3 ? 'laugh' : 'happy',
      };
    },
  },
  rescuewagon: {
    ms: 5800,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      // Sitting among the flowers, paws on the side, a wave back at the barn while it rolls.
      const wave = hold(t, 0.5, 0.7, 0.05);
      return {
        pose: {
          armL: 0.9 * w,
          armR: (0.9 - 0.9 * wave) * w,
          armROut: 2.2 * wave + wiggle(t, 0.52, 0.68, 3, 0.35),
          legL: 0.8 * w,
          legR: 0.8 * w,
          py: wiggle(t, 0.1, 0.9, 10, 0.01) * w,
          headYaw: wiggle(t, 0.1, 0.9, 2, 0.3),
          tail: wiggle(t, 0, 1, 6, 0.4),
        },
        face: wave > 0.3 ? 'laugh' : 'happy',
      };
    },
  },
  balloon: {
    ms: 6200,
    frame: (t) => {
      const wave = hold(t, 0.22, 0.5, 0.06);
      const look = hold(t, 0.55, 0.88, 0.08);
      return {
        pose: {
          py: wiggle(t, 0, 1, 5, 0.02),
          armR: 0.4 * wave,
          armROut: 2.3 * wave + wiggle(t, 0.26, 0.46, 3, 0.4),
          armLOut: 0.4 * hold(t, 0.05, 0.95),
          headYaw: Math.sin(seg(t, 0.55, 0.88) * TAU) * 0.6 * look,
          headPitch: -0.15 * look,
          tail: wiggle(t, 0, 1, 6, 0.4),
        },
        face: look > 0.3 ? 'surprised' : 'happy',
      };
    },
  },
  kite: {
    ms: 5600,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      return {
        pose: sum(steps(t, 0.1, 0.9, 10), { armL: 0.6 * w, armLOut: 2.1 * w, armROut: 0.6 * w, headPitch: -0.38 * w, headYaw: -0.3 * w, tailUp: 0.5 * w }),
        face: 'laugh',
      };
    },
  },
  goldfountain: {
    ms: 4800,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      return {
        pose: sum(jump(t, 0.12, 0.36, 0.25), jump(t, 0.42, 0.66, 0.25), jump(t, 0.7, 0.84, 0.2), {
          armLOut: (1.4 + wiggle(t, 0.1, 0.95, 8, 0.6)) * w,
          armROut: (1.4 - wiggle(t, 0.1, 0.95, 8, 0.6)) * w,
        }),
        face: 'laugh',
      };
    },
  },
  eavelights: {
    ms: 5200,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      const beat = Math.sin(seg(t, 0.05, 0.95) * 8 * Math.PI);
      return {
        pose: {
          py: Math.abs(beat) * 0.05 * w,
          tilt: beat * 0.15 * w,
          yaw: beat * 0.4 * w,
          armLOut: (1.7 + beat * 0.7) * w,
          armROut: (1.7 - beat * 0.7) * w,
          headTilt: -beat * 0.2 * w,
          tail: beat * 0.6 * w,
        },
        face: 'laugh',
      };
    },
  },
  hammock: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.02, 0.98, 0.12);
      return {
        pose: {
          roll: 1.3 * w,
          py: -0.12 * w,
          headPitch: -0.1 * w,
          squash: Math.sin(t * 6 * Math.PI) * 0.02 * w,
          tail: wiggle(t, 0, 1, 3, 0.3),
          ears: -0.3 * w,
        },
        face: w > 0.3 ? 'sleepy' : undefined,
      };
    },
  },
  opalrock: {
    ms: 4600,
    frame: (t) => {
      const sniff = hold(t, 0.02, 0.36, 0.1);
      const joy = hold(t, 0.58, 0.97, 0.08);
      return {
        pose: sum(jump(t, 0.38, 0.54, 0.22), {
          lean: 0.35 * sniff,
          headPitch: 0.35 * sniff + wiggle(t, 0.05, 0.33, 4, 0.08),
          armLOut: 2.2 * joy,
          armROut: 2.2 * joy,
          yaw: easeInOut(seg(t, 0.62, 0.95)) * TAU,
        }),
        face: t < 0.36 ? 'focused' : t < 0.56 ? 'surprised' : 'stars',
      };
    },
  },
  flamingos: {
    ms: 5400,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.1);
      const beat = Math.sin(seg(t, 0.05, 0.95) * 6 * Math.PI);
      return {
        pose: {
          legL: 0.9 * w,
          tilt: (beat * 0.12 - 0.06) * w,
          armLOut: (1.5 + beat * 0.5) * w,
          armROut: (1.5 - beat * 0.5) * w,
          headTilt: beat * 0.15 * w,
          py: Math.abs(beat) * 0.03 * w,
        },
        face: 'happy',
      };
    },
  },
  pavilion: {
    ms: 5600,
    frame: (t) => {
      const sip = bump(t, 0.18, 0.28, 0.38) + bump(t, 0.56, 0.66, 0.76);
      return {
        pose: { armR: 1.5 * sip, armROut: -0.3 * sip, headPitch: -0.12 * sip, tail: wiggle(t, 0, 1, 4, 0.3), headTilt: wiggle(t, 0.4, 0.55, 1, 0.15) },
        face: sip > 0.5 ? 'blink' : 'happy',
      };
    },
  },
  icelanterns: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.03, 0.97, 0.08);
      return { pose: sum(steps(t, 0.05, 0.95, 12), { armR: 1.0 * w, armROut: 0.3 * w, headPitch: -0.1 * w }), face: 'happy' };
    },
  },
  aurora: {
    ms: 6000,
    frame: (t) => {
      const w = hold(t, 0.04, 0.96, 0.15);
      return {
        pose: {
          headPitch: -0.55 * w,
          lean: -0.1 * w,
          armL: 0.8 * w,
          armR: 0.8 * w,
          armLOut: -0.3 * w,
          armROut: -0.3 * w,
          tilt: wiggle(t, 0.1, 0.9, 2, 0.06),
          tail: wiggle(t, 0, 1, 3, 0.3),
        },
        face: t > 0.3 && t < 0.8 ? 'love' : 'happy',
      };
    },
  },
  fireflyjars: {
    ms: 5600,
    frame: (t) => {
      const open = hold(t, 0.05, 0.3, 0.08);
      const up = hold(t, 0.3, 0.95, 0.1);
      return {
        pose: {
          armL: 1.0 * open,
          armR: 1.0 * open,
          armLOut: 2.2 * up,
          armROut: 2.2 * up,
          headPitch: -0.35 * up,
          headYaw: Math.sin(seg(t, 0.3, 0.95) * 2 * TAU) * 0.5 * up,
          py: bump(t, 0.3, 0.38, 0.46) * 0.12,
        },
        face: t < 0.3 ? 'focused' : 'surprised',
      };
    },
  },
  waterfall: {
    ms: 4800,
    frame: (t) => {
      const w = hold(t, 0.04, 0.9, 0.08);
      return {
        pose: sum({ lean: -0.45 * w, armLOut: 2.4 * w, armROut: 2.4 * w, legL: 0.8 * w, legR: 0.8 * w, ears: 0.4 * w }, jump(t, 0.76, 0.86, 0.12)),
        face: t < 0.2 ? 'surprised' : 'laugh',
      };
    },
  },
};

// ------------------------------------------------------------------ eighteen more (D48 PR D)

/** Big and tall animals (and seals) jump less and don't flip; birds use wings for paws. */
const heavy = (c: ClipCtx) => c.body === 'big' || c.body === 'tall';

/**
 * The new tricks and emotes, built from the same primitives (hop, turn, sway, lean, glance, squash) into different
 * routines. Each has its own motion and its own face; a body that can't do it the usual way does its own version.
 */
export const D48_CLIPS: Record<string, Clip> = {
  wiggle: {
    ms: 1600,
    frame: (t) => ({ pose: { tilt: wiggle(t, 0.05, 0.85, 3, 0.2), px: wiggle(t, 0.05, 0.85, 3, 0.05), tail: wiggle(t, 0, 1, 6, 0.8), squash: bump(t, 0.82, 0.9, 0.98) * 0.06 }, face: 'laugh' }),
  },
  peekaboo: {
    ms: 2000,
    frame: (t, c) => {
      const hide = hold(t, 0.06, 0.58, 0.08);
      const boo = bump(t, 0.56, 0.64, 0.78);
      return {
        pose: sum(jump(t, 0.58, 0.72, heavy(c) ? 0.08 : 0.16), { armL: 1.5 * hide, armR: 1.5 * hide, armLOut: -0.3 * hide, armROut: -0.3 * hide, headPitch: 0.25 * hide, ears: 0.4 * boo, headTilt: wiggle(t, 0.76, 0.98, 1, 0.18) } as PoseDelta),
        face: hide > 0.5 ? 'blink' : t > 0.56 ? 'laugh' : 'happy',
      };
    },
  },
  headtilt: {
    ms: 1600,
    frame: (t) => {
      const a = hold(t, 0.08, 0.46, 0.1);
      const b = hold(t, 0.52, 0.92, 0.1);
      return { pose: { headTilt: 0.42 * a - 0.38 * b, headYaw: 0.15 * a - 0.15 * b, ears: 0.25 * (a + b) }, face: t > 0.44 && t < 0.54 ? 'blink' : 'lookR' };
    },
  },
  sneeze: {
    ms: 1800,
    frame: (t) => {
      const build = easeInOut(seg(t, 0.05, 0.48)) * (1 - seg(t, 0.48, 0.52));
      const snap = bump(t, 0.48, 0.52, 0.66);
      return { pose: { headPitch: -0.35 * build + 0.4 * snap, lean: -0.1 * build + 0.2 * snap, squash: -0.05 * build + 0.12 * snap, px: -0.05 * bump(t, 0.52, 0.6, 0.8), mouth: build, ears: -0.2 * snap }, face: t > 0.52 && t < 0.8 ? 'surprised' : t < 0.48 ? 'yawn' : 'happy' };
    },
  },
  stretch: {
    ms: 2600,
    frame: (t, c) => {
      const w = hold(t, 0.12, 0.85, 0.2);
      if (c.body === 'bird') return { pose: { armLOut: 1.5 * w, armROut: 1.5 * w, armL: 0.5 * w, armR: 0.5 * w, squash: -0.06 * w + 0.05 * bump(t, 0.75, 0.85, 0.95) }, face: t < 0.4 ? 'yawn' : 'sleepy' };
      return { pose: { lean: 0.42 * w, armL: 1.1 * w, armR: 1.1 * w, tailUp: 0.6 * w, headPitch: -0.3 * w, squash: 0.05 * bump(t, 0.78, 0.86, 0.96), mouth: bump(t, 0.05, 0.22, 0.4) }, face: t < 0.4 ? 'yawn' : 'sleepy' };
    },
  },
  confetti: {
    ms: 2000,
    frame: (t, c) => ({ pose: sum(jump(t, 0.04, 0.24, heavy(c) ? 0.12 : 0.28), { armLOut: 1.6 * hold(t, 0.06, 0.4, 0.06), armROut: 1.6 * hold(t, 0.06, 0.4, 0.06), tilt: wiggle(t, 0.35, 0.9, 2, 0.12), ears: 0.4 * hold(t, 0.04, 0.5) }), face: t < 0.3 ? 'surprised' : 'laugh' }),
  },
  highfive: {
    ms: 1500,
    frame: (t, c) => {
      const up = hold(t, 0.3, 0.72, 0.08);
      const wing = c.body === 'bird';
      return {
        pose: sum(jump(t, 0.32, 0.52, heavy(c) ? 0.06 : 0.12), {
          armR: (wing ? 0.4 : 2.6) * up,
          armROut: (wing ? 2.4 : 0.4) * up,
          lean: -0.08 * up,
          headPitch: -0.2 * up,
          headYaw: c.dir * 0.2 * up,
          tail: wiggle(t, 0.5, 1, 3, 0.5),
        }),
        face: up > 0.3 ? 'laugh' : 'happy',
      };
    },
  },
  tailchase: {
    ms: 2200,
    frame: (t) => {
      const turn = easeInOut(seg(t, 0.06, 0.72));
      const dizzy = hold(t, 0.72, 0.98, 0.06);
      return { pose: sum(steps(t, 0.06, 0.72, 6), { yaw: turn * TAU * 2, headYaw: -0.5 * hold(t, 0.06, 0.72), tail: 0.8 * hold(t, 0.06, 0.72), tilt: wiggle(t, 0.72, 0.98, 2, 0.16) * dizzy, roll: wiggle(t, 0.72, 0.98, 2, 0.05) }), face: dizzy > 0.3 ? 'laugh' : 'focused' };
    },
  },
  somersault: {
    ms: 1800,
    frame: (t, c) => {
      if (heavy(c) || c.body === 'seal') {
        // A big animal rolls onto its side and back, legs in the air for a moment.
        const side = hold(t, 0.12, 0.82, 0.18);
        return { pose: { roll: c.dir * 1.0 * side, py: -0.04 * side, legL: 0.8 * side, legR: 0.8 * side, armL: 0.8 * side, armR: 0.8 * side, tail: wiggle(t, 0.2, 0.8, 4, 0.6) }, face: 'laugh' };
      }
      const flip = easeInOut(seg(t, 0.2, 0.62));
      return { pose: sum(jump(t, 0.16, 0.66, 0.24), { pitch: flip * TAU, px: c.dir * 0.22 * easeInOut(seg(t, 0.16, 0.66)) * (1 - easeInOut(seg(t, 0.8, 0.98))), armLOut: 1.5 * bump(t, 0.6, 0.72, 0.95), armROut: 1.5 * bump(t, 0.6, 0.72, 0.95) }), face: t > 0.62 ? 'laugh' : 'focused' };
    },
  },
  balloon: {
    ms: 3400,
    frame: (t, c) => {
      const up = easeInOut(seg(t, 0.06, 0.45)) * (1 - easeInOut(seg(t, 0.6, 0.94)));
      return { pose: { py: (heavy(c) ? 0.35 : 0.7) * up, armR: 2.6 * hold(t, 0.04, 0.95, 0.08), armROut: 0.3 * hold(t, 0.04, 0.95), legL: 0.4 * up, legR: 0.4 * up, tilt: wiggle(t, 0.1, 0.9, 2, 0.08), tail: wiggle(t, 0, 1, 4, 0.4) }, face: up > 0.5 ? 'stars' : 'happy' };
    },
  },
  drumsolo: {
    ms: 3200,
    frame: (t, c) => {
      // Faster and faster: the beats crowd together toward the end, then one big crash.
      const x = seg(t, 0.05, 0.8);
      const beat = Math.sin(x * x * 14 * Math.PI);
      const crash = bump(t, 0.76, 0.82, 0.96);
      return { pose: sum(jump(t, 0.76, 0.84, heavy(c) ? 0.06 : 0.14), { armL: (0.9 + beat * 0.5) * hold(t, 0.04, 0.82), armR: (0.9 - beat * 0.5) * hold(t, 0.04, 0.82), armLOut: 1.8 * crash, armROut: 1.8 * crash, headPitch: Math.abs(beat) * 0.12, tail: beat * 0.4 }), face: t > 0.8 ? 'laugh' : 'focused' };
    },
  },
  moonwalk: {
    ms: 2600,
    frame: (t, c) => {
      // Faces one way and glides the other.
      const back = easeInOut(seg(t, 0.08, 0.8));
      const glide = hold(t, 0.08, 0.86, 0.06);
      const p = Math.sin(seg(t, 0.08, 0.8) * 8 * Math.PI);
      return { pose: sum(jump(t, 0.74, 0.82, 0.08), { yaw: -c.dir * 1.1 * glide, px: c.dir * 0.3 * back * (1 - easeInOut(seg(t, 0.86, 0.99))), legL: p * 0.4 * glide, legR: -p * 0.4 * glide, lean: -0.08 * glide, armL: 0.4 * glide }), face: 'proud' };
    },
  },
  disco: {
    ms: 2800,
    frame: (t, c) => {
      const s1 = Math.sin(seg(t, 0.04, 0.84) * 6 * Math.PI);
      const point = hold(t, 0.84, 0.98, 0.04);
      return { pose: { px: s1 * 0.07, tilt: s1 * 0.16, armR: (0.6 + 1.8 * Math.max(0, s1)) * hold(t, 0.04, 0.84) + 2.6 * point, armL: (0.6 + 1.8 * Math.max(0, -s1)) * hold(t, 0.04, 0.84), armROut: 0.6 * point, headYaw: c.dir * 0.3 * point, py: Math.abs(s1) * 0.03 }, face: point > 0.4 ? 'proud' : 'happy' };
    },
  },
  chickendance: {
    ms: 3000,
    frame: (t) => {
      const flap = hold(t, 0.02, 0.24, 0.04) * Math.abs(Math.sin(t * 40));
      const wig = hold(t, 0.28, 0.5, 0.04);
      const clap = hold(t, 0.54, 0.66, 0.03);
      const turn = easeInOut(seg(t, 0.68, 0.94));
      return {
        pose: { armLOut: 1.4 * flap + 0.4 * clap, armROut: 1.4 * flap + 0.4 * clap, armL: 0.6 * flap + 1.2 * clap, armR: 0.6 * flap + 1.2 * clap, squash: 0.08 * flap, tilt: Math.sin(t * 40) * 0.12 * wig, tail: Math.sin(t * 40) * 0.8 * wig, yaw: turn * TAU, py: bump(t, 0.56, 0.6, 0.64) * 0.05 },
        face: 'laugh',
      };
    },
  },
  startwirl: {
    ms: 3000,
    frame: (t) => {
      const spin = easeInOut(seg(t, 0.08, 0.9));
      const w = hold(t, 0.06, 0.94, 0.1);
      return { pose: { yaw: spin * TAU * 1.5 * 2 - (spin > 0 ? 0 : 0), py: 0.06 * w + 0.02 * Math.sin(t * 18), armLOut: 1.3 * w, armROut: 1.3 * w, armL: 0.5 * w, armR: 0.5 * w, headPitch: -0.12 * w }, face: 'stars' };
    },
  },
  boogie: {
    ms: 3600,
    frame: (t, c) => {
      // Steps, a spin, a hop and a big finish, one after another.
      const step = hold(t, 0.02, 0.34, 0.04);
      const s1 = Math.sin(seg(t, 0.02, 0.34) * 4 * Math.PI);
      const spin = easeInOut(seg(t, 0.36, 0.52));
      const fin = hold(t, 0.78, 0.97, 0.04);
      return {
        pose: sum(jump(t, 0.56, 0.7, heavy(c) ? 0.12 : 0.3), {
          px: s1 * 0.07 * step,
          tilt: s1 * 0.18 * step,
          legL: Math.max(0, s1) * 0.5 * step,
          legR: Math.max(0, -s1) * 0.5 * step,
          yaw: spin * TAU,
          armLOut: 1.8 * fin + 1.2 * bump(t, 0.56, 0.63, 0.7),
          armROut: 1.8 * fin + 1.2 * bump(t, 0.56, 0.63, 0.7),
          armL: 0.8 * fin,
          armR: 0.8 * fin,
          tail: wiggle(t, 0, 1, 10, 0.6),
        }),
        face: fin > 0.4 ? 'stars' : 'laugh',
      };
    },
  },
  duet: {
    ms: 3400,
    frame: (t, c) => {
      const s1 = Math.sin(seg(t, 0.04, 0.56) * 4 * Math.PI);
      const bow = hold(t, 0.78, 0.96, 0.06);
      return { pose: sum(jump(t, 0.58, 0.72, 0.12), { tilt: s1 * 0.16 * hold(t, 0.04, 0.56), headYaw: c.dir * 0.4 * hold(t, 0.04, 0.56), lean: 0.4 * bow, headPitch: 0.3 * bow, armL: 0.5 * bow, armR: 0.5 * bow }), face: bow > 0.3 ? 'happy' : 'love' };
    },
  },
  miniparade: {
    ms: 3600,
    frame: (t, c) => {
      const march = hold(t, 0.04, 0.9, 0.06);
      const p = Math.sin(seg(t, 0.04, 0.9) * 10 * Math.PI);
      return { pose: { px: c.dir * 0.18 * easeInOut(seg(t, 0.04, 0.5)) * (1 - easeInOut(seg(t, 0.6, 0.98))), py: Math.abs(p) * 0.04 * march, legL: Math.max(0, p) * 0.7 * march, legR: Math.max(0, -p) * 0.7 * march, armL: Math.max(0, -p) * 0.8 * march, armR: Math.max(0, p) * 0.8 * march, headPitch: -0.12 * march, tail: p * 0.4 }, face: 'proud' };
    },
  },
};

// ------------------------------------------------------------------ the new decorations' motions (D48 PR C)

/**
 * A 3D toy's part in one of the shared motions (`three/motions.ts`): where it goes is the drawn rider's business (the
 * stage carries the toy to it); this is what its body does meanwhile. Every one starts and ends at rest.
 */
export function motionClip(motion: Motion, ms: number): Clip {
  return {
    ms,
    frame: (t, c) => {
      const w = hold(t, 0.04, 0.96, 0.08);
      switch (motion) {
        case 'gather':
        case 'peek':
        case 'peekout': {
          const look = motion === 'gather' ? 0 : wiggle(t, 0.25, 0.75, 1, 0.5);
          return {
            pose: sum(steps(t, 0.04, 0.24, 3), steps(t, 0.76, 0.96, 3), {
              headYaw: look,
              tilt: motion === 'gather' ? wiggle(t, 0.3, 0.7, 2, 0.12) : 0,
              ears: 0.25 * w,
              tail: wiggle(t, 0, 1, 5, 0.5),
            }),
            face: motion === 'gather' ? 'happy' : Math.abs(look) > 0.25 ? (look > 0 ? 'lookR' : 'lookL') : 'happy',
          };
        }
        case 'rest':
          return { pose: { squash: 0.06 * w + wiggle(t, 0.1, 0.9, 4, 0.015), headPitch: 0.22 * w, ears: -0.2 * w, tail: 0.2 * w }, face: t > 0.25 && t < 0.85 ? 'sleepy' : 'happy' };
        case 'stage':
        case 'dance':
        case 'drum':
          return {
            pose: {
              tilt: wiggle(t, 0.05, 0.95, motion === 'drum' ? 10 : 4, 0.14),
              py: Math.abs(wiggle(t, 0.05, 0.95, motion === 'drum' ? 10 : 4, 0.06)),
              armL: (0.6 + wiggle(t, 0.05, 0.95, 8, 0.4)) * w,
              armR: (0.6 - wiggle(t, 0.05, 0.95, 8, 0.4)) * w,
              tail: wiggle(t, 0, 1, 8, 0.6),
            },
            face: t > 0.75 && t < 0.92 ? 'laugh' : 'happy',
          };
        case 'ride':
        case 'sled':
        case 'swing':
          return {
            pose: { armL: 1.2 * w, armR: 1.2 * w, legL: 0.5 * w, legR: 0.5 * w, py: wiggle(t, 0, 1, motion === 'ride' ? 6 : 3, 0.015) * w, tail: wiggle(t, 0, 1, 6, 0.4), roll: motion === 'swing' ? wiggle(t, 0.05, 0.95, 3, 0.15) : 0 },
            face: 'laugh',
          };
        case 'slide': {
          const down = hold(t, 0.14, 0.62, 0.06);
          return { pose: sum(jump(t, 0.62, 0.72, 0.08), { lean: -0.2 * down, armL: 2 * down, armR: 2 * down, armLOut: 0.6 * down, armROut: 0.6 * down, legL: 0.6 * down, legR: 0.6 * down }), face: down > 0.3 ? 'laugh' : 'happy' };
        }
        case 'chase':
          return { pose: sum(jump(t, 0.06, 0.2, 0.1), jump(t, 0.32, 0.46, 0.12), jump(t, 0.56, 0.68, 0.1), jump(t, 0.74, 0.84, 0.08), { yaw: c.dir * Math.PI * 0.35 * Math.sin(seg(t, 0, 1) * Math.PI * 2) * w, ears: 0.3 * w, tail: wiggle(t, 0, 1, 6, 0.6) }), face: 'happy' };
        case 'splash':
          return { pose: { lean: (0.2 + wiggle(t, 0.1, 0.7, 3, 0.15)) * w, armL: (0.8 + wiggle(t, 0.1, 0.7, 3, 0.5)) * w, armR: (0.8 - wiggle(t, 0.1, 0.7, 3, 0.5)) * w, headPitch: 0.25 * w }, face: t > 0.7 ? 'laugh' : 'happy' };
        case 'gaze':
          return { pose: { headPitch: -0.45 * w, tilt: wiggle(t, 0.2, 0.8, 2, 0.08), ears: 0.2 * w }, face: 'stars' };
        case 'ring':
          return { pose: sum(jump(t, 0.12, 0.42, 0.22), jump(t, 0.5, 0.74, 0.16), { armR: 2.2 * hold(t, 0.12, 0.8, 0.1), armROut: 0.3 * w, ears: 0.3 * w }), face: t > 0.4 ? 'laugh' : 'happy' };
      }
    },
  };
}

for (const [decor, { motion, ms }] of Object.entries(DECOR_MOTIONS)) ACTIVITY_CLIPS[decor] ??= motionClip(motion, ms);

// ------------------------------------------------------------------ a meal (D48 PR B)

/**
 * Eating from a bowl (`components/feeding.ts`, the same 3.6 s): notices the bowl on its side (toward the middle of the
 * scene), steps up to it, three bites, a happy hop, and back to where it stood.
 */
export const MOMENT_CLIPS: Record<string, Clip> = {
  feed: {
    ms: 3600,
    frame: (t, c) => {
      const notice = hold(t, 0.02, 0.32, 0.1);
      const near = easeInOut(seg(t, 0.14, 0.3)) * (1 - easeInOut(seg(t, 0.88, 0.99)));
      const bite = (a: number) => bump(t, a - 0.04, a, a + 0.06);
      const bites = bite(0.35) + bite(0.49) + bite(0.63);
      const happy = hold(t, 0.72, 0.92, 0.06);
      const birdy = c.body === 'bird';
      return {
        pose: sum(steps(t, 0.14, 0.3, 2), jump(t, 0.74, 0.84, 0.12), {
          px: c.dir * 0.24 * near,
          headYaw: c.dir * 0.45 * notice,
          ears: 0.3 * notice + 0.2 * happy,
          headPitch: (birdy ? 0.75 : 0.5) * bites,
          lean: 0.18 * bites,
          mouth: bites,
          tail: wiggle(t, 0.66, 0.96, 4, 0.7),
          tailUp: 0.3 * happy,
        }),
        face: t > 0.7 && t < 0.95 ? 'happy' : bites > 0.3 ? 'blink' : notice > 0.3 ? (c.dir > 0 ? 'lookR' : 'lookL') : undefined,
      };
    },
  },
  /**
   * D49 PR C: a quick meal (1.1 s, `components/feeding.ts::QUICK_FEED_MS`): a lean toward the bowl, one bite, a small
   * happy bounce, back at rest. No steps: the animal eats where it stands.
   */
  nibble: {
    ms: 1100,
    frame: (t, c) => {
      const lean = hold(t, 0.05, 0.62, 0.12);
      const bite = bump(t, 0.24, 0.32, 0.42);
      const happy = hold(t, 0.55, 0.9, 0.08);
      const birdy = c.body === 'bird';
      return {
        pose: sum(jump(t, 0.58, 0.8, 0.06), {
          px: c.dir * 0.06 * lean,
          headYaw: c.dir * 0.3 * lean,
          headPitch: (birdy ? 0.7 : 0.45) * bite,
          lean: 0.12 * bite,
          mouth: bite,
          tail: wiggle(t, 0.5, 0.95, 3, 0.6),
          tailUp: 0.25 * happy,
        }),
        face: t > 0.52 && t < 0.92 ? 'happy' : bite > 0.3 ? 'blink' : undefined,
      };
    },
  },
};

/** A decoration activity's clip for the rider. */
export function activityClip(decor: string): Clip | null {
  return ACTIVITY_CLIPS[decor] ?? null;
}

/** A trick's or an emote's clip (they share the catalog's ids; D33/D34), or a group dance's (D44 PR D). */
export function performClip(id: string): Clip | null {
  return TRICK_CLIPS[id] ?? EMOTE_CLIPS[id] ?? D48_CLIPS[id] ?? MOMENT_CLIPS[id] ?? (id.startsWith('dance:') ? danceClip(id) : null);
}

/** An everyday move's clip (the ambient director's action names). */
export function ambientClip(action: string): Clip | null {
  return AMBIENT[action] ?? null;
}

/** Angles that end a whole number of turns round count as back at rest. */
export const TURN_CHANNELS = ['yaw', 'pitch', 'roll'] as const;

/** Overshoot for props popping in (re-exported for effects). */
export { easeOutBack };
