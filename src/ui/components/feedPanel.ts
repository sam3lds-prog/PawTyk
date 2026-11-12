/**
 * The friendship panel on a resident's or wildlife friend's card: its temperament, friendship level and what the next
 * level brings (D40), today's pat, and feeding from the pantry. Cosmetic only (D27).
 *
 * D48 PR B: feeding is a moment, not a toast. The card shows the animal's favorite foods (bought or not), the pantry
 * with favorites first and starred, and the home's feast. Choosing a food counts the meal here, then hands it to the
 * scene (`meal`), which closes the card and plays it out (`components/feeding.ts`); where there is no scene to play
 * it in (the Pets tab), the card says what happened, as before. **Get food** goes to the Shop with that animal's
 * favorite picked out, and the Shop sends the player back to this animal to feed it (`feedReturn`).
 */

import { app } from '../../app/app';
import { noteFirstMeal } from '../../app/usage';
import { FOODS, FOOD_BY_ID, isFavorite, isFeast, type FoodId } from '../../meta/catalogs/foods';
import { animalKindOf, favoriteFoods, feastGuests, feedAnimal, foodCount, fedToday, FOOD_AFFECTION_PER_DAY, friendship, serveFeast, suggestedFood } from '../../meta/feeding';
import { patFriend, pattedToday } from '../../meta/sanctuary';
import { BOND_UNLOCKS, nextUnlock } from '../../meta/bonds';
import { TEMPERAMENT_INFO, temperamentOf } from '../../meta/temperament';
import { animalInfo, isAnimalId } from '../../meta/animals';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { afterHearts } from './bonding';
import { sayHello } from './hello';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { foodIcon } from '../art/foods';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { toast } from './sheet';
import { localDateKey } from '../../game/dates';

/** A meal just counted (D48 PR B), for the scene to play out. */
export interface Meal {
  animal: string;
  name: string;
  food: FoodId;
  favorite: boolean;
  /** Affection before and after. */
  before: number;
  after: number;
  /** D49 PR C: its first meal, and its first taste of this food (a full meal; quick otherwise). Missing = unknown. */
  firstMeal?: boolean;
  firstTaste?: boolean;
}

/** A feast just served to a whole home (D48 PR B). */
export interface Feast {
  home: SanctuaryId;
  food: FoodId;
  fed: Array<{ animal: string; gained: number; before: number }>;
}

export interface FeedEvents {
  /** The animal just ate (for a happy reaction in the garden). */
  onFed?: (food: FoodId, favorite: boolean) => void;
  onPat?: () => void;
  /** The card closed (so the scene behind it can react where the player can see it). */
  onClose?: () => void;
  /**
   * D48 PR B: plays the meal in the scene. Returns true if it will (the card then closes and the scene shows what the
   * meal gave); false to keep the card open and say so here.
   */
  meal?: (m: Meal) => boolean;
  /** D48 PR B: plays a feast in the scene (everyone at home eats together). Returns true if it will. */
  feast?: (f: Feast) => boolean;
  /** Closes the card (given by the sheet that holds the panel). */
  close?: () => void;
  /**
   * D48 PR E: replays this animal's welcome celebration in the scene behind the card (it grants nothing). The card
   * shows a button for it when given.
   */
  welcome?: { label: string; play: () => void };
}

/**
 * Where the Shop sends the player back to feed an animal (D48 PR B): set by *Get food*, read once by the animal's
 * home when it opens again (it reopens that animal's card). Kept for this app session only.
 */
let feedReturnFor: string | null = null;
export function setFeedReturn(animal: string | null): void {
  feedReturnFor = animal;
}
export function feedReturn(): string | null {
  return feedReturnFor;
}
/** The animal to reopen, once, if it lives in `home`. */
export function takeFeedReturn(home: SanctuaryId): string | null {
  const a = feedReturnFor;
  if (!a || !isAnimalId(a) || animalInfo(a).sanctuary !== home) return null;
  feedReturnFor = null;
  return a;
}

const homeOf = (animal: string): SanctuaryId | null => (isAnimalId(animal) ? animalInfo(animal).sanctuary : null);

/**
 * D50 PR C: when today's hello or pat is all it takes for the next level, the card says so (each is one heart, once a
 * day). Nothing when it's further off: no to-do list.
 */
function nearLine(animal: string, hearts: number, patted: boolean): string {
  const helloLeft = app.save.sanctuary.greeted[animal] !== localDateKey();
  if (hearts === 1 && (helloLeft || !patted)) return `. ${helloLeft && !patted ? 'A hello or a pat' : helloLeft ? 'A hello in the scene' : 'A pat'} today gets you there.`;
  if (hearts === 2 && helloLeft && !patted) return '. A hello and a pat today get you there.';
  return '';
}

export function friendPanelMarkup(animal: string, name: string): string {
  const aff = app.save.sanctuary.affection[animal] ?? 0;
  const f = friendship(aff);
  const pct = f.next === null ? 100 : Math.round(((aff - f.from) / (f.next - f.from)) * 100);
  const kind = animalKindOf(animal);
  const isFav = (id: FoodId) => !!kind && isFavorite(FOOD_BY_ID[id], kind) && FOOD_BY_ID[id].favorites !== 'all';
  // The pantry, favorites first (D48 PR B), then the treats everyone loves, then the rest; feasts last.
  const rank = (id: FoodId) => (isFeast(FOOD_BY_ID[id]) ? 3 : isFav(id) ? 0 : FOOD_BY_ID[id].favorites === 'all' ? 1 : 2);
  const owned = FOODS.filter((x) => foodCount(app.save, x.id) > 0)
    .map((x) => x.id)
    .sort((a, b) => rank(a) - rank(b));
  const full = fedToday(app.save, animal) >= FOOD_AFFECTION_PER_DAY;
  const patted = pattedToday(app.save, animal);
  const t = TEMPERAMENT_INFO[temperamentOf(animal)];
  const next = nextUnlock(app.save, animal);
  const favs = favoriteFoods(animal);
  const home = homeOf(animal);
  // What friendship has brought so far, and what's still to come: a row of small marks, never a to-do list.
  const unlocks = BOND_UNLOCKS.map((u, lvl) =>
    u ? `<li class="${f.level >= lvl ? 'is-on' : ''}">${f.level >= lvl ? ICON.check : ICON.heart}<span>${esc(u.short)}</span></li>` : '',
  ).join('');
  const chip = (id: FoodId) => {
    const x = FOOD_BY_ID[id];
    const fav = isFav(id);
    const feast = isFeast(x);
    const label = feast
      ? `Serve the ${x.name} to everyone at the ${home ? sanctuaryDef(home).short : 'home'}. ${foodCount(app.save, id)} left`
      : `Give ${x.name}${fav ? ', a favorite' : ''}. ${foodCount(app.save, id)} left`;
    return `<li><button class="feed-btn ${fav ? 'is-fav' : ''} ${feast ? 'is-feast' : ''}" data-feed="${x.id}" aria-label="${esc(label)}">${foodIcon(x.id)}<span class="num">${foodCount(app.save, id)}</span>${fav ? `<i class="feed-btn__fav" aria-hidden="true">${ICON.star}</i>` : ''}</button></li>`;
  };
  const favLine = favs.length
    ? `<p class="friend-panel__favs"><span>${esc(name)} loves</span>${favs
        .slice(0, 4)
        .map((id) => `<span class="friend-panel__fav" title="${esc(FOOD_BY_ID[id].name)}">${foodIcon(id)}<span class="sr-only">${esc(FOOD_BY_ID[id].name)}</span></span>`)
        .join('')}</p>`
    : '';
  const getLabel = owned.some((id) => isFav(id)) ? 'More food' : `Get food ${esc(name)} loves`;
  return `<div class="friend-panel" data-friend-panel="${esc(animal)}">
    <p class="friend-panel__temper"><span class="chip chip--temper" data-temper="${temperamentOf(animal)}">${esc(t.label)}</span><span>${esc(name)} ${esc(t.greets)}.</span></p>
    <div class="friend-panel__level">
      <span class="affection">${ICON.heart}<span class="num">${aff}</span></span>
      <span class="friend-panel__name"><b>${esc(f.name)}</b>${next ? `<small>${next.hearts} ${next.hearts === 1 ? 'heart' : 'hearts'} to ${esc(next.level)}: ${esc(next.name.charAt(0).toLowerCase() + next.name.slice(1))}${nearLine(animal, next.hearts, patted)}</small>` : '<small>As close as can be</small>'}</span>
    </div>
    <span class="rank-bar" role="progressbar" aria-label="${esc(name)} friendship" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
    <ul class="friend-panel__unlocks" aria-label="What friendship brings">${unlocks}</ul>
    <button class="btn btn--secondary btn--block" data-act="pat" ${patted ? 'disabled' : ''}>${ICON.heart}${patted ? 'Patted today' : `Give ${esc(name)} a pat`}</button>
    <div class="friend-panel__feed">
      <b class="friend-panel__title">Feed ${esc(name)}</b>
      ${favLine}
      ${
        full
          ? `<p class="muted">${esc(name)} has had plenty for today, and is very content.</p>`
          : owned.length
            ? `<ul class="feed-row">${owned.map(chip).join('')}</ul>`
            : `<p class="muted">Your pantry is empty.</p>`
      }
      <button class="btn btn--quiet btn--block feed-more" data-act="get-food">${ICON.bag}${getLabel}</button>
    </div>
  </div>`;
}

/** Wires pat and feed buttons inside a sheet. Re-renders the panel in place after each action. */
export function bindFriendPanel(scope: Scope, root: HTMLElement, animal: string, name: string, ev: FeedEvents = {}): void {
  const rerender = () => {
    const p = root.querySelector('[data-friend-panel]');
    if (p) p.outerHTML = friendPanelMarkup(animal, name);
  };
  // Outside the panel, so feeding and patting (which redraw the panel) leave it be.
  if (ev.welcome)
    root
      .querySelector('[data-friend-panel]')
      ?.insertAdjacentHTML('afterend', `<button class="btn btn--secondary btn--block pet-sheet__replay" data-act="replay-welcome">${ICON.sparkle}<span>${esc(ev.welcome.label)}</span></button>`);
  scope.on(root, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="replay-welcome"]') && ev.welcome) {
      // The card makes way and the welcome plays in the scene behind it.
      ev.close?.();
      ev.welcome.play();
      return;
    }
    const pat = t.closest('[data-act="pat"]') as HTMLButtonElement | null;
    if (pat && !pat.disabled) {
      const before = app.save.sanctuary.affection[animal] ?? 0;
      if (patFriend(app.save, animal)) {
        app.persist();
        sayHello(animal);
        ev.onPat?.();
        rerender();
        afterHearts(scope, animal, before);
      }
      return;
    }
    if (t.closest('[data-act="get-food"]')) {
      // To the Shop's food, this animal's favorite picked out; the Shop brings the player back here to feed it.
      const home = homeOf(animal);
      setFeedReturn(animal);
      track('store_open', { tab: 'food', from: 'feed' });
      ev.close?.();
      app.router.go({ screen: 'shop', tab: 'food', ...(home ? { sanctuary: home } : {}), food: suggestedFood(animal), feedFor: animal });
      return;
    }
    const fb = t.closest('[data-feed]') as HTMLElement | null;
    if (!fb) return;
    const food = fb.dataset.feed as FoodId;
    const def = FOOD_BY_ID[food];
    if (isFeast(def)) {
      serve(food);
      return;
    }
    const before = app.save.sanctuary.affection[animal] ?? 0;
    const r = feedAnimal(app.save, animal, food);
    if (!r.ok) {
      toast(r.reason === 'full' ? `${name} has had plenty for today.` : 'None left in your pantry.');
      rerender();
      return;
    }
    noteFirstMeal(app.save, 'card');
    app.persist();
    track('animal_fed', { food, favorite: r.favorite });
    ev.onFed?.(food, r.favorite);
    const meal: Meal = { animal, name, food, favorite: r.favorite, before, after: before + r.gained, firstMeal: r.firstMeal, firstTaste: r.firstTaste };
    // In a scene: the card makes way and the meal is played out there (its friendship news comes after it).
    if (ev.meal?.(meal)) {
      ev.close?.();
      return;
    }
    feel('treat');
    toast(`${name} ${r.favorite ? 'loved' : 'enjoyed'} the ${def.name}! +${r.gained}`, ICON.heart);
    rerender();
    afterHearts(scope, animal, before);
  });

  /** A feast: served to everyone at this animal's home. */
  function serve(food: FoodId): void {
    const home = homeOf(animal);
    if (!home) return;
    const guests = feastGuests(app.save, home);
    const before = Object.fromEntries(guests.map((g) => [g, app.save.sanctuary.affection[g] ?? 0]));
    const r = serveFeast(app.save, home, food);
    if (!r.ok) {
      toast(r.reason === 'full' ? 'Everyone here has had plenty for today.' : r.reason === 'nobody' ? 'Nobody lives here yet.' : 'None left in your pantry.');
      rerender();
      return;
    }
    // A feast can be a player's first meal too (D49 PR E).
    noteFirstMeal(app.save, 'card');
    app.persist();
    track('animal_fed', { food, favorite: true, feast: true, guests: r.fed.length });
    const feast: Feast = { home, food, fed: r.fed.map((x) => ({ ...x, before: before[x.animal] ?? 0 })) };
    if (ev.feast?.(feast)) {
      ev.close?.();
      return;
    }
    feel('treat');
    toast(`A ${FOOD_BY_ID[food].name} for everyone at the ${sanctuaryDef(home).short}!`, ICON.heart);
    rerender();
    for (const x of feast.fed) afterHearts(scope, x.animal, x.before);
  }
}
