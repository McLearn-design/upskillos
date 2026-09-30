// Projects in the browser (ADR 10): IndexedDB, one record per project (the model as
// JSON) plus one record per asset (its bytes), and a separate recovery copy that
// autosave writes, so autosave never overwrites what you last saved.
//
// Database version 2 adds these stores. The prototype's "projects" store (version 1)
// is left as it was: those projects are not opened, and not deleted (ADR 1).

import { openDB, type IDBPDatabase } from 'idb';
import { deserialize, serialize } from '../core/serialize';
import type { Project } from '../core/types';

const DB = 'upskillos-game-studio';

export interface ProjectRecord { id: string; name: string; updatedAt: string; text: string }
interface AssetRecord { key: string; projectId: string; assetId: string; blob: Blob }

let db: Promise<IDBPDatabase> | null = null;
function open(): Promise<IDBPDatabase> {
  db ??= openDB(DB, 2, {
    upgrade(d, oldVersion) {
      if (oldVersion < 1) { d.createObjectStore('projects', { keyPath: 'id' }); d.createObjectStore('preferences'); }
      if (oldVersion < 2) {
        d.createObjectStore('projects2', { keyPath: 'id' });
        const a = d.createObjectStore('assets', { keyPath: 'key' });
        a.createIndex('projectId', 'projectId');
        d.createObjectStore('recovery', { keyPath: 'id' });
      }
    },
  });
  return db;
}

export const newProjectId = (): string => globalThis.crypto?.randomUUID?.() ?? `p${Date.now()}${Math.random().toString(36).slice(2)}`;

export async function listProjects(): Promise<{ id: string; name: string; updatedAt: string }[]> {
  const all = (await (await open()).getAll('projects2')) as ProjectRecord[];
  return all.map(({ id, name, updatedAt }) => ({ id, name, updatedAt })).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function saveProject(id: string, p: Project): Promise<void> {
  const rec: ProjectRecord = { id, name: p.name, updatedAt: new Date().toISOString(), text: serialize(p) };
  const d = await open();
  await d.put('projects2', rec);
  await d.delete('recovery', id);
  await d.put('preferences', id, 'lastProject2');
}

/** Load and check a project. Throws, listing every problem, if the saved file is not sound. */
export async function loadProject(id: string): Promise<Project> {
  const rec = (await (await open()).get('projects2', id)) as ProjectRecord | undefined;
  if (!rec) throw new Error('That project is not in this browser any more');
  return deserialize(rec.text);
}

export async function deleteProject(id: string): Promise<void> {
  const d = await open();
  const tx = d.transaction(['projects2', 'assets', 'recovery'], 'readwrite');
  await tx.objectStore('projects2').delete(id);
  await tx.objectStore('recovery').delete(id);
  const assets = tx.objectStore('assets');
  for (const key of await assets.index('projectId').getAllKeys(id)) await assets.delete(key);
  await tx.done;
}

export async function lastProjectId(): Promise<string | undefined> {
  return (await (await open()).get('preferences', 'lastProject2')) as string | undefined;
}

export async function putAsset(projectId: string, assetId: string, blob: Blob): Promise<void> {
  const rec: AssetRecord = { key: `${projectId}/${assetId}`, projectId, assetId, blob };
  await (await open()).put('assets', rec);
}

export async function getAsset(projectId: string, assetId: string): Promise<Blob | undefined> {
  return ((await (await open()).get('assets', `${projectId}/${assetId}`)) as AssetRecord | undefined)?.blob;
}

/** Autosave: a recovery copy, kept apart from the saved project. */
export async function saveRecovery(id: string, p: Project): Promise<void> {
  await (await open()).put('recovery', { id, name: p.name, updatedAt: new Date().toISOString(), text: serialize(p) });
}

export async function getRecovery(id: string): Promise<ProjectRecord | undefined> {
  return (await (await open()).get('recovery', id)) as ProjectRecord | undefined;
}
