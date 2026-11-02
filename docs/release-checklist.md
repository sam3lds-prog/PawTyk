# PawTyk — Release checklist (TestFlight → App Store)

## Build health
- [ ] `npm test` (222+), `npm run gen:check`, `npm run pack:check`, `npm run build` all green
- [ ] `npm run e2e` against `npm run dev` all green
- [ ] Version bumped in `package.json` and Xcode (marketing + build number)
- [ ] Set `DAILY_V2_FROM` in `src/game/specs.ts` to the first day the update is live for everyone (after store
      review and any staged rollout), so players on the old and new builds share the same Daily board until then.
      Dailies before that date stay on their original boards. (Currently 2026-10-27, i.e. immediately.)
- [ ] `npm run grade:report` unchanged since the last release, or `GRADING_VERSION` bumped and D22 updated (a grading
      change alters which board future dailies and levels 151+ get)

## Device QA (real iPhones: small/SE, standard, Pro Max)
- [ ] Portrait at 320 / 375 / 390 / 430 widths; safe areas (notch, home indicator)
- [ ] 8×8 boards legible at 320 (and old 9×9 saves / Paw Cup Grand Hall); Large board mode scrolls smoothly
- [ ] Sanctuary: gentle motion, never more than two things at once, still under Reduce Motion; no frame drops
- [ ] Faces: blinks/reactions smooth (60fps), only faces move, nothing shifts; reduced-motion respected
- [ ] VoiceOver: board cells announce row, column, region, pet; sheets trap focus; buttons labeled
- [ ] Dynamic text sizes don't clip win/settings sheets (they scroll)
- [ ] Background/terminate mid-board → resume offers the same board; Paw Cup attempt stays open
- [ ] Airplane mode: everything works
- [ ] Haptics feel right; sound off/on; silent switch respected
- [ ] Upgrade test: install v1 build, play to level ~14, install PawTyk over it → progress, coins, pets carried over once

### D36 (Journey / World / controls review) — not yet checked on a device
- [ ] (D37) Tap ✕ / double-tap on a real finger: the double-tap window (380 ms) feels right; no marks while panning a
      Large board; a ✕ drag marks exactly the tiles under the finger; a tap on a placed animal never erases it
- [ ] (D37) Mistake marks: a red ✕ (one-animal board, or both animals tried) and the struck animal (two-animal board)
      are legible at 320 and in High contrast; Erase leaves them; the same wrong double-tap twice costs one heart
- [ ] (D37) Hint shows the hint count; dots appear on Easy boards only
- [ ] Existing save on a device: progress untouched; a save that chose *Tap cycle* keeps it
- [ ] Journey: goal card, level and Continue visible without scrolling on an SE (375×667) with the tab bar; Daily/Zen
      a swipe below
- [ ] World: goal panel and Play above the map on an SE; map pins tappable; "New" dot visible on the tab
- [ ] Back from the Farm, the Pet Garden, the album, the Journal and a Shop opened from a sanctuary lands where you
      were, at the same scroll position; a tab tap starts afresh
- [ ] Win sheet: ordinary win is quick (one button); an arrival/region/stage shows the hero; both scroll under
      Dynamic Type; reduced motion skips the hero pop
- [ ] VoiceOver: animal buttons announce "Sheep: a double tap places a sheep"; mistakes read "a mistake, no animal here"
      or "not a cat, a mistake"; Hint reads the count; the World tab announces
      "something new to see" when a marker is set; the win sheet's main action is the first thing focused
- [ ] Level 21 bridge sheet reads well on a small phone; "Show me" lands on the glowing tile
- [ ] First run: the Farm welcome, Cotton on the tile, "Meet Cotton" → the guided board says to double-tap
- [ ] Interrupt mid-gesture (call, notification) during a ✕ drag: no stray marks; background during the win sheet →
      the credit is recorded once (`world.credits`)
- [ ] Five-player usability script (docs/DECISIONS.md D36, §10 of the review plan): tasks 1–5 without coaching

### D38 PR A — saved boards per mode
- [ ] Half-play a Journey level, leave; play and finish the Daily; Continue resumes the very same Journey board (cells,
      mistakes, hearts, hint used, clock)
- [ ] The reverse (Daily first, then a level and a Zen); all three offered on the hub; kill the app and relaunch: still
      all three
- [ ] "Play level N" from the World, the Farm, the Pet Garden and the level path while a *different* level is saved:
      the question appears every time; *Resume* opens the saved board, *Not now* changes nothing
- [ ] Tap a Zen size with a Zen board in progress: the question; *Resume* opens it and the next Zen board is still new
- [ ] Install the previous build over this one (rollback): the newest saved board is still offered; come back to this
      build: nothing finished is offered again

### D38 PR B — gesture clarity
- [ ] First placement on an ordinary board shows the controls note once, over the coach line; nothing moves; ✕ and the
      link work; never again after (also after a relaunch)
- [ ] VoiceOver on the board: "activate" on an empty tile marks ✕, activate again places — no double-tap window to
      beat; Switch Control the same
- [ ] Settings → Controls: *Fast double-tap* / *Two-step tap*; the little picture loops; under Reduce Motion it is a
      still of the last frame; the picture follows the choice
- [ ] Pause: the Controls line reads right for both schemes; "Settings and controls" opens Settings with the board paused
- [ ] 320 and 375 widths: the note fits in two or three lines without covering the board

### D38 PR C — Journey and World hierarchy
- [ ] SE (320×568) and SE2/8 (375×667): the hub's Play/Resume button and both quiet links sit above the tab bar without
      scrolling; the Daily card's top edge shows
- [ ] Hero with a saved Journey board: *Resume level N*, *Play level M instead*, both links; "New" chip when a sanctuary
      has news; the picture opens the sanctuary
- [ ] World at 320: one Play button, the two quiet links on one line; pills row; pin labels legible (12 px); the halo
      breathes (still under Reduce Motion); locked pins quiet; Expand map pans and starts on the home being built
- [ ] VoiceOver: the hero reads goal → level → Play → links; the pills announce their sanctuary; Expand map announces
      pressed / not pressed

### D38 PR D — growth policy 2 (owner decision; replaces Policy A)
- [ ] Existing save: after the update, growth, animals and gifts unchanged; replaying a cleared level shows the replay
      note and grows nothing; the next new level grows the sanctuary
- [ ] Ordinary win: "+1" pops, "N → N−1 puzzles away", the bar slides once; a tap mid-slide settles it; Reduce Motion
      shows the end state
- [ ] Arrival from the win sheet: the newcomer drops into place once, then greets; opening the sanctuary any other way
      shows no drop

### D38 PR E — polish and device hardening
- [ ] Real iPhones: SE (320×568), SE2/8 (375×667), a standard 390 and a Pro Max 430: the board's status row is one
      line; nothing a player reads is below 12 px; every tap presses the same way (buttons, cards, pins, Zen sizes)
- [ ] 8×8 and 9×9 (old saves, Paw Cup Grand Hall) at 320: region seams discoverable; pets clear of the seams; a struck
      animal and a red ✕ unmistakable; placed animals vs givens (lock) obvious; High contrast and Region patterns on
- [ ] Hint ladder: each step's coach line previews the next step and its cost; the badge count matches
- [ ] Win sheet: the skill line on Medium+; "What made it hard?" opens the reason without closing the sheet
- [ ] Sound on: placement, completed line/color and win tones distinct; silent switch respected
- [ ] Reduce Motion (device and in-app): no celebratory transforms anywhere (win sheet, halo, +1, arrivals, Settings
      picture still)
- [ ] 3D sanctuary on an older iPhone (8 / SE2): steady frame rate for two minutes, no heat, background → resume brings
      the scene back (WebGL context restored or the 2D fallback shows), memory steady
- [ ] Older battery device: 15 minutes of play, no noticeable drain; "3D animals" off saves battery as promised
- [ ] VoiceOver through the whole first ten minutes (welcome → first board → win → Farm → World)
- [ ] Five-player usability script (D36 §10): (a) how to place an animal, (b) what a mistake means, (c) why solving helps
      the World, (d) what they want to unlock next — all five answer without coaching

### D38 PR F — native save storage
- [ ] Install over the previous build on a device with progress: everything is still there (the first launch copies
      localStorage into Preferences); play a level; kill the app; relaunch: the move is there
- [ ] Settings → Erase progress, then relaunch: still erased (both copies cleared)
- [ ] Simulate storage pressure (Xcode → Device → Storage, or clear website data in Safari settings is *not* this
      app's WebView; use a dev build that clears localStorage on launch): progress survives from Preferences

### D39 PR A — what's next, and the newcomer
- [ ] Finish a sanctuary (tester shortcuts: grow the Farm to 25, solve one): the sheet says who is up next and where,
      with a bar; with every open home finished it names the next home and the levels to go
- [ ] *Meet [name]*: the newcomer drops in, a soft ring glows under it for a moment, its card says *New*; Reduce Motion:
      the ring is still and goes away
- [ ] Pet Garden arrival: the ring shows after *Welcome home* closes the card, not behind it

### D39 PR B — the loop, once
- [ ] Fresh install → guided first board → *Meet Cotton* → back to Journey: the *How PawTyk works* card, with the
      Farm and Truffle named, under the hero; *Play level 2* still on the first screen at 320×568
- [ ] *Got it* → it never returns (Journey or World); the pantry card appears next time instead
- [ ] VoiceOver reads the three steps as one sentence

### D39 PR C — why, and small celebrations
- [ ] Level 2 onward (after the controls note has gone): ✕ the rest of a row, place its animal: the row is ringed for a
      beat and the coach says *Only one spot was left…*; after three such moves it stops unless *Explain finished
      lines* is on
- [ ] Two-animal board: finishing a row by its last spot reads as one sentence; finishing two lines at once ripples the
      faces and buzzes once
- [ ] *Halfway there!* once per board; not again after leaving and resuming
- [ ] High contrast: the why ring is still clear; Reduce Motion: it holds still and disappears

### D39 PR D — the endless world
- [ ] Tester shortcuts → *Skip to level 81*: the first place (Marula Grasslands, savanna) is open and on the map as a
      small pin; its screen shows its look, its three animals and no decorations; the next place is locked
- [ ] Play into the place: its next animal is on the boards (coat and neckerchief on the tiles); the win sheet's
      arrival hero and *Meet* work there as in the regions
- [ ] *Finish every open home*: the next place opens and is announced; the World list leads with it, finished homes
      fold away once there are more than eight
- [ ] 3D animals on: a place's animals are recolored toys; off: drawn with their neckerchiefs
- [ ] A place's look (golden, autumn, blossom, misty, dusk) and a mirrored place look right on an older iPhone, with
      smooth scrolling (the looks are one static filter on the sky and land)
- [ ] Journey path, chapter 5 and later: a real chapter name, and *Finish it and the … opens on the map*
- [ ] While a place is being built: Shop → Decor and Treats open on the hand-made region of its biome, with a chip
      selected and items to buy
- [ ] 320-wide phone, a board for a place with a long name: the chip under the board ends in "…", nothing scrolls
      sideways, the timer is whole
- [ ] *Finish every open home* a few times, then World: the *Finished homes* row opens to its cards with no pause;
      the album's finished homes are one row each and open to their animals
- [ ] A toucan or seal of a place: its card never mentions a neckerchief; a kangaroo's toy has the big feet
- [ ] 3D animals on: *Meet* after an arrival rings the ground under the newcomer's toy

### D39 PR E — five hundred kinds of animal
- [ ] Tester shortcuts → *Skip to level 81*, then *Finish every open home* a few times: each new place brings three or
      four kinds you haven't met, in a landscape that suits them (a panda in a bamboo forest, a camel in the desert)
- [ ] The eight new landscapes (bamboo, mountains, desert, woodland, wetland, coast, island, grassland) look finished at
      stage 0 and at stage 4 on an older iPhone, and scroll smoothly; water sparkles and lanterns glow now and then
- [ ] A coast or wetland place: fish, whales and rays float in the water, not on the sand
- [ ] 3D animals on: a place of seated or perched animals shows toys; a place with a snake, fish or turtle shows the
      drawn scene (no toys at all)
- [ ] A kit animal on a board tile blinks, glances and cheers like the others; its card shows its kind, its fact and
      "In the wild"
- [ ] The album: "N of 545 kinds met" once places have begun

### D40 PR A — sound and touch
- [ ] On a device, sound on: ✕ is a quiet tick, a placement a soft pop, a finished row a short rise, a wrong guess one
      muted note, a solve the little melody, a new animal its own warm chime a beat later; nothing is loud next to
      other apps' sounds at the same volume
- [ ] Haptics: a ✕ is a light tap you can feel, a correct animal a clearly firmer tap, a finished row one firm tap, a
      drag across tiles only the faintest ticks, a wrong guess the gentle warning,
      a new animal one strong pulse; Settings → Haptics off: no buzz at all, sounds unchanged; Sound off: silence, the
      buzzes unchanged; the ringer switch on silent mutes the sounds
- [ ] Turning Sound effects on plays a small sample; turning it off mid-arrival-chime stops it at once
- [ ] A finger on a tile glows at once, before the ✕ appears; drag across a row: no rattle of sounds
- [ ] Tap animals in the Farm: a mouse-sized one squeaks higher than a cow
- [ ] Double-tap a little slowly twice on one board: the two-step offer appears once; *Use two-step tap* keeps the
      board and a ✕ then places with a second tap; it never appears again
- [ ] Wrong guesses: the coach never counts hearts, says *take your time* on the last one

### D40 PR B — personalities and bonding
- [ ] Farm: tap Truffle (two hops), Cotton (a slow blink and a nod), Pepper (three quick hops); Pet Garden: tap Juniper
      (turns away, then smiles) and Clover (stands tall, eyes shut). Each sounds different; a mouse squeaks higher
- [ ] On the board, a shy animal's happy face glances aside, a sleepy one smiles with its eyes shut; no tile moves
- [ ] Tap the same animal twice in a day: one heart (its card's count goes up by one, not two)
- [ ] An animal at 4 hearts: tap it → *… is your friend now!*; tap it later → a bigger heart and a warmer sound;
      at 14 + a pat → *good friend*, and it beams (eyes in two happy arcs) in the scene, on its card and in the album
- [ ] At 34 + a hello → the *Best friends!* card; *See the album* shows the framed portrait with today's date;
      at 70 the frame turns gold
- [ ] The card reads *Playful · Truffle is curious about everything…*, *3 hearts to Good friend: a beaming smile*
- [ ] Reduce Motion: a tap changes only the face (a shy one still glances away first), no hops

### D40 PR C — the win, and an arrival in four steps
- [ ] Ordinary win, 320×568 and 390×844: *Puzzle solved!*, a small star row, *Meadow Farm +1*, *One puzzle closer to
      Truffle!* and *Play level N* all fit in the first view with no scrolling; *More rewards* is closed and its summary
      lists what's inside; opening it shows time, badges, Paw Points, coins, missions and Share
- [ ] Arrival: *Truffle is home!*, her face, *Your new piglet*, her temperament; the warm chime comes a beat after the
      melody; *Meet Truffle* → she settles, is ringed and greets in her own way, the pond sparkles once, then *Next goal*
      appears under the scene with *Play level N*
- [ ] Pet Garden arrival: the next goal comes after the "came home" card is closed
- [ ] Daily: the streak chip is in the first view; Paw Cup: the score card is; a replay: the stars still to earn are
- [ ] VoiceOver: the fold reads as *More rewards*, collapsed, with its summary; the stars read "2 of 3 stars"
- [ ] Reduce Motion: no rise or bar slide; the next goal appears at once

### D40 PR D — visits worth making
- [ ] Fresh install → first board → *Meet Cotton*: *Tap Cotton to say hello.* and a dashed ring under Cotton; tapping
      her: her hello, a heart, the cue and the ring go
- [ ] Tap a little animal (a chick, a bunny, a mouse of a place) a finger's width off to the side or just above its
      head: it answers; tapping between two animals picks the nearer; a decoration with a sparkle still does its own thing
- [ ] The tapped animal: a soft ring and *Name · Temperament* over it for a moment; tap another and both move
- [ ] Reach a new stage (tester shortcuts: grow the Farm, solve one) → *Visit*: the new part glows as it grows in and
      *New at the Farm: …* says what changed; reach one, go elsewhere, come back via the "New" marker: the same
- [ ] 3D animals on: the rings and the tag sit with the toys; Reduce Motion: nothing moves, the stage still glows
- [ ] Older iPhone: the scene scrolls smoothly, nothing new animates on its own

### D41 PR A — the first arrival
- [ ] Fresh install → *Meet Cotton* → solve the first board: no results sheet; the empty meadow, then the fence grows
      in and glows, Cotton drops in with the chime and a pulse, says hello, and *Next goal · Bring Truffle the piglet
      home · 3 more puzzles* rises in with *Play level 2*
- [ ] *Skip* at any point jumps to the goal (the chime still plays once); *Visit the Farm* opens the Farm with the
      *Tap Cotton* cue and the starter gift
- [ ] 320×568: the goal's buttons are on screen when it appears; Reduce Motion: the end state at once, nothing moves
- [ ] VoiceOver: *Skip* has focus first, the captions are read as they change, then the focus is on *Play level 2*
- [ ] An existing player updating (with animals at home) never sees it; their next arrival is the usual win sheet
- [ ] *Skip* early, then wait 5 s: nothing replays behind the goal; keyboard: Tab and Shift+Tab stay on its buttons
- [ ] *I know how to play* → today's Daily first: the Daily's own results (streak, time, Share) with *Meet Cotton*

### D41 PR B — the board's identity
- [ ] Level 2: the board sits in a warm frame with corner posts; the nameplate reads *Farm · Truffle in 3*; on the
      board that brings Truffle it reads *brings Truffle home*; in an Outback board the frame is the Outback's color
- [ ] Tap a tile: corner brackets on it; arrow keys move them; a wrong guess's red ring and a correct animal's ring
      still show along the edges; gone when the puzzle is solved, and a tap after the solve brings none back
- [ ] The nameplate never covers the top row: tap the top-middle tiles of a 9×9 on a 320-wide phone
- [ ] Place a color's animal: the rest of that color softens; the open colors stay bright and easy to tell apart
- [ ] Pips fill with the animal's face as animals come home; a two-animal board shows each kind's count; a 9×9 on a
      320-wide phone shows a face and a count, and the status row stays on one line
- [ ] High contrast: plain frame with a dark outline, dark brackets; region colors still clearly distinct
- [ ] Large board mode: the frame scrolls with the board; nothing is cut off at the top
- [ ] A long place name: the plate ends in "…" inside the frame; VoiceOver reads the full sentence

### D42 PR A — the name
- [ ] Install over a build from before D42: the Journey, every saved board, the world's places and the coins are all
      still there; the home screen label reads *PawTyk* (on an older Xcode project, after setting *Display Name*)
- [ ] The Journey and welcome wordmarks, *How PawTyk works*, Settings' footer and the Daily's Share text say PawTyk
- [ ] A v1 (Cats vs Dogs) save: the welcome sheet reads *Cats vs Dogs has grown into PawTyk*
- [ ] Leaderboard (when configured, after `fb:deploy`): the name *PawTyk Team* is refused

## Store integration (only when ready; see roadmap)
- [ ] StoreKit products created (remove_ads, starter_decor, cozy_theme, pet_portraits, supporter); verified entitlement
      + restore via a maintained bridge (e.g. RevenueCat Capacitor SDK); sandbox buy, restore, refund, reinstall
- [ ] Release build never uses the dev store; legacy v1 `removeAds` confirmed by a real restore
- [ ] If ads: maintained SDK, ATT prompt policy, cadence via `shouldShowInterstitial`, none in Paw Cup or onboarding

## Leaderboard (Firebase, only when configured)
- [ ] `npm run fb:test` passes against the emulator; `npm run fb:deploy` done for the release project
- [ ] If this release changes a board spec (`game/specs.ts`), the functions were deployed *before* the app is
      released (an older server rejects the new spec and the app drops rejected solves; functions/README.md)
- [ ] App Check: only once a native App Attest provider is added and tested; until then `ENFORCE_APP_CHECK` stays unset
- [ ] TestFlight: join → solve a level and the Daily → both tables show the points → edit name → leave (documents and
      auth user gone in the console); airplane mode while joined queues solves and sends them later
- [ ] A blocked name is refused; a report from three test accounts renames the target

## App Store Connect
- [ ] Name "PawTyk" (bundle id unchanged; check the name is free in App Store Connect), subtitle, keywords, age rating
      (4+, no Kids Category)
- [ ] Privacy label matches docs/privacy-security.md for the services this build turns on
- [ ] Screenshots from the real build (Home, a board with faces, Sanctuary, Residents, Paw Cup practice)
- [ ] Support URL and privacy policy URL
- [ ] Review notes: Paw Cup is offline practice; the leaderboard is opt-in (anonymous, nickname only, leave = delete);
      gems buy cosmetic decorations only; reward videos only when the player chooses one
