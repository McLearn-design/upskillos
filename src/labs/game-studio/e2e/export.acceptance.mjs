// Phase 8, export: the game runs without the editor, and a project moves between browsers.
//   Breakout, exported for a website, is unzipped under a subpath (as GitHub Pages serves a project
//   site) on a plain static server, and plays there with no editor;
//   the one-file export plays opened straight from disk (file://);
//   the project .zip, imported, gives back the same project.
//
//   node src/labs/game-studio/e2e/export.acceptance.mjs   (starts and stops its own servers)

import { createServer } from 'node:http';
import { mkdirSync, mkdtempSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, extname, dirname } from 'node:path';
import { pathToFileURL } from 'node:url';
import { unzipSync } from 'fflate';
import { withGameStudio } from './harness.mjs';

const TMP = mkdtempSync(join(tmpdir(), 'game-studio-export-'));
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.png': 'image/png' };

/** A plain static file server, as any web host is: no knowledge of Game Studio. */
function serve(root, port) {
  const server = createServer((req, res) => {
    let path = join(root, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (existsSync(path) && statSync(path).isDirectory()) path = join(path, 'index.html');
    if (!existsSync(path)) { res.writeHead(404); res.end('not found'); return; }
    res.writeHead(200, { 'content-type': TYPES[extname(path)] ?? 'application/octet-stream' });
    res.end(readFileSync(path));
  });
  return new Promise((ok) => server.listen(port, () => ok(server)));
}

/** Open a page and see the game start: the runtime says "running", a canvas is drawn, and nothing fails. */
async function playsAlone(context, url) {
  const page = await context.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  // The runtime reports to its parent; with no editor, its own window hears it.
  await page.addInitScript(() => { window.__running = false; addEventListener('message', (e) => { if (e.data?.type === 'running') window.__running = true; }); });
  await page.goto(url);
  const running = await page.waitForFunction(() => window.__running, null, { timeout: 20000 }).then(() => true, () => false);
  const canvas = await page.locator('#game canvas').boundingBox().catch(() => null);
  await page.keyboard.press('Space'); await page.waitForTimeout(500);
  const shot = join(TMP, `${url.startsWith('file:') ? 'file' : 'site'}.png`);
  await page.screenshot({ path: shot });
  await page.close();
  return { running, canvas: !!canvas && canvas.width > 100, errors, shot };
}

const failed = await withGameStudio(5187, async ({ page, t, check }) => {
  await t('example-breakout').click();
  await t('guide').waitFor({ timeout: 30000 });
  const download = async (item) => {
    await t('menu-Project').click();
    const [d] = await Promise.all([page.waitForEvent('download'), t(`item-${item}`).click()]);
    const path = join(TMP, d.suggestedFilename());
    await d.saveAs(path);
    return path;
  };

  // ── the game for a website, under a subpath ──
  const zipPath = await download('Export game for a website (.zip)…');
  const files = unzipSync(new Uint8Array(readFileSync(zipPath)));
  const site = join(TMP, 'site', 'my-games', 'breakout');
  for (const [name, bytes] of Object.entries(files)) { mkdirSync(dirname(join(site, name)), { recursive: true }); writeFileSync(join(site, name), bytes); }
  const names = Object.keys(files);
  check('The website export is index.html, game.js, project.json and the images it uses', ['index.html', 'game.js', 'project.json'].every((n) => names.includes(n)) && names.some((n) => n.startsWith('assets/')), names.join(', '));
  const server = await serve(join(TMP, 'site'), 5188);
  const web = await playsAlone(page.context(), 'http://localhost:5188/my-games/breakout/');
  server.close();
  check('Unzipped under a subpath on a plain static server, it plays with no editor', web.running && web.canvas && web.errors.length === 0, `${JSON.stringify(web)}`);

  // ── one file, opened from disk ──
  const htmlPath = await download('Export game as one file (.html)…');
  const file = await playsAlone(page.context(), pathToFileURL(htmlPath).href);
  check('The one-file export plays opened straight from disk', file.running && file.canvas && file.errors.length === 0, `${JSON.stringify(file)}`);

  // ── the project, out and back in ──
  const before = await page.evaluate(() => JSON.stringify(window.__gameStudio.store.project));
  const projectPath = await download('Export project (.zip)…');
  await t('import-project-file').setInputFiles(projectPath);
  await page.getByTestId('answer-discard').click({ timeout: 3000 }).catch(() => {});
  await page.waitForFunction((old) => { const s = window.__gameStudio.store; return s.project && s.projectId && JSON.stringify(s.project) === old; }, before, { timeout: 15000 }).catch(() => {});
  const after = await page.evaluate(() => ({ project: JSON.stringify(window.__gameStudio.store.project), images: window.__gameStudio.store.images.size, assets: window.__gameStudio.store.project.assets.length }));
  check('Export project, then Import project: the same project opens, with every image', after.project === before && after.images === after.assets, `images ${after.images} of ${after.assets}`);
}, { ready: 'example-breakout' });
console.log(`(exports and screenshots in ${TMP})`);
process.exit(failed ? 1 : 0);
