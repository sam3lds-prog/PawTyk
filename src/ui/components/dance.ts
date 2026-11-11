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

import { danceId, danceSections, type DancePreset, type DanceRole, type DanceSpec, type DanceStyle } from '../../three/dance';
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
 * How each celebration (D48 PR E) dances: everyone hops for the Meadow Hop and ends in a leap; the Sparkle Surprise's
 * newcomer twirls while the others bob in wonder and cheer; the Friendship Circle sways together and everyone leans in
 * toward the newcomer at the end. The Boogie (no preset) is the D44 parade: each its own style, poses in turn.
 */
function presetStep(preset: DancePreset, role: DanceRole, own: DanceStyle): DanceStyle {
  if (preset === 'meadowhop') return 'hop';
  if (preset === 'sparkle') return role === 'newcomer' ? 'twirl' : own === 'flap' ? 'flap' : 'bob';
  return 'sway';
}
function presetPose(preset: DancePreset, role: DanceRole): number {
  if (preset === 'meadowhop') return 3;
  if (preset === 'sparkle') return role === 'newcomer' ? 2 : 0;
  return 1;
}

/**
 * Who dances and how: every animal in the scene (not one away on a decoration). With a `newcomer`, it gets the
 * newcomer's part and everyone else turns toward it; without, all dance as a group. Finishing poses go round in order
 * across the scene, so neighbours always strike different ones (a celebration's `preset` sets them its own way).
 */
export function planDance(svg: SVGSVGElement, o: { bpm: number; beats: number; newcomer?: string; only?: string[]; preset?: DancePreset }): Dancer[] {
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
    const own = danceStyleFor(animal);
    // A celebration with no newcomer in the scene (it left, say) is the D44 group dance.
    const preset = lead ? o.preset : undefined;
    const spec: DanceSpec = {
      role,
      style: preset ? presetStep(preset, role, own) : own,
      variant: preset ? presetPose(preset, role) : (i + seed) % 4,
      side,
      bpm: o.bpm,
      beats: o.beats,
      ...(preset ? { preset } : {}),
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

  const partClasses = (d: Dancer) => [`is-dance-${d.spec.style}`, 'is-dance-enter', 'is-dance-invite', ...[0, 1, 2, 3].map((n) => `is-dance-pose-${n}`), ...(d.spec.preset ? [`is-dance-${d.spec.preset}`] : [])];
  const preset = dancers.find((d) => d.spec.preset)?.spec.preset;

  // The stage (D45 PR D): one wide wash of warm light on the ground under the whole group, so the dancers share a
  // floor instead of standing in separate puddles. It brightens for the final pose.
  const stageAt = dancers.map((d) => ({ x: Number(d.fig.dataset.gx), y: Number(d.fig.dataset.gy), h: Number(d.fig.dataset.gh) || 30 })).filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  if (stageAt.length > 1) {
    const x0 = Math.min(...stageAt.map((p) => p.x - p.h * 0.9));
    const x1 = Math.max(...stageAt.map((p) => p.x + p.h * 0.9));
    const y0 = Math.min(...stageAt.map((p) => p.y));
    const y1 = Math.max(...stageAt.map((p) => p.y));
    const floor = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    floor.setAttribute('class', 'sp-dance-stage');
    floor.setAttribute('cx', ((x0 + x1) / 2).toFixed(1));
    floor.setAttribute('cy', ((y0 + y1) / 2 + 2).toFixed(1));
    floor.setAttribute('rx', ((x1 - x0) / 2 + 8).toFixed(1));
    floor.setAttribute('ry', Math.max(9, (y1 - y0) / 2 + 9).toFixed(1));
    floor.setAttribute('fill', 'url(#sp-dance-stage)');
    floor.setAttribute('aria-hidden', 'true');
    // Under everyone: before whichever dancer comes first in the drawing.
    const firstFig = dancers.map((d) => d.fig).find((f) => f.parentNode);
    firstFig?.parentNode?.insertBefore(floor, firstFig.parentNode.querySelector('.sanctuary__pet') ?? firstFig);
    overlays.push(floor);
    // The Friendship Circle (D48 PR E): a ring of little hearts on the ground round everyone.
    if (preset === 'circle') {
      const cx = (x0 + x1) / 2;
      const cy = (y0 + y1) / 2 + 2;
      const rx = (x1 - x0) / 2 + 12;
      const ry = Math.max(11, (y1 - y0) / 2 + 11);
      const n = Math.max(10, Math.min(22, Math.round(rx / 6)));
      const hearts = Array.from({ length: n }, (_, i) => {
        const a = (i / n) * Math.PI * 2;
        return `<path style="animation-delay:${Math.round((i / n) * 600)}ms" d="${heartPath(cx + Math.cos(a) * rx, cy + Math.sin(a) * ry, 2.4)}" fill="${i % 2 ? '#F28BA0' : '#E8556A'}"/>`;
      }).join('');
      floor.insertAdjacentHTML('afterend', `<g class="sp-dance-ring${o.reducedMotion ? ' is-still' : ''}" aria-hidden="true">${hearts}</g>`);
      overlays.push(floor.nextElementSibling!);
    }
  }
  // The dance floor (D44 PR G): a soft pool of light on the ground under each dancer, for the dance's length.
  for (const d of dancers) {
    const x = Number(d.fig.dataset.gx);
    const y = Number(d.fig.dataset.gy);
    const h = Number(d.fig.dataset.gh) || 30;
    if (!Number.isFinite(x) || !Number.isFinite(y)) continue;
    const pool = document.createElementNS('http://www.w3.org/2000/svg', 'ellipse');
    pool.setAttribute('class', 'sp-dance-light');
    pool.setAttribute('cx', String(x));
    pool.setAttribute('cy', String(y + 0.5));
    pool.setAttribute('rx', (h * 0.75).toFixed(1));
    pool.setAttribute('ry', (h * 0.2).toFixed(1));
    pool.setAttribute('fill', 'url(#sp-dance-light)');
    pool.setAttribute('aria-hidden', 'true');
    d.fig.parentNode?.insertBefore(pool, d.fig);
    overlays.push(pool);
  }
  if (dancers.length && !svg.querySelector('#sp-dance-light'))
    svg.insertAdjacentHTML(
      'afterbegin',
      `<defs><radialGradient id="sp-dance-stage"><stop offset="0" stop-color="#fff6cf" stop-opacity="0.8"/><stop offset="0.65" stop-color="#ffe08a" stop-opacity="0.42"/><stop offset="1" stop-color="#ffd978" stop-opacity="0"/></radialGradient><radialGradient id="sp-dance-light"><stop offset="0" stop-color="#fff4c2" stop-opacity="0.85"/><stop offset="0.6" stop-color="#ffe08a" stop-opacity="0.35"/><stop offset="1" stop-color="#ffe08a" stop-opacity="0"/></radialGradient></defs>`,
    );

  for (const d of dancers) {
    const f = d.fig;
    f.dataset.trick = d.id;
    f.style.setProperty('--beat', `${beat}ms`);
    f.style.setProperty('--side', d.spec.side === 'R' ? '1' : '-1');
    f.classList.add('is-dancing');
    if (d.spec.preset) f.classList.add(`is-dance-${d.spec.preset}`);
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
    // The lights come up for the final pose.
    for (const n of overlays) n.classList.add('is-finale');
    if (!in3d()) overlays.push(...confettiOverlay(svg, dancers, o.reducedMotion, preset));
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

/**
 * The finish over the dancers, for drawn scenes (the 3D stage throws its own): confetti and stars for the Boogie,
 * petals for the Meadow Hop, a shower of stars for the Sparkle Surprise, hearts rising for the Friendship Circle.
 */
function confettiOverlay(svg: SVGSVGElement, dancers: Dancer[], still: boolean, preset?: DancePreset): Element[] {
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
    const at = `style="animation-delay:${delay}ms"`;
    if (preset === 'meadowhop')
      bits.push(
        i % 4 === 0
          ? `<g class="sp-confetti sp-confetti--flower" ${at}>${[0, 72, 144, 216, 288].map((a) => `<circle cx="${(x + Math.cos((a * Math.PI) / 180) * 1.6).toFixed(1)}" cy="${(y + Math.sin((a * Math.PI) / 180) * 1.6).toFixed(1)}" r="1.2" fill="${i % 8 ? '#FFFFFF' : '#F6A6C8'}"/>`).join('')}<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="0.9" fill="#F2C230"/></g>`
          : `<ellipse class="sp-confetti sp-confetti--petal" ${at} cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" rx="1.8" ry="1" fill="${['#F6A6C8', '#FFFFFF', '#FFE08A', '#F9C5D9'][i % 4]}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
      );
    else if (preset === 'sparkle')
      bits.push(`<path class="sp-confetti sp-confetti--star" ${at} d="${star(x, y, 2.2 + (i % 3))}" fill="${['#F7C534', '#FFF3B0', '#F4A6D0', '#9FE0E6'][i % 4]}"/>`);
    else if (preset === 'circle') {
      if (i % 2) continue;
      bits.push(`<path class="sp-confetti sp-confetti--heart" ${at} d="${heartPath(x, y + 18, 2.6 + (i % 3) * 0.6)}" fill="${i % 4 ? '#F28BA0' : '#E8556A'}"/>`);
    } else
      bits.push(
        i % 5 === 0
          ? `<path class="sp-confetti sp-confetti--star" ${at} d="${star(x, y, 3.2)}" fill="#F7C534"/>`
          : `<rect class="sp-confetti" ${at} x="${(x - 1.6).toFixed(1)}" y="${(y - 1).toFixed(1)}" width="3.2" height="2" rx="0.4" fill="${col}" transform="rotate(${rot} ${x.toFixed(1)} ${y.toFixed(1)})"/>`,
      );
  }
  svg.insertAdjacentHTML('beforeend', `<g class="sp-dance-confetti${preset ? ` sp-dance-confetti--${preset}` : ''}${still ? ' is-still' : ''}" aria-hidden="true">${bits.join('')}</g>`);
  return [svg.lastElementChild!];
}

/** A small heart centred on (x, y), `r` across half its width. */
function heartPath(x: number, y: number, r: number): string {
  const f = (n: number) => n.toFixed(1);
  return `M${f(x)} ${f(y + r)} C${f(x - r * 1.6)} ${f(y)} ${f(x - r * 0.9)} ${f(y - r * 1.1)} ${f(x)} ${f(y - r * 0.35)} C${f(x + r * 0.9)} ${f(y - r * 1.1)} ${f(x + r * 1.6)} ${f(y)} ${f(x)} ${f(y + r)} Z`;
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
