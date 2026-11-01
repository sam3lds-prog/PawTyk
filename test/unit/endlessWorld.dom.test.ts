// @vitest-environment happy-dom
/**
 * The endless world on screen (D39 PR D): the World lists and pins its places (finished homes folded away once the list
 * is long), a place's own screen shows its animals and no decorations, the album and the friend card know who they are,
 * and the Journey path says which place a chapter opens.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { worldScreen } from '../../src/ui/screens/world';
import { regionScreen } from '../../src/ui/screens/region';
import { petsScreen } from '../../src/ui/screens/pets';
import { journeyScreen } from '../../src/ui/screens/journey';
import { defaultSave } from '../../src/services/storage';
import { SANCTUARIES } from '../../src/meta/catalogs/sanctuaries';
import { PETS } from '../../src/meta/catalogs/pets';
import { placeDef } from '../../src/meta/catalogs/places';
import { finishOpenHomes, skipToLevel } from '../../src/app/qaTools';
import { activeSanctuary } from '../../src/meta/world';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mount(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['shop', 'gallery', 'profile', 'sanctuary', 'game', 'challenges', 'welcome'] as const) reg[k] = blank;
  router.register({ ...reg, world: worldScreen, region: regionScreen, pets: petsScreen, journey: journeyScreen });
  app.router = router;
}

const at = '2026-10-31T12:00:00.000Z';
function finishBase(): void {
  for (const d of SANCTUARIES) {
    app.save.world.growth[d.id] = Math.max(d.stages[d.stages.length - 1]?.at ?? 0, d.arrivals[d.arrivals.length - 1].at);
    for (const a of d.arrivals) {
      if (PETS.some((p) => p.id === a.id)) app.save.inventory.pets[a.id as never] = { unlockedAt: at };
      else app.save.inventory.companions[a.id] = { unlockedAt: at };
    }
  }
}

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, worldTipSeen: true, loopTipSeen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.settings.reducedMotion = 'reduce';
  app.save.journey.nextLevel = 61;
  finishBase();
  app.save.world.growth.p1 = 4;
  app.save.inventory.companions['w1-0'] = { unlockedAt: at };
  mount();
});

describe('the endless world on screen (D39)', () => {
  it('the World builds the first place: a small pin, its card, the next place locked, and its name as the goal', () => {
    const p1 = placeDef(1);
    router.go({ screen: 'world' });
    expect(activeSanctuary(app.save)).toBe('p1');
    expect(document.querySelector('.world-focus h2')?.textContent).toBe(p1.name);
    const pin = document.querySelector<HTMLElement>('.world-pin[data-go="p1"]')!;
    expect(pin.classList.contains('is-place')).toBe(true);
    expect(pin.classList.contains('is-building')).toBe(true);
    expect(document.querySelector('.world-pin[data-go="p2"]')?.classList.contains('is-locked')).toBe(true);
    expect(document.querySelector('.world-card[data-go="p2"] .world-card__status')?.textContent).toMatch(/or as soon as every home is complete/);
    expect(document.querySelector('#sanct-title + .muted')?.textContent).toMatch(/7 open · 6 finished/);
    expect(document.querySelector('details.world-finished')).toBeNull();
  });

  it('a long world folds its finished homes away at the end of the list', () => {
    skipToLevel(app.save, 141); // places 1–4 open by level
    finishOpenHomes(app.save);
    router.go({ screen: 'world' });
    const fold = document.querySelector('details.world-finished')!;
    expect(fold).not.toBeNull();
    expect(fold.querySelectorAll('.world-card').length).toBeGreaterThanOrEqual(10);
    // What's being built is in the open list, above the fold.
    const building = document.querySelector('.world-list > li .world-card.is-building');
    expect(building).not.toBeNull();
    expect(fold.contains(building)).toBe(false);
  });

  it("a place's screen shows its animals and its look, and no decorations", () => {
    const p1 = placeDef(1);
    router.go({ screen: 'region', id: 'p1' });
    expect(document.querySelector('h1')?.textContent).toBe(p1.name);
    const cards = [...document.querySelectorAll<HTMLElement>('[data-friend-card]')].map((b) => b.dataset.friendCard);
    expect(cards).toEqual(p1.animals.map((a) => a.id));
    expect(document.querySelector('.sanctuary__scene [data-friend="w1-0"]')).not.toBeNull();
    expect(document.querySelector('#rdecor-title')).toBeNull();
    expect(document.querySelector('[data-act="shop"]')).toBeNull();
    // Its first friend's card: name, kind and coat.
    (document.querySelector('[data-friend-card="w1-0"]') as HTMLButtonElement).click();
    const sheet = document.querySelector('.pet-sheet')!;
    expect(sheet.textContent).toContain(p1.animals[0].name);
    expect(sheet.textContent).toContain(`${p1.animals[0].coat.name} coat`);
  });

  it('the album has a group for the place, with who is home and who is next', () => {
    router.go({ screen: 'pets' });
    const p1 = placeDef(1);
    const group = [...document.querySelectorAll('.album__group')].find((g) => g.getAttribute('aria-label') === p1.name)!;
    expect(group).toBeDefined();
    expect(group.textContent).toContain(p1.animals[0].name);
    expect(group.textContent).toContain(p1.animals[1].name); // coming home next: named
  });

  it("the Journey path's chapter card names the place its last level opens", () => {
    app.save.journey.nextLevel = 85;
    router.go({ screen: 'journey', view: 'path', chapter: 4 } as never);
    expect(document.querySelector('.chapter__place')?.textContent).toMatch(new RegExp(`Finish it and the ${placeDef(2).name} opens on the map`));
  });
});
