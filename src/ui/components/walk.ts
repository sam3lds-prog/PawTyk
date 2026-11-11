/**
 * Walking round the Farm in 3D (D44 PR I): a full-screen view over the Farm screen, opened from the "Walk" button in
 * the scene's corner. It loads three.js only when opened, and only where 3D toys are on (the setting, and a device
 * that can draw WebGL); without them the button isn't offered and the drawn Farm is the Farm.
 *
 * Getting round: drag to look, tap the ground to walk there, tap an animal to go and say hello; the arrow buttons
 * (hold to keep going) and the keyboard's arrows or WASD do the same. Overview (or Escape, or Back) returns to the
 * drawn Farm, focus back on the Walk button. Leaving the app pauses it; closing releases the WebGL context.
 *
 * D45 PR C: it shows the same Farm as the drawn one (`meta/homeState.ts`: stage, residents, the decorations the player
 * has out, evening light). A small map shows where the barn, pond, orchard and pasture are and which way the player
 * faces; "Go to" buttons walk there; arriving somewhere names it and plays its small discovery (the barn's doors open
 * and a chick looks out, the ducks splash, an apple drops and birds fly up, butterflies rise). Nothing is granted.
 */

import { app } from '../../app/app';
import { homeState } from '../../meta/homeState';
import { DECOR_PLACES, LANDMARKS, PLACES, landmarksAt, mapPoint, type LandmarkId } from '../../three/walkMath';
import { feel } from '../../services/feel';
import { cameraQuality } from './camera';
import { wants3D } from './scene3d';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import { openPhotoMode, type PhotoMode } from './photoMode';
import type { Scope } from '../router';
import { animalName } from './activities';

const WALK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="13" cy="4.5" r="2" fill="currentColor"/><path d="M11 21l1.6-6.2L15 17v4M9.4 11.6 11 8.4c.4-.8 1.3-1.2 2.2-.9l1.4.5 2.4 3.4M9 21l2.2-8.4L12.8 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Whether this device and these settings can walk the Farm. */
export const canWalk = (): boolean => wants3D();

/** The Walk button for the Farm scene's corner. */
export const walkButtonMarkup = (show: boolean) => `<button class="scene-walk" data-act="walk" ${show ? '' : 'hidden'} aria-label="Walk around the Farm in 3D">${WALK_ICON}<span>Walk</span></button>`;

type WalkModule = typeof import('../../three/walk');

/** How long the walk waits for a lost WebGL context to come back before saying so (D46 PR B). */
export const WALK_LOST_MS = 3000;
let loading: Promise<WalkModule> | null = null;

export interface WalkHandle {
  close(): void;
  readonly done: Promise<void>;
}

/** Dev and QA: the open walk, if any (also `window.__walk` on the dev server). */
let current: import('../../three/walk').FarmWalk | null = null;
export const openWalk = () => current;
if (import.meta.env.DEV && typeof window !== 'undefined') Object.defineProperty(window, '__walk', { configurable: true, get: () => current });

/** Opens the walk over the screen. Resolves when it closes. */
export function showFarmWalk(parent: Scope, opts: { returnFocus?: () => HTMLElement | null } = {}): WalkHandle {
  const scope = parent.child();
  // The same Farm the drawn scene shows: its stage, who is home, the decorations out, the time of day.
  const farm = homeState(app.save, 'farm');
  const places = landmarksAt(farm.stage);
  const el = h(`
    <div class="walk" role="dialog" aria-modal="true" aria-label="Walking round the Farm">
      <div class="walk__view" data-walk-view><p class="walk__loading">Opening the Farm…</p></div>
      <header class="walk__top">
        <button class="walk__back" data-act="walk-close" aria-label="Return to the Farm overview">${ICON.back}<span>Overview</span></button>
        <h2 class="walk__title">Meadow Farm</h2>
        <button class="walk__photo" data-act="walk-photo" aria-label="Take a photo of the Farm" hidden>${ICON.camera}<span>Photo</span></button>
      </header>
      <p class="walk__place" data-walk-place hidden></p>
      <p class="walk__hint" data-walk-hint>Drag to look around · Tap the ground to walk · Tap a friend to say hello</p>
      <div class="walk__pad" aria-label="Move">
        <button class="walk__btn walk__btn--left" data-move="0,1" aria-label="Turn left">${arrow(180)}</button>
        <button class="walk__btn walk__btn--up" data-move="1,0" aria-label="Walk forward">${arrow(270)}</button>
        <button class="walk__btn walk__btn--down" data-move="-1,0" aria-label="Walk back">${arrow(90)}</button>
        <button class="walk__btn walk__btn--right" data-move="0,-1" aria-label="Turn right">${arrow(0)}</button>
      </div>
      <div class="walk__map" aria-hidden="true" data-walk-map>${mapMarkup(farm.stage, farm.decor)}</div>
      ${
        places.length
          ? `<nav class="walk__goto" aria-label="Go to">
        ${places.map((l) => `<button class="walk__chip" data-goto="${l.id}" aria-label="Go to ${l.name}">${cap(l.name.replace(/^the /, ''))}</button>`).join('')}
      </nav>`
          : ''
      }
      <p class="sr-only" role="status" aria-live="polite" data-walk-status></p>
    </div>`);
  document.body.appendChild(el);
  document.body.classList.add('has-walk');
  // Modal: the screen underneath can't be tabbed to or tapped while walking (D44 PR I review).
  const under = document.getElementById('app');
  const wasInert = !!under?.inert;
  if (under) under.inert = true;
  const view = el.querySelector<HTMLElement>('[data-walk-view]')!;
  const status = el.querySelector<HTMLElement>('[data-walk-status]')!;
  el.querySelector<HTMLElement>('[data-act="walk-close"]')?.focus({ preventScroll: true });

  let walk: import('../../three/walk').FarmWalk | null = null;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  const close = () => scope.dispose();
  scope.onDispose(() => {
    walk?.dispose();
    if (current === walk) current = null;
    walk = null;
    el.remove();
    document.body.classList.remove('has-walk');
    if (under) under.inert = wasInert;
    opts.returnFocus?.()?.focus({ preventScroll: true });
    resolve();
  });

  // The map's "you are here" arrow, and the place the player is at.
  const me = el.querySelector<SVGGElement>('[data-map-me]');
  const moved = (x: number, z: number, yaw: number) => {
    const p = mapPoint(x, z);
    me?.setAttribute('transform', `translate(${(p.u * 100).toFixed(1)} ${(p.v * 100).toFixed(1)}) rotate(${((-yaw * 180) / Math.PI).toFixed(0)})`);
  };
  const placeEl = el.querySelector<HTMLElement>('[data-walk-place]')!;
  const arrived = (id: LandmarkId | null, first: boolean) => {
    for (const m of el.querySelectorAll<SVGElement>('[data-map-place]')) m.classList.toggle('is-here', m.dataset.mapPlace === id);
    for (const c of el.querySelectorAll<HTMLElement>('[data-goto]')) c.setAttribute('aria-current', String(c.dataset.goto === id));
    const l = LANDMARKS.find((x) => x.id === id);
    if (!l) {
      placeEl.hidden = true;
      return;
    }
    el.querySelector('[data-walk-hint]')?.classList.add('is-gone');
    const found = walk ? walk.found.size : 1;
    placeEl.hidden = false;
    placeEl.innerHTML = `<b>${esc(cap(l.name))}</b>${first ? `<span>${esc(l.discovery)}</span><small>${found} of ${places.length} places found</small>` : ''}`;
    // Said once for a screen reader; coming back to a place just names it.
    status.textContent = first ? `${cap(l.name)}. ${l.discovery} ${found} of ${places.length} places found.` : cap(l.name);
    if (first) feel('tap');
  };

  const fail = () => {
    view.innerHTML = `<p class="walk__loading">3D isn’t available on this device right now. The Farm is still here to visit.</p>`;
  };
  // D46 PR B: the context went (the phone needed the memory, or the app was away). A note over the view while it
  // comes back; if it doesn't within a few seconds, the walk says so and Overview takes the player back to the Farm.
  let lostTimer: ReturnType<typeof setTimeout> | null = null;
  scope.onDispose(() => {
    if (lostTimer !== null) clearTimeout(lostTimer);
  });
  const note = (text: string | null) => {
    let n = view.querySelector<HTMLElement>('.walk__note');
    if (text === null) return n?.remove();
    if (!n) {
      n = document.createElement('p');
      n.className = 'walk__loading walk__note';
      view.appendChild(n);
    }
    n.textContent = text;
  };
  const onContext = (drawing: boolean) => {
    if (!scope.alive) return;
    if (lostTimer !== null) clearTimeout(lostTimer);
    lostTimer = null;
    if (drawing) {
      note(null);
      status.textContent = 'The Farm is back.';
      return;
    }
    note('Getting the Farm back…');
    lostTimer = setTimeout(() => {
      lostTimer = null;
      if (!scope.alive || !walk?.contextLost) return;
      note('3D paused on this phone. Tap Overview to go back to the Farm.');
      status.textContent = '3D paused. Overview returns to the Farm.';
      el.querySelector<HTMLElement>('[data-act="walk-close"]')?.focus({ preventScroll: true });
    }, WALK_LOST_MS);
  };
  loading ??= import('../../three/walk');
  loading
    .then((m: WalkModule) => {
      if (!scope.alive) return;
      try {
        walk = new m.FarmWalk({
          residents: farm.residents,
          stage: farm.stage,
          decor: farm.decor,
          evening: farm.evening,
          reducedMotion: () => app.reducedMotion,
          quality: cameraQuality(),
          onHello: (id) => {
            status.textContent = `${animalName(id)} says hello!`;
            feel('hello');
          },
          onMove: moved,
          onPlace: arrived,
          onContext,
        });
      } catch {
        fail();
        return;
      }
      current = walk;
      view.replaceChildren(walk.canvas);
      // The walk is drawing: a picture can be taken.
      el.querySelector<HTMLElement>('[data-act="walk-photo"]')?.removeAttribute('hidden');
      const fit = () => walk?.fit(view.clientWidth, view.clientHeight);
      fit();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
      ro?.observe(view);
      scope.onDispose(() => ro?.disconnect());
      walk.setLive(!document.hidden);
      walk.renderNow();
      moved(walk.walker.x, walk.walker.z, walk.walker.yaw);
      bindInput(walk);
    })
    .catch(fail);

  function bindInput(w: import('../../three/walk').FarmWalk): void {
    const c = w.canvas;
    c.style.touchAction = 'none';
    let drag: { id: number; x: number; y: number; moved: number } | null = null;
    scope.on(c, 'pointerdown', (e) => {
      const p = e as PointerEvent;
      drag = { id: p.pointerId, x: p.clientX, y: p.clientY, moved: 0 };
      c.setPointerCapture?.(p.pointerId);
    });
    scope.on(c, 'pointermove', (e) => {
      const p = e as PointerEvent;
      if (!drag || p.pointerId !== drag.id) return;
      const dx = p.clientX - drag.x;
      const dy = p.clientY - drag.y;
      drag.moved += Math.abs(dx) + Math.abs(dy);
      drag.x = p.clientX;
      drag.y = p.clientY;
      if (drag.moved > 6) w.look(dx, dy);
    });
    scope.on(c, 'pointerup', (e) => {
      const p = e as PointerEvent;
      if (!drag || p.pointerId !== drag.id) return;
      const tapped = drag.moved <= 6;
      drag = null;
      if (!tapped) return;
      const r = c.getBoundingClientRect();
      const what = w.tap((p.clientX - r.left) / r.width, (p.clientY - r.top) / r.height);
      if (what === 'animal') feel('tap');
      el.querySelector('[data-walk-hint]')?.classList.add('is-gone');
    });
    scope.on(c, 'pointercancel', () => (drag = null));
    // The arrow buttons: hold to keep going.
    for (const b of el.querySelectorAll<HTMLElement>('[data-move]')) {
      const [mv, tn] = b.dataset.move!.split(',').map(Number);
      scope.on(b, 'pointerdown', (e) => {
        e.preventDefault();
        w.hold(mv, tn);
      });
      for (const t of ['pointerup', 'pointerleave', 'pointercancel']) scope.on(b, t, () => w.hold(0, 0));
      // Keyboard and switch access: a click is one step.
      scope.on(b, 'click', (e) => {
        if ((e as MouseEvent).detail !== 0) return;
        w.hold(mv, tn);
        window.setTimeout(() => w.hold(0, 0), 250);
      });
    }
    const keys: Record<string, [number, number]> = {
      ArrowUp: [1, 0],
      KeyW: [1, 0],
      ArrowDown: [-1, 0],
      KeyS: [-1, 0],
      ArrowLeft: [0, 1],
      KeyA: [0, 1],
      ArrowRight: [0, -1],
      KeyD: [0, -1],
    };
    scope.on(document, 'keydown', (e) => {
      const k = keys[(e as KeyboardEvent).code];
      if (!k || (e as KeyboardEvent).repeat) return;
      e.preventDefault();
      w.hold(...k);
    });
    scope.on(document, 'keyup', (e) => {
      if (keys[(e as KeyboardEvent).code]) w.hold(0, 0);
    });
  }

  // Photo mode (D47 PR 5): a postcard of the Farm as the player sees it (they look round to frame it).
  let photo: PhotoMode | null = null;
  scope.on(el, 'click', (e) => {
    const t = e.target as HTMLElement;
    if (t.closest('.photo-mode')) return;
    if (t.closest('[data-act="walk-photo"]') && walk && !walk.contextLost) {
      const w = walk;
      w.hold(0, 0);
      photo = openPhotoMode(scope, el, { place: 'Meadow Farm', home: 'farm', kind: 'walk', frames: [], capture: async () => w.snapshot() });
      void photo.done.then(() => {
        photo = null;
        if (scope.alive) el.querySelector<HTMLElement>('[data-act="walk-photo"]')?.focus({ preventScroll: true });
      });
      return;
    }
    if (t.closest('[data-act="walk-close"]')) close();
    const go = t.closest<HTMLElement>('[data-goto]');
    if (go && walk) {
      walk.goTo(go.dataset.goto as LandmarkId);
      el.querySelector('[data-walk-hint]')?.classList.add('is-gone');
    }
  });
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape') {
      e.preventDefault();
      // Escape leaves photo mode first, then the walk.
      if (photo?.open) photo.close();
      else close();
    } else if (ke.key === 'Tab') {
      // Focus stays inside the walk view.
      const items = [...el.querySelectorAll<HTMLElement>('button:not([disabled])')];
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (!el.contains(document.activeElement)) {
        ke.preventDefault();
        first.focus();
      } else if (ke.shiftKey && document.activeElement === first) {
        ke.preventDefault();
        last.focus();
      } else if (!ke.shiftKey && document.activeElement === last) {
        ke.preventDefault();
        first.focus();
      }
    }
  });
  // Leaving the app pauses it (nothing draws unseen), and lets go of any held key or button: its release may happen
  // elsewhere, and walking on when the player comes back would be a surprise (D44 PR I review).
  scope.on(document, 'visibilitychange', () => {
    if (document.hidden) walk?.hold(0, 0);
    walk?.setLive(!document.hidden);
  });
  scope.on(window, 'blur', () => walk?.hold(0, 0));

  return { close, done };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** The mini-map: the Farm from above (the gate at the bottom), with what is built and what the player has out. */
function mapMarkup(stage: number, decor: readonly string[]): string {
  const pt = (x: number, z: number) => {
    const p = mapPoint(x, z);
    return [p.u * 100, p.v * 100] as const;
  };
  const has = (id: LandmarkId) => stage >= (LANDMARKS.find((l) => l.id === id)?.stage ?? 9);
  const k = 100 / 60;
  const [px0, pz0] = pt(PLACES.pasture.x0, PLACES.pasture.z0);
  const [bx, bz] = pt(PLACES.barn.x, PLACES.barn.z);
  const [wx, wz] = pt(PLACES.pond.x, PLACES.pond.z);
  const parts: string[] = [
    `<rect x="1" y="1" width="98" height="98" rx="14" class="walk-map__ground"/>`,
    `<rect data-map-place="pasture" class="walk-map__pasture" x="${px0.toFixed(1)}" y="${pz0.toFixed(1)}" width="${((PLACES.pasture.x1 - PLACES.pasture.x0) * k).toFixed(1)}" height="${((PLACES.pasture.z1 - PLACES.pasture.z0) * k).toFixed(1)}" rx="3"/>`,
  ];
  if (has('barn'))
    parts.push(
      `<rect data-map-place="barn" class="walk-map__barn" x="${(bx - (PLACES.barn.w * k) / 2).toFixed(1)}" y="${(bz - (PLACES.barn.d * k) / 2).toFixed(1)}" width="${(PLACES.barn.w * k).toFixed(1)}" height="${(PLACES.barn.d * k).toFixed(1)}" rx="2" transform="rotate(${((-PLACES.barn.rot * 180) / Math.PI).toFixed(0)} ${bx.toFixed(1)} ${bz.toFixed(1)})"/>`,
    );
  if (has('pond')) parts.push(`<circle data-map-place="pond" class="walk-map__pond" cx="${wx.toFixed(1)}" cy="${wz.toFixed(1)}" r="${(PLACES.pond.r * k).toFixed(1)}"/>`);
  if (has('orchard'))
    parts.push(
      `<g data-map-place="orchard" class="walk-map__orchard">${PLACES.orchard
        .map(([x, z]) => {
          const [u, v] = pt(x, z);
          return `<circle cx="${u.toFixed(1)}" cy="${v.toFixed(1)}" r="3.4"/>`;
        })
        .join('')}</g>`,
    );
  for (const id of decor) {
    const d = (DECOR_PLACES as Record<string, { x: number; z: number } | undefined>)[id];
    if (!d) continue;
    const [u, v] = pt(d.x, d.z);
    parts.push(`<rect class="walk-map__decor" data-map-decor="${id}" x="${(u - 1.8).toFixed(1)}" y="${(v - 1.8).toFixed(1)}" width="3.6" height="3.6" rx="1"/>`);
  }
  const [gx, gz] = pt(PLACES.start.x, PLACES.start.z + 4);
  parts.push(`<path class="walk-map__gate" d="M${(gx - 5).toFixed(1)} ${gz.toFixed(1)}h10"/>`);
  parts.push(`<g data-map-me class="walk-map__me"><path d="M0 -6.5 4.6 4.6 0 2.2 -4.6 4.6Z"/></g>`);
  return `<svg viewBox="0 0 100 100" width="100%" height="100%">${parts.join('')}</svg>`;
}

function arrow(rot: number): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${rot} 12 12)"/></svg>`;
}
