// Temporary: renders every Help section and checks the corrected content. Deleted after the run.
import { chromium } from 'playwright'

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
page.setDefaultNavigationTimeout(180000)
const errors = []
page.on('pageerror', e => errors.push(e.message.slice(0, 120)))
await page.addInitScript(() => { localStorage.setItem('oc-tour-seen', '1'); localStorage.removeItem('oc-help-section') })
await page.goto('http://localhost:5317/#/about')
await page.locator('[data-tour="report-bug"]').first().waitFor({ timeout: 180000 })
await page.evaluate(() => window.dispatchEvent(new CustomEvent('oc-toggle-help')))
await page.getByText('What would you like to do?').waitFor({ timeout: 60000 })

const nav = page.locator('nav.w-64 button')
const n = await nav.count()
let all = ''
for (let i = 0; i < n; i++) {
  await nav.nth(i).dispatchEvent('click')
  await page.waitForTimeout(600)
  // Lesson Types has sub-tabs: open each so all its content is checked.
  const sub = page.locator('div.max-w-4xl.mx-auto button', { hasText: /Math \/ Calculus|Python \/ Code|Proof \/ Geometry|Web \/ JavaScript|Science \/ ScienceNotebook/ })
  const subs = await sub.count()
  if (subs) for (let k = 0; k < subs; k++) { await sub.nth(k).dispatchEvent('click'); await page.waitForTimeout(250); all += '\n' + await page.locator('div.max-w-4xl.mx-auto').last().innerText() }
  // AI Prompts has one prompt per tab, and Formatting has three tabs.
  const tabs = page.locator('div.max-w-4xl.mx-auto button', { hasText: /^(Math Lesson|JS Notebook Lesson|New Viz Component|New Course|Rules & Examples|Which Renderer\?|LaTeX Cheat Sheet)$/ })
  const tc = await tabs.count()
  if (tc) for (let k = 0; k < tc; k++) { await tabs.nth(k).dispatchEvent('click'); await page.waitForTimeout(250); all += '\n' + await page.locator('div.max-w-4xl.mx-auto').last().innerText() }
  all += '\n' + await page.locator('div.max-w-4xl.mx-auto').last().innerText()
}
const stale = ['80%', 'Viz cell', 'components/viz/react', 'VIZ_REGISTRY', 'ARCHITECTURE.md', 'always print', 'calloutType', 'Schema E', 'Add Cell', 'Register in VizFrame', 'available globally', 'defaultN', 'collapses to a space', 'Two paths', 'Export as .js file', 'CONTRIBUTING.md', '2-derivatives/005']
for (const s of stale) console.log((all.includes(s) ? 'STILL SHOWN  ' : 'gone         ') + s)
const present = ['Lesson Sections', '🔨 Edit in Builder', 'answered correctly', 'src/courses/calculus/3-derivatives/005-chain-rule.js', "kind: 'insight'", "import * as d3 from 'd3'", '\\\\angle B', 'ContinuityViz']
for (const s of present) console.log((all.includes(s) ? 'shown        ' : 'MISSING      ') + s)
console.log('sections visited:', n, ' page errors:', errors.length, errors.slice(0, 2).join(' | '))
await browser.close()
