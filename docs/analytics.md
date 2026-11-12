# PawTyk — Usage statistics (D47 PR 6)

PawTyk can send anonymous usage statistics to **Google Analytics for Firebase**, to learn whether players enjoy the
farm, where puzzles get hard, and whether optional purchases and videos are working. It is built to fail safe:

- **Off by default.** Nothing is sent until the player turns on *Share anonymous usage stats* (Settings → Your data,
  or the one-time card on Journey after their third session). This keeps the privacy policy's promise that anything
  new that is collected stays off until chosen. Turning it off stops sending at once.
- **Off in the build until configured** (`VITE_FIREBASE_ANALYTICS=1` and GoogleService-Info.plist; `docs/native-setup.md`).
  An unconfigured build shows the old "PawTyk sends no analytics" row instead of the switch, and never asks.
- **Nothing that identifies a player.** No user id, nickname, advertising id or anything typed. Consent mode denies
  ad storage, ad user data and ad personalization; Info.plist turns off IDFA/IDFV collection. Firebase adds its own
  app instance id (a random number per install) and device, OS, language and region.
- **Never in the way.** The SDK loads after the first screen; events before it is ready wait in a small queue; a
  failing SDK or a rejected call is dropped quietly. `services/analytics.ts` also keeps an in-memory list on the device
  (for the QA page) whether or not anything is sent.

Code: `services/analytics.ts` (event names, the switch, user properties), `services/firebaseAnalytics.ts` (the sink),
`app/usage.ts` (days, first-time moments, bands, the choice), `services/firebaseApp.ts` (the one Firebase app).

## Events

Parameters are game facts only: numbers or short text; booleans arrive as 1/0.

| Funnel | Event | When | Parameters |
| --- | --- | --- | --- |
| Session | `app_open` | every launch | `sessions` |
| | `day_active` | first open on a new calendar day | `day_n` (days since first play), `days_active` |
| | `retention_day` | that open is day 1, 7 or 30 | `day` |
| | `screen_view` | every screen | `screen` |
| Gameplay | `first_puzzle_start` | once ever | `mode`, `level` |
| | `puzzle_start` | every board | `mode`, `size`, `difficulty` |
| | `first_puzzle_complete` | once ever | `mode`, `seconds` |
| | `tutorial_complete` | level 1 solved, once | `seconds` |
| | `onboarding_controls` | the tutorial's first animal placed (D48) | `scheme`, `first_try`, `single_taps` (capped at 9) |
| | `puzzle_complete` | every solve | `mode`, `size`, `seconds`, `mistakes`, `hints` |
| | `level_reached` | a new Journey level 2–10, 21, then every 10 | `level` |
| | `puzzle_fail` / `puzzle_retry` | out of hearts / Try again | `mode`, `size` |
| | `hint_used` | each hint | `mode`, `tier` (1 Look, 2 Explain, 3 Place) |
| | `revive_offer` / `revive_used` | the loss sheet / a heart back | `mode`, `life`, `video` / `via` |
| | `daily_complete` | a Daily solved | `streak` |
| Sanctuary | `home_visit` | opening a home | `home`, `first` |
| | `home_time` | leaving a home | `home`, `seconds` (≤ 3600) |
| | `animal_arrived`, `region_stage`, `trick_played`, `decor_bought` | as before | as before |
| | `walk_start` | the 3D Farm walk opens | `stage` |
| | `photo_mode_open` / `postcard_created` / `postcard_shared` | photo mode | `home`, `kind`, `orientation`, `signed`, `frame`, `keepsake` / `result` |
| Sharing (M3) | `share_opened` | a share card shown (a Daily result, a postcard, an arrival keepsake) | `surface` |
| | `share_started` | the player chose Share | `surface` |
| | `share_result` | what the platform reported: `shared` (the share sheet finished, not proof of a post), `downloaded`, `copied`, `cancelled`, `failed` | `surface`, `result` |
| | `photo_memory_claimed` | the week's first postcard earned its coins | `coins` |
| Shop (M1) | `trick_tried` | a trick played as a preview in a home (never learned by it) | `trick` |
| Monetization | `store_open` | the Shop opens | `tab` |
| | `product_view` / `starter_pack_view` / `starter_pack_offer` | a product's details; the Welcome Rescue Pack shown | `product`, `where` |
| | `iap_started` / `iap_success` / `iap_cancelled` / `iap_failed` | a purchase | `product`, `reason` |
| | `rewarded_ad_offer` / `rewarded_ad_start` / `rewarded_ad_complete` | a chosen video | `placement`, `surface` (M2: `decor:<id>`, `trick:<id>`, `food:<id>`, `shop`) |
| | `reward_grant` | the video's reward recorded (or refused: the day's cap) | `placement`, `ok`, `surface` |

**User properties** (bands only): `journey_band` (1-20, 21-40, …), `homes_band` (0, 1, 2-3, 4-6, 7+),
`install_week` (ISO week of first play), `paid` (yes/no).

## Reading it

- **Retention**: Firebase's *Retention* report (cohorts by first open) gives Day 1/7/30 directly; `retention_day`
  and `day_active` make the same cut available in funnels and BigQuery, and `install_week` separates cohorts.
- **Onboarding funnel**: `first_open` → `first_puzzle_start` → `first_puzzle_complete` → `tutorial_complete` →
  `level_reached{level=21}`.
- **Sanctuary engagement**: `home_visit{first=1}`, repeat `home_visit`, `home_time` (median per visit), `walk_start`,
  `trick_played`, `postcard_created` → `postcard_shared{result=shared}`. Compare cohorts before and after D47 to see
  whether the new farm and postcards bring players back.
- **Monetization**: `store_open` → `product_view` → `iap_started` → `iap_success` (with `iap_cancelled`/`iap_failed`
  beside it); `starter_pack_offer` → `starter_pack_view` → purchase; `rewarded_ad_offer` → `rewarded_ad_complete` →
  `reward_grant{ok=1}`.
- Sessions per returning user: Firebase's engagement reports (`session_start` is automatic).

- **Sharing (M3)**: `share_opened` → `share_started` → `share_result{result=shared}` per `surface`. `shared` only
  means the system sheet finished: it never proves a post was made, seen, or led to an install. Visits that came from
  a shared card are counted on the landing page's own hosting logs, by the `?s=` on the link (no player id), not here.
- **Shop discovery (M1/M2)**: `product_view{surface=try_on}`, `trick_tried`, `reward_grant{surface=decor:…}`.

Aggregate only: there is no way (and no need) to look up one player. No share event carries a recipient, a contact,
an account or the app the player shared to.

## D49 — attention, delight and retention: what to measure

New events (opt-in like every other; game facts only):

| Event | When | Parameters |
| --- | --- | --- |
| `featured_tap` / `featured_see_all` | a Featured pick opened; See all | `kind` (decor, trick, food), `pos` (0 = the large one) / `home` |
| `welcome_card` | the arrival's card shown, Continue, a hello | `home`, `action` (shown, continue, hello), `state` (offer, fed), `from` (first_arrival) |
| `welcome_snack` | a newcomer's welcome snack | `home`, `gift` (the free first one), `favorite`, `from` (card, arrival) |
| `meal_played` | a meal starts in a scene | `style` (full, quick), `feast` |
| `animal_moment` | an animal moment plays | `moment`, `first` |
| `today_tap` | one of Journey's *Also today* rows | `kind` (resume, daily, friend, news) |
| `win_next_action` | the player picks what's next after a win (or the first arrival) | `action` (next, meet, region, sanctuary; snack, play, visit), `ms`, `milestone`, `mode`, `first_arrival` |
| `first_meal` | the first meal a player ever gives (once) | `from` (card, welcome), `visits` (home visits so far, capped at 99) |
| `mission_claimed` | now also when an errand pays by itself | `coins`, `auto` |
| `decor_bought` / `trick_bought` | now also from the try-on banner | `surface: try_on` |

**The pilot measures** (the review's proposed thresholds; not results, and not industry benchmarks). Because these
events are opt-in, the consenting players are not a fair sample of everyone: pair them with observed TestFlight
sessions (`docs/release-checklist.md` → D49) before trusting any number.

| Question | How | Pilot target |
| --- | --- | --- |
| First animal placed without help | `onboarding_controls{first_try=1}` share; observed sessions | 80%+ |
| First puzzle completed without help | `first_puzzle_complete` ÷ `first_puzzle_start`; observed | 85%+ |
| Players understand why the sanctuary grows | observed sessions (ask after level 2: "what made the Farm grow?") | 85%+ |
| Time to choose what's next after a win | `win_next_action.ms`, median and 80th percentile, by `milestone` | under 5 s |
| Feeding found within the first few visits | `first_meal.visits` ≤ 3, as a share of players with `home_visit{first=1}` | 70%+ |
| Day-1 return | `retention_day{day=1}` (and Firebase's cohort report) | 30%+ |
| Day-7 return | `retention_day{day=7}` | 10–15%+ |

Supporting reads: `welcome_snack` ÷ `welcome_card{action=shown}` (does the snack get used?), `today_tap` by kind
(which nudge helps), `meal_played{style=quick}` share over time, `animal_moment{first=1}` per player (how many
moments are discovered), `featured_tap{pos=0}` against the small ones.

## D50 — what changed for measurement

| Event | When | Parameters |
| --- | --- | --- |
| `animal_greeting` | an animal says hello a couple of seconds into a calm visit | `reason` (unlock, newcomer, solved, evening, hello), `home` |
| `welcome_card` | now also when the player taps *Look around first* | `action: look` |

Reads for the beta (with the D49 pilot measures above):
- **Voluntary revisits**: `home_visit{first=0}` that don't follow a win's Visit or Meet (`win_next_action{action=region|meet}`
  in the same minute), per player per day. Does the player come back to see the animals with nothing telling them to?
- **One more puzzle**: after an ordinary win, `win_next_action{action=next}` share, and how many sessions end on a win
  sheet. Compare a session ending right after a win that felt complete with one ending after a loss or a long pause.
- **Does the hello land?** Share of visits with `animal_greeting{reason=unlock}` followed by a hello (the friend's
  `friendship_level`) in the same visit.
- **The economy model**: each `EconomyScenario` field in `src/meta/economyModel.ts` names the event that replaces its
  assumption (`docs/economy-model.md`).
