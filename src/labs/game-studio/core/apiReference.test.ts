// The reference is checked against the real engine both ways (ADR 5): everything it
// describes exists, and everything a script can reach is described. Its declarations
// compile, and every example in it, and every example game's scripts, type-check
// against them.
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { API_REFERENCE, FIRST_SCRIPT, SCENE_API, ancestors, apiEntry, engineDts } from './apiReference';
import { nodeTypes } from './registry';
import { newProject } from './project';
import { projectApi } from './api';
import { Doc } from './doc';
import { Game, scriptGlobals } from '../engine/game';
import { NODE_CLASSES, PhysicsBody2D } from '../engine/nodes';
import { Vec2 } from '../engine/vec2';
import { EXAMPLES } from '../examples';

/** Public on the runtime objects, but used by the engine and not part of the API. */
const INTERNAL: Record<string, string[]> = {
  Node2D: ['worldTransform'],
  CollisionShape2D: ['worldShape'],
  PhysicsBody2D: ['shapes'],
  Area2D: ['shapes'],
  Vec2: ['toString', 'toJSON'],
  input: ['key', 'endFrame', 'endPhysicsStep', 'releaseAll', 'inPhysics', 'held', 'down', 'up', 'physicsDown', 'physicsUp', 'actions', 'keys'],
};

const CLASSES: Record<string, new () => object> = { ...NODE_CLASSES, PhysicsBody2D, Vec2 };

function game() {
  const d = new Doc(newProject());
  const s = d.createScene('scenes/main.scene');
  return new Game(d.project, d.scene(s.id), { frame: () => undefined });
}

/** Every name reachable on an object: its own and its prototypes', stopping at Object. */
function reachable(o: object): string[] {
  const names = new Set<string>();
  for (let x: object | null = o; x && x !== Object.prototype; x = Object.getPrototypeOf(x)) for (const k of Object.getOwnPropertyNames(x)) names.add(k);
  return [...names].filter((k) => k !== 'constructor' && !k.startsWith('_'));
}

describe('the API reference', () => {
  it('has an entry for every node type in the registry, and every script global', () => {
    for (const t of nodeTypes()) expect(apiEntry(t.type), t.type).toBeDefined();
    const globals = Object.keys(scriptGlobals(game())).sort();
    const documented = API_REFERENCE.filter((e) => !e.builtin).map((e) => e.name).sort();
    expect(documented).toEqual(globals);
  });

  it('each class extends what the engine’s class extends', () => {
    for (const e of API_REFERENCE.filter((x) => x.kind === 'class')) {
      const C = CLASSES[e.name];
      expect(C, e.name).toBeDefined();
      const parent = Object.getPrototypeOf(C.prototype).constructor;
      expect(e.extends ?? 'Object', e.name).toBe(parent === Object ? 'Object' : parent.name);
    }
  });

  it('everything it describes exists on the real objects', () => {
    const g = game(), globals = scriptGlobals(g) as Record<string, object>;
    for (const e of API_REFERENCE) {
      const o = e.kind === 'class' ? new CLASSES[e.name]() : e.builtin ? (globalThis as unknown as Record<string, object>)[e.name] : globals[e.name];
      for (const x of e.members) if (x.name !== 'constructor') expect(x.name in o, `${e.name}.${x.name}`).toBe(true);
    }
  });

  it('nothing a script can reach is missing from it', () => {
    const g = game(), globals = scriptGlobals(g) as Record<string, object>;
    for (const e of API_REFERENCE.filter((x) => !x.builtin)) {
      const o = e.kind === 'class' ? new CLASSES[e.name]() : globals[e.name];
      const described = new Set(ancestors(e).flatMap((a) => [...a.members.map((x) => x.name), ...(INTERNAL[a.name] ?? [])]));
      const missing = reachable(o).filter((k) => !described.has(k));
      expect(missing, e.name).toEqual([]);
    }
  });

  it('the Scene API reference matches project, scene and node handles', () => {
    const p = newProject();
    const project = projectApi(p);
    const scene = project.createScene('scenes/main.scene');
    const node = scene.add('Node', { name: 'N' });
    const names = (o: object) => Object.getOwnPropertyNames(o).sort();
    expect(SCENE_API.find((e) => e.name === 'project')!.members.map((x) => x.name).sort()).toEqual(names(project));
    expect(SCENE_API.find((e) => e.name === 'SceneHandle')!.members.map((x) => x.name).sort()).toEqual(names(scene));
    // A node handle also has every Inspector property of its type; a plain Node has none.
    expect(SCENE_API.find((e) => e.name === 'NodeHandle')!.members.map((x) => x.name).sort()).toEqual(names(node));
  });
});

describe('the declarations the script editor uses', () => {
  const dts = engineDts();

  /** Type-check JavaScript files against the declarations, with the script editor's libraries (no DOM). */
  function check(files: Record<string, string>): string[] {
    const all: Record<string, string> = { '/engine.d.ts': dts, ...files };
    const options: ts.CompilerOptions = { allowJs: true, checkJs: true, noEmit: true, strict: false, target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, lib: ['lib.es2020.d.ts'], types: [] };
    const host = ts.createCompilerHost(options);
    const read = host.getSourceFile.bind(host);
    host.getSourceFile = (name, lang) => (name in all ? ts.createSourceFile(name, all[name], lang) : read(name, lang));
    host.fileExists = (name) => name in all || ts.sys.fileExists(name);
    host.readFile = (name) => all[name] ?? ts.sys.readFile(name);
    const program = ts.createProgram(Object.keys(all), options, host);
    return ts.getPreEmitDiagnostics(program).map((d) => {
      const where = d.file ? `${d.file.fileName}:${d.file.getLineAndCharacterOfPosition(d.start ?? 0).line + 1}` : '';
      return `${where} ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`;
    });
  }

  it('compile, and every example in the reference type-checks against them', () => {
    const files: Record<string, string> = {};
    for (const e of API_REFERENCE) if (e.example) files[`/reference/${e.name}.js`] = e.example;
    files['/reference/first.js'] = FIRST_SCRIPT;
    expect(Object.keys(files).length).toBeGreaterThan(8);
    expect(check(files)).toEqual([]);
  });

  it('every example game’s scripts type-check against them', () => {
    for (const ex of EXAMPLES) {
      const d = new Doc(newProject());
      d.runCode('Build', ex.code);
      const files = Object.fromEntries(d.project.scripts.map((s) => [`/${ex.id}/${s.path}`, s.source]));
      expect(check(files), ex.title).toEqual([]);
    }
  });

  it('a wrong name in a script is caught: isOnFlor is not a method', () => {
    const errors = check({ '/bad.js': 'export default class P extends CharacterBody2D { physicsUpdate() { this.isOnFlor(); } }' });
    expect(errors.join('\n')).toMatch(/isOnFlor/);
  });
});
