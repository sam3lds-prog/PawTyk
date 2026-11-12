/**
 * Ads. The game talks to `AdService` only.
 *
 * PawTyk shows **reward videos only, and only when the player asks for one** (an extra life, a hint, or a video
 * token). No banners, and no interstitials: `INTERSTITIALS_ENABLED` is false, so the cadence rule below is kept for the
 * record but never reached. A reward is granted only when the ad network confirms the video was watched.
 *
 * Which service runs:
 *  - iOS app with `VITE_ADMOB_ENABLED=1` (Info.plist set up, see docs/native-setup.md) → `AdMobAdService`, using Google's
 *    test unit until `VITE_ADMOB_REWARDED_IOS` is set. Consent (UMP) and Apple's tracking prompt are asked the first time
 *    the player chooses to watch a video, never at launch.
 *  - Development and tester builds → `TestVideoAdService`: a clearly labeled stand-in so the whole flow can be tried.
 *  - Anything else → `UnavailableAdService`: no video buttons are shown and nothing is granted.
 */

import { Capacitor } from '@capacitor/core';
import { ADMOB, TEST_BUILD } from '../config/services';
import type { ModeKind } from '../game/modes';

export type RewardedPlacement = 'life' | 'hint' | 'token';

/**
 * D52 PR D: how a reward video ended, so the player hears the real reason (and nothing is granted unless `earned`):
 * the reward was earned; the video was closed before its end; no video was available (no fill); there was no
 * connection; the privacy question hasn't been answered, so no ad may be requested; or something else went wrong.
 */
export type RewardedOutcome = 'earned' | 'closed' | 'no-fill' | 'offline' | 'consent' | 'error';

/** An SDK load or show failure, as an outcome (Google Mobile Ads codes: 2 network, 3 no fill). */
export function outcomeOfError(e: unknown): RewardedOutcome {
  const code = String((e as { code?: unknown } | null)?.code ?? '');
  const msg = String((e as { message?: unknown } | null)?.message ?? '');
  if (code === '2' || /network|offline|internet/i.test(msg)) return 'offline';
  if (code === '3' || /no fill|no ad/i.test(msg)) return 'no-fill';
  return 'error';
}

/** No forced ads between boards. */
export const INTERSTITIALS_ENABLED = false;

export interface AdService {
  /** True when a real (or, in dev, simulated) ad network is ready. */
  readonly available: boolean;
  readonly isStub: boolean;
  showInterstitial(): Promise<boolean>;
  /**
   * Resolves true only when the reward was earned. `onEarned` is called the moment the network reports the reward
   * (D47 PR 4), before the video is even closed, so a reward earned and then interrupted (the app closed, the close
   * callback lost) is still granted; the caller grants idempotently, so a second report changes nothing.
   */
  showRewarded(placement: RewardedPlacement, onEarned?: () => void): Promise<boolean>;
  /** D52 PR D: how the last `showRewarded` ended (set before it resolves), for the player's message. */
  readonly lastOutcome?: RewardedOutcome | null;
  /**
   * D52 PR D (review): gives up on a video that never reported back. Its listeners are removed and a reward it reports
   * later is ignored, so it can never be credited to the next video; the pending `showRewarded` resolves false.
   */
  abandonRewarded?(): void;
}

export interface AdCadenceState {
  removeAds: boolean;
  /** Journey levels completed so far (onboarding grace). */
  levelsCompleted: number;
  /** Solo boards completed since the last interstitial. */
  boardsSinceLast: number;
  lastShownAt: number | null;
  /** Interstitials shown today. */
  shownToday: number;
}

export interface AdTrigger {
  mode: ModeKind;
  outcome: 'won' | 'lost';
  now: number;
}

export const AD_POLICY = {
  onboardingGraceLevels: 8,
  minBoardsBetween: 4,
  minMsBetween: 8 * 60_000,
  dailyCap: 3,
} as const;

/** Pure cadence rule. Called only after the player taps through the results sheet. */
export function shouldShowInterstitial(s: AdCadenceState, t: AdTrigger): boolean {
  if (s.removeAds) return false;
  if (t.outcome !== 'won') return false; // never right after a loss
  if (t.mode === 'cup') return false; // never in competitive play
  if (s.levelsCompleted < AD_POLICY.onboardingGraceLevels) return false;
  if (s.shownToday >= AD_POLICY.dailyCap) return false;
  if (s.boardsSinceLast < AD_POLICY.minBoardsBetween) return false;
  if (s.lastShownAt !== null && t.now - s.lastShownAt < AD_POLICY.minMsBetween) return false;
  return true;
}

/** Nothing to show, no rewards granted. */
export class UnavailableAdService implements AdService {
  readonly available = false;
  readonly isStub = false;
  async showInterstitial(): Promise<boolean> {
    return false;
  }
  async showRewarded(): Promise<boolean> {
    return false;
  }
}

/** Test builds only: a clearly labeled stand-in video, so the reward flow can be tried end to end. */
export class TestVideoAdService implements AdService {
  readonly available = true;
  readonly isStub = true;
  lastOutcome: RewardedOutcome | null = null;
  private stop: ((o: RewardedOutcome) => void) | null = null;
  constructor(private readonly ms = 1500) {}
  async showInterstitial(): Promise<boolean> {
    return false;
  }
  async showRewarded(placement: RewardedPlacement, onEarned?: () => void): Promise<boolean> {
    // The test video can be closed before its end (its Close button), to try the "no reward" path.
    const outcome = await fakeVideo(`Test video · ${placement}`, this.ms, (stop) => (this.stop = stop));
    this.stop = null;
    this.lastOutcome = outcome;
    if (outcome === 'earned') onEarned?.();
    return outcome === 'earned';
  }
  abandonRewarded(): void {
    this.stop?.('error');
  }
}

/** Kept for older imports and tests. */
export const DevStubAdService = TestVideoAdService;

/**
 * Google AdMob reward videos. The SDK is started, and consent asked, on the first video the player chooses to watch.
 * The reward counts only if the SDK reports it (the Rewarded event or the resolved show call).
 */
export class AdMobAdService implements AdService {
  readonly available = true;
  readonly isStub = false;
  lastOutcome: RewardedOutcome | null = null;
  private ready: Promise<boolean | 'consent'> | null = null;
  constructor(
    private readonly adId: string,
    private readonly testing: boolean,
  ) {}

  private start(): Promise<boolean | 'consent'> {
    this.ready ??= (async () => {
      try {
        const { AdMob, AdmobConsentStatus } = await import('@capacitor-community/admob');
        await AdMob.initialize({ initializeForTesting: this.testing });
        // Privacy first: the consent form where the law requires it (UMP), then Apple's tracking question.
        let info = await AdMob.requestConsentInfo();
        if (info.isConsentFormAvailable && info.status === AdmobConsentStatus.REQUIRED) info = await AdMob.showConsentForm();
        const att = await AdMob.trackingAuthorizationStatus();
        if (att.status === 'notDetermined') await AdMob.requestTrackingAuthorization();
        // D52 PR D: no answer to the privacy question means no ad may be requested; ask again next time.
        if (info && info.canRequestAds === false) {
          this.ready = null;
          return 'consent';
        }
        return true;
      } catch {
        this.ready = null; // try again next time
        return false;
      }
    })();
    return this.ready;
  }

  async showInterstitial(): Promise<boolean> {
    return false;
  }

  /** The video showing now: how to give up on it (the watchdog), if it never reports back. */
  private pending: { abandon: () => void } | null = null;

  /**
   * Shows a reward video and resolves when it is over (D52 PR D). The plugin resolves its show call only when the reward
   * is earned (iOS never settles it on an early close or a failure to present), so the end comes from its events: the
   * reward (granted at once, through `onEarned`), the dismissal (a close without the reward is `closed`), or a failure to
   * show or to load (no fill, no connection, or another error). Listeners live for this video only.
   */
  async showRewarded(_placement?: RewardedPlacement, onEarned?: () => void): Promise<boolean> {
    const started = await this.start();
    if (started !== true) {
      this.lastOutcome = started === 'consent' ? 'consent' : 'error';
      return false;
    }
    this.pending?.abandon();
    const { AdMob, RewardAdPluginEvents } = await import('@capacitor-community/admob');
    let rewarded = false;
    let done = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];
    let resolveEnd!: (ok: boolean) => void;
    const ended = new Promise<boolean>((r) => (resolveEnd = r));
    const finish = (o: RewardedOutcome) => {
      if (done) return;
      done = true;
      if (this.pending === me) this.pending = null;
      for (const h of handles) void h.remove().catch(() => {});
      this.lastOutcome = rewarded ? 'earned' : o;
      resolveEnd(rewarded);
    };
    const me = { abandon: () => finish('error') };
    this.pending = me;
    const listen = async (event: string, fn: (data: unknown) => void) => {
      const h = await AdMob.addListener(event as never, ((data: unknown) => {
        if (!done) fn(data);
      }) as never);
      // Finished while the listener was being added (abandoned, say): drop it at once.
      if (done) void h.remove().catch(() => {});
      else handles.push(h);
    };
    await listen(RewardAdPluginEvents.Rewarded, () => {
      rewarded = true;
      onEarned?.();
    });
    await listen(RewardAdPluginEvents.Dismissed, () => finish('closed'));
    await listen(RewardAdPluginEvents.FailedToShow, (e) => finish(outcomeOfError(e)));
    if (done) return ended;
    try {
      await AdMob.prepareRewardVideoAd({ adId: this.adId, isTesting: this.testing });
    } catch (e) {
      // Nothing was shown: no fill, no connection, or another load error.
      finish(outcomeOfError(e));
      return ended;
    }
    if (done) return ended;
    AdMob.showRewardVideoAd().then(
      (item) => {
        if (item && typeof item.type === 'string') {
          rewarded = true;
          finish('earned');
        }
      },
      // It couldn't be shown (not ready, another ad showing): a failure, never "closed".
      (e) => finish(outcomeOfError(e)),
    );
    return ended;
  }

  abandonRewarded(): void {
    this.pending?.abandon();
  }
}

function fakeVideo(label: string, ms: number, onStop?: (stop: (o: RewardedOutcome) => void) => void): Promise<RewardedOutcome> {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'fake-ad';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', label);
    const box = document.createElement('div');
    box.className = 'fake-ad__box';
    const l = document.createElement('div');
    l.className = 'fake-ad__label';
    l.textContent = label;
    const sub = document.createElement('div');
    sub.className = 'fake-ad__sub';
    sub.textContent = 'Test build: a stand-in for a reward video. No ad network.';
    // D52 PR D: a visible close, as a real video has: closing early earns nothing.
    const close = document.createElement('button');
    close.className = 'btn btn--quiet btn--small fake-ad__close';
    close.textContent = 'Close (no reward)';
    box.append(l, sub, close);
    el.appendChild(box);
    document.body.appendChild(el);
    let done = false;
    const end = (o: RewardedOutcome) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      el.remove();
      resolve(o);
    };
    const timer = setTimeout(() => end('earned'), ms);
    close.addEventListener('click', () => end('closed'));
    onStop?.(end);
  });
}

export function createAdService(opts: { native: boolean; testBuild: boolean; admobEnabled: boolean; adId: string; testAdId: string }): AdService {
  if (opts.native && opts.admobEnabled) return new AdMobAdService(opts.adId || opts.testAdId, !opts.adId);
  if (opts.testBuild) return new TestVideoAdService();
  return new UnavailableAdService();
}

export const ads: AdService = createAdService({
  native: Capacitor.isNativePlatform(),
  testBuild: TEST_BUILD,
  admobEnabled: ADMOB.enabled,
  adId: ADMOB.rewardedIos,
  testAdId: ADMOB.testRewardedIos,
});
