// The course and Game Studio round the loop, through the real app: a lesson of "Learn to Program by
// Making Games" shows its Try it card (the task's steps, with their pictures); the button opens Game
// Studio with the task; finishing it marks the lesson's checkpoint; "Back to the lesson" returns to the
// lesson, whose card now says Done.
//
//   node src/labs/game-studio/e2e/course.acceptance.mjs   (starts and stops its own server)

import { withGameStudio } from './harness.mjs';

const LESSON = '/chapter/making-games-1/scenes-nodes-and-positions';

const failed = await withGameStudio(5185, async ({ page, t, check }) => {
  const card = t('try-it-first-sprite');
  await card.scrollIntoViewIfNeeded();
  const pictures = await card.locator('img').count();
  const loaded = await card.locator('img').first().evaluate((img) => img.decode().then(() => img.naturalWidth > 0, () => false));
  check('The lesson shows its Try it card: the task, each step, and a picture of each step done', pictures === 4 && loaded, `${pictures} pictures`);

  await t('try-it-open-first-sprite').click();
  await t('task-panel').waitFor({ timeout: 30000 });
  const link = await page.evaluate(() => window.__gameStudio.store.task?.link ?? null);
  check('Its button opens Game Studio with the task, carrying the lesson and checkpoint', link?.task === 'first-sprite' && link.from === '/chapter/making-games-1/scenes-nodes-and-positions' && link.lesson === 'making-games::mg1-001' && link.checkpoint === 'cp-mg1-001-4', JSON.stringify(link));

  await page.evaluate(() => window.__gameStudio.store.showSolution());
  await t('task-finished').waitFor({ timeout: 15000 });
  await t('task-back').click();
  await page.waitForFunction((route) => window.location.hash.startsWith(`#${route}`), LESSON, { timeout: 10000 });
  await t('try-it-first-sprite').waitFor({ timeout: 15000 });
  await page.getByTestId('try-it-first-sprite').getByText('✓ Done').waitFor({ timeout: 5000 }).then(() => {}, () => {});
  const done = await page.getByTestId('try-it-first-sprite').getByText('✓ Done').count();
  check('Finishing it and pressing Back to the lesson returns to the lesson, where the card says Done', done === 1);
}, { hash: `#${LESSON}`, ready: 'try-it-first-sprite' });
process.exit(failed ? 1 : 0);
