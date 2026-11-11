/**
 * Trying something on in the player's own home before buying it (M1): a decoration put out where it would stand (what
 * shares its spot tucked away for the moment), or a trick played by one of the home's animals. It is a picture of the
 * save, never the save: nothing is bought, owned, shown or learned by looking, and leaving puts everything back.
 *
 * The Shop's card opens it (`tryRoute`), first rewriting its own history entry to reopen that card (`shopRouteFor`),
 * so **Back to <item>** returns the player to exactly what they were looking at. The home draws its scene with
 * `tryDecorList`, shows `tryBannerMarkup` over it, and leaves out what would act on the real save (the walk, photos,
 * putting decorations out).
 */

import { app } from '../../app/app';
import { DECOR_BY_ID, decorHome, isDecorId, spotMates, type DecorId } from '../../meta/catalogs/decor';
import { isRegionId, sanctuaryDef, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { TRICK_BY_ID, isTrickId, trickCurrency, type TrickId } from '../../meta/catalogs/tricks';
import { decorPrice, owns, walletBalance } from '../../meta/sanctuary';
import { ownsTrick } from '../../meta/tricks';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Route } from '../router';

export type TryOn = { kind: 'decor'; id: DecorId } | { kind: 'trick'; id: TrickId };

const CURRENCY_ICON = { coins: ICON.coin, vtoken: ICON.videoToken, gem: ICON.gem } as const;
const CURRENCY_NAME = { coins: 'Paw Coins', vtoken: 'video tokens', gem: 'gems' } as const;

/** What a home's route asks to try on, if it is something that can be tried there now. */
export function tryOnOf(route: { tryDecor?: string; tryTrick?: string }, home: SanctuaryId): TryOn | null {
  // A pack's piece is only ever shown in the Shop, with its pack (D47 PR 7): never tried on in a home.
  if (isDecorId(route.tryDecor) && decorHome(DECOR_BY_ID[route.tryDecor]) === home && !owns(app.save, route.tryDecor) && DECOR_BY_ID[route.tryDecor].unlock.kind !== 'pack')
    return { kind: 'decor', id: route.tryDecor };
  if (isTrickId(route.tryTrick) && !ownsTrick(app.save, route.tryTrick)) return { kind: 'trick', id: route.tryTrick };
  return null;
}

/** The decorations a home's scene draws while `t` is tried on: the piece out, whatever shares its spot away. */
export function tryDecorList<T extends string>(decor: readonly T[], t: TryOn | null): T[] {
  if (t?.kind !== 'decor') return [...decor];
  const mates = new Set<string>(spotMates(t.id).map((m) => m.id));
  return [...decor.filter((d) => !mates.has(d) && d !== t.id), t.id as string as T];
}

/** The route of the home a decoration belongs to, trying it on. */
export function tryRoute(t: TryOn, home: SanctuaryId): Route {
  const param = t.kind === 'decor' ? { tryDecor: t.id } : { tryTrick: t.id };
  return isRegionId(home) ? { screen: 'region', id: home, ...param } : { screen: 'sanctuary', ...param };
}

/** The Shop, with the item's card open (where Back from a try-on returns). */
export function shopRouteFor(t: TryOn, place?: SanctuaryId): Route {
  if (t.kind === 'decor') return { screen: 'shop', tab: 'decor', sanctuary: decorHome(DECOR_BY_ID[t.id]), decor: t.id };
  return { screen: 'shop', tab: 'tricks', trick: t.id, ...(place ? { sanctuary: place } : {}) };
}

/** Where to try a trick on: the home the player last built in, if anyone lives there (else the first with someone). */
export function trickHome(homes: Array<{ id: SanctuaryId; residents: number }>, preferred: SanctuaryId | null): SanctuaryId | null {
  const lived = homes.filter((h) => h.residents > 0);
  return lived.find((h) => h.id === preferred)?.id ?? lived[0]?.id ?? null;
}

/** The item's name, price and what the player has toward it, in words (for the banner and screen readers). */
export function tryOnFacts(t: TryOn): { name: string; price: string; have: string } {
  if (t.kind === 'decor') {
    const d = DECOR_BY_ID[t.id];
    const p = decorPrice(t.id);
    const price = p ? `${p.amount} ${CURRENCY_NAME[p.currency]}` : d.unlock.kind === 'chapter' ? 'a chapter gift' : '';
    return { name: d.name, price, have: p ? `you have ${walletBalance(app.save, p.currency)}` : '' };
  }
  const tr = TRICK_BY_ID[t.id];
  const cur = trickCurrency(tr);
  return { name: tr.name, price: cur ? `${tr.price} ${CURRENCY_NAME[cur]}` : 'free', have: cur ? `you have ${walletBalance(app.save, cur)}` : '' };
}

/** The banner over a home while something is tried on: what it is, that it isn't the player's yet, and the way back. */
export function tryBannerMarkup(t: TryOn, home: SanctuaryId): string {
  const f = tryOnFacts(t);
  const where = home === 'harmony' ? 'Pet Garden' : sanctuaryDef(home).short;
  const p = t.kind === 'decor' ? decorPrice(t.id) : null;
  const cur = t.kind === 'trick' ? trickCurrency(TRICK_BY_ID[t.id]) : (p?.currency ?? null);
  const amount = t.kind === 'trick' ? TRICK_BY_ID[t.id].price : (p?.amount ?? 0);
  const tag = cur ? `<span class="price price--${cur}">${CURRENCY_ICON[cur]}<span class="num">${amount}</span></span>` : '';
  const what = t.kind === 'decor' ? `Trying the ${esc(f.name)} in your ${esc(where)}` : `Trying ${esc(f.name)} in your ${esc(where)}`;
  return `<div class="try-banner card" role="status" data-try-banner="${t.kind}:${t.id}">
    <span class="try-banner__text"><b>${what}</b><small>Not yours yet${f.price ? ` · ${esc(f.price)}${f.have ? ` (${esc(f.have)})` : ''}` : ''}. Nothing changes until you buy it.</small></span>
    ${tag}
    <span class="try-banner__actions">
      ${t.kind === 'trick' ? `<button class="btn btn--quiet btn--small" data-act="try-again">${ICON.restart}Again</button>` : ''}
      <button class="btn btn--small" data-act="try-back">${ICON.back}Back to ${esc(f.name)}</button>
    </span>
  </div>`;
}
