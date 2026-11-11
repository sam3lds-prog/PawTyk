/**
 * Animal moments in a home's scene (D49 PR C; what they are: `meta/moments.ts`).
 *
 * Occasional, never constant: the first comes after the scene has been calm for a while (`MOMENT_FIRST_MS`), the
 * next one or two a good half-minute later, and a visit has at most `MOMENT_MAX`. One at a time, only while nothing
 * else is happening: no parade, tour, close-up, walk, meal, photo, try-on or open trick tray, the app showing, motion
 * allowed. It never claims the camera or holds anything (the scene director's `moment`): anything the player starts
 * ends it at once. Its line borrows the one under the scene, with **New** the first time a player sees that moment.
 * Played with the same tricks and emotes as the tray, so the drawn animals and the 3D toys both do it. Nothing is
 * granted.
 */

import { app } from '../../app/app';
import { MOMENT_BY_ID, noteMoment, pickMoment, seenMoments, type MomentCast, type MomentId, type MomentPick } from '../../meta/moments';
import { temperamentOf } from '../../meta/temperament';
import { track } from '../../services/analytics';
import { animalName } from './activities';
import type { SceneDirector } from './sceneDirector';
import { startTrick, type TrickHandle } from './trickPlay';

/** The first moment of a visit waits this long after the scene settles. */
export const MOMENT_FIRST_MS = 14_000;
/** Then one every so often (a random gap in this range). */
export const MOMENT_GAP_MS: readonly [number, number] = [32_000, 52_000];
/** When the scene is busy at the planned time, it looks again this much later (without counting a moment). */
export const MOMENT_RETRY_MS = 5_000;
/** At most this many in one visit. */
export const MOMENT_MAX = 4;
/** A two-animal moment's answer comes this long after the first animal starts. */
const ANSWER_MS = 450;
/** How long the line under the scene says what happened. */
const LINE_MS = 3_200;

/** The bodies that do the tray's tricks the ordinary way (a fish, a frog or a crab sits these out). */
const DOES_TRICKS = /^(sit|big|tall|upright|bird|wader)$/;

export interface MomentHost {
  svg: () => SVGSVGElement | null;
  /** The line under the scene (`[data-chat]`), borrowed for a moment. */
  chat: () => HTMLElement | null;
  director: SceneDirector;
  reducedMotion: () => boolean;
  /** Something the screen itself is doing that the director doesn't know of (a try-on, the trick tray, a sheet). */
  busy: () => boolean;
  rand?: () => number;
}

export interface SceneMoments {
  /** Plays a moment now, if the scene is free (tests and the tester shortcut). */
  playNow(id?: MomentId): MomentPick | null;
  /** How many this visit has played. */
  readonly played: number;
  readonly active: boolean;
  dispose(): void;
}

/** Tester shortcut: the next home visited plays its first moment after a couple of seconds (one visit only). */
let soon = false;
export function requestMomentSoon(): void {
  soon = true;
}
/** How soon a tester's requested moment comes. */
export const MOMENT_SOON_MS = 2_500;

export function sceneMoments(host: MomentHost): SceneMoments {
  const rand = host.rand ?? Math.random;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let running: TrickHandle[] = [];
  let lineTimer: ReturnType<typeof setTimeout> | undefined;
  let played = 0;
  let last: { moment: MomentId; who: string } | undefined;
  let disposed = false;

  const active = () => running.some((r) => r.active);
  const restoreLine = (span: Element | null, base: string, chat: HTMLElement | null) => {
    if (!chat || !span) return;
    span.textContent = base;
    chat.hidden = !base;
    chat.classList.remove('is-activity', 'is-moment');
    chat.querySelector('.moment-new')?.remove();
  };
  let restore: (() => void) | null = null;
  const stop = () => {
    const now = running;
    running = [];
    for (const r of now) r.stop();
    if (lineTimer) clearTimeout(lineTimer);
    restore?.();
    restore = null;
  };
  host.director.register('moment', { cancel: stop, active });

  const free = () => !disposed && !document.hidden && !host.reducedMotion() && host.director.owner === null && !host.director.paused && !host.busy();

  function cast(svg: SVGSVGElement): Array<MomentCast & { fig: SVGGElement }> {
    return [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet:not([data-trick]):not(.is-away)')]
      .filter((g) => !g.dataset.kit || DOES_TRICKS.test(g.dataset.kit))
      .map((g) => {
        const id = g.dataset.pet ?? g.dataset.friend ?? '';
        return { id, name: animalName(id), temper: temperamentOf(id), x: Number(g.dataset.gx) || 0, y: Number(g.dataset.gy) || 0, fig: g };
      })
      .filter((c) => c.id);
  }

  function play(only?: MomentId): MomentPick | null {
    const svg = host.svg();
    if (!svg || !free() || played >= MOMENT_MAX) return null;
    const who = cast(svg);
    const pick = only
      ? pickMoment(who, { seen: new Set(Object.keys(MOMENT_BY_ID).filter((k) => k !== only)), last, rand })
      : pickMoment(who, { seen: seenMoments(app.save), last, rand });
    if (!pick) return null;
    const a = who.find((c) => c.id === pick.who.id)!.fig;
    const first = startTrick(svg, a, pick.moment.trick, false);
    if (!first) return null;
    running = [first];
    if (pick.with && pick.moment.answer) {
      const b = who.find((c) => c.id === pick.with!.id)?.fig;
      const answer = pick.moment.answer;
      const t = setTimeout(() => {
        if (disposed || !running.includes(first) || !b) return;
        const h = startTrick(svg, b, answer, false);
        if (h) running = [...running, h];
      }, ANSWER_MS);
      running.push({ stop: () => clearTimeout(t), active: false });
    }
    played++;
    last = { moment: pick.moment.id, who: pick.who.id };
    const isNew = noteMoment(app.save, pick.moment.id);
    if (isNew) app.persist();
    track('animal_moment', { moment: pick.moment.id, first: isNew });
    // The line under the scene says it (New the first time), then gives the small talk back.
    const chat = host.chat();
    const span = chat?.querySelector('span') ?? null;
    if (chat && span) {
      const base = span.textContent ?? '';
      span.textContent = pick.moment.line(pick.who.name, pick.with?.name);
      chat.hidden = false;
      chat.classList.add('is-activity', 'is-moment');
      if (isNew) chat.insertAdjacentHTML('beforeend', '<b class="moment-new">New</b>');
      restore = () => restoreLine(span, base, chat);
      lineTimer = setTimeout(() => {
        restore?.();
        restore = null;
      }, LINE_MS);
    }
    return pick;
  }

  function schedule(ms: number): void {
    if (disposed) return;
    clearTimeout(timer);
    timer = setTimeout(() => {
      if (played >= MOMENT_MAX) return;
      if (!free()) return schedule(MOMENT_RETRY_MS);
      play();
      schedule(MOMENT_GAP_MS[0] + rand() * (MOMENT_GAP_MS[1] - MOMENT_GAP_MS[0]));
    }, ms);
  }
  schedule(soon ? MOMENT_SOON_MS : MOMENT_FIRST_MS);
  soon = false;

  return {
    playNow: (id) => play(id),
    get played() {
      return played;
    },
    get active() {
      return active();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      stop();
    },
  };
}
