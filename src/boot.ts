/** Bootstrap, after the store is ready (main.ts): load the save, apply settings, mount navigation and route to Home. */

import { app } from './app/app';
import { Router } from './ui/router';
import { mountNav } from './ui/components/nav';
import { journeyScreen } from './ui/screens/journey';
import { gameScreen } from './ui/screens/game';
import { leagueScreen } from './ui/screens/league';
import { profileScreen } from './ui/screens/profile';
import { petsScreen } from './ui/screens/pets';
import { shopScreen } from './ui/screens/shop';
import { sanctuaryScreen } from './ui/screens/sanctuary';
import { galleryScreen } from './ui/screens/gallery';
import { worldScreen } from './ui/screens/world';
import { regionScreen } from './ui/screens/region';
import { needsWelcome, welcomeScreen } from './ui/screens/welcome';
import { track } from './services/analytics';
import { catchUpAchievements } from './app/events';
import { startLeaderboardSync } from './app/leaderboardSync';
import { applyUsageChoice, noteDay } from './app/usage';

const root = document.getElementById('app')!;
const router = new Router(root);
app.router = router;
router.register({
  journey: journeyScreen,
  game: gameScreen,
  pets: petsScreen,
  challenges: leagueScreen,
  shop: shopScreen,
  sanctuary: sanctuaryScreen,
  gallery: galleryScreen,
  world: worldScreen,
  region: regionScreen,
  welcome: welcomeScreen,
  profile: profileScreen,
});
app.applySettings();
mountNav(router);
router.onChange((r) => track('screen_view', { screen: r.screen }));

app.save.onboarding.sessions++;
void app.reconcilePurchases();
startLeaderboardSync();
catchUpAchievements();
track('app_open', { sessions: app.save.onboarding.sessions });
// D47 PR 6: the day counted for Day 1 / 7 / 30 return, then usage stats if the player chose them (the SDK loads after
// the first screen, so it never slows the start).
noteDay(app.save);
app.persist();
setTimeout(() => void applyUsageChoice(app.save, { atLaunch: true }), 1500);

// Pause and save the board when the app is backgrounded; resume only if nothing is covering it.
document.addEventListener('visibilitychange', () => {
  // Back after midnight: a new day.
  if (!document.hidden && noteDay(app.save)) app.persist();
  const a = app.active;
  if (!a || router.route?.screen !== 'game') return;
  if (document.hidden) {
    a.session.pause();
    app.saveActive();
  } else if (!document.querySelector('.overlay')) {
    a.session.resume();
  }
});
window.addEventListener('pagehide', () => app.saveActive());

// Dev-only QA hook for the screenshot harness. Dead-code-eliminated from release builds.
if (import.meta.env.DEV) {
  void import('./app/gameFlow').then(({ startGame }) => {
    (window as unknown as { __pt: unknown }).__pt = { app, go: (r: Parameters<Router['go']>[0]) => router.go(r), start: startGame };
  });
}

router.reset({ screen: needsWelcome() ? 'welcome' : 'journey' });

// Tester builds (D46 PR C): the frame-rate counter comes back if it was left on.
if (import.meta.env.DEV || import.meta.env.VITE_QA === '1') void import('./ui/components/deviceChecks').then((m) => m.restoreDeviceChecks());
