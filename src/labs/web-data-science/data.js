// Synthetic datasets for the lab. Every one is generated from a fixed seed, so
// each learner sees the same rows and the task checkers can compare answers.
// They are made up to show one idea clearly; none of them is real data.

// mulberry32: a small, fast seeded generator. Same seed, same sequence.
export function rng(seed = 1) {
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  next.normal = (mu = 0, sigma = 1) => {
    const u = 1 - next()
    const v = next()
    return mu + sigma * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v)
  }
  next.int = (lo, hi) => lo + Math.floor(next() * (hi - lo + 1))
  next.pick = (list) => list[Math.floor(next() * list.length)]
  return next
}

const round = (x, d = 1) => Math.round(x * 10 ** d) / 10 ** d

function toCsv(rows) {
  const cols = Object.keys(rows[0])
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s
  }
  return [cols.join(','), ...rows.map((r) => cols.map((c) => esc(r[c])).join(','))].join('\n')
}

// 240 students: how study, sleep and an earlier score relate to an exam.
function students() {
  const r = rng(7)
  const groups = ['A', 'B', 'C']
  const rows = []
  for (let i = 0; i < 240; i++) {
    const group = groups[i % 3]
    const hours = round(Math.max(0, r.normal(group === 'A' ? 6 : group === 'B' ? 4.5 : 3.5, 2)), 1)
    const sleep = round(Math.min(10, Math.max(4, r.normal(7, 1.1))), 1)
    const prior = Math.round(Math.min(100, Math.max(20, r.normal(62, 13))))
    const score = Math.round(Math.min(100, Math.max(0, 8 + 4.2 * hours + 2.1 * sleep + 0.42 * prior + r.normal(0, 7))))
    rows.push({ id: i + 1, group, hours, sleep, prior, score, passed: score >= 60 ? 1 : 0 })
  }
  return toCsv(rows)
}

// A survey export with the usual problems: stray spaces, mixed case, missing
// values written four different ways, thousands separators and duplicates.
function survey() {
  const r = rng(11)
  const cities = ['Leeds', 'leeds ', 'LEEDS', 'York', 'york', 'Hull', ' Hull']
  const missing = ['', 'NA', 'n/a', '-']
  const rows = []
  for (let i = 0; i < 60; i++) {
    const age = r() < 0.08 ? r.pick(missing) : String(r.int(18, 70))
    const income = r() < 0.1 ? r.pick(missing) : (() => {
      const v = Math.round(r.normal(31000, 9000) / 100) * 100
      return r() < 0.4 ? v.toLocaleString('en-GB') : String(v)
    })()
    rows.push({ respondent: 'R' + String(i + 1).padStart(3, '0'), city: r.pick(cities), age, income, rating: r() < 0.05 ? '11' : String(r.int(1, 10)) })
  }
  rows.push({ ...rows[4] }, { ...rows[17] }, { ...rows[31] })
  return toCsv(rows)
}

// A year of daily sales at a café: trend, weekly rhythm, summer bump, noise.
function cafe() {
  const r = rng(23)
  const rows = []
  const start = Date.UTC(2025, 0, 1)
  for (let d = 0; d < 365; d++) {
    const date = new Date(start + d * 86400000)
    const dow = date.getUTCDay()
    const season = Math.sin(((d - 80) / 365) * 2 * Math.PI)
    const temp = round(11 + 8 * season + r.normal(0, 2.5), 1)
    const promo = r() < 0.08 ? 1 : 0
    const weekly = dow === 0 || dow === 6 ? 1.35 : dow === 1 ? 0.85 : 1
    const sales = Math.round((420 + 0.35 * d + 60 * season) * weekly * (promo ? 1.25 : 1) + r.normal(0, 35))
    rows.push({ date: date.toISOString().slice(0, 10), sales, temp, promo })
  }
  return toCsv(rows)
}

// An A/B test: 2,000 visitors, two page designs, did they sign up?
function abtest() {
  const r = rng(31)
  const rows = []
  for (let i = 0; i < 2000; i++) {
    const variant = r() < 0.5 ? 'A' : 'B'
    const converted = r() < (variant === 'A' ? 0.105 : 0.128) ? 1 : 0
    rows.push({ visitor: i + 1, variant, converted })
  }
  return toCsv(rows)
}

// Shoppers in three segments described by four correlated measurements. Made
// for clustering and PCA: the clusters are real in the generator, unlabeled
// in the features.
function shoppers() {
  const r = rng(43)
  const centres = [
    { segment: 'bargain', visits: 9, basket: 18, discount: 0.42 },
    { segment: 'weekly', visits: 4, basket: 62, discount: 0.15 },
    { segment: 'occasional', visits: 1.5, basket: 120, discount: 0.08 },
  ]
  const rows = []
  for (let i = 0; i < 300; i++) {
    const c = centres[i % 3]
    const visits = round(Math.max(0.2, r.normal(c.visits, c.visits * 0.25)), 1)
    const basket = round(Math.max(3, r.normal(c.basket, c.basket * 0.2)), 1)
    const discount = round(Math.min(0.9, Math.max(0, r.normal(c.discount, 0.06))), 2)
    const spend = round(visits * basket * 4.3 * (1 - discount * 0.5) + r.normal(0, 20), 0)
    rows.push({ id: i + 1, visits, basket, discount, spend, segment: c.segment })
  }
  return toCsv(rows)
}

// Two interleaved classes in 2D, for classification.
function moons() {
  const r = rng(53)
  const rows = []
  for (let i = 0; i < 200; i++) {
    const label = i % 2
    const t = r() * Math.PI
    const x = label ? 1 - Math.cos(t) : Math.cos(t)
    const y = label ? 0.5 - Math.sin(t) : Math.sin(t)
    rows.push({ x: round(x + r.normal(0, 0.18), 3), y: round(y + r.normal(0, 0.18), 3), label })
  }
  return toCsv(rows)
}

export const DATASETS = { students, survey, cafe, abtest, shoppers, moons }

export const DATASET_INFO = {
  students: '240 students: group, hours studied per week, sleep, prior score, exam score, passed',
  survey: '63 messy survey rows (with duplicates and missing values) to clean',
  cafe: '365 days of café sales in 2025 with temperature and promotion days',
  abtest: '2,000 visitors split between page designs A and B, and whether they signed up',
  shoppers: '300 shoppers: visits per month, basket size, discount share, spend, segment',
  moons: '200 points in two interleaved half-moon classes',
}

const cache = new Map()
export function datasetCsv(name) {
  if (!DATASETS[name]) throw new Error('No dataset called "' + name + '". Try one of: ' + Object.keys(DATASETS).join(', '))
  if (!cache.has(name)) cache.set(name, DATASETS[name]())
  return cache.get(name)
}

// Parsed rows. A fresh copy each time, so one run cannot change the next.
// Survey stays as text: cleaning it is the exercise.
export function loadDataset(name, d3) {
  const csv = datasetCsv(name)
  if (name === 'survey') return d3.csvParse(csv)
  return d3.csvParse(csv, d3.autoType)
}
