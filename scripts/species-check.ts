/**
 * Checks species lists against the kit's vocabulary (D39 PR E): every part word known, ids unique and well formed,
 * colors valid hex, facts short, and nothing a hand-drawn animal already is.
 *
 *   npx tsx scripts/species-check.ts                       # the whole catalog
 *   npx tsx scripts/species-check.ts --module path.ts      # one list (any exported array)
 */

import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { SpeciesDef } from '../src/meta/catalogs/species/types';
import { speciesProblems } from '../src/meta/catalogs/species/vocabulary';

const args = process.argv.slice(2);
const modIdx = args.indexOf('--module');
let list: SpeciesDef[];
if (modIdx >= 0) {
  const m = await import(pathToFileURL(resolve(args[modIdx + 1])).href);
  list = Object.values(m).filter(Array.isArray).flat() as SpeciesDef[];
  list = list.filter((s) => s && typeof s === 'object' && 'form' in s);
} else {
  list = [...(await import('../src/meta/catalogs/species/index')).SPECIES];
}
const problems = speciesProblems(list);
for (const p of problems) console.log(`✗ ${p}`);
const byBiome = new Map<string, number>();
for (const s of list) byBiome.set(s.biome, (byBiome.get(s.biome) ?? 0) + 1);
console.log(`${list.length} species (${[...byBiome].map(([b, n]) => `${b} ${n}`).join(', ')}): ${problems.length ? `${problems.length} problems` : 'all good'}`);
process.exit(problems.length ? 1 : 0);
