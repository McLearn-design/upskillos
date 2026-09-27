// Figures placed between the paragraphs of Lab 61 (61.1, 61.3, 61.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Readout, MiniPlot, Path, Dots, Label, Bars, curve, r } from '../../kit/fig.jsx'
import { trainDigits, accuracyUnder, covariateExperiment, f1, labelExperiment } from './engine.js'

const cache = {}
const memo = (k, g) => (cache[k] ??= g())
const EPS = [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3]
const COL = { random: 'var(--muted)', fgsm: 'var(--chart-train)', pgd: 'var(--chart-val)' }

// ---------- 61.1 ----------
export function AttackCurve() {
  const acc = useMemo(() => memo('acc', () => { const net = trainDigits(); return Object.fromEntries(['random', 'fgsm', 'pgd'].map(a => [a, EPS.map(e => accuracyUnder(net, a, e))])) }), [])
  return <div>
    <MiniPlot x={[0, 0.3]} y={[0, 1]} xTicks={7} xLabel="budget ε per pixel" yLabel="test accuracy" yFormat={v => `${Math.round(100 * v)}%`} label={`Standard model's test accuracy against ε: random ${acc.random.map(v => r(v, 2)).join(', ')}; FGSM ${acc.fgsm.map(v => r(v, 2)).join(', ')}; PGD ${acc.pgd.map(v => r(v, 2)).join(', ')}`}>{({ X, Y }) => <>
      {Object.entries(acc).map(([a, v]) => <g key={a}><Path X={X} Y={Y} points={EPS.map((e, i) => [e, v[i]])} stroke={COL[a]} /><Dots X={X} Y={Y} points={EPS.map((e, i) => [e, v[i]])} color={COL[a]} rad={3} /></g>)}
      <Label X={X} Y={Y} x={0.16} y={0.5} color={COL.random}>random ±ε</Label>
      <Label X={X} Y={Y} x={0.16} y={0.4} color={COL.fgsm}>FGSM</Label>
      <Label X={X} Y={Y} x={0.16} y={0.3} color={COL.pgd}>PGD (10 steps)</Label>
    </>}</MiniPlot>
    <Readout>At ε = 0.1, random noise leaves {r(100 * acc.random[2], 0)}% of the 400 test digits correct; FGSM leaves {r(100 * acc.fgsm[2], 0)}% and PGD {r(100 * acc.pgd[2], 0)}%. The same budget, pointed along the gradient, does many times more damage.</Readout>
  </div>
}

// ---------- 61.3 ----------
export function WeightFig() {
  const [m, setM] = useState(1.5)
  const ex = useMemo(() => memo(`c${m}`, () => covariateExperiment({ testMean: m })), [m])
  const fits = ex.fits
  return <div>
    <Controls><Slider label="Test inputs: mean" value={m} min={0} max={2.5} step={0.5} digits={1} onChange={setM} /></Controls>
    <MiniPlot x={[-3, 4]} y={[-3, 3]} xTicks={8} xLabel="x" yLabel="y" label={`Training data, the true curve and straight-line fits with and without importance weights; test inputs centred at ${m}`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={ex.train.map(t => [t.x, t.y])} color="var(--muted)" rad={2} opacity={0.5} />
      <Dots X={X} Y={Y} points={ex.test.slice(0, 200).map(t => [t.x, t.y])} color="var(--chart-val)" rad={1.8} opacity={0.35} />
      <Path X={X} Y={Y} points={curve(f1, -3, 4)} stroke="var(--text)" dash="4 3" />
      <Path X={X} Y={Y} points={[[-3, fits.plain.predict(-3)], [4, fits.plain.predict(4)]]} stroke="var(--chart-train)" />
      <Path X={X} Y={Y} points={[[-3, fits.estW.predict(-3)], [4, fits.estW.predict(4)]]} stroke="var(--chart-val)" />
      <Label X={X} Y={Y} x={0.6} y={-2.2} color="var(--chart-train)">unweighted line</Label>
      <Label X={X} Y={Y} x={0.6} y={-2.7} color="var(--chart-val)">importance-weighted line</Label>
    </>}</MiniPlot>
    <Readout>Test MSE: unweighted {r(ex.testMse.plain, 3)}, with estimated weights {r(ex.testMse.estW, 3)} (true weights {r(ex.testMse.trueW, 3)}). The weighted fit rests on an effective {r(ex.ess.estW, 0)} of 200 training points; the domain classifier’s AUC is {r(ex.auc, 2)}.</Readout>
  </div>
}

// ---------- 61.4 ----------
export function LabelShiftFig() {
  const [pi, setPi] = useState(0.1)
  const ex = useMemo(() => memo(`l${pi}`, () => labelExperiment(pi)), [pi])
  return <div>
    <Controls><Slider label="Share of class 1 at deployment" value={pi} min={0.05} max={0.5} step={0.05} digits={2} onChange={setPi} /></Controls>
    <Bars items={[{ label: 'no correction', value: ex.none.acc }, { label: 'estimated share', value: ex.estimated.acc, highlight: true }, { label: 'true share', value: ex.oracle.acc }]} max={1} min={0} digits={3} height={140} label={`Deployment accuracy at a ${pi} share of class 1: no correction ${r(ex.none.acc, 3)}, with the BBSE share ${r(ex.estimated.acc, 3)}, with the true share ${r(ex.oracle.acc, 3)}`} />
    <Readout>True share {r(pi, 2)}; BBSE estimates {r(ex.est.pi1, 3)} from the classifier’s predicted-label rate ({r(ex.est.mu1, 3)}) and its validation confusion matrix. Accuracy without correction {r(100 * ex.none.acc, 1)}%, with the estimated share {r(100 * ex.estimated.acc, 1)}%, with the true share {r(100 * ex.oracle.acc, 1)}%; log loss {r(ex.none.logLoss, 3)} → {r(ex.estimated.logLoss, 3)}.</Readout>
  </div>
}
