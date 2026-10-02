import { spawn } from 'node:child_process';
import { chromium } from 'playwright';
import { getLatestWhatsNewId } from './src/data/whatsNew.js';
const [out, slug, title, passText, ...expect] = process.argv.slice(2);
const port = 5191;
const server = spawn('npx', ['vite', '--port', String(port), '--strictPort'], { stdio: 'ignore', detached: true });
const stop = () => { try { process.kill(-server.pid); } catch {} };
process.on('exit', stop);
let browser;
try {
  for (let i = 0; ; i++) { try { if ((await fetch(`http://localhost:${port}/`)).ok) break; } catch {} if (i > 90) throw new Error('no server'); await new Promise((r) => setTimeout(r, 1000)); }
  browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1400, height: 1000 } });
  await ctx.addInitScript((w) => { try { localStorage.setItem('oc-tour-seen', '1'); localStorage.setItem('oc-whatsnew-last-seen', w); } catch {} }, getLatestWhatsNewId());
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', (e) => errs.push(e.message));
  await page.goto(`http://localhost:${port}/#/chapter/modelling-geometry-1/${slug}`);
  await page.getByText(title).first().waitFor({ timeout: 90000 });
  await page.waitForTimeout(1000);
  const stray = await page.evaluate(() => { const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT); const o = []; let n; while ((n = w.nextNode())) { const t = n.textContent; if ((t.includes('$') || /\\(text|mathbf|times|frac)/.test(t)) && !n.parentElement.closest('.monaco-editor, .katex, script, style, textarea')) o.push(t.slice(0, 80)); } return o; });
  console.log(stray.length ? 'STRAY maths: ' + stray.join(' | ') : '✓ no stray maths', '· katex errors', await page.locator('.katex-error').count());
  const runs = page.getByRole('button', { name: '▶ Run' });
  const n = await runs.count(); console.log('cells with Run', n);
  for (let i = 0; i < n; i++) { await runs.nth(i).scrollIntoViewIfNeeded(); await runs.nth(i).click(); await page.waitForTimeout(3500); }
  const text = await page.locator('body').innerText();
  for (const s of expect) console.log(text.includes(s) ? '✓' : '✗', s);
  const frames = page.locator('iframe');
  for (let i = 0; i < await frames.count(); i++) { const box = await frames.nth(i).boundingBox(); if (box && box.height > 200) { await frames.nth(i).scrollIntoViewIfNeeded(); await frames.nth(i).screenshot({ path: `${out}/pic-${slug}-${i}.png` }); console.log('picture', i); } }
  await page.getByRole('button', { name: 'Show solution' }).first().click(); await runs.nth(n - 1).click(); await page.waitForTimeout(3500);
  console.log((await page.locator('body').innerText()).includes(passText) ? '✓ solution passes' : '✗ solution pass text missing');
  for (const kind of ['project', 'challenge']) {
    const close = page.locator('button[title="Close"]'); if (await close.count()) { await close.first().click().catch(() => {}); await page.waitForTimeout(500); }
    const a = page.locator(`a[href*="mesh-lab?${kind}="]`).first();
    await a.scrollIntoViewIfNeeded(); await a.click(); await page.waitForTimeout(8000);
    console.log(kind, await a.getAttribute('href'), '→', await page.evaluate(() => location.hash));
    await page.screenshot({ path: `${out}/ml-${slug}-${kind}.png` });
  }
  console.log('errors', errs.length ? errs.join(' | ') : 'none');
} catch (e) { console.log('FAILED', e.message.split('\n')[0]); } finally { await browser?.close(); stop(); }
