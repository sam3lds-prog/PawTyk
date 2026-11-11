/**
 * Sharing a picture (D47 PR 5): on iPhone through the system share sheet (`@capacitor/share`, which offers Save Image,
 * Messages, AirDrop…), with the picture written to the app's cache first (`@capacitor/filesystem`) and removed after.
 * In a browser, the Web Share API where it can share files, else a download. Always the player's choice: nothing is
 * sent anywhere by itself, and a picture carries nothing about them.
 *
 * Results: `shared` (the sheet finished), `downloaded` (a browser saved it), `cancelled` (the player closed the sheet:
 * not an error), `failed` (anything else, e.g. Photos access refused when saving).
 */

import { Capacitor } from '@capacitor/core';

export type ShareResult = 'shared' | 'downloaded' | 'cancelled' | 'failed';

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

export async function shareImage(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  if (busy) return 'cancelled';
  busy = true;
  try {
    if (Capacitor.isNativePlatform()) return await shareNative(blob, fileName, title);
    return await shareWeb(blob, fileName, title);
  } catch (e) {
    return CANCEL.test(String((e as Error)?.message ?? e)) || (e as Error)?.name === 'AbortError' ? 'cancelled' : 'failed';
  } finally {
    busy = false;
  }
}

async function shareNative(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  const [{ Filesystem, Directory }, { Share }] = await Promise.all([import('@capacitor/filesystem'), import('@capacitor/share')]);
  const path = `postcards/${fileName}`;
  // Last time's card, if a share was interrupted before it could be removed.
  await Filesystem.rmdir({ path: 'postcards', directory: Directory.Cache, recursive: true }).catch(() => {});
  const { uri } = await Filesystem.writeFile({ path, data: await base64(blob), directory: Directory.Cache, recursive: true });
  try {
    await Share.share({ title, files: [uri] });
    return 'shared';
  } finally {
    await Filesystem.deleteFile({ path, directory: Directory.Cache }).catch(() => {});
  }
}

async function shareWeb(blob: Blob, fileName: string, title: string): Promise<ShareResult> {
  const file = typeof File !== 'undefined' ? new File([blob], fileName, { type: blob.type || 'image/png' }) : null;
  const nav = navigator as Navigator & { canShare?: (d: ShareData) => boolean };
  if (file && nav.share && nav.canShare?.({ files: [file] })) {
    await nav.share({ files: [file], title });
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
