/**
 * PawTyk's privacy policy (D43), written once and shown two ways: inside the app (Settings → Privacy policy, works
 * offline) and as the hosted page whose URL goes in App Store Connect (`npm run site` builds it from this file). Keep it
 * in step with docs/privacy-security.md, which lists exactly what each service gets.
 *
 * Blocks are plain text; `[words](https://…)` becomes a link. Everything else is escaped when rendered.
 */

import { PUBLISHER } from '../config/legal';

/** Shown as "Last updated". Change it whenever the text below changes. */
export const POLICY_UPDATED = '2026-11-09';
export const POLICY_UPDATED_TEXT = 'November 9, 2026';

export interface PolicyBlock {
  h: string;
  p?: string[];
  ul?: string[];
}

export function privacyPolicy(contact: string | null): PolicyBlock[] {
  const write = contact ? `email ${contact}` : 'use the contact address on PawTyk’s App Store page';
  return [
    {
      h: 'The short version',
      p: [
        `PawTyk is a puzzle game made by ${PUBLISHER} (“we”). It plays fully offline. Your progress is saved on your device, and we can’t see it.`,
        'PawTyk has no accounts and never asks for your email, contacts, location, photos or microphone. We don’t sell data and we don’t send analytics. Nothing leaves your device unless you choose one of the optional features below.',
      ],
    },
    {
      h: 'What stays on your device',
      p: [
        'Your levels, sanctuaries and animals, settings, and a record of anything you bought are kept in PawTyk’s own storage on your device. If you use device backups (such as iCloud Backup), they are included there like any other app’s data.',
        'To delete it: Settings → Erase progress (purchases and settings are kept), or delete the app.',
      ],
    },
    {
      h: 'Optional features',
      p: [
        'Some versions of PawTyk include the features below. Each one stays off until you choose to use it, and each is described here before it ships. If a feature isn’t in your version of the app, nothing in this section applies to you.',
      ],
      ul: [
        'Leaderboard (Google Firebase). Only if you tap Join. We keep a random player id, the nickname and picture you choose (one of your animals), your leaderboard points, and, for each board you solve after joining, which board it was and your moves, so our server can check the score. Other players see your nickname, picture and points. Leave any time in Challenges → Leaderboard, and all of it is deleted; entries with no activity for a year are deleted automatically. [Firebase privacy](https://firebase.google.com/support/privacy).',
        'Purchases (Apple and RevenueCat). Apple handles payment; we never see your card or Apple ID. RevenueCat, the service that confirms what you own, receives a random app user id and your purchase history. [RevenueCat privacy](https://www.revenuecat.com/privacy).',
        'Reward videos (Google AdMob). Only when you choose to watch one, for an extra life, a hint or a video token. Google may collect information about your device to show and measure the video, and uses your device’s advertising identifier only if you allow tracking when your device asks. [Google privacy](https://policies.google.com/privacy).',
      ],
    },
    {
      h: 'Children',
      p: [
        'PawTyk is made for everyone, including children. We don’t knowingly collect personal information from children. The leaderboard asks only for a nickname (PawTyk suggests a friendly one, and real names shouldn’t be used). A parent or guardian can ask us to delete a leaderboard entry at any time.',
      ],
    },
    {
      h: 'Your choices',
      p: [
        `Wherever you live, you can ask what we hold about you, ask us to correct it, or ask us to delete it: ${write}. For the leaderboard, include your nickname. We answer within 30 days.`,
      ],
    },
    {
      h: 'Security',
      p: [
        'Anything an optional feature sends travels over an encrypted connection. Leaderboard data can only be changed by our server, which checks every score itself.',
      ],
    },
    {
      h: 'Changes',
      p: [
        'If this policy changes, we’ll update this page and its date before the change takes effect. A change that collects something new is described here first, and stays off until you choose it.',
      ],
    },
    {
      h: 'Contact',
      p: [contact ? `${PUBLISHER} · ${contact}` : `${PUBLISHER}. Contact details are on PawTyk’s App Store page.`],
    },
  ];
}

const esc = (s: string): string => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/** Escapes a line and turns `[words](https://…)` into links that open outside the app. */
export function inlineHtml(line: string): string {
  const out: string[] = [];
  let last = 0;
  for (const m of line.matchAll(/\[([^\]]+)\]\((https:\/\/[^)\s]+)\)/g)) {
    out.push(esc(line.slice(last, m.index)));
    out.push(`<a href="${esc(m[2])}" target="_blank" rel="noopener noreferrer">${esc(m[1])}</a>`);
    last = (m.index ?? 0) + m[0].length;
  }
  out.push(esc(line.slice(last)));
  return out.join('');
}

/** The policy's sections as HTML (headings at `level`), for the in-app sheet and the hosted page. */
export function policyHtml(contact: string | null, level: 2 | 3 = 3): string {
  return privacyPolicy(contact)
    .map(
      (b) =>
        `<section><h${level}>${esc(b.h)}</h${level}>${(b.p ?? []).map((p) => `<p>${inlineHtml(p)}</p>`).join('')}${
          b.ul ? `<ul>${b.ul.map((li) => `<li>${inlineHtml(li)}</li>`).join('')}</ul>` : ''
        }</section>`,
    )
    .join('');
}
