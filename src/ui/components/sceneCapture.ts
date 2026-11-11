/**
 * A picture of a scene as it is this moment (D47 PR 5): the drawn scene, through the camera's current view, painted
 * onto a canvas, with the 3D toys over it when they are showing. No screenshot API and nothing from outside the app:
 * the scene's own SVG is copied with each part's current look (its opacity, whether it shows, and its pose in an
 * animation, read from the live page), drawn as an image, and the toys' WebGL canvas is copied right after a fresh
 * frame. So the capture never taints the canvas (everything on it is the app's own) and needs no kept drawing buffer.
 */

/** What a part looks like right now that its SVG attributes don't say: set by style sheets and animations. */
const LIVE = ['opacity', 'visibility', 'display', 'transform', 'transform-origin', 'transform-box'] as const;

/** The scene's SVG with every part's live look written onto it, sized `w` × `h`, as standalone markup. */
export function freezeSvg(svg: SVGSVGElement, w: number, h: number): string {
  const copy = svg.cloneNode(true) as SVGSVGElement;
  const from = [svg, ...svg.querySelectorAll('*')];
  const to = [copy, ...copy.querySelectorAll('*')];
  const view = typeof getComputedStyle === 'function';
  for (let i = 0; i < from.length && i < to.length; i++) {
    const el = to[i] as SVGElement;
    // Nothing interactive or for screen readers goes on a picture.
    el.removeAttribute('tabindex');
    if (!view) continue;
    const cs = getComputedStyle(from[i] as Element);
    let style = '';
    for (const p of LIVE) {
      const v = cs.getPropertyValue(p);
      if (!v || (p === 'transform' && v === 'none') || (p === 'opacity' && v === '1') || (p === 'visibility' && v === 'visible')) continue;
      if (p === 'display' && v !== 'none') continue;
      style += `${p}:${v};`;
    }
    // Moving parts are caught mid-move, then held there.
    if (style) el.setAttribute('style', `${el.getAttribute('style') ?? ''};${style}animation:none;transition:none`);
  }
  copy.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
  copy.setAttribute('width', String(Math.round(w)));
  copy.setAttribute('height', String(Math.round(h)));
  copy.setAttribute('preserveAspectRatio', 'xMidYMid slice');
  copy.removeAttribute('role');
  copy.removeAttribute('aria-label');
  copy.removeAttribute('class');
  return new XMLSerializer().serializeToString(copy);
}

/** Loads markup as an image (from a blob this function makes and frees). */
function svgImage(markup: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(new Blob([markup], { type: 'image/svg+xml;charset=utf-8' }));
    const img = new Image();
    const done = (ok: boolean) => {
      URL.revokeObjectURL(url);
      resolve(ok ? img : null);
    };
    img.onload = () => done(true);
    img.onerror = () => done(false);
    img.src = url;
  });
}

/** The scene as it is now, `width` pixels across (its height follows the view's shape), with the toys over it. */
export async function captureScene(svg: SVGSVGElement, o: { width: number; toys?: (() => HTMLCanvasElement | null) | null }): Promise<HTMLCanvasElement | null> {
  const vb = svg.viewBox.baseVal;
  const box = svg.getBoundingClientRect();
  // The shape on screen (the view is fitted into the figure), or the view's own.
  const aspect = box.width && box.height ? box.width / box.height : vb && vb.width && vb.height ? vb.width / vb.height : 1.2;
  const w = Math.round(o.width);
  const h = Math.round(w / aspect);
  const img = await svgImage(freezeSvg(svg, w, h));
  if (!img) return null;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const c = out.getContext('2d');
  if (!c) return null;
  c.drawImage(img, 0, 0, w, h);
  // The toys: a fresh frame of their canvas, laid over exactly where it shows on screen.
  const toys = o.toys?.() ?? null;
  if (toys && toys.width && toys.height) c.drawImage(toys, 0, 0, w, h);
  return out;
}
