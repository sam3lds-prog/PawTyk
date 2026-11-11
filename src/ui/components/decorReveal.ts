/**
 * D49 PR B: a new decoration arrives with a moment of delight instead of a "purchase successful" line.
 *
 * When the player buys a piece, it is noted for its home (for this app session). The next time that home's scene is
 * drawn with the piece out — straight away from the try-on banner, or from the card's **See it in your Farm**, or the
 * next visit — it pops in with a ring of sparkles, and a moment later one of the home's animals goes and uses it (the
 * Tire Swing gets a swing, the Bubble Machine a chase). A piece with nothing to do with it gets a curious look from the
 * nearest animal instead. Under reduced motion: the sparkle ring only, and nobody runs over.
 *
 * Nothing is granted or decided here: the purchase already happened. A reveal that never gets seen (the app closed)
 * is simply lost; the piece is out either way.
 */

import type { DecorId } from '../../meta/catalogs/decor';
import { DECOR_BY_ID, decorHome } from '../../meta/catalogs/decor';
import type { SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { sfx } from '../../services/audio';
import { activityFor } from '../art/activities';

/** How long the piece's pop-in and sparkle ring last; the animals come over after it. */
export const REVEAL_MS = 900;

const pending = new Map<string, DecorId[]>();

/** A piece was just bought: its home plays the reveal the next time it is drawn with the piece out. */
export function noteReveal(id: DecorId): void {
  const home = decorHome(DECOR_BY_ID[id]);
  const list = pending.get(home) ?? [];
  if (!list.includes(id)) pending.set(home, [...list, id]);
}

/** The reveals waiting for `home` (taken: each plays once). */
export function takeReveals(home: SanctuaryId): DecorId[] {
  const list = pending.get(home) ?? [];
  pending.delete(home);
  return list;
}

/** Whether a reveal is waiting for `home` (tests and QA). */
export const revealWaiting = (home: SanctuaryId): boolean => !!pending.get(home)?.length;

export interface RevealHost {
  svg: () => SVGSVGElement | null;
  reducedMotion: () => boolean;
  /** Plays the piece's activity with one of the home's animals (false if it can't now). */
  playActivity: (id: DecorId) => boolean;
  /** Turns a figure toward the piece for a moment (a curious look, a hello). */
  notice: (figureId: string) => void;
  timeout: (fn: () => void, ms: number) => void;
}

/**
 * Plays the reveal for each piece that is out in the scene (in turn, a beat apart). Returns the pieces it played.
 */
export function playReveals(host: RevealHost, ids: readonly DecorId[]): DecorId[] {
  const svg = host.svg();
  if (!svg) return [];
  const shown = ids.filter((id) => svg.querySelector(`[data-decor="${id}"]`));
  shown.forEach((id, i) =>
    host.timeout(() => {
      const g = host.svg()?.querySelector<SVGGElement>(`[data-decor="${id}"]`);
      if (!g) return;
      sparkleRing(g, host.reducedMotion());
      g.classList.add('is-revealing');
      sfx('chimes');
      host.timeout(() => g.classList.remove('is-revealing'), REVEAL_MS);
      if (host.reducedMotion()) return;
      host.timeout(() => {
        if (activityFor(id) && host.playActivity(id)) return;
        const near = nearestFigure(host.svg(), g);
        if (near) host.notice(near);
      }, REVEAL_MS - 150);
    }, i * (REVEAL_MS + 400)),
  );
  return shown;
}

/** A ring of little stars around the piece, drawn over it, that rises and fades (gone after `REVEAL_MS`). */
function sparkleRing(g: SVGGElement, still: boolean): void {
  let box = { x: 0, y: 0, width: 30, height: 30 };
  try {
    box = g.getBBox();
  } catch {
    /* not rendered (tests) */
  }
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  const r = Math.max(box.width, box.height) * 0.62 + 4;
  const stars = Array.from({ length: 7 }, (_, i) => {
    const a = (i / 7) * Math.PI * 2 - Math.PI / 2;
    const x = cx + Math.cos(a) * r;
    const y = cy + Math.sin(a) * r * 0.7;
    return `<path class="sp-reveal-star" style="animation-delay:${i * 40}ms" d="M${x.toFixed(1)} ${(y - 3).toFixed(1)} l1 2 2 1 -2 1 -1 2 -1 -2 -2 -1 2 -1 z" fill="${i % 2 ? '#FFD166' : '#FFF4C2'}"/>`;
  }).join('');
  g.insertAdjacentHTML('afterend', `<g class="sp-reveal${still ? ' is-still' : ''}" aria-hidden="true" data-reveal-for="${g.dataset.decor ?? ''}">${stars}</g>`);
  const ring = g.nextElementSibling;
  setTimeout(() => ring?.remove(), REVEAL_MS + 100);
}

/** The id of the figure nearest a piece (`friend:<id>` or a resident's id), as scene life names them. */
function nearestFigure(svg: SVGSVGElement | null, g: SVGGElement): string | null {
  if (!svg) return null;
  let at = { x: 0, y: 0 };
  try {
    const b = g.getBBox();
    at = { x: b.x + b.width / 2, y: b.y + b.height };
  } catch {
    /* not rendered */
  }
  let best: { id: string; d: number } | null = null;
  for (const f of svg.querySelectorAll<HTMLElement>('.sanctuary__pet:not(.is-away):not([data-trick])')) {
    const d = Math.hypot(Number(f.dataset.gx) - at.x, Number(f.dataset.gy) - at.y);
    const id = f.dataset.pet ?? (f.dataset.friend ? `friend:${f.dataset.friend}` : '');
    if (id && Number.isFinite(d) && (!best || d < best.d)) best = { id, d };
  }
  return best?.id ?? null;
}
