/**
 * Finding and choosing an animal in a scene (D40 PR D): a tap near an animal counts as a tap on it (little animals
 * are small targets), the chosen animal gets a soft ring on the ground and a name tag for a moment, and the one-time
 * "Tap Cotton to say hello" cue rings the animal it names. Rings are still (no pulsing loop) and never block a tap.
 */

import { animalInfo, isAnimalId } from '../../meta/animals';
import { TEMPERAMENT_INFO, temperamentOf } from '../../meta/temperament';
import { h } from '../dom';
import type { Scope } from '../router';

/** How long the name tag and the ring stay after a tap. */
export const SELECT_MS = 2600;
/** A tap target is at least this big, in scene units (the scene is drawn about one unit to one point on a phone). */
export const MIN_TARGET = 44;

export interface FigureSpot {
  gx: number;
  gy: number;
  gh: number;
}

/**
 * Which figure a scene point is on or near: the one whose padded box (at least MIN_TARGET wide and tall, centered on
 * the animal) holds the point, nearest first. -1 when none does.
 */
export function nearestFigure(figs: readonly FigureSpot[], x: number, y: number): number {
  let best = -1;
  let bestD = Infinity;
  figs.forEach((f, i) => {
    // A figure stands on (gx, gy); its head and ears reach about 1.4 × gh above the ground.
    const w = Math.max(MIN_TARGET, f.gh * 1.2 + 10);
    const hh = Math.max(MIN_TARGET, f.gh * 1.4 + 12);
    const cx = f.gx;
    const cy = f.gy - f.gh * 0.7;
    if (Math.abs(x - cx) > w / 2 || Math.abs(y - cy) > hh / 2) return;
    const d = Math.hypot(x - cx, y - cy);
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

const spotOf = (g: Element): FigureSpot | null => {
  const el = g as HTMLElement;
  const gx = Number(el.dataset.gx);
  const gy = Number(el.dataset.gy);
  const gh = Number(el.dataset.gh) || 40;
  return Number.isFinite(gx) && Number.isFinite(gy) ? { gx, gy, gh } : null;
};

/** The figure a screen tap is on or near, if any (needs layout: null where the browser can't map the point). */
export function figureNear(svg: SVGSVGElement, clientX: number, clientY: number): HTMLElement | null {
  const ctm = svg.getScreenCTM?.();
  if (!ctm || typeof svg.createSVGPoint !== 'function') return null;
  const pt = svg.createSVGPoint();
  pt.x = clientX;
  pt.y = clientY;
  const p = pt.matrixTransform(ctm.inverse());
  const figs = [...svg.querySelectorAll<HTMLElement>('.sanctuary__pet')].filter((g) => !g.classList.contains('is-away'));
  const spots = figs.map(spotOf);
  const i = nearestFigure(
    spots.map((s) => s ?? { gx: -1e6, gy: -1e6, gh: 0 }),
    p.x,
    p.y,
  );
  return i >= 0 ? figs[i] : null;
}

/** A soft ellipse on the ground under a figure (inserted just before it, so the figure stays on top). */
export function groundRing(fig: Element, cls: string): SVGEllipseElement | null {
  const s = spotOf(fig);
  if (!s) return null;
  const ring = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
  ring.setAttribute('class', cls);
  ring.setAttribute('cx', String(s.gx));
  ring.setAttribute('cy', String(s.gy + 0.5));
  ring.setAttribute('rx', (Math.max(s.gh * 0.62, 16)).toFixed(1));
  ring.setAttribute('ry', (Math.max(s.gh * 0.16, 5)).toFixed(1));
  ring.setAttribute('aria-hidden', 'true');
  fig.parentNode?.insertBefore(ring, fig);
  return ring;
}

const animalIdOf = (fig: Element) => (fig as HTMLElement).dataset.pet ?? (fig as HTMLElement).dataset.friend ?? '';

/** The name a tag shows: "Truffle · Playful". */
export function tagText(id: string): string {
  if (!isAnimalId(id)) return '';
  return `${animalInfo(id).name} · ${TEMPERAMENT_INFO[temperamentOf(id)].label}`;
}

/**
 * The tapped animal is the chosen one for a moment: a ring under it and its name tag over the scene. Choosing another
 * moves both; they leave on their own after SELECT_MS.
 */
export function selectFigure(scope: Scope, scene: HTMLElement, fig: HTMLElement): void {
  clearSelection(scene);
  const ring = groundRing(fig, 'sp-select');
  fig.classList.add('is-selected');
  const id = animalIdOf(fig);
  const text = tagText(id);
  let tag: HTMLElement | null = null;
  if (text) {
    tag = h(`<span class="scene-tag" data-scene-tag="${id}" aria-hidden="true"></span>`);
    tag.textContent = text;
    // Over the animal's head, inside the scene's frame.
    const box = fig.getBoundingClientRect();
    const frame = scene.getBoundingClientRect();
    if (box.width && frame.width) {
      const left = Math.min(Math.max(box.left + box.width / 2 - frame.left, 48), frame.width - 48);
      tag.style.left = `${left}px`;
      tag.style.top = `${Math.max(box.top - frame.top - 6, 4)}px`;
    }
    scene.appendChild(tag);
  }
  scope.timeout(() => {
    ring?.remove();
    tag?.remove();
    fig.classList.remove('is-selected');
  }, SELECT_MS);
}

export function clearSelection(scene: HTMLElement): void {
  scene.querySelectorAll('.sp-select, [data-scene-tag]').forEach((n) => n.remove());
  scene.querySelectorAll('.is-selected').forEach((n) => n.classList.remove('is-selected'));
}

/** The one-time cue's animal: the newcomer if there is one here, else the first animal in the scene. */
export function cueFigure(svg: Element | null, prefer?: string): HTMLElement | null {
  if (!svg) return null;
  return (
    (prefer ? svg.querySelector<HTMLElement>(`.sanctuary__pet[data-friend="${prefer}"], .sanctuary__pet[data-pet="${prefer}"]`) : null) ??
    svg.querySelector<HTMLElement>('.sanctuary__pet')
  );
}

/** Rings the animal the cue names (until the cue is done). */
export function ringCued(fig: HTMLElement | null): void {
  if (!fig || fig.parentNode?.querySelector('.sp-cue-ring')) return;
  groundRing(fig, 'sp-cue-ring');
  fig.classList.add('is-cued');
}

export function unringCued(root: Element): void {
  root.querySelectorAll('.sp-cue-ring').forEach((n) => n.remove());
  root.querySelectorAll('.is-cued').forEach((n) => n.classList.remove('is-cued'));
}
