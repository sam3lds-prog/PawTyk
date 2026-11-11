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
  if (fig.dataset.trick || fig.classList.contains('is-away')) return false;
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
  window.setTimeout(() => {
    overlay?.remove();
    fig.classList.remove(`is-trick-${id}`);
    fig.style.removeProperty('--trick-dir');
    fig.style.removeProperty('--trick-delay');
    delete fig.dataset.trick;
    delete fig.dataset.trickBody;
    delete fig.dataset.trickPartner;
    // A partner started a beat late (in 3D it plays the whole trick from there): it ends that much later too.
  }, (reducedMotion ? Math.max(1800, t.ms) : t.ms) + (reducedMotion ? 0 : partner * 160));
  return true;
}
