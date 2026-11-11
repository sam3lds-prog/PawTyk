/**
 * Google Analytics for Firebase as an analytics sink (D47 PR 6). In the iOS app it is the native Firebase SDK through
 * `@capacitor-firebase/analytics`; in a browser (dev, the tester page) the same plugin's web side on the shared
 * Firebase app. Either way it only ever receives what `analytics.ts` lets through: event names from the spec, game
 * facts as parameters, coarse progress bands as user properties. Never a user id.
 *
 * Privacy: consent mode is set so nothing advertising-related is stored or used (ad storage, ad user data and ad
 * personalization denied); analytics storage is granted only while the player has usage stats on. Turned off, the SDK
 * stops collecting at once (and the next launch doesn't start it).
 *
 * Robustness: events before the SDK is ready wait in a small queue; anything the SDK throws or rejects is dropped
 * quietly. Analytics failing never reaches the game.
 */

import { Capacitor } from '@capacitor/core';
import { ANALYTICS, FIREBASE, firebaseConfigured } from '../config/services';
import type { AnalyticsEvent, AnalyticsSink, EventProps, UserProperty } from './analytics';

type Plugin = typeof import('@capacitor-firebase/analytics').FirebaseAnalytics;
type Mod = typeof import('@capacitor-firebase/analytics');

/** Whether this build can send usage stats at all (the player still decides). */
export function analyticsAvailable(native = Capacitor.isNativePlatform()): boolean {
  if (!ANALYTICS.enabled) return false;
  return native || (firebaseConfigured() && !!FIREBASE.measurementId);
}

/** Firebase's limits: names up to 40 characters, parameter text up to 100; numbers and text only. */
export function toFirebaseParams(props: EventProps): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  let n = 0;
  for (const [k, v] of Object.entries(props)) {
    if (n >= 25 || !/^[a-zA-Z][a-zA-Z0-9_]{0,39}$/.test(k)) continue;
    if (typeof v === 'boolean') out[k] = v ? 1 : 0;
    else if (typeof v === 'number') {
      if (!Number.isFinite(v)) continue;
      out[k] = v;
    } else out[k] = String(v).slice(0, 100);
    n++;
  }
  return out;
}

const QUEUE_MAX = 60;

export interface FirebaseSink extends AnalyticsSink {
  /** Resolves true once the SDK is ready (false if it couldn't load). */
  readonly ready: Promise<boolean>;
}

/**
 * Makes the sink. `load` is the plugin module (injected in tests). Starts loading at once; events meanwhile are
 * queued (the newest kept).
 */
export function createFirebaseSink(load: () => Promise<Mod> = () => import('@capacitor-firebase/analytics'), native = Capacitor.isNativePlatform()): FirebaseSink {
  let plugin: Plugin | null = null;
  let mod: Mod | null = null;
  let on = true;
  const queue: Array<() => Promise<unknown>> = [];
  const quiet = (p: Promise<unknown> | undefined) => p?.catch(() => {});
  const run = (fn: () => Promise<unknown>) => {
    if (plugin) {
      try {
        quiet(fn());
      } catch {
        /* never break the game */
      }
    } else {
      queue.push(fn);
      if (queue.length > QUEUE_MAX) queue.shift();
    }
  };
  const consent = (granted: boolean) => {
    if (!plugin || !mod) return;
    const { ConsentType: T, ConsentStatus: S } = mod;
    for (const type of [T.AdStorage, T.AdUserData, T.AdPersonalization]) quiet(plugin.setConsent({ type, status: S.Denied }));
    quiet(plugin.setConsent({ type: T.AnalyticsStorage, status: granted ? S.Granted : S.Denied }));
  };
  const ready = (async () => {
    try {
      // On the web the plugin's analytics needs the shared Firebase app first (and a browser that supports it).
      if (!native) {
        const [{ firebaseApp }, an] = await Promise.all([import('./firebaseApp'), import('firebase/analytics')]);
        if (!(await an.isSupported())) return false;
        // Consent first, so even the first hit (the config) is sent under it.
        an.setConsent({ ad_storage: 'denied', ad_user_data: 'denied', ad_personalization: 'denied', analytics_storage: on ? 'granted' : 'denied' });
        an.getAnalytics(await firebaseApp());
      }
      mod = await load();
      plugin = mod.FirebaseAnalytics;
      consent(on);
      quiet(plugin.setEnabled({ enabled: on }));
      const waiting = queue.splice(0);
      if (on) for (const fn of waiting) run(fn);
      return true;
    } catch {
      queue.length = 0;
      return false;
    }
  })();
  return {
    ready,
    send(name: AnalyticsEvent, props: EventProps) {
      if (!on) return;
      const params = toFirebaseParams(props);
      run(() => plugin!.logEvent({ name, params }));
    },
    setProperty(name: UserProperty, value: string) {
      if (!on) return;
      run(() => plugin!.setUserProperty({ key: name, value: String(value).slice(0, 36) }));
    },
    setEnabled(enabled: boolean) {
      on = enabled;
      if (!enabled) queue.length = 0;
      if (plugin) {
        consent(enabled);
        quiet(plugin.setEnabled({ enabled }));
      }
    },
  };
}

/**
 * At launch with usage stats off: makes sure the native SDK isn't collecting either. Its on/off setting outlives the
 * app's own (a save recovered as new, a reinstall restored from a backup), so it is switched off whenever the player's
 * choice is off. Native only (the web SDK isn't loaded at all then). Never throws.
 */
export async function switchOffNative(load: () => Promise<Mod> = () => import('@capacitor-firebase/analytics'), native = Capacitor.isNativePlatform()): Promise<boolean> {
  if (!native || !analyticsAvailable(native)) return false;
  try {
    const { FirebaseAnalytics: plugin, ConsentType: T, ConsentStatus: S } = await load();
    for (const type of [T.AdStorage, T.AdUserData, T.AdPersonalization, T.AnalyticsStorage]) await plugin.setConsent({ type, status: S.Denied }).catch(() => {});
    await plugin.setEnabled({ enabled: false });
    return true;
  } catch {
    return false;
  }
}
