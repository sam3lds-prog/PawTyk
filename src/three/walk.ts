/**
 * The walkable 3D Farm (D44 PR I): the Farm as a little world to stroll round, with its animals as the same soft toys
 * as the scene (D34). Everything is built in code from simple shapes: rolling grass with a dirt path, the fence and
 * pasture, hay, the red barn (and its party lights), the duck pond and hen house, sunflowers, the orchard and the
 * windmill, each appearing with the Farm's stage. Animals turn to watch the player and say hello when they come near.
 *
 * Getting round: drag to look, tap the ground to walk there, tap an animal to go and say hello, or use the arrow
 * buttons (and the keyboard). Quality tiers: high (sharp, every frame) until frames come slow, then lite (lower
 * resolution, fewer grass tufts). It draws only while it is showing; leaving the app pauses it.
 */

import * as THREE from 'three';
import { Actor } from './actor';
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
}

const col = (c: string) => new THREE.Color(c);

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

  constructor(private readonly o: WalkOptions) {
    this.quality = o.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: o.quality === 'high', powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(o.quality === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'walk__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
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
    sun.position.set(-60, ev ? 14 : 70, -100);
    sun.lookAt(0, 0, 0);
    this.scene.add(sun);
    addLights(this.scene);
    if (ev) for (const l of this.scene.children) if (l instanceof THREE.Light) l.intensity *= 0.55;
    this.buildGround();
    const f = new Set(featuresAt(this.o.stage));
    this.buildHills();
    if (f.has('fence')) this.buildFence();
    if (f.has('hay')) this.buildHay(PLACES.hay.x, PLACES.hay.z);
    if (f.has('mud')) {
      const m = this.add(this.geo(new THREE.CircleGeometry(PLACES.mud.r, 28)), this.mat('#8a6545', 0.95), PLACES.mud.x, 0.03, PLACES.mud.z);
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
    const grass = col('#93c66e');
    const grass2 = col('#a9d482');
    const dirt = col('#d9bf8e');
    const c = new THREE.Color();
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i);
      const z = pos.getZ(i);
      pos.setY(i, groundY(x, z));
      // The path: from the gate to the barn, a gentle S.
      const px = Math.sin((z + 20) * 0.09) * 3 + (z < 0 ? (-z / 12) * 8 : 0);
      const onPath = z < 24 && z > -10 && Math.abs(x - px) < 1.3;
      const n = (Math.sin(x * 1.7) * Math.cos(z * 1.3) + 1) / 2;
      c.copy(grass).lerp(grass2, n * 0.7);
      if (onPath) c.copy(dirt).lerp(grass, Math.max(0, Math.abs(x - px) - 0.8) * 1.4);
      colors.push(c.r, c.g, c.b);
    }
    g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    g.computeVertexNormals();
    const m = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 });
    this.disposables.push(m);
    this.ground = new THREE.Mesh(g, m);
    this.scene.add(this.ground);
    // Grass tufts, scattered (fewer in the lite tier).
    const n = this.quality === 'high' ? 520 : 160;
    const tuft = this.geo(new THREE.ConeGeometry(0.05, 0.26, 4));
    const tm = this.mat('#6fa54e');
    const inst = new THREE.InstancedMesh(tuft, tm, n);
    const m4 = new THREE.Matrix4();
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < n; i++) {
      const x = (rnd() - 0.5) * 70;
      const z = (rnd() - 0.5) * 70;
      const s = 0.7 + rnd() * 0.8;
      m4.makeRotationZ((rnd() - 0.5) * 0.4).scale(new THREE.Vector3(s, s, s)).setPosition(x, groundY(x, z) + 0.11 * s, z);
      inst.setMatrixAt(i, m4);
    }
    this.scene.add(inst);
  }

  private buildHills(): void {
    // Far rolling hills (and a few round trees on them) closing the world in.
    const hm = this.mat('#b5d892');
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
    const wood = this.mat('#b98a5e');
    const pg = this.geo(new THREE.BoxGeometry(0.16, 1.1, 0.16));
    const pm = new THREE.InstancedMesh(pg, wood, posts.length);
    const m4 = new THREE.Matrix4();
    posts.forEach(([x, z], i) => pm.setMatrixAt(i, m4.makeTranslation(x, 0.55, z)));
    this.scene.add(pm);
    const rg = this.geo(new THREE.BoxGeometry(1, 0.1, 0.07));
    const rm = new THREE.InstancedMesh(rg, wood, rails.length * 2);
    const q = new THREE.Quaternion();
    rails.forEach(([ax, az, bx, bz], i) => {
      const len = Math.hypot(bx - ax, bz - az);
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -Math.atan2(bz - az, bx - ax));
      for (const [k, y] of [
        [0, 0.45],
        [1, 0.85],
      ])
        rm.setMatrixAt(i * 2 + k, m4.compose(new THREE.Vector3((ax + bx) / 2, y, (az + bz) / 2), q, new THREE.Vector3(len, 1, 1)));
    });
    this.scene.add(rm);
  }

  private buildHay(x: number, z: number): void {
    const g = this.geo(new THREE.CylinderGeometry(0.9, 0.9, 1.1, 24));
    const m = this.add(g, this.mat('#e8c76a'), x, 0.9, z);
    m.rotation.z = Math.PI / 2;
    const ring = this.add(this.geo(new THREE.TorusGeometry(0.5, 0.05, 6, 24)), this.mat('#d1a94a'), x + 0.56, 0.9, z);
    ring.rotation.y = Math.PI / 2;
  }

  private buildBarn(): void {
    const { x, z, w, d } = PLACES.barn;
    const h = 5;
    const red = this.mat('#c9483b');
    const white = this.mat('#f3efe6');
    const barn = new THREE.Group();
    barn.position.set(x, 0, z);
    barn.rotation.y = PLACES.barn.rot;
    this.scene.add(barn);
    this.add(this.geo(new THREE.BoxGeometry(w, h, d)), red, 0, h / 2, 0, barn);
    // The roof: a prism over the long side, white-trimmed.
    const roof = new THREE.Shape();
    roof.moveTo(-w / 2 - 0.4, 0);
    roof.lineTo(0, 3.2);
    roof.lineTo(w / 2 + 0.4, 0);
    roof.lineTo(-w / 2 - 0.4, 0);
    const rg = this.geo(new THREE.ExtrudeGeometry(roof, { depth: d + 0.6, bevelEnabled: false }));
    this.add(rg, this.mat('#7a2f26'), 0, h, -d / 2 - 0.3, barn);
    // Front: big doors with their white X, the hayloft, two windows.
    const front = d / 2 + 0.02;
    // The doorway (dark inside), and two doors on their hinges, each with half of the white X: they swing open when
    // the player walks up (D45 PR C), and a chick looks out.
    this.add(this.geo(new THREE.PlaneGeometry(3.4, 3.6)), this.mat('#3a2a22', 1), 0, 1.8, front, barn);
    const doorG = this.geo(new THREE.BoxGeometry(1.7, 3.6, 0.08));
    const doorM = this.mat('#a9372c');
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
    const g = this.geo(new THREE.BoxGeometry(1.4, 0.8, 0.9));
    const m = this.mat('#e8c76a');
    const { x, z } = PLACES.bales;
    for (const [dx, dy, dz] of [
      [-0.72, 0.4, 0],
      [0.72, 0.4, 0],
      [0, 1.2, 0],
    ])
      this.add(g, m, x + dx, dy, z + dz);
  }

  private buildPond(): void {
    const { x, z, r } = PLACES.pond;
    const rim = this.add(this.geo(new THREE.CircleGeometry(r + 0.6, 40)), this.mat('#8dbf74'), x, 0.02, z);
    rim.rotation.x = -Math.PI / 2;
    const water = new THREE.MeshStandardMaterial({ color: col('#8fcbe0'), roughness: 0.15, metalness: 0.1 });
    this.disposables.push(water);
    const w = this.add(this.geo(new THREE.CircleGeometry(r, 40)), water, x, 0.05, z);
    w.rotation.x = -Math.PI / 2;
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
    this.add(this.geo(new THREE.BoxGeometry(2.6, 1.8, 2.4)), this.mat('#f2d7a6'), x, 0.9, z);
    const roof = this.add(this.geo(new THREE.ConeGeometry(2.3, 1.3, 4)), this.mat('#c9483b'), x, 2.45, z);
    roof.rotation.y = Math.PI / 4;
    this.add(this.geo(new THREE.PlaneGeometry(0.7, 1)), this.mat('#7a4a2a'), x + 0.2, 0.55, z + 1.21);
  }

  private buildSunflowers(): void {
    const stem = this.geo(new THREE.CylinderGeometry(0.04, 0.05, 1.8, 6));
    const head = this.geo(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 18));
    const disc = this.geo(new THREE.CylinderGeometry(0.2, 0.2, 0.1, 14));
    for (let i = 0; i < 9; i++) {
      const x = -8.6 - (i % 2) * 0.5;
      const z = -5 + i * 1.8;
      this.add(stem, this.mat('#6f8a4e'), x, 0.9, z);
      // Facing into the pasture (toward +x), tilted up a little.
      const face = new THREE.Group();
      face.position.set(x, 1.85, z);
      face.rotation.set(0, Math.PI / 2, 0);
      this.scene.add(face);
      const h = this.add(head, this.mat('#f6c430'), 0, 0, 0.05, face);
      h.rotation.x = Math.PI / 2 - 0.3;
      const d = this.add(disc, this.mat('#7a4a2a'), 0, 0, 0.1, face);
      d.rotation.x = Math.PI / 2 - 0.3;
    }
  }

  private buildTree(x: number, z: number): void {
    this.add(this.geo(new THREE.CylinderGeometry(0.22, 0.3, 2.4, 8)), this.mat('#8a6648'), x, 1.2, z);
    const crown = this.add(this.geo(new THREE.SphereGeometry(1.7, 18, 14)), this.mat('#7fb35d'), x, 3.4, z);
    crown.scale.y = 0.85;
    const apple = this.geo(new THREE.SphereGeometry(0.13, 10, 8));
    const red = this.mat('#d8342c', 0.5);
    for (let i = 0; i < 6; i++) {
      const a = i * 1.1;
      this.add(apple, red, x + Math.cos(a) * 1.5, 3.1 + Math.sin(i * 2.3) * 0.6, z + Math.sin(a) * 1.5);
    }
  }

  /** The orchard's moment (D45 PR C): an apple drops from the nearest tree, and three birds fly up out of it. */
  private buildOrchardLife(): void {
    const [tx, tz] = PLACES.orchard[2];
    const apple = this.add(this.geo(new THREE.SphereGeometry(0.14, 10, 8)), this.mat('#d8342c', 0.5), tx + 1.2, 2.6, tz + 1.3);
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

  /** The pasture's moment (D45 PR C): butterflies rise from the clover, flutter round and settle again. */
  private buildPastureLife(): void {
    const wingG = this.geo(new THREE.CircleGeometry(0.09, 10));
    const flies = ['#f6a5c0', '#ffd84a', '#9fd3f2', '#ffffff', '#f6a5c0'].map((c, i) => {
      const m = new THREE.MeshBasicMaterial({ color: col(c), side: THREE.DoubleSide });
      this.disposables.push(m);
      const g = new THREE.Group();
      g.visible = false;
      const l = new THREE.Group();
      const r = new THREE.Group();
      this.add(wingG, m, -0.08, 0, 0, l);
      this.add(wingG, m, 0.08, 0, 0, r);
      g.add(l, r);
      this.scene.add(g);
      return { g, l, r, x: -2.5 + i * 1.3, z: 4.5 + (i % 2) * 2.2, a: i * 1.7 };
    });
    // A patch of clover flowers where they live.
    const cl = this.geo(new THREE.SphereGeometry(0.07, 8, 6));
    const pink = this.mat('#f4b6cf');
    for (const f of flies) for (const [dx, dz] of [[0, 0], [0.25, 0.18], [-0.2, 0.22]]) this.add(cl, pink, f.x + dx, groundY(f.x, f.z) + 0.1, f.z + dz);
    this.moments.set('pasture', {
      start: -1e9,
      ms: 5200,
      frame: (t) => {
        for (const f of flies) {
          const k = Math.sin(Math.min(1, t) * Math.PI);
          f.g.visible = t > 0 && t < 1;
          const a = f.a + t * 7;
          f.g.position.set(f.x + Math.cos(a) * k * 1.1, groundY(f.x, f.z) + 0.15 + k * 1.3 + Math.sin(a * 2.3) * 0.12, f.z + Math.sin(a) * k * 1.1);
          f.g.rotation.y = -a;
          const flap = Math.abs(Math.sin(t * 90 + f.a)) * 1.2;
          f.l.rotation.z = flap;
          f.r.rotation.z = -flap;
        }
      },
    });
  }

  /** One of the player's decorations (D45 PR C), where the drawn Farm has it too. */
  private buildDecor(id: FarmDecor): void {
    const p = DECOR_PLACES[id];
    const g = new THREE.Group();
    g.position.set(p.x, groundY(p.x, p.z), p.z);
    g.rotation.y = p.rot;
    g.name = `decor:${id}`;
    this.scene.add(g);
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
    const tower = this.add(this.geo(new THREE.CylinderGeometry(0.9, 1.6, 7, 12)), this.mat('#f3efe6'), x, 3.5 + groundY(x, z), z);
    void tower;
    this.add(this.geo(new THREE.ConeGeometry(1.2, 1.4, 12)), this.mat('#c9483b'), x, 7.7 + groundY(x, z), z);
    const sails = new THREE.Group();
    sails.position.set(x, 6.4 + groundY(x, z), z + 1.1);
    for (let k = 0; k < 4; k++) {
      const s = this.add(this.geo(new THREE.BoxGeometry(0.5, 3.6, 0.06)), this.mat('#fffaf0'), 0, 1.8, 0);
      const arm = new THREE.Group();
      arm.rotation.z = (k * Math.PI) / 2;
      s.removeFromParent();
      arm.add(s);
      sails.add(arm);
    }
    this.scene.add(sails);
    this.windmillSails = sails;
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
    if (this.raf || this.disposed || !this.live) return;
    this.last = 0;
    this.raf = requestAnimationFrame(this.tick);
  }

  private tick = (now: number): void => {
    this.raf = 0;
    if (this.disposed || !this.live) return;
    const dt = this.last ? Math.min(0.05, (now - this.last) / 1000) : 0.016;
    // Adapt: a phone that can't keep up gets the lite tier (half the pixels).
    if (this.last && this.quality === 'high') {
      this.frames++;
      if (now - this.last > 34) this.slowFrames++;
      if (this.frames === 45 && this.slowFrames > 25) this.setQuality('lite');
    }
    this.last = now;
    this.step(dt, now);
    this.render(now);
    this.raf = requestAnimationFrame(this.tick);
  };

  setQuality(q: 'high' | 'lite'): void {
    this.quality = q;
    this.renderer.setPixelRatio(q === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
    const s = new THREE.Vector2();
    this.renderer.getSize(s);
    this.renderer.setSize(s.x, s.y, false);
  }

  get tier(): 'high' | 'lite' {
    return this.quality;
  }

  private step(dt: number, now: number): void {
    const w = this.walker;
    const still = this.o.reducedMotion();
    if (this.held.turn) w.yaw += this.held.turn * TURN * dt;
    if (this.held.move) {
      w.target = null;
      this.path = [];
      nudge(w, this.held.move * 3.2 * dt, this.obstacles);
    }
    if (w.target) {
      if (still) {
        // Reduced motion: no walking glide; the player is simply there.
        const end = this.path.pop() ?? w.target;
        this.path = [];
        const s = settle(end.x, end.z, this.obstacles);
        w.yaw = yawTo(w.x, w.z, end.x, end.z);
        w.x = s.x;
        w.z = s.z;
        w.target = null;
      } else stepWalker(w, dt, this.obstacles);
    }
    // The next corner of the way there.
    if (!w.target && this.path.length) w.target = this.path.shift()!;
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
        if (m && now - m.start > m.ms) m.start = still ? now - m.ms : now;
      }
      this.o.onPlace?.(at, first);
    }
    const open = at === 'barn' ? 1 : 0;
    this.barnOpen = still ? open : this.barnOpen + (open - this.barnOpen) * Math.min(1, dt * 3);
    for (const h of this.barnDoors) h.rotation.y = (h.userData.side as number) * this.barnOpen * 1.9;
    for (const m of this.moments.values()) {
      const t = (now - m.start) / m.ms;
      if (t >= 0 && t <= 1.05) m.frame(Math.min(1, t));
    }
    if (now - this.movedAt > 120) {
      this.movedAt = now;
      this.o.onMove?.(w.x, w.z, w.yaw);
    }
  }
  private movedAt = 0;

  /** Where the player is (a destination's id), if at one. */
  get where(): LandmarkId | null {
    return this.place;
  }

  /** Walks to a destination (its place to stand and look). False if it isn't built yet. */
  goTo(id: LandmarkId): boolean {
    const l = landmarksAt(this.o.stage).find((x) => x.id === id);
    if (!l) return false;
    this.held = { move: 0, turn: 0 };
    this.walkTo(l.stand.x, l.stand.z);
    this.lookAtOnArrival = l.at;
    if (!this.raf) {
      // Not drawing (hidden, or a test): arrive at once.
      const end = this.path[this.path.length - 1] ?? this.walker.target!;
      this.path = [];
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

  /** Sets off to a point, round whatever is in the way. */
  private walkTo(x: number, z: number): void {
    const [first, ...rest] = route(this.walker, { x, z }, this.obstacles);
    this.walker.target = first;
    this.path = rest;
  }

  private render(now: number): void {
    void now;
    const w = this.walker;
    const y = groundY(w.x, w.z) + EYE;
    this.camera.position.set(w.x, y, w.z);
    this.camera.rotation.set(this.pitch, w.yaw, 0, 'YXZ');
    this.renderer.render(this.scene, this.camera);
    this.drawn++;
  }

  /** Draws one frame now (after a resize, or for a test). */
  renderNow(): void {
    if (this.disposed) return;
    this.render(performance.now());
  }

  // ---------------------------------------------------------------- input

  /** Looks round by a drag (in pixels of the canvas). */
  look(dx: number, dy: number): void {
    // Like pulling the world round: drag right to look left, down to look up.
    this.walker.yaw += dx * 0.006;
    this.pitch = Math.max(-0.6, Math.min(0.35, this.pitch + dy * 0.004));
    this.walker.target = null;
    this.path = [];
    this.lookAtOnArrival = null;
    if (!this.raf) this.renderNow();
  }

  /** Held buttons or keys: move forward (1) or back (-1), turn left (1) or right (-1). */
  hold(move: number, turn: number): void {
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
    this.renderer.dispose();
    this.renderer.forceContextLoss?.();
    this.canvas.remove();
  }
}
