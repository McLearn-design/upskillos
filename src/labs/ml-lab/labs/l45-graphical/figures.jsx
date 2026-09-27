// Figures placed between the paragraphs of Lab 45 (45.2, 45.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Check, Readout, Bars, MiniPlot, Path, Dots, Label, r } from '../../kit/fig.jsx'
import { query, makeHMM, simulate, forward, smooth, viterbi, accuracy, argmaxRows } from './engine.js'

// ---------- 45.2 ----------
const EVID = [['fails', 'build fails'], ['outage', 'outage confirmed'], ['status', 'status page red'], ['pager', 'pager fired']]
export function ExplainAway() {
  const [ev, setEv] = useState({ fails: 1 })
  const toggle = k => v => setEv(e => { const n = { ...e }; if (v) n[k] = 1; else delete n[k]; return n })
  const pb = query('bad', ev), po = query('outage', ev)
  return <div>
    <Controls>{EVID.map(([k, label]) => <Check key={k} label={label} checked={!!ev[k]} onChange={toggle(k)} />)}</Controls>
    <Bars items={[{ label: 'P(bad commit)', value: pb, highlight: true }, { label: 'P(outage)', value: po }]} max={1} digits={3} label={`Given ${Object.keys(ev).join(', ') || 'nothing'}: P(bad commit) ${r(pb, 3)}, P(outage) ${r(po, 3)}`} />
    <Readout>Given {Object.keys(ev).length ? EVID.filter(([k]) => ev[k]).map(([, l]) => l).join(' and ') : 'nothing'}: P(bad commit) = {r(pb, 3)} (prior 0.1), P(outage) = {r(po, 3)} (prior 0.05). {ev.fails && (ev.outage || ev.status) ? 'The failure is already explained, so the bad commit becomes unlikely again: explaining away.' : ev.fails ? 'The failed build raises both causes.' : ''}</Readout>
  </div>
}

// ---------- 45.4 ----------
export function HmmStrip() {
  const [stay, setStay] = useState(0.92)
  const { d, f, s, v } = useMemo(() => { const h = makeHMM(stay, 0.7), d = simulate(h, 100, 4); return { d, f: forward(h, d.obs), s: smooth(h, d.obs), v: viterbi(h, d.obs) } }, [stay])
  const down = P => P.map((p, t) => [t, p[2]])
  return <div>
    <Controls><Slider label="probability a state persists to the next minute" value={stay} min={0.4} max={0.98} step={0.02} onChange={setStay} digits={2} /></Controls>
    <MiniPlot x={[0, 100]} y={[0, 1.2]} yTicks={4} xLabel="minute" yLabel="P(Down)" label={`P(Down) over 100 minutes, filtered and smoothed, with the true Down minutes marked; persistence ${stay}`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={d.states.map((z, t) => [t, 1.1]).filter((_, t) => d.states[t] === 2)} color="var(--chart-val)" rad={2.5} />
      <Path X={X} Y={Y} points={down(f.filtered)} stroke="var(--chart-ref)" />
      <Path X={X} Y={Y} points={down(s.smoothed)} stroke="var(--chart-model)" />
      <Label X={X} Y={Y} x={2} y={0.95} color="var(--chart-model)">smoothed</Label>
      <Label X={X} Y={Y} x={2} y={0.85} color="var(--chart-ref)">filtered</Label>
    </>}</MiniPlot>
    <Readout>States right out of 100: raw readings {r(100 * accuracy(d.obs, d.states), 0)}, filtered {r(100 * accuracy(argmaxRows(f.filtered), d.states), 0)}, smoothed {r(100 * accuracy(argmaxRows(s.smoothed), d.states), 0)}, Viterbi {r(100 * accuracy(v, d.states), 0)}. Dots along the top mark the minutes the server was truly Down.</Readout>
  </div>
}
