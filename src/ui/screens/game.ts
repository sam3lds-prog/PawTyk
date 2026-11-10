/**
 * The play screen: top bar, the board (hero), one coach line, and the controls (D37). One gesture does both jobs:
 *  - 'tap' (default): a tap marks a tile ✕ (a finger drag marks a run); a double tap places the animal. On two-animal
 *    boards the two animal buttons below the board pick which one a double tap places; there is no separate ✕ button.
 *    A wrong animal costs a heart and leaves a mistake mark on the tile (red ✕, or the struck animal on a two-animal
 *    board). Erase takes back ✕ marks only: placed animals and mistakes stay.
 *  - 'classic' ("Two-step tap"): no timing at all (for VoiceOver and Switch Control): a tap marks ✕, a second tap places.
 *    An activation that arrives without a pointer (a screen reader's double-tap, a switch) is always two-step, under
 *    either scheme (D38), so assistive tech never has to beat a 380 ms window.
 * After the first placement on an ordinary board, one line explains the controls once and points at Settings (D38).
 * Hint shows how many hints you have. Dots on tiles no animal can reach appear on Easy boards only.
 * The board shows the animal you're bringing home to the sanctuary the board is for (meta/cast.ts).
 */

import { app } from '../../app/app';
import { playMode, restartGame } from '../../app/gameFlow';
import { CAT, DOG, type Species } from '../../engine/types';
import { fmtClock } from '../../game/dates';
import { CUP_HEARTS, modeKey, nextAfterWin, rulesFor, type ModeRef } from '../../game/modes';
import { ITEM_CAP, itemBalance, pawPoints, rankFor, useItem } from '../../meta/items';
import { modeShortTitle, modeTitle, type SpecVersion } from '../../game/puzzles';
import { difficultyReason, profileOf } from '../../game/grading';
import { MARK, type HintInfo, type MoveResult, type Session, type Tool, type UnitRef } from '../../game/session';
import { recordLoss, recordWin, type WinRecord } from '../../meta/progression';
import { rewardsForWin, type RewardSummary } from '../../meta/rewards';
import { finishAttempt } from '../../competitions/localCup';
import type { ScoreBreakdown } from '../../competitions/scoring';
import { afterSolve, type MetaNews } from '../../app/events';
import { DECOR_BY_ID } from '../../meta/catalogs/decor';
import { sanctuaryDef, isRegionId, type RegionId, type SanctuaryId } from '../../meta/catalogs/sanctuaries';
import { showFirstArrival } from '../components/arrival';
import { isPlaceId } from '../../meta/catalogs/places';
import { activeSanctuary, alreadyGrown, arrivalProgress, countsForGrowth, creditSolve, isMilestone, nextStage, nextToOpen, openRegions, stageOf, type GrowthNews } from '../../meta/world';
import { regionThumb } from '../art/regions';
import { animalInfo, withArticle, type AnimalId } from '../../meta/animals';
import { TEMPERAMENT_INFO, temperamentOf } from '../../meta/temperament';
import { castFor, castWord, type Cast } from '../../meta/cast';
import { queueSolve, syncLeaderboard } from '../../app/leaderboardSync';
import { decorIcon } from '../art/sanctuary';
import { ads, INTERSTITIALS_ENABLED, shouldShowInterstitial } from '../../services/ads';
import { canOfferVideo, watchVideoFor, type WatchResult } from '../../app/rewarded';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { speciesKey } from '../art/pets';
import { animalElement, animalPortrait, animalSvg, applyAnimalFace } from '../art/animals';
import { FaceDirector, lookToward, type Clock } from '../animation/faceDirector';
import type { ReactionMood } from '../animation/faceMachine';
import { isPairLesson, isTutorial, levelTip, TUTORIAL_STEPS } from '../../meta/onboarding';
import { EMPTY } from '../../engine/types';
import { Board, type ErrorMark } from '../components/board';
import { openSheet, toast, type SheetHandle } from '../components/sheet';
import { actionOf, capitalize, esc, h, plural, qs } from '../dom';
import { ICON } from '../icons';
import type { Scope, ScreenDef } from '../router';
import { showRules } from './rules';
import { showSettings } from './settings';

const MISS_MS = 700;
/** Two taps on the same tile within this long are a double tap (place the animal). */
export const DOUBLE_TAP_MS = 380;
/**
 * A second tap on the same ✕ that comes after the double-tap window but within this, and so only clears the ✕, was
 * most likely a double tap that came a little slowly (D40): after two of them, two-step tap is offered, once.
 */
export const SLOW_DOUBLE_MS = 900;

/** The board frame's rim on each side and the room its nameplate takes above it (D41), in px; styles/board.css matches. */
const FRAME_PAD = 9;
const PLATE_ROOM = 15;

/** In-memory ad cadence (resets each launch, which only makes ads rarer). */
const cadence = { boardsSinceLast: 0, lastShownAt: null as number | null, shownToday: 0, day: '' };

/** The board's "helps the …" chip: a region's short name; a place's first word (*Marula*), its full name in the label. */
function chipName(id: SanctuaryId): string {
  const d = sanctuaryDef(id);
  return isPlaceId(id) ? d.name.split(' ')[0] : d.short;
}

export const gameScreen: ScreenDef = {
  tab: null,
  title: 'Play',
  mount(root, scope) {
    const active = app.active;
    if (!active) {
      app.router.back({ screen: 'journey' });
      return;
    }
    mountGame(root, scope, active.mode, active.session, active.spec, active.cast ?? castFor(app.save, active.session.rule, active.session.puzzle.seed), active.boardId);
  },
};

function mountGame(root: HTMLElement, scope: Scope, mode: ModeRef, s: Session, spec: SpecVersion = 1, cast: Cast, boardId?: string): void {
  const tutorial = isTutorial(mode, app.save);
  // The first two-animal board (level 21) is guided too, but keeps its hearts.
  const pairLesson = !tutorial && isPairLesson(mode, app.save);
  const guided = tutorial || pairLesson;
  // Hearts follow the session (the guided first board has none to lose).
  const rules = { ...rulesFor(mode), hearts: s.heartsEnabled };
  const n = s.size;
  const total = s.total;
  const solo = s.rule === 'solo';
  /** The animal a board species shows, and the word coaching uses for it ("sheep", or a name when both are one kind). */
  const animalOf = (sp: Species): AnimalId => (sp === DOG && cast.b ? cast.b : cast.a);
  const wordOf = (sp: Species) => castWord(cast, sp === DOG ? 'b' : 'a');
  const aWord = (sp: Species) => withArticle(wordOf(sp));
  // The label comes from measuring this exact board, never from what the level or day asked for.
  const profile = profileOf(s.puzzle);
  const tierName = capitalize(profile.tier);
  const settings = app.settings;
  const scheme = settings.controls;
  const classic = scheme === 'classic';
  // Which animal a double tap (or the tap cycle) places: always the one animal on a one-animal board; on two-animal
  // boards the one the player picked last.
  let tool: Tool = solo ? 'cat' : settings.lastSpecies;
  /** Erase is a mode: while it's on, taps take ✕ marks back (never animals or mistakes). */
  let erasing = false;
  /** Dots on tiles no animal can reach: a help for Easy boards only (D37); harder boards are the player's to mark. */
  const showDots = settings.autoMark && profile.tier === 'easy';
  let lastTap: { r: number; c: number; t: number; marked: boolean } | null = null;
  let slowDoubles = 0;
  let hint: { info: HintInfo; tier: 1 | 2 } | null = null;
  let finished = false;
  let sheet: SheetHandle | null = null;
  let lastPlaced: AnimalId | null = null;
  /** Tutorial: the placement the coach is pointing at. */
  let guide: { step: number; r: number; c: number; species: Species; unit: UnitRef | null; text: string } | null = null;
  let winPet: AnimalId | null = null;
  // Zen and the guided first board never charge for hints. Extra lives work on casual boards with hearts (not Paw Cup).
  const freeHints = mode.kind === 'zen' || guided;
  const pantryOn = rules.revive && rules.hearts && !tutorial;
  const tickets = () => itemBalance(app.save, 'hint');
  const lives = () => itemBalance(app.save, 'life');

  /**
   * D41: the board sits in a frame of the home it grows — its color, a nameplate with the home and what this board
   * brings closer (*Meadow Farm · Truffle in 3*). A Paw Cup board has a plain frame. A replay names the home only.
   */
  const home = mode.kind === 'cup' ? null : cast.sanctuary;
  const homeDef = home ? sanctuaryDef(home) : null;
  const grows = !!home && !alreadyGrown(app.save, modeKey(mode));
  const plateGoal = ((): { short: string; long: string } | null => {
    if (!home || !grows) return null;
    const p = arrivalProgress(app.save, home);
    if (p) {
      const a = animalInfo(p.next.id as AnimalId);
      // This board is the one that brings them: say so.
      if (p.left <= 1) return { short: `brings ${a.name} home`, long: `Solving it brings ${a.name} the ${a.noun} home` };
      return { short: `${a.name} in ${p.left}`, long: `${a.name} the ${a.noun} comes home in ${plural(p.left, 'more puzzle')}` };
    }
    const st = nextStage(app.save, home);
    if (st) {
      const left = st.need - st.have;
      if (left <= 1) return { short: `brings ${st.stage.name.toLowerCase()}`, long: `Solving it brings the next stage, ${st.stage.name.toLowerCase()}` };
      return { short: `${st.stage.name} in ${left}`, long: `${st.stage.name} in ${plural(left, 'more puzzle')}` };
    }
    return null;
  })();
  // A replay grows nothing new, so its plate names the home only, and says so to a screen reader.
  const plateSays = homeDef ? (grows ? `This board helps the ${homeDef.name}${plateGoal ? `. ${plateGoal.long}` : ''}.` : `A ${homeDef.name} board, solved before.`) : '';
  const plate = homeDef
    ? `<span class="board-plate status-for" data-for="${home}" title="${esc(grows ? `This board helps the ${homeDef.name}, whatever you build next.` : plateSays)}"><span class="board-plate__show" aria-hidden="true">${ICON.sprout}<span class="status-for__name">${esc(chipName(home!))}</span>${plateGoal ? `<span class="board-plate__goal">${esc(plateGoal.short)}</span>` : ''}</span><span class="sr-only">${esc(plateSays)}</span></span>`
    : `<span class="board-plate board-plate--cup" aria-hidden="true">${ICON.trophy}<span>Paw Cup</span></span>`;

  /** Animals home on this board: a pip per animal on a one-animal board, a face and a count per animal on two. */
  function progressMarkup(): string {
    const one = (sp: Species, extra = '') =>
      `<span class="pcount${extra}" aria-hidden="true"><span class="pcount__face">${animalSvg(animalOf(sp))}</span><b class="num" data-count="${sp}">0</b><span class="pcount__of">/${n}</span></span>`;
    // A narrow phone shows a big one-animal board's count as a face and a number, like a two-animal board's.
    if (solo) return Array.from({ length: n }, () => `<i class="pip" aria-hidden="true"><span class="pip__face">${animalSvg(animalOf(CAT))}</span></i>`).join('') + one(CAT, ' pcount--solo');
    return one(CAT) + one(DOG);
  }

  const el = h(`
    <div class="game${guided ? ' is-guided' : ''}" data-mode="${mode.kind}">
      <header class="game-top">
        <button class="icon-btn" data-act="leave" aria-label="Leave board">${ICON.back}</button>
        <div class="game-title">
          <h1 data-autofocus aria-label="${esc(modeTitle(mode))}">${esc(modeShortTitle(mode))}</h1>
          <div class="game-sub"><span class="chip chip--board" title="${esc(`${tierName}: ${difficultyReason(profile)}`)}" aria-label="${esc(`${n} by ${n}, ${tierName}. ${difficultyReason(profile)}`)}">${n}×${n} · ${tierName}</span></div>
        </div>
        <div class="game-top__end">
          ${rules.hearts ? (pantryOn ? '<button class="hearts hearts--btn" data-hearts data-act="hearts"></button>' : '<div class="hearts" data-hearts role="img"></div>') : tutorial ? '<span class="chip chip--guide">Practice</span>' : `<span class="zen-mark" aria-label="No hearts in Zen">${ICON.leaf}</span>`}
          <button class="icon-btn" data-act="pause" aria-label="Pause">${ICON.pause}</button>
        </div>
      </header>
      <div class="board-zone" data-zone>
        <div class="board-stage" data-stage></div>
        <div class="board-foot" data-foot>
          <p class="coach" data-coach aria-live="polite"></p>
          <div class="game-status">
            <span class="status-left"><span data-progress class="progress-track${solo && n >= 7 ? ' is-many' : ''}" role="img">${progressMarkup()}</span><span class="status-board" aria-hidden="true">${n}×${n} · ${tierName}</span></span>
            ${rules.timer && settings.showTimer ? `<span class="game-timer num" data-timer aria-label="Time">${ICON.clock}<span>0:00</span></span>` : ''}
          </div>
        </div>
      </div>
      <div class="controls controls--${solo ? 'solo' : 'pair'} controls--${scheme}">
        ${solo ? '' : `<div class="tools" role="radiogroup" aria-label="Animal a ${classic ? 'second tap' : 'double tap'} places">${animalButton(CAT)}${animalButton(DOG)}</div>`}
        <button class="act act--erase" data-act="erase" aria-pressed="false">${ICON.erase}<span>Erase</span></button>
        <button class="act" data-act="hint" ${rules.hints ? '' : 'disabled aria-describedby="no-hints"'}>${rules.hints ? ICON.bulb : ICON.hint}<span data-hint-label>Hint</span>${rules.hints ? '<span class="act__badge" data-hint-badge></span>' : ''}</button>
      </div>
      ${rules.hints ? '' : '<p id="no-hints" class="sr-only">Hints are off in Paw Cup so every player has the same rules.</p>'}
    </div>`);
  root.appendChild(el);

  function animalButton(sp: Species): string {
    const word = wordOf(sp);
    const does = classic ? `a second tap places ${withArticle(word)}` : `a double tap places ${withArticle(word)}`;
    return `<button class="tool" role="radio" data-tool="${sp === CAT ? 'cat' : 'dog'}" aria-label="${esc(capitalize(word))}: ${esc(does)}"><span class="tool__art">${animalSvg(animalOf(sp))}</span><span class="tool__label">${esc(capitalize(word))}</span></button>`;
  }

  const stage = qs(el, '[data-stage]');
  const coachEl = qs(el, '[data-coach]');
  const progressEl = qs(el, '[data-progress]');
  const timerEl = el.querySelector('[data-timer] span') as HTMLElement | null;
  const heartsEl = el.querySelector('[data-hearts]') as HTMLElement | null;

  // ---------------------------------------------------------------- faces (facial-only animation)
  const tilePets = new Map<string, AnimalId>();
  const clock: Clock = { now: () => performance.now(), set: (fn, ms) => window.setTimeout(fn, ms), clear: (id) => clearTimeout(id) };
  const faces = new FaceDirector({ clock, seed: s.puzzle.seed, reducedMotion: app.reducedMotion, slowBlink: (k) => tilePets.get(k) === 'mochi' });
  scope.onDispose(() => faces.dispose());
  const keyOf = (r: number, c: number) => `${r},${c}`;

  const board = new Board(
    s.puzzle,
    scope,
    { onPress, onDrag, onKey },
    {
      pannable: settings.largeBoard,
      pet: (r, c, sp) => {
        const id = animalOf(sp);
        const { el, svg } = animalElement(id);
        tilePets.set(keyOf(r, c), id);
        faces.add(keyOf(r, c), speciesKey(sp), { apply: (v) => applyAnimalFace(svg, id, v) });
        return el;
      },
      onPetRemoved: (r, c) => {
        faces.remove(keyOf(r, c));
        tilePets.delete(keyOf(r, c));
      },
      petName: (r, c) => {
        const id = tilePets.get(keyOf(r, c));
        return id ? animalInfo(id).name : null;
      },
      speciesName: (sp) => wordOf(sp),
      triedArt: (sp) => animalSvg(animalOf(sp)),
    },
  );
  const frame = h(`<div class="board-frame${homeDef ? '' : ' board-frame--plain'}" data-frame style="--accent:${homeDef?.accent ?? 'var(--brand)'}">${plate}<i class="board-frame__post board-frame__post--tl"></i><i class="board-frame__post board-frame__post--tr"></i><i class="board-frame__post board-frame__post--bl"></i><i class="board-frame__post board-frame__post--br"></i></div>`);
  frame.appendChild(board.el);
  stage.appendChild(frame);

  const zone = qs(el, '[data-zone]');
  const foot = qs(el, '[data-foot]');
  // The zone takes the spare height; the board takes what's left after its coach line, so the two stay together. The
  // frame's rim and nameplate take their share first (D41).
  const refit = () => board.fitBox(stage, zone.clientWidth - 2 * FRAME_PAD, zone.clientHeight - foot.offsetHeight - 10 - 2 * FRAME_PAD - PLATE_ROOM);
  scope.frame(refit);
  const ro = new ResizeObserver(() => refit());
  ro.observe(zone);
  scope.onDispose(() => ro.disconnect());

  // ---------------------------------------------------------------- rendering

  /**
   * Mistake marks for the board (D37). One animal tried and wrong on a one-animal board, or both on a two-animal board,
   * means no animal lives there: a red ✕. One animal tried on a two-animal board only rules out that animal, so the
   * mark is that animal, struck through (a red ✕ there would wrongly say the tile is empty).
   */
  function errorView(): ErrorMark[][] {
    return s.cells.map((row, r) =>
      row.map((_, c) => {
        const tried = s.errorsAt(r, c);
        if (!tried.length) return 0;
        return solo || tried.length > 1 ? 'x' : tried[0];
      }),
    );
  }

  function paint(): void {
    board.render({ cells: s.cells, givenMask: s.givenMask, dead: showDots ? s.deadCells() : null, errors: errorView() });
    // D41: the animals home on this board, at a glance (a pip per animal, or a count per kind); the label says it in words.
    progressEl.setAttribute('aria-label', `${s.placedCount()} of ${total} ${total === 1 ? 'animal' : 'animals'} placed`);
    const regionsNeed = solo ? 1 : 2;
    const inRegion = new Map<number, number>();
    let cats = 0;
    let dogs = 0;
    for (let r = 0; r < n; r++)
      for (let c = 0; c < n; c++) {
        const v = s.cells[r][c];
        if (v !== CAT && v !== DOG) continue;
        if (v === CAT) cats++;
        else dogs++;
        const reg = s.puzzle.regions[r][c];
        inRegion.set(reg, (inRegion.get(reg) ?? 0) + 1);
      }
    if (solo) progressEl.querySelectorAll('.pip').forEach((p, i) => p.classList.toggle('is-on', i < cats));
    const ca = progressEl.querySelector(`[data-count="${CAT}"]`);
    const da = progressEl.querySelector(`[data-count="${DOG}"]`);
    if (ca) ca.textContent = String(cats);
    if (da) da.textContent = String(dogs);
    // Colors whose animals are all home settle, so the eye goes to the open ones.
    board.setSettled(new Set([...inRegion].filter(([, k]) => k >= regionsNeed).map(([reg]) => reg)));
    if (heartsEl) {
      heartsEl.dataset.max = String(s.maxHearts);
      heartsEl.innerHTML = Array.from({ length: s.maxHearts }, (_, i) => (i < s.hearts ? ICON.life : ICON.lifeOff)).join('');
      heartsEl.setAttribute(
        'aria-label',
        pantryOn ? `${plural(s.hearts, 'heart')} left. Extra lives: ${lives()}. Tap to use one.` : `${plural(s.hearts, 'heart')} left`,
      );
    }
    for (const b of el.querySelectorAll<HTMLButtonElement>('[data-tool]')) b.setAttribute('aria-checked', String(b.dataset.tool === tool && !erasing));
    const eb = el.querySelector('[data-act="erase"]') as HTMLButtonElement | null;
    if (eb) {
      eb.setAttribute('aria-pressed', String(erasing));
      eb.disabled = finished;
    }
    el.classList.toggle('is-erasing', erasing);
    const hintLabel = el.querySelector('[data-hint-label]');
    const badge = el.querySelector('[data-hint-badge]') as HTMLElement | null;
    if (badge && hintLabel) {
      // What the next tap costs: the board's first look is free; otherwise one hint per hint target. With no hint
      // open, ask what the next look would cost for the cell it would point at (it may already be paid for, or be the
      // free look's cell).
      let nextIsFree: boolean;
      if (hint) nextIsFree = s.hintCost(hint.info, (hint.tier + 1) as 2 | 3, freeHints) === 0;
      else if (s.freeNudgeAvailable) nextIsFree = true;
      else {
        const next = finished ? null : s.peekHint();
        nextIsFree = !!next && s.hintCost(next, 1, freeHints) === 0;
      }
      // Three steps, named for what they do: a look, the reason, the placement. A free first look says so.
      hintLabel.textContent = !hint ? (nextIsFree && !freeHints ? 'Free hint' : 'Hint') : hint.tier === 1 ? 'Explain' : 'Place it';
      // The badge is always the player's hints, so they can see what they've saved up (D37).
      badge.innerHTML = `<span class="num">${tickets()}</span>`;
      badge.classList.toggle('is-free', nextIsFree);
      badge.closest('button')!.setAttribute(
        'aria-label',
        `${hintLabel.textContent}, ${nextIsFree ? 'free this time' : 'uses one hint'}. You have ${plural(tickets(), 'hint')}.`,
      );
    }
    tick();
    syncGuide();
  }

  // ---------------------------------------------------------------- tutorial

  function startGuide(step: number): void {
    const info = step <= TUTORIAL_STEPS && !finished ? s.peekHint() : null;
    if (!info) {
      guide = null;
      board.setGuide(null);
      board.clearHint();
      coachGuide("That's the idea! Finish the board on your own. Hint is there if you need it.");
      track('onboarding_step', { step: 'tutorial_free_play' });
      return;
    }
    const word = wordOf(info.species);
    const name = animalInfo(animalOf(info.species)).name;
    // How the player places an animal under their controls.
    const tapIt = classic ? 'tap it twice (once marks ✕, again places)' : 'double-tap it';
    const tapGlow = classic ? 'Tap the glowing tile twice.' : 'Double-tap the glowing tile.';
    let text: string;
    if (solo)
      text =
        step === 1
          ? `One ${word} in every row, column and color, never touching, not even at corners. This color has a single tile, so ${name} goes there: ${tapIt}.`
          : `${friendlyReason(info.reason)} ${tapGlow}`;
    else
      text =
        step === 1
          ? `Now two animals: one ${wordOf(CAT)} and one ${wordOf(DOG)} in every row, column and color, never side by side. ${friendlyReason(info.reason)} ${tapGlow}`
          : `${friendlyReason(info.reason)} The ${word} button is picked for you: ${tapGlow.charAt(0).toLowerCase()}${tapGlow.slice(1)}`;
    guide = { step, r: info.r, c: info.c, species: info.species, unit: info.unit, text };
    tool = info.species === CAT ? 'cat' : 'dog';
    erasing = false;
    coachGuide(text);
    track('onboarding_step', { step: `${tutorial ? 'tutorial' : 'pair_lesson'}_${step}` });
  }

  function syncGuide(): void {
    if (!guide) return;
    if (s.cells[guide.r][guide.c] === guide.species) {
      const next = guide.step + 1;
      guide = null;
      board.setGuide(null);
      startGuide(next);
      if (guide) paint();
      return;
    }
    board.setGuide(s.cells[guide.r][guide.c] === EMPTY || s.cells[guide.r][guide.c] === MARK ? [guide.r, guide.c] : null);
    // The line whose logic forces the placement is softly lit, so the player sees why.
    if (!hint) board.setHint(guide.unit ? s.unitCells(guide.unit) : [], null);
  }

  function coachGuide(text: string): void {
    coach(text);
    coachEl.classList.add('is-guide');
  }

  function tick(): void {
    if (timerEl) timerEl.textContent = fmtClock(s.elapsedSeconds());
  }

  /** Pauses the clock and the pets' ambient life (blinks, dozing). */
  /**
   * Pauses the clock and the pets' ambient life (blinks, dozing). In Paw Cup the board is also hidden whenever the
   * clock is stopped (pause, rules, settings), so paused time can't be used to think.
   */
  function pauseBoard(): void {
    s.pause();
    faces.setAmbient(false);
    if (mode.kind === 'cup' && !finished && !board.el.querySelector('.board-veil')) {
      board.el.appendChild(h('<div class="board-veil">Board hidden while paused</div>'));
      el.classList.add('is-paused');
    }
  }

  function unveil(): void {
    board.el.querySelector('.board-veil')?.remove();
    el.classList.remove('is-paused');
  }

  /** Placed pets of a unit (at most `max`), for proud / focused reactions. */
  function petsIn(cells: Array<[number, number]>, max: number, first?: string): string[] {
    const out: string[] = first && faces.has(first) ? [first] : [];
    for (const [r, c] of cells) {
      if (out.length >= max) break;
      const k = keyOf(r, c);
      if (!out.includes(k) && faces.has(k)) out.push(k);
    }
    return out;
  }

  /** The coach line; `sr` is read by a screen reader only (the line is aria-live), after the visible words. */
  function coach(text: string, sr?: string): void {
    coachEl.textContent = text;
    if (sr) {
      const hidden = document.createElement('span');
      hidden.className = 'sr-only';
      hidden.textContent = ` ${sr}`;
      coachEl.appendChild(hidden);
    }
    coachEl.classList.remove('is-guide');
  }

  /** A replay of a solved level has personal goals: the stars still to earn, or the best time to beat. */
  function replayGoal(): string | null {
    if (mode.kind !== 'level') return null;
    const clear = app.save.journey.clears[`L${mode.level}`];
    if (!clear) return null;
    const missing = [!clear.clean ? 'no mistakes' : '', !clear.hintFree ? 'no hints' : ''].filter(Boolean);
    if (missing.length) return `Replay. ${missing.length === 2 ? 'Two stars' : 'One star'} to earn: solve it with ${missing.join(' and ')}.`;
    const best = app.save.journey.bestTimes[`L${mode.level}`];
    return best ? `Replay. All three stars are yours; your best is ${fmtClock(best)}.` : 'Replay. All three stars are yours.';
  }

  function defaultCoach(): string {
    if (mode.kind === 'cup') return `Paw Cup rules: no hints, ${numberWord(CUP_HEARTS).toLowerCase()} hearts, your time counts.`;
    const goal = replayGoal();
    if (goal) return goal;
    const tip = mode.kind === 'level' ? levelTip(mode.level, wordOf(CAT), wordOf(DOG)) : null;
    if (tip) return tip;
    if (mode.kind === 'zen') return 'No clock, no hearts. Take all the time you like.';
    if (classic) return solo ? `Tap once to mark a tile ✕, again to place ${aWord(CAT)}.` : `Tap once to mark a tile ✕, again to place the animal you picked.`;
    if (solo) return `One ${wordOf(CAT)} in every row, column and color, never touching. Tap to mark ✕, double-tap to place.`;
    return `One ${wordOf(CAT)} and one ${wordOf(DOG)} in every row, column and color. Pick one below: tap marks ✕, double-tap places it.`;
  }

  // ---------------------------------------------------------------- input

  const species = (): Species => (tool === 'dog' ? DOG : CAT);

  function onPress(r: number, c: number, activate = false): 'mark' | 'unmark' | null {
    if (finished || s.paused) return null;
    faces.activity();
    if (erasing) {
      lastTap = null;
      // Erase takes back ✕ marks only; the finger can keep going to clear a run of them.
      return eraseAt(r, c) ? 'unmark' : null;
    }
    const v = s.cells[r][c];
    if (v === CAT || v === DOG) {
      lastTap = null;
      handle({ ignored: true }, r, c);
      return null;
    }
    // Two-step for the tap cycle, and for any activation without a pointer (a screen reader, a switch): no timing.
    if (classic || activate) {
      // No timing: an empty tile takes a ✕; a ✕ (or a tile with a mistake for the other animal) takes the animal.
      if (v === MARK || s.errorsAt(r, c).length) tryPlace(r, c, species());
      else handle(s.toggleMark(r, c), r, c);
      return null;
    }
    const now = performance.now();
    // A second tap on the same tile, quickly: place the animal. The first tap's ✕ is taken back with a logged undo,
    // so one Undo afterwards empties the tile (and the server's replay sees exactly the same moves).
    if (lastTap && lastTap.r === r && lastTap.c === c && now - lastTap.t < DOUBLE_TAP_MS) {
      const ownMark = lastTap.marked;
      lastTap = null;
      const last = s.lastChange();
      if (ownMark && v === MARK && last && last.r === r && last.c === c && last.before === EMPTY && last.after === MARK) s.undo();
      tryPlace(r, c, species());
      return null;
    }
    // A tile with a mistake mark keeps it: a single tap only starts a possible double tap (the other animal may live
    // there on a two-animal board).
    if (s.errorsAt(r, c).length) {
      lastTap = { r, c, t: now, marked: false };
      coach(mistakeLine(r, c));
      return null;
    }
    const slow = !!lastTap && lastTap.r === r && lastTap.c === c && lastTap.marked && v === MARK && now - lastTap.t < SLOW_DOUBLE_MS;
    const res = s.toggleMark(r, c);
    lastTap = s.givenMask[r][c] ? null : { r, c, t: now, marked: !!res.marked };
    handle(res, r, c);
    if (slow && res.unmarked && ++slowDoubles >= 2) maybeOfferTwoStep();
    if (guide && guide.r === r && guide.c === c && res.marked) coach(`Now tap it again, quickly, to place ${aWord(guide.species)}.`);
    if (res.marked) return 'mark';
    if (res.unmarked) return 'unmark';
    return null;
  }

  /**
   * Tries an animal on a tile. Right: it settles there. Wrong: a heart is lost and the tile keeps a mistake mark (D37):
   * a red ✕ when no animal can live there, or the struck animal on a two-animal board. Trying the same wrong animal on
   * the same tile again does nothing and costs nothing: a double-fired tap is never charged twice.
   */
  function tryPlace(r: number, c: number, sp: Species): void {
    if (s.hasError(r, c, sp)) {
      coach(`You already tried ${withArticle(wordOf(sp))} here. ${s.errorsAt(r, c).length > 1 || solo ? 'No animal lives on this tile.' : 'Try somewhere else.'}`);
      return;
    }
    const res = s.place(r, c, sp);
    // The mistake mark replaces the player's ✕ on that tile (one mark per tile, and this one is earned).
    if (res.wrong && s.cells[r][c] === MARK) s.unmarkIfMarked(r, c);
    handle(res, r, c);
  }

  /** Erase: a ✕ comes back off; animals and mistakes stay. Returns whether a ✕ was taken back. */
  function eraseAt(r: number, c: number): boolean {
    if (s.unmarkIfMarked(r, c)) {
      feel('unmark');
      afterChange();
      return true;
    }
    const v = s.cells[r][c];
    if (s.givenMask[r][c]) handle({ ignored: true }, r, c);
    else if (v === CAT || v === DOG) coach(`Erase only takes back ✕ marks. The ${wordOf(v)} stays; Undo (in Pause) takes back your last move.`);
    else if (s.errorsAt(r, c).length) coach('Mistakes stay marked: they show where an animal was tried and didn’t belong.');
    return false;
  }

  /** What a mistake mark means, in one line. */
  function mistakeLine(r: number, c: number): string {
    const tried = s.errorsAt(r, c);
    if (solo || tried.length > 1) return 'A mistake was marked here: no animal lives on this tile.';
    const other = tried[0] === CAT ? DOG : CAT;
    return `No ${wordOf(tried[0])} here. If ${aWord(other)} lives here, pick it below and double-tap.`;
  }

  function onDrag(r: number, c: number, m: 'mark' | 'unmark'): void {
    if (finished) return;
    // Drag-marking passes over mistake marks and animals; drag-erasing only lifts ✕ marks.
    if (m === 'mark' && s.errorsAt(r, c).length) return;
    const changed = m === 'mark' ? s.markIfEmpty(r, c) : s.unmarkIfMarked(r, c);
    if (changed) {
      feel('drag');
      afterChange();
    }
  }

  function onKey(r: number, c: number, key: string): boolean {
    const k = key.toLowerCase();
    // Enter places the picked animal; Space (or X) marks ✕; 1 and 2 place the first or second animal directly;
    // Delete takes a ✕ back.
    if (k === 'enter') return keyApply(r, c, species() === DOG ? 'dog' : 'cat');
    if (k === '1' || k === 'a') return keyApply(r, c, 'cat');
    if (!solo && (k === '2' || k === 'b')) return keyApply(r, c, 'dog');
    if (k === ' ' || k === 'x' || k === '.') {
      if (finished || s.paused) return true;
      faces.activity();
      if (s.errorsAt(r, c).length) coach(mistakeLine(r, c));
      else handle(s.toggleMark(r, c), r, c);
      return true;
    }
    if (k === 'backspace' || k === 'delete' || k === '0' || k === 'e') return keyApply(r, c, 'erase');
    if (k === 'z') {
      doUndo();
      return true;
    }
    if (k === 'y') {
      doRedo();
      return true;
    }
    if (k === 'h' && rules.hints) {
      doHint();
      return true;
    }
    return false;
  }

  function keyApply(r: number, c: number, t: Tool): boolean {
    if (finished || s.paused) return true;
    faces.activity();
    if (t === 'cat' || t === 'dog') {
      const v = s.cells[r][c];
      if (v === CAT || v === DOG) handle({ ignored: true }, r, c);
      else tryPlace(r, c, t === 'dog' ? DOG : CAT);
      return true;
    }
    if (t === 'mark') {
      if (s.errorsAt(r, c).length) coach(mistakeLine(r, c));
      else handle(s.toggleMark(r, c), r, c);
      return true;
    }
    eraseAt(r, c);
    return true;
  }

  function handle(res: MoveResult, r: number, c: number): void {
    if (res.ignored) {
      const v = s.cells[r][c];
      if (s.givenMask[r][c]) coach(`This ${wordOf(v === DOG ? DOG : CAT)} is already home. Its spot is locked.`);
      else if (v === CAT || v === DOG) coach(`That ${wordOf(v)} is home to stay.`);
      return;
    }
    let react: (() => void) | undefined;
    if (res.wrong && res.placed) {
      onMistake(r, c, res.placed);
    } else if (res.placed) {
      feel('place');
      board.flash([[r, c]], 'is-fresh', 720);
      // The why (D39) is decided before the controls note can cover the coach line on a first placement.
      const why = whyLine(r, c, res.placed, res.completed ?? []);
      maybeControlsTip();
      // One-animal boards: the color this animal settles is done; its tiles glow for a beat (overlay only).
      if (solo && !app.reducedMotion) board.flash(s.unitCells({ kind: 'region', index: s.puzzle.regions[r][c] }), 'is-glow', 700);
      const key = keyOf(r, c);
      const half = halfwayNow();
      if (res.completed?.length) {
        const units = res.completed;
        onUnits(units, why);
        // The new pet and its partner in the completed line beam with pride; when one move finishes two or three lines
        // at once, every pet in them joins in (four faces at most, D39).
        const cells = units.flatMap((u) => s.unitCells(u));
        react = () => {
          if (units.length > 1) faces.wave(petsIn(cells, 4, key), 'proud', 90);
          else petsIn(cells, 2, key).forEach((k) => faces.react(k, 'proud'));
          if (half) cheerHalfway(key);
        };
      } else {
        coach(why ?? (half ? halfwayLine() : encouragement()));
        react = () => {
          faces.react(key, why ? 'proud' : 'happy');
          if (half) cheerHalfway(key);
        };
      }
    } else if (res.marked) {
      feel('mark');
      react = () => glanceFromNeighbor(r, c);
    }
    afterChange(react);
  }

  /** A pet beside a tile the player just marked glances toward it (position only, never the answer). */
  function glanceFromNeighbor(r: number, c: number): void {
    for (let dr = -1; dr <= 1; dr++)
      for (let dc = -1; dc <= 1; dc++) {
        if (!dr && !dc) continue;
        const k = keyOf(r + dr, c + dc);
        if (faces.has(k)) {
          faces.react(k, 'curious', lookToward({ r: r + dr, c: c + dc }, { r, c }));
          return;
        }
      }
  }

  function onMistake(r: number, c: number, sp: Species): void {
    feel('miss');
    board.flash([[r, c]], 'is-miss', MISS_MS);
    // The attempted animal appears faintly, puzzled, and fades. It is the only face that reacts to a mistake.
    board.ghost(r, c, animalElement(animalOf(sp), 'confused').el, MISS_MS);
    const word = wordOf(sp);
    // Two animals of one kind are told apart by name: "Not Mochi's spot", "a cat spot" otherwise.
    const named = !!cast.b && animalInfo(cast.a).noun === animalInfo(cast.b).noun;
    const spot = named ? `${word}'s spot` : `${withArticle(word)} spot`;
    // A screen reader hears the hearts left; sighted players see them above the board (D40 review).
    const left = rules.hearts ? `${plural(s.hearts, 'heart')} left.` : undefined;
    if (guide) {
      coach(`Not quite. That tile can't hold ${withArticle(word)}.`);
      const g = guide;
      scope.timeout(() => guide === g && coachGuide(g.text), 1800);
      // D40: kind words, no scorekeeping. The hearts above the board already show what's left; only the last one is
      // worth a word, and that word is "take your time". On a two-animal board the other animal may still live here.
    } else if (rules.hearts && s.hearts === 1) coach(`Not ${spot}. One heart left, so take your time.`);
    else if (!rules.hearts || s.hearts > 0) {
      const which = solo ? 'it' : `${named ? word : `the ${word}`} here`;
      coach(`Not ${spot}. It's marked for you, so there's no need to try ${which} again.`, left);
    }
  }

  function onUnits(units: UnitRef[], why: string | null = null): void {
    feel(units.length > 1 ? 'lines' : 'line');
    const cells: Array<[number, number]> = [];
    for (const u of units) cells.push(...s.unitCells(u));
    board.flash(cells, 'is-glow', 950);
    const u = units[0];
    const name = u.kind === 'region' ? `The ${board.regionName(u.index)} region` : `${capitalize(u.kind)} ${u.index + 1}`;
    const done = units.length > 1 ? `${name} and ${units.length - 1} more are complete${units.length > 2 ? ' at once!' : '.'}` : `${name} is complete.`;
    coach(why ? `${done} ${why}` : done);
  }

  /** The first few explanations are shown to everyone; after that only with the setting (D39). */
  const WHY_FIRST = 3;

  /**
   * Why a correct placement had to go where it went (D39), when one line decided it: that line's tiles get a ring for a
   * beat and the coach says it in one sentence. Only from what the player could see (`Session.whyPlaced`), never on the
   * guided boards (they teach their own way) or in the Paw Cup (it's competition), never for the tile a hint had just
   * pointed at (the hint already said why), and not while the one-time controls note covers the coach line.
   */
  function whyLine(r: number, c: number, sp: Species, completed: readonly UnitRef[]): string | null {
    if (guided || mode.kind === 'cup') return null;
    if (hint && hint.info.r === r && hint.info.c === c) return null;
    if (el.querySelector('[data-controls-tip]') || !app.save.onboarding.controlsTipSeen) return null;
    const ob = app.save.onboarding;
    if (!app.settings.explainMoves && ob.whyShown >= WHY_FIRST) return null;
    const u = s.whyPlaced(r, c, sp, completed);
    if (!u) return null;
    board.flash(s.unitCells(u), 'is-why', 1500);
    if (!app.settings.explainMoves) {
      ob.whyShown++;
      app.persist();
    }
    track('onboarding_step', { step: 'why', unit: u.kind });
    const word = wordOf(sp);
    // "row 3" stays on one line in the coach (a no-break space before the number).
    const where = unitPhrase(u).replace(/ (\d+)$/, '\u00a0$1');
    if (completed.some((x) => x.kind === u.kind && x.index === u.index)) return `It was the only spot left there for ${withArticle(word)}.`;
    if (completed.length) return `${capitalize(withArticle(word))} had one spot left in ${where}.`;
    return `Only one spot was left for ${withArticle(word)} in ${where}.`;
  }

  /** Halfway through a board (half its animals placed), once per board (D39); a resumed board past halfway is done. */
  const placedCount = () => s.cells.reduce((n, row) => n + row.filter((v) => v === CAT || v === DOG).length, 0);
  const halfOf = Math.ceil((solo ? n : 2 * n) / 2);
  let halfwayCheered = placedCount() >= halfOf;
  function halfwayNow(): boolean {
    if (halfwayCheered || guided || placedCount() < halfOf) return false;
    halfwayCheered = true;
    return true;
  }
  function halfwayLine(): string {
    return 'Halfway there!';
  }
  /** A small ripple of smiles from the newest animals toward the oldest, the move's own animal first. */
  function cheerHalfway(key: string): void {
    const keys = [...tilePets.keys()].reverse();
    faces.wave([key, ...keys.filter((k) => k !== key)].slice(0, 5), 'happy', 110);
  }

  let encourageIdx = 0;
  function encouragement(): string {
    const lines = ['Nicely reasoned.', 'Settled in.', 'That one belongs.', 'Good spot.'];
    return lines[encourageIdx++ % lines.length];
  }

  function afterChange(react?: () => void): void {
    if (hint) {
      hint = null;
      board.clearHint();
    }
    paint();
    react?.();
    const newest = [...tilePets.keys()].pop();
    if (newest) lastPlaced = tilePets.get(newest) ?? lastPlaced;
    app.saveActive();
    checkOutcome();
  }

  // ---------------------------------------------------------------- actions

  function doUndo(): void {
    if (finished) return;
    if (s.undo()) {
      feel('undo');
      faces.activity();
      faces.calmAll();
      afterChange();
    }
  }

  function doRedo(): void {
    if (finished) return;
    if (s.redo()) {
      feel('undo');
      faces.activity();
      faces.calmAll();
      afterChange();
    }
  }

  /**
   * Pays for a hint tier if it costs anything: one ticket per hint target, the board's first look free. The ticket and
   * the session's record of it are saved in one write, so a crash can't charge without the hint or the reverse.
   */
  function payFor(info: HintInfo, tier: 1 | 2 | 3): boolean {
    if (s.hintCost(info, tier, freeHints) === 0) {
      s.commitHint(info, tier, false);
      return true;
    }
    const r = useItem(app.save, `use:hint:${modeKey(mode)}:${info.r},${info.c}:${Date.now()}`, 'hint', new Date(), 'Hint');
    if (r !== 'ok') {
      showNoTickets();
      return false;
    }
    s.commitHint(info, tier, true);
    app.saveActive();
    toast(`Hint used · ${tickets()} left`, ICON.bulb);
    return true;
  }

  function showNoTickets(): void {
    if (sheet) return;
    pauseBoard();
    const canWatch = canOfferVideo();
    const ns = openSheet(scope, {
      title: 'No hints left',
      body: `
        <p class="sheet__lead">This board's free look is used. You earn a hint for every second new Journey level and from some of the day's errands. Zen Garden hints are always free.</p>
        <div class="sheet__actions">
          ${canWatch ? `<button class="btn btn--block" data-act="watch">${ICON.videoToken}Watch a short video: +1 hint</button>` : ''}
          <button class="btn ${canWatch ? 'btn--quiet' : 'btn--block'}" data-act="close" data-autofocus>Keep thinking</button>
        </div>`,
      onClose: () => {
        sheet = null;
        resumeIfOnScreen();
      },
    });
    sheet = ns;
    let busy = false;
    ns.scope.on(ns.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'watch') {
        busy = true;
        const r = await watchVideoFor('hint');
        busy = false;
        if (r === 'granted') toast('+1 hint', ICON.bulb);
        else toast(videoMessage(r));
        if (!scope.alive || !ns.scope.alive) return;
        ns.close();
        paint();
      } else ns.close();
    });
  }

  /** Hearts sheet: how many are left on this board, the pantry, and using one extra life for one heart. */
  function openHearts(): void {
    if (finished || sheet || !pantryOn) return;
    pauseBoard();
    const have = lives();
    const full = s.hearts >= s.maxHearts;
    const watch = !full && have < 1 && canOfferVideo();
    const hs = openSheet(scope, {
      title: 'Hearts and extra lives',
      body: `
        <p class="sheet__lead">${plural(s.hearts, 'heart')} of ${s.maxHearts} left on this board. Hearts start fresh on every board; extra lives keep between boards.</p>
        <div class="pantry-row"><span class="pantry-chip">${ICON.lifePlus}<b class="num">${have}</b><small>of ${ITEM_CAP.life} extra lives</small></span><span class="pantry-chip">${ICON.bulb}<b class="num">${tickets()}</b><small>hints</small></span></div>
        <div class="sheet__actions">
          ${
            watch
              ? `<button class="btn btn--block" data-act="watch">${ICON.videoToken}Watch a short video: +1 heart</button>`
              : `<button class="btn btn--block" data-act="life" ${have < 1 || full ? 'disabled' : ''}>${ICON.lifePlus}${full ? 'Hearts are full' : have < 1 ? 'No extra lives yet' : 'Use an extra life: +1 heart'}</button>`
          }
          <button class="btn btn--quiet" data-act="close" data-autofocus>Back to the board</button>
        </div>
        <p class="muted">Extra lives come from clearing new Journey levels and some errands.</p>`,
      onClose: () => {
        sheet = null;
        resumeIfOnScreen();
      },
    });
    sheet = hs;
    let busy = false;
    hs.scope.on(hs.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'life') {
        if (useLife()) coach(`An extra life! ${plural(s.hearts, 'heart')} left.`);
      } else if (a.act === 'watch') {
        busy = true;
        const r = await watchVideoFor('life');
        busy = false;
        // The extra life is the player's either way; it's used right away if they're still on this board.
        if (r === 'granted' && scope.alive && useLife()) coach(`Thanks for watching! ${plural(s.hearts, 'heart')} left.`);
        else if (r !== 'granted') toast(videoMessage(r));
        if (!hs.scope.alive) return;
      }
      hs.close();
    });
  }

  /** Spends one extra life for one heart. The pantry and the board are saved together. */
  function useLife(): boolean {
    // Checked first, so an extra life is only ever spent when it will really give a heart back.
    if (!pantryOn || !s.canAddHeart() || lives() < 1) return false;
    if (useItem(app.save, `use:life:${modeKey(mode)}:${Date.now()}`, 'life', new Date(), 'Heart') !== 'ok') return false;
    s.addHeart();
    track('extra_life_used', { mode: mode.kind });
    feel('coin');
    paint();
    app.saveActive();
    return true;
  }

  function doHint(): void {
    if (finished || !rules.hints || s.paused) return;
    if (!hint) {
      const info = s.peekHint();
      if (!info) return;
      if (!payFor(info, 1)) return;
      s.noteHint(info);
      track('hint_used', { mode: mode.kind, tier: 1 });
      hint = { info, tier: 1 };
      faces.activity();
      if (info.unit) {
        board.setHint(s.unitCells(info.unit), null);
        focusFaces(s.unitCells(info.unit));
        coach(`Look at ${unitPhrase(info.unit)}. One spot there is already decided. ${nextHintPreview(info, 2)}`);
      } else {
        board.setHint([], [info.r, info.c]);
        coach(`Look at the highlighted tile. ${nextHintPreview(info, 2)}`);
      }
    } else if (hint.tier === 1) {
      if (!payFor(hint.info, 2)) return;
      hint.tier = 2;
      track('hint_used', { mode: mode.kind, tier: 2 });
      board.setHint(hint.info.unit ? s.unitCells(hint.info.unit) : [], [hint.info.r, hint.info.c]);
      if (hint.info.unit) focusFaces(s.unitCells(hint.info.unit));
      coach(`${friendlyReason(hint.info.reason)} ${nextHintPreview(hint.info, 3)}`);
    } else {
      if (!payFor(hint.info, 3)) return;
      track('hint_used', { mode: mode.kind, tier: 3 });
      const info = s.hint();
      hint = null;
      board.clearHint();
      let reactTo: { key: string; mood: ReactionMood } | null = null;
      if (info) {
        feel('place');
        board.flash([[info.r, info.c]], 'is-fresh', 720);
        const units = s.completedUnitsAt(info.r, info.c);
        coach(friendlyReason(info.reason));
        if (units.length) onUnits(units);
        reactTo = { key: keyOf(info.r, info.c), mood: 'happy' };
      }
      paint();
      if (reactTo) faces.react(reactTo.key, reactTo.mood);
      app.saveActive();
      checkOutcome();
      return;
    }
    paint();
  }

  /** One sentence on what the next Hint tap will do and cost (D38), so a tap is never an accidental purchase. */
  function nextHintPreview(info: HintInfo, tier: 2 | 3): string {
    const cost = s.hintCost(info, tier, freeHints) === 0 ? 'free' : 'uses a hint';
    return tier === 2 ? `Next: Explain says why (${cost}).` : `Next: Place it puts the animal there (${cost}).`;
  }

  /** Pets already in the hinted line look attentive. They are where the player is already looking. */
  function focusFaces(cells: Array<[number, number]>): void {
    for (const k of petsIn(cells, 2)) faces.react(k, 'focused');
  }

  function unitPhrase(u: UnitRef): string {
    if (u.kind === 'region') return `the ${board.regionName(u.index)} region`;
    return `${u.kind} ${u.index + 1}`;
  }

  /**
   * Engine reasons say "region 3" and "cat" / "dog" (or "animal" on one-animal boards); players see colors and the
   * board's own animals.
   */
  function friendlyReason(reason: string): string {
    const name = (w: string) => (w === 'dog' ? wordOf(DOG) : wordOf(CAT));
    return reason
      .replace(
        /regions (\d+(?:, \d+)*) and (\d+)/g,
        (_m, list: string, last: string) =>
          `the ${[...list.split(', '), last]
            .map((d) => board.regionName(Number(d) - 1))
            .join(', ')
            .replace(/, ([^,]*)$/, ' and $1')} regions`,
      )
      .replace(/region (\d+)/g, (_m, d) => `the ${board.regionName(Number(d) - 1)} region`)
      .replace(/\b(a|an) (cat|dog|animal)\b/g, (_m, _a, w: string) => withArticle(name(w)))
      .replace(/\b(cat|dog|animal)\b/g, (_m, w: string) => name(w))
      .replace(/^Only one spot left/, 'Only one spot is left');
  }

  scope.on(el, 'click', (e) => {
    const t = (e.target as HTMLElement).closest('[data-tool]') as HTMLElement | null;
    if (t) {
      if (finished) return;
      selectTool(t.dataset.tool as Tool);
      feel('tool');
      faces.activity();
      if (tool === 'cat' || tool === 'dog') faces.curiousOne(tool, [0, 1.3]);
      coach(toolCoach());
      paint();
      return;
    }
    // The difficulty chip: a tap says why the board is as hard as it is (never what the next move is).
    if ((e.target as HTMLElement).closest('.chip--board')) {
      coach(`${tierName}: ${difficultyReason(profile)}`);
      return;
    }
    const a = actionOf(e);
    if (!a) return;
    switch (a.act) {
      case 'leave':
        leave();
        break;
      case 'pause':
        openPause();
        break;
      case 'erase':
        if (finished) break;
        erasing = !erasing;
        lastTap = null;
        feel('tool');
        coach(toolCoach());
        paint();
        break;
      case 'hint':
        doHint();
        break;
      case 'hearts':
        openHearts();
        break;
      case 'tip-close':
        el.querySelector('[data-controls-tip]')?.remove();
        break;
      case 'offer-close':
        el.querySelector('[data-two-step-offer]')?.remove();
        break;
      case 'tip-controls':
        el.querySelector('[data-controls-tip]')?.remove();
        pauseBoard();
        showSettings(scope, { inGame: true, onClose: () => app.router.refresh() });
        break;
      case 'use-two-step':
        // The board is saved on every move, so it comes straight back under the new controls.
        app.settings.controls = 'classic';
        app.persist();
        track('onboarding_step', { step: 'two_step_on' });
        app.saveActive();
        app.router.refresh();
        toast('Two-step tap is on: tap marks ✕, tap again places. Change it any time in Settings.');
        break;
    }
  });

  // Tool shortcuts when focus isn't on a cell.
  scope.on(document, 'keydown', (e) => {
    const ke = e as KeyboardEvent;
    if (sheet || document.querySelector('.overlay')) return;
    if ((ke.target as HTMLElement)?.closest?.('.cell')) return;
    if (ke.repeat) return; // a held key acts once (a held H must not run through hint tiers and tickets)
    const k = ke.key.toLowerCase();
    if (!solo && (k === '1' || k === 'a' || k === '2' || k === 'b')) {
      selectTool(k === '1' || k === 'a' ? 'cat' : 'dog');
      paint();
    } else if (k === 'e') {
      erasing = !erasing;
      coach(toolCoach());
      paint();
    } else if (k === 'z') doUndo();
    else if (k === 'y') doRedo();
    else if (k === 'h') doHint();
    else if (k === 'p' || k === 'escape') openPause();
  });

  /** Picks which animal a double tap places (and leaves Erase). Remembered for the next two-animal board. */
  function selectTool(t: Tool): void {
    tool = t;
    erasing = false;
    lastTap = null;
    if ((t === 'cat' || t === 'dog') && !solo) settings.lastSpecies = t;
  }

  /** What a tap does right now, in one line. */
  function toolCoach(): string {
    if (erasing) return 'Erase is on: tap a ✕ (or drag across a few) to take it back. Animals and mistakes stay. Tap Erase again when you are done.';
    return solo ? defaultCoach() : `${capitalize(wordOf(species()))} picked: tap marks ✕, double-tap places ${aWord(species())}.`;
  }

  /**
   * Once, after the first animal a player places on an ordinary board (D38): the two gestures in one line, and where to
   * change them. An overlay over the coach line (nothing shifts, no input waits on it); it leaves on its ✕, when the
   * board does, or after a while. The guided boards teach as they go and skip it.
   */
  function maybeControlsTip(): void {
    const ob = app.save.onboarding;
    if (guided || ob.controlsTipSeen || el.querySelector('[data-controls-tip]')) return;
    ob.controlsTipSeen = true;
    app.persist();
    track('onboarding_step', { step: 'controls_tip' });
    const text = classic
      ? 'Two-step tap: <b>tap</b> marks ✕, <b>tap again</b> places. Prefer a quick double-tap?'
      : '<b>Tap</b> marks ✕ · <b>double-tap</b> places. Prefer single taps with no timing?';
    const tip = h(`<div class="control-tip" data-controls-tip role="note">
      <span class="control-tip__icon" aria-hidden="true">${ICON.info}</span>
      <p class="control-tip__text">${text} <button class="control-tip__link" data-act="tip-controls">Controls in Settings</button></p>
      <button class="icon-btn icon-btn--bare control-tip__close" data-act="tip-close" aria-label="Got it">${ICON.close}</button>
    </div>`);
    foot.prepend(tip);
    scope.timeout(() => tip.remove(), 12_000);
  }

  /**
   * D40: a couple of double taps came a little too slowly and only cleared their ✕. Once ever, outside the guided
   * boards, the two-step scheme is offered (tap marks ✕, tap again places, no timing), with one tap to switch. The
   * double-tap default stays (D37); nothing changes unless the player chooses it.
   */
  function maybeOfferTwoStep(): void {
    const ob = app.save.onboarding;
    if (classic || guided || ob.twoStepOffered || el.querySelector('[data-controls-tip], [data-two-step-offer]')) return;
    ob.twoStepOffered = true;
    app.persist();
    track('onboarding_step', { step: 'two_step_offer' });
    const tip = h(`<div class="control-tip" data-two-step-offer role="note">
      <span class="control-tip__icon" aria-hidden="true">${ICON.info}</span>
      <p class="control-tip__text">Double taps coming a little slow? With <b>two-step tap</b>, a second tap places, any time later. <button class="control-tip__link" data-act="use-two-step">Use two-step tap</button></p>
      <button class="icon-btn icon-btn--bare control-tip__close" data-act="offer-close" aria-label="No thanks">${ICON.close}</button>
    </div>`);
    foot.prepend(tip);
    scope.timeout(() => tip.remove(), 14_000);
  }

  /** What a tap does under the player's controls, for the pause sheet. */
  function controlsSummary(): string {
    return classic ? 'Two-step tap: tap marks ✕, tap again places. No timing.' : 'Tap marks ✕, double-tap places. Erase takes ✕ back.';
  }

  function resumeIfOnScreen(): void {
    if (!scope.alive || finished || sheet) return;
    unveil();
    s.resume();
    faces.setAmbient(!document.hidden);
    faces.activity();
  }

  /** Back to wherever the board was opened from (Journey, the World, a sanctuary, Challenges). */
  function leave(): void {
    app.saveActive();
    app.router.back({ screen: mode.kind === 'cup' ? 'challenges' : 'journey' });
  }

  function openPause(): void {
    if (finished || sheet) return;
    pauseBoard();
    el.classList.add('is-paused');
    sheet = openSheet(scope, {
      title: 'Paused',
      body: `
        <p class="sheet__lead">${rules.timer ? `Clock stopped at ${fmtClock(s.elapsedSeconds())}.` : 'Your board is saved.'}</p>
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="resume">${ICON.resume}Resume</button>
          ${mode.kind === 'cup' ? '' : `<button class="btn btn--secondary btn--block" data-act="restart">${ICON.restart}Restart board</button>`}
          <div class="pause-row">
            <button class="btn btn--quiet" data-act="undo" ${s.canUndo() ? '' : 'disabled'}>${ICON.undo}Undo</button>
            <button class="btn btn--quiet" data-act="redo" ${s.canRedo() ? '' : 'disabled'}>${ICON.redo}Redo</button>
          </div>
          <p class="pause-controls" data-pause-controls>${ICON.mark}<span><b>Controls.</b> ${esc(controlsSummary())}</span></p>
          <button class="btn btn--quiet" data-act="rules">${ICON.help}How to play</button>
          <button class="btn btn--quiet" data-act="settings">${ICON.gear}Settings and controls</button>
          <button class="btn btn--quiet" data-act="leave">${mode.kind === 'cup' ? 'Leave (this attempt stays open)' : 'Leave and keep progress'}</button>
        </div>`,
      onClose: () => {
        sheet = null;
        if (mode.kind !== 'cup') el.classList.remove('is-paused');
        resumeIfOnScreen();
      },
    });
    const ps = sheet;
    ps.scope.on(ps.el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'resume') ps.close();
      else if (a.act === 'undo' || a.act === 'redo') {
        ps.close();
        if (a.act === 'undo') doUndo();
        else doRedo();
      } else if (a.act === 'rules') {
        ps.close();
        pauseBoard();
        showRules(scope, () => resumeIfOnScreen(), { rule: s.rule, cast });
      } else if (a.act === 'restart') {
        ps.close();
        confirmRestart();
      } else if (a.act === 'settings') {
        ps.close();
        pauseBoard();
        showSettings(scope, { inGame: true, onClose: () => app.router.refresh() });
      } else if (a.act === 'leave') {
        ps.close();
        leave();
      }
    });
  }

  function confirmRestart(): void {
    pauseBoard();
    const cs = openSheet(scope, {
      title: 'Restart this board?',
      body: `<p class="sheet__lead">Your placements and marks on this board will be cleared.</p>
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="yes">Restart board</button>
          <button class="btn btn--quiet" data-act="no">Keep playing</button>
        </div>`,
      onClose: () => resumeIfOnScreen(),
    });
    cs.scope.on(cs.el, 'click', (e) => {
      const a = actionOf(e);
      if (!a) return;
      if (a.act === 'yes') {
        cs.close();
        restartGame();
      } else cs.close();
    });
  }

  // ---------------------------------------------------------------- outcome

  function checkOutcome(): void {
    const o = s.claimOutcome();
    if (o === 'won') onWin();
    else if (o === 'lost') onLose();
  }

  function onWin(): void {
    finished = true;
    s.pause();
    board.clearSelection(true);
    paint();
    // Every animal smiles or winks in a short staggered wave (≤1.5s total), faces only.
    const order: string[] = [];
    for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) order.push(keyOf(r, c));
    faces.celebrate(order);
    winPet = lastPlaced ?? tilePets.values().next().value ?? null;
    const result = {
      size: n,
      seconds: s.elapsedSeconds(),
      mistakes: s.mistakes,
      hintsUsed: s.hintsUsed,
      revives: s.revives,
      hearts: rules.hearts,
      spec,
      tier: profile.tier,
    };
    const openedBefore = openRegions(app.save);
    // How far the board's animal was before this solve, so the win can show the step it took (D38).
    const friendBefore = mode.kind === 'cup' ? null : arrivalProgress(app.save, cast.sanctuary);
    const rec = recordWin(app.save, mode, result);
    const rewards = rewardsForWin(app.save, mode, rec, new Date(), profile.tier);
    // Every new puzzle solved (not Paw Cup) grows the sanctuary this board was started for, whatever is being built now;
    // the guided first board brings the first animal home. Credited once per board (its id is the receipt) and once per
    // puzzle (its mode key): a replay of a cleared level grows nothing more (D38).
    const replay = countsForGrowth(mode, tutorial) && alreadyGrown(app.save, modeKey(mode));
    const growth = countsForGrowth(mode, tutorial) ? creditSolve(app.save, { boardSanctuary: cast.sanctuary, openedBefore, receipt: boardId, puzzle: modeKey(mode) }) : null;
    // On the leaderboard: queue the board (with its move log) for the server to check, then send in the background.
    const queued = !tutorial && queueSolve(app.save, mode, spec, s.events, result.mistakes, result.hintsUsed);
    const cupScore = mode.kind === 'cup' ? finishAttempt(app.save, mode, s.events, s.elapsedMs()) : null;
    const news = afterSolve(mode, n, result.mistakes, result.hintsUsed);
    app.clearSaved(mode);
    app.active = null;
    app.persist();
    cadence.boardsSinceLast++;
    track('puzzle_complete', { mode: mode.kind, size: n, seconds: result.seconds, mistakes: result.mistakes, hints: result.hintsUsed });
    if (mode.kind === 'daily' && rec.newDaily) track('daily_complete', { streak: rec.streak ?? 0 });
    if (growth?.stageUp) track('region_stage', { region: growth.sanctuary, stage: stageOf(app.save, growth.sanctuary) });
    for (const c of growth?.arrived ?? []) track('animal_arrived', { animal: c, sanctuary: growth!.sanctuary });
    feel('solved');
    coach('Puzzle solved!');
    // The board locks and glows for a beat (faces smile in a wave), then the results rise in stages. Nothing waits on
    // the animation: the sheet's buttons work the moment it opens, and a tap reveals everything at once.
    if (queued) void syncLeaderboard();
    scope.timeout(() => showWin(rec, result.seconds, rewards, news, cupScore, growth, { replay, friendBefore }), app.reducedMotion ? 150 : 500);
  }

  /** What this solve did (or didn't) for the world, carried into the win sheet (D38). */
  type WorldStep = { replay: boolean; friendBefore: ReturnType<typeof arrivalProgress> };

  function rewardsMarkup(r: RewardSummary): string {
    if (!r.coins && !r.decor.length && !r.lives && !r.hints) return '';
    const pantry = [
      r.lives
        ? `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry">${ICON.lifePlus}</span><span><b>+${plural(r.lives, 'extra life', 'extra lives')}</b><small>One heart back on any Journey or Daily board</small></span></div>`
        : '',
      r.hints
        ? `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry">${ICON.bulb}</span><span><b>+${plural(r.hints, 'hint')}</b><small>Pays for one hint, whichever step you need</small></span></div>`
        : '',
    ].join('');
    const coins = r.coins
      ? `<div class="reward-coins"><span class="reward-coins__amt">${ICON.coin}<b class="num">+${r.coins}</b></span><span class="muted">${esc(r.lines.map((l) => l.label).join(' · '))}</span></div>`
      : '';
    const decor = r.decor
      .map(
        (id) =>
          `<div class="reward-item"><span class="reward-item__art">${decorIcon(id)}</span><span><b>${esc(DECOR_BY_ID[id].name)}</b><small>${r.chapter ? `Gift for finishing ${esc(r.chapter.name)}` : 'New decoration'}</small></span></div>`,
      )
      .join('');
    return `<div class="win-rewards">${coins}${decor}${pantry}</div>`;
  }

  /** The one event a milestone win is about, biggest first: a sanctuary opened, an animal came home, a sanctuary finished, a stage reached. */
  type Hero = { kind: 'opened'; region: SanctuaryId } | { kind: 'arrived'; animal: AnimalId } | { kind: 'completed' } | { kind: 'stage' } | null;
  function heroOf(g: GrowthNews | null): Hero {
    if (!g) return null;
    if (g.opened.length) return { kind: 'opened', region: g.opened[0] };
    if (g.growth > 0 && g.arrived.length) return { kind: 'arrived', animal: g.arrived[0] };
    if (g.growth > 0 && g.completed) return { kind: 'completed' };
    if (g.growth > 0 && g.stageUp) return { kind: 'stage' };
    return null;
  }

  /** The milestone's headline, as the win sheet's own title (D40: the reward first, the accounting folded away). */
  function heroTitle(g: GrowthNews, hero: NonNullable<Hero>): string {
    const def = sanctuaryDef(g.sanctuary);
    switch (hero.kind) {
      case 'opened':
        return `The ${sanctuaryDef(hero.region).name} is open!`;
      case 'arrived':
        return `${animalInfo(hero.animal).name} is home!`;
      case 'completed':
        return `The ${def.name} is complete!`;
      case 'stage':
        return `${def.short}: ${g.stageUp!.name}!`;
    }
  }

  /** The milestone, as the centerpiece of the win sheet (in place of the small appreciative face). */
  function heroMarkup(g: GrowthNews, hero: NonNullable<Hero>): string {
    const def = sanctuaryDef(g.sanctuary);
    switch (hero.kind) {
      case 'opened': {
        const r = sanctuaryDef(hero.region);
        const art = isRegionId(hero.region) ? `<svg viewBox="0 40 360 220" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${regionThumb(hero.region, 0, 'win-hero')}</svg>` : '';
        return `<div class="win-hero win-hero--opened" style="--accent:${r.accent}" data-hero="opened">
          <div class="win-hero__scene">${art}<span class="win-hero__badge">${ICON.globe}New</span></div>
          <p class="win-hero__sub">${esc(r.blurb)}</p>
        </div>`;
      }
      case 'arrived': {
        // D40: the animal first. Its face, what it is to you, and one thing about its character.
        const a = animalInfo(hero.animal);
        const t = TEMPERAMENT_INFO[temperamentOf(hero.animal)];
        return `<div class="win-hero win-hero--arrived" style="--accent:${def.accent}" data-hero="arrived">
          <div class="win-hero__portrait portrait" style="--tint:${def.accent}">${animalPortrait(hero.animal, 'happy')}<span class="win-hero__badge">${ICON.heart}Home</span></div>
          <p class="win-hero__kicker">Your new ${esc(a.noun)}</p>
          <p class="win-hero__sub">A new little friend has arrived at the ${esc(def.short)}.</p>
          <p class="win-hero__temper"><span class="chip chip--temper">${esc(t.label)}</span><span>${esc(a.name)} ${esc(t.greets)}.</span></p>
        </div>`;
      }
      case 'completed':
        return `<div class="win-hero win-hero--stage" style="--accent:${def.accent}" data-hero="completed">
          <div class="win-hero__icon">${ICON.sparkle}</div>
          <p class="win-hero__sub">Every friend has a home.${g.coins ? ` <b class="num">+${g.coins}</b> Paw Coins.` : ''}</p>
        </div>`;
      case 'stage':
        return `<div class="win-hero win-hero--stage" style="--accent:${def.accent}" data-hero="stage">
          <div class="win-hero__icon">${ICON.sprout}</div>
          <p class="win-hero__sub">${esc(g.stageUp!.change)}.</p>
        </div>`;
    }
  }

  /**
   * What else this solve did for the world: anything the hero didn't already show (a second region, more arrivals, a
   * stage reached on the same solve as an arrival). How far the next animal is comes separately (`nextFriendMarkup`).
   */
  function growthMarkup(g: GrowthNews | null, hero: Hero): string {
    if (!g) return '';
    const parts: string[] = [];
    for (const r of g.opened) {
      if (hero?.kind === 'opened' && hero.region === r) continue;
      const def = sanctuaryDef(r);
      parts.push(
        `<div class="reward-item"><span class="reward-item__art reward-item__art--pantry" style="color:${def.accent}">${ICON.globe}</span><span><b>The ${esc(def.name)} is open!</b><small>${esc(def.blurb)}</small></span></div>`,
      );
    }
    if (g.growth > 0) {
      const def = sanctuaryDef(g.sanctuary);
      if (g.redirectedFrom) {
        const from = sanctuaryDef(g.redirectedFrom);
        parts.push(`<p class="win-note muted">${ICON.info}The ${esc(from.name)} is finished, so this board helped the ${esc(def.short)} instead.</p>`);
      }
      for (const id of g.arrived) {
        if (hero?.kind === 'arrived' && hero.animal === id) continue;
        const a = animalInfo(id);
        parts.push(
          `<div class="reward-item reward-item--arrival"><span class="reward-item__art">${animalPortrait(id, 'happy')}</span><span><b>${esc(a.name)} the ${esc(a.noun)} came home to the ${esc(def.short)}!</b><small>${esc(a.trait)}</small></span></div>`,
        );
      }
      if (g.completed && hero?.kind !== 'completed')
        parts.push(
          `<div class="win-growth is-up" style="--accent:${def.accent}">${ICON.sparkle}<span><b>The ${esc(def.name)} is complete!</b>${g.coins ? ` <span class="num">+${g.coins}</span> Paw Coins` : ''}</span></div>`,
        );
      else if (g.stageUp && hero?.kind !== 'stage' && hero?.kind !== 'completed')
        parts.push(
          `<div class="win-growth is-up" style="--accent:${def.accent}">${ICON.sprout}<span><b>${esc(def.short)}: ${esc(g.stageUp.name)}!</b> ${esc(g.stageUp.change)}.</span></div>`,
        );
    }
    return parts.length ? `<div class="win-world">${parts.join('')}</div>` : '';
  }

  /**
   * A replay of a puzzle that already grew the world (D38): say so plainly, and show where the sanctuary's next animal
   * stands, with no "+1". The stars and the best time are what a replay is for (replayMarkup says which).
   */
  function replayWorldMarkup(): string {
    if (mode.kind === 'cup') return '';
    const def = sanctuaryDef(cast.sanctuary);
    return `<div class="win-world"><p class="win-note muted" data-replay-note>${ICON.info}A replay: it already grew the ${esc(def.short)} once. New levels, the Daily and Zen boards grow it.</p>${nextFriendMarkup(cast.sanctuary)}</div>`;
  }

  /**
   * The animal on its way to a sanctuary and how many puzzles until it arrives; `grew` says this solve counted for it.
   * With `before` (the same animal's progress before the solve), the line says the step — "3 → 2 puzzles away" — and the
   * bar starts where it was and fills to where it is now (one short move, skipped under reduced motion or a tap; D38).
   */
  function nextFriendMarkup(where: SanctuaryId | null, grew = false, before: ReturnType<typeof arrivalProgress> = null): string {
    if (mode.kind === 'cup') return '';
    if (!where) return upNextMarkup(null);
    const p = arrivalProgress(app.save, where);
    const def = sanctuaryDef(where);
    // D40: the step is its own small celebration ("Meadow Farm +1"), then what it brought closer, in a few words.
    const plus = grew ? `<p class="win-plus-line" style="--accent:${def.accent}"><b class="win-plus">${esc(def.name)} +1</b></p>` : '';
    if (!p) {
      const st = nextStage(app.save, where);
      // Finished here: the line points at what the next puzzle helps instead (D39), so a win always says what's next.
      if (!st) return plus + upNextMarkup(where);
      const left = st.need - st.have;
      const away = left === 1 ? 'one more puzzle' : `${left} more puzzles`;
      return `${plus}<div class="win-growth" style="--accent:${def.accent}">${ICON.sprout}<span class="win-growth__body">${grew ? `<b class="win-closer">One puzzle closer to ${esc(st.stage.name)}!</b><small>${esc(capitalize(away))} to go</small>` : `<span>${esc(capitalize(away))} to ${esc(st.stage.name.toLowerCase())}</span>`}</span></div>`;
    }
    const a = animalInfo(p.next.id);
    const span = Math.max(1, p.need - p.from);
    const pct = Math.round(((p.have - p.from) / span) * 100);
    const sameFriend = grew && before && before.next.id === p.next.id;
    const pct0 = sameFriend ? Math.round(((before.have - before.from) / Math.max(1, before.need - before.from)) * 100) : pct;
    const away = p.left === 1 ? 'one more puzzle' : `${p.left} more puzzles`;
    const step = sameFriend && before.left !== p.left ? `${esc(a.name)} the ${esc(a.noun)}: <span class="num">${before.left} → ${p.left}</span> ${p.left === 1 ? 'puzzle' : 'puzzles'} away` : `${esc(a.name)} the ${esc(a.noun)} is on the way: ${away}`;
    const head = grew ? `<b class="win-closer">One puzzle closer to ${esc(a.name)}!</b>` : '';
    return `${plus}<div class="win-next-friend" style="--accent:${def.accent}"><span class="win-next-friend__art is-shy">${animalPortrait(p.next.id, 'idle')}</span><span class="win-growth__body">${head}<span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${p.from}" aria-valuemax="${p.need}" aria-valuenow="${p.have}"><span data-grow-bar data-to="${pct}" style="width:${pct0}%"></span></span>${grew ? `<small>${step}</small>` : `<span>${step.replace(/^([^:]+?)( is on the way|:)/, '<b>$1</b>$2')}</span>`}</span></div>`;
  }

  /**
   * What the next puzzle helps when the sanctuary this board was for has nothing left to grow (D39): the animal on its
   * way to the home being built now, or the next home to open. Never empty while there is anything left in the world.
   */
  function upNextMarkup(finished: SanctuaryId | null): string {
    const act = activeSanctuary(app.save);
    if (act && act !== finished) {
      const def = sanctuaryDef(act);
      const p = arrivalProgress(app.save, act);
      const st = nextStage(app.save, act);
      if (p) {
        const a = animalInfo(p.next.id);
        const pct = Math.round(((p.have - p.from) / Math.max(1, p.need - p.from)) * 100);
        const away = p.left === 1 ? 'one more puzzle' : `${p.left} more puzzles`;
        return `<div class="win-next-friend" data-up-next style="--accent:${def.accent}"><span class="win-next-friend__art is-shy">${animalPortrait(p.next.id, 'idle')}</span><span class="win-growth__body"><span>Up next at the ${esc(def.short)}: <b>${esc(a.name)} the ${esc(a.noun)}</b>, ${away}</span><span class="progress world-progress" role="progressbar" aria-label="${esc(a.name)} coming home" aria-valuemin="${p.from}" aria-valuemax="${p.need}" aria-valuenow="${p.have}"><span style="width:${pct}%"></span></span></span></div>`;
      }
      if (st) {
        const left = st.need - st.have;
        return `<div class="win-growth" data-up-next style="--accent:${def.accent}">${ICON.sprout}<span>Up next at the ${esc(def.short)}: ${left === 1 ? 'one more puzzle' : `${left} more puzzles`} to ${esc(st.stage.name.toLowerCase())}</span></div>`;
      }
    }
    const up = nextToOpen(app.save);
    if (!up) return '';
    return `<div class="win-growth" data-up-next style="--accent:${up.def.accent}">${ICON.globe}<span>Next home: the <b>${esc(up.def.name)}</b> opens after level ${up.def.opensAfterLevel} · ${up.left === 1 ? 'one more level' : `${up.left} levels to go`}</span></div>`;
  }

  function newsMarkup(nw: MetaNews): string {
    if (!nw.achievements.length && !nw.missions.length) return '';
    const badges = nw.achievements
      .map(
        (a) =>
          `<div class="reward-item"><span class="reward-item__art reward-item__art--badge">${ICON[a.icon]}</span><span><b>Badge: ${esc(a.name)}</b><small>${esc(a.description)} +${a.coins} coins</small></span></div>`,
      )
      .join('');
    const missions = nw.missions.length
      ? `<p class="win-missions">${ICON.check}${nw.missions.length === 1 ? `Mission done: ${esc(nw.missions[0].title)}` : `${nw.missions.length} missions done`}. Claim on Journey.</p>`
      : '';
    return `<div class="win-news">${badges}${missions}</div>`;
  }

  function cupMarkup(sc: ScoreBreakdown | null): string {
    if (!sc) return '';
    return `<div class="score-card">
      <div class="score-card__total"><span class="num">${sc.total}</span><small>points</small></div>
      <dl class="score-card__rows">
        <div><dt>Finished</dt><dd class="num">${sc.base}</dd></div>
        <div><dt>Speed</dt><dd class="num">+${sc.time}</dd></div>
        <div><dt>Accuracy</dt><dd class="num">+${sc.accuracy}</dd></div>
      </dl>
      <p class="score-card__note">${ICON.info}Practice score, kept on this device. Not ranked against anyone.</p>
    </div>`;
  }

  /** Paw Points earned and how far the player is along their Paw Rank (progress only, never a ranking). */
  function pointsMarkup(r: RewardSummary): string {
    if (!r.points) return '';
    const total = pawPoints(app.save);
    const rank = rankFor(total);
    const rankUp = rank.index > rankFor(total - r.points).index;
    const nextName = rank.next !== null ? rankFor(rank.next).name : null;
    const pct = rank.next !== null ? Math.round(((total - rank.from) / (rank.next - rank.from)) * 100) : 100;
    const line = rankUp
      ? `New Paw Rank: <b>${esc(rank.name)}</b>!`
      : nextName
        ? `${esc(rank.name)} · ${rank.next! - total} to ${esc(nextName)}`
        : esc(rank.name);
    return `<div class="win-points">
      <span class="win-points__amt">${ICON.sparkle}<b class="num">+<span data-count="${r.points}">${r.points}</span></b> Paw Points</span>
      <span class="rank-bar" role="progressbar" aria-label="Paw Rank progress" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${pct}"><span style="width:${pct}%"></span></span>
      <small class="win-points__rank ${rankUp ? 'is-up' : ''}">${line}</small>
    </div>`;
  }

  /**
   * One line on the skill shown (D38): the board's measured tier, with "What made it hard?" opening the grader's own
   * reason on demand (never an invented tip). Easy boards say nothing: the line is for a step up.
   */
  function skillMarkup(): string {
    if (profile.tier === 'easy') return '';
    return `<p class="win-skill" data-skill>${ICON.target}<span>You solved a <b>${esc(tierName)}</b> ${n}×${n}.</span> <button class="win-skill__why" data-act="why">What made it ${esc(profile.tier)}?</button></p>`;
  }

  /** On a replay: what's still there to improve, instead of rewards that were already paid. */
  function replayMarkup(rec: WinRecord, seconds: number): string {
    if (mode.kind !== 'level' || rec.firstClear) return '';
    const clear = app.save.journey.clears[`L${mode.level}`];
    const missing: string[] = [];
    if (clear && !clear.clean) missing.push('with no mistakes');
    if (clear && !clear.hintFree) missing.push('without hints');
    const text =
      rec.isBest && rec.prevBest !== null
        ? `${fmtClock(rec.prevBest - seconds)} faster than your best.`
        : missing.length
          ? `${missing.length === 2 ? 'Two stars' : 'One star'} still to earn: solve it ${missing.join(' and ')}.`
          : `All three stars here. Best time ${fmtClock(app.save.journey.bestTimes[`L${mode.level}`] ?? 0)}.`;
    return `<p class="win-replay">${ICON.target}${esc(text)}</p>`;
  }
  /** Whether this newcomer is the first animal ever to come home (nobody else lives anywhere yet): D41's first arrival. */
  function isFirstArrival(id: AnimalId): boolean {
    const inv = app.save.inventory;
    const homes = [...Object.keys(inv.companions), ...Object.keys(inv.pets)];
    return homes.length === 1 && homes[0] === id;
  }

  function showWin(rec: WinRecord, seconds: number, rewards: RewardSummary, news: MetaNews, cupScore: ScoreBreakdown | null, growth: GrowthNews | null, step: WorldStep): void {
    // A visit worth making: a newly opened sanctuary first (that is the news), else a new stage or a new friend.
    const worldVisit: SanctuaryId | null = growth ? (growth.opened[0] ?? (growth.stageUp || growth.arrived.length || growth.completed ? growth.sanctuary : null)) : null;
    const next = nextAfterWin(mode);
    const arrived = growth?.growth ? growth.arrived : [];
    const meet = arrived.length > 0;
    const hero = heroOf(growth);
    // A milestone win puts the event first and the visit as its main action; the next puzzle stays one tap away as a
    // full-size second button. An ordinary win is quick: the next puzzle is the main action, the visit a quiet one.
    const milestone = isMilestone(growth) && mode.kind !== 'cup';
    // D41: the very first animal to come home (the first puzzle's Cotton) is shown happening, not reported: the Farm as
    // it was, the change growing in, the newcomer settling in, then the goal for the next animal. Skippable. Journey
    // levels only: a Daily solved first keeps its own results (streak, time, Share), with Cotton's Meet on them.
    if (growth && hero?.kind === 'arrived' && isFirstArrival(hero.animal) && isRegionId(growth.sanctuary) && mode.kind === 'level') {
      const holds: string[] = [];
      if (rewards.coins) holds.push(`+${rewards.coins} coins`);
      if (rewards.points) holds.push(`+${rewards.points} Paw Points`);
      if (news.achievements.length) holds.push(plural(news.achievements.length, 'badge'));
      showFirstArrival(scope, el, {
        animal: hero.animal,
        where: growth.sanctuary,
        stageUp: growth.stageUp ? stageOf(app.save, growth.sanctuary) : null,
        nextLevel: typeof next === 'object' && next.kind === 'level' ? next.level : null,
        holds,
        onPlay: () => {
          if (typeof next === 'object') playMode(next);
          else app.router.back({ screen: 'journey' });
        },
        onVisit: () => app.router.go({ screen: 'region', id: growth.sanctuary as RegionId }),
      });
      return;
    }
    const nextLabel = typeof next === 'object' && next.kind === 'level' ? `Play level ${next.level}` : next === 'cup' ? 'Back to Paw Cup' : 'Back to Journey';
    const visitAct = hero?.kind === 'opened' ? 'region' : meet ? 'meet' : 'region';
    const visitLabel =
      hero?.kind === 'opened'
        ? `Explore the ${sanctuaryDef(hero.region).short}`
        : meet
          ? `Meet ${animalInfo(arrived[0]).name}`
          : worldVisit
            ? `Visit the ${sanctuaryDef(worldVisit).short}`
            : 'Visit sanctuary';
    const primaryLabel = milestone ? visitLabel : nextLabel;
    const badges: string[] = [];
    if (rec.clean) badges.push(`<span class="chip chip--brand">${ICON.check}Clean solve</span>`);
    if (rec.isBest && rec.prevBest !== null) badges.push(`<span class="chip chip--gold">${ICON.sparkle}New best</span>`);
    if (rec.usedCozyDay) badges.push(`<span class="chip">Cozy Day kept your streak</span>`);
    const streak = mode.kind === 'daily' && rec.streak ? `<span class="chip chip--coral">${ICON.flame}${plural(rec.streak, 'day')} streak</span>` : '';
    const stars =
      mode.kind === 'level'
        ? `<div class="win-stars${milestone ? '' : ' win-stars--small'}" role="img" aria-label="${rec.stars} of 3 stars">${[1, 2, 3].map((i) => (i <= rec.stars ? ICON.star : ICON.starOff)).join('')}</div>`
        : '';
    const stats = `<div class="stats">
            <div class="stat"><div class="stat__v">${fmtClock(seconds)}</div><div class="stat__k">${rules.timer ? 'time' : 'time (untimed)'}</div></div>
            <div class="stat"><div class="stat__v">${s.mistakes}</div><div class="stat__k">${s.mistakes === 1 ? 'mistake' : 'mistakes'}</div></div>
            <div class="stat"><div class="stat__v">${s.hintsUsed}</div><div class="stat__k">${s.hintsUsed === 1 ? 'hint' : 'hints'}</div></div>
          </div>`;
    // What the next puzzle brings closer: the step this solve took, or (a replay, a finished home) what's up next.
    const nextLine = growth?.growth ? nextFriendMarkup(growth.sanctuary, true, step.friendBefore) : step.replay ? replayWorldMarkup() : nextFriendMarkup(activeSanctuary(app.save));
    const redirect = growth?.growth && growth.redirectedFrom ? `<p class="win-note muted">${ICON.info}The ${esc(sanctuaryDef(growth.redirectedFrom).name)} is finished, so this board helped the ${esc(sanctuaryDef(growth.sanctuary).short)} instead.</p>` : '';
    // D40: the first view is the reward. A milestone: the event itself (the newcomer, a new home), and any other news of
    // this solve. An ordinary win: the stars, the step the world took, and what it brought closer. Everything else (time,
    // badges, coins, points, missions) is one tap away in a fold under the buttons, with what it holds in its summary.
    const first =
      milestone && hero && growth
        ? `${heroMarkup(growth, hero)}${streak ? `<div class="win-badges">${streak}</div>` : ''}${growthMarkup(growth, hero)}`
        : `${winPet ? `<div class="win-pet">${animalSvg(winPet, { mood: 'proud' })}</div>` : ''}${stars}${streak ? `<div class="win-badges">${streak}</div>` : ''}${cupMarkup(cupScore)}${step.replay ? replayMarkup(rec, seconds) : ''}${redirect}${mode.kind === 'cup' || step.replay ? '' : nextLine}`;
    const details = [
      milestone ? stars : '',
      stats,
      badges.length ? `<div class="win-badges">${badges.join('')}</div>` : '',
      skillMarkup(),
      step.replay ? '' : replayMarkup(rec, seconds),
      pointsMarkup(rewards),
      rewardsMarkup(rewards),
      newsMarkup(news),
      milestone ? `<div class="win-world">${nextLine}</div>` : step.replay ? nextLine : '',
      `<div class="win-secondary"><button class="btn btn--quiet" data-act="share" aria-label="Share result">${ICON.share}Share</button></div>`,
    ].join('');
    // The fold's summary says what's inside, so nothing is hidden by surprise.
    const holds: string[] = [];
    if (rewards.coins) holds.push(`+${rewards.coins} coins`);
    if (rewards.points) holds.push(`+${rewards.points} Paw Points`);
    if (news.achievements.length) holds.push(plural(news.achievements.length, 'badge'));
    if (news.missions.length) holds.push(news.missions.length === 1 ? 'a mission done' : `${news.missions.length} missions done`);
    if (rewards.decor.length) holds.push(rewards.decor.length === 1 ? 'a gift' : `${rewards.decor.length} gifts`);
    if (rewards.lives) holds.push(`+${plural(rewards.lives, 'extra life', 'extra lives')}`);
    if (rewards.hints) holds.push(`+${plural(rewards.hints, 'hint')}`);
    // With no rewards to list, the summary still names what the fold holds.
    const inside = [milestone && stars ? 'stars' : '', milestone || step.replay ? 'time' : 'time, mistakes and hints', milestone || step.replay ? "what's next" : ''].filter(Boolean);
    const insideLine = capitalize(inside.length > 1 ? `${inside.slice(0, -1).join(', ')} and ${inside[inside.length - 1]}` : inside[0]);
    const visitQuiet =
      mode.kind === 'cup'
        ? ''
        : worldVisit
          ? `<button class="btn btn--quiet" data-act="region">${ICON.globe}Visit the ${esc(sanctuaryDef(worldVisit).short)}</button>`
          : growth?.growth
            ? `<button class="btn btn--quiet" data-act="region">${ICON.home}Visit the ${esc(sanctuaryDef(growth.sanctuary).short)}</button>`
            : `<button class="btn btn--quiet" data-act="sanctuary">${ICON.home}Visit sanctuary</button>`;
    sheet = openSheet(scope, {
      title: milestone && hero && growth ? heroTitle(growth, hero) : 'Puzzle solved!',
      center: true,
      dismissible: false,
      className: `win-sheet${milestone ? ' win-sheet--milestone' : ''}`,
      body: `
        <div class="win-stage win-stage-1">${first}</div>
        <div class="sheet__actions win-stage win-stage-2">
          ${
            milestone
              ? `<button class="btn btn--block" data-act="${visitAct}" data-autofocus>${esc(primaryLabel)}</button>
          <button class="btn btn--secondary btn--block" data-act="next">${esc(nextLabel)}</button>`
              : `<button class="btn btn--block" data-act="next" data-autofocus>${esc(primaryLabel)}</button>
          ${visitQuiet ? `<div class="win-secondary">${visitQuiet}</div>` : ''}`
          }
        </div>
        <details class="win-more win-stage win-stage-3" data-win-more>
          <summary class="win-more__summary"><span class="win-more__text"><b class="win-more__label">${holds.length ? 'More rewards' : 'Details'}</b><small class="win-more__holds">${esc(holds.length ? holds.join(' · ') : insideLine)}</small></span>${ICON.chevron}</summary>
          <div class="win-more__body">${details}</div>
        </details>`,
    });
    const ws = sheet;
    let leaving = false;
    // D40: a new animal has a sound of its own, a beat after the success melody, as its portrait comes up.
    if (milestone && hero?.kind === 'arrived') ws.scope.timeout(() => feel('arrival'), app.reducedMotion ? 300 : 900);
    // Paw Points count up while the results rise (skipped with reduced motion or a tap).
    const counter = ws.el.querySelector('[data-count]') as HTMLElement | null;
    // The sanctuary bar moves from where it was to where it is now: one short step, a beat after the results rise.
    const growBar = ws.el.querySelector('[data-grow-bar]') as HTMLElement | null;
    const settleBar = () => {
      if (growBar) growBar.style.width = `${growBar.dataset.to}%`;
    };
    const reveal = () => {
      ws.el.classList.add('is-revealed');
      if (counter) counter.textContent = counter.dataset.count ?? counter.textContent;
      settleBar();
    };
    if (growBar && !app.reducedMotion) ws.scope.timeout(() => ws.scope.frame(settleBar), 650);
    if (counter && !app.reducedMotion) {
      const target = Number(counter.dataset.count);
      const t0 = performance.now() + 300;
      counter.textContent = '0';
      const step = () => {
        // A tap may have revealed the final number between frames; never overwrite it.
        if (!ws.scope.alive || ws.el.classList.contains('is-revealed')) return;
        const k = Math.min(1, Math.max(0, (performance.now() - t0) / 600));
        counter.textContent = String(Math.round(target * (1 - Math.pow(1 - k, 3))));
        if (k < 1 && !ws.el.classList.contains('is-revealed')) ws.scope.frame(step);
      };
      ws.scope.frame(step);
    }
    ws.scope.on(ws.el, 'pointerdown', reveal);
    // Reduced motion: everything at once, no staged delays.
    if (app.reducedMotion) reveal();
    ws.scope.on(ws.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || leaving) return;
      if (a.act === 'share') {
        void shareResult(seconds);
        return;
      }
      if (a.act === 'why') {
        const why = ws.el.querySelector('[data-skill]');
        if (why) why.innerHTML = `${ICON.target}<span>${esc(tierName)}: ${esc(difficultyReason(profile))}</span>`;
        return;
      }
      leaving = true;
      ws.close();
      if (a.act === 'meet' || a.act === 'sanctuary' || a.act === 'region') {
        // The sanctuary the news is about: a newcomer's home, the region that opened (or the one that grew), or the one being built.
        const where: SanctuaryId =
          a.act === 'meet' ? (growth?.sanctuary ?? 'harmony') : a.act === 'region' ? (worldVisit ?? growth?.sanctuary ?? 'harmony') : (activeSanctuary(app.save) ?? 'harmony');
        const welcome = a.act === 'meet' ? arrived : [];
        if (isRegionId(where))
          app.router.go({ screen: 'region', id: where, fresh: growth?.stageUp && growth.sanctuary === where ? stageOf(app.save, where) : 0, welcome });
        else app.router.go({ screen: 'sanctuary', welcome });
        return;
      }
      // Celebration first, always. An interstitial (if any network is live) can only follow the player's tap.
      await maybeInterstitial();
      // Through playMode like every other play button (D38): this board's slot was just cleared, so it starts fresh.
      if (typeof next === 'object') playMode(next);
      else app.router.back({ screen: next === 'cup' ? 'challenges' : 'journey' });
    });
  }

  async function shareResult(seconds: number): Promise<void> {
    const what = mode.kind === 'daily' ? `Daily ${mode.dateKey}` : modeTitle(mode);
    const text = `PawTyk ${what}: solved in ${fmtClock(seconds)}${s.mistakes === 0 ? ' with no mistakes' : ''}.`;
    try {
      if (navigator.share) await navigator.share({ text });
      else {
        await navigator.clipboard.writeText(text);
        coach('Result copied.');
      }
    } catch {
      /* cancelled */
    }
  }

  async function maybeInterstitial(): Promise<void> {
    const today = new Date().toDateString();
    if (cadence.day !== today) {
      cadence.day = today;
      cadence.shownToday = 0;
    }
    const ok =
      INTERSTITIALS_ENABLED &&
      ads.available &&
      shouldShowInterstitial(
        {
          removeAds: app.removeAds,
          levelsCompleted: app.save.journey.nextLevel - 1,
          boardsSinceLast: cadence.boardsSinceLast,
          lastShownAt: cadence.lastShownAt,
          shownToday: cadence.shownToday,
        },
        { mode: mode.kind, outcome: 'won', now: Date.now() },
      );
    if (!ok) return;
    if (await ads.showInterstitial()) {
      cadence.boardsSinceLast = 0;
      cadence.lastShownAt = Date.now();
      cadence.shownToday++;
    }
  }

  function onLose(): void {
    pauseBoard();
    recordLoss(app.save);
    if (mode.kind === 'cup') {
      finishAttempt(app.save, mode, s.events, s.elapsedMs());
      app.clearSaved(mode);
      app.active = null;
      app.persist();
    }
    // A lost board isn't resumable (only a refill brings it back), so this clears its save slot.
    app.saveActive();
    track('puzzle_fail', { mode: mode.kind, size: n });
    feel('lost');
    const canLife = pantryOn && lives() > 0;
    const canRevive = pantryOn && !canLife && canOfferVideo();
    const wrongs = `${numberWord(s.maxHearts)} wrong placements`;
    sheet = openSheet(scope, {
      title: mode.kind === 'cup' ? 'Attempt ended' : 'Out of hearts',
      center: true,
      dismissible: false,
      body: `
        <p class="sheet__lead">${mode.kind === 'cup' ? `${wrongs} end a Paw Cup attempt.` : canLife || canRevive ? `${wrongs}. Keep this board with a heart back, or start fresh.` : `${wrongs}. Start this board again with a fresh line of logic.`}</p>
        <div class="sheet__actions">
          ${canLife ? `<button class="btn btn--block" data-act="life">${ICON.lifePlus}Use an extra life: +1 heart<span class="btn__price">${lives()} left</span></button>` : ''}
          ${canRevive ? `<button class="btn btn--block" data-act="revive">${ICON.videoToken}Watch a short video: +1 heart</button>` : ''}
          ${mode.kind === 'cup' ? '' : `<button class="btn ${canRevive || canLife ? 'btn--secondary' : ''} btn--block" data-act="restart">${ICON.restart}Try again</button>`}
          <button class="btn btn--quiet" data-act="leave">${mode.kind === 'cup' ? 'Back to Paw Cup' : 'Back to Journey'}</button>
        </div>`,
    });
    const ls = sheet;
    let busy = false;
    ls.scope.on(ls.el, 'click', async (e) => {
      const a = actionOf(e);
      if (!a || busy) return;
      if (a.act === 'life') {
        busy = true;
        const ok = useLife();
        busy = false;
        if (!ok) return;
        ls.close();
        sheet = null;
        coach('An extra life! One heart back, and your board is just as you left it.');
        resumeIfOnScreen();
        return;
      }
      if (a.act === 'revive') {
        busy = true;
        const r = await watchVideoFor('life');
        busy = false;
        if (r !== 'granted') {
          toast(videoMessage(r));
          return;
        }
        // The extra life is kept in the pantry if the player left meanwhile; otherwise it brings this board back.
        if (!scope.alive || !ls.scope.alive || !useLife()) return;
        ls.close();
        sheet = null;
        coach('Thanks for watching! One heart back, and your board is just as you left it.');
        resumeIfOnScreen();
      } else if (a.act === 'restart') {
        ls.close();
        restartGame();
      } else {
        ls.close();
        app.clearSaved(mode);
        app.active = null;
        app.persist();
        app.router.back({ screen: mode.kind === 'cup' ? 'challenges' : 'journey' });
      }
    });
  }

  // ---------------------------------------------------------------- start

  scope.on(document, 'visibilitychange', () => faces.setAmbient(!document.hidden && !s.paused && !finished));

  coach(defaultCoach());
  paint();
  if (rules.timer) scope.interval(tick, 500);
  scope.onDispose(() => {
    if (!finished) {
      s.pause();
      app.saveActive();
    }
  });
  s.resume();
  const ob = app.save.onboarding;
  if (pairLesson && !ob.pairRulesSeen) {
    // Level 21's bridge: one short sheet with the two-animal rules drawn with this board's animals, then the guided
    // lesson places the first two. Shown once.
    ob.seenRules = true;
    ob.pairRulesSeen = true;
    app.persist();
    pauseBoard();
    track('onboarding_step', { step: 'pair_bridge' });
    showRules(
      scope,
      () => {
        resumeIfOnScreen();
        startGuide(1);
        paint();
      },
      { rule: s.rule, cast, bridge: true },
    );
  } else if (guided) {
    // The guided boards teach their rule as they go.
    ob.seenRules = true;
    if (solo) ob.soloRulesSeen = true;
    else ob.pairRulesSeen = true;
    app.persist();
    startGuide(1);
    paint();
  } else if (solo ? !ob.soloRulesSeen : !ob.pairRulesSeen) {
    // The first board under a rule the player hasn't been shown (a returning player's first one-animal board, a Daily
    // before the lesson): the short how-to sheet first.
    pauseBoard();
    showRules(
      scope,
      () => {
        ob.seenRules = true;
        if (solo) ob.soloRulesSeen = true;
        else ob.pairRulesSeen = true;
        app.persist();
        resumeIfOnScreen();
      },
      { rule: s.rule, cast },
    );
  }
}

const NUMBER_WORDS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
function numberWord(n: number): string {
  return NUMBER_WORDS[n] ?? String(n);
}

function videoMessage(r: WatchResult): string {
  if (r === 'cap') return "That's all the videos for today. More tomorrow.";
  if (r === 'unavailable') return 'Videos are not available in this version.';
  return 'No video is available right now. Nothing was used; try again in a little while.';
}
