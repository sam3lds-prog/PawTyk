/**
 * A meal, played out in the scene (D48 PR B). Before, feeding took a portion from the pantry and said so in a toast.
 * Now the player picks a food on the animal's card and watches it eaten:
 *
 *  1. The card closes and the camera moves gently closer (the scene director's `feed` moment owns it).
 *  2. A bowl (the player's own: wooden, patchwork, flower or golden) appears beside the animal, toward the middle of
 *     the scene, with the food heaped in it.
 *  3. The animal notices it, steps up, and takes three bites (the heap goes down with each, a little munch each time).
 *  4. It reacts (a happier, bigger reaction for a favorite), hearts rise, and a small card under the scene shows the
 *     friendship bar moving by what the meal gave.
 *  5. The bowl goes, the camera comes back, and life carries on.
 *
 * The same moment drives the 3D toy (the figure's `data-trick="feed"`, played by `three/clips.ts`). About 3.6 s; a
 * tap on the scene, the player starting anything else, or leaving ends it at once. Under reduced motion the camera and
 * the animal stay still: the bowl, the hearts and the card show, then go.
 *
 * Nothing is decided here: the meal has already been counted (`meta/feeding.ts`) when this starts.
 *
 * D49 PR C, smart feeding: that full meal is for the moments that mean something (`meta/feeding.ts::mealStyle`): an
 * animal's first meal, its first taste of a favorite, a meal that lifts the friendship a level, or always with
 * Settings → Meals → Full. An ordinary repeat meal is **quick** (about 1.1 s): no camera move, the bowl, one bite,
 * hearts and the card; the toy plays its short `nibble`. A meal that reaches a new friendship level ends with the
 * animal beaming in a ring of hearts, and the card says the level. A feast is one short scene for the whole home.
 */

import { app } from '../../app/app';
import type { BowlId, FoodId } from '../../meta/catalogs/foods';
import { friendship, mealStyle } from '../../meta/feeding';
import { sfx } from '../../services/audio';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { bowlArt } from '../art/foods';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { SceneCamera } from './camera';

/** How long a meal takes, start to finish (the 3D clip `feed` is the same length). */
export const FEED_MS = 3600;
/** Under reduced motion: the bowl and the hearts, still, this long. */
export const FEED_STILL_MS = 2400;
/** When the three bites land (ms from the start). */
export const BITE_AT = [1250, 1750, 2250] as const;
/** When the animal reacts (hearts, its hello). */
const REACT_AT = 2650;
/** D49 PR C: a quick meal, start to finish (the 3D clip `nibble` is the same length), its one bite and its reaction. */
export const QUICK_FEED_MS = 1100;
const QUICK_BITE_AT = 320;
const QUICK_REACT_AT = 560;
/** Under reduced motion, a quick meal's bowl and hearts stay this long. */
export const QUICK_STILL_MS = 900;

export interface FeedingOptions {
  svg: SVGSVGElement;
  /** The scene's figure (`.sanctuary__scene`): the friendship card sits there. */
  host: HTMLElement;
  camera: SceneCamera | null;
  animal: string;
  name: string;
  food: FoodId;
  bowl: BowlId;
  favorite: boolean;
  /** Affection before and after the meal (for the friendship bar). */
  before: number;
  after: number;
  reducedMotion: boolean;
  /** The animal's hello (its temperament's sound), at the reaction. */
  hello?: () => void;
  /** A feast's other guests: they eat too, but without a card or sounds of their own (the first guest has them). */
  quiet?: boolean;
  /** The card's line instead of "<name> loved it" (a feast: who it fed). */
  line?: string;
  /** D49 PR C: 'quick' for an ordinary repeat meal (about a second); 'full' (the default) for one that means something. */
  style?: import('../../meta/feeding').MealStyle;
}

export interface FeedingHandle {
  /** Settles when the meal is over or was stopped. True if it played to the end. */
  readonly done: Promise<boolean>;
  stop(): void;
  readonly active: boolean;
}

const figureOf = (svg: SVGSVGElement, id: string) =>
  svg.querySelector<SVGGElement>(`.sanctuary__pet[data-pet="${CSS.escape(id)}"], .sanctuary__friend[data-friend="${CSS.escape(id)}"]`);

/** Where the bowl goes: beside the animal, toward the middle of the scene (so it stays in the picture). */
export function bowlSpot(gx: number, gy: number, gh: number, sceneWidth: number): { x: number; y: number; dir: 1 | -1; size: number } {
  const dir: 1 | -1 = gx > sceneWidth / 2 ? -1 : 1;
  return { x: gx + dir * gh * 0.72, y: gy + 0.5, dir, size: Math.max(9, gh * 0.5) };
}

/** The friendship bar's fill (0–100) for an affection, within its level. */
export function friendshipPct(aff: number): number {
  const f = friendship(aff);
  return f.next === null ? 100 : Math.round(((aff - f.from) / (f.next - f.from)) * 100);
}

/** Whether an animal in the scene can eat now (not mid-trick, not away on a decoration). */
export function canFeedInScene(svg: SVGSVGElement | null, id: string): boolean {
  const fig = svg ? figureOf(svg, id) : null;
  return !!fig && !fig.dataset.trick && !fig.classList.contains('is-away');
}

export function playFeeding(o: FeedingOptions): FeedingHandle {
  let resolve!: (v: boolean) => void;
  const done = new Promise<boolean>((r) => (resolve = r));
  const fig = figureOf(o.svg, o.animal);
  if (!fig || fig.dataset.trick || fig.classList.contains('is-away')) {
    resolve(false);
    return { done, stop: () => {}, active: false };
  }
  const gx = Number(fig.dataset.gx);
  const gy = Number(fig.dataset.gy);
  const gh = Number(fig.dataset.gh) || 30;
  const width = Number((o.svg.getAttribute('data-vb') ?? '').split(/\s+/)[2]) || o.svg.viewBox?.baseVal?.width || 360;
  const spot = bowlSpot(gx, gy, gh, width);
  const still = o.reducedMotion;
  const quick = o.style === 'quick';
  const timers: ReturnType<typeof setTimeout>[] = [];
  const at = (ms: number, fn: () => void) => timers.push(setTimeout(fn, ms));
  let over = false;

  // The bowl, on the ground beside the animal, in front of it (so the heap is seen going down).
  const k = spot.size / 24;
  fig.insertAdjacentHTML(
    'afterend',
    `<g class="sp-feed${still ? ' is-still' : ''}" aria-hidden="true" data-feed-bowl="${esc(o.animal)}" transform="translate(${(spot.x - 12 * k).toFixed(1)} ${(spot.y - 21 * k).toFixed(1)}) scale(${k.toFixed(3)})">${bowlArt(o.bowl, o.food)}</g>`,
  );
  const bowlEl = fig.nextElementSibling as SVGGElement | null;
  // Hearts over its head, rising after the last bite (a favorite gets more).
  const n = o.favorite ? 4 : 2;
  const top = gy - gh * 1.05;
  const hearts = Array.from({ length: n }, (_, i) => {
    const x = gx + (i - (n - 1) / 2) * gh * 0.28;
    return `<path class="sp-feed-heart" style="animation-delay:${i * 120}ms" d="M${x.toFixed(1)} ${(top + 3).toFixed(1)} c-3 -2 -4.5 -3.5 -4.5 -5.2 c0 -1.3 1 -2.3 2.3 -2.3 c1 0 1.7 .6 2.2 1.3 c.5 -.7 1.2 -1.3 2.2 -1.3 c1.3 0 2.3 1 2.3 2.3 c0 1.7 -1.5 3.2 -4.5 5.2 z" fill="${i % 2 ? '#F28BA0' : '#E8556A'}"/>`;
  }).join('');
  o.svg.insertAdjacentHTML('beforeend', `<g class="sp-feed-hearts${still ? ' is-still' : ''}" aria-hidden="true">${hearts}</g>`);
  const heartsEl = o.svg.lastElementChild;

  // The animal eats: the same protocol as a trick, so the 3D toy plays its `feed` clip (a quick meal: `nibble`).
  fig.dataset.trick = quick ? 'nibble' : 'feed';
  fig.style.setProperty('--feed-dx', `${(spot.dir * gh * 0.2).toFixed(1)}px`);
  fig.style.setProperty('--trick-dir', String(spot.dir));
  if (!still) fig.classList.add(quick ? 'is-trick-nibble' : 'is-trick-feed');
  fig.classList.add('is-eating');
  if (quick) bowlEl?.classList.add('is-quick');
  if (quick) heartsEl?.classList.add('is-quick');

  // The friendship card: the bar moves by what the meal gave.
  const card = document.createElement('div');
  card.className = 'feed-bond';
  card.setAttribute('role', 'status');
  const gained = Math.max(0, o.after - o.before);
  const level = friendship(o.after);
  // A level reached fills the old bar first, then starts the new one (D49 PR C: and the card names the new level).
  const levelled = friendship(o.before).level !== level.level;
  card.innerHTML = `<span class="feed-bond__name">${ICON.heart}${o.line ? `<b>${esc(o.line)}</b>` : `<b>${esc(o.name)}</b> ${o.favorite ? 'loved it' : 'enjoyed it'}${gained ? ` <span class="num">+${gained}</span>` : ''}`}</span>
    ${o.line ? '' : `<span class="rank-bar feed-bond__bar" aria-hidden="true"><span style="width:${friendshipPct(o.before)}%"></span></span><small>${levelled ? `${ICON.sparkle}<b class="feed-bond__level">${esc(level.name)}!</b>` : esc(level.name)}</small>`}`;
  if (quick) card.classList.add('is-quick');
  if (levelled) card.classList.add('is-level');
  if (!o.quiet) o.host.appendChild(card);
  const fill = card.querySelector<HTMLElement>('.feed-bond__bar span');
  const sound = (fn: () => void) => !o.quiet && fn();

  const cam = still || quick ? null : o.camera;
  if (cam) void cam.focus(fig, 1.75, 520, { dy: -3 });

  /** D49 PR C: a new friendship level: the animal beams in a ring of hearts as it reacts. */
  const celebrateLevel = () => {
    if (!levelled || o.quiet) return;
    fig.classList.add('is-bond-up');
    heartsEl?.classList.add('is-level');
    sound(() => feel('line'));
  };
  if (still) {
    if (fill) fill.style.width = `${levelled ? 100 : friendshipPct(o.after)}%`;
    sound(() => feel('treat'));
    if (levelled) heartsEl?.classList.add('is-level');
    at(quick ? QUICK_STILL_MS : FEED_STILL_MS, () => finish(true));
  } else if (quick) {
    at(QUICK_BITE_AT, () => {
      bowlEl?.querySelector('.sp-feed-food')?.setAttribute('data-bites', '3');
      sound(() => feel('treat'));
    });
    at(QUICK_REACT_AT, () => {
      heartsEl?.classList.add('is-on');
      sound(() => o.hello?.());
      if (fill) fill.style.width = `${levelled ? 100 : friendshipPct(o.after)}%`;
      celebrateLevel();
    });
    at(QUICK_FEED_MS, () => finish(true));
  } else {
    BITE_AT.forEach((ms, i) =>
      at(ms, () => {
        bowlEl?.querySelector('.sp-feed-food')?.setAttribute('data-bites', String(i + 1));
        sound(() => (i === 0 ? feel('treat') : sfx('treat')));
      }),
    );
    at(REACT_AT, () => {
      heartsEl?.classList.add('is-on');
      sound(() => o.hello?.());
      if (fill) fill.style.width = `${levelled ? 100 : friendshipPct(o.after)}%`;
      celebrateLevel();
    });
    if (levelled) at(REACT_AT + 500, () => fill && (fill.style.transition = 'none', (fill.style.width = '0%'), void fill.offsetWidth, (fill.style.transition = ''), (fill.style.width = `${friendshipPct(o.after)}%`)));
    at(FEED_MS, () => finish(true));
  }

  function finish(natural: boolean): void {
    if (over) return;
    over = true;
    for (const t of timers) clearTimeout(t);
    bowlEl?.remove();
    heartsEl?.remove();
    if (fig) {
      if (fig.dataset.trick === 'feed' || fig.dataset.trick === 'nibble') delete fig.dataset.trick;
      fig.classList.remove('is-trick-feed', 'is-trick-nibble', 'is-eating', 'is-bond-up');
      fig.style.removeProperty('--feed-dx');
      fig.style.removeProperty('--trick-dir');
    }
    // The card stays a moment after a meal that played out, so the bar can be read (a new level a little longer).
    if (natural) setTimeout(() => card.remove(), levelled ? 1600 : quick ? 700 : 900);
    else card.remove();
    if (cam) void cam.reset(natural ? 600 : 300);
    resolve(natural);
  }

  return {
    done,
    stop: () => finish(false),
    get active() {
      return !over;
    },
  };
}

// ------------------------------------------------------------------ meals on a home's screen

/** What a home's screen gives the meals played in its scene. */
export interface SceneMealsHost {
  /** The screen's root: its scene figure is found inside. */
  el: HTMLElement;
  camera: SceneCamera | null;
  director: import('./sceneDirector').SceneDirector;
  reducedMotion: () => boolean;
  /** An animal's reaction in the scene (after a pat, or a meal that couldn't be shown). */
  react: (animal: string, action: 'greet' | 'love') => void;
  /** After a meal: its friendship news (a level reached), once the scene is free again. */
  afterHearts: (animal: string, before: number) => void;
  /** The animal's hello. */
  hello: (animal: string) => void;
  /** Re-reads the bowl in use. */
  bowl: () => BowlId;
}

export interface SceneMeals {
  /** The card's feed events for an animal, wired to this scene. */
  events(animal: string, name: string): import('./feedPanel').FeedEvents;
  /**
   * D49 PR A: plays a meal already counted (a newcomer's welcome snack), with no card in between. Null if the scene
   * can't show it (the animal is busy or not drawn); else settles when it has been eaten (true) or was stopped.
   */
  feed(m: import('./feedPanel').Meal): Promise<boolean> | null;
  readonly active: boolean;
  stop(): void;
}

/** How long apart a feast's guests start eating (a ripple across the home, not all at once; D49 PR C: quicker). */
export const FEAST_STAGGER_MS = 90;

/**
 * Meals on a home's screen (D48 PR B): the director's `feed` moment. A meal claims the camera (a tour, a close-up or
 * a parade ends first) and holds the scene's ambient life still while it plays; anything the player starts ends it.
 */
export function sceneMeals(scope: { onDispose(fn: () => void): void; timeout(fn: () => void, ms: number): void; readonly alive: boolean }, h: SceneMealsHost): SceneMeals {
  let running: FeedingHandle[] = [];
  const stop = () => {
    const now = running;
    running = [];
    for (const r of now) r.stop();
  };
  h.director.register('feed', { cancel: stop, active: () => running.some((r) => r.active) });
  /** D49 PR C: full for a first meal, a first taste of a favorite or a new friendship level; quick otherwise. */
  const styleOf = (m: import('./feedPanel').Meal) =>
    mealStyle(app.settings.meals, { firstMeal: m.firstMeal ?? true, firstTaste: m.firstTaste ?? true, favorite: m.favorite, levelUp: friendship(m.before).level !== friendship(m.after).level });
  scope.onDispose(stop);
  const scene = () => ({ host: h.el.querySelector<HTMLElement>('.sanctuary__scene'), svg: h.el.querySelector<SVGSVGElement>('.sanctuary__scene svg') });

  /** Plays meals (one, or a feast's), then gives the scene back. */
  function play(meals: Array<Omit<FeedingOptions, 'svg' | 'host' | 'camera' | 'reducedMotion' | 'bowl'>>, closeUp: boolean): Promise<boolean> | null {
    // An animal moment never stands in the way of the player's meal: it ends before the check (D49 PR C).
    h.director.end('moment');
    const { host, svg } = scene();
    if (!host || !svg || !meals.some((m) => canFeedInScene(svg, m.animal))) return null;
    h.director.claim('feed');
    h.director.hold('feed', true);
    track('meal_played', { style: meals[0].style ?? 'full', feast: meals.length > 1 || !!meals[0].line });
    const handles = meals.map((m, i) => {
      const go = () =>
        playFeeding({
          ...m,
          svg,
          host,
          camera: closeUp ? h.camera : null,
          reducedMotion: h.reducedMotion(),
          bowl: h.bowl(),
          hello: () => h.hello(m.animal),
        });
      if (i === 0) return go();
      // The others start a beat apart (a feast's ripple); each is its own meal with its own bowl.
      let inner: FeedingHandle | null = null;
      let stopped = false;
      const done = new Promise<boolean>((res) =>
        scope.timeout(() => {
          if (stopped || !scope.alive) return res(false);
          inner = go();
          void inner.done.then(res);
        }, i * FEAST_STAGGER_MS),
      );
      return {
        done,
        stop: () => {
          stopped = true;
          inner?.stop();
        },
        get active() {
          return !stopped && (!inner || inner.active);
        },
      } as FeedingHandle;
    });
    // Only one card under the scene for a feast: the first guest's (the others' would stack on it).
    running = handles;
    return Promise.all(handles.map((x) => x.done)).then((ends) => {
      if (running === handles) running = [];
      h.director.hold('feed', false);
      if (scope.alive) for (const m of meals) h.afterHearts(m.animal, m.before);
      return ends[0] ?? false;
    });
  }

  return {
    events(animal, name) {
      let fedOffstage = false;
      let patted = false;
      return {
        onPat: () => (patted = true),
        meal: (m) => {
          const ok = !!play([{ animal: m.animal, name: m.name, food: m.food, favorite: m.favorite, before: m.before, after: m.after, style: styleOf(m) }], true);
          if (!ok) fedOffstage = true;
          return ok;
        },
        feast: (f) => {
          const total = f.fed.reduce((n, x) => n + x.gained, 0);
          return !!play(
            f.fed.map((x, i) => ({
              animal: x.animal,
              name: x.animal,
              food: f.food,
              favorite: true,
              before: x.before,
              after: x.before + x.gained,
              quiet: i > 0,
              line: i === 0 ? `A feast for ${f.fed.length === 1 ? 'one' : `all ${f.fed.length}`}: +${total} ♥` : undefined,
              // D49 PR C: one short group scene (in full only with Settings → Meals → Full).
              style: app.settings.meals === 'full' ? ('full' as const) : ('quick' as const),
            })),
            false,
          );
        },
        // A pat (or a meal the scene couldn't show) is answered in the scene once the card is out of the way.
        onClose: () => {
          if (fedOffstage || patted) scope.timeout(() => h.react(animal, fedOffstage ? 'greet' : 'love'), 220);
          void name;
        },
      };
    },
    feed: (m) => play([{ animal: m.animal, name: m.name, food: m.food, favorite: m.favorite, before: m.before, after: m.after, style: styleOf(m) }], true),
    get active() {
      return running.some((r) => r.active);
    },
    stop,
  };
}
