/**
 * Writes (or, without --write, checks) the fixture that pins the endless world (D39): its first places and a sample to
 * place 1000 in full (names, landscapes, looks, pins, animals), and every list a place is made from (each landscape's
 * species in order, names, words, zones, looks, accents, stages). Saves keep growth and arrivals by place and animal id, so a shipped place must never
 * change; `test/unit/places.test.ts` compares the generator with this file.
 *
 *   npx tsx scripts/places-fixture.ts          # check
 *   npx tsx scripts/places-fixture.ts --write  # regenerate (only together with a PLACES_VERSION bump)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { worldFixture } from '../src/meta/catalogs/placesSnapshot';

const FILE = 'test/unit/fixtures/places-v1.json';
const now = JSON.stringify(worldFixture(), null, 1) + '\n';
if (process.argv.includes('--write')) {
  writeFileSync(FILE, now);
  console.log(`wrote ${FILE}`);
} else {
  const was = readFileSync(FILE, 'utf8');
  if (was !== now) {
    console.error(`${FILE} differs from the generator: a shipped place would change.`);
    process.exit(1);
  }
  console.log('places: identical');
}
