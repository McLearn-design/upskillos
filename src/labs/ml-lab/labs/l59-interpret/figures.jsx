// Figures placed between the paragraphs of Lab 59 (59.1, 59.3, 59.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Dots, HLine, Label, Bars, r } from '../../kit/fig.jsx'
import { TRAIN, TEST, f, permutationImportance, gainImportance, shapley, BACKGROUND, lime } from './engine.js'

const cache = {}
const memo = (k, g) => (cache[k] ??= g())
const SHORT = ['size', 'lines', 'files', 'cache', 'hour', 'build id']

// ---------- 59.1 ----------
export function ImportanceBars() {
  const [on, setOn] = useState('test')
  const imp = useMemo(() => memo(on, () => on === 'gain' ? gainImportance().map(v => ({ rise: v })) : permutationImportance(on === 'test' ? TEST : TRAIN)), [on])
  const isGain = on === 'gain'
  return <div>
    <Controls><Radio name="o59" value={on} onChange={setOn} options={[['test', 'permutation, test builds'], ['train', 'permutation, training builds'], ['gain', 'gain (training splits)']]} /></Controls>
    <Bars items={imp.map((v, j) => ({ label: SHORT[j], value: v.rise, highlight: j === 5 }))} digits={isGain ? 3 : 2} label={`${isGain ? 'Share of gain importance' : 'Rise in squared error when each feature is shuffled'}: ${imp.map((v, j) => `${SHORT[j]} ${r(v.rise, 3)}`).join(', ')}`} />
    <Readout>{isGain ? `Gain importance: build id gets ${r(100 * imp[5].rise, 1)}% of the credit, hour of day ${r(100 * imp[4].rise, 1)}% — comparable, although only hour has a real effect (4 minutes).` : `Shuffling build id raises the ${on === 'test' ? 'test' : 'training'} error by ${r(imp[5].rise, 2)}${on === 'test' ? ' — nothing: the model cannot use noise on new builds.' : ' — the model memorized some noise, and it shows only on the data it was trained on.'} Lines changed scores ${r(imp[1].rise, 2)}, although it carries almost the same information as size (${r(imp[0].rise, 0)}).`}</Readout>
  </div>
}

// ---------- 59.3 ----------
export function Waterfall() {
  const [i, setI] = useState(4)
  const x = TEST[i - 1].x
  const s = useMemo(() => memo(`s${i}`, () => shapley(x, BACKGROUND)), [i]) // eslint-disable-line react-hooks/exhaustive-deps
  return <div>
    <Controls><Slider label="Test build" value={i} min={1} max={40} step={1} digits={0} onChange={setI} /></Controls>
    <Bars items={s.phi.map((p, j) => ({ label: SHORT[j], value: p, color: p >= 0 ? 'var(--chart-val)' : 'var(--chart-train)' }))} digits={2} height={170} min={1.3 * Math.min(0, ...s.phi)} label={`Shapley values for test build ${i}: ${s.phi.map((p, j) => `${SHORT[j]} ${r(p, 2)}`).join(', ')}; average prediction ${r(s.base, 2)}, prediction ${r(f(x), 2)}`} />
    <Readout>Build {i}: {r(x[0], 1)} MB, cache {x[3] ? 'hit' : 'miss'}, hour {x[4]}. Average prediction {r(s.base, 2)} min + contributions {r(s.phi.reduce((a, b) => a + b, 0), 2)} = {r(s.base + s.phi.reduce((a, b) => a + b, 0), 2)}, exactly the model’s prediction {r(f(x), 2)}. Orange raises the prediction, blue lowers it.</Readout>
  </div>
}

// ---------- 59.4 ----------
export function LimeStability() {
  const [w, setW] = useState(0.25)
  const runs = useMemo(() => memo(`l${w}`, () => [1, 2, 3, 4, 5].map(seed => lime(TEST[3].x, { width: w, seed }))), [w])
  const coefs = runs.map(l => l.coef[0].perSd), mean = a => a.reduce((s, v) => s + v, 0) / a.length
  return <div>
    <Controls><Slider label="Kernel width σ (standard deviations)" value={w} min={0.25} max={1.5} step={0.25} digits={2} onChange={setW} /></Controls>
    <MiniPlot x={[0, 6]} y={[0, 8]} xTicks={7} xFormat={v => (v >= 1 && v <= 5 ? `seed ${Math.round(v)}` : '')} xLabel="LIME run" yLabel="size coefficient (min per sd)" label={`LIME's change-size coefficient for test build 4 at width ${w}, five seeds: ${coefs.map(c => r(c, 2)).join(', ')}`}>{({ X, Y }) => <>
      <HLine X={X} Y={Y} y={mean(coefs)} x0={0.2} x1={5.8} color="var(--muted)" />
      <Dots X={X} Y={Y} points={coefs.map((c, k) => [k + 1, c])} color="var(--chart-val)" rad={6} />
      <Label X={X} Y={Y} x={0.25} y={mean(coefs) + 0.4} color="var(--muted)">mean</Label>
    </>}</MiniPlot>
    <Readout>Width {w}: the five runs give {r(Math.min(...coefs), 2)} to {r(Math.max(...coefs), 2)} minutes per standard deviation of size; local fidelity {r(mean(runs.map(l => l.fidelity)), 2)}; each fit rests on about {r(mean(runs.map(l => l.effectiveN)), 0)} of 400 samples.</Readout>
  </div>
}
