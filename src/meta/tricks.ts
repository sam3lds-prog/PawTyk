/** Owning and buying tricks (D33). Purchases are charged once (`buy:trick:<id>` in the item ledger), like decorations. */

import type { SaveV2 } from '../services/storage';
import { TRICK_BY_ID, TRICKS, trickCurrency, type TrickId } from './catalogs/tricks';
import { itemBalance, spendItem } from './items';
import { balance, spend } from './ledger';

export function ownsTrick(save: Pick<SaveV2, 'inventory'>, id: TrickId): boolean {
  return TRICK_BY_ID[id].tier === 'free' || !!save.inventory.tricks[id];
}

export function ownedTricks(save: Pick<SaveV2, 'inventory'>): TrickId[] {
  return TRICKS.filter((t) => ownsTrick(save, t.id)).map((t) => t.id);
}

export type TrickBuy = 'ok' | 'owned' | 'insufficient' | 'free';

/** What the player has of a trick's currency (D48 PR D: Paw Coins too). */
export function trickWallet(save: Pick<SaveV2, 'inventory'>, cur: 'coins' | 'vtoken' | 'gem'): number {
  return cur === 'coins' ? balance(save) : itemBalance(save, cur);
}

export function canAffordTrick(save: Pick<SaveV2, 'inventory'>, id: TrickId): boolean {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  return !cur || trickWallet(save, cur) >= t.price;
}

export function buyTrick(save: SaveV2, id: TrickId, now = new Date()): TrickBuy {
  const t = TRICK_BY_ID[id];
  const cur = trickCurrency(t);
  if (!cur) return 'free';
  if (save.inventory.tricks[id]) return 'owned';
  // Charged once (`buy:trick:<id>`), in the coin ledger or the item ledger.
  const r = cur === 'coins' ? spend(save, `buy:trick:${id}`, t.price, 'shop', now, t.name) : spendItem(save, `buy:trick:${id}`, cur, t.price, now, t.name);
  if (r === 'none' || r === 'insufficient') return 'insufficient';
  // 'already': charged before but not recorded (a crash between writes): own it.
  save.inventory.tricks[id] = { ownedAt: now.toISOString() };
  return 'ok';
}
