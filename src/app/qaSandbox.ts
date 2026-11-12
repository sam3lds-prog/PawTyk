/**
 * D52 PR B: visit a place of the endless world in a sandbox, in tester builds only (`featureFlags.qaTools`).
 *
 * The visit runs on a temporary copy of the save in which place k is open (empty, partly grown or complete) and being
 * built. While it lasts, nothing is written to storage (`app.holdWrites`), so whatever happens in the home — a trick,
 * a meal, a decoration, a tap on Play — changes the copy only. Leaving the home (the banner's *Leave preview*, Back,
 * a tab, a reload) ends it, and the player's own save comes back exactly as it was: the same object, checked against
 * the snapshot taken on the way in, and restored from that snapshot if anything had touched it.
 *
 * It never loops over levels (no `skipToLevel` to place 9999): the copy's Journey level is set once, and only the
 * previewed place's arrivals are recorded.
 */

import { app } from './app';
import { featureFlags } from '../config/featureFlags';
import { normalizeSave, type SaveV2 } from '../services/storage';
import { placeDef, type PlaceId } from '../meta/catalogs/places';
import { welcomeAnimal } from '../meta/animals';
import { clampPlace } from '../meta/placePreview';
import type { CanonicalRoute } from '../ui/router';
import { esc, h } from '../ui/dom';
import { ICON } from '../ui/icons';
import { toast } from '../ui/components/sheet';

export type SandboxState = 'empty' | 'growing' | 'complete';

export const SANDBOX_STATES: ReadonlyArray<{ id: SandboxState; label: string }> = [
  { id: 'empty', label: 'Empty' },
  { id: 'growing', label: 'Partly grown' },
  { id: 'complete', label: 'Complete' },
];

/**
 * The sandbox copy: the player's save (deep-copied, never shared), with place k open in the chosen state and set as
 * the home being built. Pure: `real` is not touched.
 */
export function sandboxSave(real: SaveV2, k: number, state: SandboxState, now = new Date()): SaveV2 {
  const s = normalizeSave(JSON.parse(JSON.stringify(real)), now);
  const def = placeDef(clampPlace(k));
  const last = def.stages[def.stages.length - 1].at;
  const growth = state === 'empty' ? 0 : state === 'growing' ? def.stages[2].at : Math.max(last, ...def.arrivals.map((a) => a.at));
  // Open by its own level (an empty place has not grown, so growth alone wouldn't open it).
  s.journey.nextLevel = Math.max(s.journey.nextLevel, def.opensAfterLevel + 1);
  s.world.growth[def.id] = growth;
  // Residents follow the chosen state, not the player's own progress there (review of D52 PR B): an Empty preview of a
  // place the player finished shows nobody home.
  for (const a of def.arrivals) delete s.inventory.companions[a.id];
  for (const a of def.arrivals) if (a.at <= growth) welcomeAnimal(s, a.id, now);
  s.world.active = def.id;
  return s;
}

interface Session {
  real: SaveV2;
  snapshot: string;
  active: typeof app.active;
  id: PlaceId;
  banner: HTMLElement;
}
let session: Session | null = null;

export const inSandbox = (): boolean => session !== null;
export const sandboxPlace = (): PlaceId | null => session?.id ?? null;

/** Opens place k in a sandbox and goes there. Tester builds only; does nothing in a release build. */
export function enterSandbox(k: number, state: SandboxState): boolean {
  if (!featureFlags.qaTools) return false;
  if (session) leaveSandbox({ quiet: true });
  const def = placeDef(clampPlace(k));
  const real = app.save;
  const banner = h(`<div class="qa-sandbox" role="status" data-qa-sandbox>
      <span class="qa-sandbox__text">${ICON.info}<span><b>Sandbox preview</b> · Place ${def.index}, ${esc(def.name)} · nothing here is saved</span></span>
      <button class="btn btn--small qa-sandbox__leave" data-act="leave-sandbox">Leave preview</button>
    </div>`);
  session = { real, snapshot: JSON.stringify(real), active: app.active, id: def.id, banner };
  app.holdWrites = true;
  app.active = null;
  app.save = sandboxSave(real, def.index, state);
  document.body.appendChild(banner);
  // While the way in is being drawn, a redraw of the screen being left (a sheet's close asking for a refresh as it is
  // disposed) must not end the preview it is part of (review of D52 PR B).
  let entering = true;
  banner.querySelector('[data-act="leave-sandbox"]')!.addEventListener('click', () => {
    leaveSandbox();
    app.router.go({ screen: 'world' });
  });
  // Anywhere but this home ends the preview first; a board started in the sandbox is the sandbox's, so it lands on
  // the World instead.
  app.router.guard = (route: CanonicalRoute): CanonicalRoute => {
    if (entering || (route.screen === 'region' && route.id === def.id)) return route;
    leaveSandbox();
    return route.screen === 'game' ? { screen: 'world' } : route;
  };
  try {
    app.router.go({ screen: 'region', id: def.id });
  } finally {
    entering = false;
  }
  return true;
}

/** Ends the preview: the player's own save, unchanged, and writes back on. */
export function leaveSandbox(o: { quiet?: boolean } = {}): void {
  const s = session;
  if (!s) return;
  session = null;
  app.router.guard = null;
  s.banner.remove();
  // The same object, unless something reached it while the sandbox was in front: then the snapshot taken on the way in.
  app.save = JSON.stringify(s.real) === s.snapshot ? s.real : normalizeSave(JSON.parse(s.snapshot));
  app.active = s.active;
  app.holdWrites = false;
  app.applySettings();
  if (!o.quiet) toast('Preview ended. Your own save is back, unchanged.');
}
