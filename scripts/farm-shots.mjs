// Farm and meadow pictures at fixed positions, for before/after comparisons of the art (D47).
//
//   npm run dev                                   # in one terminal (the dev-only window.__pt hook is needed)
//   node scripts/farm-shots.mjs <out-dir> [W] [H] # e.g. node scripts/farm-shots.mjs /tmp/before
//
// Drawn scenes are rendered at stage 4 with everyone home and every animation paused at the same moment; the 3D walk
// is placed at the same spots (reduced motion: no drift) except the butterfly shot, which waits for the pasture's
// butterflies. Same commit, same picture: run it before and after a change and compare file by file.
// Needs Playwright (npm i --no-save playwright) and Chromium (CHROME_PATH to use another Chrome).

import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const out = process.argv[2] ?? 'artifact/shots';
const W = Number(process.argv[3] ?? 390);
const H = Number(process.argv[4] ?? 844);
const URL = process.env.E2E_URL ?? 'http://localhost:5173/';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await browser.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 3, hasTouch: true });
await page.goto(URL);
await page.waitForFunction(() => window.__pt).then((h) => h.dispose());

await page.evaluate(async () => {
  const a = window.__pt.app;
  const tools = await import('/src/app/qaTools.ts');
  Object.assign(a.save.onboarding, { tutorialDone: true, seenRules: true, seenLoopCoach: true, sceneTapTipSeen: true, decorTipSeen: true, starterDecorChosen: true, soloRulesSeen: true, pairRulesSeen: true });
  tools.skipToLevel(a.save, 81);
  for (let i = 0; i < 4; i++) tools.finishOpenHomes(a.save);
  a.save.settings.toys3d = false;
  a.save.settings.reducedMotion = 'reduce';
  a.applySettings();
  a.persist();
});

/** A drawn scene by itself, big: every animation paused at 1.2 s so before and after match. */
async function drawn(name, region, zoom) {
  const box = await page.evaluate(
    async ({ region, zoom }) => {
      const { regionScene } = await import('/src/ui/art/regions.ts');
      const { homeState } = await import('/src/meta/homeState.ts');
      const st = homeState(window.__pt.app.save, region);
      document.querySelector('#shot')?.remove();
      const d = document.createElement('div');
      d.id = 'shot';
      d.style.cssText = 'position:fixed;inset:0;z-index:9999;background:#fff;display:grid;place-items:center';
      const vb = zoom ? zoom.join(' ') : '0 0 360 300';
      d.innerHTML = `<figure class="sanctuary__scene" style="margin:0;width:${window.innerWidth}px;aspect-ratio:${zoom ? zoom[2] / zoom[3] : 1.2}"><svg viewBox="${vb}" style="width:100%;height:100%;display:block">${regionScene(region, { stage: 4, companions: st.residents, decor: st.decor, evening: false }, `shot-${region}`)}</svg></figure>`;
      document.body.appendChild(d);
      await new Promise((r) => setTimeout(r, 300));
      for (const an of document.getAnimations()) {
        an.pause();
        an.currentTime = 1200;
      }
      const r = d.firstElementChild.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    },
    { region, zoom },
  );
  await page.screenshot({ path: `${out}/${name}.png`, clip: box });
}

await drawn('01-farm-overview', 'farm');
await drawn('02-farm-meadow-closeup', 'farm', [20, 180, 140, 100]);
await drawn('03-farm-butterflies-closeup', 'farm', [100, 120, 120, 100]);
await drawn('04-grassland-p6', 'p6');
await drawn('05-grassland-p17-closeup', 'p17', [60, 170, 160, 110]);
await page.evaluate(() => document.querySelector('#shot')?.remove());

// The 3D walk, from the same spots.
await page.evaluate(() => {
  const a = window.__pt.app;
  a.save.settings.toys3d = true;
  a.applySettings();
  window.__pt.go({ screen: 'region', id: 'farm' });
});
await page.waitForFunction(() => document.querySelector('.sanctuary__scene [data-act="walk"]:not([hidden])'), null, { timeout: 15000 }).then((h) => h.dispose());
await page.waitForTimeout(1200);
await page.evaluate(() => document.querySelector('.sanctuary__scene [data-act="walk"]').click());
await page.waitForFunction(() => window.__walk?.drawn > 3, null, { timeout: 20000 }).then((h) => h.dispose());
await page.evaluate(() => document.querySelector('[data-walk-hint]')?.classList.add('is-gone'));

/** Puts the walker at (x, z) facing `yaw`, looking `pitch`, draws one frame and saves the view. */
async function walkShot(name, at) {
  await page.evaluate((at) => {
    const w = window.__walk;
    Object.assign(w.walker, { x: at.x, z: at.z, yaw: at.yaw, target: null });
    w.path = [];
    w.goal = null;
    w.pitch = at.pitch ?? -0.08;
    w.renderNow();
  }, at);
  await page.waitForTimeout(250);
  await page.screenshot({ path: `${out}/${name}.png` });
}

await walkShot('10-walk-gate', { x: 0, z: 20, yaw: 0 });
await walkShot('11-walk-grass-closeup', { x: -3, z: 9, yaw: 0.4, pitch: -0.55 });
await walkShot('12-walk-orchard', { x: -11, z: -7, yaw: 0.55, pitch: -0.02 });
await walkShot('13-walk-barn-courtyard', { x: 6, z: 3.5, yaw: -0.3, pitch: -0.05 });
await walkShot('14-walk-pond', { x: -6.5, z: 17, yaw: 0.75, pitch: -0.2 });
await walkShot('15-walk-sunflowers', { x: -5.5, z: 3, yaw: 1.45, pitch: -0.12 });
// Butterflies at rest on the pasture's clover (still, from just outside the pasture), then rising as the player arrives.
await walkShot('16-walk-butterflies-resting', { x: -1.8, z: 10.2, yaw: 0, pitch: -0.42 });
await page.evaluate(() => {
  const a = window.__pt.app;
  a.save.settings.reducedMotion = 'full';
  a.applySettings();
  const w = window.__walk;
  Object.assign(w.walker, { x: -1.2, z: 7, yaw: 0, target: null });
  w.pitch = 0.12;
});
await page.waitForFunction(() => window.__walk.meadowStats && window.__walk.where === 'pasture', null, { timeout: 10000 }).then((h) => h.dispose());
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/17-walk-butterflies-rising.png` });
if (process.env.FLIES) {
for (const ms of [300, 900, 2500, 6000]) {
  const info = await page.evaluate(() => {
    const w = window.__walk;
    return { at: [w.walker.x, w.walker.z], where: w.where, flies: w.meadow.butterflies.flies.map((f) => [f.kind, f.state, +f.g.position.x.toFixed(2), +f.g.position.y.toFixed(2), +f.g.position.z.toFixed(2), f.g.visible]) };
  });
  console.log(ms, JSON.stringify(info));
  await page.waitForTimeout(ms);
}
await page.evaluate(() => { window.__walk.pitch = 0.1; });
await page.waitForTimeout(200);
await page.screenshot({ path: `${out}/18-walk-butterflies-later.png` });
}
await browser.close();
console.log(`saved to ${out}`);
