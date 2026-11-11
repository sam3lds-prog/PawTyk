// @vitest-environment happy-dom
/**
 * D43, release readiness: a release build without the App Store (RevenueCat), reward videos (AdMob) or the leaderboard
 * (Firebase) shows none of them: no "coming soon", no price that can't be paid, no preview of online leagues. What the
 * player already owns still shows. Settings carries the full privacy policy.
 *
 * `TEST_BUILD` is forced off, so every service is created exactly as in a release build with no keys set.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../src/config/services', async (importOriginal) => ({ ...(await importOriginal<object>()), TEST_BUILD: false }));

import { app } from '../../src/app/app';
import { currencyOffered, gemPacksOnSale, leaderboardOffered } from '../../src/app/offers';
import { iap } from '../../src/services/iap';
import { ads } from '../../src/services/ads';
import { leaderboard } from '../../src/services/leaderboard';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { shopScreen } from '../../src/ui/screens/shop';
import { leagueScreen } from '../../src/ui/screens/league';
import { showSettings } from '../../src/ui/screens/settings';
import { trickChips } from '../../src/ui/components/tricks';
import { walletPills } from '../../src/ui/components/wallet';
import { DECOR, decorHome, decorTier } from '../../src/meta/catalogs/decor';
import { TRICKS } from '../../src/meta/catalogs/tricks';
import { grantItem } from '../../src/meta/items';
import { defaultSave } from '../../src/services/storage';
import { ownsWelcomePack, grantWelcomePack } from '../../src/meta/welcomePack';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

/** Words that mark an unfinished feature. None may appear anywhere a player can reach in a release build. */
const PLACEHOLDER = /coming soon|arriving with|when (online )?leagues open|not open yet|aren['’]t online|isn['’]t online|this version doesn|preview/i;

function mountAll(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'world', 'region', 'sanctuary', 'game', 'welcome', 'pets', 'gallery', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, shop: shopScreen, challenges: leagueScreen });
  app.router = router;
}

const all = (sel: string) => [...document.querySelectorAll<HTMLElement>(sel)];
const click = (sel: string) => document.querySelector<HTMLElement>(sel)!.click();

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 9, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, seenLeagueIntro: true });
  app.save.journey.nextLevel = 30;
  mountAll();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('a release build with no store, no videos and no leaderboard', () => {
  it('really is one (the services are the unavailable ones)', () => {
    expect(iap.available).toBe(false);
    expect(ads.available).toBe(false);
    expect(leaderboard.mode).toBe('off');
    expect(gemPacksOnSale()).toBe(false);
    expect(leaderboardOffered()).toBe(false);
    expect(currencyOffered(app.save, 'coins')).toBe(true);
    expect(currencyOffered(app.save, 'gem')).toBe(false);
    expect(currencyOffered(app.save, 'vtoken')).toBe(false);
  });

  it('the Shop has no Gems tab, sells nothing for gems or video tokens, and says nothing is coming', () => {
    router.go({ screen: 'shop' });
    expect(all('.seg__btn').map((b) => b.textContent?.trim())).toEqual(['Decor', 'Food', 'Tricks']);
    for (const t of ['decor', 'food', 'tricks']) {
      click(`.seg__btn[data-tab="${t}"]`);
      const body = document.querySelector('.shop__body')!;
      expect(body.textContent).not.toMatch(PLACEHOLDER);
      expect(body.querySelector('.shop-section--premium, .shop-section--video')).toBeNull();
      expect(body.querySelector('.price--gem, .price--vtoken')).toBeNull();
      expect(body.textContent).not.toMatch(/video token|gems?\b/i);
    }
    // Only Paw Coins in the wallet.
    expect(document.querySelectorAll('.wallet__pill').length).toBe(1);
  });

  it('a Welcome Rescue Pack from a tester build’s test store doesn’t count here; a real purchase still can be made', () => {
    grantWelcomePack(app.save, 'test-pack-1', 'dev');
    expect(ownsWelcomePack(app.save)).toBe(false);
    expect(grantWelcomePack(app.save, 'T-real', 'store')).toBe(180);
    expect(ownsWelcomePack(app.save)).toBe(true);
  });

  it('a link straight to the Gems tab lands on Decor', () => {
    router.go({ screen: 'shop', tab: 'gems' });
    expect(document.querySelector('.seg__btn[aria-selected="true"]')?.getAttribute('data-tab')).toBe('decor');
    expect(document.querySelector('[data-buy]')).toBeNull();
  });

  it('what the player already owns still shows, and gems they still hold can be spent', () => {
    const premium = DECOR.find((d) => decorTier(d) === 'premium' && decorHome(d) === 'farm')!;
    expect(premium).toBeTruthy();
    app.save.inventory.decor[premium.id] = { boughtAt: '2026-11-01T00:00:00.000Z' } as never;
    router.go({ screen: 'shop', sanctuary: 'farm' });
    const premiumCards = all('.shop-section--premium [data-decor]').map((b) => b.dataset.decor);
    expect(premiumCards).toEqual([premium.id]);
    // Holding gems (bought before, say): premium things are for sale again, and the gem pill shows.
    delete app.save.inventory.decor[premium.id];
    router.go({ screen: 'shop', sanctuary: 'farm' });
    expect(document.querySelector('.shop-section--premium')).toBeNull();
    grantItem(app.save, 'test:gems', 'gem', 200, 'store');
    expect(currencyOffered(app.save, 'gem')).toBe(true);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    expect(all('.shop-section--premium [data-decor]').map((b) => b.dataset.decor)).toEqual([premium.id]);
    expect(document.querySelector('.shop-section--premium .price--gem')).toBeTruthy();
    expect(walletPills()).toContain('200 gems');
    // Still no Gems tab: there's nowhere to buy more.
    expect(all('.seg__btn').map((b) => b.dataset.tab)).not.toContain('gems');
  });

  it('a sanctuary\'s trick tray offers only the free tricks (and any already learned)', () => {
    const chips = (html: string) => [...html.matchAll(/data-trick="([^"]+)"/g)].map((m) => m[1]);
    const free = TRICKS.filter((t) => t.kind === 'trick' && t.tier === 'free').map((t) => t.id);
    expect(chips(trickChips('trick'))).toEqual(free);
    const premium = TRICKS.find((t) => t.kind === 'trick' && t.tier === 'premium')!;
    app.save.inventory.tricks = { ...(app.save.inventory.tricks ?? {}), [premium.id]: { at: '2026-11-01T00:00:00.000Z' } } as never;
    expect(chips(trickChips('trick'))).toContain(premium.id);
  });

  it('Challenges has no Leaderboard tab, opens on the Paw Cup, and previews no leagues', () => {
    router.go({ screen: 'challenges' });
    expect(all('.segmented [data-tab]').map((b) => b.dataset.tab)).toEqual(['week', 'daily']);
    expect(document.querySelector('.segmented [aria-selected="true"]')?.getAttribute('data-tab')).toBe('week');
    expect(document.querySelector('.league')!.textContent).not.toMatch(PLACEHOLDER);
    expect(document.querySelector('.division, .tiers')).toBeNull();
    click('.segmented [data-tab="daily"]');
    expect(document.querySelector('.league')!.textContent).not.toMatch(PLACEHOLDER);
    expect(document.querySelector('.league')!.textContent).not.toMatch(/online leagues|rankings arrive/i);
    // An old link to the leaderboard lands on the Paw Cup.
    router.go({ screen: 'challenges', tab: 'leaderboard' });
    expect(document.querySelector('.segmented [aria-selected="true"]')?.getAttribute('data-tab')).toBe('week');
    expect(document.querySelector('[data-lb]')).toBeNull();
  });

  it('Settings shows no purchases or leaderboard rows, and opens the full privacy policy', () => {
    showSettings(new Scope());
    const sheet = document.querySelector('.sheet')!;
    expect(sheet.textContent).not.toMatch(PLACEHOLDER);
    expect(sheet.textContent).not.toMatch(/Gem packs|Restore purchases/);
    expect(sheet.querySelector('[data-act="leaderboard"]')).toBeNull();
    expect(sheet.textContent).toContain('PawTyk shows no ads.');
    (sheet.querySelector('[data-act="privacy"]') as HTMLElement).click();
    const policy = document.querySelector('.policy-sheet')!;
    expect(policy).toBeTruthy();
    expect(policy.textContent).toContain('Last updated');
    expect(all('.policy-sheet .policy h3').map((h) => h.textContent)).toEqual([
      'The short version',
      'What stays on your device',
      'Optional features',
      'Children',
      'Your choices',
      'Security',
      'Changes',
      'Contact',
    ]);
    expect(policy.textContent).toContain('Aeonix Ventures LLC');
    for (const a of all('.policy-sheet .policy a')) {
      expect(a.getAttribute('href')).toMatch(/^https:\/\//);
      expect(a.getAttribute('target')).toBe('_blank');
    }
    (policy.querySelector('[data-act="close"]') as HTMLElement).click();
    expect(document.querySelector('.policy-sheet')).toBeNull();
  });
});
