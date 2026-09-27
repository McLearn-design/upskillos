// Figures placed between the paragraphs of Lab 47 (47.2, 47.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Check, Readout, Bars, MiniPlot, Path, Dots, VLine, Label, r } from '../../kit/fig.jsx'
import { uniformExperiment, quantile, hoeffdingEps, doubleDescent } from './engine.js'

// ---------- 47.2 ----------
export function UnionGap() {
  const [K, setK] = useState('50'), [n, setN] = useState('100')
  const res = useMemo(() => { const t = uniformExperiment({ n: Number(n), K: Number(K), noise: 0.1, trials: 200 }); return { q95: quantile(t.map(x => x.maxGap), 0.95), excess: t.reduce((s, x) => s + x.excess, 0) / t.length } }, [K, n])
  const union = hoeffdingEps(Number(n), 0.05, Number(K)), single = hoeffdingEps(Number(n), 0.05)
  return <div>
    <Controls>
      <Radio name="k47" value={K} onChange={setK} options={['1', '10', '50', '200', '1000'].map(v => [v, `|H| = ${v}`])} />
      <Radio name="n47" value={n} onChange={setN} options={['25', '100', '400'].map(v => [v, `n = ${v}`])} />
    </Controls>
    <Bars items={[{ label: 'one-hypothesis bound', value: single }, { label: 'union bound', value: union }, { label: 'actual worst gap (95%)', value: res.q95, highlight: true }]} max={0.5} digits={3} label={`n = ${n}, |H| = ${K}: single bound ${r(single, 3)}, union bound ${r(union, 3)}, actual 95th-percentile worst gap ${r(res.q95, 3)}`} />
    <Readout>With {K} thresholds and {n} examples, the union bound promises every gap below {r(union, 3)}; in 200 simulated samples the worst gap stays below {r(res.q95, 3)} 95% of the time. ERM’s average excess error is {r(res.excess, 4)}, far inside its guarantee of 2ε = {r(2 * union, 3)}. Nearly identical thresholds fail together, so counting them over-counts.</Readout>
  </div>
}

// ---------- 47.4 ----------
export function DoubleDescentFig() {
  const [ridge, setRidge] = useState(false)
  const rows = useMemo(() => doubleDescent({ ridge: ridge ? 0.1 : 1e-8 }), [ridge])
  const lx = p => Math.log10(p), ly = v => Math.log10(Math.max(v, 1e-3))
  const at = p => rows.find(x => x.p === p)
  return <div>
    <Controls><Check label="add a ridge penalty (λ = 0.1)" checked={ridge} onChange={setRidge} /></Controls>
    <MiniPlot x={[Math.log10(2), Math.log10(400)]} y={[-3, 2]} xTicks={3} yTicks={6} xFormat={v => String(Math.round(10 ** v))} yFormat={v => String(Math.round(10 ** v * 1000) / 1000)} xLabel="number of random features p (log scale)" yLabel="mean squared error (log scale)" label={`Double descent with n = 40: test error ${rows.map(x => `${x.p}:${r(x.test, 2)}`).join(', ')}`}>{({ X, Y }) => <>
      <VLine X={X} Y={Y} x={lx(40)} y0={-3} y1={2} />
      <Label X={X} Y={Y} x={lx(40) + 0.03} y={1.7}>p = n</Label>
      <Path X={X} Y={Y} points={rows.map(x => [lx(x.p), ly(x.train)])} stroke="var(--chart-train)" dash="4 3" />
      <Path X={X} Y={Y} points={rows.map(x => [lx(x.p), ly(x.test)])} stroke="var(--chart-model)" />
      <Dots X={X} Y={Y} points={rows.map(x => [lx(x.p), ly(x.test)])} color="var(--chart-model)" rad={3} />
      <Label X={X} Y={Y} x={0.35} y={-2.6} color="var(--chart-train)">training error (dashed)</Label>
    </>}</MiniPlot>
    <Readout>Median test error: p = 20: {r(at(20).test, 2)}; p = 40 = n: {r(at(40).test, 2)}; p = 400: {r(at(400).test, 2)}. {ridge ? 'With a small ridge penalty the spike disappears.' : 'At p = n the model just barely interpolates, noise included, with huge weights; beyond it, the minimum-norm interpolant gets smoother and better.'}</Readout>
  </div>
}
