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
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave } from '../../src/services/storage';
import { SANCTUARIES, sanctuaryDef as sanctuaryDefOf } from '../../src/meta/catalogs/sanctuaries';
import { PETS } from '../../src/meta/catalogs/pets';
import { BIOMES, placeDef } from '../../src/meta/catalogs/places';
import { finishOpenHomes, skipToLevel } from '../../src/app/qaTools';
import { activeSanctuary } from '../../src/meta/world';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;

function mount(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['gallery', 'profile', 'sanctuary', 'game', 'challenges', 'welcome'] as const) reg[k] = blank;
  router.register({ ...reg, shop: shopScreen, world: worldScreen, region: regionScreen, pets: petsScreen, journey: journeyScreen });
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
    const fold = document.querySelector<HTMLDetailsElement>('details.world-finished')!;
    expect(fold).not.toBeNull();
    // Its cards (each with a thumbnail) are drawn when it opens, not before.
    expect(fold.querySelectorAll('.world-card').length).toBe(0);
    (fold.querySelector('summary') as HTMLElement).click();
    expect(fold.querySelectorAll('.world-card').length).toBeGreaterThanOrEqual(6);
    expect(fold.querySelectorAll('.world-card.is-complete').length).toBe(fold.querySelectorAll('.world-card').length);
    // What's being built is in the open list, above the fold.
    const building = document.querySelector('.world-list > li .world-card.is-building');
    expect(building).not.toBeNull();
    expect(fold.contains(building)).toBe(false);
  });

  it('a finished home with news stays in the list until it is visited, so every news pill lands on a card', () => {
    skipToLevel(app.save, 141);
    finishOpenHomes(app.save);
    const news = ['p1', 'p2', 'p3', 'farm', 'savanna'] as const;
    app.save.world.unseen = {};
    for (const id of news) app.save.world.unseen[id] = { animals: [], stage: null, opened: true, at };
    router.go({ screen: 'world' });
    const fold = document.querySelector('details.world-finished')!;
    for (const id of news) {
      const c = document.querySelector(`.world-card[data-go="${id}"]`);
      expect(c, id).not.toBeNull();
      expect(fold.contains(c)).toBe(false);
    }
    const more = document.querySelector<HTMLButtonElement>('[data-act="more-news"]')!;
    expect(more.textContent).toMatch(/News in 2 more homes/);
    more.click();
    expect(['farm', 'savanna', 'p1', 'p2', 'p3']).toContain((document.activeElement as HTMLElement).dataset.go);
  });

  it('a long album folds each finished home into one row that opens to its animals', () => {
    skipToLevel(app.save, 141);
    finishOpenHomes(app.save);
    router.go({ screen: 'pets' });
    const farm = document.querySelector<HTMLDetailsElement>('details.album__fold[data-fold="farm"]')!;
    expect(farm).not.toBeNull();
    expect(farm.querySelectorAll('.pet-card').length).toBe(0);
    (farm.querySelector('summary') as HTMLElement).click();
    expect(farm.querySelectorAll('.pet-card').length).toBe(sanctuaryDefOf('farm').arrivals.length);
    // The home being built is open as before.
    const building = activeSanctuary(app.save)!;
    expect(document.querySelector(`section.album__group[aria-label="${sanctuaryDefOf(building).name}"] .pet-card`)).not.toBeNull();
    // Favorites aren't folded.
    (document.querySelector('[data-filter="fav"]') as HTMLButtonElement).click();
    expect(document.querySelector('details.album__fold')).toBeNull();
    (document.querySelector('[data-filter="all"]') as HTMLButtonElement).click();
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
    // Its first friend's card: name, kind, its true fact, and where its kind lives in the wild (D39 PR E).
    (document.querySelector('[data-friend-card="w1-0"]') as HTMLButtonElement).click();
    const sheet = document.querySelector('.pet-sheet')!;
    const w = p1.animals[0];
    expect(sheet.textContent).toContain(w.name);
    expect(sheet.textContent).toContain(w.kind);
    if (w.coat.name) expect(sheet.textContent).toContain(`${w.coat.name} coat`);
    if (!w.base) {
      expect(sheet.textContent).toContain(w.bio);
      expect(sheet.textContent).toContain('In the wild');
    }
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

  it('the Shop, while a place is being built, opens on the hand-made home its landscape is drawn as (or the Pet Garden)', () => {
    const p1 = placeDef(1);
    const art = BIOMES[p1.biome].art;
    const home = SANCTUARIES.some((d) => d.id === art) ? art : 'harmony';
    router.go({ screen: 'shop', tab: 'decor' } as never);
    const chip = document.querySelector<HTMLElement>('.place-chip[aria-selected="true"]');
    expect(chip?.dataset.place).toBe(home);
    expect(document.querySelectorAll('.shop-section').length).toBeGreaterThan(0);
    expect(document.querySelectorAll('.shop-card[data-decor]').length).toBeGreaterThan(0);
    // A stale link to a place's decor lands there too.
    router.go({ screen: 'shop', sanctuary: 'p1' } as never);
    expect(document.querySelector<HTMLElement>('.place-chip[aria-selected="true"]')?.dataset.place).toBe(home);
  });
});
