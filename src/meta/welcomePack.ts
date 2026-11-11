/**
 * The Welcome Rescue Pack (D47 PR 7): one optional bundle, once per player. 180 gems and the Rescue Wagon, a Farm
 * decoration found only in this pack. Suggested price $2.99; the price shown is always the App Store's own.
 *
 * Why 180 gems: the gem packs are 60, 160 and 420. The pack gives a little more than the 160-gem pack, plus something
 * that can't be bought any other way, so it is a fair first purchase without dwarfing the packs. It holds no hints,
 * hearts, lives or anything that helps solve a puzzle.
 *
 * Reliability:
 *  - **Granted once per purchase.** The gems are an item-ledger entry keyed by the store's transaction id
 *    (`iap:<tx>`), the wagon an ownership record; granting the same transaction again changes nothing.
 *  - **Crash recovery and restore.** At launch, and on Restore, the store's record is read; a pack transaction this save
 *    hasn't granted yet is granted then (a purchase cut off by a closed app, a new install).
 *  - **Refunds.** When the store answers and no longer has the pack (Apple refunded it, or RevenueCat moved the purchase
 *    to another install on a restore there), the wagon goes back and up to 180 of the gems still unspent are taken
 *    back. If the same purchase comes back later (restored here again), so do the wagon and those gems. Unknown
 *    (offline, not set up) is never read as refunded.
 *  - **When it is offered.** Never during onboarding: only after the player has solved puzzles past the first lessons,
 *    welcomed an animal home and visited a home, and only in the Shop (the Gems tab, and with the Farm's
 *    decorations), its highlight at most every three days and three times in all. Never after a loss, never in a
 *    board, never with a countdown.
 */

import type { SaveV2 } from '../services/storage';
import type { StoreTransaction } from '../services/iap';
import { grantItem, hasItemEntry, itemBalance, spendItem } from './items';
import { setShown } from './sanctuary';

export const WELCOME_PACK = { product: 'welcome_pack', gems: 180, decor: 'rescuewagon' } as const;

type Source = 'store' | 'dev';

function packRecord(save: SaveV2): SaveV2['purchases']['packs'] {
  save.purchases.packs ??= {};
  return save.purchases.packs;
}

/** Whether this save has the pack (granted and not refunded). */
export function ownsWelcomePack(save: Pick<SaveV2, 'purchases'>): boolean {
  return !!save.purchases.packs?.welcome;
}

/**
 * Grants the pack for one store transaction: the gems once (by transaction id), the wagon (out on the Farm), and the
 * record of it. Returns the gems granted now (0 if this transaction was already granted).
 */
export function grantWelcomePack(save: SaveV2, transactionId: string, source: Source, now = new Date()): number {
  if (!transactionId) return 0;
  const id = `iap:${transactionId}`;
  const fresh = !hasItemEntry(save, id);
  const itemSource = source === 'store' ? 'store' : 'test';
  const g = fresh ? grantItem(save, id, 'gem', WELCOME_PACK.gems, itemSource, now, 'Welcome Rescue Pack') : null;
  let back = 0;
  // The same purchase back after it was taken away (restored after the store moved it to another install): the gems
  // taken back come back too, once.
  const packs = packRecord(save)!;
  const revoked = packs.revoked;
  if (revoked && revoked.tx === transactionId) {
    if (revoked.gems > 0) back = grantItem(save, `reinstate:${transactionId}:${revoked.at}`, 'gem', revoked.gems, itemSource, now, 'Welcome Rescue Pack restored')?.granted ?? 0;
    delete packs.revoked;
  }
  if (!save.inventory.decor[WELCOME_PACK.decor]) {
    save.inventory.decor[WELCOME_PACK.decor] = { ownedAt: now.toISOString() };
    setShown(save, WELCOME_PACK.decor, true);
  }
  if (packs.welcome?.tx !== transactionId) packs.welcome = { tx: transactionId, source, at: now.toISOString() };
  return (g ? g.granted : 0) + back;
}

/**
 * The pack was refunded: the wagon goes back, and up to 180 gems still unspent are taken back (once). Returns the gems
 * taken back.
 */
export function revokeWelcomePack(save: SaveV2, now = new Date()): number {
  const rec = save.purchases.packs?.welcome;
  if (!rec) return 0;
  delete save.inventory.decor[WELCOME_PACK.decor];
  delete save.sanctuary.hidden[WELCOME_PACK.decor];
  const packs = save.purchases.packs!;
  delete packs.welcome;
  const at = now.toISOString();
  const want = Math.min(WELCOME_PACK.gems, itemBalance(save, 'gem'));
  const back = want > 0 && spendItem(save, `refund:${rec.tx}:${at}`, 'gem', want, now, 'Welcome Rescue Pack refunded') === 'ok' ? want : 0;
  packs.revoked = { tx: rec.tx, gems: back, at };
  return back;
}

/**
 * Brings the save in line with the store's record: grants a pack transaction not granted yet (a purchase a closed app
 * cut off, a restore), and takes the pack back if the store says it is gone (refunded). A null record (the store
 * couldn't be asked) changes nothing. Returns what happened.
 */
export function reconcileWelcomePack(
  save: SaveV2,
  record: { transactions: StoreTransaction[]; entitlements: string[] } | null,
  source: Source,
  now = new Date(),
): { granted: number; revoked: boolean } {
  if (!record) return { granted: 0, revoked: false };
  const tx = record.transactions.find((t) => t.productId === WELCOME_PACK.product);
  if (tx) return { granted: grantWelcomePack(save, tx.transactionId, source, now), revoked: false };
  // Gone from the store's record and from the entitlements: refunded (only ever for what the store itself sold).
  const rec = save.purchases.packs?.welcome;
  if (rec && rec.source === source && !record.entitlements.includes('welcome_pack')) {
    revokeWelcomePack(save, now);
    return { granted: 0, revoked: true };
  }
  return { granted: 0, revoked: false };
}

/** Where the player has got to: past the first lessons, an animal welcomed home, a home visited. */
export function readyForWelcomeOffer(save: SaveV2): boolean {
  if (!save.onboarding.tutorialDone || (save.journey.nextLevel ?? 1) < 6) return false;
  const animals = Object.keys(save.inventory.companions ?? {}).length + Object.keys(save.inventory.pets ?? {}).length;
  const visited = Object.keys(save.world?.visited ?? {}).length > 0 || (save.sanctuary?.visits ?? 0) > 0;
  return animals > 0 && visited;
}

/** How long between highlights, and how many in all. */
export const OFFER_GAP_MS = 3 * 24 * 60 * 60 * 1000;
export const OFFER_MAX = 3;

/** Whether the pack's highlight (with the Farm's decorations) may show now. */
export function mayHighlightWelcomePack(save: SaveV2, now = new Date()): boolean {
  if (ownsWelcomePack(save) || !readyForWelcomeOffer(save)) return false;
  const o = save.offers?.welcome;
  if (!o) return true;
  if (o.dismissed || o.shown >= OFFER_MAX) return false;
  return !o.lastAt || now.getTime() - new Date(o.lastAt).getTime() >= OFFER_GAP_MS;
}

/** The highlight was shown (counts toward the limits). */
export function noteWelcomeHighlight(save: SaveV2, now = new Date()): void {
  save.offers ??= {};
  const o = (save.offers.welcome ??= { shown: 0, lastAt: null, dismissed: false });
  o.shown++;
  o.lastAt = now.toISOString();
}

/** "Not now": the highlight doesn't come back (the pack stays in the Gems tab). */
export function dismissWelcomeHighlight(save: SaveV2): void {
  save.offers ??= {};
  const o = (save.offers.welcome ??= { shown: 0, lastAt: null, dismissed: false });
  o.dismissed = true;
}
