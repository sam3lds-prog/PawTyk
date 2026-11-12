// @vitest-environment happy-dom
/**
 * D52 PR D: reward videos stay optional and honest. An offer says what it earns before anything starts, and a video
 * starts only on the player's tap. However it ends — closed early, no video ready, no connection, the privacy question
 * unanswered, a failure, a video that never reports back — nothing is granted or used, the player hears the real
 * reason, and play goes on. A reward the network confirms is granted once. Interstitials stay off. Settings can report
 * a video.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { startGame } from '../../src/app/gameFlow';
import { setPantry } from '../../src/app/qaTools';
import { itemBalance } from '../../src/meta/items';
import { defaultSave } from '../../src/services/storage';
import { ads, INTERSTITIALS_ENABLED, TestVideoAdService, outcomeOfError } from '../../src/services/ads';
import { VIDEO_WATCHDOG_MS, lastVideoShown, watchVideoFor } from '../../src/app/rewarded';
import { showVideoReport, videoOfferLine, videoResultMessage, videoReportText } from '../../src/ui/components/videoOffer';
import { showSettings } from '../../src/ui/screens/settings';

const blank = { tab: null, title: 'x', mount: () => {} };
function mountRouter(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], typeof blank>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen } as never);
  app.router = router;
  return router;
}
const setOutcome = (o: string | null) => ((ads as { lastOutcome?: string | null }).lastOutcome = o);
const hints = () => itemBalance(app.save, 'hint');

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 11, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, controlsTipSeen: true });
  app.active = null;
  setOutcome(null);
  mountRouter();
});
afterEach(() => {
  app.active = null;
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.querySelectorAll('.overlay, .fake-ad, .toast-host').forEach((o) => o.remove());
});

describe('the reasons', () => {
  it('SDK failures become plain outcomes: 2 no connection, 3 no fill, anything else a failure', () => {
    expect(outcomeOfError({ code: '2', message: 'Network error.' })).toBe('offline');
    expect(outcomeOfError({ code: '3', message: 'No fill.' })).toBe('no-fill');
    expect(outcomeOfError({ message: 'No fill.' })).toBe('no-fill');
    expect(outcomeOfError(new Error('boom'))).toBe('error');
  });

  it('each says what happened and that nothing was used; a granted video or one already playing says nothing', () => {
    for (const r of ['closed', 'no-fill', 'no-video', 'offline', 'consent', 'error', 'unavailable'] as const) expect(videoResultMessage(r, 'hint')).toMatch(/Nothing was used\./);
    expect(videoResultMessage('closed', 'hint')).toBe("The video ended early, so there's no hint this time. Nothing was used.");
    expect(videoResultMessage('offline', 'life')).toBe('Videos need an internet connection. Nothing was used.');
    expect(videoResultMessage('cap', 'vtoken')).toBe("That's all the videos for today. More tomorrow.");
    expect(videoResultMessage('granted', 'hint')).toBeNull();
    expect(videoResultMessage('busy', 'hint')).toBeNull();
    expect(videoOfferLine('hint')).toBe('Watch an optional video to earn +1 hint.');
  });

  it('interstitials stay off', () => {
    expect(INTERSTITIALS_ENABLED).toBe(false);
  });
});

describe('watching a video', () => {
  it('closed early: no reward, nothing counted against the day, the reason kept for a report', async () => {
    vi.spyOn(ads, 'showRewarded').mockImplementation(async () => {
      setOutcome('closed');
      return false;
    });
    const before = hints();
    expect(await watchVideoFor('hint')).toBe('closed');
    expect(hints()).toBe(before);
    expect(app.save.ads.rewarded ?? 0).toBe(0);
    expect(lastVideoShown()).toMatchObject({ placement: 'hint', result: 'closed' });
  });

  it('no fill, and a thrown failure, earn nothing', async () => {
    const spy = vi.spyOn(ads, 'showRewarded').mockImplementation(async () => {
      setOutcome('no-fill');
      return false;
    });
    expect(await watchVideoFor('life')).toBe('no-fill');
    spy.mockImplementation(async () => {
      throw new Error('boom');
    });
    expect(await watchVideoFor('life')).toBe('error');
    expect(itemBalance(app.save, 'life')).toBe(itemBalance(defaultSave(), 'life'));
  });

  it('a real network with no connection says so before trying', async () => {
    const show = vi.spyOn(ads, 'showRewarded');
    const stub = Object.getOwnPropertyDescriptor(ads, 'isStub');
    Object.defineProperty(ads, 'isStub', { value: false, configurable: true });
    const online = vi.spyOn(navigator, 'onLine', 'get').mockReturnValue(false);
    expect(await watchVideoFor('hint')).toBe('offline');
    expect(show).not.toHaveBeenCalled();
    online.mockRestore();
    if (stub) Object.defineProperty(ads, 'isStub', stub);
  });

  it('a video that never reports back frees the button after a while; a reward the network confirms later is still granted once', async () => {
    let earn: (() => void) | undefined;
    vi.spyOn(ads, 'showRewarded').mockImplementation((_p, onEarned) => {
      earn = onEarned;
      return new Promise(() => {});
    });
    const before = hints();
    const first = watchVideoFor('hint');
    expect(await watchVideoFor('hint')).toBe('busy');
    await vi.advanceTimersByTimeAsync(VIDEO_WATCHDOG_MS + 10);
    expect(await first).toBe('error');
    earn?.();
    earn?.();
    expect(hints()).toBe(before + 1);
  });

  it('the test video has a visible close; closing it earns nothing', async () => {
    const svc = new TestVideoAdService(5000);
    let earned = false;
    const p = svc.showRewarded('hint', () => (earned = true));
    (document.querySelector('.fake-ad__close') as HTMLButtonElement).click();
    expect(await p).toBe(false);
    expect(svc.lastOutcome).toBe('closed');
    expect(earned).toBe(false);
    const q = svc.showRewarded('hint', () => (earned = true));
    await vi.advanceTimersByTimeAsync(5100);
    expect(await q).toBe(true);
    expect(earned).toBe(true);
  });
});

describe('on a board', () => {
  function noHintsSheet(): HTMLElement {
    setPantry(app.save, 'hint', 0);
    app.settings.controls = 'tap';
    startGame({ kind: 'level', level: 6 });
    for (let i = 0; i < 6 && !document.querySelector('.sheet'); i++) {
      (document.querySelector('[data-act="hint"]') as HTMLElement).click();
      vi.advanceTimersByTime(50);
    }
    return document.querySelector('.sheet')!;
  }

  it('out of hints: the offer says what the video earns first, and nothing starts until the tap', () => {
    const show = vi.spyOn(ads, 'showRewarded');
    const sheet = noHintsSheet();
    expect(sheet.querySelector('h2')?.textContent).toBe('No hints left');
    expect(sheet.querySelector('[data-video-offer]')?.textContent).toBe('Need one more hint? Watch an optional video to earn +1 hint.');
    expect(sheet.querySelector('[data-act="watch"]')?.textContent).toBe('Watch video');
    expect(sheet.querySelector('[data-act="watch"]')?.getAttribute('aria-label')).toBe('Watch video. Watch an optional video to earn +1 hint.');
    expect(sheet.querySelector('[data-act="close"]')?.textContent).toBe('Keep thinking');
    expect(show).not.toHaveBeenCalled();
  });

  it('a video closed early: the reason, no hint, and the board plays on', async () => {
    vi.spyOn(ads, 'showRewarded').mockImplementation(async () => {
      setOutcome('closed');
      return false;
    });
    const sheet = noHintsSheet();
    (sheet.querySelector('[data-act="watch"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(20);
    expect(document.querySelector('.toast')?.textContent).toBe("The video ended early, so there's no hint this time. Nothing was used.");
    expect(hints()).toBe(0);
    expect(document.querySelector('.sheet')).toBeNull();
    expect(app.active!.session.paused).toBe(false);
  });
});

describe('reporting a video', () => {
  it('Settings offers it whenever videos are part of the build; the report says what was wrong and when, nothing about the player', async () => {
    vi.spyOn(ads, 'showRewarded').mockImplementation(async () => {
      setOutcome('closed');
      return false;
    });
    await watchVideoFor('hint');
    const scope = new Scope();
    showSettings(scope);
    const row = document.querySelector<HTMLElement>('[data-act="video-report"]');
    expect(row).not.toBeNull();
    row!.click();
    const sheet = document.querySelector('.video-report-sheet')!;
    expect(sheet).not.toBeNull();
    (sheet.querySelector('[data-reason="Scary or upsetting"]') as HTMLElement).click();
    expect(sheet.querySelector('[data-reason="Scary or upsetting"]')!.getAttribute('aria-checked')).toBe('true');
    const text = videoReportText('Scary or upsetting');
    expect(text).toMatch(/^PawTyk video report\nReason: Scary or upsetting\nLast video: \d{4}-\d\d-\d\dT.+ \(for a hint\)\./);
    expect(text).not.toMatch(/@|nickname|device/i);
    const copy = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: copy }, configurable: true });
    (sheet.querySelector('[data-act="send"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(copy).toHaveBeenCalledWith(expect.stringMatching(/Reason: Scary or upsetting/));
    scope.dispose();
  });

  it('opens on its own too (for the post-video link or a test)', () => {
    const scope = new Scope();
    showVideoReport(scope);
    expect(document.querySelectorAll('.video-report-sheet [data-reason]')).toHaveLength(5);
    scope.dispose();
  });
});
