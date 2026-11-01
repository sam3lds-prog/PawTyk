// @vitest-environment happy-dom
/**
 * The loop, once (D39 PR B): after the first puzzle has grown a home, the Journey hub (or the World, whichever comes
 * first) shows one small card — solve a new puzzle → this home grows → this animal comes home — and *Got it* retires
 * it everywhere. One tip at a time: the pantry card and the World's own tip wait their turn.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { journeyScreen } from '../../src/ui/screens/journey';
import { worldScreen } from '../../src/ui/screens/world';
import { defaultSave } from '../../src/services/storage';
import { loopHasStarted, shouldShowLoopCoach } from '../../src/ui/components/loopCoach';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mount(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['pets', 'shop', 'gallery', 'profile', 'region', 'sanctuary', 'game', 'challenges', 'welcome'] as const) reg[k] = blank;
  router.register({ ...reg, journey: journeyScreen, world: worldScreen });
  app.router = router;
}

const coach = () => document.querySelector<HTMLElement>('[data-loop-coach]');

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  app.active = null;
  mount();
});

/** Right after the guided first board: Cotton came home and the Farm grew once. */
function afterFirstBoard(): void {
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true });
  app.save.journey.nextLevel = 2;
  app.save.world.growth.farm = 1;
  app.save.inventory.companions.cotton = { unlockedAt: '2026-10-31T11:00:00.000Z' };
}

describe('the loop, once (D39 PR B)', () => {
  it('waits for the loop to have happened: nothing before the first board', () => {
    expect(loopHasStarted(app.save)).toBe(false);
    expect(shouldShowLoopCoach(app.save)).toBe(false);
    app.save.onboarding.tutorialDone = true;
    expect(shouldShowLoopCoach(app.save)).toBe(false);
    router.go({ screen: 'journey' });
    expect(coach()).toBeNull();
  });

  it("after the first board the hub names this player's own loop, below the Play button", () => {
    afterFirstBoard();
    router.go({ screen: 'journey' });
    const c = coach()!;
    expect(c).not.toBeNull();
    expect(c.textContent).toMatch(/Solve a new puzzle/);
    expect(c.textContent).toMatch(/The Farm grows/);
    expect(c.textContent).toMatch(/Truffle comes home/);
    expect(c.textContent).toMatch(/new places open on the map/);
    expect(c.querySelector('ol')!.getAttribute('aria-label')).toBe('Solve a new puzzle, then the Farm grows, then Truffle comes home.');
    // Play stays first: the hero (and its button) come before the card.
    const hero = document.querySelector('.hero')!;
    expect(hero.compareDocumentPosition(c) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // One tip at a time: the pantry card waits.
    expect(document.querySelector('[data-pantry-intro]')).toBeNull();
  });

  it('Got it retires it for good, and the pantry card gets its turn', () => {
    afterFirstBoard();
    router.go({ screen: 'journey' });
    coach()!.querySelector<HTMLButtonElement>('.btn[data-act="loop-ok"]')!.click();
    expect(coach()).toBeNull();
    expect(app.save.onboarding.loopTipSeen).toBe(true);
    router.reset({ screen: 'journey' });
    expect(coach()).toBeNull();
    expect(document.querySelector('[data-pantry-intro]')).not.toBeNull();
  });

  it('the World shows it instead of its own tip; dismissed there, the hub never shows it', () => {
    afterFirstBoard();
    router.go({ screen: 'world' });
    expect(coach()).not.toBeNull();
    expect(document.querySelector('.world-tip')).toBeNull();
    coach()!.querySelector<HTMLButtonElement>('.icon-btn[data-act="loop-ok"]')!.click();
    expect(coach()).toBeNull();
    // Next time on the World: its own one-line tip, then nothing.
    router.reset({ screen: 'world' });
    expect(document.querySelector('.world-tip')).not.toBeNull();
    router.reset({ screen: 'journey' });
    expect(coach()).toBeNull();
  });

  it('with nothing left to build it still explains, in general words', () => {
    afterFirstBoard();
    app.save.world.active = null;
    // Everything open is finished: the Farm and the Pet Garden full, nothing else open yet.
    app.save.world.growth.farm = 26;
    app.save.world.growth.harmony = 53;
    for (const id of ['truffle', 'buttercup', 'pepper', 'marigold', 'hazel', 'juniper', 'ember', 'maple']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    for (const p of ['biscuit', 'mochi', 'pip', 'nori', 'clover', 'peanut'] as const) app.save.inventory.pets[p] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    router.go({ screen: 'journey' });
    expect(coach()!.textContent).toMatch(/Your home grows/);
    expect(coach()!.textContent).toMatch(/Animals come home/);
  });
});
