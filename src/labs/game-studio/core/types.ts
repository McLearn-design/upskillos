// The project model: everything a game is, as plain data. No React, no Phaser.
//
// This is the single source of truth (docs/game-studio-architecture.md, ADR 2).
// The editor changes it only through commands; the runtime receives a copy.

export const FORMAT_VERSION = 1;

export interface Vec2 { x: number; y: number }

/** A value a node property can hold. Vectors are {x, y}; textures and scripts are project paths. */
export type PropValue = number | string | boolean | Vec2 | null;

export interface NodeData {
  /** Stable, never shown, never reused within the project. */
  id: string;
  /** A registered node type (core/registry.ts). */
  type: string;
  /** Unique among its siblings, so paths like "Player/Sprite" are unambiguous. */
  name: string;
  /** Only the properties that differ from the type's defaults are stored. */
  props: Record<string, PropValue>;
  /** Project path of the attached script, if any. */
  script: string | null;
  children: NodeData[];
}

export interface SceneData {
  id: string;
  /** Project path, e.g. "scenes/main.scene". */
  path: string;
  root: NodeData;
}

export interface ScriptFile {
  /** Project path, e.g. "scripts/player.js". */
  path: string;
  source: string;
}

export type AssetKind = 'image';

/** An imported file. Its bytes live outside the model (storage), keyed by id. */
export interface AssetData {
  id: string;
  /** Project path, e.g. "assets/player.png". */
  path: string;
  kind: AssetKind;
  mime: string;
  width: number;
  height: number;
}

/** A named input action and the keys bound to it (KeyboardEvent.code values, e.g. "ArrowLeft", "KeyA"). */
export interface InputAction { name: string; keys: string[] }

export interface ProjectSettings {
  width: number;
  height: number;
  background: string;
  mainScene: string | null;
}

export interface Project {
  formatVersion: number;
  name: string;
  /** Counter for ids: deterministic, so replaying the code log rebuilds the same ids. */
  nextId: number;
  settings: ProjectSettings;
  input: InputAction[];
  scenes: SceneData[];
  scripts: ScriptFile[];
  assets: AssetData[];
}
