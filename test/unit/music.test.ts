// @vitest-environment happy-dom
/**
 * D44 PR B: PawTyk's own music. The scores are well-formed and the right lengths, the three signature cues share the
 * motif, every trick has a tune exactly as long as the trick, and the player keeps a beat clock with music on, off,
 * or without audio at all. Loudness and clipping are measured in a real browser by the browser tests.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCORES, cueMs, midi, type CueId, type Score } from '../../src/audio/scores';
import { TRICKS } from '../../src/meta/catalogs/tricks';
import { nowPlaying, playCue, setMusicEnabled, stopMusic } from '../../src/services/music';
import { FEEL, feel } from '../../src/services/feel';
import { defaultSave, loadSave } from '../../src/services/storage';
import { MemoryKV } from '../../src/services/kv';

const all = Object.values(SCORES) as Score[];
const KNOWN = new Set(['bass', 'pluck', 'marimba', 'bell', 'brass', 'whistle', 'pad', 'swoop', 'clap', 'stomp', 'shaker', 'block', 'cymbal', 'tuba', 'accordion', 'kalimba', 'glock']);

describe('the scores', () => {
  it('are well-formed: known instruments, notes inside the cue (with a little ring), real pitches and loudness', () => {
    // The win (and its two other turns, D50), Welcome Home, the parade, the jig, the ambient tune (D45), the three other
    // welcomes (D48), and a tune per trick.
    expect(all.length).toBe(10 + TRICKS.length);
    for (const s of all) {
      expect(s.bpm).toBeGreaterThan(40);
      expect(s.bpm).toBeLessThan(260);
      for (const p of s.parts) {
        expect(KNOWN.has(p.inst), `${s.id} ${p.inst}`).toBe(true);
        for (const n of p.notes) {
          expect(n.b).toBeGreaterThanOrEqual(0);
          expect(n.b, `${s.id} starts inside`).toBeLessThan(s.beats);
          expect(n.len).toBeGreaterThan(0);
          expect(n.b + n.len, `${s.id} rings at most a beat past the end`).toBeLessThanOrEqual(s.beats + 1);
          expect(n.v).toBeGreaterThan(0);
          expect(n.v).toBeLessThanOrEqual(1);
          for (const m of n.p) {
            expect(m).toBeGreaterThanOrEqual(midi('C2'));
            expect(m).toBeLessThanOrEqual(midi('C7'));
          }
          if (['clap', 'stomp', 'shaker', 'block', 'cymbal'].includes(p.inst)) expect(n.p).toEqual([]);
          else expect(n.p.length).toBeGreaterThan(0);
        }
      }
      for (const a of s.accents) expect(a).toBeLessThan(s.beats);
    }
  });

  it('every tune is in C major (no note outside the key), so any two can follow each other', () => {
    const inKey = new Set([0, 2, 4, 5, 7, 9, 11]);
    for (const s of all) for (const p of s.parts) for (const n of p.notes) for (const m of n.p) expect(inKey.has(m % 12), `${s.id} ${m}`).toBe(true);
  });

  it('runs as long as the plan asks: the win about 1 s, Welcome Home 2–4 s, the parade 5–8 s', () => {
    expect(cueMs(SCORES.triumph)).toBeGreaterThanOrEqual(800);
    expect(cueMs(SCORES.triumph)).toBeLessThanOrEqual(1300);
    expect(cueMs(SCORES.welcome)).toBeGreaterThanOrEqual(2000);
    expect(cueMs(SCORES.welcome)).toBeLessThanOrEqual(4000);
    expect(cueMs(SCORES.bounce)).toBeGreaterThanOrEqual(5000);
    expect(cueMs(SCORES.bounce)).toBeLessThanOrEqual(8000);
    expect(SCORES.bounce.bpm).toBeGreaterThanOrEqual(128);
    expect(SCORES.bounce.bpm).toBeLessThanOrEqual(136);
  });

  it('the parade has an intro, a dance and a finish covering every beat, with the big accent in the finish', () => {
    const sec = SCORES.bounce.sections!;
    expect(sec.intro[0]).toBe(0);
    expect(sec.intro[1]).toBe(sec.dance[0]);
    expect(sec.dance[1]).toBe(sec.finish[0]);
    expect(sec.finish[1]).toBe(SCORES.bounce.beats);
    const last = Math.max(...SCORES.bounce.accents);
    expect(last).toBeGreaterThanOrEqual(sec.finish[0]);
  });

  it('the three signature cues share the PawTyk motif: a rising C–E–G in the melody', () => {
    const hasMotif = (s: Score) =>
      s.parts.some((p) => {
        const mel = p.notes.filter((n) => n.p.length === 1).map((n) => n.p[0] % 12);
        return mel.some((_, i) => mel[i] === 0 && mel[i + 1] === 4 && mel[i + 2] === 7);
      });
    expect(hasMotif(SCORES.triumph)).toBe(true);
    expect(hasMotif(SCORES.welcome)).toBe(true);
    expect(hasMotif(SCORES.bounce)).toBe(true);
    expect(hasMotif(SCORES.jig)).toBe(true);
  });

  it('the group celebration jig is short, at the parade tempo, and lands its finish where a group dance poses', () => {
    const j = SCORES.jig;
    expect(j.bpm).toBe(SCORES.bounce.bpm);
    expect(cueMs(j)).toBeGreaterThanOrEqual(3000);
    expect(cueMs(j)).toBeLessThanOrEqual(4200);
    // A group dance strikes its pose on its last two beats (three/dance.ts): the jig's finish is there too.
    expect(j.sections!.finish).toEqual([j.beats - 2, j.beats]);
    expect(Math.max(...j.accents)).toBe(j.beats - 2);
  });

  it('every trick and emote has its own tune, as long as the trick itself (within 1%)', () => {
    const titles = new Set<string>();
    for (const t of TRICKS) {
      const s = SCORES[`trick:${t.id}` as CueId];
      expect(s, t.id).toBeTruthy();
      expect(Math.abs(cueMs(s) - t.ms) / t.ms, t.id).toBeLessThan(0.01);
      titles.add(s.title);
    }
    expect(titles.size).toBe(TRICKS.length);
  });
});

describe('the player', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    setMusicEnabled(true);
  });
  afterEach(() => {
    stopMusic(0);
    vi.useRealTimers();
  });

  it('without audio (here, no AudioContext) a cue still runs its beat clock, silently, and ends on time', async () => {
    const pb = playCue('bounce')!;
    expect(pb.audible).toBe(false);
    expect(pb.durationMs).toBe(cueMs(SCORES.bounce));
    const spb = 60000 / SCORES.bounce.bpm;
    expect(pb.beatAt(pb.startMs + 4 * spb)).toBeCloseTo(4, 6);
    expect(pb.msAt(14)).toBeCloseTo(pb.startMs + 14 * spb, 6);
    expect(nowPlaying()).toBe(pb);
    let ended = false;
    void pb.done.then(() => (ended = true));
    await vi.advanceTimersByTimeAsync(pb.durationMs + 100);
    expect(ended).toBe(true);
    expect(nowPlaying()).toBeNull();
  });

  it('a new cue stops the one before; stop() settles at once and is safe twice', async () => {
    const a = playCue('welcome')!;
    const b = playCue('triumph')!;
    expect(a.stopped).toBe(true);
    expect(nowPlaying()).toBe(b);
    b.stop();
    b.stop();
    await expect(b.done).resolves.toBeUndefined();
    expect(nowPlaying()).toBeNull();
  });

  it('music off: cues still give a clock (a silent one), and turning music off stops what is playing', () => {
    const pb = playCue('bounce')!;
    setMusicEnabled(false);
    expect(pb.stopped).toBe(true);
    const silent = playCue('bounce')!;
    expect(silent.audible).toBe(false);
    expect(silent.beatAt(silent.msAt(2))).toBeCloseTo(2, 6);
  });

  it('leaving the app stops the music', () => {
    const pb = playCue('bounce')!;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
    document.dispatchEvent(new Event('visibilitychange'));
    expect(pb.stopped).toBe(true);
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => false });
  });

  it('unknown cues play nothing', () => {
    expect(playCue('trick:nope' as CueId)).toBeNull();
  });
});

describe('with a real-enough audio context', () => {
  /** Just enough of Web Audio to schedule a score: counts the sources started and the fades. */
  class Param {
    value = 0;
    setValueAtTime() {}
    exponentialRampToValueAtTime() {}
    linearRampToValueAtTime() {}
    setTargetAtTime() {}
    cancelScheduledValues() {}
  }
  let started = 0;
  let stops = 0;
  class Node_ {
    gain = new Param();
    frequency = new Param();
    Q = new Param();
    type = '';
    buffer: unknown = null;
    connect(n: unknown) {
      return n;
    }
    disconnect() {}
    start() {
      started++;
    }
    stop() {
      stops++;
    }
  }
  class FakeCtx {
    currentTime = 0;
    sampleRate = 8000;
    state = 'running';
    destination = new Node_();
    createGain = () => new Node_();
    createOscillator = () => new Node_();
    createBiquadFilter = () => new Node_();
    createBufferSource = () => new Node_();
    createBuffer = (_c: number, n: number) => ({ getChannelData: () => new Float32Array(n) });
    resume = async () => {};
  }

  it('plays every note of a cue on the music channel', () => {
    vi.stubGlobal('AudioContext', FakeCtx);
    setMusicEnabled(true);
    started = 0;
    const pb = playCue('bounce')!;
    expect(pb.audible).toBe(true);
    const notes = SCORES.bounce.parts.reduce((n, p) => n + p.notes.reduce((m, x) => m + Math.max(1, x.p.length), 0), 0);
    expect(started).toBeGreaterThanOrEqual(notes);
    pb.stop(0);
    vi.unstubAllGlobals();
  });

  it("a cue's last notes, still ringing past its end, are faded too when the music stops or the next cue starts", () => {
    vi.useFakeTimers();
    vi.stubGlobal('AudioContext', FakeCtx);
    setMusicEnabled(true);
    const pb = playCue('triumph')!;
    vi.advanceTimersByTime(pb.durationMs + 100);
    // Its beats are over (the clock is done), but its ring is still the player's to stop.
    expect(pb.stopped).toBe(true);
    stops = 0;
    stopMusic(100);
    expect(stops).toBeGreaterThan(0);
    // Once only.
    stops = 0;
    stopMusic(100);
    expect(stops).toBe(0);
    // The same when a new cue takes over.
    const a = playCue('welcome')!;
    vi.advanceTimersByTime(a.durationMs + 100);
    stops = 0;
    playCue('triumph')!.stop(0);
    expect(stops).toBeGreaterThan(0);
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });
});

describe('Music in Settings and in the feel table', () => {
  it('is on by default, and for every save from before D44 (whose switch did nothing) until the player chooses', () => {
    expect(defaultSave().settings.music).toBe(true);
    const kv = new MemoryKV();
    const old = defaultSave();
    (old.settings as unknown as Record<string, unknown>).music = false;
    delete old.settings.musicChosen;
    kv.setItem('pawtopia.save.v2', JSON.stringify(old));
    expect(loadSave(kv).save.settings.music).toBe(true);
    const chose = defaultSave();
    chose.settings.music = false;
    chose.settings.musicChosen = true;
    kv.setItem('pawtopia.save.v2', JSON.stringify(chose));
    expect(loadSave(kv).save.settings.music).toBe(false);
  });

  it('a solve and an arrival play their cues with Music on (instead of their sound effects)', () => {
    vi.useFakeTimers();
    expect(FEEL.solved.cue).toBe('triumph');
    expect(FEEL.arrival.cue).toBe('welcome');
    setMusicEnabled(true);
    feel('solved');
    expect(nowPlaying()?.id).toBe('triumph');
    feel('trick', { cue: 'trick:dance' });
    expect(nowPlaying()?.id).toBe('trick:dance');
    setMusicEnabled(false);
    feel('solved');
    expect(nowPlaying()).toBeNull();
    vi.useRealTimers();
  });
});
