// @vitest-environment happy-dom
/**
 * D49 PR D, a focused return: the Journey shows one goal (Today at your Farm, with Play or Resume) and at most two
 * optional things (a board in progress, today's Daily, an animal close to its next friendship gift, news in another
 * home); everything else is one tap away in More to play; and an errand pays the moment it is done, once.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { journeyScreen } from '../../src/ui/screens/journey';
import { defaultSave, type SaveV2 } from '../../src/services/storage';
import { balance } from '../../src/meta/ledger';
import { autoClaimMissions, claimMission, missionStates, recordMissionEvent } from '../../src/meta/missions';
import { friendToGreet, todayItems, TODAY_MAX } from '../../src/meta/today';
import { afterSolve, claimedLine } from '../../src/app/events';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function save(): SaveV2 {
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true, seenLoopCoach: true, loopTipSeen: true, seenPantryIntro: true, usageAsked: true });
  s.journey.nextLevel = 14;
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  return s;
}

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'challenges', 'shop', 'sanctuary', 'world', 'region', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen });
  app.router = router;
  return router;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  app.replaceSave(save());
});
afterEach(() => vi.useRealTimers());

describe('what is worth doing today (meta/today.ts)', () => {
  it('at most two; a board in progress first, then the Daily, then a friend close to a gift, then news elsewhere', () => {
    const s = save();
    s.sanctuary.affection.cotton = 4; // one heart from a warmer hello
    expect(todayItems(s, { saved: [], dailyDone: false, heroHome: 'farm', now: NOW }).map((i) => i.kind)).toEqual(['daily', 'friend']);
    expect(todayItems(s, { saved: [{ kind: 'zen', size: 6, seed: 1, rule: 'solo' }], dailyDone: false, heroHome: 'farm', now: NOW }).map((i) => i.kind)).toEqual(['resume', 'daily']);
    expect(todayItems(s, { saved: [], dailyDone: true, heroHome: 'farm', now: NOW }).map((i) => i.kind)).toEqual(['friend']);
    for (const n of [0, 1, 2]) expect(todayItems(s, { saved: Array(n).fill({ kind: 'zen', size: 6, seed: 1, rule: 'solo' }), dailyDone: false, heroHome: 'farm', now: NOW }).length).toBeLessThanOrEqual(TODAY_MAX);
  });

  it('a friend only when close (two hearts at most) and not greeted today; the closest first', () => {
    const s = save();
    expect(friendToGreet(s, NOW)).toBeNull(); // five hearts away
    s.sanctuary.affection.cotton = 3;
    s.sanctuary.affection.truffle = 4;
    expect(friendToGreet(s, NOW)).toMatchObject({ animal: 'truffle', hearts: 1, unlock: 'A warmer hello' });
    s.sanctuary.greeted.truffle = '2026-11-11';
    expect(friendToGreet(s, NOW)).toMatchObject({ animal: 'cotton', hearts: 2 });
  });

  it('nothing to nudge when there is nothing worth doing: no chores, no warnings', () => {
    expect(todayItems(save(), { saved: [], dailyDone: true, heroHome: 'farm', now: NOW })).toEqual([]);
  });
});

describe('the Journey: one goal, at most two things, the rest folded', () => {
  it('Today at your Farm with Play first; Also today under it; More to play closed, saying what it holds', () => {
    app.save.sanctuary.affection.cotton = 4;
    mount().reset({ screen: 'journey' });
    expect(document.querySelector('.hero__eyebrow')?.textContent).toMatch(/Today at your Farm/);
    expect(document.querySelector('.continue__go')?.textContent).toBe('Play level 14');
    const rows = [...document.querySelectorAll<HTMLElement>('.today .today-row')];
    expect(rows.length).toBeLessThanOrEqual(2);
    expect(rows.map((r) => r.dataset.today)).toEqual(['daily', 'friend']);
    expect(rows[1].textContent).toMatch(/Cotton has a warmer hello to share/);
    expect(rows[1].textContent).not.toMatch(/miss|lose|before it|expires|hurry/i);
    // The hero comes before Today, Today before the fold.
    const order = [...document.querySelectorAll('.hero, .today, .more-play')].map((e) => e.className.split(' ')[0]);
    expect(order).toEqual(['hero', 'today', 'more-play']);
    const fold = document.querySelector<HTMLDetailsElement>('[data-more-play]')!;
    expect(fold.open).toBe(false);
    expect(fold.querySelector('summary')?.textContent).toMatch(/Daily · Zen Garden · Errands 0 of 3/);
    expect(fold.querySelector('.zen-card')).not.toBeNull();
    expect(fold.querySelector('[data-missions]')).not.toBeNull();
  });

  it('the Daily solved: not in Today; in the fold, solved, with a warm word about tomorrow', () => {
    app.save.daily.done['2026-11-11'] = { seconds: 90, mistakes: 0, hearts: 3, at: NOW.toISOString() } as never;
    mount().reset({ screen: 'journey' });
    expect(document.querySelector('.today [data-today="daily"]')).toBeNull();
    const card = document.querySelector('[data-more-play] .daily-card')!;
    expect(card.textContent).toMatch(/Solved today\. Tomorrow's: a \d×\d, Thursday\./);
    expect(document.querySelector('[data-more-play] summary')?.textContent).toMatch(/Daily solved/);
  });

  it('the fold remembers being open for the session', () => {
    const router = mount();
    router.reset({ screen: 'journey' });
    const fold = document.querySelector<HTMLDetailsElement>('[data-more-play]')!;
    fold.open = true;
    fold.dispatchEvent(new Event('toggle'));
    router.reset({ screen: 'journey' });
    expect(document.querySelector<HTMLDetailsElement>('[data-more-play]')!.open).toBe(true);
    const again = document.querySelector<HTMLDetailsElement>('[data-more-play]')!;
    again.open = false;
    again.dispatchEvent(new Event('toggle'));
  });
});

describe('an errand pays the moment it is done, once', () => {
  it('autoClaimMissions claims each finished errand once, by the same ledger ids as the Claim button', () => {
    const s = save();
    const before = balance(s);
    recordMissionEvent(s, { kind: 'solved', mode: 'level', size: 7, mistakes: 0, hints: 0 }, NOW);
    const got = autoClaimMissions(s, NOW);
    expect(got.map((c) => c.def.id)).toContain('solve1');
    const paid = got.reduce((n, c) => n + c.coins + c.overflowCoins, 0);
    expect(balance(s)).toBe(before + paid);
    // Again, or through the old Claim button: nothing more.
    expect(autoClaimMissions(s, NOW)).toEqual([]);
    for (const m of missionStates(s, NOW)) expect(claimMission(s, m.key, NOW)).toBe(0);
    expect(balance(s)).toBe(before + paid);
    expect(claimedLine(got)).toMatch(/^\+\d+ Paw Coins/);
  });

  it('a solve reports what its errands paid (the win sheet says it)', () => {
    const news = afterSolve({ kind: 'level', level: 14 }, 7, 0, 0);
    expect(news.claimed.length).toBeGreaterThan(0);
    expect(missionStates(app.save).find((m) => m.def.id === 'solve1')?.claimed).toBe(true);
  });
});
