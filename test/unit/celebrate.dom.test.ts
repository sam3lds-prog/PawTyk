// @vitest-environment happy-dom
/**
 * D44 PR E: celebrations. Level 1, the win sparkle (every win, about a second, never in the way); level 2, the
 * new-animal spotlight (skippable, then the results); level 3, the Welcome Parade on Meet (camera in on the newcomer,
 * everyone dancing, the whole scene back; Skip, Replay, Escape, leaving the app) and a home's group dance at a new
 * stage. None of them grants anything, so a skip or a replay can never pay twice; nothing is left mid-dance.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { defaultSave } from '../../src/services/storage';
import { cueMs, SCORES } from '../../src/audio/scores';
import { showSpotlight, SPOTLIGHT_HOLD_MS, WIN_SPARKLE_MS, winSparkle } from '../../src/ui/components/celebrate';
import { groupView, PARADE_CLOSE_ZOOM, startParade } from '../../src/ui/components/parade';
import type { SceneCamera, View } from '../../src/ui/components/camera';
import { nowPlaying, stopMusic } from '../../src/services/music';

// The longest of the four welcomes (D48 PR E: an animal's may be any of them).
const PARADE_MS = Math.max(...(['bounce', 'hopalong', 'sparkle', 'circle'] as const).map((c) => cueMs(SCORES[c]))) + 600;
const JIG_MS = cueMs(SCORES.jig) + 600;

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, sanctuary: sanctuaryScreen });
  app.router = router;
  return router;
}

function scene(): SVGSVGElement {
  document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
    <g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="230" data-gh="40"></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="truffle" data-gx="170" data-gy="240" data-gh="34"></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="juniper" data-gx="260" data-gy="236" data-gh="30"></g>
  </svg></figure>`;
  return document.querySelector('svg')!;
}

/** A stand-in camera that records what it was asked to do. */
function fakeCamera() {
  const calls: string[] = [];
  const full: View = { x: 0, y: 0, w: 360, h: 300 };
  const cam = {
    full,
    focus: vi.fn(async (_el: Element, zoom: number) => (calls.push(`focus:${zoom}`), true)),
    moveTo: vi.fn(async (v: View) => (calls.push(`move:${(360 / v.w).toFixed(2)}`), true)),
    reset: vi.fn(async () => (calls.push('reset'), true)),
    clearOffset: vi.fn(),
  };
  return { cam: cam as unknown as SceneCamera, calls };
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.save.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) app.save.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
});
afterEach(() => {
  stopMusic(0);
  app.settings.reducedMotion = 'system';
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe('level 1: the win sparkle', () => {
  function board() {
    document.body.innerHTML = `<div class="board-frame"><div class="board"></div></div>`;
    return { frame: document.querySelector<HTMLElement>('.board-frame')!, board: document.querySelector<HTMLElement>('.board')! };
  }

  it('sweeps light over the board and bursts stars over it, then cleans up after about a second', () => {
    const { frame, board: b } = board();
    winSparkle(new Scope(), b, frame, false);
    expect(b.querySelector('.win-sweep')).not.toBeNull();
    expect(frame.querySelectorAll('.win-burst__star').length).toBe(8);
    expect(WIN_SPARKLE_MS).toBeGreaterThanOrEqual(800);
    expect(WIN_SPARKLE_MS).toBeLessThanOrEqual(1300);
    vi.advanceTimersByTime(WIN_SPARKLE_MS + 10);
    expect(frame.querySelector('.win-sweep, .win-burst')).toBeNull();
  });

  it('reduced motion: a warm glow and still stars, no sweep', () => {
    const { frame, board: b } = board();
    winSparkle(new Scope(), b, frame, true);
    expect(b.querySelector('.win-sweep')).toBeNull();
    expect(b.classList.contains('is-win-glow')).toBe(true);
    expect(frame.querySelector('.win-burst.is-still')).not.toBeNull();
    vi.advanceTimersByTime(WIN_SPARKLE_MS + 10);
    expect(b.classList.contains('is-win-glow')).toBe(false);
  });

  it('leaving the screen ends it at once', () => {
    const { frame, board: b } = board();
    const s = new Scope();
    winSparkle(s, b, frame, false);
    s.dispose();
    expect(frame.querySelector('.win-sweep, .win-burst')).toBeNull();
  });
});

describe('level 2: the new-animal spotlight', () => {
  it('names the newcomer and its home, plays Welcome Home, and goes on by itself after a few seconds', () => {
    document.body.innerHTML = '';
    const done = vi.fn();
    showSpotlight(new Scope(), { animal: 'truffle', where: 'farm', reducedMotion: false }, done);
    const el = document.querySelector('.spotlight')!;
    expect(el.getAttribute('role')).toBe('dialog');
    expect(el.textContent).toMatch(/Truffle the piglet/);
    expect(el.textContent).toMatch(/coming home to the Farm/);
    expect(nowPlaying()?.id).toBe('welcome');
    expect(SPOTLIGHT_HOLD_MS).toBeGreaterThanOrEqual(2000);
    expect(SPOTLIGHT_HOLD_MS).toBeLessThanOrEqual(4000);
    vi.advanceTimersByTime(SPOTLIGHT_HOLD_MS + 300);
    expect(done).toHaveBeenCalledWith('ended');
    expect(done).toHaveBeenCalledTimes(1);
    expect(document.querySelector('.spotlight')).toBeNull();
  });

  it('a tap or Escape skips it; the screen going first calls nothing', () => {
    const done = vi.fn();
    showSpotlight(new Scope(), { animal: 'truffle', where: 'farm', reducedMotion: true }, done);
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(done).toHaveBeenCalledWith('skipped');
    // Once only, whatever else arrives.
    vi.advanceTimersByTime(SPOTLIGHT_HOLD_MS + 300);
    expect(done).toHaveBeenCalledTimes(1);

    const later = vi.fn();
    const s = new Scope();
    showSpotlight(s, { animal: 'truffle', where: 'farm', reducedMotion: false }, later);
    s.dispose();
    vi.advanceTimersByTime(SPOTLIGHT_HOLD_MS + 300);
    expect(later).not.toHaveBeenCalled();
    expect(document.querySelector('.spotlight')).toBeNull();
  });
});

describe('level 3: the parade', () => {
  let now = 0;
  beforeEach(() => {
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  const tick = async (ms: number) => {
    now += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  it('glides in on the newcomer, out to the dancing group, and back to the whole scene at the end', async () => {
    const svg = scene();
    const host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const { cam, calls } = fakeCamera();
    const onPart = vi.fn();
    const p = startParade({ svg, host, camera: cam, newcomer: 'truffle', reducedMotion: false, onPart });
    expect(host.classList.contains('is-parading')).toBe(true);
    expect(host.querySelector('.parade-skip')?.textContent).toBe('Skip');
    expect(calls[0]).toBe(`focus:${PARADE_CLOSE_ZOOM}`);
    // The glide lands, then the music and the newcomer's leap start together.
    expect(svg.querySelector('[data-trick]')).toBeNull();
    await tick(500);
    expect(nowPlaying()?.id).toBe('bounce');
    expect(svg.querySelector('[data-friend="truffle"]')!.getAttribute('data-trick')).toMatch(/^dance:newcomer:/);
    expect(svg.querySelector('[data-friend="cotton"]')!.getAttribute('data-trick')).toMatch(/^dance:guest:/);
    await tick(cueMs(SCORES.bounce) / 4 + 50);
    expect(calls[1]).toMatch(/^move:/);
    expect(onPart).toHaveBeenCalledWith('dance');
    await tick(cueMs(SCORES.bounce));
    expect(await p.done).toBe('ended');
    expect(calls[calls.length - 1]).toBe('reset');
    expect(host.classList.contains('is-parading')).toBe(false);
    expect(host.querySelector('.parade-skip')).toBeNull();
    expect(svg.querySelector('[data-trick]')).toBeNull();
    expect(svg.querySelector('.is-dancing')).toBeNull();
  });

  it('Skip puts everyone back at once, stops the music and gives the scene back', async () => {
    const svg = scene();
    const host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const { cam, calls } = fakeCamera();
    const p = startParade({ svg, host, camera: cam, newcomer: 'truffle', reducedMotion: false });
    await tick(1200);
    expect(svg.querySelectorAll('.is-dancing').length).toBe(3);
    const music = nowPlaying()!;
    p.skip();
    expect(await p.done).toBe('skipped');
    expect(svg.querySelector('[data-trick], .is-dancing')).toBeNull();
    expect(host.querySelector('.parade-skip')).toBeNull();
    expect(calls[calls.length - 1]).toBe('reset');
    await tick(400);
    expect(music.stopped).toBe(true);
    p.skip();
  });

  it('reduced motion: no camera move, still happy faces for the dance, still confetti', async () => {
    const svg = scene();
    const host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const { cam, calls } = fakeCamera();
    const p = startParade({ svg, host, camera: cam, newcomer: 'truffle', reducedMotion: true });
    await tick(0);
    expect(calls.filter((c) => c !== 'reset')).toEqual([]);
    expect(svg.querySelectorAll('.is-dance-still').length).toBe(3);
    expect(svg.querySelector('[class*="is-trick-dance"]')).toBeNull();
    await tick(cueMs(SCORES.bounce) - 600);
    expect(svg.querySelector('.sp-dance-confetti.is-still')).not.toBeNull();
    await tick(1000);
    expect(await p.done).toBe('ended');
    expect(svg.querySelector('.is-dancing, .sp-dance-confetti')).toBeNull();
  });

  it('frames the whole group when it fits closer, and never closer than a gentle zoom', () => {
    const svg = scene();
    const full: View = { x: 0, y: 0, w: 360, h: 300 };
    const figs = [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet')].slice(0, 2);
    const v = groupView(full, figs.map((fig) => ({ fig }) as never));
    expect(360 / v.w).toBeGreaterThan(1);
    expect(360 / v.w).toBeLessThanOrEqual(1.45 + 1e-6);
    for (const fig of figs) {
      const x = Number(fig.dataset.gx);
      expect(x).toBeGreaterThan(v.x);
      expect(x).toBeLessThan(v.x + v.w);
    }
    // Nobody to frame: the whole scene.
    expect(groupView(full, [])).toEqual(full);
  });
});

describe('the parade on Meet, and a group dance at a new stage', () => {
  // (D48 PR E: which welcome celebration an animal has had is kept, so a replay is the same one. It pays nothing.)
  const saveNow = () => JSON.stringify({ ...app.save, world: { ...app.save.world, visited: {}, celebrations: undefined } });

  it('Meet plays the parade; Replay plays it again and pays nothing either time', async () => {
    app.settings.reducedMotion = 'reduce';
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    const before = saveNow();
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('.sanctuary__scene.is-parading')).not.toBeNull();
    // Replay waits until it has played.
    expect(document.querySelector<HTMLElement>('[data-act="parade-replay"]')!.hidden).toBe(true);
    await vi.advanceTimersByTimeAsync(PARADE_MS);
    const replay = document.querySelector<HTMLElement>('[data-act="parade-replay"]')!;
    expect(replay.hidden).toBe(false);
    expect(replay.textContent).toMatch(/Replay the parade/);
    replay.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector('.sanctuary__scene.is-parading')).not.toBeNull();
    expect(document.querySelector('[data-friend="truffle"]')!.getAttribute('data-trick')).toMatch(/^dance:newcomer:/);
    await vi.advanceTimersByTimeAsync(PARADE_MS);
    expect(document.querySelector('[data-trick^="dance:"]')).toBeNull();
    // Coins, hearts, bonds, inventory: just as they were.
    expect(saveNow()).toBe(before);
  });

  it('while it plays, a tap on the scene waits (no trick tray), Skip ends it, Escape too', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(2500);
    expect(document.querySelector('.sanctuary__scene.is-parading')).not.toBeNull();
    (document.querySelector('.sanctuary__scene [data-friend="cotton"]') as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(document.querySelector('.trick-tray-slot:not([hidden])')).toBeNull();
    (document.querySelector('.parade-skip') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector('.sanctuary__scene.is-parading, [data-trick^="dance:"]')).toBeNull();
    // The next goal follows a skip as it follows the end.
    expect(document.querySelector('[data-welcome-card]')).not.toBeNull();
    (document.querySelector('[data-act="parade-replay"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(1500);
    expect(document.querySelector('.sanctuary__scene.is-parading')).not.toBeNull();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector('.sanctuary__scene.is-parading')).toBeNull();
  });

  it('leaving the app ends it: nobody dances on, unseen, and the music stops', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(2500);
    expect(document.querySelector('[data-trick^="dance:"]')).not.toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(400);
    expect(document.querySelector('[data-trick^="dance:"], .sanctuary__scene.is-parading')).toBeNull();
    expect(nowPlaying()).toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('a new stage (no newcomer to welcome): the whole home dances together to the Jig', async () => {
    app.settings.reducedMotion = 'reduce';
    const router = mount();
    router.go({ screen: 'region', id: 'farm', fresh: 2 });
    await vi.advanceTimersByTimeAsync(600);
    const dancers = [...document.querySelectorAll<HTMLElement>('[data-trick^="dance:"]')];
    expect(dancers.length).toBeGreaterThanOrEqual(2);
    for (const d of dancers) expect(d.dataset.trick).toMatch(/^dance:group:[a-z]+:\d:[LR]:132:8$/);
    await vi.advanceTimersByTimeAsync(JIG_MS);
    expect(document.querySelector('[data-trick^="dance:"]')).toBeNull();
    expect(document.querySelector<HTMLElement>('[data-act="parade-replay"]')?.textContent).toMatch(/Dance again/);
  });

  it('left before it starts (the lead-in): no parade plays unseen, and the next goal still follows', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    await vi.advanceTimersByTimeAsync(PARADE_MS);
    expect(document.querySelector('.sanctuary__scene.is-parading, [data-trick^="dance:"]')).toBeNull();
    expect(nowPlaying()).toBeNull();
    expect(document.querySelector('[data-welcome-card]')).not.toBeNull();
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('the spotlight sparkles twinkle one after another (a time delay per sparkle, D44 review)', () => {
    showSpotlight(new Scope(), { animal: 'truffle', where: 'farm', reducedMotion: false }, () => {});
    const idx = [...document.querySelectorAll<HTMLElement>('.spotlight__sparkles i')].map((i) => i.style.getPropertyValue('--i'));
    expect(idx).toEqual(['0', '1', '2', '3', '4', '5']);
    const css = readFileSync('src/ui/styles/celebrate.css', 'utf8');
    expect(css).toMatch(/spotlight-twinkle[^;]*var\(--i, 0\) \* 70ms/);
    expect(css).not.toMatch(/var\(--a\) \* [\d.]+ms/);
  });

  it('an ordinary visit: no parade, no dance', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(3000);
    expect(document.querySelector('.sanctuary__scene.is-parading, [data-trick^="dance:"]')).toBeNull();
  });
});
