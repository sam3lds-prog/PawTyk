/** The player's currencies as compact pills: Paw Coins alone, or with video tokens and gems where this build offers them. */

import { app } from '../../app/app';
import { itemBalance } from '../../meta/items';
import { currencyOffered } from '../../app/offers';
import { ICON } from '../icons';

export function coinPill(): string {
  return `<span class="coin-pill" data-coins aria-label="${app.coins()} Paw Coins">${ICON.coin}<span>${app.coins()}</span></span>`;
}

export function walletPills(): string {
  const coins = app.coins();
  const tokens = itemBalance(app.save, 'vtoken');
  const gems = itemBalance(app.save, 'gem');
  // D43: a currency this build can't earn or sell (and the player doesn't hold) has no pill.
  const showTokens = currencyOffered(app.save, 'vtoken');
  const showGems = currencyOffered(app.save, 'gem');
  const label = [`${coins} Paw Coins`, showTokens ? `${tokens} video tokens` : '', showGems ? `${gems} gems` : ''].filter(Boolean).join(', ');
  return `<span class="wallet" role="group" aria-label="${label}">
    <span class="coin-pill wallet__pill" data-coins>${ICON.coin}<span class="num">${coins}</span></span>
    ${showTokens ? `<span class="coin-pill wallet__pill wallet__pill--small">${ICON.videoToken}<span class="num">${tokens}</span></span>` : ''}
    ${showGems ? `<span class="coin-pill wallet__pill wallet__pill--small">${ICON.gem}<span class="num">${gems}</span></span>` : ''}
  </span>`;
}
