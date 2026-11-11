/**
 * The 3D Farm's things, made finer (D47 PR 2): textures painted once in code (wood planks, roof shingles, straw, a
 * sunflower's seed spiral, a soft contact shadow), and the pieces built from them: apple trees with a branching trunk,
 * layered foliage and apples; sunflowers with real petals and a seed head; a stone-banked pond with lily pads and slow
 * ripples; pebbles along the path; stones; and the soft shadow every thing casts where it touches the ground.
 *
 * Original, made from simple shapes and drawn in code: no outside art. Where it stands is `walkMath`'s (unchanged).
 * Everything made is tracked for disposal; without a 2D canvas (tests) the textures are plain.
 */

import * as THREE from 'three';
import { seeded } from '../art/botany';
import { FARM } from '../art/farmPalette';

const col = (c: string) => new THREE.Color(c);

export interface PropKit {
  mat(c: string, rough?: number): THREE.MeshStandardMaterial;
  geo<T extends THREE.BufferGeometry>(g: T): T;
  track<T extends { dispose(): void }>(d: T): T;
}

// ------------------------------------------------------------------ painted textures

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] | null {
  if (typeof document === 'undefined') return null;
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  let ctx: CanvasRenderingContext2D | null = null;
  try {
    ctx = c.getContext('2d');
  } catch {
    ctx = null;
  }
  return ctx ? [c, ctx] : null;
}

function texture(c: HTMLCanvasElement | null, repeat = true): THREE.Texture {
  const t = c ? new THREE.CanvasTexture(c) : new THREE.Texture();
  t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 4;
  return t;
}

/**
 * Vertical planks: a shade apart each, with seams, grain and the odd knot, in a light tint the material's colour
 * multiplies (so one painting serves red barn boards and bare fence wood alike).
 */
export function plankTexture(seed: number, planks = 8): THREE.Texture {
  const cv = canvas(256, 256);
  if (cv) {
    const [, c] = cv;
    const r = seeded(seed);
    const w = 256 / planks;
    for (let i = 0; i < planks; i++) {
      const v = 228 + Math.floor(r() * 27);
      c.fillStyle = `rgb(${v},${v},${v})`;
      c.fillRect(i * w, 0, w, 256);
      // Grain: long faint lines, a little wavy.
      c.strokeStyle = 'rgba(0,0,0,0.07)';
      c.lineWidth = 1;
      for (let k = 0; k < 5; k++) {
        const x = i * w + 3 + r() * (w - 6);
        c.beginPath();
        c.moveTo(x, 0);
        for (let y = 0; y <= 256; y += 32) c.lineTo(x + Math.sin(y / 40 + k) * 1.5, y);
        c.stroke();
      }
      if (r() < 0.35) {
        c.fillStyle = 'rgba(0,0,0,0.12)';
        c.beginPath();
        c.ellipse(i * w + w / 2, r() * 256, 2.5, 4, 0, 0, Math.PI * 2);
        c.fill();
      }
      // The seam, and a sliver of light on the next board's edge.
      c.fillStyle = 'rgba(0,0,0,0.28)';
      c.fillRect(i * w, 0, 2, 256);
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.fillRect(i * w + 2, 0, 1, 256);
    }
  }
  return texture(cv?.[0] ?? null);
}

/** Roof shingles: offset rows, each tile a shade apart, a shadow under each row's edge. */
export function shingleTexture(seed: number): THREE.Texture {
  const cv = canvas(256, 256);
  if (cv) {
    const [, c] = cv;
    const r = seeded(seed);
    const rows = 8;
    const h = 256 / rows;
    for (let j = 0; j < rows; j++) {
      const off = (j % 2) * 16;
      for (let x = -32 + off; x < 256; x += 32) {
        const v = 215 + Math.floor(r() * 40);
        c.fillStyle = `rgb(${v},${v},${v})`;
        c.fillRect(x + 1, j * h, 30, h);
      }
      c.fillStyle = 'rgba(0,0,0,0.22)';
      c.fillRect(0, j * h + h - 4, 256, 4);
    }
  }
  return texture(cv?.[0] ?? null);
}

/** Straw: a warm ground of fine strands, light and dark, lying mostly one way. */
export function strawTexture(seed: number): THREE.Texture {
  const cv = canvas(256, 256);
  if (cv) {
    const [, c] = cv;
    const r = seeded(seed);
    c.fillStyle = '#ead07c';
    c.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 900; i++) {
      const x = r() * 256;
      const y = r() * 256;
      const len = 10 + r() * 26;
      const a = (r() - 0.5) * 0.5;
      c.strokeStyle = r() < 0.5 ? `rgba(160,120,40,${0.25 + r() * 0.3})` : `rgba(255,246,200,${0.3 + r() * 0.4})`;
      c.lineWidth = 1 + r();
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x + Math.cos(a) * len, y + Math.sin(a) * len);
      c.stroke();
    }
  }
  return texture(cv?.[0] ?? null);
}

/** The end of a round bale: straw rolled in a spiral. */
export function baleEndTexture(): THREE.Texture {
  const cv = canvas(128, 128);
  if (cv) {
    const [, c] = cv;
    c.fillStyle = '#e8c76a';
    c.fillRect(0, 0, 128, 128);
    c.strokeStyle = 'rgba(165,120,40,0.55)';
    c.lineWidth = 2;
    c.beginPath();
    for (let a = 0; a < Math.PI * 14; a += 0.1) {
      const rr = 4 + a * 1.32;
      const x = 64 + Math.cos(a) * rr;
      const y = 64 + Math.sin(a) * rr;
      if (a === 0) c.moveTo(x, y);
      else c.lineTo(x, y);
    }
    c.stroke();
  }
  return texture(cv?.[0] ?? null, false);
}

/** A sunflower's face: the seed head's spiral of florets (golden-angle phyllotaxis), dark in the middle. */
export function seedHeadTexture(): THREE.Texture {
  const cv = canvas(128, 128);
  if (cv) {
    const [, c] = cv;
    const g = c.createRadialGradient(64, 64, 4, 64, 64, 64);
    g.addColorStop(0, '#4a2c18');
    g.addColorStop(0.75, '#6e4424');
    g.addColorStop(1, '#8a5a2a');
    c.fillStyle = g;
    c.fillRect(0, 0, 128, 128);
    const golden = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < 420; i++) {
      const rr = 3 * Math.sqrt(i);
      if (rr > 62) break;
      const a = i * golden;
      c.fillStyle = i % 3 ? 'rgba(40,24,12,0.55)' : 'rgba(190,140,70,0.5)';
      c.beginPath();
      c.arc(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr, 1.6, 0, Math.PI * 2);
      c.fill();
    }
  }
  return texture(cv?.[0] ?? null, false);
}

/** A soft round shadow, darkest in the middle. */
export function contactShadowTexture(): THREE.Texture {
  const cv = canvas(64, 64);
  if (cv) {
    const [, c] = cv;
    const g = c.createRadialGradient(32, 32, 1, 32, 32, 32);
    g.addColorStop(0, 'rgba(38,52,40,0.5)');
    g.addColorStop(0.55, 'rgba(38,52,40,0.26)');
    g.addColorStop(1, 'rgba(38,52,40,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  }
  return texture(cv?.[0] ?? null, false);
}

// ------------------------------------------------------------------ contact shadows

/** Soft shadows on the ground where things stand: one material, flat quads just above the grass's roots. */
export class Shadows {
  private map: THREE.Texture;
  private mats = new Map<number, THREE.MeshBasicMaterial>();
  private quad: THREE.PlaneGeometry;
  constructor(
    private readonly parent: THREE.Object3D,
    private readonly kit: PropKit,
  ) {
    this.map = kit.track(contactShadowTexture());
    this.quad = kit.geo(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2));
  }
  /** One material per strength (tracked, so the walk frees them). */
  private mat(strength: number): THREE.MeshBasicMaterial {
    const k = Math.round(strength * 20) / 20;
    let m = this.mats.get(k);
    if (!m) {
      m = this.kit.track(new THREE.MeshBasicMaterial({ map: this.map, transparent: true, depthWrite: false, opacity: 0.9 * k, fog: true }));
      this.mats.set(k, m);
    }
    return m;
  }
  /** A shadow `w` by `d` across at (x, z), turned by `rot`; `y` the ground there. */
  add(x: number, z: number, w: number, d: number, y = 0, rot = 0, strength = 1): THREE.Mesh {
    const m = new THREE.Mesh(this.quad, this.mat(strength));
    m.position.set(x, y + 0.025, z);
    m.rotation.y = rot;
    m.scale.set(w, 1, d);
    m.renderOrder = 1;
    this.parent.add(m);
    return m;
  }
}

// ------------------------------------------------------------------ merged, vertex-coloured shapes

/** Shapes gathered into one geometry, each in its own colour (a tree is one draw call). */
export class Merger {
  private pos: number[] = [];
  private nor: number[] = [];
  private col: number[] = [];
  add(g: THREE.BufferGeometry, m: THREE.Matrix4, c: THREE.Color | ((p: THREE.Vector3, n: THREE.Vector3) => THREE.Color)): void {
    const ng = g.index ? g.toNonIndexed() : g;
    ng.applyMatrix4(m);
    if (!ng.attributes.normal) ng.computeVertexNormals();
    const p = ng.attributes.position as THREE.BufferAttribute;
    const nn = ng.attributes.normal as THREE.BufferAttribute;
    const v = new THREE.Vector3();
    const n = new THREE.Vector3();
    for (let i = 0; i < p.count; i++) {
      v.fromBufferAttribute(p, i);
      n.fromBufferAttribute(nn, i);
      this.pos.push(v.x, v.y, v.z);
      this.nor.push(n.x, n.y, n.z);
      const cc = typeof c === 'function' ? c(v, n) : c;
      this.col.push(cc.r, cc.g, cc.b);
    }
    if (ng !== g) ng.dispose();
    g.dispose();
  }
  build(): THREE.BufferGeometry {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.pos, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.nor, 3));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.col, 3));
    g.computeBoundingSphere();
    return g;
  }
}

const Y = new THREE.Vector3(0, 1, 0);

/** A tapered branch from `a` to `b` (radii ra, rb), as a matrix on a unit cylinder (height 1, along y). */
function limb(a: THREE.Vector3, b: THREE.Vector3): THREE.Matrix4 {
  const d = b.clone().sub(a);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(Y, d.normalize());
  return new THREE.Matrix4().compose(a.clone().add(b).multiplyScalar(0.5), q, new THREE.Vector3(1, len, 1));
}

/**
 * An apple tree, as one vertex-coloured geometry: a trunk that splits into three or four branches, each carrying
 * foliage in overlapping clusters (shaded darker underneath and lighter on top), plus a few twigs; and where its
 * apples hang (returned, so they can be drawn as shiny instances).
 */
export function appleTreeGeometry(seed: number): { geo: THREE.BufferGeometry; apples: THREE.Vector3[]; crown: { y: number; r: number } } {
  const r = seeded(seed);
  const m = new Merger();
  const bark = col(FARM.tree.bark);
  const barkDark = col(FARM.tree.barkDark);
  const barkC = (_p: THREE.Vector3, n: THREE.Vector3) => (n.x * 0.6 + n.z * 0.3 > 0 ? bark : barkDark);
  // The trunk: a little lean, flaring at the root.
  const top = new THREE.Vector3((r() - 0.5) * 0.3, 2.1, (r() - 0.5) * 0.3);
  m.add(new THREE.CylinderGeometry(0.2, 0.32, 1, 9, 3), limb(new THREE.Vector3(0, 0, 0), top), barkC);
  m.add(new THREE.CylinderGeometry(0.34, 0.5, 0.3, 9), new THREE.Matrix4().makeTranslation(0, 0.15, 0), barkC);
  const leaf = FARM.tree.leaves.map(col);
  const apples: THREE.Vector3[] = [];
  const nBranches = 3 + Math.floor(r() * 2);
  let crownTop = 0;
  for (let i = 0; i < nBranches; i++) {
    const a = (i / nBranches) * Math.PI * 2 + r() * 0.6;
    const out = 0.9 + r() * 0.6;
    const end = new THREE.Vector3(top.x + Math.cos(a) * out, top.y + 0.9 + r() * 0.7, top.z + Math.sin(a) * out);
    m.add(new THREE.CylinderGeometry(0.07, 0.15, 1, 7), limb(top, end), barkC);
    // A twig off it.
    const tw = end.clone().add(new THREE.Vector3(Math.cos(a + 1) * 0.5, 0.35, Math.sin(a + 1) * 0.5));
    m.add(new THREE.CylinderGeometry(0.03, 0.06, 1, 5), limb(end.clone().lerp(top, 0.3), tw), barkC);
    // Foliage clusters round the branch's end: big soft blobs, darker below.
    for (let k = 0; k < 3; k++) {
      const c = end.clone().add(new THREE.Vector3((r() - 0.5) * 0.9, (r() - 0.2) * 0.7, (r() - 0.5) * 0.9));
      const rad = 0.75 + r() * 0.45;
      crownTop = Math.max(crownTop, c.y + rad);
      const ball = new THREE.IcosahedronGeometry(1, 2);
      // A soft, slightly lumpy blob (each vertex pushed in or out a little).
      // Each point pushed in or out by a smooth function of its direction (so shared corners move together and the
      // blob stays whole), its normal the round one: soft, not faceted.
      const pp = ball.attributes.position as THREE.BufferAttribute;
      const nn = ball.attributes.normal as THREE.BufferAttribute;
      const ph = seeded(seed * 31 + i * 7 + k)() * 6.28;
      for (let j = 0; j < pp.count; j++) {
        const dx = pp.getX(j);
        const dy = pp.getY(j);
        const dz = pp.getZ(j);
        const s = 0.94 + Math.sin(dx * 3.1 + ph) * Math.cos(dz * 2.7 - ph) * 0.08 + Math.sin(dy * 4.3 + ph) * 0.04;
        pp.setXYZ(j, dx * s, dy * s * 0.86, dz * s);
        nn.setXYZ(j, dx, dy, dz);
      }
      m.add(ball, new THREE.Matrix4().compose(c, new THREE.Quaternion(), new THREE.Vector3(rad, rad, rad)), (p, n) => {
        // Darker underneath, lighter on top, dappled.
        const t = Math.max(0, Math.min(1, (n.y + 1) / 2));
        const dapple = Math.abs(Math.sin(p.x * 7.1 + p.z * 5.3 + p.y * 3.7)) * 0.6;
        return leaf[Math.max(0, Math.min(3, Math.floor(t * 3.2 + dapple)))];
      });
      // Apples on the cluster's lower, outer side.
      for (let q = 0; q < 2; q++) {
        const ang = r() * Math.PI * 2;
        const dir = new THREE.Vector3(Math.cos(ang), -0.25 - r() * 0.45, Math.sin(ang)).normalize();
        apples.push(c.clone().add(dir.multiplyScalar(rad * 0.86)));
      }
    }
  }
  return { geo: m.build(), apples, crown: { y: crownTop, r: 2.2 } };
}

/** One apple: a slightly squat ball with a dimple, its stalk and a leaf (vertex coloured: red, flushed yellow). */
export function appleGeometry(): THREE.BufferGeometry {
  const m = new Merger();
  const ball = new THREE.SphereGeometry(0.14, 12, 9);
  const red = col(FARM.tree.apple);
  const flush = col(FARM.tree.appleFlush);
  m.add(ball, new THREE.Matrix4().makeScale(1, 0.9, 1), (p) => (p.x + p.z > 0.12 ? flush : red));
  m.add(new THREE.CylinderGeometry(0.008, 0.012, 0.08, 4), new THREE.Matrix4().makeTranslation(0, 0.15, 0), col(FARM.tree.barkDark));
  m.add(new THREE.SphereGeometry(0.04, 6, 4), new THREE.Matrix4().compose(new THREE.Vector3(0.04, 0.17, 0), new THREE.Quaternion(), new THREE.Vector3(1, 0.2, 0.5)), col(FARM.tree.leaves[0]));
  return m.build();
}

/** A sunflower petal: long, pointed, a little wider past the middle. */
function petalShape(len: number, w: number): THREE.Shape {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.quadraticCurveTo(w, len * 0.45, 0, len);
  s.quadraticCurveTo(-w, len * 0.45, 0, 0);
  return s;
}

/**
 * A sunflower's head, facing +z: green sepals behind, two rings of golden petals cupped forward, and the seed disc in
 * front (returned apart: it has its own painted texture). Radius about 0.45 m.
 */
export function sunflowerHeadGeometry(seed: number): THREE.BufferGeometry {
  const r = seeded(seed);
  const m = new Merger();
  const sepal = petalShape(0.2, 0.06);
  const petal = petalShape(0.3, 0.085);
  const gold = [col(FARM.sunflower.petal), col(FARM.sunflower.petalLight), col(FARM.sunflower.petalBack)];
  // The back of the head.
  m.add(new THREE.CylinderGeometry(0.2, 0.12, 0.08, 16).rotateX(Math.PI / 2), new THREE.Matrix4().makeTranslation(0, 0, -0.05), col(FARM.sunflower.stem));
  for (let i = 0; i < 16; i++) {
    const a = (i / 16) * Math.PI * 2;
    const mat = new THREE.Matrix4()
      .makeRotationZ(a)
      .multiply(new THREE.Matrix4().makeTranslation(0, 0.14, -0.04))
      .multiply(new THREE.Matrix4().makeRotationX(0.35));
    m.add(new THREE.ShapeGeometry(sepal, 2), mat, col(FARM.sunflower.sepal));
  }
  // Two rings of petals, the front ring offset, each petal cupped forward a little and lying its own way.
  for (const [ring, off, z, k] of [
    [0, 0, -0.01, 20],
    [1, 0.5, 0.01, 18],
  ] as const) {
    for (let i = 0; i < k; i++) {
      const a = ((i + off) / k) * Math.PI * 2 + (r() - 0.5) * 0.08;
      const mat = new THREE.Matrix4()
        .makeRotationZ(a)
        .multiply(new THREE.Matrix4().makeTranslation(0, 0.13, z))
        .multiply(new THREE.Matrix4().makeRotationX(-0.25 - r() * 0.2 - ring * 0.1))
        .multiply(new THREE.Matrix4().makeRotationY((r() - 0.5) * 0.4))
        .multiply(new THREE.Matrix4().makeScale(1, 0.85 + r() * 0.3, 1));
      m.add(new THREE.ShapeGeometry(petal, 3), mat, gold[(i + ring) % 3]);
    }
  }
  return m.build();
}

/** A sunflower's leaf: broad, heart-shaped, a pointed tip. */
export function sunflowerLeafGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.bezierCurveTo(0.22, 0.02, 0.26, 0.24, 0, 0.42);
  s.bezierCurveTo(-0.26, 0.24, -0.22, 0.02, 0, 0);
  return new THREE.ShapeGeometry(s, 5);
}

// ------------------------------------------------------------------ the pond's bank, the path's pebbles, stones

/** A stone: a squashed, slightly irregular lump (each stone made from a seed). */
export function stoneGeometry(seed: number): THREE.BufferGeometry {
  const g = new THREE.IcosahedronGeometry(1, 1);
  const p = g.attributes.position as THREE.BufferAttribute;
  const r = seeded(seed);
  for (let i = 0; i < p.count; i++) {
    const s = 0.8 + r() * 0.35;
    p.setXYZ(i, p.getX(i) * s, Math.max(-0.2, p.getY(i)) * s * 0.55, p.getZ(i) * s);
  }
  g.computeVertexNormals();
  return g;
}

/** A lily pad (a disc with its notch), lying flat. */
export function lilyPadGeometry(): THREE.BufferGeometry {
  const s = new THREE.Shape();
  s.moveTo(0, 0);
  s.absarc(0, 0, 0.32, 0.25, Math.PI * 2 - 0.25, false);
  s.lineTo(0, 0);
  return new THREE.ShapeGeometry(s, 10).rotateX(-Math.PI / 2);
}
