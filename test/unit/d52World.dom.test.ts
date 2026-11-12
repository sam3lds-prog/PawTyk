// @vitest-environment happy-dom
/**
 * D52 PR B: the World says the six hand-made homes are only the beginning, and when the next new place opens; and
 * testers can browse any place of the endless world (1–9999) without touching the save, or visit one in a sandbox that
 * saves nothing and hands the player's own save back unchanged. None of it exists in a release build.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { worldScreen, worldAheadLine } from '../../src/ui/screens/world';
import { defaultSave, V2_KEY } from '../../src/services/storage';
import { SANCTUARIES } from '../../src/meta/catalogs/sanctuaries';
import { PETS } from '../../src/meta/catalogs/pets';
import { MAX_PLACE, PLACES_VERSION, placeDef } from '../../src/meta/catalogs/places';
import { clampPlace, placePreview } from '../../src/meta/placePreview';
import { PLACE_EXAMPLES, placeDetailsMarkup, showPlaceBrowser } from '../../src/ui/components/placeBrowser';
import { enterSandbox, inSandbox, leaveSandbox, sandboxSave } from '../../src/app/qaSandbox';
import { activeSanctuary, isComplete, isOpen, stageOf } from '../../src/meta/world';
import { grant } from '../../src/meta/ledger';
import { featureFlags } from '../../src/config/featureFlags';
import { openSheet } from '../../src/ui/components/sheet';
import { isHome } from '../../src/meta/animals';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
let router: Router;
function mount(): void {
  document.body.innerHTML = '<div id="app"></div>';
  router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['gallery', 'profile', 'sanctuary', 'game', 'challenges', 'welcome', 'shop', 'region', 'pets', 'journey'] as const) reg[k] = blank;
  router.register({ ...reg, world: worldScreen });
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
const stored = () => localStorage.getItem(V2_KEY);

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 11, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, worldTipSeen: true, loopTipSeen: true });
  app.settings.reducedMotion = 'reduce';
  app.persist();
  mount();
});
afterEach(() => {
  leaveSandbox({ quiet: true });
  (featureFlags as { qaTools: boolean }).qaTools = true;
});

describe('the World: the six homes are only the beginning (D52 PR B)', () => {
  it('before the six are open: more places are waiting; the count no longer says "of 6"', () => {
    app.save.journey.nextLevel = 5;
    router.go({ screen: 'world' });
    expect(document.querySelector('[data-world-ahead]')?.textContent).toBe('Your first six homes are just the beginning. More places are waiting to be discovered.');
    expect(document.querySelector('#sanct-title + .muted')?.textContent).toBe('2 open');
  });

  it('once the sixth opens: the first new place, at its real level, or sooner', () => {
    app.save.journey.nextLevel = 61;
    expect(SANCTUARIES.every((s) => isOpen(app.save, s.id))).toBe(true);
    expect(worldAheadLine(app.save)).toBe(`A new place opens after level ${placeDef(1).opensAfterLevel} — or sooner if you finish your current homes.`);
    expect(placeDef(1).opensAfterLevel).toBe(80);
  });

  it('in the endless world: the next actual unlock', () => {
    app.save.journey.nextLevel = 81;
    finishBase();
    expect(worldAheadLine(app.save)).toBe('The next new place opens after level 100 — or sooner if you finish your current homes.');
    router.go({ screen: 'world' });
    expect(document.querySelector('[data-world-ahead]')?.textContent).toMatch(/after level 100/);
  });
});

describe('Browse future places: read-only', () => {
  it('any place 1–9999 can be inspected: name, landscape, residents, stages, when it opens', () => {
    for (const k of [1, 12, 100, 9999]) {
      const p = placePreview(k);
      expect(p.def.index).toBe(k);
      expect(p.def.name.length).toBeGreaterThan(2);
      expect(p.landscape.length).toBeGreaterThan(2);
      expect(p.stages).toHaveLength(5);
      expect([3, 4]).toContain(p.residents.length);
      for (const r of p.residents) expect(r.fact.length).toBeGreaterThan(10);
      expect(p.opens).toBe(`Opens after level ${80 + 20 * (k - 1)}, or sooner, once every home before it is complete.`);
      // Stage 0 has nobody home; the last stage has everyone.
      expect(p.stages[0].home).toHaveLength(0);
      expect(p.stages[4].home).toHaveLength(p.residents.length);
    }
    expect([clampPlace(0), clampPlace(-3), clampPlace(10_000), clampPlace('12'), clampPlace('x')]).toEqual([1, 1, MAX_PLACE, 12, 1]);
    expect(PLACE_EXAMPLES).toEqual([1, 2, 12, 40, 100, 9999]);
  });

  it('the sheet draws one place at a time, and browsing never changes or writes the save', () => {
    const before = JSON.stringify(app.save);
    const was = stored();
    const scope = new Scope();
    showPlaceBrowser(scope);
    const sheet = document.querySelector('.qa-places-sheet')!;
    const name = () => sheet.querySelector('[data-place-name]')?.textContent;
    expect(name()).toBe(placeDef(1).name);
    (sheet.querySelector('[data-act="next"]') as HTMLElement).click();
    expect(name()).toBe(placeDef(2).name);
    (sheet.querySelector('[data-place-go="9999"]') as HTMLElement).click();
    expect(name()).toBe(placeDef(9999).name);
    const input = sheet.querySelector<HTMLInputElement>('[data-place-input]')!;
    input.value = '12';
    input.dispatchEvent(new Event('change'));
    expect(name()).toBe(placeDef(12).name);
    (sheet.querySelector('[data-place-stage="3"]') as HTMLElement).click();
    expect(sheet.querySelector('[data-stage-line]')?.textContent).toMatch(/^Stage 3: /);
    expect(sheet.querySelectorAll('.qa-place')).toHaveLength(1);
    expect(sheet.querySelectorAll('.qa-place__scene svg')).toHaveLength(1);
    (sheet.querySelector('[data-act="prev"]') as HTMLElement).click();
    expect(name()).toBe(placeDef(11).name);
    expect(JSON.stringify(app.save)).toBe(before);
    expect(stored()).toBe(was);
    scope.dispose();
  });

  it('a stage preview shows who is home by then', () => {
    const html = placeDetailsMarkup(40, 2);
    const p = placePreview(40);
    expect((html.match(/qa-place__resident is-home/g) ?? []).length).toBe(p.stages[2].home.length);
  });

  it('in a board, the sandbox is not offered', () => {
    const scope = new Scope();
    showPlaceBrowser(scope, { inGame: true });
    expect(document.querySelector('.qa-places-sheet [data-sandbox]')).toBeNull();
    scope.dispose();
  });
});

describe('a sandbox visit saves nothing and gives the save back unchanged', () => {
  it('the copy: the place open in the chosen state and being built; the real save untouched; no level loop', () => {
    const before = JSON.stringify(app.save);
    const t0 = performance.now();
    const empty = sandboxSave(app.save, 9999, 'empty');
    expect(performance.now() - t0).toBeLessThan(2000);
    expect(isOpen(empty, 'p9999')).toBe(true);
    expect(stageOf(empty, 'p9999')).toBe(0);
    expect(activeSanctuary(empty)).toBe('p9999');
    const growing = sandboxSave(app.save, 12, 'growing');
    expect(stageOf(growing, 'p12')).toBe(2);
    expect(placeDef(12).animals.filter((w) => growing.inventory.companions[w.id])).toHaveLength(placeDef(12).animals.filter((w) => w.at <= 8).length);
    const done = sandboxSave(app.save, 100, 'complete');
    expect(isComplete(done, 'p100')).toBe(true);
    expect(JSON.stringify(app.save)).toBe(before);
  });

  it('enter, play around, leave: nothing stored, the very same save back', () => {
    const real = app.save;
    const before = JSON.stringify(real);
    const was = stored();
    router.go({ screen: 'world' });
    expect(enterSandbox(12, 'growing')).toBe(true);
    expect(inSandbox()).toBe(true);
    expect(router.route).toEqual({ screen: 'region', id: 'p12' });
    expect(app.save).not.toBe(real);
    expect(document.querySelector('[data-qa-sandbox]')?.textContent).toMatch(/Sandbox preview · Place 12/);
    // Whatever happens in the sandbox is the copy's, and never written.
    grant(app.save, 'qa:test', 999, 'gift');
    app.save.journey.nextLevel = 5000;
    app.persist();
    app.saveActive();
    expect(stored()).toBe(was);
    // Leaving the home ends the preview: a tab lands where it was going, with the player's own save.
    router.go({ screen: 'journey' });
    expect(inSandbox()).toBe(false);
    expect(router.route?.screen).toBe('journey');
    expect(app.save).toBe(real);
    expect(JSON.stringify(app.save)).toBe(before);
    expect(app.holdWrites).toBe(false);
    expect(document.querySelector('[data-qa-sandbox]')).toBeNull();
    app.persist();
    expect(JSON.parse(stored()!)).toEqual(JSON.parse(before));
  });

  it('a board started in the sandbox lands on the World; the banner leaves too; a touched save comes back from its snapshot', () => {
    const before = JSON.stringify(app.save);
    const real = app.save;
    enterSandbox(40, 'empty');
    router.go({ screen: 'game' });
    expect(inSandbox()).toBe(false);
    expect(router.route?.screen).toBe('world');
    enterSandbox(40, 'complete');
    // Something reached the real object while the sandbox was in front.
    real.journey.nextLevel = 777;
    (document.querySelector('[data-act="leave-sandbox"]') as HTMLElement).click();
    expect(inSandbox()).toBe(false);
    expect(router.route?.screen).toBe('world');
    expect(JSON.stringify(app.save)).toBe(before);
  });

  it('review: a sheet that redraws the screen as it closes (Settings on the Journey) does not end the preview it opened', () => {
    router.go({ screen: 'world' });
    const settings = openSheet(router.scope!, { title: 'Settings', body: '', onClose: () => app.router.refresh() });
    showPlaceBrowser(settings.scope);
    (document.querySelector('.qa-places-sheet [data-sandbox="growing"]') as HTMLElement).click();
    expect(inSandbox()).toBe(true);
    expect(router.route).toEqual({ screen: 'region', id: 'p1' });
    expect(app.holdWrites).toBe(true);
    leaveSandbox({ quiet: true });
    // And from Settings itself, the sheet is closed before the preview starts.
    router.go({ screen: 'world' });
    const s2 = openSheet(router.scope!, { title: 'Settings', body: '', onClose: () => app.router.refresh() });
    showPlaceBrowser(s2.scope, { start: 12, beforeSandbox: () => s2.close() });
    (document.querySelector('.qa-places-sheet [data-sandbox="empty"]') as HTMLElement).click();
    expect(inSandbox()).toBe(true);
    expect(router.route).toEqual({ screen: 'region', id: 'p12' });
    expect(document.querySelector('.qa-places-sheet')).toBeNull();
  });

  it('review: residents follow the chosen state, not the player’s own progress in that place', () => {
    const p = placeDef(12);
    app.save.world.growth.p12 = 25;
    for (const w of p.animals) app.save.inventory.companions[w.id] = { unlockedAt: at };
    expect(p.animals.filter((w) => isHome(sandboxSave(app.save, 12, 'empty'), w.id))).toHaveLength(0);
    const grow = sandboxSave(app.save, 12, 'growing');
    expect(p.animals.filter((w) => isHome(grow, w.id)).map((w) => w.id)).toEqual(p.animals.filter((w) => w.at <= 8).map((w) => w.id));
    expect(p.animals.every((w) => isHome(sandboxSave(app.save, 12, 'complete'), w.id))).toBe(true);
    // The player's own save keeps them all.
    expect(p.animals.every((w) => isHome(app.save, w.id))).toBe(true);
  });

  it('a release build has neither the browser nor the sandbox', () => {
    (featureFlags as { qaTools: boolean }).qaTools = false;
    const scope = new Scope();
    showPlaceBrowser(scope);
    expect(document.querySelector('.qa-places-sheet')).toBeNull();
    expect(enterSandbox(1, 'empty')).toBe(false);
    expect(inSandbox()).toBe(false);
    scope.dispose();
  });

  it('the places themselves are unchanged (PLACES_VERSION 1)', () => {
    expect(PLACES_VERSION).toBe(1);
  });
});
