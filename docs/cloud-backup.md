# PawTyk — Cloud backup: architecture decision and migration plan (D47 PR 8)

Status: **decision and plan only. Nothing here is built, no entitlement is added, and the bundle id stays
`com.sam3lds.catsvsdogs`.** Progress stays offline-first: the game never needs a network, an account or iCloud to play.

## 1. The problem

Today the save lives in PawTyk's own storage on the device (`@capacitor/preferences`, the app's UserDefaults on iOS,
mirrored into the WebView, D38/D43). That already survives app updates and rides along in iCloud Backup / a device
restore. It does **not** cover:

| Case | Today |
| --- | --- |
| Player deletes the app and reinstalls it | Progress gone (purchases come back with Restore; gems bought come back through the ledger reconcile; everything else is lost) |
| New iPhone set up *without* restoring a backup | Progress gone |
| Playing on an iPhone and an iPad | Two separate sanctuaries |
| A WebView storage eviction | Already handled (D38/D43: the native store wins) |

Goal: a player's sanctuaries, animals, Journey progress and decorations follow them to a reinstall or a second device,
**without** an in-app account, without sending their progress to us, and without ever losing progress to a sync
conflict.

## 2. Save facts that shape the design (measured on main, D47)

- One JSON document under `pawtopia.save.v2` (+ the in-progress boards in `pawtopia.sessions.v1`). `progressVersion: 2`,
  sanitized on every load (`normalizeSave`), with pre-migration backup keys (`pawtopia.backup.*`).
- Size: ~2 KB fresh; ~90 KB for a synthetic level-400 save with 30 homes grown (`journey` 53 KB, `world` 19 KB,
  `inventory` 15 KB). It grows roughly linearly with levels cleared; a very long-lived save could reach a few hundred KB.
  JSON compresses about 5–8× (deflate), so a compressed snapshot stays far under 1 MB for any realistic player.
- Every currency is an **append-only ledger with idempotent entry ids** (`level:<n>`, `ach:<id>`, `iap:<tx>`,
  `mission:<key>`, `buy:trick:<id>`, `feed:<animal>:<time+seq>`, `use:hint:<mode>:<…>:<time>`, `refund:<tx>:<at>` …)
  and balances are computed from entries. This is the key property: two copies of a save can be merged by taking the
  union of entries by id, and nothing is granted twice.
- Ownership (pets, companions, decor, tricks, accents) is a set of records with timestamps: merge is a union.
- Purchases' source of truth is the App Store through RevenueCat (entitlements; gem grants by transaction id). The
  Welcome Rescue Pack and gem packs reconcile per device at launch (D47 PR 7), so a synced save never needs to carry
  entitlements to be correct.
- Device-local by design and **not** to be synced: the leaderboard identity (anonymous Firebase uid, D30), the usage
  statistics choice (`settings.shareUsage`, D47 PR 6 — consent is per device), the native/WebView write counters, and
  in-progress boards (see §5).

## 3. Options evaluated

| | iCloud Key-Value Store (`NSUbiquitousKeyValueStore`) | **CloudKit private database** | Game Center saved games (`GKSavedGame`) | Firebase (Auth + Firestore) |
| --- | --- | --- | --- | --- |
| Account the player must have | iCloud signed in | iCloud signed in | Game Center signed in **and** iCloud Drive on | An app account (anonymous uid dies with the install; surviving a reinstall needs Sign in with Apple linking) |
| In-app sign-in UI | None | None | Game Center sheet | Sign in with Apple button |
| Size | 1 MB total per app per user, 1,024 keys | Per record 1 MB of fields (more as assets); counts toward the player's own iCloud quota (tiny) | Arbitrary blob | Firestore doc 1 MiB |
| Conflict handling | Last writer wins per key, change notification after the fact | **Optimistic concurrency: a save with a stale change tag is rejected with the server copy (`serverRecordChanged`)** | Conflicting-saves API, player-visible | Transactions; we would write it |
| Sync timing | Opportunistic, throttled; documented as not for frequently changing data | On demand (fetch/save when we ask) + optional silent push | iCloud Drive timing | On demand |
| Who can read the data | Only the player's devices | Only the player's devices (private DB; not readable by the developer) | Only the player | **Us** — data linked to the player; App Store privacy label changes; server cost and operations |
| Works offline / offline-first | Yes (local cache) | Yes, we keep the local save as primary | Yes | Yes with cache, but identity/linking adds failure modes |
| Native work | ~100 lines Swift | ~300–400 lines Swift (plugin) | ~200 lines + Game Center auth flow | JS SDK exists; Apple sign-in plugin + account linking + deletion flow |
| Notes | Easy to overwrite a rich save with a fresh one silently; no history | Can keep a couple of earlier snapshots; account-change detection via user record id | Known reliability complaints; brings in Game Center which PawTyk doesn't use | Contradicts "your progress stays on your device"; App Review requires account deletion if accounts exist |

**Sign in with Apple alone syncs nothing.** It only gives an identity; something (Firebase, CloudKit, our own server)
still has to store and merge the save. It is not a backup by itself, and adding it would add an account-deletion
obligation.

## 4. Decision

**Use CloudKit's private database, through a small first-party Capacitor plugin, as an optional "iCloud backup"
that mirrors the local save. No in-app account, no Game Center, no Firebase for saves.**

Why:

1. It needs nothing from the player beyond being signed in to iCloud, which most iPhone players already are.
2. The data stays in the player's own iCloud; we never see it, which keeps the current privacy promise true in spirit
   (the policy text still changes, §8).
3. Its change tags let the app detect a conflict *before* overwriting, and the ledger design lets the app resolve it by
   merging rather than choosing a side. Key-Value Store's silent last-writer-wins is the main way players lose
   progress in other games; CloudKit avoids it.
4. It needs no bundle id change: the plugin uses an iCloud container identifier, which is independent of the bundle id.

Rejected for now: Key-Value Store (silent overwrites, 1 MB total, throttling), Game Center saved games (requires Game
Center + iCloud Drive, flaky, a sign-in sheet), Firebase (an account, our servers hold player data, privacy label and
deletion obligations). Firebase stays the leaderboard backend only.

## 5. Sync model

- **The local save stays the primary copy.** The game reads and writes it synchronously as today; cloud work is
  background and best-effort. A failed or slow iCloud never blocks play, a puzzle, a purchase or a celebration.
- **One record per player:** record type `SaveSnapshot`, record name `main`, in the default zone of the private
  database. Fields: `payload` (deflated JSON of the save minus device-local parts), `schema` (2), `appVersion`,
  `savedAt`, `summary` (`{nextLevel, animals, sanctuaries}` for the restore prompt — no names, no device names), and
  `prev1`/`prev2` (the two previous payloads, for rollback).
- **Not synced:** `leaderboard`, `settings.shareUsage` and `onboarding.usageAsked`, write counters, `sessions` /
  `lastSession` (an in-progress board resumes on the device it was started on; syncing half-played boards between
  devices invites confusing resumes and "lost hearts" reports). Display settings sync (sound, motion, contrast) as a
  convenience, newest wins.
- **When it uploads:** after a meaningful change (a solve, an arrival, a purchase, a decoration change) debounced to at
  most once a minute, and when the app goes to the background. Never during a board's input handling.
- **When it downloads:** at launch (after the local save is loaded and shown), on returning to the foreground after
  ≥10 minutes, and on a silent push from a CloudKit subscription (optional, phase 3).

### Merge rules (pure TypeScript, `mergeSaves(local, remote)`, fully unit tested)

| Part | Rule |
| --- | --- |
| Coin / item ledgers | Union of entries by id; balances recomputed; balances never below 0 (an overspend from two offline devices shows as 0, not a debt) |
| Journey clears, stars, best times | Union per level; keep the better result |
| `nextLevel` and chapter progress | Max |
| Owned pets, companions, decor, tricks, accents | Union (earliest `unlockedAt` / `ownedAt` kept) |
| Decor shown/hidden, favorites, equipped accent | The newer change wins (each needs a `changedAt`; added in phase 1) |
| World growth, visited, credits | Max / union per sanctuary; credit receipts union (a board is credited once) |
| Affection, bonds, feeding counters | Max per animal (never adds two devices' counts together, so nothing doubles) |
| Purchases record (`purchases.*`) | Union, informational only; RevenueCat reconcile on each device stays the truth |
| Offers (Welcome Pack highlight) | Max `shown`, newest `lastAt`, `dismissed` sticky |
| Settings (synced subset) | Newest wins |

Properties the tests must prove (property-based, over generated saves): `merge(a, a) = a`; `merge(a, b)` equals
`merge(b, a)` up to newest-wins fields; merging never lowers a balance below what either side earned minus what both
spent; never removes an owned item; never grants a ledger id twice; and `normalizeSave(merge(a, b))` round-trips.

Writing: fetch → merge → save with the fetched change tag; on `serverRecordChanged`, merge again with the server copy
and retry (max 3). The merged result is also written locally, after a local pre-merge backup
(`pawtopia.backup.v2.pre-sync`, like `pre-d35`).

### First sync and restore

- **Fresh install, cloud has a save:** before the first lesson starts, a sheet: "Welcome back! Continue your sanctuary
  from iCloud? Level 142 · 18 animals · last played 3 Nov." → *Continue* (download, replace the empty local save) or
  *Start fresh* (the cloud copy is kept untouched until the player has made progress, then merged).
- **Both have progress:** merge automatically (nothing is lost by a union) and show a quiet toast "Your progress from
  your other devices is here." No choice to get wrong.
- **iCloud account changed** (the CloudKit user record id differs from the one stored locally): never merge across
  people on a shared device. Ask: keep this device's progress for this iCloud account, or start this account's own.
- **iCloud signed out / restricted / full:** the switch says "iCloud backup is paused: <reason>", play goes on; nothing
  is retried in a loop.

## 6. Migration plan

| Phase | What ships | Gate |
| --- | --- | --- |
| 0 (this PR) | This document | Reviewed |
| 1 — merge-ready save | `changedAt` on the few newest-wins fields; device suffix on time-based ledger ids generated from a per-device counter (audit: `feed:*`, `use:*`), so two devices can never produce the same id in the same millisecond; `mergeSaves` + property tests; `normalizeSave` accepts saves with and without the new fields. **No cloud yet.** Old builds keep reading new saves (only additive fields) | All existing save fixtures load; property tests green; a v1 → v2 → phase-1 save chain round-trips |
| 2 — native plugin | `ios/App/App/PawTykCloud` Swift plugin: `status()`, `fetch()`, `save(payload, changeTag)`, `userId()`; web/Android no-op. Xcode: iCloud capability → CloudKit, container `iCloud.com.sam3lds.pawtyk` (**container ids are permanent and cannot be deleted or renamed — decide once**). CloudKit schema created in Development, deployed to Production before release. No new npm dependency | Simulator + two physical devices on one Apple ID: upload, download, conflict retry |
| 3 — the feature | Settings → "iCloud backup" switch (on by default only once the privacy text is updated, see §8), the restore sheet, background upload/download, optional silent-push subscription; analytics events `cloud_restore_offered/accepted`, `cloud_sync_failed{reason}` (opt-in analytics only) | TestFlight matrix below passes |
| 4 — cleanup | Remove the pre-sync backup key after 2 releases without incidents | — |

Rollback: the feature is behind a build flag (`VITE_CLOUD_BACKUP`); turning it off leaves local saves exactly as they
are. Each device keeps its pre-merge backup; the cloud record keeps two previous payloads.

## 7. TestFlight matrix (phase 3 go/no-go)

1. Play to level 30 on iPhone A → delete the app → reinstall → restore sheet → *Continue* → same levels, animals,
   decorations, gems (no duplicates in the ledger), purchases restored through Restore.
2. iPhone A and iPad B, both offline; play different levels and buy different decorations on each → go online → both
   devices end with the union, balances correct, nothing granted twice.
3. Kill the app mid-upload (Xcode stop) → relaunch → no corruption, upload completes.
4. iCloud signed out → switch shows paused, game fully playable; sign in → sync resumes.
5. Switch the device's Apple ID → the account-change question appears; no merge across accounts.
6. iCloud storage full → paused message, no loop, no crash.
7. A save from the current App Store build (pre-phase-1) upgrades and syncs.
8. Welcome Rescue Pack bought on A → on B the wagon appears after Restore (RevenueCat), not twice from the sync.
9. VoiceOver reads the restore sheet and the switch; Reduce Motion unaffected.

## 8. Privacy and App Review

- Privacy policy (`src/legal/privacyPolicy.ts`) gets a section: progress can be backed up to the player's own iCloud
  (private database), which only their devices can read and the developer cannot; how to turn it off; deleting it
  (Settings → iCloud → Manage Storage → PawTyk, and an in-app "Delete iCloud backup" button).
- App Store privacy label: our reading is that data stored only in the user's private iCloud database, inaccessible to
  the developer, is not "collected"; confirm against Apple's App Privacy definitions when phase 3 is built.
- No account is created, so no account-deletion requirement is triggered; the in-app delete button is still provided.
- Nothing here changes the bundle id, the save keys, the product ids or the leaderboard identity.

## 9. Open questions (for the owner)

- Container name: `iCloud.com.sam3lds.pawtyk` (recommended, the product's name) or `iCloud.com.sam3lds.catsvsdogs`
  (matches the bundle id). Permanent either way.
- Default for the switch once shipped: on (recommended, it is the player's own iCloud) or ask once.
- Whether an Android build is ever planned (it would need a different backend; the merge logic is reusable).
