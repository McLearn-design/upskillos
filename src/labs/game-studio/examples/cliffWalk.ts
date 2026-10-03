// Example: Cliff Walk, the gridworld of Sutton & Barto's Example 6.6, as a game you can play and an agent can learn.
//
// A 12 × 4 grid: start bottom-left, a chest bottom-right, spikes between them along the bottom (the cliff). Every move
// costs 1; stepping onto the spikes costs 100 and sends you back to the start. The Walker is a script agent
// (ml/env.ts): what it sees is its cell, what it does is one of four moves, what it earns is that cost. Its state is
// its cell exactly, so a table holds everything there is to know, and the overlay draws the table on the grid as it
// learns: the colour of each cell is its best Q, the arrow the move it would make.
//
// Train it with Q-learning and with SARSA (Run › Train an agent…, ε constant 0.1, α 0.5, γ 1): Q-learning learns the
// shortest path along the spikes, SARSA a safer one along the top. Exploring, the shortest path falls off now and
// then, so SARSA earns more while it learns, and Q-learning's path is better once exploring stops.

import type { GameExample } from './types';
import type { EnvSpec } from '../ml/env';

const SHEET = 'assets/tiny-dungeon/tilemap/tilemap_packed.png';   // 12 × 11 tiles of 16 px
const HERO = 'assets/tiny-dungeon/tiles/tile_0085.png';
const SAND = 48, SPIKES = 41, CHEST = 89;

/** The grid as text: . ground, S the start, X spikes (the cliff), G the chest. */
export const CLIFF = [
  '............',
  '............',
  '............',
  'SXXXXXXXXXXG',
];

const walker = `// The Walker: an agent (Run › Train an agent…). Without a brain, you walk it with the arrow keys.
//
// An agent's script says what it sees, what it can do, and what it earns:
//   observe()     the numbers it sees: its column and row
//   act(action)   one move: 0 up, 1 right, 2 down, 3 left
//   reward()      what it earned since the last decision: −1 a move, −100 for the spikes
//   done()        the episode is over: it reached the chest
// With a brain (brains/walker.json, saved from Run › Train an agent…), the game asks the brain what to do every
// decideEvery frames. Training calls the same methods, so it walks the same in training and in play.
export default class Walker extends Sprite2D {
  actions = ['up', 'right', 'down', 'left']
  observations = ['column', 'row']
  brain = 'brains/walker.json'
  decideEvery = 6            // frames between moves: 10 moves a second

  ready() {
    this.ground = scene.get('Ground')
    this.message = scene.get('HUD/Message')
    this.returnLabel = scene.get('HUD/Return')
    this.restart()
  }

  restart() {
    this.cell = { x: 0, y: 3 }
    this.earned = 0
    this.total = 0
    this.atChest = false
    this.place()
  }

  place() {
    this.position = this.ground.mapToLocal(this.cell)
    this.returnLabel.text = 'Return: ' + this.total
  }

  observe() { return [this.cell.x, this.cell.y] }

  act(action) {
    if (this.atChest) this.restart()          // a brain playing on: a new walk from the start
    const d = [[0, -1], [1, 0], [0, 1], [-1, 0]][action]
    this.cell = { x: math.clamp(this.cell.x + d[0], 0, 11), y: math.clamp(this.cell.y + d[1], 0, 3) }
    let r = -1
    if (this.cell.y === 3 && this.cell.x > 0 && this.cell.x < 11) {
      r = -100                               // the spikes: back to the start
      this.cell = { x: 0, y: 3 }
    }
    if (this.cell.x === 11 && this.cell.y === 3) this.atChest = true
    this.earned += r
    this.total += r
    this.place()
    this.message.visible = this.atChest && !ai.training
  }

  reward() { const r = this.earned; this.earned = 0; return r }
  done() { return this.atChest }

  update(dt) {
    if (ai.training || ai.has(this.brain)) return   // the brain (or training) walks it
    if (this.atChest) { if (input.isJustPressed('jump')) { this.restart(); this.message.visible = false } return }
    const keys = ['move_up', 'move_right', 'move_down', 'move_left']
    for (let a = 0; a < 4; a++) if (input.isJustPressed(keys[a])) this.act(a)
  }
}
`;

const code = `// Cliff Walk: a 12 × 4 grid of 16-pixel cells (Sutton & Barto, Example 6.6).
scene = project.createScene('scenes/cliff.scene', 'Node2D', 'Cliff')
project.setSettings({ background: '#1d2330', pixelArt: true, gravity: 0 })
project.createTileset('tilesets/dungeon.tileset', { image: '${SHEET}', tileWidth: 16, tileHeight: 16 })

// The grid as text: . ground, S start, X spikes (the cliff), G the chest.
const grid = ${JSON.stringify(CLIFF, null, 2)}
scene.add('TileMapLayer', { name: 'Ground', tileset: 'tilesets/dungeon.tileset' }).fromText(grid, { '.': ${SAND}, 'S': ${SAND}, 'X': ${SAND}, 'G': ${SAND} })
scene.add('TileMapLayer', { name: 'Spikes', tileset: 'tilesets/dungeon.tileset' }).fromText(grid, { 'X': ${SPIKES} })
scene.add('TileMapLayer', { name: 'Chest', tileset: 'tilesets/dungeon.tileset' }).fromText(grid, { 'G': ${CHEST} })

project.writeScript('scripts/walker.js', ${JSON.stringify(walker)})
scene.add('Sprite2D', { name: 'Walker', position: { x: 8, y: 56 }, texture: '${HERO}', zIndex: 2, script: 'scripts/walker.js' })

// A camera over the grid's middle, 4.5 times closer: the 192 × 64 grid fills the width of the screen.
scene.add('Camera2D', { name: 'Camera', position: { x: 96, y: 40 }, zoom: 4.5 })

scene.add('CanvasLayer', { name: 'HUD' })
scene.add('Label', { name: 'Return', parent: 'HUD', position: { x: 14, y: 8 }, fontSize: 22, text: 'Return: 0' })
scene.add('Label', { name: 'Help', parent: 'HUD', position: { x: 14, y: 500 }, fontSize: 16, color: '#94a3b8', text: 'Arrow keys walk. Every move costs 1; the spikes cost 100 and send you back to the start.' })
scene.add('Label', { name: 'Message', parent: 'HUD', position: { x: 280, y: 80 }, fontSize: 26, color: '#ffd166', text: 'You reached the chest! Space to walk again.', visible: false })
`;

/** The Walker as an environment: its cell is its state (12 columns × 4 rows = 48 states), drawn over the grid. */
export const CLIFF_SPEC: EnvSpec = {
  agent: 'Walker',
  bins: [[0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5, 10.5], [0.5, 1.5, 2.5]],
  maxSteps: 200,
  overlay: { grid: [12, 4], cell: [16, 16], origin: [0, 0], arrows: ['↑', '→', '↓', '←'] },
};

export const cliffWalk: GameExample = {
  id: 'cliff-walk',
  title: 'Cliff Walk',
  blurb: 'Walk from the start to the chest without stepping on the spikes, then watch an agent learn to: the gridworld of reinforcement learning\'s textbook (Sutton & Barto, Example 6.6), with Q-learning, SARSA and their relatives, and the table drawn on the grid as it learns.',
  art: 'Kenney Tiny Dungeon (CC0)',
  images: [SHEET, HERO],
  code,
  agent: CLIFF_SPEC,
  guide: [
    'Press ▶ Run and walk it yourself with the arrow keys. Every move costs 1 and the spikes cost 100. The best walk is 13 moves: up, 11 right, down. Return −13.',
    'Open scripts/walker.js. The Walker is an agent: observe() says what it sees (its column and row), act(action) makes one move, reward() says what it earned, done() says the walk is over. A brain saved at brains/walker.json walks it from then on.',
    'Run › Train an agent…. The environment is { "agent": "Walker", "bins": … }: the bins make each cell one state, 48 in all. Set ε from 0.1 to 0.1, constant, α 0.5, γ 1, 500 episodes, and press ▶ Train in view: the table is drawn on the grid, its colour the best Q, its arrow the move it would make.',
    'Train again with the update set to SARSA, and compare. Q-learning\'s arrows run along the spikes, the shortest walk; SARSA\'s run along the top, away from them. While exploring, a random step next to the spikes falls off, so SARSA earns more during training, and Q-learning\'s walk is better once exploring stops.',
    'Try Expected SARSA, softmax exploration, and a starting Q of 0 against −20 (optimistic, since every real return is lower): which tries more of the grid early on?',
    'Save as brain, and run the game: the brain walks it, and the arrows show what it learned.',
  ],
};
