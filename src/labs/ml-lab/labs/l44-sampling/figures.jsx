// Figures placed between the paragraphs of Lab 44 (44.2, 44.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Label, curve, r } from '../../kit/fig.jsx'
import { target1d, logNorm, importance, TRUE_MEAN, TRUE_P_POS, TARGETS, metropolis, ess, rhat, STARTS, STEPS } from './engine.js'

// ---------- 44.2 ----------
export function ImportanceFig() {
  const [qm, setQm] = useState(-2), [qs, setQs] = useState(0.6)
  const res = useMemo(() => importance(qm, qs, 1000, 1), [qm, qs])
  return <div>
    <Controls>
      <Slider label="proposal mean" value={qm} min={-3} max={3} step={0.25} onChange={setQm} digits={2} />
      <Slider label="proposal sd" value={qs} min={0.3} max={4} step={0.1} onChange={setQs} digits={1} />
    </Controls>
    <MiniPlot x={[-6, 6]} y={[0, 0.8]} xLabel="θ" yLabel="density" label={`Target and proposal N(${qm}, ${qs}²): estimated mean ${r(res.estimate, 2)} (true ${r(TRUE_MEAN, 2)}), ESS ${r(res.ess, 0)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(x => Math.exp(target1d(x)), -6, 6, 300)} stroke="var(--chart-model)" />
      <Path X={X} Y={Y} points={curve(x => Math.min(0.8, Math.exp(logNorm(x, qm, qs))), -6, 6, 300)} stroke="var(--chart-ref)" dash="4 3" />
      <Label X={X} Y={Y} x={-5.8} y={0.74} color="var(--chart-model)">target</Label>
      <Label X={X} Y={Y} x={-5.8} y={0.66} color="var(--chart-ref)">proposal (dashed)</Label>
    </>}</MiniPlot>
    <Readout>Estimated mean {r(res.estimate, 3)} (true {r(TRUE_MEAN, 3)}); P(θ &gt; 0) {r(res.probPositive, 3)} (true {r(TRUE_P_POS, 3)}); ESS {r(res.ess, 0)} of 1,000. {res.ess > 300 && Math.abs(res.estimate - TRUE_MEAN) > 0.5 ? 'A healthy ESS and a wrong answer: the proposal never visits the other mode.' : 'Make the proposal cover both modes with room to spare, and the estimate and the ESS both become trustworthy.'}</Readout>
  </div>
}

// ---------- 44.4 ----------
const COLS = ['var(--chart-model)', 'var(--chart-val)', 'var(--chart-train)', 'var(--chart-ref)']
export function TraceFig() {
  const [target, setTarget] = useState('twoModes'), [ss, setSs] = useState('0.5')
  const step = Number(ss), n = 5000
  const kept = useMemo(() => STARTS.map((s, j) => metropolis(TARGETS[target].logp, s, step, n, 20 + j).chain.slice(500).map(p => p[0])), [target, ss])
  const R = rhat(kept), E = kept.map(c => ess(c))
  return <div>
    <Controls>
      <Radio name="t44" value={target} onChange={setTarget} options={[['corr', 'correlated Gaussian'], ['twoModes', 'two modes']]} />
      <Radio name="s44" value={ss} onChange={setSs} options={STEPS.map(v => [String(v), `step ${v}`])} />
    </Controls>
    <MiniPlot x={[0, 4500]} y={[-4, 4]} xLabel="iteration (after warm-up)" yLabel="θ₁" label={`Traces of four chains; R̂ ${r(R, 2)}; ESS per chain ${E.map(e => r(e, 0)).join(', ')}`}>{({ X, Y }) => <>
      {kept.map((c, j) => <Path key={j} X={X} Y={Y} points={c.filter((_, i) => i % 5 === 0).map((v, i) => [5 * i, Math.max(-4, Math.min(4, v))])} stroke={COLS[j]} />)}
    </>}</MiniPlot>
    <Readout>Step {step}: R̂ = {r(R, 2)}{R > 1.01 ? ' — the chains disagree' : ' — the chains agree'}; ESS per chain {E.map(e => r(e, 0)).join(', ')} of 4,500. {target === 'twoModes' && R > 1.1 ? 'Most chains look like healthy caterpillars, but in different places: only comparing chains reveals it.' : ''}</Readout>
  </div>
}
