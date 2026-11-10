/**
 * Renders the PawTyk icon (D42) and writes its files.
 *
 *   npm run icons                       the shipped icon (the sky set by ICON_STYLE in scripts/iconArt.ts)
 *   npm run icons -- --style golden     a preview of another sky (or dusk) in artifact/icon-golden.png; nothing shipped changes
 *   npm run icons -- --check            fails if a committed file differs from what this would write
 *
 * Writes:
 *   assets/icon.svg              the master art (1024 × 1024, square, opaque)
 *   assets/icon-only.png         1024 × 1024, no alpha: the App Store icon. Xcode 14+ needs only this one size
 *                                (App/Assets.xcassets → AppIcon, "Single Size"); `npx @capacitor/assets generate --ios`
 *                                reads it from here too
 *   public/favicon.svg           the barn alone, for browser tabs (and the tester page)
 *   public/apple-touch-icon.png  180 × 180, for "Add to Home Screen" from Safari
 *
 * Each PNG carries the SHA-256 of the SVG it was rendered from (a tEXt chunk, `pawtyk:svg-sha256`), so a test can tell
 * a PNG left over from older art. The PNGs are rendered first and the SVGs written last, so a failed render never
 * leaves new SVGs beside old PNGs.
 *
 * Rendering uses Playwright's Chromium, like the e2e smoke test (`npm i -D playwright && npx playwright install chromium`
 * once, or CHROME_PATH=/path/to/chrome).
 */

import { createHash } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { crc32 } from 'node:zlib';
import { ICON_STYLE, faviconSvg, iconSvg, type IconStyle } from './iconArt';

export const FINGERPRINT_KEY = 'pawtyk:svg-sha256';
export const sha256 = (text: string) => createHash('sha256').update(text).digest('hex');

/** Reads a PNG's tEXt chunks (keyword → text). */
export function pngText(png: Buffer): Record<string, string> {
  const out: Record<string, string> = {};
  for (let at = 8; at + 8 <= png.length; ) {
    const len = png.readUInt32BE(at);
    const type = png.toString('latin1', at + 4, at + 8);
    if (type === 'tEXt') {
      const data = png.subarray(at + 8, at + 8 + len);
      const nul = data.indexOf(0);
      out[data.toString('latin1', 0, nul)] = data.toString('latin1', nul + 1);
    }
    at += 12 + len;
  }
  return out;
}

/** Adds a tEXt chunk right after IHDR. */
function withText(png: Buffer, key: string, text: string): Buffer {
  const data = Buffer.from(`${key}\0${text}`, 'latin1');
  const head = Buffer.alloc(8);
  head.writeUInt32BE(data.length, 0);
  head.write('tEXt', 4, 'latin1');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([head.subarray(4), data])) >>> 0, 0);
  const ihdrEnd = 8 + 12 + png.readUInt32BE(8);
  return Buffer.concat([png.subarray(0, ihdrEnd), head, data, crc, png.subarray(ihdrEnd)]);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const styleAt = args.indexOf('--style');
  const style = (styleAt >= 0 ? args[styleAt + 1] : ICON_STYLE) as IconStyle;
  if (!['day', 'golden', 'dusk'].includes(style)) throw new Error(`unknown --style ${style} (day, golden or dusk)`);
  const preview = style !== ICON_STYLE;
  const icon = iconSvg({ style });
  const fav = faviconSvg();

  if (args.includes('--check')) {
    const sum = sha256(iconSvg());
    const problems = [
      readFileSync('assets/icon.svg', 'utf8') !== iconSvg() && 'assets/icon.svg',
      readFileSync('public/favicon.svg', 'utf8') !== fav && 'public/favicon.svg',
      pngText(readFileSync('assets/icon-only.png'))[FINGERPRINT_KEY] !== sum && 'assets/icon-only.png',
      pngText(readFileSync('public/apple-touch-icon.png'))[FINGERPRINT_KEY] !== sum && 'public/apple-touch-icon.png',
    ].filter(Boolean);
    console.log(problems.length ? `icons: ${problems.join(', ')} differ; run npm run icons` : 'icons: identical');
    process.exit(problems.length ? 1 : 0);
  }

  type Page = { setContent(html: string): Promise<void>; waitForTimeout(ms: number): Promise<void>; screenshot(o: object): Promise<Buffer> };
  type Browser = { newPage(o: object): Promise<Page>; close(): Promise<void> };
  type Chromium = { launch(o: object): Promise<Browser> };
  const PLAYWRIGHT = 'playwright'; // a plain string, so the type check doesn't need Playwright installed
  let chromium: Chromium | undefined;
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
    console.error('Rendering the icon needs Playwright: npm i -D playwright && npx playwright install chromium. Nothing was written.');
    process.exit(1);
  }

  const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
  /** Renders the icon at `size` px as an opaque PNG (Chrome writes RGB, no alpha channel, for an opaque page). */
  const render = async (size: number): Promise<Buffer> => {
    const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    const src = `data:image/svg+xml;base64,${Buffer.from(icon).toString('base64')}`;
    await page.setContent(`<html><body style="margin:0;background:#6FC2EA"><img src="${src}" width="${size}" height="${size}" style="display:block"></body></html>`);
    await page.waitForTimeout(150);
    const png = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
    // PNG header: width, height (bytes 16–23), bit depth 8 and color type 2 (RGB, no alpha) at bytes 24–25.
    if (png.readUInt32BE(16) !== size || png.readUInt32BE(20) !== size || png[24] !== 8 || png[25] !== 2)
      throw new Error(`expected an 8-bit RGB PNG of ${size} px`);
    return withText(png, FINGERPRINT_KEY, sha256(icon));
  };
  const big = await render(1024);
  const touch = preview ? null : await render(180);
  await browser.close();

  if (preview) {
    mkdirSync('artifact', { recursive: true });
    writeFileSync(`artifact/icon-${style}.png`, big);
    console.log(`icons: a ${style} preview in artifact/icon-${style}.png; the shipped icon (${ICON_STYLE}) is unchanged`);
    return;
  }
  mkdirSync('assets', { recursive: true });
  writeFileSync('assets/icon-only.png', big);
  writeFileSync('public/apple-touch-icon.png', touch as Buffer);
  writeFileSync('assets/icon.svg', icon);
  writeFileSync('public/favicon.svg', fav);
  console.log(`icons: ${style} → assets/icon-only.png, public/apple-touch-icon.png, assets/icon.svg, public/favicon.svg`);
}

// Run only as a script (the test imports the PNG helpers).
if (process.argv[1] && /make-icons\.ts$/.test(process.argv[1])) await main();
