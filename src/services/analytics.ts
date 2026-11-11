/**
 * Analytics hooks. Event names follow the product spec. No PII is ever attached: properties are limited to
 * game facts (mode, size, seconds, counts). Events go to pluggable sinks; by default they stay in a small
 * in-memory ring buffer (and the dev console). A real provider is added by registering a sink: D47 PR 6 adds Firebase
 * Analytics (`firebaseAnalytics.ts`), on only when configured and while the player leaves "Share anonymous usage
 * stats" on. A sink failing never reaches the game.
 */

export type AnalyticsEvent =
  | 'app_open'
  | 'onboarding_step'
  | 'puzzle_start'
  | 'puzzle_complete'
  | 'puzzle_fail'
  | 'hint_used'
  | 'pet_unlocked'
  | 'decor_bought'
  | 'sanctuary_open'
  | 'daily_complete'
  | 'league_open'
  | 'rewarded_ad_offer'
  | 'rewarded_ad_start'
  | 'rewarded_ad_complete'
  | 'reward_grant'
  | 'revive_offer'
  | 'revive_used'
  | 'puzzle_retry'
  | 'photo_mode_open'
  | 'postcard_created'
  | 'postcard_shared'
  | 'iap_started'
  | 'iap_success'
  | 'iap_failed'
  | 'iap_cancelled'
  | 'iap_refunded'
  | 'screen_view'
  | 'animation_reduced_mode'
  | 'mission_claimed'
  | 'achievement_unlocked'
  | 'extra_life_used'
  | 'food_bought'
  | 'animal_fed'
  | 'companion_unlocked'
  | 'animal_arrived'
  | 'region_open'
  | 'region_build'
  | 'region_stage'
  | 'trick_played'
  | 'trick_bought'
  | 'friendship_level'
  // D47 PR 6: the funnels (see docs/analytics.md).
  | 'first_puzzle_start'
  | 'first_puzzle_complete'
  | 'tutorial_complete'
  | 'level_reached'
  | 'home_visit'
  | 'home_time'
  | 'walk_start'
  | 'day_active'
  | 'retention_day'
  | 'store_open'
  | 'product_view'
  | 'starter_pack_view'
  | 'starter_pack_offer'
  // D48 PR A: did the first animal land on the first double tap (the controls' usability check)?
  | 'onboarding_controls'
  // D48 PR B
  | 'bowl_bought'
  // M1: a trick played as a preview in a home (never learned by it).
  | 'trick_tried'
  // M3: a share card shown, the player choosing to share it, and what the platform reported (never who to, or where).
  | 'share_opened'
  | 'share_started'
  | 'share_result'
  | 'photo_memory_claimed'
  // D49 PR A: which Featured pick was opened (its kind and place in the row), See all, and the arrival's follow-up.
  | 'featured_tap'
  | 'featured_see_all'
  | 'welcome_card'
  | 'welcome_snack';

export type EventProps = Record<string, string | number | boolean>;

export interface AnalyticsSink {
  send(name: AnalyticsEvent, props: EventProps, at: number): void;
  /** A coarse fact about the player's progress (a band, never an identity), kept by the destination. */
  setProperty?(name: UserProperty, value: string): void;
  /** Collection switched on or off (the player's choice in Settings). */
  setEnabled?(on: boolean): void;
}

/** Coarse, non-identifying player properties (bands only). */
export type UserProperty = 'journey_band' | 'homes_band' | 'install_week' | 'paid';

const MAX_BUFFER = 200;
const buffer: Array<{ name: AnalyticsEvent; props: EventProps; at: number }> = [];
const sinks = new Set<AnalyticsSink>();
let enabled = true;

/** Keys that must never leave the device even if a caller passes them by mistake. */
const BLOCKED = /name|email|phone|address|token|id_?fa|device/i;

export function addSink(s: AnalyticsSink): () => void {
  sinks.add(s);
  try {
    s.setEnabled?.(enabled);
    if (enabled) for (const [k, v] of props) s.setProperty?.(k, v);
  } catch {
    /* never break the game */
  }
  return () => sinks.delete(s);
}

export function setAnalyticsEnabled(on: boolean): void {
  enabled = on;
  for (const s of sinks) {
    try {
      s.setEnabled?.(on);
    } catch {
      /* a sink failing must never break the game */
    }
  }
}

export function analyticsEnabled(): boolean {
  return enabled;
}

const props = new Map<UserProperty, string>();
/** Sets a coarse property (sent once per change, to every sink, now and to sinks added later). */
export function setUserProperty(name: UserProperty, value: string): void {
  if (props.get(name) === value) return;
  props.set(name, value);
  if (!enabled) return;
  for (const s of sinks) {
    try {
      s.setProperty?.(name, value);
    } catch {
      /* never break the game */
    }
  }
}

export function track(name: AnalyticsEvent, props: EventProps = {}): void {
  const clean: EventProps = {};
  for (const [k, v] of Object.entries(props)) if (!BLOCKED.test(k)) clean[k] = v;
  const at = Date.now();
  // The in-memory list stays on the device (the QA page reads it); only sinks send anything, and only when on.
  buffer.push({ name, props: clean, at });
  if (buffer.length > MAX_BUFFER) buffer.shift();
  if (!enabled) return;
  for (const s of sinks) {
    try {
      s.send(name, clean, at);
    } catch {
      /* a sink failing must never break the game */
    }
  }
}

export function recentEvents(): ReadonlyArray<{ name: AnalyticsEvent; props: EventProps; at: number }> {
  return buffer;
}
