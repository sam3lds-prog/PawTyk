/**
 * The walkable 3D Farm (D44 PR I): the Farm as a little world to stroll round, with its animals as the same soft toys
 * as the scene (D34). Everything is built in code from simple shapes: rolling grass with a dirt path, the fence and
 * pasture, hay, the red barn (and its party lights), the duck pond and hen house, sunflowers, the orchard and the
 * windmill, each appearing with the Farm's stage. Animals turn to watch the player and say hello when they come near.
 *
 * Getting round: drag to look, tap the ground to walk there, tap an animal to go and say hello, or use the arrow
 * buttons (and the keyboard). Quality tiers: high (sharp, every frame) until frames come slow, then lite (lower
 * resolution, a thinner meadow). The meadow (D47: grass, wildflowers, butterflies) is `meadow.ts`. It draws only while it is showing; leaving the app pauses it.
 */

import * as THREE from 'three';
import { noteSharedTextures, releaseRenderer } from './release';
import { Actor } from './actor';
import { copyCanvas } from './capture';
import { buildMeadow, type Meadow } from './meadow';
import {
  Shadows,
  appleGeometry,
  appleTreeGeometry,
  baleEndTexture,
  lilyPadGeometry,
  plankTexture,
  seedHeadTexture,
  shingleTexture,
  stoneGeometry,
  strawTexture,
  sunflowerHeadGeometry,
  sunflowerLeafGeometry,
  type PropKit,
} from './farmProps';
import { seedOf, seeded } from '../art/botany';
import { FARM } from '../art/farmPalette';
import { addLights } from './lights';
import { toySpec } from './species';
import { Toy, ToyKit } from './toy';
import {
  ANIMAL_SPOTS,
  EYE,
  DECOR_PLACES,
  HELLO_RANGE,
  PLACES,
  TURN,
  featuresAt,
  groundY,
  isFarmDecor,
  landmarkNear,
  landmarksAt,
  nudge,
  obstaclesAt,
  pathOffset,
  pathX,
  route,
  settle,
  stepWalker,
  turnToward,
  yawTo,
  type FarmDecor,
  type LandmarkId,
  type Obstacle,
  type Walker,
} from './walkMath';

export interface WalkOptions {
  /** Farm residents at home (animal ids). */
  residents: string[];
  stage: number;
  evening: boolean;
  reducedMotion: () => boolean;
  quality: 'high' | 'lite';
  /** The decorations the player has out on the Farm (D45 PR C): the same ones the drawn Farm shows. */
  decor?: readonly string[];
  /** Told when an animal says hello (its id). */
  onHello?: (id: string) => void;
  /** Told where the player is, a few times a second while drawing (the mini-map follows). */
  onMove?: (x: number, z: number, yaw: number) => void;
  /** Told when the player arrives at a destination (`first`: the first time this walk), or leaves them all (null). */
  onPlace?: (id: LandmarkId | null, first: boolean) => void;
  /** Told when the WebGL context goes (false) and comes back (true) (D46 PR B). */
  onContext?: (drawing: boolean) => void;
}

interface Resident {
  id: string;
  actor: Actor;
  x: number;
  z: number;
  baseYaw: number;
  greetedAt: number;
  near: boolean;
  /** How far it has perked up toward the player (0–1). */
  perk: number;
}

/** A small moment at a destination: it plays once from `start` (ms) for `ms`, then rests. */
interface Moment {
  start: number;
  ms: number;
  frame(t: number): void;
  /** Its last frame has been drawn (so a moment that ran out while nothing was drawing still comes to rest). */
  rested?: boolean;
}

const col = (c: string) => new THREE.Color(c);

/** Stretches a geometry's texture coordinates (so one painted texture repeats at the right size on each thing). */
function scaleUv(g: THREE.BufferGeometry, su: number, sv: number): void {
  const uv = g.attributes.uv as THREE.BufferAttribute | undefined;
  if (!uv) return;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
}

export class FarmWalk {
  readonly canvas: HTMLCanvasElement;
  private renderer: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(62, 1, 0.1, 300);
  private kit = new ToyKit();
  private residents: Resident[] = [];
  private ground!: THREE.Mesh;
  private obstacles: Obstacle[];
  readonly walker: Walker = { x: PLACES.start.x, z: PLACES.start.z, yaw: PLACES.start.yaw, target: null };
  private pitch = -0.08;
  private raf = 0;
  private live = true;
  private disposed = false;
  /** The WebGL context is gone (D46 PR B): nothing draws until it comes back. */
  private lostContext = false;
  private last = 0;
  private held: { move: number; turn: number } = { move: 0, turn: 0 };
  private quality: 'high' | 'lite';
  private slowFrames = 0;
  private frames = 0;
  private disposables: Array<{ dispose(): void }> = [];
  private ray = new THREE.Raycaster();
  /** Frames drawn so far (tests and the QA page read it). */
  drawn = 0;
  /** The destination the player is at, and the ones found so far this walk (D45 PR C). */
  private place: LandmarkId | null = null;
  readonly found = new Set<LandmarkId>();
  private moments = new Map<LandmarkId, Moment>();
  private barnDoors: THREE.Group[] = [];
  private barnOpen = 0;
  /** The decorations standing here (tests and the QA page). */
  readonly decor: FarmDecor[];
  /** The grass, wildflowers and butterflies (D47 PR 1). */
  private meadow!: Meadow;
  /** D47 PR 2: painted textures and shared pieces (made in build()), soft shadows, and small things that move. */
  private wood!: THREE.Texture;
  private straw!: THREE.Texture;
  private shadows!: Shadows;
  private treeMat!: THREE.MeshStandardMaterial;
  private appleGeo!: THREE.BufferGeometry;
  private appleMat!: THREE.MeshStandardMaterial;
  private stoneGeo!: THREE.BufferGeometry;
  private stoneMat!: THREE.MeshStandardMaterial;
  private tickers: Array<(t: number, still: boolean) => void> = [];
  private clock = 0;

  constructor(private readonly o: WalkOptions) {
    this.quality = o.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: o.quality === 'high', powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(o.quality === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'walk__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    // D46 PR B: the OS can take the context back (memory pressure, the app in the background). Asking for it back
    // (preventDefault) lets three.js rebuild its GPU state when it returns; meanwhile nothing draws.
    this.canvas.addEventListener('webglcontextlost', (e) => {
      e.preventDefault();
      this.lostContext = true;
      if (this.raf) cancelAnimationFrame(this.raf);
      this.raf = 0;
      this.held = { move: 0, turn: 0 };
      if (!this.disposed) this.o.onContext?.(false);
    });
    this.canvas.addEventListener('webglcontextrestored', () => {
      this.lostContext = false;
      if (this.disposed) return;
      this.renderNow();
      this.kick();
      this.o.onContext?.(true);
    });
    this.decor = (o.decor ?? []).filter(isFarmDecor);
    this.obstacles = obstaclesAt(o.stage, this.decor);
    this.build();
  }

  // ---------------------------------------------------------------- the world

  private mat(c: string, rough = 0.85): THREE.MeshStandardMaterial {
    const m = new THREE.MeshStandardMaterial({ color: col(c), roughness: rough, metalness: 0 });
    this.disposables.push(m);
    return m;
  }
  private geo<T extends THREE.BufferGeometry>(g: T): T {
    this.disposables.push(g);
    return g;
  }
  private track<T extends { dispose(): void }>(d: T): T {
    this.disposables.push(d);
    return d;
  }
  private add(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent: THREE.Object3D = this.scene): THREE.Mesh {
    const mesh = new THREE.Mesh(g, m);
    mesh.position.set(x, y, z);
    parent.add(mesh);
    return mesh;
  }

  private build(): void {
    const ev = this.o.evening;
    // A sky dome: deep at the top, soft at the horizon (warm at dusk); the fog fades into the horizon colour.
    const top = col(ev ? '#3b4378' : '#8fcbea');
    const horizon = col(ev ? '#e9a98a' : '#e6f4f2');
    this.scene.background = horizon;
    this.scene.fog = new THREE.Fog(horizon, 34, 110);
    const dome = this.geo(new THREE.SphereGeometry(150, 24, 16));
    const dc: number[] = [];
    const dp = dome.attributes.position as THREE.BufferAttribute;
    const c = new THREE.Color();
    for (let i = 0; i < dp.count; i++) {
      const t = Math.max(0, Math.min(1, dp.getY(i) / 90));
      c.copy(horizon).lerp(top, Math.pow(t, 0.6));
      dc.push(c.r, c.g, c.b);
    }
    dome.setAttribute('color', new THREE.Float32BufferAttribute(dc, 3));
    const dm = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide, fog: false, depthWrite: false });
    this.disposables.push(dm);
    const sky = new THREE.Mesh(dome, dm);
    sky.renderOrder = -1;
    this.scene.add(sky);
    // The sun (or, in the evening, a low warm one).
    const sunM = new THREE.MeshBasicMaterial({ color: col(ev ? '#ffd2a0' : '#fff3c4'), fog: false });
    this.disposables.push(sunM);
    const sun = new THREE.Mesh(this.geo(new THREE.CircleGeometry(6, 24)), sunM);
    addLights(this.scene);
    // D47 PR 3: the sun in the sky is where the light comes from (upper left, behind the player at the gate, as the
    // drawn Farm's sun lights its things from the front left); low and warm in the evening.
    const light = this.scene.children.find((l): l is THREE.DirectionalLight => l instanceof THREE.DirectionalLight);
    if (light && ev) {
      light.position.set(-0.7, 0.35, 1.1);
      light.color.set('#ffc89a');
    }
    const dir = (light?.position.clone() ?? new THREE.Vector3(-0.7, 1, 1.1)).normalize();
    sun.position.copy(dir.multiplyScalar(120));
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
    if (ev) for (const l of this.scene.children) if (l instanceof THREE.Light) l.intensity *= 0.55;
    // D47 PR 2: the painted textures and pieces the Farm's things share.
    const kit: PropKit = { mat: (c, rough) => this.mat(c, rough), geo: (g) => this.geo(g), track: (d) => this.track(d) };
    this.wood = this.track(plankTexture(seedOf('farm-boards')));
    this.straw = this.track(strawTexture(seedOf('farm-straw')));
    this.shadows = new Shadows(this.scene, kit);
    this.treeMat = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.85 }));
    this.appleGeo = this.geo(appleGeometry());
    this.appleMat = this.track(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }));
    this.stoneGeo = this.geo(stoneGeometry(seedOf('farm-stone')));
    this.stoneMat = this.mat(FARM.stone.face, 0.95);
    this.buildGround();
    this.buildPathStones();
    const f = new Set(featuresAt(this.o.stage));
    this.buildHills();
    if (f.has('fence')) this.buildFence();
    if (f.has('hay')) this.buildHay(PLACES.hay.x, PLACES.hay.z);
    if (f.has('mud')) {
      const m = this.add(this.geo(new THREE.CircleGeometry(PLACES.mud.r, 28)), this.mat(FARM.ground.mud, 0.95), PLACES.mud.x, 0.03, PLACES.mud.z);
      m.rotation.x = -Math.PI / 2;
      m.scale.set(1.3, 0.8, 1);
    }
    if (f.has('barn')) this.buildBarn();
    if (f.has('bales')) this.buildBales();
    if (f.has('pond')) this.buildPond();
    if (f.has('henhouse')) this.buildHenHouse();
    if (f.has('sunflowers')) this.buildSunflowers();
    if (f.has('orchard')) {
      for (const [x, z] of PLACES.orchard) this.buildTree(x, z);
      this.buildOrchardLife();
    }
    if (f.has('windmill')) this.buildWindmill();
    if (f.has('party')) this.buildPartyLights(ev);
    for (const d of this.decor) this.buildDecor(d);
    // D47 PR 1: the meadow (grass, wildflowers, clover, butterflies), clear of everything standing here.
    this.meadow = buildMeadow(this.o.stage, this.decor, this.quality, groundY, (d) => this.disposables.push(d));
    this.scene.add(this.meadow.root);
    this.buildPastureLife();
    this.buildResidents();
  }

  private buildGround(): void {
    const size = 120;
    const seg = this.quality === 'high' ? 96 : 48;
    const g = this.geo(new THREE.PlaneGeometry(size, size, seg, seg));
    g.rotateX(-Math.PI / 2);
    const pos = g.attributes.position as THREE.BufferAttribute;
    const colors: number[] = [];
    const grass = col(FARM.ground.grass);
    const grass2 = col(FARM.ground.grassLight);
    const dirt = col(FARM.ground.dirt);
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundY(x, z));
      // The path: from the gate to the barn, a gentle S.
      const off = pathOffset(x, z);
      const n = (Math.sin(x * 1.7) * Math.cos(z * 1.3) + 1) / 2;
      c.copy(grass).lerp(grass2, n * 0.7);
      if (off < 1.3) c.copy(dirt).lerp(grass, Math.max(0, off - 0.8) * 1.4);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.disposables.push(m);
    this.ground = new THREE.Mesh(g, m);
    this.scene.add(this.ground);
    // D47: the grass, wildflowers and butterflies are the meadow's (built with the rest of the world, in build()).
  }

  /** D47 PR 2: pebbles along the path's edges, and a few stones about the Farm. */
  private buildPathStones(): void {
    const r = seeded(seedOf('walk-pebbles'));
    const spots: Array<[number, number, number]> = [];
    for (let z = -9.5; z < 23.5; z += 0.55) {
      const px = pathX(z);
      for (const side of [-1, 1]) if (r() < 0.7) spots.push([px + side * (0.95 + r() * 0.45), z + (r() - 0.5) * 0.3, 0.05 + r() * 0.07]);
    }
    // Stones in small groups: by the fence's corners, the gate, the windmill's hill.
    for (const [cx, cz] of [
      [-7.6, -7.6],
      [7.6, 12.6],
      [-3.4, 19],
      [14, 8],
      [-22, -27],
      [18, -22],
      [-18, 14],
    ])
      for (let k = 0; k < 4; k++) spots.push([cx + (r() - 0.5) * 1.6, cz + (r() - 0.5) * 1.6, 0.12 + r() * 0.22]);
    const obstacles = this.obstacles;
    const free = spots.filter(([x, z]) => !obstacles.some((o) => (o.r !== undefined ? Math.hypot(x - o.x, z - o.z) < o.r : false)));
    const inst = new THREE.InstancedMesh(this.stoneGeo, this.stoneMat, free.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tone = new THREE.Color();
    free.forEach(([x, z, s], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r() * 6.28);
      inst.setMatrixAt(i, m4.compose(new THREE.Vector3(x, groundY(x, z) + s * 0.15, z), q, new THREE.Vector3(s * (1 + r() * 0.4), s, s)));
      inst.setColorAt(i, tone.setRGB(0.85 + r() * 0.2, 0.83 + r() * 0.18, 0.78 + r() * 0.18));
    });
    this.scene.add(inst);
  }

  private buildHills(): void {
    // Far rolling hills (and a few round trees on them) closing the world in.
    const hm = this.mat(FARM.ground.hills);
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2 + 0.3;
      const r = 62 + (i % 3) * 6;
      const h = this.add(this.geo(new THREE.SphereGeometry(16 + (i % 4) * 4, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2)), hm, Math.sin(a) * r, -2, Math.cos(a) * r);
      h.scale.y = 0.45;
    }
  }

  private buildFence(): void {
    const { x0, x1, z0, z1 } = PLACES.pasture;
    const posts: Array<[number, number]> = [];
    const rails: Array<[number, number, number, number]> = [];
    const side = (ax: number, az: number, bx: number, bz: number, gap?: [number, number]) => {
      const len = Math.hypot(bx - ax, bz - az);
      const n = Math.round(len / 2.2);
      for (let i = 0; i <= n; i++) {
        const t = i / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (gap && x > gap[0] && x < gap[1]) continue;
        posts.push([x, z]);
        if (i < n) {
          const nx = ax + (bx - ax) * ((i + 1) / n);
          if (gap && ((x <= gap[0] && nx > gap[0]) || (x >= gap[0] && x < gap[1]))) continue;
          rails.push([x, z, nx, az + (bz - az) * ((i + 1) / n)]);
        }
      }
    };
    side(x0, z0, x1, z0);
    side(x1, z0, x1, z1);
    side(x0, z1, x1, z1, [-2.2, 2.2]); // the gate's gap, where the path comes in
    side(x0, z0, x0, z1);
    // D47 PR 2: weathered boards (painted grain), posts a touch out of true with pointed caps, rails each their own shade.
    const wood = this.mat(FARM.wood.post);
    wood.map = this.wood;
    const pg = this.geo(new THREE.BoxGeometry(0.16, 1.1, 0.16));
    scaleUv(pg, 0.12, 1);
    const pm = new THREE.InstancedMesh(pg, wood, posts.length);
    const cap = new THREE.InstancedMesh(this.geo(new THREE.ConeGeometry(0.13, 0.14, 4).rotateY(Math.PI / 4)), this.mat(FARM.wood.cap), posts.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const e = new THREE.Euler();
    const one = new THREE.Vector3(1, 1, 1);
    const shade = new THREE.Color();
    const r = seeded(seedOf('walk-fence'));
    posts.forEach(([x, z], i) => {
      q.setFromEuler(e.set((r() - 0.5) * 0.06, r() * 0.4, (r() - 0.5) * 0.06));
      pm.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0.55, z), q, one));
      cap.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 1.17, z), q, one));
      pm.setColorAt(i, shade.setScalar(0.88 + r() * 0.14));
      this.shadows.add(x, z, 0.5, 0.5, 0, 0, 0.6);
    });
    this.scene.add(pm, cap);
    const rg = this.geo(new THREE.BoxGeometry(1, 0.1, 0.07));
    scaleUv(rg, 2, 0.08);
    const rm = new THREE.InstancedMesh(rg, wood, rails.length * 2);
    rails.forEach(([ax, az, bx, bz], i) => {
      const len = Math.hypot(bx - ax, bz - az);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(bz - az, bx - ax));
      for (const [k, y] of [
        [0, 0.45],
        [1, 0.85],
      ]) {
        rm.setMatrixAt(i * 2 + k, m4.compose(new THREE.Vector3((ax + bx) / 2, y + (r() - 0.5) * 0.03, (az + bz) / 2), q, new THREE.Vector3(len, 1, 1)));
        rm.setColorAt(i * 2 + k, shade.setScalar(0.86 + r() * 0.16));
      }
    });
    this.scene.add(rm);
  }

  private buildHay(x: number, z: number): void {
    // D47 PR 2: a round bale of rolled straw (its ends a spiral), loose straw round its foot, and its shadow.
    const g = this.geo(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 28));
    scaleUv(g, 3, 1);
    const side = this.mat('#ffffff', 0.95);
    side.map = this.straw;
    const end = this.mat('#ffffff', 0.95);
    end.map = this.track(baleEndTexture());
    const m = new THREE.Mesh(g, [side, end, end]);
    m.position.set(x, 0.9, z);
    m.rotation.z = Math.PI / 2;
    this.scene.add(m);
    this.shadows.add(x, z, 2.2, 2.6);
    const loose = this.geo(new THREE.ConeGeometry(0.18, 0.16, 6));
    const lm = this.mat(FARM.straw.loose);
    for (const [dx, dz] of [
      [0.8, 0.6],
      [-0.7, 0.8],
      [0.3, -0.9],
    ])
      this.add(loose, lm, x + dx, 0.06, z + dz).scale.set(1.4, 1, 0.8);
  }

  private buildBarn(): void {
    const { x, z, w, d } = PLACES.barn;
    const h = 5;
    // D47 PR 2: red boards (painted grain and seams), a shingled roof, white trim at the corners and eaves, and a stone
    // footing; its soft shadow on the grass.
    const red = this.mat(FARM.barn.wall);
    red.map = this.wood;
    const white = this.mat(FARM.barn.trim);
    const barn = new THREE.Group();
    barn.position.set(x, 0, z);
    barn.rotation.y = PLACES.barn.rot;
    this.scene.add(barn);
    const walls = this.geo(new THREE.BoxGeometry(w, h, d));
    scaleUv(walls, 3.4, 1.6);
    this.add(walls, red, 0, h / 2, 0, barn);
    for (const [cx, cz] of [
      [-1, -1],
      [1, -1],
      [-1, 1],
      [1, 1],
    ])
      this.add(this.geo(new THREE.BoxGeometry(0.22, h, 0.22)), white, (cx * w) / 2, h / 2, (cz * d) / 2, barn);
    this.add(this.geo(new THREE.BoxGeometry(w + 0.12, 0.2, d + 0.12)), white, 0, h - 0.1, 0, barn);
    const footing = this.mat(FARM.barn.footing, 0.95);
    footing.map = this.wood;
    this.add(this.geo(new THREE.BoxGeometry(w + 0.16, 0.36, d + 0.16)), footing, 0, 0.18, 0, barn);
    this.shadows.add(x, z, w + 3.2, d + 3.2, 0, PLACES.barn.rot, 0.9);
    // The roof: a prism over the long side, white-trimmed.
    const roof = new THREE.Shape();
    roof.moveTo(-w / 2 - 0.4, 0);
    roof.lineTo(0, 3.2);
    roof.lineTo(w / 2 + 0.4, 0);
    roof.lineTo(-w / 2 - 0.4, 0);
    const rg = this.geo(new THREE.ExtrudeGeometry(roof, { depth: d + 0.6, bevelEnabled: false }));
    scaleUv(rg, 0.35, 0.35);
    const roofM = this.mat(FARM.barn.roof, 0.9);
    roofM.map = this.track(shingleTexture(seedOf('barn-roof')));
    this.add(rg, roofM, 0, h, -d / 2 - 0.3, barn);
    // Front: big doors with their white X, the hayloft, two windows.
    const front = d / 2 + 0.02;
    // The doorway (dark inside), and two doors on their hinges, each with half of the white X: they swing open when
    // the player walks up (D45 PR C), and a chick looks out.
    this.add(this.geo(new THREE.PlaneGeometry(3.4, 3.6)), this.mat(FARM.barn.doorway, 1), 0, 1.8, front, barn);
    const doorG = this.geo(new THREE.BoxGeometry(1.7, 3.6, 0.08));
    const doorM = this.mat(FARM.barn.door);
    const bar = this.geo(new THREE.BoxGeometry(0.14, 3.9, 0.04));
    for (const side of [-1, 1]) {
      const hinge = new THREE.Group();
      hinge.position.set(side * 1.7, 1.8, front + 0.05);
      barn.add(hinge);
      this.add(doorG, doorM, -side * 0.85, 0, 0, hinge);
      const b = this.add(bar, white, -side * 0.85, 0, 0.06, hinge);
      b.rotation.z = side * 0.44;
      hinge.userData.side = side;
      this.barnDoors.push(hinge);
    }
    // The chick in the doorway: out of sight until the doors open.
    const chick = new THREE.Group();
    chick.position.set(0.5, 0, front - 0.9);
    barn.add(chick);
    const yellow = this.mat('#ffd84a', 0.7);
    this.add(this.geo(new THREE.SphereGeometry(0.26, 14, 10)), yellow, 0, 0.26, 0, chick);
    this.add(this.geo(new THREE.SphereGeometry(0.17, 12, 10)), yellow, 0, 0.6, 0.08, chick);
    this.add(this.geo(new THREE.ConeGeometry(0.05, 0.14, 8)), this.mat('#f2a23a'), 0, 0.58, 0.28, chick).rotation.x = Math.PI / 2;
    const eye = this.geo(new THREE.SphereGeometry(0.025, 8, 6));
    const dark = this.mat('#2f2a27', 0.4);
    this.add(eye, dark, -0.07, 0.65, 0.22, chick);
    this.add(eye, dark, 0.07, 0.65, 0.22, chick);
    this.moments.set('barn', {
      start: -1e9,
      ms: 2600,
      frame: (t) => {
        // Steps forward into the doorway, a little hop, and stays looking out.
        const out = Math.min(1, t / 0.35);
        chick.position.z = front - 0.9 + out * 1.5;
        chick.position.y = t > 0.4 && t < 0.75 ? Math.abs(Math.sin(((t - 0.4) / 0.35) * Math.PI * 2)) * 0.22 : 0;
      },
    });
    const frame = this.geo(new THREE.BoxGeometry(3.6, 0.18, 0.06));
    this.add(frame, white, 0, 3.65, front + 0.03, barn);
    const glow = this.o.evening;
    const win = new THREE.MeshStandardMaterial({ color: col(glow ? '#ffd27a' : '#f8e6b8'), emissive: col(glow ? '#ffb347' : '#000000'), emissiveIntensity: glow ? 0.9 : 0 });
    this.disposables.push(win);
    for (const [wx, wy, ww] of [
      [-3, 2.8, 1.1],
      [3, 2.8, 1.1],
      [0, 5.6, 1.4],
    ])
      this.add(this.geo(new THREE.PlaneGeometry(ww, ww)), win, wx, wy, front + 0.01, barn);
    if (glow) {
      const lamp = new THREE.PointLight('#ffc070', 6, 12, 1.6);
      lamp.position.set(0, 3, front + 1.5);
      barn.add(lamp);
    }
  }

  private buildBales(): void {
    // D47 PR 2: square bales of straw, tied with twine, in their shadow.
    const g = this.geo(new THREE.BoxGeometry(1.4, 0.8, 0.9));
    scaleUv(g, 1.2, 0.7);
    const m = this.mat('#ffffff', 0.95);
    m.map = this.straw;
    const twine = this.geo(new THREE.BoxGeometry(0.04, 0.82, 0.92));
    const tm = this.mat(FARM.straw.twine);
    const { x, z } = PLACES.bales;
    for (const [dx, dy, dz, turn] of [
      [-0.72, 0.4, 0, 0.03],
      [0.72, 0.4, 0, -0.04],
      [0, 1.2, 0, 0.08],
    ]) {
      const b = this.add(g, m, x + dx, dy, z + dz);
      b.rotation.y = turn;
      for (const t of [-0.35, 0.35]) this.add(twine, tm, t, 0, 0, b);
    }
    this.shadows.add(x, z, 3.6, 2.2);
  }

  private buildPond(): void {
    const { x, z, r } = PLACES.pond;
    // D47 PR 2: a bank of damp earth and stones round the water, deeper blue toward the middle, lily pads (one in
    // flower), and slow rings spreading now and then (still under reduced motion).
    const rim = this.add(this.geo(new THREE.CircleGeometry(r + 0.6, 48)), this.mat(FARM.pond.rim), x, 0.02, z);
    rim.rotation.x = -Math.PI / 2;
    const bank = this.add(this.geo(new THREE.RingGeometry(r - 0.15, r + 0.35, 48)), this.mat(FARM.pond.bank, 0.95), x, 0.035, z);
    bank.rotation.x = -Math.PI / 2;
    const wg = this.geo(new THREE.CircleGeometry(r, 48));
    const wc: number[] = [];
    const deep = col(FARM.pond.deep);
    const shallow = col(FARM.pond.shallow);
    const c = new THREE.Color();
    const wp = wg.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < wp.count; i++) {
      c.copy(deep).lerp(shallow, Math.min(1, Math.hypot(wp.getX(i), wp.getY(i)) / r) ** 1.5);
      wc.push(c.r, c.g, c.b);
    }
    wg.setAttribute('color', new THREE.Float32BufferAttribute(wc, 3));
    const water = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.12, metalness: 0.1 });
    this.disposables.push(water);
    const w = this.add(wg, water, x, 0.05, z);
    w.rotation.x = -Math.PI / 2;
    const sr = seeded(seedOf('pond-bank'));
    const stones = new THREE.InstancedMesh(this.stoneGeo, this.stoneMat, 34);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const tone = new THREE.Color();
    for (let i = 0; i < 34; i++) {
      const a = (i / 34) * Math.PI * 2 + sr() * 0.12;
      const d = r + 0.05 + sr() * 0.35;
      const s = 0.14 + sr() * 0.18;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), sr() * 6.28);
      stones.setMatrixAt(i, m4.compose(new THREE.Vector3(x + Math.cos(a) * d, 0.04, z + Math.sin(a) * d), q, new THREE.Vector3(s * 1.3, s, s)));
      stones.setColorAt(i, tone.setScalar(0.82 + sr() * 0.3));
    }
    this.scene.add(stones);
    const padM = this.mat(FARM.pond.pad, 0.7);
    padM.side = THREE.DoubleSide;
    const padG = this.geo(lilyPadGeometry());
    for (const [dx, dz, s, a] of [
      [1.9, 1.6, 1, 0.3],
      [2.4, 0.9, 0.8, 2.1],
      [-2.6, -1.2, 0.9, 4],
      [-1.9, -2.1, 0.7, 1.2],
      [0.4, 2.8, 0.75, 5.1],
    ]) {
      const pad = this.add(padG, padM, x + dx, 0.07, z + dz);
      pad.scale.setScalar(s);
      pad.rotation.y = a;
    }
    const lily = this.add(this.geo(new THREE.ConeGeometry(0.13, 0.12, 8, 1, true)), this.mat(FARM.pond.lily, 0.7), x + 1.95, 0.13, z + 1.55);
    lily.rotation.x = Math.PI;
    this.add(this.geo(new THREE.SphereGeometry(0.05, 8, 6)), this.mat(FARM.pond.lilyHeart, 0.6), x + 1.95, 0.12, z + 1.55);
    // Slow rings, now here, now there.
    const calmM = new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0, depthWrite: false });
    this.disposables.push(calmM);
    const calmG = this.geo(new THREE.RingGeometry(0.46, 0.5, 32));
    const calm = [0, 1].map((k) => {
      const m = this.add(calmG, k ? calmM.clone() : calmM, x, 0.06, z);
      if (k) this.disposables.push(m.material as THREE.Material);
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    this.tickers.push((t, still) => {
      calm.forEach((m, k) => {
        const u = ((t + k * 3.5) % 7) / 7;
        const mat = m.material as THREE.MeshBasicMaterial;
        if (still) {
          mat.opacity = 0;
          return;
        }
        if (u < 0.02) {
          const a = Math.floor((t + k * 3.5) / 7) * 2.4 + k;
          m.position.set(x + Math.cos(a) * r * 0.45, 0.06, z + Math.sin(a) * r * 0.45);
        }
        m.scale.setScalar(0.6 + u * 3);
        mat.opacity = Math.sin(u * Math.PI) * 0.35;
      });
    });
    this.shadows.add(x, z, 2 * r + 2, 2 * r + 2, 0, 0, 0.25);
    // Two ducks. When the player comes to the bank they splash hello (D45 PR C): a hop, a shake, rings on the water.
    const ducks: THREE.Group[] = [];
    const duck = (dx: number, dz: number, c: string) => {
      const g = new THREE.Group();
      g.position.set(x + dx, 0, z + dz);
      this.scene.add(g);
      this.add(this.geo(new THREE.SphereGeometry(0.28, 16, 12)), this.mat(c), 0, 0.2, 0, g).scale.set(1.3, 0.8, 1);
      this.add(this.geo(new THREE.SphereGeometry(0.17, 14, 10)), this.mat(c), 0.24, 0.45, 0, g);
      this.add(this.geo(new THREE.ConeGeometry(0.06, 0.16, 8)), this.mat('#f2a23a'), 0.42, 0.44, 0, g).rotation.z = -Math.PI / 2;
      ducks.push(g);
    };
    duck(-1, 0.6, '#ffffff');
    duck(1.2, -0.8, '#f6e9b0');
    const ringM = new THREE.MeshBasicMaterial({ color: col('#ffffff'), transparent: true, opacity: 0, depthWrite: false });
    this.disposables.push(ringM);
    const ringG = this.geo(new THREE.RingGeometry(0.42, 0.5, 28));
    const rings = ducks.map((d) => {
      const m = this.add(ringG, ringM, d.position.x, 0.07, d.position.z);
      m.rotation.x = -Math.PI / 2;
      return m;
    });
    const dropM = new THREE.MeshBasicMaterial({ color: col('#dff3fb'), transparent: true, opacity: 0, depthWrite: false });
    this.disposables.push(dropM);
    const dropG = this.geo(new THREE.SphereGeometry(0.05, 6, 5));
    const drops = ducks.flatMap((d, k) => [0, 1, 2, 3, 4].map((i) => ({ m: this.add(dropG, dropM, d.position.x, 0.1, d.position.z), a: i * 1.26 + k, d })));
    this.moments.set('pond', {
      start: -1e9,
      ms: 2200,
      frame: (t) => {
        ducks.forEach((d, i) => {
          const u = Math.max(0, Math.min(1, (t - i * 0.12) / 0.6));
          d.position.y = Math.sin(u * Math.PI) * 0.34;
          d.rotation.z = Math.sin(u * Math.PI * 6) * 0.22 * (1 - u);
          // They turn to face the player as they settle.
          d.rotation.y = -yawTo(d.position.x, d.position.z, this.walker.x, this.walker.z) - Math.PI / 2;
        });
        const k = Math.max(0, Math.min(1, (t - 0.2) / 0.8));
        rings.forEach((r) => r.scale.setScalar(1 + k * 3.2));
        ringM.opacity = t >= 1 ? 0 : Math.sin(k * Math.PI) * 0.7;
        for (const dr of drops) {
          const u = Math.max(0, Math.min(1, (t - 0.18) / 0.5));
          dr.m.position.set(dr.d.position.x + Math.cos(dr.a) * u * 0.9, 0.1 + Math.sin(u * Math.PI) * 0.75, dr.d.position.z + Math.sin(dr.a) * u * 0.9);
        }
        dropM.opacity = t > 0.18 && t < 0.68 ? 0.9 : 0;
      },
    });
    // Reeds.
    const reed = this.geo(new THREE.CylinderGeometry(0.03, 0.03, 1.2, 6));
    const head = this.geo(new THREE.CapsuleGeometry(0.07, 0.3, 4, 8));
    for (const a of [0.4, 0.55, 2.6, 2.75, 4.2]) {
      const rx = x + Math.cos(a) * (r + 0.2);
      const rz = z + Math.sin(a) * (r + 0.2);
      this.add(reed, this.mat('#6f9a4a'), rx, 0.6, rz);
      this.add(head, this.mat('#8a5a3a'), rx, 1.25, rz);
    }
  }

  private buildHenHouse(): void {
    const { x, z } = PLACES.henhouse;
    // D47 PR 2: cream boards, a shingled roof, a little ramp, and its shadow.
    const boards = this.mat(FARM.hen.wall);
    boards.map = this.wood;
    const body = this.geo(new THREE.BoxGeometry(2.6, 1.8, 2.4));
    scaleUv(body, 1.2, 0.8);
    this.add(body, boards, x, 0.9, z);
    const roofM = this.mat(FARM.hen.roof, 0.9);
    roofM.map = this.track(shingleTexture(seedOf('hen-roof')));
    const roof = this.add(this.geo(new THREE.ConeGeometry(2.3, 1.3, 4)), roofM, x, 2.45, z);
    roof.rotation.y = Math.PI / 4;
    this.add(this.geo(new THREE.PlaneGeometry(0.7, 1)), this.mat(FARM.hen.door), x + 0.2, 0.55, z + 1.21);
    const ramp = this.add(this.geo(new THREE.BoxGeometry(0.6, 0.05, 1.1)), this.mat(FARM.wood.post), x + 0.2, 0.22, z + 1.7);
    ramp.rotation.x = 0.38;
    this.shadows.add(x, z, 4, 3.8);
  }

  private buildSunflowers(): void {
    // D47 PR 2: tall sunflowers along the pasture: a stem that bends a little, broad leaves, a head of golden petals
    // round a seed spiral, each its own height and turn, nodding slowly in the breeze.
    const stemM = this.mat(FARM.sunflower.stem);
    const leafM = this.mat(FARM.sunflower.leaf, 0.8);
    leafM.side = THREE.DoubleSide;
    const leafG = this.geo(sunflowerLeafGeometry());
    const headM = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8, side: THREE.DoubleSide });
    this.disposables.push(headM);
    const heads = [11, 23, 37].map((k) => this.geo(sunflowerHeadGeometry(k)));
    const discM = this.mat('#ffffff', 0.95);
    discM.map = this.track(seedHeadTexture());
    const disc = this.geo(new THREE.CircleGeometry(0.16, 24));
    const r = seeded(seedOf('walk-sunflowers'));
    for (let i = 0; i < 9; i++) {
      const x = -8.6 - (i % 2) * 0.5;
      const z = -5 + i * 1.8;
      const h = 1.65 + r() * 0.45;
      const bend = (r() - 0.3) * 0.35;
      const curve = new THREE.QuadraticBezierCurve3(new THREE.Vector3(x, 0, z), new THREE.Vector3(x + bend * 0.2, h * 0.55, z), new THREE.Vector3(x + bend, h, z));
      this.add(this.geo(new THREE.TubeGeometry(curve, 8, 0.045, 6, false)), stemM, 0, 0, 0);
      for (const [t, a] of [
        [0.35, r() * 6.28],
        [0.6, r() * 6.28],
      ]) {
        const p = curve.getPoint(t);
        const leaf = this.add(leafG, leafM, p.x, p.y, p.z);
        leaf.rotation.set(-0.9, a, 0);
      }
      // Facing into the pasture (toward +x), tilted up a little, nodding in the breeze.
      const face = new THREE.Group();
      face.position.set(x + bend, h + 0.05, z);
      face.rotation.set(0, Math.PI / 2 + (r() - 0.5) * 0.5, 0);
      this.scene.add(face);
      const tilt = new THREE.Group();
      tilt.rotation.x = -0.25 - r() * 0.2;
      face.add(tilt);
      tilt.add(new THREE.Mesh(heads[i % 3], headM));
      this.add(disc, discM, 0, 0, 0.035, tilt);
      const phase = r() * 6.28;
      this.tickers.push((t, still) => {
        tilt.rotation.z = still ? 0 : Math.sin(t * 0.8 + phase) * 0.05;
      });
      this.shadows.add(x + bend * 0.5, z, 0.9, 0.9, 0, 0, 0.7);
    }
  }

  private buildTree(x: number, z: number): void {
    // D47 PR 2: an apple tree: a trunk that splits into branches, foliage in layered clusters, apples among them.
    const i = PLACES.orchard.findIndex(([tx, tz]) => tx === x && tz === z);
    const t = appleTreeGeometry(seedOf(`apple-tree-${i}`));
    const mesh = new THREE.Mesh(this.geo(t.geo), this.treeMat);
    mesh.position.set(x, groundY(x, z), z);
    mesh.rotation.y = i * 1.7;
    this.scene.add(mesh);
    mesh.updateMatrixWorld();
    const apples = new THREE.InstancedMesh(this.appleGeo, this.appleMat, t.apples.length);
    const m4 = new THREE.Matrix4();
    t.apples.forEach((p, k) => apples.setMatrixAt(k, m4.makeTranslation(p.clone().applyMatrix4(mesh.matrixWorld))));
    this.scene.add(apples);
    this.shadows.add(x, z, 4.6, 4.6, groundY(x, z));
  }

  /** The orchard's moment (D45 PR C): an apple drops from the nearest tree, and three birds fly up out of it. */
  private buildOrchardLife(): void {
    const [tx, tz] = PLACES.orchard[2];
    const apple = this.add(this.appleGeo, this.appleMat, tx + 1.2, 2.6, tz + 1.3);
    const birdM = this.mat('#4a4f63', 0.8);
    const wingG = this.geo(new THREE.BoxGeometry(0.34, 0.02, 0.14));
    const birds = [0, 1, 2].map((i) => {
      const g = new THREE.Group();
      g.visible = false;
      const l = new THREE.Group();
      const r = new THREE.Group();
      this.add(wingG, birdM, -0.17, 0, 0, l);
      this.add(wingG, birdM, 0.17, 0, 0, r);
      g.add(l, r);
      this.scene.add(g);
      return { g, l, r, a: 0.6 + i * 0.9 };
    });
    this.moments.set('orchard', {
      start: -1e9,
      ms: 3200,
      frame: (t) => {
        // The apple: falls, bounces twice, rests in the grass.
        const u = Math.min(1, t / 0.4);
        const fall = u < 0.55 ? (u / 0.55) ** 2 : 1 - Math.abs(Math.sin(((u - 0.55) / 0.45) * Math.PI * 2)) * 0.12 * (1 - u);
        apple.position.y = 2.6 - fall * 2.47;
        for (const b of birds) {
          const k = Math.max(0, Math.min(1, (t - 0.1) / 0.9));
          b.g.visible = k > 0 && k < 1;
          b.g.position.set(tx + Math.cos(b.a) * (1 + k * 9), 3.6 + k * 7 + Math.sin(k * 9 + b.a) * 0.3, tz + Math.sin(b.a) * (1 + k * 9));
          b.g.rotation.y = -b.a;
          const flap = Math.sin(k * 60 + b.a) * 0.7;
          b.l.rotation.z = flap;
          b.r.rotation.z = -flap;
        }
      },
    });
  }

  /**
   * The pasture's moment (D45 PR C): butterflies rise from the clover, flutter round and settle again. Since D47 they
   * are the meadow's own butterflies, resting on the pasture's clover: arriving sends them up together.
   */
  private buildPastureLife(): void {
    const m: Moment = {
      start: -1e9,
      ms: 5200,
      frame: (t) => {
        if (t < 0.5) this.meadow.butterflies.scatter(m.start);
      },
    };
    this.moments.set('pasture', m);
  }

  /** One of the player's decorations (D45 PR C), where the drawn Farm has it too. */
  private buildDecor(id: FarmDecor): void {
    const p = DECOR_PLACES[id];
    const g = new THREE.Group();
    g.position.set(p.x, groundY(p.x, p.z), p.z);
    g.rotation.y = p.rot;
    g.name = `decor:${id}`;
    this.scene.add(g);
    // Its soft shadow (D47 PR 2), the size of its footprint.
    const span = p.r !== undefined ? p.r * 2.6 : Math.max(p.hw ?? 1, p.hd ?? 1) * 2.4;
    this.shadows.add(p.x, p.z, span, span, groundY(p.x, p.z), p.rot);
    const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number) => this.add(this.geo(new THREE.BoxGeometry(w, h, d)), this.mat(c), x, y, z, g);
    const cyl = (r0: number, r1: number, h: number, c: string, x: number, y: number, z: number, seg = 14) => this.add(this.geo(new THREE.CylinderGeometry(r0, r1, h, seg)), this.mat(c), x, y, z, g);
    const ball = (r: number, c: string, x: number, y: number, z: number) => this.add(this.geo(new THREE.SphereGeometry(r, 14, 10)), this.mat(c), x, y, z, g);
    const wheel = (r: number, x: number, y: number, z: number) => {
      const w = cyl(r, r, r * 0.5, '#3d3a3a', x, y, z, 18);
      w.rotation.x = Math.PI / 2;
      const hub = cyl(r * 0.4, r * 0.4, r * 0.52, '#f6c430', x, y, z, 12);
      hub.rotation.x = Math.PI / 2;
    };
    if (id === 'scarecrow') {
      cyl(0.06, 0.07, 2.3, '#8a6a4f', 0, 1.15, 0, 6);
      cyl(0.05, 0.05, 1.8, '#8a6a4f', 0, 1.65, 0, 6).rotation.z = Math.PI / 2;
      box(0.75, 0.8, 0.3, '#5d8fc9', 0, 1.45, 0);
      box(0.22, 0.22, 0.32, '#e2603f', -0.15, 1.3, 0.01);
      ball(0.28, '#f3e2bf', 0, 2.15, 0);
      this.add(this.geo(new THREE.ConeGeometry(0.42, 0.4, 12)), this.mat('#d9a441'), 0, 2.5, 0, g);
      cyl(0.5, 0.5, 0.03, '#d9a441', 0, 2.32, 0);
      for (const sx of [-0.1, 0.1]) ball(0.035, '#2f2a27', sx, 2.2, 0.25);
      for (const sx of [-0.95, 0.95]) ball(0.12, '#e8c76a', sx, 1.65, 0);
    } else if (id === 'wheelbarrow') {
      box(1.1, 0.4, 0.75, '#d6453a', 0, 0.62, 0);
      box(1.0, 0.06, 0.65, '#6b4a34', 0, 0.82, 0);
      wheel(0.26, 0.75, 0.26, 0);
      for (const sz of [-0.3, 0.3]) {
        cyl(0.03, 0.03, 0.9, '#8a6a4f', -0.9, 0.62, sz, 6).rotation.z = Math.PI / 2 - 0.25;
        cyl(0.03, 0.03, 0.45, '#8a6a4f', -0.35, 0.22, sz, 6);
      }
      // Daisies and sweet peas.
      const cols = ['#ffffff', '#f4a6c4', '#f6d27a', '#c9a0e8', '#ffffff', '#f4a6c4'];
      cols.forEach((c, i) => {
        const fx = -0.38 + (i % 3) * 0.38;
        const fz = i < 3 ? -0.17 : 0.17;
        cyl(0.015, 0.015, 0.3, '#6f9a4a', fx, 0.98, fz, 5);
        ball(0.09, c, fx, 1.16, fz);
      });
    } else if (id === 'trough') {
      box(2.4, 0.5, 0.9, '#8a6a4f', 0, 0.42, 0);
      const water = new THREE.MeshStandardMaterial({ color: col('#a7d3e4'), roughness: 0.15, metalness: 0.1 });
      this.disposables.push(water);
      this.add(this.geo(new THREE.BoxGeometry(2.2, 0.04, 0.7)), water, 0, 0.66, 0, g);
      for (const sx of [-1, 1]) for (const sz of [-0.35, 0.35]) box(0.14, 0.34, 0.14, '#6b4a34', sx, 0.17, sz);
    } else if (id === 'tireswing') {
      // An apple tree with a tire on its lowest branch.
      cyl(0.26, 0.36, 3, '#8a6648', 0, 1.5, 0, 8);
      const crown = ball(2.0, '#7fb35d', 0, 4.3, 0);
      crown.scale.y = 0.85;
      cyl(0.09, 0.12, 2.2, '#8a6648', 1.0, 2.75, 0, 6).rotation.z = Math.PI / 2 - 0.12;
      cyl(0.015, 0.015, 1.5, '#e8dcc0', 1.7, 1.95, 0, 5);
      const tire = this.add(this.geo(new THREE.TorusGeometry(0.42, 0.15, 10, 22)), this.mat('#3d3a3a', 0.95), 1.7, 0.85, 0, g);
      tire.rotation.y = Math.PI / 2;
      for (let i = 0; i < 5; i++) ball(0.13, '#d8342c', Math.cos(i * 1.3) * 1.7, 4 + Math.sin(i * 2.1) * 0.6, Math.sin(i * 1.3) * 1.7);
    } else if (id === 'rescuewagon') {
      // D47 PR 7: the Rescue Wagon: a blue-painted bed on four spoked wheels, a box of flowers, a welcome pennant.
      const boards = this.mat('#4f8fb8');
      boards.map = this.wood;
      const bed = this.add(this.geo(new THREE.BoxGeometry(1.7, 0.4, 0.95)), boards, 0, 0.62, 0, g);
      void bed;
      box(1.5, 0.22, 0.78, '#b98a5e', 0, 0.92, 0);
      for (const sx of [-0.6, 0.6]) for (const sz of [-0.5, 0.5]) wheel(0.3, sx, 0.3, sz);
      cyl(0.03, 0.03, 0.9, '#8a6a4f', -1.2, 0.55, 0, 6).rotation.z = Math.PI / 2 - 0.4;
      const cols = ['#f4a6c4', '#ffffff', '#f6d27a', '#b49ae0', '#ffffff', '#f4a6c4', '#f6d27a', '#ffffff'];
      cols.forEach((c, i) => {
        const fx = -0.6 + (i % 4) * 0.4;
        const fz = i < 4 ? -0.18 : 0.18;
        cyl(0.012, 0.012, 0.28, '#6f9a4a', fx, 1.15, fz, 5);
        ball(0.085, c, fx, 1.3, fz);
      });
      cyl(0.025, 0.025, 1.4, '#8a6a4f', 0.78, 1.4, 0.38, 6);
      const flag = new THREE.Shape();
      flag.moveTo(0, 0);
      flag.lineTo(0.5, -0.12);
      flag.lineTo(0, -0.26);
      const fm = this.mat('#e5546c', 0.8);
      fm.side = THREE.DoubleSide;
      const pennant = this.add(this.geo(new THREE.ShapeGeometry(flag)), fm, 0.78, 2.08, 0.38, g);
      const phase = 1.3;
      this.tickers.push((t, still) => {
        pennant.rotation.y = still ? 0 : Math.sin(t * 2.2 + phase) * 0.35;
      });
    } else {
      // The little red tractor.
      box(1.9, 0.7, 1.0, '#d6453a', 0.25, 0.95, 0);
      box(0.95, 0.85, 1.0, '#d6453a', -0.75, 1.5, 0);
      box(1.05, 0.08, 1.15, '#3d3a3a', -0.75, 2.0, 0);
      const glass = new THREE.MeshStandardMaterial({ color: col('#cfe9f5'), roughness: 0.1, transparent: true, opacity: 0.7 });
      this.disposables.push(glass);
      this.add(this.geo(new THREE.BoxGeometry(0.04, 0.5, 0.8)), glass, -0.26, 1.6, 0, g);
      cyl(0.06, 0.06, 0.7, '#3d3a3a', 0.9, 1.6, 0.3, 8);
      for (const sz of [-0.62, 0.62]) {
        wheel(0.62, -0.8, 0.62, sz);
        wheel(0.36, 0.95, 0.36, sz);
      }
      for (const sz of [-0.3, 0.3]) ball(0.08, '#fff3c4', 1.21, 1.05, sz);
    }
  }

  private windmillSails: THREE.Group | null = null;
  private buildWindmill(): void {
    const { x, z } = PLACES.windmill;
    const gy = groundY(x, z);
    // D47 PR 2: a white boarded tower, a shingled cap, and four sails of cloth on wooden frames; its shadow.
    const boards = this.mat(FARM.windmill.tower);
    boards.map = this.wood;
    const tg = this.geo(new THREE.CylinderGeometry(0.9, 1.6, 7, 14));
    scaleUv(tg, 3, 1.2);
    this.add(tg, boards, x, 3.5 + gy, z);
    const capM = this.mat(FARM.windmill.cap, 0.9);
    capM.map = this.track(shingleTexture(seedOf('windmill-cap')));
    this.add(this.geo(new THREE.ConeGeometry(1.2, 1.4, 14)), capM, x, 7.7 + gy, z);
    this.add(this.geo(new THREE.BoxGeometry(0.7, 0.9, 0.08)), this.mat(FARM.windmill.door), x, 0.45 + gy, z + 1.55);
    const sails = new THREE.Group();
    sails.position.set(x, 6.4 + gy, z + 1.1);
    const frameM = this.mat(FARM.windmill.frame);
    const cloth = this.mat(FARM.windmill.cloth, 0.95);
    cloth.side = THREE.DoubleSide;
    const spar = this.geo(new THREE.BoxGeometry(0.1, 3.8, 0.08));
    const rail = this.geo(new THREE.BoxGeometry(0.08, 3.1, 0.06));
    const rung = this.geo(new THREE.BoxGeometry(0.62, 0.05, 0.05));
    const panel = this.geo(new THREE.PlaneGeometry(0.56, 2.9));
    for (let k = 0; k < 4; k++) {
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI) / 2;
      this.add(spar, frameM, 0, 1.9, 0, arm);
      this.add(rail, frameM, 0.62, 2.25, 0, arm);
      for (let j = 0; j < 6; j++) this.add(rung, frameM, 0.31, 0.8 + j * 0.58, 0.02, arm);
      this.add(panel, cloth, 0.31, 2.25, -0.03, arm);
      sails.add(arm);
    }
    this.add(this.geo(new THREE.CylinderGeometry(0.18, 0.18, 0.3, 10).rotateX(Math.PI / 2)), frameM, 0, 0, 0.05, sails);
    this.scene.add(sails);
    this.windmillSails = sails;
    this.shadows.add(x, z, 4.2, 4.2, gy);
  }

  private buildPartyLights(evening: boolean): void {
    // From a post by the bales to the barn's corner: the party spot (D44 PR G), lit in the evening.
    const a = new THREE.Vector3(PLACES.party.x - 2.5, 2.6, PLACES.party.z + 1);
    const b = new THREE.Vector3(PLACES.barn.x - 4.2, 3.8, PLACES.barn.z + 4.4);
    this.add(this.geo(new THREE.CylinderGeometry(0.07, 0.08, 2.6, 6)), this.mat('#8a6a4f'), a.x, 1.3, a.z);
    const mid = a.clone().lerp(b, 0.5);
    mid.y -= 0.7;
    const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
    this.add(this.geo(new THREE.TubeGeometry(curve, 20, 0.015, 4, false)), this.mat('#5b4a3a'), 0, 0, 0);
    const bm = new THREE.MeshStandardMaterial({ color: col('#ffe08a'), emissive: col('#ffcf5a'), emissiveIntensity: evening ? 1.2 : 0.15 });
    this.disposables.push(bm);
    const bg = this.geo(new THREE.SphereGeometry(0.09, 10, 8));
    for (let i = 1; i < 10; i++) {
      const p = curve.getPoint(i / 10);
      this.add(bg, bm, p.x, p.y - 0.12, p.z);
    }
  }

  private buildResidents(): void {
    this.o.residents.forEach((id, i) => {
      const spec = toySpec(id);
      const spot = ANIMAL_SPOTS[i % ANIMAL_SPOTS.length];
      if (!spec || !spot) return;
      const toy = new Toy(spec, this.kit);
      const actor = new Actor(toy, 101 + i * 37);
      const [x, z] = spot;
      const s = settle(x, z, this.obstacles, 0.6);
      toy.root.position.set(s.x, groundY(s.x, s.z), s.z);
      toy.root.scale.setScalar(spec.body === 'big' || spec.body === 'tall' ? 1.25 : 0.95);
      const baseYaw = yawTo(s.x, s.z, PLACES.start.x, PLACES.start.z) + Math.PI;
      // Turned first, then tipped: an animal perks up toward the player whichever way it faces (D45 PR C).
      toy.root.rotation.order = 'YXZ';
      toy.root.rotation.y = baseYaw;
      this.scene.add(toy.root);
      this.residents.push({ id, actor, x: s.x, z: s.z, baseYaw, greetedAt: -1e9, near: false, perk: 0 });
    });
  }

  // ---------------------------------------------------------------- the loop

  /** Sizes the canvas to its box. */
  fit(w: number, h: number): void {
    if (!w || !h) return;
    this.inputAt = performance.now();
    this.renderer.setSize(w, h, false);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }

  start(): void {
    this.live = true;
    this.kick();
  }

  setLive(on: boolean): void {
    this.live = on;
    if (on) this.kick();
    else if (this.raf) {
      cancelAnimationFrame(this.raf);
      this.raf = 0;
    }
  }

  private kick(): void {
    if (this.raf || this.disposed || !this.live || this.lostContext) return;
    this.last = 0;
    this.lastFrame = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.live || this.lostContext) return;
    // Adapt: a phone that can't keep up gets the lite tier (half the pixels). Measured on the display's own frames,
    // not on the ones drawn (an idle walk draws fewer on purpose).
    if (this.lastFrame && this.quality === 'high') {
      this.frames++;
      if (now - this.lastFrame > 34) this.slowFrames++;
      if (this.frames === 45 && this.slowFrames > 25) this.setQuality('lite');
    }
    this.lastFrame = now;
    // D47 PR 3: while nothing is happening (no walking, looking, tapping, no discovery playing) the walk draws at half
    // rate (the breeze and butterflies still move), and under reduced motion, where nothing moves at all, twice a
    // second. Any input brings it back to every frame at once.
    const gap = this.busy(now) ? 0 : this.o.reducedMotion() ? 500 : 30;
    if (this.last && now - this.last < gap) {
      this.skipped++;
      this.raf = requestAnimationFrame(this.tick);
      return;
    }
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    this.last = now;
    this.step(dt, now);
    this.render(now);
    this.raf = requestAnimationFrame(this.tick);
  };

  /** Something is happening: the player is moving, looking or tapping, or a discovery is playing. */
  private busy(now: number): boolean {
    const w = this.walker;
    if (this.held.move || this.held.turn || w.target || this.path.length || this.lookAtOnArrival || now - this.inputAt < 1500 || this.barnOpen % 1 > 0.001) return true;
    // Every frame: no array made just to ask.
    for (const m of this.moments.values()) if (m.rested === false) return true;
    return false;
  }
  /** When the player last did anything. */
  private inputAt = 0;
  /** The display's last frame, and frames passed over while idle (tests and the QA page). */
  private lastFrame = 0;
  skipped = 0;

  setQuality(q: 'high' | 'lite'): void {
    this.quality = q;
    // Fewer grass clumps, flowers and butterflies too (D47).
    this.meadow.setTier(q);
    this.renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
    const s = new THREE.Vector2();
    this.renderer.getSize(s);
    this.renderer.setSize(s.x, s.y, false);
  }

  get tier(): 'high' | 'lite' {
    return this.quality;
  }

  /** Frames drawn and passed over, and the tier (tests and the QA page). */
  get frameStats(): { drawn: number; skipped: number; tier: 'high' | 'lite' } {
    return { drawn: this.drawn, skipped: this.skipped, tier: this.quality };
  }

  /** What the meadow is drawing (tests and the QA page). */
  get meadowStats(): ReturnType<Meadow['stats']> {
    return this.meadow.stats();
  }

  private step(dt: number, now: number): void {
    const w = this.walker;
    const still = this.o.reducedMotion();
    if (this.held.turn) w.yaw += this.held.turn * TURN * dt;
    if (this.held.move) {
      w.target = null;
      this.path = [];
      this.goal = null;
      nudge(w, this.held.move * 3.2 * dt, this.obstacles);
    }
    if (w.target) {
      if (still) {
        // Reduced motion: no walking glide; the player is simply there.
        const end = this.path.pop() ?? w.target;
        this.path = [];
        this.goal = null;
        const s = settle(end.x, end.z, this.obstacles);
        w.yaw = yawTo(w.x, w.z, end.x, end.z);
        w.x = s.x;
        w.z = s.z;
        w.target = null;
      } else stepWalker(w, dt, this.obstacles, !!this.goal);
    }
    // The next corner of the way there.
    if (!w.target && this.path.length) w.target = this.path.shift()!;
    // Stopped short of where it was going (something was in the way after all): find the way again from here.
    if (!w.target && this.goal) {
      const g = this.goal;
      if (Math.hypot(g.x - w.x, g.z - w.z) > 0.6 && this.replans < 3) {
        this.replans++;
        this.walkTo(g.x, g.z, true);
      } else this.goal = null;
    }
    // Arrived from a "Go to": turn to look at the place.
    if (!w.target && this.lookAtOnArrival) {
      const want = yawTo(w.x, w.z, this.lookAtOnArrival.x, this.lookAtOnArrival.z);
      w.yaw = still ? want : turnToward(w.yaw, want, TURN * 1.4 * dt);
      if (Math.abs(Math.atan2(Math.sin(want - w.yaw), Math.cos(want - w.yaw))) < 0.02) this.lookAtOnArrival = null;
    }
    // The animals: turn to watch the player when near, say hello once per visit.
    for (const r of this.residents) {
      const d = Math.hypot(w.x - r.x, w.z - r.z);
      const near = d < HELLO_RANGE;
      const want = near ? yawTo(r.x, r.z, w.x, w.z) + Math.PI : r.baseYaw;
      const cur = r.actor.toy.root.rotation.y;
      r.actor.toy.root.rotation.y = still ? want : cur + Math.atan2(Math.sin(want - cur), Math.cos(want - cur)) * Math.min(1, dt * 4);
      if (near && !r.near && now - r.greetedAt > 6000) {
        r.greetedAt = now;
        r.actor.ambient('greet', now, still);
        this.o.onHello?.(r.id);
      }
      r.near = near;
      // Near the player, it looks up at them (the player is taller than every animal here).
      r.perk = still ? (near ? 1 : 0) : r.perk + ((near ? 1 : 0) - r.perk) * Math.min(1, dt * 5);
      r.actor.toy.root.rotation.x = -0.2 * r.perk;
      r.actor.update(now, !still);
    }
    if (this.windmillSails && !still) this.windmillSails.rotation.z += dt * 0.6;
    this.meadow.update(dt, still, w);
    if (!still) this.clock += dt;
    for (const t of this.tickers) t(this.clock, still);
    this.stepPlaces(dt, now, still);
  }

  /** Destinations (D45 PR C): arriving plays the place's small moment, and the barn's doors follow the player. */
  private stepPlaces(dt: number, now: number, still: boolean): void {
    const w = this.walker;
    const at = landmarkNear(w.x, w.z, this.o.stage)?.id ?? null;
    if (at !== this.place) {
      this.place = at;
      const first = !!at && !this.found.has(at);
      if (at) {
        this.found.add(at);
        const m = this.moments.get(at);
        // Each arrival plays it again (it is short); under reduced motion it is simply shown finished.
        if (m && now - m.start > m.ms) {
          m.start = still ? now - m.ms : now;
          m.rested = false;
        }
      }
      this.o.onPlace?.(at, first);
    }
    const open = at === 'barn' ? 1 : 0;
    this.barnOpen = still ? open : this.barnOpen + (open - this.barnOpen) * Math.min(1, dt * 3);
    for (const h of this.barnDoors) h.rotation.y = (h.userData.side as number) * this.barnOpen * 1.9;
    for (const m of this.moments.values()) {
      if (m.rested !== false) continue;
      // Every started moment gets its last frame, even if the app was away while it ran out (drawing stops then, the
      // clock doesn't): no duck left mid-hop, no bird hanging in the air (D45 PR C review).
      const t = (now - m.start) / m.ms;
      if (t < 0) continue;
      m.frame(Math.min(1, t));
      if (t >= 1) m.rested = true;
    }
    if (now - this.movedAt > 120) {
      this.movedAt = now;
      this.o.onMove?.(w.x, w.z, w.yaw);
    }
  }
  private movedAt = 0;

  /** Whether every discovery that started has come to rest (tests and the QA page). */
  get settled(): boolean {
    return [...this.moments.values()].every((m) => m.rested !== false);
  }

  /** Where the player is (a destination's id), if at one. */
  get where(): LandmarkId | null {
    return this.place;
  }

  /** Walks to a destination (its place to stand and look). False if it isn't built yet. */
  goTo(id: LandmarkId): boolean {
    this.inputAt = performance.now();
    const l = landmarksAt(this.o.stage).find((x) => x.id === id);
    if (!l) return false;
    this.held = { move: 0, turn: 0 };
    this.walkTo(l.stand.x, l.stand.z);
    this.lookAtOnArrival = l.at;
    if (!this.raf) {
      // Not drawing (hidden, or a test): arrive at once.
      const end = this.path[this.path.length - 1] ?? this.walker.target!;
      this.path = [];
      this.goal = null;
      Object.assign(this.walker, end, { target: null, yaw: yawTo(end.x, end.z, l.at.x, l.at.z) });
      this.lookAtOnArrival = null;
      this.step(0, performance.now());
      this.renderNow();
    }
    return true;
  }
  private lookAtOnArrival: { x: number; z: number } | null = null;
  /** The corners still to walk through after the current target (a way round the barn, the pond, a decoration). */
  private path: Array<{ x: number; z: number }> = [];

  /** Where a routed walk is going, and how often it has had to find a new way (a few times at most). */
  private goal: { x: number; z: number } | null = null;
  private replans = 0;

  /** Sets off to a point, round whatever is in the way. */
  private walkTo(x: number, z: number, again = false): void {
    const [first, ...rest] = route(this.walker, { x, z }, this.obstacles);
    this.walker.target = first;
    this.path = rest;
    this.goal = rest[rest.length - 1] ?? first;
    if (!again) this.replans = 0;
  }

  private render(now: number): void {
    void now;
    const w = this.walker;
    const y = groundY(w.x, w.z) + EYE;
    this.camera.position.set(w.x, y, w.z);
    this.camera.rotation.set(this.pitch, w.yaw, 0, 'YXZ');
    this.meadow.follow(w.x, w.z);
    this.renderer.render(this.scene, this.camera);
    noteSharedTextures(this.renderer, this.scene);
    this.drawn++;
  }

  /** Whether the WebGL context is gone right now (tests and QA). */
  get contextLost(): boolean {
    return this.lostContext;
  }

  /** Draws one frame now (after a resize, or for a test). */
  renderNow(): void {
    if (this.disposed || this.lostContext) return;
    this.render(performance.now());
  }

  /** The view as the player sees it this moment (D47 PR 5: postcards): a fresh frame, copied at once. */
  snapshot(): HTMLCanvasElement | null {
    if (this.disposed || this.lostContext) return null;
    this.render(performance.now());
    return copyCanvas(this.canvas);
  }

  // ---------------------------------------------------------------- input

  /** Looks round by a drag (in pixels of the canvas). */
  look(dx: number, dy: number): void {
    this.inputAt = performance.now();
    // Like pulling the world round: drag right to look left, down to look up.
    this.walker.yaw += dx * 0.006;
    this.pitch = Math.max(-0.6, Math.min(0.35, this.pitch + dy * 0.004));
    this.walker.target = null;
    this.path = [];
    this.goal = null;
    this.lookAtOnArrival = null;
    if (!this.raf) this.renderNow();
  }

  /** Held buttons or keys: move forward (1) or back (-1), turn left (1) or right (-1). */
  hold(move: number, turn: number): void {
    this.inputAt = performance.now();
    this.held = { move, turn };
    if (move || turn) this.lookAtOnArrival = null;
    if (this.o.reducedMotion()) {
      // Reduced motion: a button press is a step (or a 45° turn), not a glide.
      if (move) nudge(this.walker, move * 2, this.obstacles);
      if (turn) this.walker.yaw += (turn * Math.PI) / 4;
      this.held = { move: 0, turn: 0 };
      this.renderNow();
    }
  }

  /**
   * A tap at canvas coordinates (0–1 each way): on an animal, walk up to it (it says hello); on the ground, walk
   * there. Returns what was tapped.
   */
  tap(u: number, v: number): 'animal' | 'ground' | null {
    this.inputAt = performance.now();
    this.lookAtOnArrival = null;
    this.ray.setFromCamera(new THREE.Vector2(u * 2 - 1, -(v * 2 - 1)), this.camera);
    const hitsAnimal = this.ray.intersectObjects(
      this.residents.flatMap((r) => r.actor.toy.hits),
      false,
    )[0];
    if (hitsAnimal) {
      const r = this.residents.find((x) => x.actor.toy.hits.includes(hitsAnimal.object));
      if (r) {
        const a = yawTo(r.x, r.z, this.walker.x, this.walker.z);
        this.walkTo(r.x - Math.sin(a) * 1.8, r.z - Math.cos(a) * 1.8);
        return 'animal';
      }
    }
    const g = this.ray.intersectObject(this.ground, false)[0];
    if (!g) return null;
    this.walkTo(g.point.x, g.point.z);
    return 'ground';
  }

  /** Who is home here (tests and the QA page). */
  get animals(): string[] {
    return this.residents.map((r) => r.id);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    if (this.raf) cancelAnimationFrame(this.raf);
    for (const r of this.residents) r.actor.toy.dispose();
    for (const d of this.disposables) d.dispose();
    this.kit.dispose();
    // D46 PR B: all of it, including what three.js's shared lookup texture would otherwise keep alive.
    releaseRenderer(this.renderer);
    this.canvas.remove();
  }
}
