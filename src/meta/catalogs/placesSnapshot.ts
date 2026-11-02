/** A compact, stable summary of the endless world's first places, for the fixture that pins them (D39). */
import { placeDef } from './places';

export function placesSnapshot(n: number): unknown[] {
  const out: unknown[] = [];
  for (let k = 1; k <= n; k++) {
    const p = placeDef(k);
    out.push({
      id: p.id,
      name: p.name,
      biome: p.biome,
      look: p.look,
      mirror: p.mirror,
      place: p.place,
      pin: [p.lon, p.lat],
      opens: p.opensAfterLevel,
      accent: p.accent,
      animals: p.animals.map((a) => [a.id, a.at, a.base, a.kind || null, a.name, a.coat.name, a.neckerchief, a.trait]),
    });
  }
  return out;
}
