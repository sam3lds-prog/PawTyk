/**
 * Puts the 3D toys over a sanctuary scene (D34). The 3D code (three.js) loads only when a sanctuary is first opened;
 * until it arrives, and on devices without WebGL or with "3D animals" turned off, the drawn animals stay.
 */

import { app } from '../../app/app';
import type { SceneStage } from '../../three/stage';

export interface Scene3D {
  /** Binds to the (re-)rendered scene figure and its SVG. */
  attach(figure: HTMLElement | null, svg: SVGSVGElement | null): void;
  /** Settles true once the toys are showing, false if they won't (no WebGL, setting off, load failed). */
  readonly ready: Promise<boolean>;
  setLive(on: boolean): void;
  /** Frames the same part of the scene the camera shows (D44 PR C). Kept for a stage that is still loading. */
  setView(v: { x: number; y: number; w: number; h: number } | null): void;
  /**
   * Lets go of the WebGL context while something else draws in 3D over the scene (the Farm walk, D45 PR C): two
   * renderers at once is what a small phone can't afford. The drawn animals show meanwhile. `resume` builds the toys
   * again on the scene that is attached then.
   */
  suspend(): void;
  resume(): void;
  /** Whether a WebGL stage exists right now (tests and QA). */
  readonly drawing: boolean;
  dispose(): void;
}

let webgl: boolean | null = null;
/** Whether this device can draw WebGL (checked once). */
export function hasWebGL(): boolean {
  if (webgl !== null) return webgl;
  try {
    const c = document.createElement('canvas');
    const gl = (c.getContext('webgl2') ?? c.getContext('webgl')) as WebGLRenderingContext | null;
    webgl = !!gl;
    gl?.getExtension('WEBGL_lose_context')?.loseContext();
  } catch {
    webgl = false;
  }
  return webgl;
}

export function wants3D(): boolean {
  return app.settings.toys3d && hasWebGL();
}

let loading: Promise<typeof import('../../three/stage')> | null = null;

/** Dev only: the most recent live stage, for stepping clips frame by frame (`__stage3d.freezeAt`). */
const liveStages: SceneStage[] = [];
if (import.meta.env.DEV && typeof window !== 'undefined')
  Object.defineProperty(window, '__stage3d', { configurable: true, get: () => liveStages[liveStages.length - 1] ?? null });

/**
 * The 3D layer for one scene. Nothing is loaded and no WebGL context is made until it is attached to a scene (a locked
 * region never is).
 */
export function createScene3D(): Scene3D {
  let stage: SceneStage | null = null;
  let target: [HTMLElement, SVGSVGElement] | null = null;
  let live = !document.hidden;
  let view: { x: number; y: number; w: number; h: number } | null = null;
  let disposed = false;
  let started = false;
  let suspended = false;
  let settle: (ok: boolean) => void = () => {};
  const ready = new Promise<boolean>((r) => (settle = r));
  if (!wants3D()) settle(false);

  const start = () => {
    if (started || disposed || suspended || !wants3D()) return;
    started = true;
    loading ??= import('../../three/stage');
    loading
      .then((m) => {
        if (disposed) return settle(false);
        // The scene changed while three.js loaded (to one that stays drawn): make no stage (no WebGL context) until a
        // scene that wants toys attaches again (review of D39 PR E).
        // (Or the scene was suspended meanwhile: the stage is made on resume.)
        if (!target || suspended) {
          started = false;
          return;
        }
        stage = new m.SceneStage({ reducedMotion: () => app.reducedMotion });
        liveStages.push(stage);
        stage.setLive(live);
        if (target) {
          stage.attach(...target);
          stage.setView(view);
          settle(true);
        }
      })
      .catch(() => settle(false));
  };

  return {
    ready,
    attach(figure, svg) {
      target = figure && svg ? [figure, svg] : null;
      // A scene with an animal the toy builder can't make yet (a snake, a fish; D39 PR E) stays drawn, all of it.
      if (svg?.querySelector('[data-no-toy]')) {
        target = null;
        if (stage) {
          liveStages.splice(liveStages.indexOf(stage), 1);
          stage.dispose();
          stage = null;
          started = false;
        }
        settle(false);
        return;
      }
      if (!target) return;
      if (stage) {
        stage.attach(...target);
        settle(true);
      } else start();
    },
    setLive(on) {
      live = on;
      stage?.setLive(on);
    },
    setView(v) {
      view = v;
      stage?.setView(v);
    },
    suspend() {
      suspended = true;
      if (!stage) return;
      liveStages.splice(liveStages.indexOf(stage), 1);
      stage.dispose();
      stage = null;
      started = false;
    },
    resume() {
      if (!suspended) return;
      suspended = false;
      if (target && !stage) start();
    },
    get drawing() {
      return !!stage;
    },
    dispose() {
      disposed = true;
      settle(false);
      if (stage) liveStages.splice(liveStages.indexOf(stage), 1);
      stage?.dispose();
      stage = null;
    },
  };
}
