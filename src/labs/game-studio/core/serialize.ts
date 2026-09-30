// Saving and loading the project model (ADR 10).
//
// The saved form is the model itself as JSON, with a format version. Loading
// migrates older versions forward, then checks the whole thing, so a bad file is
// reported ("scenes/main.scene: Player has no property 'speed'") instead of
// breaking the editor later.

import { FORMAT_VERSION, type NodeData, type Project } from './types';
import { checkProp, isNodeType, propDef } from './registry';
import { walk } from './project';

/** Deterministic: the same project always gives the same text (keys in the model's own order). */
export function serialize(p: Project): string {
  return JSON.stringify(p, null, 1);
}

/** Each entry turns a project of version n into version n + 1. */
const MIGRATIONS: Record<number, (p: Record<string, unknown>) => Record<string, unknown>> = {
  // 1: (p) => ({ ...p, formatVersion: 2, … }),
};

export function migrate(raw: Record<string, unknown>): Record<string, unknown> {
  let p = raw;
  let v = Number(p.formatVersion);
  if (!Number.isInteger(v) || v < 1) throw new Error('This is not a Game Studio project (no format version)');
  if (v > FORMAT_VERSION) throw new Error(`This project was saved by a newer Game Studio (format ${v}; this one reads up to ${FORMAT_VERSION})`);
  while (v < FORMAT_VERSION) {
    const step = MIGRATIONS[v];
    if (!step) throw new Error(`No way to upgrade format ${v}`);
    p = step(p);
    v = Number(p.formatVersion);
  }
  return p;
}

/** Everything wrong with a project, as sentences. Empty means it is sound. */
export function problems(p: Project): string[] {
  const out: string[] = [];
  const ids = new Set<string>();
  const scripts = new Set(p.scripts.map((s) => s.path));
  const assets = new Set(p.assets.map((a) => a.path));
  if (p.settings.mainScene && !p.scenes.some((s) => s.path === p.settings.mainScene)) out.push(`The main scene "${p.settings.mainScene}" does not exist`);
  for (const s of p.scenes) {
    for (const n of walk(s.root)) {
      const at = `${s.path}: ${n.name}`;
      if (ids.has(n.id)) out.push(`${at}: id ${n.id} is used twice`);
      ids.add(n.id);
      if (!isNodeType(n.type)) { out.push(`${at}: unknown node type "${n.type}"`); continue; }
      for (const [k, v] of Object.entries(n.props)) {
        const def = propDef(n.type, k);
        if (!def) { out.push(`${at}: ${n.type} has no property "${k}"`); continue; }
        const bad = checkProp(def, v);
        if (bad) out.push(`${at}: ${bad}`);
        if (def.type === 'texture' && typeof v === 'string' && !assets.has(v)) out.push(`${at}: missing image "${v}"`);
      }
      if (n.script && !scripts.has(n.script)) out.push(`${at}: missing script "${n.script}"`);
      const names = n.children.map((c: NodeData) => c.name);
      const dup = names.find((x, i) => names.indexOf(x) !== i);
      if (dup) out.push(`${at}: two children are both called "${dup}"`);
    }
  }
  const numbered = [...ids, ...p.assets.map((a) => a.id), ...p.scenes.map((s) => s.id)].map((id) => Number(id.slice(1))).filter(Number.isFinite);
  if (numbered.some((n) => n >= p.nextId)) out.push('nextId is not above every id in use');
  return out;
}

/** Parse, migrate and check a saved project. Throws with every problem listed if it is not sound. */
export function deserialize(text: string): Project {
  let raw: Record<string, unknown>;
  try { raw = JSON.parse(text); } catch { throw new Error('The project file is not valid JSON'); }
  const p = migrate(raw) as unknown as Project;
  for (const key of ['name', 'settings', 'input', 'scenes', 'scripts', 'assets'] as const) if (p[key] === undefined) throw new Error(`The project has no "${key}"`);
  const bad = problems(p);
  if (bad.length) throw new Error(`The project has problems:\n${bad.join('\n')}`);
  return p;
}
