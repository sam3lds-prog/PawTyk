/**
 * D51-B: the economy model. Not game code (nothing in the app imports it): a configurable, documented model of how Paw
 * Coins, extra lives, hints, food and the two premium currencies flow for a player, read from the game's **real**
 * numbers (`config/economy.ts`, the catalogs, the errand pool, the pantry rules) under three play patterns:
 * conservative, base and higher-engagement.
 *
 * It exists so economy changes are argued from numbers rather than hunches. Today the play patterns are assumptions
 * (no beta has run yet); each one names the opt-in analytics event that will replace it (`docs/analytics.md`). Run
 * `npm run economy:model` for the report (`docs/economy-model.md`). Nothing here changes a price or a reward.
 *
 * What the model deliberately does **not** recommend, whatever it shows (D50/D51 plan): cutting free lives to sell
 * revives, paid streak protection, a VIP pass, renaming purchase ids, or spending targets built only to create demand.
 */

import { ECONOMY } from '../config/economy';
import { DECOR, decorHome, decorTier, type DecorId } from './catalogs/decor';
import { TRICKS, trickCurrency } from './catalogs/tricks';
import { BOWLS, FOODS, isFeast } from './catalogs/foods';
import { REGIONS, SANCTUARIES } from './catalogs/sanctuaries';
import { DAILY_POOL, WEEKLY } from './missions';
import { CLEAR_LIVES, HINT_EVERY, ITEM_CAP, OVERFLOW_COINS, STARTER_ITEMS } from './items';
import { FOOD_AFFECTION_PER_DAY } from './feeding';
import { LEVELS_PER_CHAPTER } from './chapters';

/** A play pattern. Every field is an assumption until the event named beside it has real numbers. */
export interface EconomyScenario {
  name: 'conservative' | 'base' | 'engaged';
  label: string;
  /** Sessions a day (`day_active`, `home_time`). */
  sessionsPerDay: number;
  /** New Journey levels cleared per session (`level_reached`, `puzzle_complete{mode=level}`). */
  newLevelsPerSession: number;
  /** Share of days the Daily is solved (`daily_complete`). */
  dailyRate: number;
  /** Share of solves with no mistakes (`puzzle_complete.mistakes`). */
  cleanRate: number;
  /** Zen boards a day (`puzzle_complete{mode=zen}`). */
  zenPerDay: number;
  /** Of the day's three errands, how many get finished (`mission_claimed`). */
  errandsPerDay: number;
  /** Share of weeks the weekly errand gets finished (`mission_claimed`). */
  weeklyRate: number;
  /** Boards lost (out of hearts) per ten played (`puzzle_fail`, `revive_offer`). */
  lossesPer10: number;
  /** Share of losses where the player spends an extra life to go on (`extra_life_used`). */
  lifeUseRate: number;
  /** Paid hints (after the board's free nudge) per ten boards (`hint_used`). */
  paidHintsPer10: number;
  /** Coin meals bought a day (`food_bought`). */
  mealsPerDay: number;
  /** Reward videos watched a day, of the daily cap (`rewarded_ad_complete`). */
  videosPerDay: number;
}

export const SCENARIOS: readonly EconomyScenario[] = [
  {
    name: 'conservative',
    label: 'Conservative: one short session most days',
    sessionsPerDay: 1,
    newLevelsPerSession: 1.5,
    dailyRate: 0.35,
    cleanRate: 0.4,
    zenPerDay: 0,
    errandsPerDay: 1.2,
    weeklyRate: 0.15,
    lossesPer10: 2,
    lifeUseRate: 0.5,
    paidHintsPer10: 3,
    mealsPerDay: 0.4,
    videosPerDay: 0,
  },
  {
    name: 'base',
    label: 'Base: two short sessions a day',
    sessionsPerDay: 2,
    newLevelsPerSession: 2,
    dailyRate: 0.6,
    cleanRate: 0.55,
    zenPerDay: 0.3,
    errandsPerDay: 2,
    weeklyRate: 0.5,
    lossesPer10: 1.5,
    lifeUseRate: 0.7,
    paidHintsPer10: 2,
    mealsPerDay: 1,
    videosPerDay: 0.5,
  },
  {
    name: 'engaged',
    label: 'Higher engagement: three sessions, most errands',
    sessionsPerDay: 3,
    newLevelsPerSession: 2.5,
    dailyRate: 0.9,
    cleanRate: 0.7,
    zenPerDay: 1,
    errandsPerDay: 2.8,
    weeklyRate: 0.9,
    lossesPer10: 1,
    lifeUseRate: 0.8,
    paidHintsPer10: 1.5,
    mealsPerDay: 2,
    videosPerDay: 2,
  },
];

/** What the model reads from the game (and from the UI, for which decorations the animals use). */
export interface EconomyCatalog {
  /** Coin prices of the Farm's decorations, and which of them the animals use. */
  farmDecor: Array<{ id: DecorId; coins: number; interactive: boolean }>;
  /** Coin prices of every decoration in every home (the long goal). */
  allCoinDecor: number[];
  coinTricks: number[];
  coinBowls: number[];
  /** Video-token prices (decorations, tricks, foods). */
  tokenPrices: number[];
  /** Gem prices (decorations, tricks, foods, bowls). */
  gemPrices: number[];
  /** The cheapest everyday coin meal (one portion of a non-feast food). */
  cheapestMeal: number;
  /** A typical coin meal (the median portion price). */
  typicalMeal: number;
  /** Paw Coins for finishing a home, spread over the puzzles it takes. */
  homeCoinsPerPuzzle: number;
}

/** The catalog from the game's own data. `interactive(id)`: whether the animals use a decoration (UI activities). */
export function gameCatalog(interactive: (id: DecorId) => boolean): EconomyCatalog {
  const coin = DECOR.filter((d) => d.cost !== null && d.unlock.kind !== 'pack');
  const farm = coin.filter((d) => decorHome(d) === 'farm').map((d) => ({ id: d.id, coins: d.cost!, interactive: interactive(d.id) }));
  const meals = FOODS.filter((f) => f.coins && !isFeast(f))
    .map((f) => f.coins!)
    .sort((a, b) => a - b);
  // A home's last stage or last arrival, whichever comes later: the puzzles it takes to finish.
  const homes = SANCTUARIES.filter((s) => s.completeCoins > 0).map((s) => {
    const last = Math.max(0, ...s.stages.map((st) => st.at), ...s.arrivals.map((a) => a.at));
    return last > 0 ? s.completeCoins / last : 0;
  });
  return {
    farmDecor: farm,
    allCoinDecor: coin.map((d) => d.cost!),
    coinTricks: TRICKS.filter((t) => trickCurrency(t) === 'coins').map((t) => t.price),
    coinBowls: BOWLS.filter((b) => b.coins).map((b) => b.coins!),
    tokenPrices: [...DECOR.filter((d) => decorTier(d) === 'video' && d.tokens).map((d) => d.tokens!), ...TRICKS.filter((t) => trickCurrency(t) === 'vtoken').map((t) => t.price), ...FOODS.filter((f) => f.tokens).map((f) => f.tokens!)],
    gemPrices: [...DECOR.filter((d) => d.gems).map((d) => d.gems!), ...TRICKS.filter((t) => trickCurrency(t) === 'gem').map((t) => t.price), ...FOODS.filter((f) => f.gems).map((f) => f.gems!), ...BOWLS.filter((b) => b.gems).map((b) => b.gems!)],
    cheapestMeal: meals[0] ?? 0,
    typicalMeal: meals[Math.floor(meals.length / 2)] ?? 0,
    homeCoinsPerPuzzle: homes.length ? homes.reduce((a, b) => a + b, 0) / homes.length : 0,
  };
}

export interface EconomyResult {
  scenario: EconomyScenario;
  /** Boards a day, of each kind. */
  boards: { level: number; daily: number; zen: number; total: number };
  /** Paw Coins earned a day, by source. */
  coins: { firstClears: number; clean: number; daily: number; chapters: number; errands: number; weekly: number; homes: number; total: number };
  coinsPerSession: number;
  /**
   * The pantry (Codex review on #76): extra lives and hints over the cap of 10 arrive as coins (`OVERFLOW_COINS` each).
   * Days until each fills from the starter pantry (null: never, it is used as fast as it's earned), and coins a day
   * once both are full (the day's total plus the overflow).
   */
  pantry: { livesFullInDays: number | null; hintsFullInDays: number | null; overflowPerDay: number; coinsPerDayOnceFull: number };
  /** Paw Coins spent a day on food (at the typical meal price), and its share of the day's earnings. */
  food: { perDay: number; share: number };
  /** Days until the player can afford, from nothing (spending only on food; the pantry's overflow counted once full). */
  daysTo: { firstInteractiveFarmPiece: number; anyFarmPiece: number; allFarmCoinDecor: number; allCoinTricks: number; everythingForCoins: number };
  /** Extra lives and hints a day: earned, used, and the difference (the pantry caps at ITEM_CAP). */
  lives: { earned: number; used: number; net: number };
  hints: { earned: number; used: number; net: number };
  /** Video tokens a day, and days to the dearest token item (0 videos: never). */
  tokens: { perDay: number; daysToDearest: number | null };
  /** How many levels the player clears in 30 days. */
  levelsIn30Days: number;
}

const round = (n: number, d = 1) => Math.round(n * 10 ** d) / 10 ** d;

/** Days to save `cost` at `before` a day, which becomes `after` a day from day `switchAt` (the pantry full). */
export function daysToSave(cost: number, before: number, after: number, switchAt: number | null): number {
  if (cost <= 0) return 0;
  const at = switchAt ?? Infinity;
  if (before > 0 && cost <= before * at) return round(cost / before);
  const saved = before > 0 && Number.isFinite(at) ? before * at : 0;
  if (!Number.isFinite(at) || after <= 0) return before > 0 ? round(cost / before) : Infinity;
  return round(at + (cost - saved) / after);
}

/** Expected coins (and items) from finishing `n` of the day's three errands. "Solve any board" is always one of them. */
export function errandYield(n: number): { coins: number; lives: number; hints: number } {
  const others = DAILY_POOL.filter((m) => m.id !== 'solve1');
  const avg = (f: (m: (typeof others)[number]) => number) => others.reduce((a, m) => a + f(m), 0) / others.length;
  const first = Math.min(1, Math.max(0, n));
  const rest = Math.min(2, Math.max(0, n - 1));
  return {
    coins: first * DAILY_POOL[0].coins + rest * avg((m) => m.coins),
    lives: rest * avg((m) => m.items?.life ?? 0),
    hints: rest * avg((m) => m.items?.hint ?? 0),
  };
}

export function runScenario(sc: EconomyScenario, cat: EconomyCatalog): EconomyResult {
  const level = sc.sessionsPerDay * sc.newLevelsPerSession;
  const daily = sc.dailyRate;
  const zen = sc.zenPerDay;
  const total = level + daily + zen;
  const errands = errandYield(sc.errandsPerDay);
  const coins = {
    firstClears: level * ECONOMY.journeyFirstClear,
    clean: level * sc.cleanRate * ECONOMY.journeyCleanBonus,
    daily: daily * (ECONOMY.dailyFirstClear + sc.cleanRate * ECONOMY.dailyCleanBonus),
    chapters: (level / LEVELS_PER_CHAPTER) * ECONOMY.chapterComplete,
    errands: errands.coins,
    weekly: (sc.weeklyRate * WEEKLY.coins) / 7,
    // Journey, Daily and Zen boards all grow the home being built.
    homes: total * cat.homeCoinsPerPuzzle,
    total: 0,
  };
  coins.total = coins.firstClears + coins.clean + coins.daily + coins.chapters + coins.errands + coins.weekly + coins.homes;
  const food = sc.mealsPerDay * cat.typicalMeal;
  const spendable = Math.max(0, coins.total - food);
  const interactive = cat.farmDecor.filter((d) => d.interactive).map((d) => d.coins);
  const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
  const boardsPlayed = level + daily; // hearts and pantry items are for Journey and Daily boards
  const lives = {
    earned: level * CLEAR_LIVES + errands.lives + (sc.weeklyRate * (WEEKLY.items?.life ?? 0)) / 7,
    used: (boardsPlayed * sc.lossesPer10 * sc.lifeUseRate) / 10,
    net: 0,
  };
  lives.net = lives.earned - lives.used;
  const hints = {
    earned: level / HINT_EVERY + errands.hints + (sc.weeklyRate * (WEEKLY.items?.hint ?? 0)) / 7,
    used: (boardsPlayed * sc.paidHintsPer10) / 10,
    net: 0,
  };
  hints.net = hints.earned - hints.used;
  // The pantry fills from the starter pantry at its net rate; after that, every extra one arrives as coins.
  const fullIn = (start: number, net: number) => (net > 0 ? round(Math.max(0, ITEM_CAP.life - start) / net) : null);
  const livesFullInDays = fullIn(STARTER_ITEMS.life, lives.net);
  const hintsFullInDays = fullIn(STARTER_ITEMS.hint, hints.net);
  // Once full, the day's surplus (what's earned beyond what's used) comes as coins instead.
  const overflowPerDay = Math.max(0, lives.net) * OVERFLOW_COINS + Math.max(0, hints.net) * OVERFLOW_COINS;
  const coinsOnceFull = coins.total + overflowPerDay;
  // The model's horizon switches to the "full" rate when the later of the two is full (a conservative simplification).
  const fullAt = livesFullInDays === null && hintsFullInDays === null ? null : Math.max(livesFullInDays ?? 0, hintsFullInDays ?? 0);
  const spendableFull = Math.max(0, coinsOnceFull - food);
  const save = (cost: number) => daysToSave(cost, spendable, spendableFull, overflowPerDay > 0 ? fullAt : null);
  const dearestToken = cat.tokenPrices.length ? Math.max(...cat.tokenPrices) : 0;
  return {
    scenario: sc,
    boards: { level: round(level), daily: round(daily, 2), zen: round(zen, 2), total: round(total) },
    coins: Object.fromEntries(Object.entries(coins).map(([k, v]) => [k, round(v)])) as EconomyResult['coins'],
    coinsPerSession: round(coins.total / sc.sessionsPerDay),
    pantry: { livesFullInDays, hintsFullInDays, overflowPerDay: round(overflowPerDay), coinsPerDayOnceFull: round(coinsOnceFull) },
    food: { perDay: round(food), share: round(coins.total ? food / coins.total : 0, 2) },
    daysTo: {
      firstInteractiveFarmPiece: interactive.length ? save(Math.min(...interactive)) : Infinity,
      anyFarmPiece: cat.farmDecor.length ? save(Math.min(...cat.farmDecor.map((d) => d.coins))) : Infinity,
      allFarmCoinDecor: save(sum(cat.farmDecor.map((d) => d.coins))),
      allCoinTricks: save(sum(cat.coinTricks)),
      everythingForCoins: save(sum(cat.allCoinDecor) + sum(cat.coinTricks) + sum(cat.coinBowls)),
    },
    lives: { earned: round(lives.earned, 2), used: round(lives.used, 2), net: round(lives.net, 2) },
    hints: { earned: round(hints.earned, 2), used: round(hints.used, 2), net: round(hints.net, 2) },
    tokens: { perDay: sc.videosPerDay, daysToDearest: sc.videosPerDay > 0 ? round(dearestToken / sc.videosPerDay) : null },
    levelsIn30Days: round(level * 30, 0),
  };
}

/** Facts about the rules the model rests on (for the report). */
export function rulesSummary(): Record<string, number | string> {
  return {
    'Journey first clear': ECONOMY.journeyFirstClear,
    'Journey clean bonus': ECONOMY.journeyCleanBonus,
    'Daily (first clear, clean bonus)': `${ECONOMY.dailyFirstClear} + ${ECONOMY.dailyCleanBonus}`,
    'Chapter complete (every 20 levels)': ECONOMY.chapterComplete,
    'Extra life per new level': CLEAR_LIVES,
    'Hint every N new levels': HINT_EVERY,
    'Pantry cap (lives, hints)': `${ITEM_CAP.life}, ${ITEM_CAP.hint}`,
    'Food hearts a day, per animal': FOOD_AFFECTION_PER_DAY,
    'Homes with a completion gift': SANCTUARIES.filter((s) => s.completeCoins > 0).length,
    'Hand-made regions': REGIONS.length,
  };
}
