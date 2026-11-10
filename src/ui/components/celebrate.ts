/**
 * Celebrations, levels 1 and 2 (D44 PR E). Level 3, the Welcome Parade, is `parade.ts`.
 *
 * **Level 1, the win sparkle** (every solved board, about 1.1 s, never in the way): a band of light sweeps across the
 * board as its faces smile, and a burst of stars pops over it to Tiny Triumph. The results sheet rises while it plays;
 * nothing waits on it. Reduced motion: the board glows warm for a moment and the stars show still.
 *
 * **Level 2, the new-animal spotlight** (a win that brings an animal home, 2–4 s, skippable): the screen dims, a soft
 * light falls on the newcomer's portrait as it pops up, sparkles turn around it and Welcome Home plays; then the
 * results, whose main button is Meet (the parade). A tap, a key or the Continue button ends it at once. Reduced
 * motion: the same picture, still. It grants nothing (the solve's rewards were counted before it), so a skip can't
 * double anything up.
 */

import { animalInfo, type AnimalId } from '../../meta/animals';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { feel } from '../../services/feel';
import { animalPortrait } from '../art/animals';
import { esc, h } from '../dom';
import type { Scope } from '../router';

/** How long the win sparkle plays. */
export const WIN_SPARKLE_MS = 1150;
/** How long the spotlight holds before the results come up by themselves. */
export const SPOTLIGHT_HOLD_MS = 3300;
/** Its fade out. */
const SPOTLIGHT_OUT_MS = 220;

const STAR = `<svg viewBox="-10 -10 20 20" aria-hidden="true"><path d="M0 -9 L2.6 -2.8 L9 -2.6 L4 1.6 L5.6 8.4 L0 4.6 L-5.6 8.4 L-4 1.6 L-9 -2.6 L-2.6 -2.8 Z"/></svg>`;

/**
 * Level 1: the sweep over `board` and the star burst over `frame` (the board's frame, so the stars can spill past
 * the board's rounded edge). Cleans itself up; the returned function ends it early.
 */
export function winSparkle(scope: Scope, board: HTMLElement, frame: HTMLElement, reducedMotion: boolean): () => void {
  const sweep = h(`<div class="win-sweep" aria-hidden="true"></div>`);
  const burst = h(
    `<div class="win-burst${reducedMotion ? ' is-still' : ''}" aria-hidden="true">${Array.from({ length: 8 }, (_, i) => `<i class="win-burst__star" style="--a:${i * 45 + 22.5}deg;--d:${i % 2 ? 0.78 : 1};--delay:${(i % 4) * 40}ms">${STAR}</i>`).join('')}<i class="win-burst__ring"></i></div>`,
  );
  if (reducedMotion) board.classList.add('is-win-glow');
  else board.appendChild(sweep);
  frame.appendChild(burst);
  let done = false;
  const end = () => {
    if (done) return;
    done = true;
    sweep.remove();
    burst.remove();
    board.classList.remove('is-win-glow');
  };
  scope.timeout(end, WIN_SPARKLE_MS);
  scope.onDispose(end);
  return end;
}

export interface SpotlightOptions {
  animal: AnimalId;
  where: SanctuaryId;
  reducedMotion: boolean;
}

/**
 * Level 2: the newcomer's moment in the light. `onDone` is called once when it ends (by itself, or a tap or key), not
 * if the screen goes first.
 */
export function showSpotlight(parent: Scope, o: SpotlightOptions, onDone: (how: 'ended' | 'skipped') => void): void {
  const scope = parent.child();
  const a = animalInfo(o.animal);
  const def = sanctuaryDef(o.where);
  const prevFocus = document.activeElement as HTMLElement | null;
  const el = h(`
    <div class="spotlight${o.reducedMotion ? ' is-still' : ''}" role="dialog" aria-modal="true" aria-labelledby="spotlight-name" style="--accent:${def.accent}">
      <div class="spotlight__beam" aria-hidden="true"></div>
      <div class="spotlight__stage">
        <div class="spotlight__sparkles" aria-hidden="true">${Array.from({ length: 6 }, (_, i) => `<i style="--a:${i * 60}deg">${STAR}</i>`).join('')}</div>
        <div class="spotlight__art portrait">${animalPortrait(o.animal, 'beam')}</div>
      </div>
      <p class="spotlight__kicker">A new friend!</p>
      <h2 class="spotlight__name" id="spotlight-name">${esc(a.name)} the ${esc(a.noun)}</h2>
      <p class="spotlight__line">is coming home to the ${esc(def.short)}</p>
      <button class="btn spotlight__go" data-act="continue">Continue</button>
    </div>`);
  document.body.appendChild(el);
  // Welcome Home, with the arrival's own sound and a soft pulse.
  feel('arrival');
  scope.frame(() => el.classList.add('is-in'));
  el.querySelector<HTMLElement>('[data-act="continue"]')?.focus({ preventScroll: true });
  let over = false;
  const finish = (how: 'ended' | 'skipped') => {
    if (over) return;
    over = true;
    el.classList.remove('is-in');
    el.classList.add('is-out');
    const gone = () => {
      if (!scope.alive) return;
      scope.dispose();
      onDone(how);
    };
    if (o.reducedMotion) gone();
    else scope.timeout(gone, SPOTLIGHT_OUT_MS);
  };
  scope.onDispose(() => {
    over = true;
    el.remove();
    if (prevFocus && document.contains(prevFocus)) prevFocus.focus({ preventScroll: true });
  });
  scope.timeout(() => finish('ended'), SPOTLIGHT_HOLD_MS);
  scope.on(el, 'click', () => finish('skipped'));
  scope.on(document, 'keydown', (e) => {
    const k = (e as KeyboardEvent).key;
    if (k === 'Escape' || k === 'Enter' || k === ' ') {
      e.preventDefault();
      finish('skipped');
    } else if (k === 'Tab') e.preventDefault();
  });
  // Leaving the app ends it: the results are waiting when the player comes back.
  scope.on(document, 'visibilitychange', () => {
    if (document.hidden) finish('skipped');
  });
}
