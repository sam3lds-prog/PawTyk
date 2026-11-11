// @vitest-environment happy-dom
/**
 * D45 PR B: first arrival and celebration pacing. Cotton's first visit to the Farm gets the Welcome Parade without a
 * second "came home" announcement; the first few arrivals (and the first in each home) get the full celebration and
 * later ones a shorter one, with the full parade on Replay; Settings can ask for always full or always short.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CELEBRATION_CUE } from '../../src/ui/components/parade';
import { celebrationFor } from '../../src/meta/celebrations';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { celebrationLength, FULL_CELEBRATIONS } from '../../src/meta/celebration';
import { cueMs, SCORES } from '../../src/audio/scores';
import { nowPlaying, stopMusic } from '../../src/services/music';
import { showSpotlight, SPOTLIGHT_HOLD_MS, SPOTLIGHT_SHORT_MS } from '../../src/ui/components/celebrate';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen });
  app.router = router;
  return router;
}
const home = (...ids: string[]) => {
  for (const id of ids) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
};
const parading = () => !!document.querySelector('.sanctuary__scene.is-parading');
const toasts = () => [...document.querySelectorAll('.toast')].map((t) => t.textContent ?? '').join('|');

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.save.world.growth.farm = 12;
});
afterEach(() => {
  stopMusic(0);
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
});

describe('how long a celebration runs', () => {
  it('smart: the first few animals get the full one, later ones the short one', () => {
    home('cotton');
    expect(celebrationLength(app.save, 'smart', 'cotton', 'farm')).toBe('full');
    home('truffle', 'juniper');
    expect(FULL_CELEBRATIONS).toBe(3);
    expect(celebrationLength(app.save, 'smart', 'juniper', 'farm')).toBe('full');
    home('hazel');
    expect(celebrationLength(app.save, 'smart', 'hazel', 'farm')).toBe('short');
  });

  it('smart: the first animal to move into a new home is special again', () => {
    home('cotton', 'truffle', 'juniper', 'hazel');
    home('gumnut');
    expect(celebrationLength(app.save, 'smart', 'gumnut', 'outback')).toBe('full');
    home('skipper');
    expect(celebrationLength(app.save, 'smart', 'skipper', 'outback')).toBe('short');
  });

  it('the player can ask for always full or always short', () => {
    home('cotton', 'truffle', 'juniper', 'hazel');
    expect(celebrationLength(app.save, 'full', 'hazel', 'farm')).toBe('full');
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    home('cotton');
    expect(celebrationLength(app.save, 'short', 'cotton', 'farm')).toBe('short');
  });

  it('the setting is smart by default, kept when chosen, and a damaged value falls back', () => {
    expect(app.settings.celebrations).toBe('smart');
    const raw = JSON.parse(JSON.stringify(app.save));
    raw.settings.celebrations = 'short';
    expect(normalizeSave(raw).settings.celebrations).toBe('short');
    raw.settings.celebrations = 'loud';
    expect(normalizeSave(raw).settings.celebrations).toBe('smart');
    delete raw.settings.celebrations;
    expect(normalizeSave(raw).settings.celebrations).toBe('smart');
  });
});

describe('the brief spotlight', () => {
  it('is the same moment, held for less; a tap still skips it', () => {
    const done = vi.fn();
    showSpotlight(new Scope(), { animal: 'hazel' as never, where: 'farm', reducedMotion: false, short: true }, done);
    expect(document.querySelector('.spotlight.is-short')?.textContent).toMatch(/is coming home to the Farm/);
    expect(SPOTLIGHT_SHORT_MS).toBeLessThan(SPOTLIGHT_HOLD_MS - 1000);
    // Long enough to read a name.
    expect(SPOTLIGHT_SHORT_MS).toBeGreaterThanOrEqual(1500);
    vi.advanceTimersByTime(SPOTLIGHT_SHORT_MS + 300);
    expect(done).toHaveBeenCalledWith('ended');
    expect(document.querySelector('.spotlight')).toBeNull();
  });
});

describe('Cotton’s first visit, straight from the first arrival', () => {
  it('plays the Welcome Parade, without announcing the arrival a second time; then the welcome card (D49 PR A)', async () => {
    home('cotton');
    app.save.world.growth.farm = 1;
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton' as never], met: true });
    await vi.advanceTimersByTimeAsync(2200);
    expect(parading()).toBe(true);
    // The first animal ever: the full parade, to Barnyard Bounce.
    expect(nowPlaying()?.id).toBe('bounce');
    expect(document.querySelector('[data-friend="cotton"]')!.getAttribute('data-trick')).toMatch(/^dance:newcomer:/);
    // The arrival scene already said "Cotton is home!": no toast says it again.
    expect(toasts()).not.toMatch(/came home/);
    expect(document.querySelector('[data-welcome-card]')).toBeNull();
    await vi.advanceTimersByTimeAsync(cueMs(SCORES.bounce) + 800);
    expect(parading()).toBe(false);
    expect(document.querySelector('[data-welcome-card]')).not.toBeNull();
    // Coming back here later opens the Farm plainly: the welcome doesn't play twice.
    expect(app.router.route).toEqual({ screen: 'region', id: 'farm' });
  });

  it('can be skipped at once', async () => {
    home('cotton');
    app.save.world.growth.farm = 1;
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton' as never], met: true });
    await vi.advanceTimersByTimeAsync(2200);
    document.querySelector<HTMLElement>('[data-act="parade-skip"]')!.click();
    await vi.advanceTimersByTimeAsync(50);
    expect(parading()).toBe(false);
    expect(document.querySelector('[data-trick^="dance:"]')).toBeNull();
    expect(document.querySelector('[data-welcome-card]')).not.toBeNull();
  });

  it('D49 PR A: from the arrival’s "Give Cotton a welcome snack": the snack plays at once (free, once), the parade waits under the scene', async () => {
    home('cotton');
    app.save.world.growth.farm = 1;
    const { WELCOME_SNACK_ID } = await import('../../src/meta/welcomeSnack');
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['cotton' as never], met: true, snack: true });
    await vi.advanceTimersByTimeAsync(2200);
    // No parade by itself: the snack is the welcome, and the parade is offered.
    expect(parading()).toBe(false);
    expect(document.querySelector('[data-friend="cotton"]')!.getAttribute('data-trick')).toBe('feed');
    expect(document.querySelector<HTMLElement>('[data-act="parade-replay"]')?.textContent).toMatch(/Cotton/);
    // The free portion arrived and was eaten (the pantry is empty again), once.
    expect(app.save.inventory.items.filter((e) => e.id === WELCOME_SNACK_ID)).toHaveLength(1);
    expect(app.save.sanctuary.affection.cotton).toBeGreaterThan(0);
    await vi.advanceTimersByTimeAsync(4500);
    const card = document.querySelector('[data-welcome-card="fed"]')!;
    expect(card.textContent).toMatch(/Cotton loved the/);
    expect(card.querySelectorAll('.btn')).toHaveLength(1);
    expect(card.querySelector('[data-act="welcome-play"]')?.textContent).toMatch(/Continue to level/);
    // Back here later: plain, nothing replays, and no second free snack.
    expect(app.router.route).toEqual({ screen: 'region', id: 'farm' });
    const { welcomeSnack } = await import('../../src/meta/welcomeSnack');
    expect(welcomeSnack(app.save, 'cotton')).toBeNull();
  });

  it('a later Meet (not from the arrival scene) still announces who came home', async () => {
    home('cotton', 'truffle');
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle' as never] });
    await vi.advanceTimersByTimeAsync(300);
    expect(toasts()).toMatch(/Truffle the piglet came home to the Farm/);
  });
});

describe('the short welcome, and the full parade on Replay', () => {
  const meet = async (who: string) => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: [who as never] });
    await vi.advanceTimersByTimeAsync(2200);
  };

  it('the fourth animal home gets the short parade (the Jig); Replay offers and plays the full one', async () => {
    home('cotton', 'truffle', 'juniper', 'hazel');
    await meet('hazel');
    expect(parading()).toBe(true);
    expect(nowPlaying()?.id).toBe('jig');
    expect(cueMs(SCORES.jig)).toBeLessThan(cueMs(SCORES.bounce) * 0.6);
    await vi.advanceTimersByTimeAsync(cueMs(SCORES.jig) + 800);
    expect(parading()).toBe(false);
    const replay = document.querySelector<HTMLElement>('[data-act="parade-replay"]')!;
    expect(replay.hidden).toBe(false);
    expect(replay.textContent).toMatch(/Play the full parade/);
    replay.click();
    await vi.advanceTimersByTimeAsync(600);
    // The full one is Hazel's own welcome celebration (D48 PR E).
    const full = CELEBRATION_CUE[celebrationFor(app.save, 'hazel')];
    expect(nowPlaying()?.id).toBe(full);
    await vi.advanceTimersByTimeAsync(cueMs(SCORES[full]) + 800);
    expect(document.querySelector<HTMLElement>('[data-act="parade-replay"]')!.textContent).toMatch(/Replay the parade/);
  });

  it('always full: the fourth animal gets its full welcome; always short: even the second gets the Jig', async () => {
    home('cotton', 'truffle', 'juniper', 'hazel');
    app.settings.celebrations = 'full';
    await meet('hazel');
    expect(nowPlaying()?.id).toBe(CELEBRATION_CUE[celebrationFor(app.save, 'hazel')]);
    stopMusic(0);
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    app.save.world.growth.farm = 12;
    home('cotton', 'truffle');
    app.settings.celebrations = 'short';
    await meet('truffle');
    expect(nowPlaying()?.id).toBe('jig');
  });
});
