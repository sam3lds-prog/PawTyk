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
 *
 * D50 PR A, the card in focus:
 *  - While the card offers the snack, the scene's other controls step back (the parade's replay, Share, Tricks, the
 *    Tour, Walk and Photo buttons, the new stage's news line): the screen holds the newcomer, the snack and Continue.
 *    They come back the moment the welcome is over (the snack eaten, a hello said, the newcomer tapped in the scene)
 *    or when the player asks for them (*Look around first*, a quiet link on the card).
 *  - While the snack is being eaten, the card's buttons are disabled (not only dimmed), so no tap, key or screen
 *    reader can start a second snack or leave mid-meal; a status line says what is happening. Whatever ends the meal
 *    (it finishes, the player starts something else, a re-render) leaves the card on *Continue*.
 */

import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { noteFirstMeal } from '../../app/usage';
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

/** D50 PR A: the class on the home's screen while its welcome card holds the focus (styles/d50.css). */
export const WELCOMING_CLASS = 'is-welcoming';

const ORDINAL = ['first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'];

/** "Your first Farm friend", "Your third friend at the Outback". */
export function friendLine(home: SanctuaryId): string {
  const def = sanctuaryDef(home);
  const where = home === 'harmony' ? 'Pet Garden' : def.short;
  const n = def.arrivals.filter((a) => isHome(app.save, a.id as AnimalId)).length;
  if (n <= 1) return `Your first ${where} friend`;
  return n <= ORDINAL.length ? `Your ${ORDINAL[n - 1]} friend at the ${where}` : `Friend number ${n} at the ${where}`;
}

export interface WelcomeCardOptions {
  fed?: { food: string; favorite: boolean };
  /** D50 PR A: the snack is being eaten: the buttons are disabled and a status line says so. */
  eating?: boolean;
  /** D50 PR A: the card holds the focus (the scene's other controls are stepped back): offer *Look around first*. */
  focused?: boolean;
}

export function welcomeCardMarkup(animal: AnimalId, home: SanctuaryId, state: WelcomeState, o: WelcomeCardOptions | { food: string; favorite: boolean } = {}): string {
  // (D49's fourth argument was the meal itself; still accepted.)
  const opts: WelcomeCardOptions = 'food' in o ? { fed: o } : o;
  const fed = opts.fed;
  const eating = !!opts.eating;
  const a = animalInfo(animal);
  const def = sanctuaryDef(home);
  const level = app.save.journey.nextLevel;
  const snack = state === 'offer' ? welcomeSnack(app.save, animal) : null;
  const g = nextGoal(app.save, home);
  const title = state === 'fed' && fed ? `${a.name} ${fed.favorite ? 'loved' : 'enjoyed'} the ${FOOD_BY_ID[fed.food as keyof typeof FOOD_BY_ID]?.name ?? 'snack'}!` : `${a.name} is home!`;
  // Disabled, not only dimmed: a key press or a screen reader can't press a disabled button either.
  const off = eating ? ' disabled' : '';
  const cont = `<button class="btn btn--block ${snack || eating ? 'btn--secondary' : ''}" data-act="welcome-play" ${snack ? '' : 'data-autofocus'}${off}>Continue to level ${level}</button>`;
  const actions =
    state === 'fed'
      ? cont
      : eating
        ? `<button class="btn btn--block" data-act="welcome-snack" disabled>${ICON.heart}Give ${esc(a.name)} a welcome snack</button>
           <small class="welcome-card__note" role="status" tabindex="-1" data-welcome-status>${esc(a.name)} is having the snack…</small>
           ${cont}`
        : snack
          ? `<button class="btn btn--block" data-act="welcome-snack" data-autofocus>${ICON.heart}Give ${esc(a.name)} a welcome snack</button>
           <small class="welcome-card__note">${snack.gift ? 'Your first treat is on us' : `${esc(FOOD_BY_ID[snack.food].name)}, from your pantry`}</small>
           ${cont}`
          : `${cont}<button class="btn btn--quiet btn--block" data-act="welcome-hello">${ICON.paw}Say hello to ${esc(a.name)}</button>`;
  const look = opts.focused && state === 'offer' && !eating ? `<button class="welcome-card__look" data-act="welcome-look">Look around first</button>` : '';
  return `<section class="welcome-card card" data-welcome-card="${state}" data-animal="${esc(animal)}" aria-labelledby="welcome-title" style="--accent:${def.accent}">
    <div class="welcome-card__head">
      <span class="welcome-card__art portrait">${animalPortrait(animal, state === 'fed' ? 'beam' : 'happy')}</span>
      <span class="welcome-card__who"><b id="welcome-title" class="welcome-card__title">${esc(title)}</b><small>${esc(friendLine(home))}</small></span>
    </div>
    <div class="welcome-card__actions"${eating ? ' aria-busy="true"' : ''}>${actions}</div>
    ${g ? `<p class="welcome-card__next">${ICON.sprout}<span>Next: ${esc(nextGoalLine(g))}</span></p>` : ''}
    ${look}
  </section>`;
}

/**
 * Shows (or redraws) the card under the scene, after its cue slot, in place of the next-goal card. `entering` lets it
 * rise in the first time.
 */
export function showWelcomeCard(root: HTMLElement, animal: AnimalId, home: SanctuaryId, state: WelcomeState, o: { entering?: boolean } & WelcomeCardOptions = {}): HTMLElement | null {
  const slot = root.querySelector('[data-cue-slot]');
  if (!slot) return null;
  root.querySelector('[data-next-goal]')?.remove();
  const card = h(welcomeCardMarkup(animal, home, state, { fed: o.fed, eating: o.eating, focused: o.focused }));
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
  /**
   * Shows the card for `who`, the snack on offer. `o.focus: false` (D50 PR A): don't step the scene's controls back
   * (the player is already busy with something of their own: a photo, the tour, a walk).
   */
  show(who: AnimalId, entering?: boolean, o?: { focus?: boolean }): void;
  /** Gives `who` its welcome snack and plays it out in the scene (`from`: the card, or the first arrival's button). */
  snack(who: AnimalId, from: 'card' | 'arrival'): void;
  /** Draws the card again after the screen re-rendered (if one is up). */
  redraw(): boolean;
  /** The card's own buttons: true if the click was one of them. */
  onClick(t: HTMLElement): boolean;
  /**
   * D50 PR A: the player engaged with the scene (tapped the newcomer or another animal): the welcome is theirs now,
   * so the scene's controls come back.
   */
  release(): void;
  /** The newcomer the card is for, if it is up (tests and QA). */
  readonly animal: AnimalId | null;
  /** D50 PR A: whether the card holds the focus now (the scene's other controls stepped back). */
  readonly focused: boolean;
  /** D50 PR A: whether the snack is being eaten now (the card's buttons disabled). */
  readonly eating: boolean;
}

export function welcomeFlow(scope: Scope, host: WelcomeFlowHost): WelcomeFlow {
  let card: { animal: AnimalId; state: WelcomeState; fed?: { food: string; favorite: boolean }; eating?: boolean } | null = null;
  // D50 PR A: the card holds the focus while it offers the snack, until the welcome is over or the player looks around.
  let focus = false;
  const setFocus = (on: boolean) => {
    focus = on;
    host.el.classList.toggle(WELCOMING_CLASS, on);
  };
  const draw = (entering = false) => (card ? showWelcomeCard(host.el, card.animal, host.home, card.state, { entering, fed: card.fed, eating: card.eating, focused: focus }) : null);
  scope.onDispose(() => setFocus(false));
  const flow: WelcomeFlow = {
    show(who, entering = false, o = {}) {
      if (!scope.alive || !isHome(app.save, who)) return;
      card = { animal: who, state: 'offer' };
      // Focused only while there is a snack to give: with nothing to offer, the card is Continue and a hello, and the
      // scene's controls stay where they are.
      setFocus(o.focus !== false && !!welcomeSnack(app.save, who));
      draw(entering);
      track('welcome_card', { home: host.home, action: 'shown' });
    },
    snack(who, from) {
      // One snack at a time: never while a meal is playing, never twice for the same card.
      if (host.meals.active || card?.eating) return;
      const before = app.save.sanctuary.affection[who] ?? 0;
      const r = giveWelcomeSnack(app.save, who);
      if (!r || !r.ok) {
        toast(`${animalInfo(who).name} has had plenty for today.`);
        card = { animal: who, state: 'offer' };
        setFocus(false);
        draw();
        return;
      }
      noteFirstMeal(app.save, 'welcome');
      app.persist();
      track('welcome_snack', { home: host.home, gift: r.gift, favorite: r.favorite, from });
      track('animal_fed', { food: r.food, favorite: r.favorite, welcome: true });
      const fed = { food: r.food, favorite: r.favorite };
      // The card says it's happening (its buttons disabled) while the scene plays the meal. Focus waits on that line
      // (a disabled button can't hold it), so a keyboard or screen reader stays on the card and hears what's happening.
      card = { animal: who, state: 'offer', eating: true };
      const busyCard = draw();
      if (from === 'card') busyCard?.querySelector<HTMLElement>('[data-welcome-status]')?.focus({ preventScroll: true });
      let finished = false;
      const finish = () => {
        if (finished || !scope.alive) return;
        finished = true;
        card = { animal: who, state: 'fed', fed };
        // The welcome is over: the scene's controls come back (Replay, Share, Tricks…).
        setFocus(false);
        const el = draw();
        // Continue in view (it is the one thing left to do), then focused.
        if (el && typeof el.scrollIntoView === 'function') el.scrollIntoView({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
        el?.querySelector<HTMLElement>('[data-act="welcome-play"]')?.focus({ preventScroll: true });
        scope.timeout(() => scope.alive && host.afterSnack?.(), 700);
      };
      const playing = host.meals.feed({ animal: who, name: animalInfo(who).name, food: r.food, favorite: r.favorite, before, after: before + r.gained, firstMeal: r.firstMeal, firstTaste: r.firstTaste });
      // The meal settles however it ends (eaten, or stopped by something the player started): the card always moves on.
      if (playing) void playing.then(finish, finish);
      else {
        // The scene couldn't show it (the animal is busy): said in words, and the hearts as after any meal.
        feel('treat');
        toast(`${animalInfo(who).name} ${r.favorite ? 'loved' : 'enjoyed'} the ${FOOD_BY_ID[r.food].name}! +${r.gained}`, ICON.heart);
        afterHearts(scope, who, before);
        finish();
      }
    },
    redraw: () => {
      const el = draw();
      // A redraw keeps the screen's focus state with the card (the class lives on the screen, not the card).
      host.el.classList.toggle(WELCOMING_CLASS, !!el && focus);
      return !!el;
    },
    onClick(t) {
      const b = t.closest('[data-welcome-card] [data-act]') as HTMLElement | null;
      if (!b || !card) return false;
      // D50 PR A: nothing on the card does anything while the snack is being eaten (the buttons are disabled too;
      // this also covers a click dispatched at a disabled button).
      if (card.eating || host.meals.active || (b as HTMLButtonElement).disabled) return true;
      const who = card.animal;
      switch (b.dataset.act) {
        case 'welcome-snack':
          flow.snack(who, 'card');
          return true;
        case 'welcome-play':
          track('welcome_card', { home: host.home, action: 'continue', state: card.state });
          playMode({ kind: 'level', level: app.save.journey.nextLevel });
          return true;
        case 'welcome-look': {
          track('welcome_card', { home: host.home, action: 'look' });
          setFocus(false);
          draw();
          // Focus goes back to the scene's own controls, starting with its first button.
          host.el.querySelector<HTMLElement>('.sanctuary__scene button:not([hidden]), .sanctuary__under button:not([hidden])')?.focus({ preventScroll: true });
          return true;
        }
        case 'welcome-hello': {
          track('welcome_card', { home: host.home, action: 'hello' });
          setFocus(false);
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
    release() {
      if (!focus || card?.eating) return;
      setFocus(false);
      draw();
    },
    get animal() {
      return card?.animal ?? null;
    },
    get focused() {
      return focus;
    },
    get eating() {
      return !!card?.eating;
    },
  };
  return flow;
}
