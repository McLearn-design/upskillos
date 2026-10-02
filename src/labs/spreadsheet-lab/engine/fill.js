// Dragging the fill handle: what goes in the new cells.
//
// Excel continues patterns rather than only copying:
//   1, 2          → 3, 4, 5            (a linear trend: the best-fit line)
//   1             → 1, 1, 1            (one number is copied)
//   Item 1        → Item 2, Item 3     (text ending in a number counts up)
//   Jan  /  Monday → Feb, Mar  /  Tuesday, Wednesday
//   =A1*2         → =A2*2, =A3*2       (formulas are copied with relative references moved)
//   anything else is copied, repeating the source cells in order.
import { textToNumber } from './values.js'
import { shiftFormula } from './rewrite.js'

const LISTS = [
  ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
  ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'],
  ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
]

function inList(text) {
  for (const list of LISTS) {
    const i = list.findIndex((x) => x.toLowerCase() === text.toLowerCase())
    if (i >= 0) return { list, i }
  }
  return null
}

const matchCase = (word, like) => (like === like.toUpperCase() ? word.toUpperCase() : like === like.toLowerCase() ? word.toLowerCase() : word)

// sources: the inputs of the selected cells along the fill direction, in order.
// count: how many new cells. dRow/dCol: the direction of one step (e.g. 1, 0 for down).
// Returns the inputs for the new cells (filling backwards when dRow/dCol is negative).
export function fillInputs(sources, count, dRow, dCol) {
  const n = sources.length
  const numbers = sources.map((s) => (s.startsWith('=') ? null : textToNumber(s.trim())))
  if (n >= 2 && numbers.every((x) => x !== null)) {
    // Least-squares line through (0, x0), (1, x1)…: a constant step when the
    // sources are evenly spaced, the trend when they are not.
    const xs = numbers
    const meanI = (n - 1) / 2, meanX = xs.reduce((a, b) => a + b, 0) / n
    let sxy = 0, sxx = 0
    xs.forEach((x, i) => { sxy += (i - meanI) * (x - meanX); sxx += (i - meanI) ** 2 })
    const slope = sxy / sxx, intercept = meanX - slope * meanI
    return Array.from({ length: count }, (_, k) => String(+(intercept + slope * (n + k)).toPrecision(15)))
  }
  return Array.from({ length: count }, (_, k) => {
    const i = k % n
    const src = sources[i]
    const steps = n + k - i // how far this new cell is from the source it copies
    if (src.startsWith('=')) return shiftFormula(src, dRow * steps, dCol * steps)
    const listed = inList(src.trim())
    if (listed) {
      const { list, i: at } = listed
      return matchCase(list[(at + steps) % list.length], src.trim())
    }
    const m = /^(.*?)(\d+)$/.exec(src)
    if (m && numbers[i] === null) {
      // Counts up by the distance moved: Item 1 → Item 2, Item 3; and with
      // two sources Item 1, Item 2 → Item 3, Item 4.
      return m[1] + String(Number(m[2]) + steps).padStart(m[2].length, '0')
    }
    return src
  })
}
