/**
 * D52 PR D: reward videos said one way. An offer says what the video earns before anything starts (*Need one more
 * hint? Watch an optional video to earn +1 hint.*, then *Watch video* and *Keep thinking*); a video starts only on that
 * tap; and whatever happens — closed early, no video ready, no connection, the privacy question unanswered, a failure,
 * the daily limit — the player hears it plainly, nothing is used, and play goes on. There is no PawTyk overlay, timer
 * or countdown over a video: the ad network draws the video and its own close.
 *
 * *Report a video* (Settings, whenever videos are part of the build) lets the player tell us about a video that was
 * inappropriate or not right for children (App Store guideline 2.5.18), with when it played and what it was for.
 */

import { CONTACT_EMAIL } from '../../config/legal';
import { lastVideoShown, type VideoReward, type WatchResult } from '../../app/rewarded';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet, toast } from './sheet';

const REWARD: Record<VideoReward, { noun: string; plus: string }> = {
  hint: { noun: 'hint', plus: '+1 hint' },
  life: { noun: 'heart', plus: '+1 heart' },
  vtoken: { noun: 'token', plus: '+1 video token' },
};

/** "Watch an optional video to earn +1 hint." */
export function videoOfferLine(reward: VideoReward): string {
  return `Watch an optional video to earn ${REWARD[reward].plus}.`;
}

/** The offer as a short paragraph: a question, then what the video earns. */
export function videoOfferMarkup(reward: VideoReward): string {
  return `<p class="video-offer" data-video-offer><b>Need one more ${REWARD[reward].noun}?</b> ${esc(videoOfferLine(reward))}</p>`;
}

/**
 * What to tell the player when a video earned nothing (null when there is nothing to say: granted, or one already
 * playing). `nothing` is the reassurance ("Nothing was used." on a board, "Nothing was charged." on an item's card).
 */
export function videoResultMessage(r: WatchResult, reward: VideoReward, nothing = 'Nothing was used.'): string | null {
  const noun = REWARD[reward].noun;
  switch (r) {
    case 'granted':
    case 'busy':
      return null;
    case 'closed':
      return `The video ended early, so there's no ${noun} this time. ${nothing}`;
    case 'no-fill':
    case 'no-video':
      return `No video is ready right now. ${nothing} Try again in a little while.`;
    case 'offline':
      return `Videos need an internet connection. ${nothing}`;
    case 'consent':
      return `Videos can play once the ad privacy question has an answer. ${nothing}`;
    case 'error':
      return `The video couldn't play. ${nothing}`;
    case 'cap':
      return "That's all the videos for today. More tomorrow.";
    case 'unavailable':
      return `Videos aren't part of this version. ${nothing}`;
  }
}

const REASONS = ['Not right for children', 'Scary or upsetting', 'Rude or offensive', 'Misleading', 'Something else'] as const;

/** The report's text: the reason, when the last video played and what it was for. Nothing about the player. */
export function videoReportText(reason: string): string {
  const v = lastVideoShown();
  const when = v ? `Last video: ${v.at} (for ${v.placement === 'token' ? 'a video token' : `a ${v.placement === 'life' ? 'heart' : 'hint'}`}).` : 'No video has played since the app was opened.';
  return `PawTyk video report\nReason: ${reason}\n${when}\n${typeof __APP_VERSION__ === 'string' ? `PawTyk ${__APP_VERSION__}` : ''}`.trim();
}

/** Settings → Report a video. */
export function showVideoReport(scope: Scope): void {
  const sh = openSheet(scope, {
    title: 'Report a video',
    className: 'video-report-sheet',
    body: `
      <p class="sheet__lead">If a video was not right for children, or upsetting in any way, tell us and we'll report it to the video network so it stops showing.</p>
      <div class="rows" role="radiogroup" aria-label="What was wrong">
        ${REASONS.map((r, i) => `<button class="row" role="radio" aria-checked="${i === 0}" data-reason="${esc(r)}"><span class="row__label">${esc(r)}</span><span class="radio" aria-hidden="true"></span></button>`).join('')}
      </div>
      <p class="muted">The report says what was wrong and when the last video played. Nothing about you.</p>
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="send">${ICON.share}${CONTACT_EMAIL ? 'Email the report' : 'Copy the report'}</button>
        <button class="btn btn--quiet" data-act="close" data-autofocus>Not now</button>
      </div>`,
  });
  let reason: string = REASONS[0];
  sh.scope.on(sh.el, 'click', async (e) => {
    const t = e.target as HTMLElement;
    const r = t.closest('[data-reason]') as HTMLElement | null;
    if (r) {
      reason = r.dataset.reason!;
      for (const b of sh.el.querySelectorAll('[data-reason]')) b.setAttribute('aria-checked', String(b === r));
      return;
    }
    const act = (t.closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (act === 'close') return sh.close();
    if (act !== 'send') return;
    const text = videoReportText(reason);
    if (CONTACT_EMAIL) {
      const href = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('PawTyk video report')}&body=${encodeURIComponent(text)}`;
      try {
        window.open(href, '_blank');
      } catch {
        /* no mail app: copy instead, below */
      }
      toast('Thank you. Your report helps keep PawTyk friendly.');
      sh.close();
      return;
    }
    try {
      await navigator.clipboard.writeText(text);
      toast('Report copied. Thank you.');
    } catch {
      toast('Thank you. Reports open your email once PawTyk has a contact address.');
    }
    sh.close();
  });
}
