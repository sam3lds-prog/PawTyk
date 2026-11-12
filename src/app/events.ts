/**
 * Meta-progression hooks. Screens call these after the things that matter (a solved board, a sanctuary visit, a
 * purchase); they advance missions and unlock achievements, and report what changed so the UI can say so.
 *
 * D49 PR D: an errand finished is claimed at once (`autoClaimMissions`, the same once-only ledger ids as the Claim
 * button), and `claimed` says what it gave, so the moment it is done is the moment it pays.
 */

import { app } from './app';
import type { ModeRef } from '../game/modes';
import { checkAchievements, type AchievementDef } from '../meta/achievements';
import { autoClaimMissions, recordMissionEvent, type AutoClaim, type MissionDef } from '../meta/missions';
import { track } from '../services/analytics';

export interface MetaNews {
  achievements: AchievementDef[];
  missions: MissionDef[];
  /** D49 PR D: errands claimed by themselves just now, and what each gave. */
  claimed: AutoClaim[];
}

function finish(missions: MissionDef[]): MetaNews {
  const claimed = autoClaimMissions(app.save);
  for (const c of claimed) track('mission_claimed', { coins: c.coins + c.overflowCoins, auto: true });
  const achievements = checkAchievements(app.save);
  for (const a of achievements) track('achievement_unlocked', { id: a.id });
  return { achievements, missions, claimed };
}

/** D49 PR D: what errands just claimed themselves gave, in a few words ("+20 Paw Coins · +1 hint"), or ''. */
export function claimedLine(claimed: readonly AutoClaim[], o: { coins?: boolean } = {}): string {
  // D50 PR A: the win sheet's coin headline already counts what errands paid, so its errand line leaves coins out.
  const coins = o.coins === false ? 0 : claimed.reduce((n, c) => n + c.coins + c.overflowCoins, 0);
  const lives = claimed.reduce((n, c) => n + c.lives, 0);
  const hints = claimed.reduce((n, c) => n + c.hints, 0);
  return [coins ? `+${coins} Paw Coins` : '', lives ? `+${lives} extra ${lives === 1 ? 'life' : 'lives'}` : '', hints ? `+${hints} ${hints === 1 ? 'hint' : 'hints'}` : ''].filter(Boolean).join(' · ');
}

export function afterSolve(mode: ModeRef, size: number, mistakes: number, hints: number): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'solved', mode: mode.kind, size, mistakes, hints }));
}

export function afterSanctuaryVisit(): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'sanctuary' }));
}

export function afterDecorChange(): MetaNews {
  return finish(recordMissionEvent(app.save, { kind: 'decor' }));
}

/** Catch up on achievements earned before they existed (e.g. v1 players). */
export function catchUpAchievements(): AchievementDef[] {
  return checkAchievements(app.save);
}
