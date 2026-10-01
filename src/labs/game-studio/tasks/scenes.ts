// Chapter 6 of the course, "Scenes": scenes used inside scenes, making things while the game runs,
// groups, signals, and several scenes (docs/game-studio-course-plan.md).

import type { GameTask } from './types';
import { CHAR, GROUND, PLATFORMER, REST, block, player } from './physics';
import { childrenOf, named, need, noErrors, type Body, type Pos } from './helpers';
import type { Node } from '../engine/nodes';

const COIN = 'assets/pixel-platformer/tiles/tile_0151.png';
const BULLET = 'assets/puzzle-pack/balls/ballgrey_01.png';
const ENEMY = 'assets/pixel-platformer/characters/tile_0004.png';
const main = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')`;
const level = `${main}\n${block('Floor', 480, 420, 900, 40)}`;
const COIN_SCRIPT = `export default class Coin extends Area2D {
  bodyEntered(body) {
    if (body.name === 'Player') this.queueFree();
  }
}
`;
const BULLET_SCRIPT = `export default class Bullet extends Area2D {
  speed = 400;
  life = 1.5;

  update(dt) {
    this.position = { x: this.position.x + this.speed * dt, y: this.position.y };
    this.life -= dt;
    if (this.life <= 0) this.queueFree();
  }

  bodyEntered(body) {
    if (body.name === 'Player') return;
    this.queueFree();
  }
}
`;
const BULLET_HITS = BULLET_SCRIPT.replace(`    if (body.name === 'Player') return;
    this.queueFree();`, `    if (body.name === 'Player') return;
    if (body.isInGroup('enemies')) body.queueFree();   // only enemies are hit
    this.queueFree();`);
const bulletScene = `scene = project.createScene('scenes/bullet.scene', 'Area2D', 'Bullet')
scene.add('Sprite2D', { name: 'Sprite', texture: '${BULLET}', scale: { x: 0.06, y: 0.06 } })
scene.add('CollisionShape2D', { name: 'Shape', shape: 'circle', size: { x: 8, y: 8 } })
project.writeScript('scripts/bullet.js', ${JSON.stringify(BULLET_SCRIPT)})
scene.root.script = 'scripts/bullet.js'
scene = project.scene('scenes/main.scene')`;
const SHOOTER = PLATFORMER.replace(`  jumpSpeed = 360;
`, `  jumpSpeed = 360;
  cooldown = 0;
`).replace(/\n}\n$/, `

  update(dt) {
    // Fire a bullet every quarter of a second while Space is held.
    this.cooldown -= dt;
    if (input.isPressed('jump') && this.cooldown <= 0) {
      this.cooldown = 0.25;
      const b = scene.instantiate('scenes/bullet.scene');   // a new copy of bullet.scene
      b.position = this.position.add({ x: 20, y: 0 });
      scene.root.addChild(b);
    }
  }
}
`).replace("if (input.isJustPressed('jump') && this.isOnFloor()) v.y = -this.jumpSpeed;", '// Space shoots in this game, so no jump.');
const enemies = `scene.add('CharacterBody2D', { name: 'Enemy', position: { x: 600, y: ${REST} } })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Enemy', texture: '${ENEMY}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Enemy', size: { x: 16, y: 22 } })
scene.get('Enemy').duplicate()
scene.get('Enemy2').position = { x: 760, y: ${REST} }`;

const HEALTH_PLAYER = PLATFORMER.replace(`  jumpSpeed = 360;
`, `  jumpSpeed = 360;
  health = 3;
`).replace(/\n}\n$/, `

  // The spikes call this.
  hurt() {
    this.health -= 1;
  }
}
`);
const EMITTING = HEALTH_PLAYER.replace(`    this.health -= 1;
`, `    this.health -= 1;
    this.emit('healthChanged', this.health);   // anything connected hears the new health
`);
const HEALTH_LABEL = `export default class Health extends Label {
  show(health) {
    this.text = 'Health: ' + health;
  }
}
`;
const SPIKES = `export default class Spikes extends Area2D {
  bodyEntered(body) {
    if (body.name === 'Player') body.hurt();
  }
}
`;
const TITLE = `export default class Title extends Node2D {
  update(dt) {
    if (input.isJustPressed('jump')) scene.change('scenes/main.scene');
  }
}
`;

/** Every node in a running game. */
const all = (g: { root: Node }): Node[] => { const out: Node[] = []; const v = (n: Node) => { out.push(n); n.children.forEach(v); }; v(g.root); return out; };

export const SCENES: GameTask[] = [
  {
    id: 'scene-instances',
    chain: 'Scenes',
    title: 'One coin, many times',
    goal: 'Make a coin as its own scene, then use it three times. Change the scene once and every coin changes.',
    images: [CHAR, GROUND, COIN],
    start: `${level}\n${player(200, REST, PLATFORMER)}`,
    steps: [
      { text: 'Make a scene for the coin: in Files, press + beside scenes/, choose Area2D as its root, type coin and press Enter. Under its root (Coin), add a Sprite2D (tiles/tile_0151.png) and a CollisionShape2D.', hint: 'A scene\u2019s root can be any node. A coin is an Area2D, so that is its root.',
        check: { kind: 'project', test: (v) => { const s = v.project.scenes.find((x) => x.path === 'scenes/coin.scene'); if (!s) return 'There is no scenes/coin.scene yet.'; if (s.root.type !== 'Area2D') return `coin.scene\u2019s root is a ${s.root.type}: make the scene again with Area2D as its root.`; return s.root.children.some((c) => c.type === 'CollisionShape2D') || 'The coin has no CollisionShape2D under it.'; } } },
      { text: 'Open main.scene and put three coins on the floor: in Files, the ⧉ beside coin.scene adds an instance of it to the scene you are editing. Drag each one where you want it.',
        check: { kind: 'project', test: (v) => { const n = v.project.scenes.find((s) => s.path === 'scenes/main.scene')!; const count = JSON.stringify(n.root).split('"instance":"scenes/coin.scene"').length - 1; return count >= 3 || `main.scene has ${count} coin instances: put in three.`; } } },
      { text: 'Make coins disappear when Player touches one: open coin.scene and give its Area2D a script whose bodyEntered(body) calls this.queueFree() when the body is Player. Every coin gets it.',
        check: { kind: 'play', test: async (v) => {
          const r = await v.play({ seconds: 0.3, setup: (g) => { const p = named<Body>(g, 'Player')!, first = all(g).find((n) => n.name.startsWith('Coin')) as unknown as { globalPosition: Pos } | undefined; if (first) p.position = first.globalPosition; } });
          noErrors(r);
          const left = all(r.game).filter((n) => n.name.startsWith('Coin')).length;
          return left === 2 || `After touching one coin there are ${left} coins: there should be 2.`;
        } } },
    ],
    solution: `scene = project.createScene('scenes/coin.scene', 'Area2D', 'Coin')
scene.add('Sprite2D', { name: 'Sprite', texture: '${COIN}' })
scene.add('CollisionShape2D', { name: 'Shape', shape: 'circle', size: { x: 14, y: 14 } })
project.writeScript('scripts/coin.js', ${JSON.stringify(COIN_SCRIPT)})
scene.root.script = 'scripts/coin.js'
scene = project.scene('scenes/main.scene')
for (const x of [400, 500, 600]) scene.instance('scenes/coin.scene', { position: { x, y: ${REST} } })`,
    done: 'One coin scene, three coins. Back in the lesson: instances, and what an override is.',
  },
  {
    id: 'spawn-bullets',
    chain: 'Scenes',
    title: 'A gun that fires',
    goal: 'Make bullets while the game runs, each a new copy of bullet.scene.',
    images: [CHAR, GROUND, BULLET],
    start: `${level}\n${player(200, REST, PLATFORMER.replace("if (input.isJustPressed('jump') && this.isOnFloor()) v.y = -this.jumpSpeed;", '// Space will shoot in this game, so no jump.'))}\n${bulletScene}`,
    steps: [
      { text: 'In Player’s script, when Space is pressed, make a bullet: const b = scene.instantiate(\'scenes/bullet.scene\'); set b.position just right of Player; then scene.root.addChild(b). bullet.scene already moves itself.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.5, keys: ['Space'], keysAt: 0.2 }); noErrors(r); return all(r.game).some((n) => n.name.startsWith('Bullet')) || 'Pressing Space makes no bullet.'; } } },
      { text: 'Keep firing while Space is held, one bullet every quarter of a second: a cooldown that counts down by dt.', hint: 'this.cooldown -= dt; if (input.isPressed(\'jump\') && this.cooldown <= 0) { this.cooldown = 0.25; … fire … }',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1, keys: ['Space'] }); noErrors(r); const n = all(r.game).filter((x) => x.name.startsWith('Bullet')).length; return (n >= 3 && n <= 5) || `Holding Space for 1 second made ${n} bullets: there should be 4 (one every 0.25 s).`; } } },
    ],
    solution: `project.writeScript('scripts/player.js', ${JSON.stringify(SHOOTER)})`,
    done: 'Bullets, made as the game runs. Back in the lesson: instantiate, addChild, and freeing what you made.',
  },
  {
    id: 'enemy-group',
    chain: 'Scenes',
    title: 'Bullets that hit only enemies',
    goal: 'Put the enemies in a group, and let bullets hit only bodies in that group.',
    images: [CHAR, GROUND, BULLET, ENEMY],
    start: `${level}\n${player(200, REST, SHOOTER)}\n${bulletScene}\n${enemies}`,
    steps: [
      { text: 'Select Enemy, and in Inspector › Groups add enemies. Do the same for Enemy2.',
        check: { kind: 'project', test: (v) => { const e = v.nodes.filter((n) => n.name.startsWith('Enemy')); return (e.length >= 2 && e.every((n) => (n.groups ?? []).includes('enemies'))) || 'Both enemies should be in the group enemies.'; } } },
      { text: 'In bullet.js’s bodyEntered, if body.isInGroup(\'enemies\'), remove the body with body.queueFree(). Run and shoot: the enemies go, the floor does not.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 3, keys: ['Space'] }); noErrors(r); const left = all(r.game).filter((n) => n.name.startsWith('Enemy')).length; return (left === 0 && !!named(r.game, 'Floor')) || `${left} enemies are still there after 3 seconds of shooting.`; } } },
    ],
    solution: `scene.get('Enemy').groups = ['enemies']\nscene.get('Enemy2').groups = ['enemies']\nproject.writeScript('scripts/bullet.js', ${JSON.stringify(BULLET_HITS)})`,
    done: 'Bullets that know what an enemy is. Back in the lesson: groups, and asking "what kind of thing is this?".',
  },
  {
    id: 'health-signal',
    chain: 'Scenes',
    title: 'A health display wired with a signal',
    goal: 'The player says when its health changes; the display listens. No code joins them: a connection does.',
    images: [CHAR, GROUND],
    start: `${level}\n${player(200, REST, HEALTH_PLAYER)}
scene.add('Area2D', { name: 'Spikes', position: { x: 450, y: ${REST} } })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Spikes', size: { x: 30, y: 16 } })
project.writeScript('scripts/spikes.js', ${JSON.stringify(SPIKES)})
scene.get('Spikes').script = 'scripts/spikes.js'
scene.add('CanvasLayer', { name: 'HUD' })
project.writeScript('scripts/health.js', ${JSON.stringify(HEALTH_LABEL)})
scene.add('Label', { name: 'Health', parent: 'HUD', position: { x: 16, y: 12 }, fontSize: 24, text: 'Health: 3', script: 'scripts/health.js' })`,
    steps: [
      { text: 'In Player’s hurt(), after taking 1 from health, send a signal: this.emit(\'healthChanged\', this.health).',
        check: { kind: 'project', test: (v) => /emit\(\s*['"]healthChanged['"]/.test(v.script(v.byName('Player')?.script ?? null) ?? '') || 'Player’s script does not emit healthChanged yet.' } },
      { text: 'Connect it: select Player, and in Inspector › Signals choose signal healthChanged, node HUD/Health, method show, then Connect.',
        check: { kind: 'project', test: (v) => { const p = v.byName('Player'), h = v.byName('Health'); return (!!p && !!h && (p.connections ?? []).some((c) => c.signal === 'healthChanged' && c.target === h.id && c.method === 'show')) || 'Player has no healthChanged → Health.show connection yet.'; } } },
      { text: 'Run and walk into the spikes: the display shows Health: 2.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.3, setup: (g) => { const p = named<Body>(g, 'Player')!, s = named<{ globalPosition: Pos }>(g, 'Spikes')!; p.position = s.globalPosition; } }); noErrors(r); const h = named<{ text: string }>(r.game, 'Health'); return /\b2\b/.test(String(h?.text)) || `After the spikes, the display says "${h?.text}".`; } } },
    ],
    solution: `project.writeScript('scripts/player.js', ${JSON.stringify(EMITTING)})\nscene.get('Player').connect('healthChanged', 'HUD/Health', 'show')`,
    done: 'Health and display, joined by a signal. Back in the lesson: the observer pattern, and why the player need not know the display exists.',
  },
  {
    id: 'title-scene',
    chain: 'Scenes',
    title: 'A title screen',
    goal: 'A second scene that the game starts on, and a key that changes to the level.',
    images: [CHAR, GROUND],
    start: `${level}\n${player(200, REST, PLATFORMER)}`,
    steps: [
      { text: 'Make scenes/title.scene with a Label saying the game’s name, and make it the main scene: the ☆ beside it in Files.',
        check: { kind: 'project', test: (v) => { if (v.project.settings.mainScene !== 'scenes/title.scene') return 'The main scene is not scenes/title.scene yet.'; const s = v.project.scenes.find((x) => x.path === 'scenes/title.scene')!; return JSON.stringify(s.root).includes('"type":"Label"') || 'title.scene has no Label.'; } } },
      { text: 'Give the title scene’s root a script: when Space is pressed, scene.change(\'scenes/main.scene\').',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.6, keys: ['Space'], keysAt: 0.2 }); noErrors(r); return r.game.sceneApi.path === 'scenes/main.scene' || 'Pressing Space on the title does not change to main.scene.'; } } },
    ],
    solution: `scene = project.createScene('scenes/title.scene', 'Node2D', 'Title')
scene.add('Label', { name: 'Name', position: { x: 330, y: 220 }, fontSize: 48, text: 'MY GAME' })
project.writeScript('scripts/title.js', ${JSON.stringify(TITLE)})
scene.root.script = 'scripts/title.js'
project.setMainScene('scenes/title.scene')`,
    done: 'A title screen. Back in the lesson: scenes as screens, and keeping a score between them.',
  },
];
