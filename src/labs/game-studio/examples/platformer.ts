// Example: Coin Run. A side-on platformer: run and jump along a hillside, collect the
// coins, reach the flag, and don't fall down the gaps.
//
// Built only with the real Scene API and the engine's real nodes and scripts, like every
// example. What it adds to Potion Hunt: gravity (the project setting), jumping from a
// CharacterBody2D standing on a StaticBody2D, a pit you can fall into, a two-frame walk,
// and a backdrop made of three scaled pictures.

import type { GameExample } from './types';

const P = 'assets/pixel-platformer';
const tile = (n: number) => `${P}/tiles/tile_${String(n).padStart(4, '0')}.png`;
const back = (n: number) => `${P}/backgrounds/tile_${String(n).padStart(4, '0')}.png`;
const hero = (n: number) => `${P}/characters/tile_${String(n).padStart(4, '0')}.png`;
// Grass tops (left end, middle, right end), dirt, a coin, a flag and its pole.
const LEFT = 1, MID = 2, RIGHT = 3, DIRT = 122, COIN = 151, FLAG = 111, POLE = 131;
// The backdrop: plain sky, a strip of hills and trees (four pictures in a row), and the ground behind.
const SKY = 0, HILLS = [8, 9, 10, 11], LOW = 16;
const STAND = 0, WALK = 1;

const player = `export default class Player extends CharacterBody2D {
  speed = 110;         // pixels per second, left and right
  jumpSpeed = 360;     // upward speed at take-off: it rises v² / 2g = 360² / (2 × 980) ≈ 66 px, over three tiles
  coins = 0;
  won = false;

  ready() {
    this.start = this.position.copy();
    this.total = scene.get('Coins').children.length;
    this.sprite = this.get('Sprite');
    this.showScore();
  }

  physicsUpdate(dt) {
    const v = this.velocity;
    // Left and right: the arrow keys or A and D. After winning, stand still.
    v.x = this.won ? 0 : input.axis('move_left', 'move_right') * this.speed;
    // Gravity speeds the fall by physics.gravity (the project setting, 980) every second.
    v.y += physics.gravity * dt;
    // Jump only when standing on something: isOnFloor() is from the last moveAndSlide().
    const jump = input.isJustPressed('jump') || input.isJustPressed('move_up');
    if (jump && this.isOnFloor() && !this.won) v.y = -this.jumpSpeed;
    // Let go early for a smaller jump: cut the rising speed in half.
    if ((input.isJustReleased('jump') || input.isJustReleased('move_up')) && v.y < 0) v.y *= 0.5;
    this.velocity = v;
    this.moveAndSlide();
    // Fell down a gap: below the bottom of the level.
    if (this.position.y > 320) this.fell();
  }

  update(dt) {
    // Two pictures make the walk: swap them 8 times a second while moving on the ground.
    const walking = this.isOnFloor() && this.velocity.x !== 0 && Math.floor(time.now * 8) % 2 === 1;
    this.sprite.texture = walking || !this.isOnFloor() ? '${hero(WALK)}' : '${hero(STAND)}';
  }

  // A coin calls this when the player touches it.
  collect(coin) {
    this.coins += 1;
    this.showScore();
  }

  // The flag calls this.
  reachFlag() {
    this.won = true;
    this.showScore();
  }

  fell() {
    this.position = this.start;
    this.velocity = { x: 0, y: 0 };
    console.log('Fell down a gap. Back to the start.');
  }

  showScore() {
    scene.get('HUD/Score').text = \`Coins: \${this.coins} / \${this.total}\`;
    scene.get('HUD/Message').visible = this.won;
  }
}
`;

const coin = `// One script for every coin: it bobs up and down, and is collected when the player touches it.
export default class Coin extends Area2D {
  ready() {
    this.baseY = this.position.y;
  }

  update(dt) {
    // Each coin bobs a little out of step with the next, by its x position.
    this.position = { x: this.position.x, y: this.baseY + 2 * Math.sin(3 * time.now + this.position.x / 40) };
  }

  bodyEntered(body) {
    if (body.name !== 'Player') return;
    body.collect(this);
    this.queueFree();
  }
}
`;

const flag = `export default class Flag extends Area2D {
  bodyEntered(body) {
    if (body.name === 'Player') body.reachFlag();
  }
}
`;

const code = `// Coin Run: a level 60 × 15 tiles of 18 pixels (1080 × 270), built by code.
scene = project.createScene('scenes/level.scene', 'Node2D', 'Level')
project.setSettings({ background: '#dcf2f1', pixelArt: true, gravity: 980 })   // gravity pulls down at 980 px/s²
const T = 18                                  // one tile
const at = (col, row) => ({ x: T / 2 + T * col, y: T / 2 + T * row })   // the centre of a tile

// The backdrop, behind everything. A plain picture can be stretched: one sky picture scaled
// 45 × 6.25 covers the top; the hills are 45 pictures in a row, because they have detail.
scene.add('Node2D', { name: 'Backdrop', zIndex: -1 })
scene.add('Sprite2D', { name: 'Sky', parent: 'Backdrop', position: { x: 540, y: 75 }, scale: { x: 45, y: 6.25 }, texture: '${back(SKY)}' })
const hills = [${HILLS.map((n) => `'${back(n)}'`).join(', ')}]
for (let i = 0; i < 45; i++) scene.add('Sprite2D', { name: 'Hills', parent: 'Backdrop', position: { x: 12 + 24 * i, y: 162 }, texture: hills[i % 4] })
scene.add('Sprite2D', { name: 'Low', parent: 'Backdrop', position: { x: 540, y: 222 }, scale: { x: 45, y: 4 }, texture: '${back(LOW)}' })

// The ground and the floating platforms: one StaticBody2D. Each stretch gets its tiles and
// one rectangle shape covering them, so a stretch of 15 tiles is one shape, not 15.
scene.add('StaticBody2D', { name: 'Ground' })
function stretch(first, last, row, depth) {
  for (let col = first; col <= last; col++) {
    const top = col === first ? '${tile(LEFT)}' : col === last ? '${tile(RIGHT)}' : '${tile(MID)}'
    scene.add('Sprite2D', { name: 'Tile', parent: 'Ground', position: at(col, row), texture: top })
    for (let r = row + 1; r < row + depth; r++) scene.add('Sprite2D', { name: 'Tile', parent: 'Ground', position: at(col, r), texture: '${tile(DIRT)}' })
  }
  const width = (last - first + 1) * T, height = depth * T
  scene.add('CollisionShape2D', { name: 'Shape', parent: 'Ground', position: { x: first * T + width / 2, y: row * T + height / 2 }, size: { x: width, y: height } })
}
// Three stretches of ground two tiles deep, with gaps of three tiles between them.
stretch(0, 14, 13, 2)
stretch(18, 31, 13, 2)
stretch(35, 59, 13, 2)
// Floating platforms, one tile deep: row 10 is three tiles above the ground, row 7 three above that.
stretch(6, 9, 10, 1)
stretch(11, 13, 7, 1)
stretch(22, 25, 10, 1)
stretch(38, 40, 10, 1)
stretch(43, 46, 7, 1)

// Invisible walls at both ends, so the player cannot run off the level.
scene.add('StaticBody2D', { name: 'Edges' })
scene.add('CollisionShape2D', { name: 'Left', parent: 'Edges', position: { x: -9, y: 0 }, size: { x: 18, y: 600 } })
scene.add('CollisionShape2D', { name: 'Right', parent: 'Edges', position: { x: 1089, y: 0 }, size: { x: 18, y: 600 } })

// Ten coins: each an Area2D with a picture and a round shape, all sharing one script.
scene.add('Node2D', { name: 'Coins', zIndex: 1 })
project.writeScript('scripts/coin.js', ${JSON.stringify(coin)})
const coins = [[7, 9], [8, 9], [12, 6], [16, 11], [23, 9], [24, 9], [33, 11], [44, 6], [45, 6], [50, 12]]
for (const [col, row] of coins) {
  const c = scene.add('Area2D', { name: 'Coin1', parent: 'Coins', position: at(col, row), script: 'scripts/coin.js' })
  scene.add('Sprite2D', { name: 'Sprite', parent: c.path, texture: '${tile(COIN)}' })
  scene.add('CollisionShape2D', { name: 'Shape', parent: c.path, shape: 'circle', size: { x: 12, y: 12 } })
}

// The flag at the end: an Area2D two tiles tall, the flag on top of its pole.
scene.add('Area2D', { name: 'Flag', position: { x: 57 * T + T / 2, y: 12 * T }, zIndex: 1 })
scene.add('Sprite2D', { name: 'Cloth', parent: 'Flag', position: { x: 0, y: -9 }, texture: '${tile(FLAG)}' })
scene.add('Sprite2D', { name: 'Pole', parent: 'Flag', position: { x: 0, y: 9 }, texture: '${tile(POLE)}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Flag', size: { x: 12, y: 36 } })
project.writeScript('scripts/flag.js', ${JSON.stringify(flag)})
scene.get('Flag').script = 'scripts/flag.js'

// The player: a CharacterBody2D its script moves, a picture 24 pixels square, a shape a
// little narrower than the picture, and a camera that follows it but stays inside the level.
scene.add('CharacterBody2D', { name: 'Player', position: { x: 27, y: 200 }, zIndex: 2 })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Player', texture: '${hero(STAND)}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Player', position: { x: 0, y: 1 }, size: { x: 14, y: 22 } })
scene.add('Camera2D', { name: 'Camera', parent: 'Player', zoom: 3, smoothing: 8, limitTopLeft: { x: 0, y: 0 }, limitBottomRight: { x: 1080, y: 270 } })
project.writeScript('scripts/player.js', ${JSON.stringify(player)})
scene.get('Player').script = 'scripts/player.js'

// The HUD: on a CanvasLayer, so it stays put while the camera moves.
scene.add('CanvasLayer', { name: 'HUD' })
scene.add('Label', { name: 'Score', parent: 'HUD', position: { x: 16, y: 12 }, fontSize: 28, color: '#2b2d42', text: 'Coins: 0 / 10' })
scene.add('Label', { name: 'Message', parent: 'HUD', position: { x: 330, y: 236 }, fontSize: 40, color: '#e76f51', text: 'You reached the flag!', visible: false })
`;

export const platformer: GameExample = {
  id: 'coin-run',
  title: 'Coin Run',
  blurb: 'A side-on platformer: run, jump between platforms, collect ten coins and reach the flag. Gravity, jumping, falling down gaps, a walk made of two pictures, and a camera that scrolls the level.',
  art: 'Kenney Pixel Platformer (CC0)',
  images: [
    ...[LEFT, MID, RIGHT, DIRT, COIN, FLAG, POLE].map(tile),
    ...[SKY, ...HILLS, LOW].map(back),
    ...[STAND, WALK].map(hero),
  ],
  code,
  guide: [
    'Press ▶ Run (F5). ← → or A and D run; Space, ↑ or W jumps. Hold the jump key for a higher jump. Collect the coins and reach the flag at the far right; if you fall down a gap you go back to the start.',
    'Open Project › Settings: gravity is 980. That one number pulls the player down: scripts/player.js adds physics.gravity × dt to velocity.y every physics step. Set it to 400 and run: you float like on the Moon.',
    'In scripts/player.js, the jump only happens when isOnFloor() is true. moveAndSlide() sets that when it stops the player on a surface facing up, so you cannot jump again in mid-air. jumpSpeed 360 gives a jump of 360² ÷ (2 × 980) ≈ 66 pixels: a little over the three tiles up to each platform.',
    'Select Ground in the tree. It is one StaticBody2D holding every tile and eight teal rectangles: each stretch of ground or platform is one shape, however many tiles it has. The function stretch() in GUI → code builds each one.',
    'Select Backdrop › Sky. It is a single 24-pixel picture with scale 45 × 6.25: a plain picture can be stretched to cover the whole sky. The hills have detail, so they are 45 pictures in a row instead.',
    'Try it yourself: select one of the platforms’ shapes (Ground › Shape4 is the first floating one) and drag it up in the viewport. The tiles stay where they are, but the solid part moves: shapes, not pictures, are what the player stands on.',
    'Open scripts/coin.js: every coin bobs with a sine wave, offset by its x position so they do not all move together. Change 2 to 6 for bigger bobs.',
  ],
};
