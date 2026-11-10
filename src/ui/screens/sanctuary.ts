/**
 * The Pet Garden on Harmony Isle (D35): the illustrated garden with every owned decoration and every animal who has come
 * home, its animals in the order they arrive (the bunny, the cats and dogs, two woodland visitors), who is coming home
 * next, and the decorations you own (show / hide). New arrivals are introduced here, and after the very first board the
 * player picks one of two free starter gifts (here or on the Farm, whichever they visit first).
 */

import { hasUnlock } from '../../meta/bonds';
import { greetInScene } from '../components/bonding';
import { showNextGoal } from '../components/nextGoal';
import { cueFigure, figureNear, ringCued, selectFigure } from '../components/selection';
import { app } from '../../app/app';
import { buildHereMessage, playMode } from '../../app/gameFlow';
import { DECOR, DECOR_BY_ID, STARTER_DECOR, decorHome, decorOf, type DecorId } from '../../meta/catalogs/decor';
import type { PetId } from '../../meta/catalogs/pets';
import { chooseStarter, isShown, owns, sanctuaryChat, setShown, shownDecorIds } from '../../meta/sanctuary';
import { bindFriendPanel, friendPanelMarkup, type FeedEvents } from '../components/feedPanel';
import { unlockedCompanions, unlockedPets } from '../../meta/rewards';
import { COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { companionSvg, wearsNeckerchief, type FriendId } from '../art/companions';
import { speciesById } from '../../meta/catalogs/species/index';
import { isWildId, wildDef } from '../../meta/catalogs/places';
import { animalInfo, animalsOf, isHome, nextArrivalIn, type AnimalId } from '../../meta/animals';
import { activeSanctuary, arrivalLine, arrivalProgress, markSeen, setActive } from '../../meta/world';
import { isPetId } from '../../meta/catalogs/pets';
import { animalPortrait, animalTint } from '../art/animals';
import { greetAll, startSceneLife, type SceneLife } from '../components/sceneLife';
import { animalName, startSceneActivities, type ActivityRunner } from '../components/activities';
import { mountTrickTray } from '../components/tricks';
import { createScene3D } from '../components/scene3d';
import { SceneCamera } from '../components/camera';
import { sceneParades } from '../components/parade';
import { sceneCloseUps } from '../components/closeup';
import { figureId } from '../components/sceneLife';
import { trickBadge } from '../art/tricks';
import { localDateKey } from '../../game/dates';
import { track } from '../../services/analytics';
import { afterDecorChange, afterSanctuaryVisit } from '../../app/events';
import { feel } from '../../services/feel';
import { decorIcon, sanctuaryScene, SCENE_VIEWBOX } from '../art/sanctuary';
import { portrait, showPetSheet } from '../components/petSheet';
import { openSheet, toast } from '../components/sheet';
import { dismissSceneCue, sceneCue, sceneCueMarkup, type SceneCue } from '../components/sceneCues';
import { actionOf, esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Route, Scope, ScreenDef } from '../router';
import { coinPill } from '../components/wallet';
import { NEW_CHIP, spotlightNewcomer } from '../components/newcomer';

export function shownDecor(): DecorId[] {
  return shownDecorIds(app.save);
}

/** Local evening (7 pm to 6 am): a dusk wash and fireflies. */
export function isEvening(d = new Date()): boolean {
  const h = d.getHours();
  return h >= 19 || h < 6;
}

/** The sanctuary picture for the current save (used here, live, and on Home, still). */
export function sceneMarkup(id: string): string {
  return sanctuaryScene({ decor: shownDecor(), pets: unlockedPets(app.save), companions: unlockedCompanions(app.save), evening: isEvening() }, id);
}

/** Portrait for a wildlife friend, matching resident portraits. */
export function friendPortrait(id: FriendId, locked = false): string {
  // A good friend (D40 PR B) beams on its card.
  const mood = locked ? 'idle' : hasUnlock(app.save, id, 'expression') ? 'beam' : 'happy';
  return `<span class="portrait${locked ? ' is-locked' : ''}" style="--tint:${animalTint(id) ?? 'var(--surface-2)'}">${companionSvg(id, mood)}</span>`;
}

export const sanctuaryScreen: ScreenDef = {
  tab: 'world',
  title: 'Sanctuary',
  mount(root, scope, route: Route) {
    // Newcomers to introduce: from this win, or who came home while the player was elsewhere (the "New" marker).
    const unseen = markSeen(app.save, 'harmony');
    const welcome = [...new Set([...(route.screen === 'sanctuary' ? (route.welcome ?? []) : []), ...((unseen?.animals ?? []) as AnimalId[])])];
    track('sanctuary_open', { pets: unlockedPets(app.save).length, decor: shownDecor().length });
    app.save.sanctuary.visits++;
    const news = afterSanctuaryVisit();
    app.persist();
    for (const a of news.achievements) toast(`Badge unlocked: ${a.name}`);

    const el = h(`<div class="sanctuary"></div>`);
    root.appendChild(el);

    // Tricks: a tray under the scene for the animal you tap (kept across re-renders).
    const trayHost = h(`<div class="trick-tray-slot" hidden></div>`);
    const tricksBtn = () => el.querySelector<HTMLElement>('[data-act="tricks"]');
    const tray = mountTrickTray(scope, trayHost, () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), {
      returnFocus: tricksBtn,
      onToggle: (open) => tricksBtn()?.setAttribute('aria-expanded', String(open)),
      // A trick gets its close-up (D44 PR F).
      onPlayed: (fig, trick) => closeups.play(fig, trick),
    });

    // ---------------------------------------------------------------- ambient life (D24)
    let life: SceneLife | null = null;
    let acts: ActivityRunner | null = null;
    // 3D toys over the drawn scene (D34); kept across re-renders.
    const s3d = createScene3D();
    // The scene camera (D44 PR C) and the Welcome Parade (D44 PR E), as on the Farm.
    const camera = new SceneCamera({ reducedMotion: () => app.reducedMotion, onView: (v) => s3d.setView(v) });
    const parades = sceneParades(scope, {
      el,
      camera,
      pause: (on) => {
        life?.setLive(!on && !document.hidden);
        acts?.setLive(!on && !document.hidden);
      },
      closeTray: () => {
        // A parade takes the camera: a trick's close-up ends first.
        closeups.cancel();
        if (tray.isOpen) tray.close();
      },
      reducedMotion: () => app.reducedMotion,
    });
    const closeups = sceneCloseUps({
      host: () => el.querySelector<HTMLElement>('.sanctuary__scene'),
      svg: () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'),
      camera,
      reducedMotion: () => app.reducedMotion,
      pause: (on) => {
        life?.setLive(!on && !document.hidden);
        acts?.setLive(!on && !document.hidden);
      },
      react: (fig, action) => life?.play(figureId(fig as unknown as HTMLElement), action),
    });
    scope.onDispose(() => {
      life?.dispose();
      acts?.dispose();
      camera.dispose();
      s3d.dispose();
    });
    scope.on(document, 'visibilitychange', () => {
      if (document.hidden) closeups.cancel();
      life?.setLive(!document.hidden && !parades.active);
      acts?.setLive(!document.hidden && !parades.active);
      s3d.setLive(!document.hidden);
    });

    function wireLife(): void {
      life?.dispose();
      acts?.dispose();
      const svg = el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      life = svg ? startSceneLife(svg, 'sanct') : null;
      acts = svg ? startSceneActivities(svg, el.querySelector('[data-chat]'), () => app.reducedMotion, animalName) : null;
      // The tap cue names an animal (the newcomer if there is one) and rings it (D40).
      const slot = el.querySelector('[data-cue-slot]');
      const cue = sceneCue(!!svg?.querySelector('.sanctuary__pet'), !!svg?.querySelector('[data-decor].has-act'));
      const cued = cue === 'tap' ? cueFigure(svg, welcome[0]) : null;
      if (slot) slot.innerHTML = sceneCueMarkup(cue, cued?.dataset.name);
      ringCued(cued);
      s3d.attach(el.querySelector<HTMLElement>('.sanctuary__scene'), svg);
      camera.attach(el.querySelector<HTMLElement>('.sanctuary__scene'), svg);
      const btn = tricksBtn();
      if (btn) btn.hidden = !svg?.querySelector('.sanctuary__pet');
      el.querySelector('.sanctuary__under')?.after(trayHost);
      tray.refresh();
      if (goalShown) showNextGoal(el, 'harmony');
    }
    let goalShown = false;

    /** Feeding or patting from a card: the animal reacts in the garden once the card is closed. */
    function reactions(figure: string): FeedEvents {
      let fed = false;
      let patted = false;
      return {
        onFed: () => (fed = true),
        onPat: () => (patted = true),
        onClose: () => {
          if (fed || patted) scope.timeout(() => life?.play(figure, fed ? 'greet' : 'love'), 220);
        },
      };
    }

    function render(): void {
      // A re-render draws a new scene: a parade or a close-up on the old one ends first.
      parades.skip();
      closeups.cancel();
      const save = app.save;
      const pets = unlockedPets(save);
      const ownedDecor = DECOR.filter((d) => decorHome(d) === 'harmony' && owns(save, d.id));
      const chat = sanctuaryChat(save);
      const animals = animalsOf('harmony');
      const home = animals.filter((a) => isHome(save, a));
      const nextId = nextArrivalIn(save, 'harmony')?.id;
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h1 data-autofocus>Pet Garden</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <figure class="sanctuary__scene card is-live">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(pets, ownedDecor.length))}">${sceneMarkup('sanct')}</svg>
        </figure>
        <div class="sanctuary__under">
          <p class="sanctuary__chat" data-chat ${chat ? '' : 'hidden'}>${ICON.heart}<span>${esc(chat ?? '')}</span></p>
          ${parades.replayMarkup()}
          <button class="scene-tricks" data-act="tricks" aria-controls="${trayHost.id}" aria-expanded="${tray.isOpen}" hidden>${trickBadge('sparkle')}Tricks</button>
        </div>
        <div data-cue-slot></div>
        ${gardenProgress()}
        <section aria-labelledby="res-title">
          <div class="section-head"><h2 id="res-title">Animals</h2><span class="muted num">${home.length} of ${animals.length}</span></div>
          <ul class="resident-row resident-row--friends">
            ${animals
              .map((id) => {
                const a = animalInfo(id);
                const has = home.includes(id);
                const isNext = !has && id === nextId;
                const fresh = has && welcome.includes(id);
                const attr = isPetId(id) ? `data-pet="${id}"` : `data-friend-card="${id}"`;
                const label = has ? `${a.name} the ${a.noun}, ${fresh ? 'just came home, ' : ''}${a.trait}` : isNext ? `${a.name} the ${a.noun}, coming home next` : `A ${a.noun}, arrives later`;
                const art = isPetId(id) ? portrait(id, 'idle', !has && !isNext) : friendPortrait(id as CompanionId, !has && !isNext);
                return `<li><button class="resident ${isNext ? 'is-next' : ''}${fresh ? ' is-new' : ''}" ${attr} aria-label="${esc(label)}">${art}${fresh ? NEW_CHIP : ''}<span class="resident__name">${has || isNext ? esc(a.name) : 'Later'}</span></button></li>`;
              })
              .join('')}
          </ul>
        </section>
        <section aria-labelledby="decor-title">
          <div class="section-head"><h2 id="decor-title">Decorations</h2><span class="muted num">${ownedDecor.length} of ${decorOf('harmony').length}</span></div>
          ${
            ownedDecor.length
              ? `<div class="rows">${ownedDecor
                  .map(
                    (d) => `<button class="row decor-row" role="switch" aria-checked="${isShown(save, d.id)}" data-toggle="${d.id}">
                      <span class="decor-row__icon">${decorIcon(d.id)}</span>
                      <span class="row__label">${esc(d.name)}<small>${isShown(save, d.id) ? 'Out in the garden' : 'Tucked away'}</small></span>
                      <span class="switch" aria-hidden="true"></span>
                    </button>`,
                  )
                  .join('')}</div>`
              : `<p class="empty">Decorations you earn or buy appear in the garden.</p>`
          }
          <button class="btn btn--secondary btn--block" data-act="shop">${ICON.bag}Find decorations in the Shop</button>
        </section>`;
      wireLife();
    }

    /** Who is coming home next, and building here. */
    function gardenProgress(): string {
      const save = app.save;
      const coming = arrivalProgress(save, 'harmony');
      if (!coming) return '';
      const a = animalInfo(coming.next.id);
      const building = activeSanctuary(save) === 'harmony';
      const span = Math.max(1, coming.need - coming.from);
      const pct = Math.round(((coming.have - coming.from) / span) * 100);
      return `<section class="card region-progress" aria-labelledby="gp-title">
        <div class="region-progress__head"><h2 id="gp-title">Coming home</h2>${building ? `<span class="chip chip--brand">${ICON.sprout}Building now</span>` : ''}</div>
        <div class="coming-home">
          <span class="coming-home__art portrait is-shy">${animalPortrait(coming.next.id, 'idle')}</span>
          <span class="coming-home__body"><span><b>${esc(a.name)} the ${esc(a.noun)}</b> is on the way${building ? ' and is on your boards' : ''}.</span>
            <span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${coming.from}" aria-valuemax="${coming.need}" aria-valuenow="${coming.have}"><span style="width:${pct}%"></span></span>
            <small class="num">${plural(coming.left, 'more puzzle')}${building ? '' : ' while you build here'}</small></span>
        </div>
        ${
          building
            ? `<button class="btn btn--block" data-act="play">Play level ${save.journey.nextLevel}</button><p class="muted region-progress__note">Journey, Daily and Zen puzzles all count.</p>`
            : `<button class="btn btn--block" data-act="build">${ICON.sprout}Build here</button><p class="muted region-progress__note">Your next puzzles will help this sanctuary. Progress in your other homes is safe.</p>`
        }
      </section>`;
    }
    render();

    // Everyone says hello when you arrive: a bigger hello on the first visit of the day, or after a puzzle.
    const today = localDateKey();
    const firstToday = app.save.world.visited.harmony !== today;
    app.save.world.visited.harmony = today;
    app.persist();
    if (life) greetAll(life, (fn, ms) => scope.timeout(fn, ms), firstToday || (route.screen === 'sanctuary' && route.welcome !== undefined));

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      if (parades.onClick(t)) return;
      // A tap on someone in the garden: a small happy reaction (a heart; face only under reduced motion).
      if (t.closest('[data-act="tricks"]')) {
        if (tray.isOpen) tray.close();
        else tray.openFor(undefined, true);
        return;
      }
      const cueOk = t.closest('[data-act="cue-ok"]') as HTMLElement | null;
      if (cueOk) {
        dismissSceneCue(el, (cueOk.closest('[data-scene-cue]') as HTMLElement).dataset.sceneCue as SceneCue);
        return;
      }
      // An animal, or a tap close to one (D40: little animals are small targets), but never a decoration's own tap.
      const svgEl = t.closest('.sanctuary__scene svg') as SVGSVGElement | null;
      const fig =
        (t.closest('.sanctuary__scene .sanctuary__pet') as HTMLElement | null) ??
        (svgEl && !t.closest('[data-decor].has-act') ? figureNear(svgEl, (e as MouseEvent).clientX, (e as MouseEvent).clientY) : null);
      if (fig) {
        if (!app.save.onboarding.sceneTapTipSeen) dismissSceneCue(el, 'tap');
        // The hello counts a heart once a day (D40 PR B) before the animal answers, so a new level shows at once.
        greetInScene(scope, fig.dataset.pet ?? fig.dataset.friend ?? '');
        selectFigure(scope, el.querySelector<HTMLElement>('.sanctuary__scene')!, fig);
        life?.tap(fig);
        tray.open(fig as unknown as SVGGElement);
        return;
      }
      // A tap on a decoration someone can use: they go and use it (ride the balloon, splash in the fountain…).
      const dec = t.closest('.sanctuary__scene [data-decor].has-act') as HTMLElement | null;
      if (dec) {
        if (!app.save.onboarding.decorTipSeen) dismissSceneCue(el, 'decor');
        if (acts && !acts.busy && !acts.play(dec.dataset.decor!)) {
          const anyone = !!el.querySelector('.sanctuary__scene .sanctuary__pet');
          toast(anyone ? 'Everyone’s busy with a trick. Try again in a moment.' : 'Once someone lives here, they’ll love this.');
        }
        return;
      }
      const friendBtn = t.closest('[data-friend-card]') as HTMLElement | null;
      if (friendBtn) {
        const id = friendBtn.dataset.friendCard as CompanionId;
        showFriendSheet(scope, id, reactions(`friend:${id}`));
        return;
      }
      const petBtn = t.closest('[data-pet]') as HTMLElement | null;
      if (petBtn) {
        const id = petBtn.dataset.pet as PetId;
        showPetSheet(scope, id, { showVisit: false, ...reactions(id) });
        return;
      }
      const tog = t.closest('[data-toggle]') as HTMLElement | null;
      if (tog) {
        const id = tog.dataset.toggle as DecorId;
        setShown(app.save, id, !isShown(app.save, id));
        afterDecorChange();
        app.persist();
        render();
        (el.querySelector(`[data-toggle="${id}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'back') app.router.back({ screen: 'world' });
      else if (a.act === 'shop') app.router.go({ screen: 'shop', sanctuary: 'harmony' });
      else if (a.act === 'play') playMode({ kind: 'level', level: app.save.journey.nextLevel });
      else if (a.act === 'build' && setActive(app.save, 'harmony')) {
        app.persist();
        feel('coin');
        track('region_build', { region: 'harmony' });
        toast(buildHereMessage('harmony'));
        render();
      }
    });

    // First visit after the first board: meet the newcomer, then pick a starter gift.
    const intro = () => offerStarterGift(scope, 'harmony', render);
    const arrivals = welcome.filter((w) => isHome(app.save, w));
    // The newcomer gets its moment in the light once the "came home" card is out of the way (D39).
    // Straight from a win's Meet (not a later visit to someone who came home meanwhile), the arrival ends with its last
    // two steps — the garden livens up for a moment, then the next goal (D40) — and the starter gift waits until then.
    const met = route.screen === 'sanctuary' && !!route.welcome?.length;
    if (arrivals.length)
      introduce(scope, arrivals, () => {
        spotlightNewcomer(scope, el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), arrivals[0]);
        if (!met) return intro();
        // Straight from a win's Meet: the Welcome Parade (D44 PR E), then the next goal and the starter gift.
        const who = arrivals[0];
        scope.timeout(
          () =>
            void Promise.race([s3d.ready, new Promise<boolean>((r) => scope.timeout(() => r(false), 1500))]).then(async () => {
              if (!scope.alive) return;
              await parades.play(who);
              if (!scope.alive) return;
              goalShown = true;
              showNextGoal(el, 'harmony', true);
              scope.timeout(intro, 900);
            }),
          app.reducedMotion ? 200 : 500,
        );
      });
    else intro();
    if (met) app.router.settle({ screen: 'sanctuary' });
  },
};

function sceneLabel(pets: PetId[], decorCount: number): string {
  const here = animalsOf('harmony').filter((a) => isHome(app.save, a));
  void pets;
  const names = here.map((p) => animalInfo(p).name);
  const who = names.length ? `${names.join(', ')} ${names.length === 1 ? 'lives' : 'live'} here` : 'Nobody lives here yet';
  return `The Pet Garden. ${who}. ${plural(decorCount, 'decoration')}.`;
}

/** When an animal who hasn't arrived yet will come. */
export function arrivalText(id: AnimalId): string {
  return arrivalLine(app.save, id);
}

/** A wildlife friend's card, with the once-a-day pat and feeding. */
export function showFriendSheet(scope: Scope, id: FriendId, ev: FeedEvents = {}): void {
  const c = animalInfo(id);
  const owned = !!app.save.inventory.companions[id];
  const sh = openSheet(scope, {
    title: owned ? `${c.name} the ${c.noun}` : `A ${c.noun} (arriving soon)`,
    className: 'pet-sheet',
    onClose: ev.onClose,
    body: `
      <div class="pet-sheet__hero">${friendPortrait(id, !owned)}</div>
      <p class="pet-sheet__trait">${esc(owned ? c.trait : c.sanctuary === 'harmony' ? 'Someone is watching the garden from the hedge.' : `Someone is waiting for a home at the ${sanctuaryDef(c.sanctuary).short}.`)}</p>
      <p class="sheet__lead">${esc(owned ? c.bio : arrivalText(id))}</p>
      ${
        owned
          ? `<dl class="pet-sheet__facts">
              <div><dt>Lives</dt><dd>${esc(habitatLabel(id))}</dd></div>
              <div><dt>Kind</dt><dd>${esc(isWildId(id) && wildDef(id).coat.name ? `${c.kind}, ${wildDef(id).coat.name} coat` : c.kind)}</dd></div>
              ${isWildId(id) && speciesById(wildDef(id).species) ? `<div><dt>In the wild</dt><dd>${esc(speciesById(wildDef(id).species)!.from)}</dd></div>` : ''}
            </dl>
            ${friendPanelMarkup(id, c.name)}
            <p class="muted">Pats and food are just for fun. They make friends happy and change nothing in your puzzles.</p>`
          : ''
      }`,
  });
  if (owned) bindFriendPanel(sh.scope, sh.el, id, c.name, ev);
}

function habitatLabel(id: FriendId): string {
  if (isWildId(id)) {
    const w = wildDef(id);
    const where = sanctuaryDef(w.place);
    return `${where.name}, ${where.place}${wearsNeckerchief(id) ? '. Wears a neckerchief' : ''}`;
  }
  const c = COMPANION_BY_ID[id];
  if (c.sanctuary !== 'harmony') return `${sanctuaryDef(c.sanctuary).name}, ${sanctuaryDef(c.sanctuary).place.replace(/ · beginner$/, '')}`;
  if (c.habitat === 'ground') return 'In a burrow under the garden hedge';
  return c.habitat === 'woodland' ? 'By the woodland log' : 'In the blossom tree (when it is out)';
}

/** "Came home" sheet for new arrivals. */
export function introduce(scope: Scope, pets: AnimalId[], then?: () => void): void {
  const first = animalInfo(pets[0]);
  const sh = openSheet(scope, {
    title: pets.length > 1 ? 'New friends came home!' : `${first.name} came home!`,
    center: true,
    className: 'intro-sheet',
    onClose: () => then?.(),
    body: `
      <div class="intro-pets">
        ${pets
          .map((id) => {
            const p = animalInfo(id);
            return `<div class="intro-pet">${isPetId(id) ? portrait(id, 'happy') : friendPortrait(id as CompanionId)}<b>${esc(p.name)}</b><span class="muted">${esc(p.trait)}</span></div>`;
          })
          .join('')}
      </div>
      <p class="sheet__lead">${pets.length > 1 ? 'They found a home here.' : esc(first.bio)}</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="ok">Welcome home</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="ok"]')) sh.close();
  });
}

/**
 * One of two free starter decorations, once, after the first board: offered by whichever beginner sanctuary the player
 * visits first (the Farm's or the Pet Garden's own pair).
 */
export function offerStarterGift(scope: Scope, where: SanctuaryId, rerender: () => void): void {
  if (!app.save.onboarding.tutorialDone || app.save.onboarding.starterDecorChosen) return;
  const choices = STARTER_DECOR.filter((id) => decorHome(DECOR_BY_ID[id]) === where);
  if (choices.length < 2) return;
  const sh = openSheet(scope, {
    title: 'Pick a welcome gift',
    center: true,
    dismissible: false,
    className: 'starter-sheet',
    body: `
      <p class="sheet__lead">Choose one for the ${esc(sanctuaryDef(where).short)}. The other stays in the Shop for later.</p>
      <div class="starter-choices">
        ${choices
          .map((id) => {
            const d = DECOR_BY_ID[id];
            return `<button class="starter-choice card card--tap" data-choose="${id}">
            <span class="starter-choice__art">${decorIcon(id)}</span>
            <b>${esc(d.name)}</b><span class="muted">${esc(d.blurb)}</span>
          </button>`;
          })
          .join('')}
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const b = (e.target as HTMLElement).closest('[data-choose]') as HTMLElement | null;
    if (!b) return;
    const id = b.dataset.choose as DecorId;
    if (chooseStarter(app.save, id)) {
      afterDecorChange();
      app.persist();
      feel('coin');
      track('onboarding_step', { step: 'starter_gift', item: id });
      sh.close();
      rerender();
      toast(`${DECOR_BY_ID[id].name} is in the ${sanctuaryDef(where).short}.`);
      offerNext(scope);
    }
  });
}

function offerNext(scope: Scope): void {
  const next = app.save.journey.nextLevel;
  const sh = openSheet(scope, {
    title: 'Ready for the next puzzle?',
    body: `<p class="sheet__lead">More friends are on their way. Each one comes home as you solve puzzles while you build here, and the next one is already on your boards.</p>
      <div class="sheet__actions"><button class="btn btn--block" data-act="play">Play level ${next}</button><button class="btn btn--quiet" data-act="stay">Stay a while</button></div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = actionOf(e);
    if (!a) return;
    sh.close();
    if (a.act === 'play') playMode({ kind: 'level', level: next });
  });
}
