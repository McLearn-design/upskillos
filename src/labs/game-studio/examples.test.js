import { describe, expect, it } from 'vitest';
import { GAME_CODE_RECIPES } from './codeRecipes';
import { GAME_STUDIO_EXAMPLES } from './examples';
import { getActiveScene, normalizeProject } from './projectModel';
import { validateLearnerScript } from './scriptRuntime';

describe('Game Studio learning library', () => {
  it('uses unique IDs and produces valid portable projects', () => {
    expect(new Set(GAME_STUDIO_EXAMPLES.map((example) => example.id)).size).toBe(GAME_STUDIO_EXAMPLES.length);
    GAME_STUDIO_EXAMPLES.forEach((example) => {
      const project = example.create();
      expect(() => normalizeProject(JSON.parse(JSON.stringify(project)))).not.toThrow();
      expect(example.walkthrough.length).toBeGreaterThan(0);
      expect(example.code.length).toBeGreaterThan(20);
    });
  });

  it('ships Neon Maze Chase as a complete playable ruleset', () => {
    const project = GAME_STUDIO_EXAMPLES.find((example) => example.id === 'neon-maze').create();
    const entities = getActiveScene(project).entities;
    expect(entities.filter((entity) => entity.gameplay.role === 'player')).toHaveLength(1);
    expect(entities.filter((entity) => entity.gameplay.role === 'hazard')).toHaveLength(2);
    expect(entities.filter((entity) => entity.gameplay.role === 'collectible')).toHaveLength(43);
    expect(entities.filter((entity) => entity.physics.body === 'static' && entity.gameplay.role === 'none').length).toBeGreaterThanOrEqual(7);
  });

  it('keeps every insertable code recipe valid for the learner runtime', () => {
    expect(new Set(GAME_CODE_RECIPES.map((recipe) => recipe.id)).size).toBe(GAME_CODE_RECIPES.length);
    GAME_CODE_RECIPES.forEach((recipe) => {
      expect(validateLearnerScript(recipe.code), recipe.title).toEqual({ valid: true, error: '' });
      expect(recipe.walkthrough.length).toBeGreaterThan(0);
    });
  });
});

