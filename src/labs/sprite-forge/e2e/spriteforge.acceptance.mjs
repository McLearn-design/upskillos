// Sprite Forge on its own, through the real window: drawing, and its code in the Code panel (GUI → code); a
// flip is logged as its own line; code typed into the panel runs as one edit, and undo takes it back; bad
// code says why.
//
//   node src/labs/sprite-forge/e2e/spriteforge.acceptance.mjs   (starts and stops its own server)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withGameStudio } from '../../game-studio/e2e/harness.mjs';

const failed = await withGameStudio(5191, async ({ page, t, check }) => {
  await t('sprite-forge-code-toggle').click();
  const lines = () => t('sprite-forge-code-lines').innerText();
  check('The Code panel starts from the sprite as opened', (await lines()).includes('as it was opened'), await lines());

  const canvas = t('sprite-forge-send').locator('xpath=ancestor::div[contains(@class,"h-full") and contains(@class,"w-full") and contains(@class,"flex-col")][1]').locator('canvas').first();
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + b.width * 0.45, b.y + b.height * 0.5); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.55, b.y + b.height * 0.5, { steps: 6 }); await page.mouse.up();
  check('A brush stroke appears as one line: sprite.paint(0, [[x, y, colour], …])', /sprite\.paint\(0, \[\[\d+,\d+,\d+\]/.test(await lines()), (await lines()).split('\n').at(-1));

  await page.locator('button[title="Flip horizontally"]').click();
  check('A flip is its own line', (await lines()).includes('sprite.flipH(0)'), (await lines()).split('\n').at(-1));

  await t('sprite-forge-code-input').fill("sprite.addFrame(0, { copy: true })\nsprite.color(0, '#ff004d')");
  await t('sprite-forge-code-run').click();
  check('Code typed into the panel runs as one edit and is logged', (await lines()).includes("sprite.color(0, '#ff004d')"));
  await page.locator('button[title^="Undo"]').first().click();
  check('Undo takes it back, and its line with it', !(await lines()).includes("sprite.color(0, '#ff004d')"));

  await t('sprite-forge-code-input').fill('sprite.paint(7, [[0, 0, 1]])');
  await t('sprite-forge-code-run').click();
  check('Code that fails says why, and changes nothing', (await t('sprite-forge-code-error').innerText()).includes('no frame 7'));

  await t('sprite-forge-examples').selectOption('coin');
  await page.waitForFunction(() => document.querySelector('[data-testid="sprite-forge-code-lines"]')?.textContent?.includes('const angles'), null, { timeout: 10000 });
  check('An example sprite opens, drawn by code, with its code in the panel', (await lines()).includes('sprite.tags'));
  await page.waitForTimeout(400);
  await page.screenshot({ path: join(tmpdir(), 'sprite-forge-example.png') });
}, { hash: '#/lab/sprite-forge', ready: 'sprite-forge-code-toggle' });
process.exit(failed ? 1 : 0);
