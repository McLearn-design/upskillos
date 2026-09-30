// Game Studio: every example opens from the project list, runs, and plays without a
// script error. (What each example does is tested headlessly in examples/examples.test.ts.)
//
//   node src/labs/game-studio/e2e/examples.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5195, async ({ page, t, check }) => {
  const ids = await page.locator('[data-testid^="example-"]').evaluateAll((els) => els.map((e) => e.dataset.testid.replace('example-', '')));
  check('The project list offers examples', ids.length > 0, ids.join(', '));
  for (const [i, id] of ids.entries()) {
    if (i > 0) { await t('menu-Project').click(); await t('item-Projects and examples…').click(); }
    await t(`example-${id}`).click();
    await t('guide').waitFor({ timeout: 30000 });
    const problems = await page.evaluate(() => window.__gameStudio.store.doc.log.at(-1).label);
    check(`${id}: opens with its guide`, problems.startsWith('Build the example'), problems);
    await t('run-project').click();
    await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
    await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.text.startsWith('▶')), null, { timeout: 20000 });
    await page.locator('iframe[title="Running game"]').click();
    for (const key of ['ArrowRight', 'Space', 'ArrowDown', 'ArrowLeft', 'ArrowUp']) { await page.keyboard.down(key); await page.waitForTimeout(400); await page.keyboard.up(key); }
    const errors = await page.evaluate(() => window.__gameStudio.store.output.filter((o) => o.level === 'error').map((o) => `${o.file}:${o.line} ${o.text}`));
    check(`${id}: runs and plays without a script error`, errors.length === 0, errors.join(' | '));
    await t('stop').click();
  }
});
process.exit(failed ? 1 : 0);
