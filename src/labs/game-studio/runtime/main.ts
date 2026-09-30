// The game's iframe (ADR 3). Built into one self-contained script
// (vite.game-runtime.config.js) that the editor writes into a sandboxed iframe,
// and that an exported game runs as it is.
//
// It waits for a `load` message with the project, turns the assets into textures,
// loads the scripts as modules, builds the engine's node tree and runs it inside a
// Phaser scene. Logs and errors go back to the editor; nothing goes back into the
// project.

import * as Phaser from 'phaser';
import { Game, MATH, scriptGlobals, type ScriptError } from '../engine/game';
import { NODE_CLASSES, Node, nodeTypeOf } from '../engine/nodes';
import { Vec2 } from '../engine/vec2';
import { sceneAt } from '../core/project';
import { propsOf } from '../core/registry';
import { CHANNEL, type FromRuntime, type LogLevel, type ToRuntime } from './protocol';
import { loadScripts, locate, type LoadedScripts } from './scripts';
import { PhaserRenderer } from './phaserRenderer';

const send = (m: FromRuntime) => parent.postMessage({ channel: CHANNEL, ...m }, '*');

// ── console and uncaught errors go to the editor's Output ─────────────────
const fmt = (a: unknown): string => {
  if (typeof a === 'string') return a;
  if (a instanceof Error) return a.message;
  try { return JSON.stringify(a); } catch { return String(a); }
};
for (const level of ['log', 'info', 'warn', 'error'] as LogLevel[]) {
  const orig = console[level].bind(console);
  console[level] = (...args: unknown[]) => { orig(...args); send({ type: 'log', level, text: args.map(fmt).join(' ') }); };
}

let scripts: LoadedScripts | null = null;
const report = (e: { message: string; stack?: string; file?: string | null }, node: string | null, phase: string | null) => {
  const where = scripts && e.stack ? locate(e.stack, scripts.sourceName) : null;
  send({ type: 'error', message: e.message, file: where?.file ?? e.file ?? null, line: where?.line ?? null, column: where?.column ?? null, node, phase });
};
addEventListener('error', (ev) => { report(ev.error ?? { message: ev.message }, null, null); ev.preventDefault(); });
addEventListener('unhandledrejection', (ev) => { const r = ev.reason; report(r instanceof Error ? r : { message: String(r) }, null, null); ev.preventDefault(); });

// ── running ───────────────────────────────────────────────────────────────
let phaser: Phaser.Game | null = null;
let game: Game | null = null;
let lastLoad: Extract<ToRuntime, { type: 'load' }> | null = null;
let paused = false;

async function start(msg: Extract<ToRuntime, { type: 'load' }>): Promise<void> {
  lastLoad = msg;
  phaser?.destroy(true);
  phaser = null; game = null; paused = false;
  const { project } = msg;
  const scene = sceneAt(project, msg.scene);
  if (!scene) { report({ message: `There is no scene "${msg.scene}"` }, null, null); return; }

  // A script's `class … extends CharacterBody2D` runs when the module loads, so the classes must be there first.
  Object.assign(globalThis, NODE_CLASSES, { Vec2, math: MATH });
  try { scripts = await loadScripts(project.scripts); }
  catch (e) {
    const err = e as Error & { file?: string; line?: number; column?: number };
    if (err.line) send({ type: 'error', message: err.message, file: err.file ?? null, line: err.line, column: err.column ?? 1, node: null, phase: 'load' });
    else report(err, null, 'load');
    return;
  }

  const urls = new Map(msg.assets.map((a) => [a.path, URL.createObjectURL(new Blob([a.bytes], { type: a.mime }))]));
  const onError = (e: ScriptError) => report({ message: e.message, stack: e.stack, file: e.file }, e.node, e.phase);

  const s = project.settings;
  const scenes = class extends Phaser.Scene {
    preload() { for (const [path, url] of urls) this.load.image(path, url); }
    create() {
      const classes = scripts!.classes;
      try {
        game = new Game(project, scene!, new PhaserRenderer(this), {
          scriptClass: (path) => { const c = classes.get(path); return typeof c === 'function' ? (c as typeof Node) : undefined; },
          onError,
        });
      } catch (e) { report(e as Error, null, 'build'); return; }
      Object.assign(globalThis, scriptGlobals(game));
      game.start();
      send({ type: 'running', scene: scene!.path });
    }
    update(_time: number, delta: number) {
      if (game && !paused) game.step(Math.min(delta / 1000, 0.25));
    }
  };
  phaser = new Phaser.Game({
    type: Phaser.AUTO, parent: 'game', width: s.width, height: s.height, backgroundColor: s.background,
    scene: scenes, banner: false, input: { keyboard: false }, pixelArt: s.pixelArt !== false, roundPixels: s.pixelArt !== false,
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
  });
}

// Keys go to the engine's input map. Phaser's own keyboard is off: scripts use actions.
window.addEventListener('keydown', (e) => { game?.input.key(e.code, true); if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault(); });
window.addEventListener('keyup', (e) => game?.input.key(e.code, false));
window.addEventListener('blur', () => game?.input.releaseAll());

/** The live values of a node's registered properties, for the Inspector while running. */
function inspect(path: string): Record<string, unknown> | null {
  const n = game?.root.find(path);
  if (!n) return null;
  const out: Record<string, unknown> = {};
  for (const def of propsOf(nodeTypeOf(n))) {
    const v = (n as unknown as Record<string, unknown>)[def.name];
    out[def.name] = v && typeof v === 'object' ? { x: (v as { x: number }).x, y: (v as { y: number }).y } : v;
  }
  return out;
}

addEventListener('message', (ev: MessageEvent) => {
  const m = ev.data as ToRuntime & { channel?: string };
  if (m?.channel !== CHANNEL) return;
  if (m.type === 'load') void start(m);
  else if (m.type === 'pause' || m.type === 'resume') { paused = m.type === 'pause'; game?.input.releaseAll(); send({ type: 'paused', paused }); }
  else if (m.type === 'restart' && lastLoad) void start(lastLoad);
  else if (m.type === 'inspect') send({ type: 'state', path: m.path, props: inspect(m.path) });
});

send({ type: 'ready' });
