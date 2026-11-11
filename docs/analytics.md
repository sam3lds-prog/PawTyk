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
| | `photo_mode_open` / `postcard_created` / `postcard_shared` | photo mode | `home`, `kind`, `orientation`, `signed`, `frame` / `result` |
| Monetization | `store_open` | the Shop opens | `tab` |
| | `product_view` / `starter_pack_view` / `starter_pack_offer` | a product's details; the Welcome Rescue Pack shown | `product`, `where` |
| | `iap_started` / `iap_success` / `iap_cancelled` / `iap_failed` | a purchase | `product`, `reason` |
| | `rewarded_ad_offer` / `rewarded_ad_start` / `rewarded_ad_complete` | a chosen video | `placement` |
| | `reward_grant` | the video's reward recorded (or refused: the day's cap) | `placement`, `ok` |

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

Aggregate only: there is no way (and no need) to look up one player.
