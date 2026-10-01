// Game Studio Phase 3: script errors, found where they are.
// A script that throws while the game runs is reported once, with its file, line and node, and
// the rest of the game keeps running; clicking the error opens the script at that line. A script
// with a syntax error stops Run, and its error (line and column) also opens the script there.
//
//   node src/labs/game-studio/e2e/phase3.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const BROKEN = [
  'export default class Broken extends Node2D {',
  '  frames = 0;',
  '',
  '  update(dt) {',
  '    this.frames += 1;',
  '    if (this.frames === 30) this.notThere();',
  '  }',
  '}',
  '',
].join('\n');
const STEADY = [
  'export default class Steady extends Node2D {',
  '  ready() { this.next = 0; }',
  '  update(dt) {',
  '    if (time.now >= this.next) { console.log("tick", Math.round(time.now * 2)); this.next += 0.5; }',
  '  }',
  '}',
  '',
].join('\n');

const failed = await withGameStudio(5188, async ({ page, t, check }) => {
  const store = (fn) => page.evaluate(fn);
  /** A Node2D with a new script, its text pasted in as a learner pastes a snippet. */
  const nodeWithScript = async (name, source) => {
    await t('tree-Main').click();
    await t('add-node').selectOption('Node2D');
    await t('tree-Node2D').dblclick(); await t('rename-input').fill(name); await t('rename-input').press('Enter');
    await t(`tree-${name}`).click();
    await t('new-script').click();
    await page.locator('.monaco-editor').waitFor();
    await page.waitForTimeout(600);
    await page.evaluate((text) => navigator.clipboard.writeText(text), source);
    await page.locator('.monaco-editor').click();
    await page.keyboard.press('ControlOrMeta+A');
    await page.keyboard.press('ControlOrMeta+V');
    await page.keyboard.press('ControlOrMeta+S');
    await page.waitForTimeout(300);
    await t('file-scenes/main.scene').click();
  };
  const cursor = () => store(() => { const ed = window.__gameStudioMonaco.editor.getEditors().find((e) => e.hasWidgetFocus() || e.getModel()); const p = ed.getPosition(); return { path: ed.getModel().uri.path, line: p.lineNumber, column: p.column }; });

  await t('new-project-name').fill('Errors');
  await t('create-project').click();
  await t('new-scene').click(); await t('new-scene-name').fill('main'); await t('new-scene-name').press('Enter');
  await nodeWithScript('Broken', BROKEN);
  await nodeWithScript('Steady', STEADY);

  // Run: Broken throws on its 30th frame; Steady carries on.
  await t('run-project').click();
  await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 });
  await page.waitForFunction(() => window.__gameStudio.store.output.some((o) => o.level === 'error'), null, { timeout: 20000 });
  const ticksAtError = await store(() => window.__gameStudio.store.output.filter((o) => o.text.startsWith('tick')).length);
  await page.waitForTimeout(1500);
  const out = await store(() => window.__gameStudio.store.output.map((o) => ({ level: o.level, text: o.text, file: o.file, line: o.line, node: o.node })));
  const errors = out.filter((o) => o.level === 'error');
  const ticksLater = out.filter((o) => o.text.startsWith('tick')).length;
  check('A run-time error is reported once, with its file, line and node', errors.length === 1 && errors[0].file === 'scripts/broken.js' && errors[0].line === 6 && errors[0].node === 'Broken' && /notThere/.test(errors[0].text),
    errors.map((e) => `${e.file}:${e.line} ${e.text} (node ${e.node})`).join(' | '));
  check('The rest of the game keeps running', ticksLater >= ticksAtError + 2, `ticks ${ticksAtError} → ${ticksLater}`);

  // Click the error: the script opens at that line.
  const errorRow = out.findIndex((o) => o.level === 'error');
  await t('stop').click();
  await t(`output-${errorRow}`).click();
  await page.waitForTimeout(800);
  let c = await cursor();
  check('Clicking the error opens the script at its line', c.path === '/scripts/broken.js' && c.line === 6, `${c.path}:${c.line}`);

  // A syntax error: Run refuses, and says where.
  // Typed into the open script (Run saves open scripts first).
  await store(() => window.__gameStudio.store.editScript('scripts/broken.js', 'export default class Broken extends Node2D {\n  update(dt) {\n    const x = (1 + ;\n  }\n}\n'));
  await t('file-scenes/main.scene').click();
  await t('run-project').click();   // each Run starts Output afresh
  await page.waitForTimeout(800);
  const syntax = (await store(() => window.__gameStudio.store.output)).filter((o) => o.level === 'error');
  const running = await store(() => !!window.__gameStudio.store.running);
  check('A syntax error stops Run and gives its line and column', !running && syntax.length >= 1 && syntax[0].file === 'scripts/broken.js' && syntax[0].line === 3, syntax.map((e) => `${e.file}:${e.line}:${e.column} ${e.text}`).join(' | '));
  const row = (await store(() => window.__gameStudio.store.output)).findIndex((o) => o.level === 'error');
  await t(`output-${row}`).click();
  await page.waitForTimeout(800);
  c = await cursor();
  check('Clicking it opens the script there, at the line and column', c.path === '/scripts/broken.js' && c.line === 3 && c.column === syntax[0]?.column, `${c.path}:${c.line}:${c.column}`);
});
process.exit(failed ? 1 : 0);
