/**
 * What an arrival ends with (D49 PR A): one card under the scene, with one obvious thing to do now and the way on.
 *
 * Before, a welcome ended with everything at once: the parade's replay, Tricks, Share, the new stage's news, the next
 * goal with its own Play button, and a toast, with the resident's line squeezed between buttons. Now, once the
 * newcomer's welcome has played:
 *
 *   <Name> is home!                       (who, and what they are to the player: "Your first Farm friend")
 *   [ Give <Name> a welcome snack ]       (primary: an interaction with them, right here, no menu)
 *     Your first treat is on us           (or which food from the pantry it will be)
 *   [ Continue to level N ]               (secondary: the Journey, one tap)
 *   Next: Truffle comes home in 3 more puzzles
 *
 * After the snack has been eaten the card says so and *Continue* becomes the one button. With nothing to give (the
 * pantry empty and the free snack already had, or it has eaten its fill today), Continue leads and the second button
 * is a hello. Replay, Share, Tricks and Photo stay where they always are, by the scene.
 */

import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { animalInfo, isHome, type AnimalId } from '../../meta/animals';
import { FOOD_BY_ID } from '../../meta/catalogs/foods';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { giveWelcomeSnack, welcomeSnack } from '../../meta/welcomeSnack';
import { nextGoal } from '../../meta/world';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { animalPortrait } from '../art/animals';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { afterHearts, greetInScene } from './bonding';
import type { SceneMeals } from './feeding';
import { nextGoalLine } from './nextGoal';
import type { SceneLife } from './sceneLife';
import { selectFigure } from './selection';
import { toast } from './sheet';

export type WelcomeState = 'offer' | 'fed';

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** "Your first Farm friend", "Your third friend at the Outback". */
export function friendLine(home: SanctuaryId): string {
  const def = sanctuaryDef(home);
  const where = home === 'harmony' ? 'Pet Garden' : def.short;
  const n = def.arrivals.filter((a) => isHome(app.save, a.id as AnimalId)).length;
  if (n <= 1) return `Your first ${where} friend`;
  return n <= ORDINAL.length ? `Your ${ORDINAL[n - 1]} friend at the ${where}` : `Friend number ${n} at the ${where}`;
}

export function welcomeCardMarkup(animal: AnimalId, home: SanctuaryId, state: WelcomeState, fed?: { food: string; favorite: boolean }): string {
  const a = animalInfo(animal);
  const def = sanctuaryDef(home);
  const level = app.save.journey.nextLevel;
  const snack = state === 'offer' ? welcomeSnack(app.save, animal) : null;
  const g = nextGoal(app.save, home);
  const title = state === 'fed' && fed ? `${a.name} ${fed.favorite ? 'loved' : 'enjoyed'} the ${FOOD_BY_ID[fed.food as keyof typeof FOOD_BY_ID]?.name ?? 'snack'}!` : `${a.name} is home!`;
  const cont = `<button class="btn btn--block ${snack ? 'btn--secondary' : ''}" data-act="welcome-play" ${snack ? '' : 'data-autofocus'}>Continue to level ${level}</button>`;
  const actions =
    state === 'fed'
      ? cont
      : snack
        ? `<button class="btn btn--block" data-act="welcome-snack" data-autofocus>${ICON.heart}Give ${esc(a.name)} a welcome snack</button>
           <small class="welcome-card__note">${snack.gift ? 'Your first treat is on us' : `${esc(FOOD_BY_ID[snack.food].name)}, from your pantry`}</small>
           ${cont}`
        : `${cont}<button class="btn btn--quiet btn--block" data-act="welcome-hello">${ICON.paw}Say hello to ${esc(a.name)}</button>`;
  return `<section class="welcome-card card" data-welcome-card="${state}" data-animal="${esc(animal)}" aria-labelledby="welcome-title" style="--accent:${def.accent}">
    <div class="welcome-card__head">
      <span class="welcome-card__art portrait">${animalPortrait(animal, state === 'fed' ? 'beam' : 'happy')}</span>
      <span class="welcome-card__who"><b id="welcome-title" class="welcome-card__title">${esc(title)}</b><small>${esc(friendLine(home))}</small></span>
    </div>
    <div class="welcome-card__actions">${actions}</div>
    ${g ? `<p class="welcome-card__next">${ICON.sprout}<span>Next: ${esc(nextGoalLine(g))}</span></p>` : ''}
  </section>`;
}

/**
 * Shows (or redraws) the card under the scene, after its cue slot, in place of the next-goal card. `entering` lets it
 * rise in the first time.
 */
export function showWelcomeCard(root: HTMLElement, animal: AnimalId, home: SanctuaryId, state: WelcomeState, o: { entering?: boolean; fed?: { food: string; favorite: boolean } } = {}): HTMLElement | null {
  const slot = root.querySelector('[data-cue-slot]');
  if (!slot) return null;
  root.querySelector('[data-next-goal]')?.remove();
  const card = h(welcomeCardMarkup(animal, home, state, o.fed));
  if (o.entering && !app.reducedMotion) card.classList.add('is-entering');
  const old = root.querySelector('[data-welcome-card]');
  if (old) old.replaceWith(card);
  else slot.after(card);
  // The first time, on a phone it is below the scene: brought into view (its buttons), never past the scene's top.
  if (o.entering && typeof card.scrollIntoView === 'function') card.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
  return card;
}

/** What a home's screen gives its welcome card (D49 PR A). */
export interface WelcomeFlowHost {
  el: HTMLElement;
  home: SanctuaryId;
  meals: SceneMeals;
  life: () => SceneLife | null;
  /** After the snack has been eaten (the Farm's or the Pet Garden's starter gift, after the first board). */
  afterSnack?: () => void;
}

export interface WelcomeFlow {
  /** Shows the card for `who`, the snack on offer. */
  show(who: AnimalId, entering?: boolean): void;
  /** Gives `who` its welcome snack and plays it out in the scene (`from`: the card, or the first arrival's button). */
  snack(who: AnimalId, from: 'card' | 'arrival'): void;
  /** Draws the card again after the screen re-rendered (if one is up). */
  redraw(): boolean;
  /** The card's own buttons: true if the click was one of them. */
  onClick(t: HTMLElement): boolean;
  /** The newcomer the card is for, if it is up (tests and QA). */
  readonly animal: AnimalId | null;
}

export function welcomeFlow(scope: Scope, host: WelcomeFlowHost): WelcomeFlow {
  let card: { animal: AnimalId; state: WelcomeState; fed?: { food: string; favorite: boolean } } | null = null;
  const draw = (entering = false) => (card ? showWelcomeCard(host.el, card.animal, host.home, card.state, { entering, fed: card.fed }) : null);
  const flow: WelcomeFlow = {
    show(who, entering = false) {
      if (!scope.alive || !isHome(app.save, who)) return;
      card = { animal: who, state: 'offer' };
      draw(entering);
      track('welcome_card', { home: host.home, action: 'shown' });
    },
    snack(who, from) {
      if (host.meals.active) return;
      const before = app.save.sanctuary.affection[who] ?? 0;
      const r = giveWelcomeSnack(app.save, who);
      if (!r || !r.ok) {
        toast(`${animalInfo(who).name} has had plenty for today.`);
        card = { animal: who, state: 'offer' };
        draw();
        return;
      }
      app.persist();
      track('welcome_snack', { home: host.home, gift: r.gift, favorite: r.favorite, from });
      track('animal_fed', { food: r.food, favorite: r.favorite, welcome: true });
      const fed = { food: r.food, favorite: r.favorite };
      // The card says it's happening (its buttons rest) while the scene plays the meal.
      card = { animal: who, state: 'offer' };
      draw()?.querySelector('.welcome-card__actions')?.setAttribute('aria-busy', 'true');
      const finish = () => {
        if (!scope.alive) return;
        card = { animal: who, state: 'fed', fed };
        const el = draw();
        // Continue in view (it is the one thing left to do), then focused.
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
        el?.querySelector<HTMLElement>('[data-act="welcome-play"]')?.focus({ preventScroll: true });
        scope.timeout(() => scope.alive && host.afterSnack?.(), 700);
      };
      const playing = host.meals.feed({ animal: who, name: animalInfo(who).name, food: r.food, favorite: r.favorite, before, after: before + r.gained });
      if (playing) void playing.then(finish);
      else {
        // The scene couldn't show it (the animal is busy): said in words, and the hearts as after any meal.
        feel('treat');
        toast(`${animalInfo(who).name} ${r.favorite ? 'loved' : 'enjoyed'} the ${FOOD_BY_ID[r.food].name}! +${r.gained}`, ICON.heart);
        afterHearts(scope, who, before);
        finish();
      }
    },
    redraw: () => !!draw(),
    onClick(t) {
      const b = t.closest('[data-welcome-card] [data-act]') as HTMLElement | null;
      if (!b || !card) return false;
      const who = card.animal;
      switch (b.dataset.act) {
        case 'welcome-snack':
          flow.snack(who, 'card');
          return true;
        case 'welcome-play':
          track('welcome_card', { home: host.home, action: 'continue', state: card.state });
          playMode({ kind: 'level', level: app.save.journey.nextLevel });
          return true;
        case 'welcome-hello': {
          track('welcome_card', { home: host.home, action: 'hello' });
          greetInScene(scope, who);
          const fig = host.el.querySelector<HTMLElement>(`.sanctuary__scene [data-friend="${CSS.escape(who)}"], .sanctuary__scene [data-pet="${CSS.escape(who)}"]`);
          if (fig) {
            selectFigure(scope, host.el.querySelector<HTMLElement>('.sanctuary__scene')!, fig);
            host.life()?.tap(fig);
          }
          return true;
        }
      }
      return false;
    },
    get animal() {
      return card?.animal ?? null;
    },
  };
  return flow;
}
