// @vitest-environment happy-dom
/**
 * D44 PR D: group dances. The clips (shared by the drawing and the 3D toys) start and end at rest, follow the beat,
 * drop the newcomer in, turn guests toward it and land a different pose for each variant; animals dance their own
 * way (Cotton sways, Truffle wiggles, Juniper the bunny twirls); the choreographer times every part to the beat clock,
 * puts everyone back when stopped, and keeps still under reduced motion; the drawn dance CSS never loops forever.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DANCE_STYLES, danceClip, danceId, danceSections, parseDanceId, type DanceRole, type DanceSpec } from '../../src/three/dance';
import { performClip, TURN_CHANNELS, type ClipCtx } from '../../src/three/clips';
import { danceStyleFor, planDance, startDance } from '../../src/ui/components/dance';
import { SCORES } from '../../src/audio/scores';

const ctx = (body: ClipCtx['body'] = 'sit'): ClipCtx => ({ body, dir: 1, seed: 3 });
const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const spec = (role: DanceRole, style = 'sway' as DanceSpec['style'], variant = 0): DanceSpec => ({ role, style, variant, side: 'R', bpm: 132, beats: 16 });

describe('dance clips', () => {
  it('ids round-trip, bad ids are refused, and performClip knows them', () => {
    const d = spec('guest', 'twirl', 2);
    expect(parseDanceId(danceId(d))).toEqual(d);
    expect(parseDanceId('dance:guest:moonwalk:0:R:132:16')).toBeNull();
    expect(parseDanceId('dance:guest:sway:0:R:999:16')).toBeNull();
    expect(performClip(danceId(d))).toBe(danceClip(danceId(d)));
    expect(danceClip(danceId(d))!.ms).toBe(Math.round((16 * 60000) / 132));
  });

  it('every style, role and pose starts and ends at rest, and never gives a broken number', () => {
    for (const role of ['newcomer', 'guest', 'group'] as DanceRole[])
      for (const style of DANCE_STYLES)
        for (let v = 0; v < 4; v++) {
          const clip = danceClip(danceId(spec(role, style, v)))!;
          for (const t of [0, 1]) {
            const f = clip.frame(t, ctx());
            for (const [k, val] of Object.entries(f.pose)) {
              const x = (TURN_CHANNELS as readonly string[]).includes(k) ? wrap(val!) : val!;
              expect(Math.abs(x), `${role} ${style} ${v} ${k} at ${t}`).toBeLessThan(0.02);
            }
          }
          for (let i = 0; i <= 200; i++) for (const val of Object.values(clip.frame(i / 200, ctx()).pose)) expect(Number.isFinite(val)).toBe(true);
        }
  });

  it('the steps keep the beat: a hop is down on every beat and up between; a sway nods on the beat', () => {
    const hop = danceClip(danceId(spec('group', 'hop')))!;
    const at = (clip: typeof hop, beat: number) => clip.frame(beat / 16, ctx()).pose;
    expect(at(hop, 5).py ?? 0).toBeLessThan(0.01);
    expect(at(hop, 5.5).py!).toBeGreaterThan(0.1);
    const sway = danceClip(danceId(spec('group', 'sway')))!;
    expect(at(sway, 6).headPitch!).toBeGreaterThan(at(sway, 6.5).headPitch ?? 0);
  });

  it('hand-overs settle the short way: a twirler never spins its turns back, nor a newcomer its hello spin', () => {
    const totalTurn = (role: DanceRole, style: DanceSpec['style'], from: number, to: number) => {
      const clip = danceClip(danceId(spec(role, style)))!;
      let sum = 0;
      let prev = clip.frame(from / 16, ctx()).pose.yaw ?? 0;
      for (let b = from; b <= to; b += 0.01) {
        const y = clip.frame(b / 16, ctx()).pose.yaw ?? 0;
        sum += Math.abs(wrap(y - prev));
        prev = y;
      }
      return sum;
    };
    // Into the finish (beat 14) and out of the intro (beat 4): well under half a turn of movement, not five turns.
    expect(totalTurn('guest', 'twirl', 13.6, 14.3)).toBeLessThan(Math.PI / 2);
    expect(totalTurn('group', 'twirl', 13.6, 14.3)).toBeLessThan(Math.PI / 2);
    expect(totalTurn('newcomer', 'sway', 3.6, 4.1)).toBeLessThan(Math.PI / 2);
  });

  it('a newcomer leaps for joy and has landed by the second beat; a guest turns toward it', () => {
    const c = danceClip(danceId(spec('newcomer')))!;
    expect(c.frame(0.6 / 16, ctx()).pose.py!).toBeGreaterThan(0.8);
    expect(c.frame(1.02 / 16, ctx()).pose.py ?? 0).toBeLessThan(0.05);
    const g = danceClip(danceId({ ...spec('guest'), side: 'L' }))!;
    expect(g.frame(2.5 / 16, ctx()).pose.headYaw!).toBeLessThan(-0.3);
    const right = danceClip(danceId({ ...spec('guest'), side: 'R' }))!;
    expect(right.frame(2.5 / 16, ctx()).pose.headYaw!).toBeGreaterThan(0.3);
  });

  it('the finish lands two beats before the end with a different pose for each variant', () => {
    expect(danceSections({ role: 'guest', beats: 16 })).toEqual({ intro: 4, finish: 14, end: 16 });
    expect(danceSections({ role: 'group', beats: 8 })).toEqual({ intro: 0, finish: 6, end: 8 });
    const faces = new Set<string>();
    const poses = new Set<string>();
    for (let v = 0; v < 4; v++) {
      const f = danceClip(danceId(spec('guest', 'sway', v)))!.frame(14.6 / 16, ctx());
      faces.add(f.face!);
      poses.add(JSON.stringify(Object.keys(f.pose).sort()));
    }
    expect(faces.size).toBeGreaterThanOrEqual(3);
    expect(poses.size).toBeGreaterThanOrEqual(3);
  });

  it('big animals and seals bounce less than small ones', () => {
    const hop = danceClip(danceId(spec('group', 'hop')))!;
    expect(hop.frame(5.5 / 16, ctx('big')).pose.py!).toBeLessThan(hop.frame(5.5 / 16, ctx('sit')).pose.py! * 0.7);
    expect(hop.frame(5.5 / 16, ctx('seal')).pose.py!).toBeLessThan(hop.frame(5.5 / 16, ctx('sit')).pose.py! * 0.5);
  });
});

describe('who dances how', () => {
  it('kinds first: Cotton sways, Truffle wiggles, Juniper the bunny twirls; a seal pup bobs, an elephant stomps', () => {
    expect(danceStyleFor('cotton')).toBe('sway');
    expect(danceStyleFor('truffle')).toBe('wiggle');
    expect(danceStyleFor('juniper')).toBe('twirl');
    expect(danceStyleFor('pebble')).toBe('bob');
    expect(danceStyleFor('tembo')).toBe('stomp');
    for (const id of ['buttercup', 'pepper', 'marigold', 'hazel', 'gumnut', 'skipper', 'zuri', 'frost', 'rio', 'mango'])
      expect(DANCE_STYLES).toContain(danceStyleFor(id));
  });
});

function scene(): SVGSVGElement {
  document.body.innerHTML = `<figure class="sanctuary__scene is-live"><svg viewBox="0 0 360 300" data-vb="0 0 360 300">
    <g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-gx="80" data-gy="230" data-gh="40"></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="truffle" data-gx="170" data-gy="240" data-gh="34"></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="juniper" data-gx="260" data-gy="236" data-gh="30"></g>
    <g class="sanctuary__pet sanctuary__friend is-away" data-friend="buttercup" data-gx="300" data-gy="236" data-gh="30"></g>
  </svg></figure>`;
  return document.querySelector('svg')!;
}

describe('the choreographer', () => {
  let now = 0;
  beforeEach(() => {
    vi.useFakeTimers();
    now = 10_000;
    vi.spyOn(performance, 'now').mockImplementation(() => now);
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });
  const clock = () => {
    const start = now;
    const spb = 60000 / SCORES.bounce.bpm;
    return { score: SCORES.bounce, msAt: (b: number) => start + b * spb };
  };
  const run = (ms: number) => {
    now += ms;
    vi.advanceTimersByTime(ms);
  };

  it('plans a parade: the newcomer leads, guests turn its way, neighbours strike different poses, nobody away dances', () => {
    const plan = planDance(scene(), { bpm: 132, beats: 16, newcomer: 'truffle' });
    expect(plan.map((d) => d.animal)).toEqual(['cotton', 'truffle', 'juniper']);
    expect(plan.map((d) => d.spec.role)).toEqual(['guest', 'newcomer', 'guest']);
    expect(plan[0].spec.side).toBe('R');
    expect(plan[2].spec.side).toBe('L');
    expect(new Set(plan.map((d) => d.spec.variant)).size).toBe(3);
    expect(plan.map((d) => d.spec.style)).toEqual(['sway', 'wiggle', 'twirl']);
  });

  it('times every part to the beat, then puts everyone back', async () => {
    const svg = scene();
    const plan = planDance(svg, { bpm: 132, beats: 16, newcomer: 'truffle' });
    const parts: string[] = [];
    const h = startDance(svg, plan, clock(), { reducedMotion: false, onPart: (p) => parts.push(p) });
    const cotton = plan[0].fig;
    const truffle = plan[1].fig;
    expect(truffle.dataset.trick).toBe(plan[1].id);
    expect(truffle.classList.contains(`is-trick-${plan[1].id}`)).toBe(true);
    expect(truffle.classList.contains('is-dance-enter')).toBe(true);
    expect(cotton.classList.contains('is-dance-invite')).toBe(true);
    expect(cotton.style.getPropertyValue('--beat')).toMatch(/^454\.5ms$/);
    const spb = 60000 / 132;
    run(4 * spb + 5);
    expect(cotton.classList.contains('is-dance-sway')).toBe(true);
    expect(truffle.classList.contains('is-dance-wiggle')).toBe(true);
    run(10 * spb);
    expect(svg.querySelector('.sp-dance-confetti')).not.toBeNull();
    expect([...cotton.classList].some((c) => c.startsWith('is-dance-pose-'))).toBe(true);
    run(2 * spb + 10);
    await h.done;
    expect(parts).toEqual(['intro', 'dance', 'finish', 'end']);
    for (const d of plan) {
      expect(d.fig.dataset.trick).toBeUndefined();
      expect([...d.fig.classList].filter((c) => c.startsWith('is-dance') || c.startsWith('is-trick'))).toEqual([]);
    }
    expect(svg.querySelector('.sp-dance-confetti')).toBeNull();
  });

  it('a skip stops it at once and nothing comes back on a later beat', async () => {
    const svg = scene();
    const plan = planDance(svg, { bpm: 132, beats: 16 });
    expect(plan.every((d) => d.spec.role === 'group')).toBe(true);
    const h = startDance(svg, plan, clock(), { reducedMotion: false });
    run(2000);
    h.stop();
    h.stop();
    await h.done;
    run(10_000);
    for (const d of plan) {
      expect(d.fig.dataset.trick).toBeUndefined();
      expect(d.fig.classList.contains('is-dancing')).toBe(false);
    }
  });

  it('reduced motion: nobody moves, every dancer is busy and happy for the length, the confetti is still', () => {
    const svg = scene();
    const plan = planDance(svg, { bpm: 132, beats: 16, newcomer: 'cotton' });
    startDance(svg, plan, clock(), { reducedMotion: true });
    for (const d of plan) {
      expect(d.fig.classList.contains('is-dance-still')).toBe(true);
      expect([...d.fig.classList].some((c) => /^is-dance-(enter|invite|sway|wiggle|twirl|pose)/.test(c) || c.startsWith('is-trick-'))).toBe(false);
      expect(d.fig.dataset.trick).toBe(d.id);
    }
    run((14 * 60000) / 132 + 5);
    expect(svg.querySelector('.sp-dance-confetti.is-still')).not.toBeNull();
  });
});

describe('the drawn dance CSS', () => {
  const css = readFileSync('src/ui/styles/dance.css', 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  it('stays in the sanctuary scene, never loops forever, and every step has a dance style', () => {
    for (const [, sel] of css.matchAll(/([^{}@]+)\{[^{}]*\}/g))
      for (const one of sel.split(',').map((s) => s.trim())) {
        if (!one || /^(\d+(\.\d+)?%|from|to)$/.test(one)) continue;
        expect(one, one).toMatch(/\.sanctuary__scene/);
        expect(one).not.toMatch(/\.cell|\.board/);
      }
    expect(css).not.toMatch(/infinite/);
    for (const st of DANCE_STYLES) expect(css).toContain(`.is-dance-${st} {`);
    for (let v = 0; v < 4; v++) expect(css).toContain(`.is-dance-pose-${v} {`);
  });
});
