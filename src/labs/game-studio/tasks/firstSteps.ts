// Chapter 1 of the course, "First steps": the tasks for lessons 1.1 to 1.4
// (docs/game-studio-course-plan.md). Each starts from the previous one's solution.

import type { GameTask } from './types';
import type { Vec2 } from '../core/types';

const HERO = 'assets/pixel-platformer/characters/tile_0000.png';
const MIDDLE = { x: 480, y: 270 };
const scene = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')`;
const placed = `${scene}\nscene.add('Sprite2D', { name: 'Hero', texture: '${HERO}', position: { x: 480, y: 270 } })`;

const MOVING = `export default class Hero extends Sprite2D {
  speed = 100;   // pixels per second

  update(dt) {
    // speed × dt is how far to go this frame: 100 px/s for 1/60 s is 1.67 px.
    this.position = { x: this.position.x + this.speed * dt, y: this.position.y };
  }
}
`;

const STEERED = `export default class Hero extends Sprite2D {
  speed = 100;   // pixels per second

  update(dt) {
    // A direction from four input actions: length 1, or 0 with no key held.
    const direction = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    this.position = this.position.add(direction.scale(this.speed * dt));
  }
}
`;
const withScript = (source: string) => `${placed}\nproject.writeScript('scripts/hero.js', ${JSON.stringify(source)})\nscene.get('Hero').script = 'scripts/hero.js'`;

/** How far Hero went in a run, from where it started. */
const moved = (start: Vec2, end: { x: number; y: number }) => ({ dx: end.x - start.x, dy: end.y - start.y, d: Math.hypot(end.x - start.x, end.y - start.y) });

export const FIRST_STEPS: GameTask[] = [
  {
    id: 'first-sprite',
    chain: 'First steps',
    title: 'Put a character on the screen',
    goal: 'Add a picture to the scene, name it, and place it in the middle of the game area.',
    images: [HERO],
    start: scene,
    steps: [
      { text: 'Add a Sprite2D: + Add… at the top of the scene tree, then Sprite2D.', hint: 'The + Add… list adds a node under the one selected.',
        check: { kind: 'project', test: (v) => v.nodes.some((n) => n.type === 'Sprite2D') || 'There is no Sprite2D in the scene yet.' } },
      { text: 'Give it a picture: in the Inspector, set texture to pixel-platformer/characters/tile_0000.png (the green astronaut).', hint: 'Select the Sprite2D first; texture is in the Sprite section.',
        check: { kind: 'project', test: (v) => v.nodes.some((n) => n.type === 'Sprite2D' && v.prop(n, 'texture') === HERO) || 'No Sprite2D shows the green astronaut yet.' } },
      { text: 'Name it Hero: double-click it in the scene tree and type the name.',
        check: { kind: 'project', test: (v) => v.byName('Hero')?.type === 'Sprite2D' || 'There is no Sprite2D called Hero yet (names are case-sensitive).' } },
      { text: 'Move Hero to the middle of the game area, 480 across and 270 down: drag it, or type the position in the Inspector.', hint: 'The blue rectangle in the viewport is the game area: 960 × 540 pixels, with (0, 0) at its top-left.',
        check: { kind: 'project', test: (v) => { const h = v.byName('Hero'); if (!h) return 'Name the sprite Hero first.'; const p = v.prop(h, 'position') as Vec2; return Math.hypot(p.x - MIDDLE.x, p.y - MIDDLE.y) <= 24 || `Hero is at ${Math.round(p.x)}, ${Math.round(p.y)}: get it within 24 pixels of 480, 270.`; } } },
    ],
    solution: `scene.add('Sprite2D', { name: 'Hero', texture: '${HERO}', position: { x: 480, y: 270 } })`,
    done: 'Hero is on the screen. Back in the lesson: what a node is, and where (0, 0) is.',
  },
  {
    id: 'run-and-stop',
    chain: 'First steps',
    title: 'Run your game',
    goal: 'Change the game’s background, then run it and stop it.',
    images: [HERO],
    start: placed,
    steps: [
      { text: 'Open Project › Project settings… and choose a new background colour.',
        check: { kind: 'project', test: (v) => v.project.settings.background.toLowerCase() !== '#1d2330' || 'The background is still the starting colour, #1d2330.' } },
      { text: 'Press ▶ Run (or F5) to play the game, look at it, then press ■ Stop (or F8).',
        check: { kind: 'editor', test: (v) => v.ran || 'Run the game once.' } },
    ],
    solution: `project.setSettings({ background: '#2a6f97' })`,
    done: 'You ran your game. Back in the lesson: what Run does, and why changes made while it runs are not kept.',
  },
  {
    id: 'first-script',
    chain: 'First steps',
    title: 'Make Hero move',
    goal: 'Write a script that moves Hero to the right at 100 pixels a second, on any screen.',
    images: [HERO],
    start: placed,
    steps: [
      { text: 'Select Hero and press New script in the Inspector. The script opens: it is a class that extends Sprite2D, with ready() and update(dt).',
        check: { kind: 'project', test: (v) => !!v.byName('Hero')?.script || 'Hero has no script yet.' } },
      { text: 'In update(dt), move Hero right a little every frame: set this.position to a point with a bigger x. (It is checked as you type.)', hint: 'this.position = { x: this.position.x + 2, y: this.position.y } moves 2 pixels a frame.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1 }); const h = r.node('Hero') as unknown as { position: Vec2 } | null; if (r.errors.length) return r.errors[0]; if (!h) return 'There is no Hero in the running game.'; const m = moved(MIDDLE, h.position); return (m.dx > 20 && Math.abs(m.dy) < 1) || `In 1 second Hero moved ${Math.round(m.dx)} px right and ${Math.round(m.dy)} px down: make it go right.`; } } },
      { text: 'Make it exactly 100 pixels a second, whatever the frame rate: multiply the speed by dt, the seconds since the last frame.', hint: 'A fast screen calls update() more often, with a smaller dt; speed × dt is the same distance a second either way.',
        check: { kind: 'play', test: async (v) => {
          const dist = async (fps: number) => { const r = await v.play({ seconds: 1, fps }); if (r.errors.length) throw new Error(r.errors[0]); return moved(MIDDLE, (r.node('Hero') as unknown as { position: Vec2 }).position).dx; };
          const slow = await dist(30), fast = await dist(144);
          return (Math.abs(slow - 100) <= 2 && Math.abs(fast - 100) <= 2) || `In 1 second Hero moved ${Math.round(slow)} px at 30 frames a second and ${Math.round(fast)} px at 144: both should be 100.`;
        } } },
    ],
    solution: `project.writeScript('scripts/hero.js', ${JSON.stringify(MOVING)})\nscene.get('Hero').script = 'scripts/hero.js'`,
    done: 'Hero moves at 100 px/s on any screen. Back in the lesson: why speed × dt works.',
  },
  {
    id: 'input-actions',
    chain: 'First steps',
    title: 'Steer Hero with the keyboard',
    goal: 'Move Hero with the arrow keys or WASD, at the same speed in every direction.',
    images: [HERO],
    start: withScript(MOVING),
    steps: [
      { text: 'Make Hero stand still when no key is held: it should only move when the player asks.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1 }); if (r.errors.length) return r.errors[0]; const m = moved(MIDDLE, (r.node('Hero') as unknown as { position: Vec2 }).position); return m.d < 1 || `With no key held, Hero moved ${Math.round(m.d)} px.`; } } },
      { text: 'Move with the arrow keys or WASD, using the input actions: input.vector(\'move_left\', \'move_right\', \'move_up\', \'move_down\') gives a direction.', hint: 'Add direction.scale(this.speed * dt) to this.position.',
        check: { kind: 'play', test: async (v) => {
          for (const [key, sx, sy] of [['ArrowRight', 1, 0], ['ArrowLeft', -1, 0], ['ArrowUp', 0, -1], ['ArrowDown', 0, 1]] as const) {
            const r = await v.play({ seconds: 1, keys: [key] });
            if (r.errors.length) return r.errors[0];
            const m = moved(MIDDLE, (r.node('Hero') as unknown as { position: Vec2 }).position);
            if (!(m.dx * sx + m.dy * sy > 50)) return `Holding ${key} for 1 second moved Hero ${Math.round(m.dx)} px across and ${Math.round(m.dy)} px down.`;
          }
          return true;
        } } },
      { text: 'Diagonals no faster: holding → and ↓ together should go 100 px a second too, not 141.', hint: 'input.vector already gives a direction of length 1; if you added two directions yourself, normalize the sum.',
        check: { kind: 'play', test: async (v) => {
          const r = await v.play({ seconds: 1, keys: ['ArrowRight', 'ArrowDown'] });
          if (r.errors.length) return r.errors[0];
          const m = moved(MIDDLE, (r.node('Hero') as unknown as { position: Vec2 }).position);
          return Math.abs(m.d - 100) <= 3 || `Going diagonally, Hero went ${Math.round(m.d)} px in 1 second; it should be 100.`;
        } } },
    ],
    solution: `project.writeScript('scripts/hero.js', ${JSON.stringify(STEERED)})`,
    done: 'Hero goes where the player says. Back in the lesson: input actions, and why a direction is normalized.',
  },
];
