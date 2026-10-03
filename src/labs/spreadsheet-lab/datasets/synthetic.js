// Made-up datasets with a known rule inside them. Because the rule is known,
// a learner can check whether a chart, a formula or a model finds it: the
// study data were made with score = 35 + 5.5 × hours + noise, so a fitted
// line should have a slope near 5.5.
//
// The numbers come from a seeded random generator, so every learner gets the
// same data and the same answers.

function generator(seed) {
  // mulberry32: a small, well-mixed pseudo-random generator.
  let a = seed >>> 0
  const next = () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
  // Normally distributed noise (Box–Muller).
  const normal = (sd = 1) => Math.sqrt(-2 * Math.log(1 - next())) * Math.cos(2 * Math.PI * next()) * sd
  return { next, normal, pick: (list) => list[Math.floor(next() * list.length)] }
}

const round = (x, d = 0) => Number(x.toFixed(d))
const clamp = (x, lo, hi) => Math.min(hi, Math.max(lo, x))

// 50 students: hours studied, attendance, exam score.
export function studyHours() {
  const g = generator(2025)
  const rows = [['Hours studied', 'Attendance (%)', 'Exam score']]
  for (let i = 0; i < 50; i++) {
    const hours = round(0.5 + g.next() * 9.5, 1)
    const attendance = round(clamp(70 + hours * 2.2 + g.normal(8), 40, 100))
    const score = round(clamp(35 + 5.5 * hours + g.normal(6), 0, 100))
    rows.push([hours, attendance, score])
  }
  return rows
}

// 120 houses: floor area, bedrooms, distance to the centre, price.
export function housePrices() {
  const g = generator(1234)
  const rows = [['Floor area (m²)', 'Bedrooms', 'Distance to centre (km)', 'Price (thousands)']]
  for (let i = 0; i < 120; i++) {
    const bedrooms = 1 + Math.floor(g.next() * 5)
    const area = round(clamp(35 + bedrooms * 22 + g.normal(15), 25, 260))
    const distance = round(0.5 + g.next() * 19.5, 1)
    const price = round(50 + 2.1 * area + 8 * bedrooms - 4.5 * distance + g.normal(20))
    rows.push([area, bedrooms, distance, price])
  }
  return rows
}

// Three years of monthly sales for three shops and two products, with a
// yearly pattern (busy Decembers, quiet Februaries) and steady growth.
export function shopSales() {
  const g = generator(77)
  const rows = [['Month', 'Shop', 'Product', 'Units', 'Revenue']]
  const shops = { Northgate: 1.2, Riverside: 1, 'Old Town': 0.8 }
  const products = { Notebooks: [4, 120], Pens: [1.5, 300] } // price, base units
  const season = [0.85, 0.75, 0.9, 0.95, 1, 0.95, 0.9, 1.05, 1.25, 1.05, 1.1, 1.6]
  for (let y = 2023; y <= 2025; y++) {
    for (let m = 0; m < 12; m++) {
      const growth = 1 + 0.08 * (y - 2023 + m / 12)
      for (const [shop, size] of Object.entries(shops)) {
        for (const [product, [price, base]] of Object.entries(products)) {
          const units = Math.max(0, Math.round(base * size * season[m] * growth * (1 + g.normal(0.08))))
          rows.push([y + '-' + String(m + 1).padStart(2, '0'), shop, product, units, round(units * price, 2)])
        }
      }
    }
  }
  return rows
}
