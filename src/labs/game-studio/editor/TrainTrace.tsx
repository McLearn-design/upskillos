// Train in view's trace: the latest update, with every number in it, written out in its algorithm's own formula
// (Sutton & Barto ch. 6). With Predict on, the target and the new Q(S, A) stay hidden until you have worked them out.
//
//   S, A, R, S′          what happened
//   target                R + γ max Q(S′, ·)  (Q-learning; SARSA, Expected SARSA and Double Q-learning differ here)
//   δ = target − Q(S, A)  the TD error
//   Q(S, A) ← Q(S, A) + α δ

import { useEffect, useState } from 'react';
import { Btn, C } from './kit';
import { epsilonGreedyProbs, softmax, type QLive, type QOptions, type QTransition } from '../ml/qlearning';

export const fmtQ = (x: number) => (Math.abs(x) < 5e-10 ? '0' : String(+x.toFixed(3)));
const signed = (x: number) => (x < 0 ? `(${fmtQ(x)})` : fmtQ(x));

/** A bin in words. Cuts at …, 0.5, 1.5, 2.5, … (a whole number per bin) read as that number. */
function binLabel(cuts: number[], i: number): string {
  const unit = cuts.length > 0 && cuts.every((c, k) => Math.abs(c - (cuts[0] + k)) < 1e-9 && Math.abs(c - Math.floor(c) - 0.5) < 1e-9);
  if (unit) return String(cuts[0] - 0.5 + i);
  return i === 0 ? `< ${cuts[0]}` : i === cuts.length ? `≥ ${cuts[i - 1]}` : `${cuts[i - 1]} to ${cuts[i]}`;
}

/** A state number as the bins it stands for: (column 3, row 2). */
export function stateText(s: number, described: { observation: string[]; bins: number[][] }): string {
  const binned = described.bins.map((cuts, i) => ({ cuts, name: described.observation[i] ?? `seen ${i + 1}` })).filter((b) => b.cuts.length);
  const parts: string[] = [];
  for (let k = binned.length - 1; k >= 0; k--) { const n = binned[k].cuts.length + 1; parts[k] = `${binned[k].name.replace(/^[^:\s]*:/, '')} ${binLabel(binned[k].cuts, s % n)}`; s = Math.floor(s / n); }
  return `(${parts.join(', ')})`;
}

export function TrainTrace({ t, live, options, described, predict, onVerdict }: { t: QTransition | null; live: QLive | null; options: QOptions | null; described: { actions: string[]; observation: string[]; bins: number[][] } | null; predict: boolean; onVerdict?: (right: boolean) => void }) {
  const [guess, setGuess] = useState({ target: '', after: '' });
  const [shown, setShown] = useState(false);
  useEffect(() => { setGuess({ target: '', after: '' }); setShown(false); }, [t]);
  if (!t || !described || !options) return <div data-testid="train-trace" style={{ color: C.faint }}>The latest update will show here: S, A, R, S′, the target, the TD error and the new Q(S, A). Press Step to go one update at a time.</div>;
  const name = (a: number) => described.actions[a] ?? String(a);
  const α = options.alpha ?? 0.2, γ = options.gamma ?? 0.97, alg = options.algorithm ?? 'q';
  const row = t.nextRow.map(fmtQ).join(', ');
  let targetLine: string;
  if (t.terminal) targetLine = `S′ ends the episode, so there is no future: target = R = ${fmtQ(t.r)}`;
  else if (alg === 'q') targetLine = `target = R + γ · max Q(S′, ·) = ${fmtQ(t.r)} + ${fmtQ(γ)} × max(${row}) = ${fmtQ(t.target)}`;
  else if (alg === 'sarsa') targetLine = `A′ = ${name(t.a2!)}, chosen now by the exploring policy and taken next. target = R + γ · Q(S′, A′) = ${fmtQ(t.r)} + ${fmtQ(γ)} × ${signed(t.nextRow[t.a2!])} = ${fmtQ(t.target)}`;
  else if (alg === 'expected-sarsa') {
    const p = t.probs ?? (options.explore === 'softmax' ? softmax(t.nextRow, t.epsilon) : epsilonGreedyProbs(t.nextRow, t.epsilon));
    targetLine = `target = R + γ · Σ π(a′|S′) Q(S′, a′) = ${fmtQ(t.r)} + ${fmtQ(γ)} × (${p.map((x, i) => `${fmtQ(x)}×${signed(t.nextRow[i])}`).join(' + ')}) = ${fmtQ(t.target)}`;
  } else targetLine = `A coin flip: table ${t.updated} learns this step (Q(S′, ·) above is the two tables' average: ${row}). Table ${t.updated} picks the best action at S′ and the other table says what it is worth: target = R + γ · Q_other(S′, best) = ${fmtQ(t.target)}`;
  const check = (v: string, want: number) => v.trim() !== '' && Math.abs(Number(v) - want) <= 0.01 + 0.01 * Math.abs(want);
  const hide = predict && !shown;
  const input = (k: 'target' | 'after', testid: string) => <input data-testid={testid} value={guess[k]} onChange={(e) => setGuess({ ...guess, [k]: e.target.value })} onKeyDown={(e) => e.stopPropagation()}
    style={{ width: 70, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '1px 4px', fontFamily: C.mono, fontSize: 11 }} />;
  return (
    <div data-testid="train-trace" style={{ fontFamily: C.mono, fontSize: 11, lineHeight: 1.55, color: C.text }}>
      <div data-testid="trace-head" style={{ color: C.dim }}>Episode {t.episode}, step {t.step}: S = {stateText(t.s, described)}, A = {name(t.a)}, R = {fmtQ(t.r)}, S′ = {stateText(t.next, described)}</div>
      {hide ? <>
        <div style={{ color: C.dim }}>Q(S′, ·) = [{row}]{alg === 'sarsa' && t.a2 !== undefined ? `, A′ = ${name(t.a2)}` : ''}; Q(S, A) was {fmtQ(t.before)}; α = {fmtQ(α)}, γ = {fmtQ(γ)}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2 }}>
          Predict: target {input('target', 'trace-guess-target')} new Q(S, A) {input('after', 'trace-guess-after')}
          <Btn small testid="trace-check" onClick={() => { setShown(true); onVerdict?.(check(guess.target, t.target) && check(guess.after, t.after)); }}>Check</Btn>
        </div>
      </> : <>
        <div data-testid="trace-target">{targetLine}</div>
        <div>δ = target − Q(S, A) = {fmtQ(t.target)} − {signed(t.before)} = {fmtQ(t.delta)}</div>
        <div data-testid="trace-update">Q(S, A) ← Q(S, A) + α δ = {fmtQ(t.before)} + {fmtQ(α)} × {signed(t.delta)} = <b>{fmtQ(t.after)}</b></div>
        {predict && <div data-testid="trace-verdict" style={{ color: check(guess.target, t.target) && check(guess.after, t.after) ? C.ok : C.warn }}>
          Your target {guess.target || '—'} {check(guess.target, t.target) ? '✓' : '✗'}, your new Q {guess.after || '—'} {check(guess.after, t.after) ? '✓' : '✗'}
        </div>}
      </>}
    </div>
  );
}
