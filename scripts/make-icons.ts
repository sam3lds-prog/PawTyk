/**
 * Writes the PawTyk icon (D42) and renders its PNG sizes.
 *
 *   npm run icons                       teal background, Pip winking (the shipped icon)
 *   npm run icons -- --style sunny      or berry; --open for both eyes open
 *   npm run icons -- --check            fails if the committed SVGs differ from what this would write
 *
 * Writes:
 *   assets/icon.svg            the master art (1024 × 1024, square, opaque)
 *   assets/icon-only.png       1024 × 1024, no alpha: the App Store icon. Xcode 14+ needs only this one size
 *                              (App/Assets.xcassets → AppIcon, "Single Size"); `npx @capacitor/assets generate --ios`
 *                              reads it from here too
 *   public/favicon.svg         Pip's face alone, for browser tabs (and the tester page)
 *   public/apple-touch-icon.png  180 × 180, for "Add to Home Screen" from Safari
 *
 * Rendering uses Playwright's Chromium, like the e2e smoke test (`npm i -D playwright && npx playwright install chromium`
 * once, or CHROME_PATH=/path/to/chrome).
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { faviconSvg, iconSvg, type IconStyle } from './iconArt';

const args = process.argv.slice(2);
const styleAt = args.indexOf('--style');
const style = (styleAt >= 0 ? args[styleAt + 1] : 'teal') as IconStyle;
if (!['teal', 'sunny', 'berry'].includes(style)) throw new Error(`unknown --style ${style} (teal, sunny or berry)`);
const icon = iconSvg({ style, wink: !args.includes('--open') });
const fav = faviconSvg();

if (args.includes('--check')) {
  const same = readFileSync('assets/icon.svg', 'utf8') === icon && readFileSync('public/favicon.svg', 'utf8') === fav;
  console.log(same ? 'icons: identical' : 'icons: assets/icon.svg or public/favicon.svg differs; run npm run icons');
  process.exit(same ? 0 : 1);
}

mkdirSync('assets', { recursive: true });
writeFileSync('assets/icon.svg', icon);
writeFileSync('public/favicon.svg', fav);

type Chromium = { launch(o: object): Promise<{ newPage(o: object): Promise<Page>; close(): Promise<void> }> };
type Page = { setContent(html: string): Promise<void>; waitForTimeout(ms: number): Promise<void>; screenshot(o: object): Promise<Buffer> };
let chromium: Chromium | undefined;
const PLAYWRIGHT = 'playwright'; // a plain string, so the type check doesn't need Playwright installed
try {
  ({ chromium } = (await import(PLAYWRIGHT)) as { chromium: Chromium });
} catch {
  try {
    ({ chromium } = createRequire(import.meta.url)(PLAYWRIGHT) as { chromium: Chromium });
  } catch {
    /* reported below */
  }
}
if (!chromium) {
  console.error('Wrote the SVGs. Rendering the PNGs needs Playwright: npm i -D playwright && npx playwright install chromium');
  process.exit(1);
}

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});

/** Renders the icon at `size` px as an opaque PNG (Chrome writes RGB, no alpha channel, for an opaque page). */
async function render(size: number, out: string): Promise<void> {
  const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
  const src = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
  await page.setContent(`<html><body style="margin:0;background:#1F6E64"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`);
  await page.waitForTimeout(150);
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  // PNG header: width, height (bytes 16–23), bit depth 8 and color type 2 (RGB, no alpha) at bytes 24–25.
  if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size || png[24] !== 8 || png[25] !== 2)
    throw new Error(`${out}: expected an 8-bit RGB PNG of ${size} px`);
  writeFileSync(out, png);
}

await render(1024, 'assets/icon-only.png');
await render(180, 'public/apple-touch-icon.png');
await browser.close();
console.log(`icons: ${style}${args.includes('--open') ? ', eyes open' : ', winking'} → assets/icon.svg, assets/icon-only.png, public/favicon.svg, public/apple-touch-icon.png`);
