// The Tetris tutorial: a whole game, one idea at a time (docs/game-studio-course-plan.md, "Tetris").
//
// The game is one script, scripts/board.js, on a Node2D called Board, plus scripts/pieces.js (the
// seven shapes and their pictures, given at the start). The board is a grid of numbers; the screen
// is a grid of sprites whose pictures are set from the numbers every frame.
//
// Every step of every task adds one feature to board.js, in the order of FEATURES. boardJs(f) is the
// script with every feature up to f, so a task's start is the script after the previous task, its
// solution is the script after its last step, and each step has its own script too: the pictures
// script (e2e/tutorials.shots.mjs) types it in, and the tests check that it passes that step.

import type { GameTask, PlayResult, PlayView, TaskStep } from './types';
import { childrenOf, named, need, noErrors } from './helpers';
import type { DrawItem } from '../engine/game';

const TILE = (colour: string, n = '01') => `assets/puzzle-pack/tiles-${colour}/tile${colour}_${n}.png`;
/** Pictures by colour number: 0 is an empty cell, then the pieces in TYPES order. */
const TEXTURES = [TILE('black'), TILE('grey'), TILE('yellow'), TILE('pink'), TILE('green'), TILE('red'), TILE('blue'), TILE('orange', '72')];
const TYPES = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'] as const;
type Cells = [number, number][];
/** Each piece as four cells, [x, y], about the cell [0, 0] it turns around. y grows downwards. */
const PIECES: Record<string, Cells> = {
  I: [[-1, 0], [0, 0], [1, 0], [2, 0]],
  O: [[0, 0], [1, 0], [0, 1], [1, 1]],
  T: [[-1, 0], [0, 0], [1, 0], [0, -1]],
  S: [[-1, 0], [0, 0], [0, -1], [1, -1]],
  Z: [[-1, -1], [0, -1], [0, 0], [1, 0]],
  J: [[-1, -1], [-1, 0], [0, 0], [1, 0]],
  L: [[1, -1], [-1, 0], [0, 0], [1, 0]],
};
const SIZE = 26, ROWS = 20, COLS = 10;

const PIECES_JS = `// The seven Tetris pieces, and the pictures for the board's colour numbers.
//
// A piece is four cells, [x, y], measured from its centre cell [0, 0], which it turns around.
// x grows to the right and y grows downwards, as on the screen.
export const PIECES = {
${TYPES.map((t) => `  ${t}: ${JSON.stringify(PIECES[t]).replace(/,/g, ', ')},`).join('\n')}
};

// The pieces' names, in colour order: I is colour 1, O is 2, and so on.
export const TYPES = ${JSON.stringify(TYPES).replace(/,/g, ', ').replace(/"/g, "'")};

// The picture for each colour number. 0 is an empty cell (black); 1 to 7 are the pieces' colours.
export const TEXTURES = [
${TEXTURES.map((t) => `  '${t}',`).join('\n')}
];

// A piece's colour number, from its name: colourOf('T') is 3.
export const colourOf = (type) => TYPES.indexOf(type) + 1;
`;

// ── board.js, feature by feature ──────────────────────────────────────────

const FEATURES = ['cells', 'sprites', 'draw', 'spawn', 'drawPiece', 'canPlace', 'move', 'keys', 'fall', 'lock', 'softDrop', 'rotated', 'rotate', 'rotateKey',
  'clearLines', 'clearOnLock', 'score', 'showScore', 'bag', 'gameOver', 'hardDrop', 'levels', 'next'] as const;
type Feature = (typeof FEATURES)[number];

/** board.js with every feature up to and including `upTo` (none: an empty Board). */
export function boardJs(upTo: Feature | null): string {
  const last = upTo ? FEATURES.indexOf(upTo) : -1;
  const has = (f: Feature) => FEATURES.indexOf(f) <= last;
  const L: string[] = [];
  const add = (cond: boolean, ...lines: string[]) => { if (cond) L.push(...lines); };

  const names = [has('spawn') && 'PIECES', has('bag') && 'TYPES', has('sprites') && 'TEXTURES', has('drawPiece') && 'colourOf'].filter(Boolean);
  add(names.length > 0, `import { ${names.join(', ')} } from './pieces.js';`, '');
  add(has('cells'), 'const ROWS = 20, COLS = 10;');
  add(has('sprites'), 'const SIZE = 26;   // a cell, in pixels (the pictures are 128 across)');
  add(has('cells'), '');
  L.push('export default class Board extends Node2D {');
  add(has('fall'), '  timer = 0;        // seconds since the piece last fell');
  add(has('fall') && !has('levels'), '  interval = 0.5;   // seconds between falls');
  add(has('score'), '  score = 0;', '  lines = 0;');
  add(has('bag'), '  bag = [];         // the piece types still to come in this round of seven');
  add(has('gameOver'), '  over = false;');
  add(has('fall'), '');

  // ready
  L.push('  ready() {');
  add(has('cells'),
    '    // The board as numbers: cells[row][col] is 0 for an empty cell, or the colour (1 to 7) of what landed there.',
    '    this.cells = [];',
    '    for (let row = 0; row < ROWS; row++) this.cells.push(new Array(COLS).fill(0));');
  add(has('sprites'),
    '',
    '    // The board as pictures: one Sprite2D per cell, made once. draw() only changes their textures.',
    '    this.sprites = [];',
    '    for (let row = 0; row < ROWS; row++) {',
    '      const line = [];',
    '      for (let col = 0; col < COLS; col++) {',
    '        const s = new Sprite2D();',
    '        s.texture = TEXTURES[0];',
    '        s.position = { x: col * SIZE + SIZE / 2, y: row * SIZE + SIZE / 2 };   // a sprite\'s position is its centre',
    '        s.scale = { x: SIZE / 128, y: SIZE / 128 };',
    '        this.addChild(s);',
    '        line.push(s);',
    '      }',
    '      this.sprites.push(line);',
    '    }');
  add(has('spawn'), '');
  add(has('spawn') && !has('bag'), "    this.spawn('T');");
  add(has('bag') && !has('next'), '    this.spawn();');
  add(has('next'), '    this.next = this.takeFromBag();', '    this.spawn();');
  L.push('  }', '');

  // update
  L.push('  update(dt) {');
  add(has('gameOver'), '    if (this.over) return;   // the game has ended: nothing moves', '');
  add(has('keys'),
    '    // One press, one move: isJustPressed is true only on the frame the key goes down.',
    "    if (input.isJustPressed('move_left')) this.move(-1, 0);",
    "    if (input.isJustPressed('move_right')) this.move(1, 0);");
  add(has('rotateKey'), "    if (input.isJustPressed('move_up')) this.rotate();");
  add(has('hardDrop'), "    if (input.isJustPressed('jump')) this.hardDrop();");
  add(has('keys') && has('fall'), '');
  add(has('fall') && !has('softDrop'), '    // Fall one row every interval seconds.', '    this.timer += dt;', '    if (this.timer >= this.interval) {');
  add(has('softDrop'), '    // Fall one row every interval seconds, or every 0.05 s while ↓ is held.', '    this.timer += dt;',
    "    const wait = input.isPressed('move_down') ? 0.05 : this.interval;", '    if (this.timer >= wait) {');
  add(has('fall'), '      this.timer = 0;');
  add(has('fall') && !has('lock'), '      this.move(0, 1);');
  add(has('lock'), '      if (!this.move(0, 1)) this.lock();   // it could not fall: it has landed');
  add(has('fall'), '    }');
  add(has('draw') && (has('keys') || has('fall')), '');
  add(has('draw'), '    this.draw();');
  L.push('  }');

  // draw
  add(has('draw'), '',
    has('drawPiece') ? '  // Show the board: each cell\'s picture from its number, then the falling piece on top.' : '  // Show the board: each cell\'s picture from its number.',
    '  draw() {',
    '    for (let row = 0; row < ROWS; row++) {',
    '      for (let col = 0; col < COLS; col++) this.sprites[row][col].texture = TEXTURES[this.cells[row][col]];',
    '    }');
  add(has('drawPiece'),
    '    const p = this.piece;',
    '    for (const [x, y] of p.cells) {',
    '      const row = p.y + y, col = p.x + x;',
    '      if (row >= 0 && row < ROWS && col >= 0 && col < COLS) this.sprites[row][col].texture = TEXTURES[colourOf(p.type)];',
    '    }');
  add(has('showScore'), "    scene.get('HUD/Score').text = `Score ${this.score}`;");
  add(has('showScore') && !has('levels'), "    scene.get('HUD/Lines').text = `Lines ${this.lines}`;");
  add(has('levels'), "    scene.get('HUD/Lines').text = `Lines ${this.lines}   Level ${this.level}`;");
  add(has('next'), "    scene.get('HUD/Next').text = `Next ${this.next}`;");
  add(has('draw'), '  }');

  // spawn
  add(has('spawn'), '',
    has('bag') ? '  // A new piece at the top middle: the type given, or the next one when none is.' : '  // A new piece of this type at the top middle.');
  add(has('spawn') && !has('bag'), '  spawn(type) {');
  add(has('bag') && !has('next'), '  spawn(type = this.takeFromBag()) {');
  add(has('next'), '  spawn(type) {', '    if (!type) {', '      type = this.next;   // the one the Next label showed', '      this.next = this.takeFromBag();', '    }');
  add(has('spawn'), '    this.piece = { type, cells: PIECES[type], x: 4, y: 1 };');
  add(has('gameOver'), '    // No room for it: the well is full and the game is over.', '    if (!this.canPlace(this.piece.cells, this.piece.x, this.piece.y)) {', '      this.over = true;',
    "      scene.get('HUD/Message').text = 'Game over';", '    }');
  add(has('spawn'), '  }');

  add(has('canPlace'), '',
    '  // Whether these cells, with their centre at column x and row y, are all inside the well and on empty cells.',
    '  // (Above the top is allowed, so a piece can turn as it comes in.)',
    '  canPlace(cells, x, y) {',
    '    for (const [cx, cy] of cells) {',
    '      const col = x + cx, row = y + cy;',
    '      if (col < 0 || col >= COLS || row >= ROWS) return false;',
    '      if (row >= 0 && this.cells[row][col] !== 0) return false;',
    '    }',
    '    return true;',
    '  }');
  add(has('move'), '',
    '  // Move the piece by dx columns and dy rows if it fits there. Says whether it moved.',
    '  move(dx, dy) {',
    '    const p = this.piece;',
    '    if (!this.canPlace(p.cells, p.x + dx, p.y + dy)) return false;',
    '    p.x += dx;',
    '    p.y += dy;',
    '    return true;',
    '  }');
  add(has('lock'), '',
    has('clearOnLock') ? '  // The piece has landed: its cells become part of the board, full rows go, and a new piece comes.' : '  // The piece has landed: its cells become part of the board, and a new piece comes.',
    '  lock() {',
    '    const p = this.piece;',
    '    for (const [x, y] of p.cells) {',
    '      if (p.y + y >= 0) this.cells[p.y + y][p.x + x] = colourOf(p.type);',
    '    }');
  add(has('clearOnLock'), '    const cleared = this.clearLines();');
  add(has('score') && !has('levels'), '    this.score += [0, 100, 300, 500, 800][cleared];   // more lines at once score more');
  add(has('levels'), '    this.score += [0, 100, 300, 500, 800][cleared] * this.level;   // more lines at once score more, and more on higher levels');
  add(has('score'), '    this.lines += cleared;');
  add(has('lock') && !has('bag'), "    this.spawn('T');");
  add(has('bag'), '    this.spawn();');
  add(has('lock'), '  }');

  add(has('rotated'), '',
    '  // Each cell turned a quarter turn clockwise about [0, 0]: [x, y] becomes [-y, x]. A new list; the old one is unchanged.',
    '  rotated(cells) {',
    '    return cells.map(([x, y]) => [-y, x]);',
    '  }');
  add(has('rotate'), '',
    '  // Turn the piece if it fits. If not, try it nudged sideways ("wall kicks"): against a wall it still turns.',
    '  rotate() {',
    '    const p = this.piece;',
    "    if (p.type === 'O') return;   // a square looks the same turned (and turning it about a corner cell would move it)",
    '    const cells = this.rotated(p.cells);',
    '    for (const dx of [0, -1, 1, -2, 2]) {',
    '      if (this.canPlace(cells, p.x + dx, p.y)) {',
    '        p.cells = cells;',
    '        p.x += dx;',
    '        return;',
    '      }',
    '    }',
    '  }');
  add(has('clearLines'), '',
    '  // Take out every full row; the rows above drop down. Says how many went.',
    '  clearLines() {',
    '    const kept = this.cells.filter((row) => row.includes(0));   // a row with an empty cell is not full',
    '    const cleared = ROWS - kept.length;',
    '    while (kept.length < ROWS) kept.unshift(new Array(COLS).fill(0));   // new empty rows at the top',
    '    this.cells = kept;',
    '    return cleared;',
    '  }');
  add(has('bag'), '',
    '  // The next piece type from a "bag" of all seven in a random order: each comes once in every seven pieces.',
    '  takeFromBag() {',
    '    if (this.bag.length === 0) {',
    '      this.bag = [...TYPES];',
    '      // Shuffle (Fisher–Yates): from the end, swap each place with a random place at or before it.',
    '      for (let i = this.bag.length - 1; i > 0; i--) {',
    '        const j = Math.floor(Math.random() * (i + 1));',
    '        [this.bag[i], this.bag[j]] = [this.bag[j], this.bag[i]];',
    '      }',
    '    }',
    '    return this.bag.pop();',
    '  }');
  add(has('hardDrop'), '',
    '  // Straight down as far as it goes, and land there.',
    '  hardDrop() {',
    '    while (this.move(0, 1)) {}',
    '    this.lock();',
    '  }');
  add(has('levels'), '',
    '  // A new level every 10 lines; each level falls 15% faster than the one before.',
    '  get level() { return 1 + Math.floor(this.lines / 10); }',
    '  get interval() { return 0.5 * Math.pow(0.85, this.level - 1); }');
  L.push('}', '');
  return L.join('\n');
}

// ── the project, task by task ─────────────────────────────────────────────

const label = (name: string, y: number, text: string) => `scene.add('Label', { name: '${name}', parent: 'HUD', position: { x: 640, y: ${y} }, fontSize: 24, text: '${text}' })`;
const HUD = `scene.add('CanvasLayer', { name: 'HUD' })\n${label('Score', 20, 'Score 0')}\n${label('Lines', 56, 'Lines 0')}`;
const BASE = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')
scene.add('Node2D', { name: 'Board', position: { x: 350, y: 10 } })
project.writeScript('scripts/pieces.js', ${JSON.stringify(PIECES_JS)})`;
const writeBoard = (f: Feature | null) => `project.writeScript('scripts/board.js', ${JSON.stringify(boardJs(f))})`;

// ── checks ────────────────────────────────────────────────────────────────

type Pos = { x: number; y: number };
type Piece = { type: string; cells: Cells; x: number; y: number };
/** The Board of a running game, as its script made it. */
type B = { cells: number[][]; sprites: unknown[][]; piece: Piece; score: number; lines: number; level: number; next: string; bag: string[]; over: boolean; globalPosition: Pos; [k: string]: unknown };

/** Run the game for a moment (or longer) and give back its Board. */
async function board(v: PlayView, opts: { seconds?: number; keys?: string[]; setup?: (b: B) => void } = {}): Promise<{ b: B; r: PlayResult }> {
  const box: { b: B | null } = { b: null };
  const r = await v.play({ seconds: opts.seconds ?? 0.05, keys: opts.keys, setup: (g) => { box.b = named<B>(g, 'Board'); if (box.b && opts.setup) opts.setup(box.b); } });
  noErrors(r);
  if (!box.b) throw new Error('There is no node called Board in the running game.');
  return { b: box.b, r };
}
/** The board read afresh (after a method has changed it, which TypeScript cannot see). */
const now = (b: B): B => b;
const fn = (b: B, name: string) => { if (typeof b[name] !== 'function') throw new Error(`Board has no ${name}() method yet.`); return b[name] as (...a: unknown[]) => unknown; };
/** The picture drawn at a cell of the board (the top one, if more than one is drawn there). */
function picture(r: PlayResult, b: B, row: number, col: number): string | null {
  const x = b.globalPosition.x + col * SIZE + SIZE / 2, y = b.globalPosition.y + row * SIZE + SIZE / 2;
  const here = r.drawn.filter((i): i is Extract<DrawItem, { kind: 'sprite' }> => i.kind === 'sprite' && Math.abs(i.x - x) < 2 && Math.abs(i.y - y) < 2);
  return here.length ? here.reduce((a, c) => (c.depth > a.depth ? c : a)).texture : null;
}
const colourName = (t: string | null) => (t ? t.replace(/^.*tiles-(\w+)\/.*$/, '$1') : 'nothing');
const key = (cells: Cells) => cells.map(([x, y]) => `${x},${y}`).sort().join(' ');
const turn = (cells: Cells): Cells => cells.map(([x, y]) => [-y, x]);
const empty = () => Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
/** A board whose bottom row is full but for columns 3 to 6: an I lying flat there clears it. */
const gapRow = (b: B) => { b.cells = empty(); b.cells[19] = [1, 1, 1, 0, 0, 0, 0, 1, 1, 1]; b.piece = { type: 'I', cells: PIECES.I, x: 4, y: 19 }; };
const filled = (b: B) => b.cells.flat().filter((c) => c !== 0).length;

const play = (test: (v: PlayView) => Promise<true | string>): TaskStep['check'] => ({ kind: 'play', test });

interface Stage { text: string; hint?: string; f?: Feature; nodes?: string; check: TaskStep['check'] }
interface Part { id: string; title: string; goal: string; stages: Stage[]; done: string }

const PARTS: Part[] = [
  {
    id: 'tetris-board',
    title: 'Tetris 1: the board',
    goal: 'Make the Tetris well: a grid of numbers, 10 across and 20 down, and a grid of pictures that shows it.',
    stages: [
      { text: 'Select Board (a Node2D at 350, 10) and press New script. scripts/pieces.js is already there: the seven shapes and their pictures.',
        nodes: `${writeBoard(null)}\nscene.get('Board').script = 'scripts/board.js'`,
        check: { kind: 'project', test: (v) => !!v.byName('Board')?.script || 'Board has no script yet.' } },
      { f: 'cells', text: 'In ready(), make this.cells: an array of 20 rows, each an array of 10 zeros. A 0 is an empty cell; later a number 1 to 7 is a landed piece\'s colour.',
        hint: 'for (let row = 0; row < 20; row++) this.cells.push(new Array(10).fill(0));',
        check: play(async (v) => {
          const { b } = await board(v);
          if (!Array.isArray(b.cells)) return 'this.cells is not an array yet.';
          if (b.cells.length !== ROWS) return `this.cells has ${b.cells.length} rows; it needs 20.`;
          const bad = b.cells.findIndex((r) => !Array.isArray(r) || r.length !== COLS || r.some((c) => c !== 0));
          return bad < 0 || `Row ${bad} is not 10 zeros.`;
        }) },
      { f: 'sprites', text: 'Make the pictures: in ready(), 200 new Sprite2D()s added with this.addChild, one per cell, each 26 pixels square (scale 26/128) with the picture TEXTURES[0], and its centre at column × 26 + 13, row × 26 + 13. Keep them in this.sprites[row][col].',
        hint: 'Import TEXTURES from \'./pieces.js\'. Two loops, rows then columns; push each row\'s sprites into an array, and push that into this.sprites.',
        check: play(async (v) => {
          const { b, r } = await board(v);
          if (!Array.isArray(b.sprites) || b.sprites.length !== ROWS || b.sprites.some((row) => !Array.isArray(row) || row.length !== COLS)) return 'this.sprites should be 20 rows of 10 sprites.';
          for (const [row, col] of [[0, 0], [0, 9], [19, 0], [19, 9], [10, 4]]) {
            const p = picture(r, b, row, col);
            if (p !== TEXTURES[0]) return `Nothing black is drawn at row ${row}, column ${col} (${p ? `${colourName(p)} is` : 'nothing is'}): check the position, column × 26 + 13 across and row × 26 + 13 down.`;
          }
          const s = r.drawn.find((i) => i.kind === 'sprite' && i.texture === TEXTURES[0])!;
          return Math.abs(s.scaleX - SIZE / 128) < 0.005 || `The sprites are scaled ${s.scaleX.toFixed(3)}; 26 / 128 is 0.203.`;
        }) },
      { f: 'draw', text: 'Write draw(): set every sprite\'s texture to TEXTURES[this.cells[row][col]]. Call it at the end of update(dt), so the pictures always show the numbers.',
        check: play(async (v) => {
          const { b, r } = await board(v, { setup: (b) => { b.cells[19][0] = 1; b.cells[0][9] = 7; b.cells[10][4] = 3; } });
          for (const [row, col, c] of [[19, 0, 1], [0, 9, 7], [10, 4, 3], [5, 5, 0]]) {
            const p = picture(r, b, row, col);
            if (p !== TEXTURES[c]) return `With cells[${row}][${col}] set to ${c}, that cell shows ${colourName(p)}; it should be ${colourName(TEXTURES[c])}.`;
          }
          return true;
        }) },
    ],
    done: 'The board is numbers, and the screen shows them. Back in the lesson: a 2D array, and why the game is the numbers, not the pictures.',
  },
  {
    id: 'tetris-piece',
    title: 'Tetris 2: a piece',
    goal: 'Make a piece and show it over the board: a type, four cells, and where it is.',
    stages: [
      { f: 'spawn', text: 'Write spawn(type): set this.piece to { type, cells: PIECES[type], x: 4, y: 1 }. Call this.spawn(\'T\') at the end of ready().',
        hint: 'Import PIECES from \'./pieces.js\' too. The piece is not in this.cells: it is moving, and joins the board only when it lands.',
        check: play(async (v) => {
          const { b } = await board(v);
          if (!b.piece) return 'There is no this.piece after ready().';
          if (b.piece.type !== 'T' || b.piece.x !== 4 || b.piece.y !== 1) return `this.piece is a ${b.piece.type} at ${b.piece.x}, ${b.piece.y}: spawn('T') should put a T at 4, 1.`;
          fn(b, 'spawn').call(b, 'I');
          return (now(b).piece.type === 'I' && key(now(b).piece.cells) === key(PIECES.I)) || 'spawn(\'I\') does not make an I with PIECES.I\'s cells.';
        }) },
      { f: 'drawPiece', text: 'In draw(), after the board, draw the piece: for each [x, y] of its cells, the sprite at row piece.y + y, column piece.x + x gets TEXTURES[colourOf(piece.type)].',
        hint: 'Import colourOf. Skip a cell that is off the board (row < 0): pieces come in from above.',
        check: play(async (v) => {
          const { b, r } = await board(v, { setup: (b) => { if (b.piece) { b.piece.x = 6; b.piece.y = 5; } } });
          if (!b.piece) return 'Do step 1 first: there is no this.piece.';
          for (const [x, y] of b.piece.cells) {
            const p = picture(r, b, 5 + y, 6 + x);
            if (p !== TEXTURES[3]) return `With the T at x 6, y 5, row ${5 + y}, column ${6 + x} shows ${colourName(p)}; it should be pink, the T\'s colour.`;
          }
          return picture(r, b, 0, 0) === TEXTURES[0] || 'The rest of the board should still be black.';
        }) },
    ],
    done: 'A piece is a shape, a place and a colour. Back in the lesson: why the piece is kept apart from the board until it lands.',
  },
  {
    id: 'tetris-move',
    title: 'Tetris 3: moving, and walls',
    goal: 'Move the piece left and right with the arrow keys, never through a wall.',
    stages: [
      { f: 'canPlace', text: 'Write canPlace(cells, x, y): false if any cell, moved to x, y, is left of column 0, right of column 9, below row 19, or on a cell of this.cells that is not 0. Otherwise true.',
        hint: 'Loop over the cells; return false at the first bad one, and true after the loop. A row above the top (below 0) is allowed.',
        check: play(async (v) => {
          const { b } = await board(v);
          const can = fn(b, 'canPlace'), c: Cells = [[0, 0]];
          const cases: [Cells, number, number, boolean, string][] = [[c, 0, 0, true, 'the top-left cell'], [c, 9, 19, true, 'the bottom-right cell'], [c, -1, 5, false, 'left of the wall'], [c, 10, 5, false, 'right of the wall'], [c, 5, 20, false, 'below the floor'], [[[1, 0]], 4, 5, false, 'on a full cell (5, 5)'], [[[0, 1]], 5, 3, true, 'an empty cell (5, 4)']];
          b.cells[5][5] = 2;
          for (const [cells, x, y, want, where] of cases) if (can.call(b, cells, x, y) !== want) return `canPlace says ${!want} for ${where}; it should say ${want}.`;
          return true;
        }) },
      { f: 'move', text: 'Write move(dx, dy): if the piece\'s cells fit at x + dx, y + dy, change its x and y and return true; if not, leave it and return false.',
        check: play(async (v) => {
          const { b } = await board(v);
          const move = fn(b, 'move');
          b.piece = { type: 'O', cells: PIECES.O, x: 0, y: 5 };
          if (move.call(b, -1, 0) !== false || b.piece.x !== 0) return 'An O at the left wall should not move left: move(-1, 0) should return false and leave x at 0.';
          if (move.call(b, 1, 0) !== true || now(b).piece.x !== 1) return 'move(1, 0) should move it one column right and return true.';
          b.piece.x = 8;
          if (move.call(b, 1, 0) !== false || b.piece.x !== 8) return 'An O at x 8 fills columns 8 and 9: it should not move right.';
          return (move.call(b, 0, 1) === true && b.piece.y === 6) || 'move(0, 1) should move it one row down.';
        }) },
      { f: 'keys', text: 'In update(dt), before draw(): ← moves the piece one column left and → one column right. One press, one column: use input.isJustPressed(\'move_left\') and (\'move_right\').',
        hint: 'isPressed is true every frame the key is held, so the piece would race to the wall.',
        check: play(async (v) => {
          for (const [k, want] of [['ArrowLeft', 3], ['ArrowRight', 5]] as const) {
            const { b } = await board(v, { seconds: 0.3, keys: [k] });
            if (b.piece.x !== want) return `Holding ${k === 'ArrowLeft' ? '←' : '→'} took the piece from column 4 to ${b.piece.x}; one press should move it one column, to ${want}.`;
          }
          return true;
        }) },
    ],
    done: 'The piece moves and the walls hold. Back in the lesson: asking "would it fit?" before moving, the idea every rule in this game uses.',
  },
  {
    id: 'tetris-fall',
    title: 'Tetris 4: falling and landing',
    goal: 'Make the piece fall on a timer, land on the floor or the pile, and a new piece come.',
    stages: [
      { f: 'fall', text: 'Make it fall one row every half second: add timer = 0 and interval = 0.5 to the class; in update, add dt to this.timer, and when it reaches this.interval set it back to 0 and move(0, 1).',
        hint: 'update(dt) runs every frame; dt is the seconds since the last one. Adding them up measures time.',
        check: play(async (v) => {
          const { b } = await board(v, { seconds: 2.1 });
          return (b.piece.y >= 4 && b.piece.y <= 6) || `After 2.1 seconds the piece is at row ${b.piece.y}; falling a row every half second from row 1, it should be near row 5.`;
        }) },
      { f: 'lock', text: 'Write lock(): copy the piece\'s cells into this.cells with its colour number, then spawn(\'T\') again. Call it when move(0, 1) returns false: the piece cannot fall, so it has landed.',
        hint: 'if (!this.move(0, 1)) this.lock(); The colour number is colourOf(p.type).',
        check: play(async (v) => {
          const { b } = await board(v, { seconds: 11 });
          const n = filled(b);
          if (n !== 4) return `After 11 seconds the board has ${n} filled cells; the first T should have landed: 4 cells.`;
          if (!b.cells[19].includes(3)) return 'The landed T should be on the bottom row, row 19, in pink (3).';
          return b.piece.y < 10 || 'After it lands, a new piece should start at the top.';
        }) },
      { f: 'softDrop', text: 'Soft drop: while ↓ is held, fall every 0.05 seconds instead of every interval.',
        hint: "const wait = input.isPressed('move_down') ? 0.05 : this.interval;",
        check: play(async (v) => {
          const { b } = await board(v, { seconds: 0.6, keys: ['ArrowDown'] });
          return b.piece.y >= 8 || `Holding ↓ for 0.6 seconds took the piece only to row ${b.piece.y}.`;
        }) },
    ],
    done: 'Pieces fall, land and pile up. Back in the lesson: timers made from dt, and why the piece is copied into the board.',
  },
  {
    id: 'tetris-rotate',
    title: 'Tetris 5: turning',
    goal: 'Turn the piece a quarter turn with ↑, and let it turn against a wall.',
    stages: [
      { f: 'rotated', text: 'Write rotated(cells): a new list of cells, each [x, y] turned a quarter turn clockwise about [0, 0], which is [-y, x].',
        hint: 'return cells.map(([x, y]) => [-y, x]); (With y growing downwards, this turns clockwise on the screen.)',
        check: play(async (v) => {
          const { b } = await board(v);
          const input: Cells = [[1, 0], [0, 1], [-1, 0], [2, -1]], copy = key(input);
          const out = fn(b, 'rotated').call(b, input) as Cells;
          if (key(input) !== copy) return 'rotated() changed the cells it was given; make a new list.';
          return (Array.isArray(out) && key(out) === key(turn(input))) || `rotated([[1, 0], [0, 1], [-1, 0], [2, -1]]) gave ${JSON.stringify(out)}; it should be [[0, 1], [-1, 0], [0, -1], [1, 2]].`;
        }) },
      { f: 'rotate', text: 'Write rotate(): an O does not turn. Otherwise, if the turned cells fit, use them; if not, try the turned piece moved 1 left, 1 right, 2 left and 2 right, and use the first that fits ("wall kicks").',
        hint: 'for (const dx of [0, -1, 1, -2, 2]) if (this.canPlace(cells, p.x + dx, p.y)) { … return; }',
        check: play(async (v) => {
          const { b } = await board(v);
          const rotate = fn(b, 'rotate');
          b.piece = { type: 'T', cells: PIECES.T, x: 4, y: 5 }; rotate.call(b);
          if (key(b.piece.cells) !== key(turn(PIECES.T)) || b.piece.x !== 4) return 'A T in the open should turn a quarter turn clockwise and stay at x 4.';
          b.piece = { type: 'O', cells: PIECES.O, x: 4, y: 5 }; rotate.call(b);
          if (key(b.piece.cells) !== key(PIECES.O) || b.piece.x !== 4) return 'An O should not turn.';
          b.piece = { type: 'I', cells: turn(PIECES.I), x: 0, y: 5 }; rotate.call(b);
          const cols = b.piece.cells.map(([x]) => b.piece.x + x), rows = new Set(b.piece.cells.map(([, y]) => y));
          if (rows.size !== 1) return 'A standing I against the left wall did not turn: try it nudged right as well.';
          return cols.every((c) => c >= 0 && c < COLS) || 'After turning, the I is partly outside the wall.';
        }) },
      { f: 'rotateKey', text: 'In update, ↑ turns the piece: once per press, with input.isJustPressed(\'move_up\').',
        check: play(async (v) => {
          const { b } = await board(v, { seconds: 0.3, keys: ['ArrowUp'] });
          return key(b.piece.cells) === key(turn(PIECES.T)) || 'Holding ↑ should turn the T exactly once.';
        }) },
    ],
    done: 'Pieces turn. Back in the lesson (optional maths): why [x, y] → [−y, x] is a quarter turn, from the rotation matrix.',
  },
  {
    id: 'tetris-lines',
    title: 'Tetris 6: clearing lines',
    goal: 'When a row is full, take it out and let the rows above drop down.',
    stages: [
      { f: 'clearLines', text: 'Write clearLines(): keep only the rows that still have a 0 in them, put new rows of 10 zeros on top until there are 20 again, and return how many rows went.',
        hint: 'this.cells.filter((row) => row.includes(0)) keeps the rows that are not full. Make each new row with its own new Array(10).fill(0).',
        check: play(async (v) => {
          const { b } = await board(v);
          b.cells = empty(); b.cells[19].fill(1); b.cells[18].fill(1); b.cells[17][0] = 2; b.cells[16][9] = 3;
          const n = fn(b, 'clearLines').call(b);
          if (n !== 2) return `With rows 18 and 19 full, clearLines() returned ${n}; it should be 2.`;
          if (b.cells.length !== ROWS || b.cells.some((r) => r.length !== COLS)) return 'After clearing, the board should still be 20 rows of 10.';
          if (b.cells[19][0] !== 2 || b.cells[18][9] !== 3) return 'The rows above the full ones should drop down by 2.';
          if (b.cells.slice(0, 18).some((r) => r.some((c) => c !== 0))) return 'Rows 0 to 17 should be empty now.';
          return b.cells[0] !== b.cells[1] || 'The new top rows are all one array: changing one would change them all. Make each with new Array(10).fill(0).';
        }) },
      { f: 'clearOnLock', text: 'In lock(), after the piece joins the board, call this.clearLines().',
        check: play(async (v) => {
          const { b } = await board(v, { setup: (b) => { gapRow(b); fn(b, 'lock').call(b); } });
          return filled(b) === 0 || 'An I dropped into the gap filled the bottom row, but the row is still there.';
        }) },
    ],
    done: 'Full rows go. Back in the lesson: filtering a list, and why each new row must be its own array.',
  },
  {
    id: 'tetris-score',
    title: 'Tetris 7: score',
    goal: 'Score lines, more for several at once, and show the score and lines on the screen.',
    stages: [
      { text: 'Add a CanvasLayer named HUD, with two Labels in it, Score and Lines, to the right of the board (around x 640).',
        nodes: HUD,
        check: { kind: 'project', test: (v) => { const names = childrenOf(need(v, 'HUD', 'CanvasLayer'), 'Label').map((n) => n.name); return ['Score', 'Lines'].every((n) => names.includes(n)) || `HUD needs Labels named Score and Lines; it has ${names.join(', ') || 'none'}.`; } } },
      { f: 'score', text: 'Add score = 0 and lines = 0 to the class. In lock(), add what clearLines() returned to this.lines, and add to this.score: 100 for 1 line, 300 for 2, 500 for 3 and 800 for 4.',
        hint: 'this.score += [0, 100, 300, 500, 800][cleared];',
        check: play(async (v) => {
          const { b } = await board(v);
          if (b.score !== 0 || b.lines !== 0) return 'this.score and this.lines should start at 0.';
          gapRow(b); fn(b, 'lock').call(b);
          if (now(b).score !== 100 || now(b).lines !== 1) return `After 1 line, score is ${b.score} and lines ${b.lines}; they should be 100 and 1.`;
          b.cells = empty(); for (const r of [16, 17, 18, 19]) b.cells[r] = [0, 1, 1, 1, 1, 1, 1, 1, 1, 1];
          b.piece = { type: 'I', cells: turn(PIECES.I), x: 0, y: 17 }; fn(b, 'lock').call(b);
          return (now(b).score === 900 && now(b).lines === 5) || `After 4 lines at once more, score is ${b.score} and lines ${b.lines}; they should be 900 and 5.`;
        }) },
      { f: 'showScore', text: 'In draw(), show them: scene.get(\'HUD/Score\').text = `Score ${this.score}`, and the same for Lines.',
        check: play(async (v) => {
          const { r } = await board(v, { setup: (b) => { b.score = 1234; b.lines = 7; } });
          const text = (p: string) => String((r.node(p) as unknown as { text?: string } | null)?.text ?? '');
          return (text('HUD/Score').includes('1234') && text('HUD/Lines').includes('7')) || `With score 1234 and 7 lines, the labels say "${text('HUD/Score')}" and "${text('HUD/Lines')}".`;
        }) },
    ],
    done: 'The game keeps score. Back in the lesson: a table in an array, and why four lines are worth more than four singles.',
  },
  {
    id: 'tetris-bag',
    title: 'Tetris 8: every piece, and the end',
    goal: 'Deal the pieces fairly from a shuffled bag of seven, and end the game when the well is full.',
    stages: [
      { f: 'bag', text: 'Add bag = [] to the class and write takeFromBag(): when this.bag is empty, fill it with all seven TYPES and shuffle it; then take one off with pop(). spawn(type) with no type takes one from the bag: spawn(type = this.takeFromBag()). Call this.spawn() in ready() and lock().',
        hint: 'Fisher–Yates: for i from 6 down to 1, pick j = Math.floor(Math.random() * (i + 1)) and swap places i and j.',
        check: play(async (v) => {
          const { b } = await board(v);
          const take = fn(b, 'takeFromBag');
          if (!(TYPES as readonly string[]).includes(b.piece.type)) return 'spawn() with no type should take one from the bag.';
          b.bag = [];
          const rounds: string[] = [];
          for (let i = 0; i < 5; i++) {
            const got = Array.from({ length: 7 }, () => take.call(b) as string);
            if ([...got].sort().join('') !== [...TYPES].sort().join('')) return `Seven pieces from a fresh bag were ${got.join(' ')}; they should be all seven, once each.`;
            rounds.push(got.join(''));
          }
          return new Set(rounds).size > 1 || 'Every bag came out in the same order: shuffle it.';
        }) },
      { text: 'Add a Label named Message to HUD, under the others, with no text.',
        nodes: label('Message', 140, ''),
        check: { kind: 'project', test: (v) => childrenOf(v.byName('HUD'), 'Label').some((n) => n.name === 'Message') || 'HUD has no Label called Message.' } },
      { f: 'gameOver', text: 'Game over: add over = false. In spawn(), if the new piece does not fit, set this.over = true and the Message label\'s text to Game over. At the top of update, return straight away when this.over.',
        check: play(async (v) => {
          const { b, r } = await board(v, { seconds: 1.5, setup: (b) => { b.cells = empty().map((row) => row.map((_, c) => (c === 0 ? 0 : 1))); } });
          if (b.over !== true) return 'With the well full to the top, the next piece cannot fit, but this.over is not true.';
          const msg = String((r.node('HUD/Message') as unknown as { text?: string } | null)?.text ?? '');
          if (!/game over/i.test(msg)) return `The Message label says "${msg}"; it should say Game over.`;
          const before = JSON.stringify([b.cells, b.piece]);
          (fn(b, 'update')).call(b, 1); (fn(b, 'update')).call(b, 1);
          return JSON.stringify([b.cells, b.piece]) === before || 'After game over, nothing should move.';
        }) },
    ],
    done: 'A whole game: it starts, it is fair, it ends. Back in the lesson (optional maths): why Fisher–Yates gives every order the same chance.',
  },
  {
    id: 'tetris-finish',
    title: 'Tetris 9: hard drop, levels and next',
    goal: 'Finish it: Space drops a piece, the game speeds up every 10 lines, and the Next label shows what is coming.',
    stages: [
      { f: 'hardDrop', text: 'Write hardDrop(): move(0, 1) until it returns false, then lock(). Space calls it: input.isJustPressed(\'jump\').',
        hint: 'while (this.move(0, 1)) {}',
        check: play(async (v) => {
          const { b } = await board(v, { seconds: 0.3, keys: ['Space'] });
          const rows = b.cells.flatMap((r, i) => (r.some((c) => c !== 0) ? [i] : []));
          if (filled(b) !== 4) return `After Space, the board has ${filled(b)} filled cells; one piece should have dropped: 4.`;
          return Math.min(...rows) >= 17 || 'The dropped piece should be at the bottom.';
        }) },
      { f: 'levels', text: 'Levels: replace interval = 0.5 with get level() { return 1 + Math.floor(this.lines / 10); } and get interval() { return 0.5 * Math.pow(0.85, this.level - 1); }. Multiply the score for lines by this.level, and show the level with the lines.',
        hint: 'A getter is worked out each time it is read, so the interval changes by itself as lines go up.',
        check: play(async (v) => {
          const fall = async (lines: number) => (await board(v, { seconds: 3, setup: (b) => { b.lines = lines; b.piece = { type: 'T', cells: PIECES.T, x: 4, y: 1 }; } })).b;
          const slow = await fall(0), fast = await fall(25);
          if (slow.level !== 1 || fast.level !== 3) return `With 0 lines the level is ${slow.level}, and with 25 it is ${fast.level}: they should be 1 and 3.`;
          if (!(fast.piece.y > slow.piece.y)) return `In 3 seconds the piece fell to row ${slow.piece.y} on level 1 and row ${fast.piece.y} on level 3: higher levels should fall faster.`;
          const { b } = await board(v);
          b.lines = 25; b.score = 0; gapRow(b); fn(b, 'lock').call(b);
          return b.score === 300 || `One line on level 3 scored ${b.score}; it should be 100 × 3 = 300.`;
        }) },
      { f: 'next', text: 'Next: add a Label named Next to HUD. In ready(), set this.next = this.takeFromBag() before spawning. In spawn() with no type, use this.next and take a new this.next from the bag. Show it: `Next ${this.next}`.',
        nodes: label('Next', 92, 'Next'),
        check: play(async (v) => {
          let was = '', got = '';
          const { b, r } = await board(v, { setup: (b) => { was = b.next; fn(b, 'spawn').call(b); got = b.piece.type; } });
          if (!(TYPES as readonly string[]).includes(was)) return 'this.next should be a piece type, taken from the bag in ready().';
          if (got !== was) return `this.next was ${was}, but the next piece spawned was ${got}.`;
          const text = String((r.node('HUD/Next') as unknown as { text?: string } | null)?.text ?? '');
          return text.includes(b.next) || `The Next label says "${text}"; this.next is ${b.next}.`;
        }) },
    ],
    done: 'You made Tetris: every rule, every number, every picture. Back in the lesson: what a whole game is made of, and what to make next.',
  },
];

// ── the tasks ─────────────────────────────────────────────────────────────

/** The scene code for each step of a part: what that step adds (nodes), and board.js as it is after it. */
function stepCode(part: Part, upTo: number): string {
  const s = part.stages.slice(0, upTo + 1);
  const f = [...s].reverse().find((x) => x.f)?.f;
  return [...s.map((x) => x.nodes).filter(Boolean), f ? writeBoard(f) : ''].filter(Boolean).join('\n');
}
const solutionOf = (part: Part) => stepCode(part, part.stages.length - 1);

export const TETRIS: GameTask[] = PARTS.map((part, i) => ({
  id: part.id,
  chain: 'Tetris',
  title: part.title,
  goal: part.goal,
  images: TEXTURES,
  start: [BASE, ...PARTS.slice(0, i).map(solutionOf)].join('\n'),
  steps: part.stages.map(({ text, hint, check }) => ({ text, hint, check })),
  solution: solutionOf(part),
  done: part.done,
}));

/**
 * board.js as it is once each step of a task is done (null where a step does not change it): the
 * pictures script types these in, and the tests check each passes its step.
 */
export function tetrisStepScripts(taskId: string): (string | null)[] {
  const part = PARTS.find((p) => p.id === taskId);
  if (!part) throw new Error(`No Tetris task "${taskId}"`);
  return part.stages.map((s) => (s.f ? boardJs(s.f) : null));
}

/** The scene code that does a task's steps up to this one (for the tests). */
export function tetrisStepCode(taskId: string, step: number): string {
  return stepCode(PARTS.find((p) => p.id === taskId)!, step);
}
