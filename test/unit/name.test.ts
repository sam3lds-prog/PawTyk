import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import config from '../../capacitor.config';
import { STORE_PRODUCTS } from '../../src/config/services';
import { KV_SEQ_KEY } from '../../src/services/kv';
import { APP_KEY_PREFIXES, SESSIONS_SIDE_KEY, V1_BACKUP_KEY, V2_KEY } from '../../src/services/storage';
import { chapterAt } from '../../src/meta/chapters';

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
    expect(html).toContain('<meta name="apple-mobile-web-app-title" content="PawTyk" />');
    // The old display name is gone from the app's code, styles, page, native config and tester page (lowercase ids are
    // checked below).
    const shipped = [join(ROOT, 'index.html'), join(ROOT, 'capacitor.config.ts'), join(ROOT, 'scripts/make-artifact.mjs'), ...filesUnder(join(ROOT, 'src'))];
    const stale = shipped.filter((f) => readFileSync(f, 'utf8').includes('Pawtopia'));
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
      // New in D47, so it takes the new name; the ones above already exist in App Store Connect and keep theirs.
      welcome_pack: 'pawtyk.welcomepack',
    });
    // Generated places are pinned by the places fixture (places.test.ts); chapter names past the hand-named ones come
    // from a seed with the old name too, so a few are pinned here: a changed seed would rename them in every save.
    expect([5, 6, 7, 15, 40, 200, 1000].map((i) => chapterAt(i).name)).toEqual([
      'Bramble Path',
      'Saffron Brook',
      'Juniper Dell',
      'Comet Brook',
      'Amber Ridge',
      'Clover Bend',
      'Clover Bend 5',
    ]);
  });
});
