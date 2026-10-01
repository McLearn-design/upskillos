// Run › Train an agent…: a learning agent for this game (ml/). Say what it sees, does and earns (the
// environment spec), train it in a worker with the cross-entropy method, watch the scores climb, see
// what it learned, then watch it play the real game.

import React, { useMemo, useState } from 'react';
import type { Store } from './store';
import { Btn, C, useStore } from './kit';
import { Modal } from './Dialogs';
import type { EnvSpec } from '../ml/env';

/** The learning curve: best and elite-average score per generation, against random play. */
function Curve({ points, random, total }: { points: { best: number; eliteMean: number }[]; random: number | null; total: number }) {
  const W = 460, H = 150, pad = 26;
  const values = [...points.flatMap((p) => [p.best, p.eliteMean]), ...(random === null ? [] : [random]), 0];
  const lo = Math.min(...values), hi = Math.max(...values, lo + 1);
  const x = (i: number) => pad + (i / Math.max(1, total - 1)) * (W - pad - 8), y = (v: number) => H - pad - ((v - lo) / (hi - lo)) * (H - pad - 10);
  const line = (key: 'best' | 'eliteMean') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <svg data-testid="train-curve" width={W} height={H} style={{ display: 'block', background: C.bg, borderRadius: 4, border: `1px solid ${C.border}` }}>
      <line x1={pad} x2={W - 8} y1={y(0)} y2={y(0)} stroke={C.border} />
      {random !== null && <><line x1={pad} x2={W - 8} y1={y(random)} y2={y(random)} stroke={C.warn} strokeDasharray="4 3" /><text x={W - 10} y={y(random) - 4} fill={C.warn} fontSize={10} textAnchor="end">random play {random.toFixed(1)}</text></>}
      <path d={line('eliteMean')} fill="none" stroke={C.accent} strokeWidth={1.5} />
      <path d={line('best')} fill="none" stroke={C.ok} strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.best)} r={2.5} fill={C.ok} />)}
      <text x={pad} y={12} fill={C.dim} fontSize={10}>score per episode · <tspan fill={C.ok}>best</tspan> · <tspan fill={C.accent}>elite average</tspan></text>
      <text x={pad} y={H - 8} fill={C.faint} fontSize={10}>generation 1</text>
      <text x={W - 8} y={H - 8} fill={C.faint} fontSize={10} textAnchor="end">{total}</text>
      <text x={4} y={y(hi) + 4} fill={C.faint} fontSize={9}>{hi.toFixed(0)}</text>
      <text x={4} y={y(lo)} fill={C.faint} fontSize={9}>{lo.toFixed(0)}</text>
    </svg>
  );
}

export function TrainDialog({ store, onClose, onWatch }: { store: Store; onClose: () => void; onWatch: () => void }) {
  useStore(store);
  const t = store.training;
  const [text, setText] = useState(() => JSON.stringify(t.spec ?? store.defaultAgentSpec(), null, 2));
  const [generations, setGenerations] = useState(10);
  const [population, setPopulation] = useState(24);
  const parsed = useMemo((): { spec: EnvSpec } | { error: string } => {
    try {
      const spec = JSON.parse(text) as EnvSpec;
      if (!Array.isArray(spec.actions) || !Array.isArray(spec.observation) || !Array.isArray(spec.reward)) return { error: 'It needs actions, observation and reward lists.' };
      return { spec };
    } catch (e) { return { error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` }; }
  }, [text]);
  const last = t.generations.at(-1);
  const num: React.CSSProperties = { width: 50, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px' };
  const spec = t.spec ?? ('spec' in parsed ? parsed.spec : null);
  return (
    <Modal title="Train an agent" onClose={() => { onClose(); }} width={760} testid="train-dialog">
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 10 }}>
        An agent learns to play this game from its <b>state</b>, the numbers in its nodes, not its pixels. Say what it <b>sees</b> (observation:
        node paths like <code>Ball:position.x</code>, optionally <code>minus</code> another), what it can <b>do</b> (actions: input actions held
        for a step) and what it <b>earns</b> (reward: how much each value changes). Training plays thousands of games, headless, on the real
        engine with your scripts, keeping the best players each generation (the cross-entropy method).
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, marginBottom: 4 }}>ENVIRONMENT (JSON)</div>
          <textarea data-testid="train-spec" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} spellCheck={false}
            style={{ width: '100%', height: 300, boxSizing: 'border-box', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: C.mono, fontSize: 11, padding: 6 }} />
          {'error' in parsed && <div style={{ color: C.warn, fontSize: 11 }}>{parsed.error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 12, color: C.dim }}>
            generations <input data-testid="train-generations" type="number" min={1} max={200} value={generations} onChange={(e) => setGenerations(Math.max(1, Number(e.target.value) || 1))} style={num} />
            population <input type="number" min={4} max={200} value={population} onChange={(e) => setPopulation(Math.max(4, Number(e.target.value) || 4))} style={num} />
            <span style={{ flex: 1 }} />
            {t.running
              ? <Btn testid="train-stop" onClick={() => store.stopTraining()}>Stop</Btn>
              : <Btn testid="train-start" disabled={!('spec' in parsed)} onClick={() => 'spec' in parsed && store.startTraining(parsed.spec, { generations, population, elite: 0.2, noise: 1, seed: 3 })}>Train</Btn>}
          </div>
        </div>
        <div style={{ width: 470 }}>
          <Curve points={t.generations} random={t.random} total={t.total || generations} />
          <div data-testid="train-status" style={{ fontSize: 12, color: t.error ? C.warn : C.dim, margin: '6px 0' }}>
            {t.error ? `Could not train: ${t.error}`
              : t.running ? (last ? `Generation ${last.generation} of ${t.total}: best ${last.best.toFixed(1)}, elite average ${last.eliteMean.toFixed(1)}` : 'Starting: loading the game and playing at random first…')
              : t.score !== null ? `Trained. It averages ${t.score.toFixed(1)} a game; playing at random averages ${t.random?.toFixed(1)}.`
              : 'Not trained yet.'}
          </div>
          {t.policy && spec && (
            <>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, margin: '8px 0 4px' }}>WHAT IT LEARNED (the weights: for each action, a score from what it sees; it takes the highest)</div>
              <table data-testid="train-weights" style={{ fontSize: 11, fontFamily: C.mono, borderCollapse: 'collapse', color: C.text }}>
                <thead><tr><td style={{ color: C.faint, paddingRight: 8 }}>action</td>{spec.observation.map((o, i) => <td key={i} style={{ color: C.faint, padding: '0 6px' }} title={o.minus ? `${o.path} − ${o.minus}` : o.path}>{o.path.replace(/^.*?:/, '')}{o.minus ? ' −…' : ''}</td>)}<td style={{ color: C.faint, padding: '0 6px' }}>bias</td></tr></thead>
                <tbody>{t.policy.weights.map((w, a) => <tr key={a}><td style={{ paddingRight: 8 }}>{(spec.actions[a] ?? []).join('+') || 'nothing'}</td>{w.map((v, i) => <td key={i} style={{ padding: '0 6px', textAlign: 'right', color: v >= 0 ? C.ok : C.warn }}>{v.toFixed(2)}</td>)}</tr>)}</tbody>
              </table>
              <div style={{ marginTop: 10 }}>
                <Btn testid="train-watch" onClick={onWatch}>▶ Watch it play</Btn>
                <span style={{ fontSize: 11, color: C.faint, marginLeft: 8 }}>Runs the game with the agent at the controls. ■ Stop ends it.</span>
              </div>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
