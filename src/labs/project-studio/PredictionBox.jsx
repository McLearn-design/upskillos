// PredictionBox.jsx
// One prediction checkpoint (predictions.js): the learner commits to an answer before the
// explanation is shown. Choice and number predictions are marked; open ones are compared by
// the learner, who says how they did. The locked-in answer is remembered on this device.
import { useCallback, useState } from 'react';
import MarkdownProse from '../../components/math/MarkdownProse.jsx';
import { isCorrect } from './predictions.js';

const KEY = 'project-studio-predictions-v1';

function loadAll() {
  try { return JSON.parse(localStorage.getItem(KEY) || '{}'); } catch { return {}; }
}

export function usePredictionRecord(id) {
  const [record, setRecord] = useState(() => loadAll()[id] ?? null);
  const save = useCallback((next) => {
    setRecord(next);
    try {
      const all = loadAll();
      if (next) all[id] = next; else delete all[id];
      localStorage.setItem(KEY, JSON.stringify(all));
    } catch {}
  }, [id]);
  return [record, save];
}

const SELF = [['yes', 'I predicted this'], ['partly', 'Partly'], ['no', 'I predicted something else']];

export default function PredictionBox({ id, prediction, C, proseClass }) {
  const [record, save] = usePredictionRecord(id);
  const [draft, setDraft] = useState('');
  const locked = record != null;
  const accent = C.amber ?? '#f59e0b';

  const lock = () => {
    const response = draft.trim();
    if (!response) return;
    save({ response, correct: isCorrect(prediction, response), at: Date.now() });
  };

  return (
    <div data-prediction={id} style={{ margin: '12px 0', border: `1px solid ${accent}`, borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ padding: '5px 10px', background: C.surface2, borderBottom: `1px solid ${C.border}`, fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: accent }}>
        Predict before you look
      </div>
      <div style={{ padding: '6px 10px 10px', color: C.text }}>
        <MarkdownProse text={prediction.question} className={proseClass} />

        {!locked && prediction.kind === 'choice' && (
          <div role="radiogroup" style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12 }}>
            {prediction.choices.map((choice) => (
              <label key={choice} style={{ display: 'flex', gap: 6, alignItems: 'flex-start', cursor: 'pointer' }}>
                <input type="radio" name={id} value={choice} checked={draft === choice} onChange={() => setDraft(choice)} />
                <span>{choice}</span>
              </label>
            ))}
          </div>
        )}
        {!locked && prediction.kind === 'number' && (
          <input aria-label="Your prediction" inputMode="decimal" value={draft} onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') lock(); }}
            style={{ width: 140, fontSize: 12, padding: '3px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.text }} />
        )}
        {!locked && prediction.kind === 'open' && (
          <textarea aria-label="Your prediction" rows={2} value={draft} onChange={(e) => setDraft(e.target.value)}
            placeholder="Write what you expect, in a sentence or a number."
            style={{ width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '4px 6px', borderRadius: 5, border: `1px solid ${C.border}`, background: C.surface, color: C.text }} />
        )}
        {!locked && (
          <button onClick={lock} disabled={!draft.trim()}
            style={{ marginTop: 8, fontSize: 11, fontWeight: 600, padding: '4px 10px', borderRadius: 5, border: 'none', background: accent, color: '#111', opacity: draft.trim() ? 1 : 0.5, cursor: draft.trim() ? 'pointer' : 'default' }}>
            Lock in my prediction
          </button>
        )}

        {locked && (
          <>
            <div style={{ fontSize: 12, marginTop: 4 }}>
              Your prediction: <strong>{record.response}</strong>
              {record.correct === true && <span style={{ color: C.teal, fontWeight: 700 }}> ✓ right</span>}
              {record.correct === false && (
                <span style={{ color: C.red ?? '#ef4444', fontWeight: 700 }}> ✗ not quite. The answer: {prediction.answer}</span>
              )}
            </div>
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${C.border}` }}>
              <MarkdownProse text={prediction.explain} className={proseClass} />
            </div>
            {prediction.kind === 'open' && (
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 11, marginTop: 6 }}>
                <span style={{ color: C.hint, alignSelf: 'center' }}>How did you do?</span>
                {SELF.map(([value, label]) => (
                  <button key={value} onClick={() => save({ ...record, self: value })}
                    aria-pressed={record.self === value}
                    style={{ fontSize: 11, padding: '2px 8px', borderRadius: 5, border: `1px solid ${record.self === value ? accent : C.border}`, background: 'transparent', color: C.text, cursor: 'pointer' }}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            <button onClick={() => { save(null); setDraft(''); }}
              style={{ marginTop: 6, fontSize: 11, padding: 0, border: 'none', background: 'none', color: C.hint, cursor: 'pointer', textDecoration: 'underline' }}>
              Predict again
            </button>
          </>
        )}
      </div>
    </div>
  );
}
