/**
 * Draws every species of the endless world (D39 PR E) on one HTML page: its portrait, a happy and a sleepy face, and its
 * figure standing in a little scene, with its name, where it lives and its fact. For checking the kit's drawings by eye.
 *
 *   npx tsx scripts/species-gallery.ts [out.html] [--module path/to/list.ts] [--only biome]
 */

import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';
import type { SpeciesDef } from '../src/meta/catalogs/species/types';
import { face } from '../src/ui/art/companions';
import { kitBody, kitHead, kitPal, kitScale } from '../src/ui/art/kit';

const args = process.argv.slice(2);
const out = args.find((a) => a.endsWith('.html')) ?? 'species-gallery.html';
const modIdx = args.indexOf('--module');
const onlyIdx = args.indexOf('--only');

async function load(): Promise<SpeciesDef[]> {
  if (modIdx >= 0) {
    const m = await import(pathToFileURL(resolve(args[modIdx + 1])).href);
    // Every exported list of species (a landscape file also exports names and place words).
    return (Object.values(m).filter(Array.isArray).flat() as SpeciesDef[]).filter((s) => s && typeof s === 'object' && 'form' in s);
  }
  const m = await import('../src/meta/catalogs/species/index');
  return [...m.SPECIES];
}

function portrait(s: SpeciesDef, mood: 'idle' | 'happy' | 'sleepy'): string {
  const d = kitHead(s);
  const p = kitPal(s.colors);
  return `<svg viewBox="0 0 64 64" width="72" height="72">${d.art(p)}${face(mood, d.face(p))}</svg>`;
}

function figure(s: SpeciesDef): string {
  const p = kitPal(s.colors);
  const H = 46 * kitScale(s);
  const x = 60;
  const y = 104;
  const f = kitBody(s, p, x, y, H);
  const d = kitHead(s);
  const head = `<g transform="translate(${f.headX.toFixed(1)} ${f.headTop.toFixed(1)}) scale(${f.k.toFixed(3)})">${d.art(p)}${face('idle', d.face(p))}</g>`;
  return `<svg viewBox="0 0 120 120" width="120" height="120"><rect width="120" height="120" fill="#DCEFD8"/><rect y="96" width="120" height="24" fill="#B9DBA8"/>${f.behind}${f.body}<g>${f.tail}</g>${head}</svg>`;
}

const list = await load();
const shown = onlyIdx >= 0 ? list.filter((s) => s.biome === args[onlyIdx + 1]) : list;
const byBiome = new Map<string, SpeciesDef[]>();
for (const s of shown) byBiome.set(s.biome, [...(byBiome.get(s.biome) ?? []), s]);
const esc = (t: string) => t.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const html = `<!doctype html><meta charset="utf-8"><title>Species gallery</title>
<style>body{font:13px system-ui;margin:16px;background:#FAF7F0;color:#2F2A27}h2{margin:24px 0 8px}.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}
.c{background:#fff;border-radius:12px;padding:8px;display:grid;grid-template-columns:auto 1fr;gap:6px;align-items:center}.c b{font-size:14px}.f{grid-column:1/-1;display:flex;gap:4px;align-items:center}.m{color:#6E6A64;font-size:11px}</style>
<h1>${shown.length} species</h1>
${[...byBiome]
  .map(
    ([b, ss]) =>
      `<h2>${b} · ${ss.length}</h2><div class="grid">${ss
        .map(
          (s) =>
            `<div class="c" id="${s.id}"><div>${portrait(s, 'idle')}</div><div><b>${esc(s.name)}</b><div class="m">${esc(s.from)}</div><div class="m">${esc(s.fact)}</div></div><div class="f">${figure(s)}${portrait(s, 'happy')}${portrait(s, 'sleepy')}</div></div>`,
        )
        .join('')}</div>`,
  )
  .join('')}`;
writeFileSync(out, html);
console.log(`${shown.length} species → ${out}`);
