/**
 * Sharing a picture (D47 PR 5): on iPhone through the system share sheet (`@capacitor/share`, which offers Save Image,
 * Messages, AirDrop…), with the picture written to the app's cache first (`@capacitor/filesystem`) and removed after.
 * In a browser, the Web Share API where it can share files, else a download. Always the player's choice: nothing is
 * sent anywhere by itself, and a picture carries nothing about them.
 *
 * Results: `shared` (the sheet finished: the player picked something and it took the picture — not proof that anything
 * was posted or seen), `downloaded` (a browser saved it), `copied` (text only, no share sheet: copied for the player
 * to paste), `cancelled` (the player closed the sheet: not an error), `failed` (anything else, e.g. Photos access
 * refused when saving).
 *
 * M3: a picture can go with a line of text and a link (`ShareExtra`: the configured public page, never anything about
 * the player), and a message can be shared on its own (`shareText`). Nobody's contacts or accounts are ever touched:
 * the system sheet is the player's, and PawTyk only learns which of the results above it reported.
 */

import { Capacitor } from '@capacitor/core';

export type ShareResult = 'shared' | 'downloaded' | 'copied' | 'cancelled' | 'failed';

/** What goes with a picture: a line of text, and a link (already in the text for apps that drop links). */
export interface ShareExtra {
  text?: string;
  url?: string | null;
}

const CANCEL = /cancel|abort|dismiss/i;

function base64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

/** Only one share sheet at a time. */
let busy = false;

const outcome = (e: unknown): ShareResult => (CANCEL.test(String((e as Error)?.message ?? e)) || (e as Error)?.name === 'AbortError' ? 'cancelled' : 'failed');

export async function shareImage(blob: Blob, fileName: string, title: string, extra: ShareExtra = {}): Promise<ShareResult> {
  if (busy) return 'cancelled';
  busy = true;
  try {
    if (Capacitor.isNativePlatform()) return await shareNative(blob, fileName, title, extra);
    return await shareWeb(blob, fileName, title, extra);
  } catch (e) {
    return outcome(e);
  } finally {
    busy = false;
  }
}

/**
 * A message on its own (M3: a puzzle result without its card): the system share sheet on iPhone and where the browser
 * has one, else copied for the player to paste (`copied`), else `failed`.
 */
export async function shareText(text: string, url?: string | null): Promise<ShareResult> {
  if (busy) return 'cancelled';
  busy = true;
  try {
    if (Capacitor.isNativePlatform()) {
      const { Share } = await import('@capacitor/share');
      await Share.share({ text, ...(url ? { url } : {}) });
      return 'shared';
    }
    const nav = navigator as Navigator;
    if (nav.share) {
      await nav.share({ text, ...(url ? { url } : {}) });
      return 'shared';
    }
    if (nav.clipboard?.writeText) {
      await nav.clipboard.writeText(url && !text.includes(url) ? `${text} ${url}` : text);
      return 'copied';
    }
    return 'failed';
  } catch (e) {
    return outcome(e);
  } finally {
    busy = false;
  }
}

async function shareNative(blob: Blob, fileName: string, title: string, extra: ShareExtra): Promise<ShareResult> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const path = `postcards/${fileName}`;
  // Last time's card, if a share was interrupted before it could be removed.
  await Filesystem.rmdir({ path: 'postcards', directory: Directory.Cache, recursive: true }).catch(() => {});
  const { uri } = await Filesystem.writeFile({ path, data: await base64(blob), directory: Directory.Cache, recursive: true });
  try {
    // The link once: in the text if it's there already, else on its own.
    await Share.share({ title, files: [uri], ...(extra.text ? { text: extra.text } : {}), ...(extra.url && !extra.text?.includes(extra.url) ? { url: extra.url } : {}) });
    return 'shared';
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
  }
}

async function shareWeb(blob: Blob, fileName: string, title: string, extra: ShareExtra): Promise<ShareResult> {
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: blob.type || 'image/png' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    // The text carries the link already (some apps drop a separate url when there are files).
    await nav.share({ files: [file], title, ...(extra.text ? { text: extra.text } : {}) });
    return 'shared';
  }
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    return 'downloaded';
  } finally {
    // Long enough for the browser to start the download.
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
}
