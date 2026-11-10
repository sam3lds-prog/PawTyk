/**
 * Letting go of a WebGL renderer completely (D46 PR B).
 *
 * three.js r186 keeps one DFG lookup texture for every physically based material, made once at module level. Each
 * renderer that draws such a material uploads it and adds a `dispose` listener to it, and `renderer.dispose()` does
 * not take that listener off. So the shared texture held on to every renderer ever made, and through it the renderer's
 * WebGL context, its canvas and whatever the canvas's own listeners reach (the whole 3D walk: about 1.2 MB a visit,
 * measured in Chrome, and a WebGL context the phone can't reuse).
 *
 * Disposing the shared texture after a renderer goes calls every renderer's listener once: each releases its copy and
 * forgets the texture. A renderer still drawing simply uploads it again on its next frame (three.js re-uploads a
 * disposed texture the next time it's used), so this is safe while another scene is live.
 */

import type * as THREE from 'three';

let shared: THREE.Texture | null = null;
/** Frames looked at per renderer: a scene with no physically based material yet is looked at a few times, not forever. */
const looks = new WeakMap<THREE.WebGLRenderer, number>();
const MAX_LOOKS = 60;

/** Finds the shared lookup texture in a scene a renderer has drawn (once; it is the same texture for every renderer). */
export function noteSharedTextures(renderer: THREE.WebGLRenderer, scene: THREE.Object3D): void {
  if (shared) return;
  const n = looks.get(renderer) ?? 0;
  if (n >= MAX_LOOKS) return;
  looks.set(renderer, n + 1);
  scene.traverse((o) => {
    if (shared) return;
    const mat = (o as THREE.Mesh).material;
    for (const m of Array.isArray(mat) ? mat : mat ? [mat] : []) {
      const u = (renderer.properties.get(m) as { uniforms?: Record<string, { value: unknown }> }).uniforms;
      const t = u?.dfgLUT?.value as THREE.Texture | null | undefined;
      if (t?.isTexture) {
        shared = t;
        return;
      }
    }
  });
}

/** Disposes a renderer, drops its WebGL context, and lets the shared texture forget it. */
export function releaseRenderer(renderer: THREE.WebGLRenderer): void {
  renderer.dispose();
  renderer.forceContextLoss?.();
  shared?.dispose();
}
