/**
 * D47 review: usage statistics are sent only from the player's yes. Turned on during a session (Settings, the
 * Journey's card), nothing from before that moment goes; on at launch (the player said yes before), the session's first
 * moments go once the SDK is there. At launch with the choice off, the native SDK is told to stay off too.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const sent: string[] = [];
const switchOffNative = vi.fn(async () => true);
vi.mock('../../src/services/firebaseAnalytics', () => ({
  analyticsAvailable: () => true,
  switchOffNative,
  createFirebaseSink: () => ({
    ready: Promise.resolve(true),
    send: (name: string) => sent.push(name),
    setProperty: () => {},
    setEnabled: () => {},
  }),
}));

beforeEach(() => {
  vi.resetModules();
  sent.length = 0;
  switchOffNative.mockClear();
});
afterEach(() => vi.useRealTimers());

async function fresh() {
  const usage = await import('../../src/app/usage');
  const analytics = await import('../../src/services/analytics');
  const { defaultSave } = await import('../../src/services/storage');
  return { usage, analytics, save: defaultSave(new Date(2026, 10, 10, 12)) };
}

describe('usage statistics start at the player’s yes', () => {
  it('turned on mid-session: nothing from before that moment is sent, what follows is', async () => {
    const { usage, analytics, save } = await fresh();
    analytics.setAnalyticsEnabled(false);
    analytics.track('store_open');
    analytics.track('iap_cancelled', { product: 'gems_60' });
    analytics.track('puzzle_fail', { mode: 'level' });
    await new Promise((r) => setTimeout(r, 5));
    save.settings.shareUsage = true;
    await usage.applyUsageChoice(save);
    expect(sent).toEqual([]);
    analytics.track('puzzle_complete', { mode: 'level' });
    expect(sent).toEqual(['puzzle_complete']);
  });

  it('on at launch: the session’s first moments go once the SDK is there', async () => {
    const { usage, analytics, save } = await fresh();
    analytics.track('app_open');
    save.settings.shareUsage = true;
    await usage.applyUsageChoice(save, { atLaunch: true });
    expect(sent).toContain('app_open');
    expect(switchOffNative).not.toHaveBeenCalled();
  });

  it('off at launch: nothing is sent and the native SDK is switched off', async () => {
    const { usage, analytics, save } = await fresh();
    analytics.track('app_open');
    expect(await usage.applyUsageChoice(save, { atLaunch: true })).toBe(false);
    await new Promise((r) => setTimeout(r, 0));
    expect(switchOffNative).toHaveBeenCalledTimes(1);
    analytics.track('puzzle_complete');
    expect(sent).toEqual([]);
  });
});

describe('the one-time card', () => {
  it('shows in one run of the app: shown counts as asked, and after a restart it doesn’t come back unanswered', async () => {
    const { usage, save } = await fresh();
    save.onboarding.tutorialDone = true;
    save.onboarding.sessions = 3;
    expect(await usage.shouldAskUsage(save)).toBe(true);
    usage.noteUsageAsked(save);
    expect(save.onboarding.usageAsked).toBe(true);
    expect(await usage.shouldAskUsage(save)).toBe(true); // still on the Journey this run
    vi.resetModules();
    const next = await import('../../src/app/usage');
    expect(await next.shouldAskUsage(save)).toBe(false); // the app was closed without an answer: a no
  });

  it('answered: gone at once', async () => {
    const { usage, save } = await fresh();
    Object.assign(save.onboarding, { tutorialDone: true, sessions: 4 });
    usage.noteUsageAsked(save);
    usage.closeUsageAsk();
    expect(await usage.shouldAskUsage(save)).toBe(false);
  });
});
