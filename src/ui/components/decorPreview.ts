/**
 * A decoration's preview on its card (D48 PR C): the player's own home as it is now, with this piece out where it
 * would stand (whatever shares its spot tucked away), framed round the piece with a dashed ring, and a **Show me**
 * that plays what the animals do with it, right there, with one of the home's own animals. Nothing is bought or
 * changed by looking: it's a picture of the save, not the save.
 */

import { app } from '../../app/app';
import { DECOR_BY_ID, decorHome, spotMates, type DecorId } from '../../meta/catalogs/decor';
import { isRegionId, sanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { homeState } from '../../meta/homeState';
import { shownDecorIds } from '../../meta/sanctuary';
import { unlockedCompanions, unlockedPets } from '../../meta/rewards';
import { activityFor } from '../art/activities';
import { regionScene } from '../art/regions';
import { decorArt, sanctuaryScene } from '../art/sanctuary';
import { ActivityRunner, animalName } from './activities';
import type { Scope } from '../router';

/** The scene's frame. */
const W = 360;
const H = 300;
/** The preview's shape (a little wider than the scene: it sits on a card). */
const ASPECT = 360 / 220;

/** The part of the scene to show: round the piece, at least 140 wide, inside the scene. */
export function previewView(box: [number, number, number, number]): { x: number; y: number; w: number; h: number } {
  const [bx, by, bw, bh] = box;
  let w = Math.max(140, bw * 2.6, bh * 2.6 * ASPECT);
  w = Math.min(W, w);
  let h = w / ASPECT;
  if (h > H) {
    h = H;
    w = h * ASPECT;
  }
  const cx = bx + bw / 2;
  const cy = by + bh * 0.6;
  return { x: Math.min(W - w, Math.max(0, cx - w / 2)), y: Math.min(H - h, Math.max(0, cy - h / 2)), w, h };
}

/** The home's scene with `id` out in its spot (its spot-mates away), as an SVG's inner markup. */
export function previewScene(id: DecorId): string {
  const d = DECOR_BY_ID[id];
  const home = decorHome(d);
  const mates = new Set(spotMates(id).map((m) => m.id as string));
  if (home === 'harmony') {
    const decor = [...shownDecorIds(app.save, 'harmony').filter((x) => !mates.has(x)), id];
    return sanctuaryScene({ decor, pets: unlockedPets(app.save), companions: unlockedCompanions(app.save), evening: false }, 'pv');
  }
  if (!isRegionId(home)) return '';
  const st = homeState(app.save, home);
  const decor = [...st.decor.filter((x) => !mates.has(x)), id];
  // A piece that needs its home to grow first is shown as it will be (the card says when).
  const stage = Math.max(st.stage, d.stage ?? 0, 1);
  return regionScene(home, { stage, companions: st.residents as never[], decor, evening: false }, 'pv');
}

export function previewMarkup(id: DecorId): string {
  const a = decorArt(id);
  if (!a) return '';
  const v = previewView(a.box);
  const [bx, by, bw, bh] = a.box;
  const ring = `<ellipse class="sp-preview-ring" cx="${(bx + bw / 2).toFixed(1)}" cy="${(by + bh / 2).toFixed(1)}" rx="${(bw * 0.62).toFixed(1)}" ry="${(bh * 0.62).toFixed(1)}"/>`;
  const where = sanctuaryDef(decorHome(DECOR_BY_ID[id]));
  return `<figure class="sanctuary__scene is-live decor-preview" data-decor-preview="${id}">
    <svg viewBox="${v.x.toFixed(1)} ${v.y.toFixed(1)} ${v.w.toFixed(1)} ${v.h.toFixed(1)}" role="img" aria-label="${DECOR_BY_ID[id].name} in your ${where.name}">${previewScene(id)}${ring}</svg>
  </figure>`;
}

/**
 * Wires the preview's **Show me** (`[data-act="preview-play"]` inside `root`): plays the piece's activity with one of
 * the home's animals, in the preview. Returns whether there is anything to play (an activity and someone to do it).
 */
export function bindPreview(scope: Scope, root: HTMLElement, id: DecorId): boolean {
  const svg = root.querySelector<SVGSVGElement>(`[data-decor-preview="${id}"] svg`);
  if (!svg || !activityFor(id)) return false;
  const cast = () => [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet:not([data-trick])')].map((g) => g.dataset.pet ?? g.dataset.friend ?? '').filter(Boolean);
  if (!cast().length) return false;
  const runner = new ActivityRunner(svg, { reducedMotion: () => app.reducedMotion, cast, nameOf: animalName, caption: () => {} });
  scope.onDispose(() => runner.dispose());
  scope.on(root, 'click', (e) => {
    if (!(e.target as HTMLElement).closest('[data-act="preview-play"]')) return;
    if (!runner.busy) runner.play(id);
  });
  return true;
}
