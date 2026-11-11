/**
 * Usage statistics, the app's side (D47 PR 6): when they may be sent, the once-only moments of the funnels, the day
 * counts behind Day 1 / Day 7 / Day 30 return, and coarse progress bands. What is sent and why: docs/analytics.md.
 *
 * Nothing here identifies a player. Days are counted on the device from the save's install date; bands are wide
 * (levels 1–20, 21–40…); there is no user id. Sending happens only through `analytics.ts`, which sends nothing unless the
 * player has turned usage stats on and the build has Firebase Analytics configured.
 */

import { addSink, recentEvents, setAnalyticsEnabled, setUserProperty, track, type AnalyticsEvent, type EventProps } from '../services/analytics';
import { localDateKey } from '../game/dates';
import type { SaveV2 } from '../services/storage';

/** Days since install on which a return is counted on its own (Firebase's retention covers the rest). */
export const RETURN_DAYS = [1, 7, 30] as const;

function usage(save: SaveV2): NonNullable<SaveV2['usage']> {
  save.usage ??= { lastDay: null, daysActive: 0, firsts: {} };
  return save.usage;
}

/** Whole local days between two dates (by calendar day, not 24-hour spans). */
export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate());
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** The first day the player played: the save's install date, or an older play day if the save remembers one. */
export function firstDay(save: SaveV2): Date {
  const install = new Date(save.installDate);
  const played = Object.keys(save.stats.playDays ?? {}).sort()[0];
  const p = played ? new Date(`${played}T12:00:00`) : null;
  const ok = (d: Date | null): d is Date => !!d && !Number.isNaN(d.getTime());
  if (ok(p) && (!ok(install) || p < install)) return p;
  return ok(install) ? install : new Date();
}

/**
 * The app was opened (or came back) on `now`: the first time on a new day counts that day (`day_active`, with how many
 * days since the first and how many days so far), and Day 1, 7 and 30 are counted on their own. Returns what was
 * counted (tests).
 */
export function noteDay(save: SaveV2, now = new Date()): { dayN: number; daysActive: number } | null {
  const u = usage(save);
  const today = localDateKey(now);
  if (u.lastDay === today) return null;
  u.lastDay = today;
  u.daysActive++;
  const dayN = Math.max(0, daysBetween(firstDay(save), now));
  track('day_active', { day_n: Math.min(dayN, 365), days_active: Math.min(u.daysActive, 365) });
  if ((RETURN_DAYS as readonly number[]).includes(dayN)) track('retention_day', { day: dayN });
  return { dayN, daysActive: u.daysActive };
}

/** Counts a first-time moment once per save (the first puzzle, the tutorial finished, a home's first visit…). */
export function trackFirst(save: SaveV2, key: string, name: AnalyticsEvent, props: EventProps = {}): boolean {
  const u = usage(save);
  if (u.firsts[key]) return false;
  u.firsts[key] = true;
  track(name, props);
  return true;
}

/** A level band: 1–20 (one animal), 21–40, 41–60… */
export function levelBand(level: number): string {
  if (level <= 20) return '1-20';
  const lo = Math.floor((level - 1) / 20) * 20 + 1;
  return `${lo}-${lo + 19}`;
}

/** ISO week of a date ("2026-W45"): the install cohort. */
export function isoWeek(d: Date): string {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7;
  t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = t.getUTCFullYear();
  const w = Math.ceil(((t.getTime() - Date.UTC(y, 0, 1)) / 86_400_000 + 1) / 7);
  return `${y}-W${String(w).padStart(2, '0')}`;
}

/** The coarse properties: progress band, homes band, install week, whether anything was ever bought. */
export function noteBands(save: SaveV2): void {
  setUserProperty('journey_band', levelBand(save.journey.nextLevel ?? 1));
  const homes = Object.keys(save.world?.growth ?? {}).length;
  setUserProperty('homes_band', homes <= 1 ? String(homes) : homes <= 3 ? '2-3' : homes <= 6 ? '4-6' : '7+');
  setUserProperty('install_week', isoWeek(firstDay(save)));
  setUserProperty('paid', Object.keys(save.purchases.owned ?? {}).length ? 'yes' : 'no');
}

let started: Promise<boolean> | null = null;
/** When this session began (its events are sent once the SDK is there). */
const sessionStart = Date.now();

/**
 * Starts sending if the build can and the player has chosen to (and switches it off again if they change their mind).
 * Loads the Firebase SDK only then. Never throws.
 *
 * `atLaunch`: the choice as the app starts. Only then do this session's earlier events go too (the SDK loads a moment
 * after the app opens, and the player had said yes before). Turned on later, in Settings or on the Journey's card,
 * nothing from before that moment is sent. At launch with the choice off, the native SDK is told to stay off too.
 */
export function applyUsageChoice(save: SaveV2, opts: { atLaunch?: boolean } = {}): Promise<boolean> {
  const on = save.settings.shareUsage;
  setAnalyticsEnabled(on);
  if (!on && opts.atLaunch && !started) {
    void import('../services/firebaseAnalytics').then((m) => m.switchOffNative()).catch(() => {});
    return Promise.resolve(false);
  }
  if (!on || started) return started ?? Promise.resolve(false);
  const from = opts.atLaunch ? sessionStart : Date.now();
  started = (async () => {
    try {
      const m = await import('../services/firebaseAnalytics');
      if (!m.analyticsAvailable()) return false;
      const sink = m.createFirebaseSink();
      addSink(sink);
      for (const e of recentEvents()) if (e.at >= from) sink.send(e.name, e.props, e.at);
      noteBands(save);
      return await sink.ready;
    } catch {
      return false;
    }
  })();
  return started;
}

/** The card has been shown in this run of the app (it stays on the Journey until answered, until the app closes). */
let askOpen = false;

/**
 * Whether to show the one-time "share usage stats?" card: only in a build that can send, after a few sessions, in one
 * run of the app. Shown, it counts as asked: closing the app without answering is a no (Settings has the switch).
 */
export async function shouldAskUsage(save: SaveV2): Promise<boolean> {
  if ((save.onboarding.usageAsked && !askOpen) || save.settings.shareUsage || !save.onboarding.tutorialDone || save.onboarding.sessions < 3) return false;
  try {
    return (await import('../services/firebaseAnalytics')).analyticsAvailable();
  } catch {
    return false;
  }
}

/** The card is on screen now: it counts as asked (it won't come back after this run of the app). */
export function noteUsageAsked(save: SaveV2): void {
  askOpen = true;
  save.onboarding.usageAsked = true;
}

/** The player answered: the card is gone for good. */
export function closeUsageAsk(): void {
  askOpen = false;
}

/** D49 PR E: counts a visit to a home (any), for the first-meal measure. Returns the count so far. */
export function noteHomeVisit(save: SaveV2): number {
  const u = usage(save);
  u.homeVisits = Math.min(1_000_000, (u.homeVisits ?? 0) + 1);
  return u.homeVisits;
}

/**
 * D49 PR E: the first meal a player ever gives (once), with how many home visits it took to find feeding and where it
 * came from (an animal's card, or a newcomer's welcome snack). Opt-in like every event.
 */
export function noteFirstMeal(save: SaveV2, from: 'card' | 'welcome'): void {
  trackFirst(save, 'meal', 'first_meal', { from, visits: Math.min(usage(save).homeVisits ?? 0, 99) });
}
