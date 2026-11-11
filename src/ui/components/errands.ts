/**
 * D49 PR D: an errand that claimed itself outside a puzzle (a home visited, a decoration put out) says what it gave,
 * in one toast, at the moment it happened. Nothing to claim later.
 */

import { claimedLine, type MetaNews } from '../../app/events';
import { ICON } from '../icons';
import { toast } from './sheet';

export function sayClaimed(news: MetaNews): void {
  if (!news.claimed.length) return;
  const what = news.claimed.length === 1 ? `Errand done: ${news.claimed[0].def.title}` : `${news.claimed.length} errands done`;
  toast(`${what} · ${claimedLine(news.claimed)}`, ICON.check);
}
