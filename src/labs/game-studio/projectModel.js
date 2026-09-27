export const GAME_PROJECT_KIND = 'upskillos-game-project';
export const GAME_PROJECT_VERSION = 2;

const COLORS = ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'];

function makeId(prefix) {
  const suffix = globalThis.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${suffix}`;
}

function finite(value, fallback) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanColor(value, fallback = '#67e8f9') {
  return typeof value === 'string' && /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;
}

export function createEntity(kind = 'rectangle', overrides = {}) {
  const id = overrides.id || makeId('entity');
  const index = Math.abs(String(id).split('').reduce((sum, char) => sum + char.charCodeAt(0), 0)) % COLORS.length;
  const defaults = {
    id,
    name: kind === 'text' ? 'Label' : kind === 'circle' ? 'Ball' : 'Player',
    type: kind,
    transform: { x: 480, y: 270, rotation: 0, scaleX: 1, scaleY: 1 },
    display: {
      width: kind === 'text' ? 220 : 80,
      height: kind === 'text' ? 48 : 80,
      color: COLORS[index],
      text: kind === 'text' ? 'Hello, game!' : '',
      fontSize: 30,
    },
    physics: { enabled: false, body: 'dynamic', bounce: 0.6, collideWorldBounds: true },
    behavior: { type: 'none', speed: 220, axis: 'x', range: 180 },
    gameplay: { role: 'none', points: 1, lives: 3 },
    script: { enabled: false, source: '' },
  };

  return {
    ...defaults,
    ...overrides,
    id,
    transform: { ...defaults.transform, ...overrides.transform },
    display: { ...defaults.display, ...overrides.display },
    physics: { ...defaults.physics, ...overrides.physics },
    behavior: { ...defaults.behavior, ...overrides.behavior },
    gameplay: { ...defaults.gameplay, ...overrides.gameplay },
    script: { ...defaults.script, ...overrides.script },
  };
}

export function createScene(name = 'Main Scene', entities) {
  return {
    id: makeId('scene'),
    name,
    entities: entities || [
      createEntity('rectangle', { name: 'Player', behavior: { type: 'topDown', speed: 220 } }),
      createEntity('text', { name: 'Instructions', transform: { x: 480, y: 70 }, display: { text: 'Arrow keys move the player', width: 420 } }),
    ],
  };
}

export function createProject(name = 'My First Game', options = {}) {
  const scene = options.scene || createScene();
  const now = new Date().toISOString();
  return {
    kind: GAME_PROJECT_KIND,
    version: GAME_PROJECT_VERSION,
    id: options.id || makeId('game'),
    name,
    createdAt: options.createdAt || now,
    updatedAt: now,
    settings: {
      width: 960,
      height: 540,
      background: '#0f172a',
      gravityY: 0,
      showHud: true,
      ...options.settings,
    },
    scenes: options.scenes || [scene],
    activeSceneId: options.activeSceneId || scene.id,
    assets: options.assets || [],
  };
}

function normalizeEntity(value, index) {
  const kind = ['rectangle', 'circle', 'text'].includes(value?.type) ? value.type : 'rectangle';
  const entity = createEntity(kind, {
    ...value,
    id: typeof value?.id === 'string' ? value.id : makeId('entity'),
    name: typeof value?.name === 'string' ? value.name : `Object ${index + 1}`,
  });
  return {
    ...entity,
    transform: {
      x: finite(entity.transform.x, 480),
      y: finite(entity.transform.y, 270),
      rotation: finite(entity.transform.rotation, 0),
      scaleX: finite(entity.transform.scaleX, 1),
      scaleY: finite(entity.transform.scaleY, 1),
    },
    display: {
      ...entity.display,
      width: Math.max(1, finite(entity.display.width, 80)),
      height: Math.max(1, finite(entity.display.height, 80)),
      color: cleanColor(entity.display.color),
      text: typeof entity.display.text === 'string' ? entity.display.text : '',
      fontSize: Math.max(8, finite(entity.display.fontSize, 30)),
    },
    physics: {
      enabled: Boolean(entity.physics.enabled),
      body: entity.physics.body === 'static' ? 'static' : 'dynamic',
      bounce: Math.min(1, Math.max(0, finite(entity.physics.bounce, 0.6))),
      collideWorldBounds: entity.physics.collideWorldBounds !== false,
    },
    behavior: {
      type: ['none', 'topDown', 'bounce', 'patrol', 'platformer'].includes(entity.behavior.type) ? entity.behavior.type : 'none',
      speed: Math.max(0, finite(entity.behavior.speed, 220)),
      axis: entity.behavior.axis === 'y' ? 'y' : 'x',
      range: Math.max(0, finite(entity.behavior.range, 180)),
    },
    gameplay: {
      role: ['none', 'player', 'collectible', 'hazard', 'goal'].includes(entity.gameplay?.role) ? entity.gameplay.role : 'none',
      points: finite(entity.gameplay?.points, 1),
      lives: Math.max(1, Math.round(finite(entity.gameplay?.lives, 3))),
    },
    script: {
      enabled: Boolean(entity.script?.enabled),
      source: typeof entity.script?.source === 'string' ? entity.script.source : '',
    },
  };
}

export function normalizeProject(value) {
  if (!value || typeof value !== 'object') throw new Error('That file does not contain a Game Studio project.');
  if (value.kind !== GAME_PROJECT_KIND) throw new Error('This is not a Game Studio project file.');
  if (Number(value.version) > GAME_PROJECT_VERSION) throw new Error('This project was made with a newer version of Game Studio.');

  const scenes = Array.isArray(value.scenes) && value.scenes.length
    ? value.scenes.map((scene, sceneIndex) => ({
        id: typeof scene?.id === 'string' ? scene.id : makeId('scene'),
        name: typeof scene?.name === 'string' ? scene.name : `Scene ${sceneIndex + 1}`,
        entities: Array.isArray(scene?.entities) ? scene.entities.map(normalizeEntity) : [],
      }))
    : [createScene('Main Scene', [])];
  const activeSceneId = scenes.some((scene) => scene.id === value.activeSceneId) ? value.activeSceneId : scenes[0].id;

  return {
    kind: GAME_PROJECT_KIND,
    version: GAME_PROJECT_VERSION,
    id: typeof value.id === 'string' ? value.id : makeId('game'),
    name: typeof value.name === 'string' && value.name.trim() ? value.name.trim() : 'Untitled Game',
    createdAt: typeof value.createdAt === 'string' ? value.createdAt : new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    settings: {
      width: Math.round(Math.max(320, Math.min(3840, finite(value.settings?.width, 960)))),
      height: Math.round(Math.max(180, Math.min(2160, finite(value.settings?.height, 540)))),
      background: cleanColor(value.settings?.background, '#0f172a'),
      gravityY: finite(value.settings?.gravityY, 0),
      showHud: value.settings?.showHud !== false,
    },
    scenes,
    activeSceneId,
    assets: Array.isArray(value.assets) ? value.assets : [],
  };
}

export function getActiveScene(project) {
  return project.scenes.find((scene) => scene.id === project.activeSceneId) || project.scenes[0];
}

export function patchEntity(project, sceneId, entityId, patch) {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    scenes: project.scenes.map((scene) => scene.id !== sceneId ? scene : {
      ...scene,
      entities: scene.entities.map((entity) => entity.id !== entityId ? entity : {
        ...entity,
        ...patch,
        transform: patch.transform ? { ...entity.transform, ...patch.transform } : entity.transform,
        display: patch.display ? { ...entity.display, ...patch.display } : entity.display,
        physics: patch.physics ? { ...entity.physics, ...patch.physics } : entity.physics,
        behavior: patch.behavior ? { ...entity.behavior, ...patch.behavior } : entity.behavior,
        gameplay: patch.gameplay ? { ...entity.gameplay, ...patch.gameplay } : entity.gameplay,
        script: patch.script ? { ...entity.script, ...patch.script } : entity.script,
      }),
    }),
  };
}

export function addEntity(project, sceneId, kind = 'rectangle') {
  const entity = createEntity(kind);
  return {
    entity,
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      scenes: project.scenes.map((scene) => scene.id === sceneId
        ? { ...scene, entities: [...scene.entities, entity] }
        : scene),
    },
  };
}

export function removeEntity(project, sceneId, entityId) {
  return {
    ...project,
    updatedAt: new Date().toISOString(),
    scenes: project.scenes.map((scene) => scene.id === sceneId
      ? { ...scene, entities: scene.entities.filter((entity) => entity.id !== entityId) }
      : scene),
  };
}

export function duplicateEntity(project, sceneId, entityId) {
  const scene = project.scenes.find((item) => item.id === sceneId);
  const source = scene?.entities.find((item) => item.id === entityId);
  if (!source) return { project, entity: null };
  const entity = createEntity(source.type, {
    ...source,
    id: undefined,
    name: `${source.name} Copy`,
    transform: { ...source.transform, x: source.transform.x + 24, y: source.transform.y + 24 },
  });
  return {
    entity,
    project: {
      ...project,
      updatedAt: new Date().toISOString(),
      scenes: project.scenes.map((item) => item.id === sceneId
        ? { ...item, entities: [...item.entities, entity] }
        : item),
    },
  };
}

export function cloneProject(project, name = `${project.name} Copy`) {
  const clone = normalizeProject(JSON.parse(JSON.stringify(project)));
  clone.id = makeId('game');
  clone.name = name;
  clone.createdAt = new Date().toISOString();
  clone.updatedAt = clone.createdAt;
  return clone;
}
