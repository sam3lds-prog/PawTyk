/**
 * D52 PR D (review): the AdMob reward-video service against a stand-in plugin. The plugin resolves its show call only
 * when the reward is earned (on iOS an early close or a failure to present never settles it), so the end of a video
 * comes from its events. A close without the reward is "closed"; a failure to show is a failure, never "closed"; a load
 * failure says no fill or no connection; an unanswered privacy question is "consent". A video given up by the watchdog
 * keeps no listener, so the next video's reward is never credited to it.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

const h = vi.hoisted(() => ({
  listeners: new Map<string, Set<(d?: unknown) => void>>(),
  prepare: async (): Promise<unknown> => ({ adUnitId: 'test' }),
  show: (): Promise<unknown> => new Promise(() => {}),
  consent: { status: 'OBTAINED', isConsentFormAvailable: false, canRequestAds: true } as Record<string, unknown>,
}));

vi.mock('@capacitor-community/admob', () => ({
  AdmobConsentStatus: { REQUIRED: 'REQUIRED' },
  RewardAdPluginEvents: { Rewarded: 'onRewardedVideoAdReward', Dismissed: 'onRewardedVideoAdDismissed', FailedToShow: 'onRewardedVideoAdFailedToShow' },
  AdMob: {
    initialize: async () => {},
    requestConsentInfo: async () => h.consent,
    showConsentForm: async () => h.consent,
    trackingAuthorizationStatus: async () => ({ status: 'authorized' }),
    requestTrackingAuthorization: async () => {},
    addListener: async (event: string, fn: (d?: unknown) => void) => {
      const set = h.listeners.get(event) ?? new Set();
      h.listeners.set(event, set);
      set.add(fn);
      return { remove: async () => void set.delete(fn) };
    },
    prepareRewardVideoAd: () => h.prepare(),
    showRewardVideoAd: () => h.show(),
  },
}));

import { AdMobAdService } from '../../src/services/ads';

const fire = (event: string, data?: unknown) => [...(h.listeners.get(event) ?? [])].forEach((f) => f(data));
const live = () => [...h.listeners.values()].reduce((n, s) => n + s.size, 0);
const tick = () => new Promise((r) => setTimeout(r, 0));
/** Until the video is showing: its three listeners are in place. */
const showing = () => vi.waitFor(() => expect(live()).toBe(3));

beforeEach(() => {
  h.listeners.clear();
  h.prepare = async () => ({ adUnitId: 'test' });
  h.show = () => new Promise(() => {});
  h.consent = { status: 'OBTAINED', isConsentFormAvailable: false, canRequestAds: true };
});

describe('how a video ends', () => {
  it('closed before the reward (the show call never settles): "closed", and no listener left', async () => {
    const svc = new AdMobAdService('unit', true);
    const earned = vi.fn();
    const p = svc.showRewarded('hint', earned);
    await showing();
    fire('onRewardedVideoAdDismissed');
    expect(await p).toBe(false);
    expect(svc.lastOutcome).toBe('closed');
    expect(earned).not.toHaveBeenCalled();
    await tick();
    expect(live()).toBe(0);
  });

  it('the reward, then the close: granted once, "earned"', async () => {
    const svc = new AdMobAdService('unit', true);
    const earned = vi.fn();
    const p = svc.showRewarded('hint', earned);
    await showing();
    fire('onRewardedVideoAdReward', { type: 'coins', amount: 1 });
    fire('onRewardedVideoAdDismissed');
    expect(await p).toBe(true);
    expect(svc.lastOutcome).toBe('earned');
    expect(earned).toHaveBeenCalledTimes(1);
  });

  it('a failure to present, or a rejected show call, is a failure, never "closed"', async () => {
    const a = new AdMobAdService('unit', true);
    const pa = a.showRewarded('hint');
    await showing();
    fire('onRewardedVideoAdFailedToShow', { code: 0, message: 'Presentation failed' });
    expect(await pa).toBe(false);
    expect(a.lastOutcome).toBe('error');
    h.show = async () => {
      throw Object.assign(new Error('An ad is already showing'), { code: '' });
    };
    const b = new AdMobAdService('unit', true);
    expect(await b.showRewarded('hint')).toBe(false);
    expect(b.lastOutcome).toBe('error');
  });

  it('a load failure: no fill (3) or no connection (2)', async () => {
    h.prepare = async () => {
      throw Object.assign(new Error('No fill.'), { code: '3' });
    };
    const a = new AdMobAdService('unit', true);
    expect(await a.showRewarded('life')).toBe(false);
    expect(a.lastOutcome).toBe('no-fill');
    h.prepare = async () => {
      throw Object.assign(new Error('Network error.'), { code: '2' });
    };
    const b = new AdMobAdService('unit', true);
    expect(await b.showRewarded('life')).toBe(false);
    expect(b.lastOutcome).toBe('offline');
    expect(live()).toBe(0);
  });

  it('the privacy question unanswered: "consent", nothing requested', async () => {
    h.consent = { status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false };
    const prepare = vi.fn(h.prepare);
    h.prepare = prepare;
    const svc = new AdMobAdService('unit', true);
    expect(await svc.showRewarded('hint')).toBe(false);
    expect(svc.lastOutcome).toBe('consent');
    expect(prepare).not.toHaveBeenCalled();
  });
});

describe('a video given up by the watchdog (review: P1)', () => {
  it('keeps no listener, so the next video’s reward is credited to the next video only', async () => {
    const svc = new AdMobAdService('unit', true);
    const first = vi.fn();
    const p1 = svc.showRewarded('hint', first);
    await showing();
    svc.abandonRewarded();
    expect(await p1).toBe(false);
    await tick();
    expect(live()).toBe(0);
    const second = vi.fn();
    const p2 = svc.showRewarded('life', second);
    await showing();
    fire('onRewardedVideoAdReward', { type: 'x', amount: 1 });
    fire('onRewardedVideoAdDismissed');
    expect(await p2).toBe(true);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });
});
