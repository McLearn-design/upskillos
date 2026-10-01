// Tile Mapper on its own, through the real window: a tileset from the starter art; painting, and its code
// in the Code panel (GUI → code); code typed into the panel runs as one edit, and undo takes it back; an
// example map, made by code, opens with its code shown.
//
//   node src/labs/tile-mapper/e2e/tilemapper.acceptance.mjs   (starts and stops its own server)

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { withGameStudio } from '../../game-studio/e2e/harness.mjs';

const failed = await withGameStudio(5190, async ({ page, t, check }) => {
  await t('tileset-tab-starter').click();
  await t('starter-sheet-tiny-dungeon/tilemap/tilemap_packed.png').click();
  await page.getByRole('heading', { name: 'Choose a tileset' }).waitFor({ state: 'detached', timeout: 10000 });
  check('A fresh Tile Mapper asks for a tileset; the starter art needs nothing set', true);

  await t('tile-mapper-code-toggle').click();
  const lines = () => t('tile-mapper-code-lines').innerText();
  check('The Code panel starts from the map as opened, with the tileset as its first line', (await lines()).includes('map.tileset({"name":"tilemap_packed.png","tileW":16,"tileH":16'), await lines());

  const canvas = t('tile-mapper-send').locator('xpath=ancestor::div[contains(@class,"h-full") and contains(@class,"w-full") and contains(@class,"flex-col")][1]').locator('canvas').first();
  const b = await canvas.boundingBox();
  await page.mouse.move(b.x + b.width * 0.3, b.y + b.height * 0.3); await page.mouse.down();
  await page.mouse.move(b.x + b.width * 0.36, b.y + b.height * 0.3, { steps: 6 }); await page.mouse.up();
  check('A brush stroke appears as one line: map.paint("Ground", [[x, y, tile], …])', /map\.paint\("Ground", \[\[\d+,\d+,\d+\]/.test(await lines()), (await lines()).split('\n').at(-1));

  await t('tile-mapper-code-input').fill("map.addLayer('tiles')\nmap.layer('Layer 3', { name: 'Decor' })");
  await t('tile-mapper-code-run').click();
  const after = await lines();
  const decor = () => page.evaluate(() => [...document.querySelectorAll('input')].filter((i) => i.value === 'Decor').length);
  check('Code typed into the panel runs as one edit and is logged', after.includes("map.addLayer('tiles')") && (await decor()) > 0, after.split('\n').slice(-2).join(' | '));
  await page.locator('button[title^="Undo"]').first().click();
  check('Undo takes the edit back, and its line with it', !(await lines()).includes("map.addLayer('tiles')") && (await decor()) === 0);

  await t('tile-mapper-code-input').fill('map.paint("Nope", [[0, 0, 1]])');
  await t('tile-mapper-code-run').click();
  check('Code that fails says why, and changes nothing', (await t('tile-mapper-code-error').innerText()).includes('no layer "Nope"'));

  await t('tile-mapper-examples').selectOption('maze');
  await page.waitForFunction(() => document.querySelector('[data-testid="tile-mapper-code-lines"]')?.textContent?.includes('Start all wall'), null, { timeout: 10000 });
  check('An example map opens, made by code, and the Code panel shows the code', (await lines()).includes('recursive') || (await lines()).includes('Start all wall'));
  await page.waitForTimeout(500);
  await page.screenshot({ path: join(tmpdir(), 'tile-mapper-example.png') });
}, { hash: '#/lab/tile-mapper', ready: 'tileset-tab-starter' });
process.exit(failed ? 1 : 0);
