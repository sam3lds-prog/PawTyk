/**
 * The world map's progress (D35, D38). The Farm and the Pet Garden are open from the start; the exotic regions open at
 * Journey levels. The sanctuary you're building grows by one for every *new* puzzle you solve (Journey, Daily or Zen;
 * the Paw Cup is competition, so it doesn't count): each Journey level grows it once, each day's Daily once, each fresh
 * Zen board once (growth policy 2, D38). A replay of a cleared level still sharpens stars and times, but doesn't grow
 * the world, so the fastest way to bring an animal home is to keep going. Its animals arrive one by one at set growth
 * counts, the Farm and the regions also grow through drawn stages, and finishing a sanctuary (everyone home, last
 * stage reached) gives a coin gift. All of it is idempotent: stages and arrivals are derived from the growth count, so
 * re-running it (startup reconcile, a double tap) never grants twice.
 */

import type { ModeRef } from '../game/modes';
import type { SaveV2, UnseenNews } from '../services/storage';
import { sanctuaryDef, arrivalOf, REGIONS, SANCTUARIES, SANCTUARY_BY_ID, isSanctuaryId, type AnimalId, type Arrival, type RegionId, type SanctuaryDef, type SanctuaryId, type StageDef } from './catalogs/sanctuaries';
import { FIRST_PLACE_AFTER, LEVELS_PER_PLACE, MAX_PLACE, isPlaceId, placeDef, placeId, placeIndex, type PlaceId } from './catalogs/places';
import { animalInfo, homeAnimals, homeSince, isHome, nextArrivalIn, welcomeAnimal } from './animals';
import { grant } from './ledger';

type WorldSave = Pick<SaveV2, 'journey' | 'world' | 'inventory'>;

/** Journey levels cleared so far. */
const cleared = (save: Pick<SaveV2, 'journey'>) => save.journey.nextLevel - 1;

export function growthOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  return save.world.growth[id] ?? 0;
}

type OpenSave = Pick<SaveV2, 'journey' | 'world'> & Partial<Pick<SaveV2, 'inventory'>>;

/**
 * Open once its Journey level is cleared; one you already started building stays open whatever the level. A place of
 * the endless world (D39) also opens as soon as every home before it is complete, so a player who has finished
 * everything always has somewhere new to build.
 */
export function isOpen(save: OpenSave, id: SanctuaryId): boolean {
  if (isPlaceId(id)) {
    // Most places are open by level or because they have grown (cheap); only the one after those needs the full walk.
    const k = placeIndex(id);
    const n = placesOpenSoFar(save);
    return k <= n || (k === n + 1 && openPlaceCount(save) > n);
  }
  return cleared(save) >= sanctuaryDef(id).opensAfterLevel || growthOf(save, id) > 0;
}

/**
 * Places open by level (closed form, nothing to generate) or because they have grown: the highest place that has grown
 * was opened by the "everything before is complete" rule, and anything that has grown stays open (never take away).
 */
function placesOpenSoFar(save: OpenSave): number {
  const c = cleared(save);
  let n = c >= FIRST_PLACE_AFTER ? Math.min(MAX_PLACE, Math.floor((c - FIRST_PLACE_AFTER) / LEVELS_PER_PLACE) + 1) : 0;
  for (const [key, g] of Object.entries(save.world.growth)) if ((g ?? 0) > 0 && isPlaceId(key)) n = Math.max(n, placeIndex(key));
  return n;
}

/**
 * How many places of the endless world are open. They open in order (each one's level comes after the last one's, and
 * the "everything before is complete" rule can only reach a place after the one before it), so the open places are
 * always places 1…N; one walk finds N.
 */
export function openPlaceCount(save: OpenSave): number {
  const n = placesOpenSoFar(save);
  // Every home up to n finished: the next one opens now.
  const inv = save.inventory;
  if (!inv || n >= MAX_PLACE) return n;
  const done = (id: SanctuaryId) => isComplete({ world: save.world, inventory: inv }, id);
  if (!SANCTUARIES.every((s) => done(s.id))) return n;
  for (let k = 1; k <= n; k++) if (!done(placeId(k))) return n;
  return n + 1;
}

/**
 * Every sanctuary the world has for this save, in building order: the six hand-made ones, each open place, and the
 * next place still to open (so the map and the lists always show what comes next).
 */
export function worldIds(save: OpenSave): SanctuaryId[] {
  const n = openPlaceCount(save);
  // The next place shows once every hand-made home is open (from level 60): before that, the regions are what's next.
  const teaser = n > 0 || SANCTUARIES.every((s) => isOpen(save, s.id)) ? 1 : 0;
  const places: PlaceId[] = [];
  for (let k = 1; k <= Math.min(MAX_PLACE, n + teaser); k++) places.push(placeId(k));
  return [...SANCTUARIES.map((s) => s.id), ...places];
}

/** Stage index reached at a growth count (0 = empty land; always 0 for the Pet Garden, which has no stages). */
export function stageAt(def: SanctuaryDef, growth: number): number {
  let s = 0;
  for (let i = 0; i < def.stages.length; i++) if (growth >= def.stages[i].at) s = i;
  return s;
}

export function stageOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  return stageAt(sanctuaryDef(id), growthOf(save, id));
}

const lastStage = (def: SanctuaryDef) => Math.max(0, def.stages.length - 1);

/** Everyone has arrived and the last stage (if any) is reached. */
export function isComplete(save: Pick<SaveV2, 'world' | 'inventory'>, id: SanctuaryId): boolean {
  const def = sanctuaryDef(id);
  return stageOf(save, id) >= lastStage(def) && def.arrivals.every((a) => isHome(save, a.id));
}

/** Progress toward the next stage, for bars and labels. Null when there are no more stages. */
export function nextStage(save: Pick<SaveV2, 'world'>, id: SanctuaryId): { stage: StageDef; index: number; have: number; need: number; from: number } | null {
  const def = sanctuaryDef(id);
  const s = stageOf(save, id);
  if (s >= def.stages.length - 1) return null;
  const g = growthOf(save, id);
  return { stage: def.stages[s + 1], index: s + 1, have: g, need: def.stages[s + 1].at, from: def.stages[s].at };
}

/**
 * The animal being brought home next and how far along it is: `have` of `need` puzzles, counted from `from` (the
 * previous arrival). Null when everyone has arrived.
 */
export function arrivalProgress(
  save: Pick<SaveV2, 'world' | 'inventory'>,
  id: SanctuaryId,
): { next: Arrival; have: number; need: number; from: number; left: number } | null {
  const next = nextArrivalIn(save, id);
  if (!next) return null;
  const def = sanctuaryDef(id);
  const i = def.arrivals.indexOf(next);
  const from = i > 0 ? def.arrivals[i - 1].at : 0;
  const have = growthOf(save, id);
  return { next, have, need: next.at, from: Math.min(from, have), left: Math.max(1, next.at - have) };
}

/** Overall completion, 0–1 (for the map pin ring): growth toward the last stage or the last arrival, whichever is later. */
export function progressOf(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  const def = sanctuaryDef(id);
  const last = Math.max(def.stages[def.stages.length - 1]?.at ?? 0, def.arrivals[def.arrivals.length - 1]?.at ?? 0, 1);
  return Math.min(1, growthOf(save, id) / last);
}


/** The sanctuary you're building: the chosen one if it's open and unfinished, else the first such one, else null. */
export function activeSanctuary(save: WorldSave): SanctuaryId | null {
  const a = save.world.active;
  if (isSanctuaryId(a) && isOpen(save, a) && !isComplete(save, a)) return a;
  // In building order: the Farm, the Pet Garden, the regions as they open, then the endless world's open places (one
  // walk each, so a long world stays quick).
  for (const s of SANCTUARIES) if (isOpen(save, s.id) && !isComplete(save, s.id)) return s.id;
  for (let k = 1, n = openPlaceCount(save); k <= n; k++) if (!isComplete(save, placeId(k))) return placeId(k);
  return null;
}

/** Chooses which open, unfinished sanctuary to build. */
export function setActive(save: WorldSave, id: SanctuaryId): boolean {
  if (!isOpen(save, id) || isComplete(save, id)) return false;
  save.world.active = id;
  return true;
}

/** Animals whose arrival count this sanctuary has reached (and not yet recorded). Idempotent. */
function welcomeArrivals(save: WorldSave, id: SanctuaryId, now: Date): AnimalId[] {
  const g = growthOf(save, id);
  const out: AnimalId[] = [];
  for (const a of sanctuaryDef(id).arrivals) if (a.at <= g && welcomeAnimal(save, a.id, now)) out.push(a.id);
  return out;
}

export interface GrowthNews {
  sanctuary: SanctuaryId;
  growth: number;
  /** The stage just reached, if this solve reached one. */
  stageUp: StageDef | null;
  arrived: AnimalId[];
  completed: boolean;
  coins: number;
  /** Sanctuaries that opened with this solve (a Journey milestone). */
  opened: RegionId[];
  /**
   * The sanctuary the board was for when its credit went elsewhere: it was finished (or no longer open) by the time the
   * board was solved, so the solve helped the one being built now instead. Null when the board's own sanctuary grew.
   */
  redirectedFrom: SanctuaryId | null;
  /** True when this puzzle had grown the world before (a replay), so nothing grew this time. */
  replayed: boolean;
}

/** Whether a solved board counts toward sanctuary growth (everything but the Paw Cup; the guided first board brings the first animal home). */
export function countsForGrowth(mode: ModeRef, _tutorial = false): boolean {
  return mode.kind !== 'cup';
}

/**
 * Growth policy 2 (D38): a puzzle grows the world once. The puzzle is its mode key (`L8`, `D2026-10-31s`, `Z6-7000103s`),
 * so a replay of a cleared level, of a finished Daily, or of the very same Zen board (a restart) is a new *board* but not
 * a new *puzzle*. Zen keys are many and never come back once the next board is dealt, so only the newest are kept.
 */
export const GROWTH_POLICY = 2;
const ZEN_GROWN_KEPT = 120;

/** Has this puzzle already grown the world? (Boards built by hand without a key never have.) */
export function alreadyGrown(save: Pick<SaveV2, 'world'>, puzzle: string | undefined): boolean {
  return !!puzzle && !!save.world.grown && puzzle in save.world.grown;
}

function recordGrown(save: Pick<SaveV2, 'world'>, puzzle: string | undefined, now: Date): void {
  if (!puzzle) return;
  const grown = (save.world.grown ??= {});
  grown[puzzle] = now.toISOString();
  const zen = Object.keys(grown).filter((k) => k.startsWith('Z'));
  for (const k of zen.slice(0, Math.max(0, zen.length - ZEN_GROWN_KEPT))) delete grown[k];
}

/**
 * Moves a save to growth policy 2, once: every level already cleared and every Daily already done is marked as having
 * grown the world, so replaying them grows nothing more. Growth counts, arrivals and gifts already earned are untouched.
 */
export function upgradeGrowthPolicy(save: Pick<SaveV2, 'world' | 'journey' | 'daily'>, now = new Date()): boolean {
  if ((save.world.policy ?? 1) >= GROWTH_POLICY) return false;
  const grown = (save.world.grown ??= {});
  const at = now.toISOString();
  for (const k of Object.keys(save.journey.clears)) if (/^L\d+$/.test(k)) grown[k] ??= at;
  for (const d of Object.keys(save.daily.done)) {
    grown[`D${d}`] ??= at;
    grown[`D${d}s`] ??= at;
  }
  save.world.policy = GROWTH_POLICY;
  return true;
}

/** Can a sanctuary still take growth: open and not yet complete. */
export function canGrow(save: WorldSave, id: SanctuaryId): boolean {
  return isOpen(save, id) && !isComplete(save, id);
}

/**
 * Which sanctuary a solved board helps. A board helps the sanctuary it was cast for when it started (`cast.sanctuary`),
 * whatever the player chose to build since: switching sanctuaries changes the *next* board, never one already on the
 * table. Only when that sanctuary can't grow any more (it was finished while the board sat saved) does the credit go
 * to the one being built now; with nothing to build, nothing grows.
 */
export function beneficiaryOf(save: WorldSave, boardSanctuary: SanctuaryId | null | undefined): { id: SanctuaryId | null; redirectedFrom: SanctuaryId | null } {
  if (boardSanctuary && canGrow(save, boardSanctuary)) return { id: boardSanctuary, redirectedFrom: null };
  const fallback = activeSanctuary(save);
  return { id: fallback, redirectedFrom: boardSanctuary && fallback ? boardSanctuary : null };
}

/** Everything a win needs to credit the world exactly once, for the right sanctuary. */
export interface SolveContext {
  /** The sanctuary the board was cast for when it started (its saved `cast.sanctuary`); null for a board that had none. */
  boardSanctuary: SanctuaryId | null;
  /** Regions open before the win was recorded, so a region that just opened can be announced. */
  openedBefore: RegionId[];
  /**
   * The board's id (`app.active.boardId`). A completed board is credited at most once under it, however many times the
   * outcome is handled (a re-entered win, a replayed event log); omitted in unit tests that build boards by hand.
   */
  receipt?: string;
  /** The puzzle's mode key (`modeKey(mode)`): a puzzle grows the world once (policy 2). Omitted by hand-built boards. */
  puzzle?: string;
}

/** Credit receipts kept (the newest); older ones can't come back as a live board. */
const RECEIPTS_KEPT = 60;

/** Has this board's solve already grown the world? */
export function alreadyCredited(save: WorldSave, receipt: string | undefined): boolean {
  return !!receipt && !!save.world.credits && receipt in save.world.credits;
}

function recordReceipt(save: WorldSave, receipt: string | undefined, id: SanctuaryId | null): void {
  if (!receipt) return;
  const credits = (save.world.credits ??= {});
  credits[receipt] = id ?? 'none';
  const keys = Object.keys(credits);
  for (const k of keys.slice(0, Math.max(0, keys.length - RECEIPTS_KEPT))) delete credits[k];
}

/**
 * Records one solved puzzle for the sanctuary the board was for (see `beneficiaryOf`), welcomes any animal whose count
 * was reached, pays a finished sanctuary's gift, and reports what happened. Never moves `world.active`: the player's
 * choice of what to build next is theirs. Returns null when nothing grew and nothing opened. Idempotent per receipt.
 */
export function creditSolve(save: WorldSave, ctx: SolveContext, now = new Date()): GrowthNews | null {
  const opened = openRegions(save).filter((id) => !ctx.openedBefore.includes(id));
  if (alreadyCredited(save, ctx.receipt)) return null;
  const replayed = alreadyGrown(save, ctx.puzzle);
  const { id, redirectedFrom } = beneficiaryOf(save, ctx.boardSanctuary);
  recordReceipt(save, ctx.receipt, replayed ? null : id);
  if (!id || replayed) {
    if (!opened.length) return null;
    const only: GrowthNews = { sanctuary: opened[0], growth: 0, stageUp: null, arrived: [], completed: false, coins: 0, opened, redirectedFrom, replayed };
    noteUnseen(save, only, now);
    return only;
  }
  const def = sanctuaryDef(id);
  const before = stageOf(save, id);
  save.world.growth[id] = growthOf(save, id) + 1;
  recordGrown(save, ctx.puzzle, now);
  const after = stageOf(save, id);
  const arrived = welcomeArrivals(save, id, now);
  const completed = isComplete(save, id);
  let coins = 0;
  if (completed && grant(save, `world:complete:${id}`, def.completeCoins, 'gift', now, `${def.name} complete`)) coins = def.completeCoins;
  // Finishing a home can open the next place of the endless world (D39), so what opened is asked again now.
  const openedNow = openRegions(save).filter((r) => !ctx.openedBefore.includes(r));
  const news: GrowthNews = {
    sanctuary: id,
    growth: save.world.growth[id]!,
    stageUp: after > before ? def.stages[after] : null,
    arrived,
    completed: completed && coins > 0,
    coins,
    opened: openedNow,
    redirectedFrom,
    replayed: false,
  };
  noteUnseen(save, news, now);
  return news;
}

/** Is this win a milestone worth a visit: someone came home, a stage was reached, a sanctuary opened or finished? */
export function isMilestone(news: GrowthNews | null): boolean {
  return !!news && (news.arrived.length > 0 || news.stageUp !== null || news.opened.length > 0 || news.completed);
}

/**
 * Keeps the "New" marker: what a win did in a sanctuary the player hasn't looked at since. Arrivals and stages are
 * recorded once (they can't happen twice), so a replayed level or a reopened app never re-raises old news.
 */
function noteUnseen(save: WorldSave, news: GrowthNews, now: Date): void {
  const unseen = (save.world.unseen ??= {});
  const at = now.toISOString();
  for (const r of news.opened) {
    const u = unseen[r] ?? { animals: [], stage: null, opened: false, at };
    u.opened = true;
    u.at = at;
    unseen[r] = u;
  }
  if (news.growth > 0 && (news.arrived.length || news.stageUp)) {
    const u = unseen[news.sanctuary] ?? { animals: [], stage: null, opened: false, at };
    for (const a of news.arrived) if (!u.animals.includes(a)) u.animals.push(a);
    if (news.stageUp) u.stage = stageOf(save, news.sanctuary);
    u.at = at;
    unseen[news.sanctuary] = u;
  }
}

/** The news waiting in a sanctuary, or null when the player has seen everything there. */
export function unseenIn(save: Pick<SaveV2, 'world'>, id: SanctuaryId): UnseenNews | null {
  return save.world.unseen?.[id] ?? null;
}

/** Building order of any sanctuary: the hand-made ones first (catalog order), then places by number. */
function orderKey(id: SanctuaryId): number {
  return isPlaceId(id) ? SANCTUARIES.length + placeIndex(id) : SANCTUARIES.findIndex((s) => s.id === id);
}

/** Sanctuaries with news the player hasn't visited yet. */
export function unseenSanctuaries(save: Pick<SaveV2, 'world'>): SanctuaryId[] {
  return Object.keys(save.world.unseen ?? {}).filter((id): id is SanctuaryId => isSanctuaryId(id) && !!save.world.unseen?.[id]).sort((a, b) => orderKey(a) - orderKey(b));
}

/** A visit clears the sanctuary's "New" marker. Returns what it was, so the screen can say hello to the newcomers. */
export function markSeen(save: Pick<SaveV2, 'world'>, id: SanctuaryId): UnseenNews | null {
  const u = save.world.unseen?.[id] ?? null;
  if (u && save.world.unseen) delete save.world.unseen[id];
  return u;
}

/**
 * Records one solved puzzle for the sanctuary being built right now. For boards that know which sanctuary they were
 * started for, use `creditSolve`; this is the shorthand for tools and tests that only have a save.
 */
export function growOnSolve(save: WorldSave, openedBefore: RegionId[], now = new Date()): GrowthNews | null {
  return creditSolve(save, { boardSanctuary: activeSanctuary(save), openedBefore }, now);
}

/** Regions (the Farm and the exotic ones) that are open. */
export function openRegions(save: Pick<SaveV2, 'journey' | 'world'>): RegionId[] {
  const places: RegionId[] = [];
  for (let k = 1, n = openPlaceCount(save); k <= n; k++) places.push(placeId(k));
  return [...REGIONS.map((r) => r.id as RegionId).filter((id) => isOpen(save, id)), ...places];
}

/**
 * Startup safety net. Saves from before D35 never grew the Pet Garden (its residents arrived at Journey levels), so its
 * growth starts at the arrival count of the latest resident already home: everyone before them in the new order moves
 * in too, and the next one is a fair number of puzzles away. Then any arrival that was reached but not recorded is
 * welcomed, and a sanctuary that is already finished pays its completion gift (once, by ledger id). Idempotent.
 */
export function reconcileWorld(save: WorldSave & Pick<SaveV2, 'daily'>, now = new Date()): AnimalId[] {
  upgradeGrowthPolicy(save, now);
  if (save.world.growth.harmony === undefined) {
    const garden = SANCTUARY_BY_ID.harmony.arrivals;
    const reached = garden.filter((a) => isHome(save, a.id)).reduce((m, a) => Math.max(m, a.at), 0);
    if (reached > 0) save.world.growth.harmony = reached;
  }
  const out: AnimalId[] = [];
  for (const id of worldIds(save)) {
    if (!isOpen(save, id) && growthOf(save, id) === 0) continue;
    const s = sanctuaryDef(id);
    out.push(...welcomeArrivals(save, id, now));
    // A sanctuary that is already finished (an earlier save whose garden filled up above) still pays its gift, once.
    if (isComplete(save, id)) grant(save, `world:complete:${id}`, s.completeCoins, 'gift', now, `${s.name} complete`);
  }
  return out;
}

/** The next exotic region still to open, and how many Journey levels until it does. */
export function nextToOpen(save: OpenSave): { id: RegionId; def: SanctuaryDef; left: number; orSooner: boolean } | null {
  for (const r of REGIONS) {
    const id = r.id as RegionId;
    if (!isOpen(save, id)) return { id, def: r, left: r.opensAfterLevel - cleared(save), orSooner: false };
  }
  // The endless world (D39): the next place always exists. It opens at its level, or sooner, the moment every home
  // before it is complete.
  const k = openPlaceCount(save) + 1;
  if (k > MAX_PLACE) return null;
  const def = placeDef(k);
  return { id: def.id, def, left: Math.max(1, def.opensAfterLevel - cleared(save)), orSooner: true };
}

/** Puzzles still to solve (while building it) before a sanctuary's next stage. */
export function puzzlesToNext(save: Pick<SaveV2, 'world'>, id: SanctuaryId): number {
  const n = nextStage(save, id);
  return n ? n.need - n.have : 0;
}

/**
 * One line from a sanctuary's animal, tied to what really happened (never invented): a newcomer, the next friend on
 * the way, or the sanctuary finished. Null while nobody lives there yet.
 */
export function regionChat(save: Pick<SaveV2, 'journey' | 'world' | 'inventory'>, id: SanctuaryId, now = new Date()): string | null {
  const here = homeAnimals(save, id);
  if (!here.length) return null;
  const day = now.toISOString().slice(0, 10);
  let h = 0;
  for (const ch of `${id}-${day}`) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const who = animalInfo(here[h % here.length]).name;
  const newest = [...here].sort((a, b) => Date.parse(homeSince(save, b) ?? '') - Date.parse(homeSince(save, a) ?? ''))[0];
  const at = Date.parse(homeSince(save, newest) ?? '');
  if (!Number.isNaN(at) && now.getTime() - at < 2 * 86_400_000) return `${animalInfo(newest).name} is still exploring the new home.`;
  if (isComplete(save, id)) return `${who} thinks this is the best home in the world.`;
  const next = arrivalProgress(save, id);
  if (next && activeSanctuary(save as WorldSave) === id) {
    const nm = animalInfo(next.next.id);
    return `${who} is getting ready for ${nm.name} the ${nm.noun}: ${next.left === 1 ? 'one more puzzle' : `${next.left} more puzzles`}.`;
  }
  return `${who} hopes you'll build here again soon.`;
}

/** When an animal who hasn't come home yet will arrive, in one sentence for its card. */
export function arrivalLine(save: Pick<SaveV2, 'journey' | 'world' | 'inventory'>, id: AnimalId): string {
  const at = arrivalOf(id);
  const def = at ? sanctuaryDef(at.sanctuary) : null;
  if (!def) return 'Arriving soon.';
  if (!isOpen(save, def.id)) return `Lives at the ${def.short}, which opens after level ${def.opensAfterLevel}.`;
  const p = arrivalProgress(save, def.id);
  if (p?.next.id === id)
    return `Coming home next: ${p.left === 1 ? 'one more puzzle' : `${p.left} more puzzles`} while you build the ${def.short}. Until then, this is the animal on your boards there.`;
  return `Arrives later, after the animals before it at the ${def.short}. Solve puzzles while you build there.`;
}

// ------------------------------------------------------------------ the next goal (D40)

/** What the next puzzles bring closer, after a welcome: an animal on its way, the next stage, or the next home. */
export type NextGoal =
  | { kind: 'animal'; where: SanctuaryId; id: string; left: number }
  | { kind: 'stage'; where: SanctuaryId; name: string; change: string; left: number }
  | { kind: 'home'; where: SanctuaryId; left: number };

/**
 * The next goal from a sanctuary (D40, the fourth step of an arrival): who comes home next here, else this home's next
 * stage, else the same for the home being built now, else the next home to open. Null only when the world has nothing
 * left at all (never, in practice: the endless world always has a next place).
 */
export function nextGoal(save: SaveV2, from: SanctuaryId): NextGoal | null {
  for (const where of [from, activeSanctuary(save)]) {
    if (!where || !isOpen(save, where)) continue;
    const p = arrivalProgress(save, where);
    if (p) return { kind: 'animal', where, id: p.next.id, left: p.left };
    const st = nextStage(save, where);
    if (st) return { kind: 'stage', where, name: st.stage.name, change: st.stage.change, left: st.need - st.have };
  }
  const up = nextToOpen(save);
  return up ? { kind: 'home', where: up.id, left: up.left } : null;
}
