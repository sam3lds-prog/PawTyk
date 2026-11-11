/**
 * "Featured for your sanctuary" (M1): a short, honest pick from the existing catalog for the home the player is looking
 * at in the Shop. Chosen only from the player's own save (what they own, what lives there, what they have toward a
 * price), so it is the same every time for the same save: no randomness, no "popular", no countdowns, no prices other
 * than the real ones. Things this build can't sell are never featured.
 *
 *  1. A decoration for this home.
 *  2. A trick the animals here could learn.
 *  3. A favorite food of someone living here that the pantry has none of, the newest arrival's first.
 *  4. A special piece (video tokens or gems) the player can have now.
 *
 * D49 PR A: three at most (one shown large, two small), and what the player can afford now comes first, so the big
 * one is something they could have today. The trick and the food are for the home's newest animal (the one the player
 * just met), by name.
 *
 * D50 PR C, relevant picks. Within what the player can afford (still first), things rank by what they would *do* in
 * this home, and every pick's line says which reason it was chosen for (the strongest one it has):
 *
 *  - **interest**: the player tried it on in the home and didn't buy it ("You tried it on in your Farm"); the only bit
 *    of browsing that is kept, the last few items (`offers.tried`), and only for things still not owned;
 *  - **collection**: the next piece of a themed set the player has started ("2 of 4 in your Spring Meadow set");
 *  - **animal interaction**: the animals use it ("Cotton and Truffle will play with it"), over a piece that only stands;
 *  - then price: among what they can afford, the dearest (a real treat); otherwise the nearest.
 *
 * Gem and video-token things are featured only when the player has enough for them now: a pick is never a thing they
 * can't get. Pure.
 */

import { DECOR, DECOR_BY_ID, DECOR_SET_BY_ID, decorHome, decorTier, type DecorId } from './catalogs/decor';
import { FOOD_BY_ID, type FoodId } from './catalogs/foods';
import { TRICKS, trickCurrency, type TrickId } from './catalogs/tricks';
import { animalInfo, animalsOf, isHome } from './animals';
import { favoriteFoods, foodCount } from './feeding';
import { decorPrice, decorUnlocked, owns, setProgress, walletBalance } from './sanctuary';
import { ownsTrick } from './tricks';
import { sanctuaryDef, type SanctuaryId } from './catalogs/sanctuaries';
import { TRIED_MAX, type SaveV2 } from '../services/storage';

export type Currency = 'coins' | 'vtoken' | 'gem';

/** Why a pick was chosen (D50 PR C): its strongest reason. */
export type FeaturedWhy = 'interest' | 'collection' | 'interaction' | 'afford' | 'near' | 'favorite' | 'learn' | 'special';

/** `afford`: the player has the price now (D49 PR A: those come first). */
export type Featured =
  | { kind: 'decor'; id: DecorId; reason: string; afford: boolean; why?: FeaturedWhy }
  | { kind: 'trick'; id: TrickId; reason: string; afford: boolean; why?: FeaturedWhy }
  | { kind: 'food'; id: FoodId; reason: string; afford: boolean; why?: FeaturedWhy };

/** D49 PR A: one large and two small (was four in M1). */
export const FEATURED_MAX = 3;

export interface FeaturedOptions {
  /** D50 PR C: whether the animals use a decoration (the UI knows its activities). Missing: none count as interactive. */
  interactive?: (id: DecorId) => boolean;
}

// ------------------------------------------------------------------ local interest (D50 PR C)

/** Notes that the player tried something on (most recent first, at most a few, duplicates moved to the front). */
export function noteTried(save: SaveV2, kind: 'decor' | 'trick', id: string): void {
  const key = `${kind}:${id}`;
  const list = (save.offers ??= {}).tried ?? [];
  save.offers.tried = [key, ...list.filter((k) => k !== key)].slice(0, TRIED_MAX);
}

/** Whether the player tried it on (and, for the pick to mean anything, still doesn't own it). */
export function wasTried(save: SaveV2, kind: 'decor' | 'trick', id: string): boolean {
  return !!save.offers?.tried?.includes(`${kind}:${id}`);
}

// ------------------------------------------------------------------ the picks

const placeShort = (home: SanctuaryId) => (home === 'harmony' ? 'Pet Garden' : sanctuaryDef(home).short);

/** "Cotton", "Cotton and Truffle", "Cotton, Truffle and friends". */
function names(save: SaveV2, home: SanctuaryId): string {
  const here = animalsOf(home).filter((a) => isHome(save, a));
  const ns = [...here].reverse().map((a) => animalInfo(a).name);
  if (!ns.length) return 'Your animals';
  if (ns.length === 1) return ns[0];
  if (ns.length === 2) return `${ns[0]} and ${ns[1]}`;
  return `${ns[0]}, ${ns[1]} and friends`;
}

/**
 * The picks for `home` (at most three, each kind at most once except decorations, two), affordable first.
 * `offered(currency)` says what this build sells (`app/offers.ts`).
 */
export function featuredFor(save: SaveV2, home: SanctuaryId, offered: (c: Currency) => boolean, o: FeaturedOptions = {}): Featured[] {
  const out: Featured[] = [];
  const have = (c: Currency) => walletBalance(save, c);
  const interactive = o.interactive ?? (() => false);
  const residents = animalsOf(home).filter((a) => isHome(save, a));
  // Only what is for sale here, now, in this build, and not owned.
  const buyable = DECOR.filter((d) => decorHome(d) === home && !owns(save, d.id) && decorUnlocked(save, d.id)).filter((d) => {
    const p = decorPrice(d.id);
    return !!p && offered(p.currency);
  });

  // 1. A decoration (coins), ranked by what it would mean here.
  const coinPieces = buyable.filter((d) => decorPrice(d.id)!.currency === 'coins');
  const affordable = (id: DecorId) => decorPrice(id)!.amount <= have('coins');
  const started = (id: DecorId) => {
    const set = DECOR_BY_ID[id].set;
    return !!set && setProgress(save, set).owned > 0;
  };
  /** Its strongest reason, and how strong (higher first). */
  const why = (id: DecorId): [FeaturedWhy, number] =>
    wasTried(save, 'decor', id) ? ['interest', 3] : started(id) ? ['collection', 2] : residents.length && interactive(id) ? ['interaction', 1] : affordable(id) ? ['afford', 0] : ['near', 0];
  const ranked = [...coinPieces].sort((a, b) => {
    const fa = Number(affordable(a.id));
    const fb = Number(affordable(b.id));
    if (fa !== fb) return fb - fa;
    const wa = why(a.id)[1];
    const wb = why(b.id)[1];
    if (wa !== wb) return wb - wa;
    // Among what they can have now, the dearest (a real treat); otherwise the nearest.
    const pa = decorPrice(a.id)!.amount;
    const pb = decorPrice(b.id)!.amount;
    return fa ? pb - pa || a.id.localeCompare(b.id) : pa - pb || a.id.localeCompare(b.id);
  });
  const pick = ranked[0];
  if (pick) {
    const [w] = why(pick.id);
    const p = decorPrice(pick.id)!;
    const reason =
      w === 'interest'
        ? `You tried it on in your ${placeShort(home)}`
        : w === 'collection'
          ? (() => {
              const sp = setProgress(save, pick.set!);
              return `The next piece of your ${DECOR_SET_BY_ID[pick.set!].name} set (${sp.owned} of ${sp.total})`;
            })()
          : w === 'interaction'
            ? `${names(save, home)} will play with it`
            : affordable(pick.id)
              ? 'You have the coins for it now'
              : `${p.amount - have('coins')} more Paw Coins to go`;
    out.push({ kind: 'decor', id: pick.id, reason, afford: affordable(pick.id), why: w });
  }

  // 2. A trick for the animals here, named for the newest of them (the one the player most likely just met).
  const newestFirst = [...residents].reverse();
  if (residents.length) {
    const learnable = TRICKS.filter((t) => !ownsTrick(save, t.id)).filter((t) => {
      const c = trickCurrency(t);
      return !!c && offered(c);
    });
    const can = (t: (typeof TRICKS)[number]) => t.price <= have(trickCurrency(t)!);
    const order = (t: (typeof TRICKS)[number]) => ({ coins: 0, vtoken: 1, gem: 2 })[trickCurrency(t)!];
    // Tried on and still not learned: first, when the player can have it (or it's for coins, so they can work toward it).
    const tried = learnable.filter((t) => wasTried(save, 'trick', t.id) && (can(t) || trickCurrency(t) === 'coins')).sort((a, b) => Number(can(b)) - Number(can(a)) || order(a) - order(b) || a.price - b.price)[0];
    const now = learnable.filter(can).sort((a, b) => order(a) - order(b) || a.price - b.price)[0];
    // Not affordable yet: only ever one for coins (gems and tokens only when there are enough of them).
    const near = learnable.filter((t) => trickCurrency(t) === 'coins').sort((a, b) => a.price - b.price)[0];
    const t = tried ?? now ?? near;
    const who = animalInfo(newestFirst[0]).name;
    if (t) {
      const w: FeaturedWhy = t === tried ? 'interest' : t === now ? 'learn' : 'near';
      const reason = w === 'interest' ? `You tried it on with ${who}` : w === 'learn' ? `${who} could learn it today` : `For ${who} and friends`;
      out.push({ kind: 'trick', id: t.id, reason, afford: can(t), why: w });
    }
    // 3. A favorite food nobody has stocked, the newest arrival's first. Gems or tokens only when there are enough.
    for (const a of newestFirst) {
      let price = 0;
      let cur: Currency = 'coins';
      const f = favoriteFoods(a).find((id) => {
        const food = FOOD_BY_ID[id];
        const c: Currency | null = food.coins ? 'coins' : food.tokens ? 'vtoken' : food.gems ? 'gem' : null;
        if (!c || !offered(c) || foodCount(save, id) !== 0) return false;
        const amount = food.coins ?? food.tokens ?? food.gems ?? 0;
        if (c !== 'coins' && amount > have(c)) return false;
        cur = c;
        price = amount;
        return true;
      });
      if (f) {
        out.push({ kind: 'food', id: f, reason: `${animalInfo(a).name}'s favorite`, afford: price <= have(cur), why: 'favorite' });
        break;
      }
    }
  }

  // 4. A special piece, for a currency the player has enough of now (never one they can't get today).
  const special = buyable
    .filter((d) => decorTier(d) === 'video' || decorTier(d) === 'premium')
    .filter((d) => decorPrice(d.id)!.amount <= have(decorPrice(d.id)!.currency))
    .filter((d) => !DECOR.some((o) => decorHome(o) === home && decorTier(o) === decorTier(d) && owns(save, o.id)))
    .sort((a, b) => Number(interactive(b.id)) - Number(interactive(a.id)) || decorPrice(a.id)!.amount - decorPrice(b.id)!.amount)[0];
  if (special)
    out.push({
      kind: 'decor',
      id: special.id,
      reason: decorTier(special) === 'video' ? 'A special piece, for video tokens' : 'A premium piece, for gems',
      afford: true,
      why: 'special',
    });
  // What the player can have today first (a stable sort: otherwise in the order above).
  return out
    .map((f, i) => ({ f, i }))
    .sort((a, b) => Number(b.f.afford) - Number(a.f.afford) || a.i - b.i)
    .map((x) => x.f)
    .slice(0, FEATURED_MAX);
}
