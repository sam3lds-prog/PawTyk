/**
 * D52 PR B: Settings → Tester shortcuts → *Browse future places*, in tester builds only (`featureFlags.qaTools`).
 *
 * One place of the endless world at a time (1–9999): its name, landscape, where it is, its residents (name, kind,
 * coat, where the kind lives, its fact, when it comes home), when it opens, and its five growth stages drawn with the
 * game's own scene art and who is home by each. Read-only: browsing never touches the save, never persists, grants,
 * unlocks or buys anything, and never draws more than one place. *Visit in a sandbox* opens the place for real on a
 * temporary copy of the save (`app/qaSandbox.ts`), offered outside a board only.
 */

import { app } from '../../app/app';
import { featureFlags } from '../../config/featureFlags';
import { MAX_PLACE } from '../../meta/catalogs/places';
import { clampPlace, placePreview } from '../../meta/placePreview';
import { isOpen } from '../../meta/world';
import { SANDBOX_STATES, enterSandbox, type SandboxState } from '../../app/qaSandbox';
import { regionScene } from '../art/regions';
import { SCENE_VIEWBOX } from '../art/sanctuary';
import { animalPortrait } from '../art/animals';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet } from './sheet';

/** The quick examples the plan asks for, plus the very last place. */
export const PLACE_EXAMPLES = [1, 2, 12, 40, 100, MAX_PLACE] as const;

/** The details of place k at stage `stage` (markup only; nothing is read from or written to the save but `isOpen`). */
export function placeDetailsMarkup(k: number, stage: number): string {
  const p = placePreview(k);
  const d = p.def;
  const st = p.stages[Math.min(Math.max(0, stage), p.stages.length - 1)];
  const scene = regionScene(d.id, { stage: st.index, companions: st.home.map((w) => w.id), decor: [], evening: false }, `qa-place-${d.index}-${st.index}`);
  const open = isOpen(app.save, d.id);
  const residents = p.residents
    .map(
      (r) => `<li class="qa-place__resident${st.home.includes(r.w) ? ' is-home' : ''}">
        <span class="qa-place__face portrait" aria-hidden="true">${animalPortrait(r.w.id, 'idle')}</span>
        <span class="qa-place__who"><span><b>${esc(r.w.name)}</b> · ${esc(r.coatKind)}</span><small>Comes home at ${r.w.at} puzzles · ${esc(r.from)}</small><small class="qa-place__fact">${esc(r.fact)}</small></span>
      </li>`,
    )
    .join('');
  return `<article class="qa-place" data-place="${d.index}" style="--accent:${d.accent}">
      <p class="qa-place__eyebrow">Place ${d.index} · ${esc(p.landscape)}</p>
      <h3 class="qa-place__name" data-place-name>${esc(d.name)}</h3>
      <p class="muted qa-place__where">${esc(d.place)}</p>
      <p class="qa-place__blurb">${esc(d.blurb)}</p>
      <p class="qa-place__opens" data-place-opens>${ICON.lock}<span>${esc(p.opens)} <b>${open ? 'Open in this save.' : 'Not open in this save.'}</b></span></p>
      <div class="seg seg--small qa-place__stages" role="tablist" aria-label="Growth stages">
        ${p.stages.map((s) => `<button role="tab" class="seg__btn" data-place-stage="${s.index}" aria-selected="${s.index === st.index}">${s.index}</button>`).join('')}
      </div>
      <p class="qa-place__stage" data-stage-line><b>Stage ${st.index}: ${esc(st.name)}</b> · at ${st.at} puzzles · ${esc(st.change)} · ${st.home.length} of ${d.animals.length} home</p>
      <figure class="qa-place__scene sanctuary__scene"><svg viewBox="${SCENE_VIEWBOX}" role="img" aria-label="${esc(`${d.name} at stage ${st.index}, ${st.name}`)}">${scene}</svg></figure>
      <ul class="qa-place__residents" aria-label="Residents">${residents}</ul>
    </article>`;
}

/** Opens the browser at place `start`. `inGame` leaves out the sandbox (a board is on screen). */
export function showPlaceBrowser(scope: Scope, o: { start?: number; inGame?: boolean } = {}): void {
  if (!featureFlags.qaTools) return;
  let k = clampPlace(o.start ?? 1);
  let stage = 0;
  const sh = openSheet(scope, {
    title: 'Browse future places',
    className: 'qa-places-sheet',
    body: `
      <p class="muted">Read-only: looking changes nothing in your save. Places 1–${MAX_PLACE}, generated from their number, the same on every phone.</p>
      <div class="qa-places__controls">
        <button class="btn btn--secondary btn--small" data-act="prev" aria-label="Previous place">${ICON.back}</button>
        <label class="qa-places__label">Place <input class="qa-places__input" type="number" inputmode="numeric" min="1" max="${MAX_PLACE}" step="1" value="${k}" data-place-input aria-label="Place number, 1 to ${MAX_PLACE}"></label>
        <button class="btn btn--secondary btn--small" data-act="next" aria-label="Next place">${ICON.chevron}</button>
      </div>
      <div class="qa-places__quick" role="group" aria-label="Examples">${PLACE_EXAMPLES.map((n) => `<button class="chip" data-place-go="${n}">${n}</button>`).join('')}</div>
      <div data-place-body aria-live="polite"></div>
      ${
        o.inGame
          ? ''
          : `<div class="qa-places__sandbox">
        <p class="muted">Visit in a sandbox: a temporary copy of your save with this place open. Nothing there is saved, and leaving the home brings your own save back unchanged.</p>
        <div class="qa-places__sandbox-actions">${SANDBOX_STATES.map((s) => `<button class="btn btn--secondary btn--small" data-sandbox="${s.id}">${esc(s.label)}</button>`).join('')}</div>
      </div>`
      }`,
  });
  const body = sh.el.querySelector<HTMLElement>('[data-place-body]')!;
  const input = sh.el.querySelector<HTMLInputElement>('[data-place-input]')!;
  const render = () => {
    input.value = String(k);
    body.innerHTML = placeDetailsMarkup(k, stage);
  };
  const goTo = (n: number) => {
    k = clampPlace(n);
    stage = 0;
    render();
  };
  render();
  sh.scope.on(input, 'change', () => goTo(Number(input.value)));
  sh.scope.on(input, 'keydown', (e) => {
    if ((e as KeyboardEvent).key === 'Enter') goTo(Number(input.value));
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const t = e.target as HTMLElement;
    const act = (t.closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (act === 'prev') return goTo(k - 1);
    if (act === 'next') return goTo(k + 1);
    const go = t.closest('[data-place-go]') as HTMLElement | null;
    if (go) return goTo(Number(go.dataset.placeGo));
    const st = t.closest('[data-place-stage]') as HTMLElement | null;
    if (st) {
      stage = Number(st.dataset.placeStage);
      render();
      return;
    }
    const sb = t.closest('[data-sandbox]') as HTMLElement | null;
    if (sb && !o.inGame) {
      sh.close();
      enterSandbox(k, sb.dataset.sandbox as SandboxState);
    }
  });
}
