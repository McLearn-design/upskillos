// Run › Train an agent…: a learning agent for this game (ml/). Say what it sees, does and earns (the
// environment spec), train it in a worker with Q-learning (a table of values over binned states) or the
// cross-entropy method (a search over a linear policy's weights), watch the scores climb, see what it
// learned, then watch it play the real game.

import React, { useEffect, useMemo, useState } from 'react';
import type { Store, TrainMethod } from './store';
import { Btn, C, useStore } from './kit';
import { Modal } from './Dialogs';
import type { EnvSpec, Reading } from '../ml/env';
import type { QEpisode } from '../ml/qlearning';
import { isQPolicy } from '../ml/policy';

const W = 460, H = 150, PAD = 26;

/** Axes, the zero line and random play's line, shared by both curves. */
function frame(values: number[], random: number | null) {
  const all = [...values, ...(random === null ? [] : [random]), 0];
  const lo = Math.min(...all), hi = Math.max(...all, lo + 1);
  const y = (v: number) => H - PAD - ((v - lo) / (hi - lo)) * (H - PAD - 22);   // room above for the legend
  return { lo, hi, y };
}

function Axes({ lo, hi, y, random, first, total, legend }: { lo: number; hi: number; y: (v: number) => number; random: number | null; first: string; total: number; legend: React.ReactNode }) {
  return <>
    <line x1={PAD} x2={W - 8} y1={y(0)} y2={y(0)} stroke={C.border} />
    {random !== null && <><line x1={PAD} x2={W - 8} y1={y(random)} y2={y(random)} stroke={C.warn} strokeDasharray="4 3" /><text x={W - 10} y={y(random) - 4} fill={C.warn} fontSize={10} textAnchor="end">random play {random.toFixed(1)}</text></>}
    <text x={PAD} y={12} fill={C.dim} fontSize={10}>{legend}</text>
    <text x={PAD} y={H - 8} fill={C.faint} fontSize={10}>{first}</text>
    <text x={W - 8} y={H - 8} fill={C.faint} fontSize={10} textAnchor="end">{total}</text>
    <text x={4} y={y(hi) + 4} fill={C.faint} fontSize={9}>{hi.toFixed(0)}</text>
    <text x={4} y={y(lo)} fill={C.faint} fontSize={9}>{lo.toFixed(0)}</text>
  </>;
}

const svgStyle: React.CSSProperties = { display: 'block', background: C.bg, borderRadius: 4, border: `1px solid ${C.border}` };

/** Cross-entropy: best and elite-average score per generation, against random play. */
function CemCurve({ points, random, total }: { points: { best: number; eliteMean: number }[]; random: number | null; total: number }) {
  const { lo, hi, y } = frame(points.flatMap((p) => [p.best, p.eliteMean]), random);
  const x = (i: number) => PAD + (i / Math.max(1, total - 1)) * (W - PAD - 8);
  const line = (key: 'best' | 'eliteMean') => points.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');
  return (
    <svg data-testid="train-curve" width={W} height={H} style={svgStyle}>
      <Axes lo={lo} hi={hi} y={y} random={random} first="generation 1" total={total} legend={<>score per episode · <tspan fill={C.ok}>best</tspan> · <tspan fill={C.accent}>elite average</tspan></>} />
      <path d={line('eliteMean')} fill="none" stroke={C.accent} strokeWidth={1.5} />
      <path d={line('best')} fill="none" stroke={C.ok} strokeWidth={2} />
      {points.map((p, i) => <circle key={i} cx={x(i)} cy={y(p.best)} r={2.5} fill={C.ok} />)}
    </svg>
  );
}

/** Q-learning: each training episode's return (faint), their average over the last 10 (blue), and the greedy checks (green). */
function QCurve({ episodes, random, total }: { episodes: QEpisode[]; random: number | null; total: number }) {
  const avg = episodes.map((_, i) => { const w = episodes.slice(Math.max(0, i - 9), i + 1); return w.reduce((s, e) => s + e.total, 0) / w.length; });
  const checks = episodes.filter((e) => e.greedy !== undefined);
  const { lo, hi, y } = frame([...episodes.map((e) => e.total), ...checks.map((e) => e.greedy!)], random);
  const x = (ep: number) => PAD + ((ep - 1) / Math.max(1, total - 1)) * (W - PAD - 8);
  const path = (vals: number[]) => vals.map((v, i) => `${i ? 'L' : 'M'}${x(i + 1).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return (
    <svg data-testid="train-curve" width={W} height={H} style={svgStyle}>
      <Axes lo={lo} hi={hi} y={y} random={random} first="episode 1" total={total} legend={<>return per episode · <tspan fill={C.faint}>each</tspan> · <tspan fill={C.accent}>last 10 averaged</tspan> · <tspan fill={C.ok}>greedy check</tspan></>} />
      <path d={path(episodes.map((e) => e.total))} fill="none" stroke={C.faint} strokeWidth={1} />
      <path d={path(avg)} fill="none" stroke={C.accent} strokeWidth={2} />
      {checks.map((e) => <circle key={e.episode} cx={x(e.episode)} cy={y(e.greedy!)} r={3} fill={C.ok} />)}
    </svg>
  );
}

/** A reading's short name: its property, as a difference when it has `minus`. */
const shortName = (r: Reading) => `${r.path.replace(/^.*?:/, '')}${r.minus ? ' − ' + r.minus.replace(/^(.*?):.*$/, '$1') : ''}`;
/** Bin i of cut points [c₁ … cₖ] in words: below c₁, between two cuts, or from cₖ up. */
const binText = (cuts: number[], i: number) => (i === 0 ? `< ${cuts[0]}` : i === cuts.length ? `≥ ${cuts[i - 1]}` : `${cuts[i - 1]} to ${cuts[i]}`);

/** The Q table: one row per state (a bin of each binned reading), one column per action; the highest is what it does. */
function QTable({ spec, table, visits }: { spec: EnvSpec; table: number[][]; visits: number[] | null }) {
  const binned = spec.observation.map((r, i) => ({ r, i })).filter((x) => x.r.bins?.length);
  const decode = (s: number) => {
    const out: number[] = [];
    for (let k = binned.length - 1; k >= 0; k--) { const n = binned[k].r.bins!.length + 1; out[k] = s % n; s = Math.floor(s / n); }
    return out;
  };
  const cell: React.CSSProperties = { padding: '1px 6px', textAlign: 'right' };
  return (
    <div style={{ maxHeight: 220, overflow: 'auto', border: `1px solid ${C.border}`, borderRadius: 3 }}>
      <table data-testid="train-qtable" style={{ fontSize: 11, fontFamily: C.mono, borderCollapse: 'collapse', color: C.text, width: '100%' }}>
        <thead><tr style={{ position: 'sticky', top: 0, background: C.panel2 }}>
          <td style={{ color: C.faint, padding: '1px 6px' }}>s</td>
          {binned.map(({ r }) => <td key={r.path + (r.minus ?? '')} style={{ color: C.faint, padding: '1px 6px' }}>{shortName(r)}</td>)}
          {spec.actions.map((a, i) => <td key={i} style={{ ...cell, color: C.faint }}>Q(s, {a.join('+') || 'nothing'})</td>)}
          {visits && <td style={{ ...cell, color: C.faint }} title="Updates made from this state: a row updated rarely holds a rough estimate">visits</td>}
        </tr></thead>
        <tbody>{table.map((row, s) => {
          const bins = decode(s), best = row.indexOf(Math.max(...row)), untried = visits ? visits[s] === 0 : row.every((q) => q === 0);
          return (
            <tr key={s} style={{ color: untried ? C.faint : C.text }} title={untried ? 'Never updated: the agent has not been in this state' : undefined}>
              <td style={{ padding: '1px 6px', color: C.faint }}>{s}</td>
              {binned.map(({ r }, k) => <td key={k} style={{ padding: '1px 6px' }}>{binText(r.bins!, bins[k])}</td>)}
              {row.map((q, a) => <td key={a} style={{ ...cell, color: !untried && a === best ? C.ok : undefined, fontWeight: !untried && a === best ? 700 : 400 }}>{q.toFixed(2)}</td>)}
              {visits && <td style={{ ...cell, color: C.faint }}>{visits[s]}</td>}
            </tr>
          );
        })}</tbody>
      </table>
    </div>
  );
}

export function TrainDialog({ store, onClose, onWatch }: { store: Store; onClose: () => void; onWatch: () => void }) {
  useStore(store);
  const t = store.training;
  const [text, setText] = useState(() => JSON.stringify(t.spec ?? store.defaultAgentSpec(), null, 2));
  const [method, setMethod] = useState<TrainMethod>(t.method);
  const [generations, setGenerations] = useState(10);
  const [population, setPopulation] = useState(24);
  const [episodes, setEpisodes] = useState(100);
  const [alpha, setAlpha] = useState(0.2);
  const [gamma, setGamma] = useState(0.97);
  const [epsilon, setEpsilon] = useState(0.3);
  const parsed = useMemo((): { spec: EnvSpec } | { error: string } => {
    try {
      const spec = JSON.parse(text) as EnvSpec;
      if (!Array.isArray(spec.actions) || !Array.isArray(spec.observation) || !Array.isArray(spec.reward)) return { error: 'It needs actions, observation and reward lists.' };
      if (method === 'q' && !spec.observation.some((o) => o.bins?.length)) return { error: 'Q-learning needs "bins" on at least one observation reading: the cut points that turn its numbers into states.' };
      return { spec };
    } catch (e) { return { error: `Not valid JSON: ${e instanceof Error ? e.message : String(e)}` }; }
  }, [text, method]);
  // The environment as typed, for a task's checks (whether it parses for training or not).
  useEffect(() => {
    let spec: EnvSpec | null = null;
    try { spec = JSON.parse(text) as EnvSpec; } catch { /* not JSON yet */ }
    store.setTrainDraft(spec && typeof spec === 'object' ? spec : null);
  }, [text, store]);
  const num: React.CSSProperties = { width: 50, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px' };
  const field = (label: string, value: number, set: (v: number) => void, opts: { min: number; max: number; step?: number; testid?: string; title?: string }) => (
    <label title={opts.title} style={{ display: 'inline-flex', gap: 4, alignItems: 'center' }}>{label}
      <input data-testid={opts.testid} type="number" min={opts.min} max={opts.max} step={opts.step ?? 1} value={value} onChange={(e) => { const v = Number(e.target.value); if (Number.isFinite(v)) set(Math.min(opts.max, Math.max(opts.min, v))); }} style={num} />
    </label>
  );
  const spec = t.spec ?? ('spec' in parsed ? parsed.spec : null);
  const shown = t.method;   // what the curve and results show: the run that happened, not the radio
  const lastGen = t.generations.at(-1), lastEp = t.episodes.at(-1);
  const lastCheck = [...t.episodes].reverse().find((e) => e.greedy !== undefined);
  const start = () => {
    if (!('spec' in parsed)) return;
    if (method === 'q') store.startTraining(parsed.spec, { method: 'q', options: { episodes, alpha, gamma, epsilon, epsilonEnd: 0.02, seed: 3, checkEvery: 10 } });
    else store.startTraining(parsed.spec, { method: 'cem', options: { generations, population, elite: 0.2, noise: 1, seed: 3 } });
  };
  const status = t.error ? `Could not train: ${t.error}`
    : t.running ? (shown === 'q'
      ? (lastEp ? `Episode ${lastEp.episode} of ${t.total}: return ${lastEp.total.toFixed(1)}, ε ${lastEp.epsilon.toFixed(2)}, ${lastEp.visited} states visited${lastCheck ? `; last greedy check ${lastCheck.greedy!.toFixed(1)}` : ''}` : 'Starting: loading the game and playing at random first…')
      : (lastGen ? `Generation ${lastGen.generation} of ${t.total}: best ${lastGen.best.toFixed(1)}, elite average ${lastGen.eliteMean.toFixed(1)}` : 'Starting: loading the game and playing at random first…'))
    : t.score !== null ? `Trained. It averages ${t.score.toFixed(1)} a game; playing at random averages ${t.random?.toFixed(1)}.`
    : 'Not trained yet.';
  return (
    <Modal title="Train an agent" onClose={() => { onClose(); }} width={800} testid="train-dialog">
      <div style={{ fontSize: 12, color: C.dim, lineHeight: 1.5, marginBottom: 10 }}>
        An agent learns to play this game from its <b>state</b>, the numbers in its nodes, not its pixels. Say what it <b>sees</b> (observation:
        node paths like <code>Ball:position.x</code>, optionally <code>minus</code> another, and for Q-learning the <code>bins</code> that cut each
        number into states), what it can <b>do</b> (actions: input actions held for a step) and what it <b>earns</b> (reward: how much each value
        changes). Training plays the game headless, on the real engine with your scripts.
      </div>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8, fontSize: 12, color: C.dim }}>
        method
        <Btn small testid="train-method-q" active={method === 'q'} onClick={() => setMethod('q')} title="A table of Q(s, a): the return it expects for each action in each state, learned from every step">Q-learning</Btn>
        <Btn small testid="train-method-cem" active={method === 'cem'} onClick={() => setMethod('cem')} title="Many random weightings of a linear policy; keep the best and search around them">Cross-entropy</Btn>
        <span style={{ color: C.faint, marginLeft: 6 }}>{method === 'q' ? 'learns a value for every state and action, one step at a time (ML Lab lesson 37.4)' : 'searches over the weights of a linear policy, one whole game at a time'}</span>
      </div>
      <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, marginBottom: 4 }}>ENVIRONMENT (JSON)</div>
          <textarea data-testid="train-spec" value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => e.stopPropagation()} spellCheck={false}
            style={{ width: '100%', height: 300, boxSizing: 'border-box', background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, fontFamily: C.mono, fontSize: 11, padding: 6 }} />
          {'error' in parsed && <div data-testid="train-spec-error" style={{ color: C.warn, fontSize: 11 }}>{parsed.error}</div>}
          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6, fontSize: 12, color: C.dim, flexWrap: 'wrap' }}>
            {method === 'q' ? <>
              {field('episodes', episodes, setEpisodes, { min: 1, max: 2000, testid: 'train-episodes' })}
              {field('α', alpha, setAlpha, { min: 0.01, max: 1, step: 0.05, testid: 'train-alpha', title: 'Step size: how far each update moves Q(s, a) towards its target' })}
              {field('γ', gamma, setGamma, { min: 0, max: 1, step: 0.01, testid: 'train-gamma', title: 'Discount per step: a reward k steps away counts γ^k' })}
              {field('ε', epsilon, setEpsilon, { min: 0, max: 1, step: 0.05, testid: 'train-epsilon', title: 'Exploration at the start (a random action with this probability), falling to 0.02 by the end' })}
            </> : <>
              {field('generations', generations, setGenerations, { min: 1, max: 200, testid: 'train-generations' })}
              {field('population', population, setPopulation, { min: 4, max: 200 })}
            </>}
            <span style={{ flex: 1 }} />
            {t.running
              ? <Btn testid="train-stop" onClick={() => store.stopTraining()}>Stop</Btn>
              : <Btn testid="train-start" disabled={!('spec' in parsed)} onClick={start}>Train</Btn>}
          </div>
        </div>
        <div style={{ width: 470 }}>
          {shown === 'q'
            ? <QCurve episodes={t.episodes} random={t.random} total={t.total || episodes} />
            : <CemCurve points={t.generations} random={t.random} total={t.total || generations} />}
          <div data-testid="train-status" style={{ fontSize: 12, color: t.error ? C.warn : C.dim, margin: '6px 0' }}>{status}</div>
          {shown === 'q' && t.table && spec && (
            <>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, margin: '8px 0 4px' }}>
                {t.running ? 'THE TABLE AT THE LAST CHECK' : 'WHAT IT LEARNED'} (each row a state, each column an action; Q(s, a) is the return it expects; it plays the green one)
              </div>
              <QTable spec={spec} table={t.table} visits={t.visits} />
            </>
          )}
          {shown === 'cem' && t.policy && !isQPolicy(t.policy) && spec && (
            <>
              <div style={{ fontSize: 11, color: C.faint, fontWeight: 700, margin: '8px 0 4px' }}>WHAT IT LEARNED (the weights: for each action, a score from what it sees; it takes the highest)</div>
              <table data-testid="train-weights" style={{ fontSize: 11, fontFamily: C.mono, borderCollapse: 'collapse', color: C.text }}>
                <thead><tr><td style={{ color: C.faint, paddingRight: 8 }}>action</td>{spec.observation.map((o, i) => <td key={i} style={{ color: C.faint, padding: '0 6px' }} title={o.minus ? `${o.path} − ${o.minus}` : o.path}>{o.path.replace(/^.*?:/, '')}{o.minus ? ' −…' : ''}</td>)}<td style={{ color: C.faint, padding: '0 6px' }}>bias</td></tr></thead>
                <tbody>{t.policy.weights.map((w, a) => <tr key={a}><td style={{ paddingRight: 8 }}>{(spec.actions[a] ?? []).join('+') || 'nothing'}</td>{w.map((v, i) => <td key={i} style={{ padding: '0 6px', textAlign: 'right', color: v >= 0 ? C.ok : C.warn }}>{v.toFixed(2)}</td>)}</tr>)}</tbody>
              </table>
            </>
          )}
          {t.policy && !t.running && (
            <div style={{ marginTop: 10 }}>
              <Btn testid="train-watch" onClick={onWatch}>▶ Watch it play</Btn>
              <span style={{ fontSize: 11, color: C.faint, marginLeft: 8 }}>Runs the game with the agent at the controls. ■ Stop ends it.</span>
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}
