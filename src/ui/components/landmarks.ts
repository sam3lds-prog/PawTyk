/**
 * A home's landmark (D44 PR G): tapped (or visited on the guided tour), its doors swing open or its critter peeks out
 * for a moment, and the chat line under the scene says what happened. It grants nothing. Under reduced motion the
 * same happens without the movement (the CSS transitions collapse, so it is simply open, then closed).
 */

import { feel } from '../../services/feel';
import type { Scope } from '../router';

/** How long a landmark stays open. */
export const LANDMARK_OPEN_MS = 2600;

/** Opens a landmark for a moment. False if it is already open. */
export function openLandmark(scope: Scope, lm: Element, chat: HTMLElement | null, line: string): boolean {
  if (lm.classList.contains('is-open')) return false;
  lm.classList.add('is-open');
  feel('hello');
  const span = chat?.querySelector('span');
  if (chat && span && line) {
    span.textContent = line;
    chat.hidden = false;
  }
  scope.timeout(() => lm.classList.remove('is-open'), LANDMARK_OPEN_MS);
  return true;
}
