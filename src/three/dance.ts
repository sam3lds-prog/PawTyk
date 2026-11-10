/**
 * Group dances (D44 PR D): the Welcome Parade, a sanctuary's stage party, Party time. Every dancer follows the same
 * beats, so the group moves together, but each dances its own way: its **style** comes from its kind and temperament
 * (Cotton sways and nods, Truffle wiggles and hops, a bunny twirls, a turtle bobs its head), and its **variant** picks
 * its finishing pose, so the big finish is a row of different happy poses.
 *
 * A dance is described entirely by its id, so the drawn scene and the 3D stage build the very same clip from it
 * (no shared state; nothing here needs three.js):
 *
 *   dance:<role>:<style>:<variant>:<L|R>:<bpm>:<beats>
 *
 * - role `newcomer`: a big leap of joy and a hello spin during the intro (beats 0–4), dances, strikes its pose.
 * - role `guest`: turns toward the newcomer (on the side L or R) during the intro, dances, strikes its pose.
 * - role `group`: no intro; dances from the first beat.
 * The finish lands two beats before the end (beat 14 of Barnyard Bounce's 16), holds, and every dancer is back at
 * rest on the last beat, as every clip must be.
 */

import type { Expr } from './face';
import type { Clip, ClipCtx, Frame } from './clips';
import { arc, bump, easeInOut, easeOutBack, hold, seg, type PoseDelta } from './pose';

export type DanceRole = 'newcomer' | 'guest' | 'group';
export const DANCE_STYLES = ['sway', 'wiggle', 'twirl', 'bob', 'flap', 'stomp', 'hop', 'strut'] as const;
export type DanceStyle = (typeof DANCE_STYLES)[number];
/** Finishing poses: hooray (paws up and a little jump), a lean, a twirl that stops in a pose, a star leap. */
export const FINISH_POSES = ['hooray', 'lean', 'twirl', 'leap'] as const;

export interface DanceSpec {
  role: DanceRole;
  style: DanceStyle;
  variant: number;
  /** Which side the newcomer is on (a guest turns that way); a newcomer faces this way to start. */
  side: 'L' | 'R';
  bpm: number;
  beats: number;
}

export function danceId(d: DanceSpec): string {
  return `dance:${d.role}:${d.style}:${d.variant % FINISH_POSES.length}:${d.side}:${d.bpm}:${d.beats}`;
}

export function parseDanceId(id: string): DanceSpec | null {
  const m = /^dance:(newcomer|guest|group):([a-z]+):(\d):([LR]):(\d+(?:\.\d+)?):(\d+)$/.exec(id);
  if (!m || !(DANCE_STYLES as readonly string[]).includes(m[2])) return null;
  const bpm = Number(m[5]);
  const beats = Number(m[6]);
  if (!(bpm >= 40 && bpm <= 240 && beats >= 4 && beats <= 32)) return null;
  return {
    role: m[1] as DanceRole,
    style: m[2] as DanceStyle,
    variant: Number(m[3]),
    side: m[4] as 'L' | 'R',
    bpm,
    beats,
  };
}

/** Where the dance's parts fall, in beats. */
export function danceSections(d: Pick<DanceSpec, 'role' | 'beats'>): {
  intro: number;
  finish: number;
  end: number;
} {
  const intro = d.role === 'group' ? 0 : Math.min(4, Math.floor(d.beats / 4));
  return { intro, finish: d.beats - 2, end: d.beats };
}

const TAU = Math.PI * 2;
/** Peaks on every beat (0 between): for nods, stomps and landings. */
const kick = (b: number) => Math.max(0, Math.cos(TAU * b)) ** 3;
/** Jump heights by body: big and tall animals and seals bounce less. */
const LIFT: Record<string, number> = {
  big: 0.55,
  tall: 0.6,
  seal: 0.35,
  bird: 1,
  sit: 1,
  upright: 1,
};

function sum(...ds: PoseDelta[]): PoseDelta {
  const out: Record<string, number> = {};
  for (const d of ds) for (const k in d) out[k] = (out[k] ?? 0) + (d as Record<string, number>)[k];
  return out as PoseDelta;
}
function scale(d: PoseDelta, w: number): PoseDelta {
  const out: Record<string, number> = {};
  for (const k in d) out[k] = (d as Record<string, number>)[k] * w;
  return out as PoseDelta;
}

const TURNS = ['yaw', 'pitch', 'roll'] as const;
const wrapAngle = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
/**
 * Like `scale`, for a part that is handing over: whole turns already made (a twirl's, a spin's) are dropped first, so
 * the hand-over settles the short way instead of spinning every turn back (D44 PR D review).
 */
function settle(d: PoseDelta, w: number): PoseDelta {
  const out = scale(d, 1) as Record<string, number>;
  for (const k of TURNS) if (out[k] !== undefined) out[k] = wrapAngle(out[k]);
  return scale(out as PoseDelta, w);
}

/** One dance step at beat b (b counts from the start of the dance part), at full strength. */
function step(style: DanceStyle, b: number, lift: number, amp: number): { pose: PoseDelta; face: Expr } {
  const s1 = Math.sin(Math.PI * b); // one sway every two beats
  const s2 = Math.sin(TAU * b); // once a beat
  const k = kick(b);
  const a = amp;
  switch (style) {
    case 'sway':
      return {
        pose: {
          tilt: s1 * 0.2 * a,
          px: s1 * 0.07 * a,
          headPitch: k * 0.22 * a,
          headTilt: -s1 * 0.15 * a,
          tail: s2 * 0.5,
          ears: k * 0.2,
        },
        face: 'happy',
      };
    case 'wiggle': {
      const x = (((b % 2) + 2) % 2) / 2;
      const hop = x < 0.25 ? arc(x, 0, 0.25, 0.11 * lift) : 0;
      return {
        pose: {
          yaw: Math.sin(2 * TAU * b) * 0.28 * a,
          tail: Math.sin(2 * TAU * b) * 0.9,
          py: hop,
          squash: kick(b * 0.5) * 0.08,
          ears: 0.15,
        },
        face: 'laugh',
      };
    }
    case 'twirl': {
      const pair = Math.floor(b / 2);
      const x = b - pair * 2;
      const turn = easeInOut(seg(x, 0, 0.6));
      const hop = arc(x, 1, 1.4, 0.08 * lift);
      return {
        pose: {
          yaw: TAU * (pair + turn),
          py: hop,
          armLOut: 0.8 * bump(x, 0, 0.3, 0.6),
          armROut: 0.8 * bump(x, 0, 0.3, 0.6),
          ears: 0.2,
        },
        face: 'happy',
      };
    }
    case 'bob':
      return {
        pose: {
          headPitch: s2 * 0.26 * a,
          squash: k * 0.04,
          tilt: s1 * 0.08 * a,
          tail: s2 * 0.4,
          headTilt: s1 * 0.1,
        },
        face: 'happy',
      };
    case 'flap':
      return {
        pose: {
          armLOut: (1 + Math.sin(2 * TAU * b)) * 0.9 * a,
          armROut: (1 + Math.sin(2 * TAU * b)) * 0.9 * a,
          armL: 0.3,
          armR: 0.3,
          py: k * 0.06 * lift,
          headTilt: s1 * 0.2,
          tail: s2 * 0.4,
        },
        face: 'laugh',
      };
    case 'stomp':
      return {
        pose: {
          px: s1 * 0.1 * a,
          legL: Math.max(0, s1) * 0.5,
          legR: Math.max(0, -s1) * 0.5,
          squash: k * 0.08,
          tilt: s1 * 0.12 * a,
          headPitch: k * 0.1,
        },
        face: 'proud',
      };
    case 'hop': {
      const x = ((b % 1) + 1) % 1;
      return {
        pose: {
          py: 4 * 0.12 * lift * x * (1 - x),
          squash: k * 0.1,
          armL: 0.4 + s1 * 0.3,
          armR: 0.4 - s1 * 0.3,
          ears: 0.25,
          tail: s2 * 0.6,
        },
        face: 'laugh',
      };
    }
    case 'strut':
      return {
        pose: {
          px: Math.sin((Math.PI * b) / 2) * 0.12 * a,
          headPitch: -0.12 + k * 0.08,
          armL: Math.max(0, s1) * 0.6,
          armR: Math.max(0, -s1) * 0.6,
          lean: 0.05,
          tail: s2 * 0.4,
        },
        face: 'proud',
      };
  }
}

/** The finishing pose, `w` 0–1 (and its own little motion as it lands at beat b relative to the finish). */
function finishPose(variant: number, b: number, side: number, lift: number): { pose: PoseDelta; face: Expr } {
  switch (FINISH_POSES[variant % FINISH_POSES.length]) {
    case 'hooray':
      return {
        pose: {
          armL: 1.1,
          armR: 1.1,
          armLOut: 1.6,
          armROut: 1.6,
          py: arc(b, 0, 0.6, 0.22 * lift),
          ears: 0.4,
          tailUp: 0.4,
        },
        face: 'laugh',
      };
    case 'lean':
      return {
        pose: {
          tilt: side * 0.28,
          armROut: 2.3,
          armR: 0.6,
          headTilt: -side * 0.25,
          ears: 0.3,
        },
        face: 'happy',
      };
    case 'twirl':
      return {
        pose: {
          yaw: TAU * easeOutBack(seg(b, -0.6, 0.25), 1.2),
          armLOut: 1.2,
          armROut: 1.2,
          headPitch: -0.1,
        },
        face: 'proud',
      };
    default:
      return {
        pose: {
          py: arc(b, -0.1, 0.7, 0.34 * lift),
          squash: bump(b, 0.6, 0.72, 0.95) * 0.14,
          armLOut: 1.8,
          armROut: 1.8,
          armL: 0.6,
          armR: 0.6,
        },
        face: 'stars',
      };
  }
}

/** The intro: a newcomer leaps for joy and says hello; a guest turns toward it and gives a little hop. */
function intro(role: DanceRole, b: number, n: number, side: number, lift: number): { pose: PoseDelta; face: Expr } {
  const x = b / n;
  if (role === 'newcomer') {
    // A big leap of joy (crouch, launch, a high arc, a squash on landing by the second beat), a bounce, a hello spin.
    const crouch = bump(x, 0, 0.03, 0.06) * 0.16;
    const leap = arc(x, 0.05, 0.25, 0.9 * lift);
    const land = bump(x, 0.23, 0.27, 0.36) * 0.2;
    const bounce = arc(x, 0.29, 0.42, 0.12 * lift);
    const spin = TAU * easeInOut(seg(x, 0.5, 0.8));
    return {
      pose: {
        py: leap + bounce,
        squash: crouch + land,
        yaw: spin,
        armLOut: 0.9 * bump(x, 0.5, 0.65, 0.8),
        armROut: 0.9 * bump(x, 0.5, 0.65, 0.8),
        ears: 0.35 * seg(x, 0, 0.06),
      },
      face: x > 0.05 && x < 0.26 ? 'surprised' : 'happy',
    };
  }
  // A guest: looks over (and half turns) toward the newcomer, then a little hop of welcome.
  const look = hold(x, 0.3, 0.98, 0.2);
  return {
    pose: {
      headYaw: side * 0.55 * look,
      yaw: side * 0.45 * look,
      ears: 0.3 * look,
      py: arc(x, 0.62, 0.8, 0.07 * lift),
      px: side * 0.04 * look,
    },
    face: look > 0.3 ? (side > 0 ? 'lookR' : 'lookL') : 'happy',
  };
}

const cache = new Map<string, Clip>();

/** The clip for a dance id, or null if it isn't one. Pure: the drawing and the 3D stage get the same clip. */
export function danceClip(id: string): Clip | null {
  const hit = cache.get(id);
  if (hit) return hit;
  const d = parseDanceId(id);
  if (!d) return null;
  const { intro: n, finish: F, end } = danceSections(d);
  const ms = Math.round((d.beats * 60000) / d.bpm);
  const amp = 0.92 + (d.variant % 4) * 0.05;
  const clip: Clip = {
    ms,
    frame(t: number, c: ClipCtx): Frame {
      const b = t * end;
      const lift = LIFT[c.body] ?? 1;
      const side = d.side === 'R' ? 1 : -1;
      if (b < n) {
        const f = intro(d.role, b, n, side, lift);
        // The intro hands over to the dance smoothly.
        return { pose: settle(f.pose, 1 - seg(b, n - 0.3, n)), face: f.face };
      }
      // Dance, getting a little bigger in the two beats before the finish.
      const db = b - n;
      const grow = 1 + 0.3 * seg(b, F - 2, F);
      const dw = hold(b, n - 0.01, F + 0.15, 0.4);
      const st = step(d.style, db, lift, amp * grow);
      // The pose snaps in around the finish beat, holds, and lets go over the last beat.
      const pw = b < F - 0.15 ? 0 : Math.min(1, easeOutBack(seg(b, F - 0.15, F + 0.25), 1.4), 1 - easeInOut(seg(b, end - 0.9, end - 0.05)));
      const fp = finishPose(d.variant, b - F, side, lift);
      const pose = sum(settle(st.pose, dw), settle(fp.pose, Math.max(0, pw)));
      return { pose, face: pw > 0.4 ? fp.face : st.face };
    },
  };
  cache.set(id, clip);
  return clip;
}
