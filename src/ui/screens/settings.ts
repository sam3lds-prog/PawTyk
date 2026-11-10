/** Settings sheet: play, comfort & accessibility, purchases, data. */

import { app } from '../../app/app';
import { clearSessions, resetProgress, type Settings } from '../../services/storage';
import { ITEM_CAP, grantStarterItems } from '../../meta/items';
import { finishOpenHomes, growActive, setPantry, skipToLevel } from '../../app/qaTools';
import { iap } from '../../services/iap';
import { ads } from '../../services/ads';
import { track } from '../../services/analytics';
import { sfx } from '../../services/audio';
import { playCue } from '../../services/music';
import { haptic } from '../../services/haptics';
import { leaderboard } from '../../services/leaderboard';
import { resetLeaderboardLocal } from '../../app/leaderboardSync';
import { openSheet, toast } from '../components/sheet';
import { actionOf, esc, plural } from '../dom';
import type { Scope } from '../router';
import { featureFlags } from '../../config/featureFlags';
import { QA_RELEASE_VIEW_KEY, RELEASE_VIEW } from '../../config/services';
import { currentRules, showRules } from './rules';
import { leaderboardOffered } from '../../app/offers';
import { CONTACT_EMAIL, PRIVACY_URL } from '../../config/legal';
import { POLICY_UPDATED_TEXT, policyHtml } from '../../legal/privacyPolicy';
import { animalSvg } from '../art/animals';
import { fpsCounterOn, setFpsCounter, showListeningCheck, startFarmCheck } from '../components/deviceChecks';
import { ICON } from '../icons';

type BoolKey = 'autoMark' | 'explainMoves' | 'showTimer' | 'largeBoard' | 'music' | 'ambientMusic' | 'sound' | 'haptics' | 'highContrast' | 'regionPatterns' | 'leftHanded' | 'toys3d';

function sw(key: BoolKey, label: string, help = ''): string {
  const on = app.settings[key];
  return `<button class="row" role="switch" aria-checked="${on}" data-switch="${key}">
      <span class="row__label">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span>
      <span class="switch" aria-checked="${on}" aria-hidden="true"></span>
    </button>`;
}

function choice<K extends keyof Settings>(key: K, label: string, opts: Array<[Settings[K], string]>, help = ''): string {
  return `<div class="row row--choice">
      <span class="row__label" id="lbl-${String(key)}">${esc(label)}${help ? `<small>${esc(help)}</small>` : ''}</span>
      <span class="choice" role="group" aria-labelledby="lbl-${String(key)}">
        ${opts.map(([v, l]) => `<button data-choice="${String(key)}" data-value="${String(v)}" aria-pressed="${app.settings[key] === v}">${esc(l)}</button>`).join('')}
      </span>
    </div>`;
}

/**
 * A tiny live picture of the chosen controls (D38): a finger taps a tile and a ✕ appears; it double-taps (or, two-step,
 * taps a ✕ again) and the animal appears; Erase lifts a ✕. CSS keyframes on a loop, drawn with this player's animal; the
 * reduced-motion rules collapse it to its final frame.
 */
function controlsPreview(c: Settings['controls']): string {
  const pet = animalSvg(currentRules().cast.a);
  const two = c === 'classic';
  return `<div class="cp-demo" data-scheme="${c}" role="img" aria-label="${
    two
      ? 'Two-step tap: a tap marks a tile with a cross, tapping the cross places the animal. Erase takes crosses back.'
      : 'Fast double-tap: a tap marks a tile with a cross, a double-tap places the animal. Erase takes crosses back.'
  }">
      <span class="cp-tile cp-tile--mark"><span class="cp-finger"></span><span class="cp-x">${ICON.mark}</span><small>Tap: ✕</small></span>
      <span class="cp-tile cp-tile--place"><span class="cp-x cp-x--before">${ICON.mark}</span><span class="cp-finger cp-finger--${two ? 'again' : 'double'}"></span><span class="cp-pet">${pet}</span><small>${two ? 'Tap again: animal' : 'Double-tap: animal'}</small></span>
      <span class="cp-tile cp-tile--erase"><span class="cp-x cp-x--erased">${ICON.mark}</span><span class="cp-eraser">${ICON.erase}</span><small>Erase: ✕ only</small></span>
    </div>`;
}

export interface SettingsOptions {
  inGame?: boolean;
  onClose?: () => void;
}

export function showSettings(scope: Scope, opts: SettingsOptions = {}): void {
  let changed = false;
  const ra = app.save.purchases.removeAds;
  const purchaseState = app.removeAds
    ? `<p class="muted">Ad-free is active${ra.source === 'legacy-v1' ? ' (carried over from the first version)' : ra.source === 'dev' ? ' (development test purchase)' : ''}.</p>`
    : '';
  // D43: nothing about purchases is shown when this build sells nothing (no "coming soon").
  const purchases = iap.available
    ? `<div class="rows-title">Purchases</div>
      <div class="rows">
        <div class="row"><span class="row__label">Gem packs<small>${iap.isStub ? 'Test store: nothing is charged, and test gems never carry into a release build.' : 'App Store connected. Gems only buy premium decorations and tricks.'}</small></span></div>
        <button class="row" data-act="restore"><span class="row__label">Restore purchases</span></button>
      </div>
      ${purchaseState}`
    : purchaseState;
  const sh = openSheet(scope, {
    title: 'Settings',
    onClose: () => {
      if (changed) opts.onClose?.();
      else opts.onClose?.();
    },
    body: `
      <div class="rows-title">Play</div>
      <div class="rows">
        <button class="row" data-act="rules"><span class="row__label">How to play<small>The rules, with pictures</small></span>${ICON.chevron}</button>
        ${choice(
          'controls',
          'Controls',
          [
            ['tap', 'Fast double-tap'],
            ['classic', 'Two-step tap (no timing)'],
          ],
          'Two-step tap needs no quick double tap: tap once for ✕, tap again to place. Easier with VoiceOver or Switch Control.',
        )}
        <p class="controls-preview" data-controls-preview aria-live="polite">${controlsPreview(app.settings.controls)}</p>
        ${sw('autoMark', 'Dot impossible tiles', 'On Easy boards, a small dot shows where no animal can go')}
        ${sw('explainMoves', 'Explain finished lines', 'When a move finishes a line or color, light up the line that had one spot left. Your first few are explained anyway.')}
        ${sw('showTimer', 'Show the clock')}
        ${sw('largeBoard', 'Large board', 'Bigger tiles you can scroll around on small phones')}
      </div>
      <div class="rows-title">Comfort</div>
      <div class="rows">
        ${sw('music', 'Music', 'Tunes for wins, new friends, the Welcome Parade and tricks')}
        ${sw('ambientMusic', 'Home music', 'A quiet tune while you visit your homes. Needs Music on.')}
        ${sw('sound', 'Sound effects')}
        ${sw('haptics', 'Haptics')}
        ${choice('reducedMotion', 'Motion', [
          ['system', 'Device'],
          ['reduce', 'Reduced'],
          ['full', 'Full'],
        ])}
        ${choice(
          'celebrations',
          'Celebrations',
          [
            ['smart', 'Smart'],
            ['full', 'Full'],
            ['short', 'Short'],
          ],
          'Smart plays the full welcome for your first friends, then a shorter one. Replay always plays it in full.',
        )}
        ${sw('toys3d', '3D animals', 'Sanctuary animals as 3D toys. Off draws them flat and saves battery.')}
        ${sw('highContrast', 'High contrast')}
        ${sw('regionPatterns', 'Region patterns', 'Adds a texture to each color region')}
        ${sw('leftHanded', 'Left-handed layout')}
      </div>
      ${purchases}
      <div class="rows-title">Your data</div>
      <div class="rows">
        <div class="row"><span class="row__label">Saved on this device<small>PawTyk plays fully offline. ${app.save.leaderboard.joined ? 'Only the leaderboard uses the internet.' : 'No account, no sign-in.'}</small></span></div>
        ${
          leaderboardOffered()
            ? `<button class="row" data-act="leaderboard"><span class="row__label">Leaderboard<small>${
                app.save.leaderboard.joined
                  ? `On, as ${esc(app.save.leaderboard.nickname)}. Our server keeps a random player id, that name, a picture and your leaderboard points. Leave in Challenges to delete it all.`
                  : 'Off. If you join (in Challenges), our server keeps a random player id, a nickname, a picture and your leaderboard points. Nothing else.'
              }</small></span>${ICON.chevron}</button>`
            : ''
        }
        <div class="row"><span class="row__label">Analytics<small>PawTyk sends no analytics. Gameplay events stay in memory on your device and are never linked to you.</small></span></div>
        <div class="row"><span class="row__label">${ads.available ? 'Reward videos' : 'Ads'}<small>${ads.available ? (ads.isStub ? 'Test videos only, clearly labeled.' : 'Only when you choose one, for an extra life, a hint or a video token. Never between boards, never in Paw Cup.') : 'PawTyk shows no ads.'}</small></span></div>
        ${ads.available && !ads.isStub ? `<button class="row" data-act="ad-privacy"><span class="row__label">Ad privacy choices<small>Change what the video network may use</small></span>${ICON.chevron}</button>` : ''}
        <button class="row" data-act="privacy"><span class="row__label">Privacy policy<small>What PawTyk keeps, and what it never asks for</small></span>${ICON.chevron}</button>
        <button class="row" data-act="reset"><span class="row__label" style="color:var(--error)">Erase progress<small>Purchases and settings are kept</small></span></button>
      </div>
      ${
        featureFlags.qaTools
          ? `<div class="rows-title">Tester shortcuts</div>
      <div class="rows">
        <button class="row" role="switch" aria-checked="${RELEASE_VIEW}" data-qa="release"><span class="row__label">See the App Store build<small>${
          RELEASE_VIEW
            ? 'On: no test store, test videos or test leaderboard, as App Review will see it. Tap to bring them back.'
            : 'Hides the test store, test videos and test leaderboard, as App Review will see the game. Reloads.'
        }</small></span><span class="switch" aria-checked="${RELEASE_VIEW}" aria-hidden="true"></span></button>
        <button class="row" data-qa="skip:11"><span class="row__label">Skip to level 11<small>Marks 1–10 solved; the Outback opens</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="skip:21"><span class="row__label">Skip to level 21<small>The first two-animal board, with its lesson</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="skip:41"><span class="row__label">Skip to level 41<small>Two-animal boards; the Savanna and the Arctic are open</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="skip:81"><span class="row__label">Skip to level 81<small>Every region open; the first new place of the endless world opens</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="grow:5"><span class="row__label">Solve 5 puzzles for this sanctuary<small>Grows the sanctuary you're building; animals come home</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="finish"><span class="row__label">Finish every open home<small>Everyone comes home everywhere open; the next new place opens</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="empty"><span class="row__label">Empty extra lives and hints<small>See "no hints left" and the loss sheet without extra lives</small></span>${ICON.chevron}</button>
        <button class="row" data-qa="fill"><span class="row__label">Fill extra lives and hints to 10<small>Earning more turns into coins</small></span>${ICON.chevron}</button>
      </div>
      <div class="rows-title">Device checks</div>
      <div class="rows">
        ${opts.inGame ? '' : `<button class="row" data-qa="perf"><span class="row__label">Performance check<small>About a minute on the Farm, played by itself: frame rate, slow frames, slowdown. Copy the results.</small></span>${ICON.chevron}</button>`}
        <button class="row" role="switch" aria-checked="${fpsCounterOn()}" data-qa="fps"><span class="row__label">Frame rate counter<small>A small counter in the corner while you play (this device only)</small></span><span class="switch" aria-checked="${fpsCounterOn()}" aria-hidden="true"></span></button>
        <button class="row" data-qa="listen"><span class="row__label">Listen to every tune<small>Each cue, the parade in every home, every trick tune: on the phone’s own speaker</small></span>${ICON.chevron}</button>
      </div>`
          : ''
      }
      ${featureFlags.devGallery ? `<div class="rows-title">Developer</div><div class="rows"><button class="row" data-act="gallery"><span class="row__label">Expression gallery<small>Development builds only</small></span></button></div>` : ''}
      <p class="muted settings-foot">PawTyk ${esc(__APP_VERSION__)} · original art and sounds · fonts: Fredoka and Nunito Sans (SIL Open Font License)</p>`,
  });

  sh.scope.on(sh.el, 'click', async (e) => {
    const t = e.target as HTMLElement;
    const qa = t.closest('[data-qa]') as HTMLElement | null;
    if (qa && featureFlags.qaTools) {
      const [what, arg] = (qa.dataset.qa ?? '').split(':');
      if (what === 'release') {
        try {
          if (RELEASE_VIEW) localStorage.removeItem(QA_RELEASE_VIEW_KEY);
          else localStorage.setItem(QA_RELEASE_VIEW_KEY, '1');
        } catch {
          toast("This browser won't keep the setting.");
          return;
        }
        location.reload();
      } else if (what === 'skip') {
        skipToLevel(app.save, Number(arg));
        clearSessions(app.save);
        app.persist();
        // Reload so the normal startup catch-up hands out the skipped levels' gifts and points, once.
        location.reload();
      } else if (what === 'perf') {
        // The check runs on its own (it outlives this sheet and the screen under it).
        sh.close();
        startFarmCheck();
      } else if (what === 'fps') {
        const on = !fpsCounterOn();
        setFpsCounter(on);
        qa.setAttribute('aria-checked', String(on));
        qa.querySelector('.switch')?.setAttribute('aria-checked', String(on));
      } else if (what === 'listen') {
        showListeningCheck(sh.scope);
      } else if (what === 'finish') {
        const came = finishOpenHomes(app.save);
        app.persist();
        toast(`${plural(came.length, 'animal')} came home. A new place is open on the map.`);
      } else if (what === 'grow') {
        const came = growActive(app.save, Number(arg));
        app.persist();
        toast(came.length ? `${plural(came.length, 'animal')} came home.` : 'The sanctuary grew.');
      } else {
        setPantry(app.save, 'life', what === 'fill' ? ITEM_CAP.life : 0);
        setPantry(app.save, 'hint', what === 'fill' ? ITEM_CAP.hint : 0);
        app.persist();
        toast(what === 'fill' ? 'Extra lives and hints: 10 each.' : 'Extra lives and hints: 0.');
      }
      return;
    }
    const swEl = t.closest('[data-switch]') as HTMLElement | null;
    if (swEl) {
      const key = swEl.dataset.switch as BoolKey;
      const v = !app.settings[key];
      app.settings[key] = v;
      swEl.setAttribute('aria-checked', String(v));
      swEl.querySelector('.switch')?.setAttribute('aria-checked', String(v));
      if (key === 'music') app.settings.musicChosen = true;
      changed = true;
      app.applySettings();
      app.persist();
      // D40: turning sound or haptics on gives a small sample, so the player knows what they turned on.
      if (v && key === 'sound') sfx('hello', { style: 'playful' });
      if (v && key === 'music') playCue('triumph');
      if (v && key === 'haptics') haptic('light');
      return;
    }
    const ch = t.closest('[data-choice]') as HTMLElement | null;
    if (ch) {
      const key = ch.dataset.choice as keyof Settings;
      (app.settings as unknown as Record<string, unknown>)[key] = ch.dataset.value;
      for (const b of sh.el.querySelectorAll<HTMLElement>(`[data-choice="${key}"]`)) b.setAttribute('aria-pressed', String(b === ch));
      changed = true;
      app.applySettings();
      app.persist();
      if (key === 'reducedMotion' && app.reducedMotion) track('animation_reduced_mode', { source: 'setting' });
      if (key === 'controls') {
        const pv = sh.el.querySelector('[data-controls-preview]');
        if (pv) pv.innerHTML = controlsPreview(app.settings.controls);
      }
      return;
    }
    const a = actionOf(e);
    if (!a) return;
    if (a.act === 'leaderboard') {
      sh.close();
      app.router.go({ screen: 'challenges', tab: 'leaderboard' });
      return;
    }
    if (a.act === 'ad-privacy') {
      try {
        const { AdMob } = await import('@capacitor-community/admob');
        await AdMob.showPrivacyOptionsForm();
      } catch {
        toast('Privacy choices open after your first video.');
      }
      return;
    }
    if (a.act === 'restore') {
      const res = await iap.restore();
      if (!sh.scope.alive) return;
      if (res.ok && res.owned.includes('remove_ads') && res.source) {
        app.save.purchases.removeAds = { active: true, source: res.source, verifiedAt: new Date().toISOString() };
        app.persist();
        toast('Purchases restored.');
      } else toast(res.ok ? 'No purchases to restore.' : 'The store is not available right now.');
    } else if (a.act === 'rules') {
      showRules(sh.scope);
    } else if (a.act === 'privacy') {
      showPrivacyPolicy(sh.scope);
    } else if (a.act === 'gallery') {
      sh.close();
      app.router.go({ screen: 'gallery' });
    } else if (a.act === 'reset') {
      confirmErase(sh.scope, () => sh.close());
    }
  });
}

/**
 * The privacy policy, in full, inside the app (D43: Apple asks for it to be reachable in the app). It works offline;
 * when the hosted copy's address is set, a link to it follows.
 */
export function showPrivacyPolicy(scope: Scope): void {
  const sh = openSheet(scope, {
    title: 'Privacy policy',
    className: 'policy-sheet',
    body: `
      <p class="muted policy__date">Last updated ${esc(POLICY_UPDATED_TEXT)}</p>
      <div class="policy">${policyHtml(CONTACT_EMAIL)}</div>
      <div class="sheet__actions">
        ${PRIVACY_URL ? `<a class="btn btn--secondary btn--block" href="${esc(PRIVACY_URL)}" target="_blank" rel="noopener noreferrer">Read it online</a>` : ''}
        <button class="btn btn--quiet" data-act="close" data-autofocus>Done</button>
      </div>`,
  });
  sh.scope.on(sh.el, 'click', (e) => {
    if (actionOf(e)?.act === 'close') sh.close();
  });
}

function confirmErase(scope: Scope, done: () => void): void {
  const onBoard = app.save.leaderboard.joined && leaderboard.mode !== 'off';
  const cs = openSheet(scope, {
    title: 'Erase all progress?',
    body: `<p class="sheet__lead">Levels, pets, decorations, coins and streaks on this device will be erased. Purchases and settings stay. This can't be undone.</p>
      ${onBoard ? `<p class="muted">You'll also leave the leaderboard: your name and points there are deleted.</p>` : ''}
      <p class="lb-field__error" role="alert"></p>
      <div class="sheet__actions">
        <button class="btn btn--quiet" data-act="cancel" data-autofocus>Keep my progress</button>
        <button class="btn btn--danger btn--block" data-act="erase">Erase progress</button>
      </div>`,
  });
  let busy = false;
  cs.scope.on(cs.el, 'click', async (e) => {
    const a = actionOf(e);
    if (!a || busy) return;
    if (a.act !== 'erase') return cs.close();
    busy = true;
    if (onBoard) {
      try {
        await leaderboard.leave();
      } catch {
        // Offline or unreachable: keep everything, so the player can leave the leaderboard first and try again.
        busy = false;
        if (cs.scope.alive)
          (cs.el.querySelector('.lb-field__error') as HTMLElement).textContent =
            "Couldn't reach the leaderboard to delete your entry there. Check your connection and try again, or leave it first in League.";
        return;
      }
      resetLeaderboardLocal(app.save);
    }
    const fresh = resetProgress(app.save);
    // A fresh start gets the starter pantry again, like a new install.
    grantStarterItems(fresh);
    app.active = null;
    app.replaceSave(fresh);
    cs.close();
    done();
    app.router.reset({ screen: 'journey' });
    toast('Progress erased.');
  });
}
