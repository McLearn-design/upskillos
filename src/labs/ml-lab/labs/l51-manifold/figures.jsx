// Figures placed between the paragraphs of Lab 51 (51.3, 51.5), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Readout, MiniPlot, Dots, r } from '../../kit/fig.jsx'
import { swissRoll, geodesic, classicalMDS, pca2, rankCorr, tsneData, tsne, centroid, spread } from './engine.js'

const hue = (v, lo, hi) => `hsl(${Math.round(260 * (v - lo) / (hi - lo))}, 70%, 50%)`
const box = pts => { const bx = Math.max(...pts.map(p => Math.abs(p[0]))) * 1.1, by = Math.max(...pts.map(p => Math.abs(p[1]))) * 1.1; return [[-bx, bx], [-by, by]] }

// ---------- 51.3 ----------
const ROLL = swissRoll(), RX = ROLL.map(p => p.x), RT = ROLL.map(p => p.t), LO = Math.min(...RT), HI = Math.max(...RT)
export function IsomapK() {
  const [k, setK] = useState('8')
  const emb = useMemo(() => (k === 'pca' ? pca2(RX) : classicalMDS(geodesic(RX, Number(k)))), [k])
  const rc = Math.abs(rankCorr(emb.map(p => p[0]), RT)), [bx, by] = box(emb)
  return <div>
    <Controls><Radio name="k51" value={k} onChange={setK} options={[['pca', 'PCA'], ['4', 'Isomap k = 4'], ['8', 'k = 8'], ['10', 'k = 10'], ['20', 'k = 20']]} /></Controls>
    <MiniPlot x={bx} y={by} xLabel="axis 1" yLabel="axis 2" xFormat={() => ''} yFormat={() => ''} label={`${k === 'pca' ? 'PCA' : `Isomap with k = ${k}`}: axis 1 tracks the position along the roll with rank correlation ${r(rc, 3)}`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={emb.map((p, i) => [p[0], p[1], 3, hue(RT[i], LO, HI)])} opacity={0.9} />
    </>}</MiniPlot>
    <Readout>Colour runs along the roll. Axis 1 tracks it with rank correlation {r(rc, 3)}. {k === 'pca' ? 'PCA can only project: the layers stay folded over each other.' : Number(k) >= 10 ? 'Too many neighbours: edges jump between layers and the unrolling breaks.' : 'The sheet is unrolled: colour changes smoothly along one axis.'}</Readout>
  </div>
}

// ---------- 51.5 ----------
const TD = tsneData(), TX = TD.map(p => p.x), COLS = ['hsl(215, 70%, 50%)', 'hsl(28, 85%, 52%)', 'hsl(140, 55%, 38%)']   // blue, orange, green: named in the readout
const stats = pts => { const g = [0, 1, 2].map(c => pts.filter((_, i) => TD[i].c === c)), cs = g.map(centroid); return { s: spread(g[1]) / spread(g[0]), d: Math.hypot(cs[0][0] - cs[2][0], cs[0][1] - cs[2][1]) / Math.hypot(cs[0][0] - cs[1][0], cs[0][1] - cs[1][1]) } }
export function MapRatios() {
  const [cfg, setCfg] = useState('20')
  const emb = useMemo(() => (cfg === 'pca' ? pca2(TX) : tsne(TX, { perplexity: Number(cfg), seed: 1 })), [cfg])
  const st = stats(emb), [bx, by] = box(emb)
  return <div>
    <Controls><Radio name="p51" value={cfg} onChange={setCfg} options={[['pca', 'PCA'], ['5', 't-SNE perplexity 5'], ['20', 'perplexity 20'], ['50', 'perplexity 50']]} /></Controls>
    <MiniPlot x={bx} y={by} xLabel="map axis 1" yLabel="map axis 2" xFormat={() => ''} yFormat={() => ''} label={`${cfg === 'pca' ? 'PCA' : `t-SNE perplexity ${cfg}`}: spread ratio ${r(st.s, 1)} : 1 (true 4 : 1), distance ratio ${r(st.d, 1)} : 1 (true 4.2 : 1)`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={emb.map((p, i) => [p[0], p[1], 3, COLS[TD[i].c]])} opacity={0.85} />
    </>}</MiniPlot>
    <Readout>Blue is tight, orange four times as spread, green far away (4.2 × blue–orange). In this map: spread orange : blue {r(st.s, 1)} : 1, distance green : orange {r(st.d, 1)} : 1. {cfg === 'pca' ? 'PCA keeps both roughly.' : 't-SNE keeps who is near whom, not sizes or gaps. (t-SNE is chaotic: the exact ratios can differ slightly between browsers.)'}</Readout>
  </div>
}
