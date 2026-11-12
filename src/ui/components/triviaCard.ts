/**
 * D52 PR C: the *Animal question* card, from the Farm or the album. One question, three choices, a friendly answer
 * either way (*That's right!* with a smile and a small sparkle; *Good guess!* with the same fact), then *Another
 * question* or back. Optional and free: nothing is paid or taken, no heart, no streak, no retry. Under Reduce Motion
 * there is no sparkle. A screen reader hears the question, the choices (A, B, C), and the answer with its fact.
 */

import { app } from '../../app/app';
import { answerLine, nextQuestion, type TriviaQuestion } from '../../meta/trivia';
import { track } from '../../services/analytics';
import { animalPortrait } from '../art/animals';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet } from './sheet';

export type TriviaFrom = 'farm' | 'album';

const LETTERS = ['A', 'B', 'C'] as const;

/** The entry point a home or the album shows: a small card, never in the way. */
export function triviaEntryMarkup(): string {
  return `<button class="card card--tap trivia-entry" data-act="trivia">
      <span class="trivia-entry__icon" aria-hidden="true">${ICON.sparkle}</span>
      <span class="trivia-entry__text"><b>Animal question</b><small>A quick question about the animals. Just for fun.</small></span>
      ${ICON.chevron}
    </button>`;
}

function questionMarkup(q: TriviaQuestion, uid: string): string {
  return `<div class="trivia" data-trivia="${q.id}">
      <div class="trivia__face portrait" data-trivia-face aria-hidden="true">${q.face ? animalPortrait(q.face, 'idle') : ICON.paw}</div>
      <p class="trivia__prompt" id="${uid}-q">${esc(q.prompt)}</p>
      <div class="trivia__choices" role="group" aria-labelledby="${uid}-q">
        ${q.choices.map((c, i) => `<button class="trivia__choice" data-choice="${i}"><span class="trivia__letter" aria-hidden="true">${LETTERS[i]}</span><span class="trivia__text"><span class="sr-only">${LETTERS[i]}. </span>${esc(c)}</span><span class="trivia__mark" data-mark></span></button>`).join('')}
      </div>
      <div class="trivia__result" data-trivia-result role="status" aria-live="polite" tabindex="-1"></div>
    </div>`;
}

/** Opens the card with the next question in the rotation. */
export function showAnimalQuestion(scope: Scope, o: { from: TriviaFrom }): void {
  const uid = `tq-${Math.random().toString(36).slice(2, 8)}`;
  const back = o.from === 'farm' ? 'Back to my Farm' : 'Back to the album';
  const sh = openSheet(scope, {
    title: 'Animal question',
    className: 'trivia-sheet',
    body: `<div data-trivia-body></div>
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="another" hidden>Another question</button>
        <button class="btn btn--quiet" data-act="done">${esc(back)}</button>
      </div>`,
  });
  const body = sh.el.querySelector<HTMLElement>('[data-trivia-body]')!;
  const another = sh.el.querySelector<HTMLButtonElement>('[data-act="another"]')!;
  let q: TriviaQuestion;
  let answered = false;
  const ask = () => {
    q = nextQuestion(app.save);
    app.persist();
    answered = false;
    body.innerHTML = questionMarkup(q, uid);
    another.hidden = true;
    track('trivia_question', { question: q.id, from: o.from });
    body.querySelector<HTMLElement>('[data-choice="0"]')?.focus({ preventScroll: true });
  };
  const answer = (choice: number) => {
    if (answered) return;
    answered = true;
    const r = answerLine(q, choice);
    for (const b of body.querySelectorAll<HTMLButtonElement>('[data-choice]')) {
      const i = Number(b.dataset.choice);
      b.disabled = true;
      if (i === q.answer) {
        b.classList.add('is-correct');
        b.querySelector('[data-mark]')!.innerHTML = `${ICON.check}<span class="sr-only">${i === choice ? 'Your answer, right' : 'The answer'}</span>`;
      } else if (i === choice) {
        b.classList.add('is-chosen');
        b.querySelector('[data-mark]')!.innerHTML = '<span class="sr-only">Your answer</span>';
      }
    }
    const face = body.querySelector<HTMLElement>('[data-trivia-face]')!;
    if (q.face) face.innerHTML = animalPortrait(q.face, r.correct ? 'happy' : 'idle');
    if (r.correct && !app.reducedMotion) face.classList.add('is-sparkle');
    face.classList.toggle('is-right', r.correct);
    const res = body.querySelector<HTMLElement>('[data-trivia-result]')!;
    res.classList.toggle('is-right', r.correct);
    res.innerHTML = `<b>${esc(r.head)}</b> ${esc(r.text)}`;
    another.hidden = false;
    track('trivia_answer', { question: q.id, correct: r.correct });
    res.focus({ preventScroll: true });
  };
  ask();
  sh.scope.on(sh.el, 'click', (e) => {
    const t = e.target as HTMLElement;
    const c = t.closest('[data-choice]') as HTMLButtonElement | null;
    if (c && !c.disabled) return answer(Number(c.dataset.choice));
    const act = (t.closest('[data-act]') as HTMLElement | null)?.dataset.act;
    if (act === 'another') ask();
    else if (act === 'done') sh.close();
  });
}
