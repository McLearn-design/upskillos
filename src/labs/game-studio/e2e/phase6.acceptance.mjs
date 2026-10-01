// Game Studio Phase 6: a tile-based level made in the editor (the milestone: "user can build a
// tile-based level"). Adds a starter tile sheet, a TileMapLayer and a tileset made from the sheet;
// picks a tile from the palette; paints a stroke, fills a rectangle, erases, bucket-fills (and
// undoes it in one step), picks with Alt-click, marks a tile solid, and runs the game.
//
//   node src/labs/game-studio/e2e/phase6.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const SHEET = 'assets/tiny-dungeon/tilemap/tilemap_packed.png';   // 192 × 176: 12 × 11 tiles of 16 px
const OUT = process.env.SCREENSHOTS;
const failed = await withGameStudio(5190, async ({ page, t, check }) => {
  const store = (fn, arg) => page.evaluate(fn, arg);
  const layerProps = () => store(() => { const s = window.__gameStudio.store; return s.scene.root.children.find((c) => c.type === 'TileMapLayer').props; });
  const cellCount = async () => ((await layerProps()).cells ?? []).length / 3;
  await t('new-project-name').fill('Tiles');
  await t('create-project').click();
  await t('new-scene').click(); await t('new-scene-name').fill('level'); await t('new-scene-name').press('Enter');

  // The sheet, from the starter art, without a sprite.
  await t('left-art').click();
  await t('starter-pack').selectOption('tiny-dungeon');
  await t('starter-folder').selectOption('tilemap');
  await t(`starter-${SHEET}`).click();
  await t('starter-add').click();
  await page.waitForFunction((p) => window.__gameStudio.store.project.assets.some((a) => a.path === p), SHEET);

  // A TileMapLayer: selecting it opens the TileMap panel. A tileset from the sheet.
  await t('add-node').selectOption('TileMapLayer');
  await t('tree-TileMapLayer').click();
  await t('tile-panel').waitFor();
  await t('tile-new-tileset').click();
  await t('new-tileset-image').selectOption(SHEET);
  await t('new-tileset-create').click();
  await t('tile-palette').waitFor();
  const tilesets = await store(() => window.__gameStudio.store.project.tilesets);
  check('A tileset made from the sheet: 16 × 16 tiles, and the layer uses it', tilesets.length === 1 && tilesets[0].tileWidth === 16 && (await layerProps()).tileset === tilesets[0].path, tilesets[0]?.path);

  // Drag the bottom panel's edge up 150 px: more of the palette shows.
  const panelBefore = (await t('panel-tilemap').boundingBox()).height;
  const edge = await t('bottom-resize').boundingBox();
  await page.mouse.move(edge.x + 300, edge.y + 4); await page.mouse.down(); await page.mouse.move(edge.x + 300, edge.y - 146, { steps: 5 }); await page.mouse.up();
  const panelAfter = (await t('panel-tilemap').boundingBox()).height;
  check('The bottom panel resizes by dragging its edge', Math.abs(panelAfter - panelBefore - 150) < 3, `${Math.round(panelBefore)} → ${Math.round(panelAfter)} px`);

  // Pick tile 40 (column 4, row 3) in the palette, shown 2× (32 px a tile).
  const pal = await t('tile-palette').boundingBox();
  await page.mouse.click(pal.x + 4 * 32 + 16, pal.y + 3 * 32 + 16);
  check('Clicking the palette chooses a tile', (await store(() => window.__gameStudio.store.tile.tileId)) === 40);

  // Paint: drag across the viewport. One stroke is one command, logged as paint([...]).
  const vp = await t('viewport').boundingBox();
  const at = (fx, fy) => [vp.x + vp.width * fx, vp.y + vp.height * fy];
  const steps0 = await store(() => window.__gameStudio.store.doc.undoStack.length);
  await page.mouse.move(...at(0.35, 0.3)); await page.mouse.down(); await page.mouse.move(...at(0.65, 0.3), { steps: 12 }); await page.mouse.up();
  const props = await layerProps();
  const painted = props.cells.length / 3, tiles = new Set(props.cells.filter((_, i) => i % 3 === 2));
  const log = await store(() => window.__gameStudio.store.doc.log.at(-1).code);
  const steps1 = await store(() => window.__gameStudio.store.doc.undoStack.length);
  check('A painted stroke: a row of cells with no gaps, one undo step, logged as paint(...)', painted >= 10 && tiles.size === 1 && tiles.has(40) && steps1 === steps0 + 1 && log.includes('.paint([['), `${painted} cells`);

  // Rectangle fill.
  await t('tile-tool-rect').click();
  const before = await cellCount();
  await page.mouse.move(...at(0.4, 0.5)); await page.mouse.down(); await page.mouse.move(...at(0.5, 0.6), { steps: 6 }); await page.mouse.up();
  const rect = (await cellCount()) - before;
  check('A rectangle fill adds a whole rectangle of cells', rect >= 4, `${rect} cells`);

  // Erase one cell of the painted row.
  await t('tile-tool-erase').click();
  const beforeErase = await cellCount();
  await page.mouse.click(...at(0.5, 0.3));
  check('Erase empties the cell clicked', (await cellCount()) === beforeErase - 1);

  // Bucket fill an empty area, then undo it in one step.
  await t('tile-tool-bucket').click();
  const beforeFill = await cellCount();
  await page.mouse.click(...at(0.2, 0.85));
  const filled = (await cellCount()) - beforeFill;
  await store(() => window.__gameStudio.store.doc.undo());
  check('Bucket fill fills the empty area, and undoes in one step', filled > 100 && (await cellCount()) === beforeFill, `${filled} cells filled`);

  // Pick with Alt-click: choose a different tile first, then Alt-click a painted cell.
  await page.mouse.click(pal.x + 16, pal.y + 16);
  await page.keyboard.down('Alt'); await page.mouse.click(...at(0.4, 0.3)); await page.keyboard.up('Alt');
  check('Alt-click picks the tile under the pointer', (await store(() => window.__gameStudio.store.tile.tileId)) === 40);

  // Collision: mark tile 40 solid in the palette.
  await t('tile-collision').click();
  await page.mouse.click(pal.x + 4 * 32 + 16, pal.y + 3 * 32 + 16);
  check('Solid tiles mode marks a tile solid in the tileset', (await store(() => window.__gameStudio.store.project.tilesets[0].solid)).includes(40));
  if (OUT) await page.screenshot({ path: `${OUT}/phase6-editor.png` });

  // Run: the level is drawn by Phaser's tilemap, with no errors.
  await t('run-project').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.text.startsWith('▶')), null, { timeout: 20000 });
  await page.waitForTimeout(1000);
  if (OUT) await page.screenshot({ path: `${OUT}/phase6-running.png` });
  const errors = await store(() => window.__gameStudio.store.output.filter((o) => o.level === 'error').map((o) => o.text));
  check('It runs with no errors', errors.length === 0, errors.join(' | '));
  await t('stop').click();
});
process.exit(failed ? 1 : 0);
