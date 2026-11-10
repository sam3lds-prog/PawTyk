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
 */

export type SceneAct = 'parade' | 'closeup' | 'tour' | 'walk';

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
  /** Ends every moment. */
  cancelAll(): void;
}

/** `apply(live)`: switch the scene's ambient life and activities on or off. */
export function createSceneDirector(apply: (live: boolean) => void): SceneDirector {
  const moments = new Map<SceneAct, SceneMoment>();
  const holds = new Set<SceneAct>();
  const refresh = () => apply(holds.size === 0 && !document.hidden);
  return {
    register: (kind, m) => void moments.set(kind, m),
    claim(kind) {
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
      for (const m of moments.values()) m.cancel();
    },
  };
}
