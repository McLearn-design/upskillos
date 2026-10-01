// Game Studio, Sprite Forge and Tile Mapper connected (src/utils/artBridge.js), through the real windows:
//   New sprite… opens Sprite Forge; drawing and Send to Game Studio adds the picture and a Sprite2D;
//   Edit in Sprite Forge opens the original; sending again updates the same picture, and undo brings
//   the old one back;
//   New map… opens Tile Mapper; a tileset from the starter art, painting and Send adds a Node2D of TileMapLayers;
//   Edit in Tile Mapper opens it again; painting and sending repaints the same layers.
//
//   node src/labs/game-studio/e2e/artlabs.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5184, async ({ page, t, check }) => {
  const gs = (fn) => page.evaluate(fn);
  const assets = () => gs(() => window.__gameStudio.store.project.assets.map((a) => ({ id: a.id, path: a.path, origin: a.origin ?? null, width: a.width })));
  /** The canvas of a lab's window, found from a control in it. */
  const canvasOf = (testid) => t(testid).locator('xpath=ancestor::div[contains(@class,"h-full") and contains(@class,"w-full") and contains(@class,"flex-col")][1]').locator('canvas').first();
  const clickAt = async (canvas, points) => { const b = await canvas.boundingBox(); for (const [fx, fy] of points) await page.mouse.click(b.x + b.width * fx, b.y + b.height * fy); };

  await t('new-project-name').fill('Art test');
  await t('create-project').click();
  await t('new-scene').click(); await t('new-scene-name').fill('main'); await t('new-scene-name').press('Enter');

  // ── a sprite ──
  await t('new-sprite').click();
  await t('sprite-forge-send').waitFor({ timeout: 30000 });
  await page.waitForFunction(() => /For Game Studio/.test(document.querySelector('[data-testid="sprite-forge-note"]')?.textContent ?? ''), null, { timeout: 10000 });
  check('New sprite… opens Sprite Forge with a new sprite for this project', true);
  await clickAt(canvasOf('sprite-forge-send'), [[0.5, 0.5], [0.52, 0.5], [0.54, 0.5], [0.5, 0.55]]);
  await t('sprite-forge-send').click();
  await page.waitForFunction(() => window.__gameStudio.store.project.assets.some((a) => a.path === 'assets/sprite.png'), null, { timeout: 10000 });
  let a = await assets();
  const first = a.find((x) => x.path === 'assets/sprite.png');
  const node = await gs(() => { const s = window.__gameStudio.store.scene; const n = s.root.children.find((c) => c.type === 'Sprite2D'); return n ? { name: n.name, texture: n.props.texture, x: n.props.position?.x } : null; });
  check('Send to Game Studio adds the picture (marked as made in Sprite Forge) and a Sprite2D in the middle', !!first?.origin?.startsWith('sprite-forge:') && first.width === 32 && node?.texture === 'assets/sprite.png' && node.x === 480, JSON.stringify({ first, node }));
  await t('asset-assets/sprite.png').waitFor();

  await t('edit-sprite-assets/sprite.png').click();
  await page.waitForFunction(() => /For Game Studio/.test(document.querySelector('[data-testid="sprite-forge-note"]')?.textContent ?? ''), null, { timeout: 10000 });
  await clickAt(canvasOf('sprite-forge-send'), [[0.2, 0.2], [0.8, 0.8]]);
  await t('sprite-forge-send').click();
  await page.waitForFunction((id) => window.__gameStudio.store.project.assets.some((x) => x.path === 'assets/sprite.png' && x.id !== id), first.id, { timeout: 10000 });
  a = await assets();
  check('Edit in Sprite Forge, then Send: the same picture is updated (a new version at the same path), not added again', a.filter((x) => x.path.startsWith('assets/sprite')).length === 1 && a.find((x) => x.path === 'assets/sprite.png').origin === first.origin, JSON.stringify(a));
  await gs(() => window.__gameStudio.store.doc.undo());
  a = await assets();
  check('Undo in Game Studio brings the old picture back', a.find((x) => x.path === 'assets/sprite.png')?.id === first.id);

  // ── a map ──
  await t('tab-tilemap').click();
  await t('tile-new-map').click();
  await t('tile-mapper-send').waitFor({ timeout: 30000 });
  check('New map… opens Tile Mapper, asking for a tileset', await page.getByRole('heading', { name: 'Choose a tileset' }).isVisible());
  await t('tileset-tab-starter').click();
  await t('starter-sheet-tiny-dungeon/tilemap/tilemap_packed.png').click();
  await clickAt(canvasOf('tile-mapper-send'), [[0.3, 0.3], [0.32, 0.3], [0.34, 0.3]]);
  await t('tile-mapper-send').click();
  await page.waitForFunction(() => window.__gameStudio.store.scene?.root.children.some((c) => c.name === 'map'), null, { timeout: 10000 });
  const map = () => gs(() => { const m = window.__gameStudio.store.scene.root.children.find((c) => c.name === 'map'); return m && { id: m.id, layers: m.children.map((c) => ({ id: c.id, name: c.name, tileset: c.props.tileset, visible: c.props.visible !== false, cells: (c.props.cells ?? []).length / 3 })) }; });
  const m1 = await map();
  const ground = m1?.layers.find((l) => l.name === 'Ground');
  check('Send adds the map: a Node2D of TileMapLayers, with the collision layer hidden', !!ground && ground.cells > 0 && m1.layers.some((l) => l.name === 'Collision' && !l.visible), JSON.stringify(m1));
  const imageCount = (await assets()).length;
  check('The tileset picture comes with it, named after the sheet', (await assets()).some((x) => x.path === 'assets/tilemap_packed.png'));

  await page.getByTestId('tree-Ground').first().click();
  await t('tile-edit-in-tile-mapper').click();
  await page.waitForFunction(() => /From Game Studio/.test(document.querySelector('[data-testid="tile-mapper-note"]')?.textContent ?? ''), null, { timeout: 10000 });
  await clickAt(canvasOf('tile-mapper-send'), [[0.45, 0.5], [0.5, 0.5], [0.55, 0.5]]);
  await t('tile-mapper-send').click();
  await page.waitForFunction((n) => { const m = window.__gameStudio.store.scene.root.children.find((c) => c.name === 'map'); const g = m?.children.find((c) => c.name === 'Ground'); return g && (g.props.cells ?? []).length / 3 > n; }, ground.cells, { timeout: 10000 });
  const m2 = await map();
  check('Edit in Tile Mapper, then Send: the same layers are repainted (same nodes, more cells), the picture is not added again',
    m2.id === m1.id && JSON.stringify(m2.layers.map((l) => l.id)) === JSON.stringify(m1.layers.map((l) => l.id)) && (await assets()).length === imageCount, JSON.stringify(m2));
}, { ready: 'new-project-name' });
process.exit(failed ? 1 : 0);
