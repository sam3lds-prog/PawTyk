// @vitest-environment happy-dom
/**
 * D44 PR I: the walkable 3D Farm. Its world grows with the Farm's stage; the player walks round the barn, the pond
 * and the trees, never through them, and never off the edge; walking turns to face the way it goes; the ground rises
 * gently into hills past the bounds. Without 3D (no WebGL, or the setting off) the Walk button isn't offered.
 */
import { describe, expect, it } from 'vitest';
import {
  BOUNDS,
  FEATURES_BY_STAGE,
  PLACES,
  featuresAt,
  groundY,
  nudge,
  obstaclesAt,
  settle,
  stepWalker,
  turnToward,
  yawTo,
  type Walker,
} from '../../src/three/walkMath';
import { canWalk, walkButtonMarkup } from '../../src/ui/components/walk';

describe('the walkable Farm', () => {
  it('grows with the Farm: the barn from stage 2, the pond from 3, the orchard and windmill at 4', () => {
    expect(featuresAt(0)).toEqual([]);
    expect(featuresAt(1)).toEqual(FEATURES_BY_STAGE[1]);
    expect(featuresAt(2)).toContain('barn');
    expect(featuresAt(2)).not.toContain('pond');
    expect(featuresAt(4)).toEqual(expect.arrayContaining(['fence', 'barn', 'pond', 'orchard', 'windmill', 'sunflowers']));
    expect(obstaclesAt(1).some((o) => o.x === PLACES.barn.x)).toBe(false);
    expect(obstaclesAt(2).some((o) => o.x === PLACES.barn.x)).toBe(true);
  });

  it('nobody walks through the barn, the pond or off the edge', () => {
    const obs = obstaclesAt(4);
    const inBarn = settle(PLACES.barn.x, PLACES.barn.z, obs);
    expect(Math.abs(inBarn.x - PLACES.barn.x) > PLACES.barn.w / 2 || Math.abs(inBarn.z - PLACES.barn.z) > PLACES.barn.d / 2).toBe(true);
    const inPond = settle(PLACES.pond.x + 0.5, PLACES.pond.z, obs);
    expect(Math.hypot(inPond.x - PLACES.pond.x, inPond.z - PLACES.pond.z)).toBeGreaterThan(PLACES.pond.r);
    const far = settle(500, -500, obs);
    expect(far).toEqual({ x: BOUNDS, z: -BOUNDS });
    // Open grass is left alone.
    expect(settle(0, 15, obs)).toEqual({ x: 0, z: 15 });
  });

  it('walking to a spot turns toward it and arrives; a wall in the way stops it', () => {
    const w: Walker = { x: 0, z: 20, yaw: 0, target: { x: 6, z: 14 } };
    for (let i = 0; i < 400 && w.target; i++) stepWalker(w, 1 / 30, obstaclesAt(4));
    expect(w.target).toBeNull();
    expect(Math.hypot(w.x - 6, w.z - 14)).toBeLessThan(0.1);
    // Toward the barn's middle: stopped at its wall, not inside.
    const b: Walker = { x: PLACES.barn.x, z: PLACES.barn.z + 12, yaw: 0, target: { x: PLACES.barn.x, z: PLACES.barn.z } };
    for (let i = 0; i < 600 && b.target; i++) stepWalker(b, 1 / 30, obstaclesAt(4));
    expect(b.target).toBeNull();
    expect(b.z - PLACES.barn.z).toBeGreaterThan(PLACES.barn.d / 2);
  });

  it('turning goes the short way, and yaw 0 looks from the gate toward the barn', () => {
    // From 3 to -3 rad the short way is through π (+0.28), not back through 0 (-6).
    const t = turnToward(3, -3, 10);
    expect(t).toBeGreaterThan(3);
    expect(Math.atan2(Math.sin(t + 3), Math.cos(t + 3))).toBeCloseTo(0, 6);
    expect(Math.abs(turnToward(0.1, 6.2, 0.05) - 0.05)).toBeLessThan(1e-9);
    expect(yawTo(0, 20, 0, 0)).toBeCloseTo(0, 6);
    const w: Walker = { x: 0, z: 20, yaw: 0, target: null };
    nudge(w, 2, []);
    expect(w.z).toBeCloseTo(18, 6);
  });

  it('the middle is (nearly) flat; the edges rise gently into hills', () => {
    expect(Math.abs(groundY(0, 0))).toBeLessThan(0.05);
    expect(Math.abs(groundY(10, 10))).toBeLessThan(0.2);
    expect(groundY(55, 0)).toBeGreaterThan(2);
    expect(groundY(55, 0)).toBeLessThan(12);
  });

  it('without WebGL (here) the Walk button is not offered', () => {
    expect(canWalk()).toBe(false);
    expect(walkButtonMarkup(false)).toMatch(/data-act="walk" hidden/);
    expect(walkButtonMarkup(true)).not.toMatch(/data-act="walk" hidden/);
  });
});
