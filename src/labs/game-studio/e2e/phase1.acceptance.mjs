// Game Studio, Phase 1 acceptance test (docs/game-studio-architecture.md, ADR 13).
//
// Real clicks and keys in a real browser, with an empty browser profile:
//   Create project → create scene → add node → add sprite → import a real image →
//   attach JavaScript → edit the script → use the input API → run in the sandboxed
//   runtime → move the sprite with keys → stop (the editor is unchanged) → modify in
//   the editor → undo → redo → save → close → reopen → everything restored, and it
//   still runs.
//
//   npm run game:acceptance        (starts and stops its own dev server)

import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5197, async ({ page, t, check }) => {

  // 1. Create project
  await t('new-project-name').fill('Acceptance');
  await t('create-project').click();
  check('Create project', (await t('status').innerText()).includes('Acceptance'));

  // 2. Create scene
  await t('new-scene').click();
  await t('new-scene-name').fill('main');
  await t('new-scene-name').press('Enter');
  check('Create scene', await t('file-scenes/main.scene').isVisible());

  // 3. Add a node, and rename it Player (double-click in the tree)
  await t('add-node').selectOption('CharacterBody2D');
  await t('tree-CharacterBody2D').dblclick();
  await t('rename-input').fill('Player');
  await t('rename-input').press('Enter');
  check('Add node and rename it', await t('tree-Player').isVisible());

  // 4. Add a Sprite2D under it
  await t('tree-Player').click();
  await t('add-node').selectOption('Sprite2D');
  check('Add sprite as a child', await t('tree-Sprite2D').isVisible());

  // 5. Import a real image: a PNG drawn and encoded by the browser, fed to the file picker
  const png = Buffer.from(await page.evaluate(async () => {
    const c = document.createElement('canvas'); c.width = 64; c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#2b2d42'; g.fillRect(0, 0, 64, 64); g.fillStyle = '#ef8354'; g.beginPath(); g.arc(32, 32, 26, 0, Math.PI * 2); g.fill();
    return c.toDataURL('image/png').split(',')[1];
  }), 'base64');
  await t('import-file').setInputFiles({ name: 'hero.png', mimeType: 'image/png', buffer: png });
  await t('asset-assets/hero.png').waitFor();
  check('Import a real image', true, `${png.length} bytes`);

  // 6. Give the sprite the image
  await t('tree-Sprite2D').click();
  await t('prop-texture').selectOption('assets/hero.png');
  check('Assign the image to the sprite', (await t('node-code').innerText()).includes('texture: "assets/hero.png"'));

  // 7. Attach JavaScript to Player, from the template, and edit it
  await t('tree-Player').click();
  await t('prop-position-x').fill('200'); await t('prop-position-x').press('Enter');
  await t('prop-position-y').fill('160'); await t('prop-position-y').press('Enter');
  await t('new-script').click();
  await page.locator('.monaco-editor').waitFor();
  await page.waitForTimeout(800);
  const source = [
    'export default class Player extends CharacterBody2D {',
    '  speed = 300;',
    '',
    '  ready() {',
    '    console.log("Player ready at", this.position.x);',
    '  }',
    '',
    '  physicsUpdate(dt) {',
    "    this.velocity = input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed);",
    '    this.moveAndSlide();',
    '  }',
    '}',
    '',
  ].join('\n');
  // Paste it in over the template, as a learner pastes a snippet (typing would fight the editor's auto-closing brackets).
  await page.evaluate((text) => navigator.clipboard.writeText(text), source);
  await page.locator('.monaco-editor').click();
  await page.keyboard.press('ControlOrMeta+A');
  await page.keyboard.press('ControlOrMeta+V');
  await page.keyboard.press('ControlOrMeta+S');
  await page.waitForTimeout(300);
  check('Attach JavaScript and edit it', (await t('script-editor').innerText()).includes('saved'));

  // 8. Run, and move the player with the input API
  await t('run-project').click();
  const frame = page.locator('iframe[title="Running game"]');
  await frame.waitFor({ timeout: 20000 });
  try { await page.getByText('Player ready at 200').waitFor({ timeout: 20000 }); }
  catch (e) { console.log('Output was:', await t('panel-output').innerText()); throw e; }
  check('Run in the sandboxed runtime', true, 'ready() logged to Output');
  await t('tree-Player').click();
  await frame.click();
  await page.keyboard.down('ArrowRight'); await page.waitForTimeout(600); await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(400);
  const live = await t('inspector').locator('span[title^="The value in the running game"]').first().innerText();
  const liveX = Number(live.split(',')[0]);
  check('Move the sprite with the keys', liveX > 300, `live position ${live}`);

  // 9. Stop: the editor's values are unchanged
  await t('stop').click();
  check('Stop leaves the editor unchanged', (await t('prop-position-x').inputValue()) === '200' && !(await frame.count()));

  // 10. Modify in the editor, undo, redo
  await t('prop-position-x').fill('320'); await t('prop-position-x').press('Enter');
  const after = await t('prop-position-x').inputValue();
  await page.locator('body').click({ position: { x: 5, y: 5 } });
  await page.keyboard.press('ControlOrMeta+Z');
  const undone = await t('prop-position-x').inputValue();
  await page.keyboard.press('ControlOrMeta+Shift+Z');
  const redone = await t('prop-position-x').inputValue();
  check('Modify, undo, redo', after === '320' && undone === '200' && redone === '320', `${after} → ${undone} → ${redone}`);

  // 11. Save, close, reopen
  await page.keyboard.press('ControlOrMeta+S');
  await page.waitForTimeout(500);
  check('Save', (await t('save-state').innerText()) === 'Saved');
  await t('menu-Project').click();
  await t('item-Close project').click();
  await t('projects-dialog').waitFor();
  await t('open-Acceptance').click();
  await t('tree-Player').waitFor();

  // 12. Everything restored
  await t('tree-Player').click();
  const x = await t('prop-position-x').inputValue();
  await t('tree-Sprite2D').click();
  const tex = await t('prop-texture').inputValue();
  const thumb = await t('asset-assets/hero.png').locator('img').count();
  await t('tree-Player').click();
  await t('open-script').click();
  await page.locator('.monaco-editor').waitFor();
  await page.waitForTimeout(500);
  const text = (await page.locator('.monaco-editor .view-lines').innerText()).replace(/\u00a0/g, ' ');   // Monaco shows spaces as non-breaking spaces
  check('Reopen: everything restored', x === '320' && tex === 'assets/hero.png' && thumb === 1 && text.includes('speed = 300'), `x ${x}, texture ${tex}, image ${thumb ? 'shown' : 'missing'}, script ${text.includes('speed = 300') ? 'restored' : 'missing'}`);

  // 13. And it still runs, from the saved project
  await t('run-project').click();
  await page.getByText('Player ready at 320').waitFor({ timeout: 20000 });
  check('The reopened project runs', true);
  await t('stop').click();

  // A picture of the end state, only when asked for: SCREENSHOT=/some/where.png
  if (process.env.SCREENSHOT) await page.screenshot({ path: process.env.SCREENSHOT });
});
process.exit(failed ? 1 : 0);
