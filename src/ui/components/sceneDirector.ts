/**
 * The scene director (D45 PR A): one owner for a sanctuary scene's camera and for its ambient life.
 *
 * A scene has several cinematic moments that each want the camera and want everyone else to hold still: the Welcome
 * Parade, a trick's close-up, the guided tour, and (on the Farm) the 3D walk. Before this, each paused and resumed the
 * scene's ambient life by itself, so one moment ending could switch life back on under another that was still
 * running (a tour started during a close-up). Now:
 *
 *  - **Only one moment owns the camera.** `claim(kind)` ends every other moment first (each registers how to end).
 *  - **Pausing is a set of holds, not a switch.** `hold(kind, on)` adds or drops that moment's hold; ambient life runs
 *    only while nobody holds it and the app is showing. A moment ending drops only its own hold.
 *  - **Leaving ends everything together.** `cancelAll()` (the screen going, a re-render) ends every moment; the
 *    screen's own teardown then releases camera, audio and animation.
 *
 * D46 PR A: **what the player chose wins over what the game was about to start.** A screen starts some moments by
 * itself after a lead-in (the Welcome Parade after Meet, a new stage's dance), and the lead-in waits on the 3D toys.
 * Before, a Walk or a Tour started in that window was ended by the parade when it came. Now such a moment is
 * `pending(kind, missed)` from the start: any `claim()` (the player started something) or `cancelAll()` (a re-render,
 * leaving) before it `begin()`s drops it and calls `missed`, so the screen can offer it instead. A pending moment
 * holds nothing and owns nothing: it is only a promise to start if nothing else happens first.
 */

/** D47 PR 5: `photo`, photo mode, owns the camera too (the player framing a postcard). D48 PR B: `feed`, a meal. */
export type SceneAct = 'parade' | 'closeup' | 'tour' | 'walk' | 'photo' | 'feed';

/** Why a pending moment never started: the player started `by`, or everything was ended (`null`: a re-render, leaving). */
export type MissedBy = SceneAct | null;

export interface PendingMoment {
  /**
   * Call just before starting it. True if it may start (nothing took the scene since it was scheduled); it is then no
   * longer pending. False if it was missed or dropped: don't start it.
   */
  begin(): boolean;
  /** Gives it up quietly (no `missed` call): the screen decided not to start it. */
  drop(): void;
  /** Whether it is still waiting to start. */
  readonly waiting: boolean;
}

export interface SceneMoment {
  /** Ends it now, giving the camera back. Safe to call when it isn't running. */
  cancel(): void;
  /** Whether it is running. */
  active(): boolean;
}

export interface SceneDirector {
  register(kind: SceneAct, moment: SceneMoment): void;
  /** `kind` is about to take the camera: every other moment ends first. */
  claim(kind: SceneAct): void;
  /** Adds (or drops) `kind`'s hold on the scene's ambient life. */
  hold(kind: SceneAct, on: boolean): void;
  /** Which moment is running, if any. */
  readonly owner: SceneAct | null;
  /** Whether anything is holding ambient life still. */
  readonly paused: boolean;
  /** Applies the current state again (the app shown or hidden, a new scene drawn). */
  refresh(): void;
  /** Ends every moment (and drops every pending one, telling each it was missed). */
  cancelAll(): void;
  /**
   * A moment the screen will start by itself after a lead-in (D46 PR A). If the player starts anything first (a
   * `claim`), or everything is ended (`cancelAll`), it is missed: `missed(by)` is called once and `begin()` says no.
   */
  pending(kind: SceneAct, missed: (by: MissedBy) => void): PendingMoment;
  /** How many moments are waiting to start (tests and QA). */
  readonly waiting: number;
}

/** `apply(live)`: switch the scene's ambient life and activities on or off. */
export function createSceneDirector(apply: (live: boolean) => void): SceneDirector {
  const moments = new Map<SceneAct, SceneMoment>();
  const holds = new Set<SceneAct>();
  const refresh = () => apply(holds.size === 0 && !document.hidden);
  type Waiting = { kind: SceneAct; missed: (by: MissedBy) => void };
  const waiting = new Set<Waiting>();
  /** Everything waiting to start is missed: something else took the scene first (or the scene went). */
  const miss = (by: MissedBy) => {
    const now = [...waiting];
    waiting.clear();
    for (const w of now) w.missed(by);
  };
  return {
    register: (kind, m) => void moments.set(kind, m),
    claim(kind) {
      miss(kind);
      for (const [k, m] of moments) if (k !== kind) m.cancel();
    },
    hold(kind, on) {
      const had = holds.has(kind);
      if (on) holds.add(kind);
      else holds.delete(kind);
      if (had !== on) refresh();
    },
    get owner() {
      for (const [k, m] of moments) if (m.active()) return k;
      return null;
    },
    get paused() {
      return holds.size > 0;
    },
    refresh,
    cancelAll() {
      miss(null);
      for (const m of moments.values()) m.cancel();
    },
    pending(kind, missed) {
      const w: Waiting = { kind, missed };
      waiting.add(w);
      return {
        begin: () => waiting.delete(w),
        drop: () => void waiting.delete(w),
        get waiting() {
          return waiting.has(w);
        },
      };
    },
    get waiting() {
      return waiting.size;
    },
  };
}
