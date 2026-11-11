/**
 * D48 PR C: the new Farm pieces in 3D, for the walk (`three/walk.ts`), made from simple shapes like the rest of the
 * Farm and in the same colours as their drawings (`ui/art/decorD48.ts`), so the drawn Farm and the 3D one show the same
 * thing. Each is built round its own origin (its spot's ground point, turned by the walk) at about a metre or two
 * across. Moving parts (the windmill's blades, the carousel, the bell, bubbles, butterflies) are given `tick`s, which
 * the walk drives and which hold still under Reduce Motion.
 */

import * as THREE from 'three';

export interface ModelKit {
  group: THREE.Group;
  mat(c: string, rough?: number): THREE.MeshStandardMaterial;
  geo<T extends THREE.BufferGeometry>(g: T): T;
  add(g: THREE.BufferGeometry, m: THREE.Material, x: number, y: number, z: number, parent?: THREE.Object3D): THREE.Mesh;
  /** A moving part: called every frame with the walk's clock (s) and whether to hold still. */
  tick(fn: (t: number, still: boolean) => void): void;
  /** A material the walk disposes of. */
  own<T extends { dispose(): void }>(d: T): T;
}

const RAINBOW = ['#E5546C', '#F08A3C', '#F6C430', '#6FB07C', '#5B9BC4', '#9B7FD0'];

/** Builds a D48 Farm piece into `k.group`. Returns false if `id` isn't one. */
export function buildD48Decor(id: string, k: ModelKit): boolean {
  const g = k.group;
  const box = (w: number, h: number, d: number, c: string, x: number, y: number, z: number, parent: THREE.Object3D = g) => k.add(k.geo(new THREE.BoxGeometry(w, h, d)), k.mat(c), x, y, z, parent);
  const cyl = (r0: number, r1: number, h: number, c: string, x: number, y: number, z: number, seg = 12, parent: THREE.Object3D = g) =>
    k.add(k.geo(new THREE.CylinderGeometry(r0, r1, h, seg)), k.mat(c), x, y, z, parent);
  const ball = (r: number, c: string, x: number, y: number, z: number, parent: THREE.Object3D = g) => k.add(k.geo(new THREE.SphereGeometry(r, 12, 9)), k.mat(c), x, y, z, parent);
  const cone = (r: number, h: number, c: string, x: number, y: number, z: number, seg = 12, parent: THREE.Object3D = g) => k.add(k.geo(new THREE.ConeGeometry(r, h, seg)), k.mat(c), x, y, z, parent);
  const flower = (x: number, y: number, z: number, c: string, parent: THREE.Object3D = g) => {
    ball(0.07, c, x, y, z, parent);
    ball(0.035, '#F6C430', x, y + 0.02, z + 0.05, parent);
  };
  const post = (x: number, z: number, h: number, c = '#8a6a4f', r = 0.06) => cyl(r, r * 1.1, h, c, x, h / 2, z, 8);

  switch (id) {
    case 'flowerarch': {
      for (const sx of [-1, 1]) post(sx * 1.05, 0, 1.6, '#9a7352', 0.07);
      const arch = k.add(k.geo(new THREE.TorusGeometry(1.05, 0.07, 8, 20, Math.PI)), k.mat('#9a7352'), 0, 1.6, 0);
      void arch;
      const cols = ['#F4A6C4', '#ffffff', '#E5546C', '#B49AE0', '#F6D27A'];
      for (let i = 0; i <= 12; i++) {
        const a = (i / 12) * Math.PI;
        const x = Math.cos(a) * 1.05;
        const y = 1.6 + Math.sin(a) * 1.05;
        ball(0.12, i % 2 ? '#7FB35D' : '#6FA34E', x, y, 0.04);
        flower(x + 0.05, y + 0.04, 0.12, cols[i % cols.length]);
      }
      for (const sx of [-1, 1]) for (let j = 0; j < 4; j++) flower(sx * 1.05, 0.4 + j * 0.32, 0.1, cols[(j + (sx > 0 ? 2 : 0)) % cols.length]);
      return true;
    }
    case 'applecart': {
      box(1.9, 0.55, 1.0, '#5f9e8f', 0, 0.75, 0);
      box(1.95, 0.06, 1.05, '#f6e8cc', 0, 1.04, 0);
      for (const sx of [-0.6, 0.6])
        for (const sz of [-0.55, 0.55]) {
          const w = cyl(0.32, 0.32, 0.1, '#5b4a3a', sx, 0.32, sz, 16);
          w.rotation.x = Math.PI / 2;
        }
      for (let i = 0; i < 16; i++) ball(0.13, i % 4 === 1 ? '#9BC27A' : '#E5546C', -0.7 + (i % 6) * 0.28, 1.12 + Math.floor(i / 6) * 0.14, -0.3 + ((i * 7) % 4) * 0.2);
      for (const sz of [-0.35, 0.35]) cyl(0.03, 0.03, 0.9, '#8a6a4f', -1.3, 0.75, sz, 6).rotation.z = Math.PI / 2 - 0.3;
      return true;
    }
    case 'bench': {
      box(2.2, 0.1, 0.55, '#c99a6a', 0, 0.5, 0);
      box(2.2, 0.14, 0.06, '#b98a5e', 0, 0.95, -0.25);
      box(2.2, 0.12, 0.06, '#a87a50', 0, 0.75, -0.25);
      for (const sx of [-0.95, 0.95]) {
        box(0.08, 0.5, 0.45, '#7a5a40', sx, 0.25, 0);
        box(0.08, 0.55, 0.06, '#8a6a4f', sx, 0.8, -0.25);
      }
      box(0.8, 0.12, 0.45, '#F4A6C4', -0.5, 0.61, 0.02);
      return true;
    }
    case 'festivalstage': {
      cyl(1.7, 1.75, 0.45, '#9a6a8e', 0, 0.22, 0, 24);
      cyl(1.68, 1.68, 0.06, '#d9b48a', 0, 0.47, 0, 24);
      for (const sx of [-1.35, 1.35]) post(sx, -0.9, 2.4, '#8a6a4f', 0.06);
      const lights: THREE.Mesh[] = [];
      for (let i = 0; i < 9; i++) {
        const a = Math.PI * (0.15 + (i / 8) * 0.7);
        const m = k.own(new THREE.MeshStandardMaterial({ color: '#FFF3B0', emissive: '#FFD04D', emissiveIntensity: 0.4 }));
        lights.push(k.add(k.geo(new THREE.SphereGeometry(0.06, 8, 6)), m, Math.cos(a) * 1.6, 0.5, Math.sin(a) * 1.6 - 0.1));
      }
      for (let i = 0; i < 6; i++) {
        const fl = cone(0.12, 0.22, RAINBOW[i], -1.1 + i * 0.44, 2.2 - Math.sin(((i + 0.5) / 6) * Math.PI) * 0.2, -0.9, 3);
        fl.rotation.x = Math.PI;
      }
      k.tick((t, still) => {
        lights.forEach((l, i) => ((l.material as THREE.MeshStandardMaterial).emissiveIntensity = still ? 0.4 : 0.25 + 0.35 * (0.5 + 0.5 * Math.sin(t * 4 + i * 1.3))));
      });
      return true;
    }
    case 'carousel': {
      cyl(1.6, 1.65, 0.22, '#C9628E', 0, 0.11, 0, 24);
      cyl(1.55, 1.55, 0.05, '#e9d7b8', 0, 0.24, 0, 24);
      cyl(0.08, 0.08, 2.2, '#C9962A', 0, 1.3, 0, 8);
      const top = cone(1.75, 0.7, '#E5546C', 0, 2.65, 0, 16);
      void top;
      const turn = new THREE.Group();
      g.add(turn);
      const colors = ['#ffffff', '#F6D27A', '#AFC9E8'];
      const ponies: THREE.Group[] = [];
      for (let i = 0; i < 3; i++) {
        const a = (i / 3) * Math.PI * 2;
        const p = new THREE.Group();
        p.position.set(Math.cos(a) * 1.1, 0, Math.sin(a) * 1.1);
        p.rotation.y = -a;
        turn.add(p);
        cyl(0.025, 0.025, 2.1, '#C9962A', 0, 1.3, 0, 6, p);
        box(0.18, 0.22, 0.55, colors[i], 0, 1.0, 0, p);
        box(0.12, 0.28, 0.14, colors[i], 0, 1.18, 0.3, p);
        for (const lz of [-0.18, 0.18]) for (const lx of [-0.06, 0.06]) cyl(0.025, 0.025, 0.28, colors[i], lx, 0.78, lz, 5, p);
        ponies.push(p);
      }
      k.tick((t, still) => {
        if (still) return;
        turn.rotation.y = t * 0.4;
        ponies.forEach((p, i) => (p.position.y = Math.sin(t * 2 + i * 2.1) * 0.08));
      });
      return true;
    }
    case 'rainbowslide': {
      for (const sx of [-0.25, 0.25]) cyl(0.04, 0.04, 1.8, '#8a6a4f', 1.1 + sx * 0.0, 0.9, sx, 6);
      for (let j = 0; j < 5; j++) box(0.06, 0.04, 0.5, '#a87a50', 1.1, 0.3 + j * 0.3, 0);
      box(0.6, 0.08, 0.6, '#b98a5e', 0.8, 1.8, 0);
      RAINBOW.forEach((c, i) => {
        const strip = box(2.1, 0.04, 0.09, c, -0.25, 1.0, -0.25 + i * 0.1);
        strip.rotation.z = 0.68;
      });
      return true;
    }
    case 'butterflygarden': {
      cyl(1.5, 1.6, 0.18, '#7a5a40', 0, 0.09, 0, 20);
      const cols = ['#F4A6C4', '#ffffff', '#E5546C', '#F6D27A'];
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39;
        const r = 0.25 + ((i * 37) % 11) / 11;
        const x = Math.cos(a) * r;
        const z = Math.sin(a) * r;
        const h = 0.35 + ((i * 13) % 7) / 18;
        cyl(0.012, 0.012, h, '#6f9a4a', x, 0.18 + h / 2, z, 4);
        if (i % 3 === 0) cyl(0.035, 0.02, 0.18, '#9B7FD0', x, 0.24 + h, z, 5);
        else flower(x, 0.2 + h, z, cols[i % cols.length]);
      }
      const flies: THREE.Mesh[] = [];
      ['#F08A3C', '#5B9BC4', '#F4A6C4'].forEach((c, i) => {
        const m = k.own(new THREE.MeshStandardMaterial({ color: c, side: THREE.DoubleSide }));
        flies.push(k.add(k.geo(new THREE.PlaneGeometry(0.16, 0.1)), m, 0, 1.1, 0));
        void i;
      });
      k.tick((t, still) => {
        flies.forEach((f, i) => {
          const a = (still ? 0 : t * 0.7) + i * 2.1;
          f.position.set(Math.cos(a) * 0.9, 1.0 + Math.sin(a * 2.3) * 0.2, Math.sin(a) * 0.9);
          f.rotation.y = -a;
          f.scale.y = still ? 1 : 0.4 + 0.6 * Math.abs(Math.sin(t * 12 + i));
        });
      });
      return true;
    }
    case 'pumpkinpatch': {
      for (let i = 0; i < 6; i++) {
        const a = i * 1.2;
        const r = 0.35 + (i % 3) * 0.4;
        const s = 0.22 + ((i * 5) % 3) * 0.08;
        const p = ball(s, '#F0913A', Math.cos(a) * r, s * 0.8, Math.sin(a) * r);
        p.scale.y = 0.8;
        cyl(0.025, 0.03, 0.12, '#6F8A3E', Math.cos(a) * r, s * 1.6, Math.sin(a) * r, 5);
      }
      for (let i = 0; i < 10; i++) {
        const lf = ball(0.16, '#7FA34E', Math.cos(i * 0.7) * 1.2, 0.08, Math.sin(i * 0.7) * 1.1);
        lf.scale.set(1, 0.3, 0.7);
      }
      return true;
    }
    case 'camptent': {
      const tent = cone(1.2, 1.7, '#E8D5B0', 0, 0.85, 0, 4);
      tent.rotation.y = Math.PI / 4;
      const flap = cone(0.5, 1.2, '#5B7FB8', 0, 0.6, 0.62, 3);
      flap.rotation.y = Math.PI;
      flap.scale.z = 0.25;
      cyl(0.02, 0.02, 0.5, '#8a6a4f', 0, 1.9, 0, 5);
      const flag = k.own(new THREE.MeshStandardMaterial({ color: '#E5546C', side: THREE.DoubleSide }));
      const f = k.add(k.geo(new THREE.PlaneGeometry(0.3, 0.16)), flag, 0.15, 2.05, 0);
      k.tick((t, still) => (f.rotation.y = still ? 0 : Math.sin(t * 2.4) * 0.4));
      return true;
    }
    case 'partytable': {
      box(2.2, 0.06, 0.8, '#ffffff', 0, 0.75, 0);
      box(2.2, 0.2, 0.82, '#F4A6C4', 0, 0.64, 0);
      for (const sx of [-0.95, 0.95]) for (const sz of [-0.3, 0.3]) cyl(0.04, 0.04, 0.72, '#7a5a40', sx, 0.36, sz, 6);
      cyl(0.22, 0.22, 0.22, '#F4A6C4', 0, 0.9, 0, 16);
      cyl(0.015, 0.015, 0.12, '#9DD6F0', 0, 1.07, 0, 5);
      ball(0.03, '#F6A23A', 0, 1.15, 0);
      for (const [x, c] of [
        [-0.6, '#5B9BC4'],
        [0.6, '#6FB07C'],
        [-0.3, '#F6C430'],
      ] as Array<[number, string]>)
        cyl(0.05, 0.04, 0.12, c, x, 0.84, 0.15, 8);
      for (const sx of [-1.15, 1.15]) post(sx, -0.4, 1.7, '#8a6a4f', 0.03);
      for (let i = 0; i < 6; i++) {
        const fl = cone(0.09, 0.16, RAINBOW[i], -0.95 + i * 0.38, 1.55 - Math.sin(((i + 0.5) / 6) * Math.PI) * 0.15, -0.4, 3);
        fl.rotation.x = Math.PI;
      }
      return true;
    }
    case 'whirligig': {
      post(0, 0, 1.6, '#8a6a4f', 0.05);
      box(0.3, 0.16, 0.16, '#E5546C', 0, 1.65, 0);
      const head = new THREE.Group();
      head.position.set(0, 1.65, 0.12);
      g.add(head);
      ['#F4A6C4', '#5B9BC4', '#F6C430', '#6FB07C'].forEach((c, i) => {
        const b = k.add(k.geo(new THREE.BoxGeometry(0.08, 0.38, 0.02)), k.mat(c), 0, 0.19, 0, head);
        const arm = new THREE.Group();
        arm.rotation.z = (i * Math.PI) / 2;
        head.add(arm);
        arm.add(b);
      });
      k.tick((t, still) => (head.rotation.z = still ? 0 : t * 3));
      return true;
    }
    case 'cornshocks': {
      for (const [x, z] of [
        [-0.35, 0],
        [0.4, 0.15],
      ] as Array<[number, number]>) {
        const c = cone(0.38, 1.7, '#D9B46A', x, 0.85, z, 9);
        c.rotation.y = x;
        cyl(0.33, 0.33, 0.05, '#8a6a4f', x, 0.95, z, 9);
      }
      const p = ball(0.16, '#F0913A', 0.7, 0.13, 0.4);
      p.scale.y = 0.8;
      return true;
    }
    case 'starlanterns': {
      post(-0.2, 0, 1.9, '#8a6a4f', 0.05);
      box(0.9, 0.05, 0.05, '#8a6a4f', 0.2, 1.88, 0);
      const glows: THREE.Mesh[] = [];
      [
        [0.05, 1.45, '#FFE08A'],
        [0.4, 1.3, '#F4A6C4'],
        [0.6, 1.55, '#AFC9E8'],
      ].forEach(([x, y, c]) => {
        const m = k.own(new THREE.MeshStandardMaterial({ color: c as string, emissive: c as string, emissiveIntensity: 0.35 }));
        const s = k.add(k.geo(new THREE.OctahedronGeometry(0.13)), m, x as number, y as number, 0);
        glows.push(s);
        cyl(0.004, 0.004, 1.88 - (y as number), '#6b4a34', x as number, ((y as number) + 1.88) / 2, 0, 3);
      });
      k.tick((t, still) => glows.forEach((s, i) => (s.rotation.y = still ? 0 : t * 0.6 + i)));
      return true;
    }
    case 'barnbell': {
      for (const sx of [-0.45, 0.45]) post(sx, 0, 1.7, '#8a6a4f', 0.05);
      box(1.1, 0.1, 0.1, '#7a5a40', 0, 1.72, 0);
      const bell = new THREE.Group();
      bell.position.set(0, 1.66, 0);
      g.add(bell);
      const b = k.add(k.geo(new THREE.CylinderGeometry(0.08, 0.22, 0.32, 14, 1, true)), k.mat('#E2B046', 0.4), 0, -0.2, 0, bell);
      (b.material as THREE.MeshStandardMaterial).side = THREE.DoubleSide;
      (b.material as THREE.MeshStandardMaterial).metalness = 0.4;
      ball(0.05, '#9A6F1E', 0, -0.36, 0, bell);
      k.tick((t, still) => (bell.rotation.z = still ? 0 : Math.sin(t * 1.3) * 0.05));
      return true;
    }
    case 'bubblemachine': {
      box(0.6, 0.35, 0.4, '#7FB0D8', 0, 0.18, 0);
      ball(0.06, '#F6C430', -0.15, 0.22, 0.21);
      cyl(0.02, 0.02, 0.4, '#9aa3a8', 0.25, 0.5, 0, 5).rotation.z = -0.6;
      const bubbles: THREE.Mesh[] = [];
      for (let i = 0; i < 6; i++) {
        const m = k.own(new THREE.MeshStandardMaterial({ color: '#cfeaf7', transparent: true, opacity: 0.4, roughness: 0.1, metalness: 0.2 }));
        bubbles.push(k.add(k.geo(new THREE.SphereGeometry(0.06 + (i % 3) * 0.025, 10, 8)), m, 0, 0, 0));
      }
      k.tick((t, still) => {
        bubbles.forEach((b, i) => {
          const life = still ? 0.3 + i * 0.1 : (t * 0.35 + i / 6) % 1;
          b.position.set(0.45 + life * 0.5 + Math.sin(t * 2 + i) * 0.08, 0.6 + life * 1.6, Math.cos(i * 1.7) * 0.25);
          (b.material as THREE.MeshStandardMaterial).opacity = 0.45 * (1 - life);
        });
      });
      return true;
    }
    case 'duckfountain': {
      // In the pond's water: a stone basin, a column and a duck on top, with a little spray.
      cyl(0.75, 0.82, 0.22, '#b8b2a8', 0, 0.05, 0, 20);
      cyl(0.62, 0.62, 0.04, '#a7d3e4', 0, 0.17, 0, 20);
      cyl(0.12, 0.16, 0.7, '#cfc9be', 0, 0.5, 0, 10);
      cyl(0.32, 0.22, 0.08, '#cfc9be', 0, 0.86, 0, 14);
      const duck = ball(0.14, '#fff8e6', 0, 1.0, 0);
      duck.scale.set(1.2, 0.85, 0.9);
      ball(0.09, '#fff8e6', 0.12, 1.1, 0);
      cone(0.035, 0.08, '#F6A23A', 0.22, 1.1, 0, 6).rotation.z = -Math.PI / 2;
      const spray = k.own(new THREE.MeshStandardMaterial({ color: '#ffffff', transparent: true, opacity: 0.55 }));
      const drops: THREE.Mesh[] = [];
      for (let i = 0; i < 8; i++) drops.push(k.add(k.geo(new THREE.SphereGeometry(0.035, 6, 5)), spray, 0, 0.9, 0));
      k.tick((t, still) => {
        drops.forEach((d, i) => {
          const a = (i / 8) * Math.PI * 2;
          const life = still ? 0.5 : (t * 0.8 + i / 8) % 1;
          d.position.set(Math.cos(a) * 0.5 * life, 0.95 + 0.35 * Math.sin(life * Math.PI) - life * 0.6, Math.sin(a) * 0.5 * life);
        });
      });
      return true;
    }
  }
  return false;
}
