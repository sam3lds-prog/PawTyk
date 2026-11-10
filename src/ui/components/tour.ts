/**
 * The guided tour (D44 PR H): the camera takes the player round a home, stop by stop. Its landmark first (the doors
 * open, the critter peeks out), then every animal in turn, left to right (each one looks up and says hello as the
 * camera arrives), then the party spot (its lights come on), and back to the whole scene. A caption names each stop.
 * A Stop button on the scene, Escape, a tap on the scene or leaving the app end it at once, back on the whole scene.
 *
 * It grants nothing. Reduced motion: the camera cuts from stop to stop instead of gliding, and holds a little longer.
 */

import { animalInfo, isAnimalId } from '../../meta/animals';
import { scenePoint, type SceneCamera } from './camera';

export interface TourStop {
  kind: 'landmark' | 'animal' | 'party';
  name: string;
  el: Element;
  zoom: number;
  /** Frame higher (-) or lower (+) than the element's middle, in scene units. */
  dy?: number;
}

/** Glide between stops, and how long each one holds. */
export const TOUR_GLIDE_MS = 900;
export const TOUR_HOLD_MS = 1500;
export const TOUR_HOLD_STILL_MS = 2100;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function animalName(fig: HTMLElement): string {
  const id = fig.dataset.pet ?? fig.dataset.friend ?? '';
  if (!isAnimalId(id)) return fig.dataset.name ?? 'A friend';
  const a = animalInfo(id);
  return `${a.name} the ${a.noun}`;
}

/** The tour's stops in a scene: the landmark, the animals left to right, the party spot. */
export function tourStops(svg: SVGSVGElement): TourStop[] {
  const stops: TourStop[] = [];
  const lm = svg.querySelector<SVGGElement>('[data-landmark]');
  if (lm) stops.push({ kind: 'landmark', name: cap(lm.dataset.name ?? 'the landmark'), el: lm, zoom: 2 });
  const figs = [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-gx]')]
    .filter((g) => !g.classList.contains('is-away'))
    .sort((a, b) => Number(a.dataset.gx) - Number(b.dataset.gx));
  for (const g of figs) stops.push({ kind: 'animal', name: animalName(g as unknown as HTMLElement), el: g, zoom: 2.2, dy: -2 });
  const party = svg.querySelector<SVGGElement>('.sp-party');
  if (party) stops.push({ kind: 'party', name: 'The party lights', el: party, zoom: 1.7 });
  return stops.filter((s) => !!scenePoint(s.el));
}

export interface TourHost {
  /** The screen's root: the scene's figure, its tour button and captions live inside. */
  el: HTMLElement;
  camera: SceneCamera;
  reducedMotion: () => boolean;
  /** Pauses (or resumes) the scene's ambient life and activities. */
  pause(on: boolean): void;
  /** An animal says hello. */
  greet(fig: SVGGElement): void;
  /** Opens the landmark (its doors, its critter). */
  openLandmark(lm: Element): void;
  /** Told when the tour starts (other scene moments end first) and when it ends. */
  onStart?(): void;
  onEnd?(how: 'ended' | 'stopped'): void;
}

export interface SceneTour {
  start(): boolean;
  stop(): void;
  readonly active: boolean;
  /** A click on the screen: true if the tour handled it (its button, its Stop, a tap on the scene while it runs). */
  onClick(t: HTMLElement): boolean;
}

const TOUR_ICON = `<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M3 7.5A2.5 2.5 0 0 1 5.5 5h8A2.5 2.5 0 0 1 16 7.5v9a2.5 2.5 0 0 1-2.5 2.5h-8A2.5 2.5 0 0 1 3 16.5Z" fill="none" stroke="currentColor" stroke-width="2"/><path d="m16 10.5 5-3v9l-5-3Z" fill="currentColor"/></svg>`;

/** The tour button for the scene's corner (hidden when there's nothing to visit). */
export const tourButtonMarkup = (show: boolean) => `<button class="scene-tour" data-act="tour" ${show ? '' : 'hidden'} aria-label="Take the tour">${TOUR_ICON}<span>Tour</span></button>`;

export function sceneTour(scope: { on(t: EventTarget, type: string, fn: (e: Event) => void): void; onDispose(fn: () => void): void }, host: TourHost): SceneTour {
  let timers: ReturnType<typeof setTimeout>[] = [];
  let running = false;
  const later = (ms: number, fn: () => void) => {
    // The first stop starts at once.
    if (ms <= 0) fn();
    else timers.push(setTimeout(fn, ms));
  };
  const fig = () => host.el.querySelector<HTMLElement>('.sanctuary__scene');
  const svg = () => host.el.querySelector<SVGSVGElement>('.sanctuary__scene svg');

  const caption = (text: string | null) => {
    const f = fig();
    if (!f) return;
    let c = f.querySelector<HTMLElement>('.tour-caption');
    if (text === null) {
      c?.remove();
      return;
    }
    if (!c) {
      c = document.createElement('p');
      c.className = 'tour-caption';
      c.setAttribute('role', 'status');
      c.setAttribute('aria-live', 'polite');
      f.appendChild(c);
    }
    c.textContent = text;
    c.classList.remove('is-in');
    void c.offsetWidth;
    c.classList.add('is-in');
  };

  const finish = (how: 'ended' | 'stopped') => {
    if (!running) return;
    running = false;
    for (const t of timers) clearTimeout(t);
    timers = [];
    caption(null);
    const f = fig();
    f?.classList.remove('is-touring');
    f?.querySelector('.tour-stop')?.remove();
    f?.querySelectorAll('.sp-party.is-tour-lit').forEach((p) => p.classList.remove('is-tour-lit'));
    const btn = f?.querySelector<HTMLElement>('[data-act="tour"]');
    if (btn) btn.hidden = false;
    host.pause(false);
    void host.camera.reset(how === 'stopped' ? 350 : 800);
    host.onEnd?.(how);
  };

  scope.on(document, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Escape' && running && !document.querySelector('.overlay')) finish('stopped');
  });
  scope.on(document, 'visibilitychange', () => {
    if (document.hidden) finish('stopped');
  });
  scope.onDispose(() => finish('stopped'));

  const api: SceneTour = {
    start() {
      const s = svg();
      const f = fig();
      if (running || !s || !f || document.hidden) return false;
      const stops = tourStops(s);
      if (!stops.length) return false;
      host.onStart?.();
      running = true;
      host.pause(true);
      f.classList.add('is-touring');
      const btn = f.querySelector<HTMLElement>('[data-act="tour"]');
      if (btn) btn.hidden = true;
      const stopBtn = document.createElement('button');
      stopBtn.type = 'button';
      stopBtn.className = 'parade-skip tour-stop';
      stopBtn.dataset.act = 'tour-stop';
      stopBtn.textContent = 'Stop';
      stopBtn.setAttribute('aria-label', 'Stop the tour');
      f.appendChild(stopBtn);
      const still = host.reducedMotion();
      const glide = still ? 0 : TOUR_GLIDE_MS;
      const hold = still ? TOUR_HOLD_STILL_MS : TOUR_HOLD_MS;
      let at = 0;
      for (const stop of stops) {
        later(at, () => {
          const v = host.camera.viewOf(stop.el, stop.zoom, { dy: stop.dy });
          if (v) void host.camera.moveTo(v, glide);
          caption(stop.name);
        });
        // What happens there, as the camera arrives.
        later(at + Math.round(glide * 0.75), () => {
          if (stop.kind === 'landmark') host.openLandmark(stop.el);
          else if (stop.kind === 'animal') host.greet(stop.el as SVGGElement);
          else stop.el.classList.add('is-tour-lit');
        });
        at += glide + hold;
      }
      later(at, () => finish('ended'));
      return true;
    },
    stop: () => finish('stopped'),
    get active() {
      return running;
    },
    onClick(t) {
      if (t.closest('[data-act="tour"]')) {
        api.start();
        return true;
      }
      if (t.closest('[data-act="tour-stop"]')) {
        finish('stopped');
        return true;
      }
      // While it runs, a tap on the scene ends it (the player wants to look around themselves).
      if (running && t.closest('.sanctuary__scene')) {
        finish('stopped');
        return true;
      }
      return false;
    },
  };
  return api;
}
