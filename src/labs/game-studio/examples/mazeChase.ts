// Example: Maze Chase. Eat every coin in the maze before the ghosts catch you.
//
// Built only with the real Scene API and the engine's real nodes and scripts, like every
// example. What it adds: a tileset made from a sheet of tiles, three TileMapLayers (floor,
// walls, coins), a map written as text, solid tiles, movement from cell to cell that asks the
// map where it can go, coins eaten by erasing their cells, and ghosts that find the player
// with a breadth-first search, in a script module both ghosts import.

import type { GameExample } from './types';

const SHEET = 'assets/tiny-dungeon/tilemap/tilemap_packed.png';   // 192 × 176: 12 × 11 tiles of 16 px
const HERO = 'assets/tiny-dungeon/tiles/tile_0085.png';
const GHOST = 'assets/tiny-dungeon/tiles/tile_0121.png';
const WALL = 40, FLOOR = 48, COIN = 101;

/** The maze: # wall, . floor with a coin, P the player's start, G a ghost's start. 21 × 13 cells. */
export const MAZE = [
  '#####################',
  '#.........#.........#',
  '#.##.###..#..###.##.#',
  '#...................#',
  '#.##.#.###.###.#.##.#',
  '#....#...#G#...#....#',
  '####.###.....###.####',
  '#........#G#........#',
  '#.##.###.....###.##.#',
  '#...#.....P.....#...#',
  '###.#.###.#.###.#.###',
  '#.........#.........#',
  '#####################',
];

const grid = `// Finding a way through the maze: a breadth-first search over the cells.
// From the start, it visits every cell one step away, then every cell two steps away, and
// so on, remembering where it came from; the first time it reaches the goal, that is a
// shortest path. Walls are the cells the Walls layer says are solid.

const DIRS = [{ x: 1, y: 0 }, { x: -1, y: 0 }, { x: 0, y: 1 }, { x: 0, y: -1 }];

/** The first step (a direction) on a shortest path from one cell to another, or null if there is none. */
export function firstStep(walls, from, to) {
  const key = (c) => c.x + ',' + c.y;
  const came = new Map();   // cell → the cell it was reached from
  came.set(key(from), null);
  const queue = [from];
  while (queue.length) {
    const cell = queue.shift();
    if (cell.x === to.x && cell.y === to.y) {
      // Walk back to the cell next to the start: the direction to it is the first step.
      let c = cell;
      while (came.get(key(c)) && key(came.get(key(c))) !== key(from)) c = came.get(key(c));
      return { x: c.x - from.x, y: c.y - from.y };
    }
    for (const d of DIRS) {
      const next = { x: cell.x + d.x, y: cell.y + d.y };
      if (!came.has(key(next)) && !walls.isCellSolid(next.x, next.y)) { came.set(key(next), cell); queue.push(next); }
    }
  }
  return null;
}
`;

const player = `export default class Player extends Sprite2D {
  speed = 60;        // pixels per second: almost 4 cells a second
  lives = 3;
  score = 0;

  ready() {
    this.walls = scene.get('Walls');
    this.coins = scene.get('Coins');
    this.total = this.coins.getUsedCells().length;
    this.home = this.position.copy();
    this.over = false;
    this.restart();
  }

  restart() {
    this.position = this.home;
    this.cell = this.walls.localToMap(this.position);   // the cell it is in (or leaving)
    this.target = this.cell;                            // the cell it is heading for
    this.dir = { x: 0, y: 0 };                          // the way it is going
    this.want = { x: 0, y: 0 };                         // the way the player last asked for
    this.showHud();
  }

  // Whether the cell next to \`cell\`, in direction d, is open.
  open(cell, d) {
    return !this.walls.isCellSolid(cell.x + d.x, cell.y + d.y);
  }

  update(dt) {
    if (this.over) return;
    // Remember the last arrow pressed: the turn is taken at the next cell where it is open.
    if (input.isPressed('move_left')) this.want = { x: -1, y: 0 };
    if (input.isPressed('move_right')) this.want = { x: 1, y: 0 };
    if (input.isPressed('move_up')) this.want = { x: 0, y: -1 };
    if (input.isPressed('move_down')) this.want = { x: 0, y: 1 };
    // Turning right round can happen at once, half-way between cells.
    if (this.want.x === -this.dir.x && this.want.y === -this.dir.y && (this.want.x || this.want.y)) {
      this.dir = this.want;
      [this.cell, this.target] = [this.target, this.cell];
    }
    // Move towards the target cell's centre; on arriving, eat its coin and choose the next cell.
    let step = this.speed * dt;
    while (step > 0) {
      const goal = this.walls.mapToLocal(this.target);
      const gap = goal.distanceTo(this.position);
      if (gap > step) { this.position = this.position.add(goal.sub(this.position).scale(step / gap)); break; }
      this.position = goal;
      step -= gap;
      this.cell = this.target;
      this.eat(this.cell);
      if ((this.want.x || this.want.y) && this.open(this.cell, this.want)) this.dir = this.want;
      // Standing still, or facing a wall: stop here until a way is chosen.
      if (!(this.dir.x || this.dir.y) || !this.open(this.cell, this.dir)) { this.dir = { x: 0, y: 0 }; break; }
      this.target = { x: this.cell.x + this.dir.x, y: this.cell.y + this.dir.y };
    }
  }

  eat(cell) {
    if (this.coins.getCell(cell.x, cell.y) < 0) return;
    this.coins.eraseCell(cell.x, cell.y);   // the coin is a tile: eating it empties its cell
    this.score += 10;
    if (this.coins.getUsedCells().length === 0) this.finish('You cleared the maze!');
    this.showHud();
  }

  // A ghost calls this when it reaches the player.
  caught() {
    if (this.over) return;
    this.lives -= 1;
    if (this.lives === 0) { this.finish('Caught! Press ↻ to play again.'); return; }
    this.restart();
    for (const g of scene.get('Ghosts').children) g.restart();
  }

  finish(message) {
    this.over = true;
    scene.get('HUD/Message').text = message;
    scene.get('HUD/Message').visible = true;
    this.showHud();
  }

  showHud() {
    scene.get('HUD/Score').text = \`Score: \${this.score}   Coins left: \${this.coins.getUsedCells().length}\`;
    scene.get('HUD/Lives').text = \`Lives: \${this.lives}\`;
  }
}
`;

const ghost = `import { firstStep } from './grid.js';

// One script for both ghosts. At the centre of each cell, a ghost takes the first step of a
// shortest path to the cell the player is in (or heading for).
export default class Ghost extends Sprite2D {
  speed = 42;   // slower than the player, so it can be outrun

  ready() {
    this.walls = scene.get('Walls');
    this.player = scene.get('Player');
    this.home = this.position.copy();
    // The second ghost waits a little before it comes out.
    this.delay = this.name === 'Ghost' ? 1 : 4;
    this.restart();
  }

  restart() {
    this.position = this.home;
    this.cell = this.walls.localToMap(this.position);
    this.target = this.cell;
    this.wait = this.delay;
  }

  update(dt) {
    if (this.player.over) return;
    if (this.wait > 0) { this.wait -= dt; return; }
    let step = this.speed * dt;
    while (step > 0) {
      const goal = this.walls.mapToLocal(this.target);
      const gap = goal.distanceTo(this.position);
      if (gap > step) { this.position = this.position.add(goal.sub(this.position).scale(step / gap)); break; }
      this.position = goal;
      step -= gap;
      this.cell = this.target;
      const d = firstStep(this.walls, this.cell, this.player.target);
      if (!d || !(d.x || d.y)) break;   // no way there, or already there
      this.target = { x: this.cell.x + d.x, y: this.cell.y + d.y };
    }
    // Close enough to touch: under 10 pixels apart.
    if (this.position.distanceTo(this.player.position) < 10) this.player.caught();
  }
}
`;

const code = `// Maze Chase: a maze of 21 × 13 cells of 16 pixels, built with tiles.
scene = project.createScene('scenes/maze.scene', 'Node2D', 'Maze')
project.setSettings({ background: '#24212c', pixelArt: true, gravity: 0 })

// A tileset: the Tiny Dungeon sheet cut into 16 × 16 tiles, numbered across then down.
// Tile ${WALL} (a brick wall) is solid: isCellSolid says so, and bodies would stop at it.
project.createTileset('tilesets/dungeon.tileset', { image: '${SHEET}', tileWidth: 16, tileHeight: 16, solid: [${WALL}] })

// The maze as text: # wall, . a coin, P the player, G a ghost.
const maze = ${JSON.stringify(MAZE, null, 2).replace(/\n/g, '\n')}

// Three layers, each a TileMapLayer, drawn in order: the floor, the walls, the coins.
// fromText reads the map: each character is a cell, and the legend says which tile it gets.
scene.add('TileMapLayer', { name: 'Floor', tileset: 'tilesets/dungeon.tileset' }).fromText(maze, { '.': ${FLOOR}, 'P': ${FLOOR}, 'G': ${FLOOR} })
scene.add('TileMapLayer', { name: 'Walls', tileset: 'tilesets/dungeon.tileset' }).fromText(maze, { '#': ${WALL} })
scene.add('TileMapLayer', { name: 'Coins', tileset: 'tilesets/dungeon.tileset' }).fromText(maze, { '.': ${COIN} })

// A cell's centre: (x + 0.5) × 16 across, (y + 0.5) × 16 down.
const centre = (x, y) => ({ x: x * 16 + 8, y: y * 16 + 8 })
const find = (ch) => maze.flatMap((row, y) => [...row].map((c, x) => (c === ch ? [x, y] : null))).filter(Boolean)

// Scripts: a shared module for finding the way, the player, and one script for both ghosts.
project.writeScript('scripts/grid.js', ${JSON.stringify(grid)})
project.writeScript('scripts/player.js', ${JSON.stringify(player)})
project.writeScript('scripts/ghost.js', ${JSON.stringify(ghost)})

const [px, py] = find('P')[0]
scene.add('Sprite2D', { name: 'Player', position: centre(px, py), texture: '${HERO}', zIndex: 2, script: 'scripts/player.js' })
scene.add('Node2D', { name: 'Ghosts', zIndex: 1 })
for (const [gx, gy] of find('G')) scene.add('Sprite2D', { name: 'Ghost', parent: 'Ghosts', position: centre(gx, gy), texture: '${GHOST}', script: 'scripts/ghost.js' })

// A camera over the middle of the maze, 2.5 times closer: 336 × 208 pixels fill most of the screen.
scene.add('Camera2D', { name: 'Camera', position: { x: 168, y: 104 }, zoom: 2.5 })

scene.add('CanvasLayer', { name: 'HUD' })
scene.add('Label', { name: 'Score', parent: 'HUD', position: { x: 14, y: 6 }, fontSize: 20, text: 'Score: 0' })
scene.add('Label', { name: 'Lives', parent: 'HUD', position: { x: 860, y: 6 }, fontSize: 20, text: 'Lives: 3' })
scene.add('Label', { name: 'Message', parent: 'HUD', position: { x: 300, y: 250 }, fontSize: 36, color: '#ffd166', text: '', visible: false })
`;

export const mazeChase: GameExample = {
  id: 'maze-chase',
  title: 'Maze Chase',
  blurb: 'Eat every coin in the maze before the two ghosts catch you. A tile map in three layers, a map written as text, solid tiles, grid movement, and ghosts that find you with a breadth-first search.',
  art: 'Kenney Tiny Dungeon (CC0)',
  images: [SHEET, HERO, GHOST],
  code,
  guide: [
    'Press ▶ Run (F5). The arrow keys or WASD steer: press a direction a little before a turn and it is taken as soon as it opens. Eat all the coins; the ghosts cost you a life each time they touch you.',
    'The maze is three TileMapLayers. Select Walls: the TileMap panel opens with the Tiny Dungeon sheet as the palette. GUI → code shows how the map was made: written as text, and read with fromText.',
    'Try it yourself: with Walls selected, pick the Erase tool in the TileMap panel and click a wall in the viewport to open a new passage, then run. The player and the ghosts use it at once: they ask the map with isCellSolid, which reads the tileset’s solid tiles.',
    'Press ■ Solid tiles in the TileMap panel: the brick wall (tile 40) is outlined. Solid tiles are part of the tileset, so every layer using it agrees.',
    'Open scripts/player.js. The player moves from cell centre to cell centre: localToMap turns a position into a cell, and mapToLocal a cell into its centre. A coin is a tile in the Coins layer, so eating it is eraseCell.',
    'Open scripts/grid.js: a breadth-first search. From the ghost’s cell it visits every cell 1 step away, then 2, and so on; the first time it reaches the player, that is a shortest path. scripts/ghost.js imports it with import { firstStep } from ’./grid.js’.',
    'Change speed in scripts/ghost.js from 42 to 70, and run: now the ghosts are faster than you.',
  ],
};
