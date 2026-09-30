// Game Studio: the API reference, and the script editor's help from the same source.
// Opens Coin Run, then: F1 shows the reference; an entry, a search and the Inspector's
// links reach the right places; in the script editor, hover shows the reference's words,
// the example scripts have no underlined problems, and a misspelt method is underlined.
//
//   node src/labs/game-studio/e2e/reference.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5193, async ({ page, t, check }) => {
  await t('example-coin-run').click();
  await t('guide').waitFor({ timeout: 30000 });

  // 1. F1 opens the contents; an entry lists its members.
  await page.locator('body').press('F1');
  await t('reference').waitFor();
  check('F1 opens the API reference', await t('ref-open-CharacterBody2D').isVisible());
  await t('ref-open-CharacterBody2D').click();
  const entry = t('ref-entry-CharacterBody2D');
  check('An entry shows its methods, with Godot’s names', (await entry.innerText()).includes('isOnFloor(): boolean') && (await entry.innerText()).includes('is_on_floor()'));
  check('It shows the Inspector properties it has too', (await t('ref-member-collisionMask').innerText()).includes('Inspector'));

  // 2. Search by Godot's name finds the method, and opens it highlighted.
  await t('reference-search').fill('move_and_slide');
  await t('ref-hit-CharacterBody2D#moveAndSlide').click();
  await page.waitForTimeout(200);
  check('Searching a Godot name finds the method', await t('ref-member-moveAndSlide').isVisible());

  // 3. From the Inspector: the node's type and the types it extends are links.
  await t('tree-Player').click();
  await t('inspector-ref-Node2D').click();
  check('The Inspector links to the reference', await t('ref-entry-Node2D').isVisible(), 'Node2D');

  // 4. The script editor: hover shows the reference's text; the example has no problems.
  await t('file-scripts/coin.js').click();
  await page.locator('.monaco-editor').waitFor();
  await page.waitForFunction(() => window.__gameStudioMonaco?.editor.getEditors().length > 0, null, { timeout: 20000 });
  await page.waitForTimeout(2500);   // the TypeScript worker starts
  const hover = await page.evaluate(async () => {
    const ed = window.__gameStudioMonaco.editor.getEditors()[0], model = ed.getModel();
    const at = model.getPositionAt(model.getValue().indexOf('queueFree') + 2);
    ed.setPosition(at); ed.focus();
    ed.trigger('test', 'editor.action.showHover', {});
    for (let i = 0; i < 50; i++) { const h = document.querySelector('.monaco-hover-content'); if (h && h.textContent.includes('queueFree')) return h.textContent; await new Promise((r) => setTimeout(r, 100)); }
    return document.querySelector('.monaco-hover-content')?.textContent ?? '(no hover)';
  });
  check('Hover shows the reference’s words (and Node is the engine’s, not the browser’s)', hover.includes('end of the frame') && hover.includes('queue_free'), hover.slice(0, 120));
  const markers = async () => page.evaluate(() => window.__gameStudioMonaco.editor.getModelMarkers({}).filter((m) => m.resource.path.endsWith('coin.js') && m.severity >= 4).map((m) => m.message));
  let problems = [];
  for (let i = 0; i < 20; i++) { await page.waitForTimeout(250); problems = await markers(); }
  check('The example script has nothing underlined', problems.length === 0, problems.join(' | '));
  await page.evaluate(() => {
    const ed = window.__gameStudioMonaco.editor.getEditors()[0], model = ed.getModel();
    model.setValue(model.getValue().replace('this.queueFree()', 'this.queueFre()'));
  });
  for (let i = 0; i < 40 && !problems.some((m) => m.includes('queueFre')); i++) { await page.waitForTimeout(250); problems = await markers(); }
  check('A misspelt method is underlined before running', problems.some((m) => m.includes('queueFre')), problems.join(' | '));
  await page.evaluate(() => { const m = window.__gameStudioMonaco.editor.getEditors()[0].getModel(); m.setValue(m.getValue().replace('this.queueFre()', 'this.queueFree()')); });

  // 5. The script editor's own link opens the reference.
  console.log('reference is', await page.evaluate(() => JSON.stringify(window.__gameStudio.store.reference)));
  await page.locator('[title="Close the reference"]').click();
  await t('script-reference').click();
  check('The script editor links to the reference', await t('reference').isVisible());
});
process.exit(failed ? 1 : 0);
