// Scales and chords are sets of semitone offsets from a root.
import { mod12, pitchClassName } from './pitch.js'

export const SCALES = [
  { id: 'major', name: 'Major (Ionian)', intervals: [0, 2, 4, 5, 7, 9, 11] },
  { id: 'dorian', name: 'Dorian', intervals: [0, 2, 3, 5, 7, 9, 10] },
  { id: 'phrygian', name: 'Phrygian', intervals: [0, 1, 3, 5, 7, 8, 10] },
  { id: 'lydian', name: 'Lydian', intervals: [0, 2, 4, 6, 7, 9, 11] },
  { id: 'mixolydian', name: 'Mixolydian', intervals: [0, 2, 4, 5, 7, 9, 10] },
  { id: 'minor', name: 'Natural minor (Aeolian)', intervals: [0, 2, 3, 5, 7, 8, 10] },
  { id: 'locrian', name: 'Locrian', intervals: [0, 1, 3, 5, 6, 8, 10] },
  { id: 'harmonic-minor', name: 'Harmonic minor', intervals: [0, 2, 3, 5, 7, 8, 11] },
  { id: 'melodic-minor', name: 'Melodic minor (ascending)', intervals: [0, 2, 3, 5, 7, 9, 11] },
  { id: 'major-pentatonic', name: 'Major pentatonic', intervals: [0, 2, 4, 7, 9] },
  { id: 'minor-pentatonic', name: 'Minor pentatonic', intervals: [0, 3, 5, 7, 10] },
  { id: 'blues', name: 'Blues', intervals: [0, 3, 5, 6, 7, 10] },
  { id: 'whole-tone', name: 'Whole tone', intervals: [0, 2, 4, 6, 8, 10] },
  { id: 'diminished', name: 'Diminished (whole–half)', intervals: [0, 2, 3, 5, 6, 8, 9, 11] },
  { id: 'chromatic', name: 'Chromatic', intervals: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11] },
]

export const CHORDS = [
  { id: 'maj', name: 'major', symbol: '', intervals: [0, 4, 7] },
  { id: 'min', name: 'minor', symbol: 'm', intervals: [0, 3, 7] },
  { id: 'dim', name: 'diminished', symbol: 'dim', intervals: [0, 3, 6] },
  { id: 'aug', name: 'augmented', symbol: 'aug', intervals: [0, 4, 8] },
  { id: 'sus2', name: 'suspended 2nd', symbol: 'sus2', intervals: [0, 2, 7] },
  { id: 'sus4', name: 'suspended 4th', symbol: 'sus4', intervals: [0, 5, 7] },
  { id: 'maj7', name: 'major 7th', symbol: 'maj7', intervals: [0, 4, 7, 11] },
  { id: '7', name: 'dominant 7th', symbol: '7', intervals: [0, 4, 7, 10] },
  { id: 'min7', name: 'minor 7th', symbol: 'm7', intervals: [0, 3, 7, 10] },
  { id: 'm7b5', name: 'half-diminished 7th', symbol: 'm7♭5', intervals: [0, 3, 6, 10] },
  { id: 'dim7', name: 'diminished 7th', symbol: 'dim7', intervals: [0, 3, 6, 9] },
  { id: 'minmaj7', name: 'minor-major 7th', symbol: 'm(maj7)', intervals: [0, 3, 7, 11] },
  { id: '6', name: 'major 6th', symbol: '6', intervals: [0, 4, 7, 9] },
  { id: 'min6', name: 'minor 6th', symbol: 'm6', intervals: [0, 3, 7, 9] },
]

/** Sorted, de-duplicated pitch classes. */
export function normalizeSet(pcs) {
  return [...new Set(pcs.map(mod12))].sort((a, b) => a - b)
}

/** Offsets of a set measured from a chosen pitch class. */
export function transposeToZero(pcs, root) {
  return normalizeSet(pcs.map((p) => p - root))
}

const sameSet = (a, b) => a.length === b.length && a.every((v, i) => v === b[i])

/** Step pattern between consecutive notes, closing back at the octave. */
export function stepPattern(intervals) {
  const s = normalizeSet(intervals)
  return s.map((v, i) => (i + 1 < s.length ? s[i + 1] : 12) - v)
}

export function stepLabel(step) {
  return { 1: 'H', 2: 'W', 3: 'W+H', 4: '2W' }[step] ?? `${step}`
}

export function buildScale(rootPc, intervals) {
  return intervals.map((i) => mod12(rootPc + i))
}

/**
 * Name a set of offsets from the root. Also reports when the same notes form a
 * known scale from a different starting note (a mode/rotation).
 */
export function identifyScale(intervals) {
  const set = normalizeSet(intervals)
  const exact = SCALES.find((s) => sameSet(s.intervals, set))
  const rotations = []
  for (const start of set) {
    if (start === 0) continue
    const rotated = transposeToZero(set, start)
    const match = SCALES.find((s) => sameSet(s.intervals, rotated))
    if (match) rotations.push({ offset: start, scale: match })
  }
  return { exact: exact ?? null, rotations }
}

/**
 * Identify a chord from pitch classes. Tries every note as the root so that
 * inversions are named by their real root. `bass` is the lowest sounding pc.
 */
export function identifyChord(pcs, bass = null, opts) {
  const set = normalizeSet(pcs)
  if (set.length < 2) return null
  const candidates = bass == null ? set : [mod12(bass), ...set.filter((p) => p !== mod12(bass))]
  for (const root of candidates) {
    const shape = transposeToZero(set, root)
    const chord = CHORDS.find((c) => sameSet(c.intervals, shape))
    if (chord) {
      const rootName = pitchClassName(root, opts)
      const inv = bass == null || mod12(bass) === root ? 0 : chord.intervals.indexOf(mod12(bass - root))
      return {
        root,
        chord,
        symbol: `${rootName}${chord.symbol}` + (inv > 0 ? `/${pitchClassName(bass, opts)}` : ''),
        name: `${rootName} ${chord.name}`,
        inversion: inv,
        inversionName: ['root position', '1st inversion', '2nd inversion', '3rd inversion'][inv] ?? `${inv}th inversion`,
      }
    }
  }
  return null
}

/** Stack thirds inside a scale to make the triad (or 7th) on a scale degree. */
export function diatonicChord(scaleIntervals, degree, size = 3) {
  const n = scaleIntervals.length
  const out = []
  for (let k = 0; k < size; k++) {
    const idx = degree + 2 * k
    out.push(scaleIntervals[idx % n] + 12 * Math.floor(idx / n))
  }
  return out
}

const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII']

/** Roman numeral for the triad on a degree of a 7-note scale. */
export function romanNumeral(scaleIntervals, degree) {
  const triad = diatonicChord(scaleIntervals, degree, 3)
  const shape = triad.map((v) => v - triad[0])
  const third = shape[1]
  const fifth = shape[2]
  let numeral = ROMAN[degree] ?? String(degree + 1)
  if (third === 3) numeral = numeral.toLowerCase()
  if (third === 3 && fifth === 6) numeral += '°'
  if (third === 4 && fifth === 8) numeral += '+'
  return numeral
}

/** Smallest total semitone movement from one voicing to another (same size). */
export function voiceLeadingDistance(fromMidis, toMidis) {
  const a = [...fromMidis].sort((x, y) => x - y)
  const b = [...toMidis].sort((x, y) => x - y)
  return a.reduce((sum, v, i) => sum + Math.abs(v - (b[i] ?? v)), 0)
}

/**
 * Voice a chord (pitch classes) as close as possible to a previous voicing:
 * try every inversion in nearby octaves and keep the least total movement.
 */
export function closestVoicing(prevMidis, pcs) {
  const center = prevMidis.reduce((a, b) => a + b, 0) / prevMidis.length
  const sorted = normalizeSet(pcs)
  let best = null
  for (let inv = 0; inv < sorted.length; inv++) {
    const shape = sorted.slice(inv).concat(sorted.slice(0, inv).map((p) => p + 12))
    const base = Math.round(center / 12) * 12
    for (const oct of [-24, -12, 0, 12]) {
      const v = shape.map((p) => p + base + oct)
      const d = voiceLeadingDistance(prevMidis, v)
      if (!best || d < best.d) best = { v, d }
    }
  }
  return best.v
}

/** Express a chord built from interval offsets as whole-number just ratios, e.g. [0,4,7] → [4,5,6]. */
export function justChordRatio(intervals, justOf) {
  const fracs = intervals.map(justOf)
  const L = fracs.reduce((acc, [, d]) => lcmInt(acc, d), 1)
  const nums = fracs.map(([n, d]) => (n * L) / d)
  const g = nums.reduce((a, b) => gcdInt(a, b))
  return nums.map((n) => n / g)
}

function gcdInt(a, b) { while (b) [a, b] = [b, a % b]; return Math.abs(a) }
function lcmInt(a, b) { return (a * b) / gcdInt(a, b) }
