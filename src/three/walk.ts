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
  HELLO_RANGE,
  PLACES,
  TURN,
  featuresAt,
  groundY,
  nudge,
  obstaclesAt,
  settle,
  stepWalker,
  yawTo,
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
  /** Told when an animal says hello (its id). */
  onHello?: (id: string) => void;
}

interface Resident {
  id: string;
  actor: Actor;
  x: number;
  z: number;
  baseYaw: number;
  greetedAt: number;
  near: boolean;
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

  constructor(private readonly o: WalkOptions) {
    this.quality = o.quality;
    this.renderer = new THREE.WebGLRenderer({ antialias: o.quality === 'high', powerPreference: 'low-power' });
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.setPixelRatio(o.quality === 'high' ? Math.min(devicePixelRatio || 1, 2) : 1);
    this.canvas = this.renderer.domElement;
    this.canvas.className = 'walk__canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    this.obstacles = obstaclesAt(o.stage);
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
    if (f.has('orchard')) for (const [x, z] of PLACES.orchard) this.buildTree(x, z);
    if (f.has('windmill')) this.buildWindmill();
    if (f.has('party')) this.buildPartyLights(ev);
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
    const doors = this.add(this.geo(new THREE.PlaneGeometry(3.4, 3.6)), this.mat('#a9372c'), 0, 1.8, front, barn);
    void doors;
    const bar = this.geo(new THREE.BoxGeometry(0.16, 4.9, 0.05));
    for (const r of [0.75, -0.75]) {
      const b = this.add(bar, white, 0, 1.8, front + 0.03, barn);
      b.rotation.z = r;
    }
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
    // Two ducks.
    const duck = (dx: number, dz: number, c: string) => {
      this.add(this.geo(new THREE.SphereGeometry(0.28, 16, 12)), this.mat(c), x + dx, 0.2, z + dz).scale.set(1.3, 0.8, 1);
      this.add(this.geo(new THREE.SphereGeometry(0.17, 14, 10)), this.mat(c), x + dx + 0.24, 0.45, z + dz);
      this.add(this.geo(new THREE.ConeGeometry(0.06, 0.16, 8)), this.mat('#f2a23a'), x + dx + 0.42, 0.44, z + dz).rotation.z = -Math.PI / 2;
    };
    duck(-1, 0.6, '#ffffff');
    duck(1.2, -0.8, '#f6e9b0');
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
      toy.root.rotation.y = baseYaw;
      this.scene.add(toy.root);
      this.residents.push({ id, actor, x: s.x, z: s.z, baseYaw, greetedAt: -1e9, near: false });
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
      nudge(w, this.held.move * 3.2 * dt, this.obstacles);
    }
    if (w.target) {
      if (still) {
        // Reduced motion: no walking glide; the player is simply there.
        const s = settle(w.target.x, w.target.z, this.obstacles);
        w.yaw = yawTo(w.x, w.z, w.target.x, w.target.z);
        w.x = s.x;
        w.z = s.z;
        w.target = null;
      } else stepWalker(w, dt, this.obstacles);
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
      r.actor.update(now, !still);
    }
    if (this.windmillSails && !still) this.windmillSails.rotation.z += dt * 0.6;
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
    if (!this.raf) this.renderNow();
  }

  /** Held buttons or keys: move forward (1) or back (-1), turn left (1) or right (-1). */
  hold(move: number, turn: number): void {
    this.held = { move, turn };
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
    this.ray.setFromCamera(new THREE.Vector2(u * 2 - 1, -(v * 2 - 1)), this.camera);
    const hitsAnimal = this.ray.intersectObjects(
      this.residents.flatMap((r) => r.actor.toy.hits),
      false,
    )[0];
    if (hitsAnimal) {
      const r = this.residents.find((x) => x.actor.toy.hits.includes(hitsAnimal.object));
      if (r) {
        const a = yawTo(r.x, r.z, this.walker.x, this.walker.z);
        this.walker.target = settle(r.x - Math.sin(a) * 1.8, r.z - Math.cos(a) * 1.8, this.obstacles);
        return 'animal';
      }
    }
    const g = this.ray.intersectObject(this.ground, false)[0];
    if (!g) return null;
    this.walker.target = settle(g.point.x, g.point.z, this.obstacles);
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
