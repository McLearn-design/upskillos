// Phase 9: an agent learns to play Breakout from the game's state, in the editor, and then plays the real game.
//   Run › Train an agent… opens with Breakout's environment; Train runs the cross-entropy method in a
//   worker, drawing the learning curve; the trained agent beats random play by far; Watch it play runs
//   the game with the agent at the controls (the paddle moves with no key pressed).
//
//   node src/labs/game-studio/e2e/ml.acceptance.mjs   (starts and stops its own server)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5189, async ({ page, t, check }) => {
  await t('example-breakout').click();
  await t('guide').waitFor({ timeout: 30000 });
  await page.getByTestId('tree-Paddle').first().click();   // the Inspector then shows its live position while the game runs
  await t('menu-Run').click(); await t('item-Train an agent…').click();
  const spec = await t('train-spec').inputValue();
  check('Train an agent opens with Breakout\'s environment: what the agent sees, does and earns', spec.includes('"Ball:position.x"') && spec.includes('"minus": "Paddle:position.x"') && spec.includes('"move_left"'));

  await t('train-start').click();
  await page.getByTestId('train-status').filter({ hasText: 'Generation 1 of 10' }).waitFor({ timeout: 60000 });
  check('Training runs in a worker and reports each generation as it finishes (the page stays responsive)', await t('train-curve').isVisible());
  await page.getByTestId('train-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 180000 });
  const tr = await page.evaluate(() => { const x = window.__gameStudio.store.training; return { score: x.score, random: x.random, gens: x.generations.length }; });
  await t('train-dialog').screenshot({ path: join(tmpdir(), 'game-studio-train.png') });
  check('The trained agent averages far more than random play (30+ bricks against a loss)', tr.score >= 30 && tr.random < 0 && tr.gens === 10, JSON.stringify(tr));
  check('It shows what it learned: a weight for each thing it sees, for each action', await t('train-weights').isVisible());

  await t('train-watch').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  const xs = [];
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(250); xs.push(await page.evaluate(() => window.__gameStudio.store.running?.live?.position?.x ?? null)); }
  const seen = xs.filter((x) => x !== null);
  check('Watch it play: the game runs with the agent at the controls (the paddle moves, no key pressed)', seen.length > 5 && Math.max(...seen) - Math.min(...seen) > 40, seen.map((x) => Math.round(x)).join(' '));
  await t('stop').click();
}, { ready: 'example-breakout' });
console.log(`(dialog picture: ${join(tmpdir(), 'game-studio-train.png')})`);
process.exit(failed ? 1 : 0);
