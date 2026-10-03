// Scale builder: choose a root, toggle notes, and see/hear/name what you built.
import { useState } from 'react'
import { audio } from '../audio/labAudio.js'
import { useMusic, solveChallenge } from '../model.jsx'
import { Panel, Btn, MathOnly, Tex, Explain, Challenge } from '../ui.jsx'
import { Piano, PitchCircle, Staff } from '../views/views.jsx'
import { SCALES, identifyScale, stepPattern, stepLabel, normalizeSet, romanNumeral, diatonicChord, identifyChord, mod12, SHARP_NAMES, intervalInfo, centsBetween } from '../theory/index.js'

export default function ScaleRoom({ goRoom }) {
  const { model, set, freq, name, pcName, tonicMidi } = useMusic()
  const [order, setOrder] = useState('chromatic')
  const [playingIdx, setPlayingIdx] = useState(-1)
  const scale = normalizeSet(model.scale)
  const id = identifyScale(scale)
  const steps = stepPattern(scale)
  const midis = [...scale.map((i) => tonicMidi + i), tonicMidi + 12]

  const toggle = (pc) => {
    const off = mod12(pc - model.tonic)
    if (off === 0) return
    set({ scale: scale.includes(off) ? scale.filter((x) => x !== off) : normalizeSet([...scale, off]) })
    audio.play(freq(tonicMidi + off), { dur: 0.4 })
  }

  const playRun = (dir = 1) => {
    const seq = dir > 0 ? midis : [...midis].reverse()
    audio.play(seq.map(freq), { arpeggio: 0.28, dur: 0.3 })
    seq.forEach((_, i) => setTimeout(() => setPlayingIdx(dir > 0 ? i : seq.length - 1 - i), i * 280))
    setTimeout(() => setPlayingIdx(-1), seq.length * 280 + 200)
  }

  const degrees = scale.length === 7 ? scale.map((_, d) => {
    const tri = diatonicChord(scale, d, 3).map((i) => tonicMidi + i)
    const ch = identifyChord(tri.map(mod12), tri[0] % 12, { flats: model.flats })
    return { d, tri, roman: romanNumeral(scale, d), symbol: ch?.symbol ?? '?' }
  }) : []

  return (
    <div className="space-y-4">
      <Panel title="Root and preset">
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex flex-wrap gap-1">
            {SHARP_NAMES.map((_, pc) => (
              <Btn key={pc} active={pc === model.tonic} className="w-11 px-0 py-1 text-xs" onClick={() => set({ tonic: pc })}>{pcName(pc)}</Btn>
            ))}
          </div>
          <select value={id.exact?.id ?? ''} onChange={(e) => { const s = SCALES.find((x) => x.id === e.target.value); if (s) set({ scale: s.intervals }) }}
            className="rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-zinc-100" aria-label="Scale preset">
            <option value="">Custom…</option>
            {SCALES.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
          <Btn tone="play" onClick={() => playRun(1)}>▶ Up</Btn>
          <Btn tone="play" onClick={() => playRun(-1)}>▶ Down</Btn>
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
        <Panel title="Circle · click to toggle" right={<select value={order} onChange={(e) => setOrder(e.target.value)} className="rounded border border-zinc-700 bg-zinc-950 px-1 text-xs" aria-label="Circle order"><option value="chromatic">Semitones</option><option value="fifths">Fifths</option></select>}>
          <PitchCircle active={scale.map((i) => i + model.tonic)} root={model.tonic} order={order} onToggle={toggle} flats={model.flats} />
          <p className="mt-1 text-center text-xs text-zinc-500">Change the root: the shape rotates but never changes. That shape <i>is</i> the scale.</p>
        </Panel>
        <div className="space-y-4">
          <Panel title={id.exact ? `${pcName(model.tonic)} ${id.exact.name}` : `${pcName(model.tonic)} · unnamed scale (${scale.length} notes)`}>
            <Staff midis={midis} flats={model.flats} highlight={playingIdx} />
            <Piano low={tonicMidi - 2} high={tonicMidi + 26} onPress={(m) => toggle(m)}
              color={(m) => { const o = mod12(m - model.tonic); return o === 0 ? '#f59e0b' : scale.includes(o) ? '#8b5cf6' : null }}
              label={(m) => (scale.includes(mod12(m - model.tonic)) ? pcName(m) : '')} />
            <div className="mt-3 flex flex-wrap items-center gap-1 font-mono text-sm">
              <span className="mr-2 text-xs uppercase tracking-wider text-zinc-500">Steps</span>
              {steps.map((s, i) => (
                <span key={i} className={`rounded px-2 py-0.5 ${s === 1 ? 'bg-rose-500/20 text-rose-300' : s === 2 ? 'bg-sky-500/20 text-sky-300' : 'bg-amber-500/20 text-amber-300'}`}>{stepLabel(s)}</span>
              ))}
            </div>
            {id.rotations.length > 0 && (
              <div className="mt-2 text-sm text-zinc-400">
                Same notes, different home:{' '}
                {id.rotations.slice(0, 4).map((r) => `${pcName(model.tonic + r.offset)} ${r.scale.name}`).join(' · ')}
              </div>
            )}
          </Panel>
          <MathOnly>
            <Panel title="As numbers">
              <Tex display>{`S = \\{${scale.join(', ')}\\} \\subset \\mathbb{Z}_{12}`}</Tex>
              <div className="mt-2 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-xs uppercase text-zinc-500"><tr><th>Degree</th><th>Note</th><th>Semis</th><th>Just ratio</th><th className="text-right">Hz ({model.tuning})</th><th className="text-right">¢ from root</th></tr></thead>
                  <tbody>
                    {scale.map((s, i) => (
                      <tr key={s} className="border-t border-zinc-800">
                        <td className="py-0.5 text-zinc-400">{i + 1}</td>
                        <td className="font-mono text-zinc-100">{name(tonicMidi + s)}</td>
                        <td className="font-mono">{s}</td>
                        <td className="font-mono text-zinc-400">{intervalInfo(s).just.join(':')}</td>
                        <td className="text-right font-mono">{freq(tonicMidi + s).toFixed(2)}</td>
                        <td className="text-right font-mono text-zinc-400">{centsBetween(freq(tonicMidi), freq(tonicMidi + s)).toFixed(1)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Panel>
          </MathOnly>
        </div>
      </div>

      {degrees.length > 0 && (
        <Panel title="Chords that live in this scale (stack every other note)">
          <div className="grid grid-cols-7 gap-2">
            {degrees.map((g) => (
              <button key={g.d} type="button" onClick={() => audio.play(g.tri.map(freq), { dur: 1.2 })}
                onDoubleClick={() => { set({ chord: g.tri.map((m) => m - g.tri[0]), tonic: mod12(g.tri[0]) }); goRoom?.('chords') }}
                className="rounded-lg border border-zinc-700 bg-zinc-950 p-2 text-center hover:border-violet-400">
                <div className="font-serif text-lg text-amber-300">{g.roman}</div>
                <div className="font-mono text-xs text-zinc-300">{g.symbol}</div>
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-zinc-500">Click to hear. Double-click to open the chord in the Chord Builder.</p>
        </Panel>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <Explain>
          <p>A scale is a <b>set</b> of steps measured from a home note. You built {`{${scale.join(', ')}}`}, a {scale.length}-note scale with the step pattern <span className="font-mono">{steps.map(stepLabel).join(' ')}</span>.</p>
          {id.exact ? <p>That pattern is the <b>{id.exact.name}</b> scale. Any root with the same pattern gives the same kind of scale; only the starting pitch changes.</p> : <p>It doesn't match a scale in the lab's list — you've invented one. Try its sound against the major scale.</p>}
          {id.rotations.length > 0 && <p>Starting the same notes from a different degree gives a different <b>mode</b>: the notes are shared, but the "home" changes, so the pattern of steps from home changes too.</p>}
          <p>The 7 chords below come from stacking every other scale note. Their qualities (upper case = major, lower = minor, ° = diminished) follow from the step pattern alone.</p>
        </Explain>
        <div className="space-y-3">
          <Challenge id="scale.dDorian" prompt="Build D Dorian above (root D, steps W H W W W H W), then press Check." placeholder="(no typing needed)"
            hint="Set the root to D, then choose or toggle the notes." check={() => model.tonic === 2 && normalizeSet(model.scale).join() === '0,2,3,5,7,9,10'} onSolved={solveChallenge} />
          <Challenge id="scale.minorFromMajor" prompt="C major and which minor scale share exactly the same notes? (name the root)" placeholder="e.g. E" hint="Look at 'Same notes, different home'." check={(v) => /^a$/i.test(v.replace(/\s*minor/i, ''))} onSolved={solveChallenge} />
        </div>
      </div>
    </div>
  )
}
