// Play back the last operation's algorithm trace over the viewport.
// Same controls and speeds as CodeLens (utils/playback), plus two fast speeds
// and a "by phase" mode for traces with thousands of steps.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Editor } from '../core/Editor';
import type { Viewport } from '../render/Viewport';
import { GEOMETRY_SPEEDS, usePlaybackTicker } from '../../../utils/playback';
import { Btn, C, useEditorVersion } from './kit';
import { checkQuiz, fmt, type Quiz } from '../core/trace';

type Answer = { status: 'correct' | 'wrong' | 'revealed'; given: number[]; tries: number };

/** Predict mode: the inputs are given; type what the algorithm will compute. */
function QuizCard({ quiz, answer, onAnswer }: { quiz: Quiz; answer: Answer | undefined; onAnswer: (a: Answer) => void }) {
  const [vals, setVals] = useState<string[]>(() => quiz.answer.map(() => ''));
  const [miss, setMiss] = useState<number[] | null>(null);
  useEffect(() => { setVals(quiz.answer.map(() => '')); setMiss(null); }, [quiz]);
  const done = answer && answer.status !== 'wrong';
  const check = () => {
    const given = vals.map((v) => Number(v.trim()));
    const r = checkQuiz(quiz, given);
    const tries = (answer?.tries ?? 0) + 1;
    // The score counts answers right on the first try; later tries still finish the question.
    if (r.correct) onAnswer({ status: 'correct', given, tries });
    else { setMiss(r.off); onAnswer({ status: 'wrong', given, tries }); }
  };
  return (
    <div data-testid="quiz" style={{ background: '#1e2a3a', border: `1px solid ${C.blue}`, borderRadius: 6, padding: '8px 10px', marginBottom: 8 }}>
      <div style={{ color: C.blue, fontSize: 11, fontWeight: 700, letterSpacing: 0.4, marginBottom: 4 }}>PREDICT</div>
      <div style={{ color: C.text, lineHeight: 1.6, marginBottom: 6 }}>{quiz.prompt}</div>
      {!done && (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {quiz.answer.map((_, i) => (
            <label key={i} style={{ display: 'flex', gap: 3, alignItems: 'center', fontFamily: C.mono }}>
              <span style={{ color: C.dim }}>{quiz.labels?.[i] ?? ''}</span>
              <input value={vals[i]} onChange={(e) => setVals(vals.map((v, j) => (j === i ? e.target.value : v)))} onKeyDown={(e) => e.key === 'Enter' && check()}
                style={{ width: 64, background: C.bg, color: C.text, border: `1px solid ${miss && miss[i] > 1e-9 ? C.bad : C.border}`, borderRadius: 3, padding: '3px 5px', fontFamily: C.mono, fontSize: 12 }} />
            </label>
          ))}
          <Btn small active onClick={check}>Check</Btn>
          <Btn small onClick={() => onAnswer({ status: 'revealed', given: [], tries: (answer?.tries ?? 0) + 1 })}>Show me</Btn>
        </div>
      )}
      {answer?.status === 'wrong' && miss && <div style={{ color: C.warn, marginTop: 6 }}>Not quite: the red boxes are off. Try again, or press Show me.</div>}
      {done && (
        <div style={{ marginTop: 4, lineHeight: 1.6 }}>
          <div style={{ color: answer!.status === 'correct' ? C.ok : C.warn }}>
            {answer!.status === 'correct' ? (answer!.tries === 1 ? '✓ Right first time.' : '✓ Right.') : 'The answer:'} ({quiz.answer.map((a) => fmt(a, 4)).join(', ')})
          </div>
          <div style={{ color: C.dim }}>{quiz.rule}</div>
        </div>
      )}
    </div>
  );
}

export function TracePanel({ editor, viewport }: { editor: Editor; viewport: Viewport | null }) {
  useEditorVersion(editor);
  const trace = editor.trace;
  const [step, setStep] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeed] = useState('2x');
  const [showing, setShowing] = useState(false);
  const [answers, setAnswers] = useState<Map<number, Answer>>(new Map());
  const listRef = useRef<HTMLDivElement>(null);
  const total = trace?.steps.length ?? 0;
  const phases = useMemo(() => trace?.phases() ?? [], [trace]);

  // A new trace: start at the beginning, keep the viewport on the model until asked.
  useEffect(() => { setStep(0); setPlaying(false); setShowing(false); setAnswers(new Map()); }, [trace]);
  const predict = editor.predict;
  const pending = (i: number) => { const q = trace?.steps[i]?.quiz, a = answers.get(i); return !!q && predict && (!a || a.status === 'wrong'); };
  const hide = pending(step);
  useEffect(() => { viewport?.setTrace(showing && trace ? trace : null, step, hide); }, [viewport, showing, trace, step, hide]);
  // Playing in Predict mode stops at the next question.
  useEffect(() => { if (playing && hide) setPlaying(false); }, [playing, hide]);
  useEffect(() => () => viewport?.setTrace(null), [viewport]);
  useEffect(() => { listRef.current?.querySelector('[data-cur="1"]')?.scrollIntoView({ block: 'nearest' }); }, [step]);

  const nextPhase = useCallback((s: number) => phases.find((p) => p.start > s)?.start ?? total - 1, [phases, total]);
  const byPhase = speed === 'phase';
  // In Predict mode no jump may pass a question.
  const nextQuiz = useCallback((s: number, to: number) => { for (let i = s + 1; i < to; i++) if (pending(i)) return i; return to; }, [answers, predict, trace]); // eslint-disable-line react-hooks/exhaustive-deps
  const jump = useCallback((s: number) => nextQuiz(s, byPhase ? nextPhase(s) : s + GEOMETRY_SPEEDS[speed].steps), [nextQuiz, byPhase, nextPhase, speed]);
  usePlaybackTicker(playing, byPhase ? { interval: 1400, steps: 1 } : GEOMETRY_SPEEDS[speed], total, setStep, setPlaying, predict || byPhase ? jump : undefined);
  const asked = [...answers.values()], firstTry = asked.filter((a) => a.status === 'correct' && a.tries === 1).length;
  const quizCount = trace ? trace.steps.filter((s) => s.quiz).length : 0;

  const go = (s: number) => { setPlaying(false); setShowing(true); setStep(Math.max(0, Math.min(total - 1, s))); };

  if (!trace) {
    return (
      <div style={{ padding: 16, color: C.dim, fontSize: 12, lineHeight: 1.7, maxWidth: 720 }}>
        <div style={{ color: C.text, fontWeight: 600, marginBottom: 4 }}>Watch an algorithm run</div>
        With <b>Record traces</b> on (toolbar), every mesh operation records what it does, step by step. Try it: press Tab for edit mode, select a face, press <b>E</b> to extrude, or use <b>Mesh › Subdivide smooth</b> to watch Catmull–Clark build face points, edge points and move every vertex. Then press play here.
      </div>
    );
  }
  const cur = trace.steps[step];
  const curPhase = cur?.phase;
  const lo = Math.max(0, step - 30), hi = Math.min(total, step + 60);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', fontSize: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '5px 8px', borderBottom: `1px solid ${C.border}`, flexWrap: 'wrap' }}>
        <b style={{ color: C.accent, marginRight: 6 }}>{trace.op}</b>
        <Btn small onClick={() => go(0)} title="First step">⏮</Btn>
        <Btn small onClick={() => go(step - 1)} title="Previous step">◀</Btn>
        <Btn small active={playing} onClick={() => { setShowing(true); if (step >= total - 1) setStep(0); setPlaying(!playing); }} title="Play / pause">{playing ? '⏸ Pause' : '▶ Play'}</Btn>
        <Btn small onClick={() => go(step + 1)} title="Next step">▶</Btn>
        <Btn small onClick={() => go(total - 1)} title="Last step">⏭</Btn>
        <input type="range" min={0} max={Math.max(0, total - 1)} value={step} onChange={(e) => go(Number(e.target.value))} style={{ flex: 1, minWidth: 90, accentColor: C.accent }} />
        <span style={{ fontFamily: C.mono, color: C.dim, minWidth: 64, textAlign: 'right' }}>{step + 1}/{total}</span>
        <span style={{ display: 'flex', gap: 2, marginLeft: 4 }}>
          {[...Object.keys(GEOMETRY_SPEEDS), 'phase'].map((sp) => <Btn key={sp} small active={speed === sp} onClick={() => setSpeed(sp)} title={sp === 'phase' ? 'Jump one phase of the algorithm at a time' : `${sp} speed`}>{sp === 'phase' ? 'by phase' : sp}</Btn>)}
        </span>
        <Btn small active={showing} onClick={() => { setPlaying(false); setShowing(!showing); }} title="Show the trace in the viewport, or go back to the model">{showing ? 'Back to model' : 'Show in viewport'}</Btn>
        {quizCount > 0 && <Btn small active={predict} onClick={() => { editor.predict = !predict; editor.emit('select'); }} title="Stop before each question and predict the result">🎯 Predict{predict ? ` · ${firstTry} right first time, ${asked.filter((a) => a.status !== 'wrong').length} of ${quizCount} done` : ''}</Btn>}
      </div>
      <div style={{ display: 'flex', gap: 4, padding: '5px 8px', flexWrap: 'wrap', borderBottom: `1px solid ${C.border}` }}>
        {phases.map((p, i) => (
          <button key={i} onClick={() => go(p.start)} style={{ fontSize: 11, padding: '2px 8px', borderRadius: 10, border: `1px solid ${p.phase === curPhase ? C.accent : C.border}`, background: p.phase === curPhase ? '#4a3a22' : C.panel2, color: C.text, cursor: 'pointer' }}>
            {i + 1}. {p.phase}
          </button>
        ))}
        {trace.skipped > 0 && <span style={{ color: C.faint, fontSize: 11, alignSelf: 'center' }}>+{trace.skipped} steps summarised (large mesh)</span>}
      </div>
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1.3, padding: '8px 12px', overflowY: 'auto', borderRight: `1px solid ${C.border}` }}>
          {cur?.quiz && predict && <QuizCard quiz={cur.quiz} answer={answers.get(step)} onAnswer={(a) => setAnswers((m) => new Map(m).set(step, a))} />}
          {cur && hide && <div style={{ color: C.faint, fontSize: 11 }}>{cur.phase}: the result is hidden until you answer. The highlighted elements in the viewport are the inputs.</div>}
          {cur && !hide && (
            <>
              <div style={{ color: C.faint, fontSize: 11, marginBottom: 2 }}>{cur.phase}</div>
              <div style={{ color: C.text, fontSize: 14, fontFamily: C.mono, marginBottom: 6 }}>{cur.label}</div>
              {cur.detail && <div style={{ color: C.dim, lineHeight: 1.6, marginBottom: 6 }}>{cur.detail}</div>}
              {cur.values && (
                <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '2px 12px', fontFamily: C.mono, fontSize: 11 }}>
                  {cur.values.map(([k, v]) => <React.Fragment key={k}><span style={{ color: C.dim }}>{k}</span><span>{v}</span></React.Fragment>)}
                </div>
              )}
              <div style={{ color: C.faint, fontSize: 11, marginTop: 8 }}>
                {[cur.faces?.length && `${cur.faces.length} face(s)`, cur.edges?.length && `${cur.edges.length} edge(s)`, cur.verts?.length && `${cur.verts.length} vertex/vertices`].filter(Boolean).join(' · ') || ''}{cur.faces?.length || cur.edges?.length || cur.verts?.length ? ' highlighted' : ''}
              </div>
            </>
          )}
        </div>
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', fontFamily: C.mono, fontSize: 11 }}>
          {trace.steps.slice(lo, hi).map((s, k) => {
            const i = lo + k;
            return (
              <div key={i} data-cur={i === step ? '1' : '0'} onClick={() => go(i)} style={{ padding: '2px 8px', cursor: 'pointer', background: i === step ? '#4a3a22' : 'transparent', color: i === step ? C.text : i < step ? C.dim : C.faint, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {String(i + 1).padStart(3)}  {pending(i) ? '🎯 predict first' : s.label}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
