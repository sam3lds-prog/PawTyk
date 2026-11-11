// @vitest-environment happy-dom
/**
 * D48 PR E: four welcome celebrations. Which one an animal gets (decided once, from its id, never the same as the
 * one before), kept in the save and safe across builds; each plays its own tune, entrance, steps and finish, drawn
 * and in 3D; replays (under the scene, from the animal's card) play the same one and grant nothing; Skip and reduced
 * motion work as for the D44 parade; the three new tunes carry PawTyk's motif and sound like no other tune.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { CELEBRATIONS, assignCelebration, celebrationFor, celebrationOf, type CelebrationId } from '../../src/meta/celebrations';
import { CELEBRATION_CUE, startParade } from '../../src/ui/components/parade';
import { planDance } from '../../src/ui/components/dance';
import { DANCE_PRESETS, danceClip, danceId, parseDanceId, type DanceSpec } from '../../src/three/dance';
import { TURN_CHANNELS } from '../../src/three/clips';
import { CHANNELS, addPose, restPose } from '../../src/three/pose';
import { hasEffect } from '../../src/three/effects';
import { SCORES, cueMs, type CueId, type Score } from '../../src/audio/scores';
import { nowPlaying, stopMusic } from '../../src/services/music';
import type { SceneCamera, View } from '../../src/ui/components/camera';

const TAU = Math.PI * 2;
const near0 = (k: string, v: number) => ((TURN_CHANNELS as readonly string[]).includes(k) ? Math.abs((((v % TAU) + TAU + Math.PI) % TAU) - Math.PI) : Math.abs(v));
const NEW_CUES = ['hopalong', 'sparkle', 'circle'] as const;
const LONGEST = Math.max(...Object.values(CELEBRATION_CUE).map((c) => cueMs(SCORES[c]))) + 600;
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

function fakeCamera(): SceneCamera {
  const full: View = { x: 0, y: 0, w: 360, h: 300 };
  return { full, focus: vi.fn(async () => true), moveTo: vi.fn(async () => true), reset: vi.fn(async () => true), clearOffset: vi.fn(), setOffset: vi.fn() } as unknown as SceneCamera;
}

beforeEach(() => {
  vi.useFakeTimers();
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 10, 12)));
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

describe('which celebration an animal gets', () => {
  const arrivals = ['cotton', 'truffle', 'juniper', 'maple', 'pebble', 'dozer', 'zuri', 'marigold', 'biscuit', 'clover', 'hazel', 'sunny', 'olive', 'pip', 'rosie', 'otis'];

  it('decided once, from the animal, never the same as the welcome before it; all four come round', () => {
    const run = () => {
      const s = defaultSave(new Date(2026, 10, 10));
      return arrivals.map((a) => assignCelebration(s, a));
    };
    const got = run();
    expect(run()).toEqual(got);
    for (let i = 1; i < got.length; i++) expect(got[i], `${arrivals[i - 1]} → ${arrivals[i]}`).not.toBe(got[i - 1]);
    expect(new Set(got).size).toBe(4);
  });

  it('kept: a replay is the same celebration, and replays never move "the one before"', () => {
    const s = defaultSave(new Date(2026, 10, 10));
    const a = assignCelebration(s, 'cotton');
    const b = assignCelebration(s, 'truffle');
    expect(b).not.toBe(a);
    expect(assignCelebration(s, 'cotton')).toBe(a);
    expect(s.world.celebrations!.last).toBe(b);
    expect(celebrationFor(s, 'cotton')).toBe(a);
    expect(celebrationOf(s, 'juniper')).toBeNull();
    // Asking what it would be writes nothing.
    celebrationFor(s, 'juniper');
    expect(s.world.celebrations!.by.juniper).toBeUndefined();
  });

  it('saves round-trip; a save from before D48 has none and is fine; an id from a newer build is kept, not used', () => {
    const s = defaultSave(new Date(2026, 10, 10));
    expect(normalizeSave(JSON.parse(JSON.stringify(s))).world.celebrations).toBeUndefined();
    assignCelebration(s, 'cotton');
    const back = normalizeSave(JSON.parse(JSON.stringify(s)));
    expect(back.world.celebrations).toEqual(s.world.celebrations);
    const future = JSON.parse(JSON.stringify(s));
    future.world.celebrations.by.truffle = 'fireworks';
    const f = normalizeSave(future);
    expect(f.world.celebrations!.by.truffle).toBe('fireworks');
    expect(celebrationOf(f, 'truffle')).toBeNull();
    expect(CELEBRATIONS.map((c) => c.id)).toContain(celebrationFor(f, 'truffle'));
  });
});

describe('each dances its own way', () => {
  it('dance ids carry the celebration (the Boogie’s and group dances’ ids are as before)', () => {
    const base: DanceSpec = { role: 'newcomer', style: 'hop', variant: 3, side: 'R', bpm: 138, beats: 16 };
    expect(danceId(base)).toBe('dance:newcomer:hop:3:R:138:16');
    for (const p of DANCE_PRESETS) {
      const id = danceId({ ...base, preset: p });
      expect(id).toBe(`dance:newcomer:hop:3:R:138:16:${p}`);
      expect(parseDanceId(id)).toEqual({ ...base, preset: p });
    }
    expect(parseDanceId('dance:newcomer:hop:3:R:138:16:fireworks')).toBeNull();
    expect(parseDanceId('dance:group:sway:1:L:132:8')).toEqual({ role: 'group', style: 'sway', variant: 1, side: 'L', bpm: 132, beats: 8 });
  });

  it('steps and poses: everyone hops and leaps (Meadow Hop); a twirl and cheers (Sparkle); sway and lean in (Circle)', () => {
    const svg = scene();
    const plan = (preset?: (typeof DANCE_PRESETS)[number]) => planDance(svg, { bpm: 120, beats: 16, newcomer: 'truffle', preset }).map((d) => `${d.animal}:${d.spec.role}:${d.spec.style}:${d.spec.variant}`);
    expect(plan('meadowhop')).toEqual(['cotton:guest:hop:3', 'truffle:newcomer:hop:3', 'juniper:guest:hop:3']);
    expect(plan('sparkle')).toEqual(['cotton:guest:bob:0', 'truffle:newcomer:twirl:2', 'juniper:guest:bob:0']);
    expect(plan('circle')).toEqual(['cotton:guest:sway:1', 'truffle:newcomer:sway:1', 'juniper:guest:sway:1']);
    // The guests face the newcomer; the newcomer faces the middle.
    const sides = planDance(svg, { bpm: 120, beats: 16, newcomer: 'truffle', preset: 'circle' }).map((d) => d.spec.side);
    expect(sides).toEqual(['R', 'R', 'L']);
    // No newcomer in the scene: the plain group dance, no celebration in the ids.
    for (const d of planDance(svg, { bpm: 120, beats: 16, newcomer: 'nobody', preset: 'sparkle' })) expect(d.id).not.toMatch(/sparkle/);
  });

  it('3D: every celebration’s entrance and finish start and end at rest and stay in range, for every body and role', () => {
    for (const preset of DANCE_PRESETS)
      for (const role of ['newcomer', 'guest'] as const)
        for (const style of ['hop', 'twirl', 'bob', 'sway'] as const) {
          const clip = danceClip(danceId({ role, style, variant: preset === 'sparkle' ? 2 : 1, side: 'L', bpm: 124, beats: 16, preset }))!;
          expect(clip.ms).toBe(Math.round((16 * 60000) / 124));
          for (const body of ['sit', 'upright', 'big', 'tall', 'bird', 'seal'] as const) {
            const ctx = { body, dir: 1 as const, seed: 1 };
            for (const t of [0, 1]) for (const [k, v] of Object.entries(clip.frame(t, ctx).pose)) expect(near0(k, v as number), `${preset} ${role} ${k} ${t}`).toBeLessThan(0.03);
            for (let i = 0; i <= 96; i++) {
              const p = addPose(restPose(), clip.frame(i / 96, ctx).pose);
              for (const c of CHANNELS) expect(Number.isFinite(p[c])).toBe(true);
              expect(Math.abs(p.px)).toBeLessThan(1.25);
              expect(p.py, `${preset} ${role} ${body}`).toBeLessThan(1.3);
              expect(p.py).toBeGreaterThan(-0.15);
            }
          }
        }
  });

  it('3D: the entrances differ (three hops; a spring into a double twirl; a shy look round)', () => {
    const at = (preset: (typeof DANCE_PRESETS)[number] | undefined, t: number) => danceClip(danceId({ role: 'newcomer', style: 'sway', variant: 1, side: 'R', bpm: 120, beats: 16, ...(preset ? { preset } : {}) }))!.frame(t, { body: 'sit', dir: 1, seed: 1 }).pose;
    // In the entrance (the first quarter), the three new ones aren't the Boogie's leap.
    for (const p of DANCE_PRESETS) expect(JSON.stringify(at(p, 0.05)), p).not.toBe(JSON.stringify(at(undefined, 0.05)));
    expect(at('meadowhop', 0.03 * 4 * 0.12).py).toBeGreaterThan(0.1);
    expect(Math.abs(at('sparkle', 0.25 * 0.3).yaw ?? 0)).toBeGreaterThan(1);
    expect(Math.abs(at('circle', 0.25 * 0.2).headYaw ?? 0)).toBeGreaterThan(0.2);
    expect(hasEffect('perform:dance:newcomer')).toBe(true);
    expect(hasEffect('perform:dance:guest')).toBe(true);
  });
});

describe('the three new tunes', () => {
  const inKey = new Set([0, 2, 4, 5, 7, 9, 11]);
  const insts = (s: Score) => [...new Set(s.parts.map((p) => p.inst))].sort().join('+');
  const singles = (s: Score, from: number, to: number) =>
    s.parts
      .filter((p) => !['bass', 'tuba', 'pad', 'pluck', 'accordion', 'swoop'].includes(p.inst))
      .flatMap((p) => p.notes.filter((n) => n.b >= from && n.b < to && n.p.length === 1))
      .sort((a, b) => a.b - b.b)
      .map((n) => n.p[0] % 12);
  const hasMotif = (ns: number[]) => {
    const i = ns.indexOf(0);
    return i >= 0 && ns.slice(i).indexOf(4) > 0 && ns.slice(i + ns.slice(i).indexOf(4)).indexOf(7) > 0;
  };

  it('16 beats with the parade’s parts, in C major, each with its own band, as the welcome’s tune', () => {
    for (const id of NEW_CUES) {
      const s = SCORES[id];
      expect(s.beats).toBe(16);
      expect(s.sections).toEqual(SCORES.bounce.sections);
      for (const p of s.parts) for (const n of p.notes) for (const m of n.p) expect(inKey.has(m % 12), id).toBe(true);
      expect(cueMs(s)).toBeGreaterThan(6500);
      expect(cueMs(s)).toBeLessThan(9000);
    }
    const bands = ['bounce', ...NEW_CUES].map((id) => insts(SCORES[id as CueId]));
    expect(new Set(bands).size).toBe(4);
    expect(CELEBRATION_CUE).toEqual({ boogie: 'bounce', meadowhop: 'hopalong', sparkle: 'sparkle', circle: 'circle' });
  });

  it('each carries PawTyk’s motif (C, E, G) into its entrance and its finish', () => {
    for (const id of NEW_CUES) {
      expect(hasMotif(singles(SCORES[id], 0, 4)), `${id} entrance`).toBe(true);
      expect(hasMotif(singles(SCORES[id], 12, 16)), `${id} finish`).toBe(true);
    }
  });
});

describe('played', () => {
  let now = 0;
  beforeEach(() => {
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  const tick = async (ms: number) => {
    now += ms;
    await vi.advanceTimersByTimeAsync(ms);
  };

  for (const preset of ['meadowhop', 'sparkle', 'circle'] as CelebrationId[])
    it(`${preset}: its own tune and dance ids, its own finish, and everyone back at rest`, async () => {
      const svg = scene();
      const host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
      const p = startParade({ svg, host, camera: fakeCamera(), newcomer: 'truffle', reducedMotion: false, preset });
      await tick(500);
      expect(nowPlaying()?.id).toBe(CELEBRATION_CUE[preset]);
      expect(svg.querySelector('[data-friend="truffle"]')!.getAttribute('data-trick')).toMatch(new RegExp(`^dance:newcomer:.*:${preset}$`));
      expect(svg.querySelector('[data-friend="truffle"]')!.classList.contains(`is-dance-${preset}`)).toBe(true);
      if (preset === 'circle') expect(svg.querySelectorAll('.sp-dance-ring path').length).toBeGreaterThanOrEqual(10);
      // The finish lands two beats before the end.
      await tick(cueMs(SCORES[CELEBRATION_CUE[preset]]) - 600);
      expect(svg.querySelector(`.sp-dance-confetti--${preset}`)).not.toBeNull();
      await tick(1100);
      expect(await p.done).toBe('ended');
      expect(svg.querySelector('[data-trick], .is-dancing, .sp-dance-confetti, .sp-dance-ring')).toBeNull();
      expect(svg.querySelector(`.is-dance-${preset}`)).toBeNull();
    });

  it('Skip ends any of them at once; reduced motion keeps everyone still, the ring and finish still too', async () => {
    let svg = scene();
    let host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const p = startParade({ svg, host, camera: fakeCamera(), newcomer: 'truffle', reducedMotion: false, preset: 'sparkle' });
    await tick(1500);
    p.skip();
    expect(await p.done).toBe('skipped');
    expect(svg.querySelector('[data-trick], .is-dancing')).toBeNull();
    svg = scene();
    host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const q = startParade({ svg, host, camera: fakeCamera(), newcomer: 'truffle', reducedMotion: true, preset: 'circle' });
    await tick(0);
    expect(svg.querySelectorAll('.is-dance-still').length).toBe(3);
    expect(svg.querySelector('[class*="is-trick-dance"]')).toBeNull();
    expect(svg.querySelector('.sp-dance-ring.is-still')).not.toBeNull();
    await tick(cueMs(SCORES.circle) - 800);
    expect(svg.querySelector('.sp-dance-confetti--circle.is-still')).not.toBeNull();
    await tick(1500);
    expect(await q.done).toBe('ended');
  });
});

describe('on the Farm: Meet, Replay and the animal’s card', () => {
  const rest = () => {
    const w = { ...app.save.world, visited: {}, celebrations: undefined };
    return JSON.stringify({ ...app.save, world: w });
  };

  it('Meet plays the newcomer’s own celebration and settles it; Replay and the card replay the same; nothing is paid', async () => {
    app.settings.reducedMotion = 'reduce';
    const expected = celebrationFor(app.save, 'truffle');
    const router = mount();
    const before = rest();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(400);
    expect(nowPlaying()?.id).toBe(CELEBRATION_CUE[expected]);
    expect(celebrationOf(app.save, 'truffle')).toBe(expected);
    expect(app.save.world.celebrations!.last).toBe(expected);
    await vi.advanceTimersByTimeAsync(LONGEST);
    (document.querySelector('[data-act="parade-replay"]') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(10);
    expect(nowPlaying()?.id).toBe(CELEBRATION_CUE[expected]);
    (document.querySelector('.parade-skip') as HTMLElement).click();
    await vi.advanceTimersByTimeAsync(400);
    // The card: "Replay the welcome", named; it closes the card and plays it in the scene.
    (document.querySelector('[data-friend-card="truffle"]') as HTMLElement).click();
    const btn = document.querySelector<HTMLElement>('.pet-sheet [data-act="replay-welcome"]')!;
    expect(btn.textContent).toMatch(new RegExp(`Replay the welcome: ${CELEBRATIONS.find((c) => c.id === expected)!.name}`));
    btn.click();
    await vi.advanceTimersByTimeAsync(10);
    expect(document.querySelector('.pet-sheet')).toBeNull();
    expect(document.querySelector('.sanctuary__scene.is-parading')).not.toBeNull();
    expect(nowPlaying()?.id).toBe(CELEBRATION_CUE[expected]);
    await vi.advanceTimersByTimeAsync(LONGEST);
    expect(document.querySelector('[data-trick^="dance:"]')).toBeNull();
    expect(celebrationOf(app.save, 'truffle')).toBe(expected);
    // Coins, hearts, bonds, inventory: just as they were.
    const a = JSON.parse(rest());
    const b = JSON.parse(before);
    // (`usage` counts what the player opened: the card, here. Not a reward.)
    for (const k of Object.keys(b)) if (k !== 'usage') expect(JSON.stringify(a[k]), k).toBe(JSON.stringify(b[k]));
  });

  it('the next newcomer’s welcome is never the same as the last one, even when its own would have been', () => {
    const own = celebrationFor(defaultSave(new Date(2026, 10, 10)), 'cotton');
    app.save.world.celebrations = { last: own, by: {} };
    const got = assignCelebration(app.save, 'cotton');
    expect(got).not.toBe(own);
    expect(app.save.world.celebrations.last).toBe(got);
  });
});
