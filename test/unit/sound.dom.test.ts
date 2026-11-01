// @vitest-environment happy-dom
/**
 * How the game feels (D40 PR A): every event has its sound and haptic chosen together in one table, the table matches
 * the design (a quiet tick for a ✕, a gentle pop for a placement, a warm chime only for a new animal…), and each switch
 * in Settings silences exactly its own half.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEL, feel, type FeelEvent } from '../../src/services/feel';
import { HELLO_NOTES, HELLO_PITCH, MASTER_GAIN, setSoundEnabled, sfx } from '../../src/services/audio';
import { VIBRATE, setHapticsEnabled } from '../../src/services/haptics';
import { helloOf } from '../../src/ui/components/hello';
import { placeDef } from '../../src/meta/catalogs/places';

/** A tiny stand-in for Web Audio that counts the notes started. */
let contexts = 0;
let notes = 0;
class FakeParam {
  value = 0;
  setValueAtTime() {}
  exponentialRampToValueAtTime() {}
  cancelScheduledValues() {}
  setTargetAtTime(v: number) {
    this.value = v;
  }
}
class FakeNode {
  gain = new FakeParam();
  frequency = new FakeParam();
  type = '';
  connect(n: unknown) {
    return n;
  }
  start() {
    notes++;
  }
  stop() {}
}
class FakeContext {
  currentTime = 0;
  state = 'running';
  destination = {};
  constructor() {
    contexts++;
  }
  createGain() {
    return new FakeNode();
  }
  createOscillator() {
    return new FakeNode();
  }
  createBiquadFilter() {
    return new FakeNode();
  }
  resume() {}
}

let clock = 10_000;
beforeEach(() => {
  contexts = 0;
  notes = 0;
  (window as unknown as { AudioContext: unknown }).AudioContext = FakeContext;
  vi.spyOn(performance, 'now').mockImplementation(() => (clock += 1_000));
  setSoundEnabled(true);
  setHapticsEnabled(true);
});
afterEach(() => vi.restoreAllMocks());

describe('the feel table (D40)', () => {
  it('matches the design: each event has the sound and the haptic it was given', () => {
    // Owner request: a ✕ is felt (a light tap), and a correct animal more firmly than a ✕.
    expect(FEEL.mark).toEqual({ sound: 'tick', haptic: 'light' });
    expect(FEEL.place).toEqual({ sound: 'pop', haptic: 'medium' });
    const strength = ['select', 'light', 'medium'];
    expect(strength.indexOf(FEEL.place.haptic!)).toBeGreaterThan(strength.indexOf(FEEL.mark.haptic!));
    // Every browser fallback is long enough to be felt, and stronger kinds buzz longer.
    expect(VIBRATE.light as number).toBeGreaterThanOrEqual(10);
    expect(VIBRATE.medium as number).toBeGreaterThan(VIBRATE.light as number);
    expect(FEEL.line).toEqual({ sound: 'line', haptic: 'medium' });
    expect(FEEL.miss).toEqual({ sound: 'miss', haptic: 'warning' });
    expect(FEEL.solved).toEqual({ sound: 'solved', haptic: 'success' });
    expect(FEEL.arrival).toEqual({ sound: 'arrival', haptic: 'pulse' });
    expect(FEEL.hello).toEqual({ sound: 'hello', haptic: 'light' });
    // The arrival chime and its pulse belong to a new animal alone.
    for (const [e, f] of Object.entries(FEEL)) {
      if (e !== 'arrival') expect(f.sound, e).not.toBe('arrival');
      if (e !== 'arrival') expect(f.haptic, e).not.toBe('pulse');
    }
  });

  it('every event plays its sound and its buzz, and each switch silences only its own half', () => {
    const vibrate = vi.fn();
    Object.defineProperty(navigator, 'vibrate', { value: vibrate, configurable: true });
    for (const e of Object.keys(FEEL) as FeelEvent[]) {
      notes = 0;
      vibrate.mockClear();
      feel(e);
      expect(notes > 0, `${e} sound`).toBe(FEEL[e].sound !== null);
      expect(vibrate.mock.calls.length, `${e} haptic`).toBe(FEEL[e].haptic ? 1 : 0);
      if (FEEL[e].haptic) expect(vibrate).toHaveBeenCalledWith(VIBRATE[FEEL[e].haptic!]);
    }
    // Sound off: no notes at all (not even a context), haptics still there.
    setSoundEnabled(false);
    notes = 0;
    vibrate.mockClear();
    feel('place');
    expect(notes).toBe(0);
    expect(vibrate).toHaveBeenCalledTimes(1);
    // Haptics off: sound still plays, nothing buzzes.
    setSoundEnabled(true);
    setHapticsEnabled(false);
    vibrate.mockClear();
    feel('place');
    expect(notes).toBeGreaterThan(0);
    expect(vibrate).not.toHaveBeenCalled();
  });

  it('sound is quiet by default, and a fast run of ticks (a drag) never piles up', () => {
    expect(MASTER_GAIN).toBeLessThanOrEqual(0.45);
    vi.spyOn(performance, 'now').mockImplementation(() => 50_000);
    notes = 0;
    for (let i = 0; i < 10; i++) sfx('tick');
    expect(notes).toBe(1);
  });

  it('an animal says hello in its own rhythm, higher when it is little and lower when it is big', () => {
    for (const style of Object.keys(HELLO_NOTES) as Array<keyof typeof HELLO_NOTES>) {
      notes = 0;
      sfx('hello', { style, size: 'small' });
      expect(notes, style).toBeGreaterThan(0);
      expect(HELLO_NOTES[style].every(([, at, len]) => at + len <= 0.4), style).toBe(true);
    }
    expect(HELLO_PITCH.tiny).toBeGreaterThan(HELLO_PITCH.small);
    expect(HELLO_PITCH.small).toBeGreaterThan(HELLO_PITCH.medium);
    expect(HELLO_PITCH.medium).toBeGreaterThan(HELLO_PITCH.large);
    expect(HELLO_PITCH.large).toBeGreaterThan(HELLO_PITCH.huge);
    // Every animal's hello is sized by its kind: a resident cat, a hand-made friend, an animal of a place.
    expect(helloOf('mochi').size).toBe('small');
    expect(helloOf('cotton').size).toBeTruthy();
    for (const a of placeDef(3).animals) expect(['tiny', 'small', 'medium', 'large', 'huge']).toContain(helloOf(a.id).size);
  });
});
