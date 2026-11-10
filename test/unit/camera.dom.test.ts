// @vitest-environment happy-dom
/**
 * D44 PR C: the scene camera. Views stay the scene's shape and inside it; the SVG's viewBox and the 3D stage frame
 * the same rectangle; a glide is sharp every frame in the high tier and a GPU transform (sharp on landing) in the lite
 * one; depth layers move with the view; reduced motion cuts; a re-rendered scene keeps the camera's view; disposing
 * gives the whole scene back.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_ZOOM, SceneCamera, clampView, fullView, parseView, setCameraQuality, viewAt, type View } from '../../src/ui/components/camera';

const FULL: View = { x: 0, y: 0, w: 360, h: 300 };

let now = 0;
let frames: FrameRequestCallback[] = [];
/** Runs animation frames until `ms` have passed, one every 16 ms (or `gap`). */
function advance(ms: number, gap = 16): void {
  const end = now + ms;
  while (now < end) {
    now += gap;
    const run = frames;
    frames = [];
    for (const f of run) f(now);
  }
}

function scene(): { figure: HTMLElement; svg: SVGSVGElement } {
  document.body.innerHTML = `<figure class="sanctuary__scene"><svg viewBox="0 0 360 300">
      <g data-depth="0.6" class="hills"></g>
      <g class="sanctuary__pet" data-friend="cotton" data-gx="90" data-gy="220" data-gh="40"></g>
      <g data-depth="1.2" class="grass"></g>
    </svg><canvas class="scene3d"></canvas></figure>`;
  return { figure: document.querySelector('figure')!, svg: document.querySelector('svg')! };
}

beforeEach(() => {
  now = 1000;
  frames = [];
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (f: FrameRequestCallback) => {
    frames.push(f);
    return frames.length;
  });
  vi.stubGlobal('cancelAnimationFrame', () => {
    frames = [];
  });
  setCameraQuality('high');
});
afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('views', () => {
  it('keep the scene shape, stay inside it, and zoom at most MAX_ZOOM', () => {
    const v = viewAt(FULL, 350, 290, 2);
    expect(v.w / v.h).toBeCloseTo(360 / 300, 6);
    expect(v.x + v.w).toBeLessThanOrEqual(360);
    expect(v.y + v.h).toBeLessThanOrEqual(300);
    expect(viewAt(FULL, 180, 150, 99).w).toBeCloseTo(360 / MAX_ZOOM, 6);
    expect(viewAt(FULL, 180, 150, 0.2)).toEqual(FULL);
    expect(clampView(FULL, { x: -50, y: -50, w: 100, h: 80 })).toEqual({ x: 0, y: 0, w: 100, h: 80 });
    expect(parseView('0 0 360 300')).toEqual(FULL);
    expect(parseView('nope')).toBeNull();
  });

  it('the whole frame is kept on the SVG, so a zoomed viewBox never becomes "the scene"', () => {
    const { svg } = scene();
    expect(fullView(svg)).toEqual(FULL);
    svg.setAttribute('viewBox', '10 10 100 80');
    expect(fullView(svg)).toEqual(FULL);
  });
});

describe('the camera', () => {
  it('a cut sets the viewBox and frames the same view in 3D; back to full tells the stage null', () => {
    const { figure, svg } = scene();
    const onView = vi.fn();
    const cam = new SceneCamera({ reducedMotion: () => false, onView });
    cam.attach(figure, svg);
    const v = cam.viewOf(svg.querySelector('[data-friend]')!, 2)!;
    cam.cut(v);
    expect(parseView(svg.getAttribute('viewBox'))).toEqual(expect.objectContaining({ w: 180, h: 150 }));
    expect(onView).toHaveBeenLastCalledWith(expect.objectContaining({ w: 180, h: 150 }));
    expect(cam.zoomed).toBe(true);
    cam.cut(cam.full);
    expect(svg.getAttribute('viewBox')).toBe('0 0 360 300');
    expect(onView).toHaveBeenLastCalledWith(null);
  });

  it('glides sharply every frame in the high tier, lands exactly, and a new move cancels the old one', async () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    const target = viewAt(FULL, 90, 200, 2);
    const p = cam.moveTo(target, 400);
    advance(160);
    const mid = parseView(svg.getAttribute('viewBox'))!;
    expect(mid.w).toBeLessThan(360);
    expect(mid.w).toBeGreaterThan(target.w);
    expect(svg.style.transform).toBe('');
    advance(400);
    await expect(p).resolves.toBe(true);
    expect(parseView(svg.getAttribute('viewBox'))).toEqual(expect.objectContaining({ x: target.x, w: target.w }));
    // A move that is taken over resolves false.
    const first = cam.moveTo(FULL, 400);
    advance(50);
    const second = cam.reset(200);
    await expect(first).resolves.toBe(false);
    advance(300);
    await expect(second).resolves.toBe(true);
    expect(svg.getAttribute('viewBox')).toBe('0 0 360 300');
  });

  it('in the lite tier a glide is a transform of the drawing and the 3D canvas, sharp only when it lands', async () => {
    setCameraQuality('lite');
    const { figure, svg } = scene();
    const onView = vi.fn();
    const cam = new SceneCamera({ reducedMotion: () => false, onView });
    cam.attach(figure, svg);
    onView.mockClear();
    const p = cam.moveTo(viewAt(FULL, 90, 200, 2), 400);
    advance(160);
    expect(svg.getAttribute('viewBox')).toBe('0 0 360 300');
    expect(svg.style.transform).toMatch(/scale\(/);
    expect(figure.querySelector<HTMLElement>('.scene3d')!.style.transform).toBe(svg.style.transform);
    expect(onView).not.toHaveBeenCalled();
    advance(400);
    await p;
    expect(svg.style.transform).toBe('');
    expect(parseView(svg.getAttribute('viewBox'))!.w).toBeCloseTo(180, 6);
    expect(onView).toHaveBeenCalledTimes(1);
  });

  it('a phone that falls behind during a glide switches to the lite tier', async () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    const p = cam.moveTo(viewAt(FULL, 90, 200, 2), 1200);
    advance(1300, 45); // ~22 fps
    await p;
    const { cameraQuality } = await import('../../src/ui/components/camera');
    expect(cameraQuality()).toBe('lite');
  });

  it('depth layers move with the view (far less, near more), and lie flat at the whole scene', () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    cam.cut(viewAt(FULL, 90, 200, 2));
    expect(svg.querySelector('.hills')!.getAttribute('transform')).toMatch(/scale\(0\.8/); // (1 + 1 × 0.6) / 2
    expect(svg.querySelector('.grass')!.getAttribute('transform')).toMatch(/scale\(1\.1/); // (1 + 1 × 1.2) / 2
    expect(svg.querySelector('.sanctuary__pet')!.getAttribute('transform')).toBeNull();
    cam.cut(FULL);
    expect(svg.querySelector('.hills')!.getAttribute('transform')).toBeNull();
  });

  it('reduced motion: a move is a cut, and offsets (a dance sway) are ignored', async () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => true });
    cam.attach(figure, svg);
    await cam.moveTo(viewAt(FULL, 90, 200, 2), 600);
    expect(frames).toHaveLength(0);
    expect(parseView(svg.getAttribute('viewBox'))!.w).toBeCloseTo(180, 6);
    cam.setOffset(10, 0, 1.1);
    expect(parseView(svg.getAttribute('viewBox'))!.w).toBeCloseTo(180, 6);
    expect(svg.querySelector('.hills')!.getAttribute('transform')).toBeNull();
  });

  it('an offset nudges the view on top of where it rests, inside the frame', () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    cam.cut(viewAt(FULL, 180, 150, 2));
    cam.setOffset(6, -3, 1.05);
    const v = parseView(svg.getAttribute('viewBox'))!;
    expect(v.w).toBeCloseTo(180 / 1.05, 1);
    cam.clearOffset();
    expect(parseView(svg.getAttribute('viewBox'))!.w).toBeCloseTo(180, 6);
  });

  it('a re-rendered scene (a new SVG) takes the camera view; disposing gives the whole scene back', () => {
    const { figure, svg } = scene();
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    cam.cut(viewAt(FULL, 90, 200, 2));
    const again = scene();
    cam.attach(again.figure, again.svg);
    expect(parseView(again.svg.getAttribute('viewBox'))!.w).toBeCloseTo(180, 6);
    cam.dispose();
    expect(again.svg.getAttribute('viewBox')).toBe('0 0 360 300');
  });

  it('a name tag (placed in page pixels) goes when the camera starts to move', () => {
    const { figure, svg } = scene();
    figure.insertAdjacentHTML('beforeend', '<span data-scene-tag="cotton">Cotton</span>');
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(figure, svg);
    void cam.moveTo(viewAt(FULL, 90, 200, 2), 300);
    expect(figure.querySelector('[data-scene-tag]')).toBeNull();
  });
});
