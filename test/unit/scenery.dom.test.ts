// @vitest-environment happy-dom
/**
 * D44 PR G: the five hand-made homes, dressed up. Each has depth layers for the camera, sunlight by day and lit
 * windows or lamps by evening, a landmark to tap (doors open, a critter peeks out), a party spot whose lights come on
 * when the home celebrates, and ambient life the director plays; the endless world's places keep their own look.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { regionScene, regionThumb } from '../../src/ui/art/regions';
import { HOME_SCENERY } from '../../src/ui/art/homeScenery';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave } from '../../src/services/storage';
import { LANDMARK_OPEN_MS } from '../../src/ui/components/landmarks';
import { SceneCamera } from '../../src/ui/components/camera';

const HOMES = ['farm', 'outback', 'savanna', 'arctic', 'amazon'] as const;
const LANDMARKS = { farm: 'barn', outback: 'burrow', savanna: 'lookout', arctic: 'den', amazon: 'tree' };

function svgOf(markup: string): SVGSVGElement {
  document.body.innerHTML = `<figure class="sanctuary__scene"><svg viewBox="0 0 360 300">${markup}</svg></figure>`;
  return document.querySelector('svg')!;
}
const residents = (h: string) => COMPANIONS.filter((c) => c.sanctuary === h).map((c) => c.id) as never[];

describe('the five homes, dressed up', () => {
  it('each has its landmark, a party spot, depth layers, sunlight by day and ambient life, once grown', () => {
    for (const h of HOMES) {
      const svg = svgOf(regionScene(h, { stage: 4, companions: residents(h), decor: [] }, `t-${h}`));
      const lm = svg.querySelector<SVGGElement>('[data-landmark]');
      expect(lm?.dataset.landmark, h).toBe(LANDMARKS[h]);
      expect(lm!.querySelector('.sp-peek'), h).not.toBeNull();
      expect(svg.querySelector('.sp-party .sp-festoon .sp-bulb'), h).not.toBeNull();
      expect(svg.querySelector('[data-depth="0.35"]'), h).not.toBeNull();
      expect(svg.querySelector('[data-depth="1.22"]'), h).not.toBeNull();
      expect(svg.querySelector('.sp-sunlight'), h).not.toBeNull();
      expect(svg.querySelector('.sp-lamps'), h).toBeNull();
      expect(svg.querySelectorAll('.sp-stage .sp-grass, .sp-stage .sp-birds, .sp-stage .sp-petals, .sp-stage .sp-blades, .sp-stage .sp-glow').length, h).toBeGreaterThanOrEqual(2);
      // The animals are never inside a depth layer: they stay where the 3D toys are.
      expect(svg.querySelector('[data-depth] .sanctuary__pet'), h).toBeNull();
    }
  });

  it('the critter is hidden until the landmark opens, even without the screen’s styles (a world-map card)', () => {
    const svg = svgOf(regionThumb('farm', 4, 'thumb'));
    const peek = svg.querySelector<SVGGElement>('.sp-peek')!;
    expect(peek.getAttribute('transform')).toMatch(/^translate\(0 2\d\)$/);
    expect(svg.querySelector('.sp-bulb-halo')!.getAttribute('opacity')).toBe('0');
  });

  it('features arrive with their stage: no barn to open before the barn is built', () => {
    const early = svgOf(regionScene('farm', { stage: 1, companions: [], decor: [] }, 'a'));
    expect(early.querySelector('[data-landmark]')).toBeNull();
    expect(early.querySelector('.sp-party')).toBeNull();
    const grown = svgOf(regionScene('farm', { stage: 2, companions: [], decor: [] }, 'b'));
    expect(grown.querySelector('[data-landmark="barn"]')?.closest('.sp-stage')?.getAttribute('data-stage')).toBe('2');
  });

  it('evening: windows and lamps glow, the party lights are lit, and the sun has set', () => {
    for (const h of HOMES) {
      const svg = svgOf(regionScene(h, { stage: 4, companions: [], decor: [], evening: true }, `e-${h}`));
      expect(svg.querySelector('.sp-sunlight'), h).toBeNull();
      expect(svg.querySelector('.sp-party.is-lit'), h).not.toBeNull();
      if (HOME_SCENERY[h].lights.length) expect(svg.querySelectorAll('.sp-lamps circle').length, h).toBeGreaterThan(0);
    }
    // The barn's windows and hayloft, and the hen house.
    const farm = svgOf(regionScene('farm', { stage: 4, companions: [], decor: [], evening: true }, 'f'));
    expect(farm.querySelectorAll('.sp-lamps circle').length).toBe(8);
  });

  it('clip ids belong to the scene they are drawn in', () => {
    const a = regionScene('farm', { stage: 4, companions: [], decor: [] }, 'one');
    const b = regionScene('farm', { stage: 4, companions: [], decor: [] }, 'two');
    expect(a).toContain('id="one-lm"');
    expect(b).toContain('id="two-lm"');
    expect(b).not.toContain('one-lm');
  });

  it('the camera moves the depth layers when it comes in close, and puts them back', () => {
    const svg = svgOf(regionScene('farm', { stage: 4, companions: [], decor: [] }, 'cam'));
    const cam = new SceneCamera({ reducedMotion: () => false });
    cam.attach(document.querySelector('figure'), svg);
    cam.cut({ x: 180, y: 100, w: 180, h: 150 });
    expect(svg.querySelector('[data-depth="0.35"]')!.getAttribute('transform')).toMatch(/scale/);
    expect(svg.querySelector('[data-depth="1.22"]')!.getAttribute('transform')).toMatch(/scale/);
    cam.cut(cam.full);
    expect(svg.querySelector('[data-depth="0.35"]')!.hasAttribute('transform')).toBe(false);
    cam.dispose();
  });
});

describe('tapping the landmark', () => {
  const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
  beforeEach(() => {
    vi.useFakeTimers();
    localStorage.clear();
    app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
    app.save.world.growth.farm = 12;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  });
  afterEach(() => vi.useRealTimers());

  it('the barn doors open and a chick peeks out; the chat says so; it closes by itself and grants nothing', () => {
    document.body.innerHTML = '<div id="app"></div>';
    const router = new Router(document.getElementById('app')!);
    const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
    for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
    router.register({ ...reg, region: regionScreen });
    app.router = router;
    router.go({ screen: 'region', id: 'farm' });
    vi.advanceTimersByTime(3000);
    const before = JSON.stringify(app.save.inventory) + app.coins();
    const barn = document.querySelector<SVGGElement>('.sanctuary__scene [data-landmark="barn"]')!;
    expect(barn).not.toBeNull();
    barn.querySelector('.sp-door--l')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(barn.classList.contains('is-open')).toBe(true);
    expect(document.querySelector('[data-chat] span')?.textContent).toMatch(/chick peeks out/);
    // No trick tray: the barn isn't an animal.
    expect(document.querySelector('.trick-tray')).toBeNull();
    vi.advanceTimersByTime(LANDMARK_OPEN_MS + 10);
    expect(barn.classList.contains('is-open')).toBe(false);
    expect(JSON.stringify(app.save.inventory) + app.coins()).toBe(before);
  });
});
