/**
 * A Daily Puzzle result to share (M3): a card and a few lines of text, spoiler-free by construction. They are made only
 * from the day, the hearts left, the time and the streak: never the board, its regions or where any animal went, so
 * nothing on them can help anyone solve it. The decorative row of paws and sparkles comes from the date alone (the same
 * for everyone that day), not from the player's moves.
 *
 * The card is offered from the win sheet's optional Share, never pushed: the sheet shows it, and the player chooses
 * to share it (the system sheet, which also offers Save Image) or not.
 */

import { dateFromKey } from '../../game/dates';
import { linkLabel, shareLink, GAME_URL } from '../../config/links';
import { track } from '../../services/analytics';
import { shareImage, shareText, type ShareResult } from '../../services/share';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { postcardBlob, postcardLogo } from './postcard';
import { openSheet, toast } from './sheet';

export interface DailyResult {
  dateKey: string;
  /** Hearts left at the end, and how many the board had (null: a board without hearts). */
  hearts: number | null;
  maxHearts: number;
  seconds: number;
  /** The Daily streak including today. */
  streak: number;
}

/** Fields a result may carry: anything else (a board, a solution, a move) would be a spoiler, and is refused. */
const ALLOWED = new Set(['dateKey', 'hearts', 'maxHearts', 'seconds', 'streak']);

export function cleanResult(r: DailyResult): DailyResult {
  for (const k of Object.keys(r)) if (!ALLOWED.has(k)) throw new Error(`a share card never carries "${k}"`);
  return { dateKey: r.dateKey, hearts: r.hearts, maxHearts: r.maxHearts, seconds: Math.max(0, Math.round(r.seconds)), streak: Math.max(0, Math.round(r.streak)) };
}

export function clock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')}:${String(s).padStart(2, '0')}` : `${m}:${String(s).padStart(2, '0')}`;
}

export function dayLabel(dateKey: string, long = false): string {
  return dateFromKey(dateKey).toLocaleDateString('en-US', long ? { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' } : { weekday: 'short', month: 'short', day: 'numeric' });
}

/** Three rows of five paws and sparkles, from the date alone. */
export function resultPattern(dateKey: string): Array<Array<'paw' | 'spark'>> {
  let h = 2166136261;
  for (const c of dateKey) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  const rows: Array<Array<'paw' | 'spark'>> = [];
  for (let r = 0; r < 3; r++) {
    const row: Array<'paw' | 'spark'> = [];
    for (let c = 0; c < 5; c++) {
      h = Math.imul(h ^ (r * 5 + c + 1), 16777619);
      row.push((h >>> 7) % 5 < 3 ? 'paw' : 'spark');
    }
    rows.push(row);
  }
  return rows;
}

/** The lines of a shared result (the link last, if there is one). */
export function resultShareText(r: DailyResult, link: string | null = shareLink('daily')): string {
  const x = cleanResult(r);
  const hearts = x.hearts === null ? '' : `${'❤️'.repeat(x.hearts)}${'🤍'.repeat(Math.max(0, x.maxHearts - x.hearts))} · `;
  const streak = x.streak > 1 ? ` · ${x.streak}-day streak` : '';
  const pattern = resultPattern(x.dateKey)
    .map((row) => row.map((c) => (c === 'paw' ? '🐾' : '✨')).join(''))
    .join('\n');
  return [`PawTyk Daily Puzzle · ${dayLabel(x.dateKey)}`, `${hearts}${clock(x.seconds)}${streak}`, pattern, link ? `Can you solve today's puzzle? ${link}` : "Can you solve today's puzzle?"].join('\n');
}

const W = 1080;
const H = 1080;

function heart(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.beginPath();
  c.moveTo(x, y + r * 0.9);
  c.bezierCurveTo(x - r * 1.6, y - r * 0.1, x - r * 0.9, y - r * 1.25, x, y - r * 0.45);
  c.bezierCurveTo(x + r * 0.9, y - r * 1.25, x + r * 1.6, y - r * 0.1, x, y + r * 0.9);
  c.closePath();
}

function paw(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  // Each pad its own shape (one path would join them with lines).
  const pad = (px: number, py: number, rx: number, ry: number, rot = 0) => {
    c.beginPath();
    c.ellipse(px, py, rx, ry, rot, 0, Math.PI * 2);
    c.fill();
  };
  pad(x, y + r * 0.38, r * 0.6, r * 0.46);
  pad(x - r * 0.66, y - r * 0.18, r * 0.2, r * 0.27, -0.35);
  pad(x - r * 0.24, y - r * 0.56, r * 0.21, r * 0.28, -0.12);
  pad(x + r * 0.24, y - r * 0.56, r * 0.21, r * 0.28, 0.12);
  pad(x + r * 0.66, y - r * 0.18, r * 0.2, r * 0.27, 0.35);
}

function spark(c: CanvasRenderingContext2D, x: number, y: number, r: number): void {
  c.beginPath();
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
    const rr = i % 2 ? r * 0.32 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  c.closePath();
  c.fill();
}

/** The card, painted. Null without a 2D canvas (tests). */
export function composeResultCard(r: DailyResult, logo: CanvasImageSource | null, label: string | null = linkLabel()): HTMLCanvasElement | null {
  const x = cleanResult(r);
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const c = out.getContext('2d');
  if (!c) return null;
  const paper = c.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.8);
  paper.addColorStop(0, '#fffaf0');
  paper.addColorStop(1, '#f3e8d2');
  c.fillStyle = paper;
  c.fillRect(0, 0, W, H);
  const round = `'Fredoka', ui-rounded, 'SF Pro Rounded', system-ui, sans-serif`;
  const sans = `'Nunito Sans', ui-rounded, -apple-system, system-ui, sans-serif`;
  c.textAlign = 'center';
  c.textBaseline = 'alphabetic';
  // The mark and the name.
  let y = 150;
  if (logo) {
    c.save();
    c.beginPath();
    c.roundRect?.(W / 2 - 210, y - 78, 96, 96, 22);
    c.clip();
    c.drawImage(logo, W / 2 - 210, y - 78, 96, 96);
    c.restore();
  }
  c.fillStyle = '#2f5d4b';
  c.font = `700 84px ${round}`;
  c.fillText('PawTyk', W / 2 + (logo ? 58 : 0), y);
  y += 90;
  c.fillStyle = '#4a3a2a';
  c.font = `700 56px ${round}`;
  c.fillText('Daily Puzzle', W / 2, y);
  y += 56;
  c.fillStyle = '#7a6650';
  c.font = `600 38px ${sans}`;
  c.fillText(dayLabel(x.dateKey, true), W / 2, y);
  // Hearts left.
  y += 120;
  if (x.hearts !== null) {
    const n = x.maxHearts;
    for (let i = 0; i < n; i++) {
      heart(c, W / 2 + (i - (n - 1) / 2) * 110, y - 20, 40);
      c.fillStyle = i < x.hearts ? '#e8556a' : '#e9ddd0';
      c.fill();
    }
    y += 90;
  }
  // Time and streak.
  c.fillStyle = '#4a3a2a';
  c.font = `700 64px ${round}`;
  c.fillText(clock(x.seconds), W / 2, y);
  y += 56;
  if (x.streak > 1) {
    c.fillStyle = '#7a6650';
    c.font = `600 38px ${sans}`;
    c.fillText(`${x.streak}-day streak`, W / 2, y);
  }
  // The day's decorative pattern (the same for everyone; never the board).
  y += 70;
  const rows = resultPattern(x.dateKey);
  rows.forEach((row, ri) =>
    row.forEach((cell, ci) => {
      const cx = W / 2 + (ci - 2) * 96;
      const cy = y + ri * 84;
      c.fillStyle = cell === 'paw' ? ['#c98a5a', '#b7795d', '#d29b62'][(ri + ci) % 3] : ['#f2c230', '#f4a6d0', '#8fd3dc'][(ri + ci) % 3];
      if (cell === 'paw') paw(c, cx, cy, 30);
      else spark(c, cx, cy, 26);
    }),
  );
  // The invitation, and where to play.
  c.fillStyle = '#4a3a2a';
  c.font = `700 44px ${round}`;
  c.fillText("Can you solve today's puzzle?", W / 2, H - (label ? 108 : 70));
  if (label) {
    c.fillStyle = '#2f7d5b';
    c.font = `700 38px ${sans}`;
    c.fillText(label, W / 2, H - 56);
  }
  return out;
}

/** The win sheet's Share for a Daily: the card, and the choice to share it. */
export async function showResultCard(scope: Scope, r: DailyResult): Promise<void> {
  const text = resultShareText(r);
  const link = shareLink('daily');
  track('share_opened', { surface: 'daily' });
  const card = composeResultCard(r, await postcardLogo());
  const blob = card ? await postcardBlob(card) : null;
  if (card) card.width = 0;
  if (!scope.alive) return;
  if (!blob) {
    // No picture on this device: the lines on their own.
    await shareResultText(text, link);
    return;
  }
  const url = URL.createObjectURL(blob);
  const sh = openSheet(scope, {
    title: 'Share your result',
    className: 'postcard-sheet result-sheet',
    center: true,
    body: `
      <img class="postcard-sheet__img result-sheet__img" src="${url}" alt="${esc(`Your Daily Puzzle result for ${dayLabel(r.dateKey, true)}`)}" />
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="rc-share">${ICON.share}Share or save</button>
        <button class="btn btn--quiet" data-act="rc-done">Done</button>
      </div>
      <p class="muted sheet__note">The card shows your hearts, time and streak, never the puzzle's answer.${GAME_URL ? '' : ' (No game link is set up in this build, so it goes without one.)'}</p>`,
    onClose: () => URL.revokeObjectURL(url),
  });
  let sharing = false;
  sh.scope.on(sh.el, 'click', async (e) => {
    const b = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!b || sharing) return;
    if (b.dataset.act === 'rc-done') return sh.close();
    if (b.dataset.act !== 'rc-share') return;
    sharing = true;
    b.setAttribute('aria-busy', 'true');
    track('share_started', { surface: 'daily' });
    const res = await shareImage(blob, `pawtyk-daily-${r.dateKey}.png`, 'PawTyk Daily Puzzle', { text, url: link });
    sharing = false;
    b.removeAttribute('aria-busy');
    track('share_result', { surface: 'daily', result: res });
    shareToast(res);
  });
}

async function shareResultText(text: string, link: string | null): Promise<void> {
  track('share_started', { surface: 'result' });
  // The link is already the text's last line.
  const res = await shareText(text, link && text.includes(link) ? null : link);
  track('share_result', { surface: 'result', result: res });
  shareToast(res);
}

/** What happened, in words that never claim more than the platform said. */
export function shareToast(r: ShareResult): void {
  if (r === 'downloaded') toast('Saved to your downloads.', ICON.check);
  else if (r === 'copied') toast('Copied. Paste it wherever you like.', ICON.check);
  else if (r === 'failed') toast("It couldn't be shared or saved. If you chose Save Image, PawTyk may need permission for Photos in Settings.");
}
