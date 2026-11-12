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
import { pickGreeting, type GreetCast, type Greeting } from '../../meta/greeting';
import { temperamentOf } from '../../meta/temperament';
import { isAnimalId, type AnimalId } from '../../meta/animals';
import { nextUnlock } from '../../meta/bonds';
import { localDateKey } from '../../game/dates';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { animalName } from './activities';
import { helloOf } from './hello';
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
/**
 * D50 PR B: the hello at the start of a calm visit comes this long after the scene settles (after everyone's small
 * arrival hop), and is given up if the scene isn't free by `GREET_WINDOW_MS` (it belongs to the start of a visit).
 */
export const GREET_AFTER_MS = 2_000;
export const GREET_WINDOW_MS = 6_000;
/** How often it looks again inside that window while the scene is busy. */
const GREET_RETRY_MS = 700;
/** A home says hello at most once in this long (per app run), so walking between screens doesn't repeat it. */
export const GREET_COOLDOWN_MS = 3 * 60_000;
/** "Just solved": a win this recent is what the hello is about. */
export const GREET_SOLVED_MS = 3 * 60_000;
/** A two-animal moment's answer comes this long after the first animal starts. */
const ANSWER_MS = 450;
/** How long the line under the scene says what happened. */
const LINE_MS = 3_200;

/** The bodies that do the tray's tricks the ordinary way (a fish, a frog or a crab sits these out). */
const DOES_TRICKS = /^(sit|big|tall|upright|bird|wader)$/;

/** D50 PR B: what a home gives its hello at the start of a visit. */
export interface GreetHost {
  /** The home (for the once-in-a-while rule). */
  home: string;
  evening: () => boolean;
  /** Something of the visit's own is the moment now (a newcomer's welcome card): no hello on top of it. */
  welcoming?: () => boolean;
}

export interface MomentHost {
  svg: () => SVGSVGElement | null;
  /** The line under the scene (`[data-chat]`), borrowed for a moment. */
  chat: () => HTMLElement | null;
  director: SceneDirector;
  reducedMotion: () => boolean;
  /** Something the screen itself is doing that the director doesn't know of (a try-on, the trick tray, a sheet). */
  busy: () => boolean;
  rand?: () => number;
  /** D50 PR B: say hello at the start of the visit (homes the player lives with; not a locked place). */
  greet?: GreetHost;
}

export interface SceneMoments {
  /** Plays a moment now, if the scene is free (tests and the tester shortcut). */
  playNow(id?: MomentId): MomentPick | null;
  /** How many this visit has played. */
  readonly played: number;
  /** D50 PR B: the hello this visit gave, if any (tests and QA). */
  readonly greeting: Greeting | null;
  readonly active: boolean;
  dispose(): void;
}

/**
 * Moments can be switched off for a whole app run (browser checks that need a scene to stay exactly at rest for a
 * long time, e.g. D46's acceptance matrix). On unless a test says otherwise; not a player setting.
 */
let enabled = true;
export function setMomentsEnabled(on: boolean): void {
  enabled = on;
}

/** Tester shortcut: the next home visited plays its first moment after a couple of seconds (one visit only). */
let soon = false;
export function requestMomentSoon(): void {
  soon = true;
}
/** How soon a tester's requested moment comes. */
export const MOMENT_SOON_MS = 2_500;

/** D50 PR B: when each home last said hello, and who (this app run only: nothing is saved). */
const greeted = new Map<string, number>();
let lastGreeter: string | undefined;
let greetTurn = 0;
/** Tests and the tester shortcut: every home may say hello again on the next visit. */
export function forgetGreetings(): void {
  greeted.clear();
  lastGreeter = undefined;
  greetTurn = 0;
}
/** Whether a home said hello within the cooldown (tests and QA). */
export function greetedRecently(home: string, now = Date.now()): boolean {
  const at = greeted.get(home);
  return at !== undefined && now - at < GREET_COOLDOWN_MS;
}

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
    chat.classList.remove('is-activity', 'is-moment', 'is-greeting');
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

  // (Not while the visit's hello, D50 PR B, is still playing: one animal at a time.)
  const free = () => enabled && !disposed && !document.hidden && !host.reducedMotion() && host.director.owner === null && !host.director.paused && !host.busy() && !active();
  /**
   * D50 PR B: free for the visit's hello: as for a moment, and nothing waiting to start (a welcome's or a new stage's
   * lead-in). Under reduced motion it still comes, as a still emote and its line.
   */
  const freeToGreet = () => enabled && !disposed && !document.hidden && host.director.owner === null && !host.director.paused && host.director.waiting === 0 && !host.busy() && !active();
  let greeting: Greeting | null = null;

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
    say(pick.moment.line(pick.who.name, pick.with?.name), 'is-moment', isNew);
    return pick;
  }

  /** The line under the scene says what happened (New the first time), then gives the small talk back. */
  function say(text: string, kind: 'is-moment' | 'is-greeting', isNew = false): void {
    const chat = host.chat();
    const span = chat?.querySelector('span') ?? null;
    if (!chat || !span) return;
    if (lineTimer) clearTimeout(lineTimer);
    restore?.();
    const base = span.textContent ?? '';
    span.textContent = text;
    chat.hidden = false;
    chat.classList.add('is-activity', kind);
    if (isNew) chat.insertAdjacentHTML('beforeend', '<b class="moment-new">New</b>');
    restore = () => restoreLine(span, base, chat);
    lineTimer = setTimeout(() => {
      restore?.();
      restore = null;
    }, LINE_MS);
  }

  /** D50 PR B: who could come and say hello (the moment cast, with what the hello is about for each). */
  function greetCast(svg: SVGSVGElement): Array<GreetCast & { fig: SVGGElement }> {
    const today = localDateKey();
    return cast(svg).map((c) => {
      const inv = app.save.inventory;
      const since = isAnimalId(c.id) ? (inv.companions[c.id]?.unlockedAt ?? inv.pets[c.id]?.unlockedAt) : undefined;
      return {
        id: c.id,
        name: c.name,
        temper: c.temper,
        ...(since ? { since } : {}),
        greetedToday: app.save.sanctuary.greeted[c.id] === today,
        heartsToNext: isAnimalId(c.id) ? (nextUnlock(app.save, c.id as AnimalId)?.hearts ?? null) : null,
        fig: c.fig,
      };
    });
  }

  /** D50 PR B: the hello at the start of the visit, if the scene is free and this home hasn't said one lately. */
  function greet(): Greeting | null {
    const g = host.greet;
    const svg = host.svg();
    if (!g || !svg || greeting || greetedRecently(g.home) || !freeToGreet() || g.welcoming?.()) return null;
    const who = greetCast(svg);
    const lastWin = app.save.stats.lastWin;
    const justSolved = !!lastWin && Date.now() - Date.parse(lastWin.at) < GREET_SOLVED_MS;
    const pick = pickGreeting(who, { now: new Date(), evening: g.evening(), justSolved, last: lastGreeter, turn: greetTurn });
    if (!pick) return null;
    const fig = who.find((c) => c.id === pick.who.id)!.fig;
    const h = startTrick(svg, fig, pick.trick, host.reducedMotion());
    if (!h) return null;
    running = [h];
    greeting = pick;
    greeted.set(g.home, Date.now());
    lastGreeter = pick.who.id;
    greetTurn++;
    // Its own little hello sound (no haptic: the player didn't touch anything).
    if (isAnimalId(pick.who.id)) sfx('hello', helloOf(pick.who.id as AnimalId));
    track('animal_greeting', { reason: pick.reason, home: g.home });
    say(pick.line, 'is-greeting');
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
  // A tester's requested moment is this visit's (no hello in front of it).
  const asked = soon;
  schedule(soon ? MOMENT_SOON_MS : MOMENT_FIRST_MS);
  soon = false;
  // D50 PR B: a hello near the start of the visit, if the scene is calm then (else, a few more looks, then not at all).
  let greetTimer: ReturnType<typeof setTimeout> | undefined;
  if (host.greet && !asked) {
    const started = Date.now();
    const tryGreet = () => {
      if (disposed || greeting || Date.now() - started > GREET_WINDOW_MS) return;
      if (!greet()) greetTimer = setTimeout(tryGreet, GREET_RETRY_MS);
    };
    greetTimer = setTimeout(tryGreet, GREET_AFTER_MS);
  }

  return {
    playNow: (id) => play(id),
    get played() {
      return played;
    },
    get greeting() {
      return greeting;
    },
    get active() {
      return active();
    },
    dispose() {
      disposed = true;
      clearTimeout(timer);
      clearTimeout(greetTimer);
      stop();
    },
  };
}
