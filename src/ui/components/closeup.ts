/**
 * Trick close-ups (D44 PR F): when the player asks an animal for a trick, the camera comes in on it, holds while it
 * performs, and gives the whole scene back. Selecting an animal moves nothing; the close-up starts with the trick
 * (in over 0.4 s, the trick's own 2–4 s, out over 0.5 s). Each kind of trick has its own shot:
 *
 *  - Happy dance: in close, and the frame bumps on every beat of its tune.
 *  - Giggle: right in on the face.
 *  - Backflip: in, then pulls out and up as it leaps, so the whole flip is in frame.
 *  - Sleepy: a slow push-in for the length of the yawn and doze.
 *  - Rainbow leap: wide, high enough for the rainbow across the sky.
 *  - Party time: out to take in the animals nearby, who join the party with a dance.
 *  - Everything else: a 2× close-up.
 *
 * While a close-up plays, the rest of the scene quiets down (a soft vignette, and nobody else starts a stroll or an
 * idle), and the animals nearest look over and say hello partway through. Reduced motion: no close-ups at all (the
 * trick plays in the whole scene, as before).
 */

import { scoreFor } from '../../audio/scores';
import type { TrickId } from '../../meta/catalogs/tricks';
import { TRICK_BY_ID } from '../../meta/catalogs/tricks';
import { clampView, scenePoint, viewAt, type SceneCamera, type View } from './camera';
import { performTrick } from './trickPlay';

export interface Shot {
  /** How close (1 = the whole scene). */
  zoom: number;
  /** Where the frame centres, above (-) or below (+) the animal's middle, in its own heights. */
  dy?: number;
  /** A second move during the trick: at `at` (a share of it) to `zoom`/`dy` over `ms` (or the rest of the trick). */
  then?: { zoom: number; dy?: number; at: number; ms?: number };
  /** The frame bumps on each beat of the trick's tune. */
  beat?: boolean;
  /** Frames the animal and its neighbours (who join in) instead. */
  party?: boolean;
}

export const DEFAULT_SHOT: Shot = { zoom: 2 };
export const TRICK_SHOTS: Partial<Record<TrickId, Shot>> = {
  dance: { zoom: 1.9, beat: true },
  laugh: { zoom: 2.5, dy: -0.32 },
  backflip: { zoom: 1.9, then: { zoom: 1.35, dy: -0.9, at: 0.1, ms: 650 } },
  sleepy: { zoom: 1.45, then: { zoom: 2.3, dy: -0.15, at: 0.14 } },
  rainbow: { zoom: 1.15, dy: -0.9 },
  party: { zoom: 1.5, party: true },
};
export const shotFor = (id: TrickId): Shot => TRICK_SHOTS[id] ?? DEFAULT_SHOT;

export const CLOSEUP_IN_MS = 400;
export const CLOSEUP_OUT_MS = 500;
/** How far (scene units) an animal can be and still count as nearby: it reacts, and joins a party. */
const NEARBY = 120;

export interface CloseUpHost {
  /** The scene's figure (`.sanctuary__scene`). */
  host: () => HTMLElement | null;
  svg: () => SVGSVGElement | null;
  camera: SceneCamera;
  reducedMotion: () => boolean;
  /** Pauses (or resumes) the scene's ambient life and activities. */
  pause(on: boolean): void;
  /** Plays a small reaction on a figure (sceneLife's `play`). */
  react?(fig: SVGGElement, action: 'greet'): void;
}

export interface SceneCloseUps {
  /** Starts the close-up for a trick that has just started on `fig`. */
  play(fig: SVGGElement, id: TrickId): void;
  /** Ends the close-up now (the scene back at once). */
  cancel(): void;
  readonly active: boolean;
}

/** The figures near `fig`, nearest first. */
export function nearbyFigures(svg: SVGSVGElement, fig: SVGGElement, within = NEARBY): SVGGElement[] {
  const at = scenePoint(fig);
  if (!at) return [];
  return [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-gx]')]
    .filter((g) => g !== fig && !g.classList.contains('is-away'))
    .map((g) => ({ g, d: Math.hypot(Number(g.dataset.gx) - Number(fig.dataset.gx), Number(g.dataset.gy) - Number(fig.dataset.gy)) }))
    .filter((x) => x.d <= within)
    .sort((a, b) => a.d - b.d)
    .map((x) => x.g);
}

/** A view framing several figures (with room above them), no closer than `max`. */
export function framing(full: View, figs: Element[], max = 1.5): View {
  const pts = figs.map((f) => scenePoint(f)).filter((p): p is NonNullable<typeof p> => !!p);
  if (!pts.length) return full;
  const x0 = Math.min(...pts.map((p) => p.x - p.h * 0.8));
  const x1 = Math.max(...pts.map((p) => p.x + p.h * 0.8));
  const y0 = Math.min(...pts.map((p) => p.y - p.h * 1.3));
  const y1 = Math.max(...pts.map((p) => p.y + p.h * 0.8));
  const zoom = Math.min(max, full.w / Math.max(1, x1 - x0), full.h / Math.max(1, y1 - y0));
  return zoom <= 1.02 ? full : clampView(full, viewAt(full, (x0 + x1) / 2, (y0 + y1) / 2, zoom));
}

export function sceneCloseUps(o: CloseUpHost): SceneCloseUps {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let active: { fig: SVGGElement } | null = null;
  const later = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  const clear = () => {
    for (const t of timers) clearTimeout(t);
    timers = [];
  };
  const quiet = (on: boolean) => {
    o.host()?.classList.toggle('is-closeup', on);
    o.pause(on);
  };
  const finish = (ms: number) => {
    clear();
    if (!active) return;
    active = null;
    quiet(false);
    o.camera.clearOffset();
    void o.camera.reset(ms);
  };

  return {
    play(fig, id) {
      if (o.reducedMotion()) return;
      const svg = o.svg();
      if (!svg) return;
      clear();
      const t = TRICK_BY_ID[id];
      const shot = shotFor(id);
      const h = Number(fig.dataset.gh) || 34;
      const cam = o.camera;
      active = { fig };
      quiet(true);
      if (shot.party) {
        // Party time: everyone nearby is in the shot, and joins in with a dance.
        const friends = nearbyFigures(svg, fig).slice(0, 3);
        void cam.moveTo(framing(cam.full, [fig, ...friends], shot.zoom), CLOSEUP_IN_MS);
        friends.forEach((f, i) => later(320 + i * 140, () => performTrick(svg, f, 'dance', false)));
      } else {
        const v = cam.viewOf(fig, shot.zoom, { dy: (shot.dy ?? 0) * h });
        if (v) void cam.moveTo(v, CLOSEUP_IN_MS);
        // The nearest look over and say hello partway through.
        for (const f of nearbyFigures(svg, fig).slice(0, 2)) later(Math.round(t.ms * 0.35), () => o.react?.(f, 'greet'));
      }
      if (shot.then) {
        const then = shot.then;
        later(Math.max(CLOSEUP_IN_MS, Math.round(t.ms * then.at)), () => {
          const v = cam.viewOf(fig, then.zoom, { dy: (then.dy ?? 0) * h });
          const left = t.ms - Math.round(t.ms * then.at) - 120;
          if (v) void cam.moveTo(v, then.ms ?? Math.max(300, left), (x) => x * (2 - x));
        });
      }
      if (shot.beat) {
        // On every beat of the trick's tune, a small bump in.
        const bpm = scoreFor(`trick:${id}`)?.bpm ?? 120;
        const beat = 60000 / bpm;
        // (The tune starts with the trick, 40 ms in.)
        for (let at = 40 + beat * Math.ceil(CLOSEUP_IN_MS / beat); at < t.ms - 200; at += beat) {
          later(at, () => cam.setOffset(0, 0, 1.035));
          later(at + Math.min(140, beat * 0.4), () => cam.clearOffset());
        }
      }
      later(t.ms, () => finish(CLOSEUP_OUT_MS));
    },
    cancel: () => finish(0),
    get active() {
      return !!active;
    },
  };
}
