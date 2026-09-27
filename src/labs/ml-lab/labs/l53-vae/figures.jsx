// Figures placed between the paragraphs of Lab 53 (53.1, 53.4), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Radio, Readout, MiniPlot, Dots, r } from '../../kit/fig.jsx'
import { TEST, W, H, trainAE, trainVAE, encode, decode, sampleQuality } from './engine.js'

const cache = {}
const model = (key, make) => (cache[key] ??= make())
const colour = d => `hsl(${d * 36}, 70%, 48%)`

// ---------- 53.1 ----------
export function LatentMap() {
  const [kind, setKind] = useState('ae')
  const m = useMemo(() => (kind === 'ae' ? model('ae', () => trainAE({ latent: 2 })) : model('vae1', () => trainVAE({ beta: 1 }))), [kind])
  const pts = TEST.map(t => [...encode(m, t.x), 3.5, colour(t.d)])
  const b = 2 * Math.ceil(Math.max(3.5, ...pts.map(p => Math.max(Math.abs(p[0]), Math.abs(p[1])))) / 2)
  return <div>
    <Controls><Radio name="k53" value={kind} onChange={setKind} options={[['ae', 'plain autoencoder'], ['vae', 'VAE (β = 1)']]} /></Controls>
    <MiniPlot x={[-b, b]} y={[-b, b]} xLabel="code 1" yLabel="code 2" label={`2-number codes of 200 test digits from the ${kind === 'ae' ? 'plain autoencoder' : 'VAE'}, coloured by digit`}>{({ X, Y }) => <Dots X={X} Y={Y} points={pts} opacity={0.85} />}</MiniPlot>
    <Readout>Each dot is a test digit’s 2-number code, coloured by its digit (never shown to the network). {kind === 'ae' ? 'The plain autoencoder groups digits but nothing controls where the codes go: they spread over a wide, lopsided range, and a random code from N(0, I) may land where no digit was ever encoded.' : 'The VAE’s KL term packs the codes around the origin, roughly like N(0, I): random codes from there decode to something plausible.'}</Readout>
  </div>
}

// ---------- 53.4 ----------
function Digit({ img, x, y, s }) {
  return <g>{img.map((v, i) => <rect key={i} x={x + (i % W) * s} y={y + Math.floor(i / W) * s} width={s} height={s} fill={`rgba(20, 30, 60, ${v.toFixed(3)})`} />)}</g>
}
export function BetaGrid() {
  const [beta, setBeta] = useState('1')
  const m = useMemo(() => model(`vae${beta}`, () => trainVAE({ beta: Number(beta) })), [beta])
  const K = 7, s = 5, q = sampleQuality(m), last = m.curve.at(-1)
  return <div>
    <Controls><Radio name="b53" value={beta} onChange={setBeta} options={[['0.1', 'β = 0.1'], ['1', 'β = 1'], ['4', 'β = 4']]} /></Controls>
    <svg viewBox={`0 0 ${K * (W * s + 6)} ${K * (H * s + 6)}`} role="img" aria-label={`Digits decoded from a 7 by 7 grid of codes between −2.5 and 2.5 with β = ${beta}`} style={{ maxWidth: 300, display: 'block', margin: '0 auto', background: 'white', borderRadius: 6 }}>
      {Array.from({ length: K * K }, (_, k) => { const i = Math.floor(k / K), j = k % K; return <Digit key={k} img={decode(m, [-2.5 + 5 * j / (K - 1), 2.5 - 5 * i / (K - 1)])} x={j * (W * s + 6) + 3} y={i * (H * s + 6) + 3} s={s} /> })}
    </svg>
    <Readout>β = {beta}: KL {r(last.kl, 2)} nats, reconstruction {r(last.rec, 2)}. Of 200 random codes, {r(100 * q.recognizable, 0)}% decode to a clear digit, covering {q.distinct} of the 10 digits. {Number(beta) >= 4 ? 'Posterior collapse: the codes carry almost no information, and every code decodes to nearly the same image.' : ''}</Readout>
  </div>
}
