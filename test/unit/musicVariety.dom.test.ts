// @vitest-environment happy-dom
/**
 * D45 PR D: the music and animation quality pass. Trick tunes differ in harmony and band; each kind of animal has a
 * rhythm of its own under its tricks and its parade entrance; the Welcome Parade's tune is the theme every home plays
 * in its own voicing; an optional ambient tune sits quietly under a visit; and the final pose gets a wide hero shot
 * on a lit stage. Loudness on a phone speaker is measured in a real browser by the browser tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  RHYTHM_FEELS,
  SCORES,
  THEME_HOMES,
  cueMs,
  leadLine,
  midi,
  rhythmFor,
  rhythmParts,
  themeVariation,
  withRhythm,
  type Score,
} from '../../src/audio/scores';
import { TRICKS } from '../../src/meta/catalogs/tricks';
import { FOODS } from '../../src/meta/catalogs/foods';
import { COMPANIONS } from '../../src/meta/catalogs/companions';
import { AMBIENT_PLAYS, AMBIENT_REST_MS, ambientPlaying, arrange, nowPlaying, playCue, setMusicEnabled, startAmbient, stopAmbient, stopMusic } from '../../src/services/music';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { groupView, heroView, startParade } from '../../src/ui/components/parade';
import { planDance } from '../../src/ui/components/dance';
import { sceneCloseUps } from '../../src/ui/components/closeup';
import { viewAt, type SceneCamera, type View } from '../../src/ui/components/camera';
import { rhythmOf } from '../../src/ui/components/tricks';

const tricks = TRICKS.map((t) => SCORES[`trick:${t.id}`]);
const inKey = new Set([0, 2, 4, 5, 7, 9, 11]);
const insts = (s: Score) => [...new Set(s.parts.map((p) => p.inst))].sort().join('+');
const onsets = (s: Score, from = 0) =>
  s.parts
    .slice(from)
    .flatMap((p) => p.notes.map((n) => `${p.inst}@${n.b}`))
    .sort()
    .join(' ');
const hide = (on: boolean) => Object.defineProperty(document, 'hidden', { configurable: true, get: () => on });

beforeEach(() => {
  vi.useFakeTimers();
  setMusicEnabled(true);
});
afterEach(() => {
  stopAmbient(0);
  stopMusic(0);
  hide(false);
  vi.useRealTimers();
});

describe('the trick tunes have their own colours', () => {
  it('no two share a band: every tune has its own set of instruments', () => {
    const sets = tricks.map(insts);
    expect(new Set(sets).size).toBe(tricks.length);
  });

  it('the newer voices are all in use: tuba, accordion, kalimba, glockenspiel', () => {
    const used = new Set(tricks.flatMap((s) => s.parts.map((p) => p.inst)));
    for (const i of ['tuba', 'accordion', 'kalimba', 'glock', 'marimba', 'brass', 'whistle', 'bell', 'pad', 'pluck']) expect(used.has(i as never), i).toBe(true);
  });

  it('the harmony moves: several tunes leave C, F and G for the key’s minor chords, and not every tune ends at home', () => {
    const lowNotes = (s: Score) => s.parts.filter((p) => ['bass', 'tuba', 'pad', 'pluck', 'accordion'].includes(p.inst)).flatMap((p) => p.notes.flatMap((n) => n.p.map((m) => m % 12)));
    // A in the harmony means A minor (or F with its third on top); D means D minor.
    const minor = tricks.filter((s) => {
      const roots = s.parts.filter((p) => p.inst === 'bass' || p.inst === 'tuba').flatMap((p) => p.notes.map((n) => n.p[0] % 12));
      const chords = s.parts.filter((p) => p.inst === 'pad' || p.inst === 'pluck').flatMap((p) => p.notes.map((n) => n.p[0] % 12));
      return roots.includes(9) || roots.includes(2) || (chords.includes(9) && lowNotes(s).includes(4) && !roots.includes(5));
    });
    expect(minor.length).toBeGreaterThanOrEqual(5);
    // "Oh!" ends on the fifth, like a question.
    const oh = SCORES['trick:surprised'];
    const last = oh.parts.filter((p) => p.inst === 'pluck').flatMap((p) => p.notes).pop()!;
    expect(last.p.map((m) => m % 12).sort((x, y) => x - y)).toEqual([2, 7, 11]);
    // Everything is still in the key, so any two can follow each other.
    for (const s of tricks) for (const p of s.parts) for (const n of p.notes) for (const m of n.p) expect(inKey.has(m % 12), s.id).toBe(true);
  });
});

describe('a rhythm for every kind of animal', () => {
  it('every kind in the game has one; a sheep and a pig do not share theirs', () => {
    const kinds = new Set<string>(['cat', 'dog', ...COMPANIONS.map((c) => c.animal), ...FOODS.flatMap((f) => (f.favorites === 'all' ? [] : f.favorites))]);
    expect(kinds.size).toBeGreaterThanOrEqual(20);
    for (const k of kinds) expect(RHYTHM_FEELS.includes(rhythmFor(k)), k).toBe(true);
    expect(rhythmFor('sheep')).toBe('lilt');
    expect(rhythmFor('pig')).toBe('oompah');
    expect(rhythmFor('cow')).toBe('plod');
    expect(rhythmFor('chicken')).toBe('peck');
    expect(rhythmFor('horse')).toBe('clipclop');
    // Someone new: the soft one.
    expect(rhythmFor('axolotl')).toBe('lilt');
    expect(rhythmFor(undefined)).toBe('lilt');
    expect(rhythmOf('cotton')).toBe('lilt');
    expect(rhythmOf('truffle')).toBe('oompah');
  });

  it('the seven rhythms are all different patterns, in key, and stay inside their beats', () => {
    const sig = RHYTHM_FEELS.map((f) =>
      rhythmParts(f, 0, 4)
        .flatMap((p) => p.notes.map((n) => `${p.inst}@${n.b}`))
        .sort()
        .join(' '),
    );
    expect(new Set(sig).size).toBe(RHYTHM_FEELS.length);
    for (const f of RHYTHM_FEELS)
      for (const p of rhythmParts(f, 1, 5)) {
        expect(p.notes.length, f).toBeGreaterThan(0);
        for (const n of p.notes) {
          expect(n.b, f).toBeGreaterThanOrEqual(1);
          expect(n.b, f).toBeLessThan(5);
          for (const m of n.p) expect(inKey.has(m % 12), f).toBe(true);
          expect(n.v, f).toBeLessThanOrEqual(0.5);
        }
      }
  });

  it('the same trick sounds different for a sheep and a pig, and is the same length for both', () => {
    const base = SCORES['trick:wave'];
    const sheep = withRhythm(base, 'lilt');
    const pig = withRhythm(base, 'oompah');
    expect(sheep.bpm).toBe(base.bpm);
    expect(pig.beats).toBe(base.beats);
    expect(cueMs(sheep)).toBe(cueMs(base));
    expect(onsets(sheep, base.parts.length)).not.toBe(onsets(pig, base.parts.length));
    expect(pig.parts.some((p) => p.inst === 'tuba')).toBe(true);
    // The tune itself is untouched (and the written score is never changed).
    expect(sheep.parts.slice(0, base.parts.length)).toEqual(base.parts);
    expect(SCORES['trick:wave'].parts.length).toBe(base.parts.length);
    expect(withRhythm(base, 'lilt')).toBe(sheep);
  });

  it('a trick played by an animal carries its rhythm; the parade carries the newcomer’s under its entrance only', () => {
    const pb = playCue('trick:hop', { rhythm: 'peck' })!;
    expect(pb.score.parts.length).toBeGreaterThan(SCORES['trick:hop'].parts.length);
    const p = arrange('bounce', { rhythm: 'oompah', rhythmSpan: [0, 4] })!;
    const added = p.parts.slice(SCORES.bounce.parts.length);
    expect(added.length).toBeGreaterThan(0);
    for (const part of added) for (const n of part.notes) expect(n.b).toBeLessThan(4);
  });
});

describe('the theme, and each home’s variation', () => {
  it('every home plays the same tune at the same tempo and length, so one dance fits them all', () => {
    for (const id of ['bounce', 'jig'] as const) {
      const farm = SCORES[id];
      for (const h of THEME_HOMES) {
        const v = themeVariation(farm, h);
        expect(v.bpm, h).toBe(farm.bpm);
        expect(v.beats, h).toBe(farm.beats);
        expect(v.sections, h).toEqual(farm.sections);
        expect(v.accents, h).toEqual(farm.accents);
        expect(leadLine(v), `${id} in ${h}`).toEqual(leadLine(farm));
        for (const p of v.parts) for (const n of p.notes) for (const m of n.p) expect(inKey.has(m % 12) && m <= midi('C7'), h).toBe(true);
      }
    }
    expect(leadLine(SCORES.bounce).length).toBeGreaterThan(15);
  });

  it('each home has its own band (the Farm’s is the original)', () => {
    expect(themeVariation(SCORES.bounce, 'farm')).toBe(SCORES.bounce);
    const sets = THEME_HOMES.map((h) => insts(themeVariation(SCORES.bounce, h)) + '|' + themeVariation(SCORES.bounce, h).parts.length);
    expect(new Set(sets).size).toBe(THEME_HOMES.length);
    expect(insts(themeVariation(SCORES.bounce, 'arctic'))).toContain('glock');
    expect(insts(themeVariation(SCORES.bounce, 'outback'))).toContain('kalimba');
  });

  it('only the theme’s cues vary; a place with no band of its own plays the original', () => {
    expect(themeVariation(SCORES.triumph, 'arctic')).toBe(SCORES.triumph);
    expect(themeVariation(SCORES['trick:wave'], 'amazon')).toBe(SCORES['trick:wave']);
    expect(themeVariation(SCORES.bounce, 'place:12')).toBe(SCORES.bounce);
    expect(themeVariation(SCORES.bounce, undefined)).toBe(SCORES.bounce);
  });

  it('the parade plays its home’s variation', () => {
    expect(playCue('bounce', { home: 'outback' })!.score.title).toBe('Barnyard Bounce (outback)');
    expect(playCue('bounce', { home: 'farm' })!.score.title).toBe('Barnyard Bounce');
  });
});

describe('the ambient tune', () => {
  const meadow = SCORES.meadow;

  it('is the theme slowed down: the motif opens and closes it, no drums, about half a minute', () => {
    const tune = leadLine(meadow).map((m) => m % 12);
    expect(tune.slice(0, 3)).toEqual([0, 4, 7]);
    expect(tune.slice(-4)).toEqual([0, 4, 7, 0]);
    // The theme's first turn, A–C–F, comes by.
    expect(tune.join(',')).toContain('9,0,5');
    expect(meadow.parts.some((p) => ['stomp', 'clap', 'shaker', 'block', 'cymbal'].includes(p.inst))).toBe(false);
    expect(cueMs(meadow)).toBeGreaterThan(20000);
    expect(cueMs(meadow)).toBeLessThan(40000);
    expect(meadow.bpm).toBeLessThan(SCORES.bounce.bpm * 0.6);
  });

  it('is off unless the player turns it on, and a damaged value falls back to off', () => {
    expect(defaultSave().settings.ambientMusic).toBe(false);
    const raw = JSON.parse(JSON.stringify(defaultSave()));
    raw.settings.ambientMusic = true;
    expect(normalizeSave(raw).settings.ambientMusic).toBe(true);
    raw.settings.ambientMusic = 'loud';
    expect(normalizeSave(raw).settings.ambientMusic).toBe(false);
  });

  it('plays, rests, plays again, and after a few times leaves the place in peace', () => {
    expect(startAmbient('farm')).toBe(true);
    expect(ambientPlaying()).toMatchObject({ home: 'farm', plays: 1, title: 'Meadow Morning' });
    const round = cueMs(meadow) + AMBIENT_REST_MS;
    vi.advanceTimersByTime(round + 10);
    expect(ambientPlaying()?.plays).toBe(2);
    vi.advanceTimersByTime(round * (AMBIENT_PLAYS - 2) + 10);
    expect(ambientPlaying()?.plays).toBe(AMBIENT_PLAYS);
    vi.advanceTimersByTime(round + 10);
    expect(ambientPlaying()).toBeNull();
    vi.advanceTimersByTime(round * 3);
    expect(ambientPlaying()).toBeNull();
  });

  it('started while a cue plays (the Home music during the parade), it comes up when the cue is over (D45 review)', () => {
    const pb = playCue('bounce')!;
    startAmbient('farm');
    expect(ambientPlaying()?.ducked).toBe(true);
    vi.advanceTimersByTime(pb.durationMs - 500);
    expect(ambientPlaying()?.ducked).toBe(true);
    vi.advanceTimersByTime(1500);
    expect(ambientPlaying()?.ducked).toBe(false);
  });

  it('a cue ducks it and it comes back after; a skipped cue gives it back at once; cue after cue keeps it down', () => {
    startAmbient('farm');
    expect(ambientPlaying()?.ducked).toBe(false);
    const wave = playCue('trick:wave')!;
    expect(ambientPlaying()?.ducked).toBe(true);
    vi.advanceTimersByTime(wave.durationMs + 600);
    expect(ambientPlaying()?.ducked).toBe(false);
    // Skipped: back up straight away.
    playCue('bounce');
    expect(ambientPlaying()?.ducked).toBe(true);
    vi.advanceTimersByTime(1000);
    stopMusic(0);
    vi.advanceTimersByTime(10);
    expect(ambientPlaying()?.ducked).toBe(false);
    // One cue straight after another: down until the second is over.
    const a = playCue('trick:hop')!;
    vi.advanceTimersByTime(a.durationMs - 200);
    const b = playCue('trick:bow')!;
    vi.advanceTimersByTime(800);
    expect(ambientPlaying()?.ducked).toBe(true);
    vi.advanceTimersByTime(b.durationMs + 200);
    expect(ambientPlaying()?.ducked).toBe(false);
  });

  it('a cue plays over it without ending it; music off, leaving the app or stopping it ends it', () => {
    startAmbient('arctic');
    expect(ambientPlaying()?.title).toBe('Meadow Morning (arctic)');
    playCue('trick:wave');
    expect(nowPlaying()?.id).toBe('trick:wave');
    expect(ambientPlaying()).not.toBeNull();
    stopMusic(0);
    expect(ambientPlaying()).not.toBeNull();
    stopAmbient(0);
    expect(ambientPlaying()).toBeNull();
    startAmbient('farm');
    hide(true);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(ambientPlaying()).toBeNull();
    // It doesn't start unseen, nor with music off.
    expect(startAmbient('farm')).toBe(false);
    hide(false);
    setMusicEnabled(false);
    expect(startAmbient('farm')).toBe(false);
    setMusicEnabled(true);
    startAmbient('farm');
    setMusicEnabled(false);
    expect(ambientPlaying()).toBeNull();
  });

  describe('on a home’s screen', () => {
    const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
    const open = () => {
      localStorage.clear();
      document.body.innerHTML = '<div id="app"></div>';
      const router = new Router(document.getElementById('app')!);
      const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
      for (const k of ['journey', 'pets', 'challenges', 'shop', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
      router.register({ ...reg, region: regionScreen });
      app.router = router;
      return router;
    };
    beforeEach(() => {
      app.replaceSave(defaultSave(new Date(2026, 9, 31, 12)));
      Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
      app.save.world.growth.farm = 12;
      app.save.inventory.companions.cotton = { unlockedAt: '2026-10-31T11:00:00.000Z' };
      app.applySettings();
    });

    it('with Home music off (the default) a visit is as quiet as before', () => {
      open().go({ screen: 'region', id: 'farm' });
      vi.advanceTimersByTime(5000);
      expect(ambientPlaying()).toBeNull();
    });

    it('leaving mid-trick ends its tune with the scene (camera, audio and animation go together)', () => {
      const router = open();
      router.go({ screen: 'region', id: 'farm' });
      vi.advanceTimersByTime(3000);
      document.querySelector('.sanctuary__scene .sanctuary__pet')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      document.querySelector<HTMLElement>('.trick-chip[data-trick="wave"]')!.click();
      // Cotton's wave, with a sheep's lilt under it.
      expect(nowPlaying()?.id).toBe('trick:wave');
      expect(nowPlaying()!.score.parts.length).toBeGreaterThan(SCORES['trick:wave'].parts.length);
      router.go({ screen: 'journey' });
      expect(nowPlaying()).toBeNull();
      expect(document.querySelector('.is-closeup, .sp-closeup-light')).toBeNull();
    });

    it('with it on, the tune starts after the hellos and ends when the player leaves', () => {
      app.settings.ambientMusic = true;
      const router = open();
      router.go({ screen: 'region', id: 'farm' });
      expect(ambientPlaying()).toBeNull();
      vi.advanceTimersByTime(2000);
      expect(ambientPlaying()).toMatchObject({ home: 'farm', plays: 1 });
      router.go({ screen: 'journey' });
      expect(ambientPlaying()).toBeNull();
      app.settings.ambientMusic = false;
    });
  });
});

describe('the final pose: a hero shot on a lit stage', () => {
  const FULL: View = { x: 0, y: 0, w: 360, h: 300 };
  function scene(xs: Array<[string, number, number]>): SVGSVGElement {
    document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">${xs
      .map(([id, x, y]) => `<g class="sanctuary__pet sanctuary__friend" data-friend="${id}" data-gx="${x}" data-gy="${y}" data-gh="34"></g>`)
      .join('')}</svg></figure>`;
    return document.querySelector('svg')!;
  }
  const camera = () => {
    const calls: string[] = [];
    const cam = {
      full: FULL,
      focus: vi.fn(async (_e: Element, z: number) => (calls.push(`focus:${z}`), true)),
      moveTo: vi.fn(async (v: View) => (calls.push(`move:${(360 / v.w).toFixed(2)}`), true)),
      reset: vi.fn(async () => (calls.push('reset'), true)),
      setOffset: vi.fn((_x: number, _y: number, z: number) => calls.push(`push:${z}`)),
      clearOffset: vi.fn(() => calls.push('unpush')),
      viewOf: (e: Element, zoom: number) => viewAt(FULL, Number((e as SVGGElement).dataset.gx), Number((e as SVGGElement).dataset.gy), zoom),
    };
    return { cam: cam as unknown as SceneCamera, calls };
  };

  it('is wider than the dance’s framing, with the dancers low in the picture and sky above them', () => {
    const svg = scene([
      ['cotton', 150, 240],
      ['truffle', 200, 246],
    ]);
    const dancers = planDance(svg, { bpm: 132, beats: 16, newcomer: 'truffle' });
    const group = groupView(FULL, dancers);
    const hero = heroView(FULL, dancers);
    expect(360 / hero.w).toBeLessThan(360 / group.w);
    expect(360 / hero.w).toBeGreaterThan(1.05);
    // Everyone is in the picture, standing below its middle.
    for (const d of dancers) {
      const x = Number(d.fig.dataset.gx);
      const y = Number(d.fig.dataset.gy);
      expect(x).toBeGreaterThan(hero.x);
      expect(x).toBeLessThan(hero.x + hero.w);
      expect((y - hero.y) / hero.h).toBeGreaterThan(0.55);
      expect((y - hero.y) / hero.h).toBeLessThan(0.95);
    }
    // A group right across the scene: the whole scene is the wide shot.
    const wide = scene([
      ['cotton', 30, 240],
      ['truffle', 330, 246],
    ]);
    expect(heroView(FULL, planDance(wide, { bpm: 132, beats: 16 }))).toEqual(FULL);
  });

  it('the parade goes out to it for the final pose with a small push, on a stage that brightens; all gone after', async () => {
    const svg = scene([
      ['cotton', 150, 240],
      ['truffle', 200, 246],
    ]);
    const host = document.querySelector<HTMLElement>('.sanctuary__scene')!;
    const { cam, calls } = camera();
    const parts: string[] = [];
    const p = startParade({ svg, host, camera: cam, newcomer: 'truffle', reducedMotion: false, onPart: (x) => parts.push(x) });
    await vi.advanceTimersByTimeAsync(600);
    // One wash of light under the whole group, and a pool under each dancer.
    const stage = svg.querySelector('.sp-dance-stage')!;
    expect(stage).not.toBeNull();
    expect(svg.querySelectorAll('.sp-dance-light').length).toBe(2);
    expect(Number(stage.getAttribute('rx'))).toBeGreaterThan(40);
    // Under the animals in the drawing.
    expect(stage.compareDocumentPosition(svg.querySelector('.sanctuary__pet')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(stage.classList.contains('is-finale')).toBe(false);
    const spb = 60000 / 132;
    await vi.advanceTimersByTimeAsync(spb * 14 + 60);
    expect(parts).toContain('finish');
    expect(stage.classList.contains('is-finale')).toBe(true);
    const moves = calls.filter((c) => c.startsWith('move:')).map((c) => Number(c.slice(5)));
    // In close, out to the group, then wider again for the hero shot.
    expect(moves.length).toBe(2);
    expect(moves[1]).toBeLessThan(moves[0]);
    expect(calls).toContain('push:1.035');
    await vi.advanceTimersByTimeAsync(spb * 3);
    expect(await p.done).toBe('ended');
    expect(calls[calls.length - 1]).toBe('reset');
    expect(svg.querySelector('.sp-dance-stage, .sp-dance-light')).toBeNull();
  });

  it('reduced motion: the stage is lit, the camera stays put', async () => {
    const svg = scene([
      ['cotton', 150, 240],
      ['truffle', 200, 246],
    ]);
    const { cam, calls } = camera();
    const p = startParade({ svg, host: document.querySelector<HTMLElement>('.sanctuary__scene')!, camera: cam, newcomer: 'truffle', reducedMotion: true });
    await vi.advanceTimersByTimeAsync(300);
    expect(svg.querySelector('.sp-dance-stage')).not.toBeNull();
    await vi.advanceTimersByTimeAsync(9000);
    await p.done;
    expect(calls.filter((c) => c !== 'reset' && c !== 'unpush')).toEqual([]);
  });

  it('a trick’s close-up puts a pool of light under the performer, wherever it is in the frame; gone when it ends', () => {
    const svg = scene([
      ['cotton', 30, 240],
      ['hazel', 340, 270],
    ]);
    const { cam } = camera();
    const c = sceneCloseUps({ host: () => document.querySelector<HTMLElement>('.sanctuary__scene'), svg: () => svg, camera: cam, reducedMotion: () => false, pause: () => {} });
    const hazel = svg.querySelector<SVGGElement>('[data-friend="hazel"]')!;
    c.play(hazel, 'wave');
    const light = svg.querySelector('.sp-closeup-light')!;
    expect(light.getAttribute('cx')).toBe('340');
    expect(light.compareDocumentPosition(hazel) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    // Another trick moves the light to the new performer.
    c.play(svg.querySelector<SVGGElement>('[data-friend="cotton"]')!, 'bow');
    expect(svg.querySelectorAll('.sp-closeup-light').length).toBe(1);
    expect(svg.querySelector('.sp-closeup-light')!.getAttribute('cx')).toBe('30');
    c.cancel();
    expect(svg.querySelector('.sp-closeup-light')).toBeNull();
  });
});
