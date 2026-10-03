// Generative ear-training questions. Questions come from the model, not a fixed bank,
// and weaker items are asked more often.
import { INTERVALS } from './intervals.js'
import { CHORDS } from './harmony.js'

/** Small seeded PRNG (mulberry32) so questions are reproducible in tests. */
export function makeRng(seed = Date.now()) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const randInt = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1))

/**
 * Pick an item, weighting items with a poor or short record more heavily.
 * stats: { [id]: { right, tries } }
 */
export function pickWeighted(ids, stats = {}, rng = Math.random) {
  const weights = ids.map((id) => {
    const s = stats[id] ?? { right: 0, tries: 0 }
    const acc = s.tries ? s.right / s.tries : 0
    return 1 + 3 * (1 - acc) + 2 / (1 + s.tries)
  })
  const total = weights.reduce((a, b) => a + b, 0)
  let r = rng() * total
  for (let i = 0; i < ids.length; i++) {
    r -= weights[i]
    if (r <= 0) return ids[i]
  }
  return ids[ids.length - 1]
}

export const INTERVAL_SETS = {
  starter: [0, 4, 7, 12].map(String),
  basic: [2, 3, 4, 5, 7, 12].map(String),
  all: INTERVALS.slice(1).map((i) => String(i.semitones)),
}

/**
 * Interval question. mode: 'up' | 'down' | 'harmonic'.
 * Returns the notes to play and the correct answer id (semitones as a string).
 */
export function intervalQuestion({ pool = INTERVAL_SETS.basic, stats, rng = Math.random, mode = 'up', low = 55, high = 72 } = {}) {
  const id = pickWeighted(pool, stats, rng)
  const n = Number(id)
  const root = randInt(rng, low, high - (mode === 'down' ? 0 : n))
  const other = mode === 'down' ? root - n : root + n
  return {
    kind: 'interval',
    answer: id,
    notes: [root, other],
    harmonic: mode === 'harmonic',
    choices: pool.map((p) => ({ id: p, label: INTERVALS[Number(p)].name })),
  }
}

export const CHORD_POOL = ['maj', 'min', 'dim', 'aug']

export function chordQuestion({ pool = CHORD_POOL, stats, rng = Math.random, low = 52, high = 64 } = {}) {
  const id = pickWeighted(pool, stats, rng)
  const chord = CHORDS.find((c) => c.id === id)
  const root = randInt(rng, low, high)
  return {
    kind: 'chord',
    answer: id,
    notes: chord.intervals.map((i) => root + i),
    harmonic: true,
    choices: pool.map((p) => ({ id: p, label: CHORDS.find((c) => c.id === p).name })),
  }
}

/** Two pitches a few cents to a few semitones apart: which is higher? */
export function pitchQuestion({ rng = Math.random, cents = 50, base = 220, spread = 220 } = {}) {
  const f1 = base + rng() * spread
  const up = rng() < 0.5
  const f2 = f1 * Math.pow(2, (up ? cents : -cents) / 1200)
  return {
    kind: 'pitch',
    answer: up ? 'higher' : 'lower',
    freqs: [f1, f2],
    cents,
    choices: [{ id: 'higher', label: 'Second is higher' }, { id: 'lower', label: 'Second is lower' }],
  }
}

/** Record an answer; returns a new stats object. */
export function recordAnswer(stats, id, correct) {
  const s = stats[id] ?? { right: 0, tries: 0 }
  return { ...stats, [id]: { right: s.right + (correct ? 1 : 0), tries: s.tries + 1 } }
}

/** Accuracy 0..1 over a set of ids (items never tried count as 0). */
export function mastery(stats, ids) {
  if (!ids.length) return 0
  return ids.reduce((sum, id) => {
    const s = stats?.[id]
    return sum + (s && s.tries ? (s.right / s.tries) * Math.min(1, s.tries / 5) : 0)
  }, 0) / ids.length
}
