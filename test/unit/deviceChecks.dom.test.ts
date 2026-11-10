// @vitest-environment happy-dom
/**
 * D46 PR C: the tester build's device checks. The frame summary and its verdict, the report's text, and the
 * listening list covering every cue a player hears.
 */
import { describe, expect, it } from 'vitest';
import { frameStats, listeningList, reportText, verdict } from '../../src/ui/components/deviceChecks';
import { TRICKS } from '../../src/meta/catalogs/tricks';
import { THEME_HOMES } from '../../src/audio/scores';

describe('device checks (D46 PR C)', () => {
  it('summarises frames: median fps, 95th-percentile time, share of slow frames, worst', () => {
    const steady = Array.from({ length: 120 }, () => 16.7);
    expect(frameStats(steady)).toMatchObject({ frames: 120, fps: 60, p95: 17, slow: 0 });
    expect(verdict(frameStats(steady))).toBe('Smooth');
    const choppy = [...Array.from({ length: 80 }, () => 22), ...Array.from({ length: 20 }, () => 60)];
    const s = frameStats(choppy);
    expect(s.fps).toBe(45);
    expect(s.slow).toBeCloseTo(0.2);
    expect(s.worst).toBe(60);
    expect(verdict(s)).toBe('Slow');
    expect(verdict(frameStats(Array.from({ length: 60 }, () => 22)))).toBe('Fine');
    // A tab in the background (huge gaps) and nothing at all don't break it.
    expect(frameStats([16, 5000, 16]).frames).toBe(2);
    expect(frameStats([])).toMatchObject({ frames: 0, fps: 0 });
  });

  it('the report reads as plain text, and says when walking slowed down or a renderer was left behind', () => {
    const st = frameStats(Array.from({ length: 60 }, () => 16.7));
    const text = reportText({
      steps: [
        { step: 'Walk 1', stats: st, tier: 'high' },
        { step: 'Walk 3', stats: { ...st, fps: 40 }, tier: 'lite' },
      ],
      renderers: 2,
      walkTrend: 0.67,
      heapMB: null,
      device: 'iPhone · 390×844 @3x',
      when: '2026-11-10 12:00',
    });
    expect(text).toMatch(/Walk 1: Smooth · 60 fps/);
    expect(text).toMatch(/lite tier/);
    expect(text).toMatch(/67% \(slowing down\)/);
    expect(text).toMatch(/alive at the end: 2 \(expected 1\)/);
    expect(text).toMatch(/not reported/);
  });

  it('the listening list has the five big moments, the parade in every home, and every trick tune', () => {
    const groups = listeningList();
    const all = groups.flatMap((g) => g.items);
    expect(groups[0].items.map((i) => i.id)).toEqual(['triumph', 'welcome', 'bounce', 'jig', 'meadow']);
    expect(groups[1].items.map((i) => i.home)).toEqual([...THEME_HOMES]);
    for (const t of TRICKS) expect(all.some((i) => i.id === `trick:${t.id}`)).toBe(true);
  });
});
