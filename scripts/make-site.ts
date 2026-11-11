/**
 * PawTyk's public pages (D43): the privacy policy and the support page whose URLs go in App Store Connect, plus a small
 * home page linking them. Built from the same policy text the app shows (src/legal/privacyPolicy.ts), so the two never
 * drift. Output: site-dist/ (git-ignored), served by Firebase Hosting (`npm run site:deploy`) or any static host.
 *
 *   npm run site      needs VITE_CONTACT_EMAIL (in .env.local or the environment); refuses to build without it.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from 'vite';
import { PUBLISHER, cleanEmail } from '../src/config/legal';
import { POLICY_UPDATED, POLICY_UPDATED_TEXT, policyHtml } from '../src/legal/privacyPolicy';

const env = { ...loadEnv('production', process.cwd(), 'VITE_'), ...process.env };
const contact = cleanEmail(env.VITE_CONTACT_EMAIL);
if (!contact) {
  console.error('site: set VITE_CONTACT_EMAIL (in .env.local) to the public contact address first. Nothing was written.');
  process.exit(1);
}

const OUT = 'site-dist';
const favicon = readFileSync('public/favicon.svg', 'utf8');
const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(title: string, description: string, body: string): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(description)}">
<link rel="icon" href="data:image/svg+xml;base64,${Buffer.from(favicon).toString('base64')}">
<style>
  :root { --bg:#f7f3ea; --surface:#fffdf8; --ink:#283434; --muted:#4d5b5b; --brand:#2f7d5b; --line:#e4dccb; }
  @media (prefers-color-scheme: dark) { :root { --bg:#172020; --surface:#1f2a2a; --ink:#eef2ee; --muted:#b9c6c2; --brand:#7fd1a8; --line:#33403f; } }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--ink); font: 17px/1.6 -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif; }
  main { max-width: 680px; margin: 0 auto; padding: 32px 16px 64px; }
  header { display:flex; align-items:center; gap:12px; margin-bottom: 8px; }
  header svg { width: 44px; height: 44px; }
  header a { color: inherit; text-decoration: none; font-weight: 700; font-size: 20px; }
  h1 { font-size: 30px; line-height: 1.2; margin: 24px 0 4px; }
  h2 { font-size: 20px; margin: 28px 0 6px; }
  p, li { color: var(--muted); }
  ul { padding-left: 1.2em; }
  li { margin-bottom: 10px; }
  a { color: var(--brand); text-underline-offset: 2px; overflow-wrap: anywhere; }
  .date { margin-top: 0; font-size: 15px; }
  .card { background: var(--surface); border: 1px solid var(--line); border-radius: 16px; padding: 4px 20px 12px; margin-top: 20px; }
  footer { margin-top: 40px; font-size: 14px; color: var(--muted); border-top: 1px solid var(--line); padding-top: 16px; }
  nav a { margin-right: 16px; }
</style>
</head>
<body><main>
<header>${favicon.replace(/<\?xml[^>]*>/, '')}<a href="./">PawTyk</a></header>
${body}
<footer><nav><a href="./">Home</a><a href="privacy.html">Privacy policy</a><a href="support.html">Support</a></nav><p>© ${new Date().getFullYear()} ${esc(PUBLISHER)}. All rights reserved.</p></footer>
</main></body>
</html>
`;
}

const privacy = page(
  'Privacy policy · PawTyk',
  'What PawTyk keeps, and what it never asks for.',
  `<h1>Privacy policy</h1>
<p class="date">Last updated <time datetime="${POLICY_UPDATED}">${POLICY_UPDATED_TEXT}</time></p>
${policyHtml(contact, 2)}`,
);

const support = page(
  'Support · PawTyk',
  'Help with PawTyk, and how to reach us.',
  `<h1>Support</h1>
<p>Questions, a problem, or an idea? Email <a href="mailto:${esc(contact)}">${esc(contact)}</a> and we'll get back to you. Telling us your device and what you were doing helps.</p>
<section class="card">
<h2>Where is my progress?</h2>
<p>On your device. PawTyk plays fully offline and has no accounts. Your progress comes with you when you restore your phone from a backup.</p>
<h2>How do I start over?</h2>
<p>Settings → Erase progress. Purchases and settings are kept.</p>
<h2>How do I play?</h2>
<p>Put one animal in every row, every column and every color. The first levels teach the rules one at a time, and Settings → How to play shows them with pictures.</p>
<h2>A purchase is missing</h2>
<p>If your version of PawTyk sells anything, open the Shop's Gems tab and tap Restore purchases. If that doesn't help, email us with the date of the purchase.</p>
</section>
<p>Read our <a href="privacy.html">privacy policy</a>.</p>`,
);

// M3: the page shared cards link to. The App Store link only once there is a listing (never guessed); until then it says so.
const storeUrl = /^https:\/\/apps\.apple\.com\/[^\s]+\/id\d+/.test((env.VITE_APP_STORE_URL ?? '').trim()) ? env.VITE_APP_STORE_URL!.trim() : null;
const home = page(
  'PawTyk · a cozy logic puzzle',
  'PawTyk: one animal in every row, column and color. Solve puzzles, and sanctuaries grow.',
  `<h1>PawTyk</h1>
<p>A cozy logic puzzle. Put one animal in every row, column and color. Every puzzle you solve grows a sanctuary, and its animals come home.</p>
<section class="card">
<h2>Play PawTyk</h2>
${storeUrl ? `<p><a href="${esc(storeUrl)}">Get PawTyk on the App Store</a> for iPhone. It's free to play, with no account.</p>` : `<p>PawTyk is coming to the App Store for iPhone. It will be free to play, with no account.</p>`}
<p>A friend sent you a Daily Puzzle result or a postcard? Everyone gets the same Daily Puzzle each day, so you can compare your hearts and time.</p>
</section>
<p><a href="support.html">Support</a> · <a href="privacy.html">Privacy policy</a></p>`,
);

mkdirSync(OUT, { recursive: true });
writeFileSync(`${OUT}/privacy.html`, privacy);
writeFileSync(`${OUT}/support.html`, support);
writeFileSync(`${OUT}/index.html`, home);
console.log(`site: ${OUT}/index.html, privacy.html, support.html (contact ${contact})`);
