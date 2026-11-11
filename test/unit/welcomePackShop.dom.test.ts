// @vitest-environment happy-dom
/**
 * D47 PR 7, the Welcome Rescue Pack in the Shop (a test build, so the test store sells it): it shows only once the
 * player is ready, with its contents and the store's price; a purchase grants it once however many times it is tapped;
 * the Farm's decorations highlight it now and then and "Not now" puts that away; the wagon's own card points to the
 * pack. Nothing about it appears in a puzzle, and the obsolete Remove Interruptions product is never marketed.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { iap } from '../../src/services/iap';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave } from '../../src/services/storage';
import { itemBalance } from '../../src/meta/items';
import { ownsWelcomePack } from '../../src/meta/welcomePack';
import { isShown } from '../../src/meta/sanctuary';
import { WELCOME_PACK_ON_SALE } from '../../src/config/services';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;
const flush = async (n = 6) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setTimeout(r, 0));
};
const q = <T extends Element = HTMLElement>(sel: string) => document.querySelector<T>(sel);

function mount(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'world', 'region', 'sanctuary', 'game', 'welcome', 'pets', 'gallery', 'profile', 'challenges'] as const) reg[k] = blank;
  router.register({ ...reg, shop: shopScreen });
  app.router = router;
}

function readyPlayer(): void {
  app.replaceSave(defaultSave(new Date(2026, 10, 10, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, seenLeagueIntro: true });
  app.save.journey.nextLevel = 9;
  app.save.inventory.companions = { sheep: { unlockedAt: '2026-11-01T00:00:00.000Z' } } as never;
  app.save.sanctuary.visits = 2;
}

beforeEach(() => {
  localStorage.clear();
  readyPlayer();
  mount();
});
afterEach(() => {
  document.body.innerHTML = '';
});

describe('the Welcome Rescue Pack in the Shop', () => {
  it('is on sale in a test build with the test store', () => {
    expect(WELCOME_PACK_ON_SALE).toBe(true);
    expect(iap.available && iap.isStub).toBe(true);
  });

  it('is not shown to a player who is still in the first lessons', async () => {
    app.replaceSave(defaultSave(new Date(2026, 10, 10, 12)));
    router.go({ screen: 'shop', tab: 'gems' });
    await flush();
    expect(q('[data-welcome-pack]')).toBeNull();
    router.go({ screen: 'shop', sanctuary: 'farm' });
    await flush();
    expect(q('[data-pack-highlight]')).toBeNull();
    expect(q('[data-decor="rescuewagon"]')).toBeNull();
  });

  it('shows what is in it and the price, and grants it once however many times it is tapped', async () => {
    router.go({ screen: 'shop', tab: 'gems' });
    await flush();
    const card = q('[data-welcome-pack]')!;
    expect(card).toBeTruthy();
    expect(card.textContent).toMatch(/Rescue Wagon/);
    expect(card.textContent).toMatch(/180 gems/);
    expect(card.textContent).toMatch(/No hints, hearts/);
    const buy = q<HTMLButtonElement>('[data-buy="welcome_pack"]')!;
    expect(buy.textContent).toBe('Test');
    const before = itemBalance(app.save, 'gem');
    buy.click();
    buy.click();
    buy.click();
    await flush(10);
    expect(ownsWelcomePack(app.save)).toBe(true);
    expect(itemBalance(app.save, 'gem') - before).toBe(180);
    expect(isShown(app.save, 'rescuewagon')).toBe(true);
    // Bought: a thank-you, and no button to buy it again.
    expect(q('[data-buy="welcome_pack"]')).toBeNull();
    expect(q('[data-welcome-pack]')?.textContent).toMatch(/Owned/);
    // The obsolete product is never on sale.
    expect(q('[data-buy="remove_ads"]')).toBeNull();
    expect(document.body.textContent).not.toMatch(/Remove Interruptions/i);
  });

  it('the Farm decorations highlight it, "Take a look" opens the Gems tab, and "Not now" puts it away for good', async () => {
    router.go({ screen: 'shop', sanctuary: 'farm' });
    await flush();
    expect(q('[data-pack-highlight]')).toBeTruthy();
    expect(app.save.offers?.welcome?.shown).toBe(1);
    // The wagon is listed with the Farm's premium decorations, marked as the pack's own (no price).
    const wagon = q('[data-decor="rescuewagon"]')!;
    expect(wagon.textContent).toMatch(/In the Welcome Pack/);
    q<HTMLElement>('[data-act="pack-later"]')!.click();
    await flush();
    expect(q('[data-pack-highlight]')).toBeNull();
    expect(app.save.offers?.welcome?.dismissed).toBe(true);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    await flush();
    expect(q('[data-pack-highlight]')).toBeNull();
    // Still in the Gems tab: "Not now" only stops the highlight.
    router.go({ screen: 'shop', tab: 'gems' });
    await flush();
    expect(q('[data-welcome-pack]')).toBeTruthy();
  });

  it('the wagon\'s own card says it is only in the pack and leads there', async () => {
    router.go({ screen: 'shop', sanctuary: 'farm' });
    await flush();
    q<HTMLElement>('[data-decor="rescuewagon"]')!.click();
    await flush();
    const see = q<HTMLElement>('[data-act="see-pack"]')!;
    expect(see).toBeTruthy();
    expect(see.closest('.sheet, .overlay, [role="dialog"]')?.textContent).toMatch(/Only in the Welcome Rescue Pack/);
    see.click();
    await flush();
    expect(q('.seg__btn[aria-selected="true"]')?.getAttribute('data-tab')).toBe('gems');
    expect(q('[data-welcome-pack]')).toBeTruthy();
  });

  it('a cancelled purchase grants nothing and can be tried again', async () => {
    const real = iap.purchase.bind(iap);
    iap.purchase = async () => ({ ok: false, reason: 'cancelled' });
    try {
      router.go({ screen: 'shop', tab: 'gems' });
      await flush();
      q<HTMLButtonElement>('[data-buy="welcome_pack"]')!.click();
      await flush(10);
      expect(ownsWelcomePack(app.save)).toBe(false);
      expect(itemBalance(app.save, 'gem')).toBe(0);
      expect(q<HTMLButtonElement>('[data-buy="welcome_pack"]')?.disabled).toBe(false);
    } finally {
      iap.purchase = real;
    }
  });
});
