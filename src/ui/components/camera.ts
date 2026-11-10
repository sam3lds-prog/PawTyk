/**
 * The scene camera (D44 PR C): pans and zooms a sanctuary scene, the drawing and its 3D toys together, so a trick can
 * get a close-up, the Welcome Parade can glide to the barn, and the guided tour can visit each landmark.
 *
 * A view is a rectangle in the scene's own units (the drawn frame is 360 × 300), always the scene's shape and always
 * inside it. Applying a view sets the SVG's viewBox (vector-sharp at any zoom) and frames the same rectangle in the 3D
 * stage (`setViewOffset`), so every toy stays on its drawn spot. Taps keep working at any zoom: everything that maps a
 * tap to the scene goes through the SVG's own transform.
 *
 * **Depth (parallax)**: groups marked `data-depth` (below 1: farther away, above 1: nearer) move less or more than the
 * scene as the camera moves, so hills slide behind the barn and foreground grass sweeps past.
 *
 * **Two quality tiers**: on a phone that keeps up, every frame of a move sets the viewBox (sharp all the way, with
 * depth). If frames come slower than ~35 fps during a move, the camera switches to the lite tier for the session:
 * moves are drawn as one GPU transform of the drawing and the 3D canvas, and the sharp viewBox is set when the move
 * lands; depth stays flat.
 *
 * Reduced motion: moves become cuts (the view changes at once, nothing glides), and offsets (a beat-synced sway) are
 * ignored. Callers decide whether a close-up happens at all.
 */

export interface View {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface CameraOptions {
  reducedMotion: () => boolean;
  /** Told whenever the sharp view changes (the 3D stage frames the same rectangle). Null: the whole scene. */
  onView?: (v: View | null) => void;
}

export type Quality = 'high' | 'lite';

let quality: Quality = 'high';
/** The camera's tier for this session (tests and the settings can force one). */
export function cameraQuality(): Quality {
  return quality;
}
export function setCameraQuality(q: Quality): void {
  quality = q;
}

/** The deepest close-up (a small animal fills about a third of the frame), and the widest. */
export const MAX_ZOOM = 2.6;

export const easeInOut = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2);

const raf = (fn: FrameRequestCallback) => (typeof requestAnimationFrame === 'function' ? requestAnimationFrame(fn) : (setTimeout(() => fn(performance.now()), 16) as unknown as number));
const caf = (id: number) => (typeof cancelAnimationFrame === 'function' ? cancelAnimationFrame(id) : clearTimeout(id));

export function viewEquals(a: View, b: View, eps = 0.01): boolean {
  return Math.abs(a.x - b.x) < eps && Math.abs(a.y - b.y) < eps && Math.abs(a.w - b.w) < eps && Math.abs(a.h - b.h) < eps;
}

export function lerpView(a: View, b: View, t: number): View {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t };
}

/** Parses a viewBox string ("0 0 360 300"). */
export function parseView(s: string | null | undefined): View | null {
  const n = (s ?? '').trim().split(/[\s,]+/).map(Number);
  return n.length === 4 && n.every(Number.isFinite) && n[2] > 0 && n[3] > 0 ? { x: n[0], y: n[1], w: n[2], h: n[3] } : null;
}

/** The scene's full frame: kept on the SVG as `data-vb` the first time a camera sees it. */
export function fullView(svg: SVGSVGElement): View {
  const kept = parseView(svg.getAttribute('data-vb'));
  if (kept) return kept;
  const v = parseView(svg.getAttribute('viewBox')) ?? { x: 0, y: 0, w: 360, h: 300 };
  svg.setAttribute('data-vb', `${v.x} ${v.y} ${v.w} ${v.h}`);
  return v;
}

/** A view of `full`'s shape, `zoom`× closer, centred on (cx, cy) as nearly as the frame's edges allow. */
export function viewAt(full: View, cx: number, cy: number, zoom: number): View {
  const z = Math.max(1, Math.min(MAX_ZOOM, zoom));
  const w = full.w / z;
  const h = full.h / z;
  return clampView(full, { x: cx - w / 2, y: cy - h / 2, w, h });
}

/** Keeps a view inside the frame (and no bigger than it). */
export function clampView(full: View, v: View): View {
  const w = Math.min(full.w, v.w);
  const h = Math.min(full.h, v.h);
  return {
    x: Math.min(Math.max(v.x, full.x), full.x + full.w - w),
    y: Math.min(Math.max(v.y, full.y), full.y + full.h - h),
    w,
    h,
  };
}

/** Where a scene element stands, in scene units: a figure's ground point (`data-gx/gy`), else its box's centre. */
export function scenePoint(el: Element): { x: number; y: number; h: number } | null {
  const d = (el as HTMLElement).dataset ?? {};
  if (d.gx && d.gy) return { x: Number(d.gx), y: Number(d.gy) - Number(d.gh ?? 30) * 0.45, h: Number(d.gh ?? 30) };
  try {
    const b = (el as SVGGraphicsElement).getBBox();
    return { x: b.x + b.width / 2, y: b.y + b.height / 2, h: b.height };
  } catch {
    return null;
  }
}

export class SceneCamera {
  private figure: HTMLElement | null = null;
  private svg: SVGSVGElement | null = null;
  private fullV: View = { x: 0, y: 0, w: 360, h: 300 };
  /** The view the camera rests on (or is gliding toward), before any offset. */
  private base: View = this.fullV;
  /** The sharp view currently set on the SVG and the stage. */
  private sharp: View = this.fullV;
  private offset = { dx: 0, dy: 0, zoom: 1 };
  private anim = 0;
  private settleMove: ((ok: boolean) => void) | null = null;
  private disposed = false;

  constructor(private readonly o: CameraOptions) {}

  /** Binds to a (re-)rendered scene. A new SVG starts at the whole frame, then takes the camera's current view. */
  attach(figure: HTMLElement | null, svg: SVGSVGElement | null): void {
    this.figure = figure;
    this.svg = svg;
    if (!svg) return;
    this.fullV = fullView(svg);
    this.base = clampView(this.fullV, this.base.w > this.fullV.w ? this.fullV : this.base);
    this.sharp = this.fullV;
    this.apply(this.effective(), true);
  }

  get full(): View {
    return this.fullV;
  }

  /** The view the camera is on (or headed to), before offsets. */
  get view(): View {
    return this.base;
  }

  get zoom(): number {
    return this.fullV.w / this.base.w;
  }

  get zoomed(): boolean {
    return !viewEquals(this.base, this.fullV, 0.5);
  }

  get moving(): boolean {
    return this.anim !== 0;
  }

  /** A close-up view of a scene element (a figure, a landmark), `zoom`× in. */
  viewOf(el: Element, zoom: number, opts: { dy?: number } = {}): View | null {
    const p = scenePoint(el);
    return p ? viewAt(this.fullV, p.x, p.y + (opts.dy ?? 0), zoom) : null;
  }

  /** Glides to a view over `ms` (a cut under reduced motion, or with 0). Resolves false if another move took over. */
  moveTo(target: View, ms = 650, ease = easeInOut): Promise<boolean> {
    this.cancel();
    const to = clampView(this.fullV, target);
    if (!this.svg || this.disposed) {
      this.base = to;
      return Promise.resolve(true);
    }
    if (ms <= 0 || this.o.reducedMotion()) {
      this.base = to;
      this.apply(this.effective(), true);
      return Promise.resolve(true);
    }
    const from = this.base;
    const start = performance.now();
    let frames = 0;
    let last = start;
    let slow = 0;
    clearTag(this.figure);
    return new Promise<boolean>((resolve) => {
      this.settleMove = resolve;
      const step = (now: number) => {
        if (this.disposed) return;
        const t = Math.min(1, (now - start) / ms);
        // Adapt: a phone that can't keep up with sharp frames gets the lite tier for the rest of the session.
        if (frames > 1) slow += now - last > 28 ? 1 : 0;
        last = now;
        if (++frames === 14 && slow >= 8 && quality === 'high') quality = 'lite';
        this.base = lerpView(from, to, ease(t));
        if (t >= 1) {
          this.base = to;
          this.anim = 0;
          this.apply(this.effective(), true);
          this.settleMove = null;
          resolve(true);
          return;
        }
        this.apply(this.effective(), false);
        this.anim = raf(step);
      };
      this.anim = raf(step);
    });
  }

  /** Glides to a close-up of `el`. */
  focus(el: Element, zoom = 2, ms = 650, opts: { dy?: number } = {}): Promise<boolean> {
    const v = this.viewOf(el, zoom, opts);
    return v ? this.moveTo(v, ms) : Promise.resolve(false);
  }

  /** Back to the whole scene. */
  reset(ms = 550): Promise<boolean> {
    this.offset = { dx: 0, dy: 0, zoom: 1 };
    return this.moveTo(this.fullV, ms);
  }

  /** The view at once (no glide). */
  cut(v: View): void {
    this.cancel();
    this.base = clampView(this.fullV, v);
    this.apply(this.effective(), true);
  }

  /**
   * A small extra movement on top of the view, in scene units and a zoom factor (a beat-synced sway or bump during a
   * dance). Ignored under reduced motion. Sharp when the camera is at rest in the high tier.
   */
  setOffset(dx: number, dy: number, zoom = 1): void {
    if (this.o.reducedMotion()) return;
    this.offset = { dx, dy, zoom };
    if (!this.anim) this.apply(this.effective(), quality === 'high');
  }

  clearOffset(): void {
    if (this.offset.dx === 0 && this.offset.dy === 0 && this.offset.zoom === 1) return;
    this.offset = { dx: 0, dy: 0, zoom: 1 };
    if (!this.anim) this.apply(this.effective(), true);
  }

  /** Stops a glide where it is. */
  cancel(): void {
    if (this.anim) caf(this.anim);
    this.anim = 0;
    if (this.settleMove) {
      const s = this.settleMove;
      this.settleMove = null;
      this.apply(this.effective(), true);
      s(false);
    }
  }

  /** Back to the whole scene at once, and lets go of it. */
  dispose(): void {
    this.cancel();
    this.base = this.fullV;
    this.offset = { dx: 0, dy: 0, zoom: 1 };
    this.apply(this.fullV, true);
    this.disposed = true;
  }

  private effective(): View {
    const b = this.base;
    const o = this.offset;
    if (o.dx === 0 && o.dy === 0 && o.zoom === 1) return b;
    const w = b.w / o.zoom;
    const h = b.h / o.zoom;
    return clampView(this.fullV, { x: b.x + (b.w - w) / 2 + o.dx, y: b.y + (b.h - h) / 2 + o.dy, w, h });
  }

  /** Shows a view: sharply (viewBox, depth, the stage) or, mid-move in the lite tier, as a GPU transform. */
  private apply(v: View, settle: boolean): void {
    const svg = this.svg;
    if (!svg) return;
    if (settle || quality === 'high') {
      clearTransforms(this.figure, svg);
      if (!viewEquals(v, this.sharp, 0.001) || svg.getAttribute('viewBox') !== fmt(v)) {
        svg.setAttribute('viewBox', fmt(v));
        this.sharp = v;
        this.o.onView?.(viewEquals(v, this.fullV, 0.001) ? null : v);
      }
      this.depth(v);
      return;
    }
    // Lite, mid-move: transform the drawing and the 3D canvas from the sharp view to `v`.
    const W = svg.clientWidth || 360;
    const H = svg.clientHeight || 300;
    const s = this.sharp.w / v.w;
    const tx = ((this.sharp.x - v.x) * W) / v.w;
    const ty = ((this.sharp.y - v.y) * H) / v.h;
    const tf = `translate(${tx.toFixed(2)}px, ${ty.toFixed(2)}px) scale(${s.toFixed(4)})`;
    for (const el of layers(this.figure, svg)) {
      el.style.transformOrigin = '0 0';
      el.style.transform = tf;
    }
  }

  /** Moves the depth layers for a view (sharp frames only). */
  private depth(v: View): void {
    const svg = this.svg!;
    const groups = svg.querySelectorAll<SVGGElement>('[data-depth]');
    if (!groups.length) return;
    const f = this.fullV;
    const zoom = f.w / v.w;
    const cx = v.x + v.w / 2;
    const cy = v.y + v.h / 2;
    const dx = cx - (f.x + f.w / 2);
    const dy = cy - (f.y + f.h / 2);
    const flat = quality !== 'high' || this.o.reducedMotion();
    for (const g of groups) {
      const d = Number(g.dataset.depth);
      if (!Number.isFinite(d) || d === 1 || flat || (zoom === 1 && dx === 0 && dy === 0)) {
        if (g.hasAttribute('transform')) g.removeAttribute('transform');
        continue;
      }
      // A far layer zooms less and follows the camera part of the way; a near one more, and the other way.
      const s = (1 + (zoom - 1) * d) / zoom;
      const px = dx * (1 - d);
      const py = dy * (1 - d) * 0.6;
      g.setAttribute('transform', `translate(${(cx + px).toFixed(2)} ${(cy + py).toFixed(2)}) scale(${s.toFixed(4)}) translate(${(-cx).toFixed(2)} ${(-cy).toFixed(2)})`);
    }
  }
}

const fmt = (v: View) => `${round(v.x)} ${round(v.y)} ${round(v.w)} ${round(v.h)}`;
const round = (n: number) => Math.round(n * 100) / 100;

function layers(figure: HTMLElement | null, svg: SVGSVGElement): Array<HTMLElement | SVGElement> {
  const out: Array<HTMLElement | SVGElement> = [svg];
  figure?.querySelectorAll<HTMLElement>(':scope > .scene3d').forEach((c) => out.push(c));
  return out;
}

function clearTransforms(figure: HTMLElement | null, svg: SVGSVGElement): void {
  for (const el of layers(figure, svg)) {
    if (el.style.transform) {
      el.style.transform = '';
      el.style.transformOrigin = '';
    }
  }
}

/** A name tag is placed in page pixels: it would drift as the camera moves, so it goes. */
function clearTag(figure: HTMLElement | null): void {
  figure?.querySelectorAll('[data-scene-tag]').forEach((n) => n.remove());
}
