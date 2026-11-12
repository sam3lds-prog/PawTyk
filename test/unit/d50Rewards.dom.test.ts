// @vitest-environment happy-dom
/**
 * D50 PR A, reward clarity and the welcome in focus:
 *  - a win says what it paid in coins once: one headline that is exactly what the wallet went up by, and where it came
 *    from (the puzzle, errands, badges, a finished home) in one small line; nothing said twice;
 *  - while an arrival's welcome card offers the snack, the scene's other controls step back, and come back when the
 *    welcome is over or the player looks around or taps an animal;
 *  - while the snack is eaten, the card's buttons are disabled (no click, key or screen reader starts a second snack or
 *    leaves mid-meal), and however the meal ends the card moves on to Continue.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { app } from '../../src/app/app';
import { Router, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { gameScreen } from '../../src/ui/screens/game';
import { regionScreen } from '../../src/ui/screens/region';
import { sanctuaryScreen } from '../../src/ui/screens/sanctuary';
import { shopScreen } from '../../src/ui/screens/shop';
import { startGame } from '../../src/app/gameFlow';
import { CAT, EMPTY } from '../../src/engine/types';
import { defaultSave, type SaveV2 } from '../../src/services/storage';
import { balance, grant } from '../../src/meta/ledger';
import { coinPartsLine, winCoins } from '../../src/meta/winCoins';
import { claimedLine } from '../../src/app/events';
import { growActive } from '../../src/app/qaTools';
import { isComplete } from '../../src/meta/world';
import type { AnimalId } from '../../src/meta/animals';
import { WELCOMING_CLASS, welcomeCardMarkup } from '../../src/ui/components/welcomeCard';
import { cueMs, SCORES } from '../../src/audio/scores';

const NOW = new Date(2026, 10, 11, 12);
const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };

function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['journey', 'pets', 'challenges', 'world', 'gallery', 'welcome', 'profile'] as const) reg[k] = blank;
  router.register({ ...reg, game: gameScreen, region: regionScreen, sanctuary: sanctuaryScreen, shop: shopScreen });
  app.router = router;
  return router;
}

function farmSave(): SaveV2 {
  const s = defaultSave(NOW);
  Object.assign(s.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, pairRulesSeen: true, pairLessonDone: true, starterDecorChosen: true, sceneTapTipSeen: true, decorTipSeen: true });
  s.journey.nextLevel = 41;
  s.world.growth.farm = 4;
  for (const id of ['cotton', 'truffle']) s.inventory.companions[id] = { unlockedAt: '2026-10-31T11:00:00.000Z' };
  grant(s, 'test:coins', 300, 'gift', NOW);
  return s;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(NOW);
  localStorage.clear();
  app.replaceSave(farmSave());
  app.settings.toys3d = false;
  app.active = null;
});
afterEach(() => {
  app.settings.reducedMotion = 'system';
  app.active = null;
  vi.useRealTimers();
});

describe('what a win paid, said once (pure)', () => {
  it('adds the four sources; a source that paid nothing is left out', () => {
    const w = winCoins({ puzzle: 45, errands: [{ coins: 20, overflowCoins: 0 }, { coins: 25, overflowCoins: 0 }, { coins: 0, overflowCoins: 0 }], badges: [{ coins: 20 }], home: { coins: 100, name: 'Farm' } });
    expect(w.total).toBe(45 + 45 + 20 + 100);
    expect(w.parts.map((p) => p.label)).toEqual(['45 for the puzzle', '45 from 2 errands', '20 from a badge', '100 for finishing the Farm']);
    expect(coinPartsLine(w)).toBe('45 for the puzzle · 45 from 2 errands · 20 from a badge · 100 for finishing the Farm');
  });

  it("a pantry that's full pays its overflow as coins, counted with the errand that gave it", () => {
    const w = winCoins({ puzzle: 0, errands: [{ coins: 25, overflowCoins: 10 }], badges: [] });
    expect(w.total).toBe(35);
    expect(w.parts).toEqual([{ source: 'errands', coins: 35, label: '35 from an errand' }]);
  });

  it('from one source only, the headline needs no explanation', () => {
    const w = winCoins({ puzzle: 35, errands: [], badges: [] });
    expect(w.total).toBe(35);
    expect(coinPartsLine(w)).toBe('');
    expect(winCoins({ puzzle: 0, errands: [], badges: [] }).total).toBe(0);
  });

  it('an errand line can leave coins to the headline and still say the life or hint it gave', () => {
    const claimed = [{ coins: 25, overflowCoins: 0, lives: 1, hints: 0, def: { id: 'clean1', title: 'x' } }] as never;
    expect(claimedLine(claimed)).toBe('+25 Paw Coins · +1 extra life');
    expect(claimedLine(claimed, { coins: false })).toBe('+1 extra life');
  });
});

describe('the win sheet: one coin headline that matches the wallet', () => {
  function placeAll(): void {
    const s = app.active!.session;
    let t = 1_000;
    vi.spyOn(performance, 'now').mockImplementation(() => t);
    for (let r = 0; r < s.size; r++)
      for (let c = 0; c < s.size; c++) {
        const want = s.puzzle.solution[r][c];
        if (want === EMPTY || s.givenMask[r][c] || s.cells[r][c] === want) continue;
        document.querySelector<HTMLElement>(`[data-tool="${want === CAT ? 'cat' : 'dog'}"]`)?.click();
        const el = document.querySelector<HTMLElement>(`.cell[data-r="${r}"][data-c="${c}"]`)!;
        document.elementFromPoint = () => el;
        for (const gap of [1_000, 60]) {
          t += gap;
          el.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
          el.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, button: 0, pointerId: 1, clientX: 5, clientY: 5 }));
        }
        if (s.outcome === 'won') return;
      }
  }
  function solve(level: number): void {
    startGame({ kind: 'level', level });
    placeAll();
    vi.advanceTimersByTime(1400);
    const spot = document.querySelector<HTMLElement>('.spotlight');
    if (spot) {
      spot.click();
      vi.advanceTimersByTime(300);
    }
  }
  const sheet = () => document.querySelector('.win-sheet')!;

  it('a first clear that also finishes errands: "+N Paw Coins" is the wallet’s rise, with puzzle and errands named once', () => {
    mount();
    app.settings.controls = 'tap';
    const before = balance(app.save);
    solve(41);
    const total = Number(sheet().querySelector<HTMLElement>('[data-win-coins]')!.dataset.total);
    expect(total).toBe(balance(app.save) - before);
    const head = sheet().querySelector('.win-coins__total')!.textContent!.replace(/\s+/g, ' ').trim();
    expect(head).toBe(`+${total} Paw Coins`);
    // The first view says where it came from in one line: the puzzle and the errands this solve finished.
    const parts = sheet().querySelector('[data-win-coin-parts]')?.textContent ?? '';
    expect(parts).toMatch(/^\d+ for the puzzle · \d+ from (an errand|\d+ errands)/);
    const numbers = [...parts.matchAll(/(\d+) (for|from)/g)].map((m) => Number(m[1]));
    expect(numbers.reduce((a, b) => a + b, 0)).toBe(total);
    // The errand line names the errands, without a second coin figure.
    const errand = sheet().querySelector('[data-win-errand]')?.textContent ?? '';
    expect(errand).toMatch(/errand/i);
    expect(errand).not.toMatch(/Paw Coins/);
    // "Paw Coins" appears once in the first view, and the fold doesn't repeat the errands or claim the coins again.
    expect((sheet().querySelector('.win-stage-1')!.textContent!.match(/Paw Coins/g) ?? []).length).toBe(1);
    const fold = sheet().querySelector('[data-win-more]')!;
    expect(fold.querySelector('summary')!.textContent).not.toMatch(/coins/i);
    expect(fold.textContent).not.toMatch(/errand/i);
    expect(fold.querySelector('.reward-coins')?.textContent).toMatch(/For the puzzle/);
  });

  it('a win that finishes a home: its coins are in the one headline ("for finishing the Farm"), not said again', () => {
    mount();
    app.settings.controls = 'tap';
    // Grow the Farm until one more puzzle finishes it.
    for (let i = 0; i < 200; i++) {
      const probe = structuredClone(app.save);
      growActive(probe, 1, NOW);
      if (isComplete(probe, 'farm')) break;
      growActive(app.save, 1, NOW);
    }
    expect(isComplete(app.save, 'farm')).toBe(false);
    const before = balance(app.save);
    solve(41);
    expect(isComplete(app.save, 'farm')).toBe(true);
    const w = sheet();
    const total = Number(w.querySelector<HTMLElement>('[data-win-coins]')!.dataset.total);
    expect(total).toBe(balance(app.save) - before);
    expect(w.querySelector('[data-win-coin-parts]')?.textContent).toMatch(/for finishing the Farm/);
    expect((w.textContent!.match(/Paw Coins/g) ?? []).length).toBe(1);
  });
});

describe('the welcome card in focus', () => {
  /** Meet → the parade → the card (reduced motion keeps the timings short). */
  async function meet(router: Router, who: AnimalId = 'truffle'): Promise<HTMLElement> {
    app.settings.reducedMotion = 'reduce';
    router.go({ screen: 'region', id: 'farm', welcome: [who] });
    await vi.advanceTimersByTimeAsync(400 + cueMs(SCORES.bounce) + 600);
    return document.querySelector<HTMLElement>('.region')!;
  }

  it('while the snack is on offer the scene’s other controls step back; Look around first brings them back', async () => {
    const router = mount();
    const screen = await meet(router);
    expect(document.querySelector('[data-welcome-card="offer"]')).not.toBeNull();
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(true);
    // The card offers one thing now, the way on, and a quiet way to look around.
    expect(document.querySelector('[data-act="welcome-snack"]')).not.toBeNull();
    expect(document.querySelector('[data-act="welcome-play"]')).not.toBeNull();
    const look = document.querySelector<HTMLElement>('[data-act="welcome-look"]')!;
    expect(look.textContent).toBe('Look around first');
    look.click();
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(false);
    expect(document.querySelector('[data-act="welcome-look"]')).toBeNull();
    // The snack is still on offer.
    expect(document.querySelector('[data-act="welcome-snack"]')).not.toBeNull();
  });

  it('tapping an animal in the scene is looking around too', async () => {
    const router = mount();
    const screen = await meet(router);
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(true);
    document.querySelector('.sanctuary__scene [data-friend="truffle"]')!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(false);
  });

  it('while the snack is eaten: buttons disabled, Continue and the progress card’s Play can’t leave; then Continue', async () => {
    const router = mount();
    await meet(router);
    (document.querySelector('[data-act="welcome-snack"]') as HTMLElement).click();
    const snack = document.querySelector<HTMLButtonElement>('[data-act="welcome-snack"]')!;
    const cont = document.querySelector<HTMLButtonElement>('[data-act="welcome-play"]')!;
    expect(snack.disabled).toBe(true);
    expect(cont.disabled).toBe(true);
    expect(document.querySelector('[data-welcome-status]')?.textContent).toMatch(/Truffle is having the snack/);
    // Focus waits on that line (a disabled button can't hold it): a keyboard or screen reader stays on the card.
    expect(document.activeElement?.hasAttribute('data-welcome-status')).toBe(true);
    expect(document.querySelector('[data-act="welcome-look"]')).toBeNull();
    // A click dispatched at the disabled buttons (what a keyboard or screen reader would do if it could), and the
    // progress card's own Play: still on the Farm, and still one snack.
    const fedBefore = app.save.sanctuary.affection.truffle ?? 0;
    cont.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    snack.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    document.querySelector<HTMLElement>('.region-progress [data-act="play"]')?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(router.route?.screen).toBe('region');
    expect(app.save.sanctuary.affection.truffle ?? 0).toBe(fedBefore);
    await vi.advanceTimersByTimeAsync(3000);
    const fed = document.querySelector('[data-welcome-card="fed"]')!;
    const go = fed.querySelector<HTMLButtonElement>('[data-act="welcome-play"]')!;
    expect(go.disabled).toBe(false);
    expect(document.querySelector('.region')!.classList.contains(WELCOMING_CLASS)).toBe(false);
    go.click();
    expect(router.route?.screen).toBe('game');
  });

  it('a meal cut short (the player starts the tour) still leaves the card on Continue, never stuck', async () => {
    const router = mount();
    app.settings.reducedMotion = 'full';
    router.go({ screen: 'region', id: 'farm', welcome: ['truffle'] });
    await vi.advanceTimersByTimeAsync(800 + cueMs(SCORES.bounce) + 4000);
    document.querySelector<HTMLElement>('.parade-skip')?.click();
    await vi.advanceTimersByTimeAsync(800);
    expect(document.querySelector('[data-welcome-card="offer"]')).not.toBeNull();
    (document.querySelector('[data-act="welcome-snack"]') as HTMLElement).click();
    expect(document.querySelector<HTMLButtonElement>('[data-act="welcome-play"]')!.disabled).toBe(true);
    // Something the player starts ends the meal at once (the director's rule).
    (window as unknown as { __director: { cancelAll(): void } }).__director.cancelAll();
    await vi.advanceTimersByTimeAsync(50);
    expect(document.querySelector('[data-welcome-card="fed"]')).not.toBeNull();
    expect(document.querySelector<HTMLButtonElement>('[data-act="welcome-play"]')!.disabled).toBe(false);
  });

  it('with nothing to give, the card doesn’t take the focus (Continue and a hello, the scene as it was)', async () => {
    const router = mount();
    app.save.sanctuary.fed.truffle = { day: '2026-11-11', n: 999 };
    const screen = await meet(router);
    expect(document.querySelector('[data-welcome-card="offer"] [data-act="welcome-snack"]')).toBeNull();
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(false);
  });

  it('the markup: disabled, not just dimmed, while eating; Look around only when focused', () => {
    document.body.innerHTML = welcomeCardMarkup('truffle', 'farm', 'offer', { eating: true, focused: true });
    expect([...document.querySelectorAll<HTMLButtonElement>('.welcome-card .btn')].every((b) => b.disabled)).toBe(true);
    expect(document.querySelector('[data-act="welcome-look"]')).toBeNull();
    document.body.innerHTML = welcomeCardMarkup('truffle', 'farm', 'offer', { focused: true });
    expect(document.querySelector('[data-act="welcome-look"]')).not.toBeNull();
    document.body.innerHTML = welcomeCardMarkup('truffle', 'farm', 'offer');
    expect(document.querySelector('[data-act="welcome-look"]')).toBeNull();
  });

  it('leaving the Farm takes the focus class with it (nothing stuck on the next screen)', async () => {
    const router = mount();
    const screen = await meet(router);
    expect(screen.classList.contains(WELCOMING_CLASS)).toBe(true);
    router.go({ screen: 'shop', sanctuary: 'farm' });
    expect(document.querySelector(`.${WELCOMING_CLASS}`)).toBeNull();
  });
});
