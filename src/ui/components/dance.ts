/**
 * The choreographer (D44 PR D): starts a group dance on a sanctuary scene, every dancer on the same beat clock (a
 * music cue's, `services/music.ts`), each in its own style with its own finishing pose.
 *
 * Every dancer's figure gets the dance's id as its `data-trick` (so it is busy: no other trick, stroll or decoration
 * starts), which the 3D stage turns into the same clip (`three/dance.ts`). For drawn figures (3D off, or a kind the
 * toys can't make), CSS plays the same parts: the newcomer's drop-in or a guest's turn toward it, the style's step,
 * the finishing pose, all timed to the beat. The finish throws confetti and stars (3D: the stage's own; drawn: a
 * small overlay).
 *
 * Reduced motion: nobody moves; every dancer shows its happy face for the dance's length, and the finish shows its
 * confetti, still. Stopping (a skip, leaving the screen) puts every dancer back at once.
 */

import { danceId, danceSections, type DanceRole, type DanceSpec, type DanceStyle } from '../../three/dance';
import { toySpec } from '../../three/species';
import { animalInfo, isAnimalId } from '../../meta/animals';
import { temperamentOf } from '../../meta/temperament';
import type { Playback } from '../../services/music';

export interface Dancer {
  fig: SVGGElement;
  /** The animal's id (`cotton`, a pet's id, a wild animal's). */
  animal: string;
  spec: DanceSpec;
  id: string;
}

export interface DanceHandle {
  readonly dancers: Dancer[];
  /** Ends the dance now (a skip, the screen going): everyone back to rest. Safe to call more than once. */
  stop(): void;
  /** Settles when the dance ends or is stopped. */
  readonly done: Promise<void>;
}

/** Kinds with a dance of their own, from the plan: a sheep sways and nods, a pig wiggles and hops, a bunny twirls, a turtle bobs. */
const BY_KIND: Array<[RegExp, DanceStyle]> = [
  [/\b(sheep|lamb|ewe|ram)\b/, 'sway'],
  [/\b(pig|piglet|boar|hog)\b/, 'wiggle'],
  [/\b(bunny|rabbit|hare)\b/, 'twirl'],
  [/\b(turtle|tortoise|snail|sloth)\b/, 'bob'],
];

/** How an animal dances: its kind first, then its body, then its temperament. */
export function danceStyleFor(animal: string): DanceStyle {
  const noun = isAnimalId(animal) ? `${animalInfo(animal).noun} ${animalInfo(animal).animal ?? ''}`.toLowerCase() : animal.toLowerCase();
  for (const [re, st] of BY_KIND) if (re.test(noun)) return st;
  const body = toySpec(animal)?.body;
  if (body === 'bird') return 'flap';
  if (body === 'seal') return 'bob';
  if (body === 'big') return 'stomp';
  if (body === 'tall') return 'sway';
  switch (temperamentOf(animal)) {
    case 'playful':
    case 'energetic':
      return 'hop';
    case 'proud':
      return 'strut';
    case 'shy':
      return 'bob';
    default:
      return 'sway';
  }
}

const figureAnimal = (g: SVGGElement) => g.dataset.pet ?? g.dataset.friend ?? '';

/**
 * Who dances and how: every animal in the scene (not one away on a decoration). With a `newcomer`, it gets the
 * newcomer's part and everyone else turns toward it; without, all dance as a group. Finishing poses go round in order
 * across the scene, so neighbours always strike different ones.
 */
export function planDance(svg: SVGSVGElement, o: { bpm: number; beats: number; newcomer?: string; only?: string[] }): Dancer[] {
  const figs = [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet[data-gx]')]
    .filter((g) => !g.classList.contains('is-away') && !g.dataset.trick)
    .filter((g) => !o.only || o.only.includes(figureAnimal(g)))
    .sort((a, b) => Number(a.dataset.gx) - Number(b.dataset.gx));
  const lead = o.newcomer ? figs.find((g) => figureAnimal(g) === o.newcomer) : undefined;
  const leadX = lead ? Number(lead.dataset.gx) : null;
  const mid = (Number(svg.getAttribute('data-vb')?.split(/\s+/)[2]) || svg.viewBox?.baseVal?.width || 360) / 2;
  const seed = hash(figs.map(figureAnimal).join(','));
  return figs.map((fig, i) => {
    const animal = figureAnimal(fig);
    const x = Number(fig.dataset.gx);
    const role: DanceRole = lead ? (fig === lead ? 'newcomer' : 'guest') : 'group';
    const side = role === 'guest' ? (leadX! >= x ? 'R' : 'L') : x < mid ? 'R' : 'L';
    const spec: DanceSpec = {
      role,
      style: danceStyleFor(animal),
      variant: (i + seed) % 4,
      side,
      bpm: o.bpm,
      beats: o.beats,
    };
    return { fig, animal, spec, id: danceId(spec) };
  });
}

export interface StartOptions {
  reducedMotion: boolean;
  /** Called on each part's first beat (the camera and the parade follow along). */
  onPart?: (part: 'intro' | 'dance' | 'finish' | 'end') => void;
}

/** Starts a planned dance on `clock`'s beats (a music cue's clock: it runs in silence too). */
export function startDance(svg: SVGSVGElement, dancers: Dancer[], clock: Pick<Playback, 'msAt' | 'score'>, o: StartOptions): DanceHandle {
  const timers: ReturnType<typeof setTimeout>[] = [];
  const overlays: Element[] = [];
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  let over = false;
  const in3d = () => !!svg.closest('.has-3d');
  const beat = (60000 / clock.score.bpm).toFixed(1);
  const at = (b: number, fn: () => void) => timers.push(setTimeout(fn, Math.max(0, clock.msAt(b) - performance.now())));
  const first = dancers[0]?.spec;
  const sec = first ? danceSections(first) : { intro: 0, finish: 0, end: 0 };

  const partClasses = (d: Dancer) => [`is-dance-${d.spec.style}`, 'is-dance-enter', 'is-dance-invite', ...[0, 1, 2, 3].map((n) => `is-dance-pose-${n}`)];

  for (const d of dancers) {
    const f = d.fig;
    f.dataset.trick = d.id;
    f.style.setProperty('--beat', `${beat}ms`);
    f.style.setProperty('--side', d.spec.side === 'R' ? '1' : '-1');
    f.classList.add('is-dancing');
    if (o.reducedMotion) f.classList.add('is-dance-still');
    else {
      // The 3D stage plays the clip moving only with this class (as for a trick).
      f.classList.add(`is-trick-${d.id}`);
      if (d.spec.role === 'newcomer') f.classList.add('is-dance-enter');
      else if (d.spec.role === 'guest') f.classList.add('is-dance-invite');
      else f.classList.add(`is-dance-${d.spec.style}`);
    }
  }
  o.onPart?.(sec.intro > 0 ? 'intro' : 'dance');

  if (!o.reducedMotion) {
    if (sec.intro > 0)
      at(sec.intro, () => {
        for (const d of dancers) {
          d.fig.classList.remove('is-dance-enter', 'is-dance-invite');
          d.fig.classList.add(`is-dance-${d.spec.style}`);
        }
        o.onPart?.('dance');
      });
    at(sec.finish - 0.15, () => {
      for (const d of dancers) {
        d.fig.classList.remove(`is-dance-${d.spec.style}`);
        d.fig.classList.add(`is-dance-pose-${d.spec.variant % 4}`);
      }
    });
  } else if (sec.intro > 0) at(sec.intro, () => o.onPart?.('dance'));
  at(sec.finish, () => {
    o.onPart?.('finish');
    if (!in3d()) overlays.push(...confettiOverlay(svg, dancers, o.reducedMotion));
  });
  at(sec.end, () => finish(true));

  function finish(natural: boolean): void {
    if (over) return;
    over = true;
    for (const t of timers) clearTimeout(t);
    for (const d of dancers) {
      const f = d.fig;
      if (f.dataset.trick === d.id) delete f.dataset.trick;
      f.classList.remove('is-dancing', 'is-dance-still', `is-trick-${d.id}`, ...partClasses(d));
      f.style.removeProperty('--beat');
      f.style.removeProperty('--side');
    }
    for (const n of overlays) n.remove();
    if (natural) o.onPart?.('end');
    resolve();
  }

  return { dancers, done, stop: () => finish(false) };
}

/** The finish's confetti and stars over the dancers, for drawn scenes (the 3D stage throws its own). */
function confettiOverlay(svg: SVGSVGElement, dancers: Dancer[], still: boolean): Element[] {
  if (!dancers.length) return [];
  const xs = dancers.map((d) => Number(d.fig.dataset.gx));
  const ys = dancers.map((d) => Number(d.fig.dataset.gy) - Number(d.fig.dataset.gh ?? 30));
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const top = Math.min(...ys);
  const spread = Math.max(40, Math.max(...xs) - Math.min(...xs) + 30);
  const cols = ['#E8707A', '#F2C230', '#6FB07C', '#5B9BC4', '#9B7FD0', '#F6A23A'];
  let r = hash(`${cx}:${top}`) || 7;
  const rnd = () => (r = (r * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
  const bits: string[] = [];
  for (let i = 0; i < 26; i++) {
    const x = cx + (rnd() - 0.5) * spread;
    const y = top - 6 - rnd() * 24;
    const rot = Math.round(rnd() * 180);
    const delay = Math.round(rnd() * 260);
    const col = cols[i % cols.length];
    bits.push(
      i % 5 === 0
        ? `<path class="sp-confetti sp-confetti--star" style="animation-delay:${delay}ms" d="${star(x, y, 3.2)}" fill="#F7C534"/>`
        : `<rect class="sp-confetti" style="animation-delay:${delay}ms" x="${(x - 1.6).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="3.2" height="2" rx="0.4" fill="${col}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
    );
  }
  svg.insertAdjacentHTML('beforeend', `<g class="sp-dance-confetti${still ? ' is-still' : ''}" aria-hidden="true">${bits.join('')}</g>`);
  return [svg.lastElementChild!];
}

function star(x: number, y: number, r: number): string {
  const p: string[] = [];
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    p.push(`${(x + Math.cos(a) * rr).toFixed(2)} ${(y + Math.sin(a) * rr).toFixed(2)}`);
  }
  return `M${p.join(' L')} Z`;
}

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return (h >>> 0) % 100000;
}
