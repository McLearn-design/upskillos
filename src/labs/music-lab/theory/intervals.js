// Intervals: semitones, frequency ratios, cents, and the arithmetic of ratios.
import { ratioToCents } from './pitch.js'

export function gcd(a, b) {
  a = Math.abs(a); b = Math.abs(b)
  while (b) [a, b] = [b, a % b]
  return a
}

export function lcm(a, b) {
  return a && b ? Math.abs(a * b) / gcd(a, b) : 0
}

export function simplifyRatio(n, d) {
  const g = gcd(n, d) || 1
  return [n / g, d / g]
}

/** Prime factorisation as a map { prime: exponent }. */
export function primeFactors(n) {
  const out = {}
  let x = Math.abs(Math.round(n))
  for (let p = 2; p * p <= x; p++) {
    while (x % p === 0) { out[p] = (out[p] || 0) + 1; x /= p }
  }
  if (x > 1) out[x] = (out[x] || 0) + 1
  return out
}

/** Exponent vector of n/d over primes 2,3,5,7: 3/2 → {2:-1, 3:1}. */
export function ratioMonzo(n, d) {
  const out = {}
  for (const [p, e] of Object.entries(primeFactors(n))) out[p] = (out[p] || 0) + e
  for (const [p, e] of Object.entries(primeFactors(d))) out[p] = (out[p] || 0) - e
  for (const p of Object.keys(out)) if (out[p] === 0) delete out[p]
  return out
}

/**
 * The 13 simple intervals of the octave with their usual 5-limit just ratio.
 * The tritone has no single agreed just ratio; 45:32 is the common 5-limit one.
 */
export const INTERVALS = [
  { semitones: 0, name: 'Unison', short: 'P1', just: [1, 1] },
  { semitones: 1, name: 'Minor 2nd', short: 'm2', just: [16, 15] },
  { semitones: 2, name: 'Major 2nd', short: 'M2', just: [9, 8] },
  { semitones: 3, name: 'Minor 3rd', short: 'm3', just: [6, 5] },
  { semitones: 4, name: 'Major 3rd', short: 'M3', just: [5, 4] },
  { semitones: 5, name: 'Perfect 4th', short: 'P4', just: [4, 3] },
  { semitones: 6, name: 'Tritone', short: 'TT', just: [45, 32] },
  { semitones: 7, name: 'Perfect 5th', short: 'P5', just: [3, 2] },
  { semitones: 8, name: 'Minor 6th', short: 'm6', just: [8, 5] },
  { semitones: 9, name: 'Major 6th', short: 'M6', just: [5, 3] },
  { semitones: 10, name: 'Minor 7th', short: 'm7', just: [9, 5] },
  { semitones: 11, name: 'Major 7th', short: 'M7', just: [15, 8] },
  { semitones: 12, name: 'Octave', short: 'P8', just: [2, 1] },
]

/** Equal-temperament frequency ratio for n semitones: 2^(n/12). */
export const etRatio = (n) => Math.pow(2, n / 12)

/** Everything the lab knows about an interval of n semitones (any size). */
export function intervalInfo(n) {
  const octaves = Math.floor(n / 12)
  const simple = ((n % 12) + 12) % 12
  const base = n !== 0 && simple === 0 ? INTERVALS[12] : INTERVALS[simple]
  const extraOct = n !== 0 && simple === 0 ? octaves - 1 : octaves
  const [jn, jd] = base.just
  const justN = jn * Math.pow(2, Math.max(0, extraOct))
  const justD = jd * Math.pow(2, Math.max(0, -extraOct))
  const [sn, sd] = simplifyRatio(justN, justD)
  const just = sn / sd
  const et = etRatio(n)
  return {
    semitones: n,
    name: extraOct > 0 ? `${base.name} + ${extraOct} oct` : base.name,
    short: base.short,
    just: [sn, sd],
    justRatio: just,
    justCents: ratioToCents(just),
    etRatio: et,
    etCents: n * 100,
    /** How far equal temperament sits from the just ratio, in cents. */
    deviation: n * 100 - ratioToCents(just),
  }
}

/**
 * Beat rate (Hz) heard when two tones approximate the ratio p:q.
 * Harmonic p of the lower note meets harmonic q of the upper one; their
 * difference is the beating: |q·f2 − p·f1| (f2 is the upper note).
 */
export function beatRate(f1, f2, [p, q]) {
  return Math.abs(q * f2 - p * f1)
}

/** Closest simple ratio (denominators up to maxDen) to a decimal value. */
export function approximateRatio(x, maxDen = 16) {
  let best = [1, 1]
  let bestErr = Infinity
  for (let d = 1; d <= maxDen; d++) {
    const n = Math.round(x * d)
    if (n <= 0) continue
    const err = Math.abs(ratioToCents(n / d / x))
    if (err < bestErr - 1e-9) { bestErr = err; best = simplifyRatio(n, d) }
  }
  return { ratio: best, cents: bestErr }
}
