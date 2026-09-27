// Figures placed between the paragraphs of Lab 60 (60.2, 60.3, 60.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, VLine, Label, Bars, curve, r } from '../../kit/fig.jsx'
import { TRAIN, CALIB, TEST, trainGaussian, trainQuantiles, scorers, conformalize, evaluate, binnedCoverage, pinball } from './engine.js'
import { random, normal } from '../../kit/math.js'

const cache = {}
const memo = (k, g) => (cache[k] ??= g())

// ---------- 60.2 ----------
const rng0 = random(7), SAMPLE = Array.from({ length: 400 }, () => normal(rng0)).sort((a, b) => a - b)
export function PinballFig() {
  const [tau, setTau] = useState(0.9)
  const loss = q => SAMPLE.reduce((s, y) => s + pinball(tau, y, q), 0) / SAMPLE.length
  const qs = Array.from({ length: 241 }, (_, i) => -3 + 6 * i / 240), best = qs.reduce((b, q) => (loss(q) < loss(b) ? q : b)), emp = SAMPLE[Math.ceil(tau * SAMPLE.length) - 1]
  return <div>
    <Controls><Slider label="τ" value={tau} min={0.1} max={0.9} step={0.1} digits={1} onChange={setTau} /></Controls>
    <MiniPlot x={[-3, 3]} y={[0, 2]} xTicks={7} xLabel="constant prediction q" yLabel="mean pinball loss" label={`Mean pinball loss of 400 standard-normal points for τ = ${tau}; minimized at ${r(best, 2)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(q => Math.min(loss(q), 2), -3, 3, 120)} stroke="var(--chart-val)" />
      <VLine X={X} Y={Y} x={best} y0={0} y1={2} />
      <Label X={X} Y={Y} x={best + 0.08} y={1.8}>minimum</Label>
    </>}</MiniPlot>
    <Readout>For τ = {tau} the loss is lowest at q = {r(best, 2)}; the sample’s {r(100 * tau, 0)}th percentile is {r(emp, 2)}. Points above q cost τ = {tau} per unit, points below cost 1 − τ = {r(1 - tau, 1)}, so the minimum sits where a fraction τ of the points lie below.</Readout>
  </div>
}

// ---------- 60.3 ----------
export function RankFig() {
  const [alpha, setAlpha] = useState(0.1)
  const ns = Array.from({ length: 60 }, (_, i) => 5 + 5 * i), finite = ns.filter(n => Math.ceil((n + 1) * (1 - alpha)) <= n), nMin = finite[0] ?? Infinity
  const nMinExact = (() => { for (let n = 1; n < 1000; n++) if (Math.ceil((n + 1) * (1 - alpha)) <= n) return n; return Infinity })()
  return <div>
    <Controls><Slider label="α" value={alpha} min={0.05} max={0.3} step={0.05} digits={2} onChange={setAlpha} /></Controls>
    <MiniPlot x={[0, 300]} y={[0.6, 1]} xTicks={7} xLabel="calibration points n" yLabel="expected coverage" yFormat={v => `${Math.round(100 * v)}%`} label={`Guaranteed range of expected coverage against n for α = ${alpha}: from ${1 - alpha} to 1 − α + 1/(n + 1); q is infinite below n = ${nMinExact}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={finite.map(n => [n, 1 - alpha])} stroke="var(--chart-train)" />
      <Path X={X} Y={Y} points={finite.map(n => [n, Math.min(1, 1 - alpha + 1 / (n + 1))])} stroke="var(--chart-val)" />
      {Number.isFinite(nMin) && <VLine X={X} Y={Y} x={nMinExact} y0={0.6} y1={1} />}
      <Label X={X} Y={Y} x={150} y={1 - alpha - 0.03} color="var(--chart-train)">lower bound 1 − α</Label>
      <Label X={X} Y={Y} x={150} y={Math.min(0.985, 1 - alpha + 0.035)} color="var(--chart-val)">upper bound 1 − α + 1/(n + 1)</Label>
    </>}</MiniPlot>
    <Readout>At α = {alpha} the conformal quantile needs at least {nMinExact} calibration points (below that q = ∞). With n = 100 the expected coverage lies between {r(100 * (1 - alpha), 1)}% and {r(100 * (1 - alpha + 1 / 101), 1)}%; any single calibration draw can still land outside that range.</Readout>
  </div>
}

// ---------- 60.4 ----------
export function BinCoverage() {
  const [kind, setKind] = useState('abs')
  const S = useMemo(() => memo('S', () => scorers({ point: trainGaussian(TRAIN, { seed: 1 }), quant: trainQuantiles(TRAIN) })), [])
  const bins = useMemo(() => memo(kind, () => { const c = conformalize(S, kind, CALIB, 0.1); return binnedCoverage(evaluate(S, kind, c.q, TEST)) }), [kind, S])
  return <div>
    <Controls><Radio name="k60" value={kind} onChange={setKind} options={[['abs', 'absolute residual'], ['norm', 'normalized'], ['cqr', 'CQR']]} /></Controls>
    <Bars items={bins.map(b => ({ label: `${b.a} to ${b.b}`, value: b.coverage, highlight: b.coverage < 0.85 }))} max={1} digits={2} label={`Coverage of 90% conformal intervals by x-bin, ${kind} score: ${bins.map(b => `${b.a} to ${b.b}: ${r(b.coverage, 2)}`).join('; ')}`} />
    <Readout>Coverage of the 90% intervals on 2,000 test points, by range of x (bins with less than 85% are highlighted); mean width by bin {bins.map(b => r(b.width, 2)).join(', ')}. {kind === 'abs' ? 'One width for every x: the quiet middle is always covered, the noisy edges only about 80% of the time.' : 'The width follows the estimated noise, so coverage is more even across x — though nothing guarantees it for any one bin.'}</Readout>
  </div>
}
