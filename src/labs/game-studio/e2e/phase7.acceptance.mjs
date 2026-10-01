// Game Studio Phase 7: a multi-scene game, built from scenes inside scenes (the milestone: "user can
// build a multi-scene game"). With Zombie Arena: the arena's player is an instance of player.scene,
// with its signal connection; an override inside one instance is marked and ↺ undoes it; the ⧉
// button in Files adds another instance; changing the source scene changes every instance; and the
// game runs from the title screen into the arena.
//
//   node src/labs/game-studio/e2e/phase7.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const OUT = process.env.SCREENSHOTS;
const failed = await withGameStudio(5187, async ({ page, t, check }) => {
  const store = (fn, arg) => page.evaluate(fn, arg);
  await t('example-zombie-arena').click();
  await t('guide').waitFor({ timeout: 30000 });
  await page.locator('[title="Close the guide"]').click();
  await t('file-scenes/arena.scene').click();

  // The player is an instance; its connection is in the Inspector.
  await t('tree-Player').click();
  check('The arena’s Player is an instance of player.scene', (await t('instance-note').innerText()).includes('scenes/player.scene') && (await t('tree-instance-Player').count()) === 1);
  check('Its saved connection shows: healthChanged → HUD/Health.show()', (await t('connection-0').innerText()).replace(/\s+/g, ' ').includes('healthChanged → HUD/Health.show()'));

  // An override inside one instance: Zombie2's Sprite, scaled.
  await t('toggle-Zombie2').click();
  const sprites = page.getByTestId('tree-Sprite');
  await sprites.last().click();                 // Zombie2 › Sprite (greyed: from zombie.scene)
  await t('prop-scale-x').fill('1.5'); await t('prop-scale-x').press('Enter');
  const overrides = await store(() => window.__gameStudio.store.scene.root.children.find((c) => c.name === 'Zombie2').overrides);
  const log = await store(() => window.__gameStudio.store.doc.log.at(-1).code);
  check('Changing a node inside one instance saves an override on it, logged by path', overrides?.Sprite?.scale?.x === 1.5 && log.endsWith('scene.get("Zombie2/Sprite").scale = { x: 1.5, y: 1 }'), log.split('\n').at(-1));
  await t('override-scale').waitFor({ timeout: 3000 }).catch(() => {});
  check('The override is marked in the Inspector', (await t('override-scale').count()) === 1);
  await t('reset-scale').click();
  const after = await store(() => window.__gameStudio.store.scene.root.children.find((c) => c.name === 'Zombie2').overrides);
  check('↺ puts the scene’s value back, and the override goes', after === undefined);

  // ⧉ in Files: another zombie, an instance of zombie.scene.
  await t('tree-Arena').click();
  await t('instance-scenes/zombie.scene').click();
  const zombies = await store(() => window.__gameStudio.store.scene.root.children.filter((c) => c.instance === 'scenes/zombie.scene').map((c) => c.name));
  check('⧉ in Files adds an instance of that scene', zombies.length === 3, zombies.join(', '));

  // Change the source: every zombie in the arena changes.
  await t('file-scenes/zombie.scene').click();
  await t('tree-Sprite').click();
  await t('prop-scale-x').fill('1.25'); await t('prop-scale-x').press('Enter');
  await t('file-scenes/arena.scene').click();
  const scales = await store(() => { const s = window.__gameStudio.store; return s.expanded.root.children.filter((c) => c.name.startsWith('Zombie')).map((z) => z.children.find((c) => c.name === 'Sprite').props.scale?.x); });
  check('Changing zombie.scene changes every zombie in the arena', scales.length === 3 && scales.every((x) => x === 1.25), scales.join(', '));
  if (OUT) await page.screenshot({ path: `${OUT}/phase7-editor.png` });

  // Run: the title screen, then Space into the arena.
  await t('run-project').click();
  const frame = page.locator('iframe[title="Running game"]');
  await frame.waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.text.startsWith('▶')), null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await frame.click();
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
  await page.keyboard.down('ArrowUp'); await page.keyboard.down('Space'); await page.waitForTimeout(900); await page.keyboard.up('Space'); await page.keyboard.up('ArrowUp');
  if (OUT) await page.screenshot({ path: `${OUT}/phase7-running.png` });
  const errors = await store(() => window.__gameStudio.store.output.filter((o) => o.level === 'error').map((o) => `${o.file}:${o.line} ${o.text}`));
  check('The game runs from the title into the arena with no errors', errors.length === 0, errors.join(' | '));
  await t('stop').click();
});
process.exit(failed ? 1 : 0);
