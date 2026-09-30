// Shared by Game Studio's browser tests: start a dev server on its own port, open a
// fresh browser profile at Game Studio, record checks, and always clean up.
import { spawn } from 'node:child_process';
import { chromium } from 'playwright';

export async function withGameStudio(port, body) {
  const results = [];
  const check = (name, ok, detail = '') => { results.push({ name, ok }); console.log(`${ok ? '✓' : '✗'} ${name}${detail ? `  (${detail})` : ''}`); };
  const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
  const stopServer = () => { try { process.kill(-server.pid); } catch { /* already gone */ } };
  process.on('exit', stopServer);
  let browser;
  try {
    for (let i = 0; ; i++) {
      try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch { /* not yet */ }
      if (i > 90) throw new Error('The dev server did not start');
      await new Promise((r) => setTimeout(r, 1000));
    }
    browser = await chromium.launch();
    const context = await browser.newContext({ viewport: { width: 1500, height: 950 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await context.newPage();
    const pageErrors = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    page.on('dialog', (d) => d.accept());
    await page.goto(`http://localhost:${port}/#/lab/game-studio`);
    await page.getByTestId('projects-dialog').waitFor({ timeout: 60000 });
    const max = page.locator('button[title="Maximize"]');
    if (await max.count()) await max.first().click();
    const skip = page.getByRole('button', { name: 'Skip' });
    if (await skip.count()) await skip.first().click().catch(() => {});
    await body({ page, t: (id) => page.getByTestId(id), check });
    check('No page errors', pageErrors.length === 0, pageErrors.join(' | '));
  } catch (e) {
    check('The test ran to the end', false, e instanceof Error ? e.message.split('\n')[0] : String(e));
  } finally {
    await browser?.close();
    stopServer();
  }
  const failed = results.filter((r) => !r.ok).length;
  console.log(`\n${results.length - failed}/${results.length} passed`);
  return failed;
}
