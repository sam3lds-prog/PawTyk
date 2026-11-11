/**
 * D46 PR D: the App Store bundle check. A release bundle with no tester code, the privacy policy and the icon links
 * passes; any tester shortcut, device check or dev hook in it fails, and so does an icon with alpha.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { checkBundle, pngHeader, TESTER_MARKERS } from '../../scripts/release-bundle';

const html = '<title>PawTyk</title><link rel="apple-touch-icon" href="./apple-touch-icon.png" />';
const app = 'const policy = "What PawTyk keeps … Aeonix Ventures LLC"; const lb = `<span class="lb-me__pts">`;';

describe('the release bundle check (D46 PR D)', () => {
  it('passes a clean release bundle (and the leaderboard’s lb-me__pts class is not the __pt dev hook)', () => {
    expect(checkBundle({ 'index.html': html, 'assets/boot.js': app })).toEqual([]);
  });

  it('fails on each kind of tester code', () => {
    const samples = ['"Tester shortcuts"', 'Skip to level 41', 'title:"Performance check"', 'className="qa-fps"', '"Listen to every tune"', 'window.__pt={app}', 'window.__director=d', 'window.__s3d=s', 'defineProperty(window,"__walk",{})', 'window.__cam=c', 'window.__welcome=w', 'window.__photoStats=p'];
    for (const s of samples) expect(checkBundle({ 'index.html': html, 'assets/boot.js': app + s }).length, s).toBe(1);
    expect(TESTER_MARKERS.length).toBeGreaterThanOrEqual(samples.length - 1);
  });

  it('fails without the privacy policy, the title or the home-screen icon', () => {
    expect(checkBundle({ 'index.html': html, 'assets/boot.js': 'x' })).toHaveLength(1);
    expect(checkBundle({ 'index.html': '<title>PawTyk</title>', 'assets/boot.js': app })).toHaveLength(1);
  });

  it('reads the shipped icon: 1024 × 1024, 8-bit RGB with no alpha', () => {
    expect(pngHeader(readFileSync('assets/icon-only.png'))).toEqual({ w: 1024, h: 1024, depth: 8, color: 2 });
    expect(pngHeader(Buffer.from('not a png'))).toBeNull();
  });
});
