// Figures placed between the paragraphs of Lab 41 (41.2, 41.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, VLine, Label, curve, r } from '../../kit/fig.jsx'
import { betaPdf, coinPosterior, flips, curveData, truth, gaussFeatures, bayesLinReg } from './engine.js'

// ---------- 41.2 ----------
const FLIPS = flips(0.8, 100, 1)
export function BetaUpdate() {
  const [prior, setPrior] = useState('2,2'), [n, setN] = useState(10)
  const [a, b] = prior.split(',').map(Number), seen = FLIPS.slice(0, n), h = seen.reduce((s, v) => s + v, 0)
  const post = coinPosterior(a, b, h, n - h)
  const top = Math.max(3, ...curve(p => betaPdf(p, post.A, post.B), 0.005, 0.995, 100).map(q => q[1]))
  return <div>
    <Controls>
      <Radio name="prior41" value={prior} onChange={setPrior} options={[['1,1', 'uniform Beta(1, 1)'], ['2,2', 'mild Beta(2, 2)'], ['20,20', 'strong fairness Beta(20, 20)']]} />
      <Slider label="flips seen (true P(heads) = 0.8)" value={n} min={0} max={100} step={1} onChange={setN} digits={0} />
    </Controls>
    <MiniPlot x={[0, 1]} y={[0, top * 1.05]} xLabel="θ = P(heads)" yLabel="density" label={`Prior Beta(${a}, ${b}) and posterior Beta(${post.A}, ${post.B}) after ${h} heads in ${n} flips; posterior mean ${r(post.mean, 3)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(p => betaPdf(p, a, b), 0.005, 0.995, 100)} stroke="var(--chart-ref)" dash="4 3" />
      <Path X={X} Y={Y} points={curve(p => betaPdf(p, post.A, post.B), 0.005, 0.995, 200)} stroke="var(--chart-model)" />
      <VLine X={X} Y={Y} x={post.lo} y0={0} y1={top * 0.3} color="var(--chart-model)" />
      <VLine X={X} Y={Y} x={post.hi} y0={0} y1={top * 0.3} color="var(--chart-model)" />
      <Label X={X} Y={Y} x={0.03} y={top * 0.95} color="var(--chart-ref)">dashed: prior</Label>
    </>}</MiniPlot>
    <Readout>{h} heads in {n} flips. Posterior Beta({post.A}, {post.B}): mean {r(post.mean, 3)}, 95% credible interval [{r(post.lo, 3)}, {r(post.hi, 3)}] (short marks){n ? `; maximum likelihood says ${r(h / n, 3)}` : ''}. The strong prior holds the mean near 0.5 for many flips; the data win in the end.</Readout>
  </div>
}

// ---------- 41.4 ----------
const PTS = curveData(15, 41)
export function PredictiveBand() {
  const [n, setN] = useState(6)
  const model = useMemo(() => bayesLinReg(PTS.slice(0, n), x => gaussFeatures(x), 0.1, 16), [n])
  const xs = Array.from({ length: 121 }, (_, i) => -0.1 + 1.2 * i / 120), pr = xs.map(x => model.predict(x))
  const at = x => Math.sqrt(model.predict(x).variance)
  return <div>
    <Controls><Slider label="observations" value={n} min={0} max={15} step={1} onChange={setN} digits={0} /></Controls>
    <MiniPlot x={[-0.1, 1.1]} y={[-3, 3]} xLabel="x" yLabel="y" label={`Bayesian linear regression with ${n} observations: predictive mean and ±2 standard deviations`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={xs.map((x, i) => [x, Math.min(3, pr[i].mean + 2 * Math.sqrt(pr[i].variance))])} stroke="var(--chart-ref)" dash="4 3" />
      <Path X={X} Y={Y} points={xs.map((x, i) => [x, Math.max(-3, pr[i].mean - 2 * Math.sqrt(pr[i].variance))])} stroke="var(--chart-ref)" dash="4 3" />
      <Path X={X} Y={Y} points={curve(truth, 0, 1, 100)} stroke="var(--border)" />
      <Path X={X} Y={Y} points={xs.map((x, i) => [x, pr[i].mean])} stroke="var(--chart-model)" />
      <Dots X={X} Y={Y} points={PTS.slice(0, n).map(d => [d.x, d.y])} color="var(--chart-train)" />
    </>}</MiniPlot>
    <Readout>Predictive standard deviation at x = 0.5: {r(at(0.5), 3)}; at x = 1.1, beyond the data: {r(at(1.1), 3)}; the noise alone is 0.25. The band (dashed, ±2 sd) is narrow where observations constrain the weights and never narrower than the noise.</Readout>
  </div>
}
