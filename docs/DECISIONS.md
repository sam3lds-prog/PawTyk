# PawTyk — Decision log

The game was called Pawtopia until D42; entries before it keep the name they were written with.

Short, dated records of choices that shape the code. Newest last.

## 2026-10-25 · D1 — Upgrade in place, keep the engine untouched
The puzzle engine (`src/engine/*`) and its tests are the product's core asset. Pawtopia builds around it:
no file under `src/engine/` changes behavior, every existing test still passes unmodified, and
`npm run gen:check` still verifies 1,000 boards. New behavior (tool input, hint tiers, snapshots) lives in
`src/game/session.ts` (API-compatible superset) and new modules.

## 2026-10-25 · D2 — Keep Vite + TypeScript + Capacitor, no UI framework
The app is a handful of screens and one interactive board. A framework adds weight and a migration without
solving a real problem. We use small typed DOM modules with an explicit screen lifecycle (`ui/router.ts`)
that owns timers, listeners and async continuations, which is what fixes the stale-callback class of bugs.

## 2026-10-25 · D3 — Save schema v2 with additive normalization
`pawtopia.save.v2` replaces `cvd.progress.v1`. Migration is one-way, idempotent and non-destructive:
the raw v1 value is copied to `pawtopia.backup.cvd.progress.v1`, v2 is written and read back, and the v1 key
is left alone (only an explicit player reset removes it). Every field is normalized on load, so future
optional fields don't need a version bump, and corrupted data degrades to defaults instead of crashing.

Levels a v1 player had already cleared are recorded as cleared during migration, so replaying them can
never mint first-clear coins a second time.

## 2026-10-25 · D4 — Reset removes only app-owned keys
`resetProgress` deletes keys prefixed `pawtopia.` or `cvd.` and nothing else, then writes a fresh save that
keeps purchase entitlements and settings. `localStorage.clear()` is gone.

## 2026-10-25 · D5 — One outcome per transition
`Session.claimOutcome()` returns a win or loss exactly once. The UI processes results only through it, so
double taps, a hint landing on the winning cell, or a re-render can't award twice or show two sheets.

## 2026-10-25 · D6 — Celebration before ads; stubs are dev-only
The win sheet always shows first. An interstitial can appear only after the player taps through, and only
when `shouldShowInterstitial` allows it (no onboarding, no Paw Cup, never after a loss, ≥4 boards and
≥8 minutes apart, ≤3/day). Release builds use `UnavailableAdService` / `UnavailableIapService` until real SDKs
are integrated: nothing can be bought, no ad is faked, and dev-stub entitlements (`source: 'dev'`) are
ignored outside development builds. Hints are free while no rewarded network is live.

The v1 `removeAds` flag is carried over as `source: 'legacy-v1'` and honored, but flagged unverified: v1 only
ever had a stub store, so a real restore must confirm it once StoreKit is wired.

## 2026-10-25 · D7 — Deterministic boards + digest-checked resume
A `ModeRef` (`level`, `daily`, `zen`, `cup`) fully identifies a board because generation is deterministic.
The in-progress board is saved as (mode, layout digest, generator version, snapshot). Resume regenerates the
board and refuses if the digest or `GENERATOR_VERSION` differs, so a generator change can never graft an old
snapshot onto a different puzzle.

## 2026-10-25 · D8 — Local dates for Daily, UTC for competition
The Daily Cozy Puzzle keeps v1's local-date keys so existing records and streaks remain valid. Paw Cup weeks
use ISO weeks in UTC (Monday 00:00 UTC) so every competitor shares one boundary. Date math uses calendar
fields, never fixed 24-hour offsets, so DST can't skip or repeat a day.

## 2026-10-25 · D9 — Rename the app, keep the bundle id
The display name becomes **Pawtopia** (`capacitor.config.ts` `appName`, page title, icon). The iOS bundle id stays
`com.sam3lds.catsvsdogs`: changing it would make Pawtopia a different App Store app, so existing players would not
receive it as an update and their on-device save (which the v2 migration carries forward) would be stranded.
The App Store listing name is set in App Store Connect and can say Pawtopia without touching the bundle id.
(D42 renames it again, to PawTyk, the same way.)

## 2026-10-25 · D10 — Screens own a lifecycle scope; the board is the hero
`ui/router.ts` mounts one screen at a time with a `Scope` that owns its timers, listeners, sheets and async
continuations. The game screen groups the board with its one-line coach in a flexible zone, so on tall phones the
spare height is shared above and below instead of separating the board from its feedback. Cells are sized from the
zone (max 76px, min 26px; 9×9 fits a 320px phone at ~31px cells). "Large board" keeps cells ≥46px and scrolls.

## 2026-10-25 · D11 — Faces are pose data on fixed SVG layers; the head never moves
Each pet is one 64×64 SVG with fixed layers: `head-static` (never transformed), `cheeks`, `eyes` (pupils glance
inside the eye; closed "smiling" arcs crossfade in), `lids` (fur-colored eyelids lowering from the top), `brows`
and `mouth` (discrete shapes that crossfade). An expression is a small `Pose` (eye state, lid coverage, pupil
offset, brow lift/tilt, mouth shape, blush) written as CSS custom properties and two data attributes, so a
reaction never touches layout and the tile's size and hit area never change. A test parses `pets.css` and fails if
any `transform` targets something other than pupils, lids or brows, and checks that board pets have no transform or
animation (the mistake ghost only fades).

Reactions come only from explicit session events: correct placement → happy; line/region complete → proud (the new
pet and its partner, two faces at most); a mistake → the faint ghost of the attempted pet looks puzzled (no placed
pet ever reacts to a mistake); hint → pets already in the highlighted line look attentive; picking the Cat/Dog
tool → one pet of that species glances down at the toolbar; marking a tile → one neighbor glances at it; win → a
staggered smile/wink wave that ends within 1.5 s. A tile's pet identity depends only on its region, the board seed
and the player's roster, never the solution. Glance direction depends only on tile positions.

`FaceDirector` (DOM-free, fake-clock tested) caps concurrent reactions at three, staggers idle blinks with a seeded
random per tile (4–9 s), lets pets doze after 20 s without input, pauses ambient life when the board is paused or
hidden, stops blinks in reduced-motion mode (reactions then switch instantly), and clears every timer when a pet
leaves its tile or the screen unmounts. Outside the board (tool buttons, win sheet, collection) pets are static.

## 2026-10-25 · D12 — The 60-level launch pack is the v1 boards, frozen and verified
`src/data/levelPack.ts` holds levels 1–60 exactly as the deterministic generator produced them for v1 (same seeds),
so a returning player's level 14 is the same board, and a saved in-progress board still matches its digest. Freezing
them means a future generator change can never alter a shipped level. `npm run pack:check` and the test suite verify
every board: n connected regions, the solution obeys the rules, givens agree with it, the exact solver finds exactly
one solution, and the human deduction engine solves it without guessing. The test also regenerates all 60 and
compares digests, which is the "seed determinism across releases" guard. The curve: 5×5 (1–10, with the spacing
technique arriving at 7), 6×6 (11–26), 7×7 (27–40), 8×8 (41–60); levels beyond 60 are generated and verified on
device by the same generator.

## 2026-10-25 · D13 — Onboarding: one guided board, then one idea per level
Fresh installs see a welcome screen (two-sentence story, the founding pair in two tiles) and go straight into level 1.
Level 1 is forgiving (no hearts to lose, a "Practice" chip instead) and the deduction engine picks two forced
placements that are highlighted one at a time with the forcing line softly lit; then the player finishes alone.
Later levels show a single coaching sentence when a new idea first matters (rows/columns at 2, regions at 4, spacing at
7, hints at 12, "pointing" at 19). Returning v1 players skip all of this.

## 2026-10-25 · D14 — Free soft currency on an idempotent ledger; one reward path for wins and migration
Paw Coins are earned only by playing and spent only on cosmetic decor (`config/economy.ts`: 35 first clear, +10 first
clean solve, 15 (+10 clean) for a day's daily, 100 per finished chapter; Zen and Paw Cup pay nothing). Every grant and
spend is a ledger entry with a stable id (`clear:L12`, `clean:L12`, `daily:2026-10-25`, `chapter:1`,
`buy:decor:rug`) applied at most once, and the balance is the sum of the ledger, so replays, double taps and re-runs
can't mint or charge twice. The same `applyLevelRewards` runs at win time and, on startup, over every cleared level
(`reconcileRewards`): a v1 player at level 14 receives 13 × 35 coins and the residents for levels 1, 5 and 10, once,
with a "Welcome to Pawtopia" note. Pets arrive at fixed milestones (1: Mochi + Biscuit, 5: Pip, 10: Nori,
15: Clover, 20: Peanut); chapters gift Stone Fountain, Blossom Tree, Little Bridge. Nothing is random or purchasable.

## 2026-10-25 · D15 — Sanctuary decor has fixed homes
Each of the 15 decorations has one spot in the garden, so items can't overlap or form invalid combinations; players
customize by earning, buying, and showing / hiding. Residents sit on their favorite piece when it's out (Mochi on the
cushion, Biscuit in the basket, Pip on the perch, Clover on the blanket, Nori on the rug). Pets outside the board are
static art. After the first board the player picks one of two starter gifts (Paper Lamp or Plump Cushion).

## 2026-10-25 · D16 — One scoring function and one replay verifier, shared with the future server
`competitions/scoring.ts` implements the spec formula in integer arithmetic (round half up), with the published
fixtures as tests (par 150: 75 s clean → 900, 150 s → 850, 300 s → 800, one mistake → 775). Ties: total → clean
clears → less summed time → earlier final verified finish. `competitions/verify.ts` replays an attempt's discrete
event log on a fresh session built from the official board: mistakes and completion are recomputed, hints/revives in
ranked play void the attempt, out-of-order timestamps, off-board moves and edits to givens are rejected, elapsed time
comes from the server clock, and a client clock running ahead of the server is rejected. Implausibly fast solves
are flagged for review, never auto-rejected (slow or fast accessibility users must not be disqualified). Both files are
pure and DOM-free so the Phase 6 Cloud Functions can import them unchanged. `leagueRules.ts` settles a cohort: top 5
promote, bottom 3 relegate only with ≥15 qualified players, provisional players and non-participants never drop,
rewards are coins and cosmetics only.

## 2026-10-25 · D17 — The League tab is honest practice until the backend exists
With `featureFlags.onlineLeagues` off, the Paw Cup screen offers the real five weekly boards (UTC week) under real
rules — no hints, no refills, two attempts, best counts — scored by the same verifier, but labeled everywhere as a
practice score kept on the device. The division preview contains only "You" and says real players will appear when
leagues launch; nothing is fabricated. "You vs last week" compares the player with themself.

## 2026-10-25 · D18 — Missions and badges are small, deterministic and optional
Three daily missions (always "solve any board", plus two chosen by the date, so everyone shares them) and one weekly
mission; missing a day costs nothing and no mission asks for an ad. Twelve badges with fixed small coin gifts.
Claims and gifts use the idempotent ledger. v1 history (cleared levels, best times by board size) is folded into
stats during migration so returning players' Journal and badges reflect what they actually did.

## 2026-10-25 · D19 — Settings say exactly what this build does
Settings states plainly that progress is on-device, no analytics are sent, and (in release) no ads are shown; the store
row says purchases aren't connected. Board cells announce the resident's name to VoiceOver. The v1 glyph module
(`src/game/icons.ts`) was removed once every surface used the new rigs; it remains in git history.

## 2026-10-25 · D20 — Fixes from the independent review
A separate review pass (fresh read of the code, not the author's notes) found seven defects; all are fixed with tests:
1. **Resumed Paw Cup attempts scored 0** — the event log wasn't saved with the board, so the verifier replayed only
   post-resume moves. Cup snapshots now carry the full log; a test proves a save-and-resume attempt scores exactly the
   same as an uninterrupted one.
2. **An open Cup attempt could be lost** by playing any other board (one shared save slot). Open attempts now live in
   their own per-board slots (`save.cup.open`), and League resumes from there. Attempts left open in a past week expire.
3. **A lost board resumed frozen.** Only boards still in play are saved or resumed.
4. **Rules / Settings stopped the Cup clock with the board visible.** In Paw Cup every pause hides the board.
5. **An older daily reset the streak.** Earlier dates are recorded but never touch the streak.
6. **Re-entering a mode wiped its saved board.** Every "play" entry point uses `playMode`, which continues a saved board
   of that same mode.
7. **Erase progress granted fresh Cup attempts.** Attempt records survive a reset (purchases and settings already did).

## 2026-10-26 · D21 — Five hearts on casual boards; Paw Cup keeps three
Journey and Daily boards now allow five wrong placements (`CASUAL_HEARTS`); Paw Cup keeps its published three
(`CUP_HEARTS`), and the replay verifier pins that number explicitly so a casual-rule change can never alter a ranked
result. Zen and the guided first board stay heart-free. Hearts are per board and never carry over.
`Session` takes `maxHearts` (default 3, so every existing caller and test behaves as before) and snapshots record it.
A board saved under the old three-heart rule keeps the mistakes it made and gains the two new hearts (2 of 3 → 4 of 5).

Wrong placements already behaved as the feel review asked (the attempted pet appears as a faint, puzzled ghost; the
tile keeps whatever it held, empty or the player's ✕; nothing reveals the other species). The ghost now also gets a
thin strike that fades with it, opacity only. The pet tool picked last is remembered for the next board (Cat/Dog
only, so a first tap always places), Settings shows a small picture of what one tap does under each control scheme,
and the loss sheet states the real allowance. Fixed in passing: long sheets (Settings) squeezed their sections to fit
the screen and clipped rows; sheet children no longer shrink.

Not done, on purpose: an optional long-press action sheet. It conflicts with drag-marking and needs a usability test
first. At 8×8 on a 320px phone cells are ~36px, below 44pt; "Large board" (≥46px, scrollable) remains the answer.

## 2026-10-26 · D22 — Measured difficulty, versioned specs, 8×8 cap for new boards (D1 kept)
Labels now come from measuring each board (`src/game/grading.ts`, method and calibration in `docs/DIFFICULTY.md`):
the grader replays the unchanged deduction engine step by step and scores breakthroughs, chain length, neighbor
logic, easy openings and sparse givens. Easy = singles only; Expert additionally requires neighbor logic. It lives
outside `src/engine/`, so D1 stands: no engine file changed and every original test passes unmodified.

Which board a level or day gets is now versioned (`src/game/specs.ts`):
- **Spec 1** (unchanged): Journey 1–70, every daily before 2026-10-27, Zen, and Paw Cup.
- **Spec 2**: Journey 71+ rotates 5×5–8×8 in ten-level blocks (a small board can be Expert, a big one Medium) and
  dailies from 2026-10-27 follow a ≤8×8 weekday ladder. Each board is *picked* by its measured label from a fixed
  sequence of candidate seeds, so every device gets the same board.
- Journey 61–150 are frozen in `src/data/journeyPack2.ts` (61–70 exactly as players already saw them). `pack:check`
  regenerates and fails if any committed board would change. Beyond 150, boards are picked on device by the same rule.
- Saved boards record `specVersion` and resume on it; older saves are spec 1, so an in-progress 9×9 at level 75 still
  resumes as that 9×9. A cleared level that moved to a new board keeps its clear, stars and one-time rewards; only its
  best time starts fresh (`LevelClear.spec`).
- Zen offers 5–8. Paw Cup keeps its published five boards including the 9×9 Grand Hall (owner decision), so the
  Grand Thinker badge stays reachable there.

Performance: picking a board takes ~70 ms on a laptop on average, ~0.6 s worst case over a year of dailies; only
dailies and levels beyond 150 pick on device.

## 2026-10-26 · D23 — A small pantry (treats, hint tickets) and Paw Points; a staged win moment
Hearts, treats, tickets, coins and points are kept apart (`src/meta/items.ts`):
- **Hearts** are per board (D21). **Treats** (one heart back on a Journey or Daily board, mid-board or to continue
  after a loss with every placement kept) and **hint tickets** persist between boards, capped at 10 each; anything
  earned past a cap arrives as 10 coins per item instead of vanishing. Neither works in Paw Cup; a treat is logged as a
  revive, so the verifier voids a ranked attempt that used one.
- **Hints** (owner decision): each board's first look (tier 1) is free; after that one ticket pays for one hint target,
  whichever tiers are opened for it (the exact cell, then placing it). Zen and the guided first board stay free. The
  "no hints" star still means no hint of any kind. The ticket and the board's record of it are saved in one write.
- **Earning**: a first clear gives a treat, every even-numbered new level a ticket, some errands add one; replays
  earn none. Everyone gets a one-time starter pantry (3 treats, 5 tickets) instead of back-dated items for old clears
  (owner decision), explained once on Home. With no ad network live, the "watch a video for a ticket" option exists
  only in development builds (D6 unchanged).
- **Paw Points / Paw Rank**: first clear 100 + difficulty bonus by measured label (0/25/50/100), +25 for the first
  clean and +25 for the first hint-free solve of a level; dailies 60 + bonus. Back-dated for old clears (they buy
  nothing). Eight named ranks, shown on the win sheet and in the Journal, never as a competitive score.
- **Win moment**: the sheet opens 0.5 s after the last pet (faces finish their wave behind it), then stars and
  stats, points and rank, rewards and the next resident rise in three stages within ~1.5 s; a tap reveals all, the
  buttons work immediately, reduced motion shows everything at once. Replays show what's left to improve instead of
  rewards.

## 2026-10-26 · D24 — A living sanctuary (revises D11/D15 for the sanctuary only) and the first wildlife friends
On the puzzle board nothing changes: pets animate their faces only, and the existing CSS guards still enforce it. The
**sanctuary scene** is now a lightly animated diorama (`ui/animation/ambientDirector.ts`, DOM-free, fake-clock tested):
every 5–12 s one figure or decoration does something small (blink, glance, yawn, tail wag, stretch, hop; the fountain
catches the light, the lantern glows, a blossom petal drifts, fireflies twinkle in the evening). At most two move at
once, each action lasts ≤ 1.8 s, there is one scheduling timer plus one end timer per running action, and everything
stops when the screen is hidden or left. Reduced motion shows a still scene; a tap still gets a face-only reaction.
All motion CSS lives in `sanctuary-life.css`, scoped to `.sanctuary__scene.is-live`, and a test fails if a rule
escapes that scope, loops forever or runs longer than 1.8 s. Home's scene card stays still.

- **Wildlife friends** are a separate model (`meta/catalogs/companions.ts`), never a puzzle species: Ember the fox
  (level 30, by a woodland log) and Maple the red panda (level 45, napping in the blossom tree when it's out, otherwise
  on the lawn by the cottage). Deterministic milestones, back-dated like residents. Capybara, otter, axolotl and owl
  are planned but not listed until their art exists.
- The Play path's paw marks now sit only on levels where someone really arrives (they used to mark every fifth level,
  including 25, 35, 40… where nobody came); the win sheet counts down to the next arrival.
- A once-a-day **pat** on any resident or friend adds a heart of affection (cosmetic only). Tapping a figure in the
  garden makes it react. One line under the scene comes from a resident and only states real facts (a recent Hard or
  Expert solve, the streak, a newcomer, today's solve). Evenings (7 pm–6 am local) get a dusk wash and fireflies.

## 2026-10-26 · D25 — Fixes from the second independent review
A fresh review of D21–D24 found no data loss, no double grants and no Paw Cup leak, and nine smaller defects; all are
fixed with tests where testable:
1. A board with a spent ticket, a mistake or a treat but no placement was thrown away on re-entry (so a paid hint could
   be paid again, and lost hearts came back). Such boards are now resumable.
2. Looking at the free hint again after any move charged a ticket. The free look's cell is remembered (and saved).
3. Tapping the win sheet could leave the Paw Points count-up frozen mid-count. The final number now always wins.
4. Under reduced motion the win sheet's later sections still waited out their stage delays. Everything shows at once.
5. The hint badge said a ticket was needed when the next look was already paid for. It now asks the session.
6. A held key (H, C, D…) auto-repeated actions and could run through hint tiers and tickets. Repeats are ignored.
7. An errand claimed with a full treat jar announced "+1 treat" while the treat had become coins. The toast now says
   exactly what arrived (`claimMissionDetailed`).
8. Paw Cup boards were labeled by their lineup slot in the League list but by measurement on the board. The list now
   shows size and par only (measuring five Cup boards on screen open would cost up to a second each on a phone).
9. The Play path showed the new board's size for a level whose old 9×9 was still in progress. It now uses the saved spec.
Also: a treat is spent only after checking it will really restore a heart; erasing progress grants the starter pantry
again; the release checklist now covers setting `DAILY_V2_FROM` to the rollout date and pinning grading changes.

## 2026-10-29 · D26 — Softer board, colored game icons, Play opens on your level, treats become Extra lives
- **Board**: dark region dividers and the dark frame are gone. Regions are separated by 4px light seams in the board's
  ivory, with a faint outer ring and shadow. Players who need stronger edges get the dark dividers back in
  Settings → High contrast (unchanged), and Region patterns still add texture.
- **Icons**: lives are glossy hearts (a lost one is a pale dashed outline, so it isn't color alone); hints are a golden
  bulb with a paw; extra lives, video tokens, gems and food have their own colored icons. Drawn in layers, no
  gradients, so cloned copies render identically.
- **Play tab**: opens centered on the level you're on, with a pinned "Play level N · size · difficulty" button above the
  tab bar (it resumes a saved board of that level, on that board's own spec).
- **Naming**: the item that gives a heart back is now an **Extra life** (ledger kind `life`; saved `treat` entries load
  as `life`). Hint tickets are just **hints** in the UI. "Treats" now means food for sanctuary animals (D27). Ledger
  ids keep their original `treat` wording (`starter:pantry:treat`, `treat:L12`, `mission:…:treat`) so nothing is ever
  granted twice.

## 2026-10-29 · D27 — Three currencies, sanctuary food, optional reward videos (AdMob), gems (RevenueCat); Capacitor 8
Owner decisions (2026-10-29): reward videos through Google AdMob, paid gems through RevenueCat. This revises D6
("no ad SDK, nothing for sale") under the same principles: optional, honest, never pay-to-win.

- **Currencies**: Paw Coins (earned by solving; everyday decor and food), **video tokens** (only from reward videos;
  special decor and special treats), **gems** (App Store gem packs; premium decor only). Gems and tokens live in the
  item ledger (`vtoken`, `gem`), spent with idempotent ids like coins. Nothing sold or earned by video affects puzzles,
  Paw Cup or rankings; hearts and hints can be earned by playing or by a video, never bought with money.
- **Decor**: each item has exactly one price. New for Harmony: Rainbow Kite and Cottage String Lights (video tokens),
  Hot-Air Balloon and Golden Fountain (gems). Items can share a **slot** (the Golden Fountain stands where the Stone
  Fountain does); bringing one out tucks the other away, and a bought item comes straight out.
- **Food & treats**: 8 foods for coins, 3 special treats for video tokens, kept in the pantry (max 30 each) and fed from
  an animal's card. Favorites count double; special treats are everyone's favorite. An animal takes up to 6 hearts of
  affection from food a day, then politely declines (the food stays). Affection gives a friendship level (New friend →
  Family). Cosmetic only.
- **Reward videos** (`services/ads.ts`, `app/rewarded.ts`): only when the player taps "Watch a short video" for an extra
  life (when out of extra lives, incl. on the loss sheet, where it brings the board back), a hint (when out of hints)
  or a video token (Shop). 10 a day, shared. Granted only when the SDK confirms the reward, and kept even if the player
  left the screen. **No interstitials** (`INTERSTITIALS_ENABLED = false`) and no banners. The old "refill all hearts"
  revive is gone; a video gives one heart, like an extra life. AdMob runs only on the iOS app with `VITE_ADMOB_ENABLED=1`
  (Info.plist must be set up first, or the SDK crashes); consent (UMP) and Apple's tracking prompt are asked on the first
  video the player chooses, never at launch. Google's test unit is used until a real one is configured.
- **Gems** (`services/iap.ts`, `meta/gems.ts`): RevenueCat on the iOS app when `VITE_REVENUECAT_IOS_KEY` is set. Each
  purchase is granted once per store transaction id, and on launch any recorded consumable the save lacks is granted.
  Release builds without a key show gem packs as "coming soon". The never-built bundles (starter decor, cozy theme,
  portraits, supporter) were removed from the catalog; Remove interruptions stays for v1 owners.
- **Test builds** (dev and the tester preview) use a labeled test store and test videos. Test gems carry source `test`
  and never count in a release build (`setTestEntriesCount`), mirroring D6's dev entitlements.
- **Capacitor 6 → 8** (plus `@capacitor/haptics` 8), done before the iOS project was first generated, because both
  plugins require Capacitor 8. Setup steps for Info.plist, App Store Connect products, RevenueCat and AdMob are in
  `docs/native-setup.md`; keys go in `.env.local` (`.env.example` lists them).

## 2026-10-29 · D28 — The world map and regional sanctuaries
Owner decisions (2026-10-29): four regional sanctuaries — Australian Outback, African Savanna, Arctic, Amazon
Rainforest — each with animals from that region, tracked on a world map.

- **Opening**: regions open for free at Journey milestones (after levels 6, 20, 40, 60). Opening and growing a region
  are never sold; there is no way to buy progress.
- **Growing**: you build one regional sanctuary at a time (the first open, unfinished one, or the one you pick with
  "Build here"; progress elsewhere is kept). Every solved puzzle adds one to it — Journey (replays too), Daily and Zen;
  Paw Cup is competition and the guided first board is practice, so neither counts. Stages at 3 / 8 / 15 / 25 solves:
  first friend, shelter, water and shade, thriving. Each of the first three stages welcomes one of the region's
  animals; the last gives 150 Paw Coins once (`world:complete:<id>`). Stages and arrivals are derived from the growth
  count, so a reconcile at startup repairs an interrupted save and nothing is granted twice (`meta/world.ts`).
- **Animals**: 12 regional wildlife friends (koala, kangaroo, wombat; giraffe, meerkat, elephant calf; snowy owl, polar
  bear cub, seal pup; toucan, sloth, capybara), drawn in code like Ember and Maple, with pats, food and favorites. They
  live only in their sanctuary and never appear on a puzzle board (cats and dogs only, D11).
- **Decor**: each region has four decorations of its own (two for coins, one for video tokens, one for gems), bought
  once that region is open. The Shop's decor tab picks a sanctuary. Every decoration belongs to exactly one sanctuary.
- **Map**: Natural Earth land outlines (public domain, via world-atlas) projected with Natural Earth I by a one-off
  script; the output is committed and the app computes pin positions with the same formula (no d3 at runtime). Harmony
  is a small fictional island in the Pacific.
- **Navigation**: the bottom bar's Pets tab becomes **World** (map → regional sanctuary). The resident collection is
  now the **Animal album** (from World), with every wildlife friend listed by sanctuary. Home shows a strip with the
  sanctuary being built and how close its next stage is.
- **Life**: regional scenes reuse the sanctuary ambient director (D24): blades turn, the aurora ripples, birds and
  butterflies drift, hammocks sway, one short action at a time, nothing looping, still under reduced motion. Animals
  say hello when you arrive (a bigger hello on the first visit of the day or right after a solve that helped), and a
  stage just reached grows in.

## 2026-10-29 · D29 — Livelier sanctuaries, still calm
Owner request: sanctuaries more animated, and animals excited when you visit.

- **Arrival**: everyone in a sanctuary (Harmony or a region) says hello one after another when you arrive: a hop or a
  wag, or a bigger hello (two happy hops, a smile and a heart) on the first visit of the day and right after a puzzle
  that helped that place. A stage just reached grows in.
- **Taps and care**: tapping an animal in the scene gets a happy hop and a heart. Feeding or patting from an animal's
  card makes it react in the scene once the card closes, where you can see it.
- **Ambient pacing** (revises D24's numbers, not its rules): up to three small actions at once (was two), one every
  3.5–9 s (was 5–12 s), plus short strolls (a few steps, a turn, back to its spot). Every action is still ≤ 1.8 s, nothing
  loops forever, everything pauses when the screen is hidden, and under reduced motion nothing moves by itself (a tap
  still gets a smile and a heart). The puzzle board is unchanged: faces only (D11).

## 2026-10-29 · D30 — A real leaderboard on our own server (Firebase)
Owner decision (2026-10-29): leaderboard on our own server, Firebase.

- **What is ranked**: Paw Points from the Journey and the Daily (the progress measure players already know), in a
  weekly table (UTC week) and an all-time table. Paw Cup stays offline practice; its online leagues are still Phase 6.
- **Opt-in**: League → Leaderboard → Join, with a nickname (a friendly suggestion is the default) and a picture of one
  of the player's welcomed animals. Anonymous sign-in happens only then. Leaving deletes everything.
- **Fair by construction**: the client never sends points. It sends which board it solved (mode + spec) and the move
  log; the server rebuilds the board and replays the log with that mode's rules (the same `Session` and verifier the
  game uses), then awards with the app's own point table. Award ids (`L12`, `clean:L12`, `nohint:L12`, `D<date>`) pay
  once per account. Logs faster than 250 ms per placement don't count, a board counts only on the spec it is issued
  under today, and no log may hold more hints than the board has cells. 30 solves an hour, 80 a day, checked before any
  board is rebuilt. Only boards solved after joining count (earlier solves have no logs to check). Honest about the
  limit: a script can replay boards like a person would, so pacing (not the replay) bounds what it can add; App Check
  and reports are the next lines. To make every board checkable, a hint that places a pet
  is now logged as a placement, and Journey/Daily saves keep their move log across resumes.
- **Names**: 3–20 characters, no links; strong words blocked anywhere, short ambiguous ones only as whole words (so
  Hancock and Dickens are fine); checked on device and server. Three distinct reporters (each with a counted solve)
  replace a name with "Player ####". Only real players are shown, ever.
- **Deletion**: leaving removes every document, the player's id in reports they made, and the sign-in; erasing
  progress leaves first; a daily clean-up removes accounts inactive for a year. A sync still in flight when the player
  leaves is ignored.
- **App Check** isn't wired up: the web view can't use App Attest without a native plugin, and enforcing it without
  one would reject every call. It stays off until that plugin exists.
- **Shape**: all decisions in `src/leaderboard/` (pure, unit-tested against an in-memory store that enforces Firestore's
  reads-before-writes); `functions/src/index.ts` only adapts Firestore and Auth. Firestore rules deny all client
  writes. The Firebase SDK is loaded only when the leaderboard is used. Without Firebase settings, development builds
  and the tester preview run the same logic on the device (a table with only you); release builds say it's coming.
- **Not done here**: the security-rules tests and the functions could not be run against the Firebase emulator in this
  environment (its download is blocked); they are ready to run with `npm run fb:test` / `npm run fb:emulators`.

## 2026-10-29 · D31 — A steeper Journey: 7×7 from level 6, then 8×8 and 9×9
Owner decisions (2026-10-29): new boards for every level from 6; 8×8 and 9×9 mix later. This revises D22's 8×8 cap
for the Journey (dailies keep it).

- **Spec 3** (`game/specs.ts → journeyTargetV3`, frozen in `data/journeyPack3.ts` for 6–150): 7×7 right after the five
  first lessons, 8×8 from 15, the first 9×9 at 40, 9×9 the main size after 70, with occasional smaller breather boards.
  Each board is chosen by measured difficulty and its label is what it measures.
- **What players keep**: levels already cleared stay cleared with their stars, coins, points and arrivals. A replay of
  such a level is the new board, with its best time starting fresh (times only compare on the same board). A board in
  progress resumes on the spec it was started on (spec 1 and 2 boards stay buildable), and the leaderboard counts a
  board only on the spec it's issued under today.
- Tips moved with the sizes (7×7 at 6, 8×8 at 15, 9×9 at 40).

## 2026-10-29 · D32 — Animals use the special and premium decorations
Owner decision (2026-10-29): every gem and video-token decoration gets something animals do with it.

- **Twelve activities** (`ui/art/activities.ts`): balloon rides, kite flying, splashing in the golden fountain, a
  rooftop dance under the string lights, hammock naps, the opal rock's shine, dancing with the flamingos, tea under the
  pavilion, a lantern parade, aurora watching, letting the fireflies out, and sliding down the waterfall.
- **How it plays** (`ui/components/activities.ts`): tap the decoration, or wait — one starts by itself 5–9 s after you
  arrive and then every 35–60 s while the screen is open. One at a time. A copy of an animal from that scene (a resident
  or wildlife friend) takes part while its own figure steps away, and the line under the scene says what's happening.
- **Motion policy** (extends D24/D29): a whole activity is one short scene of at most 6.5 s including repeats
  (`styles/sanctuary-play.css`, checked by `test/unit/play.test.ts`); nothing loops forever; nothing starts by itself
  under reduced motion, and a tap shows the animal in place, still. Paused when the screen is hidden.
- The Shop's decoration card names the activity, so buying one says what it will do.

## 2026-10-29 · D33 — Tricks: ask an animal to perform, with an emote
Owner decision (2026-10-29): two free tricks, then everyday tricks for video tokens earned by watching videos, then
more animated tricks that can only be bought with gems.

- **Ten tricks** (`meta/catalogs/tricks.ts`): Wave and Hop are free and known by everyone. Spin, Take a bow, Roll
  over and Happy dance cost 2–3 video tokens (which only come from reward videos the player chooses to watch). Backflip
  (a flip and a shower of stars), Bubble float (floats up in a bubble, then pop), Star juggling and Rainbow leap (over
  a rainbow that paints itself) cost 40–90 gems and can't be had any other way.
- **How it plays**: tap any resident or wildlife friend in a sanctuary, or the Tricks button under the scene, and a
  tray opens — "Ask Mochi to…" — with every trick and everyone in the scene to choose from (so it works with a
  keyboard or screen reader too). A known trick plays at once on that animal with an emote bubble beside its head and
  is announced to screen readers; any other opens its card with a live preview and how to get it. The Shop has a
  Tricks tab with the same cards. A trick learned once works for every animal. An animal busy on a decoration, or
  already mid-trick, finishes first; a trick takes over from a greeting or stroll in progress.
- **Activities and screen readers** (revises D32): only an activity the player starts is announced; ones that start
  by themselves are shown, not read out.
- **Charged once** like decorations (`buy:trick:<id>` in the item ledger), saved in `inventory.tricks`.
- **Motion policy** (extends D24/D32): each trick is 1.3–3.4 s and over by itself; props never outlast it; the board
  is never touched; under reduced motion only the emote shows, still. Ambient life and activities leave an animal
  alone while it performs. Tricks change nothing in puzzles, rankings or rewards.

## 2026-10-29 · D34 — The sanctuary animals become 3D soft toys
Owner decisions (2026-10-29): real 3D animals (not 2.5D, not whole 3D scenes); soft-toy look; tricks plus new emotes
acted out with face and body.

- **Models** (`src/three/species.ts`, `toy.ts`): all 20 animals are built in code from rounded parts with a plush
  finish (a soft sheen), in their 2D colors, with painted faces (`face.ts`: eyes, brows, blush and mouths per
  expression) and a small rig: body, head, ears, front legs or wings or flippers, hind legs, tail, trunk. No model files.
- **In the scene** (`stage.ts`): a transparent WebGL canvas lies over the drawn sanctuary; each toy stands exactly on
  its drawn figure's spot (`data-gx/gy/gh`), nearer ones in front, with a soft ground shadow. The drawn figures stay,
  invisible, as the source of truth: the stage watches their classes (`is-hop`, `is-trick-…`, `is-away`) and plays
  the same thing in 3D, so the ambient director, tricks and activities needed no new wiring. Taps still land on the
  drawn figures; a toy that has wandered off is picked by a ray.
- **Motion** (`clips.ts`, `actor.ts`): pure, tested clips that start and end at rest: breathing, blinks and ear
  twitches; a look round, a yawn, a stretch, a wag, a hop; a greeting wave; and a stroll that turns to show the
  animal's profile and back. Tricks and emotes take over from small moves.
- **Tricks in 3D**: the ten tricks are performances with depth (a spin shows the back, the backflip turns over in the
  air, the rainbow leap turns toward where it lands and walks home through its back), with 3D props that follow the
  animal: a star burst, a glassy bubble that pops, juggled stars, a rainbow that paints itself, dust puffs, notes. The
  emote bubble is drawn in 3D beside the head and follows it. The drawn overlays remain for the drawn animals.
- **Emotes** (revises D33's list): eight feelings acted out with the face and the whole body, in their own tab of the
  tray and the Shop: Love and Giggle are free; Cheer, Surprise, Sleepy (2 video tokens) and Shy (3) are video-token
  emotes; Starstruck (45 gems: star eyes, a twirl inside a ring of stars) and Party time (60 gems: a party hat,
  confetti, a dance) can only be bought. Same ledger, same rules, cosmetic only. New faces: heart eyes, star eyes,
  giggling, blushing, yawning, surprised.
- **Decoration rides in 3D** (D32): the toy itself rides the balloon, flies the kite, naps in the hammock, slides down
  the waterfall. It follows the drawn rider's path (which stays, invisible, as the choreography), acts it out with
  its own clip, turns to face where a travelling decoration takes it, and sits *inside* the balloon's basket: an
  invisible cut-out in front of the toy lets the drawn basket show over its legs.
- **Previews**: a trick or emote card shows a 3D toy performing it too, released when the card closes.
- **Cost and fallbacks**: three.js loads only when a sanctuary opens (≈ 165 kB gzipped, its own chunk; the
  single-file tester preview carries it from the start), and no WebGL context is made for a scene that never shows
  toys (a locked region). If the OS takes the context back, the drawn animals return until it is restored. Eight toys
  draw in about 200 calls and 140k triangles; posing them takes about 0.1 ms a frame. Without
  WebGL, if the context is lost, or with Settings → 3D animals off, the drawn animals stay. Frames: smooth while
  something plays, ~30 fps for breathing, a few per second under reduced motion (where nothing moves by itself), none
  when hidden or scrolled away. The canvas and context are released when the screen closes.
- The puzzle board is untouched (faces only, D11).

## 2026-10-29 · D35 — One animal first; the Farm and the Pet Garden; animals come home as you build (revises D11, D15, D28)
Owner decisions (2026-10-29): Journey levels 1–20 are one-animal boards and two animals start after level 20, which
also slows how fast animals are collected. Not cats only: the animals belong to the sanctuary being built, starting
with farm animals (a sheep first, so it doesn't feel like a cat or dog puzzle), then domestic pets including cats and
dogs; beginner sanctuaries first, the exotic regions at later levels. You collect a sanctuary's animals, treats and
decor, then move on and build the next one. Controls: tap places ✕, double-tap places the animal and a wrong one costs
a heart; only Erase and Hint below the board, the rules tucked away. Recommended options taken: a new Farm plus the
Pet Garden as the beginner sanctuaries; one level ladder; the board shows the animal you're bringing home; two animal
buttons on two-animal boards. Slow-down pace, board sizes and the Daily left to us.

- **The one-animal rule** (`engine/solo.ts`): one animal in every row, column and color region, and no two touch,
  not even at a corner. The animal is stored as species 1, so sessions, saves, replays and the server verifier carry
  it unchanged; `Puzzle.rule = 'solo'` marks the board. The generator places a random permutation, grows regions from
  the animals at uneven rates, repairs any second solution by moving one cell between neighboring regions, and keeps
  the board only if the human deduction steps solve it (single → pointing → neighbor lock → k regions in k lines).
  1–13 ms per board. Hints and grading use the same steps (`docs/DIFFICULTY.md`).
- **One ladder, spec 4** (`game/specs.ts`, `data/journeyPack4.ts`): levels 1–20 are one-animal boards, 5×5 lessons
  up to 9×9 by level 17 (level 1 has a one-tile region, so the first move needs no hunting); level 21 is the
  two-animal lesson and every level L ≥ 21 plays the exact board two-animal level L − 20 always had (the five original
  lessons, then the spec-3 ramp), so nothing new is generated for it. Saved boards keep their spec. Daily and Zen are
  one-animal boards until the two-animal lesson is done (`playsSolo`); the one-animal Daily is its own board (≤ 8×8),
  and both Dailies of a date share one award id, so a day pays Paw Points once. Paw Cup boards have two animals, so
  the Cup opens after level 21.
- **The world** (`meta/world.ts`, `meta/catalogs/sanctuaries.ts`): the Farm and the Pet Garden are open from the
  start; the Outback opens after level 10, the Savanna 25, the Arctic 40, the Amazon 60. Every puzzle you solve
  (Journey, Daily, Zen, including the guided first board; not Paw Cup) grows the sanctuary you're building by one.
  Its animals come home one at a time at set counts: the Farm's Cotton the sheep (1), Truffle the piglet (4),
  Buttercup the calf (8), Pepper the goat kid (13), Marigold the chick (19) and Hazel the pony (26); the Pet Garden's
  Juniper the bunny, then the six cats and dogs, Ember and Maple (1 → 53); the regions' three animals at 3, 8 and 15.
  The Farm and the regions also grow through drawn stages. When everyone is home (and the last stage is reached) the
  sanctuary is finished, pays a coin gift once, and building moves to the next open one; the player can switch at
  any time. Arrivals and stages are derived from the count, so nothing is ever granted twice. Earlier saves start the
  Pet Garden at their residents' place in its line.
- **The board's animals** (`meta/cast.ts`): a board shows the animal you're bringing home next in the sanctuary you're
  building; a two-animal board pairs it with one already home, of a different kind when possible. The cast is saved
  with the board. All the friends' heads now have animated face layers (`ui/art/companions.ts` → `friendRigBody`),
  still faces only on the board (D11 kept).
- **Controls** (`ui/screens/game.ts`): tap a tile for ✕ (tap again to clear); double-tap (within 380 ms) to place;
  a wrong placement costs a heart and leaves a ✕. Erase is a toggle; one-animal boards show only Erase and Hint,
  two-animal boards add the two animal buttons (the double tap places the one picked). Undo, redo and How to play are
  in the pause sheet. The old tap cycle stays as Settings → Controls → Classic. How to play draws the board's own
  animals and shows the rule the player is on.
- **Each sanctuary has its own treats and decor**: the Food shop is filtered by sanctuary; the Farm sells hay, apples
  and corn, and has five decorations (a scarecrow, a flower wheelbarrow and a water trough, then a tire swing and a
  little red tractor that animals ride, in 2D and 3D). The first free starter gift is offered where the player first
  visits: a wheelbarrow or a trough on the Farm.
- **3D** (D34): seven new soft toys (sheep, piglet, calf, goat kid, chick, pony, bunny) with side ears, wool, horns,
  a beard, a crest, patches and a blaze; tire-swing and tractor rides.
- **Screens**: Home shows the sanctuary being built and who comes next; the win sheet says who came home and who is on
  the way; the album groups animals by sanctuary and shows the next arrival in color; the World map has six pins.
- **Saves from before D35** (`storage.upgradeLadder`, once, with a backup at `pawtopia.backup.v2.pre-d35`; v1 saves
  too): two-animal level L is now level L + 20 on the very same board, so a player who had cleared any level moves up
  by 20. Clears, stars, best times, the next level, the board in progress and queued leaderboard solves move with it;
  the two-animal lesson counts as done, so their Daily, Zen and Paw Cup stay two-animal. Levels 1–20 show as open
  (not solved) on the path, and Home says once what happened. A player who never cleared a level starts the new
  ladder. A save that already uses the new numbering (any one-animal onboarding flag or spec-4 board) is never moved;
  an old two-animal level 1 left in progress by a player with no clears is dropped rather than resumed as the new
  level 1. The v1 welcome sheet stays for v1 saves; a moved save's catch-up (finished chapters under their new
  numbers) is listed in its own notice. Solved counts and the first-chapter badge count real clears.
- **Rewards follow the board, not the number** (`specs.levelRewardKey`): one-animal levels pay under `S1`–`S20`; level
  L ≥ 21 pays under `L<L − 20>`, the id that board always had. Coins, Paw Points, extra lives, hints and the server's
  awards all use it, so a moved player never earns twice for a board (nor gets nothing for the new levels). Chapter
  gifts stay with chapter numbers.
- **Both Dailies of a date pay the same** (`specs.dailyPointsTier`): the easier of the two weekday slots, on the device
  and on the server, so no one gains by playing the other board. The server refuses one-animal Dailies dated before
  the measured Dailies (2026-10-27), when they didn't exist.
- **No-timing controls**: Settings → Controls → Tap cycle (no quick double tap; for VoiceOver and Switch Control) is
  named in Settings and in How to play.
- Kept: hearts, hints and the Paw Cup's rules; the two-animal engine and every shipped two-animal board; nothing
  pay-to-win.

## 2026-10-31 · D36 — Journey, World and puzzle UX review (revises D35's controls and win flow)
Owner decisions (2026-10-31), from the Journey/World/puzzle UX review of `main` @ `9e47172`: the default controls move
to **one tap places the selected animal** (an explicit ✕ tool for marking; the D35 tap/double-tap scheme and the tap
cycle stay as options and existing players are told once); the bottom bar becomes **four tabs, Journey / World /
Challenges / Shop**, with Home folded into Journey; the work ships as **five stacked pull requests** (correctness,
controls, navigation, win flow, delight) and nothing is merged without the owner. World growth keeps **Policy A**:
every Journey, Daily and Zen solve counts (replays too); the Paw Cup never does. *(Policy A is superseded by D38 PR D:
each puzzle grows the world once.)*

### PR 1 — correctness (P0)
- **A wrong guess leaves the tile as it was** (`game.ts::placeAt`, `::keyApply`): the attempted animal fades as a
  ghost with a strike and a heart is lost, but nothing is marked for the player. Before, every wrong placement wrote a
  ✕, which on a two-animal board is false when the tile holds the other animal and on any board gives away what a
  heart just paid for. The player's own ✕ (made first, by keyboard or by hand) stays. `Board.render` keeps a mistake's
  ghost across a re-render.
- **A board helps the sanctuary it started for** (`world.ts::creditSolve`, `::beneficiaryOf`): the win credits the
  board's saved `cast.sanctuary`, not whatever is being built at the time. Choosing another sanctuary while a board is
  saved changes the *next* board; the saved one keeps its promise, and the Build-here toast says so. Only a board whose
  sanctuary was finished while it sat saved helps the one being built now, and the win sheet says it did
  (`GrowthNews.redirectedFrom`). With nothing left to build, nothing grows. Crediting never moves `world.active`.
- **One credit per board** (`world.credits`): every board gets an id when it starts (`gameFlow.newBoardId`, saved
  with the board as `boardId`); its solve is credited once under it, whatever handles the win again. The newest sixty
  receipts are kept. Boards saved before ids existed get one on resume.
- **A region that opens is the news** (`game.ts::showWin`): when a solve opens a sanctuary, the win's visit action is
  "Explore the Outback" and goes there, even when the same solve also grew the Farm. Meeting a newcomer goes to the
  newcomer's home.
- The board's header shows which sanctuary it helps (a chip beside the size; in the status line on short phones), and
  the win's world line reads "Farm +1 · Truffle is on the way: 2 more puzzles".

### PR 2 — controls: one tap places (P0/P1)
- **Default scheme `place`** (`storage.ControlScheme`): a tool bar under the board with the board's animal(s), ✕ and
  Erase, one pressed at a time (a radiogroup); one tap on a tile applies the tool. A one-animal board shows its animal
  pressed from the start, so a new player's first placement is one tap. Pressing ✕ or Erase a second time goes back to
  the animal. The ✕ tool drags a run of tiles; the animal tool never drags, and in Large board mode nothing acts on
  pointer-down, so a pan can't mark. A tap on a placed animal does nothing but say how to take it back (Erase or Undo):
  an accidental tap never erases. Keyboard: arrows move; Enter applies the pressed tool; 1/2 place; X or Space marks;
  Delete erases; Z/Y undo/redo; H hint; E and X (off a cell) switch tools.
- **The other schemes stay**: `tap` (D35: tap ✕, double-tap places; Erase toggles) and `classic` (tap cycle), named
  in Settings with a one-line picture each, and How to play describes whichever is on.
- **Existing players move with the default and are told once** (`storage.normalizeSave`): a save whose `controls` is
  D35's default `tap` (never a choice made under these options, marked by `controlsVersion: 2`) becomes `place`, and
  `onboarding.controlsNotice` shows one card on the hub with "Got it" and "Choose controls". A player who chose the tap
  cycle keeps it; a save that never played, and a fresh install, get the default silently. The retired `tools`
  spelling (the first pick-a-tool scheme) is `place` again.
- **Level 21 opens with a bridge** (`rules.showRules({ bridge })`): one sheet, the two-animal rules drawn with the
  board's own animals and the controls in one line, then the guided lesson places the first two. Shown once
  (`pairRulesSeen`). Level 19 and 20 tips say what is coming.
- Coaching under each scheme says what the player actually does ("tap it", "double-tap it", "tap it twice").

### PR 3 — one Journey, the World above its map, Back that works (P1)
- **Four tabs** (`ui/components/nav.ts`, `router.TabId`): **Journey · World · Challenges · Shop**. Home and Play were
  two places to start a puzzle with overlapping Daily and Zen entries; they are one screen now (`screens/journey.ts`).
  League is Challenges (the Paw Points leaderboard, the Paw Cup, the Daily history). The old route names still resolve
  (`router.canonical`), so saved links and tests keep working.
- **The Journey hub, in order**: the goal card (the sanctuary being built, its picture, who is on the way and how close,
  Visit), then the next level with one big button, then Level path and World map links, the Daily with its week strip,
  Zen with its sizes, the one-time notices and the errands. On a 375×667 phone the goal, the level and the button are
  all on screen without scrolling (checked in e2e at 390×844 and by screenshot at 375×667). The chapter path is the
  Journey's second view (`view: 'path'`), one tap away and one tap back.
- **One Continue**: the next unfinished Journey level, or the Journey board already on the table (with "Play level N
  instead" when they differ). A saved Daily or Zen board is offered on its own line, never as Continue.
- **World**: the goal panel (with Play and Visit, and "Build somewhere else instead" when there is somewhere else)
  sits above the map; the list below says **Building here · … / Build here · … while you build here / Locked until
  level N / Complete** — never "Paused". A one-line explanation of one-home-at-a-time shows on the first visit, with
  its own close (`onboarding.worldTipSeen`).
- **Back retraces your steps** (`Router.history`): every screen remembers the one it was opened from and how far down
  the reader was; Back returns there at that scroll position. The Farm, the Pet Garden, the album and the Journal all
  use it (the Pet Garden used to go to Home while the Farm went to the World). A Shop opened from a sanctuary shows a
  Back to that sanctuary. A tab tap is a fresh start (the history is cleared). A board is never kept in the history, so
  Back never reopens a finished board; leaving a board returns to wherever it was opened from.
- The win sheet's "Back home" is "Back to Journey" (`modes.nextAfterWin` says `journey`).
- Two things the independent review of the stack caught: the welcome splash is never kept in the Back history (a new
  player who leaves the first board or visits the Farm after it comes back to the Journey, not to "Meet Cotton"), and
  "Play level N instead" while a Journey board with progress is saved asks first, naming the board and its moves,
  since the game keeps one board at a time.

### PR 4 — the win sheet: milestones first, ordinary wins quick (P1)
- **Two kinds of win** (`game.ts::showWin`, `world.isMilestone`). An ordinary win is quick: stars and time, Paw
  Points, the rewards, the world line ("Farm +1 · Buttercup the calf is on the way: 4 more puzzles"), one big button
  (the next level) and a quiet Visit. A milestone win — someone came home, a stage was reached, a sanctuary opened or
  finished — puts the event first as the sheet's centerpiece (`heroMarkup`: the region's land with a New badge, the
  newcomer's portrait with a Home badge, or the stage) and makes the visit the main action (Meet Truffle, Explore the
  Outback, Visit the Farm), with the next level a full-size second button. Nothing waits on a visit: the next puzzle is
  always one tap away.
- **The biggest news leads** (`heroOf`): a region that opened outranks an arrival, which outranks a finished sanctuary,
  which outranks a stage; the rest is listed under the stats. The Paw Cup never shows a hero.
- **"New" until visited** (`world.unseen`, `noteUnseen`, `unseenIn`, `markSeen`): a milestone the player skips waits
  as a coral chip on the World card ("New: Truffle came home" / "New: just opened" / "New: barn raising"), a dot on
  the map pin and on the World tab, and a chip on the Journey's goal card, until that sanctuary is opened. Opening it
  clears the marker and greets the newcomers (the toast and the hello the sanctuary already gave to arrivals from this
  win). Arrivals and stages can only happen once, so a replayed level or a reopened app never re-raises old news; the
  sheet itself is never persisted.

### PR 5 — delight and hardening (P2)
- **The welcome is the Farm** (`welcome.ts`): the land at its first stage, one tile with the animal of the first board
  (`castFor` on the fresh save: Cotton), a story about Meadow Farm, and "Meet Cotton". Mochi and Biscuit are gone from
  the splash; they come home later, in the Pet Garden.
- **Hint steps say what they do** (`Hint → Explain → Place it`), the same free look and ticket rules as before. A tap
  on the board's difficulty chip tells why the board is as hard as it is (`difficultyReason`), never what to do next.
- **Replays have goals** (`game.ts::replayGoal`): the coach line on a solved level says which stars are still to earn
  ("One star to earn: solve it with no mistakes") or the best time to beat. No new currency, no leaderboard effect.
- **Color glow on one-animal boards**: placing an animal glows its color's tiles for a beat (overlay only, off under
  reduced motion), the same acknowledgement two-animal boards give a finished line.
- **One-time cues in a sanctuary** (`components/sceneCues.ts`): "Try tapping an animal" on the first visit with an
  animal; later, "Tap a decoration with a sparkle" once a decoration that can be used is out. Each is dismissed by
  doing the thing or by its close, once (`onboarding.sceneTapTipSeen`, `decorTipSeen`). Never during a puzzle.
- Not done here, on purpose: a "feature of the day" on sanctuary cards (would need a pat/activity availability model
  that is honest about what is really available) and the five-player usability session, which needs people. The
  device checklist for everything in D36 is in `docs/release-checklist.md`.
- Docs: README (tabs, controls, first run), package description, architecture (crediting, navigation), roadmap.
- Hardening tests from the independent review: Large board mode pans without marking or placing; a ✕ drag changes
  exactly the tiles under the finger; tool buttons and cells carry screen-reader labels; reduced motion skips the color
  glow; with no video network the loss sheet offers no video and the Journey loop still runs.

## 2026-10-31 · D37 — One gesture: tap marks, double-tap places; mistakes stay marked (revises D36's controls)
Owner decisions (2026-10-31, after play-testing D36): a single action for marking and placing. One tap marks a tile
✕; a double tap places the animal if it belongs there. A wrong animal costs a heart and leaves an error mark. Two-animal
boards keep an animal button for each animal below the board and no separate ✕ button: pick the animal, tap to mark,
double-tap to place. Erase takes back ✕ marks only, never placed animals or mistakes. The Hint button shows how many
hints the player has. The dots on tiles no animal can reach show on Easy boards only.

- **One scheme, plus the tap cycle** (`storage.ControlScheme = 'tap' | 'classic'`): D36's one-tap tool bar (`place`)
  is retired, with its one-time notice (`components/notices.ts`, `onboarding.controlsNotice`, `settings.controlsVersion`
  all removed). Every save plays tap / double-tap (`place` and the older `tools` map to `tap`), except a save that chose
  the tap cycle, which stays: it needs no quick double tap, for VoiceOver and Switch Control.
- **Mistakes stay on the board** (`Session.errorsAt`, `hasError`; `SessionSnapshot.errors`; `Board` `ErrorMark`): a wrong
  animal is remembered on its tile. On a one-animal board, or when both animals were tried on a two-animal board, the
  mark is a red ✕ (no animal lives there). When only one animal was tried on a two-animal board, the mark is that
  animal, faded and struck through in red: it says "no cat here", not "empty", because the other animal may live there
  (the reason D36 stopped writing a plain ✕ for wrong guesses), and the other animal can still be placed on it. The
  mark replaces the player's own ✕ on that tile. It is a record of a paid mistake, not a board change: Undo, Erase and
  drag-marking never touch it, and restoring a save keeps only marks that are true. Trying the same wrong animal on the
  same tile again does nothing and costs nothing. The move log is unchanged (a wrong guess is still one `place`
  event), so the server's replay check and Paw Cup scoring are untouched.
- **Erase is ✕-only** (`game.ts::eraseAt`): with Erase on, a tap (or a drag) takes ✕ marks back; on an animal or a
  mistake it says why it stays. Placed animals are always right (a wrong one never settles), so nothing is lost; Undo
  in the pause sheet still takes back the last move.
- **Hint count** (`game.ts::paint`): the badge on Hint is always the player's hints. When the next look costs nothing
  (each board's first look, Zen, the guided boards), the button says "Free hint".
- **Dots on Easy boards only** (`showDots`): the "Dot impossible tiles" setting now applies to boards measured Easy;
  on Medium and harder boards, marking is the player's to do.
- Copy follows: the coach line, the guided boards ("double-tap it"), How to play and the level-21 bridge ("Tap a tile
  to mark it ✕. Double-tap to place… A wrong guess costs a heart and is marked in red"), Settings.

## 2026-10-31 · D38 — Premium UX pass: saved boards per mode, gesture clarity, hierarchy, fair growth, polish
From `PAWTOPIA_D37_UX_PREMIUM_REVIEW_REVISED_NO_UNDO.md` (the independent audit of `main` @ `c5d5783`). Five small PRs
(A–E), each reviewable on its own; nothing here rebuilds what D36/D37 delivered.

### PR A — one saved board per mode (P0)
The audit's one verified code-level issue: `lastSession` was a single slot for Journey, Daily and Zen, `playMode` only
looked for a save of the requested mode, and `saveActive` replaced the slot, so an unfinished Journey board was silently
displaced by playing a Daily (and vice versa). Confirmed with a failing test against `main` before the fix.

- **Slots** (`storage.SaveV2.sessions`: `level` | `daily` | `zen`, each `SavedSession | null`): a Journey board, the
  Daily and the latest Zen board are kept independently. Paw Cup attempts stay in `cup.open`, one per board, as before.
  `setSavedSession` / `savedSession` / `clearSessions` are the only writers; `app.saveActive` and `app.clearSaved` use
  them.
- **Mirror for older builds** (`lastSession`): still written, as the newest of the slots (`syncSessionMirror`), so a
  build from before D38 finds the latest board. `normalizeSave` folds a legacy `lastSession` into its mode's slot (the
  one-time migration; idempotent). A rollback round trip is handled for real: an older build rewrites the save *without*
  `sessions`, so `saveSave` also keeps the slots beside it (`SESSIONS_SIDE_KEY`, which that build never touches) and
  `loadSave` puts them back; then a board the older build saved in `lastSession` replaces its stale slot, and a
  `lastSession` it set to `null` empties the newest slot (it finished that board) rather than offering a finished board
  again. (The independent review caught the first cut of this, which only worked on a shape no build writes.)
  `upgradeLadder` (D35) moves the Journey slot, not the mirror.
- **The guard at the boundary** (`gameFlow.playMode` → `heldBoardFor` → `askAboutHeldBoard`): within a mode there is
  still one slot, so before a *different* board of the same mode would take it from one with real progress
  (`hasMeaningfulProgress`), one sheet asks: *Resume* the saved board, *Start* the new one, or *Not now*. Every "play
  this" button goes through `playMode` — the Journey hub, "Play level N instead", the level path, the World, the Farm and
  the Pet Garden, the Daily card, the Zen sizes, the win sheet's next level — so the hub's own confirm (PR 3) is gone and
  no screen can throw a board away on its own. The Zen seed is consumed in `startGame` (`nextZenMode` / `zenSeed`), so a Zen tap that is answered
  with *Resume* or *Not now* spends nothing.
- **The hub lists every saved board**: the Journey board is Continue; a saved Daily and a saved Zen each get their own
  "in progress" line (`resumableSessions`). `buildHereMessage` is honest about several held boards.
- Tests: `test/unit/sessions.dom.test.ts` (cross-mode preservation both ways, after a reload, the guard from the World, a
  sanctuary, the level path, the Daily card and the Zen sizes; a board with no progress is simply replaced; Paw Cup slots
  never collide), `storage.test.ts` (slots, mirror, migration, rollback), `navigation.dom.test.ts` updated.

### PR B — gesture clarity and accessibility (P1)
D37's gesture stays the default (owner decision); this makes it quicker to learn and gives assistive tech a path with no
timing to beat.

- **One line, once** (`game.ts::maybeControlsTip`, `onboarding.controlsTipSeen`): after the first animal a player places
  on an ordinary board — not a ✕, not on the guided boards — a small note over the coach line: *Tap marks ✕ ·
  double-tap places. Prefer single taps with no timing? Controls in Settings* (worded for the two-step scheme when that is
  set). It is an overlay (`.control-tip`, absolute over `.board-foot`), so the board never moves under a finger and no
  input waits on it; ✕ or its link (which opens Settings, pausing the board) or twelve seconds remove it.
- **Activation without a pointer is two-step** (`Board` click with `detail === 0` → `onPress(r, c, activate = true)`):
  a screen reader's or a switch's "activate" marks ✕, and a second activation places — under either scheme. A finger
  still gets the fast double-tap. Keyboard keys are unchanged (Enter places, Space/X marks).
- **Discoverable from Pause**: a read-only *Controls* line saying what a tap does right now, and the Settings button
  renamed *Settings and controls*. *How to play* ends with where the other scheme lives.
- **Settings in player language**: *Fast double-tap* / *Two-step tap (no timing)*, with one help line, and a tiny live
  picture (`settings.ts::controlsPreview`, `.cp-demo`): a finger taps a tile and a ✕ appears, double-taps (or taps a ✕
  again) and this player's animal appears, Erase lifts a ✕. CSS keyframes on one 4 s timeline with no delays, so the
  reduced-motion rules collapse it to its last frame. No new engine.
- Device checks still to do (release checklist, D38 PR B): the 380 ms window on a real finger at 320 and 375, VoiceOver
  through the board (activation = two-step), Switch Control, Dynamic Type on the note.

### PR C — Journey and World hierarchy (P1)
- **One hero on the Journey hub** (`journey.ts::heroGoalMarkup`, `.hero`): the goal row (a small picture of the
  sanctuary being built, *Building the Meadow Farm*, the animal on its way and its bar), then the level with its
  thumbnail, one big *Play level N* / *Resume level N*, and two quiet links, *View path* and *Visit Farm*. The goal card
  and the Continue card are gone (D36 had one above the other, which pushed Play below the fold on an SE); the hub no
  longer offers a World-map link next to the Visit link (the World tab is the map). When every open sanctuary is
  finished the goal row names the next home to open and the second link is *World*. The button sits on the first
  screen at 320×568 with the tab bar (e2e checks it) and at 375×667. Presentation only: ids, achievements, onboarding,
  Back and the saved-board rules are untouched.
- **World**: the focus card keeps the story but has one big button (*Play level N* full width); *Visit Farm* and *Build
  elsewhere* are quiet links, so nothing wraps at 320. Under it, one row of pills for what else is going on
  (`.world-now`): news waiting in a sanctuary (coral, *Truffle came home · Farm*) and the next home to open (*Next to
  open: Outback · after level 10*); each pill opens its sanctuary. The map stays the delightful overview, not the only
  way in: pin labels 10 → 12 px, the home being built has a soft breathing halo (a still under reduced motion), locked
  homes step back (smaller, paler, quieter names), and *Expand map* doubles its width to pan around, starting on the
  home being built. The home cards below are the reliable touch targets, as before.

### PR D — growth you can see, and fair (P1) — *owner decision: replaces D36's Policy A*
The audit found that Policy A (every non-Cup solve grows the world) lets replaying one easy level rescue every animal.
Not a bug: a product choice. Owner decision (2026-10-31, after the D38 tester build): **growth policy 2 replaces
Policy A**, and this PR merges with the rest of D38.

- **Growth policy 2** (`world.GROWTH_POLICY`, `save.world.policy`, `save.world.grown`): a puzzle grows the world once,
  keyed by its mode key — each Journey level once, each day's Daily once, each fresh Zen board once (a restarted Zen
  board is the same puzzle). `creditSolve` takes the key (`SolveContext.puzzle`); a replay is still receipted (the win
  is handled once) but grows nothing and says `replayed`. Boards built by hand without a key (tools, the `growOnSolve`
  shorthand, older tests) keep counting. Only the newest 120 Zen keys are kept; levels and dailies are bounded anyway.
  A solve whose credit is redirected (its sanctuary finished meanwhile, D36 PR 1) still marks the puzzle as grown: one
  growth per puzzle, whichever sanctuary receives it.
- **Migration once** (`upgradeGrowthPolicy`, run by `reconcileWorld` at startup): every level already cleared and every
  Daily already done is marked as grown, so replaying them grows nothing more. Growth counts, arrivals, stages and
  gifts already earned are untouched. Coins, Paw Points, stars, best times and leaderboard scoring are unchanged and
  separate. A v1 → v2 migration starts on policy 1 on purpose so the same backfill covers its clears, and a tester's
  *Skip to level N* marks the skipped levels as grown (the independent review caught both gaps).
- **The ordinary win shows the step** (`game.ts::nextFriendMarkup`): *Farm +1 · Truffle the piglet: 3 → 2 puzzles away*,
  and the animal's bar starts where it was and slides to where it is now (900 ms, a beat after the results rise; a tap
  settles it at once; reduced motion shows the end state). The milestone win (hero first) is as PR 4 left it. A replay
  says so plainly — *A replay: it already grew the Farm once. New levels, the Daily and Zen boards grow it* — with the
  next animal's standing and no *+1*; the stars and best time are what a replay is for.
- **A true arrival settles in** (`region.ts`, `.is-arriving`): coming straight from the win that brought them, the
  newcomer drops into place once (≤0.9 s, never under reduced motion), then says hello as before.

### PR E — visual polish and device hardening (P2)
Code-side craft from the audit; the device checks are listed in `docs/release-checklist.md` (D38 PR E) and still to run.

- **Text floor**: every piece of text a player reads is at least 12 px (`--t-xs`): the tab labels, tier ladder, week
  strip, mission chips, world card chips, region steps, album traits, trick prices, the feed counter. Fredoka for titles
  and Nunito Sans for content, as before.
- **One press language** (`components.css`): every tappable surface presses in the same `--dur-press` (100 ms) and
  springs back the same way — buttons sink 2 px with their edge, map pins shrink, cards, tools, Zen sizes, chapter
  tabs, residents, pet cards, pills and the hero's picture dip 1 px. Haptics unchanged; nothing bounces.
- **Quiet status rows**: the World's header shows Paw Coins only (nothing there is for sale in tokens or gems; the Shop
  keeps all three). On the board, short phones keep *3 of 7* and drop the words (the accessible label carries them), so
  the status row — progress, size · tier, the sanctuary tag, the clock — is one line at 320.
- **Hint ladder clarity** (`game.ts::nextHintPreview`): the coach line after each hint step previews the next one and
  its cost: *Next: Explain says why (free)* · *Next: Place it puts the animal there (uses a hint)*.
- **Skill shown** (`skillMarkup`): a Medium or harder solve adds *You solved a Medium 7×7* with *What made it medium?*,
  which opens the grader's own reason (`difficultyReason`) in place. Easy boards say nothing.
- Already in place and kept: distinct tones for a placement, a completed line/color and a win; the whole-color glow when
  a color completes (overlay only, 950 ms); reduced motion disables every celebratory transform globally
  (`base.css`); placed animals carry no lock, givens do.
- Deferred, as the audit allowed: a player-triggered *mark direct impossibilities* comfort command, and a two-animal
  teaser at levels 8–12 (user-test first; frozen boards are not renumbered).

### PR F — the save lives in the app's own storage on a device
A WebView's localStorage can be evicted by iOS under storage pressure; the game's whole progress lived there. Cheap fix,
still free: `@capacitor/preferences` (the app's UserDefaults on iOS, which rides along in device backups) behind the
existing synchronous `KV` interface.

- `services/kv.ts::NativeKV`: reads come from memory after one hydration (`hydrate()` reads every key before the save
  is loaded); writes go to memory, to the WebView's localStorage (so a rollback build still finds the save) and, in
  order, to the store (a write-behind queue), with a write counter (`KV_SEQ_KEY`) on both sides. Hydration reconciles
  the two, for the game's own keys only (`pawtopia.*`, `cvd.*`): a key only the WebView has is copied to the store
  (every existing player's save, the first time); a key only the store has stays (the WebView was evicted — the reason
  for all this); a key both have with different values takes the WebView's unless its count is *behind* the store's.
  The WebView is written first and the store after, so the WebView can only be ahead (the app was killed before the
  queue drained) or level with a different value (a pre-D38 build played on; it knows neither store nor counter), and
  in both cases it is the newer side; only an evicted or reset WebView is behind. (The independent review found the
  first cut always preferred the store, which lost the last move after a kill and all progress after a rollback.) A
  store that fails leaves the game on localStorage, as before.
- `hydratePlatformKV()` swaps the platform store on a native platform only; `main.ts` awaits it and then imports the
  app (`boot.ts`), so nothing reads a save before the store is ready. Browsers and the single-file artifact are
  unchanged (localStorage).
- `npx cap sync ios` adds the plugin to the iOS project (docs/native-setup.md). A true cross-device cloud save
  (iCloud key-value store or Firebase) is a bigger step and not needed for v1.
- Tests: `test/unit/nativeKv.test.ts` (hydration, write order and removes, the first-run copy and precedence, a store
  that is down, the real save round trip).

## 2026-10-31 · D39 — The loop, made legible; a little "why"; a world that never runs out
Owner request (2026-10-31): a one-time explanation of the loop; *Meet* as the win's main action with the newcomer easy to
find and the next arrival always in view; a soft visit offer that never blocks *Next level*; a short "why" and a
micro-celebration when a line or color is finished; and enough levels, places and animals for players who never stop.
Read against `main` @ `36d6e93` first: *Meet* as the primary action, the arrival drop-and-greet, the quiet visit button
on ordinary wins and the finished-line glow already shipped in D36–D38, so this decision builds only the gaps. Five
PRs (A–E), stacked, each reviewable on its own.

### PR A — the win always says what's next; the newcomer is easy to find
- **Never a blank "what's next"** (`game.ts::upNextMarkup`): when the sanctuary a board was for has nothing left to grow
  (the solve that finished it, a replay there, a win that only opened a region), the world line points at what the next
  puzzle helps instead — *Up next at the Pet Garden: Juniper the bunny, one more puzzle*, with its bar — or, with every
  open home finished, *Next home: the Outback Sanctuary opens after level 10 · 6 levels to go*. Paw Cup wins stay
  quiet, as before.
- **The newcomer, ringed** (`components/newcomer.ts`): arriving from *Meet* (or the "New" marker), the animal who just
  came home gets a soft ring on the ground under its figure for 2.6 s (an ellipse inside its own figure group, behind the
  body, so ambient life and the 3D toys are untouched; still under reduced motion, a 400 ms fade either way), and its
  card in the Animals row carries a *New* chip and "just came home" in its label for the whole visit. The Pet Garden
  rings its newcomer once the "came home" card is closed, so the moment isn't spent behind a sheet.
- Unchanged on purpose: *Meet [name]* stays the main action on an arrival (D36), the drop-and-greet stays (D38), and an
  ordinary win keeps *Play level N* as its one big button with the visit as a quiet link.
- Tests: `test/unit/gameScreen.dom.test.ts` (finishing a sanctuary, everything open finished, a replay),
  `test/unit/newcomer.dom.test.ts` (Meet, the "New" marker, an ordinary visit, the Pet Garden after its card).

### PR B — the loop, once
- **One small card, once** (`components/loopCoach.ts`, `onboarding.loopTipSeen`): after the first puzzle has grown a
  home (the guided first board brings Cotton in, so in practice right after it), the Journey hub — or the World,
  whichever the player opens first — shows *How Pawtopia works*: three steps, *Solve a new puzzle → The Farm grows →
  Truffle comes home*, filled in with this player's own sanctuary and the animal on its way (general words when nothing
  is being built), and one line: *Every new puzzle grows the home you're building. Animals arrive one by one, and new
  places open on the map as you go.* *Got it* or ✕ retires it on both screens.
- A card in the flow, never a modal: on the hub it sits under the hero, so *Play level N* stays on the first screen;
  screen readers get the three steps as one sentence (the list's label).
- **One tip at a time**: while it shows, the hub's pantry card and the World's one-line tip wait their turn.
- Existing players see it once too (harmless; dismissible), like D38's controls note.
- Tests: `test/unit/loopCoach.dom.test.ts`.

### PR C — a little "why", and small celebrations
Two-animal boards already glowed a finished line, played its tone and made two faces proud (D23–D26); one-animal
boards glowed the color on every placement. What was missing was any *why*, and anything between a placement and the
win on a long board.

- **Why a move fit** (`Session.whyPlaced`, `game.ts::whyLine`): after a correct placement, the row, column or region in
  which that tile was the only spot left for the animal — judged only from what the player could see just before the
  move (the other animals and the tiles their rules rule out, the player's ✕ marks, the mistake marks; every ✕ in such
  a line is true for this animal, since the line holds exactly one of it, here). Its tiles get a calm ring for 1.5 s
  (`.cell.is-why`, opacity only; still under reduced motion) and the coach says it in one sentence: *Only one spot was
  left for a sheep in row 3* on a one-animal board; on a two-animal board it joins the completion line — *Row 3 is
  complete. It was the only spot left there for a piglet.* Lines the move finished are named first, then region, row,
  column. A move no single line decided (a longer chain, or a lucky guess) says nothing about why: nothing is invented.
- **When**: the first three explanations are shown to everyone (`onboarding.whyShown`), then only with Settings →
  *Explain finished lines* (`settings.explainMoves`, off by default). Never on the guided boards (they teach their own
  way), never in the Paw Cup, never for the tile a hint had just pointed at, and not while D38's one-time controls note
  covers the coach line. It never reveals anything about the moves still to come, so D37's rule (dots on impossible tiles
  only on Easy boards) stands.
- **Small celebrations**: a move that finishes two or three lines at once gets a ripple of proud faces across them (four
  at most, under the usual cap of three at once), a success haptic and *…complete at once!*; and every board, either
  rule, has one *Halfway there!* when half its animals are placed, with a small ripple of smiles from the newest animals
  (`FaceDirector.wave`, staggered, cleared with the board). A resumed board already past halfway doesn't cheer again.
  Faces only, as always (D11): no tile or head moves.
- Tests: `test/unit/session.test.ts` (whyPlaced), `test/unit/gameScreen.dom.test.ts` (first three, the setting, no
  invented reasons, two-animal sentence, guided boards, halfway once).

### PR D — a world that never runs out
The Journey already had no end (past level 170 each board is generated on the device from its level number, the same
board on every phone), but the world did: the six hand-made homes take about 180 new puzzles to finish, and after that
a solve grew nothing. For players who never stop, the world now keeps going.

- **Places** (`meta/catalogs/places.ts`): after the Amazon, place 1, 2, 3 … are generated from hand-written ingredients
  as a pure function of their number. Each is one of the five drawn biomes (a farm, the outback, the savanna, the Arctic,
  the rainforest; every five places visit all five, never the same twice in a row), with its own name (*Marula
  Grasslands*, *Quandong Station*, *Narwhal Cove*; 200 per biome before any repeats), a look (golden light, autumn,
  blossom, mist or dusk, as a color treatment and a light overlay on the region's own art; classic is the region as
  drawn), mirroring (two places of a biome in a row never look alike), a pin inside its biome's part of the world (a
  koala never lives in Siberia), the same five stages as a region (0/3/8/15/25) and its completion gift.
- **New animals**: three natives per place — new individuals of the species already drawn for that biome, each with a
  name (a biome's own names first, then a shared list; no two animals share a name for the first ~225), a coat (three
  per species, taking turns), sometimes a knotted neckerchief, a trait and a short bio in the game's voice — and, every
  other place of the farm, savanna and Arctic, a guest kind that lives there: a rabbit, a bat-eared fox, an arctic fox
  or an arctic hare (drawn species in a new role and coat). Natives arrive in their region's order, so each stands on the
  feature its stage brings (the goat on the bales); guests stand on open ground. They appear on boards like any animal
  (the next one on its way is the board's animal), move like their species in the scene, and their 3D toys are the
  species' toys recolored (the neckerchief is 2D only for now).
- **Opening**: place k opens after Journey level 60 + 20k — one new place at the end of every chapter from level 80 —
  or sooner, the moment every home before it is complete (`world.openPlaceCount`; open places are always 1…N, so one
  walk finds them). A Zen-only player who finishes everything still always has somewhere new to build. The solve that
  finishes a home announces the place it opened (`creditSolve` asks again after growing). The next place appears on the
  map, locked, only once every hand-made home is open, so the early game is unchanged.
- **Screens**: the World lists every home (`world.worldIds`); once the endless world has begun the list leads with
  what's being built, then open homes, the next one, and the finished ones last, folded away once the list passes eight;
  a place's pin is smaller and keeps its name to itself unless it's being built, has news or is next; at most three
  news pills (the rest are one tap away); news chips name two animals and *N more*. A place's screen shows its animals
  and has no decorations (its charm is its animals and its look; decorations stay with their hand-made homes). The album
  has a group per home. Chapters after the fifth have names (*Thistle Path*, *Firefly Hollow* …) instead of "Far Fields
  N", and the chapter card says which place its last level opens.
- **Never changes once shipped**: saves keep growth and arrivals by place and animal id, so `PLACES_VERSION` and
  `test/unit/fixtures/places-v1.json` (the first forty places, regenerated only with a version bump:
  `npx tsx scripts/places-fixture.ts`) pin the recipe.
- Tester shortcuts: *Skip to level 81* and *Finish every open home* (which opens the next place).
- Tests: `test/unit/places.test.ts` (the fixture, 300 places well formed, looks, ids, who the animals are, opening by
  level and by finishing, the board's cast, reload and reconcile, the shortcut, chapters, drawing, coats on portrait,
  board face and toy), `test/unit/endlessWorld.dom.test.ts` (World, the fold, a place's screen, the album, the chapter
  card), `test/unit/difficulty.test.ts` (levels 300, 1000 and 5000 are sound boards).

### Review fixes (independent review of the stack)
- **The Shop while a place is being built** (its Decor tab was blank): the Shop sells for the hand-made homes only, so while a
  place is being built it opens on the hand-made region of the same biome (its decor and the treats its animals know).
  A stale link to a place's decor lands there too.
- **The newcomer's ring under 3D toys** (PR A): it was drawn inside the figure's group, which the toys hide; it now
  sits just before the figure in the scene, still behind the body, and the toy stands on it.
- **The board's status chip at 320 px**: place names are long, so the chip shows a place's first word (*Marula*; its
  label has the full name) and, if even that doesn't fit, gives way with "…"; the timer and progress count never shrink.
- **A long world stays light**: the World's fold of finished homes and the album's finished groups draw their cards
  (a thumbnail or a row of portraits per home) the first time they open (`ui/components/fold.ts`). A finished home with
  news stays in the list until it is visited, so *News in N more homes* always lands on a card you can see (it now has
  its own action, so *Build elsewhere* still goes to the list). Favorites in the album are never folded.
- **Neckerchiefs**: some kinds have no chin to tie one under (a toucan, a seal); an animal of those kinds never wears its
  own, and now its card no longer says it does (`companions.ts::wearsNeckerchief`, the same test the art uses). The
  recipe (and the fixture) are unchanged.
- **3D toys of new animals keep their species' shape**: a recolored toy keeps its species' id, so the builder's
  per-species touches (a kangaroo's big feet) apply.
- **"Never take away" for places**: `openPlaceCount` also counts any place that has grown, so a save that somehow grew a
  later place (an edited save, a future rule) opens everything up to it rather than hiding a home the player built.
- Measured: at 150 places the World's first draw was about 2.3 MB of markup (1.9 MB of it the fold) and 0.8–0.9 s on a
  4× slowed CPU; the fold is now empty until opened. Looking far ahead (place 9999) the first time walks every place
  before it once (about 1.6 s); only tools do that today, and the walk is cached.

### PR E — five hundred kinds of animal
Sam asked for at least 500 unique animals: "there are so many countries, biomes with so many different animals". PR D's
places brought new *individuals* of the eighteen drawn species; now each place brings new *kinds*.

- **The kit** (`ui/art/kit.ts`): a species is a few words of data (`meta/catalogs/species/`, written with `sp()`): head
  shape, ears, a crown (horns, antlers, a crest, a mane…), snout or beak, eyes, a marking, extras (whiskers, tusks, a
  pouch…), a tail, one of twelve bodies (seated, big, long-necked, upright, perched, wading, lying, long and low, shelled,
  coiled, frog, bat) or a whole form (fish, whale, ray, crab, octopus, jelly, sea star, snail, butterfly, bee, ladybird,
  beetle), a size, and four colors (plus optional head, wing, shell, face, beak and eye colors). The head plugs into the
  same face rig as every friend, so a kit animal's board tile blinks, glances and grins like Cotton's.
- **545 kinds across fifteen landscapes**: the five hand-made regions' (farm, outback, savanna, Arctic, rainforest), the
  Antarctic (drawn as the Arctic), the jungles of Asia and Africa (drawn as the rainforest), and eight new scenes
  (`ui/art/landscapes.ts`): bamboo forest, mountains, desert, woodland, wetland, coast, island and grassland. 521 are
  kit species; the 24 hand-drawn kinds (the regions' animals, the Pet Garden's fox and red panda, PR D's guests) keep
  their own art and coats. Every one has where it lives in the wild and one short, true fact (its story on its card).
  The lists were written by landscape, checked against the vocabulary (`scripts/species-check.ts`), and looked at one
  by one in the gallery (`scripts/species-gallery.ts`); facts were kept to well-established ones.
- **Places meet new kinds**: three per place, four in every other place of a landscape, in the landscape's own order
  (its best-loved first, shapes mixed); the hand-drawn kinds come after the new ones (the player knows them), the drawn
  guests a little way in. A landscape shows every kind before any comes round again, then they return as new
  individuals (with a neckerchief, and their real color forms where they have them). The first hundred places alone
  meet over three hundred kinds. Each landscape has its own names for its animals and its own words for place names.
- **3D**: a kit species becomes a toy when the toy builder has its parts (seated, big, long-necked, upright, perched or
  lying; 369 kinds with the hand-drawn ones). A scene with any animal that can't be a toy yet (a snake, a fish, a
  turtle) stays drawn, all of it, rather than mixing toys and drawings (`data-no-toy`, `ui/components/scene3d.ts`).
- **Small things**: the album counts *kinds met* once the endless world has begun; a kit animal's card adds "In the
  wild"; treats follow what a kind eats (an oryx loves hay); the new landscapes' water, lanterns and petals sparkle,
  glow and drift like the regions' decorations; the Shop, while a new landscape is being built, opens on the Pet Garden.
- **Not yet** (the kit's limits, noted by the writers): long-necked swimming birds (a swan reads as a white duck),
  forked or streaming tails, beetle jaws, tail-tip colors, scales on reptiles' tiles, more than one antler shape. Two
  kinds are forms of one species, kept as separate animals children know: the Bengal and Amur tigers, the grey and
  Arctic wolves.
- `PLACES_VERSION` stays 1: nothing of PR D has shipped, so the recipe changed before any save could hold a place; the
  fixture (`test/unit/fixtures/places-v1.json`) was regenerated for the new recipe and pins it from here.
- Tests: `test/unit/species.test.ts` (at least 500 kinds, all well formed, every landscape's order, no repeats before
  a landscape is done, every species draws in three moods and as a figure, toys and the drawn-scene rule, kinds met,
  nouns), `test/unit/places.test.ts` and `endlessWorld.dom.test.ts` updated, and three e2e checks (a place's kit
  animals, a toyable place in 3D, a place with a snake or fish kept drawn).

#### PR E review fixes (independent review)
- **A red fox or red panda place crashed** (the first around place 109): the Pet Garden's fox and red panda had no
  coats. They have three each now, a hand-drawn kind falls back to its own colors, and a test draws every place animal
  over a full lap of every landscape (places 1–300) through every renderer (portrait, board rig, scene figure, tint, toy).
- **Every list a place is made from is pinned**, not just the first forty places: each landscape's species order,
  names, words, zones, looks, accents and stages, plus every 25th place to 1000 (`placesSnapshot.ts::worldFixture`).
  `docs/species-kit.md` says what that means once places ship.
- **Swimmers arrive when their water is there**: where a scene's water comes with its third stage (an oasis, a pond by
  the ice), a place's fish and whales arrive last; the desert has an oasis spot. Checked over 3,000 places: none early.
- **Words**: kinds named for places keep their capitals ("North American river otter", "Christmas Island red crab"),
  others don't ("giant Pacific octopus", "gentoo penguin"); "a European robin"; "grey wolves", "wood mice", "musk oxen".
- **3D**: a scene that changes to one that stays drawn while three.js is still loading no longer makes a stage.
- **Content**: the Pekin duck (a domestic mallard, the wetland's mallard already) is now the Muscovy duck, its own
  species; repeated facts rewritten (llama, bilby, red-necked wallaby, Arctic hare); the Virginia opossum is "the only
  marsupial" north of Mexico; the green tree python lives in the outback's landscape (New Guinea).
- Small: names are escaped in figure attributes; `data-no-toy="1"`; coats' colors are checked; unused landscape text
  removed (places.ts holds it).
- Noted, not changed: the startup bundle grows by about 78 kB gzipped (the catalog, the kit and the landscapes load
  for every player); loading them only once places begin is a follow-up. New landscape thumbnails are heavier than the
  regions' (the World's finished fold draws them only when opened).

## 2026-11-01 · D40 — How it feels: sound and touch, a calmer win, animals with personalities, visits worth making
Owner request (2026-11-01): simplify the win screen (the reward first, the accounting folded away), a four-step
arrival, stronger animal personalities with small bonding milestones, more rewarding sanctuary visits, and one
coherent sound-and-haptics system; plus polished microinteractions and a two-step control option. Checked against
the D39 stack (#14–#18) first: two-step tap, *Meet* first on an arrival, the newcomer's ring, friendship levels and the
synthesized sounds already existed, so this builds the gaps. Owner decisions (2026-11-01): **double-tap stays the
default** (D37), two-step stays a choice and is offered when it would help; **a small star row stays** in an ordinary
win's first view; **every animal** gets a personality; friendship levels unlock **a warmer greeting, a new
expression and a portrait**, with hello, pat and food each counting once a day. Four PRs (A–D), stacked on #18.

### PR A — one feel for every moment
- **One table** (`services/feel.ts::FEEL`): every event that sounds or buzzes goes through `feel(event)`, so its sound
  and haptic are chosen together. Mark ✕: a quiet tick and a light tap. Place (a correct animal): a gentle bright pop
  and a firm (medium) tap, stronger than a ✕ (owner request, 2026-11-01: the ✕ was the barely-there selection tick and
  the placement a light tap). A row, column or color finished: a short rising tone and a firm tap, landing with the
  placement's as one (more lines at once: a three-note rise, still one tap). Dragging ✕ across tiles keeps the
  lightest tick per tile, so a run never rattles. Wrong guess: one muted soft note and the gentle warning pattern (never a buzzer).
  Solved: the game's own melody (C–E–G, then a ringing high C) and success. A new animal: a warm chime over a soft chord,
  a sound used for nothing else, and one heavy pulse, a beat after the melody as its portrait comes up. Tapping an
  animal: a tiny hello (below). Undo, a tool, a drag: the lightest haptic, no sound.
- **Quiet by default**: the master level dropped from 0.55 to 0.42; every sound peaks far below full scale (rendered
  offline in Chrome and measured: the melody peaks at 0.11, a ✕ tick at 0.02). A drag across many tiles never piles
  sounds up (the same sound at most every 40–140 ms). Turning *Sound effects* off also silences anything still ringing,
  at once; turning sound or haptics on plays a small sample. Sound and haptics keep separate switches.
- **An animal's hello** (`components/hello.ts`): tapping an animal in a sanctuary plays a tiny cue pitched by its size
  (a mouse squeaks higher than a bison); PR B gives it the animal's temperament's rhythm.
- **A finger is acknowledged at once** (`Board`, `.cell.is-press`): on pointerdown a tile glows softly for 240 ms and a
  ✕ on it gives a little, before the move lands, under either scheme and on pannable boards. Animals on the board still
  never move (D11): their tile only glows.
- **A kinder wrong guess**: the coach line no longer counts hearts (the hearts above the board do): *Not a cat spot.
  It's marked for you, so there's no need to try it again.*; only the last heart is mentioned, as *take your time*. The
  mistake flash is a thinner ring with a lighter hatch that eases away instead of holding.
- **Two-step tap, offered when it helps** (`game.ts::maybeOfferTwoStep`, `onboarding.twoStepOffered`): double-tap stays
  the default (owner decision). When two double taps come a little too slowly (a second tap on the same ✕ between 380
  and 900 ms, which only clears it), a one-time note offers two-step tap with one tap to switch; the board carries on
  under the new controls. Never on the guided boards, never for a player already on two-step.
- Tests: `test/unit/sound.dom.test.ts` (the table, each switch silences only its own half, quiet level, no pile-up,
  every hello style and size), `test/unit/gameScreen.dom.test.ts` (the press, the wrong-guess words, the offer once and
  the switch).

### PR B — every animal a character; friendships that bring something
- **Six temperaments** (`meta/temperament.ts`): playful, sleepy, shy, proud, bouncy (energetic) and gentle. The six
  residents and twenty-one hand-made friends are chosen from their own traits (Truffle playful, Cotton sleepy, Juniper
  and Ember shy, Clover proud, Biscuit bouncy…); every other kind by its name (otters and penguins playful, owls and big
  cats proud, sloths and pythons sleepy, deer and hedgehogs shy, squirrels and wolves bouncy, whales and tortoises
  gentle), then by its shape. A kind keeps one temperament everywhere; no randomness, nothing saved. Across the 545
  kinds: 116 playful, 47 sleepy, 61 shy, 115 proud, 132 bouncy, 74 gentle (a test keeps every one at 40 or more and
  none above 30%).
- **Faces on the board** (`ui/art/pets.ts::TEMPER_POSE`): a friend's happy face is its temperament's — a playful grin,
  a sleepy closed-eye smile, a shy sideways glance with a deep blush, a proud chin-up, a bouncy beam with high brows, a
  gentle soft smile; proud ones wink after a solve. Residents keep their own hand-made faces. Faces only (D11).
- **Greetings in the scenes** (`sceneLife.ts`, `styles/sanctuary-life.css`): a tap or an arrival hello plays the
  temperament's own 1.4 s greeting — shy turns away, then comes round with a smile; sleepy blinks slowly and nods;
  proud stands tall with its eyes shut; bouncy hops three times; gentle leans in; playful keeps the two happy hops.
  Residents' faces follow the same steps (a shy one glances away first). Under reduced motion a tap still changes only
  the face. The hello sound (PR A) plays in the same rhythm.
- **Bonding** (`meta/bonds.ts`, `components/bonding.ts`): a hello in a scene now counts a heart (once a day per
  animal), as a pat and food already did; hearts never go down. Friend (5): a warmer hello (a bigger heart, one more warm
  note). Good friend (15): a new expression, a beaming smile with two happy arcs for eyes (in the scene, on its card,
  in the album). Best friend (35): its portrait in the album, announced by a small card (*Best friends!*, *See the
  album*). Family (70): a golden frame. Each new level is said once, in a toast or that card. Nothing asks the player
  to come back: the card's line *has had plenty for today, and is very content* replaced *Come back tomorrow*.
- **The card** (`feedPanel.ts`): the temperament as a chip and a sentence (*Truffle is curious about everything and
  delighted to see you.*), the hearts to the next level and what it brings (*3 hearts to Good friend: a beaming
  smile*), and a row of what friendship has brought and will bring.
- **The album** (`screens/pets.ts`): *Best friends* — framed, beaming portraits, oldest first, with the date; a
  friendship that reached 35 hearts before this build has its portrait too.
- Save: `sanctuary.greeted` (the day of each animal's last counted hello) and `sanctuary.bestSince`; both default to
  empty for older saves.
- Tests: `test/unit/personality.test.ts` (every animal has a temperament, the named characters, the spread, faces,
  hellos once a day, the unlock order, no decay, portraits, saves, the beaming face), `test/unit/bonding.dom.test.ts`
  (figures carry their temperament, a tap counts once a day, a new level is announced and changes the greeting, the
  best-friend card and the album, the card's lines); e2e: Cotton greets sleepily and a hello counts once.

### PR C — the reward first; an arrival in four steps
- **An ordinary win** (`game.ts::showWin`): the sheet is titled *Puzzle solved!*; its first view is the board's smiling
  animal, a small row of stars (owner decision), the step the world took (*Meadow Farm +1*), what it brought closer
  (*One puzzle closer to Truffle!*, with the bar moving and *Truffle the piglet: 3 → 2 puzzles away* under it), then
  *Play level N* and the quiet *Visit the Farm*. Everything else — time, mistakes and hints, *Clean solve* and *New best*,
  the skill line, Paw Points and rank, coins, gifts and pantry items, badges and missions, Share — is in one closed
  fold under the buttons, *More rewards*, whose summary says what it holds (*+45 coins · +175 Paw Points · 2 badges*).
  Nothing was removed: the same reward logic, revealed when asked. A Daily keeps its streak chip up top; a Paw Cup win
  keeps its score card up top; a replay shows which stars are still to earn up top, and the replay note in the fold.
- **An arrival**: the sheet's title is the news (*Truffle is home!*), then the animal's face, *Your new piglet*, *A new
  little friend has arrived at the Farm.*, and its temperament (*Playful · Truffle is curious about everything and
  delighted to see you.*); *Meet Truffle* is the main action and *Play level N* the full second button (D36). Even the
  stars wait in the fold, with what's coming next. Other milestones work the same way: the title is the news (*The
  Outback Sanctuary is open!*, *The Meadow Farm is complete!*, *Farm: Duck pond!*), the picture and its line below.
- **The four steps**: (1) the puzzle completes — the success melody, the board's animals smile in a wave; (2) the new
  friend is revealed — its own warm chime and pulse as its portrait comes up (PR A), its name, kind and one character
  detail; (3) welcome home — *Meet* opens its home, where it settles in, is ringed, greets in its own way, and the
  scene livens up for a moment (`SceneLife.cheer`: two of its lively parts play once; nothing under reduced motion);
  (4) the next goal — a small card under the scene (`components/nextGoal.ts`, `world.ts::nextGoal`): *Next goal ·
  Buttercup the calf comes home in 3 more puzzles* with *Play level N*; with every animal home here it is the next
  stage, then the home being built now, then the next home to open. The Pet Garden shows it once its "came home" card
  is closed.
- The coach line on the board says *Puzzle solved!* too.
- Tests: `test/unit/gameScreen.dom.test.ts` (the first view and the fold for an ordinary win and an arrival; the
  milestone titles), `test/unit/newcomer.dom.test.ts` (the next goal after *Meet*, in the Pet Garden, and what it
  points at as homes fill); e2e: the arrival's first view and its closed fold.

### PR D — visits worth making
- **A first visit leads straight to a reaction** (`sceneCues.ts`, `components/selection.ts`): the one-time cue names an
  animal — the newcomer if there is one, else the first animal in the scene — *Tap Cotton to say hello.*, and a
  dashed ring sits on the ground under that animal until the cue is done. Tapping it plays its hello (PR A), its
  temperament's greeting (PR B) and counts its heart; the cue and the ring go.
- **Easy to find and choose** (`selection.ts`): a tap on or near an animal reaches it — a figure's target is its own
  height and width plus a margin, and never less than 44 scene units (about 44 points on a phone), the nearest animal
  winning — so a mouse or a chick is as easy to tap as a cow. Decorations' own taps still come first. The tapped
  animal gets a soft ring on the ground and a name tag over its head (*Truffle · Playful*) for 2.6 s; tapping another
  moves both. With 3D toys the rings sit under the toys, as the newcomer's ring does (D39).
- **Every growth milestone is visible** (`region.ts`): a stage that just appeared — from the solve that reached it, or
  reached while the player was elsewhere (the "New" marker) — glows for 2.6 s (a glow, so also under reduced motion)
  as it grows in, and a line under the scene says what changed: *New at the Farm: Barn raising · A red barn goes up
  beside the pasture.*
- **Ambience, restrained on purpose**: nothing new loops. The scene already plays one small thing every 3.5–9 s, at
  most three at once, paused when hidden; the only addition is the one-off liveliness of a welcome (PR C). Reduced
  motion and the drawn (no-WebGL) scenes are unchanged; every new ring and tag is still.
- Tests: `test/unit/visits.dom.test.ts` (the target geometry, the named cue and its ring, the reaction, moving the
  selection, a stage's glow and line from a solve and from the "New" marker), `navigation.dom.test.ts` updated; e2e:
  the named, ringed cue on the first Farm visit, and a tap just above a small animal reaching it in a real browser.

### Review fixes (independent review of the D40 stack)
- **D11 held** (A): the touch squeeze scaled a struck animal (`.cell__tried`); now only ✕ marks give, and the faces test
  covers struck and ghost art too.
- **Screen readers** (A): the coach line keeps the hearts left in a screen-reader-only span (it is the live region);
  on screen it stays kind and count-free.
- **Words** (A, B): two animals of one kind are told apart by name (*Not Mochi's spot*); on a two-animal board *no
  need to try the cat here again* (the other animal may live there); the two-step offer asks *Double taps coming a
  little slow?*; names with letters like ā, ō and ñ match their rule (the Kākāpō is playful); the album's label keeps
  the month's capital.
- **A shy good friend keeps its eyes** (B) while it turns away; the beaming arcs come with its smile.
- **An arrival plays once** (C): `Router.settle` rewrites the route once the welcome (or a fresh stage) has played, so
  Back from a board or a refresh opens the place plainly instead of replaying the toast, the greeting and the goal.
- **A new player sees the whole first arrival** (C): the starter gift waits until the welcome has played (it opened at
  once and covered steps 3 and 4).
- **The next goal is honest** (C): it looks at the home being built first, so it never says *comes home in 2 more
  puzzles* about a home those puzzles won't grow; the Pet Garden shows it only after *Meet*.
- **Liveliness never interrupts** (C): `SceneLife.cheer` only takes free slots (`AmbientDirector.offer`).
- **Small** (C, D): the next goal and the stage line rise in once, not on every re-render; a Daily milestone keeps
  its streak chip up top (as an ordinary Daily does); the fold's summary names what it holds when there are no
  rewards (*Stars, time and what's next*); the name tag is measured and kept whole inside the scene's frame.
- Tests added: no replay on Back, gift timing, the honest goal, later visits, `offer()`, the Zen and replay first
  views, a named two-animal mistake, the screen-reader hearts, the shy beam timing, the Kākāpō.

## 2026-11-01 · D41 — A world you can see being built from the first puzzle; a board that belongs to it
Owner request (2026-11-01): (A) introduce sanctuary building immediately — the first puzzle already brings Cotton
home, so make that a prominent, skippable arrival with a visible change in the Farm, then a clear goal for the next
animal, so players understand within two levels that they are building a living world; (C) a more distinctive board —
keep the logical grid, but consider a sanctuary-inspired frame, region treatment, selected-cell indicators, a
progress display and animal styling, never change for its own sake, keep it readable. Two PRs, stacked on D40 (#22).

### PR A — the first arrival, shown happening
- **The first animal ever to come home** (`components/arrival.ts`, `game.ts::isFirstArrival`) — in practice the first
  puzzle's Cotton — is shown, not reported: instead of a results sheet, a full-screen moment over the board. (1) The
  Farm as it was: *Empty meadow · Long grass and a quiet gate.* (2) The change the puzzle made grows in and glows:
  *Your puzzle grew it! · A fenced pasture, and a sheep wanders in.* (3) Cotton drops in, ringed on the ground, with
  the arrival chime and pulse: *Cotton is home! · Your new sheep. Sleepy: Cotton says hello with a slow blink and a
  drowsy smile.* (4) She says hello in her own way, and the goal rises in: *Next goal · Bring Truffle the piglet home
  · 3 more puzzles, and Truffle moves in.* with *Play level 2* and *Visit the Farm*, and what the puzzle also earned in
  small print (*+45 coins · +150 Paw Points · 2 badges*). About five seconds.
- **Skippable**: *Skip* (or Escape) goes straight to the goal, chime included; the buttons work from the first moment.
  Under reduced motion only the end shows: the scene as it is now, the news and the goal. On a short phone the scene
  shrinks so the goal fits, and the goal scrolls into view when it appears.
- The World's "New" marker for it is read (the player has just seen the news), so *Visit the Farm* opens the Farm
  plainly: the *Tap Cotton to say hello* cue and the starter gift follow there, as before.
- Every later arrival keeps the win sheet and *Meet* (D40); this is the first animal's moment only. Players with any
  animal already at home never see it.
- Tests: `test/unit/gameScreen.dom.test.ts` (the four steps in order, Skip, Visit, Play level 2, reduced motion, a later
  arrival keeps the sheet); e2e: the first board ends in the arrival, the change grows in, Cotton settles in, the goal.
- Review fixes: *Skip* stops the steps still to come (they ran on: the caption flipped back and Cotton dropped in again
  behind the goal, and focus was pulled back at 4.2 s); under reduced motion the focus starts on *Play level 2* (it
  was given to the already hidden *Skip*, so it stayed on the game behind); it is a real modal — the game behind is
  inert and Tab stays inside, as in a sheet; Journey levels only — a Daily solved first keeps its own results
  (streak, time, Share) with Cotton's *Meet* on them. Tests for each.

### PR B — a board that belongs to its home
Each change answers a question the player has while playing; none is decoration alone, and the grid itself — its
cells, colors, seams, marks and the animals' faces — is unchanged.
- **Whose board is this?** (`game.ts`, `styles/board.css`): the board sits in a frame of the home it grows — a rim in
  that home's color with a post at each corner — and a nameplate rides on the top rim: the home and what this board
  brings closer (*Farm · Truffle in 3*; *Farm · brings Truffle home* on the board that does; the next stage when every
  animal is home). It replaces the small *Farm* chip under the board, so the board carries the loop on every level.
  A replay's plate names the home only; a Paw Cup board has a plain frame. A screen reader hears it in full
  (*This board helps the Meadow Farm. Truffle the piglet comes home in 3 more puzzles.*; a replay: *A Meadow Farm
  board, solved before.*); long place names end in "…". The plate never covers a tile and lets taps through.
- **Where am I?** (`Board.select`): the tile last touched, or reached by keyboard, gets four corner brackets in ink
  (over a light halo, so they read on every color). Corners only, so the tile's own rings — a mistake, a correct
  animal, the tutorial's glowing tile, the keyboard focus — still show along its edges. Ink, not the home's color: a
  teal home's color reads as a hint. An overlay, so nothing on a tile moves (D11); it goes when the board is solved and
  doesn't come back.
- **What's left?** (`Board.setSettled`): a color whose animals are all home settles — its empty tiles soften toward the
  mat — so the eye goes to the colors still open. Animals stay as they are; high contrast softens less.
- **How far along?**: *3 of 6 animals placed* became a pip per animal that shows the animal's face when it is home
  (one-animal boards), or each kind's face and count (two-animal boards, and big one-animal boards on a narrow phone).
  The same words are its label for screen readers.
- **Which are animals?**: animals on tiles sit a little above their tile (a soft shadow), so they read at a glance
  against the colors. Still art; no transform or animation (the faces test still holds).
- Fitting: the frame's rim and plate are taken off the space the board is fitted to, so a 9×9 board still fits a
  320×568 phone; in Large board mode the frame scrolls with the board.
- Tests: `test/unit/gameScreen.dom.test.ts` (the frame and plate, the plate for an arrival board and a replay, pips
  and counts, settling colors, the selection with keyboard and on a solve); e2e: the frame, plate and pips on level 2.
- Review fixes: the plate hung 5–6 px over the top row (on a 9×9 at 320 px about a fifth of a tile, and taps there
  did nothing) — it is slimmer and sits on the rim, clear of the tiles, and lets taps through; the selection was a
  full ring over the tile's edge, hiding its mistake, correct-animal and tutorial rings and the focus outline, and in
  the Pet Garden's teal it looked like a hint — it is corner brackets in ink now; the row and column bands are gone,
  so a paler tile means one thing only, a settled color; a tap on a solved board no longer brings the selection back;
  a replay's plate no longer says the board helps its home; the plate's words reach VoiceOver as text.

## 2026-11-01 · D42 — The game is called PawTyk; a new app icon
Owner request (2026-11-01): change the game's name to PawTyk (the repository is now `sam3lds-prog/PawTyk`) and update
the icon to something fun and catchy. Two PRs on `main` @ `982c1a5`.

### PR A — the name
- **Everything a player, the App Store or a browser shows says PawTyk**: `capacitor.config.ts` `appName`, the page
  title (*PawTyk*, *World · PawTyk*), the Journey and welcome wordmarks, *How PawTyk works*, *Welcome to PawTyk* (v1
  players: *Cats vs Dogs has grown into PawTyk*), Settings, the Shop's thank-you, the Daily's share text, the tester
  page's title and file (`artifact/pawtyk-qa.html`), `package.json`, the functions package, the emulator project
  (`demo-pawtyk`), and the docs that describe the game as it is now. The roadmap moved to `docs/ROADMAP.md`.
- **Kept, on purpose** (as D9 kept the bundle id): the bundle id `com.sam3lds.catsvsdogs`; every save key
  (`pawtopia.save.v2`, `pawtopia.sessions.v1`, the backups, `pawtopia.kv.seq`, `pawtopia.lb.device`) and the reset's
  `pawtopia.*` / `cvd.*` scope, or existing saves would be stranded; the seed text of generated places and chapter
  names (`pawtopia-places-v1`, `pawtopia-chapters-v1`), or every generated place and chapter a save holds would change
  (the places fixture would fail); the App Store product ids (`pawtopia.gems.*`, `pawtopia.removeads`), which players
  never see and which can't be renamed once they exist in App Store Connect. A comment at each says why.
- **Leaderboard names**: nobody can pose as the game under its new name or its old one: *PawTyk* and *Pawtopia* are
  refused inside a word (*PawTyk Team*, *P4wTyk*) or written as the words themselves (*Paw Tyk*, *Paw-Tyk*), but not
  where ordinary words only run together (*Pawty Kat*, *Paw Tyke*), which the spaces-removed rule for strong words
  would have caught. The rule lives in the shared code, so the server enforces it after the next `fb:deploy`.
- **Safari's Add to Home Screen** is labelled *PawTyk* from any tab (`apple-mobile-web-app-title`; it used the page
  title, *World · PawTyk*). On iOS, `appName` reaches the home screen only when `cap add ios` creates the project; an
  older project's *Display Name* is set in Xcode (`docs/native-setup.md` §0).
- No player-facing *Pawtopia is now PawTyk* note: the Pawtopia name never reached the App Store (the listing is still
  Cats vs Dogs), so the only rename players see is v1's, which the welcome sheet already explains.
- Tests: `test/unit/name.test.ts` (no *Pawtopia* left in `src/`, `index.html`, `capacitor.config.ts` or the tester
  page's script; the app name, title and home-screen title; the bundle id, save keys and product ids unchanged; the
  generated chapter names pinned, as the places fixture pins places); the leaderboard name test covers both names and
  the ordinary names that must stay allowed.
- Review fixes (independent agent): the name rule refused innocent names like *Pawty Kat*; Safari's home-screen label
  followed the tab; the name scan missed the tester page's script; the seeds were checked as source text rather than by
  what they produce; the Xcode *Display Name* step belonged with the rename.

### PR B — the icon: Meadow Farm
- **The Farm, where every player starts** (`scripts/iconArt.ts`): the Farm's red barn as the scenes draw it (white
  trim, wall boards, a white cross-braced door — which is also the game's ✕ mark), a size up so it carries the icon on
  a home screen; Cotton the sheep leaning out of the hayloft with her hooves on the sill; Truffle the piglet sitting
  out front; a round hay bale; and a paw-print weathervane on the roof, for the Paw in PawTyk. The fields in front are
  laid out like the board: plots in the board's color families with light seams between them, as its colors sit on
  its mat, so the icon says "farm" first and "puzzle" second. Clear summer sky, sun and clouds behind.
- A first draft, Pip the cat peeking over a little board, was dropped: Sam felt it looked too much like another
  puzzle game's cat icon and asked for something about farms.
- **Drawn the way the game's animals are**: Cotton's and Truffle's heads are the companion rigs' shapes, in their own
  palettes read from `ui/art/companions.ts` (`friendPalette`), so the icon follows a palette change; the barn's colors
  are copied from the Farm scene's barn (`ui/art/regions.ts`). One opaque outline throughout (the scenes' translucent
  outline makes a dark halo at icon size). No text; nothing important in the corners, which iOS rounds.
- **Files**: `assets/icon.svg` (master), `assets/icon-only.png` (1024 × 1024, RGB with no alpha channel, as the App
  Store requires; Xcode's single-size AppIcon or `npx @capacitor/assets generate --ios`), `public/apple-touch-icon.png`
  (180 px, linked from `index.html`), and `public/favicon.svg` — the barn alone with its white ✕ door, which still
  reads at 16 px. `npm run icons` renders the PNGs first and writes the SVGs last; each PNG records the SHA-256 of the
  SVG it came from (a `tEXt` chunk), so `npm run icons:check` and the test catch a PNG left over from older art.
- **Other skies**: `golden` (golden hour) and `dusk` are built in. `npm run icons -- --style golden` renders a preview
  to `artifact/icon-golden.png` without touching the shipped files; shipping one means setting `ICON_STYLE` in
  `scripts/iconArt.ts` and running `npm run icons`.
- Tests: `test/unit/icon.test.ts` (the committed SVGs are what the code draws and the PNGs were rendered from them;
  both PNGs have the right size and no alpha; every sky draws; the page links the icons).
- Review fixes (independent agent): the palettes were copied rather than read from the game; a missing Playwright left
  new SVGs beside old PNGs, and nothing tied a PNG to its SVG; `--style` overwrote the shipped icon and broke the check;
  the cat draft's commit carries a 650 KB PNG of art that never shipped, so this PR is best merged with *Squash and
  merge* to keep it out of `main`'s history.

## 2026-11-09 · D43 — Release readiness: safe deletes, a privacy policy, nothing unfinished on show, CI

From an outside release-readiness review of `main` (D41) and the open D42 PRs. Built on PR #27 (the license), so it
lands after #25 → #26 → #27.

### Native saves: an interrupted delete stays deleted
- **The risk** (the review, `services/kv.ts`): `NativeKV.removeItem` removes the key from the WebView's copy at once and
  queues the remove for the native store. Killed before the queue drains, the next launch found the key in the store
  only, and kept it — the rule for an *evicted* WebView. So an interrupted **Erase progress** could bring back the old
  v1 save and the backups (reproduced by the new test on the old code).
- **The fix**: every hydration now writes the reconciled keys back to the WebView's copy and marks it complete
  (`pawtopia.kv.complete`, kept only there). A key the store holds but a complete WebView — whose count isn't behind
  the store's — lacks was deleted, so it is removed from the store. An eviction takes the marker with everything
  else, so the store still wins there. A WebView copy from D38–D42 (counted, never marked) keeps the old rule once,
  then is refilled and marked.
- **A full WebView** (quota): a refused write drops the WebView's count and marker for the rest of the session, so the
  next launch trusts the store, which got the write; that launch refills and re-marks the WebView.
- Tests (`test/unit/nativeKv.test.ts`): an interrupted remove; an interrupted *Erase progress* with a real save;
  eviction across two launches keeps every key; a D38–D42 WebView missing a key; a full WebView.

### Nothing unfinished on show (`app/offers.ts`)
- Apple's review asks for complete functionality and no placeholders. A release build with no RevenueCat key, no
  AdMob and no Firebase used to say *coming soon* in the Shop (a Gems tab of unpriced packs, premium decor and tricks
  for gems), *which this version doesn't show yet* for video tokens, *The leaderboard is coming* on the first tab of
  Challenges, a *Preview* division table, and *Coming soon* in Settings.
- Now each part shows only when its service is there: no Gems tab or gem prices without the App Store; nothing priced
  in video tokens without reward videos; no Leaderboard tab without Firebase (Challenges opens on the Paw Cup). What
  the player owns always shows, and gems or tokens they still hold can be spent. The wallet shows only the
  currencies on offer.
- With leagues off, the Paw Cup shows no division table or tier ladder; the Paw Cup and Daily copy say what is there
  today (*Your Paw Cup scores stay on this device. Beat your own best each week.*), never *when leagues open*.
- Each service turns its part back on by itself once its settings are present; nothing else changes.
- **Tester page**: Settings → Tester shortcuts → *See the App Store build* reloads with the test store, test videos and
  the on-device leaderboard off (`QA_RELEASE_VIEW_KEY`), so the tester shows exactly what App Review will see.
- Tests: `test/unit/releaseBuild.dom.test.ts` mounts the Shop, Challenges and Settings with `TEST_BUILD` off (every
  service as in a keyless release build) and scans them for placeholder words; three new browser checks.

### A privacy policy, in the app and on the web
- One text, `src/legal/privacyPolicy.ts`, written from `docs/privacy-security.md`: what stays on the device, each
  optional service and exactly what it gets (only if that version has it, only when the player uses it), children,
  choices (access, correction, deletion, within 30 days), security, changes, contact. Publisher: Aeonix Ventures LLC.
- **In the app**: Settings → *Privacy policy* shows the whole text, offline. When `VITE_PRIVACY_URL` is set, a *Read it
  online* link follows.
- **On the web**: `npm run site` builds `site-dist/` (privacy, support, a small home page) from the same text;
  `npm run site:deploy` puts it on Firebase Hosting (`firebase.json` → `hosting`, free tier; `<project>.web.app`).
  Any static host works too.
- **Contact address**: Sam will create a dedicated address (owner decision, 2026-11-09) rather than publish a personal
  one. It goes in `VITE_CONTACT_EMAIL`; `npm run site` refuses to build without it, and until it's set the in-app
  policy points to the App Store page for contact details.

### Release check and CI
- `npm run release:check`: fails without a contact address or a hosted policy URL, with the tester flag on, or with
  emulators on; lists which optional services the build has, and the App Store privacy answer that goes with them
  (*Data Not Collected* when none are on).
- `.github/workflows/ci.yml` runs on every PR and push to `main`: unit tests, type check and build, `gen:check`,
  `pack:check`, `places:check`, `icons:check`, and the browser tests against the dev server (Playwright installed in
  the job only). Results stay in the Actions tab.

## 2026-11-09 · D44 — Farm, celebrations and animation upgrade

From the *PawTyk — Farm, Celebrations & Animation Upgrade Plan* Sam shared, read against `main` @ `c15b7d7`.
Owner decisions, asked up front (2026-11-09):
- **Scope**: everything in the plan, including the guided tour and a walkable 3D Farm.
- **Music**: original tunes composed in code, played by the game's own synthesizer; any cue can be swapped for a
  recorded track later.
- **Welcome Parade**: plays for every new animal when the player taps *Meet*; skippable and replayable.
- **Scenery**: the upgrade goes on all five hand-drawn homes (Farm, Outback, Savanna, Arctic, Rainforest).

### PR A — three hearts
- Journey and Daily boards start with **3 hearts** (was 5 since D21; the original game had 3). Paw Cup stays 3; Zen
  has none; the guided first puzzle still costs nothing.
- **A board in progress keeps its allowance**: `Session.restore` builds the board with the larger of the rule and the
  snapshot's `maxHearts`, so a five-heart board saved before this build finishes with five. A board from a build with
  no allowance in its snapshot (the original three) is unchanged.
- **The leaderboard server** replays Journey and Daily logs with five hearts allowed (`CASUAL_HEARTS_BEFORE_D44`): a
  board started before the update still counts, and every log that fits three fits five.
- Extra lives and reward videos already cap at the board's allowance (`Session.addHeart`), so with three they give
  back up to three.
- **No unfair mistake from a bounce**: two presses on one tile closer than 50 ms (`TAP_BOUNCE_MS`) are one touch
  reported twice, so the second is dropped. A human double tap is never that fast (the browser tests now double-tap
  at a human pace). A double-fired wrong guess already cost nothing (D37).

### PR B — PawTyk's own music
- **The music is composed in code** (`src/audio/scores.ts`) and played by the game's synthesizer
  (`src/services/music.ts`): no audio files, no licenses. Everything is original and in C major; the **PawTyk motif**
  (a rising C–E–G that turns up to A or C) opens the win sting, carries Welcome Home and ends Barnyard Bounce's dance.
- Cues: **Tiny Triumph** (every solve, about 1.1 s), **Welcome Home** (a new animal, 3.6 s, 100 BPM), **Barnyard
  Bounce** (the Welcome Parade, 132 BPM, 16 beats ≈ 7.3 s: intro 0–4, dance 4–12, finish 12–16, big accent on 14),
  and a **tune for each of the 18 tricks and emotes**, exactly as long as the trick (a rising flourish for Spin, a
  drum-roll build for Backflip, a slow falling phrase for Sleepy, Barnyard Bounce's finish for Party time).
- Instruments: plucked bass, strummed chords, marimba, bells, brass, a whistle, pads, a gliding swoop, claps, stomps,
  shaker, wood block and a soft cymbal. Measured in Chrome (the browser tests render every cue offline): peaks at most
  0.23 of full scale, loudness 0.010–0.021 RMS; quiet tunes carry a `level` trim.
- **One channel, its own switch**: music plays on a channel under the sound effects, so a tap always reads through.
  Settings → *Music* (on). The `music` setting existed before with nothing behind it (off in every save), so it is on
  until the player sets it (`musicChosen`). With Music on, a solve, an arrival and a trick play their cue *instead of*
  their sound effect; with Music off they keep their sound effects.
- **A beat clock** comes with every cue (`Playback.beatAt`, `msAt`, `done`), and runs even with Music off or no audio,
  so the dances (PR D) keep their timing in silence.
- Leaving the app fades the music out. On iOS 17+ the audio session is *ambient*: PawTyk follows the silent switch and
  mixes with other audio.
- **Recorded tracks later**: `useRecordedTrack(id, url)` swaps a cue's score for an audio file at the same tempo.

### PR C — the scene camera
- `ui/components/camera.ts` (`SceneCamera`) pans and zooms a sanctuary scene: the drawing and its 3D toys together.
  A **view** is a rectangle in scene units, always the scene's shape and inside it (up to 2.6× close).
- **One rectangle, two layers**: a view sets the SVG's `viewBox` (vector-sharp at any zoom) and the 3D stage frames
  the same rectangle with `camera.setViewOffset`, drawing at once so the toys never lag a frame. The browser tests
  check a figure's ground point lands on the same pixel in both, at the whole scene and at 2× (under 2 px).
- Code that read the viewBox as the scene's size now reads the whole frame, kept on the SVG as `data-vb` (the stage,
  tricks). A ride's toy follows its drawn rider through the view (`sceneBox`). Taps map through the SVG's own
  transform, so they keep working at any zoom; a name tag (placed in page pixels) goes when the camera moves.
- **Depth**: groups marked `data-depth` (below 1 farther, above 1 nearer) move and zoom less or more than the scene,
  for parallax. PR G marks each home's layers.
- **Quality tiers**: high (every frame of a glide is sharp, with depth) until a glide falls behind (~35 fps); then lite
  for the session (a glide is one GPU transform of the drawing and the 3D canvas, sharp when it lands; depth flat).
- **Reduced motion**: a glide is a cut; offsets (a dance's beat sway) are ignored.
- Every sanctuary screen has a camera (`region.ts`); it is disposed with the screen and gives the whole scene back.

### PR D — group dances
- `three/dance.ts` makes a dance clip from its id alone (`dance:<role>:<style>:<variant>:<L|R>:<bpm>:<beats>`), so
  every dancer is a pure function of time on one beat clock: the music's (`Playback.msAt`), which runs in silence too.
- **Roles**: the **newcomer** leaps in from rest (crouch, leap, land, bounce, spin, eyes wide in the air), each
  **guest** turns toward it and beckons, and a **group** (no newcomer) starts straight on the step. Then everyone
  dances their own step and strikes a finishing pose on the last two beats.
- **Steps by animal**: kind first (sheep sway, pigs wiggle, bunnies twirl, turtles and snails bob), then body (birds
  flap, seals bob, big animals stomp, tall ones sway), then temperament (playful/energetic hop, proud strut, shy bob,
  others sway). Finishing poses (hooray, lean, turn, leap) go round across the scene so neighbours differ.
- `ui/components/dance.ts` (`planDance`, `startDance`): every dancer's figure gets the dance id as its `data-trick`
  (busy: no trick, stroll or decoration starts), which the 3D stage plays as a clip; drawn figures (3D off, or a kind
  the toys can't make) play the same parts in CSS (`styles/dance.css`), every length in beats.
- **The finish**: confetti over every dancer and a fan of stars over the newcomer (3D: sized for the whole scene, not a
  close-up; drawn: a small SVG overlay).
- **Stopping**: a skip or leaving the screen puts every dancer back at once: classes come off, and in 3D the clip
  fades (`Actor.endPerform`) and its props go. Nothing loops forever.
- **Reduced motion**: nobody moves; every dancer shows its happy face for the dance's length, confetti still.

### PR E — three levels of celebration
- **Level 1, the win sparkle** (every win, ~1.1 s, `components/celebrate.ts`): a band of light sweeps the board as its
  faces smile, a ring and eight stars burst over it, to Tiny Triumph. The results rise at 650 ms (was 500) while it
  plays; nothing waits on it. Reduced motion: a warm glow and still stars.
- **Level 2, the new-animal spotlight** (a win that brings an animal home, ~3.3 s, then the results): the screen dims,
  a beam falls on the newcomer's portrait as it pops up, sparkles turn, Welcome Home plays. A tap, Escape/Enter or
  Continue goes on at once; leaving the app skips it. The very first arrival keeps its own scene (D41). The results
  don't play the arrival sound again.
- **Level 3, the Welcome Parade** (Meet, on the Farm, every region and the Pet Garden; `components/parade.ts`): the
  camera glides in on the newcomer (1.9×), then Barnyard Bounce and the newcomer's leap start together; at the dance
  the camera pulls out to frame the whole group (≤1.45×), and at the end it gives the whole scene back. Then the next
  goal (D40) and, after the first board, the starter gift.
- **A new stage with no newcomer**: the whole home dances together to **Barnyard Jig** (new cue: 8 beats, 132 BPM,
  the motif rising into a finish on beat 6), no camera move.
- **Skip / Replay**: a Skip button on the scene (and Escape) ends it at once: everyone back at rest, music fades,
  camera back. Afterwards **Replay the parade** (or **Dance again**) sits under the scene. While it plays, taps on the
  scene and the Tricks button wait. Leaving the app or re-rendering the scene ends it.
- **Nothing is paid twice**: none of the three levels grants anything (the solve's rewards are counted before them),
  so skips and replays change nothing; a test replays the parade and compares the save.
- **Reduced motion**: the camera stays put; every dancer shows its happy face for the dance's length; still confetti.
- The Pet Garden gets the scene camera too (it had none), for its parade.

### PR F — trick close-ups
- `components/closeup.ts` (`sceneCloseUps`): selecting an animal moves nothing; a trick brings the camera in over
  0.4 s, holds for the trick's own 2–4 s, and gives the whole scene back over 0.5 s. The tray tells the screen when a
  trick starts (`onPlayed`), on the Farm, every region and the Pet Garden.
- **A shot per kind of trick**: Happy dance in close with a small bump on every beat of its tune; Giggle right in on
  the face (2.5×, framed high); Backflip in, then pulls out and up as it leaps; Sleepy a slow push-in for the length
  of the doze; Rainbow wide and high; Party time frames the animal and up to three neighbours, who join in with a
  Happy dance. Everything else: a 2× close-up.
- **The scene quiets**: a soft vignette (`.is-closeup`), and nobody else starts a stroll or an idle meanwhile; the
  nearest two animals look over and say hello a third of the way through.
- A new trick replaces the close-up; a parade, a re-render or leaving the app ends it with the scene back at once.
- **Reduced motion**: no close-ups (the trick plays in the whole scene, as before).

### PR G — the five homes, dressed up
- `art/homeScenery.ts` adds, for the Farm, Outback, Savanna, Arctic and Rainforest (the endless world's places keep
  their own look):
  - **Depth**: the sky on a far layer (`data-depth` 0.35), what floats in it at 0.55, and foreground grass, spinifex,
    dry grass, snow or fronds at the bottom corners at 1.22, so the camera's close-ups and the tour have parallax.
    Animals are never on a depth layer (they stay where the 3D toys are).
  - **Light**: warm sunlight from each home's sun (cool on the ice) by day; in the evening the barn's windows and
    hayloft, the hen house, the snow den and the platform lantern glow.
  - **A landmark to tap**: the barn's doors swing open and a chick peeks out; a bilby pops up from the Outback burrow;
    a rock hyrax peeks over the Savanna lookout; an arctic fox kit peeks out of the snow den; a golden tamarin peeks
    round the Rainforest tree. The chat line says so; it closes after 2.6 s and grants nothing. Each critter hides
    behind its own transform, so a world-map card never shows it.
  - **A party spot**: a string of lights (lanterns in the Savanna and Rainforest, ice lights on the snow den) where
    the animals gather; lit in the evening and, twinkling, whenever the home celebrates.
  - **Ambient life** the director plays (D24): butterflies, swaying grass (new `.sp-grass`), drifting leaves, petals
    and snow, a windmill on the Farm's far hill, sunbeams through the Rainforest canopy.
- **The dance floor**: every dance puts a soft pool of light on the ground under each dancer for its length.

### PR H — the guided tour
- `components/tour.ts`: a **Tour** button in the scene's corner (every open home with animals) takes the camera round
  it: the landmark first (it opens), every animal at home left to right (each says hello as the camera arrives), the
  party spot (its lights come on), and back to the whole scene. A caption names each stop. ~0.9 s glides, 1.5 s holds.
- **Stop any time**: a Stop button, Escape, a tap on the scene, leaving the app; a parade, a trick or a re-render
  also end it. It always ends on the whole scene. Nobody wanders off meanwhile (ambient life and activities pause).
- It grants nothing. **Reduced motion**: cuts between stops, each held 2.1 s.

### PR I — walking round the Farm in 3D (Option B)
- A **Walk** button in the Farm scene's corner (only where 3D toys are on: the setting and a device that can draw
  WebGL; otherwise the drawn Farm is the Farm, unchanged) opens a full-screen 3D Farm (`three/walk.ts`, loaded on
  demand, ~15 kB on top of the toys' three.js chunk).
- **The world**, built in code from simple shapes and growing with the Farm's stage like its drawn scene: rolling grass
  with a dirt path from the gate, the fenced pasture, hay, mud, the red barn with lit windows in the evening and the
  party lights, hay bales, the duck pond with ducks and reeds, the hen house, sunflowers, the orchard, a turning
  windmill on the hill; a sky dome (dusk at evening), fog, and hills closing it in.
- **Animals**: the Farm's residents as the same soft toys (D34); they turn to watch the player and say hello (once per
  visit) when the player comes within 4 m.
- **Getting round**: drag to look, tap the ground to walk there, tap an animal to walk up and say hello; hold the
  arrow buttons (or arrows/WASD) to walk and turn. The player walks round the barn, pond, hen house, hay and trees,
  never through them, and never off the edge (`three/walkMath.ts`, tested on its own).
- **Quality tiers**: high (antialiased, up to 2× pixels, ~520 grass tufts) unless the setting says lite or frames come
  slow (>25 of the first 45 over 34 ms), then lite (1× pixels, ~160 tufts).
- It draws only while showing (paused when the app is hidden); Close, Escape or leaving the screen release the WebGL
  context and give focus back to the Walk button. **Reduced motion**: taps and arrow presses move in steps (and 45°
  turns) instead of gliding, the windmill rests, the animals just smile.

### QA — the regression list
Checked in the browser tests on a small iPhone (320 × 568), on top of each PR's own tests:
- **Framing**: the Farm frames with no horizontal overflow; the Tour and Walk buttons sit inside the scene, apart; the
  parade's Skip stays inside the scene; the walk's arrow pad stays on screen.
- **Nothing pays twice**: replaying the parade and running the tour leave coins, inventory and bonds untouched; no
  celebration grants anything (rewards are counted at the solve, before any of them).
- **Nobody stuck**: after skips, stops and replays no figure keeps a `data-trick` or a dance class.
- **Background**: leaving the app ends a parade and its music; the walk stops drawing and resumes on return.
- **3D off**: the drawn animals dance the parade, the tour runs with the camera, the barn opens; no Walk button and no
  WebGL context.
- **Reduced motion**: the parade is a still celebration (happy faces, still confetti, no camera move) and a trick gets
  no close-up.
- **Tiers**: in the lite tier the walk draws at 1× pixels.
- CI: unit tests, build, generator (1000 boards), level packs, places, icons and the browser tests all green.

## 2026-11-10 · D45 — follow-ups from the D44 review

Four focused PRs after an outside review of D44: scene coordination (A), first arrival and celebration pacing (B),
the 3D farm (C), and a music and animation quality pass (D).

### PR A — the scene director
A sanctuary scene has four moments that each want the camera and a quiet scene: the Welcome Parade, a trick's
close-up, the guided tour and (on the Farm) the 3D walk. Each used to pause and resume the scene's ambient life with
its own `pause(true/false)`, so one moment ending could switch life back on under another: starting the tour during a
close-up paused the scene, ended the close-up, and the close-up's ending un-paused it for the whole tour.

- **`ui/components/sceneDirector.ts`**: one per scene screen (the Pet Garden and every home).
  - **One owner of the camera.** Each moment registers how to end; `claim(kind)` ends every other one first. The
    screens no longer list who to cancel in each place.
  - **Holds, not a switch.** `hold(kind, on)` adds or drops that moment's hold; ambient life and activities run only
    while there are no holds and the app is showing. A moment ending drops only its own hold.
  - **Leaving ends everything together**: `cancelAll()` on a re-render and on leaving, before the camera, toys and
    life are released. The 3D walk is a moment too (anything else claiming the scene closes it).
- **Parade replay race**: a parade replayed before it ended had its hold dropped by the first one's ending; the older
  parade now leaves the scene to the newer one.
- Tests: holds and ownership on their own; the real close-ups, tour and parades wired through a director (trick → tour
  → Stop → live; tour → trick; parade ↔ tour; replay; rapid switching; app hidden; leaving); and the Farm screen
  itself, where the old wiring fails the "no wake-up during the tour" check. Browser test: the same hand-over.

### PR B — first arrival and celebration pacing
- **Cotton gets her parade.** The first arrival's own scene (D41) ends in "Visit the Farm", which opened the Farm
  plainly: the first animal was the only one with no Welcome Parade. It now passes `welcome` like a Meet, plus `met`:
  the arrival scene has already said "Cotton is home!", so the Farm doesn't say it again in a toast. The parade plays
  (Skip as ever), then the next goal and the starter gift. The route settles after, so coming back never replays it.
- **Tiny Triumph is heard out.** A spotlit win opened its spotlight 0.65 s after the last placement, and Welcome Home
  replaced the win's tune mid-phrase. With music on, the spotlight now opens when Tiny Triumph ends
  (`SPOTLIGHT_AFTER_TRIUMPH_MS`, 1.1 s, as the sparkle finishes); Welcome Home opens on the chord that follows it
  (C → F G C), so it reads as the answer. With music off, or reduced motion, nothing waits.
- **Smart pacing** (`meta/celebration.ts`): a full celebration (3.3 s spotlight, ~7 s parade) for the first three
  animals home and for the first animal in each home; after that a brief spotlight (1.8 s: the name lands with Welcome
  Home's third beat) and the short parade (the same staging to the 3.6 s Barnyard Jig). After a short parade the
  button under the scene reads **Play the full parade**; replays are always the full one.
- **The player's choice**: Settings → Comfort → Celebrations: Smart (default), Full, Short.
- Nothing here grants anything; lengths only.

### PR C — the 3D Farm shows the player's Farm
- **One description for both pictures** (`meta/homeState.ts`): stage, residents in arrival order, the decorations that
  are out, evening. The drawn Farm and the 3D walk are both built from it, so they can't disagree. Before, the walk
  got the stage and residents only: a player's tractor or scarecrow was missing in 3D.
- **Decorations in 3D**: the Farm's five (scarecrow, flower wheelbarrow, water trough, tire-swing tree, little red
  tractor) are modelled and stand where `walkMath.DECOR_PLACES` says; each is solid. A test ties the list to the
  catalog, so a sixth Farm decoration can't ship without a 3D place.
- **One renderer at a time**: opening the walk suspends the scene's own 3D layer (`Scene3D.suspend`: the stage is
  disposed and its WebGL context released; the drawn animals stand in), and closing resumes it. Two contexts at once
  is what a small phone can't afford.
- **Finding the way back and around**: the Close ✕ became a labelled **Overview** button (Escape and Back still
  work). A small map (bottom left) shows the pasture, barn, pond, orchard and the decorations, with an arrow for the
  player and the way they face. **Go to** buttons walk to each destination that is built, round whatever is in the
  way (`walkMath.route`: a straight line when clear, else the shortest way over a 1 m grid with unneeded corners
  removed; taps on the ground and on animals use it too, so a tap behind the barn no longer stops at its wall).
- **Destinations and discoveries**: arriving somewhere names it, and the first time says what happens there and counts
  it ("2 of 4 places found"; per walk, nothing saved, nothing granted). The barn's doors swing open and a chick steps
  out; the pond's ducks hop, shake and turn to the player with rings on the water; an apple drops in the orchard and
  three birds fly up; butterflies rise from the pasture's clover. Each plays once per arrival and rests. An animal
  the player comes close to perks up to look at them as well as turning.
- **Reduced motion**: Go to places the player there at once; doors are simply open, the chick simply there; no
  butterflies or birds.

### PR D — music and animation quality pass
**Music** (all original; nothing quotes or imitates an existing tune)
- **Variety in the trick tunes**: they shared three chords and mostly a marimba. Four new synthesized voices (tuba,
  accordion, kalimba, glockenspiel) and the key's other chords: a kalimba hello, a tuba under the hops, a
  glockenspiel twirl, a plagal "ta-daa" for the bow, an accordion roll, an A-minor shuffle, a floating major-seventh
  bubble, a lullaby on the fourth for sleepy, a shy A minor that peeks into C, "Oh!" ending on the fifth like a
  question. Still all in C major, so any two can follow each other; a test requires every tune to have its own band.
- **A rhythm for every kind of animal** (`withRhythm`): seven small figures laid under a trick's tune for whoever
  performs it: sheep (and other soft animals) a two-note lilt, pigs an oom-pah, cows and elephants a plod, birds a
  peck, hoofed animals a clip-clop, hoppers a bounce, cats and foxes a prowl. The Welcome Parade plays the newcomer's
  rhythm under its entrance.
- **The theme and its variations** (`themeVariation`): Barnyard Bounce's tune is the PawTyk theme. Every home plays
  the same notes at the same tempo (one dance fits them all) with its own band: Farm the original, Pet Garden a toy
  box, Outback thumb piano and tuba, Savanna hand-drum patter, Arctic glockenspiel and bells, Amazon a whistled tune
  over shakers. The short parade (the Jig) and the ambient tune take the same variation.
- **Phone speakers**: a phone plays almost nothing under 300 Hz, where the bass and the stomp lived. Both now carry
  harmonics a phone can play; the music channel has a master chain (55 Hz high-pass, a gentle compressor, make-up
  gain); and the per-tune trims were re-measured **through a phone-speaker filter**: every trick tune's loudest moment
  is within 3 dB of the others, the signature cues within 2.5 dB, no cue loses more than 5 dB to the speaker, nothing
  clips (also checked for every home's parade and every rhythm). The browser tests measure this on every run.
- **Optional ambient music**: Settings → Comfort → **Home music**, off by default. On a home's screen it plays Meadow
  Morning (the theme slowed to 72 BPM, no drums) in that home's voicing, quietly (half a cue's level, lower still
  while a cue plays), rests 9 s, and after four plays leaves the place in peace. It stops on leaving the screen or the
  app, and needs Music on.

**Staging**
- **The stage**: the dancers stood in separate pools of light. A wide warm wash now lies under the whole group, and
  every light comes up for the final pose.
- **The hero shot**: at the finish the camera goes out to a wider framing with the dancers low in the picture (the
  party lights and confetti above them), with a small push as the poses land. Group dances get it too.
- **Close-ups at 2×**: checked on a 390 pt phone at 2× for the animals at the scene's edges. The camera can't centre
  an animal near the edge (it never shows past the scene), which left a neighbour in the middle of the frame looking
  like the star. The performer now has its own pool of light on the ground for the close-up.
- Reduced motion: lights are simply on; no camera move.

**Not done here** (they need a device or a studio): before/after recordings on real iPhones, loudness checked by ear on
real speakers, and a professionally recorded track. `music.useRecordedTrack(id, url)` is the hook for the last: a
recording replaces a cue's synthesized score and keeps its beat clock.

## 2026-11-10 · D46 — final polish and QA

A scoped pass after an outside review of D45 ("no further species expansion or major new feature"): transitions (A),
the 3D layer's lifecycle (B), visual and audio acceptance (C) and release validation (D). The acceptance test it set:
the player can start, stop, skip, replay and switch between every farm interaction without getting stuck, unexpectedly
changing screens, losing a reward, hearing overlapping music or seeing the wrong animal animation.

### PR A — what the player chose wins over what the game was about to start
The review's race: the director (D45 PR A) coordinated moments that had started, but the Farm screen started the
Welcome Parade after a lead-in (600 ms, then up to 1.5 s waiting for the 3D toys). A Walk tapped in that window opened
the walk; the parade then claimed the camera and closed it. The same for the Tour and a trick's close-up, on every
home and the Pet Garden.

- **Pending moments** (`sceneDirector.pending(kind, missed)`): a celebration the screen starts by itself is pending
  from the moment it is scheduled. Any `claim()` before it `begin()`s (the player started a walk, the tour or a trick)
  or a `cancelAll()` (a re-render, leaving) misses it: it never starts by itself after that. A pending moment holds
  nothing and owns nothing.
- **Missed is not lost** (`parade.scheduleParade`): a missed celebration is offered under the scene: *Watch Cotton’s
  welcome* (or *Celebrate the new stage*), which plays it in full and then becomes the usual Replay. Hidden app during
  the lead-in: offered on return, not played unseen. Left during the lead-in: the next visit to that home offers it
  (kept for the session; a welcome grants nothing, so nothing is lost if the app closes).
- **What follows waits for a free scene**: the next goal and the Farm's starter gift come once nothing owns the camera
  (the walk closed, the tour or the trick over), so the gift's sheet never lands on top of a walk.
- Used by both kinds of screen: every home (the welcome and a new stage's group dance) and the Pet Garden.
- Tests: the director's pending rules; the Farm screen with the real tour, close-ups and parades (Tour during the
  lead-in: fails on the old wiring at "still touring"); trick during the lead-in; leaving and coming back; the app
  hidden; rapid re-entry. Browser (320 × 568): Walk, Tour and leaving during the lead-in, rapid re-entry, and the
  **acceptance matrix**: every farm interaction (parade replay, trick, tour, walk, the barn) started straight after
  every other, then ended as a player ends it; after each of the 20 pairs the scene is at rest (no owner, no hold,
  nothing pending, nobody mid-trick, no tune, one canvas, the toys back, still on the Farm) and the save is unchanged.

### PR B — the 3D layer's lifecycle
- **Readiness per renderer** (`Scene3D.ready`, the review's Issue B): `ready` was one promise made when the scene's 3D
  layer was created. After the walk suspended and resumed it, it still said "yes" from the first renderer while the
  replacement was loading, so a celebration started just after Overview began drawn and the toys popped in mid-dance.
  Now `ready` is a getter for the renderer there is now: a new promise whenever the answer changes (suspended, the
  context lost, rebuilt, a scene that stays drawn), settling true once that stage draws. `state` says where it is
  (`off`, `loading`, `drawing`, `suspended`, `lost`, `failed`, `disposed`). A late load for a renderer that has gone
  (suspended, disposed, re-targeted meanwhile) is dropped by an epoch.
- **Parades wait for the toys** (briefly): `sceneParades` takes `toysReady` and waits for it, at most 1.2 s, after
  taking the scene and before its first beat (Replay, a parade the player starts). Meanwhile it owns the scene (taps
  wait, ambient life is held, the Tour and Walk buttons step aside); leaving the screen or the app cancels the wait and
  nothing starts later. A parade the screen scheduled has waited inside its lead-in already, so it doesn't wait again
  (review: a second wait sat outside the pending moment, and leaving then lost the welcome).
- **Lost contexts.** The stage reports `webglcontextlost` / `webglcontextrestored` (`onContext`). Lost: `ready` says
  false at once and the drawn animals show. Back: true again. Not back within 3 s: the renderer is disposed and rebuilt
  with a new context (never while the app is in the background: once it's back; at most twice in a row, and a rebuilt
  renderer that keeps drawing for 30 s earns that back; after two failed in a row that scene stays drawn). A renderer that can't be made at all
  (the constructor throws) leaves the drawn scene and isn't retried on that scene. three.js failing to load (offline,
  first launch) is retried on the next scene.
- **The walk's own context**: asks for it back (`preventDefault`), stops drawing and lets go of held keys; a note
  *Getting the Farm back…* over the view; if it isn't back in 3 s: *3D paused on this phone. Tap Overview to go back
  to the Farm.*, with focus on Overview.
- **A leak in three.js r186, found by the soak test**: one module-level DFG lookup texture is shared by every
  physically based material, each renderer adds a `dispose` listener to it, and `renderer.dispose()` doesn't remove
  it. So every renderer ever made stayed alive with its (lost) WebGL context and canvas: after three walks, four
  renderers and seven canvases. `three/release.ts` finds that texture once and disposes it after each renderer is
  released (every renderer forgets it; a live one re-uploads it on its next frame). After the fix: one renderer alive.
- Tests: unit (a stand-in stage): readiness after suspend → resume (the review's case: pending, not the old "yes"),
  eight round trips leaving one renderer, suspend/resume while loading, lost and restored, lost and rebuilt (and the
  cap), a renderer that can't be made, a scene that stays drawn, 3D off, disposed while loading; parades waiting for
  toys, with a bound, and cancelled by a tour. Browser: seven Walk → Overview round trips (one WebGL canvas at a time,
  toys back each time, one renderer alive after GC, heap steady); a celebration started the moment the walk closes
  dances in 3D from its first beat; the scene's context lost and restored, lost and rebuilt; the walk's context lost
  and restored, lost for good (and Overview still works).

### PR C — visual and audio acceptance
The review asked for real-device recordings and listening; this session has no iPhone, so the pass was done in Chrome
at iPhone sizes (320 × 568 and 390 × 844, 2×, toys and drawn), frame by frame, and on the scores themselves. Only what
could be seen or measured to be wrong was changed; everything a device has to judge is now one tap away for testers.

**Found and fixed**
- **The dance and the finish cut the Farm's edge animals in half.** Framing the group (D44) and the hero shot (D45) came
  to 1.07–1.14× for the Farm, whose animals stand right across the scene: the sheep at the left and the horse at the
  right were half out of the picture for the whole dance and the final pose, at every size, toys or drawn. The frame
  now allows a whole figure's height each side (they sway and hop), and a group shot under 1.2× (a hero shot under
  1.1×) is the whole scene: a move nobody notices isn't worth cropping anyone. A clustered group (a new place with
  three animals) still gets its closer framing.
- **Skip sat on the horse.** The parade's Skip (and the tour's Stop) was in the bottom-right corner, where the Farm's
  front animal stands: at the finish it covered the horse's legs. Both are now top right, in the sky; the Tour and Walk
  buttons there are hidden while either plays.
- **A spin sounded like a solved puzzle.** Twirl and Twirl opened with C–E–G–C in sixteenths, note for note Tiny
  Triumph (the solve's signature). It now opens with a turn round G landing on C, then the same turn a step up over
  D minor: same band, rhythm and length, so its loudness and the trick's timing are unchanged.
- **The walk's Go-to buttons wrapped into two rows** over the middle of the view on a 320-wide phone. Tighter there,
  they fit one row (still 44 pt tall).

**Checked and left as they are**
- The newcomer's close-up at the start of the parade, the trick close-up (performer centred in its own light), the
  tour's stops and captions, the drawn Farm against the 3D walk from the gate (the same barn, fence, hay, mud and
  animals, where the drawing puts them; the sunflowers and windmill are there, to the left, as in the drawing).
- A wider walk camera on portrait phones was tried (the view is a 32–38° slot) and dropped: it shows the whole barn
  but makes the animals small. A matter of taste for the device review, not a defect.
- Barnyard Bounce's hook: it states its phrase and answers it with the same shape a step higher, then climbs to the
  top: the repetition that makes a tune stick. Every trick tune opens its own way (no two alike).
- Cue lengths: tricks 1.3–3.4 s, the parade 7.3 s (8.6 s with its glide in), the short parade 3.6 s.

**For the device review (tester builds, Settings → Tester shortcuts → Device checks)**
- **Performance check**: about a minute on the Farm, played by itself: the scene at rest, the tour, three walks (to the
  pond, the barn and the orchard, then Overview), a Welcome Parade, the scene at rest again. Per step: median fps,
  95th-percentile frame time, the share of frames over 33 ms, the walk's quality tier; then the third walk against the
  first (under 85%: a slowdown that builds up), the 3D renderers alive (1 expected) and JS memory where the browser
  reports it (iOS doesn't: Xcode's memory gauge is the place). *Copy results* puts it all on the clipboard.
- **Frame rate counter**: fps and p95 in the corner while playing (green, amber, red), this device only.
- **Listen to every tune**: the five big moments, the parade in each home's voicing, the 18 trick tunes: one tap each,
  or all in a row, on the phone's own speaker.
- None of it is in a release build. The Performance check isn't offered from a board's own Settings (it would leave
  the board); its parade is led by a Farm animal who is home.

Tests: unit (the Farm's real layout frames as the whole scene for the dance and the finish; no trick tune opens with a
signature cue's notes in its rhythm, fails on the old Spin; no two trick tunes open alike; the theme's hook returns;
the frame summary, verdicts, report text and listening list). Browser (320 × 568): every steady frame of a whole
Welcome Parade, toys and drawn, keeps every animal in the picture and clear of Skip (fails on the old framing); the
walk's Go-to row is one row; the Performance check runs through all seven steps from Settings and reports one renderer
alive; the counter and the listening list work.

### PR D — release validation
- **The App Store bundle, checked** (`npm run release:bundle`; also the last step of `release:check`, and in CI): builds
  what a release gets (the tester flag off, whatever `.env.local` says) and fails if it contains any tester code (the
  tester shortcuts, the device checks, the dev hooks for the director, the 3D layer and the walk), if the in-app privacy
  policy is missing, if the 1024 px icon has an alpha channel (App Store Connect rejects it) or isn't 1024 × 1024, if
  the home-screen icon isn't linked, or if the name or bundle id changed. Checked both ways: today's release build
  passes; a tester build fails on five markers.
- **Force-close** (browser tests): iOS kills an app without `pagehide`, so the tests crash the page's renderer (nothing
  of the page runs after) and reopen in the same profile. Mid-board (two animals and a ✕): Resume brings back exactly
  those moves. The instant a board's solve is recorded: its coins and the next level are there once (not lost, not
  paid again) and the solved board isn't offered to resume. During a parade, then during the walk: the save is
  unchanged and the Farm opens plainly with its toys.
- **The TestFlight smoke test**: `docs/release-checklist.md` → D46: the review's acceptance test as steps on a phone,
  the performance and sound checks with the tester's device checks, and the App Store items.
- Not done here (needs Sam): the TestFlight build itself and running that list on iPhones; App Store Connect (name,
  privacy URL, screenshots); the trademark search.

### Review (independent agent, on the whole stack)
No P0 or P1. Eight P2s, all fixed before merge in the PR they belong to (each next PR took them in with a merge commit):
- **A**: an owed welcome and a new stage's dance on the same visit shared the one button under the scene (one
  overwrote the other); the welcome is now offered once the dance is done. The wait for a free scene (before the next
  goal and the starter gift) added a scope disposer every 250 ms of a long walk; it keeps one timer now.
- **B**: a scheduled parade waited for the toys a second time inside `play()`, outside the pending moment, so leaving
  then lost the welcome, and Tour and Walk showed but didn't answer; a scheduled parade doesn't wait twice now, and
  while a parade waits the two buttons step aside. A rebuild with 3D turned off meanwhile left `ready` pending; it
  settles false. Rebuilds no longer happen while the app is in the background, and a rebuilt renderer that keeps
  drawing for 30 s earns the rebuild budget back.
- **C**: the Performance check's parade could be led by a non-Farm animal; and it isn't offered from a board's own
  Settings.
- **D**: the bundle check now also looks for the camera and welcome dev hooks. The force-close test "nothing paid
  twice" could never fail (parades and the walk grant nothing); the kill right after a solve is the one that can.
- Confirmed by the reviewer: `three/release.ts` is safe with another renderer live (each renderer re-uploads the
  shared texture on its next frame); holds are always released; `after` runs once; the release bundle carries no
  tester code, and a tester build does.
- CI: three D46 browser checks failed on PR B's first run because a tap on the walk's Overview didn't settle within the
  test's 3 s on CI's software WebGL; taps are now hit-tested first and given 10 s.

## 2026-11-10 · D47 — unified UX, farm graphics, photo mode, analytics, the Welcome Rescue Pack

Nine PRs from the D47–D48 plan. Out of scope by the plan and not done: Buddy Training, new species, a Season Pass, VIP,
new currencies, purchased hints or hearts, forced interstitials, a bundle id change. Puzzles, the generators and saved
boards, three hearts per Journey and Daily board, drag-to-✕, the Look / Explain / Place hints, region patterns, high
contrast, VoiceOver and reduced motion are unchanged (their tests are unchanged and pass). Before/after pictures at the
same positions: `docs/screenshots/d47/` (made by `scripts/farm-shots.mjs` on D46 main 3e2fc90 and on D47).

### PR 1 — a natural meadow (drawn and 3D)
- **Purpose**: the Farm's tufts and cones become a meadow; butterflies that look and move like butterflies.
- **What**: `src/art/botany.ts` (shared shapes and palette: six butterfly species with fore and hind wings, veins,
  borders, spots; grass, flower and clover colours; seeded noise), `src/ui/art/botany.ts` (drawn grass clumps, seed
  heads, clover, buttercups, daisies, lavender, dandelions and clocks, rosettes; seeded drifts kept off paths and
  animals' spots), `src/three/meadow.ts` + `meadowLayout.ts` (the 3D meadow), `sanctuary-life.css` (drawn butterflies:
  rest, take off, flap and glide, land, as one ambient part with no loop of its own).
- **3D**: near grass is a field that travels with the player (placed in the vertex shader, thinned by a baked mask that
  keeps the path, mud, pond, buildings, decorations and animals' spots bare), far grass in skippable chunks; one
  instanced mesh per flower kind; wind in the shader, anchored at the roots (a per-vertex sway weight, 0 at the root),
  stopped under reduced motion. Butterflies: a state machine (rest, open wings, take off, wander on curved arcs, glide,
  land on a flower), take off when the player walks up; the pasture's discovery sends them up together. Wing texture
  painted once from the same vector shapes as the drawn ones.
- **Numbers**: high tier 3,600 field blades, 1,400 clumps, 620 flowers, 170 clover, 7 butterflies in ~48 draw calls;
  lite 1,400 / 500 / 240 / 60 / 4. The drawn Farm ~1,100 elements, ~146 KB, memoized; map cards strip the meadow.
- **Tests**: `botany.test`, `meadowLife.dom.test`, `meadow3d.test` (layout determinism, masks, tiers, the state
  machine, reduced motion); browser: the meadow's counts, tiers and draw calls.

### PR 2 — trees, sunflowers and the Farm's materials
- Apple trees that branch, layered foliage, apples; sunflowers with two petal rings round a seed spiral, curved stems
  and leaves; the barn's boards, shingles, trim and footing; fences with grain and caps; hay bales rolled and tied;
  the pond's bank, stones, lily pads and slow rings; pebble paths; the windmill's boarded tower and framed sails; soft
  contact shadows. Drawn (`src/ui/art/farmArt.ts`) and 3D (`src/three/farmProps.ts`: canvas-painted textures, merged
  vertex-colour geometry, one draw call per thing). Every landmark, route, interaction and decoration spot stays where
  it was (walkMath and the drawn layout unchanged). Tests: `farmProps.test`.

### PR 3 — one Farm in 2D and 3D, and the frame budget
- `src/art/farmPalette.ts` used by both; the walk's sun where its light comes from, warm and low in the evening.
- Idle walk: half rate while nothing happens, twice a second under reduced motion; any input brings every frame back;
  the lite-tier check measures the display's frames. Contact shadows only (no shadow maps); tracked disposal.
  `frameStats`/`meadowStats` for tests and the QA page. Tests: `farmPalette.test`; browser: idle frames passed over,
  five walk round trips leave one canvas.

### PR 4 — losing a board
- "So close!": how many animals were placed, the board kept as it was; an earned extra life, an optional short video
  for one, **Try again, free**, and back. Never a purchase; Paw Cup shows only the way back. No setting (Auto-✕, dots)
  is switched on for the player.
- Reward exactly once: recorded when the network reports it (before the video closes), keyed by the video's id, one
  video at a time. Tests: `gameScreen.dom.test` (choices, words, life, double tap, reported twice, interrupted close,
  free retry, Paw Cup); browser at 320 × 568: the sheet within reach, the video tapped twice → one heart, then drag ✕,
  tap/slow tap, double tap; free retry with settings untouched.
- **Deferred, as an experiment only:** solver-assisted marking (offering to ✕ the tiles the solver can prove empty
  after a revive). Not built: it changes what a board asks of the player and would need a usability test against
  drag-marking; if tried, behind a setting that is off by default, never switched on for the player.

### PR 5 — photo mode and postcards
- Photo on every home and on the walk; the director gives photo mode the camera; framings (whole home, everyone, each
  animal); landscape 1500 × 1000 or portrait 1080 × 1350; optional PawTyk mark and home name; nothing about the player.
  The SVG frozen with live styles + the WebGL canvas copied right after a fresh frame (no preserveDrawingBuffer); 3D off
  or no WebGL: the drawn animals. iOS share sheet through @capacitor/share + @capacitor/filesystem (file deleted
  after); cancel isn't an error. Needs `NSPhotoLibraryAddUsageDescription`. Tests: `postcard.dom.test`, browser
  (three postcards in a row, leaving mid-capture, 3D off, the walk in portrait, Escape order).

### PR 6 — usage statistics (Firebase Analytics, opt-in)
- Off by default and off in the build until configured; the player opts in (Settings, or a one-time card); no user id,
  no advertising id, consent mode denies ad storage/personalization. Funnels for play, homes, retention (D1/D7/D30
  counted on the device), the store (incl. cancelled), reward videos and grants. A failing SDK never reaches the game.
  Docs: `docs/analytics.md`, privacy policy dated 2026-11-10. Tests: `usage.test` (sinks, consent, queue, failures, day counts), `privacyPolicy.test`.

### PR 7 — the Welcome Rescue Pack
- `pawtyk.welcomepack`, non-consumable ($2.99 suggested; the price shown is the App Store's), entitlement
  `welcome_pack`: 180 gems + the **Rescue Wagon**, a Farm decoration only in this pack (drawn, 3D, with its own ride).
  No hints, hearts or anything that helps win. 180: a little more than the 160 pack, so a fair first purchase.
- Offered only after the first lessons (level 6+), an animal home and a home visited; in the Shop's Gems tab, and
  highlighted with the Farm's decorations at most every 3 days, 3 times, never after "Not now"; never on a board,
  after a loss, in the Paw Cup or a sanctuary (a test enforces where it may appear).
- Exactly once: gems by the store's transaction id and once per player (a second id for the same pack grants no
  more), one purchase at a time; launch reconcile grants a purchase the app never recorded (crash, reinstall +
  Restore). A pack missing from the store's record is **not** taken back by default (`REVOKE_WHEN_MISSING`): RevenueCat
  moves a purchase to another install on a Restore there, so absence isn't proof of a refund; the revocation path is
  built and tested for when the sandbox proves the refund signal. An unanswered store changes nothing. Remove
  Interruptions stays unsold and unmarketed; v1 owners keep it. A test-store grant never counts in a release build.
- **Payments stay off in release** until `VITE_WELCOME_PACK=1`, set only after App Store Connect, RevenueCat and the
  sandbox checks (release-checklist D47). Tests: `welcomePack.test`, `welcomePackShop.dom.test`, browser (test store).
- Open: in the sandbox, confirm the purchase's transaction id matches RevenueCat's record (no second grant on
  relaunch; the gem packs share this), and whether a refund drops the pack from RevenueCat's record.

### Review (independent agent, on the whole stack) and what changed
No P0. Five P1s and nine P2s; all fixed before merge except where noted:
- **A video revive at the extra-life cap** turned the reward into coins and then spent one of the player's own lives.
  The video isn't offered with a full pantry now (test).
- **The pack's gems were once per transaction id, not per player**: a second id for the same purchase (StoreKit can
  report one) would grant 180 again. Now once per player; after Erase progress they come back once (tests).
- **Opting in sent the session's earlier events**: turned on in Settings or on the card, only what follows is sent;
  only a yes given before this launch sends the launch's first moments. At launch with the choice off, the native SDK
  is switched off too (its setting outlives the save). Web: consent set before the SDK's first hit (tests).
- **"In Full Bloom" would have needed the pack**: it counts every decoration except the pack's own (test).
- **A Restore on a second device would silently take the pack from the first** (RevenueCat moves the purchase): no
  clawback by default now (above).
- P2s: "Not now" holds within the same visit; nothing leads to the pack until the store has given its price (no
  empty Gems tab); the purchase toast says what was actually granted; a test-store pack doesn't count in release; the
  usage card shows in one run of the app only (unanswered = no) and Erase progress keeps the answer and the bought
  wagon; a store that never answers frees the purchase guard after two minutes; the postcard mark is retried after a
  timeout; the walk's idle check allocates nothing per frame; the TestFlight steps carry the Info.plist key that keeps
  Firebase off until the player says yes.

### PR 8 — cloud backup: decision and plan only
- `docs/cloud-backup.md`: optional iCloud backup through CloudKit's private database, no account, merged (the ledgers'
  idempotent ids make a union safe) rather than overwritten; not Key-Value Store (silent last-writer-wins), not Game
  Center saved games, not Firebase. Sign in with Apple alone syncs nothing. Four-phase plan; bundle id unchanged.

### PR 9 — integrated QA
- Browser checks added to the smoke run (`test/e2e/d47.mjs`): meadow counts and tiers, idle frames, five walk round
  trips, the loss sheet and revive on 320 × 568 with drag/tap/double-tap after it, free retry, the pack in the test
  store; plus PR 5's photo checks.
- Bundle (gzip): app `boot` 332 → 352 KB (the drawn meadow and botany), walk chunk 8 → 20 KB (meadow and props, loaded
  with the walk), toys +2 KB; share/filesystem/analytics plugins are small lazy chunks.
- Release checklist D47: TestFlight build steps, device checks per PR, the pack's sandbox checks, go/no-go.
- **Not established here**: anything about a real iPhone. All of this ran in Chrome at iPhone sizes with software WebGL;
  frame rate, heat, the share sheet, Photos permission, Firebase DebugView and StoreKit need the TestFlight pass.

## 2026-11-10 · D48 — shop, feeding, tricks and celebrations (Farm Life & Personality)

From *PawTyk — Shop, Feeding, Tricks & Celebration Upgrade Plan* (Sam: "implement all these and merge it"). Six PRs,
a working game after each: A polish, B feeding, C decorations, D tricks and emotes, E celebration styles, F QA. The
guiding rule from the plan: more ways to enjoy the animals already rescued, not more obligations or things to buy.
Nothing here touches puzzles, hearts, hints, rankings or the Paw Cup.

### PR A — UX and haptic polish
- **Swipe-marking skips nothing.** A fast swipe can report its first move several tiles away; the board now marks every
  tile on the straight line between the last tile and the new one (a 4-connected grid walk, `cellsBetween`), and
  reads every coalesced pointer position. A tile already handled in the drag is passed over.
- **Drag haptics are restrained.** One light selection tick per tile that changes, at most every 40 ms (`DRAG_TICK_MS`),
  so a fast swipe changing three tiles in a frame is one tick, never a buzz. No tick for passing over an unchanged tile
  (the board only reports changes), none for staying inside a tile, no sound while dragging, nothing with Haptics off.
  Marks and placements are never spaced. Real `@capacitor/haptics` feel needs the device check.
- **Postcards keep every animal.** A postcard is a 3:2 or 4:5 crop of the screen, and a centred crop cut animals near
  the scene's top or bottom. Every framing now fits its animals (whole height, ears to feet) inside the card's own shape
  with a 10% margin (`SAFE_MARGIN`), widening near the scene's edges until they fit where the card can reach; the crop
  follows the animals (`focus`) instead of the screen's middle, the guide shows exactly that crop, and switching
  landscape/portrait or the signature refits the framing.
- **The Daily, said shorter.** "Daily Puzzle"; the card reads *Thursday: 6×6, one animal. Same board for everyone.*;
  *Solved today. A new one tomorrow.* Internal ids and ledger entries unchanged.
- **The first board teaches the two moves one at a time** (double-tap players): *tap any tile once* marks ✕ (a note),
  then the guided tile glows for the double tap. Two-step tap players keep the old first step (no timing to learn).
  Usability check: `onboarding_controls` (opt-in analytics only) says whether the first animal landed on the first
  double tap and how many single taps came before; the five-player script should watch the same moment.
- Tests: `d48polish.dom.test` (grid walk, tick spacing and silence, safe framing for groups, tall and edge animals in
  both shapes, the warm-up and two-step), smoke e2e updated for the warm-up.

### PR B — feeding: a moment, more food, a choice of currency
- **A meal is played out.** Choosing a food on an animal's card counts the meal (as before, `meta/feeding.ts`), then the
  card makes way and the scene plays it (`components/feeding.ts`, the director's new `feed` moment): the camera moves
  gently closer, the player's bowl appears beside the animal toward the middle of the scene, the animal notices it,
  steps up, takes three bites (the heap goes down each time, a munch each time), reacts (more hearts for a favorite),
  and a small card under the scene shows the friendship bar moving. ~3.6 s; the 3D toy plays the same moment from
  its `feed` clip (with rising hearts). Anything the player starts (Photo, Walk, Tour, a trick) ends it; leaving ends
  it. Reduced motion: no camera, no movement; bowl, hearts and card shown still. Friendship news (a level reached)
  comes after the meal, not over it. Where there's no scene (the Pets tab) the card says what happened, as before.
- **The card shows what the animal loves** (its favorites' icons, bought or not), the pantry favorites-first and
  starred, the home's feast, and **Get food** (or *More food*), which opens the Shop's Food tab on that home with the
  animal's favorite picked out and a *Shopping for Cotton* banner; after a purchase it reads **Feed Cotton**, which goes
  back and reopens her card (`setFeedReturn` / `takeFeedReturn`). Leaving the Shop any other way forgets the errand.
  The trick tray has a **Feed** button too.
- **Thirty foods** (15 new): pumpkin cubes, rolled oats, seed mix (Farm); leafy lettuce, pup biscuits, herb basket (Pet
  Garden); saltbush (Outback); watermelon (Savanna); little sprats (Arctic); papaya boats (Amazon); and everywhere the
  **Harvest Basket** (coins, loved by all), Rainbow Fruit Bowl and Party Treat Platter (tokens or gems), the **Golden
  Picnic Basket** (gems) and the **Festival Feast** (tokens or gems), which one serving feeds a whole home at once.
  Storybook treats, species-appropriate favorites; nothing reads as real-world feeding advice.
- **Currencies: coins first.** `foodOffers`: one portion; a bundle of five for 90% of five (coins); special treats keep
  their video-token price and gain a gem one; the premium treat is gems only. Gem foods give nothing more than coin
  ones can (a favorite is 2 a portion, the daily limit stays 6): every animal can reach the day's limit with coins alone
  (test). Offers follow D43: nothing priced in a currency the build can't sell, unless the player holds some.
- **Exactly once.** A purchase's spend and grant share one id (`buy:food:<food>:<offer>:<n>`); a bundle that wouldn't
  fit the pantry (30 each) isn't sold, so nothing is charged for food that can't be kept; quick taps buy as often as
  tapped, each charged once and granted once (test: every grant has its own spend). A feast uses its portion only if
  someone there has room for more today.
- **Bowls, kept for good**: wooden (everyone's), patchwork (150 coins), flower (35 gems), golden (60 gems). A bowl
  changes how a meal looks, never what it gives. Ownership is the purchase in the ledger (`buy:bowl:<id>`), so a bowl
  survives a rollback to a build that doesn't know bowls (`inventory.bowls` is a cache; test).
- Prices are starting points for the economy check in PR F (a new level pays 35 coins).
- Tests: `feeding.dom.test` (catalog, offers, bundles, quick taps, feasts, bowls and rollback, coins-only friendship,
  the meal in the scene incl. stop and reduced motion, the Farm's card → meal, the Shop round trip, the tray's Feed).

### PR C — decorations: twenty-one pieces the animals use, spots, sets, a preview
- **21 new pieces**, 16 on the Farm, one in each other home: Flower Arch (180), Apple Cart (200), Wooden Bench (120),
  Festival Stage (120 gems), Mini Carousel (75 gems), Rainbow Slide (90 gems); Butterfly Garden (160), Pumpkin Patch
  (150), Cozy Tent (140), Party Table (130); Musical Windmill (4 tokens), Corn Shocks (90), Star Lanterns (3 tokens),
  Barn Bell (3 tokens), Bubble Machine (4 tokens); Duck Pond Fountain (250); Wind Chimes (Pet Garden, 100), Red Rock
  Slide (Outback, 150), Drum Circle (Savanna, 140), Sled Hill (Arctic, 4 tokens), Vine Swing (Amazon, 130). Prices are
  the plan's starting points (PR F checks them against the 35 coins a level). Original art (`art/decorD48.ts`), 3D for
  the Farm walk (`three/decorModels.ts`, with solid colliders), and something to do for every one.
- **Spots, not clutter.** The Farm was already full, so the 16 Farm pieces share four spots (`slot`): the meadow by the
  path (six), the hill by the orchard (four, drawn small: far away), the corner by the big tree (five, tall and narrow),
  the pond (the fountain). One piece per spot is out at a time; putting one out (or buying it) tucks away the one there,
  and the card says which. Each spot's pieces are drawn to fit its box, so nothing overlaps another spot or covers an
  animal (test; the cow stands 6 units further right to make room). Buttercup's spot moved from x 262 to 268.
- **Interactive**: one set of 15 **motions** (`three/motions.ts`) for all 21 (gather, peek, rest, ride, slide, chase,
  splash, ring…), drawn by `styles/decor-d48.css` and the same motion as a 3D clip (`motionClip`), always the same
  length; the decoration's own part moves with it (the carousel's ponies go round, the sled goes down, the vine swings,
  the bell swings). The Barn Bell, the Wind Chimes and the Musical Windmill make their own sound when the player starts
  them (never by themselves). The **Barn Bell rings whenever a parade welcomes a newcomer**; a tap on the **Festival
  Stage** starts a dance for everyone (a solo show with one animal); its lights chase during any celebration there.
- **Themed sets**: Spring Meadow (arch, butterfly garden, musical windmill, pond fountain), Harvest Festival (cart,
  pumpkins, corn shocks, and the scarecrow), Cozy Camp (bench, tent, star lanterns), Barnyard Party (stage, party
  table, barn bell). A set has at most one piece per spot, so it can always be out together. The Shop's Farm decor has a
  *Themed sets* section (pieces, owned count, **Put the whole set out**); a home's list says which sets are set up; new
  badge **Set Dresser** (a whole set out). *In Full Bloom* keeps counting the collection it was set for (the pieces before
  D48), so new pieces never move a goal a player was working toward.
- **The card previews it in the player's own home**: the home as it is, this piece out in its spot (its spot-mate away),
  framed round it with a dashed ring; **Show me** plays what the animals do with it, with one of the home's own animals.
  It says where it stands and what it replaces, its set and how much of it is owned, and when it will appear (the
  fountain waits for the pond: `stage`, honoured by the drawing, the walk and `homeState` alike). Owned pieces have
  **Put it out / Tuck it away** right on the card. Premium pieces are more of a spectacle, never better at anything.
- Saves: decorations, hidden flags and set membership are kept by id (older builds keep unknown ids), so a save from
  before D48 shows exactly what it did (test), and a rollback keeps owned pieces.
- Tests: `decorations.dom.test` (art, activity and 3D length for each, prices, spots and swapping, no overlaps with other
  spots or the animals, the pond's wait, sets and the badge, the preview, older saves, the Shop card's preview, spot,
  set and show/hide, the sets section, the stage's dance and the bell); `walkPlaces` and `toys` updated for spots and
  motions.

### PR D — eighteen more tricks and emotes, in four groups, for coins too
- **36 in all.** Emotes: Happy Wiggle (free), Peekaboo (80 coins), Head Tilt (60), Little Sneeze (70), Sleepy Stretch
  (60), Confetti Pop (2 tokens). Tricks: High Five (free), Tail Chase (100 coins), Somersault (2 tokens), Balloon Float
  (50 gems), Drum Solo (55 gems). Dances: Moonwalk, Disco Paws, Silly Chicken Dance (3 tokens each), Star Twirl (45
  gems), Barnyard Boogie (70 gems). Group acts: Buddy Duet (60 gems), Mini Parade (80 gems). Prices are starting points
  for PR F's economy check.
- **Paw Coins learn the everyday ones** (`tier: 'coins'`): earned by playing, so they're on sale in every build, a
  release build without a store included. The spend goes through the coin ledger (`buy:trick:<id>`), once.
- **Four groups** (`group`, else by kind): Emotes, Tricks, Dances, Group acts — the tray's tabs and the Shop's headings,
  each split by how it's learned (free, coins, video tokens, gems). The tray has an **Again** row: the last four played
  this session (owned ones only), redrawn in place so focus stays put.
- **Group acts** take partners (`partners`: a duet one, the parade three): the nearest free animals in the scene (not
  mid-trick, not away on a decoration) join a beat (160 ms) behind each other, with no bubble of their own; with nobody
  free it's a solo. In 3D the partner's clip starts that beat later too (`Actor.perform(…, delay)`).
- **Bodies do their own version**: big and tall animals roll on their side instead of a somersault and float lower under
  the balloons; birds give a wing five and stretch their wings; seals bob through the dances (drawn: `data-trick-body`;
  3D: the clip reads the body).
- Every one has: drawn motion and a bubble exactly as long as it (`styles/tricks-d48.css`), a 3D clip of the same length
  built from the same primitives (`D48_CLIPS`), 3D props (confetti, balloons, a drum, a mirror ball, a sneeze puff,
  notes, words), drawn props for the showpieces (none under Reduce Motion), and **its own tune** of exactly its length
  with a band no other tune has (`audio/scores.ts`; the phone-speaker levels within the D45 span, test + e2e).
- **Preview before buying**: the Shop's card plays it on its own little stage (with partners for a group act) before
  any price; *Show me again*.
- Tests: `tricksD48.dom.test` (catalog and tiers, groups and partners, coins once through the ledger, drawn and 3D
  length and rest, body versions, props and reduced motion, tunes, the tray's tabs and Again row, the Shop's groups and
  buying with coins); `tricks.test` and `releaseBuild` updated for the new tiers.

### PR E — four welcome celebrations
- **Barnyard Boogie** (the D44 Welcome Parade, unchanged), **Meadow Hop** (the newcomer hops in three hops and
  waves; everyone hops; one big leap; petals and flowers), **Sparkle Surprise** (a crouch and a spring into a double
  twirl; the others start back, then cheer and bob; a fan and a shower of stars), **Friendship Circle** (a shy look
  round and a happy bounce; the others lean in close and everyone sways; a ring of hearts on the ground; hearts rise).
- **Which one**: decided the first time an animal's welcome plays, from its id (`meta/celebrations.ts`: FNV-1a mixed,
  so the four come round evenly across the game's animals), and never the same as the welcome before it
  (`world.celebrations.last`). Kept per animal (`world.celebrations.by`), so a replay is the same celebration; a
  replay never moves `last`. Deterministic: the same arrivals in the same order give the same celebrations (test).
- **Its own music**: Meadow Hop (kalimba over an oom-pah tuba, a wood block on every hop), Sparkle Surprise
  (glockenspiel arpeggios over held major-seventh chords, a swoop and a pop), Friendship Circle (whistle and
  accordion, warm and swaying). Each is 16 beats with the parade's parts (entrance 0–4, finish from 12, poses on 14),
  in C major, with its own band, and carries PawTyk's motif (C–E–G) into its entrance and its finish; on a phone
  speaker they sit with the signature cues (e2e).
- **The same machinery**: the choreographer takes a `preset` (the dance id carries it: `…:<beats>:<preset>`; the
  Boogie's and group dances' ids are exactly as before), which sets the steps, the poses, the entrance (drawn and
  3D) and the finish (drawn overlay and 3D props). The camera, Skip, Escape, leaving the app, reduced motion (still
  faces, the ring and finish still) and the short welcome (the Jig, with the celebration's steps and finish) all work
  as for the D44 parade.
- **Replay**: the button under the scene, as before, and now **the animal's card** (*Replay the welcome: Meadow Hop*),
  on the Farm and in the Pet Garden, for an animal in the scene: the card makes way and it plays there.
- **No double rewards**: a celebration grants nothing; playing, replaying and skipping change only the record of which
  one it was (test: everything else in the save as it was).
- Saves: `world.celebrations` is optional; ids are kept as they are (a newer build's unknown id is kept, not used), so
  saves round-trip both ways.
- Tests: `celebrations.dom.test` (assignment, consecutive arrivals, replays, saves; ids, steps and poses per preset;
  3D entrances and rest for every body; the tunes' form, band and motif; each played with its tune, ids, finish and
  clean end; Skip and reduced motion; Meet, Replay and the card on the Farm paying nothing); `celebrate`, `pacing`,
  `music` and `deviceChecks` updated (an animal's welcome may be any of the four).

### PR F — integration and release checks
- **Economy, in levels played** (a new level pays 35 coins; `d48Release.test`): a day's meals to the limit for any
  kind of animal with its cheapest coin favorite ≤ 2 levels; a coin trick ≤ 3; a coin decoration 2–8; the patchwork
  bowl ≤ 5; everything D48 sells for coins together 40–100 levels (about 70 now): a long goal, not a wall. Video-token
  prices ≤ 4 (under half a day's videos); gem prices ≤ the middle pack, and the smallest pack buys a premium trick or
  bowl. Coins stay the main way: most foods and new decorations, and seven of the eighteen tricks (two free). Five at
  once cost less than five and never less than four. No price needed changing.
- **Saves**: a save from before D48 loads untouched and gains none of D48's records (bowls, the chosen bowl,
  celebrations); a save with everything D48 round-trips exactly, every purchase charged once (retries included); ids a
  newer build might write (a decoration, a trick, a bowl, a celebration) are kept and never used.
- **Browser checks** (`test/e2e/d48.mjs`, run by the smoke suite): feeding on the Farm and the Get food round trip; a
  decoration's card with its preview and Show me; the tray's four groups and Again, a group act's preview with its
  partner, a coin trick learned once for three quick taps; each new welcome with its own tune (the circle's ring of
  hearts), Skip, the replay from the animal's card, and nothing in the save changed; every new control has a name; no
  stalls during a drawn celebration (with 3D toys the test browser renders in software, so it is only reported).
- The music checks now count 44 cues and hold the three new welcomes to the signature cues' loudness (e2e).
- **Tester shortcuts** (QA builds only, Settings): *Add 500 Paw Coins* (a tester gift in the coin ledger) and *Watch a
  welcome celebration* (each tap plays the next of the four on the Farm, for an animal at home there; it changes only
  that animal's record, never which came last). *Listen to every tune* lists the three new welcomes.

## 2026-11-11 · M — monetization, discovery and organic growth

From *PawTyk — Monetization, Discovery & Organic Growth Plan*. Started from merged `main` after D48 (`d674ab8`),
auditing what D48 already built: the Shop's decoration cards already preview the piece in the player's own home
(D48 PR C), trick cards already play the trick first (D48 PR D), the trick card already offers a video for a token,
postcards and the system share sheet exist (D47 PR 5). M builds on those, without new currencies, IAPs, tricks or
decorations. Global constraints kept: three hearts and free retries, no gem revives, no interstitials or banners, no
VIP pass, product ids unchanged, the Welcome Pack's offer and dismissal untouched, nothing required for the Journey.

### M1 — Shop discovery and visual previews
- **Featured for your <home>** (top of the Decor tab, `meta/featured.ts`): up to four picks from the existing catalog
  for the home being browsed — the next piece of a themed set already started (else what the player can afford now,
  else the nearest), a special piece for a currency the player already has (when this build sells it), a trick the
  animals there could learn, and a favorite food of someone living there that the pantry has none of. Chosen from the
  save alone, so the same save always gets the same picks; every card shows the real price and names the currency.
  No popularity, countdowns, "limited" or "only today": the test checks the wording.
- **See it in your <home>** (a decoration's card): the home itself opens with the piece out where it would stand
  (whatever shares its spot set aside for the moment), framed and with a banner: what it is, *Not yours yet*, its price
  and what the player has toward it. The real scene draws it (2D and under the 3D toys alike); the walk and photos step
  aside while trying on. Nothing is owned, shown or spent (test: the save's inventory and ledger unchanged).
- **Try it in your <home>** (a trick's card, from the Shop) and **Try it on <animal>** (from a home's tray, for one not
  learned yet): one of the home's animals plays it in the scene, with partners for a group act, the close-up and its
  tune; *Again* plays it again. A preview, never an unlock (`trick_tried` in analytics).
- **Back to <item>**: before leaving, the Shop's own history entry is rewritten to reopen that item's card, so the
  banner's button (or the system Back) lands on exactly what the player was looking at.
- **Prices in words**: decoration and trick cards say "180 Paw Coins · you have 120" (or *Yours, out now*); food cards
  say what the player has in each currency it is sold for.
- Release builds: what the build can't sell is never featured or offered (the existing `currencyOffered`).
- Tests: `shopM1.dom.test` (featured picks, honesty, determinism, availability; try-on lists; the Farm try-on and Back;
  a trick tried from the Shop and from the tray, never learned).

### M2 — earning a video token from an item's card
- When a decoration, a trick or a treat costs more video tokens than the player has, its card says so in plain numbers
  ("You have 1 video token; this needs 3", how many to go, how many videos are left today) and offers an optional
  **Watch a video: +1 token** (`components/earnToken.ts`). D48's trick card already had a button; decorations and
  food now have the same, and all three share one piece.
- It goes through the one reward-video service (`app/rewarded.ts`): the daily cap of ten, one grant per watched video
  (a reward reported twice grants once), saved at once. The card stays open throughout, so the player is back on the
  same item with the new balance; with enough, the Buy button is there and focused.
- Every other outcome is said plainly and charges nothing: a video not finished or not ready ("No token this time"),
  a failure of the ad service (caught, not an error on screen), videos not in this build (no button, a line saying
  so), today's videos used up (no button, "more tomorrow"). Release builds without videos hide token items as before.
- Analytics: the reward events now carry the surface they were chosen from (`decor:<id>`, `trick:<id>`, `food:<id>`,
  `shop`), never anything about the player.
- No forced ads, banners, interstitials or paid puzzle recovery were added; the in-puzzle extra life and hint videos
  are unchanged.
- Tests: `rewardedM2.dom.test` (the card's wording, no button without videos or after the cap, watched, twice,
  cancelled, failed, the cap, staying on the item, a trick never learned by watching).

### M3 — shareable moments, a game link, and the weekly Photo Memory
- **Audit first**: postcards, photo mode and the system share sheet (D47 PR 5, `services/share.ts`) were reused, not
  duplicated. D48 changed sharing only through photo framing (PR A). The win sheet's Share was text only.
- **A Daily result to share**: the win sheet's optional Share (in its fold, as before) now shows a card
  (`components/resultCard.ts`) with PawTyk's mark, *Daily Puzzle*, the date, hearts left, the time, the streak, a
  decorative row of paws and sparkles, and "Can you solve today's puzzle?" (with the link when configured), plus the
  same in a few lines of text. Spoiler-free by construction: the card and text are made from five fields only (the
  date, hearts, max hearts, seconds, streak); anything else is refused (a test passes a board and expects an error).
  The pattern comes from the date alone: the same for everyone that day. Other boards still share a line of text.
- **An arrival keepsake**: after a newcomer's welcome celebration has played (never during it, never on the win sheet,
  so nothing sits beside the Welcome Pack offer), the row under the scene offers **Share <name>'s arrival**: photo mode
  framed on the newcomer, the card signed "<name> came home to the <home>", shared with "Meet my new PawTyk friend…
  Come build a cozy animal sanctuary with me." (and the link). The player still chooses the framing, the shape and
  whether to sign it. Homes with photo mode only (the Pet Garden has none yet).
- **Postcards** keep their native share and save; their share now carries a line of text (and the link when set).
  No account, no contacts, nothing about the player on the card or in the text.
- **The game link** (`config/links.ts`): `VITE_GAME_URL`, a public https page, optional. Refused: http, credentials,
  ports, localhost and private networks, `.local`/`.test`-style names, staging/preview/dev labels and tunnels (a real
  `.dev` domain is fine). Unset (as in this repo): shared without a link, and nothing is invented; no App Store link is
  guessed. Links carry only `?s=daily|arrival|postcard|result`, so the landing page's hosting logs can count visits
  from shares without identifying anyone. No deep link: the landing page is the fallback for every device.
  `release:check` refuses a non-public `VITE_GAME_URL` and reports the link in use. The site's home page gains a "Play
  PawTyk" section: the App Store link only when `VITE_APP_STORE_URL` is a real listing, else "coming to the App Store".
- **The share service** (`services/share.ts`): a picture can go with text and a link (the link given once); text can
  be shared on its own (`shareText`: the system sheet, else copied, else failed). Results are what the platform
  reports; the app never says a post was made (a finished share sheet gets no toast at all).
- **Photo Memory** (`meta/photoMemory.ts`): "Capture a memory this week": the week's first postcard earns 30 Paw
  Coins, for making it (saved, shared or kept private alike). Once per local Monday-to-Sunday week, by one coin-ledger
  entry named for the week (`photo-memory:<monday>`), so repeated taps, retried callbacks and reloads can't grant it
  twice. No streak, nothing lost by skipping a week, coins only. Shown in photo mode, on the postcard that earns it,
  and beside the weekly errand on Journey (nothing to claim).
- **Analytics** (opt-in as before): `share_opened`, `share_started`, `share_result` (the platform's report),
  `photo_memory_claimed`; never a recipient, contact or account.
- **Compliance**: no reward for posting, tagging, sharing a particular post, reviewing or rating; the only sharing-
  adjacent reward is for making a postcard, which needs no share. Before release: re-read App Store Review Guidelines
  (3.1, 3.2.2, 5.6.3) and the Facebook/Instagram promotion rules (summarised in `docs/referrals.md`, M4).
- Tests: `shareM3.dom.test` (spoiler-free card and text, the date-only pattern, link validation and none configured,
  browser, native and copy shares, cancels and failures, wording that never claims a post, one reward per week,
  week boundaries, reload, a skipped week, the photo mode reward once, the keepsake framing and caption, analytics
  off and no recipients, nothing opening by itself after a welcome).

### M4 — friend invites and referrals: review only (`growth/m4-friend-referrals`)

The plan asks for an architecture and compliance review first, with no production reward system until Sam approves
the backend, identity, attribution and fraud-control approach. So M4 is the review, `docs/referrals.md`, and nothing
else: no code, Cloud Function, rule, screen or reward. `featureFlags.friends` stays `false`.

What the review settles (each point is argued in the doc):
- **What earns:** the referrer is rewarded only when a friend has *played* the first five Journey levels. The server
  checks this by replaying their move logs with the leaderboard's own `checkSolve`.
- **What never earns:** installing, signing up, posting, sharing, tagging, reviews or ratings (App Store 3.2.2(x) and
  5.6.3; Meta's promotion rules).
- **Gating:** a referral never gates anything.
- **Attribution is honest:**
  - server-issued opaque codes;
  - Universal Links when the app is installed, and manual code entry otherwise;
  - no fingerprinting, deferred-link SDK or clipboard sniffing (Firebase Dynamic Links has been shut down since
    25 August 2025);
  - the app says "a friend used your code", never "installed from your link".
- **Fraud controls:**
  - App Check (App Attest) enforced;
  - Apple DeviceCheck bit 0 marks a device that has already redeemed a code (it survives reinstall);
  - caps, a new-player window, redeem rate limits and review flags.
- **Privacy:**
  - stores only uids, codes and timestamps;
  - the referrer sees counts only;
  - in-app deletion (5.1.1(v)) through the same path as the leaderboard's Leave.

Go-live blockers, all native or ops:
- a native App Check provider;
- a DeviceCheck plugin with its key in Secret Manager;
- Universal Links;
- emulator tests;
- a legal read of the terms sentence;
- a two-iPhone TestFlight run.

Open decisions D1–D6, with recommendations, are in `docs/referrals.md` §9. The most important is D1: the plan's
50 coins for the friend carries App Review risk, and the recommendation is to reward only the referrer.

### M5 — cosmetic collections and upgrades: design only (`growth/m5-cosmetics`)

`docs/cosmetics.md`. Nothing is built: the plan says M5 is designed and evaluated after M1–M4, with no large new
catalog until measured demand supports it.

The proposal:
- **Collections** grouped from existing decorations, tricks, foods and bowls. Each can be completed with Paw Coins
  alone, and the reward is a postcard frame or album title (no coins, no new faucet).
- **Personalising one animal** at no cost to the player: a signature trick, a favourite bowl and a portrait frame
  tint. Accessories are parked, since they would need new art for every species.
- **Three pilot upgrades**: Lily Fountain, Starry Campfire and Blossom Arch. Each is a second look bought with coins
  only, switchable on and off, and previewed with the M1 try-on.

Measurement gates G0–G2 use the existing opt-in events. Their thresholds are proposals for Sam.

Ruled out: loot boxes, timers, limited pieces, gem-only collections, power and new IAP products.

### M — integration and release checks (`monetization/m-integration`)

- **Browser checks** (`test/e2e/m.mjs`, run by `npm run e2e`):
  - **M1:** Featured for your Farm (1–4 picks, priced, none owned); a featured decoration tried on in the real scene
    and Back to it, with nothing changed; an unlearned trick played in the home, Again, Back, still unlearned.
  - **M2:** a token decoration's card offers a video, and the test video adds one token on the same card.
  - **M3:**
    - a solved Daily → Share opens the result card, never the board;
    - after a welcome, the keepsake sits under the scene, never on a win sheet, and opens photo mode framed on the
      newcomer;
    - the week's first postcard earns 30 coins once, and a second postcard and a reload earn nothing.
- **Constraint guards** (`test/unit/mIntegration.test.ts`):
  - the IAP product ids are unchanged, with no new products;
  - `featureFlags.friends` is off;
  - no interstitial, even in test builds.
- **Tester shortcuts** (QA builds): Video tokens to 0, Use up today's videos (a toggle), Forget this week's Photo
  Memory. The last is the one tester tool that takes a coin-ledger entry back out, and its coins go with it.
- **Found by the browser checks:** at 390 points wide, the arrival keepsake button pushed the row under the scene
  (chat, Watch the parade, Tricks) past the screen, and the page scrolled sideways. The keepsake now gets a line of
  its own, the row wraps instead, and `m.mjs` checks the button sits within the phone's width.
- **Not established by any of this:** an iPhone's share sheet (each app reports its own result), AdMob's real videos
  and their failures, Photos permission, and VoiceOver. The M sections of the release checklist cover them on
  TestFlight.

## 2026-11-11 · D49 — Attention, delight and retention: fewer choices, quicker rewards, a reason to come back

From the outside review Sam shared (*PawTyk — D48 UX, Engagement & Retention Review*, of `main` @ `02d593b`). Its
verdict: the features are well built and there is enough content; what PawTyk needs is a tighter run of small,
satisfying moments for someone with two or three minutes: immediate feedback, visible progress, one obvious next
action. It asked for five focused PRs (A–E), no new currencies, catalogs, referral rewards or tabs, and nothing that
pressures a player (no chores, missed-day penalties, artificial scarcity or guilt).

### PR A — attention first (`d49/a-attention`)
- **Featured, one large and two small** (`meta/featured.ts`, `screens/shop.ts`): at most three picks (was four), and
  what the player can buy *today* comes first (a stable sort on `afford`, else the order the picks are chosen in), so the
  large one is something they could have now. The trick and the food are named for the home's **newest** animal (the
  one the player most likely just met). Order of choosing: a decoration (the next piece of a set started, else the
  dearest affordable, else the nearest), a trick, a favorite food not in the pantry, then a special piece. **See all**
  in the section's head goes straight to the home's whole catalog (its first section, heading focused). At 390 pt the
  catalog now starts on the first screen; at 320 pt the large card and the first small one do.
- **One way to see a decoration** (`decorSheet`, `components/tryOn.ts`): the card no longer offers both *Show me* and
  *See it in your Farm*. A piece that can be tried on has **Try it in my <home>**: it stands out in the player's own
  scene and one of the home's animals uses it there at once (**Again** replays it). The card's own *Show me* stays only
  as the light fallback for a piece that can't be tried on now (owned, or waiting for the pond). **Buy is right there**:
  when the player has the price, the try-on banner has **Buy** (a trick: **Learn**), charged once by the Shop's own
  purchase ids (`buy:decor:<id>`, `buy:trick:<id>`); the piece stays out, theirs, the banner goes and the home is plain
  again (`router.settle`). Without the price the banner shows it as short, with no Buy.
- **An arrival ends with one card** (`components/welcomeCard.ts`, `meta/welcomeSnack.ts`): before, after a welcome
  the screen held the parade's Replay, Tricks, Share, the stage's news, a Next goal card with its own Play button and a
  toast, with the resident's line squeezed into a narrow column between buttons. Now, once the Welcome Parade has
  played, one card under the scene says **<Name> is home!** · *Your second friend at the Farm*, then:
  - **Give <Name> a welcome snack** (primary): played out in the scene at once (`SceneMeals.feed`), an ordinary meal
    (same daily limit, same hearts). Something from the pantry it can eat (favorites first, never a feast); with
    nothing in the pantry, **the first one is on the house**: one portion of its favorite, granted once per player by
    one item-ledger entry (`gift:welcome-snack`), so a double tap, a reload or the next arrival can never grant it twice.
  - **Continue to level N** (secondary). After the snack the card says *<Name> loved the Apple Slices!* and Continue
    is its one button. With nothing to give (no food, the gift had, or it ate its fill today) Continue leads and the
    second button is **Say hello to <Name>** (a heart once a day, as a tap does).
  - The next goal as one line (*Next: Buttercup the calf comes home in 2 more puzzles*) instead of a second card.
  - Replay, Share, Tricks and Photo stay by the scene. The row under the scene gives the resident's line a line of its
    own and lets the buttons wrap (the cramped text in the review's screenshot).
  - The starter gift (after the first board) now waits until the snack has been eaten, or the next visit, and no longer
    asks *Ready for the next puzzle?* afterwards: the card already has Continue.
- **The first arrival** (D41) ends the same way: **Give Cotton a welcome snack** (*Your first treat is on us*), then
  **Continue to level 2**. The snack opens the Farm with Cotton eating it at once (`route.snack`); the arrival has
  already shown her coming home, so her Welcome Parade is offered under the scene (*Watch Cotton's welcome*) instead of
  playing first. (*Visit the Farm*, with the parade first, remains only for a newcomer with no snack to give.)
- Analytics (opt-in, as always): `featured_tap` (kind, position), `featured_see_all`, `welcome_card` (shown, continue,
  hello), `welcome_snack` (gift or pantry, favorite, from the card or the arrival), `decor_bought` / `trick_bought`
  with `surface: 'try_on'`.
- Tests: `test/unit/d49Attention.dom.test.ts` (three picks, affordable first, named for the newest animal; one large
  and two small with See all; one way to see a piece; Buy and Learn from the banner, charged once; the free snack once,
  the pantry next, never a feast, none when full; the card without a snack; Meet → parade → snack → Continue, kept
  across a re-render, gone on a later visit). Updated: the D40/D41/D45/D46 arrival tests (the card instead of the goal
  card; the first arrival's snack), M1's Featured tests, and the browser checks (the first session's snack, M1's
  1–3 picks, D48's card).

### PR B — small rewards, said at once (`d49/b-micro-rewards`)
- **A placement pops** (`board.css`, `Board.flash`): the success ring on a correct tile pops out (from 72% to a hair
  over full size) and fades in 0.48 s (was a 0.72 s fade). Overlay only: the tile's `::before`; the animal never
  moves (D11).
- **A finished line ripples** (`Board.ripple`): instead of one 0.95 s wash, each tile of the finished row, column or
  color glows for 0.3 s, starting from the tile just placed and spreading outward 30 ms per tile of distance (the
  farthest starts by 150 ms), so the whole line is done in about 0.4 s. Two or three lines at once ripple together.
  Under reduced motion every tile glows at once. On one-animal boards the color's own glow (0.52 s, was 0.7 s) is
  skipped when the move finished the color as a line (the ripple says it).
- **What a win earned, beside the success** (`showWin`): the first view of every win (ordinary and milestone) shows
  **+35 Paw Coins** as a small pill that pops in under the stars or the hero; an errand finished by the solve says so
  (*Errand done: Solve any board. Claim it on Journey.*); a Daily adds a warm line about tomorrow's board (*Tomorrow's
  puzzle, a 6×6, arrives Thursday. See you then!*), with nothing to keep up. The fold's summary lists only what the
  fold alone holds (no coins there any more).
- **One puzzle away, it shows** (`components/eager.ts`): wherever the next arrival is pictured (the win sheet's line,
  the Journey's goal, a home's *Coming home* row, the World's card, the next goal), an animal one puzzle away beams
  instead of peeking shyly, with a soft pulsing halo and an **Almost home!** tag, and the line says *Truffle is one
  puzzle away!*. A face and a glow only; no halo pulse under reduced motion.
- **A new decoration arrives** (`components/decorReveal.ts`): no "purchase successful" toast. Bought on its card, the
  card stays open: *It's yours! It's out in the Meadow Farm, and your animals can't wait to try it.* with **See it in
  the Meadow Farm** as its one main button (and Done). The next time that home's scene is drawn with the piece out
  (straight away, or the next visit this session), it pops in with a ring of little stars and a soft chime, and a
  moment later one of the home's animals goes and uses it (the decoration's own activity: a swing, a splash, a chase);
  a piece with nothing to do gets a curious look from the nearest animal. Bought from the try-on banner (PR A), it
  arrives right there. Never over a welcome, a stage's dance or a try-on; once per purchase; under reduced motion the
  sparkles only. Nothing is decided by it: the purchase already happened.
- Tests: `test/unit/d49Rewards.dom.test.ts` (the ripple's order, timing and reduced-motion form, overlay-only CSS;
  eager portraits and the Farm's Almost home!; the bought card, See it, the arrival once, nothing on a second visit;
  reduced motion). Updated: the D40 first-view test (coins in view, not in the fold's summary).

### PR C — smart feeding and animal moments (`d49/c-feeding-moments`)
- **Smart feeding** (`meta/feeding.ts::mealStyle`, `components/feeding.ts`): D48's meal (camera close, bowl, three
  bites, the reaction: 3.6 s) is lovely once and slow the fifth time. It now plays **in full** when the meal means
  something: the animal's **first meal**, its **first taste of a favorite**, or a meal that **lifts the friendship a
  level**; otherwise it is **quick** (1.1 s: no camera move, the bowl, one bite, hearts, the friendship card), and the
  3D toy plays a matching 1.1 s `nibble` clip (`three/clips.ts`, at rest at both ends like every clip). Feeding three
  animals in a row now takes about 3 s, not 11. A **feast** is one short group scene (every guest quick, 90 ms apart).
  **Settings → Meals → Full** plays every meal in full. Under reduced motion a quick meal is still, 0.9 s.
  - What an animal has eaten is kept in the save (`sanctuary.tasted`: animal → foods, additive, ignored by older
    builds). A save from before D49 has no record, so each animal's next meal plays in full once.
  - **A new friendship level** in a meal: the animal beams in a ring of hearts as it reacts, and the card names the
    level (*Friend!*). The level's own news (the warmer hello, a beaming smile, the album portrait) follows as before.
- **Animal moments** (`meta/moments.ts`, `components/animalMoments.ts`): eight curated moments, each an existing trick
  or emote (no new animation system): *spots a butterfly* (Head Tilt), *sneezed in the flowers* (Little Sneeze), *dozed
  off* (Sleepy), *two friends say hello to each other* (Wave, answered with Love), *a big stretch*, *a happy wiggle*,
  *chased its own tail*, *peekaboo in the grass*. A temperament that suits it does it when one is home (a sleepy one
  dozes, a shy one plays peekaboo); a fish, frog or crab sits them out.
  - **Occasional, never constant**: the first after the scene has been calm for 14 s, then one every 32–52 s, at most
    four a visit. Only while nothing else is going on (no parade, tour, close-up, walk, meal, photo, try-on, open
    sheet or trick tray), the app showing and motion allowed; otherwise it waits and looks again 5 s later.
  - **The scene director's `moment`**: it never claims the camera or holds ambient life; anything the player starts
    ends it at once (`startTrick` gives tricks a handle, and a trick ending clears only what it put there, so it can
    never wipe a parade's dance off a figure it shared).
  - **A small discovery, nothing more**: the line under the scene says what happened (*Truffle is watching a
    butterfly.*), with **New** the first time the player sees that moment (`sanctuary.moments`: moment → the date first
    seen). Moments the player hasn't seen come first, so the first visits show different ones. Nothing is granted, and
    nothing about them is a chore.
- Tester shortcuts: **Show an animal moment** (opens the Farm; one comes after 2.5 s), **Forget first meals**.
- Analytics (opt-in): `meal_played` (full or quick, feast), `animal_moment` (which, first time or not).
- Tests: `test/unit/d49Feeding.dom.test.ts` (which meals are full; tastes kept and normalized; a quick meal's timing,
  no camera, the nibble clip, reduced motion; a level-up's reaction and card; first, repeat and new-favorite meals on
  the Farm; Meals → Full; the moments catalog, unseen first, temperaments, pairs, no repeats; first-seen noted once;
  the schedule, the cap, waiting while busy, hidden or reduced, ended by any claim with its line restored; a trick never
  clearing another's). Updated: the market feeding test (the result carries the new flags).

### PR D — a focused return (`d49/d-today`)
- **One goal, at most two things** (`meta/today.ts`, `screens/journey.ts`): the hero now reads **Today at your Farm**
  (who is on the way, the bar, Level N and its one big Play or Resume, unchanged and still above the fold at
  320×568). Under it, **Also today** shows at most two optional things, picked from what the save already holds:
  a Daily or Zen board left in progress (the player's own work first); today's **Daily Puzzle** if it isn't solved; an
  animal one or two hearts from what friendship brings next that hasn't had today's hello (*Cotton has a warmer hello
  to share · One heart away: say hello in the Farm*); news in another home (*Something new at the Outback*). Nothing
  else competes: the Daily with its week strip, the Zen Garden and the errands are in **More to play**, a fold closed
  by default whose summary says what it holds (*Daily solved · Zen Garden · Errands 2 of 3*) and that stays open for
  the session once opened. A solved Daily says so there with a warm word about tomorrow (*Tomorrow's: a 7×7,
  Thursday.*).
- **No pressure**: nothing says "missed", nothing counts down or expires, no streak warning, no notification. An
  empty Also today is simply absent. Hearts still never decay (D40), so a friend nudge is an invitation, not a debt.
- **Errands pay the moment they're done** (`meta/missions.ts::autoClaimMissions`, `app/events.ts`): evaluated as the
  review asked, and adopted: a finished errand (today's or the week's) is claimed at once through the very same
  once-only ledger ids as the Claim button (`mission:<key>`, `…:treat`, `…:hint`), so it can't be credited twice
  whichever path runs; `MetaNews.claimed` says what each gave. The win sheet's line becomes *Errand done: Solve any
  board · +20 Paw Coins* (D49 PR B had *Claim it on Journey*), and a Pet Garden visit that finishes *Visit the
  sanctuary* says so in a toast. The Claim button stays for an errand finished before this build. (Visits to the Farm
  and the regions still don't count for that errand, as before: a try-on there must change nothing.)
- Analytics (opt-in): `today_tap` (which kind), `mission_claimed` now with `auto: true`.
- Tests: `test/unit/d49Today.dom.test.ts` (the order and the cap, a friend only when close and not greeted, nothing
  when there's nothing; the hub's order, rows, wording with no pressure, the fold closed with its summary, a solved
  Daily with tomorrow, the fold remembered; auto-claim once by the same ids as Claim; a solve reports what it paid).
  Updated: the Journey hub test (*Today at your Farm*).

### PR E — validation and measurement (`d49/e-validation`)
- **Browser checks** (`test/e2e/d49.mjs`, run by `npm run e2e`), mostly on a 320×568 phone:
  - a returning player's Journey: *Today at your Farm*, Play above the fold, at most two rows under it, the rest
    folded, nothing scrolling sideways; the friend nudge opens the Farm and goes once Cotton has had her hello;
  - Featured as one large and two small, See all landing on the catalog;
  - Try it in my Farm → Buy on the banner: charged once (tapped twice), out for good, sparkles in, an animal uses it;
  - after a welcome, one card in the phone's width with the resident's line on its own line; the snack plays, then
    Continue alone;
  - an ordinary repeat meal in a real browser takes about a second, and the toy nibbles;
  - an animal moment comes by itself (New the first time) and the Tour takes over at once, nobody left mid-trick;
  - a win at 320×568: the coins beside the success, its errand already paid, Play next on screen without scrolling;
  - quick back-and-forth between Journey, the Farm and the Shop leaves the scene at rest.
- **Measurement** (opt-in, `docs/analytics.md` → D49): `win_next_action` (how long after a win, or the first
  arrival, the player chose what's next) and `first_meal` (once, with the home visits it took: `usage.homeVisits`, an
  additive count). With PR A–D's events, the review's pilot measures are listed there with their proposed targets and
  the caveat that opt-in players are not a fair sample: pair them with observed TestFlight sessions.
- **TestFlight scenarios** (`docs/release-checklist.md` → D49): the first session observed, attention, micro-rewards,
  feeding and animal life (incl. five minutes with the frame-rate counter), the focused return, VoiceOver on the
  welcome card.
- **Found and fixed by the checks**:
  - PR C: animal moments draw emote bubbles in 3D by themselves, and three.js's one shared sprite geometry kept every
    scene renderer that ever drew one alive (D46's renderer check: 7 left after 7 walks). `three/release.ts` now
    disposes it with each renderer, as D46 did for the shared lookup texture. (A tray trick before a walk would have
    done the same; it just never happened in the checks.) D46's browser checks switch moments off
    (`setMomentsEnabled`), since they need the scene exactly at rest for minutes.
  - PR B: a bought decoration's card stays open now, so the old purchase check (which tapped the Shop's card under
    it) was updated; the win's coin pill had no space between the amount and *Paw Coins* for screen readers.
  - PR A: Cotton's welcome snack is a meal, so the old *feeding adds two hearts* check counts from after it.
  - The try-on banner's Back is quiet when Buy is there, so Buy is the one strong button.
  - PR D: an in-progress Daily is resumed from its row under the hero (the Daily card itself is folded into *More to
    play*), so the old smoke check that tapped the card now taps the row. The D44 regression page switches animal
    moments off too, so a moment starting by itself is never counted as a figure left mid-trick.
- **Found and fixed in code review** (Codex on the PRs):
  - PR A: the first arrival's automatic welcome snack is a *pending* scene moment. A Photo, the Tour, the Walk or a
    trick the player starts during its lead-in keeps going, and the welcome card offers the snack instead.
  - PR B: a bought decoration's arrival stays waiting until it actually plays (a piece not drawn yet, like the Duck Pond
    Fountain before the pond, a busy scene, or a visit left early, keeps it for the next eligible visit).
  - PR C: the player's trick or meal ends an animal moment *before* checking whether the animal is free
    (`director.end('moment')`; the tray's `beforePlay`), so the player's pick plays instead of being turned away.
  - PR E: the home-visit count is saved with the visit itself, and a feast as the first meal records `first_meal`.
- **Before and after** (`docs/screenshots/d49/`, against `docs/screenshots/m/`): Featured (`a1`, was `m1-featured`), a
  decoration's card (`a2`, was `m1-decor-card`), the try-on banner with Buy (`a3`), the welcome card before and after
  the snack (`a4`, `a5`, was `m3-keepsake`), a win at 320 (`b1`), a quick meal and an animal moment (`c1`, `c2`), the
  returning player's Journey at 320 and 390 (`d1`, `d2`).
- **Not established here**: real iPhones (haptics, the ripple's feel, speaker sound, 3D frame rate during moments and
  quick meals, VoiceOver), and real players: none of the pilot targets has been measured. The review recommends a
  real-player beta before more development; the checklist and the events are ready for it.

## 2026-11-11 · D50 — Reward clarity, short-visit delight, a focused return; D51 audit and economy model

From *PawTyk — Revised D50/D51 Implementation Plan* (shared by Sam): optimise for a player with two or three minutes.
Four D50 PRs, and D51 as a validation sprint: the board-ergonomics audit (no control changes until real players show a
problem) and a documented economy model (no economy changes until real data). D51-C (a cosmetic pilot) is not built:
the plan holds it for after launch. Nothing here adds a currency, a chore, a claim button, a notification or a tab.
Bundle id, product ids, save keys and the puzzle generator are unchanged. Sam asked for the stack to be merged and a
tester page built (the plan itself says not to merge silently; his explicit request was followed).

### PR A — reward clarity and arrival focus (`d50/a-rewards-arrival`)
- **One coin headline per win** (`meta/winCoins.ts`, `screens/game.ts`): the first view says *+N Paw Coins* once,
  where N is exactly what the wallet went up by. A small line says where it came from when there was more than one
  source: *45 for the puzzle · 45 from 2 errands · 40 from 2 badges · 150 for finishing the Farm*. Before, the pill
  said +45 and the errand line said +45 again, and the player had to add them up (or wonder if it was the same 45).
  The errand line now names the errand and anything else it gave (a life, a hint), with no coin figure
  (`claimedLine(…, { coins: false })`). The fold no longer repeats the errands. Its coin row says *For the puzzle*.
  A finished home's coins are in the headline, not in the hero or the growth line. The first arrival's summary uses
  the same total. Nothing is credited here: every part was already paid once, by its own ledger id.
- **The welcome card in focus** (`components/welcomeCard.ts`, `styles/d50.css`): while the card offers the snack, the
  scene's other controls step back. That means the parade's replay, Share, Tricks, Tour, Walk, Photo, the new stage's
  line and the progress card's own Play (`.is-welcoming` on the screen). They come back when the snack has been eaten,
  a hello is said, an animal is tapped in the scene, or the player taps **Look around first** (a quiet link on the
  card). A welcome the player set aside for something of their own (parade offered instead, D46) never takes the focus.
  Nor does a card with nothing to give (Continue and a hello).
- **Guarded while the snack is eaten**: the card's buttons are `disabled`, not only dimmed. D49 used
  `pointer-events: none`, which a keyboard, Switch Control or VoiceOver could still press. A status line says
  *<Name> is having the snack…*, and focus waits on it, then moves to Continue. The progress card's Play is ignored
  until the meal ends too. However the meal ends (eaten, stopped by something the player started, a redraw), the card
  moves on to Continue. It can't get stuck, and a snack can't be given twice.
- Tests: `test/unit/d50Rewards.dom.test.ts` (the pure total and its line; a first clear with errands where the
  headline equals the wallet's rise, with *Paw Coins* said once and the fold not repeating; a win that finishes a home;
  the focus rules; disabled buttons and dispatched clicks that change nothing; a meal cut short still reaches
  Continue; no focus with nothing to give; leaving clears the class). D46's acceptance matrix and M3's keepsake browser
  checks tap *Look around first* first.

### PR B — short-session delight (`d50/b-farm-delight`)
- **A hello at the start of a calm visit** (`meta/greeting.ts`, `components/animalMoments.ts`): about two seconds into
  a visit where nothing else is happening, one animal comes over in its temperament's way (a playful wiggle, a shy
  peekaboo, a gentle heart, a bouncy high five…). It comes for a reason its line says:
  - a friendship one hello away (*Truffle is hoping you'll say hello.*, and a tap is that hello);
  - a newcomer from the last day (*… is still settling in, and says hi.*);
  - a win a moment ago (*… heard you solved a puzzle!*);
  - the evening;
  - or just its own hello.
  
  The animals take turns (never the same one twice running). It never plays over a welcome, an owed welcome, a new
  stage's dance, a meal, the tour, a walk, a photo, a try-on or a sheet, and it is given up if the first six seconds
  stay busy. A home says it at most once in three minutes, in memory only, so going Farm → Shop → Farm doesn't repeat
  it. Under Reduce Motion it is a still emote with its line. Anything the player starts ends it, because it is the
  director's `moment`. It plays the animal's hello sound with no haptic, since the player didn't touch anything.
  Nothing is granted or saved, and D49's moments stay occasional discoveries. A D49 moment never starts while the
  hello plays (one animal at a time), and the hello's line has its own class, so it isn't counted as a moment.
- **Three turns of an ordinary win** (`meta/winFlavor.ts`, `audio/scores.ts`): ordinary wins rotate Tiny Triumph and
  two turns of it, *A Little Skip* and *Bright Landing*. They share the motif, the length and the band, and only where
  the melody lands changes. The win animal's face rotates too: proud, happy, beaming. It is never the same twice
  running (by boards solved). A milestone keeps the original, because its spotlight answers Tiny Triumph, and the big
  moments stay big by contrast. The phone-speaker check holds the new turns within the signature cues' 2.5 dB.
- Tester shortcut: **Say hello again**. Analytics (opt-in): `animal_greeting` (`reason`, `home`).
- Tests: `test/unit/d50Delight.dom.test.ts` (who and why, turns, tricks; in a home: timing and line, the cooldown,
  never over a welcome, an owed welcome or a sheet, ended by the tour, still under Reduce Motion, the friend one hello
  away comes first; one animal at a time; the flavors rotate, a milestone keeps the original, the scores' family; two
  ordinary wins in a row differ in face and cue). D49's rapid-navigation check lets a playing hello finish before it
  counts tricks left behind.

### PR C — a focused return and relevant shopping (`d50/c-return-shop`)
- **The Daily said once** (`screens/journey.ts`): when today's Daily (or today's Daily in progress) is a row in *Also
  today*, *More to play* keeps only the week, on a small card with *Today's is in Also today, above*. Its summary
  says *This week* instead of *Daily*. Yesterday's unfinished Daily is a different board, so today's keeps its card in
  the fold.
- **Friendship copy that says what the next thing does** (`meta/today.ts`, `components/feedPanel.ts`): the Today row
  is *Say hello to Truffle · One hello at the Farm and you're friends: a warmer hello.* (or *A hello … and a pat on
  Truffle's card …*). It appears only when today can get there: a hello is one heart and a pat another, each once a
  day, so a friend two hearts away who was already patted today isn't promised. The friend card adds *A hello or a pat
  today gets you there.* when that's true.
- **Featured by what it would do here** (`meta/featured.ts`): affordable first, as D49 had it. Then, within the
  decorations:
  - a piece the player tried on and didn't buy (*You tried it on in your Farm*);
  - then the next piece of a started set;
  - then a piece the animals use (*Truffle and Cotton will play with it*, from the UI's activities);
  - then price.
  
  A trick tried on and not learned comes back the same way. Gem and video-token things (special pieces, tricks,
  foods) are featured only when the player has enough now, so a pick is never something they can't get today.
  Deterministic, and every pick's line says why.
- **The one bit of browsing kept** (`offers.tried`, `services/storage.ts`): the last six items tried on (`decor:<id>`,
  `trick:<id>`), newest first, normalized on load. Older saves load as before, and nothing else about browsing is kept.
- Tests: `test/unit/d50Return.dom.test.ts` (the Daily once, also in progress and when solved; the friend promise and
  its words; the card's line; Featured's order and reasons, never an unaffordable gem or token thing, a tried trick, the
  tries capped and normalized; in the Shop, Try it then back leads with it). D49's Today test moved to the new words.

### PR D — validation and release; D51-A and D51-B (`d50/d-validation`)
- **Browser checks** (`test/e2e/d50.mjs`, in `npm run e2e`), at 320×568 and 390×844:
  - the coin headline equals the wallet's rise, said once, with Play on screen;
  - two ordinary wins smile differently;
  - the welcome card's focus and Look around first;
  - the snack from the keyboard: Enter starts it, the buttons are disabled and hold focus, more keys and clicks change
    nothing, then Enter on Continue goes on;
  - a calm visit's hello, and not again straight after;
  - the Journey's single Daily and the friend row;
  - Featured after a try and a reload;
  - a save from before D50 reloading unchanged.
- **Release checks** (`test/unit/d50Validation.test.ts`): a pre-D50 save gains no record; `offers.tried` round-trips;
  product ids, the bundle id and no interstitials are as they were.
- **D51-A, board ergonomics** (`docs/board-ergonomics.md`): audited, nothing rebuilt. Drag-to-mark, drag haptics,
  three hint tiers, region patterns, large boards, the level-21 lesson and the two-step scheme all exist. The doc
  sets out a five-player small-iPhone test, with each task's threshold for a change, and how to evaluate an
  animal-first scheme without changing the default. No Buddy Training levels.
- **D51-B, the economy model** (`src/meta/economyModel.ts`, `npm run economy:model`, `docs/economy-model.md`): reads
  the real numbers (economy config, catalogs, errand pool, pantry rules, homes' completion coins). It runs
  conservative, base and higher-engagement play patterns, each field naming the opt-in event that will replace it. It
  finds that:
  - the first Farm piece the animals use is within a day's play;
  - everything for coins is weeks (conservative) to days (engaged);
  - lives and hints are earned well faster than used, so once the pantry is full (in 1–20 days) the surplus arrives
    as 16–100 more coins a day;
  - food is about 5–6% of earnings.
  
  It changes nothing, and it records what the plan rules out: cutting free lives, paid streaks, a VIP pass, renaming
  ids, demand-only gem sinks.
- **D51-C** (cosmetic pilot): not built, by the plan. It waits for D51-B with real data.
- **Found and fixed by the checks**:
  - PR A: Tab and Enter while the snack was eaten reached the progress card's Play. Play now waits too. The redraw
    used to drop focus to the page, so focus now waits on the status line.
  - PR A: D49's win check expected a coin figure in the errand line; it now expects the errand named without one.
  - PR B: a D49 moment could start while the hello played, and its handle replaced the hello's, so the hello could
    no longer be ended by the director. It's one animal at a time now.
  - PR B: the hello's line was marked as a moment, and D49's moment check read it as one. It has its own class now.
  - PR B: a hello could play in front of a tester's requested moment, or over a welcome still owed. Neither happens
    now.
  - PR B: a hello could follow a new stage's group dance that was skipped early (D44's dance check). A new stage is
    now its visit's hello. The unit test fails without the fix.
  - PR B: D44's hand-started dance check (outside the scene director) counted the visit's own hello, which began as
    the dance stopped, as a toy left dancing. The check turns moments off around itself.
  - PR C: without the Daily card, the week strip (positioned inside that card's padding) overlapped the new line. The
    week now sits on a small card of its own.
- **Found and fixed in code review** (Codex on the PRs; each thread has a reply):
  - PR B (#74): the hello's turns counted through a list whose order shifted with each pick, so one of three animals
    never said hello. Turns now step round the whole cast.
  - PR C (#75): a tried-on trick the player couldn't afford yet pushed out an affordable one. It's affordable first
    now, then the tried-on one to work toward.
  - PR D (#76): the economy model left out the pantry's overflow (10 coins for each life or hint over the cap). It now
    reports when each fills, the coins a day once full, and saves up at the faster rate from then on.
- **Follow-up (#77)**, found while checking the tester page and in a local browser run:
  - *Say hello again* showed nothing after *Finish every open home*, because the first visit is the newcomers'. It
    now counts the Farm's news as seen first, and says so when nobody is home.
  - A tap on the barn in the first two seconds could have the hello's line land on top of the barn's own. Any tap on
    a home's screen now means the visit's hello stays away (`skipGreeting`). Tests fail without the fix.
  - A decoration tapped while the hello played found its only animal busy, so nobody rode the tractor (CI's smoke
    check). The tap now ends an animal's own moment first, as tricks and meals already did (D49). The test fails
    without the fix.
  - D47's postcard check, run on `main` after the merge, found a D49 animal moment starting just after *Done*. A
    postcard session can outlast the first moment's wait, and the moment starts when the camera is free. D47's checks
    now turn the scene's own moments off, as D46's do, since they need the Farm exactly at rest.
- **Local browser runs**: a dev server that hot-reloads an edited module serves it under a new URL, and a check that
  imports the module by its plain path then gets a second copy. `setMomentsEnabled(false)` and `requestMomentSoon`
  were landing on that copy, which made D46, D44 and D49 checks fail locally and only locally. Restart the dev server
  after editing before running `npm run e2e` (CI always starts fresh).
- Before and after: `docs/screenshots/d50/`, captured from `main` (`66df26f`) and the D50 stack: the win at 320, the
  welcome card at 390, Journey's *Also today* and fold at 320, Featured at 390, and the hello at 390.
- Not established here: real iPhones (haptics, speaker sound, VoiceOver, 3D frame rate, Reduce Motion), and real
  players. The TestFlight gate is in `docs/release-checklist.md` → D50.

## 2026-11-11 · D52 — Player clarity, the world ahead, animal questions, respectful videos

From *PawTyk D52 — Player Clarity, Future-World Preview, Animal Trivia and Respectful Monetization* (shared by Sam),
written against `main` @ `219a3de`. Principles: the player always knows who comes home next and how close; playing
another puzzle stays easier than a shop, a video or a question; ads and questions are optional; saves, animal ids,
world generation, purchase ids and earned rewards stay compatible; nothing is rebuilt that D50 already has (the
endless world, D51-A's audit, D51-B's economy model). Interstitials stay off (`INTERSTITIALS_ENABLED = false`), and
there is no custom overlay over a native ad. Sam asked for the stack to be merged and a tester page built.

### PR A — one sentence for who comes home next (`d52/a-progress-copy`)
- **The win's countdown, in one sentence** (`components/comesHome.ts`, `screens/game.ts`). Before, an ordinary win
  said *One puzzle closer to Hazel!* and then *Hazel the pony: 7 → 6 puzzles away*: two countdowns, and an arrow to
  subtract. Now it says one thing:
  - *Hazel the pony comes home in 6 more puzzles.* The first time an animal is presented (the first solve toward it,
    or the win after the one before it came home), with its kind.
  - *Hazel comes home in 4 more puzzles.* After that, by name.
  - *One more puzzle and Hazel is home!* When the next puzzle brings it (its portrait still beams, D49).
  - *Hazel is home!* Its arrival is the arrival's own moment (spotlight, hero, Meet), never "0 puzzles".
  - A replay, which grows nothing: *Hazel comes home in 4 more new puzzles.*, with no +1, beside the replay's existing
    explanation.
  - A home with no animal left but a stage to reach: *3 more puzzles until the next stage: Duck pond.*
  The count is `arrivalProgress(…).left`; the progression is unchanged. The bar still slides from before to after
  (D38), so the step is shown, not said. The bar is `aria-hidden`: a screen reader reads the sentence once.
- **One verb everywhere: comes home.** The Journey's goal (*joins in 5 puzzles* → *comes home in 5 more puzzles*),
  the World's focus card (*arrives in*) and status lines, the first arrival's goal (*3 more puzzles, and Truffle moves
  in* → *Truffle comes home in 3 more puzzles.*), the album's next-arrival card, and *Up next at the Pet Garden: one
  more puzzle and Juniper is home!* on a win in a finished home. The Journey's stage line uses the stage sentence.
- **Which puzzles grow a home, said once**: under the first ordinary win that grows a home, a small note: *New
  Journey, Daily and Zen puzzles grow your homes. Replays and Paw Cup don't.* (`onboarding.growthNoteSeen`, new,
  optional; a save without it loads as unseen.)
- Tests: `test/unit/d52Progress.dom.test.ts` (the sentence at 6, 4, 1 and replay; Hazel counted down on real wins
  6 → 4 → 1 → home with no arrows and no "closer"; the bar hidden from screen readers; a replay with no +1 and *new*
  puzzles; the stage countdown; the note once; the Journey and the World; an older save). The D38–D40 win tests and
  the smoke check were updated to the new words.

### PR B — the world continues, and safe previews of places ahead (`d52/b-world-ahead`)
- **The first six homes are not the end, said on the World** (`screens/world.ts`, `worldAheadLine`). The code already
  had six hand-made homes and up to 9,999 generated places across fifteen landscapes (D39); the World didn't say so.
  Under *Homes* there is now one line:
  - before the six are open: *Your first six homes are just the beginning. More places are waiting to be
    discovered.*
  - once the sixth is open: *A new place opens after level 80 — or sooner if you finish your current homes.*
  - in the endless world: *The next new place opens after level N — …*, with N from `nextToOpen` (the real rule).
  The count beside *Homes* says *2 open*, no longer *2 of 6 open*, which read as a total. Gemini's mastery tiers were
  not built: they would duplicate the endless world.
- **Settings → Tester shortcuts → Browse future places** (`components/placeBrowser.ts`, `meta/placePreview.ts`; tester
  builds only, `featureFlags.qaTools`). A place number (1–9,999) with Previous and Next, and quick examples 1, 2, 12,
  40, 100 and 9,999. It shows the place's name, landscape and where it is, its blurb, when it opens (and whether it is
  open in this save), its residents (name, coat and kind, when each comes home, where the kind lives, its fact), and
  its five growth stages, each drawn with the game's own scene art and who is home by then. One place at a time, from
  `placeDef(k)`; nothing is renamed or regenerated (`PLACES_VERSION` and the place fixtures are unchanged). Browsing
  never touches `app.save`, never persists, grants, unlocks or buys. 2D only: the 3D toys would need a renderer per
  stage, so the preview stays on the drawn scene, which every place has.
- **Visit in a sandbox** (`app/qaSandbox.ts`): from the browser (outside a board), *Empty*, *Partly grown* or
  *Complete* opens the place for real on a temporary copy of the save, in which it is open and being built. While the
  sandbox is in front, `app.holdWrites` stops every write to storage (`persist` and `saveActive` still notify), and a
  banner says *Sandbox preview · Place 12, … · nothing here is saved* with *Leave preview*. Leaving the home in any way
  (the banner, Back, a tab; a board started there lands on the World) ends the preview through a router guard, and the
  player's own save comes back: the same object, checked against the snapshot taken on the way in, and restored from
  the snapshot if anything had reached it. A reload ends it too (nothing was written). Erase progress and the other
  tester shortcuts wait until the preview is left. No `skipToLevel` loop: the copy's level is set once, and only the
  previewed place's arrivals are recorded, so place 9,999 opens as fast as place 1.
- **Not in the App Store build**: `release:bundle` now also fails on *Browse future places* or the sandbox banner.
- **Found in code review (Codex, #79)**, both fixed with a test that fails without the fix:
  - From Journey → Settings → Browse future places, entering a sandbox disposed Settings, whose close redraws the
    Journey; that redraw went through the new router guard and ended the preview at once, so the place opened on the
    real save with no banner and writes on. Settings now closes before the preview starts (`beforeSandbox`), and a
    redraw while the way in is being drawn passes the guard.
  - A preview of a place the player already has residents in kept them all (residents come from the inventory, not
    the growth count), so *Empty* showed a full home. The copy now clears the place's residents before adding the ones
    the chosen state has.
- Tests: `test/unit/d52World.dom.test.ts` (the World's line before, at and after the sixth home, and the count;
  places 1, 12, 100 and 9,999 inspected; the sheet's controls, one place drawn, the save and storage unchanged;
  stage previews; no sandbox in a board; the sandbox copy for 9,999, 12 and 100 without touching the real save;
  enter → change things → leave, with nothing stored and the same object back; a board started there; a touched save
  restored from its snapshot; a release build with neither; `PLACES_VERSION`).

### PR C — Animal question, optional delight (`d52/c-animal-question`)
- **A card, never in the way** (`components/triviaCard.ts`, `meta/trivia.ts`). *Animal question · A quick question
  about the animals. Just for fun.* is offered in the album and on the Farm (under *Animals*, once someone is home, not
  during a try-on). It opens a sheet with one question, three lettered choices, then the answer:
  - right: *That's right!* and the fact; the friend smiles and a small sparkle passes (none under Reduce Motion);
  - wrong: *Good guess!* and the same fact; the right choice is marked, the guess shown with a dashed edge (no red);
  - then *Another question* and *Back to my Farm* (or *Back to the album*).
  No coins, hearts, streaks, retries or penalties. It is never between a win and the next puzzle, never on the win
  sheet, never over an ad, and it does nothing to boards or their loading.
- **Twenty questions, checked** (`docs/trivia.md` lists a source for each): Cotton's, Truffle's, Buttercup's, Pepper's,
  Marigold's and Hazel's kinds on the Farm, Juniper's in the Pet Garden, the Outback's, the Savanna's, the Arctic's and
  the Rainforest's friends, and the fennec fox from the desert places (the plan's own example, asked by the first fennec
  out in the world). Each is about a species already in the game. Where the game's own fact was looser than its source,
  the question follows the source (a harp seal pup's *baby coat* is white; it can be yellow-stained at birth).
- **The rotation** asks about friends who are home first (and the wider world's fennec), never repeats the question just
  asked, and keeps its place in the save (`save.trivia`, new and optional), so the next visit goes on from there.
- **Measured, opt-in**: `trivia_question` (which, from where) and `trivia_answer` (which, right or not)
  (`docs/analytics.md` → D52).
- Not built: a trivia link on the Daily results (the plan says to consider it after the pilot), and any reward.
- **Found in code review (Codex, #80)**: *Another question* carried a `hidden` attribute that the block button's own
  `display: flex` overrode, so it showed (and skipped the question) before an answer. It is now added only once the
  question is answered; the test checks it isn't in the sheet before then.
- Tests: `test/unit/d52Trivia.dom.test.ts` (twenty questions on species in the game, three distinct choices, answers in
  every position, a face for each; the fennec example word for word; the rotation with friends at home, no repeats, kept
  across a save round trip; a right answer with its sparkle and nothing paid or taken; a wrong one with *Good guess!*
  and the answer marked; Another question; Reduce Motion; the screen-reader labels and live region; the two events; the
  album's and the Farm's entry points).

### PR D — reward videos, said honestly; no forced ads (`d52/d-videos`)
- **Interstitials stay off** (`INTERSTITIALS_ENABLED = false`) and nothing new is shown between boards. There is no
  PawTyk overlay, timer, countdown or question over a video: the ad network draws a video and its own close, and the
  app can't promise a five-second skip. The plan's "future experiment" rules for skippable interstitials are recorded in
  `docs/release-checklist.md` → D52, not built.
- **An offer says what it earns before anything starts** (`components/videoOffer.ts`):
  - out of hints: *Need one more hint? Watch an optional video to earn +1 hint.* with **Watch video** and **Keep
    thinking**;
  - hearts: *Need one more heart? Watch an optional video to earn +1 heart.* with **Watch video** and **Back to the
    board**;
  - the loss sheet: *Watch an optional video: +1 heart*; an item's card: *Watch an optional video: +1 token*; the
    Shop's earn card: *Watch an optional video to earn +1 video token.* and **Watch video**.
  Each Watch button's accessible name repeats the reward. A video starts only on that tap (unchanged).
- **The real reason when a video earns nothing** (`services/ads.ts` → `RewardedOutcome`, `app/rewarded.ts`). The AdMob
  service now says how a video ended: earned; closed before its end; no fill (code 3); no connection (code 2); the
  privacy question unanswered (`canRequestAds` false after the consent form, asked again next time); or another
  failure. A real network with no connection is caught before trying. The player hears one plain line each time
  (*The video ended early, so there's no hint this time. Nothing was used.*, *Videos need an internet connection…*),
  nothing is used, and the board goes on. Grants are unchanged: only on the network's reward, once per video by its
  ledger id, within the daily cap of 10.
- **A video that never reports back** (a lost close after backgrounding, say) is given up after 3 minutes
  (`VIDEO_WATCHDOG_MS`), so a video can never block play or the next video. Giving up removes its listeners
  (`abandonRewarded`) and ignores anything it reports later.
- **The test video has a visible close** (*Close (no reward)*), so testers can try the "closed early" path; waiting it
  out earns the reward as before.
- **Report a video** (Settings → Your data, whenever videos are part of the build): *Not right for children*, *Scary or
  upsetting*, *Rude or offensive*, *Misleading* or *Something else*, then **Email the report** (to the contact address)
  or **Copy the report** when there is none yet. The report says what was wrong, when the last video played and what it
  was for, and the app version; nothing about the player. App Store guideline 2.5.18 asks apps with ads for this.
  *Ad privacy choices* (Google's privacy options form) stays beside it for real videos.
- **Purchases**: unchanged. Gems and the Welcome Rescue Pack show only when a store is configured (D43, D47), and the
  pack stays off in release until `VITE_WELCOME_PACK=1`. Their sandbox checks are part of the D52 TestFlight gate.
  Free hints and lives are not reduced (D51-B's economy model advises against it).
- **Found in code review (Codex, #81)**, fixed with tests that fail without the fix (`test/unit/d52AdMob.test.ts`, a
  stand-in plugin):
  - P1: the watchdog freed the button but left the timed-out video's reward listener in place, so the next video's
    one reward event paid both (a hint and a heart). Each video's listeners now live for that video only, and giving
    up on one removes them and ignores its late reports.
  - P2: a video that failed to present (after loading) was reported as closed early. Reading the plugin showed more:
    on iOS its show call settles only when the reward is earned, never on an early close or a failure to present. The
    service now ends a video from the plugin's events: the reward, the dismissal (*closed* only without the reward)
    and a failure to show (a failure, or no fill / no connection from its code); a rejected show call is a failure.
    Before this, an early close on iOS would have kept *showing* set until the watchdog.
- Tests: `test/unit/d52Videos.dom.test.ts` (SDK codes to outcomes; each message; interstitials off; closed early, no
  fill and a thrown failure earn nothing and keep the day's count; offline before trying; the watchdog, with a late
  report ignored; the test video's close; the out-of-hints offer and that nothing starts before the tap; a video
  closed early on a board with the board playing on; Report a video from Settings, its text and the copy fallback). The
  M2 token test now expects the plain reason.

### PR E — the public-launch gate, browser checks, pictures (`d52/e-gate`)
- **The TestFlight gate** (`docs/release-checklist.md` → D52): builds and an upgrade over a D50 save; five first-time
  players; the Hazel countdown and its five-person question; the World's lines; the place browser and sandbox in a
  tester build and their absence in the App Store build; the Animal question with VoiceOver and Reduce Motion; every
  video path on a phone (closed early, airplane mode, backgrounding, consent and tracking denied, the daily limit,
  Report a video); StoreKit sandbox for every product the build sells, older *Remove ads* honoured; sound, haptics,
  small screens, 3D, postcards and the Photos text; privacy answers, URLs, metadata and naming. It also records the
  rules for any future skippable-interstitial test (not built).
- **Browser checks** (`test/e2e/d52.mjs`, in `npm run e2e`; 7 checks): Hazel counted 6 → 4 → 1 in one sentence that
  fits 320 points with a silent bar and no arrow, and the once-only growth note; the World's line before and after the
  sixth home; Browse future places to 9,999 and place 12 at stage 3 with the save and storage untouched, also across a
  reload; a sandbox visit that writes nothing and gives the own save back; an Animal question from the album that
  answers kindly, moves on and pays nothing; the out-of-hints offer and a test video closed early, with the board
  playing on.
- **Pictures** (`docs/screenshots/d52/`): the win at 320 before and after; the World at 390 before and after; the place
  browser, a sandbox visit, an Animal question and the out-of-hints offer, after. (The *before* pictures came from a
  separate dev server of `main`, which drew with the fallback font.)
- Found while taking them: the place browser's resident line wrapped its kind under the name (fixed), and a World card
  for a home not being built read *… One more puzzle and Juniper is home while you build here* (now *Build here ·
  Juniper comes home after one more puzzle here*).
- **Not verified here** (needs a phone or people): VoiceOver and Switch Control, Reduce Motion on iOS, sound and
  haptics, real AdMob videos and their failures, consent and tracking prompts, StoreKit sandbox, 3D frame rate,
  postcard saving, and the five-person tests.
