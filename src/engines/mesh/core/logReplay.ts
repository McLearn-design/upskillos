// Replaying the GUI → code log (Script › Trace the GUI → code log). Every change made in the interface is
// logged as the script line that would make it (Editor.run). Running those lines, in order, on the scene as it
// was before the first of them must rebuild the scene exactly: the log is the session as a program. This runs
// them on a fresh editor and compares hashes of everything a script can change.

import { Editor } from './Editor';
import { runScript } from './api';
import { sceneHash } from './recorder';
import { Scene } from './Scene';
import { Trace } from './trace';

/** Replay the log on a copy of the starting scene, traced, and say whether it rebuilds the current scene. */
export function traceReplay(ed: Editor): { lines: number; same: boolean; error: string | null } {
  const trace = new Trace('Replay the log');
  const first = ed.undoStack.find((s) => s.log);
  const lines = ed.log.map((e) => e.code).filter((c): c is string => !!c);
  trace.step({
    phase: 'Log', label: lines.length ? `${lines.length} logged line${lines.length === 1 ? '' : 's'}: ${lines.slice(-3).join(' · ')}` : 'The log is empty: change something with the menus, the Inspector or the gizmo first',
    detail: 'Each change through the interface is written as the script line that makes it: objects by name (scene.get("…")), numbers trimmed to 6 decimals, rotations in radians.',
    values: lines.slice(-8).map((l, i) => [`${Math.max(0, lines.length - 8) + i + 1}`, l] as [string, string]),
    quiz: lines.length ? { prompt: 'How many lines will the replay run?', answer: [lines.length], labels: ['lines'], rule: 'One line (or a few) per change made in the interface; undone changes are taken out of the log.', tolerance: 0 } : undefined,
  });
  if (!first || !lines.length) { ed.trace = trace; ed.traceTarget = ed.active; ed.emit('trace'); return { lines: 0, same: true, error: null }; }
  const fresh = new Editor();
  fresh.scene = Scene.fromJSON(first.before);
  const r = runScript(fresh, lines.join('\n'));
  trace.step({ phase: 'Replay', label: r.error ? `The replay stopped: ${r.error}` : `Ran ${lines.length} lines on a copy of the scene from before "${first.label}"`, detail: 'A fresh editor, the starting scene, and the log run as one script.', values: [['start', `before "${first.label}"`]] });
  const a = sceneHash(ed.scene), b = sceneHash(fresh.scene), same = !r.error && a === b;
  trace.step({
    phase: 'Compare', label: same ? 'The replayed scene matches the scene you built: same hash' : 'The replayed scene differs from the scene you built',
    detail: 'The hash covers names, transforms, hierarchy, meshes, modifiers and materials. Equal hashes mean the log really is the session as a program.',
    values: [['your scene', String(a)], ['replayed', String(b)]],
  });
  ed.trace = trace; ed.traceTarget = ed.active; ed.emit('trace');
  ed.message = same ? `Replayed ${lines.length} logged lines: the same scene` : `Replay differs${r.error ? `: ${r.error}` : ''}`;
  ed.emit('select');
  return { lines: lines.length, same, error: r.error };
}
