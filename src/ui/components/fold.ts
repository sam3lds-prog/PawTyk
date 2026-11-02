/**
 * A fold whose contents are drawn the first time it opens (D39). A long world keeps its finished homes in folds, and a
 * fold drawn up front would still cost the full list (a thumbnail or a row of portraits per home), so its body starts
 * empty and is filled on the tap that opens it, or when code opens it.
 *
 * Markup: `<details data-fold="key"><summary>…</summary><… data-fold-body></…></details>`.
 */

import type { Scope } from '../router';

export interface Folds {
  /** Fills and opens a fold; returns it, or null when there is none with that key. */
  open(key: string): HTMLDetailsElement | null;
}

export function wireFolds(scope: Scope, root: HTMLElement, fill: (key: string) => string): Folds {
  const ensure = (d: HTMLDetailsElement) => {
    const body = d.querySelector<HTMLElement>('[data-fold-body]');
    if (!body || d.dataset.filled) return;
    d.dataset.filled = '1';
    body.innerHTML = fill(d.dataset.fold!);
  };
  // The tap (or Enter/Space) on the summary fills it before the browser opens it, so nothing pops in a frame late.
  scope.on(root, 'click', (e) => {
    const s = (e.target as HTMLElement).closest('summary');
    const d = s?.parentElement;
    if (d instanceof HTMLDetailsElement && d.dataset.fold !== undefined) ensure(d);
  });
  // Anything else that opens it (find in page, an assistive tech's own action).
  scope.on(root, 'toggle', (e) => {
    const d = e.target;
    if (d instanceof HTMLDetailsElement && d.open && d.dataset.fold !== undefined) ensure(d);
  }, { capture: true });
  return {
    open(key) {
      const d = root.querySelector<HTMLDetailsElement>(`details[data-fold="${key}"]`);
      if (!d) return null;
      ensure(d);
      d.open = true;
      return d;
    },
  };
}
