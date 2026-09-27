// Figures placed between the paragraphs of Lab 40 (40.3, 40.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, HLine, Label, r } from '../../kit/fig.jsx'
import { makeSet, MODELS, errorRate, bayes, learningCurvesD } from './engine.js'

// ---------- 40.3 ----------
const NS = [10, 20, 40, 100, 400]
export function GdaBoundary() {
  const [world, setWorld] = useState('different'), [ns, setNs] = useState('400'), [model, setModel] = useState('qda')
  const n = Number(ns)
  const { train, errs, fit } = useMemo(() => {
    let train = makeSet(world, n, 17)
    if (!train.some(p => p.label) || train.every(p => p.label)) train = [...train, ...makeSet(world, 4, 3)]
    const test = makeSet(world, 2000, 999), fits = Object.fromEntries(Object.keys(MODELS).map(m => [m, MODELS[m](train)]))
    return { train, fit: fits, errs: Object.fromEntries(Object.entries(fits).map(([m, f]) => [m, errorRate(f.prob, test)])) }
  }, [world, n])
  const grid = []
  for (let i = 0; i <= 30; i++) for (let j = 0; j <= 30; j++) { const x1 = -4 + 8 * i / 30, x2 = -4 + 8 * j / 30; grid.push([x1, x2, 1.6, fit[model].prob(x1, x2) >= 0.5 ? 'var(--chart-val)' : 'var(--chart-train)']) }
  const b = bayes(world)
  return <div>
    <Controls>
      <Radio name="w40" value={world} onChange={setWorld} options={[['shared', 'shared covariance'], ['different', 'different covariances'], ['skewed', 'far subgroup']]} />
      <Radio name="m40" value={model} onChange={setModel} options={[['lda', 'LDA'], ['qda', 'QDA'], ['logistic', 'logistic']]} />
      <Radio name="n40" value={ns} onChange={setNs} options={NS.map(v => [String(v), `${v} examples`])} />
    </Controls>
    <MiniPlot x={[-4, 4]} y={[-4, 4]} xLabel="x₁" yLabel="x₂" label={`${model} fitted on ${n} examples in the ${world} world; test errors LDA ${r(errs.lda, 3)}, QDA ${r(errs.qda, 3)}, logistic ${r(errs.logistic, 3)}`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={grid} opacity={0.35} />
      <Dots X={X} Y={Y} points={train.map(p => [p.x1, p.x2, 3.5, p.label ? 'var(--chart-val)' : 'var(--chart-train)'])} opacity={0.95} />
    </>}</MiniPlot>
    <Readout>Test error with {n} examples: LDA {r(errs.lda, 3)}, QDA {r(errs.qda, 3)}, logistic {r(errs.logistic, 3)}{b ? `; the best possible (Bayes) error is ${r(errorRate(b, makeSet(world, 2000, 999)), 3)}` : ''}. The faint background shows where the chosen model predicts each class.</Readout>
  </div>
}

// ---------- 40.4 ----------
export function LearningCurvesFig() {
  const [d, setD] = useState('20')
  const res = useMemo(() => learningCurvesD(Number(d), { reps: 15 }), [d])
  const lx = n => Math.log10(n), names = { naiveBayes: 'naive Bayes', lda: 'full LDA', logistic: 'logistic' }, colors = { naiveBayes: 'var(--chart-model)', lda: 'var(--chart-val)', logistic: 'var(--chart-ref)' }
  const i40 = res.sizes.indexOf(40)
  return <div>
    <Controls><Radio name="d40" value={d} onChange={setD} options={[['2', '2 features'], ['20', '20 features']]} /></Controls>
    <MiniPlot x={[1, 2.7]} y={[0, 0.45]} yTicks={4} xFormat={v => String(Math.round(10 ** v))} xLabel="training examples (log scale)" yLabel="test error" label={`Learning curves with ${d} features; at 40 examples ${Object.entries(res.curves).map(([m, c]) => `${names[m]} ${r(c[i40], 3)}`).join(', ')}; Bayes error ${r(res.bayes, 3)}`}>{({ X, Y }) => <>
      <HLine X={X} Y={Y} y={res.bayes} x0={1} x1={2.7} color="var(--border)" />
      {Object.entries(res.curves).map(([m, c]) => <Path key={m} X={X} Y={Y} points={res.sizes.map((n, i) => [lx(n), c[i]])} stroke={colors[m]} />)}
      {Object.entries(res.curves).map(([m, c], k) => <Label key={m} X={X} Y={Y} x={2.05} y={0.43 - 0.04 * k} color={colors[m]}>{names[m]}</Label>)}
    </>}</MiniPlot>
    <Readout>At 40 examples: {Object.entries(res.curves).map(([m, c]) => `${names[m]} ${r(100 * c[i40], 1)}%`).join(', ')}; Bayes error {r(100 * res.bayes, 1)}% (grey line). {d === '20' ? 'With 20 features the assumptions of naive Bayes buy a large head start; full LDA must estimate 210 covariance entries and suffers most.' : 'With 2 features all three have few parameters, and the choice hardly matters.'}</Readout>
  </div>
}
