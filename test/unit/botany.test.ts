/**
 * D47 PR 1: the drawn botany. Meadows are the same every time for the same place, keep clear of where animals stand
 * and of paths, stay light (a scene is re-drawn on every frame of a camera glide), and never write a NaN into a path.
 * Compact path data decodes back to the points it was given. Map thumbnails leave the meadow out.
 */
import { describe, expect, it } from 'vitest';
import { BUTTERFLY_KINDS, meadowNoise, seedOf, seeded } from '../../src/art/botany';
import { butterfly, compact, meadow, place, stripMeadow } from '../../src/ui/art/botany';
import { regionScene, regionThumb } from '../../src/ui/art/regions';

/** Decodes compact path data (M, m, l, c, q, z) to absolute points, rounded to tenths. */
function decode(d: string): number[][] {
  const toks = d.match(/[MmlcqzZ]|-?\d*\.?\d+/g) ?? [];
  const out: number[][] = [];
  let x = 0;
  let y = 0;
  let sx = 0;
  let sy = 0;
  let cmd = '';
  for (let i = 0; i < toks.length; ) {
    if (/[a-z]/i.test(toks[i])) cmd = toks[i++];
    if (cmd === 'z' || cmd === 'Z') {
      x = sx;
      y = sy;
      continue;
    }
    const per = cmd === 'c' ? 3 : cmd === 'q' ? 2 : 1;
    const pts: number[] = [];
    for (let k = 0; k < per; k++) {
      const a = +toks[i++];
      const b = +toks[i++];
      pts.push(cmd === 'M' ? a : x + a, cmd === 'M' ? b : y + b);
    }
    x = pts[pts.length - 2];
    y = pts[pts.length - 1];
    if (cmd === 'M' || cmd === 'm') {
      sx = x;
      sy = y;
    }
    out.push(pts.map((v) => Math.round(v * 10) / 10));
  }
  return out;
}

const elements = (svg: string) => (svg.match(/<(path|g|circle|use|clipPath|ellipse|rect|polygon)\b/g) ?? []).length;

describe('compact path data', () => {
  it('decodes to the points it was given, rounded to tenths', () => {
    const d = 'M10.25 20C12 18 14 16 15.5 12.04C16 14 17.3 18 19 20Z M30 40L31.1 39.9Q33 35 34 41Z';
    expect(decode(compact(d))).toEqual([[10.3, 20], [12, 18, 14, 16, 15.5, 12], [16, 14, 17.3, 18, 19, 20], [30, 40], [31.1, 39.9], [33, 35, 34, 41]]);
  });

  it('can be joined end to end (each starts absolute)', () => {
    const a = compact('M5 5L6 6Z');
    const b = compact('M100 100L101 101Z');
    expect(decode(a + b)).toEqual([[5, 5], [6, 6], [100, 100], [101, 101]]);
  });

  it('moves shapes by a transform', () => {
    expect(decode(place('M0 0L1 0', [2, 0, 0, 2, 10, 20]))).toEqual([[10, 20], [12, 20]]);
    // A quarter turn: (1, 0) goes to (0, 1).
    expect(decode(place('M0 0L1 0', [0, 1, -1, 0, 0, 0]))).toEqual([[0, 0], [0, 1]]);
  });
});

describe('meadow', () => {
  const opts = { top: () => 130, seed: seedOf('test-meadow'), density: 0.62, avoid: [[180, 230, 30] as [number, number, number]], clear: (x: number) => Math.abs(x - 300) < 10 };

  it('is the same every time for the same seed, and different for another', () => {
    const a = meadow('t', opts);
    expect(meadow('t', opts).svg).toBe(a.svg);
    expect(meadow('t', { ...opts, seed: 7 }).svg).not.toBe(a.svg);
  });

  it('keeps clear of where animals stand and of paths', () => {
    const { roots } = meadow('t', opts);
    expect(roots.length).toBeGreaterThan(60);
    for (const [x, y] of roots) {
      expect(((x - 180) / 30) ** 2 + ((y - 230) / (30 / 1.4)) ** 2).toBeGreaterThanOrEqual(1);
      expect(Math.abs(x - 300)).toBeGreaterThanOrEqual(10);
      expect(y).toBeGreaterThan(130);
    }
  });

  it('grows in thick and thin patches, not a grid', () => {
    const { roots } = meadow('t', { ...opts, avoid: [], clear: undefined });
    // Count plants in 60 x 40 windows: some windows are much fuller than others.
    const counts = new Map<string, number>();
    for (const [x, y] of roots) {
      const k = `${Math.floor(x / 60)},${Math.floor((y - 130) / 40)}`;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    const v = [...counts.values()];
    expect(Math.max(...v) - Math.min(...v)).toBeGreaterThanOrEqual(3);
  });

  it('never writes NaN or undefined, and stays light', () => {
    const { svg } = meadow('t', { ...opts, butterflies: [...BUTTERFLY_KINDS] });
    expect(svg).not.toMatch(/NaN|undefined|Infinity/);
    expect(elements(svg)).toBeLessThan(1400);
    expect(svg.length).toBeLessThan(200_000);
  });

  it('is one ambient part, with a few swaying clumps', () => {
    const { svg } = meadow('t', { ...opts, swaying: 6 });
    expect(svg.match(/class="sp-meadow"/g)).toHaveLength(1);
    expect(svg).not.toMatch(/data-stage=/);
    expect((svg.match(/class="sp-grass"/g) ?? []).length).toBeGreaterThanOrEqual(6);
  });
});

describe('butterflies', () => {
  it('draws every species without NaN, with mirrored wings and its own ids', () => {
    for (const k of BUTTERFLY_KINDS) {
      const svg = butterfly(100, 100, k, { id: 'x' });
      expect(svg).not.toMatch(/NaN|undefined/);
      expect(svg).toContain(`data-bf="${k}"`);
      expect(svg).toMatch(/<use href="#x-bf\d+w"\/>/);
      expect(svg).toContain('class="sp-birds sp-bf"');
    }
    const ids = [butterfly(1, 1, 'monarch', { id: 'x' }), butterfly(1, 1, 'monarch', { id: 'x' })].map((s) => s.match(/id="([^"]+)"/)?.[1]);
    expect(ids[0]).not.toBe(ids[1]);
  });
});

describe('scenes', () => {
  it('the Farm and the grassland grow a meadow, and their map cards leave it out', () => {
    for (const r of ['farm', 'p6'] as const) {
      const scene = regionScene(r, { stage: 4, companions: [], decor: [] }, `s${r}`);
      expect(scene).toContain('sp-meadow');
      expect(scene).not.toMatch(/NaN|undefined/);
      expect(elements(scene)).toBeLessThan(1600);
      const thumb = regionThumb(r, 4, `t${r}`);
      expect(thumb).not.toContain('sp-meadow');
      // About what a card weighed before D47 (Farm 377, grassland 487 elements): the map draws many at once.
      expect(elements(thumb)).toBeLessThan(r === 'farm' ? 420 : 560);
    }
  });

  it('strips only the meadow', () => {
    expect(stripMeadow('<a/><!--meadow--><g>x</g><!--/meadow--><b/>')).toBe('<a/><b/>');
  });
});

describe('shared randomness', () => {
  it('is seeded and smooth', () => {
    const a = seeded(3);
    const b = seeded(3);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
    expect(Math.abs(meadowNoise(1, 1, 5) - meadowNoise(1.01, 1, 5))).toBeLessThan(0.05);
    expect(seedOf('farm')).toBe(seedOf('farm'));
  });
});
