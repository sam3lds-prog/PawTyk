/**
 * The fourth step of an arrival (D40): once the newcomer has said hello, a small card says what the next puzzles bring
 * closer — the next animal on its way, the next stage, or the next home — with the level that starts it.
 */

import { app } from '../../app/app';
import { animalInfo, type AnimalId } from '../../meta/animals';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { nextGoal, type NextGoal } from '../../meta/world';
import { animalPortrait } from '../art/animals';
import { esc, h } from '../dom';
import { ICON } from '../icons';

const puzzles = (n: number) => (n === 1 ? 'one more puzzle' : `${n} more puzzles`);

export function nextGoalLine(g: NextGoal): string {
  switch (g.kind) {
    case 'animal': {
      const a = animalInfo(g.id as AnimalId);
      return `${a.name} the ${a.noun} comes home in ${puzzles(g.left)}`;
    }
    case 'stage':
      return `The ${sanctuaryDef(g.where).short} grows: ${g.name.toLowerCase()} in ${puzzles(g.left)}`;
    case 'home':
      return `The ${sanctuaryDef(g.where).name} opens in ${g.left === 1 ? 'one more level' : `${g.left} levels`}`;
  }
}

export function nextGoalMarkup(g: NextGoal): string {
  const art =
    g.kind === 'animal'
      ? `<span class="next-goal__art portrait is-shy">${animalPortrait(g.id as AnimalId, 'idle')}</span>`
      : `<span class="next-goal__art next-goal__art--icon">${g.kind === 'stage' ? ICON.sprout : ICON.globe}</span>`;
  return `<section class="next-goal card" data-next-goal aria-label="Next goal" style="--accent:${sanctuaryDef(g.where).accent}">
    ${art}
    <span class="next-goal__body"><small class="next-goal__kicker">Next goal</small><b>${esc(nextGoalLine(g))}</b></span>
    <button class="btn btn--small next-goal__play" data-act="play">Play level ${app.save.journey.nextLevel}</button>
  </section>`;
}

/** Shows the next goal under the scene (after its cue slot), once per visit. */
export function showNextGoal(root: HTMLElement, from: SanctuaryId): void {
  if (root.querySelector('[data-next-goal]')) return;
  const g = nextGoal(app.save, from);
  const slot = root.querySelector('[data-cue-slot]');
  if (!g || !slot) return;
  slot.after(h(nextGoalMarkup(g)));
}
