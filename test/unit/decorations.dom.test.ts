// @vitest-environment happy-dom
/**
 * D48 PR C, decorations: twenty-one new pieces, each drawn, each something an animal does (drawn and 3D, the same
 * length), the Farm's in four spots (one piece out per spot, never overlapping each other or the animals), four themed
 * sets that can be out together, a piece that waits for its home to grow, a preview on the card, show/hide from the
 * card, and saves from before D48 unchanged.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { DECOR, DECOR_BY_ID, DECOR_SETS, PRE_D48_DECOR, SPOT_NAMES, decorTier, setPieces, spotMates } from '../../src/meta/catalogs/decor';
import { activityFor, ACTIVITIES } from '../../src/ui/art/activities';
import { activityClip } from '../../src/three/clips';
import { DECOR_MOTIONS } from '../../src/three/motions';
import { decorArt, hasDecorArt } from '../../src/ui/art/sanctuary';
import { D48_DECOR_ART } from '../../src/ui/art/decorD48';
import { regionScene } from '../../src/ui/art/regions';
import { buyDecor, isShown, setProgress, setShown, showSet, shownDecorIds, shownInSpot } from '../../src/meta/sanctuary';
import { homeState } from '../../src/meta/homeState';
import { checkAchievements } from '../../src/meta/achievements';
import { DECOR_PLACES, SPOTS_3D } from '../../src/three/walkMath';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { grant } from '../../src/meta/ledger';
import { grantItem } from '../../src/meta/items';
import { previewMarkup, previewView } from '../../src/ui/components/decorPreview';

const NOW = new Date(2026, 10, 10, 12);
const NEW = DECOR.filter((d) => !PRE_D48_DECOR.includes(d.id));
const FARM_NEW = NEW.filter((d) => d.sanctuary === 'farm');

import { stageOf } from '../../src/meta/world';
import { app } from '../../src/app/app';

/** Growth that puts the Farm at `stage`. */
function growFarm(s: ReturnType<typeof defaultSave>, stage: number): void {
  for (let g = 0; g < 200; g++) {
    s.world.growth.farm = g;
    if (stageOf(s, 'farm') >= stage) return;
  }
}

function rich(stage = 4) {
  const s = defaultSave(NOW);
  grant(s, 'test:coins', 20000, 'gift', NOW);
  grantItem(s, 'test:gems', 'gem', 2000, 'test', NOW);
  grantItem(s, 'test:tokens', 'vtoken', 100, 'gift', NOW);
  s.journey.nextLevel = 200;
  for (const id of ['cotton', 'truffle', 'buttercup', 'pepper', 'marigold', 'hazel']) s.inventory.companions[id] = { unlockedAt: NOW.toISOString() };
  growFarm(s, stage);
  return s;
}

describe('twenty-one new pieces', () => {
  it('21 new, 16 of them on the Farm; each drawn, each with something to do, the 3D part as long as the drawn one', () => {
    expect(NEW).toHaveLength(21);
    expect(FARM_NEW).toHaveLength(16);
    for (const d of NEW) {
      expect(hasDecorArt(d.id), d.id).toBe(true);
      const a = activityFor(d.id);
      expect(a, d.id).not.toBeNull();
      expect(a!.motion, d.id).toBe(DECOR_MOTIONS[d.id].motion);
      expect(activityClip(d.id)?.ms, d.id).toBe(a!.ms);
      expect(d.play, d.id).toBeTruthy();
    }
    // Every activity there is (old and new) still has its 3D part.
    for (const a of Object.values(ACTIVITIES)) expect(activityClip(a.decor)?.ms, a.decor).toBe(a.ms);
  });

  it('prices as the plan suggested: coins for most, video tokens for the special ones, gems only for spectacle', () => {
    expect(DECOR_BY_ID.flowerarch.cost).toBe(180);
    expect(DECOR_BY_ID.bench.cost).toBe(120);
    expect(DECOR_BY_ID.duckfountain.cost).toBe(250);
    expect(DECOR_BY_ID.barnbell.tokens).toBe(3);
    expect(DECOR_BY_ID.carousel.gems).toBe(75);
    expect(DECOR_BY_ID.festivalstage.gems).toBe(120);
    const tiers = NEW.map((d) => decorTier(d));
    expect(tiers.filter((t) => t === 'coins').length).toBeGreaterThan(tiers.filter((t) => t === 'premium').length * 3);
  });
});

describe('the Farm’s spots', () => {
  it('every new Farm piece has a spot with a name, and the same place in 3D as its spot-mates', () => {
    for (const d of FARM_NEW) {
      expect(d.slot, d.id).toBeTruthy();
      expect(SPOT_NAMES[d.slot!], d.id).toBeTruthy();
      const p = DECOR_PLACES[d.id as keyof typeof DECOR_PLACES];
      expect(p.spot, d.id).toBe(d.slot);
      expect({ x: p.x, z: p.z }).toEqual(SPOTS_3D[d.slot as keyof typeof SPOTS_3D]);
    }
  });

  it('buying a piece puts it out and tucks away whatever stood in its spot; one piece per spot, always', () => {
    const s = rich();
    expect(buyDecor(s, 'bench', NOW)).toBe('ok');
    expect(isShown(s, 'bench')).toBe(true);
    expect(buyDecor(s, 'applecart', NOW)).toBe('ok');
    expect(isShown(s, 'applecart')).toBe(true);
    expect(isShown(s, 'bench')).toBe(false);
    expect(shownInSpot(s, 'bench')).toBe('applecart');
    setShown(s, 'bench', true);
    expect(isShown(s, 'applecart')).toBe(false);
    for (const slot of Object.keys(SPOT_NAMES)) {
      const out = shownDecorIds(s, 'farm').filter((id) => DECOR_BY_ID[id].slot === slot);
      expect(out.length, slot).toBeLessThanOrEqual(1);
    }
  });

  /** The drawn figure's rough box for a Farm animal at its spot. */
  const ANIMALS: Record<string, [number, number, number]> = { cotton: [60, 240, 34], truffle: [182, 262, 30], buttercup: [268, 230, 38], pepper: [214, 166, 24], marigold: [134, 232, 20], hazel: [320, 270, 44] };
  const overlap = (a: [number, number, number, number], b: [number, number, number, number]) => {
    const w = Math.min(a[0] + a[2], b[0] + b[2]) - Math.max(a[0], b[0]);
    const h = Math.min(a[1] + a[3], b[1] + b[3]) - Math.max(a[1], b[1]);
    return w > 0 && h > 0 ? w * h : 0;
  };

  it('nothing in a spot overlaps another spot’s piece, or covers more than a sliver of a Farm animal', () => {
    for (const d of FARM_NEW) {
      const box = decorArt(d.id)!.box;
      for (const e of FARM_NEW) {
        if (e.slot === d.slot) continue;
        expect(overlap(box, decorArt(e.id)!.box), `${d.id} vs ${e.id}`).toBe(0);
      }
      for (const [who, [x, y, h]] of Object.entries(ANIMALS)) {
        // The visible animal (its head and body), a little inside its full box. A piece drawn behind the animal (its
        // ground further back) may tuck a little more behind it than a piece standing in front of it may cover.
        const fig: [number, number, number, number] = [x - h * 0.45, y - h * 1.0, h * 0.9, h * 0.95];
        const behind = decorArt(d.id)!.base < (who === 'pepper' ? 189 : y);
        expect(overlap(box, fig) / (fig[2] * fig[3]), `${d.id} vs ${who}`).toBeLessThan(behind ? 0.15 : 0.08);
      }
    }
  });

  it('a piece that needs the pond (stage 3) waits for it, drawn and in 3D alike; once there, it’s out', () => {
    const s = rich(2);
    buyDecor(s, 'duckfountain', NOW);
    expect(homeState(s, 'farm', NOW).decor).not.toContain('duckfountain');
    document.body.innerHTML = `<svg>${regionScene('farm', { stage: 2, companions: [], decor: ['duckfountain'] }, 't')}</svg>`;
    expect(document.querySelector('[data-decor="duckfountain"]')).toBeNull();
    growFarm(s, 3);
    expect(homeState(s, 'farm', NOW).decor).toContain('duckfountain');
    document.body.innerHTML = `<svg>${regionScene('farm', { stage: 4, companions: [], decor: ['duckfountain'] }, 't')}</svg>`;
    expect(document.querySelector('[data-decor="duckfountain"]')).not.toBeNull();
  });
});

describe('themed sets', () => {
  it('four sets; a set never has two pieces in one spot, so it can always be out together', () => {
    expect(DECOR_SETS.map((x) => x.id)).toEqual(['spring', 'harvest', 'camp', 'party']);
    for (const st of DECOR_SETS) {
      const pieces = setPieces(st.id);
      expect(pieces.length, st.id).toBeGreaterThanOrEqual(3);
      const slots = pieces.map((d) => d.slot).filter(Boolean);
      expect(new Set(slots).size, st.id).toBe(slots.length);
    }
    // The scarecrow (before D48) belongs to the Harvest Festival.
    expect(setPieces('harvest').map((d) => d.id)).toContain('scarecrow');
  });

  it('putting a whole set out brings out every owned piece, and the badge comes when all are out together', () => {
    const s = rich();
    for (const d of setPieces('camp')) buyDecor(s, d.id, NOW);
    buyDecor(s, 'applecart', NOW); // takes the bench's spot
    expect(setProgress(s, 'camp')).toMatchObject({ owned: 3, total: 3, complete: true, together: false });
    expect(checkAchievements(s, NOW).map((a) => a.id)).not.toContain('set_dresser');
    expect(showSet(s, 'camp')).toEqual(['bench']);
    expect(setProgress(s, 'camp').together).toBe(true);
    expect(checkAchievements(s, NOW).map((a) => a.id)).toContain('set_dresser');
  });
});

describe('the card’s preview', () => {
  it('frames the piece in the player’s own home, with the piece out and its spot-mate away', () => {
    const s = rich();
    app.replaceSave(s);
    buyDecor(app.save, 'bench', NOW);
    document.body.innerHTML = previewMarkup('applecart');
    expect(document.querySelector('[data-decor="applecart"]')).not.toBeNull();
    expect(document.querySelector('[data-decor="bench"]')).toBeNull();
    // Its own animals are there to show what they do with it.
    expect(document.querySelectorAll('.sanctuary__pet').length).toBeGreaterThan(0);
    const v = previewView(decorArt('applecart')!.box);
    expect(v.x).toBeGreaterThanOrEqual(0);
    expect(v.x + v.w).toBeLessThanOrEqual(360.01);
    expect(v.y + v.h).toBeLessThanOrEqual(300.01);
  });
});

describe('older saves', () => {
  it('a save from before D48 shows exactly what it showed: nothing new is out, nothing owned moved', () => {
    const s = rich();
    for (const id of ['scarecrow', 'tractor', 'trough'] as const) s.inventory.decor[id] = { ownedAt: NOW.toISOString() };
    const back = normalizeSave(JSON.parse(JSON.stringify(s)), NOW);
    expect(shownDecorIds(back, 'farm').sort()).toEqual(['scarecrow', 'tractor', 'trough']);
    // And new pieces round-trip, owned and hidden alike.
    buyDecor(back, 'carousel', NOW);
    setShown(back, 'carousel', false);
    const again = normalizeSave(JSON.parse(JSON.stringify(back)), NOW);
    expect(again.inventory.decor.carousel).toBeTruthy();
    expect(isShown(again, 'carousel')).toBe(false);
  });

  it('every piece’s art box sits inside the scene', () => {
    for (const [id, a] of Object.entries(D48_DECOR_ART)) {
      const [x, y, w, h] = a.box;
      expect(x, id).toBeGreaterThanOrEqual(0);
      expect(y, id).toBeGreaterThanOrEqual(0);
      expect(x + w, id).toBeLessThanOrEqual(360);
      expect(y + h, id).toBeLessThanOrEqual(300);
      expect(spotMates(id as never).every((m) => m.id !== id)).toBe(true);
    }
  });
});

// ------------------------------------------------------------------ on the Farm's screen and in the Shop

import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { shopScreen } from '../../src/ui/screens/shop';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
function mountApp(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile', 'game', 'sanctuary'] as const) reg[k] = blank;
  router.register({ ...reg, region: regionScreen, shop: shopScreen });
  app.router = router;
  return router;
}

describe('in the app', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    app.replaceSave(rich());
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, starterDecorChosen: true, decorTipSeen: true, sceneTapTipSeen: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
  });

  it('a piece’s card in the Shop: its preview, its spot, its set; bought, it can be tucked away and put out again', () => {
    mountApp().go({ screen: 'shop', sanctuary: 'farm', tab: 'decor', decor: 'flowerarch' });
    const sheet = document.querySelector('.decor-sheet')!;
    expect(sheet.querySelector('[data-decor-preview="flowerarch"]')).not.toBeNull();
    expect(sheet.textContent).toMatch(/Stands in the meadow by the path/);
    expect(sheet.textContent).toMatch(/Spring Meadow/);
    (sheet.querySelector('[data-act="buy"]') as HTMLElement).click();
    expect(isShown(app.save, 'flowerarch')).toBe(true);
    app.router.go({ screen: 'shop', sanctuary: 'farm', tab: 'decor', decor: 'flowerarch' });
    const owned = document.querySelector('.decor-sheet')!;
    (owned.querySelector('[data-act="hide"]') as HTMLElement).click();
    expect(isShown(app.save, 'flowerarch')).toBe(false);
    (owned.querySelector('[data-act="show"]') as HTMLElement).click();
    expect(isShown(app.save, 'flowerarch')).toBe(true);
  });

  it('the Farm’s themed sets in the Shop, with “Put the whole set out” once a set is owned', () => {
    for (const d of setPieces('party')) buyDecor(app.save, d.id, NOW);
    buyDecor(app.save, 'bench', NOW);
    mountApp().go({ screen: 'shop', sanctuary: 'farm', tab: 'decor' });
    const card = document.querySelector('[data-set="party"]')!;
    expect(card.textContent).toMatch(/3 of 3/);
    (card.querySelector('[data-act="show-set"]') as HTMLElement).click();
    expect(setProgress(app.save, 'party').together).toBe(true);
    expect(document.querySelector('[data-set="party"]')?.textContent).toMatch(/Out together/);
  });

  it('on the Farm: the Festival Stage hosts a dance for everyone; the Barn Bell rings when a parade welcomes someone', async () => {
    buyDecor(app.save, 'festivalstage', NOW);
    buyDecor(app.save, 'barnbell', NOW);
    mountApp().go({ screen: 'region', id: 'farm' });
    const stage = document.querySelector<HTMLElement>('.sanctuary__scene [data-decor="festivalstage"]')!;
    expect(stage.classList.contains('has-act')).toBe(true);
    stage.querySelector('path, ellipse')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    await vi.advanceTimersByTimeAsync(1400);
    expect(document.querySelectorAll('.sanctuary__scene .sanctuary__pet.is-dancing').length).toBeGreaterThan(1);
    (document.querySelector('[data-act="parade-skip"]') as HTMLElement | null)?.click();
    await vi.advanceTimersByTimeAsync(400);
    // Straight from a win's Meet: the welcome parade starts, and the bell rings for the newcomer.
    app.router.go({ screen: 'region', id: 'farm', welcome: ['hazel'] });
    await vi.advanceTimersByTimeAsync(2600);
    expect(document.querySelector('.sanctuary__scene .sanctuary__pet.is-dancing')).not.toBeNull();
    expect(document.querySelector('.sanctuary__scene [data-decor="barnbell"]')?.classList.contains('is-ringing')).toBe(true);
  });
});
