// Train in view (ml/qlearning.ts in the game's runtime): a panel over the running game while an agent learns in
// it. What the learner is doing now (exploring, or a greedy check), how fast the game plays, and the learning curve;
// when it is done, the score and the way back to the table and Save as brain.

import type { Store } from './store';
import { Btn, C, useStore } from './kit';
import { QCurve } from './TrainDialog';

/** The strip's height: the game box stops above it, so the panel never covers the game. */
export const TRAIN_HUD_HEIGHT = 186;

/** Whether the strip shows: while training in view, and after, until the game is run another way. */
export const trainHudShown = (store: Store) => store.inView && (store.training.running || store.training.score !== null || !!store.training.error);

/** Game frames per drawn frame: 1 is real time; the last plays as fast as the machine allows. */
const SPEEDS: [number, string][] = [[1, 'Real time'], [4, '4×'], [16, '16×'], [64, '64×'], [1024, 'Max']];

export function TrainHud({ store, onOpenDialog, onWatch }: { store: Store; onOpenDialog: () => void; onWatch: () => void }) {
  useStore(store);
  const t = store.training, live = store.trainLive;
  if (!trainHudShown(store)) return null;
  const lastCheck = [...t.episodes].reverse().find((e) => e.greedy !== undefined);
  const doing = !live ? 'Starting: loading the game, and playing at random (headless) to measure it first…'
    : live.mode === 'check' ? `Greedy check after episode ${live.episode}, game ${live.checkGame}: no exploring, no learning. Return so far ${live.total.toFixed(1)}`
    : live.mode === 'reset' ? `Episode ${live.episode} of ${live.episodes}: starting`
    : `Episode ${live.episode} of ${live.episodes}: exploring ${Math.round(live.epsilon * 100)}% of the time (ε ${live.epsilon.toFixed(2)}). Return so far ${live.total.toFixed(1)}, ${live.steps} steps`;
  return (
    <div data-testid="train-hud" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: TRAIN_HUD_HEIGHT, boxSizing: 'border-box', display: 'flex', gap: 12, background: C.panel, borderTop: `1px solid ${C.border}`, padding: 10, fontSize: 12, color: C.text }}>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 6 }}>
        <b>{t.running ? 'Training in view (Q-learning)' : t.error ? 'Training stopped' : 'Trained in view'}</b>
        {t.running && <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ color: C.faint }}>speed</span>
          {SPEEDS.map(([v, label]) => <Btn key={v} small testid={`train-speed-${v}`} active={store.trainSpeed === v} onClick={() => store.setTrainSpeed(v)}>{label}</Btn>)}
        </div>}
        <div data-testid="train-hud-status" style={{ color: t.error ? C.warn : C.dim, lineHeight: 1.5 }}>
          {t.error ? `Could not train: ${t.error}`
            : t.running ? <>{doing}{lastCheck ? <><br />Last greedy check {lastCheck.greedy!.toFixed(1)}; random play {t.random?.toFixed(1)}.</> : null}</>
            : `Trained. Its greedy play averages ${t.score!.toFixed(1)} a game; playing at random averages ${t.random?.toFixed(1)}.`}
        </div>
        {!t.running && t.policy && (
          <div style={{ display: 'flex', gap: 6 }}>
            <Btn testid="train-hud-watch" onClick={onWatch}>▶ Watch it play</Btn>
            <Btn testid="train-hud-open" onClick={onOpenDialog}>What it learned, Save as brain…</Btn>
          </div>
        )}
      </div>
      <QCurve episodes={t.episodes} random={t.random} total={t.total} />
    </div>
  );
}
