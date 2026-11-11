// @vitest-environment happy-dom
/**
 * D48 PR D: eighteen more tricks and emotes. The catalog and its tiers (now with Paw Coins), the groups (emotes,
 * tricks, dances, group acts), buying with coins through the ledger, the tray's groups and "Again" row, group acts that
 * bring in partners, bodies that do their own version, and that every new one has motion (drawn and 3D), props, a
 * bubble that lasts as long as it does, and a tune of exactly its length.
 */
import { readFileSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TRICKS, TRICK_BY_ID, TRICK_GROUPS, trickCurrency, trickGroup, type TrickId } from '../../src/meta/catalogs/tricks';
import { buyTrick, canAffordTrick, ownsTrick, trickWallet } from '../../src/meta/tricks';
import { balance, grant } from '../../src/meta/ledger';
import { defaultSave } from '../../src/services/storage';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { regionScreen } from '../../src/ui/screens/region';
import { shopScreen } from '../../src/ui/screens/shop';
import { mountTrickTray, noteRecent, partnersFor, recentTricks, trickChips } from '../../src/ui/components/tricks';
import { performTrick, trickBody } from '../../src/ui/components/trickPlay';
import { trickOverlay, trickProps } from '../../src/ui/art/tricks';
import { D48_CLIPS, TURN_CHANNELS, performClip } from '../../src/three/clips';
import { CHANNELS, addPose, restPose } from '../../src/three/pose';
import { EXPRESSIONS } from '../../src/three/face';
import { hasEffect } from '../../src/three/effects';
import { SCORES, cueMs, type CueId } from '../../src/audio/scores';

const NOW = new Date(2026, 10, 10, 12);
const NEW: TrickId[] = TRICKS.slice(TRICKS.findIndex((t) => t.id === 'wiggle')).map((t) => t.id);
const TAU = Math.PI * 2;
const near0 = (k: string, v: number) => ((TURN_CHANNELS as readonly string[]).includes(k) ? Math.abs((((v % TAU) + TAU + Math.PI) % TAU) - Math.PI) : Math.abs(v));
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

/** A little scene: three animals in a row (the lead in the middle). */
function scene(): { svg: SVGSVGElement; figs: SVGGElement[] } {
  document.body.innerHTML = `<div class="sanctuary__scene is-live"><svg viewBox="0 0 360 300">
    <g class="sanctuary__pet sanctuary__friend" data-friend="cotton" data-name="Cotton" data-gx="80" data-gy="200" data-gh="30"><rect width="20" height="20"/></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="dozer" data-name="Dozer" data-gx="180" data-gy="200" data-gh="30"><rect width="20" height="20"/></g>
    <g class="sanctuary__pet sanctuary__friend" data-friend="marigold" data-name="Marigold" data-gx="300" data-gy="200" data-gh="30"><rect width="20" height="20"/></g>
  </svg></div>`;
  const svg = document.querySelector('svg')!;
  return { svg, figs: [...svg.querySelectorAll<SVGGElement>('.sanctuary__pet')] };
}

describe('the catalog: thirty-six, in four groups and four ways to learn', () => {
  it('eighteen new ones, each with its own id, glyph-carrying emote, length and blurb', () => {
    expect(TRICKS.length).toBe(36);
    expect(NEW).toEqual(['wiggle', 'peekaboo', 'headtilt', 'sneeze', 'stretch', 'confetti', 'highfive', 'tailchase', 'somersault', 'balloon', 'drumsolo', 'moonwalk', 'disco', 'chickendance', 'startwirl', 'boogie', 'duet', 'miniparade']);
    for (const id of NEW) {
      const t = TRICK_BY_ID[id];
      expect(t.ms, id).toBeGreaterThanOrEqual(1500);
      expect(t.ms, id).toBeLessThanOrEqual(3600);
      expect(t.blurb.length, id).toBeGreaterThan(10);
    }
  });

  it('the tiers the plan set: two free, everyday ones for coins, video tokens for a few, gems for the showpieces', () => {
    const tier = (id: TrickId) => `${TRICK_BY_ID[id].tier}${TRICK_BY_ID[id].price ? ` ${TRICK_BY_ID[id].price}` : ''}`;
    expect(NEW.filter((id) => TRICK_BY_ID[id].tier === 'free')).toEqual(['wiggle', 'highfive']);
    for (const id of ['peekaboo', 'headtilt', 'sneeze', 'stretch', 'tailchase'] as TrickId[]) {
      expect(trickCurrency(TRICK_BY_ID[id]), id).toBe('coins');
      expect(TRICK_BY_ID[id].price, id).toBeGreaterThanOrEqual(50);
      expect(TRICK_BY_ID[id].price, id).toBeLessThanOrEqual(120);
    }
    for (const id of ['confetti', 'somersault', 'moonwalk', 'disco', 'chickendance'] as TrickId[]) expect(trickCurrency(TRICK_BY_ID[id]), id).toBe('vtoken');
    for (const id of ['balloon', 'drumsolo', 'startwirl', 'boogie', 'duet', 'miniparade'] as TrickId[]) {
      expect(trickCurrency(TRICK_BY_ID[id]), id).toBe('gem');
      expect(TRICK_BY_ID[id].price, id).toBeGreaterThanOrEqual(40);
    }
    expect(tier('tailchase')).toBe('coins 100');
  });

  it('every group has something in it; dances and group acts are their own groups, and only group acts take partners', () => {
    for (const g of TRICK_GROUPS) expect(TRICKS.some((t) => trickGroup(t) === g), g).toBe(true);
    expect(TRICKS.filter((t) => trickGroup(t) === 'dance').map((t) => t.id)).toEqual(['dance', 'moonwalk', 'disco', 'chickendance', 'startwirl', 'boogie']);
    expect(TRICKS.filter((t) => trickGroup(t) === 'group').map((t) => t.id)).toEqual(['duet', 'miniparade']);
    expect(TRICK_BY_ID.duet.partners).toBe(1);
    expect(TRICK_BY_ID.miniparade.partners).toBe(3);
    expect(TRICKS.filter((t) => t.partners).every((t) => trickGroup(t) === 'group')).toBe(true);
  });
});

describe('learning one for coins', () => {
  it('spends Paw Coins once through the ledger (a second tap, or a retry, takes nothing more)', () => {
    const s = defaultSave(NOW);
    grant(s, 'test:coins', 150, 'gift', NOW);
    expect(trickWallet(s, 'coins')).toBe(150);
    expect(canAffordTrick(s, 'tailchase')).toBe(true);
    expect(buyTrick(s, 'tailchase', NOW)).toBe('ok');
    expect(balance(s)).toBe(50);
    expect(ownsTrick(s, 'tailchase')).toBe(true);
    expect(buyTrick(s, 'tailchase', NOW)).toBe('owned');
    expect(balance(s)).toBe(50);
    // Not enough for another: nothing happens.
    expect(buyTrick(s, 'peekaboo', NOW)).toBe('insufficient');
    expect(balance(s)).toBe(50);
    expect(ownsTrick(s, 'peekaboo')).toBe(false);
  });

  it('the free ones are known from the start', () => {
    const s = defaultSave(NOW);
    expect(ownsTrick(s, 'wiggle')).toBe(true);
    expect(ownsTrick(s, 'highfive')).toBe(true);
    expect(buyTrick(s, 'wiggle', NOW)).toBe('free');
  });
});

describe('every new one looks, moves and sounds like itself', () => {
  const css = (readFileSync('src/ui/styles/sanctuary-play.css', 'utf8') + readFileSync('src/ui/styles/tricks-d48.css', 'utf8')).replace(/\/\*[\s\S]*?\*\//g, '');

  it('a drawn motion and a bubble, each exactly as long as the trick', () => {
    for (const id of NEW) {
      const ms = TRICK_BY_ID[id].ms;
      expect(css, id).toMatch(new RegExp(`\\.sanctuary__pet\\.is-trick-${id}\\s*\\{[^}]*animation:[^;]*${ms}ms`));
      expect(css, id).toMatch(new RegExp(`\\.sp-trick--${id} \\.sp-trick-emote\\s*\\{[^}]*animation: sp-emote ${ms}ms`));
    }
  });

  it('a body that can’t do it the usual way does its own version (drawn)', () => {
    expect(trickBody('dozer')).toBe('big');
    expect(trickBody('zuri')).toBe('tall');
    expect(trickBody('pebble')).toBe('seal');
    expect(trickBody('marigold')).toBe('bird');
    expect(css).toMatch(/\.is-trick-somersault\[data-trick-body='big'\][^{]*\{[^}]*animation-name: sp-t-siderollover/);
    expect(css).toMatch(/\[data-trick-body='seal'\]\.is-trick-disco/);
  });

  it('3D: as long as the trick, at rest at both ends, in range for every body, with faces it has', () => {
    for (const id of NEW) {
      const clip = performClip(id)!;
      expect(clip, id).toBeTruthy();
      expect(clip.ms, id).toBe(TRICK_BY_ID[id].ms);
      expect(D48_CLIPS[id], id).toBe(clip);
      for (const body of ['sit', 'upright', 'big', 'tall', 'bird', 'seal'] as const)
        for (const dir of [1, -1] as const) {
          const ctx = { body, dir, seed: 3 };
          for (const t of [0, 1]) for (const [k, v] of Object.entries(clip.frame(t, ctx).pose)) expect(near0(k, v as number), `${id} ${body} ${k} at ${t}`).toBeLessThan(0.03);
          for (let i = 0; i <= 80; i++) {
            const f = clip.frame(i / 80, ctx);
            const p = addPose(restPose(), f.pose);
            for (const c of CHANNELS) expect(Number.isFinite(p[c]), `${id} ${c}`).toBe(true);
            expect(Math.abs(p.px), `${id} px`).toBeLessThan(1.25);
            expect(p.py, `${id} ${body} py`).toBeLessThan(1.3);
            expect(p.py, `${id} ${body} py`).toBeGreaterThan(-0.15);
            if (f.face) expect(EXPRESSIONS).toContain(f.face);
          }
        }
    }
  });

  it('3D: a big animal rolls on its side instead of flipping; a bird gives a wing five', () => {
    const mid = (id: string, body: 'sit' | 'big' | 'bird') => D48_CLIPS[id].frame(0.45, { body, dir: 1, seed: 1 }).pose;
    expect(Math.abs(mid('somersault', 'sit').pitch ?? 0)).toBeGreaterThan(1);
    expect(Math.abs(mid('somersault', 'big').pitch ?? 0)).toBe(0);
    expect(Math.abs(mid('somersault', 'big').roll ?? 0)).toBeGreaterThan(0.5);
    const five = (body: 'sit' | 'bird') => D48_CLIPS.highfive.frame(0.5, { body, dir: 1, seed: 1 }).pose;
    expect(five('sit').armR!).toBeGreaterThan(five('bird').armR!);
    expect(five('bird').armROut!).toBeGreaterThan(five('sit').armROut!);
  });

  it('props in 3D for every one, drawn props for the showpieces, and none drawn under reduced motion', () => {
    const box = { x: 100, y: 100, w: 30, h: 30 };
    for (const id of NEW) expect(hasEffect(`perform:${id}`), id).toBe(true);
    for (const id of ['confetti', 'balloon', 'drumsolo', 'disco', 'sneeze', 'startwirl', 'boogie', 'duet', 'miniparade'] as TrickId[]) expect(trickProps(id, box), id).not.toBe('');
    for (const id of NEW) {
      const still = trickOverlay(id, TRICK_BY_ID[id].emote, box, 360, false);
      expect(still, id).toMatch(/sp-trick-emote/);
      expect(still, id).not.toMatch(/sp-trick-(notes|confetti|balloons|drum|disco|puff|twinkles)/);
    }
  });

  it('a tune of its own for every one, exactly as long as the trick', () => {
    for (const id of NEW) {
      const s = SCORES[`trick:${id}` as CueId];
      expect(s, id).toBeTruthy();
      expect(Math.abs(cueMs(s) - TRICK_BY_ID[id].ms), id).toBeLessThan(TRICK_BY_ID[id].ms * 0.01);
    }
  });
});

describe('group acts bring in their partners', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('the nearest free animals join, a beat behind, with no bubble of their own; then everyone is cleared', () => {
    const { svg, figs } = scene();
    const [cotton, dozer, marigold] = figs;
    // Dozer leads; Cotton is nearer than Marigold.
    expect(partnersFor(svg, dozer, 1)).toEqual([cotton]);
    expect(partnersFor(svg, dozer, 3)).toEqual([cotton, marigold]);
    // Someone busy doesn't join.
    marigold.classList.add('is-away');
    expect(partnersFor(svg, dozer, 3)).toEqual([cotton]);
    marigold.classList.remove('is-away');

    expect(performTrick(svg, dozer, 'miniparade', false)).toBe(true);
    partnersFor(svg, dozer, 3).forEach((p, i) => performTrick(svg, p, 'miniparade', false, i + 1));
    expect(svg.querySelectorAll('.sp-trick').length).toBe(1);
    expect(cotton.dataset.trickPartner).toBe('1');
    expect(marigold.dataset.trickPartner).toBe('2');
    expect(marigold.style.getPropertyValue('--trick-delay')).toBe('320ms');
    expect(dozer.dataset.trickBody).toBe('big');
    expect(cotton.classList.contains('is-trick-miniparade')).toBe(true);
    vi.advanceTimersByTime(TRICK_BY_ID.miniparade.ms + 400);
    for (const f of figs) {
      expect(f.dataset.trick, f.dataset.friend).toBeUndefined();
      expect(f.dataset.trickPartner).toBeUndefined();
      expect(f.style.getPropertyValue('--trick-delay')).toBe('');
    }
    expect(svg.querySelectorAll('.sp-trick').length).toBe(0);
  });
});

describe('the tray: four groups, and the last few again', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    app.replaceSave(defaultSave(NOW));
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.innerHTML = '';
  });

  it('a chip row per group; the coins ones show with their price until learned', () => {
    const ids = (html: string) => [...html.matchAll(/data-trick="([^"]+)"/g)].map((m) => m[1]);
    expect(ids(trickChips('emote'))).toEqual(expect.arrayContaining(['love', 'laugh', 'wiggle', 'peekaboo']));
    expect(ids(trickChips('trick'))).toEqual(expect.arrayContaining(['wave', 'hop', 'highfive', 'tailchase']));
    expect(ids(trickChips('dance'))).not.toContain('wave');
    for (const g of TRICK_GROUPS) for (const id of ids(trickChips(g))) expect(trickGroup(TRICK_BY_ID[id as TrickId]), id).toBe(g);
    expect(trickChips('emote')).toMatch(/data-trick="peekaboo"[^>]*aria-label="[^"]*80/);
  });

  it('switching group, playing one, and finding it under "Again"', () => {
    const { svg } = scene();
    const host = document.createElement('div');
    document.body.append(host);
    const scope = new Scope();
    const tray = mountTrickTray(scope, host, () => svg);
    tray.openFor('cotton');
    expect([...host.querySelectorAll<HTMLElement>('[data-tray-tab]')].map((b) => b.textContent)).toEqual(['Emotes', 'Tricks', 'Dances', 'Group acts']);
    (host.querySelector('[data-tray-tab="emote"]') as HTMLElement).click();
    expect(host.querySelector('[data-tray-tab="emote"]')?.getAttribute('aria-selected')).toBe('true');
    expect(host.querySelector('.trick-tray__recent')).toBeNull();
    (host.querySelector('.trick-tray__list [data-trick="wiggle"]') as HTMLElement).click();
    expect(svg.querySelector('[data-friend="cotton"]')?.getAttribute('data-trick')).toBe('wiggle');
    expect(recentTricks()[0]).toBe('wiggle');
    expect(host.querySelector('.trick-tray__recent [data-trick="wiggle"]')).not.toBeNull();
    noteRecent('highfive');
    expect(recentTricks().slice(0, 2)).toEqual(['highfive', 'wiggle']);
    // Something never learned is never "again".
    noteRecent('balloon');
    expect(recentTricks()).not.toContain('balloon');
    scope.dispose();
  });
});

describe('the Shop’s tricks tab', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
    localStorage.clear();
    app.replaceSave(defaultSave(NOW));
    Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true });
  });
  afterEach(() => {
    vi.useRealTimers();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    document.body.innerHTML = '';
  });

  it('is grouped Emotes, Tricks, Dances, Group acts, with a coins section; a card opens its sheet, where coins learn it', () => {
    grant(app.save, 'test:coins', 200, 'gift', NOW);
    mountApp().go({ screen: 'shop', tab: 'tricks' });
    expect([...document.querySelectorAll('.shop__group')].map((h) => h.textContent)).toEqual(['Emotes', 'Tricks', 'Dances', 'Group acts']);
    expect(document.querySelector('[data-trick-group="trick"][data-trick-tier="coins"] [data-trick-card="tailchase"]')).not.toBeNull();
    expect(document.querySelector('[data-trick-group="group"] [data-trick-card="duet"]')).not.toBeNull();
    (document.querySelector('[data-trick-card="tailchase"]') as HTMLElement).click();
    const sheet = document.querySelector('.trick-sheet')!;
    expect(sheet.querySelector('.trick-sheet__stage')).not.toBeNull();
    (sheet.querySelector('[data-act="buy"]') as HTMLElement).click();
    expect(ownsTrick(app.save, 'tailchase')).toBe(true);
    expect(balance(app.save)).toBe(100);
  });
});
