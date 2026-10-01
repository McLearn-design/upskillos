// Example: Potion Hunt. A top-down dungeon: walk the hero around, pick up eight
// potions, keep away from the bat.
//
// Built only with the real Scene API (the same calls the GUI → code panel shows) and
// the engine's real nodes and scripts: nothing here is special-cased for the example.
// The floor and walls are TileMapLayers (the walls' tiles are solid), the hero a
// CharacterBody2D, and the potions and the bat Area2Ds that notice the hero coming in.

import type { GameExample } from './types';

const T = 'assets/tiny-dungeon/tiles';
const SHEET = 'assets/tiny-dungeon/tilemap/tilemap_packed.png';   // the same tiles, as one sheet: 12 × 11 tiles of 16 px
const tile = (n: number) => `${T}/tile_${String(n).padStart(4, '0')}.png`;
const FLOOR = [48, 49, 51], WALL = 40, HERO = 85, BAT = 120, POTIONS = [113, 114, 115, 116];

const player = `export default class Player extends CharacterBody2D {
  speed = 70;          // pixels per second (the camera zooms in 4 times, so this feels quick)
  found = 0;

  ready() {
    this.start = this.position.copy();
    this.total = scene.get('Potions').children.length;
    this.showScore();
  }

  physicsUpdate(dt) {
    // Arrow keys or WASD, through the input map: a direction of length at most 1.
    const direction = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    this.velocity = direction.scale(this.speed);
    // Move, stopping at the walls and sliding along them.
    this.moveAndSlide();
  }

  // A potion calls this when the hero walks into it.
  collect(potion) {
    this.found += 1;
    this.showScore();
    console.log('Picked up', potion.name);
  }

  // The bat calls this when it touches the hero.
  hurt() {
    this.position = this.start;
    console.log('The bat got you! Back to the start.');
  }

  showScore() {
    scene.get('HUD/Score').text = \`Potions: \${this.found} / \${this.total}\`;
    scene.get('HUD/Message').visible = this.found === this.total;
  }
}
`;

const potion = `// One script for every potion: each is an Area2D that notices the hero walking in.
export default class Potion extends Area2D {
  bodyEntered(body) {
    if (body.name !== 'Player') return;
    body.collect(this);
    this.queueFree();
  }
}
`;

const bat = `export default class Bat extends Area2D {
  ready() {
    this.centre = this.position.copy();
  }

  update(dt) {
    // A figure of eight: across once while it goes up and down twice.
    const t = time.now;
    this.position = {
      x: this.centre.x + 60 * Math.sin(t),
      y: this.centre.y + 25 * Math.sin(2 * t),
    };
  }

  bodyEntered(body) {
    if (body.name === 'Player') body.hurt();
  }
}
`;

const code = `// Potion Hunt: a dungeon 20 × 12 tiles of 16 pixels, built by code.
scene = project.createScene('scenes/dungeon.scene', 'Node2D', 'Dungeon')
project.setSettings({ background: '#1b1720', pixelArt: true, gravity: 0 })   // top-down: nothing falls

// A tileset: the Tiny Dungeon sheet cut into 16 × 16 tiles. The wall tile (${WALL}) is solid.
project.createTileset('tilesets/dungeon.tileset', { image: '${SHEET}', tileWidth: 16, tileHeight: 16, solid: [${WALL}] })

// The floor: a TileMapLayer filled with one tile, then a few cells changed for variety.
const floor = scene.add('TileMapLayer', { name: 'Floor', tileset: 'tilesets/dungeon.tileset' })
floor.fill(1, 1, 18, 10, ${FLOOR[0]})
for (let row = 1; row < 11; row++) for (let col = 1; col < 19; col++) if ((row * 7 + col * 3) % 5 === 0) floor.setCell(col, row, col % 2 ? ${FLOOR[1]} : ${FLOOR[2]})

// The walls: a second layer, a ring of wall tiles round the edge. Being solid, they stop the hero.
const walls = scene.add('TileMapLayer', { name: 'Walls', tileset: 'tilesets/dungeon.tileset' })
walls.fill(0, 0, 20, 1, ${WALL})
walls.fill(0, 11, 20, 1, ${WALL})
walls.fill(0, 1, 1, 10, ${WALL})
walls.fill(19, 1, 1, 10, ${WALL})

// Eight potions: each an Area2D with a picture and a shape, all sharing one script.
scene.add('Node2D', { name: 'Potions', zIndex: 1 })
project.writeScript('scripts/potion.js', ${JSON.stringify(potion)})
const potions = [[4, 3], [15, 2], [10, 6], [3, 9], [17, 9], [7, 5], [13, 9], [16, 5]]
potions.forEach(([col, row], i) => {
  const colour = [${POTIONS.map((n) => `'${tile(n)}'`).join(', ')}][i % 4]
  const p = scene.add('Area2D', { name: 'Potion1', parent: 'Potions', position: { x: 8 + 16 * col, y: 8 + 16 * row }, script: 'scripts/potion.js' })
  scene.add('Sprite2D', { name: 'Sprite', parent: p.path, texture: colour })
  scene.add('CollisionShape2D', { name: 'Shape', parent: p.path, size: { x: 10, y: 12 } })
})

// The hero: a body you move from a script, its picture, its shape, and a camera that follows it.
scene.add('CharacterBody2D', { name: 'Player', position: { x: 40, y: 96 }, zIndex: 2 })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Player', texture: '${tile(HERO)}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Player', size: { x: 12, y: 12 } })
scene.add('Camera2D', { name: 'Camera', parent: 'Player', zoom: 4, smoothing: 6, limitTopLeft: { x: 0, y: 0 }, limitBottomRight: { x: 320, y: 192 } })
project.writeScript('scripts/player.js', ${JSON.stringify(player)})
scene.get('Player').script = 'scripts/player.js'

// The bat: an Area2D that flies a figure of eight and notices when it touches the hero.
scene.add('Area2D', { name: 'Bat', position: { x: 160, y: 96 }, zIndex: 2 })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Bat', texture: '${tile(BAT)}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Bat', shape: 'circle', size: { x: 12, y: 12 } })
project.writeScript('scripts/bat.js', ${JSON.stringify(bat)})
scene.get('Bat').script = 'scripts/bat.js'

// The HUD: on a CanvasLayer, so it stays put while the camera moves.
scene.add('CanvasLayer', { name: 'HUD' })
scene.add('Label', { name: 'Score', parent: 'HUD', position: { x: 16, y: 12 }, fontSize: 28, text: 'Potions: 0 / 8' })
scene.add('Label', { name: 'Message', parent: 'HUD', position: { x: 300, y: 236 }, fontSize: 40, color: '#ffd166', text: 'You found them all!', visible: false })
`;

export const potionHunt: GameExample = {
  id: 'potion-hunt',
  title: 'Potion Hunt',
  blurb: 'A top-down dungeon: walk the hero round, collect eight potions, dodge the bat. Scripts, input, walls that stop you, pickups, a following camera and a HUD.',
  art: 'Kenney Tiny Dungeon (CC0)',
  images: [SHEET, ...[HERO, BAT, ...POTIONS].map(tile)],
  code,
  guide: [
    'Press ▶ Run (F5). Arrow keys or WASD move the hero. Collect all eight potions; keep away from the bat.',
    'GUI → code (below) shows the code that built this whole project: a tileset, a Floor layer filled with fill() and varied with setCell(), a Walls layer round the edge, then the potions, the hero, the bat and the HUD. It is the same Scene API every editor action writes.',
    'The teal rectangles in the viewport are what bodies collide with: the Walls layer\u2019s solid tiles (merged into four long rectangles) and the hero\u2019s shape. That is why the hero stops at the walls and slides along them: moveAndSlide() in scripts/player.js. Select Walls to paint more walls in the TileMap panel.',
    'Each potion is an Area2D (green outline) with the same script, scripts/potion.js: when a body comes in, bodyEntered runs. It tells the player, and removes itself with queueFree().',
    'Select Player › Camera in the tree. zoom 4 shows the dungeon 4 times bigger; the limits stop the camera at the walls. Change zoom to 2, or smoothing to 0, and run again: the Inspector changes the real game.',
    'Try it yourself: select Potions › Potion1 and press Ctrl+D to duplicate it, then drag the copy somewhere else in the viewport. It works at once, and the count becomes 9: the script counts the potions when the game starts.',
    'Open scripts/bat.js: two sine waves, one twice as fast as the other, make the figure of eight. Change 60 to 120 and run.',
  ],
};
