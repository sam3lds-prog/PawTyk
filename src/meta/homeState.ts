/**
 * What a home looks like right now (D45 PR C): one description that every picture of it is drawn from. The drawn
 * scene on its screen and the 3D walk round the Farm both read this, so they always show the same stage, the same
 * residents, the same decorations out, and the same time of day.
 */

import type { SaveV2 } from '../services/storage';
import { isHome, type AnimalId } from './animals';
import type { DecorId } from './catalogs/decor';
import { sanctuaryDef, type RegionId } from './catalogs/sanctuaries';
import { shownDecorIds } from './sanctuary';
import { isOpen, stageOf } from './world';

export interface HomeState {
  id: RegionId;
  open: boolean;
  /** 0 (not open) to 4. */
  stage: number;
  /** Who lives here now, in the order they arrived. */
  residents: string[];
  /** The decorations the player has out. */
  decor: DecorId[];
  /** Lamps lit, windows glowing. */
  evening: boolean;
}

/** Evening from 7 pm to 6 am, by the device's clock. */
export function isEveningAt(d: Date): boolean {
  const h = d.getHours();
  return h >= 19 || h < 6;
}

export function homeState(save: SaveV2, id: RegionId, now: Date = new Date()): HomeState {
  const open = isOpen(save, id);
  return {
    id,
    open,
    stage: open ? stageOf(save, id) : 0,
    residents: sanctuaryDef(id)
      .arrivals.map((a) => a.id as string)
      .filter((a) => isHome(save, a as AnimalId)),
    decor: shownDecorIds(save, id),
    evening: isEveningAt(now),
  };
}
