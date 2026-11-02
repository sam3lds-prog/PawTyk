import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';
import { STORE_PRODUCTS } from '../../src/config/services';
import { KV_SEQ_KEY } from '../../src/services/kv';
import { APP_KEY_PREFIXES, SESSIONS_SIDE_KEY, V1_BACKUP_KEY, V2_KEY } from '../../src/services/storage';

const ROOT = join(__dirname, '../..');

function filesUnder(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) filesUnder(p, out);
    else if (/\.(ts|css|html)$/.test(name)) out.push(p);
  }
  return out;
}

describe('the game is called PawTyk (D42)', () => {
  it('says PawTyk wherever a player or the App Store can see a name', () => {
    expect(config.appName).toBe('PawTyk');
    const html = readFileSync(join(ROOT, 'index.html'), 'utf8');
    expect(html).toContain('<title>PawTyk</title>');
    // The old display name is gone from the app's code, styles and page (lowercase ids are checked below).
    const stale = [join(ROOT, 'index.html'), ...filesUnder(join(ROOT, 'src'))].filter((f) => readFileSync(f, 'utf8').includes('Pawtopia'));
    expect(stale.map((f) => f.slice(ROOT.length + 1))).toEqual([]);
  });

  it('keeps the bundle id, save keys, seeds and product ids, so saves, places and purchases carry over', () => {
    expect(config.appId).toBe('com.sam3lds.catsvsdogs');
    expect(V2_KEY).toBe('pawtopia.save.v2');
    expect(V1_BACKUP_KEY).toBe('pawtopia.backup.cvd.progress.v1');
    expect(SESSIONS_SIDE_KEY).toBe('pawtopia.sessions.v1');
    expect(KV_SEQ_KEY).toBe('pawtopia.kv.seq');
    expect(readFileSync(join(ROOT, 'src/services/leaderboard.ts'), 'utf8')).toContain("const DEVICE_KEY = 'pawtopia.lb.device';");
    expect(APP_KEY_PREFIXES).toEqual(['pawtopia.', 'cvd.']);
    expect(STORE_PRODUCTS).toEqual({
      remove_ads: 'pawtopia.removeads',
      gems_60: 'pawtopia.gems.60',
      gems_160: 'pawtopia.gems.160',
      gems_420: 'pawtopia.gems.420',
    });
    const places = readFileSync(join(ROOT, 'src/meta/catalogs/places.ts'), 'utf8');
    expect(places).toContain('`pawtopia-places-v${PLACES_VERSION}:');
    expect(readFileSync(join(ROOT, 'src/meta/chapters.ts'), 'utf8')).toContain("hashString('pawtopia-chapters-v1')");
  });
});
