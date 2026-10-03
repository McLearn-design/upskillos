// Pitch: notes, MIDI numbers, frequencies and cents.
// Pure functions only. Every room in the Music Lab reads from these.

export const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
export const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B']

/** Speed of sound in air at about 20 °C, in metres per second. */
export const SPEED_OF_SOUND = 343

export const A4_MIDI = 69

/** Wrap any integer into 0..11. */
export const mod12 = (n) => ((n % 12) + 12) % 12

/** Equal-tempered frequency of a MIDI note: f = a4 · 2^((m − 69)/12). */
export function midiToFreq(midi, a4 = 440) {
  return a4 * Math.pow(2, (midi - A4_MIDI) / 12)
}

/** Continuous (fractional) MIDI number for a frequency. */
export function freqToMidi(freq, a4 = 440) {
  return A4_MIDI + 12 * Math.log2(freq / a4)
}

export function pitchClassName(pc, { flats = false } = {}) {
  return (flats ? FLAT_NAMES : SHARP_NAMES)[mod12(pc)]
}

/** MIDI number → "C4" style name. Octave numbering: MIDI 60 = C4. */
export function midiToName(midi, opts) {
  const m = Math.round(midi)
  return `${pitchClassName(m, opts)}${Math.floor(m / 12) - 1}`
}

const LETTER_PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }

/** "C#4", "Eb3", "a4" → MIDI number. Returns null when the text is not a note. */
export function parseNote(text) {
  const m = /^\s*([A-Ga-g])([#b♯♭]*)(-?\d+)\s*$/.exec(String(text))
  if (!m) return null
  const letter = m[1].toUpperCase()
  let acc = 0
  for (const ch of m[2]) acc += ch === '#' || ch === '♯' ? 1 : -1
  const octave = Number(m[3])
  return (octave + 1) * 12 + LETTER_PC[letter] + acc
}

/** Size of the interval from f1 to f2 in cents: 1200 · log2(f2/f1). */
export function centsBetween(f1, f2) {
  return 1200 * Math.log2(f2 / f1)
}

export function ratioToCents(ratio) {
  return 1200 * Math.log2(ratio)
}

export function centsToRatio(cents) {
  return Math.pow(2, cents / 1200)
}

/** Nearest equal-tempered note to a frequency and how far off it is, in cents. */
export function nearestNote(freq, a4 = 440) {
  const exact = freqToMidi(freq, a4)
  const midi = Math.round(exact)
  return { midi, name: midiToName(midi), cents: (exact - midi) * 100 }
}

/** Wavelength in metres: λ = v / f. */
export function wavelength(freq, speed = SPEED_OF_SOUND) {
  return speed / freq
}

/** Period in milliseconds: T = 1 / f. */
export function periodMs(freq) {
  return 1000 / freq
}

export function isBlackKey(midi) {
  return [1, 3, 6, 8, 10].includes(mod12(midi))
}
