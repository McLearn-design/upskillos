// Figures placed between the paragraphs of Lab 57 (57.2, 57.3, 57.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Plot, Path, Dots, Label, Bars, r } from '../../kit/fig.jsx'
import { makeGraph, layout, hops, train, smoothing } from './engine.js'

const cache = {}
const memo = (k, f) => (cache[k] ??= f())
const G = makeGraph()
const COMM = ['var(--chart-train)', 'var(--chart-val)', 'hsl(150, 55%, 40%)']
const HOP = ['hsl(0, 75%, 50%)', 'hsl(30, 90%, 50%)', 'hsl(50, 90%, 45%)', 'hsl(190, 70%, 45%)', 'hsl(220, 60%, 60%)']

// ---------- 57.2 ----------
export function ReceptiveField() {
  const [src, setSrc] = useState('0'), [L, setL] = useState(2)
  const P = useMemo(() => memo('layout', () => layout(G)), [])
  const d = useMemo(() => hops(G, Number(src), 4), [src])
  const seen = d.filter(v => v <= L).length, other = d.filter((v, i) => v <= L && G.y[i] !== G.y[Number(src)]).length
  const xs = P.map(p => p[0]), ys = P.map(p => p[1]), pad = 0.15, bx = [Math.min(...xs) - pad, Math.max(...xs) + pad], by = [Math.min(...ys) - pad, Math.max(...ys) + pad]
  return <div>
    <Controls>
      <Radio name="s57" value={src} onChange={setSrc} options={[['0', 'node 0'], ['4', 'node 4'], ['17', 'node 17']]} />
      <Slider label="Layers" value={L} min={0} max={4} step={1} digits={0} onChange={setL} />
    </Controls>
    <Plot x={bx} y={by} width={460} height={300} grid={false} xLabel="" yLabel="" xFormat={() => ''} yFormat={() => ''} label={`The playground's graph: nodes within ${L} hops of node ${src} are coloured by distance; ${seen} of 90 nodes`}>{({ X, Y }) => <>
      {G.edges.map(([a, b], k) => <line key={k} x1={X(P[a][0])} y1={Y(P[a][1])} x2={X(P[b][0])} y2={Y(P[b][1])} stroke="var(--border)" strokeWidth="1" />)}
      <Dots X={X} Y={Y} points={P.map((p, i) => [p[0], p[1], i === Number(src) ? 7 : 4.5, d[i] <= L ? HOP[d[i]] : 'var(--muted)'])} opacity={0.95} />
    </>}</Plot>
    <Readout>After {L} layer{L === 1 ? '' : 's'}, node {src} depends on {seen} of the 90 nodes ({r(100 * seen / 90, 0)}%) — red is the node itself, then orange, yellow, teal and blue for 1–4 hops. {seen > 1 ? `${other} of them (${r(100 * other / seen, 0)}%) belong to other communities.` : ''}</Readout>
  </div>
}

// ---------- 57.3 ----------
export function GcnVsMlp() {
  const [per, setPer] = useState('2')
  const res = useMemo(() => memo(`r${per}`, () => ['gcn', 'mlp'].map(kind => [1, 2, 3, 4, 5].map(s => train(G, kind, { perClass: Number(per), labelSeed: s }).acc))), [per])
  const mean = a => a.reduce((s, v) => s + v, 0) / a.length
  return <div>
    <Controls><Radio name="p57" value={per} onChange={setPer} options={[['1', '1 label per community'], ['2', '2 labels'], ['5', '5 labels']]} /></Controls>
    <Bars items={[...res[0].map((v, i) => ({ label: `GCN ${i + 1}`, value: v, color: 'var(--chart-val)' })), ...res[1].map((v, i) => ({ label: `MLP ${i + 1}`, value: v, color: 'var(--chart-train)' }))]} max={1} digits={2} label={`Accuracy on unlabelled nodes for 5 choices of labelled nodes, ${per} per community: GCN mean ${r(mean(res[0]), 3)}, MLP mean ${r(mean(res[1]), 3)}`} />
    <Readout>With {per} labelled node{per === '1' ? '' : 's'} per community, the GCN labels {r(100 * mean(res[0]), 0)}% of the unlabelled nodes correctly on average (range {r(100 * Math.min(...res[0]), 0)}–{r(100 * Math.max(...res[0]), 0)}%); the MLP on the same features gets {r(100 * mean(res[1]), 0)}%, near the 33% of guessing. Numbers 1–5: which nodes were labelled.</Readout>
  </div>
}

// ---------- 57.4 ----------
export function SmoothingFig() {
  const rows = useMemo(() => memo('smooth', () => smoothing(G)), [])
  const s0 = rows[0].spread
  return <div>
    <MiniPlot x={[0, 6]} y={[0, 1]} xTicks={7} xFormat={v => String(rows[Math.round(v)]?.k ?? '')} xLabel="propagation steps k" yLabel="share" label={`Probe accuracy and feature spread (relative to step 0) after k propagation steps: accuracy ${rows.map(x => r(x.acc, 2)).join(', ')}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={rows.map((x, i) => [i, x.acc])} stroke="var(--chart-val)" />
      <Dots X={X} Y={Y} points={rows.map((x, i) => [i, x.acc])} color="var(--chart-val)" rad={3.5} />
      <Path X={X} Y={Y} points={rows.map((x, i) => [i, x.spread / s0])} stroke="var(--chart-train)" dash="4 3" />
      <Label X={X} Y={Y} x={2.2} y={0.58} color="var(--chart-val)">probe accuracy</Label>
      <Label X={X} Y={Y} x={2.2} y={0.48} color="var(--chart-train)">relative feature spread (dashed)</Label>
    </>}</MiniPlot>
    <Readout>Averaging over neighbours first removes noise: the probe rises from {r(100 * rows[0].acc, 0)}% to {r(100 * Math.max(...rows.map(x => x.acc)), 0)}% by k = {rows.reduce((b, x) => (x.acc > b.acc ? x : b)).k}. Then it erases the differences between communities too: at k = 32 the spread is {r(rows.at(-1).spread / s0 * 100, 2)}% of the original and the probe is back to {r(100 * rows.at(-1).acc, 0)}%.</Readout>
  </div>
}
