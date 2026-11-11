# PawTyk — Friend invites and referrals (M4): architecture and compliance review

**Status: review only. Nothing here is built or shipped.** Under the plan, the production reward system waits until
Sam approves the backend, identity, attribution and fraud-control approach below. Until then, `featureFlags.friends`
stays `false`, no Friends & Invites entry appears, and no code, Cloud Function or Firestore rule for referrals exists.
This document is the approval package. Section 9 lists the decisions that need an answer.

Reviewed 2026-11-11 against Apple's App Store Review Guidelines (last updated 16 October 2026) and Meta's developer and
Page policies. Quotes are short; follow the links for the full text. This is a product and engineering review, not
legal advice. The final terms text should get a legal read before launch.

## 1. What the plan proposes

- **Reward:** each side gets 50 Paw Coins when a friend qualifies. The referrer gets a Friendship Garden Gate
  decoration after three qualified friends.
- **Qualifying:** a friend qualifies once they are attributed to the referrer *and* complete the first five Journey
  levels.
- **Backend:**
  - codes are opaque and issued by the server;
  - identity is opt-in, with a manual code-entry fallback;
  - verification happens on the server, and every grant is idempotent;
  - caps and fraud protections are in place;
  - no contact harvesting and no ad-ID fingerprinting;
  - the privacy policy is updated and the data can be deleted.
- **Honesty:** the app never claims install verification from a local code.
- **UX:** a quiet Friends & Invites entry.

## 2. Compliance review

### Apple

- **3.2.2(x).** This rule is the line between allowed and not allowed. Apps "must not force users to rate the app,
  review the app, download other apps, or other store-related actions in order to access functionality, content, or
  use of the app." It then allows rewards for in-app actions, "such as by completing a level or watching an ad."
  - **Consequence:** a referral can never gate anything. The Journey, the Daily, the Shop and every existing reward
    stay fully available to someone who never invites anyone.
  - **Consequence:** the friend's half of any reward should be earned by **playing** (finishing level 5), never by
    installing or registering.
- **5.6.3 Discovery Fraud.** Manipulating "charts, search, reviews, or referrals to your app erodes customer trust and
  is not permitted." This is the reason for every fraud control in section 5. A referral scheme that reinstall farms
  or bots can feed counts as manipulated referrals.
- **App Review practice is stricter than the text.** Developers have posted rejections under 3.2.2 that read "your
  app incentivizes referrals in order to sign up new users"
  ([forum thread 674832](https://developer.apple.com/forums/thread/674832),
  [108548](https://developer.apple.com/forums/thread/108548)).
  - One posted rejection (February 2021) told the developer the new user "should not receive any rewards for
    downloading or registering."
  - **Reading:** a reward for the *friend* tied to signing up is the pattern review rejects. A reward for the
    *referrer*, paid only when the friend has genuinely played, is the defensible one. See decision D1.
- **3.1.1.** "Any credits or in-game currencies purchased via in-app purchase may not expire." Referral coins are
  earned, not bought. They go into the same wallet and never expire either.
- **5.1.1(v).** "If your app supports account creation, you must also offer account deletion within the app." An
  invite code is tied to a Firebase account, so deleting it must be in the app (section 6). That flow already exists
  for the leaderboard.
- **4.5.4.** Push notifications must not promote anything without explicit opt-in. **Decision:** no "your friend
  joined!" pushes. Status is shown in the app only.
- **5.1.2 / App Tracking Transparency.** Matching an install to a click by IP address, device model, screen size and
  so on is fingerprinting. Apple forbids it, and so does the plan. **Decision:** no probabilistic attribution, ever.

### Meta (Facebook, Instagram) and other social platforms

- **Page promotions.** Meta's Page rules say personal Timelines and friend connections "must not be used to administer
  promotions." Their examples include "share on your Timeline to enter" and "tag your friends in this post to enter."
- **Developer policy.** Meta's developer policy deep dive gives a non-compliant example: rewarding points for each
  friend a post is shared with
  ([policies deep dive](https://developers.facebook.com/docs/apps/policies/policies-deep-dive/)).
- **Scope.** PawTyk uses no Meta SDK. It shares only through the iOS share sheet (M3), so Meta's Platform terms apply
  indirectly at most. We follow them anyway:
  - nothing is rewarded for posting, sharing, tagging or liking;
  - the referrer is rewarded only when a friend plays five levels, whatever channel the invite went through
    (Messages, mail, said aloud);
  - the share text is a suggestion that the player can edit, and some share targets drop it.
- **The same rule covers M3's Photo Memory.** It rewards *making* the week's first postcard, never sharing it. That
  was a deliberate M3 decision.

### Rules this design follows (from the plan's global constraints)

- No reward for posting, tagging, reviews or ratings.
- No contacts access, and no recipient list or phone numbers.
- Referrals are never required for the Journey, and no existing free reward is reduced.
- Counts shown are real: "2 friends reached level 5", never "Join 10,000 players inviting friends!".
- No urgency timers ("invite in the next 2 hours").

## 3. What exists today, and what's missing

| Piece | State |
| --- | --- |
| Firebase project, anonymous Auth, callable Cloud Functions (2nd gen) | **Built** for the leaderboard (`functions/src/index.ts`, `src/services/leaderboard.ts`) |
| Server-side replay of a solved board from its move log | **Built**: `src/leaderboard/check.ts` rebuilds the official board, replays every move, rejects `too-fast` / `invalid-log` |
| Idempotent award ids on the server | **Built**: `players/{uid}/awards/{awardId}`, one grant per id |
| Firestore rules: clients never write | **Built**: deny-by-default `firestore.rules`, emulator tests in `test/firebase/rules.test.ts` |
| In-app account deletion | **Built** for the leaderboard: Leave deletes `players/{uid}`, `scores/{uid}`, `reports` |
| App Check with App Attest | **Missing.** The app sends no App Check tokens. `ENFORCE_APP_CHECK` is off until a native provider exists |
| DeviceCheck (per-device bits) | **Missing.** Needs a small native plugin plus a server key |
| Universal Links (`apple-app-site-association`, Associated Domains entitlement) | **Missing.** Needs the public domain from `VITE_GAME_URL` |
| Deferred deep linking (link → App Store → app opens with the code) | **Not available.** Firebase Dynamic Links shut down on 25 August 2025; we add no third-party attribution SDK (decision D4) |
| A server-side coin balance | **Doesn't exist, by design.** The wallet and ledger are on the device |

## 4. Architecture

### 4.1 Identity: opt-in, the same anonymous account as the leaderboard

- Nothing happens until the player opens **Friends & Invites** and taps **Get my invite code**. That signs in
  anonymously with Firebase. If they already joined the leaderboard, the existing account is reused.
- There is no name, email, phone number or Apple ID, so no Sign in with Apple is needed.
- The leaderboard nickname is never shown to the friend, and the friend is never shown to the referrer (section 6).
- An anonymous account is lost if the app is deleted. That is acceptable: the codes are disposable and the rewards
  already granted are in the local wallet. The cloud backup design (`docs/cloud-backup.md`) does not include
  referral state.

### 4.2 Codes: issued by the server, opaque, revocable

- **Format.** `createInviteCode()` is a callable that returns 8 characters in Crockford base32 with no I, L, O or U
  (40 random bits), shown as `PAW-7K3M-9QXD`. It contains no uid, name, date or counter, so nothing can be read out
  of it.
- **Storage.** `inviteCodes/{code}` → `{ owner: uid, createdAt, revokedAt? }` and `players/{uid}.inviteCode`. There
  is one live code per account, and **New code** revokes the old one (rate-limited to 3 a day).
- **Collisions.** On a collision, the function retries. With 2⁴⁰ codes, collisions are practically never reached.

### 4.3 Attribution: honest, and no fingerprinting

Without deferred deep linking, a link can't carry the code through an App Store install. The design says so instead
of pretending:

1. **The invite link** is `https://<game domain>/i/PAW-7K3M-9QXD`, a static page on the public game site.
   - **App installed:** the Universal Link opens the app with the code filled in on the "Have a code?" sheet.
     Nothing is applied until the friend taps **Use code**.
   - **App not installed:** the page shows the code in large text, a **Copy code** button and the App Store link.
     After installing, the friend pastes or types the code under **Friends & Invites → Have a code?**.
2. **Manual entry** always works. It is how most friends who don't have the app yet will arrive, and it is the only
   path in the web build.
3. **What the server knows:** "account B entered A's code, then played five levels." It does **not** know that B
   installed because of A's link. The UI never says "your friend installed from your link". It says "a friend used
   your code".
4. **No pasteboard sniffing.** The app does not read the clipboard on first launch to find a code. Reading it
   silently is fingerprint-adjacent and triggers iOS's paste banner. Pasting is always the friend's own action.

### 4.4 Redeeming a code (the friend)

`redeemInviteCode({ code, deviceToken })` is a callable, with App Check enforced. In one transaction it checks:

- the caller is signed in, and the code exists and isn't revoked;
- the code isn't the caller's own (same uid);
- the caller hasn't already redeemed a code (`referrals/{friendUid}` exists);
- **this device hasn't redeemed a code before:** the DeviceCheck token is checked with Apple's `query_two_bits`, and
  bit 0 set means "this iPhone has already been someone's invited friend". Apple keeps these bits per device and
  per developer team, and they survive deleting and reinstalling the app. That is the only reinstall-proof check that
  isn't fingerprinting;
- **the window:** the friend is new. They have finished at most 4 Journey levels, by their own claim, re-checked at
  qualification, and their first launch was within 14 days (decision D3);
- **rate limits:** at most 5 redeem attempts per account per day, and an invalid code costs an attempt. This stops
  people guessing codes.

On success it writes `referrals/{friendUid}` → `{ referrer, code, redeemedAt, status: 'pending' }` and sets
DeviceCheck bit 0. The DeviceCheck token itself is never stored.

### 4.5 Qualifying: five Journey levels, replayed on the server

- **The submission.** The friend's app sends its solved Journey levels 1–5 (board ref, spec and move log) to
  `submitReferralProgress`.
- **Keeping the logs.** Today the app keeps move logs only after the player joins the leaderboard
  (`enqueueSolve` in `src/leaderboard/queue.ts` returns early when not joined). Referrals need one small client
  change: always keep the move logs of the first five Journey levels on the device. That is five small logs, never
  sent unless the player redeems a code. Otherwise a friend who played levels 1–4 before entering the code couldn't
  qualify.
- **The check.** The function runs the existing `checkSolve` for each level, the same code that guards the
  leaderboard. A log that doesn't solve the official board, or solves it impossibly fast, is rejected.
- **Qualifying.** When all five are verified, the function sets `status: 'qualified'` and writes the awards
  idempotently:
  - `players/{referrer}/awards/ref:friend:{friendUid}`: 50 coins, but only while the referrer is under the cap;
  - `players/{friendUid}/awards/ref:welcome`: per decision D1;
  - when the referrer reaches 3 qualified friends, `players/{referrer}/awards/ref:gate`, the Garden Gate (decision
    D2).
- **Levels from before the code.** Levels finished before the code was entered still count. The window check in 4.4
  stops anyone who had already played far.

### 4.6 Claiming into the wallet

The coin wallet lives on the device, so the server can't deposit coins. Instead:

- The app lists `players/{uid}/awards` where the id starts with `ref:` (a rules read the owner is allowed). For each
  one it calls the local `grant(save, 'ref:friend:<friendUid>', 50, 'referral', now)`. The ledger is idempotent per
  id, so a reinstall, a second device or a double tap can't pay twice from the same award.
- A Garden Gate award calls `grantItem(save, 'friendship-gate', 'decor', 1, 'referral', now)`.
- **Threat model.** Someone editing their own save file can already give themselves coins. The server's job is to
  make the *legitimate* path impossible to farm, not to protect a wallet that is on the device by design.

### 4.7 Caps and fraud controls (all on the server)

| Control | Value (proposed) | Stops |
| --- | --- | --- |
| App Check (App Attest) enforced on all referral functions | required, **go-live blocker** | scripts calling the functions directly |
| DeviceCheck bit 0 on redeem | once per iPhone, ever | reinstall farming, one phone with many accounts |
| Self-referral | same uid rejected; same device covered by bit 0 | inviting yourself |
| Referrer cap | 5 rewarded friends lifetime (decision D2); more friends can still use the code, without coins | invite farms |
| Weekly cap | 2 qualifying rewards per referrer per local week | bursts |
| Redeem window | ≤ 4 levels done, first launch ≤ 14 days ago | veterans trading codes |
| Replay check | `checkSolve` on all 5 levels, including `too-fast` | bots that fake progress |
| Redeem attempts | 5 per account per day | brute-forcing codes |
| Code rotation | 3 per day | spraying fresh codes |
| Flags | the referrer's qualified friends all redeemed within minutes, or from devices first seen the same hour → hold for review (no auto-ban) | coordinated rings |

The web build has no DeviceCheck, so it **can't redeem or earn referral rewards**. It can show a code ("Invites work
in the iPhone app"). This keeps the hard checks intact.

## 5. Data and privacy

**What is stored (Firestore):**

- `inviteCodes/{code}`: owner uid, creation and revocation times.
- `players/{uid}.inviteCode`.
- `referrals/{friendUid}`: referrer uid, code, redeem and qualify times, status.
- Award documents.

**What is never stored:**

- names, emails or phone numbers;
- contacts or recipients;
- IDFA or IDFV;
- IP addresses (Cloud Functions must not log `rawRequest.ip`);
- DeviceCheck tokens. Apple keeps the bits, and they say nothing about who owns the device.

**Who sees what:**

- The referrer sees only counts: "Friends who reached level 5: 2". They never see a friend's uid, nickname or
  progress.
- The friend sees "You joined with a friend's code" and nothing about the referrer.

**Deletion (5.1.1(v)):**

- **Friends & Invites → Delete my invite data** and the leaderboard's **Leave** both run one `deleteReferralData`
  path. It:
  - revokes and deletes the code;
  - deletes `referrals/{uid}` and the award documents;
  - replaces the uid in the referrer field of other players' `referrals` docs with `deleted`, so their counts stay
    true.
- DeviceCheck bit 0 stays set. It isn't personal data we hold, and clearing it would reopen reinstall farming.
- Coins already in the local wallet stay. They are the player's.

**Paperwork:**

- **Privacy policy:** add an "Invites" section to `src/legal/privacyPolicy.ts`.
- **App Store privacy label:** "User ID" and "Gameplay content", linked, for App Functionality, the same categories
  the leaderboard already declares. Check that nothing new is needed.
- **Analytics:** all events follow the existing opt-in.
  - The events are `invite_opened`, `invite_code_created`, `invite_shared` (reusing `share_result`),
    `invite_code_entered` (`result: ok | invalid | own | used | device | window | limit | offline`),
    `referral_qualified` and `referral_reward_claimed`.
  - The **code and uids are never analytics props.** The BLOCKED regex in `src/services/analytics.ts` should gain
    `code|referr` as a guard.

## 6. UX outline (Friends & Invites)

- **Where it lives.** One quiet row in **Settings → Friends & Invites**, plus a line at the bottom of the Journey's
  missions list once the player has finished level 5. There is nothing on the win sheet, no badge or dot, no pop-up
  and no push.
- **Your invite:**
  - The rules in one sentence: "When a friend plays their first five levels with your code, you both get 50 Paw
    Coins." This sentence changes with decision D1.
  - The code in big letters, with **Share invite**. The share sheet's text is "Come build a cozy animal sanctuary with
    me in PawTyk 🐾 My invite code: PAW-7K3M-9QXD <link>"; the link comes from M3's `shareLink('invite')`.
  - **Copy code.**
  - The status: "Friends who reached level 5: 1 · 2 more for the Friendship Garden Gate". The count is real, and the
    line is hidden at 0.
  - The small print: "Rewards are for friends who play, not for posting, tagging, reviews or ratings. Up to 5
    friends."
- **Have a code?** A field that accepts `PAW-7K3M-9QXD`, `7K3M9QXD` or any case, then **Use code**. Plain answers:
  - "That code isn't one we know."
  - "That's your own code."
  - "This iPhone has already joined with a code."
  - "Codes are for new sanctuaries."
  - "Invites need a connection; try again when you're online."
- **Offline and web.** Everything in the game still works. Only this screen needs a connection, and the web build
  says invites work in the iPhone app.
- **Accessibility.** The code is read out character by character (`aria-label="P A W, 7 K 3 M, 9 Q X D"`), and every
  string is in plain words.

## 7. Go-live gate (before `featureFlags.friends` can be on)

1. Sam approves the decisions in section 9.
2. A native App Check provider (App Attest, with DeviceCheck as the fallback) ships, and `ENFORCE_APP_CHECK=true`
   works for the leaderboard first. This is also the leaderboard's own recommended gate.
3. A DeviceCheck plugin and the server key are in Secret Manager, never in the repo, `.env` or `.env.local`.
4. Universal Links are set up: Associated Domains for the game domain, an `apple-app-site-association` file from
   `make-site.ts`, and the `/i/<code>` landing page.
5. Emulator tests pass for the new rules (clients still never write) and for every row of the table in 4.7.
6. Legal reads the terms sentence, and the privacy policy and privacy label are updated.
7. A TestFlight run on two real iPhones works end to end:
   - A shares;
   - B installs and enters the code;
   - B plays levels 1–5;
   - A is paid once, and B per D1;
   - B reinstalls and is refused;
   - A deletes the data.
8. App Review notes explain that the reward is for a friend's in-app play, is capped, gates nothing and isn't paid for
   installs.

**Estimated build after approval:** about 2 weeks for one engineer, about half of it native (App Check, DeviceCheck,
Universal Links) and TestFlight time.

## 8. Not doing

- Contacts upload or "invite your contacts".
- Rewards per share or per message sent.
- Leaderboards of top inviters.
- Third-party attribution SDKs (Branch, AppsFlyer and the like).
- IP or device fingerprinting, and reading the clipboard on launch.
- Push notifications about invites.
- Showing a friend's name or progress.
- Gating any content behind an invite.

## 9. Decisions for Sam

- **D1. The friend's reward.**
  - (a) The plan as written: the friend gets 50 coins when they finish level 5. This is allowed by 3.2.2(x)
    ("completing a level") but carries some App Review risk, given past rejections of rewarding new users.
  - (b) **Recommended:** the friend gets no referral-specific coins. Every new player already gets the same
    level-5 milestone rewards, and the friend's screen says "You joined with a friend's code 🐾". Only the referrer is
    rewarded. This has the lowest review risk.
  - (c) The friend gets a cosmetic thank-you (a postcard frame) instead of coins.
- **D2. Caps and the Gate.** Is 5 rewarded friends lifetime and 2 per week right? The Friendship Garden Gate needs new
  art, and M1 excluded new decorations, so it needs its own approval. A no-art option is a "Friends" postcard frame
  after 3.
- **D3. The redeem window.** Is "≤ 4 levels done and first launch ≤ 14 days ago" right, or would you rather have
  "before level 5" only?
- **D4. Attribution.** Universal Links plus manual code entry, with no deferred deep link SDK (recommended), or pay
  for a third-party SDK and accept its privacy-label and tracking implications?
- **D5. The web build.** Show a code only (recommended), or leave invites out of the web build entirely?
- **D6. Order.** Build the App Check provider for the leaderboard first and ship it alone (recommended), then
  referrals on top?

## Sources

- [Apple, App Store Review Guidelines](https://developer.apple.com/app-store/review/guidelines/): 3.1.1, 3.2.2(x),
  4.5.4, 5.1.1(v), 5.6.3. Last updated 16 October 2026.
- Apple Developer Forums, referral rejections under 3.2.2:
  [674832](https://developer.apple.com/forums/thread/674832), [108548](https://developer.apple.com/forums/thread/108548).
- [Apple, DeviceCheck `DCDevice`](https://developer.apple.com/documentation/devicecheck/dcdevice) and
  [Accessing and modifying per-device data](https://developer.apple.com/documentation/devicecheck/accessing-and-modifying-per-device-data).
- [Firebase, App Check with App Attest](https://firebase.google.com/docs/app-check/ios/app-attest-provider);
  [App Check overview](https://firebase.google.com/docs/app-check).
- Firebase Dynamic Links shutdown on 25 August 2025:
  [Branch](https://www.branch.io/resources/blog/life-after-firebase-dynamic-links-three-paths-to-a-better-deep-linking-stack/),
  [AppsFlyer](https://www.appsflyer.com/?p=364599).
- [Meta, Developer Policies](https://developers.facebook.com/devpolicy) and
  [policies deep dive](https://developers.facebook.com/docs/apps/policies/policies-deep-dive/); Page promotion rules, as
  summarised by [Gleam](https://gleam.io/blog/facebook-promotion-guidelines/).
