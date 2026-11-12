/**
 * Reward videos, always the player's choice: an extra life, a hint, or a video token. One gentle daily cap is shared by
 * all of them. A reward is granted only when the ad service confirms the video was watched, exactly once per video,
 * and it is granted even if the player left the screen meanwhile (they watched it). Never in Paw Cup (the game screen
 * offers none there).
 */

import { app } from './app';
import { ads, type RewardedOutcome } from '../services/ads';
import { track } from '../services/analytics';
import { grantItem, hasItemEntry } from '../meta/items';
import { localDateKey } from '../game/dates';
import type { SaveV2 } from '../services/storage';

export const REWARDED_DAILY_CAP = 10;

export type VideoReward = 'life' | 'hint' | 'vtoken';

export function videosLeftToday(save: Pick<SaveV2, 'ads'>, now = new Date()): number {
  const day = localDateKey(now);
  return save.ads.day === day ? Math.max(0, REWARDED_DAILY_CAP - save.ads.rewarded) : REWARDED_DAILY_CAP;
}

/** Whether a "watch a video" button should be offered at all. */
export function canOfferVideo(): boolean {
  return ads.available && videosLeftToday(app.save) > 0;
}

/**
 * Counts a watched video toward today's cap and grants the reward, once per video: `video` names the watch, so a
 * second report of the same video (the network's reward event and its close, a retried callback) grants nothing.
 * Pure apart from mutating the save.
 */
export function recordVideoReward(save: SaveV2, reward: VideoReward, now = new Date(), video?: string): boolean {
  const day = localDateKey(now);
  if (save.ads.day !== day) save.ads = { ...save.ads, day, rewarded: 0 };
  const id = video ? `ad:${reward}:${video}` : `ad:${reward}:${now.getTime().toString(36)}:${save.ads.rewarded + 1}`;
  if (hasItemEntry(save, id)) return false;
  if (save.ads.rewarded >= REWARDED_DAILY_CAP) return false;
  save.ads.rewarded++;
  const g = grantItem(save, id, reward, 1, 'ad', now, 'Reward video');
  return !!g;
}

/**
 * How a video the player chose went (D52 PR D names the reasons): granted; closed before its end; no video available;
 * no connection; the ad privacy question unanswered; another failure; `no-video` when the service gave no reason; the
 * daily cap; no videos in this build; or one already playing.
 */
export type WatchResult = 'granted' | 'closed' | 'no-fill' | 'offline' | 'consent' | 'error' | 'no-video' | 'cap' | 'unavailable' | 'busy';

/** The video showing now, if any: one at a time, so a second tap never starts (or pays for) a second video. */
let showing = false;
let videos = 0;

/**
 * D52 PR D: a video that never reports back (a lost close after the app was backgrounded, say) is given up after this
 * long, so a video can never block play or the next video. Giving up removes its listeners and ignores anything it
 * reports later, so a later reward event can never be credited to it or counted twice (review of D52 PR D).
 */
export const VIDEO_WATCHDOG_MS = 180_000;

/** D52 PR D: the last video shown (when, for what, how it ended), for *Report a video*. Kept in memory only. */
export interface LastVideo {
  at: string;
  placement: string;
  result: WatchResult;
}
let lastVideo: LastVideo | null = null;
export const lastVideoShown = (): LastVideo | null => lastVideo;

/**
 * Shows a reward video the player chose, and grants its reward exactly once (D47 PR 4): at the moment the network
 * reports the reward (so it is kept even if the video's close never reaches us, or the player has left the screen),
 * idempotently by the video's own id, saved at once. A video that wasn't finished grants nothing.
 */
export async function watchVideoFor(reward: VideoReward, ctx: { surface?: string } = {}): Promise<WatchResult> {
  if (!ads.available) return 'unavailable';
  if (showing) return 'busy';
  if (videosLeftToday(app.save) <= 0) return 'cap';
  // A real network needs a connection: say so before trying (the test videos play offline).
  if (!ads.isStub && typeof navigator !== 'undefined' && navigator.onLine === false) return 'offline';
  const placement = reward === 'vtoken' ? 'token' : reward;
  const video = `${Date.now().toString(36)}-${++videos}`;
  showing = true;
  // M2: where the player chose it (an item's card, the Shop's earn card), never who they are.
  const surface: Record<string, string> = ctx.surface ? { surface: ctx.surface } : {};
  track('rewarded_ad_offer', { placement, ...surface });
  track('rewarded_ad_start', { placement, ...surface });
  let granted = false;
  let refused = false;
  let abandoned = false;
  const grantOnce = () => {
    if (granted || refused || abandoned) return;
    if (recordVideoReward(app.save, reward, new Date(), video)) {
      granted = true;
      app.persist();
      track('rewarded_ad_complete', { placement, ...surface });
      track('reward_grant', { placement, ok: true, ...surface });
    } else {
      refused = true;
      track('reward_grant', { placement, ok: false });
    }
  };
  let failed: WatchResult | null = null;
  let watchdog: ReturnType<typeof setTimeout> | undefined;
  try {
    const timedOut = new Promise<'timeout'>((resolve) => (watchdog = setTimeout(() => resolve('timeout'), VIDEO_WATCHDOG_MS)));
    const ok = await Promise.race([ads.showRewarded(placement, grantOnce), timedOut]);
    if (ok === true) grantOnce();
    else if (ok === 'timeout') {
      abandoned = true;
      ads.abandonRewarded?.();
      failed = 'error';
    }
  } catch {
    failed = 'error';
  } finally {
    clearTimeout(watchdog);
    showing = false;
  }
  const result: WatchResult = granted ? 'granted' : refused ? 'cap' : (failed ?? reasonOf(ads.lastOutcome));
  lastVideo = { at: new Date().toISOString(), placement, result };
  if (!granted && !refused) track('reward_grant', { placement, ok: false, reason: result, ...surface });
  return result;
}

/** The ad service's reason, as a result for the player (no reason given: `no-video`). */
function reasonOf(o: RewardedOutcome | null | undefined): WatchResult {
  switch (o) {
    case 'closed':
    case 'no-fill':
    case 'offline':
    case 'consent':
    case 'error':
      return o;
    default:
      return 'no-video';
  }
}
