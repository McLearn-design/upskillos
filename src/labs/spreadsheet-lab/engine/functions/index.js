// The whole function library, keyed by upper-case name.
import math from './math.js'
import stats, { statAliases } from './stats.js'
import logic from './logic.js'
import lookup from './lookup.js'
import text from './text.js'
import info from './info.js'
import dates from './dates.js'
import financial from './financial.js'
import pivot from './pivot.js'

const library = { ...math, ...stats, ...logic, ...lookup, ...text, ...info, ...dates, ...financial, ...pivot }

// Older names (STDEV, VAR, RANK…) run the same code as their modern ones, and
// their help says which name to prefer.
for (const [old, modern] of Object.entries(statAliases)) {
  if (library[modern] && !library[old]) {
    library[old] = { ...library[modern], aliasOf: modern, syntax: library[modern].syntax.replace(modern, old) }
  }
}

export const FUNCTIONS = Object.freeze(library)

// Categories in the order the help panel lists them.
export const CATEGORIES = [...new Set(Object.values(FUNCTIONS).map((f) => f.category))]
