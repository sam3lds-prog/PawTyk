/**
 * Earning a video token from the card of the thing it's for (M2). When the player has fewer tokens than an item needs,
 * its card says so plainly (how many they have, how many it needs, how many videos are left today) and offers an
 * optional **Watch a video: +1 token** that goes through the one reward-video service (`app/rewarded.ts`: the daily
 * cap, one grant per watched video, saved at once). The card stays open throughout, so the player is back on the same
 * item when the video ends, with the new balance shown.
 *
 * Never forced and never instead of anything else: nothing is shown when videos aren't part of this build, and a video
 * that doesn't finish, isn't there or fails grants nothing and charges nothing.
 */

import { app } from '../../app/app';
import { REWARDED_DAILY_CAP, canOfferVideo, videosLeftToday, watchVideoFor, type WatchResult } from '../../app/rewarded';
import { itemBalance } from '../../meta/items';
import { ads } from '../../services/ads';
import { plural } from '../dom';
import { ICON } from '../icons';
import { toast } from './sheet';
import { videoResultMessage } from './videoOffer';

/** What the card says when tokens are short, and the optional button (when a video can be offered now). */
export function tokenNeedMarkup(need: number): string {
  const have = itemBalance(app.save, 'vtoken');
  const short = Math.max(0, need - have);
  if (!short) return '';
  const left = videosLeftToday(app.save);
  const head = `You have ${plural(have, 'video token')}; this needs ${need}.`;
  if (!ads.available)
    return `<p class="token-need muted" data-token-need>${head} Video tokens come from short reward videos, which aren't available right now.</p>`;
  if (!left)
    return `<p class="token-need muted" data-token-need>${head} That's all ${REWARDED_DAILY_CAP} videos for today; more tomorrow.</p>`;
  return `<div class="token-need" data-token-need>
    <p class="muted">${head} Each short video you choose to watch earns one${short > 1 ? ` (${short} to go)` : ''}. ${plural(left, 'video')} left today.</p>
    <button class="btn btn--secondary btn--block" data-act="earn-token" ${canOfferVideo() ? '' : 'disabled'}>${ICON.videoToken}Watch an optional video: +1 token</button>
  </div>`;
}

/** What to tell the player after a video (nothing on "busy": a video is already showing). */
export function earnMessage(r: WatchResult): string | null {
  // D52 PR D: the real reason (closed early, no video ready, no connection…), said the way every video offer says it.
  return r === 'granted' ? '+1 video token' : videoResultMessage(r, 'vtoken', 'Nothing was charged.');
}

let earning = false;

/**
 * Shows a video the player chose, from an item's card (`surface` names it, for analytics), and tells them how it went.
 * `refresh` redraws the card with the new balance; it is called whatever happened, while the card is still open.
 */
export async function earnToken(button: HTMLButtonElement | null, surface: string, refresh: () => void, alive: () => boolean): Promise<WatchResult> {
  if (earning) return 'busy';
  earning = true;
  button?.setAttribute('aria-busy', 'true');
  if (button) button.disabled = true;
  let r: WatchResult = 'no-video';
  try {
    r = await watchVideoFor('vtoken', { surface });
  } catch {
    // The ad service failed outright: nothing was granted and nothing charged.
    r = 'no-video';
  } finally {
    earning = false;
  }
  const msg = earnMessage(r);
  if (msg) toast(msg, r === 'granted' ? ICON.videoToken : undefined);
  if (alive()) refresh();
  return r;
}
