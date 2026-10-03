// Train in view: Q-learning inside the visible game (runtime/main.ts, ml/qlearning.ts QLearner). The paddle plays
// every episode on screen, the panel says what the learner is doing, the speed changes how fast it plays, and the
// result is exactly what the headless worker gets with the same settings (the same learner, the same random draws).
//
//   node src/labs/game-studio/e2e/trainview.acceptance.mjs   (starts and stops its own server)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5188, async ({ page, t, check }) => {
  await t('example-breakout').click();
  await t('guide').waitFor({ timeout: 30000 });
  await page.getByTestId('tree-Paddle').first().click();   // the Inspector shows its live position while it trains
  await t('menu-Run').click(); await t('item-Train an agent…').click();
  await t('train-episodes').fill('12');
  await t('train-in-view').click();
  await t('train-hud').waitFor({ timeout: 30000 });
  await page.getByTestId('train-hud-status').filter({ hasText: /Episode \d+ of 12/ }).waitFor({ timeout: 60000 });
  check('Train in view runs in the game, with a panel saying what the learner is doing', await page.locator('iframe[title="Running game"]').isVisible());
  // At real time, the paddle moves on its own (nobody presses a key).
  await t('train-speed-1').click();
  const xs = [];
  for (let i = 0; i < 16; i++) { await page.waitForTimeout(250); xs.push(await page.evaluate(() => window.__gameStudio.store.running?.live?.position?.x ?? null)); }
  const seen = xs.filter((x) => x !== null);
  check('The agent plays on screen: the paddle moves with no key pressed', seen.length > 5 && Math.max(...seen) - Math.min(...seen) > 20, seen.map((x) => Math.round(x)).join(' '));
  await page.screenshot({ path: join(tmpdir(), 'game-studio-train-in-view.png') });
  const slow = await page.evaluate(() => window.__gameStudio.store.trainLive?.episode ?? 0);
  await t('train-speed-1024').click();
  await page.getByTestId('train-hud-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 240000 });
  const inView = await page.evaluate(() => { const x = window.__gameStudio.store.training; return { score: x.score, random: x.random, episodes: x.episodes.length, checks: x.episodes.filter((e) => e.greedy !== undefined).map((e) => e.greedy) }; });
  check('Max speed finishes the run; every episode was reported, with its greedy checks', inView.episodes === 12 && inView.checks.length === 2 && slow <= 3, JSON.stringify({ ...inView, slowEpisode: slow }));
  await t('train-hud').screenshot({ path: join(tmpdir(), 'game-studio-train-hud.png') });

  // The same settings in the worker, headless: the same learner, the same draws, so the same result.
  await t('stop').click();
  await t('menu-Run').click(); await t('item-Train an agent…').click();
  await t('train-episodes').fill('12');
  await t('train-start').click();
  await page.getByTestId('train-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 240000 });
  const headless = await page.evaluate(() => { const x = window.__gameStudio.store.training; return { score: x.score, random: x.random, episodes: x.episodes.length, checks: x.episodes.filter((e) => e.greedy !== undefined).map((e) => e.greedy) }; });
  check('In view and headless learn exactly the same thing (same score, same greedy checks)', JSON.stringify(inView) === JSON.stringify(headless), JSON.stringify(headless));
}, { ready: 'example-breakout' });
console.log(`(pictures: ${join(tmpdir(), 'game-studio-train-in-view.png')}, ${join(tmpdir(), 'game-studio-train-hud.png')})`);
process.exit(failed ? 1 : 0);
