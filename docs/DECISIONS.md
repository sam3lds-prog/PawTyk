# Pawtopia — Decision log

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
  that home's color with a post at each corner — and a nameplate hangs over the top: the home and what this board
  brings closer (*Farm · Truffle in 3*; *Farm · brings Truffle home* on the board that does; the next stage when every
  animal is home). It replaces the small *Farm* chip under the board, so the board carries the loop on every level.
  A replay's plate names the home only; a Paw Cup board has a plain frame. The plate's label reads it in full
  (*This board helps the Meadow Farm. Truffle the piglet comes home in 3 more puzzles.*); long place names end in "…".
- **Where am I?** (`Board.select`): the tile last touched, or reached by keyboard, is ringed in the home's color, and
  its row and column are lifted a little (a faint light band under the animals and marks), like a selected cell in a
  number puzzle. Overlays only, so nothing on a tile moves (D11); it clears when the board is solved; high contrast
  keeps the ring and drops the bands.
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

