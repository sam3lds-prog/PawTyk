/**
 * Copying a WebGL canvas for a picture (D47 PR 5: postcards). Called right after a frame is drawn, in the same task,
 * so the drawing buffer is still there: the renderers need no `preserveDrawingBuffer` (which costs every frame).
 */

/** A 2D copy of a canvas, or null if it is empty or there is no 2D canvas. */
export function copyCanvas(src: HTMLCanvasElement): HTMLCanvasElement | null {
  if (!src.width || !src.height) return null;
  const c = document.createElement('canvas');
  c.width = src.width;
  c.height = src.height;
  const ctx = c.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(src, 0, 0);
  return c;
}
