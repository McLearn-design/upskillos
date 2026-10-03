// Waves as sums of sines (Fourier series). Used to draw and to synthesise timbres.

export const WAVE_TYPES = ['sine', 'square', 'triangle', 'sawtooth']

/**
 * Fourier amplitudes a₁…a_N for the classic waveforms, normalised so a₁ = 1.
 *   square:   odd n, 1/n
 *   sawtooth: every n, (−1)^(n+1)/n
 *   triangle: odd n, (−1)^((n−1)/2)/n²
 */
export function partialsFor(type, count = 16) {
  return Array.from({ length: count }, (_, i) => {
    const n = i + 1
    switch (type) {
      case 'sine': return n === 1 ? 1 : 0
      case 'square': return n % 2 ? 1 / n : 0
      case 'sawtooth': return (n % 2 ? 1 : -1) / n
      case 'triangle': return n % 2 ? ((((n - 1) / 2) % 2 ? -1 : 1) / (n * n)) : 0
      default: return 0
    }
  })
}

/** Value at phase t (in cycles of the fundamental) of Σ aₙ·sin(2πnt). */
export function sampleWave(partials, t) {
  let y = 0
  for (let i = 0; i < partials.length; i++) {
    if (partials[i]) y += partials[i] * Math.sin(2 * Math.PI * (i + 1) * t)
  }
  return y
}

/** Sample `n` points over `cycles` cycles, returning [{t, y}]. */
export function sampleCycles(partials, cycles = 2, n = 400) {
  return Array.from({ length: n + 1 }, (_, i) => {
    const t = (i / n) * cycles
    return { t, y: sampleWave(partials, t) }
  })
}

/** Harmonic series of a fundamental: f, 2f, 3f, … */
export function harmonicSeries(f0, count = 8) {
  return Array.from({ length: count }, (_, i) => ({ n: i + 1, freq: f0 * (i + 1) }))
}

/** Sum of two equal sines at f1 and f2 at time t (seconds). Shows beating. */
export function twoToneSample(f1, f2, t) {
  return 0.5 * (Math.sin(2 * Math.PI * f1 * t) + Math.sin(2 * Math.PI * f2 * t))
}
