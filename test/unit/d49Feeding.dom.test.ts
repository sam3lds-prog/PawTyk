// @vitest-environment happy-dom
/**
 * D49 PR C, smart feeding and animal moments: a meal plays in full when it means something (a first meal, a first
 * taste of a favorite, a new friendship level, or always with Settings → Meals → Full) and quickly otherwise; a feast
 * is one short scene; and now and then an animal does something small on its own, only while nothing else happens,
 * at most a few times a visit, with New the first time a moment is seen.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { shopScreen } from '../../src/ui/screens/shop';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { grant } from '../../src/meta/ledger';
import { buyFood, feedAnimal, mealStyle, serveFeast } from '../../src/meta/feeding';
import { grantItem } from '../../src/meta/items';
import { MOMENTS, noteMoment, pickMoment, type MomentCast } from '../../src/meta/moments';
import { MOMENT_FIRST_MS, MOMENT_GAP_MS, MOMENT_MAX, MOMENT_RETRY_MS, sceneMoments } from '../../src/ui/components/animalMoments';
import { createSceneDirector } from '../../src/ui/components/sceneDirector';
import { FEED_MS, QUICK_FEED_MS, QUICK_STILL_MS, playFeeding } from '../../src/ui/components/feeding';
import { startTrick } from '../../src/ui/components/trickPlay';
import { MOMENT_CLIPS } from '../../src/three/clips';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mountApp(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, shop: shopScreen });
  app.router = router;
  return router;
}

describe('smart feeding: which meals play in full', () => {
  it('full for a first meal, a first taste of a favorite, a new level, or with Meals → Full; quick otherwise', () => {
    const base = { firstMeal: false, firstTaste: false, favorite: false, levelUp: false };
    expect(mealStyle('smart', base)).toBe('quick');
    expect(mealStyle('smart', { ...base, firstMeal: true })).toBe('full');
    expect(mealStyle('smart', { ...base, firstTaste: true, favorite: true })).toBe('full');
    // A first taste of something it doesn't especially love is an ordinary meal.
    expect(mealStyle('smart', { ...base, firstTaste: true })).toBe('quick');
    expect(mealStyle('smart', { ...base, levelUp: true })).toBe('full');
    expect(mealStyle('full', base)).toBe('full');
  });

  it('a meal notes what the animal tasted (first meal, first taste), and the save keeps it', () => {
    const s = defaultSave(NOW);
    grant(s, 'test:coins', 500, 'gift', NOW);
    s.inventory.companions.cotton = { unlockedAt: NOW.toISOString() };
    buyFood(s, 'hay', { offer: 'five', now: NOW });
    const a = feedAnimal(s, 'cotton', 'hay', NOW);
    expect(a.ok && a.firstMeal && a.firstTaste).toBe(true);
    const b = feedAnimal(s, 'cotton', 'hay', NOW);
    expect(b.ok && !b.firstMeal && !b.firstTaste).toBe(true);
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.sanctuary.tasted?.cotton).toEqual(['hay']);
    expect(back.settings.meals).toBe('smart');
    // A feast counts as a taste for everyone it fed.
    s.inventory.companions.truffle = { unlockedAt: NOW.toISOString() };
    s.world.growth.farm = 4;
    grantItem(s, 'test:feast', 'food', 1, 'gift', NOW, 'Feast', 'festivalfeast');
    expect(serveFeast(s, 'farm', 'festivalfeast', NOW).ok).toBe(true);
    expect(s.sanctuary.tasted?.truffle).toContain('festivalfeast');
  });
});

function scene(): void {
  document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300"><g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="240" data-gh="30" data-name="Cotton"><rect x="65" y="210" width="30" height="30"/></g></svg></figure>`;
}

describe('a quick meal', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('about a second: no camera, one bite, hearts, the card; the toy nibbles; everything cleared after', async () => {
    scene();
    const focus = vi.fn();
    const h = playFeeding({ svg: document.querySelector('svg')!, host: document.querySelector('figure')!, camera: { focus, reset: vi.fn() } as never, animal: 'cotton', name: 'Cotton', food: 'hay', bowl: 'classic', favorite: true, before: 8, after: 10, reducedMotion: false, style: 'quick' });
    const fig = document.querySelector<SVGGElement>('[data-friend="cotton"]')!;
    expect(fig.dataset.trick).toBe('nibble');
    expect(fig.classList.contains('is-trick-nibble')).toBe(true);
    expect(focus).not.toHaveBeenCalled();
    expect(document.querySelector('.sp-feed.is-quick')).not.toBeNull();
    vi.advanceTimersByTime(400);
    expect(document.querySelector('.sp-feed-food')?.getAttribute('data-bites')).toBe('3');
    vi.advanceTimersByTime(300);
    expect(document.querySelector('.sp-feed-hearts.is-on')).not.toBeNull();
    vi.advanceTimersByTime(QUICK_FEED_MS);
    expect(await h.done).toBe(true);
    expect(fig.dataset.trick).toBeUndefined();
    expect(document.querySelector('.sp-feed, .sp-feed-hearts')).toBeNull();
    // The quick clip is a real 3D clip of the same length.
    expect(MOMENT_CLIPS.nibble.ms).toBe(QUICK_FEED_MS);
    expect(QUICK_FEED_MS).toBeLessThanOrEqual(1200);
  });

  it('under reduced motion: still, and over quickly', async () => {
    scene();
    const h = playFeeding({ svg: document.querySelector('svg')!, host: document.querySelector('figure')!, camera: null, animal: 'cotton', name: 'Cotton', food: 'hay', bowl: 'classic', favorite: true, before: 8, after: 10, reducedMotion: true, style: 'quick' });
    expect(document.querySelector('[data-friend="cotton"]')!.classList.contains('is-trick-nibble')).toBe(false);
    vi.advanceTimersByTime(QUICK_STILL_MS + 10);
    expect(await h.done).toBe(true);
  });

  it('a meal that reaches a new level: the animal beams in a ring of hearts and the card names the level', () => {
    scene();
    playFeeding({ svg: document.querySelector('svg')!, host: document.querySelector('figure')!, camera: null, animal: 'cotton', name: 'Cotton', food: 'hay', bowl: 'classic', favorite: true, before: 4, after: 6, reducedMotion: false });
    expect(document.querySelector('.feed-bond.is-level .feed-bond__level')?.textContent).toBe('Friend!');
    vi.advanceTimersByTime(2700);
    expect(document.querySelector('[data-friend="cotton"]')!.classList.contains('is-bond-up')).toBe(true);
    expect(document.querySelector('.sp-feed-hearts.is-level')).not.toBeNull();
    vi.advanceTimersByTime(FEED_MS);
    expect(document.querySelector('.is-bond-up')).toBeNull();
  });
});

describe('meals on the Farm: full when it means something, quick after', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    app.replaceSave(defaultSave(NOW));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, decorTipSeen: true, sceneTapTipSeen: true });
    app.save.world.growth.farm = 4;
    for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    grant(app.save, 'test:coins', 500, 'gift', NOW);
    app.settings.toys3d = false;
    app.settings.meals = 'smart';
  });
  afterEach(() => {
    vi.useRealTimers();
    app.settings.meals = 'smart';
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
  });
  const feed = (food: string) => {
    (document.querySelector('[data-friend-card="cotton"]') as HTMLElement).click();
    (document.querySelector(`.friend-panel [data-feed="${food}"]`) as HTMLElement).click();
    return document.querySelector('.sanctuary__scene [data-friend="cotton"]')?.getAttribute('data-trick');
  };

  it('Cotton’s first meal is full; the same food again is quick; a new favorite is full again', () => {
    buyFood(app.save, 'hay', { offer: 'five', now: NOW });
    buyFood(app.save, 'oats', NOW);
    mountApp().go({ screen: 'region', id: 'farm' });
    expect(feed('hay')).toBe('feed');
    vi.advanceTimersByTime(FEED_MS + 1500);
    expect(feed('hay')).toBe('nibble');
    vi.advanceTimersByTime(QUICK_FEED_MS + 1500);
    // Oats are a sheep's favorite too, never tasted: full.
    expect(feed('oats')).toBe('feed');
  });

  it('Meals → Full: every meal plays in full', () => {
    app.settings.meals = 'full';
    app.save.sanctuary.tasted = { cotton: ['hay'] };
    buyFood(app.save, 'hay', NOW);
    mountApp().go({ screen: 'region', id: 'farm' });
    expect(feed('hay')).toBe('feed');
  });
});

describe('animal moments: which one, and who', () => {
  const cast: MomentCast[] = [
    { id: 'cotton', name: 'Cotton', temper: 'sleepy', x: 80, y: 240 },
    { id: 'truffle', name: 'Truffle', temper: 'playful', x: 200, y: 230 },
    { id: 'juniper', name: 'Juniper', temper: 'shy', x: 300, y: 250 },
  ];
  const r0 = () => 0;

  it('six to eight curated moments, each an existing trick or emote', async () => {
    const { TRICK_BY_ID } = await import('../../src/meta/catalogs/tricks');
    expect(MOMENTS.length).toBeGreaterThanOrEqual(6);
    expect(MOMENTS.length).toBeLessThanOrEqual(8);
    for (const m of MOMENTS) {
      expect(TRICK_BY_ID[m.trick], m.id).toBeDefined();
      if (m.answer) expect(TRICK_BY_ID[m.answer], m.id).toBeDefined();
    }
  });

  it('unseen moments first, in order; the preferred temperament does it; a two-animal one needs two', () => {
    const first = pickMoment(cast, { seen: new Set(), rand: r0 })!;
    expect(first.moment.id).toBe(MOMENTS[0].id);
    // The butterfly is for a shy or gentle one: Juniper.
    expect(first.who.id).toBe('juniper');
    const doze = pickMoment(cast, { seen: new Set(MOMENTS.slice(0, 2).map((m) => m.id)), rand: r0 })!;
    expect(doze.moment.id).toBe('doze');
    expect(doze.who.id).toBe('cotton');
    const hello = pickMoment(cast, { seen: new Set(['butterfly', 'sneeze', 'doze']), rand: r0 })!;
    expect(hello.moment.id).toBe('hello');
    expect(hello.with).toBeDefined();
    expect(hello.with!.id).not.toBe(hello.who.id);
    // Alone, nobody says hello to anyone.
    expect(pickMoment(cast.slice(0, 1), { seen: new Set(['butterfly', 'sneeze', 'doze']), rand: r0 })!.moment.id).not.toBe('hello');
  });

  it('once all are seen: never the same moment, or the same animal, twice in a row', () => {
    const all = new Set(MOMENTS.map((m) => m.id));
    for (let i = 0; i < 20; i++) {
      const rand = () => ((i * 7919) % 97) / 97;
      const p = pickMoment(cast, { seen: all, last: { moment: 'sneeze', who: 'truffle' }, rand })!;
      expect(p.moment.id).not.toBe('sneeze');
      expect(p.who.id).not.toBe('truffle');
    }
  });

  it('the first time is noted once (a local date), and kept in the save', () => {
    const s = defaultSave(NOW);
    expect(noteMoment(s, 'sneeze', NOW)).toBe(true);
    expect(noteMoment(s, 'sneeze', NOW)).toBe(false);
    expect(normalizeSave(JSON.parse(JSON.stringify(s))).sanctuary.moments).toEqual({ sneeze: '2026-11-11' });
  });
});

describe('animal moments in a scene', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    app.replaceSave(defaultSave(NOW));
    app.settings.reducedMotion = 'full';
    document.body.innerHTML = `<p data-chat><span>Cotton is grazing.</span></p><figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
      <g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="240"></g>
      <g class="sanctuary__pet sanctuary__friend" data-friend="truffle" data-gx="200" data-gy="230"></g>
      <g class="sanctuary__pet sanctuary__friend" data-friend="nemo" data-kit="fish" data-gx="300" data-gy="260"></g></svg></figure>`;
  });
  afterEach(() => {
    app.settings.reducedMotion = 'system';
    vi.useRealTimers();
  });
  const mk = (o: { busy?: () => boolean } = {}) => {
    const director = createSceneDirector(() => {});
    const m = sceneMoments({ svg: () => document.querySelector('svg'), chat: () => document.querySelector('[data-chat]'), director, reducedMotion: () => app.reducedMotion, busy: o.busy ?? (() => false), rand: () => 0 });
    return { m, director };
  };
  const tricked = () => [...document.querySelectorAll<HTMLElement>('[data-trick]')].map((g) => `${g.dataset.friend}:${g.dataset.trick}`);

  it('none at first; one after the scene has been calm a while, with its line (New the first time); then the small talk back', () => {
    const { m } = mk();
    vi.advanceTimersByTime(MOMENT_FIRST_MS - 100);
    expect(tricked()).toEqual([]);
    vi.advanceTimersByTime(200);
    expect(tricked()).toHaveLength(1);
    // A fish sits these out.
    expect(tricked()[0]).not.toMatch(/^nemo/);
    expect(document.querySelector('[data-chat] .moment-new')?.textContent).toBe('New');
    expect(document.querySelector('[data-chat] span')?.textContent).not.toBe('Cotton is grazing.');
    expect(Object.keys(app.save.sanctuary.moments ?? {})).toHaveLength(1);
    vi.advanceTimersByTime(4000);
    expect(document.querySelector('[data-chat] span')?.textContent).toBe('Cotton is grazing.');
    expect(document.querySelector('.moment-new')).toBeNull();
    m.dispose();
  });

  it('occasional: a long gap, and at most a few a visit', () => {
    const { m } = mk();
    vi.advanceTimersByTime(MOMENT_FIRST_MS + 10);
    expect(m.played).toBe(1);
    vi.advanceTimersByTime(MOMENT_GAP_MS[0] - 100);
    expect(m.played).toBe(1);
    vi.advanceTimersByTime(MOMENT_GAP_MS[1] * (MOMENT_MAX + 3));
    expect(m.played).toBe(MOMENT_MAX);
    m.dispose();
  });

  it('never while something else is going on, the app is hidden, or motion is reduced; it waits and tries again', () => {
    let busy = true;
    const { m } = mk({ busy: () => busy });
    vi.advanceTimersByTime(MOMENT_FIRST_MS + 10);
    expect(m.played).toBe(0);
    busy = false;
    app.settings.reducedMotion = 'reduce';
    vi.advanceTimersByTime(MOMENT_RETRY_MS + 10);
    expect(m.played).toBe(0);
    app.settings.reducedMotion = 'full';
    vi.advanceTimersByTime(MOMENT_RETRY_MS + 10);
    expect(m.played).toBe(1);
    m.dispose();
  });

  it('anything the player starts ends it at once (the director), and its line goes', () => {
    const { m, director } = mk();
    director.register('tour', { cancel: () => {}, active: () => false });
    expect(m.playNow()).not.toBeNull();
    expect(m.active).toBe(true);
    expect(director.owner).toBe('moment');
    director.claim('tour');
    expect(m.active).toBe(false);
    expect(tricked()).toEqual([]);
    expect(document.querySelector('[data-chat] span')?.textContent).toBe('Cotton is grazing.');
    m.dispose();
  });

  it('a trick that ends never clears what has since taken the figure (a parade’s dance)', () => {
    const svg = document.querySelector('svg')!;
    const fig = svg.querySelector<SVGGElement>('[data-friend="cotton"]')!;
    const h = startTrick(svg, fig, 'sneeze', false)!;
    fig.dataset.trick = 'dance:newcomer:boogie';
    h.stop();
    expect(fig.dataset.trick).toBe('dance:newcomer:boogie');
  });
});
