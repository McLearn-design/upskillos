// Rhythm as arithmetic: fractions of a beat, ratios, cycles and even spacing.
import { lcm } from './intervals.js'

/**
 * Euclidean rhythm E(k, n): spread k hits as evenly as possible over n steps.
 * Uses the Bresenham form (i·k mod n < k), which gives the same rhythms as
 * Bjorklund's algorithm up to rotation. Always starts with a hit when k > 0.
 */
export function euclid(hits, steps) {
  const n = Math.max(1, Math.floor(steps))
  const k = Math.max(0, Math.min(n, Math.floor(hits)))
  return Array.from({ length: n }, (_, i) => k > 0 && (i * k) % n < k)
}

export function rotate(pattern, by) {
  const n = pattern.length
  if (!n) return pattern
  const r = ((by % n) + n) % n
  return pattern.slice(n - r).concat(pattern.slice(0, n - r))
}

/** Gaps between consecutive hits, wrapping around: E(3,8) → [3,3,2]. */
export function interOnsetIntervals(pattern) {
  const hits = pattern.map((h, i) => (h ? i : -1)).filter((i) => i >= 0)
  if (hits.length === 0) return []
  return hits.map((h, i) => (i + 1 < hits.length ? hits[i + 1] : hits[0] + pattern.length) - h)
}

/**
 * Two pulse streams, a against b, laid on their common grid of lcm(a,b) cells.
 * Returns which cells each stream hits and where they coincide.
 */
export function polyrhythm(a, b) {
  const cells = lcm(a, b)
  const sa = cells / a
  const sb = cells / b
  const A = Array.from({ length: cells }, (_, i) => i % sa === 0)
  const B = Array.from({ length: cells }, (_, i) => i % sb === 0)
  return { cells, a: A, b: B, together: A.map((x, i) => x && B[i]).filter(Boolean).length }
}

/** Seconds per beat at a tempo. */
export const secondsPerBeat = (bpm) => 60 / bpm

export const NOTE_VALUES = [
  { id: 'whole', name: 'Whole', beats: 4, frac: '4' },
  { id: 'half', name: 'Half', beats: 2, frac: '2' },
  { id: 'quarter', name: 'Quarter', beats: 1, frac: '1' },
  { id: 'eighth', name: 'Eighth', beats: 1 / 2, frac: '1/2' },
  { id: 'triplet', name: 'Eighth triplet', beats: 1 / 3, frac: '1/3' },
  { id: 'sixteenth', name: 'Sixteenth', beats: 1 / 4, frac: '1/4' },
]

/** Well-known Euclidean rhythms (from Toussaint, "The Euclidean Algorithm Generates Traditional Musical Rhythms"). */
export const EUCLID_PRESETS = [
  { k: 3, n: 8, name: 'Tresillo (Cuba)' },
  { k: 5, n: 8, name: 'Cinquillo (Cuba)' },
  { k: 2, n: 5, name: 'Persian khafif-e-ramal' },
  { k: 3, n: 4, name: 'Cumbia / calypso' },
  { k: 4, n: 9, name: 'Turkish aksak' },
  { k: 5, n: 12, name: 'South African venda' },
  { k: 7, n: 12, name: 'West African bell' },
  { k: 5, n: 16, name: 'Bossa nova (rotated)' },
]
