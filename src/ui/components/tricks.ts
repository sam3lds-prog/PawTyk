/**
 * Tricks in a sanctuary (D33): tapping an animal (or the scene's Tricks button) opens a small tray under the scene —
 * "Ask Mochi to…" — with every trick and everyone who can do one; owned tricks play right away, the others open their
 * card (watch a video for tokens, or buy with gems). A trick plays on the scene figure itself with an emote bubble
 * beside its head (`trickPlay.ts`). Under reduced motion only the bubble shows.
 */

import { app } from '../../app/app';
import { canOfferVideo, watchVideoFor } from '../../app/rewarded';
import { TRICK_BY_ID, TRICK_GROUPS, TRICK_GROUP_NAME, TRICKS, trickCurrency, trickGroup, type TrickGroup, type TrickId } from '../../meta/catalogs/tricks';
import { buyTrick, ownsTrick, trickWallet } from '../../meta/tricks';
import { ads } from '../../services/ads';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { rhythmFor, type RhythmFeel } from '../../audio/scores';
import { animalInfo, isAnimalId } from '../../meta/animals';
import { iap } from '../../services/iap';
import { currencyOffered } from '../../app/offers';
import { trickBadge } from '../art/tricks';
import { performTrick } from './trickPlay';
import { residentFigure } from '../art/sanctuary';
import { companionFigure } from '../art/companions';
import { isCompanionId } from '../../meta/catalogs/companions';
import { isWildId } from '../../meta/catalogs/places';
import { isPetId } from '../../meta/catalogs/pets';
import { esc, plural } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet, toast } from './sheet';
import { createScene3D } from './scene3d';
import { animalName } from './activities';
import { avatarPortrait } from '../screens/leaderboardTab';

const CURRENCY = { coins: { icon: () => ICON.coin, name: 'Paw Coins' }, vtoken: { icon: () => ICON.videoToken, name: 'video tokens' }, gem: { icon: () => ICON.gem, name: 'gems' } } as const;

export { performTrick };

/** The rhythm an animal performs to (by its kind). */
export function rhythmOf(id: string): RhythmFeel {
  return rhythmFor(isAnimalId(id) ? animalInfo(id).animal : undefined);
}

function priceTag(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  if (!cur) return '<span class="trick-chip__price">Free</span>';
  const short = trickWallet(app.save, cur) < t.price;
  return `<span class="trick-chip__price price price--${cur} ${short ? 'is-short' : ''}">${CURRENCY[cur].icon()}<span class="num">${t.price}</span></span>`;
}

function chipLabel(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  return ownsTrick(app.save, id) ? t.name : `${t.name}, ${t.price} ${CURRENCY[trickCurrency(t)!].name}`;
}

function chipInner(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  const owned = ownsTrick(app.save, id);
  return `${trickBadge(t.emote)}<span class="trick-chip__name">${esc(t.name)}</span>${owned ? '' : priceTag(id)}`;
}

function chipClass(id: TrickId): string {
  const t = TRICK_BY_ID[id];
  return `trick-chip ${ownsTrick(app.save, id) ? '' : 'is-locked'} trick-chip--${t.tier}`;
}

/** Owned and free tricks always; the others only when their currency can be had in this build (D43). */
function trickOffered(id: TrickId): boolean {
  const cur = trickCurrency(TRICK_BY_ID[id]);
  return !cur || ownsTrick(app.save, id) || currencyOffered(app.save, cur);
}

const TIER_ORDER = { free: 0, coins: 1, video: 2, premium: 3 } as const;

/**
 * The buttons for a group (D48 PR D: emotes, tricks, dances, group acts; `trick` and `emote` as before), free first,
 * then coins, video tokens and gems, catalog order within each.
 */
export function trickChips(group: TrickGroup = 'trick'): string {
  return TRICKS.filter((t) => trickGroup(t) === group && trickOffered(t.id))
    .sort((a, b) => TIER_ORDER[a.tier] - TIER_ORDER[b.tier])
    .map((t) => chipMarkup(t.id))
    .join('');
}

const chipMarkup = (id: TrickId) => `<li><button class="${chipClass(id)}" data-trick="${id}" aria-label="${esc(chipLabel(id))}">${chipInner(id)}</button></li>`;

/**
 * D48 PR D: the last few played, for the top of the tray (kept for this app session, newest first; owned ones only).
 */
let recent: TrickId[] = [];
export function noteRecent(id: TrickId): void {
  recent = [id, ...recent.filter((x) => x !== id)].slice(0, 4);
}
export function recentTricks(): TrickId[] {
  return recent.filter((id) => ownsTrick(app.save, id));
}
const recentRow = () =>
  recentTricks().length
    ? `<div class="trick-tray__recent" role="group" aria-label="Played lately"><span class="muted">Again:</span><ul class="trick-tray__list trick-tray__list--recent">${recentTricks().map(chipMarkup).join('')}</ul></div>`
    : '';

/**
 * The partners a group act takes (D48 PR D): the nearest free animals in the scene (not mid-trick, not away on a
 * decoration), up to the act's own number. A duet with nobody free is a solo; a parade marches with whoever is there.
 */
export function partnersFor(svg: SVGSVGElement, lead: SVGGElement, n: number): SVGGElement[] {
  const x = Number(lead.dataset.gx);
  return [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-gx]')]
    .filter((g) => g !== lead && !g.dataset.trick && !g.classList.contains('is-away'))
    .sort((a, b) => Math.abs(Number(a.dataset.gx) - x) - Math.abs(Number(b.dataset.gx) - x))
    .slice(0, n);
}

/** Updates the chips in place (after a purchase), so focus and scroll stay where they are. */
function updateChips(root: ParentNode): void {
  for (const b of root.querySelectorAll<HTMLElement>('.trick-chip[data-trick]')) {
    const id = b.dataset.trick as TrickId;
    b.className = chipClass(id);
    b.setAttribute('aria-label', chipLabel(id));
    b.innerHTML = chipInner(id);
  }
}

type Who = { kind: 'pet' | 'friend'; id: string };
const whoKey = (w: Who) => `${w.kind}:${w.id}`;

export interface TrickTray {
  /** Opens the tray for an animal in the scene (by its figure). */
  open(fig: SVGGElement): void;
  /** Opens the tray for an animal by id (or the first one in the scene); `focus` moves focus into it. */
  openFor(id?: string, focus?: boolean): void;
  close(): void;
  refresh(): void;
  readonly isOpen: boolean;
}

export interface TrickTrayOptions {
  /** Where focus goes when the tray closes from inside (its close button). */
  returnFocus?: () => HTMLElement | null;
  /** Told when the tray opens or closes (to keep a toggle button's aria-expanded right). */
  onToggle?: (open: boolean) => void;
  /** Told when a trick starts on a figure (the scene camera's close-up, D44 PR F). */
  onPlayed?: (fig: SVGGElement, id: TrickId) => void;
  /** D48 PR B: the tray's Feed button (the animal's card, at its food). Without it there is no Feed button. */
  onFeed?: (id: string) => void;
}

/**
 * Mounts the tray into `host` (a slot under the scene). `svg` returns the live scene. Anyone in the scene can be
 * picked from the tray itself, so it works without tapping the scene (keyboard, screen readers).
 */
export function mountTrickTray(scope: Scope, host: HTMLElement, svg: () => SVGSVGElement | null, opts: TrickTrayOptions = {}): TrickTray {
  let target: Who | null = null;
  let tab: TrickGroup = 'trick';
  host.id ||= `trick-tray-${Math.random().toString(36).slice(2, 8)}`;

  const cast = (): Who[] => {
    const s = svg();
    if (!s) return [];
    return [
      ...[...s.querySelectorAll<SVGGElement>('.sanctuary__pet[data-pet]')].map((g) => ({ kind: 'pet' as const, id: g.dataset.pet! })),
      ...[...s.querySelectorAll<SVGGElement>('.sanctuary__friend[data-friend]')].map((g) => ({ kind: 'friend' as const, id: g.dataset.friend! })),
    ];
  };

  const figure = (): SVGGElement | null => {
    const s = svg();
    if (!s || !target) return null;
    return s.querySelector<SVGGElement>(target.kind === 'pet' ? `.sanctuary__pet[data-pet="${target.id}"]` : `.sanctuary__friend[data-friend="${target.id}"]`);
  };

  function setTarget(w: Who | null): void {
    const was = !!target;
    target = w;
    render();
    if (was !== !!target) opts.onToggle?.(!!target);
  }

  function render(): void {
    const everyone = cast();
    // Whoever the tray was for may have left the scene (a re-render): fall back to someone who's there.
    if (target && !everyone.some((w) => whoKey(w) === whoKey(target!))) target = everyone[0] ?? null;
    if (!target) {
      host.hidden = true;
      host.innerHTML = '';
      return;
    }
    const name = animalName(target.id);
    host.hidden = false;
    host.innerHTML = `<div class="trick-tray card" role="group" aria-label="${esc(`Tricks for ${name}`)}">
      <div class="trick-tray__head">
        ${everyone.length > 1 ? '' : `<span class="trick-tray__pic">${avatarPortrait(target.id)}</span>`}
        <b>Ask ${esc(name)} to…</b>
        ${opts.onFeed ? `<button class="btn btn--small btn--secondary trick-tray__feed" data-act="tray-feed" aria-label="${esc(`Feed ${name}`)}">${ICON.heart}Feed</button>` : ''}
        <button class="icon-btn icon-btn--small" data-act="tray-close" aria-label="Close tricks">${ICON.close}</button>
      </div>
      ${recentRow()}
      <div class="seg seg--small trick-tray__tabs" role="tablist" aria-label="Kinds of tricks">
        ${TRICK_GROUPS.map((k) => `<button role="tab" class="seg__btn" data-tray-tab="${k}" aria-selected="${k === tab}">${TRICK_GROUP_NAME[k]}</button>`).join('')}
      </div>
      ${
        everyone.length > 1
          ? `<div class="trick-tray__who" role="group" aria-label="Who does the trick">${everyone
              .map((w) => `<button class="trick-who" data-who="${whoKey(w)}" aria-pressed="${whoKey(w) === whoKey(target!)}" aria-label="${esc(animalName(w.id))}">${avatarPortrait(w.id)}</button>`)
              .join('')}</div>`
          : ''
      }
      <ul class="trick-tray__list" role="tabpanel" aria-label="${TRICK_GROUP_NAME[tab]}">${trickChips(tab)}</ul>
      <p class="sr-only" aria-live="polite" data-tray-status></p>
    </div>`;
  }

  scope.on(host, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('[data-act="tray-close"]')) {
      setTarget(null);
      opts.returnFocus?.()?.focus({ preventScroll: true });
      return;
    }
    if (t.closest('[data-act="tray-feed"]') && target) {
      opts.onFeed?.(target.id);
      return;
    }
    const tb = t.closest('[data-tray-tab]') as HTMLElement | null;
    if (tb) {
      tab = tb.dataset.trayTab as TrickGroup;
      render();
      host.querySelector<HTMLElement>(`[data-tray-tab="${tab}"]`)?.focus({ preventScroll: true });
      return;
    }
    const who = t.closest('[data-who]') as HTMLElement | null;
    if (who) {
      const [kind, id] = who.dataset.who!.split(':') as ['pet' | 'friend', string];
      setTarget({ kind, id });
      host.querySelector<HTMLElement>(`[data-who="${kind}:${id}"]`)?.focus({ preventScroll: true });
      return;
    }
    const chip = t.closest('[data-trick]') as HTMLElement | null;
    if (!chip || !target) return;
    const id = chip.dataset.trick as TrickId;
    if (!ownsTrick(app.save, id)) {
      showTrickSheet(scope, id, { who: target.id, onBought: () => updateChips(host) });
      return;
    }
    const s = svg();
    const fig = figure();
    const status = host.querySelector('[data-tray-status]');
    const name = animalName(target.id);
    if (s && fig && performTrick(s, fig, id, app.reducedMotion)) {
      // D48 PR D: a group act brings in the nearest free friends (a duet's partner, a parade's marchers).
      const n = TRICK_BY_ID[id].partners ?? 0;
      const partners = n ? partnersFor(s, fig, n) : [];
      partners.forEach((p, i) => performTrick(s, p, id, app.reducedMotion, i + 1));
      // The tune, with this animal's own rhythm under it (D45 PR D): a sheep's wave and a piglet's don't sound alike.
      feel('trick', { cue: `trick:${id}`, rhythm: rhythmOf(target.id) });
      track('trick_played', { trick: id, partners: partners.length });
      noteRecent(id);
      // The "Again" row, redrawn in place (focus stays on the chip that was tapped).
      const row = host.querySelector('.trick-tray__recent');
      const fresh = recentRow();
      const fromRow = !!chip.closest('.trick-tray__recent');
      if (row) row.outerHTML = fresh;
      else host.querySelector('.trick-tray__tabs')?.insertAdjacentHTML('beforebegin', fresh);
      if (fromRow) host.querySelector<HTMLElement>(`.trick-tray__recent [data-trick="${id}"]`)?.focus({ preventScroll: true });
      opts.onPlayed?.(fig, id);
      if (status) status.textContent = `${name}: ${TRICK_BY_ID[id].name}!${partners.length ? ` With ${partners.map((p) => p.dataset.name ?? '').filter(Boolean).join(' and ')}.` : ''}`;
    } else if (fig) {
      const msg = fig.classList.contains('is-away') ? `${name} is busy right now. Ask again in a moment.` : `${name} is still finishing a trick.`;
      if (fig.classList.contains('is-away')) toast(msg);
      if (status) status.textContent = msg;
    }
  });

  return {
    open(fig) {
      const pet = fig.dataset.pet;
      const friend = fig.dataset.friend;
      setTarget(pet ? { kind: 'pet', id: pet } : friend ? { kind: 'friend', id: friend } : null);
      if (target) host.scrollIntoView?.({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
    },
    openFor(id, focus = false) {
      const everyone = cast();
      setTarget(everyone.find((w) => w.id === id) ?? everyone[0] ?? null);
      if (!target) return;
      host.scrollIntoView?.({ block: 'nearest', behavior: app.reducedMotion ? 'auto' : 'smooth' });
      if (focus) host.querySelector<HTMLElement>('.trick-chip')?.focus({ preventScroll: true });
    },
    close() {
      setTarget(null);
    },
    refresh: render,
    get isOpen() {
      return !!target;
    },
  };
}

/** A trick's card: a preview, its price, and how to get it. */
export function showTrickSheet(scope: Scope, id: TrickId, opts: { who?: string; onBought?: () => void } = {}): void {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  const who = opts.who ?? 'mochi';
  const whoName = animalName(who);
  const owned = ownsTrick(app.save, id);

  const body = () => {
    const have = cur ? trickWallet(app.save, cur) : 0;
    const short = cur ? Math.max(0, t.price - have) : 0;
    let actions = '';
    if (owned || ownsTrick(app.save, id)) actions = `<p class="trick-sheet__owned">${ICON.check}Yours. In a sanctuary, tap an animal or Tricks and ask for it.</p>`;
    else if (cur === 'coins')
      // D48 PR D: the everyday ones, for Paw Coins (earned by solving).
      actions = short
        ? `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${t.price} Paw Coins`)}">${ICON.coin}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'Paw Coin')}. Solving a new level earns 35.</p>`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Learn it for ${ICON.coin}<span class="num">${t.price}</span></button>`;
    else if (cur === 'vtoken')
      actions = short
        ? `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${t.price} video tokens`)}">${ICON.videoToken}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'video token')}. Video tokens come only from short reward videos you choose to watch.</p>
           ${ads.available && canOfferVideo() ? `<button class="btn btn--secondary btn--block" data-act="watch">${ICON.videoToken}Watch a video: +1 token</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Get it for ${ICON.videoToken}<span class="num">${t.price}</span></button>`;
    else if (cur === 'gem')
      actions = short
        ? `<button class="btn btn--block" disabled aria-label="${esc(`Costs ${t.price} gems`)}">${ICON.gem}<span class="num">${t.price}</span></button>
           <p class="muted">You have ${plural(have, 'gem')}.${iap.available ? ' Gem packs are in the Shop.' : ''}</p>
           ${iap.available ? `<button class="btn btn--secondary btn--block" data-act="gems">${ICON.gem}See gem packs</button>` : ''}`
        : `<button class="btn btn--block" data-act="buy" data-autofocus>Buy for ${ICON.gem}<span class="num">${t.price}</span></button>`;
    return `
      ${t.tier === 'premium' || t.tier === 'video' ? `<span class="chip ${t.tier === 'premium' ? 'chip--gem' : 'chip--video'}">${t.tier === 'premium' ? `${ICON.gem}Premium` : `${ICON.videoToken}Video-token`} ${TRICK_GROUP_NAME[trickGroup(t)].toLowerCase().replace(/s$/, '')}</span>` : `<span class="chip">${TRICK_GROUP_NAME[trickGroup(t)].replace(/s$/, '')}</span>`}
      <figure class="trick-sheet__stage sanctuary__scene is-live" aria-label="${esc(`${whoName} showing ${t.name}`)}">
        <svg viewBox="0 0 120 104" role="img"><rect width="120" height="104" rx="14" fill="#e6f2df"/><path d="M0 84 Q60 74 120 84 V90 A14 14 0 0 1 106 104 H14 A14 14 0 0 1 0 90 Z" fill="#cfe3c4"/>${t.partners ? stagePartners(who, t.partners) : stageFigure(who)}</svg>
      </figure>
      <button class="btn btn--quiet btn--small trick-sheet__again" data-act="preview">${ICON.restart}Show me again</button>
      <p class="sheet__lead">${esc(t.blurb)}</p>
      <div class="sheet__actions">${actions}<button class="btn btn--quiet" data-act="close">Close</button></div>
      <p class="muted trick-sheet__note">Tricks are just for fun. They change nothing in your puzzles.</p>`;
  };

  const sh = openSheet(scope, { title: t.name, className: 'trick-sheet', body: body() });
  // A preview, never an unlock: it plays on the card's own little stage (a group act with its partners there too).
  const preview = () => {
    const s = sh.el.querySelector<SVGSVGElement>('.trick-sheet__stage svg');
    const figs = [...(s?.querySelectorAll<SVGGElement>('.sanctuary__pet') ?? [])];
    if (s && figs[0] && performTrick(s, figs[0], id, app.reducedMotion)) {
      figs.slice(1).forEach((f, i) => performTrick(s, f, id, app.reducedMotion, i + 1));
      feel('trick', { cue: `trick:${id}` });
    }
  };
  // The preview animal is a 3D toy too (D34), when the sanctuary's are.
  const s3d = createScene3D();
  sh.scope.onDispose(() => s3d.dispose());
  s3d.attach(sh.el.querySelector<HTMLElement>('.trick-sheet__stage'), sh.el.querySelector<SVGSVGElement>('.trick-sheet__stage svg'));
  let first = false;
  const firstPreview = () => {
    if (first || !sh.scope.alive) return;
    first = true;
    preview();
  };
  // First show it once the toy is there (or straight away, drawn, when there won't be one).
  void s3d.ready.then((ok) => sh.scope.alive && sh.scope.timeout(firstPreview, ok ? 250 : 350));

  let busy = false;
  sh.scope.on(sh.el, 'click', async (e) => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a || busy) return;
    switch (a.dataset.act) {
      case 'close':
        sh.close();
        break;
      case 'preview':
        preview();
        break;
      case 'gems':
        sh.close();
        app.router.go({ screen: 'shop', tab: 'gems' });
        break;
      case 'watch': {
        busy = true;
        const r = await watchVideoFor('vtoken');
        busy = false;
        if (!sh.scope.alive) return;
        if (r === 'granted') toast('+1 video token', ICON.videoToken);
        else toast(r === 'cap' ? "That's all the videos for today. More tomorrow." : 'No video is available right now. Try again in a little while.');
        rerender();
        break;
      }
      case 'buy': {
        busy = true;
        const r = buyTrick(app.save, id);
        busy = false;
        if (r === 'ok') {
          app.persist();
          feel('buy');
          track('trick_bought', { trick: id, tier: t.tier, amount: t.price });
          toast(`${t.name} learned! Ask for it in any sanctuary.`);
          opts.onBought?.();
          rerender();
          preview();
        } else toast(r === 'insufficient' ? `Not enough ${cur ? CURRENCY[cur].name : 'tokens'} yet.` : 'Already yours.');
        busy = false;
        break;
      }
    }
  });

  /** Re-renders the actions only (after a video or a purchase), keeping the preview stage in place. */
  function rerender(): void {
    const tmp = document.createElement('div');
    tmp.innerHTML = body();
    const next = tmp.querySelector('.sheet__actions');
    const now = sh.el.querySelector('.sheet__actions');
    if (next && now) now.replaceWith(next);
  }
}

/** A group act's preview (D48 PR D): the animal and a friend or two, smaller, side by side. */
function stagePartners(id: string, n: number): string {
  const friends = ['mochi', 'biscuit', 'pip'].filter((x) => x !== id).slice(0, Math.min(2, n));
  const all = [id, ...friends];
  const H = 26;
  return all
    .map((who, i) => {
      const x = 60 + (i - (all.length - 1) / 2) * 34;
      if (isPetId(who)) return residentFigure(who, x, 90, H + 2, 'happy');
      if (isCompanionId(who) || isWildId(who)) return companionFigure(who, x, 90, H, 'happy');
      return residentFigure('mochi', x, 90, H + 2, 'happy');
    })
    .join('');
}

/** A preview figure on the little stage in the trick card (a scene figure, so the trick plays on it). */
function stageFigure(id: string): string {
  if (isPetId(id)) return residentFigure(id, 60, 90, 34, 'happy');
  if (isCompanionId(id) || isWildId(id)) return companionFigure(id, 60, 90, 32, 'happy');
  return residentFigure('mochi', 60, 90, 34, 'happy');
}
