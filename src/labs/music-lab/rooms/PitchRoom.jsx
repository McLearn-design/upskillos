// Pitch & Tuning room: frequency ↔ note, cents, and the tuning systems compared.
import { useEffect, useState } from 'react'
import { audio } from '../audio/labAudio.js'
import { useMusic, solveChallenge } from '../model.jsx'
import { Panel, Btn, Seg, Slider, Stat, MathOnly, Tex, Explain, Challenge, fmtHz, fmtCents } from '../ui.jsx'
import { Piano } from '../views/views.jsx'
import {
  freqToMidi, nearestNote, parseNote, midiToFreq, centsBetween, wavelength,
  TUNINGS, getTuning, tunedFreq, PYTHAGOREAN_COMMA, intervalInfo, mod12,
} from '../theory/index.js'

export default function PitchRoom() {
  const { model, set, freq: tuned, name, pcName, tonicMidi } = useMusic()
  const [freq, setFreq] = useState(261.63)
  const [text, setText] = useState('C4')
  const [playing, setPlaying] = useState(false)

  useEffect(() => { if (playing) audio.drone('pitch', { freq, type: 'sine', gain: 0.25 }) }, [playing, freq])
  useEffect(() => () => audio.stopDrone('pitch'), [])

  const near = nearestNote(freq, model.a4)
  const exactMidi = freqToMidi(freq, model.a4)

  const goNote = (t) => {
    setText(t)
    const m = parseNote(t)
    if (m != null) setFreq(midiToFreq(m, model.a4))
  }

  const tuning = getTuning(model.tuning)
  const rows = Array.from({ length: 13 }, (_, i) => {
    const m = tonicMidi + i
    const et = midiToFreq(m, model.a4)
    const t = tunedFreq(m, { tuning: model.tuning, tonic: model.tonic, a4: model.a4 })
    return { i, m, et, t, dev: centsBetween(et, t), info: intervalInfo(i) }
  })
  const triad = [0, 4, 7, 12].map((i) => tonicMidi + i)

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
        <Panel title="Frequency explorer">
          <div className="space-y-4">
            <Slider label="Frequency (log scale: equal distances are equal ratios)" value={freq} min={27.5} max={4186} log onChange={setFreq} format={fmtHz} />
            <CentsRuler near={near} />
            <Piano low={48} high={84} onPress={(m) => { setFreq(tuned(m)); setText(name(m)); audio.play(tuned(m)) }}
              color={(m) => (m === near.midi ? '#f59e0b' : null)} label={(m) => (mod12(m) === 0 ? name(m) : '')} />
            <div className="flex flex-wrap items-center gap-2">
              <Btn tone={playing ? 'stop' : 'play'} onClick={() => { if (playing) audio.stopDrone('pitch'); setPlaying(!playing) }}>{playing ? '■ Stop' : '▶ Hold tone'}</Btn>
              <Btn onClick={() => setFreq((f) => f * Math.pow(2, 1 / 12))}>+1 semitone</Btn>
              <Btn onClick={() => setFreq((f) => f * Math.pow(2, 1 / 1200) ** 10)}>+10¢</Btn>
              <Btn onClick={() => setFreq((f) => f / Math.pow(2, 1 / 12))}>−1 semitone</Btn>
              <form onSubmit={(e) => { e.preventDefault(); goNote(text) }} className="flex gap-1">
                <input value={text} onChange={(e) => setText(e.target.value)} className="w-20 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1 font-mono text-sm" aria-label="Note name" />
                <Btn tone="ghost" type="submit">Go</Btn>
              </form>
            </div>
          </div>
        </Panel>
        <Panel title="Readout">
          <div className="grid grid-cols-2 gap-2">
            <Stat label="Nearest note" value={near.name} sub={fmtCents(near.cents)} accent="text-amber-300" />
            <Stat label="Frequency" value={freq.toFixed(2)} sub="Hz" />
            <MathOnly>
              <Stat label="MIDI (exact)" value={exactMidi.toFixed(2)} sub="69 = A4" />
              <Stat label="From A4" value={`${centsBetween(model.a4, freq).toFixed(0)}¢`} sub={`ratio ${(freq / model.a4).toFixed(4)}`} />
              <Stat label="Wavelength" value={`${wavelength(freq).toFixed(2)} m`} sub="in air" />
              <Stat label="Octave" value={Math.floor(exactMidi / 12) - 1} sub="scientific" />
            </MathOnly>
          </div>
          <MathOnly>
            <div className="mt-3 space-y-1 text-zinc-300">
              <Tex display>{`f = ${model.a4}\\cdot 2^{(m-69)/12}`}</Tex>
              <Tex display>{`m = 69 + 12\\log_2\\!\\left(\\tfrac{${freq.toFixed(1)}}{${model.a4}}\\right) = ${exactMidi.toFixed(2)}`}</Tex>
            </div>
          </MathOnly>
          <div className="mt-3">
            <Slider label="Reference A4" value={model.a4} min={415} max={466} step={1} onChange={(v) => set({ a4: v })} format={(v) => `${v} Hz`} />
          </div>
        </Panel>
      </div>

      <Panel
        title={`Tuning systems · scale on ${pcName(model.tonic)}`}
        right={<Seg size="xs" value={model.tuning} onChange={(v) => set({ tuning: v })} options={TUNINGS.map((t) => ({ value: t.id, label: t.short }))} />}
      >
        <p className="mb-3 text-sm text-zinc-400">{tuning.blurb}</p>
        <div className="mb-3 flex flex-wrap gap-2">
          <Btn tone="play" onClick={() => audio.play(triad.map((m) => midiToFreq(m, model.a4)), { dur: 2.2 })}>▶ Major chord · 12-TET</Btn>
          <Btn tone="play" onClick={() => audio.play(triad.map(tuned), { dur: 2.2 })}>▶ Major chord · {tuning.short}</Btn>
          <Btn tone="ghost" onClick={() => audio.play(rows.slice(0, 13).map((r) => r.t), { arpeggio: 0.18, dur: 0.3 })}>▶ Chromatic run · {tuning.short}</Btn>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-zinc-500">
              <tr><th className="py-1">Note</th><th>Interval</th><MathOnly><th>Just ratio</th></MathOnly><th className="text-right">12-TET Hz</th><th className="text-right">{tuning.short} Hz</th><th className="text-right">Δ cents</th><th /></tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.i} className="border-t border-zinc-800">
                  <td className="py-1 font-mono text-zinc-100">{name(r.m)}</td>
                  <td className="text-zinc-300">{r.info.name}</td>
                  <MathOnly><td className="font-mono text-zinc-400">{r.info.just.join(':')}</td></MathOnly>
                  <td className="text-right font-mono text-zinc-400">{r.et.toFixed(2)}</td>
                  <td className="text-right font-mono text-zinc-100">{r.t.toFixed(2)}</td>
                  <td className={`text-right font-mono ${Math.abs(r.dev) < 0.05 ? 'text-zinc-500' : r.dev > 0 ? 'text-sky-400' : 'text-rose-400'}`}>{fmtCents(r.dev)}</td>
                  <td className="text-right"><button type="button" className="px-2 text-emerald-400" onClick={() => audio.play([r.t])} aria-label={`Play ${name(r.m)}`}>▶</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Explain>
          <p>Pitch is <b>logarithmic</b>: we hear equal <em>ratios</em> as equal steps. That is why the frequency slider above is on a log scale, and why we measure intervals in <b>cents</b>: 1200 per octave, 100 per equal-tempered semitone, cents = 1200·log₂(f₂/f₁).</p>
          <p>Tuning systems disagree because the "pure" intervals don't fit together. Twelve pure 3:2 fifths should land on the starting note seven octaves up, but overshoot by the <b>Pythagorean comma</b>, {PYTHAGOREAN_COMMA.toFixed(2)}¢. Equal temperament shares that error out: each fifth is 2¢ narrow and each major third about 14¢ wide, so every key is usable and none is pure.</p>
          <p>Play the two major chords back to back. The just chord is smoother and steadier; the 12-TET chord has a faint shimmer — that is beating from the mistuned third.</p>
        </Explain>
        <div className="space-y-3">
          <Challenge id="pitch.a5" prompt={`With A4 = ${model.a4} Hz, what is the frequency of A5?`} placeholder="Hz" hint="One octave up." check={(v) => Math.abs(parseFloat(v) - model.a4 * 2) < 0.6} onSolved={solveChallenge} />
          <Challenge id="pitch.semitoneRatio" prompt="In 12-TET, by what number do you multiply a frequency to go up one semitone? (4 decimal places)" hint="Twelve equal steps must multiply to 2." check={(v) => Math.abs(parseFloat(v) - Math.pow(2, 1 / 12)) < 0.0002} onSolved={solveChallenge} />
        </div>
      </div>
    </div>
  )
}

function CentsRuler({ near }) {
  const pct = 50 + near.cents / 2 // ±100¢ across the bar
  return (
    <div>
      <div className="relative h-8 rounded-lg bg-zinc-950">
        <div className="absolute inset-y-0 left-1/2 w-px bg-emerald-500" />
        {[-50, 50].map((c) => <div key={c} className="absolute inset-y-2 w-px bg-zinc-700" style={{ left: `${50 + c / 2}%` }} />)}
        <div className="absolute top-1 h-6 w-1.5 -translate-x-1/2 rounded bg-amber-400 transition-all" style={{ left: `${pct}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-zinc-500"><span>−100¢</span><span>{near.name} {Math.abs(near.cents) < 5 ? '✓ in tune' : fmtCents(near.cents)}</span><span>+100¢</span></div>
    </div>
  )
}
