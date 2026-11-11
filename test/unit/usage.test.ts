/**
 * D47 PR 6: usage statistics. Nothing is sent unless the player turns them on; the Firebase sink keeps to Firebase's
 * limits, denies every advertising use, queues until ready, stops at once when switched off, and never lets a failure
 * reach the game. Day counts for Day 1 / 7 / 30, first-time moments counted once, and wide bands only.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { addSink, recentEvents, setAnalyticsEnabled, track, type AnalyticsSink } from '../../src/services/analytics';
import { createFirebaseSink, toFirebaseParams } from '../../src/services/firebaseAnalytics';
import { daysBetween, isoWeek, levelBand, noteDay, trackFirst } from '../../src/app/usage';
import { defaultSave, normalizeSave } from '../../src/services/storage';

afterEach(() => {
  setAnalyticsEnabled(true);
  vi.restoreAllMocks();
});

/** A stand-in for the plugin module. */
function fakePlugin(o: { fail?: boolean; slow?: Promise<void> } = {}) {
  const calls: Array<[string, unknown]> = [];
  const rec = (name: string) => async (arg: unknown) => {
    calls.push([name, arg]);
    if (o.fail) throw new Error('native error');
  };
  const mod = {
    FirebaseAnalytics: { logEvent: rec('logEvent'), setUserProperty: rec('setUserProperty'), setEnabled: rec('setEnabled'), setConsent: rec('setConsent') },
    ConsentType: { AdStorage: 'AD_STORAGE', AdUserData: 'AD_USER_DATA', AdPersonalization: 'AD_PERSONALIZATION', AnalyticsStorage: 'ANALYTICS_STORAGE' },
    ConsentStatus: { Granted: 'GRANTED', Denied: 'DENIED' },
  };
  const load = async () => {
    await o.slow;
    return mod as never;
  };
  return { calls, load };
}

describe('usage stats are the player’s choice', () => {
  it('off by default in a new save and in an old one', () => {
    expect(defaultSave().settings.shareUsage).toBe(false);
    const old = JSON.parse(JSON.stringify(defaultSave()));
    delete old.settings.shareUsage;
    expect(normalizeSave(old).settings.shareUsage).toBe(false);
  });

  it('switched off, sinks receive nothing (the local list still notes events on the device)', () => {
    const got: string[] = [];
    const off = addSink({ send: (n) => got.push(n) });
    setAnalyticsEnabled(false);
    track('app_open', { sessions: 1 });
    expect(got).toEqual([]);
    expect(recentEvents()[recentEvents().length - 1]?.name).toBe('app_open');
    setAnalyticsEnabled(true);
    track('app_open', { sessions: 2 });
    expect(got).toEqual(['app_open']);
    off();
  });

  it('a sink that throws never reaches the game', () => {
    const bad: AnalyticsSink = {
      send: () => {
        throw new Error('boom');
      },
      setEnabled: () => {
        throw new Error('boom');
      },
    };
    const off = addSink(bad);
    expect(() => track('store_open', { tab: 'gems' })).not.toThrow();
    expect(() => setAnalyticsEnabled(false)).not.toThrow();
    off();
  });
});

describe('the Firebase sink', () => {
  it('keeps to Firebase’s limits: numbers and short text, booleans as 0/1, odd keys dropped', () => {
    const p = toFirebaseParams({ mode: 'level', first: true, n: 3, bad: Number.NaN, 'weird key': 'x', long: 'y'.repeat(200) });
    expect(p).toEqual({ mode: 'level', first: 1, n: 3, long: 'y'.repeat(100) });
  });

  it('denies every advertising use, grants analytics storage, queues until ready, then sends', async () => {
    let go!: () => void;
    const { calls, load } = fakePlugin({ slow: new Promise<void>((r) => (go = r)) });
    const sink = createFirebaseSink(load, true);
    sink.send('puzzle_start', { mode: 'level' }, 0);
    expect(calls).toEqual([]);
    go();
    expect(await sink.ready).toBe(true);
    const consent = calls.filter(([n]) => n === 'setConsent').map(([, a]) => a);
    expect(consent).toEqual(
      expect.arrayContaining([
        { type: 'AD_STORAGE', status: 'DENIED' },
        { type: 'AD_USER_DATA', status: 'DENIED' },
        { type: 'AD_PERSONALIZATION', status: 'DENIED' },
        { type: 'ANALYTICS_STORAGE', status: 'GRANTED' },
      ]),
    );
    expect(calls).toContainEqual(['logEvent', { name: 'puzzle_start', params: { mode: 'level' } }]);
    // No user id is ever set.
    expect(calls.some(([n]) => /userid/i.test(n))).toBe(false);
  });

  it('switched off: collection stops, analytics storage is denied, nothing more is sent', async () => {
    const { calls, load } = fakePlugin();
    const sink = createFirebaseSink(load, true);
    await sink.ready;
    sink.setEnabled!(false);
    const n = calls.length;
    sink.send('store_open', {}, 0);
    sink.setProperty!('journey_band', '1-20');
    expect(calls.slice(n).some(([name]) => name === 'logEvent' || name === 'setUserProperty')).toBe(false);
    expect(calls).toContainEqual(['setEnabled', { enabled: false }]);
    expect(calls).toContainEqual(['setConsent', { type: 'ANALYTICS_STORAGE', status: 'DENIED' }]);
  });

  it('an SDK that fails to load or rejects every call changes nothing for the game', async () => {
    const broken = createFirebaseSink(async () => {
      throw new Error('no SDK');
    }, true);
    broken.send('app_open', {}, 0);
    expect(await broken.ready).toBe(false);
    const { load } = fakePlugin({ fail: true });
    const rejecting = createFirebaseSink(load, true);
    await rejecting.ready;
    expect(() => rejecting.send('app_open', {}, 0)).not.toThrow();
    await new Promise((r) => setTimeout(r, 0));
  });
});

describe('days, firsts and bands', () => {
  it('counts calendar days, and Day 1, 7 and 30 on their own, once a day', () => {
    const save = defaultSave(new Date(2026, 10, 1, 9));
    const names = () => recentEvents().map((e) => e.name);
    const before = recentEvents().length;
    expect(noteDay(save, new Date(2026, 10, 1, 20))?.dayN).toBe(0);
    expect(noteDay(save, new Date(2026, 10, 1, 22))).toBeNull();
    expect(noteDay(save, new Date(2026, 10, 2, 0, 5))?.dayN).toBe(1);
    expect(recentEvents().slice(before).filter((e) => e.name === 'retention_day').map((e) => e.props.day)).toEqual([1]);
    expect(noteDay(save, new Date(2026, 10, 8, 12))?.dayN).toBe(7);
    expect(noteDay(save, new Date(2026, 11, 1, 12))?.dayN).toBe(30);
    expect(save.usage!.daysActive).toBe(4);
    expect(names().slice(before).filter((n) => n === 'retention_day')).toHaveLength(3);
    expect(daysBetween(new Date(2026, 2, 7, 23), new Date(2026, 2, 9, 1))).toBe(2);
  });

  it('a first-time moment is counted once', () => {
    const save = defaultSave();
    expect(trackFirst(save, 'puzzle_start', 'first_puzzle_start')).toBe(true);
    expect(trackFirst(save, 'puzzle_start', 'first_puzzle_start')).toBe(false);
  });

  it('bands are wide', () => {
    expect([1, 20, 21, 40, 41, 95].map(levelBand)).toEqual(['1-20', '1-20', '21-40', '21-40', '41-60', '81-100']);
    expect(isoWeek(new Date(2026, 0, 1))).toBe('2026-W01');
    expect(isoWeek(new Date(2026, 11, 31))).toBe('2026-W53');
  });
});
