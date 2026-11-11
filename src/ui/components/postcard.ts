/**
 * Postcards (D47 PR 5): a captured scene made into a keepsake. The picture is cropped to the postcard's shape round the
 * part the player framed, set on warm paper with a soft rounded edge, and, if the player wants, signed small in a
 * corner with the PawTyk mark and the home's name. Nothing about the player goes on it.
 *
 * `postcardLayout` is the geometry (pure, tested); `composePostcard` paints it on a canvas.
 */

export type Orientation = 'landscape' | 'portrait';

/** Output sizes: a 3:2 card and a 4:5 one (what a phone's photos and messages show well). */
export const POSTCARD_SIZE: Record<Orientation, { w: number; h: number }> = {
  landscape: { w: 1500, h: 1000 },
  portrait: { w: 1080, h: 1350 },
};

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PostcardLayout {
  w: number;
  h: number;
  /** Where the picture sits on the card. */
  photo: Rect;
  /** The part of the captured picture that fills it (the card's shape, round the framed centre, inside the capture). */
  crop: Rect;
  /** The corner radius of the picture, the paper margin, and the signature's line (its baseline and height). */
  radius: number;
  margin: number;
  signature: { x: number; y: number; size: number } | null;
}

/**
 * The card's geometry for a capture `srcW` × `srcH`, framed round `focus` (0–1 across and down; the middle by
 * default). The crop keeps the card's own shape and never reaches outside the capture.
 */
export function postcardLayout(o: Orientation, srcW: number, srcH: number, signed: boolean, focus = { x: 0.5, y: 0.5 }): PostcardLayout {
  const { w, h } = POSTCARD_SIZE[o];
  const margin = Math.round(Math.min(w, h) * 0.045);
  // The signature sits on the paper under the picture (a narrow band), or the picture takes it.
  const band = signed ? Math.round(h * 0.075) : 0;
  const photo = { x: margin, y: margin, w: w - margin * 2, h: h - margin * 2 - band };
  const aspect = photo.w / photo.h;
  let cw = srcW;
  let ch = cw / aspect;
  if (ch > srcH) {
    ch = srcH;
    cw = ch * aspect;
  }
  const cx = Math.min(srcW - cw / 2, Math.max(cw / 2, focus.x * srcW));
  const cy = Math.min(srcH - ch / 2, Math.max(ch / 2, focus.y * srcH));
  const crop = { x: cx - cw / 2, y: cy - ch / 2, w: cw, h: ch };
  const size = Math.round(band * 0.42);
  return {
    w,
    h,
    photo,
    crop,
    radius: Math.round(margin * 0.7),
    margin,
    signature: signed ? { x: margin, y: photo.y + photo.h + Math.round(band * 0.66), size } : null,
  };
}

function roundRect(c: CanvasRenderingContext2D, r: Rect, rad: number): void {
  c.beginPath();
  c.moveTo(r.x + rad, r.y);
  c.arcTo(r.x + r.w, r.y, r.x + r.w, r.y + r.h, rad);
  c.arcTo(r.x + r.w, r.y + r.h, r.x, r.y + r.h, rad);
  c.arcTo(r.x, r.y + r.h, r.x, r.y, rad);
  c.arcTo(r.x, r.y, r.x + r.w, r.y, rad);
  c.closePath();
}

export interface PostcardOptions {
  orientation: Orientation;
  /** Sign it: the PawTyk mark and the home's name. */
  signed: boolean;
  /** The home's name (no player names). */
  place: string;
  /** The PawTyk mark, if it loaded. */
  logo?: CanvasImageSource | null;
  /** Where the player framed (0–1 across and down), for the crop. */
  focus?: { x: number; y: number };
  /** The home's colour, for a thin rule under the picture. */
  accent?: string;
}

/** Paints the card. Null if there is no 2D canvas (tests without one). */
export function composePostcard(src: HTMLCanvasElement, o: PostcardOptions): HTMLCanvasElement | null {
  const L = postcardLayout(o.orientation, src.width, src.height, o.signed, o.focus);
  const out = document.createElement('canvas');
  out.width = L.w;
  out.height = L.h;
  const c = out.getContext('2d');
  if (!c) return null;
  // Warm paper, a little lighter at the middle.
  const paper = c.createRadialGradient(L.w / 2, L.h / 2, L.w * 0.1, L.w / 2, L.h / 2, L.w * 0.8);
  paper.addColorStop(0, '#fffaf0');
  paper.addColorStop(1, '#f6ecd8');
  c.fillStyle = paper;
  c.fillRect(0, 0, L.w, L.h);
  // The picture: a soft shadow, then the photo clipped to its rounded rectangle, then a fine edge.
  c.save();
  c.shadowColor = 'rgba(60,45,25,0.22)';
  c.shadowBlur = L.margin * 0.5;
  c.shadowOffsetY = L.margin * 0.12;
  roundRect(c, L.photo, L.radius);
  c.fillStyle = '#e9efe2';
  c.fill();
  c.restore();
  c.save();
  roundRect(c, L.photo, L.radius);
  c.clip();
  c.imageSmoothingQuality = 'high';
  c.drawImage(src, L.crop.x, L.crop.y, L.crop.w, L.crop.h, L.photo.x, L.photo.y, L.photo.w, L.photo.h);
  c.restore();
  roundRect(c, L.photo, L.radius);
  c.strokeStyle = 'rgba(80,60,35,0.18)';
  c.lineWidth = 2;
  c.stroke();
  if (L.signature) {
    const s = L.signature;
    let x = s.x;
    if (o.logo) {
      const d = Math.round(s.size * 1.5);
      c.save();
      roundRect(c, { x, y: s.y - d * 0.8, w: d, h: d }, d * 0.22);
      c.clip();
      c.drawImage(o.logo, x, s.y - d * 0.8, d, d);
      c.restore();
      x += d + s.size * 0.5;
    }
    c.fillStyle = '#4a3a2a';
    c.textBaseline = 'alphabetic';
    c.font = `600 ${s.size}px Fredoka, ui-rounded, 'SF Pro Rounded', system-ui, sans-serif`;
    c.fillText('PawTyk', x, s.y);
    const pw = c.measureText('PawTyk').width;
    c.fillStyle = '#7a6650';
    c.font = `600 ${Math.round(s.size * 0.9)}px 'Nunito Sans', ui-rounded, -apple-system, system-ui, sans-serif`;
    c.fillText(`  ·  ${o.place}`, x + pw, s.y);
    if (o.accent) {
      c.fillStyle = o.accent;
      c.globalAlpha = 0.5;
      c.fillRect(L.w - L.margin - s.size * 3, s.y - s.size * 0.38, s.size * 3, Math.max(2, s.size * 0.12));
      c.globalAlpha = 1;
    }
  }
  return out;
}

/** The card as a PNG, for sharing. */
export function postcardBlob(card: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise((resolve) => {
    try {
      card.toBlob((b) => resolve(b), 'image/png');
    } catch {
      // A tainted canvas (it shouldn't be: everything on it is our own) or no encoder.
      resolve(null);
    }
  });
}

let logoImg: Promise<HTMLImageElement | null> | null = null;
/** The PawTyk mark (the app's own icon, from this origin, so the card stays shareable). */
export function postcardLogo(): Promise<HTMLImageElement | null> {
  logoImg ??= new Promise((resolve) => {
    if (typeof Image === 'undefined') return resolve(null);
    const img = new Image();
    // A card is never kept waiting for its signature: without the mark in a moment, it is signed in words alone.
    const late = setTimeout(() => resolve(null), 1200);
    img.onload = () => {
      clearTimeout(late);
      resolve(img);
    };
    img.onerror = () => {
      clearTimeout(late);
      resolve(null);
    };
    img.src = `${import.meta.env.BASE_URL ?? '/'}apple-touch-icon.png`;
  });
  return logoImg;
}
