/**
 * The Pet Garden on Harmony Isle (D35): the illustrated garden with every owned decoration and every animal who has come
 * home, its animals in the order they arrive (the bunny, the cats and dogs, two woodland visitors), who is coming home
 * next, and the decorations you own (show / hide). New arrivals are introduced here, and after the very first board the
 * player picks one of two free starter gifts (here or on the Farm, whichever they visit first).
 */

import { noteHomeVisit } from '../../app/usage';
import { arrivalPortrait } from '../components/eager';
import { hasUnlock } from '../../meta/bonds';
import { greetInScene } from '../components/bonding';
import { showNextGoal } from '../components/nextGoal';
import { welcomeFlow } from '../components/welcomeCard';
import { sayClaimed } from '../components/errands';
import { sceneMoments } from '../components/animalMoments';
import { playReveals, waitingReveals, type RevealHost } from '../components/decorReveal';
import { cueFigure, figureNear, ringCued, selectFigure } from '../components/selection';
import { app } from '../../app/app';
import { buildHereMessage, playMode } from '../../app/gameFlow';
import { DECOR, DECOR_BY_ID, STARTER_DECOR, decorHome, decorOf, type DecorId } from '../../meta/catalogs/decor';
import type { PetId } from '../../meta/catalogs/pets';
import { chooseStarter, isShown, owns, sanctuaryChat, setShown, shownDecorIds } from '../../meta/sanctuary';
import { bindFriendPanel, friendPanelMarkup, takeFeedReturn, type FeedEvents } from '../components/feedPanel';
import { sceneMeals } from '../components/feeding';
import { afterHearts } from '../components/bonding';
import { sayHello } from '../components/hello';
import { bowlInUse } from '../../meta/feeding';
import { unlockedCompanions, unlockedPets } from '../../meta/rewards';
import { COMPANION_BY_ID, type CompanionId } from '../../meta/catalogs/companions';
import { sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { companionSvg, wearsNeckerchief, type FriendId } from '../art/companions';
import { speciesById } from '../../meta/catalogs/species/index';
import { isWildId, wildDef } from '../../meta/catalogs/places';
import { animalInfo, animalsOf, isHome, nextArrivalIn, type AnimalId } from '../../meta/animals';
import { activeSanctuary, arrivalLine, arrivalProgress, markSeen, setActive } from '../../meta/world';
import { isPetId } from '../../meta/catalogs/pets';
import { animalTint } from '../art/animals';
import { greetAll, startSceneLife, type SceneLife } from '../components/sceneLife';
import { animalName, startSceneActivities, type ActivityRunner } from '../components/activities';
import { mountTrickTray, partnersFor } from '../components/tricks';
import { buyTriedOn, shopRouteFor, tryBannerMarkup, tryDecorList, tryOnOf } from '../components/tryOn';
import { performTrick } from '../components/trickPlay';
import { TRICK_BY_ID } from '../../meta/catalogs/tricks';
import { createScene3D } from '../components/scene3d';
import { SceneCamera } from '../components/camera';
import { missedWelcome, sceneParades, scheduleParade } from '../components/parade';
import { CELEBRATION_BY_ID, assignCelebration, celebrationFor, celebrationOf } from '../../meta/celebrations';
import { createSceneDirector } from '../components/sceneDirector';
import { startAmbient, stopAmbient, stopMusic } from '../../services/music';
import { celebrationLength } from '../../meta/celebration';
import { isEveningAt } from '../../meta/homeState';
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
  return isEveningAt(d);
}

/** The sanctuary picture for the current save (used here, live, and on Home, still); `decor` overrides what's out (M1's try-on). */
export function sceneMarkup(id: string, decor: DecorId[] = shownDecor()): string {
  return sanctuaryScene({ decor, pets: unlockedPets(app.save), companions: unlockedCompanions(app.save), evening: isEvening() }, id);
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
    // D49 PR E: home visits, for "fed within the first few visits".
    noteHomeVisit(app.save);
    const news = afterSanctuaryVisit();
    app.persist();
    for (const a of news.achievements) toast(`Badge unlocked: ${a.name}`);
    sayClaimed(news);

    const el = h(`<div class="sanctuary"></div>`);
    // M1: the Shop's try-on (a decoration out, or a trick played here), changing nothing saved. D49 PR A: until the
    // player buys it from the banner; the garden is then plainly theirs (no banner).
    let tryOn = route.screen === 'sanctuary' ? tryOnOf(route, 'harmony') : null;
    root.appendChild(el);

    // Tricks: a tray under the scene for the animal you tap (kept across re-renders).
    const trayHost = h(`<div class="trick-tray-slot" hidden></div>`);
    const tricksBtn = () => el.querySelector<HTMLElement>('[data-act="tricks"]');
    const tray = mountTrickTray(scope, trayHost, () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), {
      returnFocus: tricksBtn,
      onToggle: (open) => tricksBtn()?.setAttribute('aria-expanded', String(open)),
      // A trick gets its close-up (D44 PR F).
      onPlayed: (fig, trick) => {
        director.claim('closeup');
        closeups.play(fig, trick);
      },
      // An animal moment ends before the player's trick is checked, so their pick wins (D49 PR C).
      beforePlay: () => director.end('moment'),
      // D48 PR B: Feed, straight from the tray: the animal's card, at its food.
      onFeed: (id) => openCard(id),
    });

    // ---------------------------------------------------------------- ambient life (D24)
    let life: SceneLife | null = null;
    let acts: ActivityRunner | null = null;
    // 3D toys over the drawn scene (D34); kept across re-renders.
    const s3d = createScene3D();
    // The scene camera (D44 PR C) and the Welcome Parade (D44 PR E), as on the Farm.
    const camera = new SceneCamera({ reducedMotion: () => app.reducedMotion, onView: (v) => s3d.setView(v) });
    // The scene director (D45 PR A): one owner of the camera, and holds (not switches) on ambient life.
    const director = createSceneDirector((live) => {
      life?.setLive(live);
      acts?.setLive(live);
    });
    const parades = sceneParades(scope, {
      el,
      home: 'harmony',
      camera,
      pause: (on) => director.hold('parade', on),
      closeTray: () => {
        // A parade takes the camera: a trick's close-up ends first.
        director.claim('parade');
        if (tray.isOpen) tray.close();
      },
      reducedMotion: () => app.reducedMotion,
      // D46 PR B: a parade waits for the toys of the renderer there is now (rebuilt after the walk, say).
      toysReady: () => s3d.ready,
      // D48 PR E: the newcomer's welcome celebration, settled the first time it plays.
      celebration: (newcomer) => {
        const had = celebrationOf(app.save, newcomer);
        const c = assignCelebration(app.save, newcomer);
        if (!had) app.persist();
        return c;
      },
    });
    const closeups = sceneCloseUps({
      host: () => el.querySelector<HTMLElement>('.sanctuary__scene'),
      svg: () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'),
      camera,
      reducedMotion: () => app.reducedMotion,
      pause: (on) => director.hold('closeup', on),
      react: (fig, action) => life?.play(figureId(fig as unknown as HTMLElement), action),
    });
    director.register('parade', { cancel: () => parades.skip(), active: () => parades.active });
    director.register('closeup', { cancel: () => closeups.cancel(), active: () => closeups.active });
    // Meals, played out in the garden (D48 PR B).
    const meals = sceneMeals(scope, {
      el,
      camera,
      director,
      reducedMotion: () => app.reducedMotion,
      react: (animal, action) => life?.play(isPetId(animal) ? animal : `friend:${animal}`, action),
      afterHearts: (animal, before) => afterHearts(scope, animal, before),
      hello: (animal) => sayHello(animal),
      bowl: () => bowlInUse(app.save),
    });
    // D49 PR C: now and then, an animal does something small on its own (only while nothing else is happening).
    const moments = sceneMoments({
      svg: () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'),
      chat: () => el.querySelector<HTMLElement>('[data-chat]'),
      director,
      reducedMotion: () => app.reducedMotion,
      busy: () => !!tryOn || tray.isOpen || meals.active || parades.active || !!document.querySelector('.overlay') || !!acts?.busy,
      // D50 PR B: someone says hello a couple of seconds into a calm visit (never over a welcome or anything else).
      // (Not when a newcomer is the visit's news, or a welcome is owed: that is the hello.)
      greet: { home: 'harmony', evening: () => isEvening(), welcoming: () => !!welcomes.animal || welcome.length > 0 || !!parades.offered?.unplayed },
    });
    scope.onDispose(() => moments.dispose());
    // D49 PR A: the arrival's follow-up card (a welcome snack, then the Journey); the starter gift waits for the snack.
    const welcomes = welcomeFlow(scope, { el, home: 'harmony', meals, life: () => life, afterSnack: () => offerStarterGift(scope, 'harmony', render, { askNext: false }) });
    /** An animal's card (a resident's or a friend's), its feeding played out in the garden. */
    function openCard(id: string): void {
      if (isPetId(id)) showPetSheet(scope, id, { showVisit: false, ...meals.events(id, animalInfo(id).name), welcome: welcomeFor(id) });
      else if (isHome(app.save, id as AnimalId)) showFriendSheet(scope, id as CompanionId, { ...meals.events(id, animalInfo(id as AnimalId).name), welcome: welcomeFor(id) });
    }
    /** D48 PR E: an animal's card replays its welcome celebration in the garden (it grants nothing). */
    function welcomeFor(animal: string): { label: string; play: () => void } | undefined {
      if (!el.querySelector(`.sanctuary__scene [data-friend="${animal}"], .sanctuary__scene [data-pet="${animal}"]`)) return undefined;
      const c = CELEBRATION_BY_ID[celebrationFor(app.save, animal)];
      return { label: `Replay the welcome: ${c.name}`, play: () => void parades.play(animal) };
    }
    // The home's ambient tune (D45 PR D), if the player has turned it on: after the hellos, and gone with the screen.
    if (app.settings.ambientMusic && true) scope.timeout(() => scope.alive && startAmbient('harmony'), 1800);
    scope.onDispose(() => {
      stopAmbient();
      // A trick's tune or the parade's goes with the scene it belongs to (D45: camera, audio and animation end together).
      stopMusic(200);
      // Leaving ends every scene moment together, then the camera, the toys and the life go.
      director.cancelAll();
      life?.dispose();
      acts?.dispose();
      camera.dispose();
      s3d.dispose();
    });
    scope.on(document, 'visibilitychange', () => {
      if (document.hidden) closeups.cancel();
      director.refresh();
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
      if (!welcomes.redraw() && goalShown) showNextGoal(el, 'harmony');
    }
    let goalShown = false;

    function render(): void {
      // A re-render draws a new scene: a parade or a close-up on the old one ends first.
      director.cancelAll();
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
        ${tryOn ? tryBannerMarkup(tryOn, 'harmony') : ''}
        <figure class="sanctuary__scene card is-live${tryOn ? ' is-trying' : ''}">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(pets, ownedDecor.length))}">${sceneMarkup('sanct', tryDecorList(shownDecor(), tryOn))}</svg>
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
          ${arrivalPortrait(coming.next.id, coming.left, 'coming-home__art portrait')}
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
    // M1: a trick tried on: one of the garden's animals plays it, once the toys are there (again on request). A
    // preview, never an unlock; a group act brings in its partners as it would for real.
    function playTry(): void {
      const t = tryOn;
      if (t?.kind !== 'trick' || !scope.alive) return;
      const svg = el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      const fig = svg?.querySelector<SVGGElement>('.sanctuary__pet:not(.is-away):not([data-trick])');
      if (!svg || !fig) return;
      if (tray.isOpen) tray.close();
      if (!performTrick(svg, fig, t.id, app.reducedMotion)) return;
      const n = TRICK_BY_ID[t.id].partners ?? 0;
      if (n) partnersFor(svg, fig, n).forEach((p, i) => performTrick(svg, p, t.id, app.reducedMotion, i + 1));
      feel('trick', { cue: `trick:${t.id}` });
      director.claim('closeup');
      closeups.play(fig, t.id);
    }
    if (tryOn?.kind === 'trick') void Promise.race([s3d.ready, scope.wait(1500)]).then(() => scope.timeout(playTry, app.reducedMotion ? 200 : 700));
    // D49 PR A: a decoration tried on is used here too (again on request), as on the Farm.
    function playTryDecor(): void {
      if (tryOn?.kind !== 'decor' || !scope.alive || !acts || acts.busy) return;
      acts.play(tryOn.id);
    }
    if (tryOn?.kind === 'decor') void Promise.race([s3d.ready, scope.wait(1500)]).then(() => scope.timeout(playTryDecor, app.reducedMotion ? 300 : 900));
    /** D49 PR A: bought from the banner: it's theirs, here, and the garden is plainly theirs again. */
    function buyTry(): void {
      if (!tryOn) return;
      const t = tryOn;
      const r = buyTriedOn(t, 'harmony');
      toast(r.line, r.ok ? ICON.check : undefined);
      if (!r.ok) return;
      tryOn = null;
      app.router.settle({ screen: 'sanctuary' });
      render();
      afterTryBuy(t);
    }
    function afterTryBuy(t: NonNullable<typeof tryOn>): void {
      // D49 PR B: bought where it stands: it arrives properly (sparkles, then an animal goes and uses it).
      if (t.kind === 'decor') scope.timeout(() => scope.alive && playReveals(revealHost, [t.id]), app.reducedMotion ? 100 : 300);
    }
    // D49 PR B: a decoration bought since the last look here arrives now, once the garden has settled (never over a
    // welcome or a try-on).
    const revealHost: RevealHost = {
      svg: () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'),
      reducedMotion: () => app.reducedMotion,
      playActivity: (d) => !!acts && !acts.busy && !!acts.play(d),
      notice: (fid) => void life?.play(fid, 'look'),
      timeout: (fn, ms) => scope.timeout(() => scope.alive && fn(), ms),
    };
    if (!tryOn && !welcome.length) {
      const ids = waitingReveals('harmony');
      if (ids.length) void Promise.race([s3d.ready, scope.wait(1500)]).then(() => scope.timeout(() => scope.alive && director.owner === null && playReveals(revealHost, ids), app.reducedMotion ? 200 : 700));
    }

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      // D50: the player has started something of their own; the visit's hello, if it hasn't come yet, stays away.
      moments.skipGreeting();
      if (parades.onClick(t)) return;
      if (welcomes.onClick(t)) return;
      // A meal is playing: the scene is its stage until it's eaten (a moment; anything else the player starts ends it).
      if (meals.active && t.closest('.sanctuary__scene')) return;
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
        // D50 PR A: the player is with the animals now: a welcome card holding the focus lets the scene's controls back.
        welcomes.release();
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
        openCard(friendBtn.dataset.friendCard as CompanionId);
        return;
      }
      const petBtn = t.closest('[data-pet]') as HTMLElement | null;
      if (petBtn) {
        openCard(petBtn.dataset.pet as PetId);
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
      else if (a.act === 'try-back' && tryOn) app.router.back(shopRouteFor(tryOn, 'harmony'));
      else if (a.act === 'try-again') tryOn?.kind === 'decor' ? playTryDecor() : playTry();
      else if (a.act === 'try-buy') buyTry();
      else if (a.act === 'shop') app.router.go({ screen: 'shop', sanctuary: 'harmony' });
      // D50 PR A: not in the middle of the newcomer's welcome snack (the card's own Continue waits too).
      else if (a.act === 'play' && !welcomes.eating) playMode({ kind: 'level', level: app.save.journey.nextLevel });
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
        // Straight from a win's Meet: the Welcome Parade (D44 PR E), then the next goal and the starter gift. A trick
        // the player starts first is kept, and the parade is offered instead (D46 PR A).
        const who = arrivals[0];
        scheduleParade(scope, director, parades, {
          newcomer: who,
          delay: app.reducedMotion ? 200 : 500,
          waitFor: () => Promise.race([s3d.ready, new Promise<boolean>((r) => scope.timeout(() => r(false), 1500))]),
          short: celebrationLength(app.save, app.settings.celebrations, who, 'harmony') === 'short',
          after: (played) => {
            goalShown = true;
            // D49 PR A: the welcome ends with one card (a snack for the newcomer, then the Journey); the starter gift
            // waits for the snack, or the next visit. D50 PR A: in focus only after a welcome that played.
            welcomes.show(who, true, { focus: played });
          },
        });
      });
    else intro();
    // Back from the Shop with food for someone here (D48 PR B): their card again, to feed them.
    const feedBack = takeFeedReturn('harmony');
    if (feedBack && isHome(app.save, feedBack as AnimalId)) scope.timeout(() => scope.alive && openCard(feedBack), 350);
    // A welcome missed by leaving during its lead-in (D46 PR A) is offered under the scene, never played by itself.
    const owed = !met ? missedWelcome('harmony') : undefined;
    if (owed && isHome(app.save, owed as AnimalId)) parades.offer(owed);
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
  if (owned) bindFriendPanel(sh.scope, sh.el, id, c.name, { ...ev, close: () => sh.close() });
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
export function offerStarterGift(scope: Scope, where: SanctuaryId, rerender: () => void, o: { askNext?: boolean } = {}): void {
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
      // D49 PR A: after a welcome, its card already offers Continue: no second "Ready for the next puzzle?".
      if (o.askNext !== false) offerNext(scope);
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
