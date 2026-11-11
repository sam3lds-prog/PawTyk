// M integration: the plan's global constraints that a later change could quietly break, and the M tester shortcuts.
import { describe, expect, it } from 'vitest';
import { forgetPhotoMemory, setVideosUsed, zeroTokens } from '../../src/app/qaTools';
import { REWARDED_DAILY_CAP, videosLeftToday } from '../../src/app/rewarded';
import { featureFlags } from '../../src/config/featureFlags';
import { balance } from '../../src/meta/ledger';
import { grantItem, itemBalance } from '../../src/meta/items';
import { claimPhotoMemory, photoMemoryDone } from '../../src/meta/photoMemory';
import { TestVideoAdService } from '../../src/services/ads';
import { PRODUCT_CATALOG } from '../../src/services/iap';
import { defaultSave } from '../../src/services/storage';

const NOW = new Date(2026, 10, 11, 12);

describe('M: global constraints', () => {
  it('keeps every IAP product id as it was, and adds none (no VIP pass, no referral or cosmetics products)', () => {
    expect(PRODUCT_CATALOG.map((p) => p.id)).toEqual(['gems_60', 'gems_160', 'gems_420', 'remove_ads', 'welcome_pack']);
  });

  it('keeps friend invites off until the referral review is approved (docs/referrals.md)', () => {
    expect(featureFlags.friends).toBe(false);
  });

  it('never shows an interstitial, even in test builds', async () => {
    expect(await new TestVideoAdService(1).showInterstitial()).toBe(false);
  });
});

describe('M: tester shortcuts', () => {
  it('sets video tokens to 0, once, through the item ledger', () => {
    const s = defaultSave();
    grantItem(s, 'test:tokens', 'vtoken', 3, 'gift', NOW);
    zeroTokens(s, NOW);
    expect(itemBalance(s, 'vtoken')).toBe(0);
    const n = s.inventory.items.length;
    zeroTokens(s, NOW);
    expect(s.inventory.items.length).toBe(n);
  });

  it("uses up today's videos and gives them back", () => {
    const s = defaultSave();
    setVideosUsed(s, REWARDED_DAILY_CAP, NOW);
    expect(videosLeftToday(s, NOW)).toBe(0);
    setVideosUsed(s, 0, NOW);
    expect(videosLeftToday(s, NOW)).toBe(REWARDED_DAILY_CAP);
  });

  it("forgets this week's Photo Memory with its coins, so the next postcard earns it again", () => {
    const s = defaultSave();
    const before = balance(s);
    expect(forgetPhotoMemory(s, NOW)).toBe(false);
    expect(claimPhotoMemory(s, NOW)).toBe(30);
    expect(forgetPhotoMemory(s, NOW)).toBe(true);
    expect(balance(s)).toBe(before);
    expect(photoMemoryDone(s, NOW)).toBe(false);
    expect(claimPhotoMemory(s, NOW)).toBe(30);
    expect(balance(s)).toBe(before + 30);
  });
});
