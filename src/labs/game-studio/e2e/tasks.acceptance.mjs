// Game Studio's tasks: the course's "Try it" loop (docs/game-studio-course-plan.md).
// A lesson-style link opens a task; doing its steps in the editor ticks them off (project, editor
// and play checks, the last running the learner's own scripts in a worker); finishing marks the
// lesson's checkpoint and "Back to the lesson" goes back. Then Help › Tutorials, a script task done
// by typing, "Next task", and "Show me".
//
//   node src/labs/game-studio/e2e/tasks.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const HERO = 'assets/pixel-platformer/characters/tile_0000.png';
const link = '#/lab/game-studio?task=first-sprite&from=%2F&lesson=test-lesson&checkpoint=cp-test-1';
const failed = await withGameStudio(5186, async ({ page, t, check, answer }) => {
  const done = (i) => page.locator(`[data-testid="task-step-${i}"][data-done="yes"]`).waitFor({ timeout: 8000 }).then(() => true, () => false);
  check('A lesson’s link opens the task, with its steps', (await t('task-step-0').getAttribute('data-done')) === 'no' && (await t('task-panel').innerText()).includes('Put a character on the screen'));

  // Step by step in the editor, each ticked when Game Studio sees it.
  await t('add-node').selectOption('Sprite2D');
  const s0 = await done(0);
  await t('tree-Sprite2D').click();
  await t('prop-texture').selectOption(HERO);
  const s1 = await done(1);
  await t('tree-Sprite2D').dblclick(); await t('rename-input').fill('Hero'); await t('rename-input').press('Enter');
  const s2 = await done(2);
  await t('tree-Hero').click();
  await t('prop-position-x').fill('480'); await t('prop-position-x').press('Enter');
  await t('prop-position-y').fill('270'); await t('prop-position-y').press('Enter');
  const s3 = await done(3);
  check('Each step ticks off as it is done in the editor', s0 && s1 && s2 && s3, `${[s0, s1, s2, s3].map((x) => (x ? '✓' : '·')).join(' ')}`);

  // Finished: the lesson's checkpoint is marked, and Back goes to the lesson.
  await t('task-finished').waitFor({ timeout: 5000 });
  const marked = await page.evaluate(() => Object.keys(localStorage).some((k) => (localStorage.getItem(k) ?? '').includes('cp-test-1')));
  check('Finishing marks the lesson’s checkpoint in the app’s progress', marked);
  await t('task-back').click();
  await page.waitForFunction(() => window.location.hash === '#/', null, { timeout: 5000 }).catch(() => {});
  check('"Back to the lesson" returns to the lesson’s route', await page.evaluate(() => window.location.hash) === '#/');

  // Help › Tutorials: the script task, done by typing a script (play checks run it in a worker).
  await page.goto(page.url().replace(/#.*$/, '#/lab/game-studio'));
  await t('menu-Help').waitFor({ timeout: 60000 });
  if (await t('dialog-close').count()) await t('dialog-close').click();
  await t('menu-Help').click(); await t('item-Tutorials…').click();
  await t('tutorial-first-script').click();
  await answer('discard');
  await t('task-panel').waitFor();
  await t('tree-Hero').click();
  await t('new-script').click();
  await page.locator('.monaco-editor').waitFor();
  const n0 = await done(0);
  await page.waitForTimeout(600);
  const source = 'export default class Hero extends Sprite2D {\n  speed = 100;\n\n  update(dt) {\n    this.position = { x: this.position.x + this.speed * dt, y: this.position.y };\n  }\n}\n';
  await page.evaluate((text) => navigator.clipboard.writeText(text), source);
  await page.locator('.monaco-editor').click();
  await page.keyboard.press('ControlOrMeta+A'); await page.keyboard.press('ControlOrMeta+V');   // not saved: checks read the text as typed
  const n1 = await done(1), n2 = await done(2);
  check('A script typed in the editor passes the play checks (moving, 100 px/s at any frame rate), checked as typed, before saving', n0 && n1 && n2, `${[n0, n1, n2].map((x) => (x ? '✓' : '·')).join(' ')}`);

  // In a tutorial, finishing offers the next task; "Show me" finishes it.
  await t('task-next').click();
  await page.locator('[data-testid="task-panel"]').getByText('Steer Hero with the keyboard').waitFor();
  await t('task-show-me').click();
  await answer('yes');
  await t('task-finished').waitFor({ timeout: 10000 }).catch(() => {});
  check('"Next task" goes on in the tutorial, and "Show me" completes a task', (await t('task-finished').count()) === 1);

  // Help › Tutorials lists every chain; Physics' first steps done in the editor, as its steps say.
  const startTutorial = async (id) => { await t('menu-Help').click(); await t('item-Tutorials…').click(); await t(`tutorial-${id}`).scrollIntoViewIfNeeded(); await t(`tutorial-${id}`).click(); await answer('discard'); await t('task-panel').waitFor(); };
  await t('menu-Help').click(); await t('item-Tutorials…').click();
  const listed = await page.locator('[data-testid^="tutorial-"]').count();
  const bottom = await page.evaluate(() => { const d = document.querySelector('[data-testid="tutorials-dialog"]').getBoundingClientRect(); return d.bottom <= window.innerHeight; });
  await t('tutorial-tiled-map').scrollIntoViewIfNeeded();
  const lastVisible = await t('tutorial-tiled-map').isVisible();
  check('The Tutorials dialog fits the window, and scrolls to the last task', bottom && lastVisible);
  await t('dialog-close').click();
  await startTutorial('stop-at-walls');
  await t('tree-Main').click();
  await t('add-node').selectOption('CharacterBody2D');
  await t('tree-CharacterBody2D').dblclick(); await t('rename-input').fill('Player'); await t('rename-input').press('Enter');
  const p0 = await done(0);
  await t('tree-Player').click(); await t('add-node').selectOption('Sprite2D');
  await t('tree-Sprite2D').click(); await t('prop-texture').selectOption(HERO);
  await t('tree-Player').click(); await t('add-node').selectOption('CollisionShape2D');
  const p1 = await done(1);
  await t('tree-Player').click(); await t('new-script').click();
  const p2 = await done(2);
  check(`Help › Tutorials lists the tasks (${listed}); Physics’ first steps tick when done as described, and New script gives a CharacterBody2D arrow-key movement`, listed >= 18 && p0 && p1 && p2, `${[p0, p1, p2].map((x) => (x ? '✓' : '·')).join(' ')}`);

  // The Tiled task, done with the real Import button in Starter art.
  await startTutorial('tiled-map');
  await t('left-art').click();
  await t('starter-pack').selectOption('tiny-dungeon');
  await t('starter-map-sample-map.tmx').click();
  check('Importing Kenney’s map from Starter art finishes the Tiled task', await done(0));
}, { hash: link, ready: 'task-panel' });
process.exit(failed ? 1 : 0);
