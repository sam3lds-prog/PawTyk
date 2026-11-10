/**
 * The Welcome Parade (D44 PR E, celebration level 3): a new animal's arrival, played out in its home when the player
 * taps Meet. The camera glides in on the newcomer as it leaps into the scene to Barnyard Bounce, pulls back as everyone
 * dances, holds on the finish (confetti, stars, poses), and gives the whole scene back. About 7 s; a Skip button ends
 * it at once, and a Replay button plays it again afterwards (it grants nothing, so replays and skips can't double up).
 *
 * The same machinery plays a home's group celebration when it reaches a new stage: everyone dances together to the
 * shorter Barnyard Jig, with no newcomer and no camera move.
 *
 * Reduced motion: the camera stays on the whole scene, every animal shows its happy face for the dance's length and
 * the confetti appears still (the dance's own reduced form, `dance.ts`). The music still plays (unless it is off).
 */

import { playCue, type Playback } from '../../services/music';
import { scoreFor, type CueId } from '../../audio/scores';
import { planDance, startDance, type DanceHandle, type Dancer } from './dance';
import { clampView, scenePoint, viewAt, type SceneCamera, type View } from './camera';

export type ParadeEnd = 'ended' | 'skipped';

export interface ParadeOptions {
  svg: SVGSVGElement;
  /** The scene's figure (`.sanctuary__scene`): it holds the Skip button and is marked while the parade plays. */
  host: HTMLElement;
  camera: SceneCamera | null;
  /** The animal being welcomed; none for a group celebration. */
  newcomer?: string;
  reducedMotion: boolean;
  /** The tune whose beats everyone follows (default: Barnyard Bounce, or the Jig for a group celebration). */
  cue?: CueId;
  /** Told as each part starts (tests and the screen follow along). */
  onPart?: (part: 'intro' | 'dance' | 'finish' | 'end') => void;
}

export interface ParadeHandle {
  readonly dancers: Dancer[];
  readonly done: Promise<ParadeEnd>;
  /** Ends it now: dancers back at rest, music fades, camera back on the whole scene. Safe to call more than once. */
  skip(): void;
  readonly active: boolean;
}

/** How close the camera comes on the newcomer as it arrives. */
export const PARADE_CLOSE_ZOOM = 1.9;
/** The glide in on the newcomer, before the music starts. */
const GLIDE_IN_MS = 450;
/** The most the camera zooms to frame the whole dancing group. */
const GROUP_MAX_ZOOM = 1.45;

/** A view framing every dancer (a margin around their figures), no closer than `GROUP_MAX_ZOOM`. */
export function groupView(full: View, dancers: Dancer[]): View {
  const pts = dancers.map((d) => scenePoint(d.fig)).filter((p): p is NonNullable<typeof p> => !!p);
  if (!pts.length) return full;
  const x0 = Math.min(...pts.map((p) => p.x - p.h * 0.7));
  const x1 = Math.max(...pts.map((p) => p.x + p.h * 0.7));
  const y0 = Math.min(...pts.map((p) => p.y - p.h * 1.1));
  const y1 = Math.max(...pts.map((p) => p.y + p.h * 0.75));
  const zoom = Math.min(GROUP_MAX_ZOOM, full.w / Math.max(1, x1 - x0), full.h / Math.max(1, y1 - y0));
  return zoom <= 1.02 ? full : clampView(full, viewAt(full, (x0 + x1) / 2, (y0 + y1) / 2, zoom));
}

export function startParade(o: ParadeOptions): ParadeHandle {
  const cue: CueId = o.cue ?? (o.newcomer ? 'bounce' : 'jig');
  const score = scoreFor(cue);
  let pb: Playback | null = null;
  let resolve!: (e: ParadeEnd) => void;
  const done = new Promise<ParadeEnd>((r) => (resolve = r));
  let over = false;
  let dance: DanceHandle | null = null;
  let skipBtn: HTMLButtonElement | null = null;
  let startTimer: ReturnType<typeof setTimeout> | null = null;
  const dancers = score ? planDance(o.svg, { bpm: score.bpm, beats: score.beats, newcomer: o.newcomer }) : [];
  const lead = o.newcomer ? dancers.find((d) => d.spec.role === 'newcomer') : undefined;

  const end = (how: ParadeEnd) => {
    if (over) return;
    over = true;
    if (startTimer !== null) clearTimeout(startTimer);
    dance?.stop();
    if (how === 'skipped') pb?.stop(220);
    o.camera?.clearOffset();
    void o.camera?.reset(how === 'skipped' ? 300 : 700);
    o.host.classList.remove('is-parading');
    skipBtn?.remove();
    if (how === 'ended') o.onPart?.('end');
    resolve(how);
  };

  if (!score || !dancers.length) {
    over = true;
    resolve('ended');
    return { dancers, done, skip: () => {}, get active() { return false; } };
  }

  o.host.classList.add('is-parading');
  skipBtn = document.createElement('button');
  skipBtn.type = 'button';
  skipBtn.className = 'parade-skip';
  skipBtn.dataset.act = 'parade-skip';
  skipBtn.textContent = 'Skip';
  skipBtn.setAttribute('aria-label', o.newcomer ? 'Skip the welcome parade' : 'Skip the celebration');
  o.host.appendChild(skipBtn);

  // The camera: in on the newcomer first (the music and its leap start as the glide lands), out to the whole group
  // for the dance, the whole scene at the end.
  const cam = o.reducedMotion ? null : o.camera;
  const go = () => {
    if (over) return;
    pb = playCue(cue);
    if (!pb) {
      end('ended');
      return;
    }
    dance = startDance(o.svg, dancers, pb, {
      reducedMotion: o.reducedMotion,
      onPart: (part) => {
        if (part === 'end') {
          end('ended');
          return;
        }
        if (part === 'dance' && cam && o.newcomer) void cam.moveTo(groupView(cam.full, dancers), 800);
        o.onPart?.(part);
      },
    });
  };
  if (cam && lead) {
    // On the clock, not the glide's promise: a glide another move takes over (or a frame that never comes) can't hold
    // the parade up.
    void cam.focus(lead.fig, PARADE_CLOSE_ZOOM, GLIDE_IN_MS, { dy: -4 });
    startTimer = setTimeout(go, GLIDE_IN_MS + 20);
  } else go();

  return {
    dancers,
    done,
    skip: () => end('skipped'),
    get active() {
      return !over;
    },
  };
}

/** What a sanctuary screen needs from its scene to play parades there. */
export interface SceneParadeHost {
  /** The screen's root (its scene figure, the Replay button and clicks live inside). */
  el: HTMLElement;
  camera: SceneCamera | null;
  /** The scene's ambient life and activities (paused while a parade plays). */
  pause(on: boolean): void;
  /** Closes the trick tray, if open. */
  closeTray(): void;
  reducedMotion: () => boolean;
}

export interface SceneParades {
  /** Plays the parade (with a newcomer) or the group dance. Resolves true if anyone danced. */
  play(newcomer?: string): Promise<boolean>;
  skip(): void;
  readonly active: boolean;
  /** The Replay button, for the row under the scene (hidden until a parade has played). */
  replayMarkup(): string;
  /** A click on the screen: true if the parade handled it (Skip, Replay, or a tap on the scene while it plays). */
  onClick(t: HTMLElement): boolean;
}

const REPLAY_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/></svg>`;

/**
 * Parades on a sanctuary screen: Skip and Replay, Escape to skip, leaving the app ends it, and the scene is the
 * parade's stage while it plays (taps on it and the Tricks button wait).
 */
export function sceneParades(scope: { on(t: EventTarget, type: string, fn: (e: Event) => void): void; onDispose(fn: () => void): void; readonly alive: boolean }, host: SceneParadeHost): SceneParades {
  let current: ParadeHandle | null = null;
  let replay: { newcomer?: string } | null = null;
  const label = () => (replay?.newcomer ? 'Replay the parade' : 'Dance again');
  scope.on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && current?.active && !document.querySelector('.overlay')) current.skip();
  });
  scope.on(document, 'visibilitychange', () => {
    // Leaving the app ends it (its music stops on its own): nothing dances on, unseen.
    if (document.hidden) current?.skip();
  });
  scope.onDispose(() => current?.skip());

  const api: SceneParades = {
    async play(newcomer) {
      current?.skip();
      // Started while the app was hidden (the player left during the lead-in): it doesn't play unseen (D44 review).
      if (document.hidden) return false;
      const fig = host.el.querySelector<HTMLElement>('.sanctuary__scene');
      const svg = host.el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      if (!fig || !svg || !scope.alive) return false;
      host.closeTray();
      // Nobody wanders off or starts something else mid-dance.
      host.pause(true);
      const btn = () => host.el.querySelector<HTMLElement>('[data-act="parade-replay"]');
      const b0 = btn();
      if (b0) b0.hidden = true;
      const p = startParade({ svg, host: fig, camera: host.camera, newcomer, reducedMotion: host.reducedMotion() });
      current = p;
      await p.done;
      if (current === p) current = null;
      if (!scope.alive) return false;
      host.pause(false);
      if (!p.dancers.length) return false;
      // It grants nothing, so it can be played again as often as the player likes.
      replay = { newcomer };
      const b = btn();
      if (b) {
        b.hidden = false;
        b.innerHTML = `${REPLAY_ICON}${label()}`;
      }
      return true;
    },
    skip: () => current?.skip(),
    get active() {
      return !!current?.active;
    },
    replayMarkup: () => `<button class="scene-replay" data-act="parade-replay" ${replay ? '' : 'hidden'}>${REPLAY_ICON}${label()}</button>`,
    onClick(t) {
      if (t.closest('[data-act="parade-skip"]')) {
        current?.skip();
        return true;
      }
      if (t.closest('[data-act="parade-replay"]')) {
        void api.play(replay?.newcomer);
        return true;
      }
      // While a parade plays, the scene is its stage: taps wait (Skip ends it).
      return !!current?.active && !!t.closest('.sanctuary__scene, [data-act="tricks"]');
    },
  };
  return api;
}
