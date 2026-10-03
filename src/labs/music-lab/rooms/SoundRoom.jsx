// Sound room: oscillator, waveforms, and harmonics (an introduction to Fourier).
import { useEffect, useMemo, useState } from 'react'
import { audio } from '../audio/labAudio.js'
import { useMusic, solveChallenge } from '../model.jsx'
import { Panel, Btn, Seg, Slider, Stat, MathOnly, Tex, Explain, Challenge, fmtHz, fmtCents } from '../ui.jsx'
import { WavePlot, Bars } from '../views/views.jsx'
import { WAVE_TYPES, partialsFor, sampleWave, nearestNote, wavelength, periodMs } from '../theory/index.js'

const N_PARTIALS = 12
const WINDOW_MS = 10

export default function SoundRoom() {
  const { model } = useMusic()
  const [freq, setFreq] = useState(220)
  const [gain, setGain] = useState(0.5)
  const [preset, setPreset] = useState('sine')
  const [partials, setPartials] = useState(() => partialsFor('sine', N_PARTIALS))
  const [playing, setPlaying] = useState(false)
  const [view, setView] = useState('time')

  // What you see is what you hear: the drone is built from the same partials.
  useEffect(() => {
    if (playing) audio.drone('sound', { freq, partials: partials.some(Boolean) ? partials : [1], gain: gain * 0.4 })
  }, [playing, freq, partials, gain])
  useEffect(() => () => audio.stopDrone('sound'), [])

  const toggle = () => {
    if (playing) { audio.stopDrone('sound'); setPlaying(false) } else setPlaying(true)
  }
  const choosePreset = (t) => { setPreset(t); setPartials(partialsFor(t, N_PARTIALS)) }
  const setPartial = (i, v) => { setPreset('custom'); setPartials((p) => p.map((x, j) => (j === i ? (Math.sign(x) || 1) * v : x))) }

  // Fixed 10 ms window: doubling the frequency visibly doubles the cycles.
  const ys = useMemo(() => {
    const n = 600
    const peak = Math.max(1e-9, ...Array.from({ length: 200 }, (_, i) => Math.abs(sampleWave(partials, i / 200))))
    return Array.from({ length: n }, (_, i) => (gain * sampleWave(partials, (i / n) * (WINDOW_MS / 1000) * freq)) / peak)
  }, [partials, freq, gain])

  const near = nearestNote(freq, model.a4)
  const activeTerms = partials.map((a, i) => ({ a, n: i + 1 })).filter((p) => p.a)
  const series = activeTerms.slice(0, 4).map(({ a, n }) => {
    const m = Math.abs(a)
    const eq = (x, y) => Math.abs(x - y) < 1e-9
    const coef = eq(m, 1) ? '' : eq(m, 1 / n) ? `\\tfrac{1}{${n}}` : eq(m, 1 / (n * n)) ? `\\tfrac{1}{${n * n}}` : m.toFixed(2)
    return `${a < 0 ? '-' : '+'} ${coef}\\sin(2\\pi\\cdot ${n}ft)`
  }).join(' ').replace(/^\+ /, '')

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="space-y-4">
        <Panel
          title={view === 'time' ? `Time domain · ${WINDOW_MS} ms window` : 'Frequency domain · spectrum'}
          right={<Seg size="xs" value={view} onChange={setView} options={[{ value: 'time', label: 'Waveform' }, { value: 'freq', label: 'Spectrum' }]} />}
        >
          {view === 'time' ? (
            <WavePlot ys={ys} height={170} />
          ) : (
            <Bars height={170} bars={partials.map((a, i) => ({ label: `${Math.round(freq * (i + 1))}`, value: Math.abs(a) * gain }))} />
          )}
          <div className="mt-2 text-xs text-zinc-500">
            {view === 'time'
              ? `${(freq * WINDOW_MS / 1000).toFixed(1)} cycles fit in ${WINDOW_MS} ms. Height is amplitude (loudness); crowding is frequency (pitch).`
              : 'Each bar is one sine wave at a whole-number multiple of the fundamental (Hz shown below).'}
          </div>
        </Panel>

        <Panel title="Harmonics · drag bars to shape the timbre" right={<Seg size="xs" value={preset} onChange={choosePreset} options={WAVE_TYPES} />}>
          <Bars height={140} max={1} onSet={setPartial} bars={partials.map((a, i) => ({ label: `${i + 1}×`, value: Math.abs(a), color: i === 0 ? '#f59e0b' : '#8b5cf6' }))} />
          <div className="mt-2 flex flex-wrap gap-2">
            <Btn tone="ghost" onClick={() => { setPreset('custom'); setPartials((p) => p.map((x, i) => (i === 0 ? x : 0))) }}>Fundamental only</Btn>
            <Btn tone="ghost" onClick={() => { setPreset('custom'); setPartials((p) => p.map((x, i) => (i % 2 === 1 ? 0 : x))) }}>Remove even harmonics</Btn>
            <Btn tone="ghost" onClick={() => { setPreset('custom'); setPartials((p) => p.map((x, i) => (i === 0 ? 0 : x))) }}>Remove fundamental</Btn>
          </div>
          <MathOnly>
            <div className="mt-3 overflow-x-auto text-zinc-200">
              <Tex display>{`y(t) = ${series || '0'}${activeTerms.length > 4 ? ' + \\cdots' : ''}`}</Tex>
            </div>
          </MathOnly>
        </Panel>

        <Explain>
          <p>Sound is a pressure wave. <b>Frequency</b> (cycles per second, Hz) is what you hear as pitch; <b>amplitude</b> is loudness.</p>
          <p>Press ×2: the waveform packs twice the cycles into the same window and the pitch rises by an <b>octave</b>. Every octave is the same <em>ratio</em> (×2), not the same number of hertz: 110→220 adds 110 Hz, 440→880 adds 440 Hz. That is why pitch behaves like a logarithm.</p>
          <p>The <b>harmonics</b> panel is Fourier's idea: any repeating wave is a sum of sines at f, 2f, 3f… A square wave is odd harmonics at 1/n; a sawtooth is all harmonics at 1/n. Change the bars and the pitch stays put (same fundamental) while the <b>timbre</b> changes. Remove the fundamental entirely and you will often still hear the same pitch: your brain infers it from the spacing of the harmonics (the "missing fundamental").</p>
        </Explain>
      </div>

      <div className="space-y-4">
        <Panel title="Oscillator">
          <div className="space-y-3">
            <Btn tone={playing ? 'stop' : 'play'} className="w-full" onClick={toggle}>{playing ? '■ Stop' : '▶ Play tone'}</Btn>
            <Slider label="Frequency" value={freq} min={55} max={1760} log onChange={setFreq} format={fmtHz} />
            <div className="flex gap-2">
              <Btn className="flex-1" onClick={() => setFreq((f) => Math.max(55, f / 2))}>÷2</Btn>
              <Btn className="flex-1" onClick={() => setFreq((f) => Math.min(1760, f * 2))}>×2</Btn>
              <Btn className="flex-1" onClick={() => setFreq(model.a4)}>A4</Btn>
            </div>
            <Slider label="Amplitude" value={gain} min={0} max={1} step={0.01} onChange={setGain} format={(v) => v.toFixed(2)} />
          </div>
        </Panel>
        <Panel title="Measurements">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nearest note" value={near.name} sub={fmtCents(near.cents)} accent="text-amber-300" />
            <Stat label="Frequency" value={freq.toFixed(1)} sub="Hz" />
            <MathOnly>
              <Stat label="Period T" value={periodMs(freq).toFixed(2)} sub="ms  (T = 1/f)" />
              <Stat label="Wavelength λ" value={wavelength(freq).toFixed(2)} sub="m  (λ = v/f, v=343)" />
            </MathOnly>
          </div>
          <MathOnly>
            <div className="mt-3 text-zinc-300"><Tex display>{`f_{\\text{octave up}} = 2f = ${(2 * freq).toFixed(1)}\\ \\text{Hz}`}</Tex></div>
          </MathOnly>
        </Panel>
        <Challenge
          id="sound.octave317"
          prompt="What frequency is exactly one octave above 317 Hz?"
          placeholder="Hz"
          hint="An octave is a ratio of 2."
          check={(v) => Math.abs(parseFloat(v) - 634) < 0.6}
          onSolved={solveChallenge}
        />
        <Challenge
          id="sound.octaveDown"
          prompt="How many octaves are there between 55 Hz and 1760 Hz?"
          hint="Keep halving 1760 until you reach 55."
          check={(v) => parseFloat(v) === 5}
          onSolved={solveChallenge}
        />
      </div>
    </div>
  )
}
