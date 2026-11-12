# Board ergonomics: audit and test plan (D51-A)

The D50/D51 plan asks us to audit the board's controls before writing any code, avoid rebuilding what exists, and
change a control only when watching real first-time players on small iPhones shows a problem. This is that audit,
done against `main` after D50, plus the usability test that decides what comes next.

**Outcome: no control changes in D51-A.** Everything the review proposed is already built. What remains is checking
on real phones, with real players. The tests below are what to watch for, and each one says what would justify a
change.

## What exists today

| Proposed in the review | Where it lives | State |
|---|---|---|
| Swipe across tiles to mark ✕ | `ui/components/board.ts` (drag): every tile on the line between two finger reports is walked, and coalesced pointer events are read, so a fast swipe never skips a tile (D48 PR A) | Built, unit and browser tests |
| Haptic ticks while marking | `services/feel.ts` (`drag`): one soft tick per tile that changes, at most every 40 ms (`DRAG_TICK_MS`), none for tiles that don't change, none with Haptics off, no sound | Built, needs a real iPhone |
| Progressive hints | `game/session.ts`: tier 1 nudge (the row, column or color that forces a move), tier 2 the exact tile and why, tier 3 places it. The board's first nudge is free, and one hint ticket pays for one target, whichever tiers are opened | Built |
| Color accessibility | Settings → Region patterns (`regionPatterns`, off by default) adds a texture to each color; Settings → High contrast | Built, never tested with players |
| Large boards | Settings → Large board (`largeBoard`): bigger tiles you scroll around. Without it a 9×9 fits a 320×568 phone at 29 px per tile (D41) | Built |
| Two-animal teaching | Level 21's guided lesson (`meta/onboarding.ts::isPairLesson`), with its bridge sheet | Built |
| Another way to place | Settings → Controls: *Fast double-tap* (default) or *Two-step tap (no timing)*. Two-step is offered once to a player whose double taps come too slowly (D40), and is the scheme for VoiceOver and Switch Control (D38) | Built |
| Mistakes | A wrong animal costs a heart and leaves a mark (D37); dots on impossible tiles on Easy boards only | Built |
| Separate "Buddy Training" levels before 21 | — | **Not built, by decision** (the plan keeps it out) |

## Usability test (five first-time players, small iPhones)

Run on an iPhone SE (2nd or 3rd gen) or an iPhone 12 mini, plus one standard-size phone, from a fresh install of
the TestFlight build. Sound on, haptics on, default settings. Watch and write down; don't help unless the player is
stuck for more than about 30 seconds. With consent, the opt-in analytics (`onboarding_controls`, `hint_used`,
`puzzle_fail`, `puzzle_retry`) add numbers to what you saw.

| # | Task | Watch for | Change only if |
|---|---|---|---|
| 1 | Play level 1 with no explanation beyond the game's own | Do they mark ✕ with a tap and place with a double tap? Time to the first animal placed | 2+ of 5 never find placing, or need over a minute |
| 2 | Levels 2–5 | Do they swipe to mark several tiles at once without being told? | No one swipes by level 5: that's a teaching question, not a control change (one line in the coach) |
| 3 | A 7×7 or larger on the small phone | Wrong tile touched (a neighbour's mark appears) | 2+ players hit the wrong tile more than twice on one board: then evaluate the Large board default for that screen size |
| 4 | Ask for a hint when stuck | Do they understand tier 1 (the line is ringed) before opening tier 2? | 3+ of 5 open the placement straight away: reword tier 1, don't add tiers |
| 5 | Level 21 (the first two-animal board, via the tester shortcut) | Do they finish the lesson and the next board? Confusion between the two animals | 2+ can't finish the board after the lesson: improve the lesson's words and example; still no extra levels |
| 6 | One player with Region patterns on, one with High contrast | Can they tell the colors apart at arm's length? | Either can't: adjust the pattern's contrast or density |
| 7 | One player with VoiceOver (Two-step tap) | Can they mark, place and erase? | Any of the three is impossible: that's a bug to fix before launch |

### An "animal-first" tap scheme

The plan asks us to *evaluate* an optional scheme where you pick the animal first and then tap tiles. Two-animal
boards already have an animal button for each animal, so this is close to what exists. Offer it to two of the five
players as a paper prototype after task 5, and ask which they'd keep. Don't change the default without that
evidence. If it's built later, it's a third choice under Settings → Controls, never a replacement.

## Where the results go

Write the results into `docs/release-checklist.md` → D50 (the TestFlight section), with the device, the iOS version
and what each player did. A change that the results justify gets its own PR, with the observation it answers in the
description.
