// Figures placed between the paragraphs of Lab 55 (55.1, 55.3, 55.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Path, Dots, Label, Bars, r } from '../../kit/fig.jsx'
import { TRAIN_TEXT, TEST_TEXT, VOCAB, ngramModel, interpolatedModel, bitsPerChar } from './engine.js'

const cache = {}
const memo = (k, f) => (cache[k] ??= f())
const shownChar = c => (c === ' ' ? '␣' : c === '\n' ? '⏎' : c)
const entropyBits = p => -p.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0)
const top = (p, k) => p.map((v, i) => [v, i]).sort((a, b) => b[0] - a[0]).slice(0, k)

// ---------- 55.1 ----------
const CONTEXTS = ['th', 'the ', 'the b', 'the mod', 'data ']
export function NextChar() {
  const [ctx, setCtx] = useState('the mod'), [n, setN] = useState(4)
  const p = useMemo(() => memo(`i${n}`, () => interpolatedModel(TRAIN_TEXT, n)).dist(ctx), [ctx, n])
  const h = entropyBits(p), best = top(p, 8)
  return <div>
    <Controls>
      <Radio name="c55" value={ctx} onChange={setCtx} options={CONTEXTS.map(c => [c, `“${c.replace(/ /g, '␣')}”`])} />
      <Slider label="Order n" value={n} min={1} max={5} step={1} digits={0} onChange={setN} />
    </Controls>
    <Bars items={best.map(([v, i], k) => ({ label: shownChar(VOCAB[i]), value: v, highlight: k === 0 }))} max={1} digits={2} label={`The 8 most likely next characters after “${ctx}” under the interpolated ${n}-gram`} />
    <Readout>With {n - 1} character{n === 2 ? '' : 's'} of context, the model sees “{ctx.slice(ctx.length - (n - 1)).replace(/ /g, '␣') || '(nothing)'}”. Its next-character distribution has entropy {r(h, 2)} bits — as uncertain as a uniform choice among {r(2 ** h, 1)} characters (all 28: 4.81 bits).</Readout>
  </div>
}

// ---------- 55.3 ----------
export function SmoothingCurves() {
  const [kind, setKind] = useState('addk')
  const rows = useMemo(() => memo(kind, () => [1, 2, 3, 4, 5, 6].map(n => { const m = kind === 'addk' ? ngramModel(TRAIN_TEXT, n, 0.1) : interpolatedModel(TRAIN_TEXT, n); return { n, train: bitsPerChar(m, TRAIN_TEXT), test: bitsPerChar(m, TEST_TEXT) } })), [kind])
  const best = rows.reduce((b, x) => (x.test < b.test ? x : b))
  return <div>
    <Controls><Radio name="k55" value={kind} onChange={setKind} options={[['addk', 'add-k (k = 0.1)'], ['interp', 'interpolated']]} /></Controls>
    <MiniPlot x={[1, 6]} y={[0, 5]} xTicks={6} yTicks={6} xFormat={v => String(Math.round(v))} xLabel="order n" yLabel="bits per character" label={`Training and held-out bits per character by order, ${kind === 'addk' ? 'add-k' : 'interpolated'}: best held-out ${r(best.test, 3)} at n = ${best.n}`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={rows.map(x => [x.n, x.train])} stroke="var(--chart-train)" dash="4 3" />
      <Path X={X} Y={Y} points={rows.map(x => [x.n, x.test])} stroke="var(--chart-val)" />
      <Dots X={X} Y={Y} points={[[best.n, best.test]]} color="var(--chart-val)" rad={5} />
      <Label X={X} Y={Y} x={1.1} y={0.9} color="var(--chart-val)">held-out</Label>
      <Label X={X} Y={Y} x={1.1} y={0.4} color="var(--chart-train)">training (dashed)</Label>
    </>}</MiniPlot>
    <Readout>Best held-out: {r(best.test, 3)} bits at n = {best.n} (perplexity {r(2 ** best.test, 2)}). {kind === 'addk' ? 'Held-out bits rise from n = 4 while training bits still fall: longer contexts are mostly unseen, and add-k spreads their mass over all 28 characters.' : 'Unseen long contexts fall back on shorter ones, so held-out bits keep falling to n = 5 and barely rise at n = 6.'}</Readout>
  </div>
}

// ---------- 55.4 ----------
export function TemperatureBars() {
  const [T, setT] = useState(1), [k, setK] = useState(0)
  const base = useMemo(() => memo('i4the', () => interpolatedModel(TRAIN_TEXT, 4).dist('the ')), [])
  let p = base.map(v => Math.pow(Math.max(v, 1e-12), 1 / T))
  if (k) { const cut = [...p].sort((a, b) => b - a)[k - 1]; p = p.map(v => (v >= cut ? v : 0)) }
  const s = p.reduce((a, b) => a + b, 0); p = p.map(v => v / s)
  const best = top(p, 8), h = entropyBits(p)
  return <div>
    <Controls>
      <Slider label="Temperature" value={T} min={0.2} max={2} step={0.1} digits={1} onChange={setT} />
      <Slider label="Top-k (0 = off)" value={k} min={0} max={10} step={1} digits={0} onChange={setK} />
    </Controls>
    <Bars items={best.map(([v, i], j) => ({ label: shownChar(VOCAB[i]), value: v, highlight: j === 0 }))} max={1} digits={2} label={`Next-character probabilities after “the␣” at temperature ${T}${k ? `, top-${k}` : ''}`} />
    <Readout>After “the␣” (interpolated 4-gram): the most likely next character has probability {r(best[0][0], 2)}; entropy {r(h, 2)} bits, {p.filter(v => v > 0.001).length} characters above 0.1%. {T < 0.6 ? 'Low temperature: nearly always the same choice — the road to “the the the”.' : T > 1.4 ? 'High temperature: rare characters gain mass — the road to gibberish.' : ''}</Readout>
  </div>
}
