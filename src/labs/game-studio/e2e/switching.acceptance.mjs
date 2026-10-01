// Game Studio: switching projects always works, and never loses work without asking.
// With an example open, unsaved, and its game running: creating a project asks (inside the editor,
// not a browser box); Cancel keeps everything; "Continue without saving" switches and stops the
// game; "Save, then continue" saves first. Starting a tutorial while running switches too.
//
//   node src/labs/game-studio/e2e/switching.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const failed = await withGameStudio(5183, async ({ page, t, check, answer }) => {
  const state = () => page.evaluate(() => { const s = window.__gameStudio.store; return { name: s.project?.name, running: !!s.running, question: s.question?.text ?? null, task: s.task?.def.id ?? null }; });
  const runIt = async () => { await t('run-project').click(); await page.locator('iframe[title="Running game"]').waitFor({ timeout: 20000 }); };
  const create = async (name) => { await t('menu-Project').click(); await t('item-Projects and examples…').click(); await t('new-project-name').fill(name); await t('create-project').click(); };

  await t('example-coin-run').click();
  await t('guide').waitFor({ timeout: 30000 });
  await runIt();

  await create('Fresh');
  let s = await state();
  check('With unsaved changes, creating a project asks first, in the editor', !!s.question && (await t('question').isVisible()), s.question);
  await answer('cancel');
  s = await state();
  check('Cancel keeps the open project, still running', s.name === 'Coin Run' && s.running && !s.question);

  await t('dialog-close').click().catch(() => {});
  await create('Fresh');
  await answer('discard');
  await page.waitForFunction(() => window.__gameStudio.store.project?.name === 'Fresh', null, { timeout: 5000 }).catch(() => {});
  s = await state();
  check('"Continue without saving" opens the new project and stops the old game', s.name === 'Fresh' && !s.running && (await t('game-box').isHidden()), JSON.stringify(s));

  // Save, then continue: the example is saved before the switch.
  await t('menu-Project').click(); await t('item-Projects and examples…').click();
  await t('example-breakout').click();
  await page.waitForFunction(() => window.__gameStudio.store.project?.name === 'Breakout', null, { timeout: 15000 });
  await runIt();
  await create('Second');
  await answer('save');
  await page.waitForFunction(() => window.__gameStudio.store.project?.name === 'Second', null, { timeout: 5000 }).catch(() => {});
  await t('menu-Project').click(); await t('item-Projects and examples…').click();
  const listed = await t('open-Breakout').waitFor({ timeout: 5000 }).then(() => true, () => false);   // the saved list loads after the dialog opens
  await t('dialog-close').click().catch(() => {});
  check('"Save, then continue" saves the old project, then opens the new one', (await state()).name === 'Second' && listed, `saved list has Breakout: ${listed}`);

  // A tutorial while a game runs (the new project needs a scene to run).
  await page.evaluate(() => window.__gameStudio.store.createScene('scenes/main.scene'));
  await runIt();
  await t('menu-Help').click(); await t('item-Tutorials…').click();
  await t('tutorial-first-sprite').click();
  await answer('discard');
  await t('task-panel').waitFor({ timeout: 10000 }).catch(() => {});
  s = await state();
  check('Starting a tutorial while a game runs stops it and opens the task', s.task === 'first-sprite' && !s.running, JSON.stringify(s));
});
process.exit(failed ? 1 : 0);
