// @vitest-environment happy-dom
/**
 * D44 PR F: trick close-ups. Selecting an animal moves nothing; a trick brings the camera in (0.4 s), holds while it
 * performs, and gives the whole scene back (0.5 s). Each kind of trick has its own shot (a beat-synced dance, a
 * face close-up for a giggle, a pull-out for a backflip, a slow push-in for sleepy, a wide rainbow, a party that takes
 * in the neighbours, who join in); the scene quiets meanwhile and the nearest animals react. Reduced motion: none.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CLOSEUP_IN_MS, CLOSEUP_OUT_MS, DEFAULT_SHOT, framing, nearbyFigures, sceneCloseUps, shotFor, TRICK_SHOTS } from '../../src/ui/components/closeup';
import { viewAt, type SceneCamera, type View } from '../../src/ui/components/camera';
import { TRICK_BY_ID, TRICKS, type TrickId } from '../../src/meta/catalogs/tricks';

const FULL: View = { x: 0, y: 0, w: 360, h: 300 };

function scene(): SVGSVGElement {
  document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
    <g class="sanctuary__pet" data-friend="cotton" data-gx="80" data-gy="230" data-gh="40"></g>
    <g class="sanctuary__pet" data-friend="truffle" data-gx="150" data-gy="240" data-gh="34"></g>
    <g class="sanctuary__pet" data-friend="juniper" data-gx="200" data-gy="236" data-gh="30"></g>
    <g class="sanctuary__pet" data-friend="hazel" data-gx="340" data-gy="150" data-gh="30"></g>
  </svg></figure>`;
  return document.querySelector('svg')!;
}

function rig(reduced = false) {
  const svg = scene();
  const moves: Array<{ v: View; ms: number }> = [];
  const offsets: number[] = [];
  const resets: number[] = [];
  const cam = {
    full: FULL,
    viewOf: (el: Element, zoom: number, o: { dy?: number } = {}) => {
      const g = el as SVGGElement;
      return viewAt(FULL, Number(g.dataset.gx), Number(g.dataset.gy) - Number(g.dataset.gh) * 0.45 + (o.dy ?? 0), zoom);
    },
    moveTo: vi.fn(async (v: View, ms: number) => (moves.push({ v, ms }), true)),
    reset: vi.fn(async (ms: number) => (resets.push(ms), true)),
    setOffset: vi.fn((_dx: number, _dy: number, z: number) => offsets.push(z)),
    clearOffset: vi.fn(),
  } as unknown as SceneCamera;
  const pause = vi.fn();
  const react = vi.fn();
  const c = sceneCloseUps({
    host: () => document.querySelector<HTMLElement>('.sanctuary__scene'),
    svg: () => svg,
    camera: cam,
    reducedMotion: () => reduced,
    pause,
    react,
  });
  const fig = (id: string) => svg.querySelector<SVGGElement>(`[data-friend="${id}"]`)!;
  const host = () => document.querySelector<HTMLElement>('.sanctuary__scene')!;
  return { svg, c, cam, moves, offsets, resets, pause, react, fig, host };
}
const zoomOf = (v: View) => FULL.w / v.w;

beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('the shots', () => {
  it('the six named tricks have shots of their own; every other trick gets the 2× close-up', () => {
    expect(Object.keys(TRICK_SHOTS).sort()).toEqual(['backflip', 'dance', 'laugh', 'party', 'rainbow', 'sleepy']);
    expect(shotFor('wave')).toBe(DEFAULT_SHOT);
    expect(DEFAULT_SHOT.zoom).toBe(2);
    expect(shotFor('laugh').zoom).toBeGreaterThan(DEFAULT_SHOT.zoom);
    expect(shotFor('rainbow').zoom).toBeLessThan(1.3);
    for (const t of TRICKS) expect(shotFor(t.id).zoom).toBeGreaterThanOrEqual(1);
  });
});

describe('a close-up', () => {
  it('comes in over 0.4 s when the trick starts, quiets the scene, and goes back over 0.5 s when it ends', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'wave');
    expect(r.moves[0].ms).toBe(CLOSEUP_IN_MS);
    expect(zoomOf(r.moves[0].v)).toBeCloseTo(2, 5);
    expect(r.host().classList.contains('is-closeup')).toBe(true);
    expect(r.pause).toHaveBeenLastCalledWith(true);
    expect(r.c.active).toBe(true);
    vi.advanceTimersByTime(TRICK_BY_ID.wave.ms);
    expect(r.resets).toEqual([CLOSEUP_OUT_MS]);
    expect(r.host().classList.contains('is-closeup')).toBe(false);
    expect(r.pause).toHaveBeenLastCalledWith(false);
    expect(r.c.active).toBe(false);
  });

  it('the nearest animals look over and say hello partway through; a far one does not', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'bow');
    vi.advanceTimersByTime(Math.round(TRICK_BY_ID.bow.ms * 0.35) + 1);
    const who = r.react.mock.calls.map(([f]) => (f as SVGGElement).dataset.friend);
    expect(who).toEqual(['juniper', 'cotton']);
    expect(nearbyFigures(r.svg, r.fig('truffle')).map((f) => f.dataset.friend)).not.toContain('hazel');
  });

  it('a giggle is a face close-up: closer, and framed higher than the middle of the body', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'laugh');
    const v = r.moves[0].v;
    expect(zoomOf(v)).toBeCloseTo(2.5, 5);
    const body = 240 - 34 * 0.45;
    expect(v.y + v.h / 2).toBeLessThan(body);
  });

  it('a backflip pulls out and up as it leaps', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'backflip');
    vi.advanceTimersByTime(CLOSEUP_IN_MS + 10);
    expect(r.moves.length).toBe(2);
    expect(zoomOf(r.moves[1].v)).toBeLessThan(zoomOf(r.moves[0].v));
    expect(r.moves[1].v.y).toBeLessThan(r.moves[0].v.y);
  });

  it('sleepy is a slow push-in for the length of the doze', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'sleepy');
    vi.advanceTimersByTime(TRICK_BY_ID.sleepy.ms * 0.2);
    expect(zoomOf(r.moves[1].v)).toBeGreaterThan(zoomOf(r.moves[0].v));
    expect(r.moves[1].ms).toBeGreaterThan(1500);
  });

  it('a rainbow is wide; a happy dance bumps the frame on its beats', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'rainbow');
    expect(zoomOf(r.moves[0].v)).toBeLessThan(1.3);
    r.c.cancel();
    r.offsets.length = 0;
    r.c.play(r.fig('truffle'), 'dance');
    vi.advanceTimersByTime(TRICK_BY_ID.dance.ms);
    expect(r.offsets.length).toBeGreaterThanOrEqual(3);
    expect(r.offsets.every((z) => z > 1 && z < 1.1)).toBe(true);
  });

  it('party time takes in the neighbours, who join in with a dance; the far one stays out of it', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'party');
    const v = r.moves[0].v;
    for (const id of ['cotton', 'truffle', 'juniper']) {
      const x = Number(r.fig(id).dataset.gx);
      expect(x).toBeGreaterThan(v.x);
      expect(x).toBeLessThan(v.x + v.w);
    }
    vi.advanceTimersByTime(800);
    expect(r.fig('juniper').dataset.trick).toBe('dance');
    expect(r.fig('cotton').dataset.trick).toBe('dance');
    expect(r.fig('hazel').dataset.trick).toBeUndefined();
    // Nobody is left mid-trick.
    vi.advanceTimersByTime(TRICK_BY_ID.dance.ms + 10);
    expect(r.svg.querySelector('[data-trick]')).toBeNull();
  });

  it('a new trick replaces the close-up; cancel gives the scene back at once', () => {
    const r = rig();
    r.c.play(r.fig('truffle'), 'wave');
    r.c.play(r.fig('cotton'), 'bow');
    vi.advanceTimersByTime(TRICK_BY_ID.wave.ms);
    // Only the second trick's end resets (the first one's timers were cleared).
    expect(r.resets).toEqual([]);
    r.c.cancel();
    expect(r.resets).toEqual([0]);
    expect(r.host().classList.contains('is-closeup')).toBe(false);
  });

  it('reduced motion: no close-up at all', () => {
    const r = rig(true);
    for (const id of ['wave', 'party', 'dance'] as TrickId[]) r.c.play(r.fig('truffle'), id);
    expect(r.moves).toEqual([]);
    expect(r.host().classList.contains('is-closeup')).toBe(false);
    expect(r.pause).not.toHaveBeenCalled();
  });

  it('framing keeps every figure in view, and is the whole scene for nobody', () => {
    const svg = scene();
    const figs = [...svg.querySelectorAll('.sanctuary__pet')];
    const v = framing(FULL, figs.slice(0, 3));
    for (const f of figs.slice(0, 3)) {
      const x = Number((f as SVGGElement).dataset.gx);
      expect(x).toBeGreaterThan(v.x);
      expect(x).toBeLessThan(v.x + v.w);
    }
    expect(framing(FULL, [])).toEqual(FULL);
  });
});
