// Interval room: two notes, their ratio, cents, and the beating that tells
// equal temperament and just intonation apart.
import { useEffect, useMemo, useState } from 'react'
import { audio } from '../audio/labAudio.js'
import { useMusic, solveChallenge } from '../model.jsx'
import { Panel, Btn, Seg, Slider, Stat, MathOnly, Tex, Explain, Challenge, fmtHz, fmtCents } from '../ui.jsx'
import { Piano, WavePlot } from '../views/views.jsx'
import { INTERVALS, intervalInfo, midiToFreq, centsBetween, beatRate, approximateRatio, ratioMonzo, parseNote, mod12 } from '../theory/index.js'

const RICH = [1, 0.5, 0.33, 0.25, 0.2, 0.16, 0.14, 0.12] // harmonics make beating audible

export default function IntervalRoom() {
  const { model, name, tonicMidi } = useMusic()
  const [low, setLow] = useState(tonicMidi)
  const [semis, setSemis] = useState(7)
  const [system, setSystem] = useState('equal') // 'equal' | 'just' | 'free'
  const [detune, setDetune] = useState(0) // cents, only in free mode
  const [holding, setHolding] = useState(false)

  const info = intervalInfo(semis)
  const f1 = midiToFreq(low, model.a4)
  const ratio = system === 'just' ? info.justRatio : info.etRatio * (system === 'free' ? Math.pow(2, detune / 1200) : 1)
  const f2 = f1 * ratio
  const cents = centsBetween(f1, f2)
  const beats = beatRate(f1, f2, info.just)
  const approx = approximateRatio(ratio, 32)
  const monzo = ratioMonzo(...info.just)

  useEffect(() => {
    if (!holding) return
    audio.drone('ivl-a', { freq: f1, partials: RICH, gain: 0.18 })
    audio.drone('ivl-b', { freq: f2, partials: RICH, gain: 0.18 })
  }, [holding, f1, f2])
  useEffect(() => () => { audio.stopDrone('ivl-a'); audio.stopDrone('ivl-b') }, [])

  const toggleHold = () => {
    if (holding) { audio.stopDrone('ivl-a'); audio.stopDrone('ivl-b') }
    setHolding(!holding)
  }

  // Beat envelope over 3 seconds: |cos(π·Δ·t)|
  const envelope = useMemo(() => Array.from({ length: 600 }, (_, i) => Math.cos(Math.PI * beats * (i / 600) * 3)), [beats])

  const onKey = (m) => {
    if (m > low && m - low <= 24) setSemis(m - low)
    else { setLow(m); }
    audio.play(midiToFreq(m, model.a4))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <Panel title="Two notes" right={<Seg size="xs" value={system} onChange={(v) => { setSystem(v); setDetune(0) }} options={[{ value: 'equal', label: 'Equal temp.' }, { value: 'just', label: 'Just' }, { value: 'free', label: 'Free drag' }]} />}>
          <div className="mb-3 flex flex-wrap gap-1">
            {INTERVALS.slice(1).map((i) => (
              <Btn key={i.semitones} active={i.semitones === semis} onClick={() => setSemis(i.semitones)} className="px-2 py-1 text-xs">{i.short}</Btn>
            ))}
          </div>
          <Piano low={48} high={84} onPress={onKey}
            color={(m) => (m === low ? '#f59e0b' : m === low + semis ? '#8b5cf6' : null)}
            label={(m) => (m === low || m === low + semis ? name(m) : mod12(m) === 0 ? name(m) : '')} />
          <p className="mt-1 text-xs text-zinc-500">Click a key above the orange note to set the upper note; click below it to move the lower note.</p>
          {system === 'free' && (
            <div className="mt-3">
              <Slider label="Drag the upper note (cents from equal temperament)" value={detune} min={-50} max={50} step={0.5} onChange={setDetune} format={fmtCents} />
              <div className="mt-1 text-xs text-zinc-500">Hold both notes and drag slowly. Listen for the wobble to slow down and stop — that is the just ratio, {fmtCents(info.justCents - semis * 100)} from equal.</div>
            </div>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn tone="play" onClick={() => audio.play([f1], { dur: 1 })}>▶ {name(low)}</Btn>
            <Btn tone="play" onClick={() => audio.play([f2], { dur: 1 })}>▶ upper</Btn>
            <Btn tone="play" onClick={() => audio.play([f1, f2], { arpeggio: 0.5, dur: 1 })}>▶ Melodic</Btn>
            <Btn tone="play" onClick={() => audio.play([f1, f2], { dur: 2.5 })}>▶ Together</Btn>
            <Btn tone={holding ? 'stop' : 'ghost'} onClick={toggleHold}>{holding ? '■ Release' : '⏸ Hold both (live)'}</Btn>
          </div>
        </Panel>

        <Panel title={info.name}>
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Semitones" value={semis} accent="text-amber-300" />
            <Stat label="Upper note" value={name(low + semis)} sub={fmtHz(f2)} />
            <MathOnly>
              <Stat label="Ratio f₂/f₁" value={ratio.toFixed(4)} sub={`≈ ${approx.ratio.join(':')}`} />
              <Stat label="Size" value={`${cents.toFixed(2)}¢`} sub={`just ${info.justCents.toFixed(2)}¢`} />
            </MathOnly>
            <Stat label="Beats" value={`${beats.toFixed(2)} /s`} sub={beats < 0.05 ? 'pure — no beating' : 'wobble rate'} accent={beats < 0.05 ? 'text-emerald-400' : 'text-rose-300'} />
            <Stat label="Just ratio" value={info.just.join(':')} sub={Object.entries(monzo).map(([p, e]) => `${p}^${e}`).join(' · ')} />
          </div>
          <MathOnly>
            <div className="mt-3 space-y-1 text-sm text-zinc-300">
              <div className="text-xs uppercase tracking-wider text-zinc-500">Equal temperament</div>
              <Tex display>{`f_2 = f_1\\cdot 2^{${semis}/12} = ${f1.toFixed(2)}\\times ${info.etRatio.toFixed(4)} = ${(f1 * info.etRatio).toFixed(2)}`}</Tex>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Just intonation</div>
              <Tex display>{`f_2 = f_1\\cdot \\tfrac{${info.just[0]}}{${info.just[1]}} = ${(f1 * info.justRatio).toFixed(2)}`}</Tex>
              <div className="text-xs uppercase tracking-wider text-zinc-500">Beating</div>
              <Tex display>{`|${info.just[1]}f_2 - ${info.just[0]}f_1| = ${beats.toFixed(2)}\\ \\text{Hz}`}</Tex>
            </div>
          </MathOnly>
        </Panel>
      </div>

      <Panel title="Beating envelope · 3 seconds">
        <WavePlot ys={envelope} height={90} color={beats < 0.05 ? '#34d399' : '#fb7185'} markers={[1 / 3, 2 / 3]} />
        <div className="mt-1 text-xs text-zinc-500">
          Harmonic {info.just[0]} of the lower note ({(f1 * info.just[0]).toFixed(1)} Hz) and harmonic {info.just[1]} of the upper note ({(f2 * info.just[1]).toFixed(1)} Hz) nearly coincide. Their difference, {beats.toFixed(2)} Hz, is heard as a pulsing in loudness.
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Explain>
          <p>A <b>{info.name.toLowerCase()}</b> is {semis} semitones. In just intonation it is the ratio <b>{info.just[0]}:{info.just[1]}</b>: for every {info.just[1]} vibrations of the lower note, the upper makes {info.just[0]}. Their waves line up again after every {info.just[1]} cycles of the lower note, which is why simple ratios sound smooth.</p>
          <p>Equal temperament uses 2^({semis}/12) = {info.etRatio.toFixed(4)} instead of {info.justRatio.toFixed(4)}, a difference of {fmtCents(info.deviation)}. That is too small to hear as "out of tune" on its own, but you can hear it as <b>beating</b>: {beats.toFixed(2)} pulses per second from {name(low)}.</p>
          <p>Try the major 3rd (M3): equal temperament is 13.7¢ sharp of 5:4, so the beating is fast. The perfect 5th is only 2¢ off — slow beating. That difference shaped centuries of tuning debates.</p>
        </Explain>
        <div className="space-y-3">
          <Challenge id="interval.fifthAboveA4" prompt="Name the note a perfect fifth above A4." placeholder="e.g. C#5" hint="Count 7 semitones up." check={(v) => parseNote(v) === 76} onSolved={solveChallenge} />
          <Challenge id="interval.just660" prompt="Using a just 3:2 ratio, what frequency is a perfect fifth above 440 Hz?" placeholder="Hz" check={(v) => Math.abs(parseFloat(v) - 660) < 0.5} onSolved={solveChallenge} />
          <Challenge id="interval.fourthPlusFifth" prompt="A perfect 4th (4:3) stacked on a perfect 5th (3:2) gives what ratio?" placeholder="n:d" hint="Multiply the ratios." check={(v) => /^\s*2\s*[:/]\s*1\s*$/.test(v)} onSolved={solveChallenge} />
        </div>
      </div>
    </div>
  )
}
