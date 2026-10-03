// Cliff Walk (examples/cliffWalk.ts), the textbook gridworld, learned in view: the table is drawn on the grid as it
// learns (ml/overlay.ts), SARSA's arrows end up along the top and Q-learning's along the spikes, and a saved brain
// walks the game.
//
//   node src/labs/game-studio/e2e/cliff.acceptance.mjs   (starts and stops its own server)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5187, async ({ page, t, check }) => {
  await t('example-cliff-walk').click();
  await t('guide').waitFor({ timeout: 30000 });
  const textbook = async (algorithm) => {
    await t('menu-Run').click(); await t('item-Train an agent…').click();
    await t('train-algorithm').selectOption(algorithm);
    await t('train-schedule').selectOption('constant');
    for (const [id, v] of [['train-episodes', '500'], ['train-alpha', '0.5'], ['train-gamma', '1'], ['train-epsilon', '0.1'], ['train-epsilon-end', '0.1']]) await t(id).fill(v);
  };
  await textbook('sarsa');
  const spec = await t('train-spec').inputValue();
  check('Train an agent opens with the Walker as a script agent, its cells as states, and an overlay', spec.includes('"agent": "Walker"') && spec.includes('"overlay"'));
  await t('train-in-view').click();
  await page.getByTestId('train-hud-status').filter({ hasText: /Episode \d+ of 500/ }).waitFor({ timeout: 60000 });
  // Step: pause, and one update at a time, every number shown in SARSA's formula.
  await t('train-step').click();
  await page.getByTestId('trace-target').waitFor({ timeout: 15000 });
  const line = await t('trace-target').innerText();
  check('Step pauses and shows the latest update in its formula (SARSA: R + γ · Q(S′, A′), with A′ named)', /A′ = (up|right|down|left)|ends the episode/.test(line) && /target = /.test(line), line.slice(0, 140));
  await t('train-predict').check();
  const head = await t('trace-head').innerText();
  await t('train-step').click();
  await page.waitForFunction((h) => { const e = document.querySelector('[data-testid="trace-head"]'); return e && e.textContent !== h; }, head, { timeout: 15000 });
  await page.getByTestId('trace-check').waitFor({ timeout: 15000 });
  const hidden = await page.getByTestId('trace-target').count();
  await t('trace-guess-target').fill('0'); await t('trace-guess-after').fill('0');
  await t('trace-check').click();
  const verdict = await t('trace-verdict').innerText();
  check('Predict hides the target and the new Q until Check, then marks your answers', hidden === 0 && /Your target 0 [✓✗], your new Q 0 [✓✗]/.test(verdict), verdict);
  await page.screenshot({ path: join(tmpdir(), 'game-studio-cliff-step.png') });
  await t('train-predict').uncheck();
  await t('train-speed-16').click();
  await page.waitForTimeout(6000);
  await page.screenshot({ path: join(tmpdir(), 'game-studio-cliff-learning.png') });
  await t('train-speed-1024').click();
  await page.getByTestId('train-hud-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 300000 });
  await page.screenshot({ path: join(tmpdir(), 'game-studio-cliff-sarsa.png') });
  const sarsa = await page.evaluate(() => window.__gameStudio.store.training.score);
  check('SARSA learns a walk to the chest (greedy play finishes, longer than 13 moves)', sarsa < -13 && sarsa > -40, String(sarsa));

  await t('stop').click();
  await textbook('q');
  await t('train-start').click();
  await page.getByTestId('train-status').filter({ hasText: 'Trained.' }).waitFor({ timeout: 300000 });
  const q = await page.evaluate(() => window.__gameStudio.store.training.score);
  check('Q-learning learns the shortest walk, along the spikes: return −13', q === -13, String(q));
  await t('train-save-brain').click();
  await t('dialog-close').click().catch(() => {});
  await page.keyboard.press('Escape').catch(() => {});
  await page.getByTestId('tree-Walker').first().click();   // the Inspector then shows its live position while the game runs
  await t('run-project').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  const xs = [];
  for (let i = 0; i < 32 && !xs.some((x) => x >= 184); i++) { await page.waitForTimeout(250); xs.push(await page.evaluate(() => window.__gameStudio.store.running?.live?.position?.x ?? null)); }
  await page.screenshot({ path: join(tmpdir(), 'game-studio-cliff-brain.png') });
  const seen = xs.filter((x) => x !== null);
  // Column 11's centre is x = 11.5 × 16 = 184: the brain walks there (to the chest) with no key pressed.
  check('Saved as a brain, it walks the game to the chest with no keys pressed', seen.some((x) => x >= 184), seen.map((x) => Math.round(x)).join(' '));

  // Compare: SARSA and Q-learning, the same three seeds each, averaged.
  await t('stop').click();
  await t('menu-Run').click(); await t('item-Train an agent…').click();
  await t('train-method-compare').click();
  for (const algorithm of ['sarsa', 'q']) {
    await t('train-algorithm').selectOption(algorithm);
    await t('train-schedule').selectOption('constant');
    for (const [id, v] of [['train-episodes', '300'], ['train-alpha', '0.5'], ['train-gamma', '1'], ['train-epsilon', '0.1'], ['train-epsilon-end', '0.1']]) await t(id).fill(v);
    await t('compare-add').click();
  }
  await t('compare-seeds').fill('3');
  await t('compare-start').click();
  await page.getByTestId('compare-status').filter({ hasText: 'Done: 6 runs' }).waitFor({ timeout: 300000 });
  const table = await t('compare-table').innerText();
  const rows = table.split('\n').filter((l) => /SARSA|Q-learning/.test(l));
  const late = (r) => Number(r.split('\t').find((c) => c.includes('±')).split('±')[0]);
  const greedy = (r) => Number(r.split('\t').filter((c) => c.includes('±'))[1].split('±')[0]);
  await t('train-dialog').screenshot({ path: join(tmpdir(), 'game-studio-cliff-compare.png') });
  check('Compare: SARSA earns more while exploring; Q-learning\'s greedy walk is the shortest (−13)', rows.length === 2 && late(rows[0]) > late(rows[1]) && greedy(rows[1]) === -13, rows.join(' | '));
}, { ready: 'example-cliff-walk' });
console.log(`(pictures: ${['step', 'learning', 'sarsa', 'brain', 'compare'].map((n) => join(tmpdir(), `game-studio-cliff-${n}.png`)).join(', ')})`);
process.exit(failed ? 1 : 0);
