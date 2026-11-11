/**
 * D47 PR 7, the Welcome Rescue Pack: 180 gems and the Rescue Wagon, once per player. Granted exactly once per store
 * transaction (repeated taps, a second grant, crash recovery and restore), taken back on a refund and given back if the
 * same purchase is restored, offered only once the player has seen what decorations are for, and never often.
 */
import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  OFFER_GAP_MS,
  OFFER_MAX,
  WELCOME_PACK,
  dismissWelcomeHighlight,
  grantWelcomePack,
  mayHighlightWelcomePack,
  noteWelcomeHighlight,
  ownsWelcomePack,
  readyForWelcomeOffer,
  reconcileWelcomePack,
  revokeWelcomePack,
  REVOKE_WHEN_MISSING,
} from '../../src/meta/welcomePack';
import { itemBalance, spendItem } from '../../src/meta/items';
import { decorPrice, isShown, owns } from '../../src/meta/sanctuary';
import { DECOR_BY_ID, decorTier, PRE_D48_DECOR } from '../../src/meta/catalogs/decor';
import { defaultSave, normalizeSave, type SaveV2 } from '../../src/services/storage';
import { PRODUCT_CATALOG, TestStoreIapService, UnavailableIapService } from '../../src/services/iap';
import { STORE_PRODUCTS, REVENUECAT } from '../../src/config/services';
import { ACHIEVEMENTS } from '../../src/meta/achievements';
import { DECOR } from '../../src/meta/catalogs/decor';

const NOW = new Date(2026, 10, 10, 12);
const later = (ms: number) => new Date(NOW.getTime() + ms);
const gems = (s: SaveV2) => itemBalance(s, 'gem');
const record = (tx: string | null) => ({
  transactions: tx ? [{ transactionId: tx, productId: 'welcome_pack' as const }] : [],
  entitlements: tx ? ['welcome_pack'] : [],
});

/** A player past the first lessons, with an animal home and a home visited. */
function ready(): SaveV2 {
  const s = defaultSave(NOW);
  s.onboarding.tutorialDone = true;
  s.journey.nextLevel = 8;
  s.inventory.companions = { sheep: { unlockedAt: NOW.toISOString() } } as never;
  s.sanctuary.visits = 1;
  return s;
}

describe('what is in the pack', () => {
  it('is 180 gems and the Rescue Wagon, a Farm decoration sold nowhere else, and nothing that helps win', () => {
    expect(WELCOME_PACK).toEqual({ product: 'welcome_pack', gems: 180, decor: 'rescuewagon' });
    const wagon = DECOR_BY_ID.rescuewagon;
    expect(wagon.sanctuary).toBe('farm');
    expect(wagon.unlock).toEqual({ kind: 'pack', pack: 'welcome' });
    expect(decorPrice('rescuewagon')).toBeNull();
    expect(decorTier(wagon)).toBe('premium');
    const entry = PRODUCT_CATALOG.find((p) => p.id === 'welcome_pack')!;
    expect(entry.description).toMatch(/180 gems/);
    expect(`${entry.title} ${entry.description}`).not.toMatch(/hint|heart|life|lives|remove|interruption|ads?\b/i);
    expect(STORE_PRODUCTS.welcome_pack).toBe('pawtyk.welcomepack');
    expect(REVENUECAT.welcomePackEntitlement).toBe('welcome_pack');
  });
});

describe('nothing else asks for it', () => {
  it('"In Full Bloom" counts every decoration except the pack’s own, so it never needs a purchase', () => {
    const bloom = ACHIEVEMENTS.find((a) => a.id === 'full_garden')!;
    const s = ready();
    // D48 PR C: the collection it was set for (the pieces before D48), so new pieces never move the goal.
    const garden = DECOR.filter((d) => d.unlock.kind !== 'pack' && PRE_D48_DECOR.includes(d.id));
    for (const d of garden) s.inventory.decor[d.id] = { ownedAt: NOW.toISOString() } as never;
    const [cur, target] = bloom.progress(s);
    expect(target).toBe(PRE_D48_DECOR.length - 1);
    expect(cur).toBe(target);
    expect(bloom.description).toBe(`Own all ${PRE_D48_DECOR.length - 1} decorations.`);
  });
});

describe('granting it exactly once', () => {
  it('gives the gems once per transaction, puts the wagon out on the Farm and records it', () => {
    const s = ready();
    expect(ownsWelcomePack(s)).toBe(false);
    expect(grantWelcomePack(s, 'T-1', 'store', NOW)).toBe(180);
    expect(gems(s)).toBe(180);
    expect(owns(s, 'rescuewagon')).toBe(true);
    expect(isShown(s, 'rescuewagon')).toBe(true);
    expect(ownsWelcomePack(s)).toBe(true);
    // The same transaction again (a second tap's callback, a restore, the launch check): nothing more.
    expect(grantWelcomePack(s, 'T-1', 'store', later(1000))).toBe(0);
    expect(grantWelcomePack(s, 'T-1', 'store', later(2000))).toBe(0);
    expect(gems(s)).toBe(180);
    expect(s.purchases.packs?.welcome).toEqual({ tx: 'T-1', source: 'store', at: NOW.toISOString() });
    expect(s.inventory.items.filter((e) => e.id === 'iap:T-1')).toHaveLength(1);
  });

  it('once per player: the same pack reported under another transaction id grants no more gems', () => {
    const s = ready();
    expect(grantWelcomePack(s, 'T-1', 'store', NOW)).toBe(180);
    // StoreKit can report a new id for the same purchase ("already purchased"); the launch check then sees the first.
    expect(grantWelcomePack(s, 'T-2', 'store', later(1000))).toBe(0);
    expect(reconcileWelcomePack(s, record('T-1'), 'store', later(2000)).granted).toBe(0);
    expect(reconcileWelcomePack(s, record('T-2'), 'store', later(3000)).granted).toBe(0);
    expect(gems(s)).toBe(180);
    expect(s.purchases.packs?.welcome?.tx).toBe('T-1');
  });

  it('after Erase progress (purchases kept, the gem ledger new) the pack’s gems and wagon come back once', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    s.inventory.items = [];
    delete s.inventory.decor.rescuewagon;
    expect(reconcileWelcomePack(s, record('T-1'), 'store', later(1000)).granted).toBe(180);
    expect(owns(s, 'rescuewagon')).toBe(true);
    expect(reconcileWelcomePack(s, record('T-1'), 'store', later(2000)).granted).toBe(0);
  });

  it('never grants without a transaction id', () => {
    const s = ready();
    expect(grantWelcomePack(s, '', 'store', NOW)).toBe(0);
    expect(ownsWelcomePack(s)).toBe(false);
    expect(gems(s)).toBe(0);
  });

  it('keeps the wagon where the player put it (a hidden wagon stays hidden on a later check)', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    s.sanctuary.hidden.rescuewagon = true;
    reconcileWelcomePack(s, record('T-1'), 'store', later(1000));
    expect(isShown(s, 'rescuewagon')).toBe(false);
  });

  it('the test store sells it once: a second purchase is the same transaction, and grants nothing more', async () => {
    const store = new TestStoreIapService();
    const s = ready();
    const a = await store.purchase('welcome_pack');
    const b = await store.purchase('welcome_pack');
    expect(a.ok && b.ok && a.transactionId === b.transactionId).toBe(true);
    if (!a.ok || !b.ok) return;
    expect(grantWelcomePack(s, a.transactionId, a.source, NOW) + grantWelcomePack(s, b.transactionId, b.source, NOW)).toBe(180);
    expect(await store.purchaseRecord()).toEqual(record(a.transactionId));
  });
});

describe('crash recovery, restore and refunds (reconciling with the store)', () => {
  it('grants a purchase the app never got to record (closed mid-purchase, a new install)', () => {
    const s = ready();
    const r = reconcileWelcomePack(s, record('T-9'), 'store', NOW);
    expect(r).toEqual({ granted: 180, revoked: false, missing: false });
    expect(ownsWelcomePack(s)).toBe(true);
    expect(reconcileWelcomePack(s, record('T-9'), 'store', later(5000))).toEqual({ granted: 0, revoked: false, missing: false });
    expect(gems(s)).toBe(180);
  });

  it('an unanswered store (offline, not set up) changes nothing, ever', async () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    const none = await new UnavailableIapService().purchaseRecord();
    expect(none).toBeNull();
    expect(reconcileWelcomePack(s, none, 'store', NOW, { revoke: true })).toEqual({ granted: 0, revoked: false, missing: false });
    expect(ownsWelcomePack(s)).toBe(true);
    expect(gems(s)).toBe(180);
  });

  it('by default nothing is taken back when the store’s record no longer shows the pack (a Restore elsewhere moves it)', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    expect(REVOKE_WHEN_MISSING).toBe(false);
    expect(reconcileWelcomePack(s, record(null), 'store', later(1000))).toEqual({ granted: 0, revoked: false, missing: true });
    expect(ownsWelcomePack(s)).toBe(true);
    expect(owns(s, 'rescuewagon')).toBe(true);
    expect(gems(s)).toBe(180);
  });

  it('with revocation on: the wagon and up to 180 unspent gems go back, once', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    expect(spendItem(s, 'buy:x', 'gem', 50, NOW)).toBe('ok');
    const r = reconcileWelcomePack(s, record(null), 'store', later(1000), { revoke: true });
    expect(r).toEqual({ granted: 0, revoked: true, missing: true });
    expect(ownsWelcomePack(s)).toBe(false);
    expect(owns(s, 'rescuewagon')).toBe(false);
    expect(gems(s)).toBe(0); // 130 left, all taken back; never below zero
    expect(s.purchases.packs?.revoked).toMatchObject({ tx: 'T-1', gems: 130 });
    // Asked again: nothing more happens.
    expect(reconcileWelcomePack(s, record(null), 'store', later(2000), { revoke: true })).toEqual({ granted: 0, revoked: false, missing: false });
    expect(gems(s)).toBe(0);
  });

  it('never takes more than the pack gave, even from a bigger balance', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    s.inventory.items.push({ id: 'iap:G-1', item: 'gem', delta: 160, at: NOW.toISOString(), source: 'store' });
    expect(revokeWelcomePack(s, later(1000))).toBe(180);
    expect(gems(s)).toBe(160);
  });

  it('the same purchase restored after being taken away (moved to another install and back) gives everything back', () => {
    const s = ready();
    grantWelcomePack(s, 'T-1', 'store', NOW);
    reconcileWelcomePack(s, record(null), 'store', later(1000), { revoke: true });
    expect(gems(s)).toBe(0);
    const r = reconcileWelcomePack(s, record('T-1'), 'store', later(2000));
    expect(r.granted).toBe(180);
    expect(gems(s)).toBe(180);
    expect(owns(s, 'rescuewagon')).toBe(true);
    expect(s.purchases.packs?.revoked).toBeUndefined();
    // And only once.
    expect(reconcileWelcomePack(s, record('T-1'), 'store', later(3000)).granted).toBe(0);
    expect(gems(s)).toBe(180);
  });

  it('test-store grants are never taken back by the real store, and the record survives a save round trip', () => {
    const s = ready();
    grantWelcomePack(s, 'test-pack-1', 'dev', NOW);
    expect(reconcileWelcomePack(s, record(null), 'store', NOW, { revoke: true })).toEqual({ granted: 0, revoked: false, missing: false });
    expect(ownsWelcomePack(s)).toBe(true);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(back.purchases.packs?.welcome).toEqual(s.purchases.packs?.welcome);
    revokeWelcomePack(s, later(1));
    const back2 = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(back2.purchases.packs?.revoked).toEqual(s.purchases.packs?.revoked);
    expect(back2.purchases.packs?.welcome).toBeUndefined();
  });

  it('an older save without any pack record loads with none', () => {
    const s = defaultSave(NOW) as unknown as Record<string, unknown>;
    const p = s.purchases as Record<string, unknown>;
    Reflect.deleteProperty(p, 'packs');
    Reflect.deleteProperty(s, 'offers');
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(ownsWelcomePack(back)).toBe(false);
    expect(back.purchases.packs).toEqual({});
    expect(back.offers).toEqual({});
  });
});

describe('when it is offered', () => {
  it('not during onboarding: only after lessons, an animal home and a visit home', () => {
    const s = defaultSave(NOW);
    expect(readyForWelcomeOffer(s)).toBe(false);
    s.onboarding.tutorialDone = true;
    s.journey.nextLevel = 8;
    expect(readyForWelcomeOffer(s)).toBe(false);
    s.inventory.pets = { cat: { unlockedAt: NOW.toISOString() } } as never;
    expect(readyForWelcomeOffer(s)).toBe(false);
    s.sanctuary.visits = 1;
    expect(readyForWelcomeOffer(s)).toBe(true);
    s.journey.nextLevel = 3;
    expect(readyForWelcomeOffer(s)).toBe(false);
  });

  it('the highlight shows at most every three days, three times in all, and never after "Not now" or once owned', () => {
    const s = ready();
    expect(mayHighlightWelcomePack(s, NOW)).toBe(true);
    noteWelcomeHighlight(s, NOW);
    expect(mayHighlightWelcomePack(s, later(OFFER_GAP_MS - 1))).toBe(false);
    expect(mayHighlightWelcomePack(s, later(OFFER_GAP_MS))).toBe(true);
    for (let i = 1; i < OFFER_MAX; i++) noteWelcomeHighlight(s, later(OFFER_GAP_MS * i));
    expect(mayHighlightWelcomePack(s, later(OFFER_GAP_MS * 10))).toBe(false);

    const d = ready();
    dismissWelcomeHighlight(d);
    expect(mayHighlightWelcomePack(d, later(OFFER_GAP_MS * 10))).toBe(false);

    const o = ready();
    grantWelcomePack(o, 'T-1', 'store', NOW);
    expect(mayHighlightWelcomePack(o, NOW)).toBe(false);
  });
});

describe('where it never appears', () => {
  it('only the Shop sells it: never a puzzle, a loss, the Paw Cup, the Journey, a sanctuary or a walk', () => {
    const root = join(__dirname, '../../src');
    const files: string[] = [];
    const walk = (d: string) => {
      for (const f of readdirSync(d, { withFileTypes: true })) {
        if (f.isDirectory()) walk(join(d, f.name));
        else if (/\.ts$/.test(f.name)) files.push(join(d, f.name));
      }
    };
    walk(root);
    // Code that offers it (comments aside): the Shop, and the services and rules behind it.
    const code = (f: string) => readFileSync(f, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    const offers = files.filter((f) => /welcomePack|welcome_pack|Welcome Rescue Pack|data-buy/.test(code(f))).map((f) => f.slice(root.length + 1));
    expect(offers.sort()).toEqual(['app/app.ts', 'config/services.ts', 'meta/catalogs/decor.ts', 'meta/welcomePack.ts', 'services/iap.ts', 'ui/screens/shop.ts']);
  });
});
