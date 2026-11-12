// @vitest-environment happy-dom
/**
 * D52 PR C: Animal question. Twenty questions about animals in the game, one right answer each; the rotation asks about
 * friends at home first and never repeats the last one; the card answers kindly either way, costs and pays nothing,
 * has no sparkle under Reduce Motion, and reads well to a screen reader. The Farm and the album offer it; nothing else
 * changes (the economy, the board).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { app } from '../../src/app/app';
import { Router, Scope, type CanonicalRoute, type ScreenDef } from '../../src/ui/router';
import { petsScreen } from '../../src/ui/screens/pets';
import { regionScreen } from '../../src/ui/screens/region';
import { defaultSave, normalizeSave } from '../../src/services/storage';
import { TRIVIA_COUNT, answerLine, nextQuestion, triviaQuestions } from '../../src/meta/trivia';
import { showAnimalQuestion } from '../../src/ui/components/triviaCard';
import { SPECIES_BY_ID } from '../../src/meta/catalogs/species/index';
import { isWildId, wildDef } from '../../src/meta/catalogs/places';
import { balance } from '../../src/meta/ledger';
import { itemBalance } from '../../src/meta/items';
import { recentEvents, setAnalyticsEnabled } from '../../src/services/analytics';

const blank: ScreenDef = { tab: null, title: 'x', mount: () => {} };
function mount(): Router {
  document.body.innerHTML = '<div id="app"></div>';
  const router = new Router(document.getElementById('app')!);
  const reg = {} as Record<CanonicalRoute['screen'], ScreenDef>;
  for (const k of ['gallery', 'profile', 'sanctuary', 'game', 'challenges', 'welcome', 'shop', 'world', 'journey'] as const) reg[k] = blank;
  router.register({ ...reg, pets: petsScreen, region: regionScreen });
  app.router = router;
  return router;
}
const home = (...ids: string[]) => {
  for (const id of ids) app.save.inventory.companions[id] = { unlockedAt: '2026-11-01T00:00:00.000Z' };
};

beforeEach(() => {
  localStorage.clear();
  app.replaceSave(defaultSave(new Date(2026, 10, 11, 12)));
  Object.assign(app.save.onboarding, { tutorialDone: true, seenRules: true, soloRulesSeen: true, worldTipSeen: true, loopTipSeen: true, sceneTapTipSeen: true, decorTipSeen: true });
  app.settings.reducedMotion = 'full';
  app.save.settings.toys3d = false;
});
afterEach(() => {
  document.querySelectorAll('.overlay').forEach((o) => o.remove());
});

describe('the questions', () => {
  const qs = triviaQuestions();
  it('twenty, each about a species in the game, with three choices and one answer, and a face', () => {
    expect(TRIVIA_COUNT).toBe(20);
    expect(new Set(qs.map((q) => q.id)).size).toBe(20);
    for (const q of qs) {
      expect(SPECIES_BY_ID.has(q.species), q.id).toBe(true);
      expect(q.choices).toHaveLength(3);
      expect(new Set(q.choices).size).toBe(3);
      expect([0, 1, 2]).toContain(q.answer);
      expect(q.face, q.id).toBeTruthy();
      expect(q.prompt.endsWith('?')).toBe(true);
      expect(q.explain.length).toBeGreaterThan(20);
    }
    // The answer isn't always the first choice.
    expect(new Set(qs.map((q) => q.answer)).size).toBe(3);
    // The fennec asks with the face of a fennec out in the world.
    const fennec = qs.find((q) => q.id === 'fennec-ears')!;
    expect(isWildId(fennec.face) && wildDef(fennec.face as never).species).toBe('fennec');
  });

  it('the plan’s example: right is "That\'s right!", wrong is "Good guess!", with the same fact', () => {
    const q = qs.find((x) => x.id === 'fennec-ears')!;
    expect(q.prompt).toBe('Why do fennec foxes have such large ears?');
    expect(q.choices).toEqual(['To help release body heat', 'To store water', 'To help them fly']);
    expect(answerLine(q, 0)).toMatchObject({ correct: true, head: "That's right!" });
    expect(answerLine(q, 2)).toMatchObject({ correct: false, head: 'Good guess!', text: answerLine(q, 0).text });
  });

  it('friends at home first, never the same one twice in a row, and the place in the rotation is kept', () => {
    home('cotton', 'truffle', 'buttercup');
    const asked: string[] = [];
    for (let i = 0; i < 12; i++) asked.push(nextQuestion(app.save).id);
    for (let i = 1; i < asked.length; i++) expect(asked[i]).not.toBe(asked[i - 1]);
    // Only Cotton's, Truffle's, Buttercup's and the wider world's (the fennec) come up.
    expect(new Set(asked)).toEqual(new Set(['sheep-faces', 'pig-mud', 'calf-stand', 'fennec-ears']));
    const kept = normalizeSave(JSON.parse(JSON.stringify(app.save))).trivia;
    expect(kept).toEqual(app.save.trivia);
    expect(nextQuestion(normalizeSave(JSON.parse(JSON.stringify(app.save)))).id).not.toBe(app.save.trivia!.last);
  });

  it('with nobody home there is still a question (any will do), and never twice running', () => {
    const a = nextQuestion(app.save).id;
    const b = nextQuestion(app.save).id;
    expect(a).not.toBe(b);
  });
});

describe('the card', () => {
  const sheet = () => document.querySelector('.trivia-sheet')!;
  it('a right answer: a smile and a sparkle, the fact, Another question; nothing paid or taken', () => {
    home('cotton');
    const coins = balance(app.save);
    const lives = itemBalance(app.save, 'life');
    const scope = new Scope();
    showAnimalQuestion(scope, { from: 'farm' });
    const id = sheet().querySelector<HTMLElement>('[data-trivia]')!.dataset.trivia!;
    const q = triviaQuestions().find((x) => x.id === id)!;
    // Review: nothing to skip with before answering (not just hidden: not there).
    expect(sheet().querySelector('[data-act="another"]')).toBeNull();
    expect(sheet().querySelector('[data-act="done"]')?.textContent).toBe('Back to my Farm');
    (sheet().querySelector(`[data-choice="${q.answer}"]`) as HTMLElement).click();
    expect(sheet().querySelector('[data-trivia-result]')?.textContent).toBe(`That's right! ${q.explain}`);
    expect(sheet().querySelector('[data-trivia-face]')!.classList.contains('is-sparkle')).toBe(true);
    expect(sheet().querySelectorAll('[data-choice]:disabled')).toHaveLength(3);
    expect(sheet().querySelector('[data-act="another"]')).not.toBeNull();
    expect(balance(app.save)).toBe(coins);
    expect(itemBalance(app.save, 'life')).toBe(lives);
    scope.dispose();
  });

  it('a wrong answer: "Good guess!", the right one marked, no penalty; Another question asks a different one', () => {
    home('cotton', 'truffle');
    const scope = new Scope();
    showAnimalQuestion(scope, { from: 'album' });
    const id = sheet().querySelector<HTMLElement>('[data-trivia]')!.dataset.trivia!;
    const q = triviaQuestions().find((x) => x.id === id)!;
    const wrong = (q.answer + 1) % 3;
    (sheet().querySelector(`[data-choice="${wrong}"]`) as HTMLElement).click();
    expect(sheet().querySelector('[data-trivia-result]')?.textContent).toMatch(/^Good guess! /);
    expect(sheet().querySelector(`[data-choice="${q.answer}"]`)!.classList.contains('is-correct')).toBe(true);
    expect(sheet().querySelector(`[data-choice="${wrong}"]`)!.classList.contains('is-chosen')).toBe(true);
    expect(sheet().querySelector('[data-trivia-face]')!.classList.contains('is-sparkle')).toBe(false);
    expect(sheet().querySelector('[data-act="done"]')?.textContent).toBe('Back to the album');
    (sheet().querySelector('[data-act="another"]') as HTMLElement).click();
    expect(sheet().querySelector<HTMLElement>('[data-trivia]')!.dataset.trivia).not.toBe(id);
    expect(sheet().querySelector('[data-trivia-result]')?.textContent).toBe('');
    scope.dispose();
  });

  it('Reduce Motion: no sparkle; a screen reader gets the question, lettered choices and the answer in a live region', () => {
    app.settings.reducedMotion = 'reduce';
    home('cotton');
    const scope = new Scope();
    showAnimalQuestion(scope, { from: 'farm' });
    const group = sheet().querySelector('.trivia__choices')!;
    const label = document.getElementById(group.getAttribute('aria-labelledby')!)!;
    expect(label.textContent!.endsWith('?')).toBe(true);
    expect(sheet().querySelector('[data-choice="0"] .sr-only')?.textContent).toBe('A. ');
    expect(sheet().querySelector('[data-trivia-result]')?.getAttribute('role')).toBe('status');
    (sheet().querySelector('[data-choice="0"]') as HTMLElement).click();
    expect(sheet().querySelector('[data-trivia-face]')!.classList.contains('is-sparkle')).toBe(false);
    expect(document.activeElement?.matches('[data-trivia-result]')).toBe(true);
    scope.dispose();
  });

  it('opt-in measures say which question and whether it was right, never more', () => {
    setAnalyticsEnabled(true);
    home('cotton');
    const before = recentEvents().length;
    const scope = new Scope();
    showAnimalQuestion(scope, { from: 'farm' });
    (sheet().querySelector('[data-choice="0"]') as HTMLElement).click();
    const ev = recentEvents().slice(before).filter((e) => e.name.startsWith('trivia_'));
    expect(ev.map((e) => e.name)).toEqual(['trivia_question', 'trivia_answer']);
    expect(Object.keys(ev[1].props).sort()).toEqual(['correct', 'question']);
    scope.dispose();
    setAnalyticsEnabled(false);
  });
});

describe('where it is offered', () => {
  it('the album has the card; the Farm has it once someone is home', () => {
    const router = mount();
    router.go({ screen: 'pets' });
    expect(document.querySelector('.pets [data-act="trivia"], [data-act="trivia"]')).not.toBeNull();
    (document.querySelector('[data-act="trivia"]') as HTMLElement).click();
    expect(document.querySelector('.trivia-sheet')).not.toBeNull();
    document.querySelectorAll('.overlay').forEach((o) => o.remove());
    router.go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('[data-act="trivia"]')).toBeNull();
    home('cotton');
    app.save.world.growth.farm = 1;
    router.go({ screen: 'region', id: 'farm' });
    expect(document.querySelector('[data-act="trivia"]')).not.toBeNull();
  });
});
