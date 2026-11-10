/**
 * Walking round the Farm in 3D (D44 PR I): a full-screen view over the Farm screen, opened from the "Walk" button in
 * the scene's corner. It loads three.js only when opened, and only where 3D toys are on (the setting, and a device
 * that can draw WebGL); without them the button isn't offered and the drawn Farm is the Farm.
 *
 * Getting round: drag to look, tap the ground to walk there, tap an animal to go and say hello; the arrow buttons
 * (hold to keep going) and the keyboard's arrows or WASD do the same. Close (or Escape, or Back) returns to the Farm,
 * focus back on the Walk button. Leaving the app pauses it; closing releases the WebGL context.
 */

import { app } from '../../app/app';
import { isHome, type AnimalId } from '../../meta/animals';
import { sanctuaryDef } from '../../meta/catalogs/sanctuaries';
import { stageOf } from '../../meta/world';
import { feel } from '../../services/feel';
import { cameraQuality } from './camera';
import { wants3D } from './scene3d';
import { h } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { animalName } from './activities';

const WALK_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="13" cy="4.5" r="2" fill="currentColor"/><path d="M11 21l1.6-6.2L15 17v4M9.4 11.6 11 8.4c.4-.8 1.3-1.2 2.2-.9l1.4.5 2.4 3.4M9 21l2.2-8.4L12.8 9" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

/** Whether this device and these settings can walk the Farm. */
export const canWalk = (): boolean => wants3D();

/** The Walk button for the Farm scene's corner. */
export const walkButtonMarkup = (show: boolean) => `<button class="scene-walk" data-act="walk" ${show ? '' : 'hidden'} aria-label="Walk around the Farm in 3D">${WALK_ICON}<span>Walk</span></button>`;

type WalkModule = typeof import('../../three/walk');
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
  const def = sanctuaryDef('farm');
  const residents = def.arrivals.map((a) => a.id as string).filter((id) => isHome(app.save, id as AnimalId));
  const el = h(`
    <div class="walk" role="dialog" aria-modal="true" aria-label="Walking round the Farm">
      <div class="walk__view" data-walk-view><p class="walk__loading">Opening the Farm…</p></div>
      <header class="walk__top">
        <h2 class="walk__title">Meadow Farm</h2>
        <button class="icon-btn walk__close" data-act="walk-close" aria-label="Close">${ICON.close}</button>
      </header>
      <p class="walk__hint" data-walk-hint>Drag to look around · Tap the ground to walk · Tap a friend to say hello</p>
      <div class="walk__pad" aria-label="Move">
        <button class="walk__btn walk__btn--left" data-move="0,1" aria-label="Turn left">${arrow(180)}</button>
        <button class="walk__btn walk__btn--up" data-move="1,0" aria-label="Walk forward">${arrow(270)}</button>
        <button class="walk__btn walk__btn--down" data-move="-1,0" aria-label="Walk back">${arrow(90)}</button>
        <button class="walk__btn walk__btn--right" data-move="0,-1" aria-label="Turn right">${arrow(0)}</button>
      </div>
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

  const fail = () => {
    view.innerHTML = `<p class="walk__loading">3D isn’t available on this device right now. The Farm is still here to visit.</p>`;
  };
  loading ??= import('../../three/walk');
  loading
    .then((m: WalkModule) => {
      if (!scope.alive) return;
      try {
        walk = new m.FarmWalk({
          residents,
          stage: stageOf(app.save, 'farm'),
          evening: (() => {
            const hr = new Date().getHours();
            return hr >= 19 || hr < 6;
          })(),
          reducedMotion: () => app.reducedMotion,
          quality: cameraQuality(),
          onHello: (id) => {
            status.textContent = `${animalName(id)} says hello!`;
            feel('hello');
          },
        });
      } catch {
        fail();
        return;
      }
      current = walk;
      view.replaceChildren(walk.canvas);
      const fit = () => walk?.fit(view.clientWidth, view.clientHeight);
      fit();
      const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
      ro?.observe(view);
      scope.onDispose(() => ro?.disconnect());
      walk.setLive(!document.hidden);
      walk.renderNow();
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

  scope.on(el, 'click', (e) => {
    if ((e.target as HTMLElement).closest('[data-act="walk-close"]')) close();
  });
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (ke.key === 'Escape') {
      e.preventDefault();
      close();
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

function arrow(rot: number): string {
  return `<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M8 5l8 7-8 7" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" transform="rotate(${rot} 12 12)"/></svg>`;
}
