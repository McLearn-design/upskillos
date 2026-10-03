import { describe, it, expect } from 'vitest'
import {
  midiToFreq, freqToMidi, midiToName, parseNote, centsBetween, nearestNote, wavelength,
  intervalInfo, beatRate, primeFactors, ratioMonzo, approximateRatio, lcm,
  identifyScale, identifyChord, stepPattern, romanNumeral, diatonicChord, SCALES, voiceLeadingDistance, closestVoicing, justChordRatio,
  tunedFreq, getTuning, PYTHAGOREAN_COMMA, deviationFromEqual,
  euclid, interOnsetIntervals, polyrhythm, rotate,
  circleOfFifths, keySignature, relativeMinor,
  makeRng, intervalQuestion, chordQuestion, pitchQuestion, recordAnswer, mastery, pickWeighted,
  partialsFor, sampleWave,
} from './index.js'

const close = (a, b, eps = 1e-3) => expect(Math.abs(a - b)).toBeLessThan(eps)

describe('pitch', () => {
  it('converts MIDI and frequency both ways', () => {
    close(midiToFreq(69), 440)
    close(midiToFreq(60), 261.6256)
    close(midiToFreq(81), 880)
    close(freqToMidi(261.6256), 60)
    close(midiToFreq(69, 432), 432)
  })
  it('names and parses notes', () => {
    expect(midiToName(60)).toBe('C4')
    expect(midiToName(61)).toBe('C#4')
    expect(midiToName(61, { flats: true })).toBe('Db4')
    expect(parseNote('C4')).toBe(60)
    expect(parseNote('Eb3')).toBe(51)
    expect(parseNote('a4')).toBe(69)
    expect(parseNote('hello')).toBeNull()
  })
  it('measures cents logarithmically', () => {
    close(centsBetween(220, 440), 1200)
    close(centsBetween(440, 660), 701.955)
    const n = nearestNote(445)
    expect(n.name).toBe('A4')
    close(n.cents, 19.56, 0.01)
  })
  it('computes wavelength', () => {
    close(wavelength(343), 1)
  })
})

describe('intervals', () => {
  it('describes a perfect fifth', () => {
    const p5 = intervalInfo(7)
    expect(p5.name).toBe('Perfect 5th')
    expect(p5.just).toEqual([3, 2])
    close(p5.justCents, 701.955)
    close(p5.etRatio, 1.498307)
    close(p5.deviation, -1.955)
  })
  it('handles compound intervals and the octave', () => {
    expect(intervalInfo(12).just).toEqual([2, 1])
    expect(intervalInfo(19).just).toEqual([3, 1])
    expect(intervalInfo(24).just).toEqual([4, 1])
  })
  it('computes beat rates', () => {
    expect(beatRate(200, 300, [3, 2])).toBe(0)
    close(beatRate(261.6256, midiToFreq(67), [3, 2]), 0.8869, 1e-3)
  })
  it('factors ratios', () => {
    expect(primeFactors(360)).toEqual({ 2: 3, 3: 2, 5: 1 })
    expect(ratioMonzo(3, 2)).toEqual({ 2: -1, 3: 1 })
    expect(ratioMonzo(5, 4)).toEqual({ 2: -2, 5: 1 })
    expect(lcm(3, 4)).toBe(12)
  })
  it('approximates decimals with simple ratios', () => {
    expect(approximateRatio(1.4983).ratio).toEqual([3, 2])
    expect(approximateRatio(1.2599, 8).ratio).toEqual([5, 4])
    expect(approximateRatio(1.2599).ratio).toEqual([19, 15])
  })
})

describe('scales and chords', () => {
  it('identifies scales and their modes', () => {
    expect(identifyScale([0, 2, 4, 5, 7, 9, 11]).exact.id).toBe('major')
    const minor = identifyScale([0, 2, 3, 5, 7, 8, 10])
    expect(minor.exact.id).toBe('minor')
    expect(minor.rotations.some((r) => r.offset === 3 && r.scale.id === 'major')).toBe(true)
    expect(identifyScale([0, 1, 5]).exact).toBeNull()
  })
  it('gives step patterns', () => {
    expect(stepPattern([0, 2, 4, 5, 7, 9, 11])).toEqual([2, 2, 1, 2, 2, 2, 1])
  })
  it('identifies chords including inversions', () => {
    expect(identifyChord([0, 4, 7]).symbol).toBe('C')
    expect(identifyChord([0, 3, 7]).symbol).toBe('Cm')
    expect(identifyChord([7, 11, 2, 5]).symbol).toBe('G7')
    const inv = identifyChord([4, 7, 0], 4)
    expect(inv.symbol).toBe('C/E')
    expect(inv.inversion).toBe(1)
    expect(identifyChord([0, 1])).toBeNull()
  })
  it('builds diatonic chords and Roman numerals', () => {
    const major = SCALES.find((s) => s.id === 'major').intervals
    expect(diatonicChord(major, 4)).toEqual([7, 11, 14])
    expect([0, 1, 2, 3, 4, 5, 6].map((d) => romanNumeral(major, d))).toEqual(['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'])
  })
  it('measures voice-leading distance', () => {
    expect(voiceLeadingDistance([60, 64, 67], [60, 65, 69])).toBe(3)
  })
  it('finds the closest voicing and just chord ratios', () => {
    // C major (C4 E4 G4) → F major: nearest is C4 F4 A4 (2nd inversion)
    expect(closestVoicing([60, 64, 67], [5, 9, 0])).toEqual([60, 65, 69])
    // → G major: B3 D4 G4
    expect(closestVoicing([60, 64, 67], [7, 11, 2])).toEqual([59, 62, 67])
    const just = (n) => intervalInfo(n).just
    expect(justChordRatio([0, 4, 7], just)).toEqual([4, 5, 6])
    expect(justChordRatio([0, 3, 7], just)).toEqual([10, 12, 15])
  })
})

describe('tuning', () => {
  it('anchors the tonic and tunes intervals', () => {
    close(tunedFreq(60, { tuning: 'just' }), midiToFreq(60))
    close(tunedFreq(67, { tuning: 'just' }) / tunedFreq(60, { tuning: 'just' }), 1.5)
    close(tunedFreq(64, { tuning: 'meantone' }) / tunedFreq(60, { tuning: 'meantone' }), 1.25)
    close(tunedFreq(64, { tuning: 'pythagorean' }) / midiToFreq(60), 81 / 64)
    close(tunedFreq(69, { tuning: 'equal' }), 440)
  })
  it('works for non-C tonics', () => {
    close(tunedFreq(69 + 7, { tuning: 'just', tonic: 9 }) / 440, 1.5)
  })
  it('knows the Pythagorean comma and deviations', () => {
    close(PYTHAGOREAN_COMMA, 23.46, 0.01)
    close(deviationFromEqual('just')[4], -13.69, 0.01)
    expect(getTuning('nope').id).toBe('equal')
  })
})

describe('rhythm', () => {
  it('builds Euclidean rhythms', () => {
    const tresillo = euclid(3, 8)
    expect(tresillo.map((x) => (x ? 'x' : '.')).join('')).toBe('x..x..x.')
    expect(interOnsetIntervals(tresillo)).toEqual([3, 3, 2])
    expect(euclid(5, 8).filter(Boolean).length).toBe(5)
    expect(euclid(0, 8).some(Boolean)).toBe(false)
    expect(rotate([true, false, false], 1)).toEqual([false, true, false])
  })
  it('lays polyrhythms on a common grid', () => {
    const p = polyrhythm(3, 2)
    expect(p.cells).toBe(6)
    expect(p.a.filter(Boolean).length).toBe(3)
    expect(p.b.filter(Boolean).length).toBe(2)
    expect(p.together).toBe(1)
  })
})

describe('circle of fifths', () => {
  it('generates the cycle and key signatures', () => {
    expect(circleOfFifths(0)).toEqual([0, 7, 2, 9, 4, 11, 6, 1, 8, 3, 10, 5])
    expect(keySignature(7).sharps).toBe(1)
    expect(keySignature(5).flats).toBe(1)
    expect(keySignature(3).name).toBe('Eb')
    expect(relativeMinor(0)).toBe(9)
  })
})

describe('ear training', () => {
  it('generates reproducible, valid questions', () => {
    const q1 = intervalQuestion({ rng: makeRng(1) })
    const q2 = intervalQuestion({ rng: makeRng(1) })
    expect(q1).toEqual(q2)
    expect(q1.notes[1] - q1.notes[0]).toBe(Number(q1.answer))
    const c = chordQuestion({ rng: makeRng(2) })
    expect(identifyChord(c.notes).chord.id).toBe(c.answer)
    const p = pitchQuestion({ rng: makeRng(3), cents: 25 })
    close(Math.abs(centsBetween(p.freqs[0], p.freqs[1])), 25)
  })
  it('tracks mastery and favours weak items', () => {
    let s = {}
    for (let i = 0; i < 5; i++) s = recordAnswer(s, '7', true)
    expect(mastery(s, ['7'])).toBe(1)
    expect(mastery(s, ['7', '4'])).toBe(0.5)
    const rng = makeRng(9)
    let weak = 0
    for (let i = 0; i < 400; i++) if (pickWeighted(['7', '4'], s, rng) === '4') weak++
    expect(weak).toBeGreaterThan(220)
  })
})

describe('waves', () => {
  it('produces Fourier partials', () => {
    expect(partialsFor('sine', 4)).toEqual([1, 0, 0, 0])
    expect(partialsFor('square', 5)).toEqual([1, 0, 1 / 3, 0, 1 / 5])
    close(sampleWave([1], 0.25), 1)
  })
})
