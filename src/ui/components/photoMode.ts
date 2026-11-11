/**
 * Photo mode (D47 PR 5): the player frames a moment in a home (drawn or with the 3D toys) or on the Farm walk, takes
 * a picture, and gets a postcard to keep or share.
 *
 *  - The scene stays alive (animals keep moving, so a picture can catch a dance or a trick) and its other controls step
 *    aside. A guide shows the postcard's shape over the scene.
 *  - Framing: the whole home, its animals together, or one animal close (the scene's own camera glides there); on the
 *    walk, wherever the player looks.
 *  - Landscape or portrait; signed with the PawTyk mark and the home's name, or not (the player's choice).
 *  - The shutter makes the postcard and shows it: Share or save (the system share sheet on iPhone, which offers Save
 *    Image), Take another, or Done. Sharing is never automatic and the picture carries nothing about the player.
 *  - Done (or leaving the screen) puts the camera back where it was and everything back as it was. A capture still
 *    running when the screen goes is dropped; every picture made is released.
 */

import { app } from '../../app/app';
import { track } from '../../services/analytics';
import { feel } from '../../services/feel';
import { shareImage, type ShareResult } from '../../services/share';
import { esc, h } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { composePostcard, postcardBlob, postcardLayout, postcardLogo, type Orientation } from './postcard';
import { openSheet, toast } from './sheet';

export interface PhotoFrame {
  id: string;
  label: string;
  /**
   * Moves the camera there (resolves when it has arrived). `shape` is the postcard window's share of the view (D48 PR
   * A): the framing fits its animals inside it, with room to spare.
   */
  go(shape?: { w: number; h: number }): Promise<unknown> | void;
  /** Where this framing's animals are in the view now (0–1 across and down), so the postcard's crop keeps them. */
  focus?(): { x: number; y: number };
}

export interface PhotoTarget {
  /** The home's name, for the signature (no player names). */
  place: string;
  /** For analytics and the file name: the home's id ('farm'…). */
  home: string;
  kind: '2d' | '3d' | 'walk';
  accent?: string;
  /** Framings to choose from (the first is where it starts); none on the walk (the player looks round). */
  frames: PhotoFrame[];
  /** The picture as it is now, or null if it can't be taken. */
  capture(): Promise<HTMLCanvasElement | null>;
}

export interface PhotoMode {
  readonly done: Promise<void>;
  close(): void;
  /** Whether it is open. */
  readonly open: boolean;
}

/** How many postcards have been made and freed this session (tests and QA: no picture is kept by mistake). */
export const photoStats = { made: 0, freed: 0, urls: 0, revoked: 0 };
if (import.meta.env.DEV && typeof window !== 'undefined') (window as unknown as { __photoStats?: unknown }).__photoStats = photoStats;

const SHUTTER_ICON = '<svg viewBox="0 0 24 24" width="30" height="30" aria-hidden="true"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.4"/><circle cx="12" cy="12" r="6.2" fill="currentColor"/></svg>';

/**
 * Opens photo mode over `host` (the scene's figure, or the walk). With `dock`, the controls sit there (under a small
 * scene) instead of over the picture.
 */
export function openPhotoMode(parent: Scope, host: HTMLElement, t: PhotoTarget, o: { dock?: HTMLElement } = {}): PhotoMode {
  const scope = parent.child();
  let orientation: Orientation = 'landscape';
  let signed = true;
  let frame = t.frames[0]?.id ?? null;
  let busy = false;
  let isOpen = true;
  let resolve!: () => void;
  const done = new Promise<void>((r) => (resolve = r));
  track('photo_mode_open', { home: t.home, kind: t.kind });

  const ui = h(`
    <div class="photo-mode" role="group" aria-label="Photo mode">
      <div class="photo-mode__guide" data-photo-guide aria-hidden="true"><div class="photo-mode__window"></div></div>
      <div class="photo-mode__top">
        <span class="photo-mode__title">${ICON.camera}Photo</span>
        <button class="photo-mode__done" data-act="photo-done">Done</button>
      </div>
      <div class="photo-mode__panel">
        ${
          t.frames.length > 1
            ? `<div class="photo-mode__frames" role="radiogroup" aria-label="Framing">${t.frames
                .map((f) => `<button class="photo-chip" role="radio" aria-checked="${f.id === frame}" data-frame="${esc(f.id)}">${esc(f.label)}</button>`)
                .join('')}</div>`
            : ''
        }
        <div class="photo-mode__row">
          <div class="photo-seg" role="radiogroup" aria-label="Shape">
            <button class="photo-chip" role="radio" aria-checked="true" data-orient="landscape">Landscape</button>
            <button class="photo-chip" role="radio" aria-checked="false" data-orient="portrait">Portrait</button>
          </div>
          <button class="photo-shutter" data-act="photo-take" aria-label="Take the photo">${SHUTTER_ICON}</button>
          <label class="photo-sign"><input type="checkbox" data-photo-sign checked /> <span>PawTyk &amp; ${esc(t.place)}</span></label>
        </div>
      </div>
      <div class="photo-mode__flash" data-photo-flash aria-hidden="true"></div>
    </div>`);
  host.appendChild(ui);
  host.classList.add('is-photo');
  const panel = ui.querySelector<HTMLElement>('.photo-mode__panel')!;
  if (o.dock) {
    panel.classList.add('is-docked');
    o.dock.appendChild(panel);
  }
  const guide = ui.querySelector<HTMLElement>('[data-photo-guide]')!;
  const win = guide.firstElementChild as HTMLElement;

  /** The framing chosen now (its focus keeps the animals on the card). */
  const current = () => t.frames.find((f) => f.id === frame) ?? null;
  /** The postcard window's share of the scene (D48 PR A), for fitting a framing inside it. */
  const shape = () => {
    const b = host.getBoundingClientRect();
    if (!b.width || !b.height) return { w: 1, h: 1 };
    const L = postcardLayout(orientation, b.width, b.height, signed);
    return { w: L.crop.w / b.width, h: L.crop.h / b.height };
  };
  /** The postcard's picture shape, over the scene: exactly what will be on the card (it follows the animals). */
  const placeGuide = () => {
    const b = host.getBoundingClientRect();
    if (!b.width || !b.height) return;
    const L = postcardLayout(orientation, b.width, b.height, signed, current()?.focus?.());
    win.style.left = `${(L.crop.x / b.width) * 100}%`;
    win.style.top = `${(L.crop.y / b.height) * 100}%`;
    win.style.width = `${(L.crop.w / b.width) * 100}%`;
    win.style.height = `${(L.crop.h / b.height) * 100}%`;
  };
  /** Frames the chosen view for the card's shape now, and puts the guide over it once the camera is there. */
  const reframe = () => {
    placeGuide();
    const go = current()?.go(shape());
    void Promise.resolve(go).then(() => scope.alive && placeGuide());
  };
  placeGuide();
  scope.on(window, 'resize', placeGuide);

  const choose = (sel: string, attr: string, value: string) => {
    for (const b of ui.querySelectorAll<HTMLElement>(sel)) b.setAttribute('aria-checked', String(b.getAttribute(attr) === value));
  };

  const close = () => scope.dispose();
  scope.onDispose(() => {
    isOpen = false;
    ui.remove();
    panel.remove();
    host.classList.remove('is-photo');
    resolve();
  });

  async function take(): Promise<void> {
    if (busy) return;
    busy = true;
    try {
      if (!app.reducedMotion) {
        const fl = ui.querySelector<HTMLElement>('[data-photo-flash]')!;
        fl.classList.remove('is-on');
        void fl.offsetWidth;
        fl.classList.add('is-on');
      }
      feel('tap');
      const [shot, logo] = await Promise.all([t.capture().catch(() => null), postcardLogo()]);
      // The screen went meanwhile: nothing to show, nothing kept.
      if (!scope.alive) {
        if (shot) shot.width = 0;
        return;
      }
      if (!shot) {
        toast("This picture couldn't be taken. Try again in a moment.");
        return;
      }
      const card = composePostcard(shot, { orientation, signed, place: t.place, logo, accent: t.accent, focus: current()?.focus?.() });
      shot.width = 0;
      if (!card) {
        toast("This picture couldn't be made on this device.");
        return;
      }
      photoStats.made++;
      track('postcard_created', { home: t.home, kind: t.kind, orientation, signed, frame: frame ?? 'view' });
      await preview(card);
    } finally {
      busy = false;
    }
  }

  /** The postcard, and what to do with it. */
  async function preview(card: HTMLCanvasElement): Promise<void> {
    const blob = await postcardBlob(card);
    card.width = 0;
    photoStats.freed++;
    if (!scope.alive) return;
    if (!blob) {
      toast("This picture couldn't be made on this device.");
      return;
    }
    const url = URL.createObjectURL(blob);
    photoStats.urls++;
    const file = `pawtyk-${t.home}-${new Date().toISOString().slice(0, 10)}.png`;
    const ps = openSheet(scope, {
      title: 'Your postcard',
      className: 'postcard-sheet',
      center: true,
      body: `
        <img class="postcard-sheet__img ${orientation === 'portrait' ? 'is-portrait' : ''}" src="${url}" alt="A postcard of ${esc(t.place)}" />
        <div class="sheet__actions">
          <button class="btn btn--block" data-act="pc-share">${ICON.share}Share or save</button>
          <button class="btn btn--secondary btn--block" data-act="pc-again">${ICON.camera}Take another</button>
          <button class="btn btn--quiet" data-act="pc-done">Done</button>
        </div>
        <p class="muted sheet__note">Only the picture is shared, and only if you choose to.</p>`,
      onClose: () => {
        URL.revokeObjectURL(url);
        photoStats.revoked++;
      },
    });
    let sharing = false;
    ps.scope.on(ps.el, 'click', async (e) => {
      const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
      if (!b || sharing) return;
      if (b.dataset.act === 'pc-share') {
        sharing = true;
        b.setAttribute('aria-busy', 'true');
        const r: ShareResult = await shareImage(blob, file, `${t.place} · PawTyk`);
        sharing = false;
        b.removeAttribute('aria-busy');
        track('postcard_shared', { home: t.home, result: r });
        if (r === 'shared') toast('Postcard shared.', ICON.check);
        else if (r === 'downloaded') toast('Postcard saved to your downloads.', ICON.check);
        else if (r === 'failed') toast("It couldn't be shared or saved. If you chose Save Image, PawTyk may need permission for Photos in Settings.");
      } else if (b.dataset.act === 'pc-again') ps.close();
      else {
        ps.close();
        close();
      }
    });
  }

  const onClick = (e: Event) => {
    const el = e.target as HTMLElement;
    const fr = el.closest<HTMLElement>('[data-frame]');
    if (fr && !busy) {
      frame = fr.dataset.frame!;
      choose('[data-frame]', 'data-frame', frame);
      reframe();
      return;
    }
    const or = el.closest<HTMLElement>('[data-orient]');
    if (or) {
      orientation = or.dataset.orient as Orientation;
      choose('[data-orient]', 'data-orient', orientation);
      // A new shape: the framing is fitted to it again, so nobody ends up on the card's edge.
      reframe();
      return;
    }
    if (el.closest('[data-act="photo-take"]')) void take();
    else if (el.closest('[data-act="photo-done"]')) close();
  };
  scope.on(ui, 'click', onClick);
  if (o.dock) scope.on(panel, 'click', onClick);
  scope.on(panel, 'change', (e) => {
    const box = (e.target as HTMLElement).closest<HTMLInputElement>('[data-photo-sign]');
    if (!box) return;
    signed = box.checked;
    reframe();
  });
  reframe();
  panel.querySelector<HTMLElement>('[data-act="photo-take"]')?.focus({ preventScroll: true });

  return {
    done,
    close,
    get open() {
      return isOpen;
    },
  };
}
