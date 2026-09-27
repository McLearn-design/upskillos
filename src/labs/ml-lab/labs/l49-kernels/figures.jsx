// Figures placed between the paragraphs of Lab 49 (49.3, 49.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Readout, MiniPlot, Path, Dots, curve, r } from '../../kit/fig.jsx'
import { regData, target, krr, kfoldError, circles, kernelPCA, thresholdAccuracy } from './engine.js'

const DATA = regData()

// ---------- 49.3 ----------
export function KrrFit() {
  const [g, setG] = useState('3'), [l, setL] = useState('0.1')
  const h = { gamma: Number(g) }, lam = Number(l)
  const m = useMemo(() => krr(DATA, 'rbf', h, lam), [g, l])
  const cv = useMemo(() => kfoldError(DATA, 'rbf', h, lam), [g, l])
  return <div>
    <Controls>
      <Radio name="g49" value={g} onChange={setG} options={['0.01', '0.3', '3', '30'].map(v => [v, `γ = ${v}`])} />
      <Radio name="l49" value={l} onChange={setL} options={['0.0001', '0.01', '0.1', '1'].map(v => [v, `λ = ${v}`])} />
    </Controls>
    <MiniPlot x={[-2, 2]} y={[-2, 3]} xLabel="x" yLabel="y" label={`RBF kernel ridge with γ = ${g}, λ = ${l}; 5-fold error ${r(cv, 3)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(target, -2, 2, 200)} stroke="var(--border)" />
      <Path X={X} Y={Y} points={curve(x => Math.max(-2, Math.min(3, m.predict(x))), -2, 2, 300)} stroke="var(--chart-model)" />
      <Dots X={X} Y={Y} points={DATA.map(d => [d.x, d.y])} color="var(--chart-train)" />
    </>}</MiniPlot>
    <Readout>5-fold cross-validation error {r(cv, 3)} (the grey curve is the truth). {Number(g) >= 30 && lam < 0.01 ? 'Narrow bumps and almost no penalty: the fit spikes through each point and collapses toward 0 between them.' : Number(g) <= 0.01 ? 'Very wide bumps: the fit is nearly a low-degree curve and misses the wiggles.' : ''} The best cell of the playground’s grid is γ = 3, λ = 0.1.</Readout>
  </div>
}

// ---------- 49.4 ----------
const RINGS = circles()
export function RingsPca() {
  const [cfg, setCfg] = useState('rbf:2')
  const [key, gs] = cfg.split(':')
  const res = useMemo(() => kernelPCA(RINGS, key, { gamma: Number(gs) }), [cfg])
  const acc = [0, 1].map(c => thresholdAccuracy(res.proj.map(p => p[c]), RINGS.map(p => p.ring)))
  const xs = res.proj.map(p => p[0]), ys = res.proj.map(p => p[1]), pad = v => [Math.min(...v) * 1.1 - 1e-6, Math.max(...v) * 1.1 + 1e-6]
  return <div>
    <Controls><Radio name="k49" value={cfg} onChange={setCfg} options={[['linear:1', 'linear'], ['rbf:0.1', 'RBF γ = 0.1'], ['rbf:2', 'RBF γ = 2'], ['rbf:5', 'RBF γ = 5']]} /></Controls>
    <MiniPlot x={pad(xs)} y={pad(ys)} xLabel="component 1" yLabel="component 2" label={`Kernel PCA (${cfg}): best single-threshold separation of the rings ${r(100 * acc[0], 0)}% on component 1, ${r(100 * acc[1], 0)}% on component 2`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={res.proj.map((p, i) => [p[0], p[1], 3, RINGS[i].ring ? 'var(--chart-val)' : 'var(--chart-model)'])} opacity={0.8} />
    </>}</MiniPlot>
    <Readout>Best single threshold separating the rings: {r(100 * acc[0], 0)}% on component 1, {r(100 * acc[1], 0)}% on component 2 (50% is chance). {acc[1] === 1 || acc[0] === 1 ? 'One kernel component separates the rings perfectly — without ever seeing a label.' : ''}</Readout>
  </div>
}
