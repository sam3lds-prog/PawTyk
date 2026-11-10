import { describe, expect, it } from 'vitest';
import { generatePuzzle } from '../../src/engine/generator';
import { CAT, DOG, EMPTY, type Puzzle, type Species } from '../../src/engine/types';
import { CASUAL_HEARTS, CASUAL_HEARTS_BEFORE_D44, CUP_HEARTS, rulesFor } from '../../src/game/modes';
import { MARK, Session, type SessionEvent } from '../../src/game/session';
import { captureSession, resumeSession } from '../../src/game/sessionPersistence';
import { puzzleFor } from '../../src/game/puzzles';
import { verifyAttempt } from '../../src/competitions/verify';
import { checkSolve } from '../../src/leaderboard/check';
import { currentSpec } from '../../src/game/puzzles';

const p = generatePuzzle({ size: 6, seed: 21 });

function cellWhere(s: Session, pz: Puzzle, want: number): [number, number] {
  for (let r = 0; r < pz.size; r++) for (let c = 0; c < pz.size; c++) if (!s.givenMask[r][c] && pz.solution[r][c] === want) return [r, c];
  throw new Error('no cell');
}

function casual(pz: Puzzle = p): Session {
  return new Session(pz, { maxHearts: CASUAL_HEARTS });
}

describe('heart allowance per mode', () => {
  it('casual boards start with three hearts (D44), Paw Cup keeps three, Zen has none', () => {
    expect(rulesFor({ kind: 'level', level: 12 }).maxHearts).toBe(3);
    expect(rulesFor({ kind: 'daily', dateKey: '2026-10-26' }).maxHearts).toBe(3);
    expect(rulesFor({ kind: 'cup', weekKey: '2026-W44', index: 0 }).maxHearts).toBe(3);
    expect(rulesFor({ kind: 'zen', size: 6, seed: 1 }).hearts).toBe(false);
    const s = casual();
    expect(s.hearts).toBe(3);
    expect(s.maxHearts).toBe(3);
  });

  it('the default stays at three (the original rule), so older callers are unchanged', () => {
    const s = new Session(p);
    expect(s.maxHearts).toBe(3);
    expect(s.hearts).toBe(3);
  });

  it('three wrong placements end a casual board, exactly once; a refill restores all three', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    for (let i = 0; i < 2; i++) s.place(r, c, CAT);
    expect(s.outcome).toBe('playing');
    expect(s.hearts).toBe(1);
    s.place(r, c, CAT);
    expect(s.outcome).toBe('lost');
    expect(s.claimOutcome()).toBe('lost');
    expect(s.claimOutcome()).toBeNull();
    // More taps after the loss change nothing.
    expect(s.place(r, c, CAT).ignored).toBe(true);
    expect(s.hearts).toBe(0);
    expect(s.mistakes).toBe(3);
    s.revive();
    expect(s.hearts).toBe(3);
  });
});

describe('wrong placements in a two-species game', () => {
  it('a Cat on a Dog tile costs one heart and leaves the tile exactly as it was (no ✕, no Dog)', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    const res = s.apply(r, c, 'cat');
    expect(res.wrong).toBe(true);
    expect(res.placed).toBe(CAT);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.hearts).toBe(2);
    expect(s.mistakes).toBe(1);
    expect(s.canUndo()).toBe(false); // nothing to undo, so undo can never refund the heart
  });

  it('a Dog on a Cat tile the player had marked ✕ keeps the ✕ and reveals nothing', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, CAT);
    s.apply(r, c, 'mark');
    expect(s.cells[r][c]).toBe(MARK);
    const res = s.apply(r, c, 'dog');
    expect(res.wrong).toBe(true);
    expect(s.cells[r][c]).toBe(MARK);
    expect(s.hearts).toBe(2);
  });

  it('a Cat on an empty tile is a mistake too, and the tile stays empty', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, EMPTY);
    expect(s.apply(r, c, 'cat').wrong).toBe(true);
    expect(s.cells[r][c]).toBe(EMPTY);
  });

  it('never charges for givens, the other pet on a placed tile, or no-op taps', () => {
    const s = casual();
    const g = p.givens[0];
    expect(s.apply(g.r, g.c, g.kind === CAT ? 'dog' : 'cat').ignored).toBe(true);
    const [r, c] = cellWhere(s, p, CAT);
    s.apply(r, c, 'cat');
    expect(s.apply(r, c, 'dog').ignored).toBe(true); // a Dog never silently replaces a Cat
    expect(s.cells[r][c]).toBe(CAT);
    const [er, ec] = cellWhere(s, p, EMPTY);
    expect(s.apply(er, ec, 'erase').ignored).toBe(true);
    expect(s.hearts).toBe(3);
    expect(s.mistakes).toBe(0);
  });

  it('tapping a placed pet with its own tool clears it without a mistake', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.apply(r, c, 'dog');
    expect(s.apply(r, c, 'dog').cleared).toBe(true);
    expect(s.cells[r][c]).toBe(EMPTY);
    expect(s.hearts).toBe(3);
  });

  it('a double-fired tap on a wrong tile charges twice only because it is two placements, and both are logged', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.apply(r, c, 'cat');
    s.apply(r, c, 'cat');
    expect(s.hearts).toBe(1);
    expect(s.events.filter((e) => e.type === 'place')).toHaveLength(2);
  });
});

describe('saving and resuming with the new allowance', () => {
  it('round-trips a three-heart board', () => {
    const s = casual();
    const [r, c] = cellWhere(s, p, DOG);
    s.place(r, c, CAT);
    const snap = s.snapshot();
    expect(snap.maxHearts).toBe(3);
    const t = Session.restore(p, snap, { maxHearts: CASUAL_HEARTS })!;
    expect(t.hearts).toBe(2);
    expect(t.maxHearts).toBe(3);
  });

  it('D44: a board saved under five hearts finishes under five (it never gets harder halfway through)', () => {
    const before = new Session(p, { maxHearts: CASUAL_HEARTS_BEFORE_D44 });
    const [r, c] = cellWhere(before, p, DOG);
    before.place(r, c, CAT);
    before.place(r, c, CAT); // 3 of 5 left
    const t = Session.restore(p, before.snapshot(), { maxHearts: CASUAL_HEARTS })!;
    expect(t.maxHearts).toBe(5);
    expect(t.hearts).toBe(3);
    // A third mistake leaves it playing (it would end a new board); the fifth ends it, and a revive refills five.
    t.place(r, c, CAT);
    expect(t.outcome).toBe('playing');
    t.place(r, c, CAT);
    t.place(r, c, CAT);
    expect(t.outcome).toBe('lost');
    t.revive();
    expect(t.hearts).toBe(5);
  });

  it('a board saved by a build without an allowance (the original three) keeps its mistakes', () => {
    const old = new Session(p);
    const [r, c] = cellWhere(old, p, DOG);
    old.place(r, c, CAT); // 2 of 3 left
    const snap = old.snapshot();
    delete snap.maxHearts; // what an older build wrote
    const t = Session.restore(p, snap, { maxHearts: CASUAL_HEARTS })!;
    expect(t.maxHearts).toBe(3);
    expect(t.hearts).toBe(2);
    expect(t.mistakes).toBe(1);
  });

  it('resumes a saved Journey board with three hearts through the real persistence path', () => {
    const mode = { kind: 'level' as const, level: 14 };
    const pz = puzzleFor(mode);
    const s = new Session(pz, { maxHearts: CASUAL_HEARTS });
    const [r, c] = cellWhere(s, pz, CAT);
    s.place(r, c, CAT);
    const saved = captureSession(mode, s)!;
    const back = resumeSession(saved)!;
    expect(back.session.maxHearts).toBe(3);
    expect(back.session.hearts).toBe(3);
    expect(back.session.cells[r][c]).toBe(CAT);
  });

  it('a Paw Cup board resumes at three hearts', () => {
    const mode = { kind: 'cup' as const, weekKey: '2026-W44', index: 0 };
    const pz = puzzleFor(mode);
    const s = new Session(pz, { maxHearts: CUP_HEARTS });
    const saved = captureSession(mode, s)!;
    expect(resumeSession(saved)!.session.maxHearts).toBe(3);
  });
});

describe('Paw Cup verification keeps its three-heart rule', () => {
  it('three wrong placements end a ranked attempt', () => {
    const [r, c] = cellWhere(new Session(p), p, DOG);
    const events: SessionEvent[] = [1000, 2000, 3000].map((t) => ({ t, type: 'place', r, c, s: CAT as Species }));
    // Then the player keeps going: every remaining correct placement.
    let t = 4000;
    for (let rr = 0; rr < p.size; rr++)
      for (let cc = 0; cc < p.size; cc++) {
        const v = p.solution[rr][cc];
        if (v === EMPTY || p.givens.some((g) => g.r === rr && g.c === cc)) continue;
        events.push({ t: (t += 1000), type: 'place', r: rr, c: cc, s: v as Species });
      }
    const res = verifyAttempt({ puzzle: p, events, parSeconds: 150, ranked: true });
    expect(res.mistakes).toBe(3);
    expect(res.completed).toBe(false);
  });
});

describe('the leaderboard server, after D44', () => {
  /** A Journey board's log: `wrong` wrong placements, then every remaining correct one, a second apart. */
  function log(mode: { kind: 'level'; level: number }, wrong: number): SessionEvent[] {
    const pz = puzzleFor(mode);
    const [r, c] = cellWhere(new Session(pz), pz, EMPTY);
    const events: SessionEvent[] = Array.from({ length: wrong }, (_, i) => ({ t: 1000 * (i + 1), type: 'place' as const, r, c, s: CAT as Species }));
    let t = 1000 * (wrong + 1);
    for (let rr = 0; rr < pz.size; rr++)
      for (let cc = 0; cc < pz.size; cc++) {
        const v = pz.solution[rr][cc];
        if (v === EMPTY || pz.givens.some((g) => g.r === rr && g.c === cc)) continue;
        events.push({ t: (t += 1000), type: 'place', r: rr, c: cc, s: v as Species });
      }
    return events;
  }

  it('still accepts a Journey board started under five hearts that made four mistakes', () => {
    const mode = { kind: 'level' as const, level: 12 };
    const sub = { mode, spec: currentSpec(mode) as 1 | 2 | 3 | 4, events: log(mode, 4) };
    const r = checkSolve(sub, new Date('2026-11-09T12:00:00Z'));
    expect(r.ok).toBe(true);
    // A board that made five mistakes was lost under either rule (and never revived), so it isn't a solve.
    expect(checkSolve({ ...sub, events: log(mode, 5) }, new Date('2026-11-09T12:00:00Z')).ok).toBe(false);
  });
});
