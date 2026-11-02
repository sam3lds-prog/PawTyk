/**
 * Writes (or, without --write, checks) the fixture that pins the endless world's first places (D39): their names,
 * biomes, looks, pins and animals. Saves keep growth and arrivals by place and animal id, so a shipped place must never
 * change; `test/unit/places.test.ts` compares the generator with this file.
 *
 *   npx tsx scripts/places-fixture.ts          # check
 *   npx tsx scripts/places-fixture.ts --write  # regenerate (only together with a PLACES_VERSION bump)
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { placesSnapshot } from '../src/meta/catalogs/placesSnapshot';

const FILE = 'test/unit/fixtures/places-v1.json';
const now = JSON.stringify(placesSnapshot(40), null, 1) + '\n';
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
