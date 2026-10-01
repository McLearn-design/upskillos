// Saving and loading the project model (ADR 10).
//
// The saved form is the model itself as JSON, with a format version. Loading
// migrates older versions forward, then checks the whole thing, so a bad file is
// reported ("scenes/main.scene: Player has no property 'speed'") instead of
// breaking the editor later.

import { FORMAT_VERSION, type AnimationClip, type NodeData, type Project, type SceneData, type SpriteAnimation, type TilesetData } from './types';
import { trackTarget } from './animation';
import { checkProp, isNodeType, propDef, propValue } from './registry';
import { walk } from './project';
import { tilesetGrid, tilesetProblem } from './tiles';

/** Deterministic: the same project always gives the same text (keys in the model's own order). */
export function serialize(p: Project): string {
  return JSON.stringify(p, null, 1);
}

/** Each entry turns a project of version n into version n + 1. */
const MIGRATIONS: Record<number, (p: Record<string, unknown>) => Record<string, unknown>> = {
  // Format 2 adds tilesets (Phase 6). Older projects have none.
  1: (p) => {
    const { assets, ...rest } = p;
    return { ...rest, formatVersion: 2, tilesets: [], assets };
  },
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
  const tilesets = new Map<string, TilesetData>();
  for (const ts of p.tilesets ?? []) {
    const bad = tilesetProblem(ts);
    if (bad) { out.push(bad); continue; }
    if (tilesets.has(ts.path)) out.push(`There are two tilesets at "${ts.path}"`);
    tilesets.set(ts.path, ts);
    if (!assets.has(ts.image)) out.push(`${ts.path}: missing image "${ts.image}"`);
  }
  /** How many tiles a tileset has, when its image is known. */
  const tileCount = (path: string) => { const ts = tilesets.get(path), a = ts && p.assets.find((x) => x.path === ts.image); return ts && a ? tilesetGrid(ts, a.width, a.height).count : null; };
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
        if (def.type === 'tileset' && typeof v === 'string' && !tilesets.has(v)) out.push(`${at}: missing tileset "${v}"`);
        if (def.type === 'cells' && !bad) {
          const count = tileCount(propValue(n.type, n.props, 'tileset') as string);
          const cells = v as number[];
          if (count !== null) for (let i = 2; i < cells.length; i += 3) if (cells[i] >= count) { out.push(`${at}: cell ${cells[i - 2]}, ${cells[i - 1]} uses tile ${cells[i]}, but the tileset has ${count} tiles (0 to ${count - 1})`); break; }
        }
        if (def.type === 'animations' && !bad) out.push(...clipProblems(s, n, v as AnimationClip[]).map((m) => `${at}: ${m}`));
        if (def.type === 'spriteFrames' && !bad) for (const a of v as SpriteAnimation[]) for (const f of a.frames) if (!assets.has(f)) out.push(`${at}: animation "${a.name}" uses a missing image "${f}"`);
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
  for (const key of ['name', 'settings', 'input', 'scenes', 'scripts', 'tilesets', 'assets'] as const) if (p[key] === undefined) throw new Error(`The project has no "${key}"`);
  const bad = problems(p);
  if (bad.length) throw new Error(`The project has problems:\n${bad.join('\n')}`);
  return p;
}

/** An AnimationPlayer's tracks must each reach a real node and property, with keys that property accepts. */
function clipProblems(scene: SceneData, player: NodeData, clips: AnimationClip[]): string[] {
  const out: string[] = [];
  for (const c of clips) {
    for (const tr of c.tracks) {
      const where = `animation "${c.name}", track ${tr.path}.${tr.property}`;
      const target = trackTarget(scene, player.id, tr.path);
      if (!target) { out.push(`${where}: there is no node "${tr.path}" (paths start at the AnimationPlayer's parent)`); continue; }
      const def = propDef(target.type, tr.property);
      if (!def) { out.push(`${where}: ${target.type} has no property "${tr.property}"`); continue; }
      if (def.type === 'spriteFrames' || def.type === 'animations') { out.push(`${where}: ${tr.property} cannot be animated`); continue; }
      for (const k of tr.keys) { const bad = checkProp(def, k.value); if (bad) { out.push(`${where}: the key at ${k.time} s: ${bad}`); break; } }
    }
  }
  const auto = propValue(player.type, player.props, 'autoplay') as string;
  if (auto && !clips.some((c) => c.name === auto)) out.push(`autoplay names "${auto}", but there is no animation by that name`);
  return out;
}
