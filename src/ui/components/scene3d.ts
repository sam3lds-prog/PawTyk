/**
 * Puts the 3D toys over a sanctuary scene (D34). The 3D code (three.js) loads only when a sanctuary is first opened;
 * until it arrives, and on devices without WebGL or with "3D animals" turned off, the drawn animals stay.
 */

import { app } from '../../app/app';
import type { SceneStage } from '../../three/stage';

export interface Scene3D {
  /** Binds to the (re-)rendered scene figure and its SVG. */
  attach(figure: HTMLElement | null, svg: SVGSVGElement | null): void;
  /**
   * Whether the toys are showing, for the renderer there is now (D46 PR B): settles true once the current stage draws,
   * false if it won't (no WebGL, setting off, a scene that stays drawn, suspended, the context lost, load failed). Read
   * it when it is needed, not once: after a suspend or a lost context it is a new promise for the new renderer, so a
   * celebration started just after the walk closes waits for the toys being rebuilt instead of an old "yes".
   */
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
  /** Whether toys are on screen right now: a stage exists and its context is there (tests and QA). */
  readonly drawing: boolean;
  /** Where it is: `off` (stays drawn), `loading`, `drawing`, `suspended`, `lost` (context gone), `failed`. */
  readonly state: Scene3DState;
  dispose(): void;
}

export type Scene3DState = 'off' | 'loading' | 'drawing' | 'suspended' | 'lost' | 'failed' | 'disposed';

/** A lost context that hasn't come back after this long is given up on: the stage is rebuilt with a new one. */
export const LOST_REBUILD_MS = 3000;
/** How many times one scene rebuilds after lost contexts before it stays drawn. */
export const MAX_REBUILDS = 2;

/** Counts across every scene (tests and the QA page): renderers made and released, rebuilds, failures. */
const stats = { created: 0, disposed: 0, rebuilds: 0, failures: 0 };
export const scene3dStats = () => ({ ...stats, live: stats.created - stats.disposed });
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __scene3dStats?: unknown }).__scene3dStats = scene3dStats;

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
  /** Made (and failed) once: a stage whose constructor threw isn't tried again on this scene. */
  let failed = false;
  let rebuilds = 0;
  let lostTimer: ReturnType<typeof setTimeout> | null = null;
  /** Bumped whenever the renderer a load was for goes away (suspend, dispose, a new scene): a late load is dropped. */
  let epoch = 0;

  // Readiness, per renderer (D46 PR B): one promise per stretch of "will the toys show?". It settles once; a change
  // after that (suspended, lost, rebuilt) starts a new one, which is what `ready` hands out from then on.
  type Gen = { p: Promise<boolean>; settle: (v: boolean) => void; done: boolean; value?: boolean };
  const newGen = (): Gen => {
    const g = { done: false } as Gen;
    g.p = new Promise<boolean>((r) => (g.settle = (v) => {
      if (g.done) return;
      g.done = true;
      g.value = v;
      r(v);
    }));
    return g;
  };
  let gen = newGen();
  /** `null`: the toys are on their way (a new, unsettled promise). A boolean: they show, or they won't for now. */
  const become = (ok: boolean | null) => {
    if (ok === null) {
      if (gen.done) gen = newGen();
      return;
    }
    if (gen.done && gen.value !== ok) gen = newGen();
    gen.settle(ok);
  };

  const release = () => {
    if (lostTimer !== null) clearTimeout(lostTimer);
    lostTimer = null;
    if (!stage) return;
    const i = liveStages.indexOf(stage);
    if (i >= 0) liveStages.splice(i, 1);
    stage.dispose();
    stats.disposed++;
    stage = null;
  };

  /** The OS took the context back (D46 PR B): the drawn animals show; if it doesn't come back, rebuild. */
  const onContext = (drawing: boolean) => {
    if (disposed || suspended) return;
    if (drawing) {
      if (lostTimer !== null) clearTimeout(lostTimer);
      lostTimer = null;
      become(true);
      return;
    }
    become(false);
    if (lostTimer !== null) clearTimeout(lostTimer);
    lostTimer = setTimeout(() => {
      lostTimer = null;
      if (disposed || suspended || !stage?.contextLost) return;
      release();
      started = false;
      epoch++;
      if (rebuilds >= MAX_REBUILDS) {
        // Twice is enough: this scene stays drawn (the drawn animals do everything the toys do).
        failed = true;
        stats.failures++;
        return;
      }
      rebuilds++;
      stats.rebuilds++;
      if (target) {
        become(null);
        start();
      }
    }, LOST_REBUILD_MS);
  };

  const start = () => {
    if (started || disposed || suspended || failed || !wants3D()) return;
    started = true;
    become(null);
    const mine = ++epoch;
    loading ??= import('../../three/stage');
    loading
      .then((m) => {
        // Suspended, disposed or re-targeted while three.js loaded: this load is for a renderer that's gone.
        if (mine !== epoch || disposed) return;
        // The scene changed while three.js loaded (to one that stays drawn): make no stage (no WebGL context) until a
        // scene that wants toys attaches again (review of D39 PR E).
        if (!target || suspended) {
          started = false;
          become(false);
          return;
        }
        try {
          stage = new m.SceneStage({ reducedMotion: () => app.reducedMotion, onContext });
        } catch {
          // No context to be had (too many, or the GPU said no): the drawn scene it is, for this scene.
          failed = true;
          started = false;
          stats.failures++;
          become(false);
          return;
        }
        stats.created++;
        liveStages.push(stage);
        stage.setLive(live);
        stage.attach(...target);
        stage.setView(view);
        become(!stage.contextLost);
      })
      .catch(() => {
        if (mine !== epoch) return;
        started = false;
        // three.js didn't load (offline first launch, say): try again on the next attach.
        loading = null;
        become(false);
      });
  };

  if (!wants3D()) become(false);

  return {
    get ready() {
      return gen.p;
    },
    attach(figure, svg) {
      target = figure && svg ? [figure, svg] : null;
      // A scene with an animal the toy builder can't make yet (a snake, a fish; D39 PR E) stays drawn, all of it.
      if (svg?.querySelector('[data-no-toy]')) {
        target = null;
        release();
        started = false;
        epoch++;
        become(false);
        return;
      }
      if (!target) return;
      if (stage) {
        stage.attach(...target);
        become(!stage.contextLost);
      } else if (!wants3D() || failed) become(false);
      else start();
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
      if (disposed) return;
      suspended = true;
      release();
      started = false;
      epoch++;
      become(false);
    },
    resume() {
      if (!suspended || disposed) return;
      suspended = false;
      if (target && !stage && wants3D() && !failed) start();
    },
    get drawing() {
      return !!stage && !stage.contextLost;
    },
    get state(): Scene3DState {
      if (disposed) return 'disposed';
      if (suspended) return 'suspended';
      if (failed) return 'failed';
      if (stage) return stage.contextLost ? 'lost' : 'drawing';
      return started ? 'loading' : 'off';
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      epoch++;
      release();
      become(false);
    },
  };
}
