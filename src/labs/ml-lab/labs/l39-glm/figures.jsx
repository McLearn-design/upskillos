// Figures placed between the paragraphs of Lab 39 (39.4, 39.5), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Check, Readout, MiniPlot, Path, Dots, Label, r } from '../../kit/fig.jsx'
import { makeData, objective, newton, gradientDescent, optimum, gaps, standardizer, lwrData, lwrFit, lwrLoo, TAUS } from './engine.js'

// ---------- 39.4 ----------
export function NewtonRace() {
  const [fam, setFam] = useState('bernoulli'), [std, setStd] = useState(false)
  const { gn, gd } = useMemo(() => {
    const d = makeData(fam), o = objective(fam, d, standardizer(d, std).f), best = optimum(o)
    return { gn: gaps(o, newton(o, [0, 0], 12), best), gd: gaps(o, gradientDescent(o, [0, 0], 40), best) }
  }, [fam, std])
  const lg = v => Math.max(-16, Math.log10(v))
  return <div>
    <Controls>
      <Radio name="fam39" value={fam} onChange={setFam} options={[['gaussian', 'Gaussian'], ['bernoulli', 'logistic'], ['poisson', 'Poisson']]} />
      <Check label="standardize x" checked={std} onChange={setStd} />
    </Controls>
    <MiniPlot x={[0, 40]} y={[-16, 2]} xLabel="step" yLabel="log₁₀ (loss − optimum)" label={`Loss gap by step for the ${fam} model${std ? ' on standardized x' : ''}: Newton reaches ${gn[6].toExponential(0)} after 6 steps; gradient descent ${gd[40].toExponential(0)} after 40`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={gd.map((v, i) => [i, lg(v)])} stroke="var(--chart-ref)" />
      <Path X={X} Y={Y} points={gn.map((v, i) => [i, lg(v)])} stroke="var(--chart-model)" />
      <Dots X={X} Y={Y} points={gn.map((v, i) => [i, lg(v)])} color="var(--chart-model)" rad={3} />
      <Label X={X} Y={Y} x={14} y={-13} color="var(--chart-model)">Newton</Label>
      <Label X={X} Y={Y} x={26} y={lg(gd[26]) + 1.2} color="var(--chart-ref)">gradient descent</Label>
    </>}</MiniPlot>
    <Readout>Newton: {gn.slice(0, 7).map(v => v.toExponential(0)).join(' → ')}. Gradient descent after 40 steps: {gd[40].toExponential(1)}. {std ? 'Standardizing x helps gradient descent a great deal; Newton’s gaps are unchanged — it is affine invariant.' : 'On raw x the loss surface is stretched and gradient descent crawls; tick “standardize x” and compare.'}</Readout>
  </div>
}

// ---------- 39.5 ----------
const LD = lwrData(), LOO = TAUS.map(t => lwrLoo(LD, t)), BEST = LOO.indexOf(Math.min(...LOO))
export function BandwidthLOO() {
  const [ks, setK] = useState('3'), k = Number(ks)
  const tau = TAUS[k], xs = Array.from({ length: 101 }, (_, i) => i / 10)
  const curve = xs.map(x => [x, lwrFit(LD, x, tau).predict(x)])
  return <div>
    <Controls><Radio name="tau39" value={ks} onChange={setK} options={TAUS.map((t, i) => [String(i), `τ = ${Number.isFinite(t) ? t : '∞'}`])} /></Controls>
    <MiniPlot x={[0, 10]} y={[-1.5, 4.5]} xLabel="x" yLabel="y" label={`Locally weighted regression with τ = ${tau}: leave-one-out error ${r(LOO[k], 3)}`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={LD.map(d => [d.x, d.y])} color="var(--chart-train)" rad={2.5} />
      <Path X={X} Y={Y} points={curve} stroke="var(--chart-model)" />
    </>}</MiniPlot>
    <Readout>τ = {Number.isFinite(tau) ? tau : '∞'}: leave-one-out error {r(LOO[k], 3)}. The smallest leave-one-out error is at τ = {TAUS[BEST]} ({r(LOO[BEST], 3)}); τ = ∞ is a single straight line ({r(LOO.at(-1), 3)}).</Readout>
  </div>
}
