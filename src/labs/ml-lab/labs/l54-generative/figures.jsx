// Figures placed between the paragraphs of Lab 54 (54.1, 54.2, 54.3), built on the lab's own engine.
import React, { useMemo, useState } from 'react'
import { Controls, Slider, Radio, Readout, MiniPlot, Plot, Path, Dots, Label, curve, r } from '../../kit/fig.jsx'
import { sampleTarget, modeCoverage, modeShares, trainGAN, GAN_PRESETS, schedule, noiseTo, T_STEPS } from './engine.js'
import { random, normal } from '../../kit/math.js'

const pdf = (x, m, s) => Math.exp(-0.5 * ((x - m) / s) ** 2) / (s * Math.sqrt(2 * Math.PI))
const B = [-3.2, 3.2], REAL = sampleTarget('ring', 300, random(77))
const cache = {}
const memo = (k, f) => (cache[k] ??= f())

// ---------- 54.1 ----------
export function OptimalD() {
  const [m, setM] = useState(1), [s, setS] = useState(1.5)
  const dStar = x => { const a = pdf(x, 0, 1), b = pdf(x, m, s); return a / (a + b) }
  // Jensen–Shannon divergence by numerical integration.
  let js = 0; const dx = 0.005
  for (let x = -14; x <= 14; x += dx) { const a = pdf(x, 0, 1), b = pdf(x, m, s), q = (a + b) / 2; if (a > 1e-300) js += 0.5 * a * Math.log(a / q) * dx; if (b > 1e-300) js += 0.5 * b * Math.log(b / q) * dx }
  return <div>
    <Controls>
      <Slider label="Generator mean" value={m} min={-2} max={2} step={0.1} digits={1} onChange={setM} />
      <Slider label="Generator sd" value={s} min={0.5} max={2.5} step={0.1} digits={1} onChange={setS} />
    </Controls>
    <MiniPlot x={[-5, 5]} y={[0, 1]} xLabel="x" yLabel="density · D*" label={`Data N(0, 1), generator N(${m}, ${s}²), and the optimal discriminator D*(x) = p_data / (p_data + p_g)`}>{({ X, Y }) => <>
      <Path X={X} Y={Y} points={curve(x => pdf(x, 0, 1), -5, 5)} stroke="var(--muted)" />
      <Path X={X} Y={Y} points={curve(x => pdf(x, m, s), -5, 5)} stroke="var(--chart-train)" dash="4 3" />
      <Path X={X} Y={Y} points={curve(dStar, -5, 5)} stroke="var(--chart-val)" />
      <Label X={X} Y={Y} x={-4.8} y={0.93} color="var(--chart-val)">D*(x)</Label>
      <Label X={X} Y={Y} x={-4.8} y={0.82} color="var(--muted)">data density</Label>
      <Label X={X} Y={Y} x={-4.8} y={0.71} color="var(--chart-train)">generator (dashed)</Label>
    </>}</MiniPlot>
    <Readout>D* is high where the data are denser than the generator and low where the generator overproduces. At x = 0 it is {r(dStar(0), 3)}. JS divergence {r(js, 3)} nats, so the game’s value at D* is 2·JS − log 4 = {r(2 * js - Math.log(4), 3)}. {Math.abs(m) < 1e-9 && Math.abs(s - 1) < 1e-9 ? 'The generator matches the data: D* = ½ everywhere and the value is −log 4 ≈ −1.386.' : 'Move the generator to mean 0 and sd 1 to reach the equilibrium.'}</Readout>
  </div>
}

// ---------- 54.2 ----------
export function CollapseFig() {
  const [preset, setPreset] = useState('greedy'), [seed, setSeed] = useState('2')
  const g = useMemo(() => memo(`${preset}-${seed}`, () => { const run = trainGAN({ seed: Number(seed), ...GAN_PRESETS[preset].opts }); return run.sample(1000) }), [preset, seed])
  const cov = modeCoverage(g), sh = modeShares(g), top = Math.max(...sh)
  return <div>
    <Controls>
      <Radio name="p54" value={preset} onChange={setPreset} options={[['balanced', 'balanced'], ['greedy', 'generator-heavy']]} />
      <Radio name="s54" value={seed} onChange={setSeed} options={['1', '2', '3'].map(v => [v, `seed ${v}`])} />
    </Controls>
    <Plot x={B} y={B} width={300} height={300} xLabel="x₁" yLabel="x₂" label={`Real ring (grey) and 400 generated samples after ${preset} training with seed ${seed}: ${cov.covered} of 8 modes covered`}>{({ X, Y }) => <>
      <Dots X={X} Y={Y} points={REAL} color="var(--muted)" rad={2} opacity={0.4} />
      <Dots X={X} Y={Y} points={g.slice(0, 400).map(p => [Math.max(B[0], Math.min(B[1], p[0])), Math.max(B[0], Math.min(B[1], p[1]))])} color="var(--chart-val)" rad={2} opacity={0.75} />
    </>}</Plot>
    <Readout>{cov.covered} of 8 modes covered; {r(100 * cov.quality, 0)}% of samples land on a mode; the fullest mode holds {r(100 * top, 0)}% (ideal 12.5%). {cov.covered === 1 ? 'Mode collapse: the generator found one region the discriminator accepts.' : cov.covered < 8 ? 'Neither collapsed nor converged: most samples sit between clusters.' : 'All eight clusters are covered.'}</Readout>
  </div>
}

// ---------- 54.3 ----------
const S = schedule(), rng0 = random(3), X0 = sampleTarget('ring', 500, rng0), EPS = X0.map(() => Float64Array.of(normal(rng0), normal(rng0)))
export function NoisingFig() {
  const [t, setT] = useState(10)
  const xt = X0.map((x, i) => noiseTo(x, t, EPS[i], S)), cov = modeCoverage(xt)
  return <div>
    <Controls><Slider label="Step t" value={t} min={0} max={T_STEPS - 1} step={1} digits={0} onChange={setT} /></Controls>
    <Plot x={B} y={B} width={300} height={300} xLabel="x₁" yLabel="x₂" label={`500 ring points noised to step ${t}: signal factor ${r(Math.sqrt(S.abar[t]), 3)}`}>{({ X, Y }) => <Dots X={X} Y={Y} points={xt.map(p => [Math.max(B[0], Math.min(B[1], p[0])), Math.max(B[0], Math.min(B[1], p[1]))])} color="var(--chart-train)" rad={2} opacity={0.7} />}</Plot>
    <Readout>x_t = {r(Math.sqrt(S.abar[t]), 3)}·x₀ + {r(Math.sqrt(1 - S.abar[t]), 3)}·ε. {r(100 * cov.quality, 0)}% of points still sit within 0.54 of a mode (pure noise: about 17% by chance).</Readout>
  </div>
}
