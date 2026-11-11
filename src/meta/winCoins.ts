/**
 * What a win paid in Paw Coins, said once (D50 PR A).
 *
 * Before, a win could say "+45 Paw Coins" beside the success and then, two lines lower, "2 errands done · +45 Paw
 * Coins": two numbers, and the player had to add them up (or wonder whether it was the same 45 twice). Now the first
 * view has one headline, the total the wallet actually went up by, and one small line saying where it came from:
 *
 *     +90 Paw Coins
 *     45 for the puzzle · 45 from 2 errands
 *
 * The parts are the four ways a solve pays coins, each already credited once by its own ledger id before the sheet is
 * drawn (this file credits nothing):
 *
 *  - the puzzle itself (`meta/rewards.ts`: first clear, clean, Daily…, plus a full pantry's overflow);
 *  - errands that finished and claimed themselves (`missions.ts::autoClaimMissions`, D49 PR D);
 *  - badges unlocked by this solve (`achievements.ts`);
 *  - a home finished by this solve (`world.ts`, its `completeCoins`).
 *
 * Pure.
 */

export type CoinSource = 'puzzle' | 'errands' | 'badges' | 'home';

export interface CoinPart {
  source: CoinSource;
  coins: number;
  /** "45 for the puzzle", "45 from 2 errands", "20 from a badge", "100 for finishing the Farm". */
  label: string;
}

export interface WinCoins {
  total: number;
  /** Only the parts that paid something, in the order above. */
  parts: CoinPart[];
}

export interface WinCoinsInput {
  /** The puzzle's own coins (`RewardSummary.coins`). */
  puzzle: number;
  /** Errands claimed by this solve: each one's coins and pantry overflow. */
  errands: ReadonlyArray<{ coins: number; overflowCoins: number }>;
  /** Badges unlocked by this solve. */
  badges: ReadonlyArray<{ coins: number }>;
  /** Coins for a home this solve finished, and the home's short name ("Farm"). */
  home?: { coins: number; name: string } | null;
}

const count = (n: number, one: string, many: string) => (n === 1 ? one : `${n} ${many}`);

export function winCoins(o: WinCoinsInput): WinCoins {
  const parts: CoinPart[] = [];
  if (o.puzzle > 0) parts.push({ source: 'puzzle', coins: o.puzzle, label: `${o.puzzle} for the puzzle` });
  const errands = o.errands.filter((e) => e.coins + e.overflowCoins > 0);
  const fromErrands = errands.reduce((n, e) => n + e.coins + e.overflowCoins, 0);
  if (fromErrands > 0) parts.push({ source: 'errands', coins: fromErrands, label: `${fromErrands} from ${count(errands.length, 'an errand', 'errands')}` });
  const badges = o.badges.filter((b) => b.coins > 0);
  const fromBadges = badges.reduce((n, b) => n + b.coins, 0);
  if (fromBadges > 0) parts.push({ source: 'badges', coins: fromBadges, label: `${fromBadges} from ${count(badges.length, 'a badge', 'badges')}` });
  if (o.home && o.home.coins > 0) parts.push({ source: 'home', coins: o.home.coins, label: `${o.home.coins} for finishing the ${o.home.name}` });
  return { total: parts.reduce((n, p) => n + p.coins, 0), parts };
}

/** The small line under the headline: where the coins came from, only when there was more than one source. */
export function coinPartsLine(w: WinCoins): string {
  return w.parts.length > 1 ? w.parts.map((p) => p.label).join(' · ') : '';
}
