/**
 * Before an App Store build (D43): checks the settings a release needs and says which optional services this build
 * will have, so App Store Connect's privacy answers match. Exits 1 if something required is missing.
 *
 *   npm run release:check
 *
 * Reads `.env.production.local`, `.env.local` and the environment, the same way `vite build` does.
 */
import { readFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { cleanEmail, cleanUrl } from '../src/config/legal';
import { publicGameUrl } from '../src/config/links';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env } as Record<string, string | undefined>;
const problems: string[] = [];
const notes: string[] = [];

const contact = cleanEmail(env.VITE_CONTACT_EMAIL);
if (!contact) problems.push('VITE_CONTACT_EMAIL is not set to an email address. The privacy policy and support page need it.');
const privacyUrl = cleanUrl(env.VITE_PRIVACY_URL);
if (!privacyUrl) problems.push('VITE_PRIVACY_URL is not set to an https:// address. Host the policy (npm run site:deploy) and put its URL here and in App Store Connect.');
if (env.VITE_QA === '1') problems.push('VITE_QA=1 is set: that is the tester build (tester shortcuts on). Remove it for the App Store.');
if (env.VITE_FIREBASE_EMULATORS === '1') problems.push('VITE_FIREBASE_EMULATORS=1 points the leaderboard at local emulators. Remove it.');

// M3: where shared cards point. Optional; never a test or development address.
const gameUrlSet = (env.VITE_GAME_URL ?? '').trim();
const gameUrl = publicGameUrl(gameUrlSet);
if (gameUrlSet && !gameUrl)
  problems.push(`VITE_GAME_URL=${gameUrlSet} is not a public https page (a local, private, test or preview address can't go to players). Use the landing page's real address, or leave it empty.`);
const storeUrl = (env.VITE_APP_STORE_URL ?? '').trim();
if (storeUrl && !/^https:\/\/apps\.apple\.com\/[^\s]+\/id\d+/.test(storeUrl)) problems.push('VITE_APP_STORE_URL must be the App Store listing (https://apps.apple.com/…/id…), or empty until there is one.');

const cap = readFileSync('capacitor.config.ts', 'utf8');
if (!/appName:\s*'PawTyk'/.test(cap)) problems.push("capacitor.config.ts: appName should be 'PawTyk'.");

const store = !!env.VITE_REVENUECAT_IOS_KEY;
const videos = env.VITE_ADMOB_ENABLED === '1';
const board = !!(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID && env.VITE_FIREBASE_APP_ID);
const pack = env.VITE_WELCOME_PACK === '1';
if (pack && !store) problems.push('VITE_WELCOME_PACK=1 without VITE_REVENUECAT_IOS_KEY: the Welcome Rescue Pack needs the App Store. Set the key or remove the flag.');
const usage = env.VITE_FIREBASE_ANALYTICS === '1';
if (videos && !env.VITE_ADMOB_REWARDED_IOS) problems.push('VITE_ADMOB_ENABLED=1 without VITE_ADMOB_REWARDED_IOS would show Google test videos. Set your ad unit id.');

notes.push(`Gems (App Store via RevenueCat): ${store ? 'ON — the Gems tab and premium items show' : 'off — no Gems tab, nothing sold for gems'}`);
notes.push(`Reward videos (AdMob): ${videos ? 'ON — check Info.plist has GADApplicationIdentifier, SKAdNetworkItems and NSUserTrackingUsageDescription' : 'off — no videos, nothing sold for video tokens'}`);
notes.push(`Leaderboard (Firebase): ${board ? 'ON — deploy functions and rules first (npm run fb:deploy)' : 'off — no Leaderboard tab'}`);
notes.push(
  `Welcome Rescue Pack: ${pack ? 'ON — only if pawtyk.welcomepack is set up in App Store Connect + RevenueCat and the sandbox checks passed (release-checklist D47)' : 'off — not sold (players who own it keep it)'}`,
);
notes.push(`Usage statistics (Firebase Analytics, opt-in): ${usage ? 'ON — add GoogleService-Info.plist (docs/analytics.md); answer the privacy label for analytics' : 'off — nothing is sent'}`);
notes.push(`Game link on shared cards: ${gameUrl ? `${gameUrl} (with ?s=daily|arrival|postcard|result)` : 'none — cards and messages are shared without a link (set VITE_GAME_URL to the landing page once it is live)'}`);
notes.push(
  store || videos || board || usage
    ? 'App Store privacy answers: see docs/privacy-security.md → "App Store privacy label" for each service that is ON.'
    : 'App Store privacy answers: "Data Not Collected" (nothing leaves the device).',
);

console.log('PawTyk release check\n');
for (const n of notes) console.log(`  • ${n}`);
if (contact) console.log(`  • Contact: ${contact}`);
if (privacyUrl) console.log(`  • Privacy policy: ${privacyUrl}`);
if (problems.length) {
  console.log('\nFix before an App Store build:');
  for (const p of problems) console.log(`  ✗ ${p}`);
  process.exit(1);
}
console.log('\nReady: settings are complete.');
