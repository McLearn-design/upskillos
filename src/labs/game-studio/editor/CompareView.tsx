// Run › Train an agent… › Compare: several settings, each trained over the same seeds, side by side (ml/compare.ts).
// The curves are each setting's average over seeds (smoothed over 10 episodes); the table gives the mean and the
// spread (sample standard deviation) of each run's late return (still exploring) and its greedy score (exploring off).
import type { Store } from './store';
import { Btn, C, useStore } from './kit';
import { summarise } from '../ml/compare';
import type { EnvSpec } from '../ml/env';

const COLORS = ['#5aa9ff', '#6ee7b7', '#fbbf24', '#f87171', '#c084fc', '#f472b6'];
const W = 470, H = 190, PAD = 30;

function CompareChart({ curves, random }: { curves: { label: string; curve: number[] }[]; random: number | null }) {
  // The range is the curves' own after their first tenth: random play, and the first few episodes of learning, can be
  // far below the rest (−1751 and −959 on the cliff) and would flatten the part worth comparing. Those are clipped.
  const skip = (c: number[]) => c.slice(Math.min(20, Math.floor(c.length / 10)));
  const all = curves.flatMap((c) => skip(c.curve));
  if (!all.length) return <div style={{ height: H, border: `1px solid ${C.border}`, borderRadius: 4, display: 'grid', placeItems: 'center', color: C.faint, fontSize: 12 }}>Add settings and press Compare: the averaged learning curves appear here.</div>;
  const lo = Math.min(...all), hi = Math.max(...all, lo + 1), n = Math.max(...curves.map((c) => c.curve.length), 2);
  const clipped = curves.some((c) => c.curve.some((v) => v < lo));
  const x = (i: number) => PAD + (i / (n - 1)) * (W - PAD - 8), y = (v: number) => H - 22 - ((Math.max(v, lo) - lo) / (hi - lo)) * (H - 40);
  return (
    <svg data-testid="compare-chart" width={W} height={H} style={{ display: 'block', background: C.bg, border: `1px solid ${C.border}`, borderRadius: 4 }}>
      {random !== null && random >= lo && <><line x1={PAD} x2={W - 8} y1={y(random)} y2={y(random)} stroke={C.warn} strokeDasharray="4 3" /><text x={W - 10} y={y(random) - 4} fill={C.warn} fontSize={10} textAnchor="end">random play {random.toFixed(1)}</text></>}
      {random !== null && random < lo && <text x={W - 10} y={H - 6 - 12} fill={C.warn} fontSize={10} textAnchor="end">random play {random.toFixed(1)}, below the chart</text>}
      {clipped && <text x={PAD + 4} y={H - 6 - 12} fill={C.faint} fontSize={10}>the first episodes are lower: clipped</text>}
      {curves.map((c, k) => <path key={k} d={c.curve.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ')} fill="none" stroke={COLORS[k % COLORS.length]} strokeWidth={2} />)}
      <text x={PAD} y={12} fill={C.dim} fontSize={10}>return per episode, averaged over seeds (10-episode smoothing)</text>
      <text x={4} y={y(hi) + 4} fill={C.faint} fontSize={9}>{hi.toFixed(0)}</text>
      <text x={4} y={y(lo)} fill={C.faint} fontSize={9}>{lo.toFixed(0)}</text>
      <text x={PAD} y={H - 6} fill={C.faint} fontSize={10}>episode 1</text>
      <text x={W - 8} y={H - 6} fill={C.faint} fontSize={10} textAnchor="end">{n}</text>
    </svg>
  );
}

export function CompareView({ store, spec }: { store: Store; spec: EnvSpec | null }) {
  useStore(store);
  const c = store.comparison;
  const summary = summarise(c.configs, c.runs);
  const total = c.configs.length * c.seeds.length;
  const pm = (m: number, s: number) => (Number.isFinite(m) ? `${m.toFixed(1)} ± ${s.toFixed(1)}` : '—');
  return (
    <div data-testid="compare-view" style={{ fontSize: 12, color: C.dim }}>
      <CompareChart curves={summary.filter((s) => s.runs > 0)} random={c.random} />
      <div data-testid="compare-status" style={{ margin: '6px 0' }}>
        {c.error ? <span style={{ color: C.warn }}>Could not compare: {c.error}</span>
          : c.running ? `Run ${c.runs.length + 1} of ${total}…`
          : c.runs.length ? `Done: ${c.runs.length} runs (${c.configs.length} settings × ${c.seeds.length} seeds, the same seeds for each).`
          : 'Each setting will be trained once per seed, headless.'}
      </div>
      <table data-testid="compare-table" style={{ width: '100%', borderCollapse: 'collapse', fontFamily: C.mono, fontSize: 11, color: C.text }}>
        <thead><tr style={{ color: C.faint }}><td /><td>setting</td><td style={{ textAlign: 'right' }} title="Each run's average return over its last 50 episodes (still exploring): mean ± sample standard deviation over seeds">late return</td><td style={{ textAlign: 'right' }} title="Each run's final table played greedily on held-out games: mean ± sample standard deviation over seeds">greedy</td><td /></tr></thead>
        <tbody>{c.configs.map((cfg, k) => (
          <tr key={k}>
            <td><span style={{ display: 'inline-block', width: 10, height: 10, background: COLORS[k % COLORS.length], borderRadius: 2 }} /></td>
            <td style={{ padding: '1px 6px' }}>{cfg.label}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{pm(summary[k].late.mean, summary[k].late.sd)}</td>
            <td style={{ textAlign: 'right', whiteSpace: 'nowrap', paddingLeft: 6 }}>{pm(summary[k].greedy.mean, summary[k].greedy.sd)}</td>
            <td>{!c.running && <Btn small onClick={() => store.removeCompareConfig(k)} title="Remove this setting">×</Btn>}</td>
          </tr>
        ))}</tbody>
      </table>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 8 }}>
        seeds <input data-testid="compare-seeds" type="number" min={1} max={30} value={c.seeds.length} onChange={(e) => store.setCompareSeeds(Number(e.target.value) || 1)} onKeyDown={(e) => e.stopPropagation()} style={{ width: 50, background: C.bg, color: C.text, border: `1px solid ${C.border}`, borderRadius: 3, padding: '2px 4px' }} />
        <span style={{ flex: 1 }} />
        {c.running
          ? <Btn testid="compare-stop" onClick={() => store.stopCompare()}>Stop</Btn>
          : <Btn testid="compare-start" disabled={!spec || !c.configs.length} onClick={() => spec && store.startCompare(spec)}>Compare</Btn>}
      </div>
    </div>
  );
}
