// Tuning systems: where each of the 12 notes sits, in cents above the tonic.
import { midiToFreq, mod12, ratioToCents } from './pitch.js'

const fromRatios = (ratios) => ratios.map(([n, d]) => ratioToCents(n / d))

/** Quarter-comma meantone fifth: four of them make an exact 5:4 major third (+2 oct). */
export const MEANTONE_FIFTH = ratioToCents(Math.pow(5, 1 / 4))

/** Chain of fifths k ∈ [-3, 8] covers E♭…G♯, the usual meantone layout. */
function meantoneOffsets(fifth) {
  const out = new Array(12)
  for (let k = -3; k <= 8; k++) {
    const pc = mod12(7 * k)
    out[pc] = (((k * fifth) % 1200) + 1200) % 1200
  }
  return out
}

export const TUNINGS = [
  {
    id: 'equal',
    name: '12-tone equal temperament',
    short: '12-TET',
    offsets: Array.from({ length: 12 }, (_, i) => i * 100),
    ratios: null,
    blurb: 'Every semitone is the same ratio, 2^(1/12). Every key sounds equally (slightly) out of tune.',
  },
  {
    id: 'just',
    name: '5-limit just intonation',
    short: 'Just',
    ratios: [[1, 1], [16, 15], [9, 8], [6, 5], [5, 4], [4, 3], [45, 32], [3, 2], [8, 5], [5, 3], [9, 5], [15, 8]],
    blurb: 'Small whole-number ratios built from 2, 3 and 5. Pure chords in one key, sour ones in others.',
  },
  {
    id: 'pythagorean',
    name: 'Pythagorean',
    short: 'Pythag.',
    ratios: [[1, 1], [256, 243], [9, 8], [32, 27], [81, 64], [4, 3], [729, 512], [3, 2], [128, 81], [27, 16], [16, 9], [243, 128]],
    blurb: 'Everything is stacked pure 3:2 fifths. Fifths are perfect; major thirds (81:64) are wide.',
  },
  {
    id: 'meantone',
    name: 'Quarter-comma meantone',
    short: 'Meantone',
    ratios: null,
    offsets: meantoneOffsets(MEANTONE_FIFTH),
    blurb: 'Fifths are narrowed so major thirds come out pure 5:4. One "wolf" fifth (G♯–E♭) is unusable.',
  },
].map((t) => ({ ...t, offsets: t.offsets ?? fromRatios(t.ratios) }))

export const getTuning = (id) => TUNINGS.find((t) => t.id === id) ?? TUNINGS[0]

/**
 * Frequency of a MIDI note in a tuning built on a tonic pitch class.
 * The tonic itself is anchored to its equal-tempered pitch, so the systems can
 * be compared note by note.
 */
export function tunedFreq(midi, { tuning = 'equal', tonic = 0, a4 = 440 } = {}) {
  const t = getTuning(tuning)
  const above = mod12(midi - tonic)
  const tonicMidi = midi - above
  return midiToFreq(tonicMidi, a4) * Math.pow(2, t.offsets[above] / 1200)
}

/** Deviation of each degree from equal temperament, in cents. */
export function deviationFromEqual(tuningId) {
  return getTuning(tuningId).offsets.map((c, i) => c - i * 100)
}

/** The Pythagorean comma: 12 pure fifths overshoot 7 octaves by this much. */
export const PYTHAGOREAN_COMMA = ratioToCents(Math.pow(1.5, 12) / Math.pow(2, 7))
