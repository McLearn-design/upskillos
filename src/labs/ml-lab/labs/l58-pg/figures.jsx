// Figures placed between the paragraphs of Lab 58 (58.1, 58.2, 58.3), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Label, Bars, VLine, curve, r } from '../../kit/fig.jsx'
import { METHODS, train, movingAverage, pRight, gradientSpread } from './engine.js'

const cache = {}
const memo = (k, f) => (cache[k] ??= f())
const SEED_COL = ['var(--chart-val)', 'var(--chart-train)', 'hsl(150, 55%, 40%)']

// ---------- 58.1 ----------
export function PolicyCurve() {
  const [w, setW] = useState(5)
  const p = th => pRight([0, 0, w, 0, 0], [0, 0, th, 0])
  return <div>
    <Controls><Slider label="Weight θ on the pole angle" value={w} min={0} max={20} step={1} digits={0} onChange={setW} /></Controls>
    <MiniPlot x={[-0.2, 0.2]} y={[0, 1]} xLabel="pole angle (radians; failure beyond ±0.21)" yLabel="π(push right | s)" label={`Probability of pushing right against pole angle for weight ${w}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(p, -0.2, 0.2)} stroke="var(--chart-val)" />
      <VLine X={X} Y={Y} x={0.05} y0={0} y1={1} />
      <Label X={X} Y={Y} x={0.055} y={0.1}>0.05 rad</Label>
    </>}</MiniPlot>
    <Readout>With the pole leaning 0.05 rad to the right, the policy pushes right with probability {r(p(0.05), 3)}. {w === 0 ? 'Weight 0: a coin flip everywhere — random pushing, about 22 steps per episode.' : 'The policy stays stochastic: larger weights make it more decisive, and training has to discover them from rewards alone.'}</Readout>
  </div>
}

// ---------- 58.2 ----------
export function SeedCurves() {
  const [m, setM] = useState('reinforce')
  const runs = useMemo(() => memo(m, () => [1, 2, 3].map(s => movingAverage(train(m, { ...METHODS[m].opts, seed: s }).returns))), [m])
  return <div>
    <Controls><Radio name="m58" value={m} onChange={setM} options={[['reinforce', 'plain REINFORCE'], ['baseline', 'with a learned baseline']]} /></Controls>
    <MiniPlot x={[0, 400]} y={[0, 200]} xLabel="episode" yLabel="steps (20-episode average)" label={`${METHODS[m].name}: 20-episode averages after 400 episodes for seeds 1–3: ${runs.map(a => r(a.at(-1), 0)).join(', ')}`}>{({ X, Y }) => <>
      {runs.map((a, i) => <Path key={i} X={X} Y={Y} points={a.map((v, e) => [e + 1, v])} stroke={SEED_COL[i]} />)}
      {runs.map((a, i) => <Label key={`l${i}`} X={X} Y={Y} x={12} y={190 - 16 * i} color={SEED_COL[i]}>seed {i + 1}</Label>)}
    </>}</MiniPlot>
    <Readout>After 400 episodes the three seeds balance for {runs.map(a => r(a.at(-1), 0)).join(', ')} steps on average (maximum 200). {m === 'reinforce' ? 'Same algorithm, same learning rate: one seed stalls near random pushing while the others climb.' : 'With a baseline, all three climb.'}</Readout>
  </div>
}

// ---------- 58.3 ----------
const NAMES = ['cart x', 'cart ẋ', 'angle', 'ang. vel.', 'bias']
export function SpreadBars() {
  const g = useMemo(() => memo('spread', () => gradientSpread([0, 0, 0, 0, 0])), [])
  return <div>
    <Bars items={NAMES.flatMap((n, i) => [{ label: n, value: g.plain.sd[i], color: 'var(--chart-train)' }, { label: '− b', value: g.baseline.sd[i], color: 'var(--chart-val)' }])} digits={1} height={150} label={`Standard deviation of 200 single-episode gradient estimates per policy weight, without (blue) and with (orange) a baseline: ${NAMES.map((n, i) => `${n} ${r(g.plain.sd[i], 1)} → ${r(g.baseline.sd[i], 1)}`).join('; ')}`} />
    <Readout>Blue: spread of 200 single-episode estimates of each gradient component at the random policy; orange (“− b”): the same episodes with the baseline subtracted. Every spread shrinks — by {r(100 * Math.min(...NAMES.map((_, i) => 1 - g.baseline.sd[i] / g.plain.sd[i])), 0)}–{r(100 * Math.max(...NAMES.map((_, i) => 1 - g.baseline.sd[i] / g.plain.sd[i])), 0)}% — while the means stay within sampling noise of each other (pole angle: {r(g.plain.mean[2], 2)} and {r(g.baseline.mean[2], 2)}).</Readout>
  </div>
}
