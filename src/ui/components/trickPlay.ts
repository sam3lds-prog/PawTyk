/**
 * Playing a trick on a scene figure (D33), kept free of app state so it can be tested on its own. The trick's motion
 * is CSS (`.is-trick-<id>` in styles/sanctuary-play.css); this adds the emote and props, then clears everything after
 * the trick's own length. Under reduced motion only the emote shows, still.
 */

import { TRICK_BY_ID, type TrickId } from '../../meta/catalogs/tricks';
import { trickDir, trickOverlay } from '../art/tricks';
import { toySpec } from '../../three/species';

/**
 * D48 PR D: a body that can't do a trick the usual way does its own version (a big or tall animal rolls on its side
 * instead of somersaulting, floats lower; a bird gives a wing five; a seal bobs). The drawn figure carries its body as
 * `data-trick-body` for the CSS; the 3D clip reads the body itself.
 */
export function trickBody(animal: string): string {
  return toySpec(animal)?.body ?? 'sit';
}

/** Ambient and greeting classes a trick takes over from (sceneLife's `is-<action>`). */
const KEEP = /^is-(away|live|trick-)/;

/**
 * Plays a trick on a scene figure. Returns false if that figure is busy (mid-trick, or away on a decoration).
 * `partner` (D48 PR D) is a group act's partner number (1, 2, 3: a duet's other dancer, a parade's marchers in line):
 * it follows the lead a beat behind, with no bubble of its own.
 */
export function performTrick(svg: SVGSVGElement, fig: SVGGElement, id: TrickId, reducedMotion: boolean, partner = 0): boolean {
  return !!startTrick(svg, fig, id, reducedMotion, partner);
}

/** D49 PR C: a trick in progress, which can be ended early (an animal moment when the player starts something). */
export interface TrickHandle {
  /** Ends it now (its emote and motion go); safe to call after it ended by itself. */
  stop(): void;
  readonly active: boolean;
}

/**
 * `performTrick`, with a handle. Ending (by itself or by `stop`) clears only what this trick put there: if something
 * else has since taken the figure (a parade's dance), its own `data-trick` is left alone.
 */
export function startTrick(svg: SVGSVGElement, fig: SVGGElement, id: TrickId, reducedMotion: boolean, partner = 0): TrickHandle | null {
  if (fig.dataset.trick || fig.classList.contains('is-away')) return null;
  const t = TRICK_BY_ID[id];
  // The trick replaces whatever small ambient motion the animal was in the middle of (a greeting, a stroll).
  for (const c of [...fig.classList]) if (c.startsWith('is-') && !KEEP.test(c)) fig.classList.remove(c);
  let box = { x: 0, y: 0, w: 30, h: 30 };
  // The animal's own outline: the hidden heart above its head would lift the emote bubble too high.
  const hearts = [...fig.querySelectorAll<SVGElement>('.sp-heart')];
  hearts.forEach((h) => (h.style.display = 'none'));
  try {
    const b = fig.getBBox();
    box = { x: b.x, y: b.y, w: b.width, h: b.height };
  } catch {
    /* not rendered */
  }
  hearts.forEach((h) => (h.style.display = ''));
  // The scene's whole width, even while the camera shows a part of it (D44 PR C keeps it as `data-vb`).
  const width = Number((svg.getAttribute('data-vb') ?? '').split(/\s+/)[2]) || svg.viewBox?.baseVal?.width || Infinity;
  // With 3D toys (D34) the stage draws the emote and props itself, following the animal; the drawn overlay is for
  // the drawn animals.
  const in3d = !!svg.closest('.has-3d');
  let overlay: Element | null = null;
  if (!in3d && !partner) {
    svg.insertAdjacentHTML('beforeend', trickOverlay(id, t.emote, box, width, !reducedMotion));
    overlay = svg.lastElementChild;
  }
  fig.dataset.trick = id;
  fig.style.setProperty('--trick-dir', String(trickDir(box, width)));
  const animal = fig.dataset.pet ?? fig.dataset.friend ?? '';
  if (animal) fig.dataset.trickBody = trickBody(animal);
  if (partner) {
    fig.dataset.trickPartner = String(partner);
    fig.style.setProperty('--trick-delay', `${partner * 160}ms`);
  }
  if (!reducedMotion) fig.classList.add(`is-trick-${id}`);
  let over = false;
  const end = () => {
    if (over) return;
    over = true;
    overlay?.remove();
    fig.classList.remove(`is-trick-${id}`);
    if (fig.dataset.trick !== id) return;
    fig.style.removeProperty('--trick-dir');
    fig.style.removeProperty('--trick-delay');
    delete fig.dataset.trick;
    delete fig.dataset.trickBody;
    delete fig.dataset.trickPartner;
  };
  // A partner started a beat late (in 3D it plays the whole trick from there): it ends that much later too.
  const timer = window.setTimeout(end, (reducedMotion ? Math.max(1800, t.ms) : t.ms) + (reducedMotion ? 0 : partner * 160));
  return {
    stop: () => {
      clearTimeout(timer);
      end();
    },
    get active() {
      return !over;
    },
  };
}
