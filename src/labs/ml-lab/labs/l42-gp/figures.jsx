// Figures placed between the paragraphs of Lab 42 (42.3, 42.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, Label, r } from '../../kit/fig.jsx'
import { gpPosterior, observations, target, ELLS, lmlCurve, grid } from './engine.js'

const ALL = observations(), G = grid(120)

// ---------- 42.3 ----------
export function GpPosterior() {
  const [n, setN] = useState(8), [sn, setSn] = useState('0.1')
  const data = ALL.slice(0, n), h = { ell: 0.2, sf: 1, sn: Number(sn) }
  const post = useMemo(() => gpPosterior(data, 'rbf', h, G), [n, sn])
  const sdAt = x => Math.sqrt(gpPosterior(data, 'rbf', h, [x]).variance[0])
  return <div>
    <Controls>
      <Slider label="observations" value={n} min={0} max={14} step={1} onChange={setN} digits={0} />
      <Radio name="sn42" value={sn} onChange={setSn} options={[['0.01', 'noise 0.01'], ['0.1', 'noise 0.1'], ['0.4', 'noise 0.4']]} />
    </Controls>
    <MiniPlot x={[-0.1, 1.1]} y={[-2.5, 2.5]} xLabel="x" yLabel="f(x)" label={`GP posterior (RBF, ℓ = 0.2) with ${n} observations and noise ${sn}; sd in the gap at x = 0.575: ${r(sdAt(0.575), 3)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={G.map((x, i) => [x, Math.min(2.5, post.mean[i] + 2 * Math.sqrt(post.variance[i]))])} stroke="var(--chart-ref)" dash="4 3" />
      <Path X={X} Y={Y} points={G.map((x, i) => [x, Math.max(-2.5, post.mean[i] - 2 * Math.sqrt(post.variance[i]))])} stroke="var(--chart-ref)" dash="4 3" />
      <Path X={X} Y={Y} points={G.map(x => [x, target(x)])} stroke="var(--border)" />
      <Path X={X} Y={Y} points={G.map((x, i) => [x, post.mean[i]])} stroke="var(--chart-model)" />
      <Dots X={X} Y={Y} points={data.map(d => [d.x, d.y])} color="var(--chart-train)" />
    </>}</MiniPlot>
    <Readout>Posterior sd in the gap (x = 0.575): {r(sdAt(0.575), 3)}; beyond the data (x = 1.05): {r(sdAt(1.05), 3)}; the prior sd is 1. With noise 0.01 the mean passes through every observation; with 0.4 it passes between them.</Readout>
  </div>
}

// ---------- 42.4 ----------
export function LmlScan() {
  const [sn, setSn] = useState('0.1')
  const curves = useMemo(() => Object.fromEntries(['rbf', 'matern', 'periodic'].map(k => [k, lmlCurve(ALL, k, 1, Number(sn))])), [sn])
  const rbf = curves.rbf, best = rbf.reduce((a, b) => (b.lml > a.lml ? b : a))
  const bestOf = k => curves[k].reduce((a, b) => (b.lml > a.lml ? b : a))
  return <div>
    <Controls><Radio name="lml42" value={sn} onChange={setSn} options={[['0.01', 'noise 0.01'], ['0.1', 'noise 0.1'], ['0.2', 'noise 0.2']]} /></Controls>
    <MiniPlot x={[-1.8, 0]} y={[-20, 0]} yTicks={5} xFormat={v => String(Math.round(10 ** v * 100) / 100)} xLabel="length scale ℓ (log scale)" yLabel="log marginal likelihood" label={`Log marginal likelihood by length scale with noise ${sn}: RBF best at ℓ = ${best.ell}`}>{({ X, Y }) => <>
      {[['rbf', 'var(--chart-model)'], ['matern', 'var(--chart-val)'], ['periodic', 'var(--chart-ref)']].map(([k, c]) => <Path key={k} X={X} Y={Y} points={curves[k].map(p => [Math.log10(p.ell), Math.max(p.lml, -20)])} stroke={c} />)}
      <Dots X={X} Y={Y} points={[[Math.log10(best.ell), best.lml]]} color="var(--chart-model)" rad={5} />
      <Label X={X} Y={Y} x={-1.75} y={-1.5} color="var(--chart-model)">RBF</Label>
      <Label X={X} Y={Y} x={-1.75} y={-3.5} color="var(--chart-val)">Matérn</Label>
      <Label X={X} Y={Y} x={-1.75} y={-5.5} color="var(--chart-ref)">periodic</Label>
    </>}</MiniPlot>
    <Readout>RBF: best ℓ = {best.ell} ({r(best.lml, 1)}; curves cut off at −20). Best of each kernel: RBF {r(bestOf('rbf').lml, 1)}, Matérn {r(bestOf('matern').lml, 1)}, periodic (period 0.5) {r(bestOf('periodic').lml, 1)} — the wrong period is rejected by a wide margin.</Readout>
  </div>
}
