/**
 * The newcomer, made easy to find (D39): when a win's *Meet* (or the "New" marker) brings the player to a sanctuary, the
 * animal who just came home gets a soft ring on the ground under its figure for a moment, and its card in the Animals
 * row says *New*. The ring is an overlay inside the figure's own group (behind the body), so the scene, its ambient
 * life and the 3D toys are untouched; under reduced motion it is still, and it goes away either way.
 */

import type { Scope } from '../router';

/** How long the ring stays (ms). */
export const SPOTLIGHT_MS = 2600;

/** Rings the ground under a drawn figure (`data-friend` or `data-pet`). Returns false when the figure isn't in the scene. */
export function spotlightNewcomer(scope: Scope, svg: SVGSVGElement | null, id: string): boolean {
  const fig = svg?.querySelector<SVGGElement>(`.sanctuary__pet[data-friend="${id}"], .sanctuary__pet[data-pet="${id}"]`);
  if (!fig) return false;
  const x = Number(fig.dataset.gx);
  const y = Number(fig.dataset.gy);
  const h = Number(fig.dataset.gh) || 40;
  if (!Number.isFinite(x) || !Number.isFinite(y)) return false;
  const ns = 'http://www.w3.org/2000/svg';
  const ring = document.createElementNS(ns, 'ellipse');
  ring.setAttribute('class', 'sp-spotlight');
  ring.setAttribute('cx', String(x));
  ring.setAttribute('cy', String(y + 0.5));
  ring.setAttribute('rx', (h * 0.62).toFixed(1));
  ring.setAttribute('ry', (h * 0.16).toFixed(1));
  ring.setAttribute('aria-hidden', 'true');
  fig.insertBefore(ring, fig.firstChild);
  fig.classList.add('is-newcomer');
  // It fades for the last 400 ms (a transition, so reduced motion only drops the pop-in), then leaves.
  scope.timeout(() => ring.classList.add('is-out'), SPOTLIGHT_MS - 400);
  scope.timeout(() => {
    ring.remove();
    fig.classList.remove('is-newcomer');
  }, SPOTLIGHT_MS);
  return true;
}

/** The "New" chip on a newcomer's card in the Animals row. */
export const NEW_CHIP = '<span class="resident__new" aria-hidden="true">New</span>';
