// Figures placed between the paragraphs of Lab 56 (56.2, 56.3, 56.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Plot, Path, Dots, VLine, Label, curve, r } from '../../kit/fig.jsx'
import { POOL, pickLabels, labelPropagation, activeCurves } from './engine.js'

const cache = {}
const memo = (k, f) => (cache[k] ??= f())
const B = { x: [-1.5, 2.5], y: [-1, 1.5] }
const mix = s => `hsl(${Math.round(215 - 185 * s)}, 75%, ${Math.round(48 + 10 * (1 - Math.abs(2 * s - 1)))}%)`

// ---------- 56.2 ----------
const ITERS = ['1', '3', '10', '30', '60']
export function PropagationSteps() {
  const [it, setIt] = useState('3')
  const L = useMemo(() => pickLabels(2, 1), [])
  const scores = useMemo(() => memo(`p${it}`, () => labelPropagation(L, { iters: Number(it) }).scores), [it, L])
  const reached = scores.filter(s => s !== 0.5).length, right = scores.filter((s, i) => s !== 0.5 && (s >= 0.5 ? 1 : 0) === POOL[i].y).length
  return <div>
    <Controls><Radio name="i56" value={it} onChange={setIt} options={ITERS.map(v => [v, `${v} step${v === '1' ? '' : 's'}`])} /></Controls>
    <Plot x={B.x} y={B.y} width={460} height={290} xTicks={5} yTicks={6} xLabel="x₁" yLabel="x₂" label={`Label scores after ${it} propagation steps from two labelled points: ${reached} of 400 pool points reached`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={POOL.map((p, i) => [p.x[0], p.x[1], 2.6, scores[i] === 0.5 ? 'var(--muted)' : mix(scores[i])])} opacity={0.8} />
      <Dots X={X} Y={Y} points={L.map(i => [POOL[i].x[0], POOL[i].x[1], 7, POOL[i].y ? mix(1) : mix(0)])} opacity={1} />
    </>}</Plot>
    <Readout>After {it} step{it === '1' ? '' : 's'}, {reached} of the 400 unlabelled points have received some label score (grey: not yet reached); {reached ? r(100 * right / reached, 0) : 0}% of those lean toward their true class. Labels travel along each moon a few neighbours per step; where the two moons come close, some leak across the gap.</Readout>
  </div>
}

// ---------- 56.3 ----------
export function ActiveCurves() {
  const [n, setN] = useState(12)
  const c = useMemo(() => memo('curves', () => activeCurves(4, 24)), [])
  const at = s => c[s].find(x => x.labels === n).acc
  return <div>
    <Controls><Slider label="Labels" value={n} min={4} max={28} step={1} digits={0} onChange={setN} /></Controls>
    <MiniPlot x={[4, 28]} y={[0.7, 1]} xLabel="labels" yLabel="test accuracy" yFormat={v => `${Math.round(100 * v)}%`} label={`Test accuracy by number of labels, random against uncertainty sampling (average of 4 runs): at ${n} labels ${r(at('random'), 3)} against ${r(at('uncertainty'), 3)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={c.random.map(x => [x.labels, x.acc])} stroke="var(--chart-train)" dash="4 3" />
      <Path X={X} Y={Y} points={c.uncertainty.map(x => [x.labels, x.acc])} stroke="var(--chart-val)" />
      <VLine X={X} Y={Y} x={n} y0={0.7} y1={1} />
      <Label X={X} Y={Y} x={16} y={0.76} color="var(--chart-train)">random (dashed)</Label>
      <Label X={X} Y={Y} x={16} y={0.72} color="var(--chart-val)">uncertainty sampling</Label>
    </>}</MiniPlot>
    <Readout>With {n} labels (4 random, then {n - 4} chosen): random labels {r(100 * at('random'), 1)}%, uncertainty sampling {r(100 * at('uncertainty'), 1)}% — average of 4 runs, tested on 600 random points.</Readout>
  </div>
}

// ---------- 56.4 ----------
export function InfoNceTemp() {
  const [tau, setTau] = useState(0.3)
  const neg = 0.2, N = 98
  const loss = (sp, t) => { const a = sp / t, b = neg / t, m = Math.max(a, b); return -(a - m) + Math.log(Math.exp(a - m) + N * Math.exp(b - m)) }
  const top = Math.log(N + 1) + 1.5
  return <div>
    <Controls><Slider label="Temperature τ" value={tau} min={0.05} max={1} step={0.05} digits={2} onChange={setTau} /></Controls>
    <MiniPlot x={[-1, 1]} y={[0, 6]} xLabel="cosine similarity of the positive pair" yLabel="InfoNCE loss" label={`InfoNCE loss against the positive pair's similarity at τ = ${tau}, with 98 negatives at similarity 0.2`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(s => Math.min(loss(s, 1), top), -1, 1)} stroke="var(--muted)" dash="4 3" />
      <Path X={X} Y={Y} points={curve(s => Math.min(loss(s, tau), top), -1, 1)} stroke="var(--chart-val)" />
      <VLine X={X} Y={Y} x={neg} y0={0} y1={6} />
      <Label X={X} Y={Y} x={neg + 0.03} y={5.5}>negatives’ similarity</Label>
      <Label X={X} Y={Y} x={-0.95} y={0.5} color="var(--muted)">τ = 1 (dashed)</Label>
    </>}</MiniPlot>
    <Readout>At τ = {tau}: a positive pair at similarity 0.9 costs {r(loss(0.9, tau), 3)}; at 0.2, no closer than the 98 negatives, it costs log 99 = {r(loss(0.2, tau), 3)}. A small τ sharpens the softmax, so the loss rewards the partner only when it clearly beats every negative; with τ = 1 even a perfect match still costs {r(loss(1, 1), 3)}.</Readout>
  </div>
}
