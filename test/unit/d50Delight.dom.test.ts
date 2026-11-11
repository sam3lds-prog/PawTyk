// @vitest-environment happy-dom
/**
 * D50 PR B, short-session delight:
 *  - a couple of seconds into a calm visit, one animal comes over and says hello, in its temperament's way and for a
 *    reason the player can read (a friendship one hello away, a newcomer, a win just now, the evening); never over a
 *    welcome, a meal, a tour, a sheet or a try-on; once in a while per home (walking between screens doesn't repeat it);
 *    a still emote under reduced motion; ended by anything the player starts; nothing granted or saved;
 *  - an ordinary win takes one of three restrained turns (its jingle, its animal's smile), never the same twice running;
 *    a milestone keeps the original.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { gameScreen } from '../../src/ui/screens/game';
import { shopScreen } from '../../src/ui/screens/shop';
import { startGame } from '../../src/app/gameFlow';
import { CAT, EMPTY } from '../../src/engine/types';
import { defaultSave, type SaveV2 } from '../../src/services/storage';
import { GREET_TRICK, pickGreeting, type GreetCast } from '../../src/meta/greeting';
import { forgetGreetings, greetedRecently, GREET_AFTER_MS, GREET_COOLDOWN_MS, GREET_WINDOW_MS, sceneMoments, setMomentsEnabled } from '../../src/ui/components/animalMoments';
import { createSceneDirector } from '../../src/ui/components/sceneDirector';
import { WIN_FLAVORS, winFlavor } from '../../src/meta/winFlavor';
import { SCORES, cueMs, type Score } from '../../src/audio/scores';
import { nowPlaying, setMusicEnabled, stopMusic } from '../../src/services/music';
import { TEMPERAMENTS } from '../../src/meta/temperament';
import { TRICK_BY_ID } from '../../src/meta/catalogs/tricks';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, game: gameScreen, shop: shopScreen });
  app.router = router;
  return router;
}

function farmSave(): SaveV2 {
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  s.journey.nextLevel = 41;
  s.world.growth.farm = 6;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-01T11:00:00.000Z' };
  s.world.visited.farm = '2026-11-11';
  return s;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  app.replaceSave(farmSave());
  app.settings.toys3d = false;
  app.settings.reducedMotion = 'full';
  app.active = null;
  forgetGreetings();
  setMomentsEnabled(true);
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  app.active = null;
  vi.useRealTimers();
});

const cast = (o: Partial<GreetCast> & { id: string }): GreetCast => ({ name: o.id[0].toUpperCase() + o.id.slice(1), temper: 'playful', greetedToday: true, heartsToNext: 5, ...o });

describe('who says hello, and why (pure)', () => {
  const ctx = { now: NOW, evening: false, justSolved: false, turn: 0 };

  it('a friend one hello from what friendship brings next comes first, and the line says a hello is all it takes', () => {
    const g = pickGreeting([cast({ id: 'cotton', temper: 'sleepy' }), cast({ id: 'truffle', greetedToday: false, heartsToNext: 1 })], ctx)!;
    expect(g.who.id).toBe('truffle');
    expect(g.reason).toBe('unlock');
    expect(g.line).toBe('Truffle is hoping you’ll say hello.');
    // Already greeted today: a hello wouldn't count, so that isn't what it's about.
    const g2 = pickGreeting([cast({ id: 'truffle', greetedToday: true, heartsToNext: 1 })], ctx)!;
    expect(g2.reason).toBe('hello');
  });

  it('a newcomer (home within a day) is still settling in; then a win, the evening, or its temperament', () => {
    const fresh = cast({ id: 'buttercup', temper: 'gentle', since: new Date(NOW.getTime() - 3_600_000).toISOString() });
    expect(pickGreeting([cast({ id: 'cotton' }), fresh], ctx)!.line).toBe('Buttercup is still settling in, and says hi.');
    expect(pickGreeting([cast({ id: 'cotton' })], { ...ctx, justSolved: true })!.line).toBe('Cotton heard you solved a puzzle!');
    expect(pickGreeting([cast({ id: 'cotton' })], { ...ctx, evening: true })!.line).toBe('Cotton says a sleepy good evening.');
    expect(pickGreeting([cast({ id: 'cotton', temper: 'shy' })], ctx)!.line).toBe('Cotton peeks out to say hi.');
    expect(pickGreeting([], ctx)).toBeNull();
  });

  it('takes turns: never the same animal twice running when there is a choice', () => {
    const who = [cast({ id: 'cotton' }), cast({ id: 'truffle' }), cast({ id: 'buttercup' })];
    let last: string | undefined;
    for (let turn = 0; turn < 9; turn++) {
      const g = pickGreeting(who, { ...ctx, last, turn })!;
      expect(g.who.id).not.toBe(last);
      last = g.who.id;
    }
  });

  it('each temperament greets with a short trick every animal has, free and quick', () => {
    for (const t of TEMPERAMENTS) {
      const trick = TRICK_BY_ID[GREET_TRICK[t]];
      expect(trick, t).toBeTruthy();
      expect(trick.ms).toBeLessThanOrEqual(2200);
    }
  });
});

describe('the hello in a home', () => {
  const tricked = () => [...document.querySelectorAll<HTMLElement>('.sanctuary__scene [data-trick]')].map((g) => `${g.dataset.friend}:${g.dataset.trick}`);
  const line = () => document.querySelector('[data-chat] span')?.textContent ?? '';

  it('a calm visit: one animal says hello a couple of seconds in, with its line; then the small talk comes back', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS - 200);
    expect(tricked()).toEqual([]);
    await vi.advanceTimersByTimeAsync(400);
    expect(tricked()).toHaveLength(1);
    expect(line()).toMatch(/Cotton|Truffle/);
    expect(document.querySelector<HTMLElement>('[data-chat]')!.hidden).toBe(false);
    // Nothing granted or saved for it, and it isn't one of D49's moments (no New, none counted as seen).
    expect(app.save.sanctuary.moments ?? {}).toEqual({});
    expect(document.querySelector('.moment-new')).toBeNull();
    await vi.advanceTimersByTimeAsync(4000);
    expect(tricked()).toEqual([]);
  });

  it('walking away and straight back: no second hello from the same home for a while; later, yes', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(tricked()).toHaveLength(1);
    expect(greetedRecently('farm')).toBe(true);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_WINDOW_MS + 500);
    expect(tricked()).toEqual([]);
    vi.setSystemTime(NOW.getTime() + GREET_COOLDOWN_MS + 10_000);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(tricked()).toHaveLength(1);
  });

  it('never over a welcome: straight from Meet, the parade is the hello', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 300);
    expect(tricked().every((t) => t.includes(':dance:'))).toBe(true);
    expect(line()).not.toMatch(/say hi|hello|settling|solved|evening/i);
    expect(greetedRecently('farm')).toBe(false);
  });

  it('never with a sheet open (a card, a gift); given up if the scene is busy for the whole start of the visit', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    document.body.insertAdjacentHTML('beforeend', '<div class="overlay"></div>');
    await vi.advanceTimersByTimeAsync(GREET_WINDOW_MS + 1500);
    document.querySelector('.overlay')!.remove();
    await vi.advanceTimersByTimeAsync(3000);
    expect(tricked()).toEqual([]);
    expect(greetedRecently('farm')).toBe(false);
  });

  it('whatever the player starts ends it at once (the tour takes the scene)', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(tricked()).toHaveLength(1);
    (document.querySelector('[data-act="tour"]') as HTMLElement).click();
    expect(tricked()).toEqual([]);
    expect(document.querySelector('.is-touring, .sanctuary__scene.is-touring')).not.toBeNull();
  });

  it('under reduced motion: a still emote and its line (no motion class)', async () => {
    app.settings.reducedMotion = 'reduce';
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(tricked()).toHaveLength(1);
    expect(document.querySelector('.sanctuary__scene [data-trick][class*="is-trick-"]')).toBeNull();
    expect(line()).toMatch(/Cotton|Truffle/);
  });

  it('a friend one hello from its next friendship gift is the one who comes over', async () => {
    app.save.sanctuary.affection.truffle = 4; // Friend at 5
    const router = mount();
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_AFTER_MS + 200);
    expect(tricked()).toEqual(['truffle:wiggle']);
    expect(line()).toBe('Truffle is hoping you’ll say hello.');
  });

  it('the scene director knows it as a moment (a stand-alone scene)', () => {
    document.body.innerHTML = `<p data-chat><span>Hi.</span></p><figure class="sanctuary__scene"><svg viewBox="0 0 360 300"><g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="240"></g></svg></figure>`;
    const director = createSceneDirector(() => {});
    const m = sceneMoments({ svg: () => document.querySelector('svg'), chat: () => document.querySelector('[data-chat]'), director, reducedMotion: () => false, busy: () => false, greet: { home: 'test', evening: () => false } });
    vi.advanceTimersByTime(GREET_AFTER_MS + 10);
    expect(m.greeting?.who.id).toBe('cotton');
    expect(m.active).toBe(true);
    director.claim('tour');
    expect(m.active).toBe(false);
    expect(document.querySelector('[data-trick]')).toBeNull();
    m.dispose();
  });
});

describe('three turns of an ordinary win', () => {
  it('rotates through three flavors, never the same twice running; a milestone keeps the original', () => {
    expect(WIN_FLAVORS).toHaveLength(3);
    for (let n = 0; n < 10; n++) expect(winFlavor(n, false)).not.toEqual(winFlavor(n + 1, false));
    expect(winFlavor(1, true)).toEqual(WIN_FLAVORS[0]);
    expect(winFlavor(2, true).cue).toBe('triumph');
  });

  it('the other two turns are Tiny Triumph’s family: its motif, its length, its band', () => {
    const motif = (s: Score) =>
      s.parts.some((p) => {
        const mel = p.notes.filter((n) => n.p.length === 1).map((n) => n.p[0] % 12);
        return mel.some((_, i) => mel[i] === 0 && mel[i + 1] === 4 && mel[i + 2] === 7);
      });
    for (const id of ['triumph2', 'triumph3'] as const) {
      const s = SCORES[id];
      expect(motif(s), id).toBe(true);
      expect(Math.abs(cueMs(s) - cueMs(SCORES.triumph))).toBeLessThan(150);
      expect(s.bpm).toBe(SCORES.triumph.bpm);
    }
  });

  function solveLevel(level: number): void {
    startGame({ kind: 'level', level });
    const s = app.active!.session;
    let t = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        document.querySelector<HTMLElement>(`[data-tool="${want === CAT ? 'cat' : 'dog'}"]`)?.click();
        const el = document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
        document.elementFromPoint = () => el;
        for (const gap of [1_000, 60]) {
          t += gap;
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
        }
        if (s.outcome === 'won') return;
      }
  }

  it('two ordinary wins in a row: a different smile and (with Music on) a different turn of the jingle', () => {
    mount();
    app.settings.controls = 'tap';
    setMusicEnabled(true);
    // Far from any arrival: the Farm's next animal is a few puzzles off, so these are ordinary wins.
    app.save.world.growth.farm = 4;
    const moods: string[] = [];
    const cues: string[] = [];
    for (const level of [41, 42]) {
      solveLevel(level);
      cues.push(nowPlaying()?.id ?? '');
      vi.advanceTimersByTime(1400);
      const sheet = document.querySelector('.win-sheet')!;
      expect(sheet.classList.contains('win-sheet--milestone')).toBe(false);
      moods.push(sheet.querySelector<HTMLElement>('[data-win-mood]')?.dataset.winMood ?? '');
      stopMusic(0);
      app.active = null;
    }
    expect(moods[0]).not.toBe(moods[1]);
    expect(cues[0]).not.toBe(cues[1]);
    for (const c of cues) expect(['triumph', 'triumph2', 'triumph3']).toContain(c);
    setMusicEnabled(false);
  });
});

describe('the hello and the moments share the scene', () => {
  it('a moment never starts while the hello is playing, and the hello’s line isn’t a moment’s (no New, not counted)', () => {
    document.body.innerHTML = `<p data-chat><span>Hi.</span></p><figure class="sanctuary__scene"><svg viewBox="0 0 360 300"><g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="240"></g><g class="sanctuary__pet sanctuary__friend" data-friend="truffle" data-gx="200" data-gy="240"></g></svg></figure>`;
    const director = createSceneDirector(() => {});
    const m = sceneMoments({ svg: () => document.querySelector('svg'), chat: () => document.querySelector('[data-chat]'), director, reducedMotion: () => false, busy: () => false, greet: { home: 'test2', evening: () => false } });
    vi.advanceTimersByTime(GREET_AFTER_MS + 10);
    expect(m.greeting).not.toBeNull();
    expect(document.querySelector('[data-chat]')!.classList.contains('is-greeting')).toBe(true);
    expect(document.querySelector('[data-chat]')!.classList.contains('is-moment')).toBe(false);
    // A moment asked for now waits: one animal at a time.
    expect(m.playNow()).toBeNull();
    expect(document.querySelectorAll('[data-trick]')).toHaveLength(1);
    vi.advanceTimersByTime(3000);
    expect(m.playNow()).not.toBeNull();
    m.dispose();
  });

  it('a welcome still owed (offered under the scene) is the visit’s hello: no greeting on top of it', async () => {
    const router = mount();
    // Leave during the welcome's lead-in: the next visit offers it.
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(100);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    router.go({ screen: 'region', id: 'farm' });
    await vi.advanceTimersByTimeAsync(GREET_WINDOW_MS + 500);
    expect(document.querySelector<HTMLElement>('[data-act="parade-replay"]')?.hidden).toBe(false);
    expect(greetedRecently('farm')).toBe(false);
  });
});

describe('a new stage is its own hello', () => {
  it('a visit that opens on a new stage (its group dance) has no greeting on top, even after the dance', async () => {
    const router = mount();
    router.go({ screen: 'region', id: 'farm', fresh: 2 });
    // The dance starts, and the player skips it straight away: the scene is free well inside the hello's window.
    await vi.advanceTimersByTimeAsync(1300);
    expect(document.querySelector('.parade-skip')).not.toBeNull();
    document.querySelector<HTMLElement>('.parade-skip')!.click();
    await vi.advanceTimersByTimeAsync(GREET_WINDOW_MS);
    expect(greetedRecently('farm')).toBe(false);
    expect(document.querySelector('.sanctuary__chat.is-greeting')).toBeNull();
  });
});
