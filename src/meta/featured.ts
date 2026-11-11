/**
 * "Featured for your sanctuary" (M1): a short, honest pick from the existing catalog for the home the player is looking
 * at in the Shop. Chosen only from the player's own save (what they own, what lives there, what they have toward a
 * price), so it is the same every time for the same save: no randomness, no "popular", no countdowns, no prices other
 * than the real ones. Things this build can't sell are never featured.
 *
 *  1. A decoration for this home: the next piece of a themed set already started, else what the player can afford now
 *     (the dearest such, so it's a real treat), else the nearest within reach.
 *  2. A trick the animals here could learn: the cheapest the player can afford (coins first), else the nearest.
 *  3. A favorite food of someone living here that the pantry has none of, the newest arrival's first.
 *  4. A special piece (video tokens or gems), when this build sells it, the player has none of that tier here and the
 *     player already has some of that currency.
 *
 * D49 PR A: three at most (one shown large, two small), and what the player can afford now comes first, so the big
 * one is something they could have today. The trick and the food are for the home's newest animal (the one the player
 * just met), by name.
 */

import { DECOR, DECOR_SET_BY_ID, decorHome, decorTier, type DecorId } from './catalogs/decor';
import { FOOD_BY_ID, type FoodId } from './catalogs/foods';
import { TRICKS, trickCurrency, type TrickId } from './catalogs/tricks';
import { animalInfo, animalsOf, isHome } from './animals';
import { favoriteFoods, foodCount } from './feeding';
import { decorPrice, decorUnlocked, owns, setProgress, walletBalance } from './sanctuary';
import { ownsTrick } from './tricks';
import type { SanctuaryId } from './catalogs/sanctuaries';
import type { SaveV2 } from '../services/storage';

export type Currency = 'coins' | 'vtoken' | 'gem';

/** `afford`: the player has the price now (D49 PR A: those come first). */
export type Featured =
  | { kind: 'decor'; id: DecorId; reason: string; afford: boolean }
  | { kind: 'trick'; id: TrickId; reason: string; afford: boolean }
  | { kind: 'food'; id: FoodId; reason: string; afford: boolean };

/** D49 PR A: one large and two small (was four in M1). */
export const FEATURED_MAX = 3;

/**
 * The picks for `home` (at most three, each kind at most once except decorations, two), affordable first.
 * `offered(currency)` says what this build sells (`app/offers.ts`).
 */
export function featuredFor(save: SaveV2, home: SanctuaryId, offered: (c: Currency) => boolean): Featured[] {
  const out: Featured[] = [];
  const have = (c: Currency) => walletBalance(save, c);
  // Only what is for sale here, now, in this build, and not owned.
  const buyable = DECOR.filter((d) => decorHome(d) === home && !owns(save, d.id) && decorUnlocked(save, d.id)).filter((d) => {
    const p = decorPrice(d.id);
    return !!p && offered(p.currency);
  });
  const coinPieces = buyable.filter((d) => decorPrice(d.id)!.currency === 'coins');
  // 1. A set already started, its next piece.
  const started = coinPieces
    .filter((d) => d.set && setProgress(save, d.set).owned > 0)
    .sort((a, b) => setProgress(save, b.set!).owned - setProgress(save, a.set!).owned || decorPrice(a.id)!.amount - decorPrice(b.id)!.amount)[0];
  if (started) {
    const p = setProgress(save, started.set!);
    out.push({ kind: 'decor', id: started.id, reason: `The next piece of your ${DECOR_SET_BY_ID[started.set!].name} set (${p.owned} of ${p.total})`, afford: decorPrice(started.id)!.amount <= have('coins') });
  } else {
    const affordable = coinPieces.filter((d) => decorPrice(d.id)!.amount <= have('coins')).sort((a, b) => decorPrice(b.id)!.amount - decorPrice(a.id)!.amount)[0];
    const nearest = [...coinPieces].sort((a, b) => decorPrice(a.id)!.amount - decorPrice(b.id)!.amount)[0];
    const pick = affordable ?? nearest;
    if (pick) out.push({ kind: 'decor', id: pick.id, reason: affordable ? 'You have the coins for it now' : `${decorPrice(pick.id)!.amount - have('coins')} more Paw Coins to go`, afford: !!affordable });
  }
  // 2. A trick for the animals here, named for the newest of them (the one the player most likely just met).
  const residents = animalsOf(home).filter((a) => isHome(save, a));
  const newestFirst = [...residents].reverse();
  if (residents.length) {
    const learnable = TRICKS.filter((t) => !ownsTrick(save, t.id)).filter((t) => {
      const c = trickCurrency(t);
      return !!c && offered(c);
    });
    const order = (t: (typeof TRICKS)[number]) => ({ coins: 0, vtoken: 1, gem: 2 })[trickCurrency(t)!];
    const can = learnable.filter((t) => t.price <= have(trickCurrency(t)!)).sort((a, b) => order(a) - order(b) || a.price - b.price)[0];
    const near = learnable.filter((t) => trickCurrency(t) === 'coins').sort((a, b) => a.price - b.price)[0];
    const t = can ?? near;
    const who = animalInfo(newestFirst[0]).name;
    if (t) out.push({ kind: 'trick', id: t.id, reason: can ? `${who} could learn it today` : `For ${who} and friends`, afford: !!can });
    // 3. A favorite food nobody has stocked, the newest arrival's first.
    for (const a of newestFirst) {
      let price = 0;
      let cur: Currency = 'coins';
      const f = favoriteFoods(a).find((id) => {
        const food = FOOD_BY_ID[id];
        const c: Currency | null = food.coins ? 'coins' : food.tokens ? 'vtoken' : food.gems ? 'gem' : null;
        if (!c || !offered(c) || foodCount(save, id) !== 0) return false;
        cur = c;
        price = food.coins ?? food.tokens ?? food.gems ?? 0;
        return true;
      });
      if (f) {
        out.push({ kind: 'food', id: f, reason: `${animalInfo(a).name}'s favorite`, afford: price <= have(cur) });
        break;
      }
    }
  }
  // 4. A special piece, for a currency the player already has some of.
  const special = buyable
    .filter((d) => decorTier(d) === 'video' || decorTier(d) === 'premium')
    .filter((d) => have(decorPrice(d.id)!.currency) > 0)
    .filter((d) => !DECOR.some((o) => decorHome(o) === home && decorTier(o) === decorTier(d) && owns(save, o.id)))
    .sort((a, b) => decorPrice(a.id)!.amount - decorPrice(b.id)!.amount)[0];
  if (special)
    out.push({
      kind: 'decor',
      id: special.id,
      reason: decorTier(special) === 'video' ? 'A special piece, for video tokens' : 'A premium piece, for gems',
      afford: decorPrice(special.id)!.amount <= have(decorPrice(special.id)!.currency),
    });
  // What the player can have today first (a stable sort: otherwise in the order above).
  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => Number(b.f.afford) - Number(a.f.afford) || a.i - b.i)
    .map((x) => x.f)
    .slice(0, FEATURED_MAX);
}
