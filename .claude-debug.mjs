import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
page.setDefaultNavigationTimeout(180000)
const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 160)))
await page.addInitScript(() => { localStorage.setItem('oc-tour-seen', '1'); localStorage.removeItem('oc-help-section') })
await page.goto('http://localhost:5317/#/about')
await page.locator('[data-tour="report-bug"]').first().waitFor({ timeout: 180000 })
await page.evaluate(() => window.dispatchEvent(new CustomEvent('oc-toggle-help')))
await page.getByText('What would you like to do?').waitFor({ timeout: 60000 })
const nav = page.locator('nav.w-64 button')
const n = await nav.count()
for (let i = 0; i < n; i++) {
  const label = (await nav.nth(i).innerText()).trim()
  await nav.nth(i).dispatchEvent('click'); await page.waitForTimeout(700)
  const ok = await page.locator('div.max-w-4xl.mx-auto').count()
  console.log(label.padEnd(22), ok ? 'renders' : 'GONE', errors.length ? 'error: ' + errors.at(-1) : '')
  if (!ok) break
}
await browser.close()
