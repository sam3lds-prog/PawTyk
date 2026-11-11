# PawTyk — Native setup (iOS app, App Store, AdMob, RevenueCat, Firebase)

Everything outside the game itself is **off until you configure it**. A build with no settings plays fully offline,
sells nothing, shows no videos and makes no network calls. Turn services on one at a time.

Settings go in `.env.local` at the repo root (git-ignored). Copy `.env.example` and fill in what you have.
They are public client identifiers (they ship inside the app anyway), but keep them out of git so each machine and
build can use its own.

## 0. The iOS project (Capacitor 8)

Capacitor was upgraded to 8 before the iOS project was first generated, so there is nothing to migrate.
Requirements: Node 22+, Xcode 26+, CocoaPods or Swift Package Manager (Capacitor 8 defaults to SPM).

```
npm ci
npm run build
npx cap add ios        # once
npx cap sync ios
npx cap open ios
```

Set your Team in Xcode, keep the bundle id `com.sam3lds.catsvsdogs` (D9), and run on a device.

**Home-screen name** (D42): `appName` in `capacitor.config.ts` (*PawTyk*) is written into the iOS project only when
`npx cap add ios` creates it; `cap sync` doesn't change it. On a project made earlier, set *Display Name* to PawTyk in
Xcode (target → General).

**App icon** (D42): in Xcode, open `App/Assets.xcassets` → `AppIcon`, set it to *Single Size*, and drop in
`assets/icon-only.png` (1024 × 1024, no transparency, as the App Store requires; iOS rounds the corners). Or run
`npx @capacitor/assets generate --ios`, which reads the same file. To change the art, edit `scripts/iconArt.ts` and run
`npm run icons`. To look at another sky first, `npm run icons -- --style golden` (or `dusk`) renders a preview to
`artifact/icon-golden.png` and leaves the shipped files alone; to ship it, set `ICON_STYLE` in `scripts/iconArt.ts`
and run `npm run icons`.

Progress is kept in the app's own storage on a device (`@capacitor/preferences` → UserDefaults, D38 PR F), not only
in the WebView's localStorage, so iOS can't evict it and it rides along in device backups. `npx cap sync ios` adds
the plugin; nothing else to configure. The first launch of this build copies an existing player's save over.

**Postcards** (D47 PR 5): sharing uses `@capacitor/share` and `@capacitor/filesystem` (a postcard is written to the
app's cache, handed to the share sheet, and deleted after). `npx cap sync ios` adds both. The share sheet's *Save
Image* writes to Photos, which iOS allows only with a reason in `ios/App/App/Info.plist`:
`NSPhotoLibraryAddUsageDescription` = "PawTyk saves the postcards you choose to keep to your Photos." Without the key
iOS stops the app the first time a player taps Save Image, so add it before a TestFlight build. Nothing else is
needed: no permission is asked until a player saves a postcard themselves.

## 1. Reward videos — Google AdMob (`@capacitor-community/admob`)

PawTyk only shows **reward videos the player asks for** (an extra life, a hint, a video token). No banners, no
interstitials. Consent (Google UMP) and Apple's tracking prompt are asked the first time a player chooses a video.

1. In `ios/App/App/Info.plist` add:
   - `GADApplicationIdentifier` = your AdMob **app id**. Until you have one, use Google's test app id
     `ca-app-pub-3940256099942544~1458002511`.
   - `NSUserTrackingUsageDescription` = "PawTyk asks so the optional reward videos can be more relevant. You can say
     no and still get every reward."
   - `SKAdNetworkItems` = the list from Google's iOS quick-start (copy it from the AdMob docs; it changes over time).
2. In the AdMob console create a **Rewarded** ad unit for the iOS app; put its id in `.env.local`:
   `VITE_ADMOB_REWARDED_IOS=ca-app-pub-…/…` (leave empty to keep Google's test videos).
3. Only after step 1, set `VITE_ADMOB_ENABLED=1`. Without the Info.plist keys the Google SDK would crash the app on
   the first video, which is why the switch exists.
4. In AdMob, create the GDPR / US-state privacy messages (Privacy & messaging) so the consent form has something to
   show. Players can reopen it from Settings → Ad privacy choices.
5. App Store Connect privacy label: with AdMob live the app is **no longer "Data Not Collected"**. Declare what the
   Google Mobile Ads SDK collects (identifiers, usage data, diagnostics; used for third-party advertising), and update
   the privacy policy. If you ever submit to the Kids category, remove ads first.

Daily cap: 10 reward videos per player per day, shared by all rewards (`src/app/rewarded.ts`).

## 2. Gems and purchases — RevenueCat (`@revenuecat/purchases-capacitor`)

1. In App Store Connect create the in-app purchases with exactly these product ids (`src/config/services.ts`):
   | Product id | Type | Grants |
   | --- | --- | --- |
   | `pawtopia.gems.60` | Consumable | 60 gems |
   | `pawtopia.gems.160` | Consumable | 160 gems |
   | `pawtopia.gems.420` | Consumable | 420 gems |
   | `pawtopia.removeads` | Non-consumable | entitlement `remove_ads` (for v1 owners only; not on sale, never marketed) |
   | `pawtyk.welcomepack` | Non-consumable | the Welcome Rescue Pack: 180 gems + the Rescue Wagon (entitlement `welcome_pack`) |
   Suggested price tiers: $0.99 / $1.99 / $4.99 for gems, $2.99 for the Welcome Rescue Pack. Prices always come from the
   store. The existing ids keep their old `pawtopia.` prefix (they already exist); only the new pack uses `pawtyk.`.
2. Create a RevenueCat project, add the iOS app (App Store Connect shared secret / in-app purchase key), import the
   products, and create the entitlements `remove_ads` (attached to `pawtopia.removeads`) and `welcome_pack` (attached to
   `pawtyk.welcomepack`).
3. Put RevenueCat's **public iOS SDK key** in `.env.local`: `VITE_REVENUECAT_IOS_KEY=appl_…`.
4. In Xcode enable the **In-App Purchase** capability. Test with a sandbox account.
5. **Welcome Rescue Pack (D47 PR 7):** it is sold only when `VITE_WELCOME_PACK=1` (test builds always show it with the
   free test store). Leave it unset in a release build until all of these are true: the product is *Ready to Submit* in
   App Store Connect with its review screenshot and description, it is attached to `welcome_pack` in RevenueCat, and the
   sandbox checks in `docs/release-checklist.md` (D47 section) pass on an iPhone. Nothing else needs changing to turn it
   on or off; a player who owns it keeps it either way.

How grants stay safe: gems are granted once per store transaction id; on launch the app asks RevenueCat for all
consumable transactions and grants any it missed (a crash between paying and saving). Restore Purchases restores
`remove_ads` and the Welcome Rescue Pack. The pack is granted by its transaction id too (its 180 gems once, the wagon
owned and out on the Farm); at launch the app reads RevenueCat's record and grants a pack it never recorded (a closed
app mid-purchase, a new install after Restore), and only once per player whatever transaction id the store reports.
If RevenueCat answers and no longer has the pack, nothing is taken back by default (`REVOKE_WHEN_MISSING` in
`src/meta/welcomePack.ts`): a Restore on another device moves the purchase there in RevenueCat, so its absence isn't
proof of a refund. Revocation (wagon put away, up to 180 unspent gems back, both returned if the purchase comes back)
is built and tested for when the sandbox shows the refund signal is reliable. An unanswered store never changes
anything. Gems only buy premium decorations and
tricks — never hearts, hints or rankings, and nothing in the Paw Cup.

## 3. Leaderboards — Firebase (see `functions/README.md`)

1. Create a Firebase project (**Blaze** plan, needed for Cloud Functions; a small leaderboard stays well inside the free
   quotas) and add a **Web app** (the game runs in a web view and uses the JS SDK). Enable **Authentication →
   Sign-in method → Anonymous**. Create the **Firestore** database (production mode).
2. From the Web app's config put in `.env.local`:
   `VITE_FIREBASE_API_KEY`, `VITE_FIREBASE_AUTH_DOMAIN`, `VITE_FIREBASE_PROJECT_ID`, `VITE_FIREBASE_APP_ID`
   (and `VITE_FIREBASE_REGION` if you deploy the functions outside `us-central1`; then also set `FUNCTIONS_REGION` in
   `functions/.env`). The web config is not a secret; it identifies the project.
3. Install the Firebase CLI (`npm i -g firebase-tools`), `firebase login`, copy `.firebaserc.example` to `.firebaserc`
   with your project id, then: `npm --prefix functions install && npm run fb:deploy`. That builds `functions/lib`,
   deploys the four callable functions (`lbProfile`, `lbSubmit`, `lbReport`, `lbDelete`), the security rules and the
   two composite indexes (weekly table and weekly rank).
4. Run the security-rules tests once against the emulator: `npm run fb:test` (needs Java; the CLI downloads the
   emulator the first time).
5. Update the App Store privacy label (docs/privacy-security.md has the exact answers).
6. **App Check is not wired up yet.** The game runs in a web view, where Firebase's web App Check can't use App Attest;
   it needs a native provider plugin (for example `@capacitor-firebase/app-check`) once the iOS project exists. Until
   that is added and tested, **leave `ENFORCE_APP_CHECK` unset**: enforcing it would reject every call. The server's
   replay check and pacing limits work without it; App Check mainly stops scripted sign-ups.

Players are never signed in automatically: nothing reaches Firebase until a player opens League → Leaderboard and taps
**Join**. Leaving (League → Leaderboard → Leave) deletes their documents and their anonymous account.
Without the Firebase settings a release build has no Leaderboard tab at all (D43); development builds and the tester
preview run the same server logic on the device (a table with only you on it).

## 3b. Usage statistics — Google Analytics for Firebase (`@capacitor-firebase/analytics`, D47)

Off until you turn it on here, and then still off for each player until they choose "Share anonymous usage stats"
(Settings, or a one-time card on Journey after a few sessions). What is sent: `docs/analytics.md`.

1. In the Firebase console (the same project as the leaderboard, or a new one), add an **iOS app** with the bundle id
   `com.sam3lds.catsvsdogs` and download **GoogleService-Info.plist**. Drag it into Xcode under `App/App` (copy items,
   target App). It is not a secret, but keep it out of git like `.env.local`.
2. In `ios/App/App/Info.plist` add (so nothing advertising-related is collected, whatever the player chooses):
   - `GOOGLE_ANALYTICS_ADID_COLLECTION_ENABLED` = NO
   - `GOOGLE_ANALYTICS_IDFV_COLLECTION_ENABLED` = NO
   - `GOOGLE_ANALYTICS_DEFAULT_ALLOW_AD_PERSONALIZATION_SIGNALS` = NO
   - `FIREBASE_ANALYTICS_COLLECTION_ENABLED` = NO (the app switches collection on only for players who chose it)
3. `npx cap sync ios` (adds the plugin and the Firebase iOS SDK). The plugin's npm package asks for Firebase JS 12;
   `package.json` overrides that to the app's Firebase 13 (only its web half uses it).
4. In `.env.local`: `VITE_FIREBASE_ANALYTICS=1` (and, for the web tester page, `VITE_FIREBASE_MEASUREMENT_ID=G-…` from
   the Firebase web app).
5. App Store Connect privacy label: add **Usage Data → Product Interaction** and **Identifiers → Device ID**, not
   linked to identity, not tracking, purpose Analytics (`docs/privacy-security.md`). The in-app policy already
   describes it.
6. Check in the Firebase console's **DebugView** (run once with `-FIRDebugEnabled` in the scheme's arguments) that
   events arrive only after turning the switch on, and stop when it is turned off.

## 4. Privacy policy, support page and contact (D43)

App Store Connect needs a **privacy policy URL** and a **support URL**, and the app must show the policy too (it does:
Settings → Privacy policy, the full text, offline).

1. Make the public contact address and put it in `.env.local`: `VITE_CONTACT_EMAIL=…`.
2. `npm run site` builds `site-dist/index.html`, `privacy.html` and `support.html` from the app's own policy text.
3. Host them. The repo is set up for **Firebase Hosting** (free): `firebase login`, `firebase use <project>`, then
   `npm run site:deploy`. The pages are at `https://<project>.web.app/privacy.html` and `…/support.html`.
   Any static host works the same way.
4. Put the privacy URL in `.env.local` too, `VITE_PRIVACY_URL=https://<project>.web.app/privacy.html`, so Settings links
   to it, and in App Store Connect (App Privacy → Privacy Policy URL; the support URL goes on the version page).
5. `npm run release:check` before archiving: it fails if either is missing and says which App Store privacy answers fit
   the services this build has.

When the policy text changes, update `POLICY_UPDATED` in `src/legal/privacyPolicy.ts` and redeploy the site.

## 5. Tester builds

`npm run artifact -- --qa` builds `artifact/pawtyk-qa.html`: a single-file web build with a **test store** (free,
labeled gems), **test videos** and the Tester shortcuts in Settings. Test gems never count in a release build.
Tester shortcuts → *See the App Store build* reloads it without the test store, test videos and test leaderboard, as a
release build with no service settings looks (and as App Review sees it).
