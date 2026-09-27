// Figures placed between the paragraphs of Lab 48 (48.2, 48.5), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, Label, r } from '../../kit/fig.jsx'
import { kkt, lassoProblem, ista, subgradient } from './engine.js'

// ---------- 48.2 ----------
export function KktFig() {
  const [a1, setA1] = useState(2), [a2, setA2] = useState(1), [b, setB] = useState(1)
  const s = kkt([a1, a2], b), s2 = kkt([a1, a2], b + 0.1)
  const circle = rad => Array.from({ length: 81 }, (_, i) => [a1 + rad * Math.cos(2 * Math.PI * i / 80), a2 + rad * Math.sin(2 * Math.PI * i / 80)])
  return <div>
    <Controls>
      <Slider label="a₁" value={a1} min={-2} max={3} step={0.25} onChange={setA1} digits={2} />
      <Slider label="a₂" value={a2} min={-2} max={3} step={0.25} onChange={setA2} digits={2} />
      <Slider label="b (constraint x₁ + x₂ ≤ b)" value={b} min={-1} max={3} step={0.25} onChange={setB} digits={2} />
    </Controls>
    <MiniPlot x={[-6, 9]} y={[-3, 4]} xLabel="x₁" yLabel="x₂" label={`Minimize distance to a = (${a1}, ${a2}) subject to x₁ + x₂ ≤ ${b}: x* = (${r(s.x[0], 2)}, ${r(s.x[1], 2)}), λ = ${r(s.lambda, 2)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={[[b - 4, 4], [b + 3, -3]]} stroke="var(--chart-val)" />
      <Label X={X} Y={Y} x={-5.8} y={-2.7} color="var(--chart-val)">feasible: below and left of the line</Label>
      {s.active && [0.5, 1].map(k => <Path key={k} X={X} Y={Y} points={circle(k * Math.sqrt(2 * s.fStar))} stroke="var(--border)" dash="4 3" />)}
      <Dots X={X} Y={Y} points={[[a1, a2, 4, 'var(--chart-ref)'], [s.x[0], s.x[1], 6, 'var(--chart-model)']]} opacity={1} />
      <Label X={X} Y={Y} x={a1 + 0.15} y={a2 + 0.15} color="var(--chart-ref)">a</Label>
      <Label X={X} Y={Y} x={s.x[0] + 0.15} y={s.x[1] - 0.35} color="var(--chart-model)">x*</Label>
    </>}</MiniPlot>
    <Readout>{s.active ? `The constraint is active: x* = (${r(s.x[0], 3)}, ${r(s.x[1], 3)}), λ = ${r(s.lambda, 3)} > 0, f* = ${r(s.fStar, 3)}. Raising b by 0.1 changes f* by ${r(s2.fStar - s.fStar, 4)} (−0.1 λ = ${r(-0.1 * s.lambda, 4)}).` : 'a is feasible, so the constraint does nothing: x* = a, λ = 0, and relaxing b changes nothing.'}</Readout>
  </div>
}

// ---------- 48.5 ----------
const P = lassoProblem(), LAMS = [0.01, 0.03, 0.1, 0.3, 1]
export function LassoRace() {
  const [lam, setLam] = useState('0.1')
  const runs = useMemo(() => { const l = Number(lam), I = ista(P, l), F = ista(P, l, 200, true), S = subgradient(P, l), best = Math.min(...I.hist, ...F.hist); return { I, F, S, best } }, [lam])
  const lg = v => Math.max(-12, Math.log10(Math.max(v - runs.best, 1e-16)))
  const zeros = w => w.filter(v => v === 0).length
  return <div>
    <Controls><Radio name="lam48" value={lam} onChange={setLam} options={LAMS.map(v => [String(v), `λ = ${v}`])} /></Controls>
    <MiniPlot x={[0, 200]} y={[-12, 1]} xLabel="iteration" yLabel="log₁₀ (objective − optimum)" label={`Lasso with λ = ${lam}: ISTA, FISTA and subgradient descent`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={runs.S.hist.map((v, i) => [i, lg(v)])} stroke="var(--chart-ref)" />
      <Path X={X} Y={Y} points={runs.I.hist.map((v, i) => [i, lg(v)])} stroke="var(--chart-model)" />
      <Path X={X} Y={Y} points={runs.F.hist.map((v, i) => [i, lg(v)])} stroke="var(--chart-val)" dash="4 3" />
      <Label X={X} Y={Y} x={120} y={-1} color="var(--chart-ref)">subgradient</Label>
      <Label X={X} Y={Y} x={60} y={-10.5} color="var(--chart-model)">ISTA</Label>
      <Label X={X} Y={Y} x={60} y={-8.5} color="var(--chart-val)">FISTA (dashed)</Label>
    </>}</MiniPlot>
    <Readout>Exact zeros among 30 coefficients: ISTA {zeros(runs.I.w)}, FISTA {zeros(runs.F.w)}, subgradient {zeros(runs.S.w)}. The proximal step lands exactly on zero; subgradient steps only hover near it.</Readout>
  </div>
}
