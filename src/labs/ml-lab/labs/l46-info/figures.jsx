// Figures placed between the paragraphs of Lab 46 (46.2, 46.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, Bars, r } from '../../kit/fig.jsx'
import { normalize, entropy, huffman, codewords, avgLength, sampleRelation, correlation, miBinned, RELATIONS } from './engine.js'

const OUT = ['passed', 'failed', 'flaky', 'timeout']

// ---------- 46.2 ----------
export function CodeLengths() {
  const [w, setW] = useState([8, 4, 2, 2])
  const p = normalize(w), L = huffman(p), words = codewords(L), H = entropy(p), avg = avgLength(p, L)
  const set = i => v => setW(ws => ws.map((x, j) => (j === i ? v : x)))
  return <div>
    <Controls>{OUT.map((o, i) => <Slider key={o} label={`weight of “${o}”`} value={w[i]} min={1} max={20} step={1} onChange={set(i)} digits={0} />)}</Controls>
    <Bars items={OUT.flatMap((o, i) => [{ label: o, value: -Math.log2(p[i]) }, { label: 'code', value: L[i], highlight: true }])} digits={2} label={`Ideal lengths −log₂p and Huffman lengths: ${OUT.map((o, i) => `${o} ${r(-Math.log2(p[i]), 2)} vs ${L[i]}`).join(', ')}`} />
    <Readout>Each pair of bars: the ideal length −log₂p, then Huffman’s codeword length (darker). Probabilities {p.map(v => r(v, 3)).join(', ')}; codewords {words.join(', ')}. Entropy {r(H, 3)} bits; Huffman average {r(avg, 3)} bits (gap {r(avg - H, 3)}). The gap is zero only when every probability is a power of ½.</Readout>
  </div>
}

// ---------- 46.4 ----------
export function MiBias() {
  const [rel, setRel] = useState('quadratic'), [bins, setBins] = useState(8)
  const pts = useMemo(() => sampleRelation(rel), [rel])
  const shuffled = useMemo(() => { const ys = sampleRelation(rel, 600, 99).map(p => p.y); return pts.map((p, i) => ({ x: p.x, y: ys[(i * 7919) % ys.length] })) }, [pts, rel])
  const mi = miBinned(pts, bins), base = miBinned(shuffled, bins)
  return <div>
    <Controls>
      <Radio name="rel46" value={rel} onChange={setRel} options={Object.entries(RELATIONS).map(([k, v]) => [k, v.name.split(':')[0]])} />
      <Slider label="bins per axis" value={bins} min={4} max={24} step={2} onChange={setBins} digits={0} />
    </Controls>
    <Bars items={[{ label: 'MI (binned)', value: mi, highlight: true }, { label: 'shuffled baseline', value: base }, { label: '|correlation|', value: Math.abs(correlation(pts)) }]} max={2} digits={3} label={`${rel}: MI ${r(mi, 3)} bits, shuffled ${r(base, 3)} bits, correlation ${r(correlation(pts), 3)} with ${bins} bins`} />
    <Readout>{RELATIONS[rel].name}. MI {r(mi, 3)} bits against a shuffled baseline of {r(base, 3)} — the baseline should be 0, so it measures the estimator’s upward bias, which grows with the number of bins. Correlation {r(correlation(pts), 3)}.</Readout>
  </div>
}
