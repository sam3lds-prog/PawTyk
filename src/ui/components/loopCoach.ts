/**
 * The loop, once, in one picture and one sentence (D39 PR B). After the first puzzle has grown a home (the guided first
 * board brings the first animal in), the Journey hub — or the World, whichever the player opens first — shows a small
 * card: *Solve a new puzzle → the Farm grows → Truffle comes home*, filled in with this player's own sanctuary and the
 * animal on its way, and one line saying new places open as you go. *Got it* (or ✕) dismisses it for good, from either
 * screen. It is a card in the flow, never a modal, and it sits below the hero so Play stays on the first screen.
 */

import { app } from '../../app/app';
import { sanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { animalInfo } from '../../meta/animals';
import { activeSanctuary, arrivalProgress } from '../../meta/world';
import type { SaveV2 } from '../../services/storage';
import { track } from '../../services/analytics';
import { animalPortrait } from '../art/animals';
import { esc } from '../dom';
import { ICON } from '../icons';

/** Something has grown, or someone is home: the loop has happened once, so it can be named. */
export function loopHasStarted(save: Pick<SaveV2, 'world' | 'inventory'>): boolean {
  return Object.values(save.world.growth).some((g) => (g ?? 0) > 0) || Object.keys(save.inventory.companions).length > 0;
}

export function shouldShowLoopCoach(save: Pick<SaveV2, 'world' | 'inventory' | 'onboarding'>): boolean {
  return !save.onboarding.loopTipSeen && save.onboarding.tutorialDone && loopHasStarted(save);
}

/** The card, filled in with the home being built and who is on the way (generic words when nothing is being built). */
export function loopCoachMarkup(save: SaveV2): string {
  const id = activeSanctuary(save);
  const def = id ? sanctuaryDef(id) : null;
  const coming = id ? arrivalProgress(save, id) : null;
  const a = coming ? animalInfo(coming.next.id) : null;
  const grows = def ? `The ${esc(def.short)} grows` : 'Your home grows';
  const third = a
    ? `<span class="loop-coach__art portrait is-shy" aria-hidden="true">${animalPortrait(coming!.next.id, 'idle')}</span><span class="loop-coach__label">${esc(a.name)} comes home</span>`
    : `<span class="loop-coach__art" aria-hidden="true">${ICON.heart}</span><span class="loop-coach__label">Animals come home</span>`;
  const story = `Solve a new puzzle, then ${def ? `the ${def.short}` : 'your home'} grows, then ${a ? `${a.name} comes home` : 'animals come home'}.`;
  return `<section class="card loop-coach" data-loop-coach style="--accent:${def?.accent ?? 'var(--brand)'}" aria-labelledby="loop-title">
    <div class="loop-coach__head">
      <h2 id="loop-title">How Pawtopia works</h2>
      <button class="icon-btn icon-btn--bare" data-act="loop-ok" aria-label="Dismiss">${ICON.close}</button>
    </div>
    <ol class="loop-coach__steps" aria-label="${esc(story)}">
      <li aria-hidden="true"><span class="loop-coach__art">${ICON.play}</span><span class="loop-coach__label">Solve a new puzzle</span></li>
      <li aria-hidden="true"><span class="loop-coach__art">${ICON.sprout}</span><span class="loop-coach__label">${grows}</span></li>
      <li aria-hidden="true">${third}</li>
    </ol>
    <p class="loop-coach__line">Every new puzzle grows the home you're building. Animals arrive one by one, and new places open on the map as you go.</p>
    <button class="btn btn--secondary btn--block" data-act="loop-ok">Got it</button>
  </section>`;
}

/** Dismisses the card for good (from whichever screen it was on) and removes it from `root`. */
export function dismissLoopCoach(root: ParentNode, where: 'journey' | 'world'): void {
  if (!app.save.onboarding.loopTipSeen) {
    app.save.onboarding.loopTipSeen = true;
    app.persist();
    track('onboarding_step', { step: 'loop_coach', where });
  }
  root.querySelector('[data-loop-coach]')?.remove();
}
