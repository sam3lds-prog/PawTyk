/**
 * Animal album (D35): every animal, sanctuary by sanctuary in the order they come home, with who is on the way next
 * and favorites. Reached from the World map.
 */

import { app } from '../../app/app';
import type { PetId } from '../../meta/catalogs/pets';
import { isPetId } from '../../meta/catalogs/pets';
import { portrait, showPetSheet } from '../components/petSheet';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { coinPill } from '../components/wallet';
import type { CompanionId } from '../../meta/catalogs/companions';
import { sanctuaryDef, type SanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { wireFolds } from '../components/fold';
import { animalInfo, animalsOf, isHome, nextArrivalIn } from '../../meta/animals';
import { activeSanctuary, arrivalProgress, isOpen, worldIds } from '../../meta/world';
import { friendPortrait, showFriendSheet } from './sanctuary';

type Filter = 'all' | 'home' | 'fav';
let lastFilter: Filter = 'all';

export const petsScreen: ScreenDef = {
  tab: 'world',
  title: 'Animals',
  mount(root, scope) {
    const el = h(`<div class="pets"></div>`);
    root.appendChild(el);

    const show = (id: string) => {
      const save = app.save;
      return lastFilter === 'all' ? true : lastFilter === 'home' ? isHome(save, id as PetId) : !!save.inventory.favorites[id];
    };
    function cardsOf(sd: SanctuaryDef): string {
      const save = app.save;
      const nextId = nextArrivalIn(save, sd.id)?.id;
      const open = isOpen(save, sd.id);
      return animalsOf(sd.id)
        .filter(show)
        .map((id) => {
          const a = animalInfo(id);
          const ownsIt = isHome(save, id);
          const fav = !!save.inventory.favorites[id];
          const isNext = !ownsIt && id === nextId;
          const when = !open ? `Opens after level ${sd.opensAfterLevel}` : isNext ? 'Coming home next' : 'Arrives later';
          const attr = isPetId(id) ? `data-pet="${id}"` : `data-friend="${id}"`;
          const shown = ownsIt || (isNext && open);
          const art = isPetId(id) ? portrait(id, ownsIt ? 'happy' : 'idle', !shown) : friendPortrait(id as CompanionId, !shown);
          return `<li><button class="pet-card card card--tap ${ownsIt ? '' : 'is-locked'}" ${attr} aria-label="${esc(ownsIt ? `${a.name} the ${a.noun}, ${a.trait}${fav ? ', favorite' : ''}` : `${shown ? a.name : `A ${a.noun}`}. ${when}`)}">
                ${fav ? `<span class="pet-card__fav" aria-hidden="true">${ICON.heart}</span>` : ''}
                ${art}
                <span class="pet-card__name">${shown ? esc(a.name) : '???'}</span>
                <span class="pet-card__trait">${ownsIt ? esc(a.trait) : esc(when)}</span>
                <span class="chip">${esc(a.kind)}</span>
              </button></li>`;
        })
        .join('');
    }
    wireFolds(scope, el, (key) => cardsOf(sanctuaryDef(key as SanctuaryId)));

    function render(): void {
      const save = app.save;
      const building = activeSanctuary(save);
      // Every home in this save's world (D39: the open places of the endless world and the next one too).
      const homes = worldIds(save).map(sanctuaryDef);
      const all = homes.flatMap((s) => animalsOf(s.id));
      const homeCount = all.filter((a) => isHome(save, a)).length;
      const coming = building ? arrivalProgress(save, building) : null;
      const filters: Array<[Filter, string]> = [
        ['all', 'All'],
        ['home', 'Home'],
        ['fav', 'Favorites'],
      ];
      // A long world (D39) folds each finished home's group; its cards are drawn when it opens. Favorites stay unfolded.
      const long = homes.length > 8 && lastFilter !== 'fav';
      const groups = homes.map((sd) => {
        const ids = animalsOf(sd.id).filter(show);
        if (!ids.length) return '';
        const n = animalsOf(sd.id).filter((a) => isHome(save, a)).length;
        const head = `<h3>${esc(sd.name)}</h3><span class="muted num">${n} of ${sd.arrivals.length}</span>`;
        if (long && n === sd.arrivals.length)
          return `<details class="album__group album__fold" data-fold="${sd.id}" aria-label="${esc(sd.name)}">
            <summary class="section-head">${head}${ICON.chevron}</summary>
            <ul class="pet-grid" data-fold-body></ul>
          </details>`;
        return `<section class="album__group" aria-label="${esc(sd.name)}">
          <div class="section-head">${head}</div>
          <ul class="pet-grid">${cardsOf(sd)}</ul>
        </section>`;
      }).join('');
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h1 data-autofocus>Animal album</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <p class="muted pets__count">${homeCount} of ${all.length} animals have come home</p>
        ${
          coming && building
            ? (() => {
                const a = animalInfo(coming.next.id);
                const span = Math.max(1, coming.need - coming.from);
                return `<div class="next-arrival card">
                  ${isPetId(coming.next.id) ? portrait(coming.next.id, 'idle') : friendPortrait(coming.next.id as CompanionId)}
                  <div class="next-arrival__body">
                    <b>${esc(a.name)} the ${esc(a.noun)} is on the way</b>
                    <span class="muted">${plural(coming.left, 'more puzzle')} while you build the ${esc(sanctuaryDef(building).short)}.</span>
                    <div class="progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${coming.from}" aria-valuemax="${coming.need}" aria-valuenow="${coming.have}"><span style="width:${Math.round(((coming.have - coming.from) / span) * 100)}%"></span></div>
                  </div>
                </div>`;
              })()
            : ''
        }
        <div class="segmented" role="tablist" aria-label="Filter animals">
          ${filters.map(([f, l]) => `<button role="tab" data-filter="${f}" aria-selected="${lastFilter === f}">${l}</button>`).join('')}
        </div>
        ${groups || `<p class="empty">${lastFilter === 'fav' ? 'Tap an animal who has come home and add them to your favorites.' : 'Nobody has come home yet.'}</p>`}`;
    }
    render();

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const f = t.closest('[data-filter]') as HTMLElement | null;
      if (f) {
        lastFilter = f.dataset.filter as Filter;
        render();
        (el.querySelector(`[data-filter="${lastFilter}"]`) as HTMLElement | null)?.focus();
        return;
      }
      if (t.closest('[data-act="back"]')) {
        app.router.back({ screen: 'world' });
        return;
      }
      const friend = t.closest('[data-friend]') as HTMLElement | null;
      if (friend) {
        showFriendSheet(scope, friend.dataset.friend as CompanionId);
        return;
      }
      const card = t.closest('[data-pet]') as HTMLElement | null;
      if (card) showPetSheet(scope, card.dataset.pet as PetId, { onChange: render });
    });
  },
};
