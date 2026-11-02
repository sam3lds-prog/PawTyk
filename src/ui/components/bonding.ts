/**
 * Bonding moments (D40 PR B): a hello in a scene counts a heart (once a day), and when a hello, a pat or food lifts a
 * friendship to its next level the player sees what it unlocked — a short note for a warmer hello, a beaming smile or
 * a golden frame, and a small card for the portrait a best friend gets in the album.
 */

import { app } from '../../app/app';
import { animalInfo, isAnimalId } from '../../meta/animals';
import { bondNews, helloFriend, type BondNews } from '../../meta/bonds';
import { feel } from '../../services/feel';
import { track } from '../../services/analytics';
import { animalPortrait, animalTint } from '../art/animals';
import { esc } from '../dom';
import { ICON } from '../icons';
import type { Scope } from '../router';
import { openSheet, toast } from './sheet';

const LEVEL_LINE: Record<string, (n: string) => string> = {
  Friend: (n) => `${n} is your friend now!`,
  'Good friend': (n) => `${n} is your good friend now!`,
  'Best friend': (n) => `${n} is your best friend now!`,
  Family: (n) => `${n} is family now!`,
};

/** Shows what a new friendship level unlocked. */
export function celebrateBond(scope: Scope, news: BondNews): void {
  const name = animalInfo(news.id as never).name;
  track('friendship_level', { level: news.level.level });
  if (news.unlock !== 'portrait') {
    toast(`${(LEVEL_LINE[news.level.name] ?? LEVEL_LINE.Friend)(name)} ${news.line}`, ICON.heart);
    return;
  }
  feel('lines');
  const sh = openSheet(scope, {
    title: 'Best friends!',
    center: true,
    className: 'bond-sheet',
    body: `
      <div class="bond-portrait"><span class="portrait portrait--frame" style="--tint:${animalTint(news.id as never) ?? 'var(--surface-2)'}">${animalPortrait(news.id as never, 'beam')}</span></div>
      <p class="sheet__lead">${esc(name)} and you are best friends. ${esc(news.line)}</p>
      <div class="sheet__actions">
        <button class="btn btn--block" data-act="album" data-autofocus>${ICON.paw}See the album</button>
        <button class="btn btn--quiet btn--block" data-act="close">Lovely</button>
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    const a = (e.target as HTMLElement).closest('[data-act]') as HTMLElement | null;
    if (!a) return;
    sh.close();
    if (a.dataset.act === 'album') app.router.go({ screen: 'pets' });
  });
}

/** A hello in a scene: counts its heart once a day, and celebrates a new level. Returns the news, if any. */
export function greetInScene(scope: Scope, id: string): BondNews | null {
  if (!isAnimalId(id)) return null;
  const before = app.save.sanctuary.affection[id] ?? 0;
  if (!helloFriend(app.save, id)) return null;
  const news = bondNews(app.save, id, before, animalInfo(id).name);
  app.persist();
  if (news) celebrateBond(scope, news);
  return news;
}

/** After a pat or a meal on a card: celebrates a new level reached from `before` hearts. */
export function afterHearts(scope: Scope, id: string, before: number): void {
  if (!isAnimalId(id)) return;
  const news = bondNews(app.save, id, before, animalInfo(id as never).name);
  if (news) {
    app.persist();
    celebrateBond(scope, news);
  }
}
