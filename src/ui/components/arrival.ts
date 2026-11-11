/**
 * The first arrival (D41 PR A): the first puzzle brings Cotton home, and instead of a results sheet the player sees it
 * happen — the Farm as it was, the change their puzzle made growing in, Cotton settling into it and saying hello —
 * then a clear goal: who comes home next, how many puzzles away, and the level that starts it.
 *
 * About five seconds, in four steps; Skip (or Escape) jumps straight to the goal, and under reduced motion the goal is
 * all there is, the scene already as it is now. Nothing here is required reading: the buttons work from the start.
 *
 * D49 PR A: it ends on two buttons, in order: **Give Cotton a welcome snack** (the first treat is on the house: the
 * Farm opens and she eats it there, the first thing the player does with an animal) and **Continue to level 2**.
 */

import { app } from '../../app/app';
import { animalInfo, type AnimalId } from '../../meta/animals';
import { sanctuaryDef, type RegionId } from '../../meta/catalogs/sanctuaries';
import { shownDecorIds } from '../../meta/sanctuary';
import { arrivalProgress, markSeen, stageOf } from '../../meta/world';
import { welcomeSnack } from '../../meta/welcomeSnack';
import { TEMPERAMENT_INFO, temperamentOf } from '../../meta/temperament';
import { feel } from '../../services/feel';
import { track } from '../../services/analytics';
import { animalPortrait } from '../art/animals';
import { regionScene } from '../art/regions';
import { SCENE_VIEWBOX } from '../art/sanctuary';
import type { FriendId } from '../art/companions';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { startSceneLife } from './sceneLife';
import { spotlightNewcomer } from './newcomer';

/** When each step starts (ms after the overlay opens). */
export const ARRIVAL_STEPS = { grow: 900, arrive: 2100, hello: 3000, goal: 4200 } as const;

export interface ArrivalOptions {
  animal: AnimalId;
  where: RegionId;
  /** The stage the solve reached, if it reached one (it grows in); otherwise only the newcomer is new. */
  stageUp: number | null;
  /** The level the main button starts. */
  nextLevel: number | null;
  /** What the solve also earned, in a few words ("+45 coins · 2 badges"), shown small under the goal. */
  holds: string[];
  onPlay: () => void;
  /** D49 PR A: to the home, where the newcomer has its welcome snack at once. */
  onSnack: () => void;
  /** To the home, its Welcome Parade first (only offered when there is no snack to give). */
  onVisit: () => void;
}

export function showFirstArrival(scope: Scope, root: HTMLElement, o: ArrivalOptions): void {
  const sc = scope.child();
  const def = sanctuaryDef(o.where);
  const a = animalInfo(o.animal);
  const t = TEMPERAMENT_INFO[temperamentOf(o.animal)];
  const save = app.save;
  // Everyone at home now, the newcomer included; the scene is drawn as it is now and the new parts start hidden.
  const home = def.arrivals.map((x) => x.id as string).filter((id) => !!save.inventory.companions[id]) as FriendId[];
  const stage = stageOf(save, o.where);
  const svg = regionScene(o.where, { stage, companions: home, decor: shownDecorIds(save, o.where), evening: false }, 'arrival');
  const before = o.stageUp ? def.stages[o.stageUp - 1] : def.stages[stage];
  const after = o.stageUp ? def.stages[o.stageUp] : null;
  const next = arrivalProgress(save, o.where);
  const nextInfo = next ? animalInfo(next.next.id as AnimalId) : null;
  const span = next ? Math.max(1, next.need - next.from) : 1;
  const pct = next ? Math.round(((next.have - next.from) / span) * 100) : 0;
  // D49 PR A: what the newcomer's welcome snack would be (the first is free), if it can have one.
  const snack = welcomeSnack(save, o.animal);

  const el = h(`<div class="arrival" role="dialog" aria-modal="true" aria-labelledby="arrival-title" style="--accent:${def.accent}">
    <div class="arrival__inner">
      <div class="arrival__top">
        <p class="arrival__where">${ICON.pin}${esc(def.name)}</p>
        <button class="btn btn--quiet arrival__skip" data-act="skip">Skip</button>
      </div>
      <figure class="arrival__scene sanctuary__scene is-live">
        <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(`The ${def.name}${after ? `: ${after.change}` : ''}. ${a.name} the ${a.noun} lives here now.`)}">${svg}</svg>
      </figure>
      <div class="arrival__caption" aria-live="polite">
        <h2 id="arrival-title" class="arrival__title" data-caption-title>${esc(before.name)}</h2>
        <p class="arrival__line" data-caption-line>${esc(before.change)}.</p>
      </div>
      <section class="arrival__goal" data-arrival-goal aria-label="Next goal" hidden>
        <p class="arrival__kicker">Next goal</p>
        ${
          next && nextInfo
            ? `<div class="arrival__next">
                <span class="arrival__next-art portrait is-shy">${animalPortrait(next.next.id as AnimalId, 'idle')}</span>
                <span class="arrival__next-body">
                  <b>Bring ${esc(nextInfo.name)} the ${esc(nextInfo.noun)} home</b>
                  <span class="progress world-progress" role="progressbar" aria-label="${esc(nextInfo.name)} coming home" aria-valuemin="${next.from}" aria-valuemax="${next.need}" aria-valuenow="${next.have}"><span style="width:${pct}%"></span></span>
                  <small>${next.left === 1 ? 'One more puzzle' : `${next.left} more puzzles`}, and ${esc(nextInfo.name)} moves in.</small>
                </span>
              </div>`
            : `<p class="arrival__line">Every puzzle grows the ${esc(def.short)}.</p>`
        }
        <div class="arrival__actions">
          ${
            snack
              ? `<button class="btn btn--block" data-act="snack">${ICON.heart}Give ${esc(a.name)} a welcome snack</button>
                 <small class="arrival__note">${snack.gift ? 'Your first treat is on us' : 'From your pantry'}</small>`
              : ''
          }
          ${o.nextLevel ? `<button class="btn btn--block ${snack ? 'btn--secondary' : ''}" data-act="play">Continue to level ${o.nextLevel}</button>` : ''}
          ${snack ? '' : `<button class="btn btn--quiet" data-act="visit">${ICON.home}Visit the ${esc(def.short)}</button>`}
        </div>
        ${o.holds.length ? `<p class="arrival__holds">${esc(o.holds.join(' · '))}</p>` : ''}
      </section>
    </div>
  </div>`);
  root.appendChild(el);
  // The player sees the news here, so the World's "New" marker for it is already read.
  markSeen(save, o.where);
  app.persist();
  track('onboarding_step', { step: 'first_arrival' });

  const scene = el.querySelector<SVGSVGElement>('.arrival__scene svg')!;
  const life = startSceneLife(scene, 'arrival');
  sc.onDispose(() => life.dispose());
  const fig = scene.querySelector<HTMLElement>(`.sanctuary__pet[data-friend="${o.animal}"]`);
  const grown = o.stageUp ? [...scene.querySelectorAll<HTMLElement>(`.sp-stage[data-stage="${o.stageUp}"]`)] : [];
  const title = el.querySelector('[data-caption-title]')!;
  const line = el.querySelector('[data-caption-line]')!;
  const goal = el.querySelector<HTMLElement>('[data-arrival-goal]')!;
  let step = 0;
  let chimed = false;
  const caption = (tt: string, ll: string) => {
    title.textContent = tt;
    line.textContent = ll;
  };
  const arrivedCaption = () => caption(`${a.name} is home!`, `Your new ${a.noun}. ${t.label}: ${a.name} ${t.greets}.`);

  const toGrow = () => {
    step = 1;
    for (const g of grown) {
      g.classList.remove('is-waiting');
      g.classList.add('is-new', 'is-fresh');
    }
    if (after) caption('Your puzzle grew it!', `${after.change}.`);
  };
  const toArrive = () => {
    step = 2;
    fig?.classList.remove('is-waiting');
    fig?.classList.add('is-arriving');
    // The newcomer is easy to find: the same soft ring on the ground as a Meet (D39).
    spotlightNewcomer(sc, scene, o.animal);
    arrivedCaption();
    if (!chimed) feel('arrival');
    chimed = true;
  };
  const toHello = () => {
    step = 3;
    fig?.classList.remove('is-arriving');
    life.play(`friend:${o.animal}`, 'greet');
  };
  const toGoal = (focus = true) => {
    // Skipped before the newcomer appeared: it is still easy to find (the ring a Meet gives).
    if (step < 2) spotlightNewcomer(sc, scene, o.animal);
    step = 4;
    for (const g of grown) g.classList.remove('is-waiting', 'is-new');
    fig?.classList.remove('is-waiting', 'is-arriving');
    arrivedCaption();
    goal.hidden = false;
    el.classList.add('is-done');
    // On a short phone the goal is below the scene: bring its buttons into view.
    if (typeof goal.scrollIntoView === 'function') goal.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
    if (focus) el.querySelector<HTMLElement>('[data-act="snack"], [data-act="play"], [data-act="visit"]')?.focus({ preventScroll: true });
  };

  // The steps run in their own scope, so Skip stops the ones still to come (none replays behind the goal).
  const steps = sc.child();
  if (app.reducedMotion) {
    // Still: the scene as it is now, the news, the goal (focused, since there is nothing to skip). The chime still
    // says someone new is here.
    toArrive();
    toGoal();
  } else {
    for (const g of grown) g.classList.add('is-waiting');
    fig?.classList.add('is-waiting');
    steps.timeout(toGrow, ARRIVAL_STEPS.grow);
    steps.timeout(toArrive, ARRIVAL_STEPS.arrive);
    steps.timeout(toHello, ARRIVAL_STEPS.hello);
    steps.timeout(() => toGoal(), ARRIVAL_STEPS.goal);
    el.querySelector<HTMLElement>('[data-act="skip"]')?.focus({ preventScroll: true });
  }

  // A modal: what is behind it can't be reached until it closes (the screen is left then, or given back).
  const behind = [...root.children].filter((n): n is HTMLElement => n !== el && n instanceof HTMLElement && !n.inert);
  for (const n of behind) n.inert = true;
  sc.onDispose(() => {
    for (const n of behind) n.inert = false;
  });

  const skip = () => {
    if (step >= 4) return;
    steps.dispose();
    if (!chimed) feel('arrival');
    chimed = true;
    track('onboarding_step', { step: 'first_arrival_skipped' });
    toGoal();
  };
  const close = (then: () => void) => {
    sc.dispose();
    el.remove();
    then();
  };
  sc.on(el, 'click', (e) => {
    const act = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!act) return;
    if (act.dataset.act === 'skip') skip();
    else if (act.dataset.act === 'play') {
      track('welcome_card', { home: o.where, action: 'continue', from: 'first_arrival' });
      close(o.onPlay);
    } else if (act.dataset.act === 'snack') close(o.onSnack);
    else if (act.dataset.act === 'visit') close(o.onVisit);
  });
  sc.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape') skip();
    else if (ke.key === 'Tab') {
      // Tab stays inside, as in a sheet.
      // Skip is hidden once the goal is up.
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled])')].filter(
        (b) => !b.closest('[hidden]') && !(b.dataset.act === 'skip' && el.classList.contains('is-done')),
      );
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const inside = el.contains(document.activeElement);
      if (ke.shiftKey && (document.activeElement === first || !inside)) {
        ke.preventDefault();
        last.focus();
      } else if (!ke.shiftKey && (document.activeElement === last || !inside)) {
        ke.preventDefault();
        first.focus();
      }
    }
  });
}
