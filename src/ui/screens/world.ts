/**
 * World: what the puzzles build (D35, D36, D38). First the goal: the sanctuary being built, who is on the way, and the
 * next puzzle one tap away; then one row of what else is going on (news waiting to be seen, the next home to open). The
 * map is a delightful overview (bigger labels, a halo on the home being built, locked homes kept quiet; it can be
 * expanded), never the only way in: the home cards below are the reliable touch targets. Then the map of every sanctuary (the Farm and the Pet Garden open from the start; each exotic
 * region opens at a Journey level) and the list with each one's state: building here, build here, locked until a level,
 * complete. Whichever one you build grows with the puzzles you solve, and its animals come home one by one (the one on
 * its way is the animal on your boards). Nothing here is for sale: puzzles are what grow a sanctuary.
 */

import { arrivalPortrait } from '../components/eager';
import { app } from '../../app/app';
import { playMode } from '../../app/gameFlow';
import { sanctuaryDef, SANCTUARY_BY_ID, isRegionId, type RegionId, type SanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { isPlaceId } from '../../meta/catalogs/places';
import { activeSanctuary, arrivalProgress, isComplete, isOpen, nextStage, nextToOpen, progressOf, stageOf, unseenIn, worldIds } from '../../meta/world';
import { animalInfo, homeAnimals } from '../../meta/animals';
import { animalPortrait } from '../art/animals';
import { regionThumb } from '../art/regions';
import { pinPercent, worldMapSvg } from '../art/worldMap';
import { esc, h, plural } from '../dom';
import { ICON } from '../icons';
import type { ScreenDef } from '../router';
import { coinPill } from '../components/wallet';
import { dismissLoopCoach, loopCoachMarkup, shouldShowLoopCoach } from '../components/loopCoach';
import { sceneMarkup } from './sanctuary';
import { wireFolds } from '../components/fold';

const short = (d: SanctuaryDef) => d.short;

type Status = 'building' | 'open' | 'complete' | 'locked';

/**
 * Every home's status, worked out once per visit (D39): with the endless world a long list asks for each home's status
 * several times, and asking the world each time would grow with the square of the list.
 */
let statusMemo: Map<string, Status> | null = null;
function statusOf(id: SanctuaryDef['id']): Status {
  const hit = statusMemo?.get(id);
  if (hit) return hit;
  const st: Status = !isOpen(app.save, id) ? 'locked' : isComplete(app.save, id) ? 'complete' : activeSanctuary(app.save) === id ? 'building' : 'open';
  statusMemo?.set(id, st);
  return st;
}

/** One honest line per sanctuary: locked until a level, complete, building here, or open to build (never "paused"). */
function statusLine(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const cleared = app.save.journey.nextLevel - 1;
  if (st === 'locked')
    return isPlaceId(def.id)
      ? `Opens after level ${def.opensAfterLevel} · or as soon as every home is complete`
      : `Locked until level ${def.opensAfterLevel} · ${plural(def.opensAfterLevel - cleared, 'level')} to go`;
  if (st === 'complete') return 'Complete · every friend has a home';
  const coming = arrivalProgress(app.save, def.id);
  const lead = st === 'building' ? 'Building here · ' : 'Build here · ';
  const tail = st === 'building' ? '' : ' while you build here';
  if (coming) return `${lead}${animalInfo(coming.next.id).name} comes home in ${plural(coming.left, 'puzzle')}${tail}`;
  const next = nextStage(app.save, def.id);
  return next ? `${lead}${plural(next.need - next.have, 'puzzle')} to ${next.stage.name.toLowerCase()}${tail}` : `${lead}almost complete`;
}

/** The friend who stands for a sanctuary on its map pin: the first one home there, if any. */
function pinFace(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  if (st === 'locked') return ICON.lock;
  // A finished place is a small check on the map (a long world has many; their faces are in the album).
  if (st === 'complete' && isPlaceId(def.id) && !unseenIn(app.save, def.id)) return ICON.check;
  const first = homeAnimals(app.save, def.id)[0];
  return first ? animalPortrait(first, 'happy') : def.beginner ? ICON.home : ICON.sprout;
}

/** "New: Truffle came home" / "New: the barn went up" / "New: just opened", until the player visits. */
function newsLine(id: SanctuaryDef['id']): string {
  const u = unseenIn(app.save, id);
  if (!u) return '';
  if (u.animals.length) {
    const names = u.animals.map((a) => animalInfo(a as Parameters<typeof animalInfo>[0]).name);
    // A long list would overflow its chip: two names, then how many more (D39).
    const who = names.length > 3 ? `${names.slice(0, 2).join(', ')} and ${names.length - 2} more` : names.join(', ');
    return `New: ${who} came home`;
  }
  if (u.opened) return 'New: just opened';
  if (u.stage !== null) return `New: ${sanctuaryDef(id).stages[u.stage]?.name.toLowerCase() ?? 'a new stage'}`;
  return 'New';
}

function pinLabel(def: SanctuaryDef): string {
  const st = statusOf(def.id);
  const pct = `, ${Math.round(progressOf(app.save, def.id) * 100)}% grown`;
  const nw = newsLine(def.id);
  return `${def.name}, ${def.place}. ${nw ? `${nw}. ` : ''}${statusLine(def)}${st === 'locked' ? '' : pct}`;
}

export const worldScreen: ScreenDef = {
  tab: 'world',
  title: 'World',
  mount(root, scope) {
    const save = app.save;
    const building = activeSanctuary(save);
    const upcoming = nextToOpen(save);
    statusMemo = new Map();
    scope.onDispose(() => (statusMemo = null));
    // Every home this save's world has: the six hand-made ones, each open place of the endless world, and the next (D39).
    const homes = worldIds(save).map(sanctuaryDef);
    const openCount = homes.filter((d) => statusOf(d.id) !== 'locked').length;
    const finishedCount = homes.filter((d) => statusOf(d.id) === 'complete').length;
    const level = save.journey.nextLevel;

    const pins = homes.map((d) => {
      const p = pinPercent(d.lon, d.lat);
      const st = statusOf(d.id);
      const prog = progressOf(save, d.id);
      // A place's pin is smaller and keeps its name to itself unless it is being built, has news, or is next (D39).
      const quiet = isPlaceId(d.id) && st !== 'building' && st !== 'locked' && !unseenIn(save, d.id);
      return `<button class="world-pin is-${st}${isPlaceId(d.id) ? ' is-place' : ''}${quiet ? ' is-quiet' : ''}${unseenIn(save, d.id) ? ' has-news' : ''}" data-go="${d.id}" style="left:${p.left.toFixed(2)}%;top:${p.top.toFixed(2)}%;--accent:${d.accent};--p:${prog.toFixed(3)}" aria-label="${esc(pinLabel(d))}">
        <span class="world-pin__ring" aria-hidden="true"><span class="world-pin__face">${pinFace(d)}</span>${unseenIn(save, d.id) ? '<span class="news-dot"></span>' : ''}</span>
        <span class="world-pin__label" aria-hidden="true">${esc(short(d))}</span>
      </button>`;
    }).join('');

    let focus = '';
    if (building) {
      const def = sanctuaryDef(building);
      const coming = arrivalProgress(save, building);
      const next = nextStage(save, building);
      const bar = (have: number, from: number, need: number, label: string) =>
        `<div class="progress world-progress" role="progressbar" aria-label="${esc(label)}" aria-valuemin="${from}" aria-valuemax="${need}" aria-valuenow="${have}"><span style="width:${Math.round(((have - from) / Math.max(1, need - from)) * 100)}%"></span></div>`;
      const body = coming
        ? (() => {
            const a = animalInfo(coming.next.id);
            return `<div class="coming-home">${arrivalPortrait(coming.next.id, coming.left, 'coming-home__art portrait')}<span class="coming-home__body"><span><b>${esc(a.name)} the ${esc(a.noun)}</b> arrives in ${plural(coming.left, 'puzzle')}.</span>${bar(coming.have, coming.from, coming.need, `${a.name} coming home`)}</span></div>`;
          })()
        : next
          ? `<p class="muted">Next: <b>${esc(next.stage.name)}</b>. ${esc(next.stage.change)}.</p>${bar(next.have, next.from, next.need, `Progress to ${next.stage.name}`)}`
          : '';
      const others = homes.filter((d) => d.id !== building && statusOf(d.id) === 'open').length;
      focus = `<section class="card world-focus" style="--accent:${def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.sprout}Building now${def.stages.length ? ` · stage ${stageOf(save, building)} of ${def.stages.length - 1}` : ''}</p>
        <h2 id="focus-title">${esc(def.name)}</h2>
        ${body}
        <div class="world-focus__actions">
          <button class="btn btn--block" data-act="play">Play level ${level}</button>
        </div>
        <div class="world-focus__links">
          <button class="btn btn--quiet" data-go="${building}">${ICON.home}Visit ${esc(def.short)}</button>
          ${others ? `<button class="btn btn--quiet" data-act="others">${ICON.globe}Build elsewhere</button>` : ''}
        </div>
      </section>`;
    } else if (!openCount && upcoming) {
      const pct = Math.round(((level - 1) / upcoming.def.opensAfterLevel) * 100);
      focus = `<section class="card world-focus" style="--accent:${upcoming.def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.pin}Your first journey</p>
        <h2 id="focus-title">${esc(upcoming.def.name)}</h2>
        <p class="muted">${esc(upcoming.def.blurb)}</p>
        <div class="progress world-progress" role="progressbar" aria-label="Levels until it opens" aria-valuemin="0" aria-valuemax="${upcoming.def.opensAfterLevel}" aria-valuenow="${level - 1}"><span style="width:${pct}%"></span></div>
        <p class="world-focus__count">Opens after level ${upcoming.def.opensAfterLevel} · ${plural(upcoming.left, 'level')} to go</p>
        <div class="world-focus__actions"><button class="btn" data-act="play">Play level ${level}</button></div>
      </section>`;
    } else if (upcoming) {
      focus = `<section class="card world-focus" style="--accent:${upcoming.def.accent}" aria-labelledby="focus-title">
        <p class="world-focus__eyebrow">${ICON.pin}Next on the map</p>
        <h2 id="focus-title">${esc(upcoming.def.name)}</h2>
        <p class="muted">Every open sanctuary is complete. The ${esc(short(upcoming.def))} opens after level ${upcoming.def.opensAfterLevel} (${plural(upcoming.left, 'level')} to go)${upcoming.orSooner ? ', or as soon as every home is complete' : ''}.</p>
        <div class="world-focus__actions"><button class="btn" data-act="play">Play level ${level}</button></div>
      </section>`;
    } else {
      focus = `<section class="card world-focus" aria-labelledby="focus-title"><p class="world-focus__eyebrow">${ICON.sparkle}All done</p><h2 id="focus-title">Every sanctuary is thriving</h2><p class="muted">Thank you for building homes all around the world.</p></section>`;
    }

    // What else is going on, in one row (D38): news waiting in a sanctuary, and the next home to open. Each pill opens
    // its sanctuary; the row is left out when there is nothing to say.
    // At most three news pills; the rest are one tap away in the list (a long world can hold news in many homes, D39).
    const withNews = homes.filter((d) => unseenIn(save, d.id));
    const newsPills =
      withNews
        .slice(0, 3)
        .map((d) => `<button class="now-pill now-pill--news" data-go="${d.id}" style="--accent:${d.accent}">${ICON.sparkle}<span>${esc(newsLine(d.id).replace(/^New: /, ''))} · ${esc(short(d))}</span></button>`)
        .join('') + (withNews.length > 3 ? `<button class="now-pill now-pill--news" data-act="more-news">${ICON.sparkle}<span>News in ${withNews.length - 3} more ${withNews.length - 3 === 1 ? 'home' : 'homes'}</span></button>` : '');
    const nextPill =
      upcoming && !unseenIn(save, upcoming.id)
        ? `<button class="now-pill now-pill--next" data-go="${upcoming.id}" style="--accent:${upcoming.def.accent}">${ICON.lock}<span>Next to open: ${esc(short(upcoming.def))} · after level ${upcoming.def.opensAfterLevel}</span></button>`
        : '';
    const now = newsPills || nextPill ? `<div class="world-now" aria-label="What's new on the map">${newsPills}${nextPill}</div>` : '';

    const card = (d: SanctuaryDef) => {
      const st = statusOf(d.id);
      const art = isRegionId(d.id) ? regionThumb(d.id, stageOf(save, d.id), `wt-${d.id}`) : sceneMarkup(`wt-${d.id}`);
      const prog = st === 'locked' ? (level - 1) / Math.max(1, d.opensAfterLevel) : progressOf(save, d.id);
      const have = homeAnimals(save, d.id).length;
      return `<li><button class="world-card card card--tap is-${st}" data-go="${d.id}" style="--accent:${d.accent}" aria-label="${esc(pinLabel(d))}">
        <span class="world-card__thumb"><svg viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${art}</svg>${st === 'locked' ? `<span class="world-card__lock"><span>${ICON.lock}</span></span>` : ''}</span>
        <span class="world-card__body">
          <span class="world-card__name">${esc(d.name)}</span>
          <span class="world-card__place">${esc(d.place)}</span>
          <span class="world-card__status">${unseenIn(save, d.id) ? `<span class="chip chip--coral chip--news">${ICON.sparkle}${esc(newsLine(d.id))}</span>` : st === 'building' ? `<span class="chip chip--brand">${ICON.sprout}Building</span>` : ''}${esc(statusLine(d))}</span>
          <span class="progress world-card__bar"><span style="width:${Math.round(Math.min(1, prog) * 100)}%"></span></span>
          ${st !== 'locked' ? `<span class="world-card__friends">${have} of ${d.arrivals.length} animals home</span>` : ''}
        </span>
        ${ICON.chevron}
      </button></li>`;
    };
    // Once the endless world has begun, the list leads with what's being built, then what's open, then what's next, with
    // the finished homes last; a long world keeps them in one fold, so the list doesn't grow with every home (D39). The
    // six hand-made homes alone keep their map order, as before.
    // A finished home with news stays in the list until it is visited, so every news pill lands on a card you can see.
    // The fold's cards are drawn when it opens: each has a thumbnail, and a long world has many (review of D39).
    const rank: Record<Status, number> = { building: 0, open: 1, locked: 2, complete: 3 };
    const ordered = homes.length > 6 ? [...homes].sort((a, b) => rank[statusOf(a.id)] - rank[statusOf(b.id)]) : homes;
    const folded = (d: SanctuaryDef) => homes.length > 8 && statusOf(d.id) === 'complete' && !unseenIn(save, d.id);
    const foldedHomes = homes.filter(folded);
    const cards = ordered
      .filter((d) => !folded(d))
      .map(card)
      .join('');
    const finished = foldedHomes.length
      ? `<details class="world-finished" data-fold="finished"><summary>${ICON.check}Finished homes <span class="num">${foldedHomes.length}</span></summary><ul class="world-list" data-fold-body></ul></details>`
      : '';

    // The loop, once (D39), wherever the player looks first; then, the first time here, one line on how the World works.
    // Never both at once.
    const tip = shouldShowLoopCoach(save)
      ? loopCoachMarkup(save)
      : !save.onboarding.worldTipSeen
      ? `<div class="world-tip card" data-world-tip role="note">
          <span class="world-tip__icon">${ICON.info}</span>
          <p>Your puzzles help one home grow at a time. You can change the home you're building whenever you like; progress elsewhere is kept.</p>
          <button class="icon-btn icon-btn--bare" data-act="tip-ok" aria-label="Got it">${ICON.close}</button>
        </div>`
      : '';

    const el = h(`
      <div class="world">
        <header class="screen-head">
          <h1 data-autofocus>World</h1>
          <div class="screen-head__end">${coinPill()}</div>
        </header>
        ${tip}
        ${focus}
        ${now}
        <div class="world-map-wrap" data-map-wrap>
          <div class="world-map card">
            ${worldMapSvg(SANCTUARY_BY_ID.harmony)}
            ${pins}
          </div>
          <button class="world-map__expand" data-act="expand" aria-pressed="false" aria-label="Expand the map">${ICON.globe}<span>Expand map</span></button>
        </div>
        <section aria-labelledby="sanct-title">
          <div class="section-head"><h2 id="sanct-title">Homes</h2><span class="muted num">${homes.length > 6 ? `${openCount} open${finishedCount ? ` · ${finishedCount} finished` : ''}` : `${openCount} of ${homes.length} open`}</span></div>
          <ul class="world-list">${cards}</ul>
          ${finished}
        </section>
        <button class="btn btn--secondary btn--block" data-act="album">${ICON.paw}Animal album</button>
      </div>`);
    root.appendChild(el);
    wireFolds(scope, el, () => foldedHomes.map(card).join(''));

    scope.on(el, 'click', (e) => {
      const t = e.target as HTMLElement;
      const go = t.closest('[data-go]') as HTMLElement | null;
      if (go) {
        const id = go.dataset.go!;
        if (isRegionId(id)) app.router.go({ screen: 'region', id: id as RegionId });
        else app.router.go({ screen: 'sanctuary' });
        return;
      }
      const a = t.closest('[data-act]') as HTMLElement | null;
      if (!a) return;
      if (a.dataset.act === 'play') playMode({ kind: 'level', level: app.save.journey.nextLevel });
      else if (a.dataset.act === 'album') app.router.go({ screen: 'pets' });
      else if (a.dataset.act === 'others') el.querySelector('#sanct-title')?.scrollIntoView({ block: 'start', behavior: app.reducedMotion ? 'auto' : 'smooth' });
      else if (a.dataset.act === 'more-news') {
        // "News in N more homes" lands on the first of them (a home with news is always in the list, never in the fold).
        const rest = new Set(withNews.slice(3).map((d) => d.id));
        const first = [...el.querySelectorAll<HTMLElement>('.world-card')].find((c) => rest.has(c.dataset.go as SanctuaryDef['id'])) ?? null;
        const target = first ?? el.querySelector<HTMLElement>('#sanct-title');
        target?.scrollIntoView({ block: first ? 'center' : 'start', behavior: app.reducedMotion ? 'auto' : 'smooth' });
        first?.focus({ preventScroll: true });
      }
      else if (a.dataset.act === 'expand') {
        // A bigger map to pan around (twice the width, scrolled from the home being built); nothing else moves.
        const wrap = el.querySelector('[data-map-wrap]') as HTMLElement;
        const on = wrap.classList.toggle('is-large');
        a.setAttribute('aria-pressed', String(on));
        a.querySelector('span')!.textContent = on ? 'Shrink map' : 'Expand map';
        if (on) {
          const map = wrap.querySelector('.world-map') as HTMLElement;
          const pin = (map.querySelector('.world-pin.is-building') ?? map.querySelector('.world-pin.is-open')) as HTMLElement | null;
          if (pin) wrap.scrollLeft = Math.max(0, pin.offsetLeft - wrap.clientWidth / 2);
        }
      }
      else if (a.dataset.act === 'loop-ok') dismissLoopCoach(el, 'world');
      else if (a.dataset.act === 'tip-ok') {
        app.save.onboarding.worldTipSeen = true;
        app.persist();
        el.querySelector('[data-world-tip]')?.remove();
      }
    });
  },
};
