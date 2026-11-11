// @vitest-environment happy-dom
/**
 * D47 PR 5: photo mode and postcards. The card's geometry keeps its shape and never reaches outside the picture;
 * the scene's copy carries each part's live look and nothing interactive; photo mode opens and closes cleanly (the
 * scene's controls back, nothing left behind), drops a capture that finishes after the screen went, says so when a
 * picture can't be taken, survives repeated captures (every picture released), and sharing is the player's choice,
 * with a download where a browser can't share and a cancel that is not an error.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { POSTCARD_SIZE, postcardLayout } from '../../src/ui/components/postcard';
import { freezeSvg } from '../../src/ui/components/sceneCapture';
import { groupFrame } from '../../src/ui/components/photoFrames';
import { Scope } from '../../src/ui/router';

describe('the postcard’s shape', () => {
  for (const o of ['landscape', 'portrait'] as const)
    for (const [w, h] of [
      [2160, 1800],
      [1170, 2532],
      [800, 800],
    ])
      it(`${o} from ${w}×${h}: the crop keeps the picture's shape and stays inside the capture`, () => {
        for (const focus of [
          { x: 0.5, y: 0.5 },
          { x: 0, y: 0 },
          { x: 1, y: 1 },
        ]) {
          const L = postcardLayout(o, w, h, true, focus);
          expect(L.w).toBe(POSTCARD_SIZE[o].w);
          expect(L.crop.w / L.crop.h).toBeCloseTo(L.photo.w / L.photo.h, 3);
          expect(L.crop.x).toBeGreaterThanOrEqual(-1e-6);
          expect(L.crop.y).toBeGreaterThanOrEqual(-1e-6);
          expect(L.crop.x + L.crop.w).toBeLessThanOrEqual(w + 1e-6);
          expect(L.crop.y + L.crop.h).toBeLessThanOrEqual(h + 1e-6);
          // The signature sits on the paper under the picture, inside the card.
          expect(L.signature!.y).toBeGreaterThan(L.photo.y + L.photo.h);
          expect(L.signature!.y).toBeLessThan(L.h);
        }
      });

  it('unsigned, the picture takes the band', () => {
    const a = postcardLayout('landscape', 2000, 1500, true);
    const b = postcardLayout('landscape', 2000, 1500, false);
    expect(b.signature).toBeNull();
    expect(b.photo.h).toBeGreaterThan(a.photo.h);
  });
});

describe('the scene’s copy for a picture', () => {
  it('carries each part’s live look (hidden, faded, mid-move) and nothing for focus or screen readers', () => {
    document.body.innerHTML = `<svg viewBox="0 0 360 300" role="img" aria-label="x" class="s"><g class="a" tabindex="0"><rect width="10" height="10"/></g><g class="b"><rect/></g></svg>`;
    const st = document.createElement('style');
    st.textContent = '.a { opacity: 0.4; transform: translate(3px, 4px); } .b { display: none; }';
    document.head.appendChild(st);
    const svg = document.querySelector('svg')!;
    const m = freezeSvg(svg, 1200, 1000);
    expect(m).toMatch(/xmlns="http:\/\/www.w3.org\/2000\/svg"/);
    expect(m).toMatch(/width="1200"/);
    expect(m).toMatch(/opacity:\s*0.4/);
    expect(m).toMatch(/display:\s*none/);
    expect(m).not.toMatch(/tabindex|aria-label|role=/);
    st.remove();
  });
});

describe('framing everyone', () => {
  it('fits every animal with room round them, and never zooms past the whole home for a spread-out group', () => {
    const full = { x: 0, y: 0, w: 360, h: 300 };
    const close = groupFrame(full, [
      { x: 150, y: 200, h: 30 },
      { x: 190, y: 210, h: 30 },
    ]);
    expect(close.w).toBeLessThan(full.w);
    for (const p of [150, 190]) {
      expect(p).toBeGreaterThan(close.x);
      expect(p).toBeLessThan(close.x + close.w);
    }
    const spread = groupFrame(full, [
      { x: 20, y: 150, h: 30 },
      { x: 340, y: 260, h: 30 },
    ]);
    expect(spread).toEqual(full);
  });
});

describe('photo mode', () => {
  let scope: Scope;
  let host: HTMLElement;
  beforeEach(() => {
    document.body.innerHTML = '<figure class="sanctuary__scene"><button class="scene-tour">Tour</button></figure>';
    host = document.querySelector('figure')!;
    scope = new Scope();
  });
  afterEach(() => {
    scope.dispose();
    vi.restoreAllMocks();
  });

  const canvas = () => {
    const c = document.createElement('canvas');
    c.width = 400;
    c.height = 300;
    return c;
  };

  it('opens over the scene, and Done puts everything back (no leftover controls, the scene’s class gone)', async () => {
    const { openPhotoMode } = await import('../../src/ui/components/photoMode');
    const dock = document.createElement('div');
    host.after(dock);
    const go = vi.fn();
    const pm = openPhotoMode(scope, host, { place: 'Meadow Farm', home: 'farm', kind: '2d', frames: [{ id: 'home', label: 'Whole home', go }], capture: async () => canvas() }, { dock });
    expect(host.classList.contains('is-photo')).toBe(true);
    expect(go).toHaveBeenCalledTimes(1);
    expect(dock.querySelector('[data-act="photo-take"]')).not.toBeNull();
    (host.querySelector('[data-act="photo-done"]') as HTMLButtonElement).click();
    await pm.done;
    expect(pm.open).toBe(false);
    expect(host.classList.contains('is-photo')).toBe(false);
    expect(document.querySelector('.photo-mode, .photo-mode__panel')).toBeNull();
  });

  it('a capture that finishes after the screen went shows nothing and keeps nothing', async () => {
    const { openPhotoMode, photoStats } = await import('../../src/ui/components/photoMode');
    let finish: (c: HTMLCanvasElement | null) => void = () => {};
    const made = photoStats.made;
    const pm = openPhotoMode(scope, host, { place: 'Farm', home: 'farm', kind: '2d', frames: [], capture: () => new Promise((r) => (finish = r)) });
    (host.querySelector('[data-act="photo-take"]') as HTMLButtonElement).click();
    scope.dispose();
    const c = canvas();
    finish(c);
    await pm.done;
    // (The PawTyk mark is waited for a moment at most.)
    await vi.waitFor(() => expect(c.width).toBe(0), { timeout: 3000 });
    expect(document.querySelector('.postcard-sheet')).toBeNull();
    expect(photoStats.made).toBe(made);
    expect(c.width).toBe(0);
  });

  it('says so when a picture can’t be taken (no renderer, no canvas), and stays open to try again', async () => {
    const { openPhotoMode } = await import('../../src/ui/components/photoMode');
    const sheet = await import('../../src/ui/components/sheet');
    const toast = vi.spyOn(sheet, 'toast').mockImplementation(() => {});
    const pm = openPhotoMode(scope, host, { place: 'Farm', home: 'farm', kind: '3d', frames: [], capture: async () => null });
    (host.querySelector('[data-act="photo-take"]') as HTMLButtonElement).click();
    await vi.waitFor(() => expect(toast).toHaveBeenCalled(), { timeout: 3000 });
    expect(String(toast.mock.calls[0][0])).toMatch(/couldn.t be taken/);
    expect(pm.open).toBe(true);
  });
});

describe('sharing a postcard', () => {
  afterEach(() => vi.restoreAllMocks());

  it('a browser that can’t share files downloads it (and frees the link); one that can, shares; a cancel is not an error', async () => {
    const { shareImage } = await import('../../src/services/share');
    const blob = new Blob(['x'], { type: 'image/png' });
    const created = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:x');
    const revoked = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    vi.useFakeTimers();
    const click = vi.fn();
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(click);
    expect(await shareImage(blob, 'a.png', 'A')).toBe('downloaded');
    expect(click).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(5000);
    expect(created).toHaveBeenCalledTimes(1);
    expect(revoked).toHaveBeenCalledTimes(1);
    vi.useRealTimers();

    const nav = navigator as Navigator & { canShare?: unknown; share?: unknown };
    const share = vi.fn().mockResolvedValue(undefined);
    Object.assign(nav, { canShare: () => true, share });
    expect(await shareImage(blob, 'a.png', 'A')).toBe('shared');
    expect(share).toHaveBeenCalledTimes(1);
    share.mockRejectedValueOnce(Object.assign(new Error('Share canceled'), { name: 'AbortError' }));
    expect(await shareImage(blob, 'a.png', 'A')).toBe('cancelled');
    share.mockRejectedValueOnce(new Error('NotAllowedError: permission'));
    expect(await shareImage(blob, 'a.png', 'A')).toBe('failed');
    Reflect.deleteProperty(nav, 'canShare');
    Reflect.deleteProperty(nav, 'share');
  });
});
