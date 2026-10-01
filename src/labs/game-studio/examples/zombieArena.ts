// Example: Zombie Arena. A game in several scenes: a title screen, the arena, and a game-over
// screen. In the arena, zombies keep coming; shoot them before they reach you.
//
// Built only with the real Scene API and the engine's real nodes and scripts, like every
// example. What it adds (Phase 7):
//   - scenes used inside scenes: the player is an instance of player.scene;
//   - scenes made while the game runs: zombies and bullets, with scene.instantiate();
//   - a group: "zombies", which bullets look for and the arena counts;
//   - signals: each zombie's "died", connected in code; the player's "healthChanged",
//     connected in the scene (Inspector › Signals) to the HUD, with no code wiring it;
//   - changing scenes, title → arena → game over → title, with scene.change();
//   - a script module (state.js) whose values last from scene to scene: the score and the best.

import type { GameExample } from './types';

const SHEET = 'assets/top-down-shooter/tilesheet/tilesheet_complete.png';   // 1728 × 1280: 27 × 20 tiles of 64 px
const SURVIVOR = 'assets/top-down-shooter/survivor-1/survivor1_gun.png';     // 51 × 43, facing right
const ZOMBIE = 'assets/top-down-shooter/zombie-1/zoimbie1_hold.png';         // 35 × 43, facing right
const BULLET = 'assets/puzzle-pack/balls/ballgrey_01.png';                   // 128 × 128, shown at 0.08
const GRASS = 0, CRATE = 128;

const state = `// Values that last from scene to scene. A module is loaded once for the whole game, so
// whatever its exports hold stays when scene.change() replaces every node.
export const state = { score: 0, best: 0 };
`;

const title = `import { state } from './state.js';

export default class Title extends Node2D {
  ready() {
    scene.get('Best').text = state.best ? \`Best: \${state.best}\` : '';
  }

  update(dt) {
    if (input.isJustPressed('jump')) scene.change('scenes/arena.scene');
  }
}
`;

const player = `export default class Player extends CharacterBody2D {
  speed = 220;          // pixels per second
  health = 3;
  facing = new Vec2(1, 0);
  cooldown = 0;         // seconds until it can shoot again
  safe = 0;             // seconds it cannot be hurt, after a hit

  physicsUpdate(dt) {
    const dir = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    if (dir.length() > 0) this.facing = dir;
    this.rotation = this.facing.angle();      // the picture faces right, so its angle is the facing's
    this.velocity = dir.scale(this.speed);
    this.moveAndSlide();
  }

  update(dt) {
    this.cooldown -= dt;
    this.safe -= dt;
    this.get('Sprite').opacity = this.safe > 0 && Math.floor(time.now * 10) % 2 ? 0.4 : 1;
    if (input.isPressed('jump') && this.cooldown <= 0) this.shoot();
  }

  shoot() {
    this.cooldown = 0.25;
    // A new bullet, made from bullet.scene, put into the arena.
    const b = scene.instantiate('scenes/bullet.scene');
    b.position = this.position.add(this.facing.scale(32));
    b.velocity = this.facing.scale(520);
    scene.root.addChild(b);
  }

  // A zombie calls this when it reaches the player.
  hurt() {
    if (this.safe > 0) return;
    this.safe = 1;
    this.health -= 1;
    // Anything connected to healthChanged hears about it: the HUD is, in the arena scene.
    this.emit('healthChanged', this.health);
    if (this.health <= 0) scene.root.gameOver();
  }
}
`;

const zombie = `export default class Zombie extends CharacterBody2D {
  speed = 70;
  health = 2;

  ready() {
    this.player = scene.find('Player');
  }

  physicsUpdate(dt) {
    if (!this.player) return;
    const to = this.player.position.sub(this.position);
    this.rotation = to.angle();
    this.velocity = to.normalized().scale(this.speed);
    this.moveAndSlide();
    if (to.length() < 38) this.player.hurt();
  }

  // A bullet calls this.
  hit() {
    this.health -= 1;
    if (this.health > 0) return;
    this.emit('died', this);      // the arena connected to this when it made the zombie
    this.queueFree();
  }
}
`;

const bullet = `export default class Bullet extends Area2D {
  velocity = new Vec2(0, 0);    // set by the player when it shoots
  life = 1.2;                   // seconds before it goes, if it hits nothing

  update(dt) {
    this.position = this.position.add(this.velocity.scale(dt));
    this.life -= dt;
    if (this.life <= 0) this.queueFree();
  }

  bodyEntered(body) {
    if (body.isInGroup('zombies')) body.hit();
    if (!body.isInGroup('player')) this.queueFree();   // a zombie or a wall stops it
  }
}
`;

const arena = `import { state } from './state.js';

// The arena: it sends zombies in, faster and faster, and keeps the score.
export default class Arena extends Node2D {
  ready() {
    state.score = 0;
    this.next = 1.5;        // seconds until the next zombie
    this.every = 2.2;
    this.spawned = 0;
    // The zombies already in the scene (instances placed in the editor) count too.
    for (const z of scene.getNodesInGroup('zombies')) z.connect('died', this, 'zombieDied');
    this.showScore();
  }

  update(dt) {
    this.next -= dt;
    if (this.next <= 0) {
      this.spawn();
      this.every = Math.max(0.6, this.every * 0.93);
      this.next = this.every;
    }
  }

  spawn() {
    // A new zombie, made from zombie.scene, at the next of the four corners.
    const corners = [{ x: 96, y: 96 }, { x: 864, y: 96 }, { x: 864, y: 480 }, { x: 96, y: 480 }];
    const z = scene.instantiate('scenes/zombie.scene');
    z.position = corners[this.spawned % 4];
    this.spawned += 1;
    z.connect('died', this, 'zombieDied');
    this.addChild(z);
  }

  zombieDied(zombie) {
    state.score += 10;
    this.showScore();
  }

  gameOver() {
    state.best = Math.max(state.best, state.score);
    scene.change('scenes/gameover.scene');
  }

  showScore() {
    scene.get('HUD/Score').text = \`Score: \${state.score}\`;
  }
}
`;

const health = `// The HUD's health. The arena scene connects the player's healthChanged signal to show().
export default class Health extends Label {
  show(health) {
    this.text = 'Health: ' + '♥'.repeat(Math.max(0, health));
  }
}
`;

const gameover = `import { state } from './state.js';

export default class GameOver extends Node2D {
  ready() {
    scene.get('Score').text = \`Score: \${state.score}   Best: \${state.best}\`;
  }

  update(dt) {
    if (input.isJustPressed('jump')) scene.change('scenes/title.scene');
  }
}
`;

const code = `// Zombie Arena: five scenes. Three are pieces used by the arena (player, zombie, bullet).
project.setSettings({ background: '#2b2d31', pixelArt: false, gravity: 0 })
project.writeScript('scripts/state.js', ${JSON.stringify(state)})

// The player: its own scene, used in the arena as an instance.
scene = project.createScene('scenes/player.scene', 'CharacterBody2D', 'Player')
scene.root.groups = ['player']
scene.add('Sprite2D', { name: 'Sprite', texture: '${SURVIVOR}' })
scene.add('CollisionShape2D', { name: 'Shape', shape: 'circle', size: { x: 30, y: 30 } })
project.writeScript('scripts/player.js', ${JSON.stringify(player)})
scene.root.script = 'scripts/player.js'

// A zombie: on layer 2, so zombies pass through each other and the player; its mask is the walls (layer 1).
scene = project.createScene('scenes/zombie.scene', 'CharacterBody2D', 'Zombie')
scene.root.groups = ['zombies']
scene.root.collisionLayer = 2
scene.add('Sprite2D', { name: 'Sprite', texture: '${ZOMBIE}' })
scene.add('CollisionShape2D', { name: 'Shape', shape: 'circle', size: { x: 28, y: 28 } })
project.writeScript('scripts/zombie.js', ${JSON.stringify(zombie)})
scene.root.script = 'scripts/zombie.js'

// A bullet: an Area2D that notices walls (layer 1) and zombies (layer 2): mask 1 + 2 = 3.
scene = project.createScene('scenes/bullet.scene', 'Area2D', 'Bullet')
scene.root.collisionMask = 3
scene.add('Sprite2D', { name: 'Sprite', texture: '${BULLET}', scale: { x: 0.08, y: 0.08 } })
scene.add('CollisionShape2D', { name: 'Shape', shape: 'circle', size: { x: 10, y: 10 } })
project.writeScript('scripts/bullet.js', ${JSON.stringify(bullet)})
scene.root.script = 'scripts/bullet.js'

// The arena: grass, walls of crates round the edge, the player, two zombies to start, and the HUD.
scene = project.createScene('scenes/arena.scene', 'Node2D', 'Arena')
project.createTileset('tilesets/shooter.tileset', { image: '${SHEET}', tileWidth: 64, tileHeight: 64, solid: [${CRATE}] })
scene.add('TileMapLayer', { name: 'Ground', tileset: 'tilesets/shooter.tileset' }).fill(0, 0, 15, 9, ${GRASS})
const walls = scene.add('TileMapLayer', { name: 'Walls', tileset: 'tilesets/shooter.tileset' })
walls.fill(0, 0, 15, 1, ${CRATE}); walls.fill(0, 8, 15, 1, ${CRATE}); walls.fill(0, 1, 1, 7, ${CRATE}); walls.fill(14, 1, 1, 7, ${CRATE})
scene.instance('scenes/player.scene', { name: 'Player', position: { x: 480, y: 288 } })
scene.instance('scenes/zombie.scene', { name: 'Zombie', position: { x: 160, y: 160 } })
scene.instance('scenes/zombie.scene', { name: 'Zombie2', position: { x: 800, y: 416 } })
scene.add('CanvasLayer', { name: 'HUD' })
scene.add('Label', { name: 'Score', parent: 'HUD', position: { x: 16, y: 10 }, fontSize: 24, text: 'Score: 0' })
project.writeScript('scripts/health.js', ${JSON.stringify(health)})
scene.add('Label', { name: 'Health', parent: 'HUD', position: { x: 760, y: 10 }, fontSize: 24, color: '#ff6b6b', text: 'Health: ♥♥♥', script: 'scripts/health.js' })
// A connection saved in the scene: when the player emits healthChanged, the HUD's show() runs.
scene.get('Player').connect('healthChanged', 'HUD/Health', 'show')
project.writeScript('scripts/arena.js', ${JSON.stringify(arena)})
scene.root.script = 'scripts/arena.js'

// The title screen: where the game starts.
scene = project.createScene('scenes/title.scene', 'Node2D', 'Title')
scene.add('Label', { name: 'Name', position: { x: 300, y: 170 }, fontSize: 64, color: '#8bd450', text: 'ZOMBIE ARENA' })
scene.add('Label', { name: 'Help', position: { x: 250, y: 280 }, fontSize: 22, text: 'Arrow keys or WASD to move · Space to shoot' })
scene.add('Label', { name: 'Start', position: { x: 360, y: 340 }, fontSize: 26, color: '#ffd166', text: 'Press Space to start' })
scene.add('Label', { name: 'Best', position: { x: 430, y: 400 }, fontSize: 22, text: '' })
project.writeScript('scripts/title.js', ${JSON.stringify(title)})
scene.root.script = 'scripts/title.js'
project.setMainScene('scenes/title.scene')

// Game over.
scene = project.createScene('scenes/gameover.scene', 'Node2D', 'GameOver')
scene.add('Label', { name: 'Title', position: { x: 340, y: 190 }, fontSize: 56, color: '#ff6b6b', text: 'GAME OVER' })
scene.add('Label', { name: 'Score', position: { x: 370, y: 290 }, fontSize: 26, text: '' })
scene.add('Label', { name: 'Again', position: { x: 330, y: 350 }, fontSize: 22, color: '#ffd166', text: 'Press Space for the title screen' })
project.writeScript('scripts/gameover.js', ${JSON.stringify(gameover)})
scene.root.script = 'scripts/gameover.js'
`;

export const zombieArena: GameExample = {
  id: 'zombie-arena',
  title: 'Zombie Arena',
  blurb: 'A game in several scenes: a title screen, an arena where zombies keep coming, and game over. Scenes used inside scenes, scenes made while the game runs, groups, signals, and a score that lasts from scene to scene.',
  art: 'Kenney Top-down Shooter and Puzzle Pack 2 (CC0)',
  images: [SHEET, SURVIVOR, ZOMBIE, BULLET],
  code,
  guide: [
    'Press ▶ Run (F5): the title screen, the main scene. Space starts; arrows or WASD move, Space shoots. Three zombie touches and it is game over; Space goes back to the title, which shows your best score.',
    'The game is five scenes (Files › scenes/). scene.change() switches between title, arena and game over: see scripts/title.js, arena.js and gameover.js.',
    'Open arena.scene and select Player: it is an instance of player.scene (⧉ in the tree; click ⧉ to open that scene). Its children are greyed: they belong to player.scene. Change the speed in scripts/player.js or the picture in player.scene, and the arena’s player changes too.',
    'Zombies and bullets are made while the game runs: scene.instantiate(’scenes/zombie.scene’) in scripts/arena.js, and bullets in shoot() in scripts/player.js.',
    'Groups: zombie.scene’s root is in the group "zombies" (Inspector › Groups). A bullet hits a body only if body.isInGroup(’zombies’); the arena finds the zombies already placed with scene.getNodesInGroup(’zombies’).',
    'Signals: select Player in arena.scene and look at Inspector › Signals: healthChanged → HUD/Health.show(). That connection is saved in the scene; player.js only says this.emit(’healthChanged’, this.health). Each zombie’s "died" signal is connected in code instead, in arena.js.',
    'Try it yourself: select Zombie2 in arena.scene, then its Sprite (greyed, from zombie.scene), and set its scale to 1.5. Only that zombie gets bigger: the change is saved as an override on that instance (marked, with ↺ to undo it).',
  ],
};
