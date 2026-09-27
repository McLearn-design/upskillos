// Figures placed between the paragraphs of Lab 43 (43.2, 43.3), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, Label, r } from '../../kit/fig.jsx'
import { sampleWorld, runEM, hardLabels, agreement } from './engine.js'

const COLS = ['var(--chart-model)', 'var(--chart-val)', 'var(--chart-train)']

// ---------- 43.2 ----------
export function EmSteps() {
  const [world, setWorld] = useState('three'), [t, setT] = useState(0)
  const K = world === 'three' ? 3 : 2
  const { data, hist } = useMemo(() => { const data = sampleWorld(world); return { data, hist: runEM(data.map(d => d.x), K, { seed: 2, iters: 20, floor: 1e-3 }) } }, [world])
  const step = hist[Math.min(t, hist.length - 1)], labels = hardLabels(step.R), conf = step.R.map(row => Math.max(...row))
  const unsure = conf.filter(c => c < 0.9).length
  return <div>
    <Controls>
      <Radio name="w43" value={world} onChange={v => { setWorld(v); setT(0) }} options={[['three', 'three clusters'], ['unequal', 'big and small cluster']]} />
      <Slider label="EM iteration" value={t} min={0} max={20} step={1} onChange={setT} digits={0} />
    </Controls>
    <MiniPlot x={[-5, 5]} y={[-4, 4]} xLabel="x₁" yLabel="x₂" label={`EM iteration ${t}: log-likelihood ${r(step.ll, 1)}; ${unsure} points with top responsibility below 0.9`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={data.map((d, i) => [d.x[0], d.x[1], conf[i] < 0.9 ? 2 : 3.5, COLS[labels[i]]])} opacity={0.85} />
      <Dots X={X} Y={Y} points={step.model.map((c, k) => [c.m[0], c.m[1], 7, COLS[k]])} opacity={1} />
    </>}</MiniPlot>
    <Readout>Iteration {t}: log-likelihood {r(step.ll, 1)} (it never decreases: {hist.slice(0, 21).map(h => r(h.ll, 0)).slice(0, 6).join(' → ')} …). Large dots are component means; small points are unsure (top responsibility below 0.9): {unsure} now. Agreement with the true labels: {r(100 * agreement(labels, data.map(d => d.z), K), 1)}%.</Readout>
  </div>
}

// ---------- 43.3 ----------
export function RestartCurves() {
  const runs = useMemo(() => { const data = sampleWorld('stretched'), X = data.map(d => d.x); return [1, 2, 3, 4, 5].map(s => { const h = runEM(X, 2, { seed: s, iters: 80, floor: 1e-3 }); return { s, lls: h.map(x => x.ll), agr: agreement(hardLabels(h.at(-1).R), data.map(d => d.z), 2) } }) }, [])
  return <div>
    <MiniPlot x={[0, 80]} y={[-1100, -850]} yTicks={6} xLabel="EM iteration" yLabel="log-likelihood" label={`Five EM starts on the parallel clusters; final log-likelihoods ${runs.map(x => r(x.lls.at(-1), 0)).join(', ')}`}>{({ X, Y }) => <>
      {runs.map(x => <Path key={x.s} X={X} Y={Y} points={x.lls.map((v, i) => [i, Math.max(v, -1100)])} stroke={x.agr > 0.9 ? 'var(--chart-model)' : 'var(--chart-ref)'} />)}
      <Label X={X} Y={Y} x={50} y={-880} color="var(--chart-model)">right split</Label>
      <Label X={X} Y={Y} x={50} y={-1025} color="var(--chart-ref)">wrong split</Label>
    </>}</MiniPlot>
    <Readout>Every curve rises monotonically, but some sit for dozens of iterations on a plateau (the wrong split) before climbing: {runs.map(x => `start ${x.s} ends at ${r(x.lls.at(-1), 0)} (${r(100 * x.agr, 0)}% agreement)`).join('; ')}. Stopped at 40 iterations, most would look converged on the wrong answer.</Readout>
  </div>
}
