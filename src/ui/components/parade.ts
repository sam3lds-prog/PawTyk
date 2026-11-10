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
import { rhythmFor, scoreFor, type CueId } from '../../audio/scores';
import { animalInfo, isAnimalId } from '../../meta/animals';
import { planDance, startDance, type DanceHandle, type Dancer } from './dance';
import { clampView, scenePoint, viewAt, type SceneCamera, type View } from './camera';
import type { MissedBy, SceneDirector } from './sceneDirector';
import type { Scope } from '../router';

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
  /** The home it plays in (D45 PR D): each home's band plays the theme its own way. */
  home?: string;
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

/** The final pose's zoom: wide enough for the whole group, the lights above them and the confetti. */
const HERO_MAX_ZOOM = 1.22;

/**
 * The hero shot for the final pose (D45 PR D): wider than the dance's framing, with the dancers in the lower part of
 * the picture so the party lights and the confetti have the sky above them.
 */
export function heroView(full: View, dancers: Dancer[]): View {
  const pts = dancers.map((d) => scenePoint(d.fig)).filter((p): p is NonNullable<typeof p> => !!p);
  if (!pts.length) return full;
  const x0 = Math.min(...pts.map((p) => p.x - p.h));
  const x1 = Math.max(...pts.map((p) => p.x + p.h));
  const top = Math.min(...pts.map((p) => p.y - p.h * 2.6));
  const bottom = Math.max(...pts.map((p) => p.y + p.h * 0.6));
  const zoom = Math.min(HERO_MAX_ZOOM, full.w / Math.max(1, x1 - x0), full.h / Math.max(1, bottom - top));
  if (zoom <= 1.04) return full;
  // The ground line two thirds of the way down.
  const ground = Math.max(...pts.map((p) => p.y));
  return clampView(full, viewAt(full, (x0 + x1) / 2, ground - (full.h / zoom) * 0.17, zoom));
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
  let punchTimer: ReturnType<typeof setTimeout> | null = null;
  const dancers = score ? planDance(o.svg, { bpm: score.bpm, beats: score.beats, newcomer: o.newcomer }) : [];
  const lead = o.newcomer ? dancers.find((d) => d.spec.role === 'newcomer') : undefined;

  const end = (how: ParadeEnd) => {
    if (over) return;
    over = true;
    if (startTimer !== null) clearTimeout(startTimer);
    if (punchTimer !== null) clearTimeout(punchTimer);
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
    // The theme in this home's voicing, and (D45 PR D) the newcomer's own rhythm under its entrance.
    const lead_ = o.newcomer && isAnimalId(o.newcomer) ? rhythmFor(animalInfo(o.newcomer).animal) : undefined;
    pb = playCue(cue, { home: o.home, rhythm: lead_, rhythmSpan: score.sections?.intro ?? [0, Math.min(4, score.beats)] });
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
        // The final pose: out to the hero shot, with a small push as the poses land (D45 PR D).
        if (part === 'finish' && cam) {
          void cam.moveTo(heroView(cam.full, dancers), 420);
          cam.setOffset?.(0, 0, 1.035);
          punchTimer = setTimeout(() => cam.clearOffset?.(), 180);
        }
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
  /** The home's id (D45 PR D): its own voicing of the theme. */
  home?: string;
  /** Closes the trick tray, if open. */
  closeTray(): void;
  reducedMotion: () => boolean;
}

export interface SceneParades {
  /** Plays the parade (with a newcomer) or the group dance. Resolves true if anyone danced. */
  play(newcomer?: string, opts?: { short?: boolean }): Promise<boolean>;
  /**
   * Offers a celebration that never started (D46 PR A): the player began something else during its lead-in, or left.
   * The button under the scene says *Watch Truffle's welcome* (or *Celebrate the new stage*) and plays it in full.
   */
  offer(newcomer?: string): void;
  /** What the button under the scene offers now (tests and QA): `null` while it is hidden. */
  readonly offered: { newcomer?: string; unplayed: boolean } | null;
  skip(): void;
  readonly active: boolean;
  /** The Replay button, for the row under the scene (hidden until a parade has played). */
  replayMarkup(): string;
  /** A click on the screen: true if the parade handled it (Skip, Replay, or a tap on the scene while it plays). */
  onClick(t: HTMLElement): boolean;
}

const REPLAY_ICON = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5L8 5.5Z" fill="currentColor"/></svg>`;

/**
 * Welcomes that never played (D46 PR A), by home: the player left during the lead-in. Coming back offers it under
 * the scene. Kept for this session only; a welcome grants nothing, so nothing is lost if the app closes.
 */
const missedWelcomes = new Map<string, string>();
/** The newcomer whose welcome this home still owes, if any. */
export const missedWelcome = (home: string): string | undefined => missedWelcomes.get(home);

/** The label for a celebration the player hasn't seen yet. */
function unplayedLabel(newcomer?: string): string {
  if (!newcomer) return 'Celebrate the new stage';
  const name = isAnimalId(newcomer) ? animalInfo(newcomer).name : 'the newcomer';
  return `Watch ${name}’s welcome`;
}

/**
 * Parades on a sanctuary screen: Skip and Replay, Escape to skip, leaving the app ends it, and the scene is the
 * parade's stage while it plays (taps on it and the Tricks button wait).
 */
export function sceneParades(scope: { on(t: EventTarget, type: string, fn: (e: Event) => void): void; onDispose(fn: () => void): void; readonly alive: boolean }, host: SceneParadeHost): SceneParades {
  let current: ParadeHandle | null = null;
  let replay: { newcomer?: string; unplayed?: boolean } | null = null;
  /** The last one played was the short welcome: Replay offers the full parade by name. */
  let wasShort = false;
  const label = () => (replay?.unplayed ? unplayedLabel(replay.newcomer) : wasShort ? 'Play the full parade' : replay?.newcomer ? 'Replay the parade' : 'Dance again');
  const showButton = () => {
    const b = host.el.querySelector<HTMLElement>('[data-act="parade-replay"]');
    if (!b) return;
    b.hidden = !replay;
    b.innerHTML = `${REPLAY_ICON}${label()}`;
  };
  scope.on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && current?.active && !document.querySelector('.overlay')) current.skip();
  });
  scope.on(document, 'visibilitychange', () => {
    // Leaving the app ends it (its music stops on its own): nothing dances on, unseen.
    if (document.hidden) current?.skip();
  });
  scope.onDispose(() => current?.skip());

  const api: SceneParades = {
    async play(newcomer, opts = {}) {
      current?.skip();
      // Started while the app was hidden (the player left during the lead-in): it doesn't play unseen (D44 review).
      if (document.hidden) return false;
      const fig = host.el.querySelector<HTMLElement>('.sanctuary__scene');
      const svg = host.el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      if (!fig || !svg || !scope.alive) return false;
      host.closeTray();
      // This home's welcome is being seen now (D46 PR A): nothing is owed any more.
      if (newcomer && host.home && missedWelcomes.get(host.home) === newcomer) missedWelcomes.delete(host.home);
      // Nobody wanders off or starts something else mid-dance.
      host.pause(true);
      const btn = () => host.el.querySelector<HTMLElement>('[data-act="parade-replay"]');
      const b0 = btn();
      if (b0) b0.hidden = true;
      // The short welcome (D45 PR B): the same parade to the shorter Barnyard Jig. Replay plays the full one.
      const p = startParade({ svg, host: fig, camera: host.camera, newcomer, reducedMotion: host.reducedMotion(), cue: newcomer && opts.short ? 'jig' : undefined, home: host.home });
      current = p;
      await p.done;
      // Replayed before it ended: the newer parade owns the scene's pause now, so this one leaves it be (D45 PR A).
      if (current !== p) return false;
      current = null;
      if (!scope.alive) return false;
      host.pause(false);
      if (!p.dancers.length) return false;
      // It grants nothing, so it can be played again as often as the player likes.
      replay = { newcomer };
      wasShort = !!opts.short && !!newcomer;
      showButton();
      return true;
    },
    offer(newcomer) {
      // A welcome is owed until it is watched, here or on the next visit.
      if (newcomer && host.home) missedWelcomes.set(host.home, newcomer);
      replay = { newcomer, unplayed: true };
      wasShort = false;
      showButton();
    },
    get offered() {
      return replay ? { newcomer: replay.newcomer, unplayed: !!replay.unplayed } : null;
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

export interface ScheduledParade {
  /** The player missed it (they started something else, or a re-render ended everything) and it was offered instead. */
  readonly missed: MissedBy | 'hidden' | undefined;
  /** Whether it is still waiting for its lead-in. */
  readonly waiting: boolean;
}

/**
 * A celebration the screen starts by itself (D46 PR A): the Welcome Parade straight from Meet, or a new stage's group
 * dance. It waits `delay`, then (briefly) for `waitFor` (the 3D toys), and plays, unless in the meantime the player
 * started something (Walk, Tour, a trick: what they chose is kept), the scene was re-drawn, the app was hidden or the
 * screen went. Then it never starts by itself: the button under the scene offers it (and a welcome missed by leaving
 * is offered on the next visit). Either way `after` runs once the scene is free (no moment owns the camera): the next
 * goal and the starter gift, which must never cover a walk or a tour.
 */
export function scheduleParade(
  scope: Scope,
  director: SceneDirector,
  parades: SceneParades,
  o: { newcomer?: string; delay: number; waitFor?: () => Promise<unknown>; short?: boolean; after?: (played: boolean) => void },
): ScheduledParade {
  let missed: MissedBy | 'hidden' | undefined;
  let finished = false;
  const done = (played: boolean) => {
    if (finished || !scope.alive) return;
    finished = true;
    if (played) return o.after?.(true);
    // Once nothing owns the camera: a walk closed, a tour or a trick over. Checked from the next tick on: the moment
    // that missed it claims the scene before it starts running.
    // One timer at a time (review: scope.timeout would add a disposer every 250 ms of a long walk).
    let t: ReturnType<typeof setTimeout> | undefined;
    scope.onDispose(() => clearTimeout(t));
    const whenFree = () => {
      if (!scope.alive) return;
      if (director.owner === null) o.after?.(false);
      else t = setTimeout(whenFree, 250);
    };
    t = setTimeout(whenFree, 250);
  };
  const onMissed = (by: MissedBy | 'hidden') => {
    missed = by;
    // Left during the lead-in: the next visit offers it (a welcome only; a stage's dance is just a moment).
    if (!scope.alive) {
      if (o.newcomer) parades.offer(o.newcomer);
      return;
    }
    parades.offer(o.newcomer);
    done(false);
  };
  const pend = director.pending('parade', onMissed);
  scope.timeout(
    () =>
      void (o.waitFor?.() ?? Promise.resolve()).then(async () => {
        if (!scope.alive || !pend.waiting) return;
        // The player left the app during the lead-in: it doesn't play unseen; it's offered for when they're back.
        if (document.hidden) {
          pend.drop();
          onMissed('hidden');
          return;
        }
        if (!pend.begin()) return;
        const danced = await parades.play(o.newcomer, { short: o.short });
        done(danced);
      }),
    o.delay,
  );
  return {
    get missed() {
      return missed;
    },
    get waiting() {
      return pend.waiting;
    },
  };
}
