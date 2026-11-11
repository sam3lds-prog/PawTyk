/**
 * Photo mode's framings for a home's scene (D47 PR 5): the whole home, its animals together, and each animal close.
 * The scene's own camera glides there, so the 3D toys follow.
 *
 * D48 PR A, safe framing: a postcard is a crop of the screen (3:2 or 4:5), so the animals must fit inside **that**
 * shape, not the screen's. Every framing fits its animals (their whole height, ears and tails included) inside the
 * postcard's window with `SAFE_MARGIN` to spare on every side, and tells the postcard where they are (`focus`), so the
 * crop centres on them rather than on the middle of the screen. Changing the shape refits the framing.
 */

import { ICON } from '../icons';
import { MAX_ZOOM, viewAt, type SceneCamera, type View } from './camera';
import type { PhotoFrame } from './photoMode';

export const photoButtonMarkup = (show: boolean) =>
  `<button class="scene-photo" data-act="photo" ${show ? '' : 'hidden'} aria-label="Take a photo of this home">${ICON.camera}<span>Photo</span></button>`;

/** The postcard window's share of the view (0–1 each way): what the card keeps of the screen. */
export interface Shape {
  w: number;
  h: number;
}
const WHOLE: Shape = { w: 1, h: 1 };

/** Room kept round the animals inside the postcard's window, each side, as a share of the window (D48 PR A). */
export const SAFE_MARGIN = 0.1;

interface Spot {
  /** The figure's ground point. */
  x: number;
  y: number;
  /** Its height. */
  h: number;
  name: string;
}

/** A figure's own box: its whole height above the ground point (with a little for ears), and a body's width each side. */
export function figureBox(p: { x: number; y: number; h: number }): { x0: number; x1: number; y0: number; y1: number } {
  return { x0: p.x - p.h * 0.75, x1: p.x + p.h * 0.75, y0: p.y - p.h * 1.12, y1: p.y + p.h * 0.1 };
}

function spots(svg: SVGSVGElement): Spot[] {
  return [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet')]
    .filter((g) => g.dataset.gx && g.dataset.gy && !g.classList.contains('is-away'))
    .map((g) => ({ x: Number(g.dataset.gx), y: Number(g.dataset.gy), h: Number(g.dataset.gh ?? 30), name: g.dataset.name ?? '' }));
}

function bounds(s: Array<{ x: number; y: number; h: number }>) {
  const b = s.map(figureBox);
  return { x0: Math.min(...b.map((q) => q.x0)), x1: Math.max(...b.map((q) => q.x1)), y0: Math.min(...b.map((q) => q.y0)), y1: Math.max(...b.map((q) => q.y1)) };
}

/**
 * Whether a box sits inside the postcard's window of `view` with the safe margin, the window placed as the postcard
 * places its crop: round the box's middle, but never past the view's edges.
 */
function fitsIn(view: View, shape: Shape, b: { x0: number; x1: number; y0: number; y1: number }): boolean {
  const ww = view.w * shape.w;
  const wh = view.h * shape.h;
  const cx = Math.min(view.x + view.w - ww / 2, Math.max(view.x + ww / 2, (b.x0 + b.x1) / 2));
  const cy = Math.min(view.y + view.h - wh / 2, Math.max(view.y + wh / 2, (b.y0 + b.y1) / 2));
  const mx = ww * SAFE_MARGIN * 0.8;
  const my = wh * SAFE_MARGIN * 0.8;
  return b.x0 >= cx - ww / 2 + mx && b.x1 <= cx + ww / 2 - mx && b.y0 >= cy - wh / 2 + my && b.y1 <= cy + wh / 2 - my;
}

/**
 * A view round every animal (`s`: ground points and heights) that fits them inside the postcard's window (`shape`)
 * with the safe margin, no closer than 1.3× (closer than that isn't worth a move) and no further than the whole home.
 * Near the scene's edge the view can't centre on them, so it widens until they fit where the card can reach.
 */
export function groupFrame(full: View, s: Array<{ x: number; y: number; h: number }>, shape: Shape = WHOLE, maxZoom = 2.2): View {
  if (!s.length) return full;
  const b = bounds(s);
  const room = 1 - 2 * SAFE_MARGIN;
  let zoom = Math.min((full.w * shape.w * room) / Math.max(1, b.x1 - b.x0), (full.h * shape.h * room) / Math.max(1, b.y1 - b.y0), maxZoom, MAX_ZOOM);
  const at = (z: number) => viewAt(full, (b.x0 + b.x1) / 2, (b.y0 + b.y1) / 2, z);
  while (zoom >= 1.3 && !fitsIn(at(zoom), shape, b)) zoom *= 0.94;
  return zoom < 1.3 ? full : at(zoom);
}

/** Where the animals' middle is in a view (0–1 across and down), for the postcard's crop. */
export function focusIn(view: View, s: Array<{ x: number; y: number; h: number }>): { x: number; y: number } {
  if (!s.length) return { x: 0.5, y: 0.5 };
  const b = bounds(s);
  const clamp = (v: number) => Math.max(0, Math.min(1, v));
  return { x: clamp(((b.x0 + b.x1) / 2 - view.x) / view.w), y: clamp(((b.y0 + b.y1) / 2 - view.y) / view.h) };
}

export function photoFrames(camera: SceneCamera, svg: SVGSVGElement): PhotoFrame[] {
  const s = () => spots(svg);
  // The whole home: the camera on everything; the postcard's crop still leans toward the animals.
  const out: PhotoFrame[] = [{ id: 'home', label: 'Whole home', go: () => camera.moveTo(camera.full, 600), focus: () => focusIn(camera.full, s()) }];
  if (s().length > 1) {
    let view = camera.full;
    out.push({
      id: 'animals',
      label: 'Everyone',
      go: (shape) => camera.moveTo((view = groupFrame(camera.full, s(), shape)), 600),
      focus: () => focusIn(view, s()),
    });
  }
  for (const p of s().slice(0, 8)) {
    if (!p.name) continue;
    let view = camera.full;
    const me = () => s().find((q) => q.name === p.name) ?? p;
    out.push({
      id: `a:${p.name}`,
      label: p.name,
      // One animal close: as close as 2.3×, but always whole inside the card, a tall one too.
      go: (shape) => camera.moveTo((view = groupFrame(camera.full, [me()], shape, 2.3)), 600),
      focus: () => focusIn(view, [me()]),
    });
  }
  return out;
}
