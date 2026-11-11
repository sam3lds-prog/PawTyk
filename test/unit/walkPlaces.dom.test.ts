// @vitest-environment happy-dom
/**
 * D45 PR C: the 3D Farm shows the same Farm as the drawn one (one shared description: stage, residents, the
 * decorations out, evening), has destinations with a way to walk to them and a map, and the scene's own 3D layer lets
 * go of its WebGL context while the walk is open.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ANIMAL_SPOTS,
  BOUNDS,
  DECOR_PLACES,
  LANDMARKS,
  PLACES,
  SPEED,
  clearLine,
  isFree,
  landmarkNear,
  landmarksAt,
  mapPoint,
  obstaclesAt,
  route,
  settle,
  stepWalker,
  type Walker,
} from '../../src/three/walkMath';
import { homeState, isEveningAt } from '../../src/meta/homeState';
import { defaultSave } from '../../src/services/storage';
import { setShown } from '../../src/meta/sanctuary';
import { regionScene } from '../../src/ui/art/regions';
import { DECOR } from '../../src/meta/catalogs/decor';

const ALL_DECOR = Object.keys(DECOR_PLACES);

describe('the player’s decorations stand on the 3D Farm', () => {
  it('there is a place for every Farm decoration in the catalog, and only those', () => {
    const farm = DECOR.filter((d) => d.sanctuary === 'farm').map((d) => d.id as string);
    expect(ALL_DECOR.sort()).toEqual(farm.sort());
  });

  it('they are solid: the player walks round them, and only the ones that are out', () => {
    const none = obstaclesAt(4);
    const all = obstaclesAt(4, ALL_DECOR);
    // D48 PR C: the pond's fountain stands in the pond, which is solid already.
    const solid = ALL_DECOR.filter((id) => DECOR_PLACES[id as keyof typeof DECOR_PLACES].solid !== false);
    expect(all.length).toBe(none.length + solid.length);
    for (const id of solid) {
      const p = DECOR_PLACES[id as keyof typeof DECOR_PLACES];
      expect(isFree(p.x, p.z, none), id).toBe(true);
      expect(isFree(p.x, p.z, all), id).toBe(false);
      const s = settle(p.x, p.z, obstaclesAt(4, [id]));
      expect(Math.hypot(s.x - p.x, s.z - p.z), id).toBeGreaterThan(0.4);
    }
    // Something that isn't a Farm decoration is ignored.
    expect(obstaclesAt(4, ['campfire', 'nonsense']).length).toBe(none.length);
  });

  it('none stands inside a building, the pond, another decoration, or on an animal’s spot', () => {
    const built = obstaclesAt(4);
    for (const id of ALL_DECOR) {
      const p = DECOR_PLACES[id as keyof typeof DECOR_PLACES];
      // D48 PR C: the pond's fountain stands in the pond's water, on purpose.
      if (p.solid !== false) expect(isFree(p.x, p.z, built, 1), id).toBe(true);
      expect(Math.abs(p.x) < BOUNDS - 4 && Math.abs(p.z) < BOUNDS - 4, id).toBe(true);
      for (const [ax, az] of ANIMAL_SPOTS) expect(Math.hypot(ax - p.x, az - p.z), `${id} vs spot`).toBeGreaterThan(2);
      for (const other of ALL_DECOR) {
        if (other === id) continue;
        const q = DECOR_PLACES[other as keyof typeof DECOR_PLACES];
        // Pieces of one spot share it (only one is ever out); everything else keeps its distance.
        if (p.spot && p.spot === q.spot) {
          expect([q.x, q.z], `${id} and ${other} share their spot`).toEqual([p.x, p.z]);
          continue;
        }
        expect(Math.hypot(q.x - p.x, q.z - p.z), `${id} vs ${other}`).toBeGreaterThan(4);
      }
    }
  });
});

describe('destinations', () => {
  it('the pasture from the start, the barn from stage 2, the pond from 3, the orchard at 4', () => {
    expect(landmarksAt(1).map((l) => l.id)).toEqual(['pasture']);
    expect(landmarksAt(2).map((l) => l.id)).toEqual(['pasture', 'barn']);
    expect(landmarksAt(3).map((l) => l.id)).toEqual(['pasture', 'barn', 'pond']);
    expect(landmarksAt(4).map((l) => l.id).sort()).toEqual(['barn', 'orchard', 'pasture', 'pond']);
  });

  it('each has somewhere free to stand, from where the player is at that place and no other', () => {
    const obs = obstaclesAt(4, ALL_DECOR);
    for (const l of LANDMARKS) {
      expect(isFree(l.stand.x, l.stand.z, obs, 0.55), l.id).toBe(true);
      expect(Math.hypot(l.stand.x - l.at.x, l.stand.z - l.at.z), l.id).toBeLessThan(l.range);
      expect(landmarkNear(l.stand.x, l.stand.z, 4)?.id, l.id).toBe(l.id);
      expect(l.discovery.length, l.id).toBeGreaterThan(10);
    }
  });

  it('at the gate the player is nowhere in particular; a place not built yet is not a place', () => {
    expect(landmarkNear(PLACES.start.x, PLACES.start.z, 4)).toBeNull();
    const pond = LANDMARKS.find((l) => l.id === 'pond')!;
    expect(landmarkNear(pond.stand.x, pond.stand.z, 2)?.id).not.toBe('pond');
  });

  it('the map keeps every point inside it, the gate at the bottom', () => {
    expect(mapPoint(0, 0)).toEqual({ u: 0.5, v: 0.5 });
    expect(mapPoint(PLACES.start.x, PLACES.start.z).v).toBeGreaterThan(0.7);
    expect(mapPoint(-999, 999)).toEqual({ u: 0, v: 1 });
  });
});

describe('finding the way', () => {
  const obs = obstaclesAt(4, ALL_DECOR);
  // As the walk follows a route: turning on the spot before each leg (`pivot`).
  const walk = (from: { x: number; z: number }, to: { x: number; z: number }, o: { yaw?: number; hz?: number; pivot?: boolean } = {}) => {
    const w: Walker = { x: from.x, z: from.z, yaw: o.yaw ?? 0, target: null };
    const path = route(w, to, obs);
    const dt = 1 / (o.hz ?? 30);
    let t = 0;
    for (const p of path) {
      w.target = p;
      while (w.target && t < 90) {
        stepWalker(w, dt, obs, o.pivot ?? true);
        t += dt;
      }
    }
    return { w, t, path };
  };

  it('a straight line when nothing is in the way', () => {
    expect(route({ x: 0, z: 20 }, { x: 0, z: 14 }, obs)).toEqual([{ x: 0, z: 14 }]);
  });

  it('round the barn: every leg is clear, and the walker arrives', () => {
    const from = { x: 20, z: -12 };
    const to = { x: 2, z: -16 };
    expect(clearLine(from, to, obs)).toBe(false);
    const { w, path } = walk(from, to);
    expect(path.length).toBeGreaterThan(1);
    let at = from;
    for (const p of path) {
      expect(clearLine(at, p, obs)).toBe(true);
      at = p;
    }
    expect(Math.hypot(w.x - to.x, w.z - to.z)).toBeLessThan(0.3);
  });

  it('from the gate and from every destination to every other, the walker gets there in good time', () => {
    const spots = [{ id: 'gate', stand: { x: PLACES.start.x, z: PLACES.start.z } }, ...LANDMARKS];
    for (const a of spots)
      for (const b of LANDMARKS) {
        if (a.id === b.id) continue;
        const { w, t } = walk(a.stand, b.stand);
        expect(Math.hypot(w.x - b.stand.x, w.z - b.stand.z), `${a.id} → ${b.id}`).toBeLessThan(0.6);
        // No long way round: within three times the straight walk (plus turning).
        expect(t, `${a.id} → ${b.id}`).toBeLessThan((Math.hypot(a.stand.x - b.stand.x, a.stand.z - b.stand.z) / SPEED) * 3 + 6);
      }
  });

  it('facing the wrong way beside a decoration: it turns on the spot first, and does not curve into it (D45 review)', () => {
    // Beside the trough, facing away from the pond: the straight line is clear, an arc is not.
    const pond = LANDMARKS.find((l) => l.id === 'pond')!;
    const from = { x: 15, z: 2.5 };
    expect(route(from, pond.stand, obs).length).toBeGreaterThanOrEqual(1);
    for (const hz of [30, 60]) {
      const { w } = walk(from, pond.stand, { yaw: 0, hz });
      expect(Math.hypot(w.x - pond.stand.x, w.z - pond.stand.z), `${hz} Hz`).toBeLessThan(0.6);
    }
    // Without the pivot (a plain tap-and-go arc) this is the walk that used to stop short.
    const arc = walk(from, pond.stand, { yaw: 0, hz: 60, pivot: false });
    expect(Math.hypot(arc.w.x - pond.stand.x, arc.w.z - pond.stand.z)).toBeGreaterThan(1);
  });

  it('pivoting: the walker does not move until it faces the way', () => {
    const w: Walker = { x: 0, z: 20, yaw: Math.PI, target: { x: 0, z: 10 } };
    stepWalker(w, 1 / 30, obs, true);
    expect(w.z).toBe(20);
    expect(w.yaw).not.toBe(Math.PI);
    for (let i = 0; i < 400 && w.target; i++) stepWalker(w, 1 / 30, obs, true);
    expect(Math.hypot(w.x, w.z - 10)).toBeLessThan(0.3);
  });

  it('a goal inside something ends beside it', () => {
    const path = route({ x: 0, z: 20 }, { x: PLACES.pond.x, z: PLACES.pond.z }, obs);
    const end = path[path.length - 1];
    expect(Math.hypot(end.x - PLACES.pond.x, end.z - PLACES.pond.z)).toBeGreaterThan(PLACES.pond.r);
  });
});

describe('one description of the Farm for both pictures', () => {
  const save = () => {
    const s = defaultSave(new Date(2026, 9, 31, 12));
    s.world.growth.farm = 12;
    for (const id of ['truffle', 'cotton']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
    for (const id of ['tractor', 'trough', 'scarecrow']) s.inventory.decor[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' } as never;
    setShown(s, 'tractor' as never, true);
    setShown(s, 'trough' as never, true);
    setShown(s, 'scarecrow' as never, false);
    return s;
  };

  it('stage, residents in arrival order, only the decorations that are out, and the time of day', () => {
    const st = homeState(save(), 'farm', new Date(2026, 9, 31, 12));
    expect(st.open).toBe(true);
    expect(st.stage).toBeGreaterThanOrEqual(1);
    expect(st.residents).toEqual(['cotton', 'truffle']);
    expect([...st.decor].sort()).toEqual(['tractor', 'trough']);
    expect(st.evening).toBe(false);
    expect(homeState(save(), 'farm', new Date(2026, 9, 31, 21)).evening).toBe(true);
    expect(isEveningAt(new Date(2026, 9, 31, 5))).toBe(true);
    expect(isEveningAt(new Date(2026, 9, 31, 6))).toBe(false);
  });

  it('a home that isn’t open yet has no stage', () => {
    const st = homeState(defaultSave(new Date(2026, 9, 31, 12)), 'outback');
    expect(st.open).toBe(false);
    expect(st.stage).toBe(0);
    expect(st.residents).toEqual([]);
  });

  it('the drawn Farm and the 3D Farm show the same decorations and residents', () => {
    const st = homeState(save(), 'farm', new Date(2026, 9, 31, 12));
    document.body.innerHTML = `<svg>${regionScene('farm', { stage: st.stage, companions: st.residents as never[], decor: st.decor, evening: st.evening }, 't')}</svg>`;
    const drawnDecor = [...document.querySelectorAll<SVGElement>('[data-decor]')].map((g) => g.dataset.decor).sort();
    const drawnAnimals = [...document.querySelectorAll<SVGElement>('.sanctuary__pet[data-friend]')].map((g) => g.dataset.friend).sort();
    // What the walk builds: every decoration with a 3D place, the same residents.
    const walkDecor = st.decor.filter((d) => d in DECOR_PLACES).sort();
    expect(walkDecor).toEqual(drawnDecor);
    expect([...st.residents].sort()).toEqual(drawnAnimals);
  });
});

describe('one 3D renderer at a time', () => {
  const made: Array<{ disposed: boolean; attached: number }> = [];
  beforeEach(() => {
    made.length = 0;
    vi.resetModules();
    vi.doMock('../../src/three/stage', () => ({
      SceneStage: class {
        disposed = false;
        attached = 0;
        constructor() {
          made.push(this);
        }
        setLive() {}
        setView() {}
        attach() {
          this.attached++;
        }
        dispose() {
          this.disposed = true;
        }
      },
    }));
    // happy-dom has no WebGL: stand one in so the scene wants its toys.
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({ getExtension: () => null } as never);
  });
  afterEach(() => {
    vi.doUnmock('../../src/three/stage');
    vi.restoreAllMocks();
  });

  it('suspend releases the scene’s stage (its WebGL context); resume builds it again on the same scene', async () => {
    const { createScene3D } = await import('../../src/ui/components/scene3d');
    document.body.innerHTML = '<figure class="sanctuary__scene"><svg></svg></figure>';
    const s3d = createScene3D();
    s3d.attach(document.querySelector('figure'), document.querySelector('svg'));
    await vi.waitFor(() => expect(made.length).toBe(1));
    expect(s3d.drawing).toBe(true);
    s3d.suspend();
    expect(made[0].disposed).toBe(true);
    expect(s3d.drawing).toBe(false);
    // Nothing is built while suspended, even if the scene re-renders.
    s3d.attach(document.querySelector('figure'), document.querySelector('svg'));
    await new Promise((r) => setTimeout(r, 20));
    expect(made.length).toBe(1);
    s3d.resume();
    await vi.waitFor(() => expect(made.length).toBe(2));
    expect(made[1].attached).toBe(1);
    expect(made[1].disposed).toBe(false);
    expect(s3d.drawing).toBe(true);
    s3d.dispose();
    expect(made[1].disposed).toBe(true);
  });

  it('suspended before three.js has loaded: no stage is made until resume', async () => {
    const { createScene3D } = await import('../../src/ui/components/scene3d');
    document.body.innerHTML = '<figure class="sanctuary__scene"><svg></svg></figure>';
    const s3d = createScene3D();
    s3d.attach(document.querySelector('figure'), document.querySelector('svg'));
    s3d.suspend();
    await new Promise((r) => setTimeout(r, 30));
    expect(made.length).toBe(0);
    s3d.resume();
    await vi.waitFor(() => expect(made.length).toBe(1));
    s3d.dispose();
  });
});
