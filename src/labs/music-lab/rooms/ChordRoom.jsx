// Chord builder + progression/voice-leading lab.
import { useRef, useState } from 'react'
import { audio } from '../audio/labAudio.js'
import { useMusic, solveChallenge } from '../model.jsx'
import { Panel, Btn, MathOnly, Tex, Explain, Challenge } from '../ui.jsx'
import { Piano, PitchCircle, Staff } from '../views/views.jsx'
import {
  CHORDS, INTERVALS, identifyChord, normalizeSet, intervalInfo, justChordRatio, mod12, SHARP_NAMES,
  SCALES, diatonicChord, romanNumeral, closestVoicing, voiceLeadingDistance,
} from '../theory/index.js'

const ADDABLE = [
  { s: 3, label: 'm3' }, { s: 4, label: 'M3' }, { s: 5, label: 'P4' }, { s: 6, label: '♭5' }, { s: 7, label: 'P5' },
  { s: 8, label: '♯5' }, { s: 9, label: '6' }, { s: 10, label: 'm7' }, { s: 11, label: 'M7' }, { s: 2, label: '2' }, { s: 14, label: '9' },
]

const MAJOR = SCALES.find((s) => s.id === 'major').intervals
const PRESET_PROGS = [
  { name: 'I–IV–V–I', degs: [0, 3, 4, 0] },
  { name: 'I–V–vi–IV (pop)', degs: [0, 4, 5, 3] },
  { name: 'ii–V–I (jazz)', degs: [1, 4, 0, 0] },
  { name: 'vi–IV–I–V', degs: [5, 3, 0, 4] },
  { name: 'I–vi–ii–V (50s)', degs: [0, 5, 1, 4] },
]

export default function ChordRoom() {
  const { model, set, freq, name, pcName, tonicMidi } = useMusic()
  const [inversion, setInversion] = useState(0)
  const [prog, setProg] = useState([0, 3, 4, 0])
  const [smooth, setSmooth] = useState(true)
  const [step, setStep] = useState(-1)
  const timers = useRef([])

  const chord = normalizeSet(model.chord).length ? [...new Set(model.chord)].sort((a, b) => a - b) : [0]
  const n = chord.length
  const inv = Math.min(inversion, Math.max(0, n - 1))
  const voicing = chord.map((i, k) => tonicMidi + i + (k < inv ? 12 : 0)).sort((a, b) => a - b)
  const id = identifyChord(voicing.map(mod12), voicing[0], { flats: model.flats })
  const ratio = n > 1 && chord.every((i) => i <= 24) ? justChordRatio(chord, (s) => intervalInfo(s).just) : null

  const toggle = (s) => {
    if (s === 0) return
    set({ chord: chord.includes(s) ? chord.filter((x) => x !== s) : [...chord, s].sort((a, b) => a - b) })
    setInversion(0)
  }
  const play = (arp = 0) => audio.play(voicing.map(freq), { arpeggio: arp, dur: arp ? 0.8 : 1.6 })

  // ── Progression ──
  const triads = MAJOR.map((_, d) => diatonicChord(MAJOR, d, 3))
  const voicings = []
  prog.forEach((d, i) => {
    const pcs = triads[d].map((x) => mod12(model.tonic + x))
    if (i === 0 || !smooth) voicings.push(triads[d].map((x) => tonicMidi + x))
    else voicings.push(closestVoicing(voicings[i - 1], pcs))
  })
  const totalMove = voicings.slice(1).reduce((s, v, i) => s + voiceLeadingDistance(voicings[i], v), 0)

  const playProg = () => {
    timers.current.forEach(clearTimeout)
    const beat = 0.9
    voicings.forEach((v, i) => {
      audio.play(v.map(freq), { delay: i * beat, dur: beat * 0.95 })
      audio.play([freq(tonicMidi - 12 + triads[prog[i]][0])], { delay: i * beat, dur: beat * 0.95, velocity: 0.6 })
      timers.current.push(setTimeout(() => setStep(i), i * beat * 1000))
    })
    timers.current.push(setTimeout(() => setStep(-1), voicings.length * beat * 1000 + 200))
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1fr_300px]">
        <Panel title="Chord builder">
          <div className="mb-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs uppercase tracking-wider text-zinc-500">Root</span>
            {SHARP_NAMES.map((_, pc) => (
              <Btn key={pc} active={pc === model.tonic} className="w-10 px-0 py-1 text-xs" onClick={() => set({ tonic: pc })}>{pcName(pc)}</Btn>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs uppercase tracking-wider text-zinc-500">Add above root</span>
            {ADDABLE.map((a) => (
              <Btn key={a.s} active={chord.includes(a.s)} className="px-2 py-1 text-xs" onClick={() => toggle(a.s)}>+{a.label}</Btn>
            ))}
          </div>
          <div className="mb-3 flex flex-wrap items-center gap-1">
            <span className="mr-1 text-xs uppercase tracking-wider text-zinc-500">Presets</span>
            {CHORDS.slice(0, 11).map((c) => (
              <Btn key={c.id} className="px-2 py-1 text-xs" onClick={() => { set({ chord: c.intervals }); setInversion(0) }}>{pcName(model.tonic)}{c.symbol || 'maj'}</Btn>
            ))}
          </div>
          <div className="grid gap-3 md:grid-cols-[1fr_160px]">
            <Piano low={tonicMidi - 5} high={tonicMidi + 28} onPress={(m) => toggle(m - tonicMidi)}
              color={(m) => (m === voicing[0] ? '#f59e0b' : voicing.includes(m) ? '#8b5cf6' : null)}
              label={(m) => (voicing.includes(m) ? pcName(m) : '')} />
            <Staff midis={voicing} stacked flats={model.flats} />
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <Btn tone="play" onClick={() => play(0)}>▶ Block</Btn>
            <Btn tone="play" onClick={() => play(0.2)}>▶ Broken</Btn>
            <Btn onClick={() => setInversion((i) => (i + 1) % n)} disabled={n < 2}>Invert ({['root', '1st', '2nd', '3rd', '4th'][inv]})</Btn>
          </div>
        </Panel>
        <div className="space-y-4">
          <Panel title="What you built">
            <div className="text-center">
              <div className="font-mono text-3xl text-amber-300">{id?.symbol ?? '?'}</div>
              <div className="text-sm text-zinc-300">{id ? `${id.name} · ${id.inversionName}` : 'Not a chord in the lab dictionary'}</div>
              <div className="mt-1 font-mono text-xs text-zinc-500">{voicing.map(name).join(' ')}</div>
            </div>
            <PitchCircle active={voicing} root={id?.root ?? model.tonic} size={200} flats={model.flats} />
          </Panel>
          <MathOnly>
            <Panel title="Numbers">
              <Tex display>{`\\{${chord.join(', ')}\\}`}</Tex>
              {ratio && <Tex display>{`\\text{just: } ${ratio.join(' : ')}`}</Tex>}
              <div className="mt-1 text-xs text-zinc-400">
                {chord.slice(1).map((s) => `${INTERVALS[s % 12]?.short ?? s} = ${s} semitones`).join(' · ')}
              </div>
            </Panel>
          </MathOnly>
        </div>
      </div>

      <Panel title={`Progression in ${pcName(model.tonic)} major`} right={
        <label className="flex items-center gap-2 text-xs text-zinc-400"><input type="checkbox" checked={smooth} onChange={(e) => setSmooth(e.target.checked)} className="accent-violet-500" />Smooth voice leading</label>
      }>
        <div className="mb-3 flex flex-wrap gap-1">
          {PRESET_PROGS.map((p) => <Btn key={p.name} className="px-2 py-1 text-xs" onClick={() => setProg(p.degs)}>{p.name}</Btn>)}
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
          {prog.map((d, i) => {
            const v = voicings[i]
            const prev = voicings[i - 1]
            const ch = identifyChord(v.map(mod12), null, { flats: model.flats })
            return (
              <div key={i} className={`rounded-lg border p-2 ${step === i ? 'border-amber-400 bg-amber-400/10' : 'border-zinc-700 bg-zinc-950'}`}>
                <select value={d} onChange={(e) => setProg((p) => p.map((x, j) => (j === i ? Number(e.target.value) : x)))}
                  className="w-full rounded border border-zinc-700 bg-zinc-900 px-1 font-serif text-lg text-amber-300" aria-label={`Chord ${i + 1}`}>
                  {MAJOR.map((_, k) => <option key={k} value={k}>{romanNumeral(MAJOR, k)}</option>)}
                </select>
                <div className="mt-1 text-center font-mono text-sm text-zinc-200">{ch?.symbol}</div>
                <div className="mt-1 flex flex-col-reverse items-center font-mono text-xs">
                  {v.map((m) => {
                    const common = prev?.includes(m)
                    return <span key={m} className={common ? 'text-emerald-400' : 'text-zinc-400'}>{name(m)}{common ? ' =' : ''}</span>
                  })}
                </div>
              </div>
            )
          })}
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Btn tone="play" onClick={playProg}>▶ Play progression</Btn>
          <span className="text-sm text-zinc-400">Total voice movement: <b className="font-mono text-zinc-100">{totalMove}</b> semitones <span className="text-emerald-400">(= held common tone)</span></span>
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Explain>
          {id ? <p><b>{id.symbol}</b> is a {id.name}: root {pcName(id.root)} plus {id.chord.intervals.slice(1).map((s) => intervalInfo(s).name.toLowerCase()).join(' and ')}. </p> : <p>This set of notes isn't in the lab's chord dictionary. Try removing a note.</p>}
          <p>Major and minor triads differ by one note: the 3rd. M3 (4 semitones) above the root gives major, m3 (3 semitones) gives minor. Swap them and listen.</p>
          {ratio && <p>In just intonation these notes vibrate in the ratio <b>{ratio.join(':')}</b>. The major triad 4:5:6 is literally harmonics 4, 5 and 6 of one fundamental, which is part of why it sounds so stable.</p>}
          <p>In the progression, each chord is a Roman numeral: its position in the key. With smooth voice leading on, each chord is re-voiced to move as little as possible — notes shared between chords stay put (green), others step to the nearest chord tone. Turn it off to hear the jumpier root-position version.</p>
        </Explain>
        <div className="space-y-3">
          <Challenge id="chord.eMinor" prompt="Build E minor in the builder (root E), then press Check." placeholder="(no typing needed)" check={() => id?.root === 4 && id?.chord.id === 'min'} onSolved={solveChallenge} hint="Root E, add m3 and P5." />
          <Challenge id="chord.g7Notes" prompt="Which note does G7 add on top of the G major triad?" placeholder="note name" check={(v) => /^f$/i.test(v)} hint="A minor 7th is 10 semitones above the root." onSolved={solveChallenge} />
        </div>
      </div>
    </div>
  )
}
