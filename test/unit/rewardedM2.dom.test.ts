// @vitest-environment happy-dom
/**
 * M2, earning a video token from an item's card: the card says how many tokens the player has and how many it needs,
 * offers an optional video (only when videos are part of this build and some are left today), shows the new balance
 * when a verified reward comes in, and stays on the same item. A video that doesn't finish, isn't there or fails
 * grants nothing and charges nothing; a reward reported twice grants once; the daily cap holds.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave } from '../../src/services/storage';
import { grantItem, itemBalance } from '../../src/meta/items';
import { REWARDED_DAILY_CAP } from '../../src/app/rewarded';
import { ads } from '../../src/services/ads';
import { earnMessage, tokenNeedMarkup } from '../../src/ui/components/earnToken';
import { DECOR, decorHome } from '../../src/meta/catalogs/decor';
import { owns } from '../../src/meta/sanctuary';
import { ownsTrick } from '../../src/meta/tricks';
import { localDateKey } from '../../src/game/dates';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
// A Farm piece sold for video tokens.
const TOKEN_DECOR = DECOR.find((d) => decorHome(d) === 'farm' && d.tokens && d.unlock.kind === 'shop')!;

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game', 'region', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, shop: shopScreen });
  app.router = router;
  return router;
}

/** The ad service's answer to the next video: watched (the reward reported, maybe twice), not finished, or a failure. */
function nextVideo(outcome: 'watched' | 'twice' | 'cancelled' | 'failed') {
  return vi.spyOn(ads, 'showRewarded').mockImplementation(async (_p, onEarned) => {
    if (outcome === 'failed') throw new Error('network');
    if (outcome === 'cancelled') return false;
    onEarned?.();
    if (outcome === 'twice') onEarned?.();
    return true;
  });
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true });
  s.journey.nextLevel = 41;
  s.world.growth.farm = 4;
  grantItem(s, 'test:tokens', 'vtoken', 1, 'gift', NOW);
  app.replaceSave(s);
});
afterEach(() => {
  vi.restoreAllMocks();
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  vi.useRealTimers();
});

describe('what the card says', () => {
  it('how many the player has and needs, and the optional video with the videos left today', () => {
    expect(ads.available).toBe(true);
    const html = tokenNeedMarkup(3);
    expect(html).toContain('You have 1 video token; this needs 3.');
    expect(html).toContain('(2 to go)');
    expect(html).toContain(`${REWARDED_DAILY_CAP} videos left today`);
    expect(html).toContain('data-act="earn-token"');
    expect(tokenNeedMarkup(1)).toBe('');
  });

  it('no button when today’s videos are used up, or when this build has no videos', () => {
    app.save.ads = { ...app.save.ads, day: localDateKey(NOW), rewarded: REWARDED_DAILY_CAP };
    expect(tokenNeedMarkup(3)).toMatch(/That's all \d+ videos for today/);
    expect(tokenNeedMarkup(3)).not.toContain('earn-token');
    app.save.ads.rewarded = 0;
    vi.spyOn(ads, 'available', 'get').mockReturnValue(false);
    expect(tokenNeedMarkup(3)).toMatch(/aren't available right now/);
    expect(tokenNeedMarkup(3)).not.toContain('earn-token');
  });

  it('every outcome is said plainly; only a watched video says +1', () => {
    expect(earnMessage('granted')).toBe('+1 video token');
    for (const r of ['no-video', 'unavailable', 'cap'] as const) expect(earnMessage(r)).not.toMatch(/\+1/);
    expect(earnMessage('no-video')).toMatch(/Nothing was charged/);
    expect(earnMessage('busy')).toBeNull();
  });
});

describe('on a decoration’s card', () => {
  const open = () => {
    mount().go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: TOKEN_DECOR.id });
    return document.querySelector<HTMLElement>('.decor-sheet')!;
  };

  it('a watched video: +1 token, the card shows the new balance and stays on the same item; enough, and Buy is there', async () => {
    const need = TOKEN_DECOR.tokens!;
    nextVideo('watched');
    const sheet = open();
    expect(sheet.querySelector('[data-token-need]')?.textContent).toContain(`You have 1 video token; this needs ${need}.`);
    for (let i = 1; i < need; i++) {
      (sheet.querySelector('[data-act="earn-token"]') as HTMLElement).click();
      await vi.advanceTimersByTimeAsync(10);
      expect(itemBalance(app.save, 'vtoken')).toBe(1 + i);
      expect(document.querySelector('.decor-sheet')).toBe(sheet);
    }
    expect(sheet.querySelector('[data-token-need]')).toBeNull();
    expect(sheet.querySelector('.price-line')?.textContent).toContain(`you have ${need}`);
    const buy = sheet.querySelector<HTMLElement>('[data-act="buy"]')!;
    expect(document.activeElement).toBe(buy);
    buy.click();
    expect(owns(app.save, TOKEN_DECOR.id)).toBe(true);
    expect(itemBalance(app.save, 'vtoken')).toBe(0);
  });

  it('a reward reported twice for one video grants one token', async () => {
    nextVideo('twice');
    const sheet = open();
    (sheet.querySelector('[data-act="earn-token"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(itemBalance(app.save, 'vtoken')).toBe(2);
  });

  it('a video not finished, or a failure: no token, nothing charged, the card still on the item, and it can be tried again', async () => {
    const spy = nextVideo('cancelled');
    const sheet = open();
    (sheet.querySelector('[data-act="earn-token"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(itemBalance(app.save, 'vtoken')).toBe(1);
    expect(document.querySelector('.toast')?.textContent).toMatch(/No token this time/);
    expect(document.querySelector('.decor-sheet')).toBe(sheet);
    spy.mockImplementation(async () => {
      throw new Error('network');
    });
    const again = sheet.querySelector<HTMLButtonElement>('[data-act="earn-token"]')!;
    expect(again.disabled).toBe(false);
    again.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(itemBalance(app.save, 'vtoken')).toBe(1);
    expect(app.save.ads.rewarded ?? 0).toBe(0);
    expect(document.querySelector('.decor-sheet')).toBe(sheet);
  });

  it('the daily cap holds: the last video of the day, then no more buttons', async () => {
    nextVideo('watched');
    app.save.ads = { ...app.save.ads, day: localDateKey(NOW), rewarded: REWARDED_DAILY_CAP - 1 };
    const sheet = open();
    (sheet.querySelector('[data-act="earn-token"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(itemBalance(app.save, 'vtoken')).toBe(2);
    if (TOKEN_DECOR.tokens! > 2) {
      expect(sheet.querySelector('[data-act="earn-token"]')).toBeNull();
      expect(sheet.querySelector('[data-token-need]')?.textContent).toMatch(/That's all/);
    }
  });
});

describe('on a trick’s card', () => {
  it('the same: the new balance, the same card, and nothing learned until the player chooses to', async () => {
    nextVideo('watched');
    mount().go({ screen: 'shop', tab: 'tricks', trick: 'confetti' });
    const sheet = document.querySelector<HTMLElement>('.trick-sheet')!;
    expect(sheet.querySelector('[data-token-need]')?.textContent).toContain('You have 1 video token; this needs 2.');
    (sheet.querySelector('[data-act="earn-token"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector('.trick-sheet')).toBe(sheet);
    expect(itemBalance(app.save, 'vtoken')).toBe(2);
    expect(ownsTrick(app.save, 'confetti')).toBe(false);
    expect(sheet.querySelector('[data-act="buy"]')).not.toBeNull();
  });
});
