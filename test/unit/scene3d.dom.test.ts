// @vitest-environment happy-dom
/**
 * D46 PR B: the scene's 3D layer, renderer by renderer. `ready` answers for the renderer there is now: after a suspend
 * (the walk) or a lost context it is a new promise, so a celebration started just after the walk closes waits for the
 * toys being rebuilt instead of the first renderer's old "yes". Repeated suspend/resume leaves one renderer; a lost
 * context that doesn't come back is rebuilt (twice at most); a renderer that can't be made leaves the drawn scene.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const made = vi.hoisted(() => ({ list: [] as FakeStage[], throwNext: 0 }));
interface FakeStage {
  contextLost: boolean;
  disposed: boolean;
  attached: number;
  live: boolean;
  lose(): void;
  restore(): void;
}

vi.mock('../../src/three/stage', () => ({
  SceneStage: class {
    contextLost = false;
    disposed = false;
    attached = 0;
    live = true;
    private onContext?: (d: boolean) => void;
    constructor(o: { onContext?: (d: boolean) => void }) {
      if (made.throwNext > 0) {
        made.throwNext--;
        throw new Error('no WebGL context');
      }
      this.onContext = o.onContext;
      made.list.push(this as unknown as FakeStage);
    }
    attach() {
      this.attached++;
    }
    setLive(on: boolean) {
      this.live = on;
    }
    setView() {}
    dispose() {
      this.disposed = true;
    }
    lose() {
      this.contextLost = true;
      this.onContext?.(false);
    }
    restore() {
      this.contextLost = false;
      this.onContext?.(true);
    }
  },
}));

// A device that can draw WebGL (checked once, before the module caches it).
HTMLCanvasElement.prototype.getContext = (() => ({ getExtension: () => null })) as unknown as HTMLCanvasElement['getContext'];

import { app } from '../../src/app/app';
import { createScene3D, LOST_REBUILD_MS, MAX_REBUILDS, scene3dStats, STEADY_MS, type Scene3D } from '../../src/ui/components/scene3d';

/** Settles pending microtasks and the dynamic import. */
const flush = async () => {
  await vi.dynamicImportSettled();
  for (let i = 0; i < 8; i++) await Promise.resolve();
};

/** Whether a promise has settled yet, and to what. */
async function peek<T>(p: Promise<T>): Promise<{ settled: boolean; value?: T }> {
  const marker = Symbol('pending');
  const v = await Promise.race([p, Promise.resolve(marker)]);
  return v === marker ? { settled: false } : { settled: true, value: v as T };
}

function scene(noToy = false) {
  const fig = document.createElement('figure');
  fig.innerHTML = `<svg viewBox="0 0 360 300">${noToy ? '<g data-no-toy></g>' : '<g class="sanctuary__pet"></g>'}</svg>`;
  document.body.appendChild(fig);
  return { fig, svg: fig.querySelector('svg')! };
}

let s3d: Scene3D;
beforeEach(() => {
  made.list.length = 0;
  made.throwNext = 0;
  app.save.settings.toys3d = true;
});
afterEach(() => {
  s3d?.dispose();
  vi.useRealTimers();
  document.body.innerHTML = '';
});

describe('the scene’s 3D layer, renderer by renderer (D46 PR B)', () => {
  it('ready settles true once the stage draws, and is a new promise after a suspend: false while the walk is open', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    expect(s3d.state).toBe('loading');
    await flush();
    expect(await s3d.ready).toBe(true);
    expect(s3d.drawing).toBe(true);
    const first = s3d.ready;
    s3d.suspend();
    expect(s3d.state).toBe('suspended');
    expect(s3d.ready).not.toBe(first);
    expect(await s3d.ready).toBe(false);
    expect(made.list[0].disposed).toBe(true);
  });

  it('the bug: just after resume, ready is still on its way (not the first renderer’s old yes), then true', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    s3d.suspend();
    s3d.resume();
    // The replacement is loading: a parade asking now must wait, not get the original renderer's "true".
    expect(s3d.state).toBe('loading');
    expect((await peek(s3d.ready)).settled).toBe(false);
    await flush();
    expect(await peek(s3d.ready)).toEqual({ settled: true, value: true });
    expect(made.list.length).toBe(2);
  });

  it('repeated walk → overview leaves exactly one renderer, every earlier one released', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    const before = scene3dStats();
    for (let i = 0; i < 8; i++) {
      s3d.suspend();
      s3d.resume();
      await flush();
      expect(await s3d.ready).toBe(true);
    }
    expect(made.list.filter((s) => !s.disposed).length).toBe(1);
    const after = scene3dStats();
    expect(after.created - before.created).toBe(8);
    expect(after.disposed - before.disposed).toBe(8);
  });

  it('suspend and resume while three.js is still loading: one renderer, made for the resumed scene', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    s3d.suspend();
    s3d.resume();
    s3d.suspend();
    await flush();
    expect(made.list.length).toBe(0);
    s3d.resume();
    await flush();
    expect(made.list.length).toBe(1);
    expect(await s3d.ready).toBe(true);
  });

  it('a lost context: ready says false at once; when it comes back, true again', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    made.list[0].lose();
    expect(s3d.state).toBe('lost');
    expect(s3d.drawing).toBe(false);
    expect(await s3d.ready).toBe(false);
    made.list[0].restore();
    expect(await s3d.ready).toBe(true);
    expect(s3d.state).toBe('drawing');
  });

  it('a context that doesn’t come back is rebuilt with a new one; after two rebuilds the scene stays drawn', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    for (let i = 0; i < MAX_REBUILDS; i++) {
      made.list[made.list.length - 1].lose();
      vi.advanceTimersByTime(LOST_REBUILD_MS);
      expect(made.list[made.list.length - 1].disposed).toBe(true);
      await flush();
      expect(await s3d.ready).toBe(true);
    }
    expect(made.list.length).toBe(MAX_REBUILDS + 1);
    made.list[made.list.length - 1].lose();
    vi.advanceTimersByTime(LOST_REBUILD_MS);
    await flush();
    expect(s3d.state).toBe('failed');
    expect(await s3d.ready).toBe(false);
    // A re-render doesn't try again on this scene.
    s3d.attach(fig, svg);
    await flush();
    expect(made.list.length).toBe(MAX_REBUILDS + 1);
  });

  it('review: lost while the app is away, it rebuilds only once the app is back; 3D turned off meanwhile → ready false', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const hide = (on: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    hide(true);
    made.list[0].lose();
    vi.advanceTimersByTime(LOST_REBUILD_MS * 3);
    expect(made.list[0].disposed).toBe(false);
    expect(s3d.state).toBe('lost');
    // Back, and 3D was turned off while away: no new renderer, and ready says so (it used to stay pending).
    app.save.settings.toys3d = false;
    hide(false);
    document.dispatchEvent(new Event('visibilitychange'));
    vi.advanceTimersByTime(600);
    await flush();
    expect(made.list.length).toBe(1);
    expect(await peek(s3d.ready)).toEqual({ settled: true, value: false });
  });

  it('review: a rebuilt renderer that keeps drawing earns the rebuild budget back', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < MAX_REBUILDS; i++) {
        made.list[made.list.length - 1].lose();
        vi.advanceTimersByTime(LOST_REBUILD_MS);
        await flush();
      }
      expect(s3d.state).toBe('drawing');
      vi.advanceTimersByTime(STEADY_MS);
    }
    expect(made.list.length).toBe(1 + 3 * MAX_REBUILDS);
  });

  it('a context that comes back in time is kept (no rebuild)', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    made.list[0].lose();
    vi.advanceTimersByTime(LOST_REBUILD_MS - 500);
    made.list[0].restore();
    vi.advanceTimersByTime(LOST_REBUILD_MS);
    await flush();
    expect(made.list.length).toBe(1);
    expect(s3d.state).toBe('drawing');
  });

  it('a renderer that can’t be made: the drawn scene, ready false, and no retry loop', async () => {
    made.throwNext = 5;
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    expect(s3d.state).toBe('failed');
    expect(await s3d.ready).toBe(false);
    s3d.suspend();
    s3d.resume();
    s3d.attach(fig, svg);
    await flush();
    expect(made.throwNext).toBe(4);
  });

  it('a scene that stays drawn (a snake, a fish): ready false and no renderer; a later toy scene gets one', async () => {
    s3d = createScene3D();
    const drawn = scene(true);
    s3d.attach(drawn.fig, drawn.svg);
    await flush();
    expect(await s3d.ready).toBe(false);
    expect(made.list.length).toBe(0);
    const toys = scene();
    s3d.attach(toys.fig, toys.svg);
    await flush();
    expect(await s3d.ready).toBe(true);
  });

  it('3D off: ready is false at once and nothing loads', async () => {
    app.save.settings.toys3d = false;
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    await flush();
    expect(await s3d.ready).toBe(false);
    expect(made.list.length).toBe(0);
    expect(s3d.state).toBe('off');
  });

  it('disposed while loading: no renderer is made, ready false', async () => {
    s3d = createScene3D();
    const { fig, svg } = scene();
    s3d.attach(fig, svg);
    const p = s3d.ready;
    s3d.dispose();
    await flush();
    expect(made.list.length).toBe(0);
    expect(await p).toBe(false);
  });
});
