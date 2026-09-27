import { openDB } from 'idb';

const DB_NAME = 'upskillos-game-studio';
const DB_VERSION = 1;

const dbPromise = openDB(DB_NAME, DB_VERSION, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('projects')) db.createObjectStore('projects', { keyPath: 'id' });
    if (!db.objectStoreNames.contains('preferences')) db.createObjectStore('preferences');
  },
});

export async function saveProject(project) {
  return (await dbPromise).put('projects', project);
}

export async function loadProject(id) {
  return (await dbPromise).get('projects', id);
}

export async function listProjects() {
  const projects = await (await dbPromise).getAll('projects');
  return projects.sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export async function setLastProjectId(id) {
  return (await dbPromise).put('preferences', id, 'lastProjectId');
}

export async function getLastProjectId() {
  return (await dbPromise).get('preferences', 'lastProjectId');
}

