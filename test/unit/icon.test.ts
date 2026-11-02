import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { faviconSvg, iconSvg } from '../../scripts/iconArt';

const ROOT = join(__dirname, '../..');
const read = (f: string) => readFileSync(join(ROOT, f));

/** Width, height, bit depth and color type from a PNG's header. */
function pngInfo(buf: Buffer) {
  expect(buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe(true);
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20), depth: buf[24], colorType: buf[25] };
}

describe('the PawTyk icon (D42)', () => {
  it('the committed art is what scripts/iconArt.ts draws (teal, winking)', () => {
    expect(read('assets/icon.svg').toString()).toBe(iconSvg());
    expect(read('public/favicon.svg').toString()).toBe(faviconSvg());
  });

  it('the App Store icon is 1024 × 1024 with no alpha channel, and the touch icon is 180 × 180', () => {
    // Color type 2 is RGB: App Store Connect rejects an app icon with an alpha channel.
    expect(pngInfo(read('assets/icon-only.png'))).toEqual({ width: 1024, height: 1024, depth: 8, colorType: 2 });
    expect(pngInfo(read('public/apple-touch-icon.png'))).toEqual({ width: 180, height: 180, depth: 8, colorType: 2 });
  });

  it('is square and opaque, uses the game colors, and every variant draws', () => {
    const svg = iconSvg();
    expect(svg).toContain('viewBox="0 0 1024 1024"');
    expect(svg).toMatch(/<rect width="1024" height="1024" fill="url\(#pt-teal-bg\)"\/>/); // a full-bleed background
    expect(svg).toContain('#F3A762'); // Pip's fur
    expect(svg).toContain('<title>PawTyk</title>');
    for (const style of ['teal', 'sunny', 'berry'] as const)
      for (const wink of [true, false]) {
        const v = iconSvg({ style, wink });
        expect(v).not.toMatch(/NaN|undefined/);
        expect(v.match(/<svg/g)).toHaveLength(1);
      }
    expect(iconSvg({ wink: false })).not.toBe(iconSvg());
  });

  it('the page links the favicon and the touch icon', () => {
    const html = read('index.html').toString();
    expect(html).toContain('href="./favicon.svg"');
    expect(html).toContain('rel="apple-touch-icon" href="./apple-touch-icon.png"');
  });
});
