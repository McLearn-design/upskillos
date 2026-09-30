// Game Studio, Phase 2 test: build a small platformer scene from the starter art and
// run it with a following camera and a HUD (docs/game-studio-status.md).
//
//   drag starter art into the viewport → a player body with the character under it
//   (dragged in the tree; it stays where it was) → a zoomed Camera2D under the player
//   → a HUD label on a CanvasLayer → the movement script → rotate and scale a tile
//   with the tools, then undo both → run, move right: the world scrolls, the HUD stays
//
//   node src/labs/game-studio/e2e/phase2.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

// Pictures of each stage, only when asked for: SCREENSHOTS=/some/folder
const OUT = process.env.SCREENSHOTS;
const shot = (page, name) => (OUT ? page.screenshot({ path: `${OUT}/${name}` }) : undefined);
const PP = 'assets/pixel-platformer';

const failed = await withGameStudio(5196, async ({ page, t, check }) => {
  await t('new-project-name').fill('Platformer');
  await t('create-project').click();
  await t('new-scene').click(); await t('new-scene-name').fill('level'); await t('new-scene-name').press('Enter');

  // A player body in the middle of the game area.
  await t('add-node').selectOption('CharacterBody2D');
  await t('tree-CharacterBody2D').dblclick(); await t('rename-input').fill('Player'); await t('rename-input').press('Enter');
  await t('tree-Player').click();
  await t('prop-position-x').fill('480'); await t('prop-position-x').press('Enter');
  await t('prop-position-y').fill('272'); await t('prop-position-y').press('Enter');

  // Starter art: a character and a row of ground tiles, dragged into the viewport.
  await t('left-art').click();
  await t('starter-pack').selectOption('pixel-platformer');
  await t('starter-folder').selectOption('characters');
  const vp = await t('viewport').boundingBox();
  const at = (fx, fy) => ({ targetPosition: { x: vp.width * fx, y: vp.height * fy } });
  await t(`starter-${PP}/characters/tile_0000.png`).dragTo(t('viewport'), at(0.5, 0.5));
  await t('tree-Tile0000').waitFor({ timeout: 10000 });
  await t('starter-folder').selectOption('tiles');
  const spriteCount = () => page.evaluate(() => window.__gameStudio.store.scene.root.children.filter((c) => c.type === 'Sprite2D').length);
  for (const [i, fx] of [[0, 0.38], [1, 0.5], [2, 0.62]]) {
    const before = await spriteCount();
    await t(`starter-${PP}/tiles/tile_000${i}.png`).dragTo(t('viewport'), at(fx, 0.62));
    await page.waitForFunction((n) => window.__gameStudio.store.scene.root.children.filter((c) => c.type === 'Sprite2D').length > n, before);   // the import finishes after the drop
  }
  const inProject = await page.evaluate(() => window.__gameStudio.store.project.assets.map((a) => a.path));
  const sprites = await page.evaluate(() => window.__gameStudio.store.scene.root.children.filter((c) => c.type === 'Sprite2D').map((c) => c.name));
  check('Starter art dragged into the scene', inProject.length === 4 && sprites.length === 4, `${inProject.length} images in the project; sprites ${sprites.join(', ')}`);

  // Put the character under the player, in the tree. It must stay where it is on screen.
  const worldBefore = await page.evaluate(() => { const s = window.__gameStudio.store; const n = s.scene.root.children.find((c) => c.name === 'Tile0000'); return n.props.position; });
  await t('tree-Tile0000').dragTo(t('tree-Player'));
  const local = await page.evaluate(() => { const s = window.__gameStudio.store; const p = s.scene.root.children.find((c) => c.name === 'Player'); return p.children[0] ? (p.children[0].props.position ?? { x: 0, y: 0 }) : null; });
  if (!local) console.log('tree after the drag:', await page.evaluate(() => JSON.stringify(window.__gameStudio.store.scene.root, (k, v) => (k === 'props' || k === 'id' ? undefined : v))));
  check('Reparent in the tree keeps the character in place', !!local && Math.abs(local.x - (worldBefore.x - 480)) < 1e-9 && Math.abs((local.y ?? 0) - (worldBefore.y - 272)) < 1e-9, `world ${JSON.stringify(worldBefore)} → local ${JSON.stringify(local)}`);

  // A camera under the player, zoomed in; a HUD label on a screen layer.
  await t('tree-Player').click();
  await t('add-node').selectOption('Camera2D');
  await t('prop-zoom').fill('2'); await t('prop-zoom').press('Enter');
  await t('tree-Level').click();
  await t('add-node').selectOption('CanvasLayer');
  await t('add-node').selectOption('Label');
  await t('prop-text').fill('Coins: 0'); await t('prop-text').press('Enter');
  await t('prop-position-x').fill('12'); await t('prop-position-x').press('Enter');
  await t('prop-position-y').fill('10'); await t('prop-position-y').press('Enter');
  check('Camera and HUD added', (await t('tree-Camera2D').count()) === 1 && (await t('tree-Label').count()) === 1);

  // The movement script, from the template.
  await t('tree-Player').click();
  await t('new-script').click();
  await page.locator('.monaco-editor').waitFor();
  const attached = await page.evaluate(() => window.__gameStudio.store.scene.root.children.find((c) => c.name === 'Player').script);
  check('Script attached to the player', attached === 'scripts/player.js', String(attached));
  await t('left-files').click();
  await page.locator('[data-testid="viewport"]').waitFor({ state: 'attached' });
  await page.getByText('🎬 level.scene').click();

  // Rotate and scale a tile with the tools, then undo both.
  await t('tree-Tile0001').click();
  await page.keyboard.press('f');   // frame the selection: its origin is now the viewport's centre
  await page.waitForTimeout(200);
  const box = await t('viewport').boundingBox();
  const cx = box.x + box.width * 0.5, cy = box.y + box.height * 0.5;
  await page.keyboard.press('e');
  await page.mouse.move(cx + 40, cy); await page.mouse.down(); await page.mouse.move(cx, cy + 40, { steps: 6 }); await page.mouse.up();
  const rot = await t('prop-rotation').inputValue();
  await page.keyboard.press('r');
  await page.mouse.move(cx + 20, cy); await page.mouse.down(); await page.mouse.move(cx + 40, cy, { steps: 6 }); await page.mouse.up();
  const sc = await t('prop-scale-x').inputValue();
  await page.keyboard.press('ControlOrMeta+Z'); await page.keyboard.press('ControlOrMeta+Z');
  const back = [await t('prop-rotation').inputValue(), await t('prop-scale-x').inputValue()];
  await page.keyboard.press('w');
  check('Rotate (E) and scale (R) tools, and undo', rot === '90' && sc === '2' && back[0] === '0' && back[1] === '1', `rotation ${rot}°, scale ${sc}, after undo ${back.join(', ')}`);
  await shot(page, 'gs-phase2-editor.png');

  // Run: the camera follows the player, the HUD stays.
  await t('run-project').click();
  const frame = page.locator('iframe[title="Running game"]');
  await frame.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.text.startsWith('▶')), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const fb = await frame.boundingBox();
  const hud = { x: fb.x, y: fb.y, width: 220, height: 60 }, world = { x: fb.x, y: fb.y + fb.height / 2 + 20, width: fb.width, height: fb.height / 2 - 20 };   // below the player: the ground tiles, which scroll past a camera that follows exactly
  const hud1 = await page.screenshot({ clip: hud }), world1 = await page.screenshot({ clip: world });
  await shot(page, 'gs-phase2-run-1.png');
  await frame.click();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(300);
  const hud2 = await page.screenshot({ clip: hud }), world2 = await page.screenshot({ clip: world });
  await shot(page, 'gs-phase2-run-2.png');
  check('The HUD stays put while the player moves', hud1.equals(hud2));
  check('The world scrolls under the camera', !world1.equals(world2));
  await t('stop').click();

  await page.keyboard.press('ControlOrMeta+S');
  await page.waitForTimeout(400);
  check('Saved', (await t('save-state').innerText()) === 'Saved');
});
process.exit(failed ? 1 : 0);
