import { chromium } from 'playwright'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
page.setDefaultNavigationTimeout(180000)
await page.addInitScript(() => localStorage.setItem('oc-tour-seen', '1'))
await page.goto('http://localhost:5317/#/chapter/zz-figure-test-1/figure-test')
const run = page.locator('button', { hasText: /^\s*▶?\s*Run\s*$/ })
await run.first().waitFor({ timeout: 180000 })
const n = await run.count()
for (let i = 0; i < n; i++) { await run.nth(i).dispatchEvent('click'); await page.waitForTimeout(i === 0 ? 30000 : 6000) }
const body = await page.locator('body').innerText()
console.log(JSON.stringify({ cells: n, rawJsonShown: body.includes('opencalc_figure'), keptBefore: body.includes('before the figure'), keptAfter: body.includes('after the figure') }))
await page.screenshot({ path: process.env.SHOT_DIR + '/fig-test2.png', fullPage: true })
await browser.close()
