/**
 * Photo mode's framings for a home's scene (D47 PR 5): the whole home, its animals together, and each animal close.
 * The scene's own camera glides there, so the 3D toys follow.
 */

import { ICON } from '../icons';
import { viewAt, type SceneCamera, type View } from './camera';
import type { PhotoFrame } from './photoMode';

export const photoButtonMarkup = (show: boolean) =>
  `<button class="scene-photo" data-act="photo" ${show ? '' : 'hidden'} aria-label="Take a photo of this home">${ICON.camera}<span>Photo</span></button>`;

interface Spot {
  x: number;
  y: number;
  h: number;
  name: string;
}

function spots(svg: SVGSVGElement): Spot[] {
  return [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet')]
    .filter((g) => g.dataset.gx && g.dataset.gy && !g.classList.contains('is-away'))
    .map((g) => {
      const h = Number(g.dataset.gh ?? 30);
      return { x: Number(g.dataset.gx), y: Number(g.dataset.gy) - h * 0.45, h, name: g.dataset.name ?? '' };
    });
}

/** A view round every animal, with room round them (no closer than 1.3×, no further than the whole home). */
export function groupFrame(full: View, s: Array<{ x: number; y: number; h: number }>): View {
  const x0 = Math.min(...s.map((p) => p.x - p.h * 0.7));
  const x1 = Math.max(...s.map((p) => p.x + p.h * 0.7));
  const y0 = Math.min(...s.map((p) => p.y - p.h * 0.8));
  const y1 = Math.max(...s.map((p) => p.y + p.h * 0.8));
  const zoom = Math.max(1, Math.min(full.w / Math.max(1, (x1 - x0) * 1.25), full.h / Math.max(1, (y1 - y0) * 1.25), 2.2));
  return viewAt(full, (x0 + x1) / 2, (y0 + y1) / 2, zoom < 1.3 ? 1 : zoom);
}

export function photoFrames(camera: SceneCamera, svg: SVGSVGElement): PhotoFrame[] {
  const out: PhotoFrame[] = [{ id: 'home', label: 'Whole home', go: () => camera.moveTo(camera.full, 600) }];
  const s = spots(svg);
  if (s.length > 1) out.push({ id: 'animals', label: 'Everyone', go: () => camera.moveTo(groupFrame(camera.full, s), 600) });
  for (const p of s.slice(0, 8)) if (p.name) out.push({ id: `a:${p.name}`, label: p.name, go: () => camera.moveTo(viewAt(camera.full, p.x, p.y, 2.3), 600) });
  return out;
}
