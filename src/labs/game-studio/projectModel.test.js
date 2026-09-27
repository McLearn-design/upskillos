import { describe, expect, it } from 'vitest';
import {
  GAME_PROJECT_KIND,
  addEntity,
  createProject,
  duplicateEntity,
  getActiveScene,
  normalizeProject,
  patchEntity,
  removeEntity,
} from './projectModel';

describe('Game Studio project model', () => {
  it('creates a versioned project with an editable scene', () => {
    const project = createProject();
    expect(project.kind).toBe(GAME_PROJECT_KIND);
    expect(getActiveScene(project).entities.length).toBeGreaterThan(0);
  });

  it('updates, duplicates, and removes entities without mutating the source', () => {
    const source = createProject();
    const scene = getActiveScene(source);
    const entity = scene.entities[0];
    const moved = patchEntity(source, scene.id, entity.id, { transform: { x: 42 } });
    expect(entity.transform.x).not.toBe(42);
    expect(getActiveScene(moved).entities[0].transform.x).toBe(42);

    const duplicated = duplicateEntity(moved, scene.id, entity.id);
    expect(getActiveScene(duplicated.project).entities).toHaveLength(scene.entities.length + 1);
    expect(duplicated.entity.id).toBeTruthy();
    expect(duplicated.entity.id).not.toBe(entity.id);

    const removed = removeEntity(duplicated.project, scene.id, duplicated.entity.id);
    expect(getActiveScene(removed).entities).toHaveLength(scene.entities.length);
  });

  it('normalizes imported values and rejects unrelated files', () => {
    const source = createProject();
    source.settings.width = 10;
    source.scenes[0].entities[0].display.color = 'nope';
    const normalized = normalizeProject(JSON.parse(JSON.stringify(source)));
    expect(normalized.settings.width).toBe(320);
    expect(normalized.scenes[0].entities[0].display.color).toMatch(/^#/);
    expect(() => normalizeProject({ version: 1 })).toThrow(/not a Game Studio/i);
  });

  it('upgrades version 1 entities with current gameplay and script components', () => {
    const legacy = createProject();
    legacy.version = 1;
    delete legacy.scenes[0].entities[0].gameplay;
    delete legacy.scenes[0].entities[0].script;
    const normalized = normalizeProject(JSON.parse(JSON.stringify(legacy)));
    expect(normalized.version).toBe(2);
    expect(normalized.scenes[0].entities[0].gameplay.role).toBe('none');
    expect(normalized.scenes[0].entities[0].script.enabled).toBe(false);
  });

  it('adds an entity to the requested scene', () => {
    const source = createProject();
    const scene = getActiveScene(source);
    const result = addEntity(source, scene.id, 'circle');
    expect(result.entity.type).toBe('circle');
    expect(getActiveScene(result.project).entities).toHaveLength(scene.entities.length + 1);
  });
});
