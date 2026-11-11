// @vitest-environment happy-dom
/**
 * M3, shareable moments: a Daily result's card and text are spoiler-free by construction; the game link is only ever
 * a configured public page (none: shared without one); shares go through the one share service with native, browser
 * and copy fallbacks, and report cancels and failures without ever claiming a post was made; the weekly Photo Memory
 * pays 30 coins for the week's first postcard once, across retries and reloads, on the player's own weeks; analytics
 * follow the player's choice and carry no recipients; and nothing about sharing opens by itself.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GAME_URL, linkLabel, publicGameUrl, shareLink } from '../../src/config/links';
import { cleanResult, composeResultCard, resultPattern, resultShareText, type DailyResult } from '../../src/ui/components/resultCard';
import { PHOTO_MEMORY_COINS, claimPhotoMemory, photoMemoryDone, photoMemoryWeek } from '../../src/meta/photoMemory';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { balance } from '../../src/meta/ledger';
import { addSink, setAnalyticsEnabled, track } from '../../src/services/analytics';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { CELEBRATION_CUE } from '../../src/ui/components/parade';
import { celebrationFor } from '../../src/meta/celebrations';
import { SCORES, cueMs } from '../../src/audio/scores';

const R: DailyResult = { dateKey: '2026-11-11', hearts: 2, maxHearts: 3, seconds: 134, streak: 5 };

describe('a Daily result: spoiler-free by construction', () => {
  it('only the day, hearts, time and streak: anything else (a board, a solution) is refused', () => {
    expect(cleanResult(R)).toEqual(R);
    expect(() => cleanResult({ ...R, board: [[0, 1]] } as unknown as DailyResult)).toThrow(/never carries "board"/);
    expect(() => cleanResult({ ...R, solution: 'r1c2' } as unknown as DailyResult)).toThrow();
  });

  it('the text: the brand, the date, hearts left, the time, the streak, a decorative row, the invitation', () => {
    const t = resultShareText(R, null);
    const lines = t.split('\n');
    expect(lines[0]).toBe('PawTyk Daily Puzzle · Wed, Nov 11');
    expect(lines[1]).toBe('❤️❤️🤍 · 2:14 · 5-day streak');
    expect(lines.slice(2, 5).every((l) => /^[🐾✨]+$/u.test(l))).toBe(true);
    expect(lines[5]).toBe("Can you solve today's puzzle?");
    // No coordinates, rows, columns or cell names anywhere.
    expect(t).not.toMatch(/r\d+c\d+|row|column|col \d|\(\d+,\s*\d+\)/i);
  });

  it('the decorative row comes from the date alone: the same for everyone that day, whatever their result', () => {
    const a = resultShareText(R, null).split('\n').slice(2, 5);
    const b = resultShareText({ ...R, hearts: 0, seconds: 999, streak: 1 }, null).split('\n').slice(2, 5);
    expect(a).toEqual(b);
    expect(resultPattern('2026-11-11')).toEqual(resultPattern('2026-11-11'));
    expect(resultPattern('2026-11-12')).not.toEqual(resultPattern('2026-11-11'));
  });

  it('a board without hearts says nothing about hearts; a first day says nothing about a streak', () => {
    const t = resultShareText({ ...R, hearts: null, streak: 1 }, null);
    expect(t.split('\n')[1]).toBe('2:14');
  });

  it('the card paints without the board (no canvas in this test: nothing breaks, nothing to show)', () => {
    expect(composeResultCard(R, null, null)).toBeNull();
  });
});

describe('the game link', () => {
  it('only a public https page; never local, private, test, preview or tunnel addresses', () => {
    for (const bad of [
      'http://pawtyk.app',
      'https://localhost:5173',
      'https://localhost',
      'https://127.0.0.1/',
      'https://192.168.1.4/',
      'https://10.0.0.2/',
      'https://pawtyk.local/',
      'https://pawtyk.test/',
      'https://staging.pawtyk.app/',
      'https://dev-2.pawtyk.app/',
      'https://preview.pawtyk.app/',
      'https://pawtyk-staging.web.app/',
      'https://abc.ngrok.io/',
      'https://user:pw@pawtyk.app/',
      'https://pawtyk.app:8443/',
      'not a url',
      '',
      undefined,
    ])
      expect(publicGameUrl(bad), String(bad)).toBeNull();
    expect(publicGameUrl('https://pawtyk.web.app/')).toBe('https://pawtyk.web.app/');
    // A real `.dev` domain is fine (only a test label below the top level isn't).
    expect(publicGameUrl('https://pawtyk.dev')).toBe('https://pawtyk.dev/');
    expect(publicGameUrl('https://pawtyk.app/play?ref=me#x')).toBe('https://pawtyk.app/play');
  });

  it('a share link carries only which kind of card it came from; none configured, none at all', () => {
    expect(shareLink('daily', 'https://pawtyk.app/')).toBe('https://pawtyk.app/?s=daily');
    expect(shareLink('arrival', 'https://pawtyk.app/play')).toBe('https://pawtyk.app/play?s=arrival');
    expect(linkLabel('https://pawtyk.app/')).toBe('pawtyk.app');
    expect(shareLink('daily', null)).toBeNull();
    // This test build sets none: shares go without a link, and the text says nothing about one.
    expect(GAME_URL).toBeNull();
    expect(resultShareText(R)).not.toMatch(/https?:/);
    expect(resultShareText(R, 'https://pawtyk.app/?s=daily').split('\n').pop()).toBe("Can you solve today's puzzle? https://pawtyk.app/?s=daily");
  });
});

describe('Photo Memory: 30 coins for the week’s first postcard, once', () => {
  it('once a week: a second postcard, a repeated tap, a retried callback grant nothing more', () => {
    const s = defaultSave(new Date(2026, 10, 11, 9));
    const now = new Date(2026, 10, 11, 10);
    expect(photoMemoryDone(s, now)).toBe(false);
    expect(claimPhotoMemory(s, now)).toBe(PHOTO_MEMORY_COINS);
    expect(claimPhotoMemory(s, now)).toBe(0);
    expect(claimPhotoMemory(s, new Date(2026, 10, 13, 22))).toBe(0);
    expect(balance(s)).toBe(PHOTO_MEMORY_COINS);
    expect(photoMemoryDone(s, now)).toBe(true);
  });

  it('the player’s own weeks: Monday to Sunday on their calendar (Sunday night and Monday morning are different weeks)', () => {
    const sunday = new Date(2026, 10, 15, 23, 59);
    const monday = new Date(2026, 10, 16, 0, 1);
    expect(photoMemoryWeek(new Date(2026, 10, 9, 0, 0))).toBe('2026-11-09');
    expect(photoMemoryWeek(sunday)).toBe('2026-11-09');
    expect(photoMemoryWeek(monday)).toBe('2026-11-16');
    const s = defaultSave(sunday);
    expect(claimPhotoMemory(s, sunday)).toBe(30);
    expect(claimPhotoMemory(s, monday)).toBe(30);
    expect(balance(s)).toBe(60);
  });

  it('kept across a reload: the record is in the save, so the week can’t be earned again', () => {
    const s = defaultSave(new Date(2026, 10, 11));
    claimPhotoMemory(s, new Date(2026, 10, 11, 12));
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(photoMemoryDone(back, new Date(2026, 10, 12))).toBe(true);
    expect(claimPhotoMemory(back, new Date(2026, 10, 12))).toBe(0);
    expect(balance(back)).toBe(30);
  });

  it('a week skipped costs nothing', () => {
    const s = defaultSave(new Date(2026, 10, 1));
    expect(claimPhotoMemory(s, new Date(2026, 10, 25))).toBe(30);
    expect(balance(s)).toBe(30);
  });
});

describe('photo mode: the postcard still works as before, and earns the week’s coins once', () => {
  let scope: Scope;
  let host: HTMLElement;
  beforeEach(() => {
    vi.useRealTimers();
    app.replaceSave(defaultSave(new Date()));
    document.body.innerHTML = '<figure class="sanctuary__scene"></figure>';
    host = document.querySelector('figure')!;
    scope = new Scope();
  });
  afterEach(() => {
    scope.dispose();
    vi.restoreAllMocks();
  });

  it('the first postcard: +30 shown on it; the second: nothing more; sharing is the same either way', async () => {
    const postcard = await import('../../src/ui/components/postcard');
    // Happy-dom has no canvas: a stand-in card and picture.
    vi.spyOn(postcard, 'composePostcard').mockImplementation(() => document.createElement('canvas'));
    vi.spyOn(postcard, 'postcardBlob').mockResolvedValue(new Blob(['x'], { type: 'image/png' }));
    vi.spyOn(postcard, 'postcardLogo').mockResolvedValue(null);
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const { openPhotoMode } = await import('../../src/ui/components/photoMode');
    const pm = openPhotoMode(scope, host, { place: 'Meadow Farm', home: 'farm', kind: '2d', frames: [], capture: async () => document.createElement('canvas') });
    expect(host.querySelector('[data-photo-memory]')?.textContent).toMatch(/earns 30 Paw Coins\. Sharing it is up to you/);
    (host.querySelector('[data-act="photo-take"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.postcard-sheet')).not.toBeNull(), { timeout: 3000 });
    expect(document.querySelector('.postcard-sheet__memory')?.textContent).toMatch(/\+30 Paw Coins/);
    expect(balance(app.save)).toBe(30);
    expect(host.querySelector('[data-photo-memory]')?.textContent).toMatch(/done/);
    (document.querySelector('[data-act="pc-again"]') as HTMLElement).click();
    (host.querySelector('[data-act="photo-take"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(document.querySelector('.postcard-sheet')).not.toBeNull(), { timeout: 3000 });
    expect(document.querySelector('.postcard-sheet__memory')).toBeNull();
    expect(balance(app.save)).toBe(30);
    pm.close();
  });

  it('a keepsake: framed on its animal, signed with its line, and shared with its words', async () => {
    const { openPhotoMode } = await import('../../src/ui/components/photoMode');
    const go = vi.fn();
    openPhotoMode(
      scope,
      host,
      {
        place: 'Meadow Farm',
        home: 'farm',
        kind: '2d',
        frames: [
          { id: 'home', label: 'Whole home', go: vi.fn() },
          { id: 'a:Cotton', label: 'Cotton', go },
        ],
        capture: async () => null,
        keepsake: { caption: 'Cotton came home to the Farm', text: 'Meet my new PawTyk friend, Cotton the sheep! 🐾', source: 'arrival' },
      },
      { frame: 'a:Cotton' },
    );
    expect(go).toHaveBeenCalledTimes(1);
    expect(host.querySelector('[data-frame="a:Cotton"]')?.getAttribute('aria-checked')).toBe('true');
    expect(host.querySelector('.photo-sign')?.textContent).toContain('Cotton came home to the Farm');
  });
});

describe('analytics follow the player’s choice, and carry no recipients', () => {
  afterEach(() => setAnalyticsEnabled(true));
  it('off: nothing goes to a sink; on: the share events carry only the surface and the platform’s result', async () => {
    const sent: Array<{ name: string; props: Record<string, unknown> }> = [];
    const off = addSink({ send: (name, props) => sent.push({ name, props }) });
    setAnalyticsEnabled(false);
    track('share_result', { surface: 'daily', result: 'shared' });
    expect(sent).toHaveLength(0);
    setAnalyticsEnabled(true);
    track('share_result', { surface: 'daily', result: 'shared', recipient_name: 'Sam', email: 'x@y.z' });
    expect(sent[sent.length - 1]).toEqual({ name: 'share_result', props: { surface: 'daily', result: 'shared' } });
    off();
  });
});

describe('nothing about sharing opens by itself', () => {
  const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    const s = defaultSave(new Date(2026, 10, 11, 12));
    Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    s.journey.nextLevel = 41;
    s.world.growth.farm = 4;
    for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    app.replaceSave(s);
    app.settings.reducedMotion = 'reduce';
  });
  afterEach(() => {
    app.settings.reducedMotion = 'system';
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    vi.useRealTimers();
  });

  it('after a welcome: an optional "Share Truffle’s arrival" under the scene, never a sheet or photo mode on its own', async () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = new Router(document.getElementById('app')!);
    const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
    for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
    router.register({ ...reg, region: regionScreen });
    app.router = router;
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    expect(document.querySelector('[data-act="share-arrival"]')).toBeNull();
    await vi.advanceTimersByTimeAsync(cueMs(SCORES[CELEBRATION_CUE[celebrationFor(app.save, 'truffle')]]) + 3000);
    const btn = document.querySelector<HTMLElement>('[data-act="share-arrival"]');
    expect(btn?.textContent).toMatch(/Share Truffle's arrival/);
    expect(document.querySelector('.photo-mode, .postcard-sheet, .result-sheet, .sheet')).toBeNull();
    btn!.click();
    expect(document.querySelector('.photo-mode')).not.toBeNull();
    expect(document.querySelector('.photo-sign')?.textContent).toMatch(/Truffle came home to the Farm/);
  });
});

// Last: it re-imports modules with the native platform mocked.
describe('the share service: native, browser and copy, cancels and failures', () => {
  const nav = navigator as Navigator & { canShare?: unknown; share?: unknown; clipboard?: unknown };
  afterEach(() => {
    Reflect.deleteProperty(nav, 'canShare');
    Reflect.deleteProperty(nav, 'share');
    vi.restoreAllMocks();
    vi.doUnmock('@capacitor/core');
    vi.doUnmock('@capacitor/share');
    vi.doUnmock('@capacitor/filesystem');
    vi.resetModules();
  });

  it('a picture with its words: the browser’s share gets the text (with the link in it)', async () => {
    const { shareImage } = await import('../../src/services/share');
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(nav, { canShare: () => true, share });
    expect(await shareImage(new Blob(['x']), 'a.png', 'A', { text: 'Hi https://pawtyk.app/?s=daily', url: 'https://pawtyk.app/?s=daily' })).toBe('shared');
    expect(share.mock.calls[0][0]).toMatchObject({ text: 'Hi https://pawtyk.app/?s=daily', title: 'A' });
  });

  it('text alone: the share sheet where there is one, else copied for pasting, else failed; a cancel is not a failure', async () => {
    const { shareText } = await import('../../src/services/share');
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(nav, { share });
    expect(await shareText('Hello', 'https://pawtyk.app/?s=result')).toBe('shared');
    expect(share).toHaveBeenCalledWith({ text: 'Hello', url: 'https://pawtyk.app/?s=result' });
    share.mockRejectedValueOnce(Object.assign(new Error('Share canceled'), { name: 'AbortError' }));
    expect(await shareText('Hello')).toBe('cancelled');
    share.mockRejectedValueOnce(new Error('boom'));
    expect(await shareText('Hello')).toBe('failed');
    Reflect.deleteProperty(nav, 'share');
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(nav, 'clipboard', { value: { writeText }, configurable: true });
    expect(await shareText('Hello', 'https://pawtyk.app/?s=result')).toBe('copied');
    expect(writeText).toHaveBeenCalledWith('Hello https://pawtyk.app/?s=result');
    Object.defineProperty(nav, 'clipboard', { value: undefined, configurable: true });
    expect(await shareText('Hello')).toBe('failed');
  });

  it('on iPhone: the system sheet, the picture written to the cache and removed after, the link given once', async () => {
    const shareSpy = vi.fn().mockResolvedValue({ activityType: 'com.apple.UIKit.activity.Message' });
    const writeFile = vi.fn().mockResolvedValue({ uri: 'file:///cache/postcards/a.png' });
    const deleteFile = vi.fn().mockResolvedValue(undefined);
    vi.doMock('@capacitor/core', () => ({ Capacitor: { isNativePlatform: () => true } }));
    vi.doMock('@capacitor/share', () => ({ Share: { share: shareSpy } }));
    vi.doMock('@capacitor/filesystem', () => ({ Directory: { Cache: 'CACHE' }, Filesystem: { writeFile, deleteFile, rmdir: vi.fn().mockResolvedValue(undefined) } }));
    vi.resetModules();
    const { shareImage, shareText } = await import('../../src/services/share');
    expect(await shareImage(new Blob(['x']), 'a.png', 'A', { text: 'Meet Cotton! https://pawtyk.app/?s=arrival', url: 'https://pawtyk.app/?s=arrival' })).toBe('shared');
    expect(shareSpy.mock.calls[0][0]).toEqual({ title: 'A', files: ['file:///cache/postcards/a.png'], text: 'Meet Cotton! https://pawtyk.app/?s=arrival' });
    expect(deleteFile).toHaveBeenCalledTimes(1);
    shareSpy.mockRejectedValueOnce(new Error('Share canceled'));
    expect(await shareText('Hi')).toBe('cancelled');
  });

  it('what the player is told never claims a post was made', async () => {
    const { shareToast } = await import('../../src/ui/components/resultCard');
    const sheet = await import('../../src/ui/components/sheet');
    const toast = vi.spyOn(sheet, 'toast').mockImplementation(() => {});
    for (const r of ['shared', 'downloaded', 'copied', 'cancelled', 'failed'] as const) shareToast(r);
    const said = toast.mock.calls.map((c) => String(c[0])).join(' ');
    expect(said).not.toMatch(/posted|published|your friends saw|shared with/i);
    // A finished share sheet and a cancel say nothing at all.
    expect(toast).toHaveBeenCalledTimes(3);
  });
});
