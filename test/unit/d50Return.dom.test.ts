// @vitest-environment happy-dom
/**
 * D50 PR C, a focused return and relevant shopping:
 *  - the Journey never offers today's Daily twice (a row above means the fold keeps only the week);
 *  - the friend row says what the next thing to do accomplishes, and only promises what today can do (a hello is a
 *    heart, a pat on the card another, each once a day); the friend card says when today's hello or pat gets there;
 *  - Featured ranks, within what the player can afford now: something they tried on and didn't buy, then the next
 *    piece of a set they started, then a piece the animals use, then price; each pick says why; gem and video-token
 *    things only when the player has enough of them now; the only browsing kept is the last few tries.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { journeyScreen } from '../../src/ui/screens/journey';
import { regionScreen } from '../../src/ui/screens/region';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave, normalizeSave, TRIED_MAX, type SaveV2 } from '../../src/services/storage';
import { grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { friendRowText, friendToGreet } from '../../src/meta/today';
import { featuredFor, noteTried, wasTried, type Currency } from '../../src/meta/featured';
import { DECOR, DECOR_BY_ID, decorHome } from '../../src/meta/catalogs/decor';
import { decorPrice } from '../../src/meta/sanctuary';
import { FOOD_BY_ID } from '../../src/meta/catalogs/foods';
import { TRICK_BY_ID, trickCurrency } from '../../src/meta/catalogs/tricks';
import { friendPanelMarkup } from '../../src/ui/components/feedPanel';
import { activityFor } from '../../src/ui/art/activities';
import { startGame } from '../../src/app/gameFlow';
import { dailyFor } from '../../src/game/modes';
import { EMPTY, type Species } from '../../src/engine/types';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
const all = (_c: Currency) => true;
const interactive = (id: string) => !!activityFor(id as never);

function farmSave(coins = 0): SaveV2 {
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true, seenLoopCoach: true, loopTipSeen: true, seenPantryIntro: true, usageAsked: true });
  s.journey.nextLevel = 14;
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  if (coins) grant(s, 'test:coins', coins, 'gift', NOW);
  return s;
}

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'challenges', 'sanctuary', 'world', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen, region: regionScreen, shop: shopScreen });
  app.router = router;
  return router;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  app.replaceSave(farmSave());
  app.settings.toys3d = false;
});
afterEach(() => {
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
  vi.useRealTimers();
});

describe('the Journey says the Daily once', () => {
  it('today’s Daily is a row above: the fold keeps the week, with a pointer up, and no second Daily card', () => {
    mount().reset({ screen: 'journey' });
    expect(document.querySelectorAll('.daily-card')).toHaveLength(1);
    expect(document.querySelector('.today [data-today="daily"]')).not.toBeNull();
    const fold = document.querySelector('[data-more-play]')!;
    expect(fold.querySelector('.daily-card')).toBeNull();
    expect(fold.querySelector('[data-daily-above]')?.textContent).toMatch(/Today’s is in Also today, above/);
    expect(fold.querySelector('.week-strip')).not.toBeNull();
    expect(fold.querySelector('summary')!.textContent).not.toMatch(/Daily/);
  });

  it('a Daily in progress is its Resume row; the fold doesn’t offer the Daily again either', () => {
    const router = mount();
    // Today's Daily, one animal placed, saved.
    startGame(dailyFor('2026-11-11', app.save.journey.nextLevel));
    const s = app.active!.session;
    outer: for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++)
        if (!s.givenMask[r][c] && s.cells[r][c] === EMPTY && s.puzzle.solution[r][c] !== EMPTY) {
          s.place(r, c, s.puzzle.solution[r][c] as Species);
          break outer;
        }
    app.saveActive();
    app.active = null;
    router.reset({ screen: 'journey' });
    const rows = [...document.querySelectorAll<HTMLElement>('.today .today-row')].map((r) => r.dataset.today);
    expect(rows).toContain('resume');
    expect(rows).not.toContain('daily');
    expect(document.querySelector('[data-more-play] .daily-card')).toBeNull();
    expect(document.querySelector('[data-more-play] [data-daily-above]')).not.toBeNull();
  });

  it('the Daily solved: no row above, so the fold has its card (solved, with tomorrow)', () => {
    app.save.daily.done['2026-11-11'] = { seconds: 90, mistakes: 0, hearts: 3, at: NOW.toISOString() } as never;
    mount().reset({ screen: 'journey' });
    expect(document.querySelectorAll('.daily-card')).toHaveLength(1);
    expect(document.querySelector('[data-more-play] .daily-card')?.textContent).toMatch(/Solved today/);
    expect(document.querySelector('[data-daily-above]')).toBeNull();
  });
});

describe('friendship, said accurately', () => {
  it('one heart: a hello does it; two: a hello and a pat, only if the pat is still to give today', () => {
    const s = farmSave();
    s.sanctuary.affection.truffle = 4;
    expect(friendToGreet(s, NOW)).toMatchObject({ animal: 'truffle', hearts: 1, needs: ['hello'], level: 'Friend' });
    s.sanctuary.affection.truffle = 3;
    expect(friendToGreet(s, NOW)).toMatchObject({ animal: 'truffle', hearts: 2, needs: ['hello', 'pat'], level: 'Friend' });
    // Patted already today: a hello alone can't get there, so it isn't promised.
    s.sanctuary.patted.truffle = '2026-11-11';
    expect(friendToGreet(s, NOW)).toBeNull();
  });

  it('the row: who, what to do, and what it brings', () => {
    const s = farmSave();
    s.sanctuary.affection.truffle = 4;
    expect(friendRowText(friendToGreet(s, NOW)!, 'Farm')).toEqual({ title: 'Say hello to Truffle', sub: 'One hello at the Farm and you’re friends: a warmer hello.' });
    s.sanctuary.affection.truffle = 13;
    expect(friendRowText(friendToGreet(s, NOW)!, 'Farm').sub).toBe('A hello at the Farm and a pat on Truffle’s card and you’re good friends: a beaming smile.');
  });

  it('the friend card says when today’s hello or pat is all it takes', () => {
    app.save.sanctuary.affection.truffle = 4;
    document.body.innerHTML = friendPanelMarkup('truffle', 'Truffle');
    expect(document.querySelector('.friend-panel__name small')?.textContent).toBe('1 heart to Friend: a warmer hello. A hello or a pat today gets you there.');
    app.save.sanctuary.affection.truffle = 1;
    document.body.innerHTML = friendPanelMarkup('truffle', 'Truffle');
    expect(document.querySelector('.friend-panel__name small')?.textContent).toBe('4 hearts to Friend: a warmer hello');
  });
});

describe('Featured, ranked by what it would do here', () => {
  const firstDecor = (s: SaveV2) => featuredFor(s, 'farm', all, { interactive }).find((p) => p.kind === 'decor')!;

  it('something tried on and not bought comes first among what the player can afford, and says so', () => {
    const s = farmSave(400);
    const before = firstDecor(s);
    const other = DECOR.find((d) => decorHome(d) === 'farm' && d.id !== before.id && decorPrice(d.id)?.currency === 'coins' && decorPrice(d.id)!.amount <= 400 && !d.set)!;
    noteTried(s, 'decor', other.id);
    const p = firstDecor(s);
    expect(p.id).toBe(other.id);
    expect(p.why).toBe('interest');
    expect(p.reason).toBe('You tried it on in your Farm');
    // Bought: it's no longer a pick.
    s.inventory.decor[other.id] = { ownedAt: NOW.toISOString() };
    expect(firstDecor(s).id).not.toBe(other.id);
  });

  it('a piece the animals use ranks over one that only stands, and the line names who will play with it', () => {
    const s = farmSave(400);
    const p = firstDecor(s);
    expect(interactive(p.id)).toBe(true);
    expect(p.why).toBe('interaction');
    expect(p.reason).toBe('Truffle and Cotton will play with it');
    // Without the activities' word, it falls back to price (and says so).
    const plain = featuredFor(s, 'farm', all).find((x) => x.kind === 'decor')!;
    expect(plain.reason).toBe('You have the coins for it now');
  });

  it('what the player can afford still comes first: a tried-on piece they can’t afford doesn’t lead', () => {
    const s = farmSave(100);
    const dear = DECOR.filter((d) => decorHome(d) === 'farm' && decorPrice(d.id)?.currency === 'coins' && decorPrice(d.id)!.amount > 100).sort((a, b) => decorPrice(b.id)!.amount - decorPrice(a.id)!.amount)[0];
    noteTried(s, 'decor', dear.id);
    const p = firstDecor(s);
    expect(p.afford).toBe(true);
    expect(p.id).not.toBe(dear.id);
  });

  it('never a gem or video-token thing the player can’t have now (special piece, trick or food)', () => {
    const s = farmSave(0);
    grantItem(s, 'test:gems', 'gem', 1, 'test', NOW);
    grantItem(s, 'test:tokens', 'vtoken', 1, 'gift', NOW);
    for (const p of featuredFor(s, 'farm', all, { interactive })) {
      const cur = p.kind === 'decor' ? decorPrice(p.id)!.currency : p.kind === 'trick' ? trickCurrency(TRICK_BY_ID[p.id]) : FOOD_BY_ID[p.id].coins ? 'coins' : FOOD_BY_ID[p.id].tokens ? 'vtoken' : 'gem';
      if (cur !== 'coins') expect(p.afford, `${p.kind}:${p.id}`).toBe(true);
    }
    // With enough, a special piece can be featured (and it's one the animals use, when there is one).
    grantItem(s, 'test:gems2', 'gem', 500, 'test', NOW);
    grantItem(s, 'test:tokens2', 'vtoken', 20, 'gift', NOW);
    const special = featuredFor(s, 'farm', all, { interactive }).find((p) => p.kind === 'decor' && p.why === 'special');
    expect(special).toBeTruthy();
    expect(special!.kind === 'decor' && (DECOR_BY_ID[special!.id as keyof typeof DECOR_BY_ID].gems || DECOR_BY_ID[special!.id as keyof typeof DECOR_BY_ID].tokens)).toBeTruthy();
  });

  it('a tried-on trick the player can’t afford yet never pushes out one they can (Codex review on #75)', () => {
    const s = farmSave(80);
    noteTried(s, 'trick', 'tailchase'); // 100 coins
    const t = featuredFor(s, 'farm', all, { interactive }).find((p) => p.kind === 'trick')!;
    expect(t.afford).toBe(true);
    expect(t.id).not.toBe('tailchase');
    // With nothing affordable, the tried one is what to work toward.
    const poor = farmSave(0);
    noteTried(poor, 'trick', 'tailchase');
    const p = featuredFor(poor, 'farm', all, { interactive }).find((x) => x.kind === 'trick')!;
    expect(p.id).toBe('tailchase');
    expect(p.reason).toBe('You tried it on with Truffle');
  });

  it('a trick tried on and not learned comes back, named for who tried it', () => {
    const s = farmSave(200);
    noteTried(s, 'trick', 'tailchase');
    const t = featuredFor(s, 'farm', all, { interactive }).find((p) => p.kind === 'trick')!;
    expect(t.id).toBe('tailchase');
    expect(t.reason).toBe('You tried it on with Truffle');
  });

  it('the same for the same save; the tries kept are the last few, newest first, nothing else', () => {
    const s = farmSave(300);
    expect(featuredFor(s, 'farm', all, { interactive })).toEqual(featuredFor(s, 'farm', all, { interactive }));
    for (const id of ['scarecrow', 'wheelbarrow', 'trough', 'flowerarch', 'applecart', 'bench', 'carousel', 'scarecrow']) noteTried(s, 'decor', id);
    expect(s.offers!.tried).toHaveLength(TRIED_MAX);
    expect(s.offers!.tried![0]).toBe('decor:scarecrow');
    expect(new Set(s.offers!.tried).size).toBe(TRIED_MAX);
    expect(wasTried(s, 'decor', 'wheelbarrow')).toBe(false);
    // Saved and loaded: kept as is; anything malformed dropped.
    const back = normalizeSave(JSON.parse(JSON.stringify({ ...s, offers: { ...s.offers, tried: [...s.offers!.tried!, 'decor:<x>', 7, 'nope'] } })), NOW);
    expect(back.offers?.tried).toEqual(s.offers!.tried);
    // An older save without it loads as before.
    expect(normalizeSave(JSON.parse(JSON.stringify(farmSave())), NOW).offers?.tried).toBeUndefined();
  });

  it('in the Shop: Try it in my Farm remembers the try; back in the Shop it leads Featured with its reason', async () => {
    app.replaceSave(farmSave(400));
    app.settings.reducedMotion = 'reduce';
    const router = mount();
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' });
    const lead = document.querySelector<HTMLElement>('.featured-card--lead')!;
    const leadId = lead.dataset.decor;
    // Try something that isn't already the lead.
    const pick = DECOR.find((d) => decorHome(d) === 'farm' && d.id !== leadId && decorPrice(d.id)?.currency === 'coins' && decorPrice(d.id)!.amount <= 400 && !d.slot)!;
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm', decor: pick.id });
    (document.querySelector('.decor-sheet [data-act="try"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(100);
    expect(app.save.offers?.tried?.[0]).toBe(`decor:${pick.id}`);
    router.go({ screen: 'shop', tab: 'decor', sanctuary: 'farm' });
    const now = document.querySelector<HTMLElement>('.featured-card--lead')!;
    expect(now.dataset.decor).toBe(pick.id);
    expect(now.textContent).toMatch(/You tried it on in your Farm/);
    app.settings.reducedMotion = 'system';
  });
});
