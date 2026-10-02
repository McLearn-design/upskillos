// The course and Game Studio round the loop, through the real app: a lesson of "Learn to Program by
// Making Games" shows its Try it card (the task's steps, with their pictures); the button opens Game
// Studio with the task; finishing it marks the lesson's checkpoint; "Back to the lesson" returns to the
// lesson, whose card now says Done.
//
//   node src/labs/game-studio/e2e/course.acceptance.mjs   (starts and stops its own server)

import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { withGameStudio } from './harness.mjs';

// Every lesson of the course, with the task its Try it card opens (none for the bonus lesson).
const COURSE = fileURLToPath(new URL('../../../courses/making-games/', import.meta.url));
const ALL = readdirSync(COURSE).filter((d) => /^\d+-/.test(d)).sort((a, b) => parseInt(a) - parseInt(b)).flatMap((chapter) => readdirSync(COURSE + chapter).filter((f) => f.endsWith('.js')).sort().map((f) => {
  const text = readFileSync(`${COURSE}${chapter}/${f}`, 'utf8');
  return { route: `/chapter/making-games-${parseInt(chapter)}/${f.replace(/^\d+-/, '').replace(/\.js$/, '')}`, task: text.match(/task: '([a-z-]+)'/)?.[1] ?? null };
}));

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

  // Every lesson opens and shows its Try it card, with no errors on the page.
  const bad = [];
  for (const l of ALL) {
    await page.goto(page.url().replace(/#.*$/, `#${l.route}`));
    await page.getByText('Conceptual Intuition').first().waitFor({ timeout: 20000 }).catch(() => bad.push(`${l.route}: did not load`));
    if (l.task) {
      const card = page.getByTestId(`try-it-${l.task}`);
      for (let i = 0; i < 12 && !(await card.count()); i++) { await page.mouse.wheel(0, 1500); await page.waitForTimeout(150); }
      if (!(await card.count())) bad.push(`${l.route}: no Try it card for ${l.task}`);
    }
    if (await page.getByText('failed to render').count()) bad.push(`${l.route}: a block failed to render`);
  }
  check(`All ${ALL.length} lessons open, each with its Try it card`, bad.length === 0 && ALL.length >= 33, bad.join(' | '));
}, { hash: `#${LESSON}`, ready: 'try-it-first-sprite' });
process.exit(failed ? 1 : 0);
