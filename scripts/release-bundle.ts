/**
 * The App Store bundle, checked (D46 PR D). Builds what `vite build` makes for a release (no tester flag), in a
 * temporary folder, and checks what App Review and players will get:
 *
 *  - no tester code: the tester shortcuts, the device checks (Performance check, frame-rate counter, Listen to every
 *    tune) and the dev hooks (`window.__pt`, the scene director, the 3D layer) are all left out;
 *  - the in-app privacy policy is there;
 *  - the app icon is 1024 × 1024 with no alpha channel (App Store Connect rejects one with alpha), and the home-screen
 *    and browser icons are linked;
 *  - the app keeps its name and its bundle id (an update to the existing App Store app, D9 / D42).
 *
 *   npm run release:bundle        (also run by `npm run release:check`, and in CI)
 *
 * Exits 1 if anything is wrong. Settings (contact address, privacy URL) are `release:check`'s job.
 */
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { build } from 'vite';

/** What only a tester build may contain. Each is specific enough not to match ordinary code or text. */
export const TESTER_MARKERS: ReadonlyArray<[string, RegExp]> = [
  ['the tester shortcuts', /Tester shortcuts/],
  ['Skip to level (tester)', /Skip to level \d/],
  ['the Performance check', /Performance check/],
  ['the frame-rate counter', /qa-fps/],
  ['Listen to every tune', /Listen to every tune/],
  ['the dev hook window.__pt', /\.__pt\s*=|__pt:/],
  ['the scene director dev hook', /__director/],
  ['the 3D layer dev hooks', /__s3d|__scene3dStats|__stage3d/],
  ['the walk dev hook', /["'`]__walk["'`]/],
  ['the camera and welcome dev hooks', /\.__cam\s*=|__cam:|__welcome/],
  ['the photo mode dev hook (D47)', /__photoStats/],
];

/** Width, height, bit depth and colour type of a PNG (type 2: RGB, 6: RGB with alpha). */
export function pngHeader(buf: Buffer): { w: number; h: number; depth: number; color: number } | null {
  if (buf.length < 26 || buf.toString('ascii', 12, 16) !== 'IHDR') return null;
  return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20), depth: buf[24], color: buf[25] };
}

/** Checks a built bundle's files (path → text). Returns the problems found. */
export function checkBundle(files: Record<string, string>): string[] {
  const problems: string[] = [];
  const js = Object.entries(files).filter(([p]) => p.endsWith('.js'));
  if (!js.length) problems.push('The build has no JavaScript.');
  for (const [what, re] of TESTER_MARKERS) {
    const hit = js.find(([, text]) => re.test(text));
    if (hit) problems.push(`Tester code in the release bundle: ${what} (${hit[0]}).`);
  }
  if (!js.some(([, text]) => /What PawTyk keeps|privacy/i.test(text) && /Aeonix Ventures/.test(text)))
    problems.push('The in-app privacy policy (Settings → Privacy policy) is missing from the bundle.');
  const html = files['index.html'] ?? '';
  if (!/<title>PawTyk<\/title>/.test(html)) problems.push('index.html: the page title should be PawTyk.');
  if (!/rel="apple-touch-icon"/.test(html)) problems.push('index.html: the apple-touch-icon link is missing.');
  return problems;
}

function readTree(dir: string, base = dir, out: Record<string, string> = {}): Record<string, string> {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) readTree(p, base, out);
    else if (/\.(js|html|css)$/.test(name)) out[p.slice(base.length + 1)] = readFileSync(p, 'utf8');
  }
  return out;
}

async function main(): Promise<void> {
  const problems: string[] = [];
  const icon = pngHeader(readFileSync('assets/icon-only.png'));
  if (!icon || icon.w !== 1024 || icon.h !== 1024) problems.push('assets/icon-only.png must be 1024 × 1024.');
  else if (icon.color !== 2) problems.push('assets/icon-only.png has an alpha channel (or isn’t RGB): App Store Connect will reject it. Run npm run icons.');
  const cap = readFileSync('capacitor.config.ts', 'utf8');
  if (!/appId:\s*'com\.sam3lds\.catsvsdogs'/.test(cap)) problems.push("capacitor.config.ts: appId must stay 'com.sam3lds.catsvsdogs' (an update to the existing App Store app).");
  if (!/appName:\s*'PawTyk'/.test(cap)) problems.push("capacitor.config.ts: appName should be 'PawTyk'.");

  const out = mkdtempSync(join(tmpdir(), 'pawtyk-release-'));
  // The release build: the tester flag off whatever the shell or .env.local says.
  process.env.VITE_QA = '';
  try {
    await build({ logLevel: 'warn', build: { outDir: out, emptyOutDir: true } });
    const files = readTree(out);
    problems.push(...checkBundle(files));
    const kb = Math.round(Object.entries(files).filter(([p]) => p.endsWith('.js')).reduce((n, [, t]) => n + Buffer.byteLength(t), 0) / 1024);
    console.log(`PawTyk release bundle: ${Object.keys(files).length} files, ${kb} KB of JavaScript (before compression).`);
  } finally {
    rmSync(out, { recursive: true, force: true });
  }
  if (problems.length) {
    console.log('\nThe release bundle needs fixing:');
    for (const p of problems) console.log(`  ✗ ${p}`);
    process.exit(1);
  }
  console.log('  ✓ No tester code (shortcuts, device checks, dev hooks)');
  console.log('  ✓ The privacy policy is in the app');
  console.log('  ✓ Icon 1024 × 1024, no alpha; home-screen icon linked');
  console.log('  ✓ Name PawTyk, bundle id unchanged');
}

if (process.argv[1]?.endsWith('release-bundle.ts')) void main();
