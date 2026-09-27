// Figures placed between the paragraphs of Lab 52 (52.1, 52.5), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Readout, MiniPlot, Path, VLine, Label, r } from '../../kit/fig.jsx'
import { train, trainDeep, ARCHS } from './engine.js'

// ---------- 52.1 ----------
const CFGS = { none: {}, dropout: { dropout: 0.3 }, decay: { weightDecay: 1 }, jitter: { jitter: 0.15 } }
export function RegCurves() {
  const [cfg, setCfg] = useState('none')
  const run = useMemo(() => train(CFGS[cfg]), [cfg])
  const last = run.log.at(-1), top = Math.max(0.8, ...run.log.map(l => Math.min(l.val, 1.5)))
  return <div>
    <Controls><Radio name="c52" value={cfg} onChange={setCfg} options={[['none', 'no regularization'], ['dropout', 'dropout 0.3'], ['decay', 'weight decay 1'], ['jitter', 'input jitter 0.15']]} /></Controls>
    <MiniPlot x={[0, 400]} y={[0, top]} xLabel="epoch" yLabel="loss" label={`Training and validation loss with ${cfg}: best validation loss at epoch ${run.best.epoch}; final accuracy train ${r(last.trainAcc, 3)}, validation ${r(last.valAcc, 3)}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={run.log.map(l => [l.epoch, l.train])} stroke="var(--chart-train)" dash="4 3" />
      <Path X={X} Y={Y} points={run.log.map(l => [l.epoch, Math.min(l.val, top)])} stroke="var(--chart-val)" />
      <VLine X={X} Y={Y} x={run.best.epoch} y0={0} y1={top} />
      <Label X={X} Y={Y} x={run.best.epoch + 5} y={top * 0.92}>lowest validation loss</Label>
      <Label X={X} Y={Y} x={250} y={top * 0.6} color="var(--chart-val)">validation</Label>
      <Label X={X} Y={Y} x={250} y={top * 0.1} color="var(--chart-train)">training (dashed)</Label>
    </>}</MiniPlot>
    <Readout>After 400 epochs: training accuracy {r(100 * last.trainAcc, 1)}%, validation {r(100 * last.valAcc, 1)}%. Validation loss was lowest at epoch {run.best.epoch} (accuracy {r(100 * run.best.valAcc, 1)}%) — the checkpoint early stopping keeps.</Readout>
  </div>
}

// ---------- 52.5 ----------
const SHORT = { tanh: 'plain tanh', relu: 'plain ReLU', bn: 'tanh + batch norm', res: 'tanh + residual', resln: 'ReLU + LN + residual' }
const COLS = { tanh: 'var(--muted)', relu: 'var(--chart-train)', bn: 'hsl(160, 60%, 38%)', res: 'var(--chart-val)', resln: 'hsl(275, 60%, 55%)' }
export function DepthTrain() {
  const [d, setD] = useState('16')
  const curves = useMemo(() => Object.fromEntries(Object.entries(ARCHS).map(([k, a]) => [k, trainDeep(Number(d), { ...a.opts, width: 16 }, 100)])), [d])
  const lg = v => Math.log10(Math.max(v, 1e-3))
  return <div>
    <Controls><Radio name="d52" value={d} onChange={setD} options={['2', '4', '8', '16'].map(v => [v, `depth ${v}`])} /></Controls>
    <MiniPlot x={[0, 100]} y={[-3, 1.2]} yFormat={v => String(Math.round(10 ** v * 1000) / 1000)} xLabel="training step" yLabel="training loss (log scale)" label={`Training loss over 100 steps at depth ${d}: ${Object.entries(curves).map(([k, c]) => `${ARCHS[k].name} ${r(c.at(-1), 3)}`).join('; ')}`}>{({ X, Y }) => <>
      {Object.entries(curves).map(([k, c]) => <Path key={k} X={X} Y={Y} points={c.map((v, i) => [i, lg(v)])} stroke={COLS[k]} />)}
      {Object.keys(curves).map((k, i) => <Label key={k} X={X} Y={Y} x={3} y={-1.6 - 0.28 * i} color={COLS[k]}>{SHORT[k]}</Label>)}
    </>}</MiniPlot>
    <Readout>Training loss after 100 steps at depth {d}: {Object.entries(curves).map(([k, c]) => `${ARCHS[k].name} ${r(c.at(-1), 3)}`).join('; ')}.</Readout>
  </div>
}
