---
id: wds-08-cleaning-data
title: Cleaning messy data
part: 2. Working with real data
summary: Real exports have stray spaces, four spellings of "missing", numbers with commas and duplicate rows. See the problems, then fix them with small, explicit steps.
js: string methods, regular expressions, ?? and ?., Set for de-duplication
height: 420
controls: [{"name":"steps","label":"Cleaning steps applied","min":0,"max":4,"step":1,"value":0}]
---

<!-- explore -->
```js
const raw = d3.csvParse(datasets.survey)
const MISSING = new Set(['', 'NA', 'n/a', '-'])
const steps = [
  'trim spaces, fix city capitals',
  'missing markers → null',
  'text → numbers (strip commas), ratings 1–10',
  'drop duplicate rows',
]
let rows = raw.map(d => ({ ...d }))
if (params.steps >= 1) rows = rows.map(d => ({ ...d, city: d.city.trim().toLowerCase().replace(/^./, c => c.toUpperCase()) }))
if (params.steps >= 2) rows = rows.map(d => Object.fromEntries(Object.entries(d).map(([k, v]) => [k, MISSING.has(v.trim()) ? null : v])))
if (params.steps >= 3) rows = rows.map(d => ({
  ...d,
  age: d.age == null ? null : Number(d.age),
  income: d.income == null ? null : Number(d.income.replace(/,/g, '')),
  rating: d.rating >= 1 && d.rating <= 10 ? Number(d.rating) : null,
}))
if (params.steps >= 4) { const seen = new Set(); rows = rows.filter(d => { const k = JSON.stringify(d); return seen.has(k) ? false : (seen.add(k), true) }) }

const cols = ['city', 'age', 'income', 'rating']
const seen = new Set()
const status = (d, k) => {
  const v = d[k]
  if (v == null || MISSING.has(String(v).trim())) return 'missing'
  if (k === 'city') return /^[A-Z][a-z]+$/.test(v) ? 'ok' : 'messy'
  if (typeof v === 'number') return k === 'rating' && (v < 1 || v > 10) ? 'invalid' : 'ok'
  return /^\d+$/.test(v) && !(k === 'rating' && (+v < 1 || +v > 10)) ? 'text' : (k === 'rating' ? 'invalid' : 'messy')
}
const colors = { ok: theme.good, text: theme.palette[2], messy: theme.palette[5], missing: theme.muted, invalid: theme.bad, duplicate: theme.palette[4] }
const cell = Math.min(14, (height - 90) / Math.ceil(rows.length / 2) )
const svg = d3.select(el).append('svg').attr('width', width).attr('height', height)
svg.append('text').attr('x', 16).attr('y', 20).attr('fill', theme.text).attr('font-weight', 600)
  .text(rows.length + ' rows. Steps: ' + (params.steps ? steps.slice(0, params.steps).join(' · ') : 'none yet'))
const half = Math.ceil(rows.length / 2)
rows.forEach((d, i) => {
  const key = JSON.stringify(d)
  const dup = seen.has(key); seen.add(key)
  const gx = 16 + (i >= half ? cols.length * 34 + 40 : 0), gy = 36 + (i % half) * cell
  cols.forEach((k, j) => {
    const s = dup ? 'duplicate' : status(d, k)
    svg.append('rect').attr('x', gx + j * 34).attr('y', gy).attr('width', 32).attr('height', cell - 2).attr('fill', colors[s])
      .append('title').text(d.respondent + ' ' + k + ': ' + JSON.stringify(d[k]) + ' (' + s + ')')
  })
})
Object.entries(colors).forEach(([k, c], i) => {
  const lx = Math.min(width - 130, 16 + 2 * (cols.length * 34 + 40)), ly = 50 + i * 20
  svg.append('rect').attr('x', lx).attr('y', ly - 10).attr('width', 12).attr('height', 12).attr('fill', c)
  svg.append('text').attr('x', lx + 18).attr('y', ly).attr('font-size', 12).attr('fill', theme.text).text(k)
})
svg.append('text').attr('x', 16).attr('y', height - 8).attr('font-size', 11).attr('fill', theme.muted).text('columns: ' + cols.join(', ') + '  (hover a cell for its value)')
```

<!-- learn -->
Each row of squares is one survey response; the columns are city, age, income and rating. Step the slider up and watch the colours turn green. Notice what each step **changes the count of**: only the last one removes rows. Everything before it rewrites values but keeps every row.

Messy data is the normal case. The usual problems, all in this survey:

- **Inconsistent text**: `"Leeds"`, `"leeds "`, `"LEEDS"` are one city to a person and three to a computer.
- **Several ways to say missing**: empty, `NA`, `n/a`, `-`. Pick one, `null`, and convert all of them to it.
- **Numbers stored as text**, some with thousands separators: `"31,200"`. `Number("31,200")` is `NaN`, so remove the comma first.
- **Impossible values**: a rating of 11 on a 1–10 scale. Don't guess what was meant; mark it missing.
- **Duplicate rows**, usually from an export or merge done twice.

Rules that keep cleaning trustworthy:

1. **Never edit the raw data.** Each step makes a new array from the last, so you can always see what changed.
2. **Count before and after each step**, and log the numbers.
3. **Don't silently drop rows with missing values.** Missing is information, and dropping can bias every result that follows (see the maths).

<!-- javascript -->
**String methods** return new strings: `s.trim()`, `s.toLowerCase()`, `s.padStart(3, '0')`, `s.includes('x')`.

**Regular expressions** describe text patterns. `/,/g` matches every comma (`g` = global, all of them); `/^\d+$/` matches a string made only of digits (`^` start, `\d` digit, `+` one or more, `$` end).

```js
'31,200'.replace(/,/g, '')                       // '31200'
'leeds '.trim().replace(/^./, c => c.toUpperCase())   // 'Leeds'
/^\d+$/.test('42')                               // true
```

**`??` and `?.`** handle missing values without crashes:

```js
row.income ?? 0          // row.income, or 0 if it is null or undefined (but not if it is 0)
row.address?.city        // undefined instead of an error when address is missing
```

Compare `??` with `||`: `0 || 5` is `5`, because `||` treats every falsy value (0, '', false) as missing. `0 ?? 5` is `0`.

**De-duplicating with a Set.** A Set keeps one of each value, but objects are compared by reference, so turn each row into a string key first:

```js
const seen = new Set()
const unique = rows.filter(d => {
  const key = JSON.stringify(d)
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
```

<!-- maths -->
Dropping rows with missing values is only safe when the values are **missing completely at random** (MCAR): when whether a value is missing has nothing to do with the value itself or with anything else.

Suppose high earners skip the income question more often. That is **missing not at random** (MNAR). The observed mean is then

$$
\bar{x}_{\text{observed}} = \frac{\sum_{i\,\text{answered}} x_i}{n_{\text{answered}}} < \mu
$$

because the largest values are disproportionately absent. No amount of extra data fixes this bias; more rows only make you more confident in a wrong number. Between the two is **missing at random** (MAR): whether a value is missing depends on other columns you did record, such as city. Then you can adjust using those columns, for example by comparing within each city.

<!-- code -->
```js
const raw = d3.csvParse(datasets.survey)
log('raw rows:', raw.length)
table(raw, 6)

const MISSING = new Set(['', 'NA', 'n/a', '-'])

// Step 1 is done for you: tidy the city names.
const step1 = raw.map(d => ({
  ...d,
  city: d.city.trim().toLowerCase().replace(/^./, c => c.toUpperCase()),
}))
log('cities after step 1:', [...new Set(step1.map(d => d.city))])

// Task: finish the cleaning and return the summary.
return null
```

<!-- task -->
Continue from `step1` with one new array per step:

1. Turn every missing marker (`''`, `NA`, `n/a`, `-`, after trimming) into `null`, in every column.
2. Convert `age` and `income` to numbers (remove the commas from incomes). Keep `rating` only if it is between 1 and 10, otherwise `null`.
3. Remove exact duplicate rows.

**Return** `{ rows, missingIncome, cities }`: the number of rows left, how many of them have a `null` income, and the distinct city names sorted A to Z.

<!-- solution -->
```js
const raw = d3.csvParse(datasets.survey)
const MISSING = new Set(['', 'NA', 'n/a', '-'])

const step1 = raw.map(d => ({
  ...d,
  city: d.city.trim().toLowerCase().replace(/^./, c => c.toUpperCase()),
}))
const step2 = step1.map(d =>
  Object.fromEntries(Object.entries(d).map(([k, v]) => [k, MISSING.has(v.trim()) ? null : v])))
const step3 = step2.map(d => ({
  ...d,
  age: d.age == null ? null : Number(d.age),
  income: d.income == null ? null : Number(d.income.replace(/,/g, '')),
  rating: d.rating != null && +d.rating >= 1 && +d.rating <= 10 ? Number(d.rating) : null,
}))
const seen = new Set()
const clean = step3.filter(d => {
  const key = JSON.stringify(d)
  if (seen.has(key)) return false
  seen.add(key)
  return true
})
log('rows:', raw.length, '→', clean.length)
table(clean, 6)

return {
  rows: clean.length,
  missingIncome: clean.filter(d => d.income == null).length,
  cities: [...new Set(clean.map(d => d.city))].sort(),
}
```
