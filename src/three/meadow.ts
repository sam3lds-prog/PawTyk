/**
 * The 3D Farm's meadow (D47 PR 1): grass, wildflowers, clover and butterflies for the walk, from the same species and
 * colours as the drawn Farm (`art/botany.ts`).
 *
 * Grass is clumps of curved, tapered blades shaded from root to tip, drawn as instances (a few draw calls for
 * thousands of clumps, in chunks the camera can skip when they are behind it); flowers are one instanced mesh per
 * kind; a breeze sways them in the vertex shader (a gust travels across the Farm), and stops under reduced motion.
 * Butterflies have the drawn species' wings (painted once into a small texture from the same shapes), rest on flowers
 * with their wings opening now and then, fly off on wandering, curving paths and land on another flower, and take off
 * if the player walks right up to them. The pasture's discovery sends its butterflies up together.
 *
 * Everything it makes goes into `disposables` (the walk frees them with the rest). The lite tier shows fewer of
 * everything, and a walk that drops to lite part-way thins its meadow at once.
 */

import * as THREE from 'three';
import { BUTTERFLIES, FLOWERS, GRASS, WING, seedOf, seeded, type ButterflyKind } from '../art/botany';
import { BLOOM_HEIGHT, BLOOM_KINDS, FIELD_TILE, FLOWER_SCALE, MEADOW_COUNTS, MEADOW_RADIUS, PASTURE_HOME, fieldMask, meadowLayout, type BloomKind, type MeadowLayout, type MeadowTier, type Perch } from './meadowLayout';

const col = (c: string) => new THREE.Color(c);

// ------------------------------------------------------------------ building geometry

/** Triangles gathered into one geometry: positions, normals, colours, and how much each vertex sways in the breeze. */
class Mesher {
  pos: number[] = [];
  nor: number[] = [];
  col: number[] = [];
  sway: number[] = [];
  /** A triangle; `n` its normal (meadow normals point up, so both sides are lit like the ground). */
  tri(a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, ca: THREE.Color, cb: THREE.Color, cc: THREE.Color, sa: number, sb: number, sc: number, n: THREE.Vector3): void {
    this.pos.push(a.x, a.y, a.z, b.x, b.y, b.z, c.x, c.y, c.z);
    for (let i = 0; i < 3; i++) this.nor.push(n.x, n.y, n.z);
    this.col.push(ca.r, ca.g, ca.b, cb.r, cb.g, cb.b, cc.r, cc.g, cc.b);
    this.sway.push(sa, sb, sc);
  }
  /** A three.js shape moved into place, in one colour, swaying by its height (`sway` per metre up), normals up. */
  shape(g: THREE.BufferGeometry, m: THREE.Matrix4, c: THREE.Color, sway: (y: number) => number, up = 0.75): void {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.applyMatrix4(m);
    const p = ng.attributes.position as THREE.BufferAttribute;
    const nn = ng.attributes.normal as THREE.BufferAttribute | undefined;
    const n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      this.pos.push(p.getX(i), p.getY(i), p.getZ(i));
      // Mostly up, a little of the shape's own: soft, like the ground's light, with a hint of roundness.
      if (nn) n.set(nn.getX(i), nn.getY(i), nn.getZ(i)).multiplyScalar(1 - up);
      else n.set(0, 0, 0);
      n.y += up;
      n.normalize();
      this.nor.push(n.x, n.y, n.z);
      this.col.push(c.r, c.g, c.b);
      this.sway.push(sway(p.getY(i)));
    }
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.setAttribute('aSway', new THREE.Float32BufferAttribute(this.sway, 1));
    g.computeBoundingSphere();
    return g;
  }
}

/**
 * A clump of grass: blades upright at the root and curving over toward the tip, tapering to a point, each leaning its
 * own way, shaded from a dark root to a sunlit tip. `blades` of them, about `h` tall.
 */
export function clumpGeometry(seed: number, blades: number, h: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const m = new Mesher();
  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * Math.PI * 2 + r() * 0.8;
    const off = 0.015 + r() * 0.05;
    const bx = Math.cos(a) * off;
    const bz = Math.sin(a) * off;
    // Leaning outward, more or less.
    const lean = a + (r() - 0.5) * 1.2;
    const dx = Math.cos(lean);
    const dz = Math.sin(lean);
    const len = h * (0.6 + r() * 0.55);
    const bend = len * (0.2 + r() * 0.35);
    const w = 0.014 + r() * 0.012;
    const root = col(GRASS.root[Math.floor(r() * GRASS.root.length)]);
    const mid = col(GRASS.mid[Math.floor(r() * GRASS.mid.length)]);
    const tip = col(GRASS.tip[Math.floor(r() * GRASS.tip.length)]);
    const shade = (t: number) => (t < 0.5 ? root.clone().lerp(mid, t * 2) : mid.clone().lerp(tip, (t - 0.5) * 2));
    // Across the blade (perpendicular to its lean), and a slightly tilted normal so each blade catches the sun its way.
    const px = -dz;
    const pz = dx;
    const n = v(dx * 0.25, 1, dz * 0.25).normalize();
    const rows = 4;
    let prevL: THREE.Vector3 | null = null;
    let prevR: THREE.Vector3 | null = null;
    let prevT = 0;
    for (let k = 0; k <= rows; k++) {
      const t = k / rows;
      const cx = bx + dx * bend * t * t;
      const cz = bz + dz * bend * t * t;
      const cy = len * t * (1 - 0.18 * t * t);
      const half = w * Math.pow(1 - t, 0.85);
      const L = v(cx - px * half, cy, cz - pz * half);
      const R = v(cx + px * half, cy, cz + pz * half);
      if (prevL && prevR) {
        const c0 = shade(prevT);
        const c1 = shade(t);
        const s0 = prevT * prevT;
        const s1 = t * t;
        if (k === rows) m.tri(prevL, prevR, L, c0, c0, c1, s0, s0, s1, n);
        else {
          m.tri(prevL, prevR, R, c0, c0, c1, s0, s0, s1, n);
          m.tri(prevL, R, L, c0, c1, c1, s0, s1, s1, n);
        }
      }
      prevL = L;
      prevR = R;
      prevT = t;
    }
  }
  return m.build();
}

/** A ring of petals (thin, slightly cupped quads) round the origin, in the XZ plane. */
function petals(m: Mesher, mat: THREE.Matrix4, k: number, rIn: number, rOut: number, width: number, cup: number, c: THREE.Color, c2: THREE.Color, sway: number, twist = 0): void {
  const n = new THREE.Vector3(0, 1, 0);
  const p = (rad: number, a: number, y: number) => new THREE.Vector3(Math.cos(a) * rad, y, Math.sin(a) * rad).applyMatrix4(mat);
  for (let i = 0; i < k; i++) {
    const a = (i / k) * Math.PI * 2 + twist;
    const wa = width / rOut;
    const base = p(rIn, a, 0);
    const l = p(rOut * 0.7, a - wa, cup * 0.5);
    const rr = p(rOut * 0.7, a + wa, cup * 0.5);
    const tip = p(rOut, a, cup);
    m.tri(base, rr, l, c2, c, c, sway, sway, sway, n);
    m.tri(l, rr, tip, c, c, c, sway, sway, sway, n);
  }
}

/** One flower of a kind, its stem rooted at the origin, as one geometry (the meadow draws each kind as instances). */
export function bloomGeometry(kind: BloomKind): THREE.BufferGeometry {
  const m = new Mesher();
  // Drawn at life size, then grown to the toy world's (FLOWER_SCALE).
  const h = BLOOM_HEIGHT[kind] / FLOWER_SCALE;
  const sway = (y: number) => Math.max(0, y / h) ** 2 * 0.7;
  const stemC = col(FLOWERS.stem);
  const leafC = col(FLOWERS.leaf);
  // A stem leaning a little, and the head on top facing up and slightly out.
  const lean = kind === 'clover' ? 0 : 0.08;
  // Rooted at the origin and leaning from there.
  if (kind !== 'lavender') m.shape(new THREE.CylinderGeometry(0.006, 0.009, h, 4, 1, true), new THREE.Matrix4().makeRotationZ(lean).multiply(new THREE.Matrix4().makeTranslation(0, h / 2, 0)), stemC, sway, 0.4);
  const top = new THREE.Vector3(-Math.sin(lean) * h, Math.cos(lean) * h, 0);
  const head = (tilt: number) => new THREE.Matrix4().compose(top, new THREE.Quaternion().setFromEuler(new THREE.Euler(0, 0, tilt)), new THREE.Vector3(1, 1, 1));
  const hs = sway(h);
  // A leaf or two low on the stem.
  const leaf = (y: number, a: number, len: number, c: THREE.Color) => {
    const g = new THREE.BufferGeometry();
    const pts = [0, 0, 0, len * 0.5, 0.012, len * 0.16, len, 0.03, 0, len * 0.5, 0.012, -len * 0.16];
    g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    g.setIndex([0, 1, 2, 0, 2, 3]);
    g.computeVertexNormals();
    m.shape(g, new THREE.Matrix4().makeRotationY(a).setPosition(0, y, 0), c, sway, 0.9);
  };
  switch (kind) {
    case 'daisy': {
      leaf(0.02, 0.6, 0.09, leafC);
      leaf(0.03, 3.4, 0.08, leafC);
      petals(m, head(-0.35), 14, 0.012, 0.075, 0.012, 0.012, col('#ffffff'), col(FLOWERS.daisy.shade), hs);
      m.shape(new THREE.SphereGeometry(0.022, 8, 4, 0, Math.PI * 2, 0, Math.PI / 2), head(-0.35).multiply(new THREE.Matrix4().makeScale(1, 0.55, 1)), col(FLOWERS.daisy.center), () => hs, 0.5);
      break;
    }
    case 'buttercup': {
      leaf(0.02, 1.2, 0.08, leafC);
      leaf(0.04, 4.0, 0.07, leafC);
      petals(m, head(-0.25), 5, 0.004, 0.05, 0.022, 0.028, col(FLOWERS.buttercup.petal), col('#f2b20f'), hs);
      m.shape(new THREE.SphereGeometry(0.014, 6, 4), head(-0.25).multiply(new THREE.Matrix4().makeTranslation(0, 0.008, 0)), col(FLOWERS.buttercup.center), () => hs, 0.5);
      break;
    }
    case 'dandelion': {
      // A rosette of toothed leaves flat on the ground.
      for (let i = 0; i < 5; i++) leaf(0.004, i * 1.26, 0.11, leafC);
      petals(m, head(-0.2), 18, 0.005, 0.05, 0.007, 0.01, col(FLOWERS.dandelion.petal), col(FLOWERS.dandelion.petalDark), hs);
      petals(m, head(-0.2).multiply(new THREE.Matrix4().makeTranslation(0, 0.006, 0)), 12, 0.003, 0.032, 0.007, 0.012, col(FLOWERS.dandelion.petalDark), col(FLOWERS.dandelion.petalDark), hs, 0.2);
      break;
    }
    case 'clock': {
      for (let i = 0; i < 4; i++) leaf(0.004, i * 1.6 + 0.4, 0.1, leafC);
      // A seed head: a pale ball, and a finer, lighter shell of seeds round it.
      m.shape(new THREE.IcosahedronGeometry(0.045, 1), head(0), col(FLOWERS.dandelion.clockShade), () => hs, 0.2);
      m.shape(new THREE.IcosahedronGeometry(0.05, 0), head(0).multiply(new THREE.Matrix4().makeRotationY(0.5)), col(FLOWERS.dandelion.clock), () => hs, 0.2);
      break;
    }
    case 'lavender': {
      // Three or four stems, each with a spike of paired buds, lighter and smaller toward the tip.
      const bud = col(FLOWERS.lavender.bud);
      const light = col(FLOWERS.lavender.budLight);
      for (const [a, tilt, s] of [
        [0, 0.12, 1],
        [2.1, 0.18, 0.9],
        [4.2, 0.1, 0.95],
      ] as const) {
        const hh = h * s;
        const rot = new THREE.Matrix4().makeRotationY(a).multiply(new THREE.Matrix4().makeRotationZ(tilt));
        m.shape(new THREE.CylinderGeometry(0.004, 0.006, hh, 3, 1, true), rot.clone().multiply(new THREE.Matrix4().makeTranslation(0, hh / 2, 0)), col(FLOWERS.lavender.leaf), sway, 0.4);
        for (let j = 0; j < 7; j++) {
          const t = j / 6;
          const y = hh * (0.62 + t * 0.38);
          const rr = 0.014 * (1 - t * 0.45);
          for (const side of [-1, 1]) m.shape(new THREE.OctahedronGeometry(rr), rot.clone().multiply(new THREE.Matrix4().makeTranslation(side * rr * 0.7, y, (j % 2) * rr * 0.5)), j % 2 ? light : bud, sway, 0.4);
        }
      }
      leaf(0.01, 0.4, 0.1, col(FLOWERS.lavender.leaf));
      leaf(0.01, 3.0, 0.09, col(FLOWERS.lavender.leaf));
      break;
    }
    case 'clover': {
      // A round pink-white blossom of florets.
      m.shape(new THREE.IcosahedronGeometry(0.03, 1), head(0).multiply(new THREE.Matrix4().makeScale(1, 0.85, 1)), col(FLOWERS.clover.blossom), () => hs, 0.3);
      m.shape(new THREE.IcosahedronGeometry(0.018, 0), head(0).multiply(new THREE.Matrix4().makeTranslation(0, 0.018, 0)), col(FLOWERS.clover.blossomTip), () => hs, 0.3);
      break;
    }
  }
  return m.build().scale(FLOWER_SCALE, FLOWER_SCALE, FLOWER_SCALE);
}

/** A patch of clover leaves flat on the ground: trefoils of heart-shaped leaflets in two greens. */
export function cloverGeometry(seed: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const m = new Mesher();
  const shape = new THREE.Shape();
  // One heart-shaped leaflet, its point at the middle of the trefoil.
  shape.moveTo(0, 0);
  shape.quadraticCurveTo(-0.034, 0.016, -0.016, 0.034);
  shape.quadraticCurveTo(-0.004, 0.042, 0, 0.03);
  shape.quadraticCurveTo(0.004, 0.042, 0.016, 0.034);
  shape.quadraticCurveTo(0.034, 0.016, 0, 0);
  for (let i = 0; i < 6; i++) {
    const x = (r() - 0.5) * 0.3;
    const z = (r() - 0.5) * 0.3;
    const y = 0.02 + r() * 0.05;
    const c = col(GRASS.clover[i % GRASS.clover.length]);
    const turn = r() * Math.PI * 2;
    for (let j = 0; j < 3; j++) {
      const mat = new THREE.Matrix4()
        .makeTranslation(x, y, z)
        .multiply(new THREE.Matrix4().makeRotationY(turn + (j * Math.PI * 2) / 3))
        .multiply(new THREE.Matrix4().makeRotationX(-Math.PI / 2 + 0.25));
      m.shape(new THREE.ShapeGeometry(shape, 3), mat, c, () => 0.05, 0.95);
    }
    // Its stalk.
    m.shape(new THREE.CylinderGeometry(0.003, 0.003, y, 3, 1, true), new THREE.Matrix4().makeTranslation(x, y / 2, z), col(FLOWERS.stem), () => 0, 0.5);
  }
  return m.build().scale(FLOWER_SCALE, FLOWER_SCALE, FLOWER_SCALE);
}

// ------------------------------------------------------------------ the breeze

export interface Breeze {
  uniforms: { uTime: { value: number }; uWind: { value: number } };
}

/** The traveling grass (see `buildMeadow`): where the player is, and the map of where grass grows. */
export interface Field {
  uniforms: {
    uPlayer: { value: THREE.Vector2 };
    uTile: { value: number };
    uMask: { value: THREE.DataTexture };
    uMaskMin: { value: number };
    uMaskSize: { value: number };
  };
}

/** The Farm's ground height in the shader: the same as `groundY` (walkMath), so the traveling grass stands on it. */
const GROUND_GLSL = `float fR = length(fW);
  float fY = pow(max(0.0, fR - 28.0), 1.3) * 0.06 + sin(fW.x * 0.21) * cos(fW.y * 0.17) * 0.12 * min(1.0, fR / 12.0) - 0.01;`;

/**
 * The traveling grass's placement, in the shader: each clump keeps its place in a square that moves with the player
 * (wrapping round as they walk, faded out toward the square's edge so nothing pops), stands on the ground, and grows
 * only where the map says grass grows (a clump whose own number is under the map's thickness there).
 */
const FIELD_GLSL = `#ifdef USE_INSTANCING
  vec2 fOff = vec2(instanceMatrix[3][0], instanceMatrix[3][2]);
  mat4 fTurn = instanceMatrix;
  fTurn[3] = vec4(0.0, 0.0, 0.0, 1.0);
  mvPosition = fTurn * vec4(transformed, 1.0);
  vec2 fW = uPlayer + mod(fOff - uPlayer + 0.5 * uTile, uTile) - 0.5 * uTile;
  vec2 fUv = (fW - uMaskMin) / uMaskSize;
  float fDense = (fUv.x < 0.0 || fUv.y < 0.0 || fUv.x > 1.0 || fUv.y > 1.0) ? 0.3 : texture2D(uMask, fUv).r;
  float fHash = fract(sin(dot(fOff, vec2(12.9898, 78.233))) * 43758.5453);
  float fKeep = step(fHash, fDense) * (1.0 - smoothstep(0.5 * uTile - 3.5, 0.5 * uTile, length(fW - uPlayer)));
  ${GROUND_GLSL}
  mvPosition.xyz = mvPosition.xyz * fKeep + vec3(fW.x, fY, fW.y);
#endif
`;

/**
 * The meadow's material: lit like the ground (both sides of a blade lit as its front, so grass never shows a dark
 * underside), vertex coloured, and swayed by the breeze: each vertex by its `aSway`, in a gust that travels across the
 * Farm (so a field ripples rather than every blade nodding together). With a `field`, it places the traveling grass.
 */
export function meadowMaterial(breeze: Breeze, field?: Field): THREE.MeshLambertMaterial {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, breeze.uniforms, field?.uniforms ?? {});
    let project = THREE.ShaderChunk.project_vertex;
    if (field) project = project.replace(/#ifdef USE_INSTANCING[\s\S]*?#endif\n/, FIELD_GLSL);
    sh.vertexShader = sh.vertexShader
      .replace(
        '#include <common>',
        `#include <common>\nattribute float aSway;\nuniform float uTime;\nuniform float uWind;${field ? '\nuniform vec2 uPlayer;\nuniform float uTile;\nuniform sampler2D uMask;\nuniform float uMaskMin;\nuniform float uMaskSize;' : ''}`,
      )
      .replace(
        '#include <project_vertex>',
        project.replace(
          'mvPosition = modelViewMatrix * mvPosition;',
          `float wPh = uTime * 1.6 - mvPosition.x * 0.22 - mvPosition.z * 0.13;
          float wGust = 0.55 + 0.45 * sin(uTime * 0.37 - mvPosition.x * 0.04);
          float wAmt = aSway * uWind * wGust;
          mvPosition.x += (sin(wPh) * 0.09 + 0.05) * wAmt;
          mvPosition.z += sin(wPh * 0.7 + 1.3) * 0.045 * wAmt;
          mvPosition.y -= abs(sin(wPh)) * 0.02 * wAmt;
          mvPosition = modelViewMatrix * mvPosition;`,
        ),
      );
    sh.fragmentShader = sh.fragmentShader.replace(
      '#include <normal_fragment_begin>',
      THREE.ShaderChunk.normal_fragment_begin.replace('float faceDirection = gl_FrontFacing ? 1.0 : - 1.0;', 'float faceDirection = 1.0;'),
    );
  };
  m.customProgramCacheKey = () => (field ? 'pawtyk-meadow-field' : 'pawtyk-meadow');
  return m;
}

// ------------------------------------------------------------------ butterflies

/** Wing texture cells: one per species, the right wings painted from the shared shapes. */
const CELL_W = 80;
const ATLAS_W = 512;
const ATLAS_H = 128;
const PX = 8;

/** Paints every species' right wings into one small texture (null where there is no 2D canvas, as in tests). */
export function wingAtlas(): THREE.CanvasTexture | null {
  if (typeof document === 'undefined' || typeof Path2D === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = ATLAS_W;
  canvas.height = ATLAS_H;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = canvas.getContext('2d');
  } catch {
    ctx = null;
  }
  if (!ctx) return null;
  const { bounds } = WING;
  Object.values(BUTTERFLIES).forEach((b, i) => {
    const c = ctx!;
    c.setTransform(PX, 0, 0, PX, i * CELL_W + 4 - bounds.x0 * PX, -bounds.y0 * PX);
    const hind = new Path2D(b.tail ? WING.hindTail : WING.hind);
    const fore = new Path2D(WING.fore);
    c.fillStyle = b.edge;
    c.fill(hind);
    c.fill(fore);
    c.save();
    c.translate(0.5, 0);
    c.scale(0.84, 0.84);
    c.translate(-0.5, 0);
    c.fillStyle = b.fill;
    c.fill(hind);
    c.fill(fore);
    c.restore();
    c.save();
    c.globalAlpha = 0.5;
    c.fillStyle = b.light;
    c.translate(2.2, -1.6);
    c.scale(0.5, 0.5);
    c.fill(fore);
    c.restore();
    if (b.bands.length) {
      c.save();
      c.clip(fore);
      c.fillStyle = b.edge;
      for (const t of b.bands) c.fill(new Path2D(WING.band(t)));
      c.restore();
    }
    if (b.tip) {
      c.fillStyle = b.tip;
      c.fill(new Path2D(WING.tip));
    }
    c.strokeStyle = b.vein;
    c.globalAlpha = 0.85;
    c.lineWidth = 0.22;
    c.stroke(new Path2D(WING.veins));
    c.globalAlpha = 1;
    if (b.spot) {
      c.fillStyle = b.spot;
      for (const [x, y, rr] of WING.spots(b.kind)) {
        c.beginPath();
        c.arc(x, y, rr, 0, Math.PI * 2);
        c.fill();
      }
    }
  });
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 2;
  return tex;
}

/** A right wing as a flat quad (hinged at x = 0, head toward +z), its texture the species' cell of the atlas. */
function wingGeometry(index: number, k: number): THREE.BufferGeometry {
  const { x0, x1, y0, y1 } = WING.bounds;
  const g = new THREE.BufferGeometry();
  // 2D (x, y) → 3D (x, 0, −y): the drawn head (−y) faces +z.
  const p = (x: number, y: number) => [x * k, 0, -y * k];
  g.setAttribute('position', new THREE.Float32BufferAttribute([...p(x0, y0), ...p(x1, y0), ...p(x0, y1), ...p(x1, y1)], 3));
  const u = (x: number) => (index * CELL_W + 4 + (x - x0) * PX) / ATLAS_W;
  const v = (y: number) => 1 - ((y - y0) * PX) / ATLAS_H;
  g.setAttribute('uv', new THREE.Float32BufferAttribute([u(x0), v(y0), u(x1), v(y0), u(x0), v(y1), u(x1), v(y1)], 2));
  g.setAttribute('normal', new THREE.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
  g.setIndex([0, 2, 1, 1, 2, 3]);
  return g;
}

interface Fly {
  kind: ButterflyKind;
  g: THREE.Group;
  right: THREE.Object3D;
  left: THREE.Object3D;
  /** Its home ground: it wanders among the flowers within reach of it. */
  home: { x: number; z: number; r: number };
  perch: number;
  state: 'rest' | 'fly';
  /** Resting: until when (s). Flying: when it set off, how long it takes, from where, to which perch. */
  until: number;
  t0: number;
  dur: number;
  from: THREE.Vector3;
  to: number;
  arc: number;
  phase: number;
}

const ease = (u: number) => u * u * (3 - 2 * u);

/**
 * The walk's butterflies: each rests on a flower, now and then opening its wings; sets off on a wandering, curving path
 * to another flower near its home; and takes off if the player walks right up to it. Under reduced motion they rest.
 */
export class Butterflies {
  readonly flies: Fly[] = [];
  private r = seeded(seedOf('walk-butterflies'));
  private clock = 0;
  private scattered = -1;

  constructor(
    private readonly perches: Perch[],
    layout: MeadowLayout['flies'],
    parent: THREE.Object3D,
    track: (d: { dispose(): void }) => void,
  ) {
    const tex = wingAtlas();
    if (tex) track(tex);
    const kinds = Object.keys(BUTTERFLIES) as ButterflyKind[];
    const bodyM = new THREE.MeshLambertMaterial({ color: col('#2f2a26') });
    track(bodyM);
    const bodyG = new THREE.CapsuleGeometry(0.01, 0.1, 2, 6).rotateX(Math.PI / 2);
    track(bodyG);
    const mats = new Map<ButterflyKind, THREE.Material>();
    layout.forEach(({ kind, perch }, i) => {
      const b = BUTTERFLIES[kind];
      const k = (0.38 * b.size) / 17;
      let mat = mats.get(kind);
      if (!mat) {
        // The species' painted wings; without a canvas (tests), its colour.
        mat = tex ? new THREE.MeshLambertMaterial({ map: tex, alphaTest: 0.5, side: THREE.DoubleSide }) : new THREE.MeshLambertMaterial({ color: col(b.fill), side: THREE.DoubleSide });
        track(mat);
        mats.set(kind, mat);
      }
      const wg = wingGeometry(kinds.indexOf(kind), k);
      track(wg);
      const g = new THREE.Group();
      g.name = `butterfly:${kind}`;
      const right = new THREE.Group();
      const left = new THREE.Group();
      right.add(new THREE.Mesh(wg, mat));
      const lm = new THREE.Mesh(wg, mat);
      lm.scale.x = -1;
      left.add(lm);
      const body = new THREE.Mesh(bodyG, bodyM);
      body.scale.setScalar(b.size);
      g.add(right, left, body);
      parent.add(g);
      const p = perches[perch];
      // The first few live in the pasture (they are its discovery); the rest roam the Farm.
      const home = i < 4 ? { ...PASTURE_HOME } : { x: p.x, z: p.z, r: 9 };
      const fly: Fly = { kind, g, right, left, home, perch, state: 'rest', until: 2 + this.r() * 6, t0: 0, dur: 1, from: new THREE.Vector3(), to: perch, arc: 0.8, phase: this.r() * 10 };
      this.flies.push(fly);
      this.restAt(fly, perch, 0, true);
    });
  }

  /** Which perches are there to land on (the lite tier shows fewer flowers). */
  private open: boolean[] = [];
  landOn(open: boolean[]): void {
    this.open = open;
  }

  /** How many fly now (the lite tier shows fewer). */
  setShown(n: number): void {
    this.flies.forEach((f, i) => (f.g.visible = i < n));
  }

  private restAt(f: Fly, perch: number, now: number, still: boolean): void {
    const p = this.perches[perch];
    f.perch = perch;
    f.state = 'rest';
    f.g.position.set(p.x, p.y + 0.012, p.z);
    f.g.rotation.set(0, this.r() * Math.PI * 2, 0);
    f.until = now + (still ? 0 : 2.5 + this.r() * 6);
  }

  /** Another flower near its home, a few metres from where it is (not the one it is on). */
  private nextPerch(f: Fly, away?: { x: number; z: number }): number {
    const here = f.g.position;
    const ok: number[] = [];
    this.perches.forEach((p, i) => {
      if (i === f.perch || this.open[i] === false) return;
      const d = Math.hypot(p.x - here.x, p.z - here.z);
      if (d < 1.5 || d > 9 || Math.hypot(p.x - f.home.x, p.z - f.home.z) > f.home.r) return;
      if (away && Math.hypot(p.x - away.x, p.z - away.z) < 3) return;
      ok.push(i);
    });
    if (ok.length) return ok[Math.floor(this.r() * ok.length)];
    // Nowhere near home: anywhere within reach.
    let best = f.perch;
    let bestD = Infinity;
    this.perches.forEach((p, i) => {
      const d = Math.abs(Math.hypot(p.x - here.x, p.z - here.z) - 4);
      if (i !== f.perch && this.open[i] !== false && d < bestD) {
        best = i;
        bestD = d;
      }
    });
    return best;
  }

  private takeOff(f: Fly, now: number, high = false, away?: { x: number; z: number }): void {
    const to = this.nextPerch(f, away);
    const p = this.perches[to];
    const d = Math.hypot(p.x - f.g.position.x, p.z - f.g.position.z);
    f.state = 'fly';
    f.from.copy(f.g.position);
    f.to = to;
    f.t0 = now;
    f.dur = Math.max(1.8, Math.min(6, d / 1.4));
    f.arc = (high ? 1.6 : 0.5) + d * 0.12 + this.r() * 0.5;
  }

  /** The pasture's discovery: every butterfly resting there rises at once, high, and settles on other flowers. */
  scatter(start: number): void {
    if (this.scattered === start) return;
    this.scattered = start;
    for (const f of this.flies) if (f.g.visible && f.state === 'rest' && Math.hypot(f.g.position.x - PASTURE_HOME.x, f.g.position.z - PASTURE_HOME.z) < PASTURE_HOME.r + 1.5) this.takeOff(f, this.clock, true);
  }

  update(dt: number, still: boolean, player: { x: number; z: number }): void {
    this.clock += dt;
    const now = this.clock;
    for (const f of this.flies) {
      if (!f.g.visible) continue;
      if (still) {
        // Reduced motion: at rest, wings half open; one in flight lands where it was going.
        if (f.state === 'fly') this.restAt(f, f.to, now, true);
        f.right.rotation.z = 0.9;
        f.left.rotation.z = -0.9;
        continue;
      }
      if (f.state === 'rest') {
        // Wings held up together, opening now and then to bask.
        const open = Math.max(0, Math.sin(now * 0.8 + f.phase)) ** 3;
        const a = 1.3 - open * 1.05;
        f.right.rotation.z = a;
        f.left.rotation.z = -a;
        const near = Math.hypot(player.x - f.g.position.x, player.z - f.g.position.z) < 1.3;
        if (now > f.until || near) this.takeOff(f, now, false, near ? player : undefined);
        continue;
      }
      const u = Math.min(1, (now - f.t0) / f.dur);
      const p = this.perches[f.to];
      const e = ease(u);
      const x = f.from.x + (p.x - f.from.x) * e;
      const z = f.from.z + (p.z - f.from.z) * e;
      // Up in an arc, wandering side to side, bobbing with each beat.
      const lift = Math.sin(Math.PI * u);
      const dx = p.x - f.from.x;
      const dz = p.z - f.from.z;
      const len = Math.hypot(dx, dz) || 1;
      const side = Math.sin(u * Math.PI * 3 + f.phase) * 0.45 * lift;
      const y = f.from.y + (p.y + 0.012 - f.from.y) * e + f.arc * lift + Math.sin(now * 13 + f.phase) * 0.04 * lift;
      const nx = x + (-dz / len) * side;
      const nz = z + (dx / len) * side;
      // Heading the way it moves.
      const vx = nx - f.g.position.x;
      const vz = nz - f.g.position.z;
      if (vx * vx + vz * vz > 1e-8) f.g.rotation.y = Math.atan2(vx, vz);
      f.g.rotation.x = -0.25 * lift;
      f.g.position.set(nx, y, nz);
      // Beating fast in the air, slowing to land.
      const beat = Math.abs(Math.sin(now * 26 + f.phase));
      const a = 0.15 + beat * 1.25 * (u < 0.9 ? 1 : (1 - u) * 10) + (u >= 0.9 ? (u - 0.9) * 10 * 1.2 : 0);
      f.right.rotation.z = a;
      f.left.rotation.z = -a;
      if (u >= 1) this.restAt(f, f.to, now, false);
    }
  }
}

// ------------------------------------------------------------------ the meadow

export interface Meadow {
  root: THREE.Group;
  butterflies: Butterflies;
  layout: MeadowLayout;
  /** Each frame: the breeze, and the butterflies (`still` under reduced motion). */
  update(dt: number, still: boolean, player: { x: number; z: number }): void;
  /** Before each drawing: the traveling grass gathers round the player. */
  follow(x: number, z: number): void;
  /** Fewer of everything (a phone that can't keep up). */
  setTier(t: MeadowTier): void;
  /** Instances drawn per kind (tests and the QA page). */
  stats(): { field: number; clumps: number; blooms: number; clover: number; butterflies: number; drawCalls: number };
}

const CHUNK = 31;

export function buildMeadow(stage: number, decor: readonly string[], tier: MeadowTier, ground: (x: number, z: number) => number, track: (d: { dispose(): void }) => void): Meadow {
  const layout = meadowLayout(stage, decor, 'high');
  const root = new THREE.Group();
  root.name = 'meadow';
  const breeze: Breeze = { uniforms: { uTime: { value: 0 }, uWind: { value: 1 } } };
  const mat = meadowMaterial(breeze);
  track(mat);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const s3 = new THREE.Vector3();
  const p3 = new THREE.Vector3();
  const yAxis = new THREE.Vector3(0, 1, 0);
  const tint = new THREE.Color();
  const tinted = seeded(seedOf('walk-meadow-tint'));
  const place = (mesh: THREE.InstancedMesh, i: number, x: number, z: number, s: number, yaw: number, sy = s) => {
    q.setFromAxisAngle(yAxis, yaw);
    m4.compose(p3.set(x, ground(x, z) - 0.01, z), q, s3.set(s, sy, s));
    mesh.setMatrixAt(i, m4);
  };
  const meshes: Array<{ mesh: THREE.InstancedMesh; full: number; lite: number; kind: 'field' | 'clumps' | 'blooms' | 'clover'; bloom?: BloomKind }> = [];
  const clumpGeos = [clumpGeometry(11, 9, 0.36), clumpGeometry(23, 7, 0.28)];
  for (const g of clumpGeos) track(g);

  // The traveling grass: thick wherever the player walks, at a fixed cost. Its clumps keep their places in a square
  // round the player (the shader moves them as the player walks) and grow only where the map says grass grows.
  const mask = fieldMask(stage, decor);
  const maskTex = new THREE.DataTexture(mask.data, mask.size, mask.size, THREE.RedFormat, THREE.UnsignedByteType);
  maskTex.magFilter = THREE.LinearFilter;
  maskTex.minFilter = THREE.LinearFilter;
  maskTex.needsUpdate = true;
  track(maskTex);
  const field: Field = {
    uniforms: {
      uPlayer: { value: new THREE.Vector2() },
      uTile: { value: FIELD_TILE },
      uMask: { value: maskTex },
      uMaskMin: { value: -mask.extent / 2 },
      uMaskSize: { value: mask.extent },
    },
  };
  const fieldMat = meadowMaterial(breeze, field);
  track(fieldMat);
  const fr = seeded(seedOf('walk-field'));
  const perField = Math.ceil(MEADOW_COUNTS.high.field / 2);
  clumpGeos.forEach((g, v) => {
    const mesh = new THREE.InstancedMesh(g, fieldMat, perField);
    for (let i = 0; i < perField; i++) {
      const s = 0.8 + fr() * 0.55;
      q.setFromAxisAngle(yAxis, fr() * Math.PI * 2);
      // Its place in the square (x, z); the shader puts it on the ground near the player.
      m4.compose(p3.set((fr() - 0.5) * FIELD_TILE, 0, (fr() - 0.5) * FIELD_TILE), q, s3.set(s, s * (0.85 + fr() * 0.35), s));
      mesh.setMatrixAt(i, m4);
      const w = tinted();
      mesh.setColorAt(i, tint.setRGB(0.9 + w * 0.16, 0.94 + tinted() * 0.1, 0.86 + (1 - w) * 0.14));
    }
    // It is always round the player: never culled.
    mesh.frustumCulled = false;
    mesh.name = `meadow:field${v}`;
    track(mesh);
    root.add(mesh);
    meshes.push({ mesh, full: perField, lite: Math.ceil(MEADOW_COUNTS.lite.field / 2), kind: 'field' });
  });

  // The grass scattered over the whole Farm (seen from afar, beyond the traveling grass), in chunks the camera can
  // skip when they are behind it.
  const chunks = new Map<string, Array<(typeof layout.clumps)[number]>>();
  for (const c of layout.clumps) {
    const key = `${Math.floor((c.x + MEADOW_RADIUS) / CHUNK)},${Math.floor((c.z + MEADOW_RADIUS) / CHUNK)},${c.v % 2}`;
    (chunks.get(key) ?? chunks.set(key, []).get(key)!).push(c);
  }
  const liteShare = layout.clumps.length ? MEADOW_COUNTS.lite.clumps / layout.clumps.length : 1;
  for (const [key, list] of chunks) {
    const mesh = new THREE.InstancedMesh(clumpGeos[Number(key.split(',')[2])], mat, list.length);
    list.forEach((c, i) => {
      place(mesh, i, c.x, c.z, c.s, c.yaw, c.s * (0.85 + (i % 5) * 0.08));
      // No two clumps quite the same green: a little warmer or cooler, lighter or darker.
      const w = tinted();
      mesh.setColorAt(i, tint.setRGB(0.9 + w * 0.16, 0.94 + tinted() * 0.1, 0.86 + (1 - w) * 0.14));
    });
    mesh.computeBoundingSphere();
    track(mesh);
    mesh.name = 'meadow:grass';
    root.add(mesh);
    meshes.push({ mesh, full: list.length, lite: Math.ceil(list.length * liteShare), kind: 'clumps' });
  }

  // Flowers, one instanced mesh per kind.
  const liteBlooms = layout.blooms.length ? MEADOW_COUNTS.lite.blooms / layout.blooms.length : 1;
  for (const kind of BLOOM_KINDS) {
    const list = layout.blooms.filter((b) => b.kind === kind);
    if (!list.length) continue;
    const g = bloomGeometry(kind);
    track(g);
    const mesh = new THREE.InstancedMesh(g, mat, list.length);
    list.forEach((b, i) => place(mesh, i, b.x, b.z, b.s, b.yaw));
    mesh.computeBoundingSphere();
    track(mesh);
    mesh.name = `meadow:${kind}`;
    root.add(mesh);
    // The pasture's clover always stays (its butterflies land there).
    meshes.push({ mesh, full: list.length, lite: Math.max(kind === 'clover' ? 10 : 1, Math.ceil(list.length * liteBlooms)), kind: 'blooms', bloom: kind });
  }

  // Clover leaves.
  const cg = cloverGeometry(5);
  track(cg);
  const clover = new THREE.InstancedMesh(cg, mat, layout.clover.length);
  layout.clover.forEach((c, i) => place(clover, i, c.x, c.z, c.s, c.yaw));
  clover.computeBoundingSphere();
  track(clover);
  clover.name = 'meadow:clover';
  root.add(clover);
  meshes.push({ mesh: clover, full: layout.clover.length, lite: Math.min(layout.clover.length, MEADOW_COUNTS.lite.clover), kind: 'clover' });

  const butterflies = new Butterflies(layout.perches, layout.flies, root, track);
  const setTier = (t: MeadowTier) => {
    for (const m of meshes) m.mesh.count = t === 'high' ? m.full : Math.min(m.full, m.lite);
    // Butterflies land only on flowers that are there.
    const shown = new Map(meshes.filter((m) => m.bloom).map((m) => [m.bloom!, m.mesh.count]));
    const seen = new Map<BloomKind, number>();
    butterflies.landOn(
      layout.blooms.map((b) => {
        const k = seen.get(b.kind) ?? 0;
        seen.set(b.kind, k + 1);
        return k < (shown.get(b.kind) ?? 0);
      }),
    );
    butterflies.setShown(t === 'high' ? layout.flies.length : Math.min(layout.flies.length, MEADOW_COUNTS.lite.flies));
  };
  setTier(tier);
  let time = 0;
  return {
    root,
    butterflies,
    layout,
    follow(x, z) {
      field.uniforms.uPlayer.value.set(x, z);
    },
    update(dt, still, player) {
      // The breeze: still under reduced motion (the grass simply stands).
      if (!still) time += dt;
      breeze.uniforms.uTime.value = time;
      breeze.uniforms.uWind.value = still ? 0 : 1;
      butterflies.update(dt, still, player);
    },
    setTier,
    stats() {
      const sum = (k: string) => meshes.filter((m) => m.kind === k).reduce((a, m) => a + m.mesh.count, 0);
      return {
        field: sum('field'),
        clumps: sum('clumps'),
        blooms: sum('blooms'),
        clover: sum('clover'),
        butterflies: butterflies.flies.filter((f) => f.g.visible).length,
        drawCalls: meshes.length + butterflies.flies.filter((f) => f.g.visible).length * 3,
      };
    },
  };
}
