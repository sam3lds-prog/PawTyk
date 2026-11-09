/**
 * What this build can really offer (D43, release readiness). Apple asks that a submitted app has no unfinished
 * placeholders, so a feature whose service isn't connected is not shown at all — no "coming soon", no price the player
 * has no way to pay:
 *  - **Gems** need the App Store (RevenueCat). Without it there is no Gems tab, no premium decor, tricks or emotes for
 *    sale, and no gem pill — unless the player still has gems to spend.
 *  - **Video tokens** need reward videos (AdMob). Without them there are no special decor, treats or video-token tricks
 *    for sale, and no token pill — unless the player still has tokens to spend.
 *  - **The leaderboard** needs Firebase. Without it the Challenges screen has no Leaderboard tab.
 * Anything already owned always stays visible and usable. Each service turns its part back on by itself once its
 * build-time settings are present (docs/native-setup.md); nothing else needs to change.
 */

import { itemBalance } from '../meta/items';
import { ads } from '../services/ads';
import { iap } from '../services/iap';
import { leaderboard } from '../services/leaderboard';
import type { SaveV2 } from '../services/storage';

export type Currency = 'coins' | 'vtoken' | 'gem';

/** Gem packs can be bought here (a store is connected). */
export function gemPacksOnSale(): boolean {
  return iap.available;
}

/** Whether things priced in this currency are offered: coins always; tokens and gems when they can be earned or bought, or the player still holds some. */
export function currencyOffered(save: Pick<SaveV2, 'inventory'>, currency: Currency): boolean {
  if (currency === 'coins') return true;
  if (currency === 'gem') return iap.available || itemBalance(save, 'gem') > 0;
  return ads.available || itemBalance(save, 'vtoken') > 0;
}

/** The online (or tester) leaderboard is there to join. */
export function leaderboardOffered(): boolean {
  return leaderboard.mode !== 'off';
}
