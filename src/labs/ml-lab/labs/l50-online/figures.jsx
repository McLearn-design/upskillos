// Figures placed between the paragraphs of Lab 50 (50.3, 50.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Readout, MiniPlot, Path, Label, r } from '../../kit/fig.jsx'
import { adversarialLosses, expertLosses, hedge, hedgeEta, hedgeBound, followLeader, ARM_SETS, averageRegret } from './engine.js'

// ---------- 50.3 ----------
export function HedgeVsLeader() {
  const [scn, setScn] = useState('adversarial'), [mul, setMul] = useState('1')
  const T = 2000
  const res = useMemo(() => { const L = scn === 'adversarial' ? adversarialLosses(T) : expertLosses(T), N = L[0].length; return { h: hedge(L, Number(mul) * hedgeEta(T, N)), f: followLeader(L), bound: hedgeBound(T, N) } }, [scn, mul])
  const top = Math.max(50, res.h.curve.at(-1), Math.min(res.f.curve.at(-1), 1100)) * 1.1
  const pts = c => c.filter((_, i) => i % 10 === 0).map((v, i) => [10 * i, Math.min(v, top)])
  return <div>
    <Controls>
      <Radio name="s50" value={scn} onChange={setScn} options={[['adversarial', 'adversarial (2 experts)'], ['stochastic', 'best changes halfway (5 experts)']]} />
      <Radio name="m50" value={mul} onChange={setMul} options={[['0.1', 'η × 0.1'], ['1', 'η as in theory'], ['5', 'η × 5']]} />
    </Controls>
    <MiniPlot x={[0, T]} y={[0, top]} xLabel="round" yLabel="regret" label={`Regret over ${T} rounds: Hedge ${r(res.h.regret, 1)}, follow the leader ${r(res.f.regret, 1)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={pts(res.f.curve)} stroke="var(--chart-ref)" />
      <Path X={X} Y={Y} points={pts(res.h.curve)} stroke="var(--chart-model)" />
      <Path X={X} Y={Y} points={[[0, 0], [T, res.bound]]} stroke="var(--chart-val)" dash="4 3" />
      <Label X={X} Y={Y} x={T * 0.55} y={top * 0.92} color="var(--chart-ref)">follow the leader</Label>
      <Label X={X} Y={Y} x={T * 0.55} y={top * 0.8} color="var(--chart-model)">Hedge</Label>
    </>}</MiniPlot>
    <Readout>After {T} rounds: Hedge {r(res.h.regret, 1)}, follow the leader {r(res.f.regret, 1)}; Hedge’s guarantee with the theoretical η is {r(res.bound, 1)} (dashed line, reached at the end).</Readout>
  </div>
}

// ---------- 50.4 ----------
const COLS = { greedy: 'var(--chart-ref)', eps: 'var(--chart-val)', ucb: 'var(--chart-train)', ts: 'var(--chart-model)' }
const NAMES = { greedy: 'greedy', eps: 'ε-greedy', ucb: 'UCB1', ts: 'Thompson' }
export function BanditRace() {
  const [arms, setArms] = useState('easy'), [Ts, setTs] = useState('5000')
  const T = Number(Ts), res = useMemo(() => Object.fromEntries(Object.keys(NAMES).map(p => [p, averageRegret(ARM_SETS[arms].means, p, T, 12)])), [arms, Ts])
  const top = Math.max(...Object.values(res).map(x => x.curve.at(-1))) * 1.05
  return <div>
    <Controls>
      <Radio name="a50" value={arms} onChange={setArms} options={Object.entries(ARM_SETS).map(([k, v]) => [k, v.name])} />
      <Radio name="t50" value={Ts} onChange={setTs} options={[['1000', '1,000 rounds'], ['5000', '5,000 rounds']]} />
    </Controls>
    <MiniPlot x={[0, T]} y={[0, top]} xLabel="round" yLabel="average regret" label={`Average regret over 12 runs after ${T} rounds: ${Object.entries(res).map(([p, x]) => `${NAMES[p]} ${r(x.curve.at(-1), 1)}`).join(', ')}`}>{({ X, Y }) => <>
      {Object.entries(res).map(([p, x]) => <Path key={p} X={X} Y={Y} points={x.curve.map((v, i) => [Math.min(T, i * x.step), v])} stroke={COLS[p]} />)}
      {Object.keys(res).map((p, k) => <Label key={p} X={X} Y={Y} x={T * 0.03} y={top * (0.95 - 0.08 * k)} color={COLS[p]}>{NAMES[p]}</Label>)}
    </>}</MiniPlot>
    <Readout>Average regret after {T.toLocaleString('en')} rounds: {Object.entries(res).map(([p, x]) => `${NAMES[p]} ${r(x.curve.at(-1), 1)}`).join('; ')}.</Readout>
  </div>
}
