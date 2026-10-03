// Phase 9: an agent learns to play Breakout from the game's state, in the editor, and then plays the real game.
//   Run › Train an agent… opens with Breakout's environment; Train runs Q-learning in a worker, drawing the
//   learning curve and the Q table; the trained agent beats random play by far; Watch it play runs the game
//   with the agent at the controls (the paddle moves with no key pressed). Then the cross-entropy method,
//   the other way to train, from the same dialog.
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

  check('Its environment cuts two readings into bins, the states of a Q table', spec.includes('"bins"'));

  await t('train-start').click();
  await page.getByTestId('train-status').filter({ hasText: /Episode \d+ of 100/ }).waitFor({ timeout: 60000 });
  check('Q-learning runs in a worker and reports each episode as it finishes (the page stays responsive)', await t('train-curve').isVisible());
  await page.getByTestId('train-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 300000 });
  const tq = await page.evaluate(() => { const x = window.__gameStudio.store.training; return { method: x.method, score: x.score, random: x.random, episodes: x.episodes.length, checks: x.episodes.filter((e) => e.greedy !== undefined).length }; });
  await t('train-dialog').screenshot({ path: join(tmpdir(), 'game-studio-train-q.png') });
  check('The Q-learning agent averages far more than random play (40+ bricks against a loss)', tq.method === 'q' && tq.score >= 40 && tq.random < 0 && tq.episodes === 100 && tq.checks === 10, JSON.stringify(tq));
  const rows = await page.getByTestId('train-qtable').locator('tbody tr').count();
  check('It shows what it learned: the Q table, a row for each of the 14 states and a value for each action', rows === 14, String(rows));
  await t('train-save-brain').click();
  const saved = await page.evaluate(() => { const st = window.__gameStudio.store; const b = st.doc.project.brains; return { n: b.length, path: b[0]?.path, rows: b[0]?.policy.table.length, actions: b[0]?.actions, code: st.doc.log.at(-1).code.slice(0, 40) }; });
  check('Save as brain puts it in the project (brains/, exported with the game), as a line of GUI → code', saved.n === 1 && saved.rows === 14 && saved.code.startsWith('project.saveBrain("brains/') && saved.actions.join() === 'jump+move_left,jump+move_right', JSON.stringify(saved));

  await t('train-watch').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  const xs = [];
  for (let i = 0; i < 24; i++) { await page.waitForTimeout(250); xs.push(await page.evaluate(() => window.__gameStudio.store.running?.live?.position?.x ?? null)); }
  const seen = xs.filter((x) => x !== null);
  check('Watch it play: the game runs with the agent at the controls (the paddle moves, no key pressed)', seen.length > 5 && Math.max(...seen) - Math.min(...seen) > 40, seen.map((x) => Math.round(x)).join(' '));
  await t('stop').click();

  // The other method: the cross-entropy method searches over a linear policy's weights.
  await t('menu-Run').click(); await t('item-Train an agent…').click();
  await t('train-method-cem').click();
  await t('train-start').click();
  await page.getByTestId('train-status').filter({ hasText: 'Generation 1 of 10' }).waitFor({ timeout: 60000 });
  await page.getByTestId('train-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 180000 });
  const tr = await page.evaluate(() => { const x = window.__gameStudio.store.training; return { method: x.method, score: x.score, random: x.random, gens: x.generations.length }; });
  await t('train-dialog').screenshot({ path: join(tmpdir(), 'game-studio-train.png') });
  check('The cross-entropy agent beats random play by far too (30+)', tr.method === 'cem' && tr.score >= 30 && tr.random < 0 && tr.gens === 10, JSON.stringify(tr));
  check('It shows what it learned: a weight for each thing it sees, for each action', await t('train-weights').isVisible());
}, { ready: 'example-breakout' });
console.log(`(dialog pictures: ${join(tmpdir(), 'game-studio-train-q.png')}, ${join(tmpdir(), 'game-studio-train.png')})`);
process.exit(failed ? 1 : 0);
