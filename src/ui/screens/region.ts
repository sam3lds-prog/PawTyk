/**
 * The Farm or a regional sanctuary: its scene at the stage it has grown to, its animals and who is coming home next,
 * what the next stage brings, and its own decorations. Opening a sanctuary and growing it are never sold; solving
 * puzzles while it's the one you're building is what grows it, and while you build here your boards show the animal
 * on its way (D35). The animals greet you when you arrive (a bigger hello right after a solve that helped).
 */

import { app } from '../../app/app';
import { buildHereMessage, playMode } from '../../app/gameFlow';
import { afterDecorChange } from '../../app/events';
import { isPlaceId } from '../../meta/catalogs/places';
import type { FriendId } from '../art/companions';
import { decorOf, type DecorId } from '../../meta/catalogs/decor';
import { sanctuaryDef, type RegionId } from '../../meta/catalogs/sanctuaries';
import { isShown, owns, setShown } from '../../meta/sanctuary';
import { activeSanctuary, arrivalProgress, isComplete, isOpen, markSeen, nextStage, regionChat, setActive, stageOf } from '../../meta/world';
import { animalInfo, isHome, nextArrivalIn, type AnimalId } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import { localDateKey } from '../../game/dates';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { regionScene } from '../art/regions';
import { decorIcon, SCENE_VIEWBOX } from '../art/sanctuary';
import { greetAll, startSceneLife, type SceneLife } from '../components/sceneLife';
import { animalName, startSceneActivities, type ActivityRunner } from '../components/activities';
import { mountTrickTray } from '../components/tricks';
import { createScene3D } from '../components/scene3d';
import { SceneCamera } from '../components/camera';
import { missedWelcome, sceneParades, scheduleParade } from '../components/parade';
import { createSceneDirector } from '../components/sceneDirector';
import { startAmbient, stopAmbient, stopMusic } from '../../services/music';
import { celebrationLength } from '../../meta/celebration';
import { homeState } from '../../meta/homeState';
import { sceneCloseUps } from '../components/closeup';
import { openLandmark } from '../components/landmarks';
import { sceneTour, tourButtonMarkup } from '../components/tour';
import { canWalk, showFarmWalk, walkButtonMarkup, type WalkHandle } from '../components/walk';
import { HOME_SCENERY } from '../art/homeScenery';
import { figureId } from '../components/sceneLife';
import { trickBadge } from '../art/tricks';
import { toast } from '../components/sheet';
import { dismissSceneCue, sceneCue, sceneCueMarkup, type SceneCue } from '../components/sceneCues';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { Route, ScreenDef } from '../router';
import { friendPortrait, offerStarterGift, showFriendSheet } from './sanctuary';
import { coinPill } from '../components/wallet';
import { NEW_CHIP, spotlightNewcomer } from '../components/newcomer';
import { greetInScene } from '../components/bonding';
import { showNextGoal } from '../components/nextGoal';
import { cueFigure, figureNear, ringCued, selectFigure } from '../components/selection';

/** How long a stage that just appeared glows (D40). */
const STAGE_GLOW_MS = 2600;

export const regionScreen: ScreenDef = {
  tab: 'world',
  title: 'Sanctuary',
  mount(root, scope, route: Route) {
    if (route.screen !== 'region') return;
    const id: RegionId = route.id;
    const def = sanctuaryDef(id);
    const order = def.arrivals.map((a) => a.id as string);
    // Everyone who will live here, in the order they arrive (a hand-made region's friends, or a place's own animals).
    const friendsHere = order.map((a) => ({ ...animalInfo(a as AnimalId), id: a as FriendId }));
    // The endless world's places have no decorations (yet): their charm is their animals and their look (D39).
    const hasDecor = !isPlaceId(id);
    const today = localDateKey();
    const firstVisitToday = app.save.world.visited[id] !== today;
    // Whatever happened here since the last visit (the "New" marker) is seen now; newcomers get their hello below.
    const news = markSeen(app.save, id);
    // Which stage just appeared (coming from a solve that reached it, or reached while the player was elsewhere), to
    // pop it in and say what changed (D40).
    const freshStage = route.fresh || news?.stage || 0;
    if (isOpen(app.save, id)) {
      app.save.world.visited[id] = today;
      app.persist();
    } else if (news) app.persist();
    track('region_open', { region: id, stage: stageOf(app.save, id) });
    // Who came home, just now (a win's Meet) or while the player was elsewhere (the "New" marker): their cards say New
    // and the first one's figure gets a moment in the light (D39).
    const newcomers = [...new Set([...(route.welcome ?? []), ...((news?.animals ?? []) as AnimalId[])])].filter((w) => isHome(app.save, w));

    const el = h(`<div class="sanctuary region" style="--accent:${def.accent}"></div>`);
    root.appendChild(el);

    // Tricks: a tray under the scene for the animal you tap (kept across re-renders).
    const trayHost = h(`<div class="trick-tray-slot" hidden></div>`);
    const tricksBtn = () => el.querySelector<HTMLElement>('[data-act="tricks"]');
    const tray = mountTrickTray(scope, trayHost, () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), {
      returnFocus: tricksBtn,
      onToggle: (open) => tricksBtn()?.setAttribute('aria-expanded', String(open)),
      // A trick gets its close-up (D44 PR F); the tour, if it's running, ends first.
      onPlayed: (fig, trick) => {
        director.claim('closeup');
        closeups.play(fig, trick);
      },
    });
    let life: SceneLife | null = null;
    let acts: ActivityRunner | null = null;
    // 3D toys over the drawn scene (D34); kept across re-renders.
    const s3d = createScene3D();
    // The scene camera (D44 PR C): close-ups, the parade's glide, the guided tour. The drawing and the toys move together.
    const camera = new SceneCamera({ reducedMotion: () => app.reducedMotion, onView: (v) => s3d.setView(v) });
    if (import.meta.env.DEV) (window as unknown as { __cam?: SceneCamera }).__cam = camera;
    // Dev and QA: the scene's 3D layer (D46 PR B: its state, suspend/resume by hand).
    if (import.meta.env.DEV) (window as unknown as { __s3d?: unknown }).__s3d = s3d;
    // The Welcome Parade and group celebrations (D44 PR E).
    // The scene director (D45 PR A): one owner of the camera, and holds (not switches) on ambient life.
    const director = createSceneDirector((live) => {
      life?.setLive(live);
      acts?.setLive(live);
    });
    const parades = sceneParades(scope, {
      el,
      home: id,
      camera,
      pause: (on) => director.hold('parade', on),
      closeTray: () => {
        // A parade takes the camera: a trick's close-up or the tour ends first.
        director.claim('parade');
        if (tray.isOpen) tray.close();
      },
      reducedMotion: () => app.reducedMotion,
      // D46 PR B: a parade waits for the toys of the renderer there is now (rebuilt after the walk, say).
      toysReady: () => s3d.ready,
    });
    const closeups = sceneCloseUps({
      host: () => el.querySelector<HTMLElement>('.sanctuary__scene'),
      svg: () => el.querySelector<SVGSVGElement>('.sanctuary__scene svg'),
      camera,
      reducedMotion: () => app.reducedMotion,
      pause: (on) => director.hold('closeup', on),
      react: (fig, action) => life?.play(figureId(fig as unknown as HTMLElement), action),
    });
    // The guided tour (D44 PR H): the landmark, every animal, the party spot, and back.
    const landmarkLine = () => (isPlaceId(id) ? '' : (HOME_SCENERY[id as keyof typeof HOME_SCENERY]?.landmark.line ?? ''));
    const tour = sceneTour(scope, {
      el,
      camera,
      reducedMotion: () => app.reducedMotion,
      pause: (on) => director.hold('tour', on),
      greet: (fig) => life?.play(figureId(fig as unknown as HTMLElement), 'greet'),
      openLandmark: (lm) => openLandmark(scope, lm, el.querySelector('[data-chat]'), landmarkLine()),
      onStart: () => {
        director.claim('tour');
        if (tray.isOpen) tray.close();
      },
    });
    director.register('parade', { cancel: () => parades.skip(), active: () => parades.active });
    director.register('closeup', { cancel: () => closeups.cancel(), active: () => closeups.active });
    director.register('tour', { cancel: () => tour.stop(), active: () => tour.active });
    let walking: WalkHandle | null = null;
    director.register('walk', { cancel: () => walking?.close(), active: () => !!walking });
    if (import.meta.env.DEV) (window as unknown as { __director?: unknown }).__director = director;
    // The home's ambient tune (D45 PR D), if the player has turned it on: after the hellos, and gone with the screen.
    if (app.settings.ambientMusic && isOpen(app.save, id)) scope.timeout(() => scope.alive && startAmbient(id), 1800);
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

    function progressCard(): string {
      const save = app.save;
      const level = save.journey.nextLevel;
      if (!isOpen(save, id)) {
        const cleared = level - 1;
        const pct = Math.round((cleared / def.opensAfterLevel) * 100);
        return `<section class="card region-progress" aria-labelledby="rp-title">
          <h2 id="rp-title">${ICON.lock}Opens after level ${def.opensAfterLevel}</h2>
          ${isPlaceId(id) ? `<p class="muted">Or sooner: it opens the moment every home before it is complete.</p>` : ''}
          <p class="muted">${esc(def.blurb)}</p>
          <div class="progress world-progress" role="progressbar" aria-label="Levels until it opens" aria-valuemin="0" aria-valuemax="${def.opensAfterLevel}" aria-valuenow="${cleared}"><span style="width:${pct}%"></span></div>
          <p class="world-focus__count">${plural(def.opensAfterLevel - cleared, 'level')} to go</p>
          <button class="btn btn--block" data-act="play">Play level ${level}</button>
        </section>`;
      }
      if (isComplete(save, id))
        return `<section class="card region-progress is-complete" aria-labelledby="rp-title">
          <h2 id="rp-title">${ICON.sparkle}Thriving</h2>
          <p class="muted">${esc(def.stages[def.stages.length - 1].change)}. Every friend here has a home. Thank you!</p>
        </section>`;
      const next = nextStage(save, id);
      const coming = arrivalProgress(save, id);
      const building = activeSanctuary(save) === id;
      const total = def.stages.length - 1;
      const steps = def.stages
        .slice(1)
        .map(
          (st, i) =>
            `<li class="${stageOf(save, id) >= i + 1 ? 'is-done' : next && i + 1 === next.index ? 'is-next' : ''}"><span class="region-steps__dot" aria-hidden="true">${stageOf(save, id) >= i + 1 ? ICON.check : i + 1}</span><span>${esc(st.name)}</span></li>`,
        )
        .join('');
      const comingRow = coming
        ? (() => {
            const a = animalInfo(coming.next.id);
            const span = Math.max(1, coming.need - coming.from);
            const pct = Math.round(((coming.have - coming.from) / span) * 100);
            return `<div class="coming-home">
              <span class="coming-home__art portrait is-shy">${animalPortrait(coming.next.id, 'idle')}</span>
              <span class="coming-home__body"><span><b>${esc(a.name)} the ${esc(a.noun)}</b> is coming home${building ? ' and is on your boards' : ''}.</span>
                <span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${coming.from}" aria-valuemax="${coming.need}" aria-valuenow="${coming.have}"><span style="width:${pct}%"></span></span>
                <small class="num">${plural(coming.left, 'more puzzle')}${building ? '' : ' while you build here'}</small></span>
            </div>`;
          })()
        : '';
      const stageLine = next
        ? `<p class="muted">Next stage, <b>${esc(next.stage.name.toLowerCase())}</b>: ${esc(next.stage.change)}. <span class="num">${plural(next.need - next.have, 'puzzle')}</span> to go.</p>`
        : '';
      return `<section class="card region-progress" aria-labelledby="rp-title">
        <div class="region-progress__head"><h2 id="rp-title">Stage ${stageOf(save, id)} of ${total}</h2>${building ? `<span class="chip chip--brand">${ICON.sprout}Building now</span>` : ''}</div>
        ${comingRow}
        <ol class="region-steps" aria-label="Stages">${steps}</ol>
        ${stageLine}
        ${
          building
            ? `<button class="btn btn--block" data-act="play">Play level ${level}</button><p class="muted region-progress__note">Journey, Daily and Zen puzzles all count.</p>`
            : `<button class="btn btn--block" data-act="build">${ICON.sprout}Build here</button><p class="muted region-progress__note">Your next puzzles will help this sanctuary. Progress in your other homes is safe.</p>`
        }
      </section>`;
    }

    function render(): void {
      // A re-render (a decoration toggled) draws a new scene: a parade, a close-up or the tour on the old one ends first.
      director.cancelAll();
      const save = app.save;
      const open = isOpen(save, id);
      // The home as it is now (D45 PR C): the same description the Farm's 3D walk is built from.
      const state = homeState(save, id);
      const stage = stageOf(save, id);
      const welcomed = friendsHere.filter((c) => state.residents.includes(c.id)).map((c) => c.id);
      const nextId = nextArrivalIn(save, id)?.id;
      const decor = state.decor;
      const ownedDecor = decorOf(id).filter((d) => owns(save, d.id));
      const chat = open ? regionChat(save, id) : null;
      el.innerHTML = `
        <header class="screen-head">
          <button class="icon-btn" data-act="back" aria-label="Back">${ICON.back}</button>
          <h1 data-autofocus>${esc(def.name)}</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        <p class="muted region__place">${ICON.pin}${esc(def.place)}</p>
        <figure class="sanctuary__scene card is-live ${open ? '' : 'is-locked'}">
          <svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(sceneLabel(stage, welcomed))}">${regionScene(id, { stage: open ? stage : 0, companions: welcomed, decor, evening: state.evening }, `rg-${id}`)}</svg>
          ${tourButtonMarkup(open && welcomed.length > 0)}
          ${id === 'farm' ? walkButtonMarkup(open && stage >= 1 && canWalk()) : ''}
        </figure>
        <div class="sanctuary__under">
          <p class="sanctuary__chat" data-chat ${chat ? '' : 'hidden'}>${ICON.heart}<span>${esc(chat ?? '')}</span></p>
          ${parades.replayMarkup()}
          <button class="scene-tricks" data-act="tricks" aria-controls="${trayHost.id}" aria-expanded="${tray.isOpen}" hidden>${trickBadge('sparkle')}Tricks</button>
        </div>
        ${freshStage && def.stages[freshStage] ? `<p class="stage-news${stageNewsShown ? '' : ' is-entering'}" data-stage-news style="--accent:${def.accent}">${ICON.sprout}<span><b>New at the ${esc(def.short)}: ${esc(def.stages[freshStage].name)}</b> ${esc(def.stages[freshStage].change)}.</span></p>` : ''}
        <div data-cue-slot></div>
        ${progressCard()}
        <section aria-labelledby="animals-title">
          <div class="section-head"><h2 id="animals-title">Animals</h2><span class="muted num">${welcomed.length} of ${friendsHere.length}</span></div>
          <ul class="resident-row resident-row--friends">
            ${friendsHere
              .map((c) => {
                const has = welcomed.includes(c.id);
                const isNext = !has && c.id === nextId;
                const fresh = has && newcomers.includes(c.id);
                return `<li><button class="resident ${isNext ? 'is-next' : ''}${fresh ? ' is-new' : ''}" data-friend-card="${c.id}" aria-label="${esc(has ? `${c.name} the ${c.noun}, ${fresh ? 'just came home, ' : ''}${c.trait}` : isNext ? `${c.name} the ${c.noun}, coming home next` : `A ${c.noun}, arrives later`)}">
                  ${friendPortrait(c.id, !has && !isNext)}${fresh ? NEW_CHIP : ''}
                  <span class="resident__name">${has || isNext ? esc(c.name) : 'Later'}</span>
                </button></li>`;
              })
              .join('')}
          </ul>
        </section>
        ${hasDecor ? `<section aria-labelledby="rdecor-title">
          <div class="section-head"><h2 id="rdecor-title">Decorations</h2><span class="muted num">${ownedDecor.length} of ${decorOf(id).length}</span></div>
          ${
            ownedDecor.length
              ? `<div class="rows">${ownedDecor
                  .map(
                    (d) => `<button class="row decor-row" role="switch" aria-checked="${isShown(save, d.id)}" data-toggle="${d.id}">
                      <span class="decor-row__icon">${decorIcon(d.id)}</span>
                      <span class="row__label">${esc(d.name)}<small>${isShown(save, d.id) ? 'Out in the sanctuary' : 'Tucked away'}</small></span>
                      <span class="switch" aria-hidden="true"></span>
                    </button>`,
                  )
                  .join('')}</div>`
              : `<p class="empty">${open ? `Decorations and treats for the ${esc(def.short)} are in the Shop.` : 'Its decorations can be bought once it opens.'}</p>`
          }
          <button class="btn btn--secondary btn--block" data-act="shop">${ICON.bag}${esc(def.short)} decorations and treats</button>
        </section>` : ''}`;
      life?.dispose();
      acts?.dispose();
      const svg = el.querySelector<SVGSVGElement>('.sanctuary__scene svg');
      life = svg ? startSceneLife(svg, `region-${id}`) : null;
      acts = svg && open ? startSceneActivities(svg, el.querySelector('[data-chat]'), () => app.reducedMotion, animalName) : null;
      // One cue at a time, once: tap an animal (by name, the newcomer if there is one, and ringed: D40); later, use a
      // decoration.
      const slot = el.querySelector('[data-cue-slot]');
      const cue = open ? sceneCue(!!svg?.querySelector('.sanctuary__pet'), !!svg?.querySelector('[data-decor].has-act')) : null;
      const cued = cue === 'tap' ? cueFigure(svg, newcomers[0]) : null;
      if (slot) slot.innerHTML = sceneCueMarkup(cue, cued?.dataset.name);
      ringCued(cued);
      s3d.attach(open ? el.querySelector<HTMLElement>('.sanctuary__scene') : null, svg);
      camera.attach(el.querySelector<HTMLElement>('.sanctuary__scene'), svg);
      const btn = tricksBtn();
      if (btn) btn.hidden = !open || !svg?.querySelector('.sanctuary__pet');
      el.querySelector('.sanctuary__under')?.after(trayHost);
      tray.refresh();
      if (goalShown) showNextGoal(el, id);
      stageNewsShown = true;
    }
    let goalShown = false;
    // The stage's line rises in once; a re-render (a decoration toggled) keeps it still.
    let stageNewsShown = false;
    render();

    // Straight from a win's Meet: the Welcome Parade (D44 PR E). A new stage (and no newcomer to welcome): the whole
    // home celebrates with a group dance.
    const welcoming = !!newcomers.length && !!route.welcome?.includes(newcomers[0]);
    const groupDance = !welcoming && !!freshStage && isOpen(app.save, id) && !!el.querySelector('.sanctuary__scene .sanctuary__pet');

    /** Waits (briefly) for the 3D toys, so they dance from the first beat; the drawing dances if they don't come. */
    const toysReady = () => Promise.race([s3d.ready, new Promise<boolean>((r) => scope.timeout(() => r(false), 1500))]);
    /** The celebration this visit starts by itself, if any (tests and QA). */
    let welcome: import('../components/parade').ScheduledParade | null = null;

    // Arrival: a new stage grows in, then everyone says hello (a bigger hello on the first visit of the day, or right
    // after a solve that helped this place). A parade or a group dance is the hello instead.
    if (isOpen(app.save, id) && life) {
      const svg = el.querySelector('.sanctuary__scene svg');
      // What changed glows for a moment (also under reduced motion: a glow, not a movement), and a line says what it is.
      if (freshStage && svg)
        for (const g of svg.querySelectorAll(`.sp-stage[data-stage="${freshStage}"]`)) {
          if (!app.reducedMotion) g.classList.add('is-new');
          g.classList.add('is-fresh');
          scope.timeout(() => g.classList.remove('is-fresh'), STAGE_GLOW_MS);
        }
      if (!welcoming && !groupDance) greetAll(life, (fn, ms) => scope.timeout(fn, ms), route.fresh !== undefined || firstVisitToday);
    }
    // After the first board: a starter gift for the Farm (if the Pet Garden hasn't offered it already). Straight from a
    // win's Meet, it waits until the arrival has played out, so its card never covers the welcome (D40 review).
    if (isOpen(app.save, id) && !welcoming) offerStarterGift(scope, id, render);
    // Someone came home, just now or while the player was elsewhere: say so, ring them in the scene, and let them say hello.
    if (newcomers.length) {
      const a = animalInfo(newcomers[0]);
      // Straight from the first arrival's own scene (D45 PR B), the news has been told: no second announcement.
      if (!route.met) toast(`${a.name} the ${a.noun} came home to the ${def.short}!`, ICON.heart);
      spotlightNewcomer(scope, el.querySelector<SVGSVGElement>('.sanctuary__scene svg'), newcomers[0]);
      if (welcoming) {
        // Straight from the win that brought them: the Welcome Parade (D44 PR E), then (D40) the next goal, and after
        // the first board the Farm's starter gift, so its card never covers the welcome. If the player starts a walk,
        // the tour or a trick before it begins, theirs is kept and the parade is offered instead (D46 PR A); the goal
        // and the gift then wait until the scene is free.
        const who = newcomers[0];
        welcome = scheduleParade(scope, director, parades, {
          newcomer: who,
          delay: app.reducedMotion ? 300 : 600,
          waitFor: toysReady,
          short: celebrationLength(app.save, app.settings.celebrations, who, id) === 'short',
          after: () => {
            goalShown = true;
            showNextGoal(el, id, true);
            offerStarterGift(scope, id, render);
          },
        });
      } else scope.timeout(() => life?.play(`friend:${newcomers[0]}`, 'greet'), app.reducedMotion ? 0 : 900);
    } else if (groupDance)
      // The new stage pops in first, then everyone dances (unless the player has started something: D46 PR A).
      welcome = scheduleParade(scope, director, parades, { delay: app.reducedMotion ? 400 : 1100, waitFor: toysReady });
    // A welcome the player missed by leaving during its lead-in (D46 PR A): offered here now, never played by itself.
    const owed = !welcoming ? missedWelcome(id) : undefined;
    if (owed && isHome(app.save, owed as AnimalId)) parades.offer(owed);
    if (import.meta.env.DEV) (window as unknown as { __welcome?: unknown }).__welcome = welcome;
    // The welcome has played: coming back here (Back from a board, a refresh) opens the place plainly (D40 review).
    if (route.welcome?.length || route.fresh) app.router.settle({ screen: 'region', id });

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      if (parades.onClick(t)) return;
      // Walk round the Farm in 3D (D44 PR I): the scene's own 3D layer rests meanwhile.
      if (t.closest('[data-act="walk"]')) {
        director.claim('walk');
        if (tray.isOpen) tray.close();
        // One 3D renderer at a time (D45 PR C): the scene's own lets go of its WebGL context while the walk draws.
        s3d.suspend();
        director.hold('walk', true);
        const w = showFarmWalk(scope, { returnFocus: () => el.querySelector<HTMLElement>('[data-act="walk"]') });
        walking = w;
        void w.done.then(() => {
          if (walking === w) walking = null;
          if (!scope.alive) return;
          s3d.resume();
          s3d.setLive(!document.hidden);
          director.hold('walk', false);
        });
        return;
      }
      if (tour.onClick(t)) return;
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
        (svgEl && !t.closest('[data-decor].has-act, [data-landmark]') ? figureNear(svgEl, (e as MouseEvent).clientX, (e as MouseEvent).clientY) : null);
      if (fig) {
        if (!app.save.onboarding.sceneTapTipSeen) dismissSceneCue(el, 'tap');
        // The hello counts a heart once a day (D40 PR B) before the animal answers, so a new level shows at once.
        greetInScene(scope, fig.dataset.pet ?? fig.dataset.friend ?? '');
        selectFigure(scope, el.querySelector<HTMLElement>('.sanctuary__scene')!, fig);
        life?.tap(fig);
        tray.open(fig as unknown as SVGGElement);
        return;
      }
      // The home's landmark (D44 PR G): the barn's doors open, a critter peeks out.
      const lm = t.closest('.sanctuary__scene [data-landmark]');
      if (lm) {
        openLandmark(scope, lm, el.querySelector('[data-chat]'), landmarkLine());
        return;
      }
      const dec = t.closest('.sanctuary__scene [data-decor].has-act') as HTMLElement | null;
      if (dec) {
        if (!app.save.onboarding.decorTipSeen) dismissSceneCue(el, 'decor');
        if (acts && !acts.busy && !acts.play(dec.dataset.decor!)) {
          const anyone = !!el.querySelector('.sanctuary__scene .sanctuary__pet');
          toast(anyone ? 'Everyone’s busy with a trick. Try again in a moment.' : 'Once an animal lives here, they’ll love this.');
        }
        return;
      }
      const friendBtn = t.closest('[data-friend-card]') as HTMLElement | null;
      if (friendBtn) {
        const cid = friendBtn.dataset.friendCard as FriendId;
        let fed = false;
        let patted = false;
        showFriendSheet(scope, cid, {
          onFed: () => (fed = true),
          onPat: () => (patted = true),
          // React in the scene once the card is out of the way.
          onClose: () => {
            if (fed || patted) scope.timeout(() => life?.play(`friend:${cid}`, fed ? 'greet' : 'love'), 220);
          },
        });
        return;
      }
      const tog = t.closest('[data-toggle]') as HTMLElement | null;
      if (tog) {
        const d = tog.dataset.toggle as DecorId;
        setShown(app.save, d, !isShown(app.save, d));
        afterDecorChange();
        app.persist();
        render();
        (el.querySelector(`[data-toggle="${d}"]`) as HTMLElement | null)?.focus();
        return;
      }
      const a = t.closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      switch (a.dataset.act) {
        case 'back':
          app.router.back({ screen: 'world' });
          break;
        case 'play':
          playMode({ kind: 'level', level: app.save.journey.nextLevel });
          break;
        case 'build':
          if (setActive(app.save, id)) {
            app.persist();
            feel('coin');
            track('region_build', { region: id });
            toast(buildHereMessage(id));
            render();
          }
          break;
        case 'shop':
          app.router.go({ screen: 'shop', sanctuary: id });
          break;
      }
    });

    function sceneLabel(stage: number, welcomed: FriendId[]): string {
      const who = welcomed.map((c) => `${animalInfo(c).name} the ${animalInfo(c).noun}`);
      const where = stage ? def.stages[stage].name : `${def.stages[0]?.name ?? 'Wild land'}, waiting for its first friend`;
      return `The ${def.name}. ${where}.${who.length ? ` ${who.join(', ')} ${who.length === 1 ? 'lives' : 'live'} here.` : ''}`;
    }
  },
};
