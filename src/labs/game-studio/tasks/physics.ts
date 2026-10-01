// Chapter 2 of the course, "Physics": bodies and shapes, gravity and jumping, areas, rigid
// bodies and bounce, collision layers (docs/game-studio-course-plan.md).

import type { GameTask } from './types';
import { childrenOf, named, need, noErrors, type Body, type Pos } from './helpers';

export const CHAR = 'assets/pixel-platformer/characters/tile_0000.png';   // 24 × 24
export const GROUND = 'assets/pixel-platformer/tiles/tile_0002.png';      // 18 × 18
const COIN = 'assets/pixel-platformer/tiles/tile_0151.png';
const BALL = 'assets/puzzle-pack/balls/ballblue_01.png';           // 128 × 128

const main = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')`;

/** What New script writes for a CharacterBody2D (editor/store.ts, scriptTemplate). */
const TOPDOWN = `export default class Player extends CharacterBody2D {
  speed = 200;

  physicsUpdate(dt) {
    // A direction from four input actions (Project › Input map), length at most 1.
    const direction = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    this.velocity = direction.scale(this.speed);
    this.moveAndSlide();
  }
}
`;

export const PLATFORMER = `export default class Player extends CharacterBody2D {
  speed = 200;
  jumpSpeed = 360;

  physicsUpdate(dt) {
    const v = this.velocity;
    v.x = input.axis('move_left', 'move_right') * this.speed;   // left and right only
    v.y += physics.gravity * dt;                                // gravity: faster and faster downward
    if (input.isJustPressed('jump') && this.isOnFloor()) v.y = -this.jumpSpeed;
    this.velocity = v;
    this.moveAndSlide();
  }
}
`;

const COLLECTOR = PLATFORMER.replace(`  jumpSpeed = 360;
`, `  jumpSpeed = 360;
  coins = 0;
`).replace(/\n}\n$/, `

  // A coin calls this when the player touches it.
  collect() {
    this.coins += 1;
    scene.get('Score').text = 'Coins: ' + this.coins;
  }
}
`);

const COIN_SCRIPT = `export default class Coin extends Area2D {
  bodyEntered(body) {
    if (body.name !== 'Player') return;
    body.collect();
    this.queueFree();
  }
}
`;

/** A player body with its picture and shape, and a script. */
export const player = (x: number, y: number, script: string) => `scene.add('CharacterBody2D', { name: 'Player', position: { x: ${x}, y: ${y} } })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Player', texture: '${CHAR}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Player', size: { x: 16, y: 22 } })
project.writeScript('scripts/player.js', ${JSON.stringify(script)})
scene.get('Player').script = 'scripts/player.js'`;

/** A solid block: a StaticBody2D with a shape and a stretched ground picture. */
export const block = (name: string, x: number, y: number, w: number, h: number) => `scene.add('StaticBody2D', { name: '${name}', position: { x: ${x}, y: ${y} } })
scene.add('Sprite2D', { name: 'Sprite', parent: '${name}', texture: '${GROUND}', scale: { x: ${w / 18}, y: ${h / 18} } })
scene.add('CollisionShape2D', { name: 'Shape', parent: '${name}', size: { x: ${w}, y: ${h} } })`;

// The floor's top is at y 400; Player's shape is 22 tall, so standing it is at 400 − 11 = 389.
const FLOOR_TOP = 400;
export const REST = 389;
const platformLevel = `${main}\n${block('Floor', 480, 420, 900, 40)}`;

export const PHYSICS: GameTask[] = [
  {
    id: 'stop-at-walls',
    chain: 'Physics',
    title: 'A player who cannot walk through walls',
    goal: 'Make a body you move with the keys, and a wall that stops it.',
    images: [CHAR, GROUND],
    start: main,
    steps: [
      { text: 'Add a CharacterBody2D, name it Player, and put it on the left of the game area: position 300, 270. A CharacterBody2D is a body your script moves.', hint: 'New nodes start at 0, 0, the top-left corner.',
        check: { kind: 'project', test: (v) => { const p = need(v, 'Player', 'CharacterBody2D'); const at = v.prop(p, 'position') as Pos; return (at.x > 40 && at.y > 40) || 'Player is still at the top-left corner: put it at 300, 270.'; } } },
      { text: 'Under Player, add a Sprite2D showing the green astronaut, and a CollisionShape2D. The picture is what you see; the shape is what bumps into things.', hint: 'Select Player first, then + Add… adds under it.',
        check: { kind: 'project', test: (v) => { const p = need(v, 'Player', 'CharacterBody2D'); if (!childrenOf(p, 'Sprite2D').some((s) => v.prop(s, 'texture') === CHAR)) return 'Player has no Sprite2D showing the astronaut under it.'; return childrenOf(p, 'CollisionShape2D').length > 0 || 'Player has no CollisionShape2D under it.'; } } },
      { text: 'Give Player a new script. For a CharacterBody2D it starts as arrow-key movement with moveAndSlide(). Run it and walk around.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1, keys: ['ArrowRight'] }); noErrors(r); const p = named<Body>(r.game, 'Player'); const start = v.prop(v.byName('Player')!, 'position') as Pos; return (p && p.position.x - start.x > 50) || 'Holding → for 1 second does not move Player right yet.'; } } },
      { text: 'Add a wall to the right of Player: a StaticBody2D named Wall, with a CollisionShape2D under it (make it tall: size y 200). Walking right, Player should stop at it.', hint: 'A StaticBody2D never moves, and bodies stop against its shapes. The wall needs its own shape; a picture alone stops nothing.',
        check: { kind: 'play', test: async (v) => {
          const w = need(v, 'Wall', 'StaticBody2D');
          if (!childrenOf(w, 'CollisionShape2D').length) return 'Wall has no CollisionShape2D under it.';
          const wp = v.prop(w, 'position') as Pos, pp = v.prop(v.byName('Player')!, 'position') as Pos;
          const wx = wp.x, px = pp.x, half = ((v.prop(childrenOf(w, 'CollisionShape2D')[0], 'size') as Pos).y * Math.abs((v.prop(w, 'scale') as Pos).y)) / 2;
          if (wx < px + 30) return 'Put the wall to the right of Player, with a gap.';
          if (Math.abs(wp.y - pp.y) > half + 11) return `The wall is not in Player\u2019s way: Player is at y ${Math.round(pp.y)}, and the wall covers y ${Math.round(wp.y - half)} to ${Math.round(wp.y + half)}.`;
          const r = await v.play({ seconds: 5, keys: ['ArrowRight'] }); noErrors(r);
          const p = named<Body>(r.game, 'Player')!;
          return (p.position.x < wx && p.isOnWall()) || `After 5 seconds of →, Player is at x ${Math.round(p.position.x)}: it went through the wall at ${Math.round(wx)}.`;
        } } },
    ],
    solution: `${player(300, 270, TOPDOWN)}\n${block('Wall', 600, 270, 32, 200)}`,
    done: 'Player stops at the wall, and slides along it if you hold ↑ too. Back in the lesson: how moveAndSlide finds the shortest way out of a wall.',
  },
  {
    id: 'gravity-and-jumping',
    chain: 'Physics',
    title: 'Gravity and jumping',
    goal: 'Turn the top-down player into a platformer: it falls, walks left and right, and jumps.',
    images: [CHAR, GROUND],
    start: `${platformLevel}\n${player(300, 200, TOPDOWN)}`,
    steps: [
      { text: 'Add gravity: every physics step, add physics.gravity × dt to velocity.y, so Player falls and lands on the floor.', hint: 'Keep the velocity from step to step: const v = this.velocity; … v.y += physics.gravity * dt; … this.velocity = v.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 2 }); noErrors(r); const p = named<Body>(r.game, 'Player')!; return (Math.abs(p.position.y - REST) < 1 && p.isOnFloor()) || `After 2 seconds Player is at y ${Math.round(p.position.y)}; standing on the floor it would be at ${REST}.`; } } },
      { text: 'Left and right only: ↑ and ↓ should no longer move Player. Use input.axis(\'move_left\', \'move_right\') for the x speed.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1.5, keys: ['ArrowUp'] }); noErrors(r); const p = named<Body>(r.game, 'Player')!; return Math.abs(p.position.y - REST) < 1 || 'Holding ↑ still moves Player up.'; } } },
      { text: 'Jump: when Space is pressed and Player is on the floor, set velocity.y to −360 (up is negative y).', hint: 'input.isJustPressed(\'jump\') is true once per press; isOnFloor() is true when the last moveAndSlide() stopped it on something below.',
        check: { kind: 'play', test: async (v) => {
          let top = Infinity;
          // Stand on the floor for half a second, then hold Space.
          const r = await v.play({ seconds: 3, keys: ['Space'], keysAt: 0.5, setup: (g) => { const p = named<Body>(g, 'Player')!; p.position = { x: p.position.x, y: REST }; }, watch: (g) => { top = Math.min(top, named<Body>(g, 'Player')!.position.y); } });
          noErrors(r);
          const rise = REST - top, p = named<Body>(r.game, 'Player')!;
          if (rise < 40) return `Pressing Space, Player rose ${Math.round(rise)} px: make it jump higher (at least 40).`;
          return Math.abs(p.position.y - REST) < 1 || 'Holding Space, Player keeps jumping: jump once per press (isJustPressed), and only from the floor.';
        } } },
      { text: 'Only from the floor: pressing Space in mid-air does nothing.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.2, keys: ['Space'], setup: (g) => { const p = named<Body>(g, 'Player')!; p.position = { x: p.position.x, y: 150 }; p.velocity = { x: 0, y: 0 }; } }); noErrors(r); const p = named<Body>(r.game, 'Player')!; return p.velocity.y > 0 || 'Player jumped in mid-air: check isOnFloor() before jumping.'; } } },
    ],
    solution: `project.writeScript('scripts/player.js', ${JSON.stringify(PLATFORMER)})`,
    done: 'Player falls, walks and jumps. Back in the lesson: why the jump is v² / 2g high, and why physics steps at a fixed 1/60 s.',
  },
  {
    id: 'collect-coins',
    chain: 'Physics',
    title: 'Coins to collect',
    goal: 'An Area2D notices the player without stopping it: make a coin that disappears and counts.',
    images: [CHAR, GROUND, COIN],
    start: `${platformLevel}\n${player(300, REST, PLATFORMER)}\nscene.add('Label', { name: 'Score', position: { x: 16, y: 12 }, fontSize: 24, text: 'Coins: 0' })`,
    steps: [
      { text: 'Add a coin: an Area2D named Coin, with a Sprite2D (pixel-platformer/tiles/tile_0151.png) and a CollisionShape2D under it. Put it on the floor, to the right of Player.',
        check: { kind: 'project', test: (v) => { const c = need(v, 'Coin', 'Area2D'); return childrenOf(c, 'CollisionShape2D').length > 0 || 'Coin has no CollisionShape2D under it: an area notices bodies only with a shape.'; } } },
      { text: 'Give Coin a script: in bodyEntered(body), remove the coin with this.queueFree(). Walk into it.', hint: 'bodyEntered runs when a body comes into the area’s shape.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.3, setup: (g) => { const c = named<Body>(g, 'Coin'), p = named<Body>(g, 'Player'); if (c && p) p.position = (c as unknown as { globalPosition: Pos }).globalPosition; } }); noErrors(r); return !named(r.game, 'Coin') || 'Touching the coin does not remove it yet.'; } } },
      { text: 'Count it: before it goes, the coin calls body.collect(), and Player’s collect() adds 1 and shows "Coins: 1" in the Score label.', hint: 'In player.js add collect() { this.coins += 1; scene.get(\'Score\').text = \'Coins: \' + this.coins; } and a field coins = 0.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 0.3, setup: (g) => { const c = named<Body>(g, 'Coin'), p = named<Body>(g, 'Player'); if (c && p) p.position = (c as unknown as { globalPosition: Pos }).globalPosition; } }); noErrors(r); const label = named<{ text: string }>(r.game, 'Score'); return (label && /\b1\b/.test(String(label.text))) || `After touching the coin the Score says "${label?.text}".`; } } },
    ],
    solution: `project.writeScript('scripts/player.js', ${JSON.stringify(COLLECTOR)})
scene.add('Area2D', { name: 'Coin', position: { x: 450, y: ${REST} } })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Coin', texture: '${COIN}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Coin', shape: 'circle', size: { x: 14, y: 14 } })
project.writeScript('scripts/coin.js', ${JSON.stringify(COIN_SCRIPT)})
scene.get('Coin').script = 'scripts/coin.js'`,
    done: 'A coin that counts. Back in the lesson: how an area finds the bodies inside it.',
  },
  {
    id: 'bouncing-ball',
    chain: 'Physics',
    title: 'A bouncing ball',
    goal: 'A RigidBody2D moves by itself: gravity pulls it, and it bounces.',
    images: [GROUND, BALL],
    start: platformLevel,
    steps: [
      { text: 'Add a RigidBody2D named Ball above the floor, with a round CollisionShape2D (shape: circle, size 26) and a Sprite2D of puzzle-pack/balls/ballblue_01.png at scale 0.2. Run it: it falls by itself.', hint: 'No script: physics moves a RigidBody2D.',
        check: { kind: 'play', test: async (v) => { need(v, 'Ball', 'RigidBody2D'); const start = v.prop(v.byName('Ball')!, 'position') as Pos; const r = await v.play({ seconds: 0.5 }); noErrors(r); const b = named<Body>(r.game, 'Ball')!; return b.position.y - start.y > 50 || 'Ball does not fall: is it a RigidBody2D, with gravityScale above 0?'; } } },
      { text: 'Give Ball a shape that lands on the floor: it should stop on it, not fall through.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 4 }); noErrors(r); const b = named<Body>(r.game, 'Ball')!; return b.position.y < FLOOR_TOP || 'Ball fell through the floor: it needs a CollisionShape2D under it.'; } } },
      { text: 'Make it bounce: set Ball’s bounce to 0.8 in the Inspector. 1 bounces back as fast as it hit; 0 stops dead.',
        check: { kind: 'play', test: async (v) => { let up = 0; const r = await v.play({ seconds: 3, watch: (g) => { up = Math.min(up, named<Body>(g, 'Ball')!.velocity.y); } }); noErrors(r); return up < -150 || 'Ball does not bounce up off the floor yet.'; } } },
    ],
    solution: `scene.add('RigidBody2D', { name: 'Ball', position: { x: 480, y: 120 }, bounce: 0.8 })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Ball', texture: '${BALL}', scale: { x: 0.2, y: 0.2 } })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Ball', shape: 'circle', size: { x: 26, y: 26 } })`,
    done: 'A ball that bounces. Back in the lesson: reflecting a velocity off a surface, and what bounce multiplies.',
  },
  {
    id: 'collision-layers',
    chain: 'Physics',
    title: 'Collision layers',
    goal: 'Make the ball fall through a glass shelf but land on the floor, using layers and masks.',
    images: [GROUND, BALL],
    start: `${platformLevel}
${block('Glass', 480, 250, 300, 16)}
scene.add('RigidBody2D', { name: 'Ball', position: { x: 480, y: 120 } })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Ball', texture: '${BALL}', scale: { x: 0.2, y: 0.2 } })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Ball', shape: 'circle', size: { x: 26, y: 26 } })`,
    steps: [
      { text: 'Run it: the ball lands on the Glass shelf. Now put Glass on collision layer 2 only (Inspector › collisionLayer: turn 1 off, 2 on). The ball’s mask is layer 1, so it falls through to the floor.', hint: 'A body stops at another only if its mask includes a layer the other is on.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 3 }); noErrors(r); const b = named<Body>(r.game, 'Ball')!; return b.position.y > 300 || 'The ball still lands on the glass.'; } } },
      { text: 'Add a second ball, Ball2, that does land on the glass: duplicate Ball (Ctrl+D) and turn on layer 2 in its collisionMask.',
        check: { kind: 'play', test: async (v) => { need(v, 'Ball2', 'RigidBody2D'); const r = await v.play({ seconds: 3 }); noErrors(r); const b1 = named<Body>(r.game, 'Ball')!, b2 = named<Body>(r.game, 'Ball2')!; if (b1.position.y < 300) return 'Ball should still fall through the glass.'; return b2.position.y < 250 || 'Ball2 falls through the glass: its mask needs layer 2.'; } } },
    ],
    solution: `scene.get('Glass').collisionLayer = 2
scene.get('Ball').duplicate()
scene.get('Ball2').collisionMask = 3`,
    done: 'Same shelf, two balls, different rules. Back in the lesson: layers as bits, and why 1 + 2 = 3.',
  },
];
