// Chapters 4 and 5 of the course: "Animation" (sprite frames, keyframes, animation from scripts)
// and "Tilemaps" (tilesets, layers, solid tiles, maps from Tiled). See docs/game-studio-course-plan.md.

import type { GameTask } from './types';
import { CHAR, GROUND, PLATFORMER, REST, block, player } from './physics';
import { childrenOf, named, need, noErrors, type Body, type Pos } from './helpers';
import type { AnimationClip, SpriteAnimation, TilesetData } from '../core/types';
import { AnimatedSprite2D } from '../engine/nodes';

const WALK2 = 'assets/pixel-platformer/characters/tile_0001.png';
const SHEET = 'assets/tiny-dungeon/tilemap/tilemap_packed.png';      // 12 × 11 tiles of 16 px
const KNIGHT = 'assets/tiny-dungeon/tiles/tile_0085.png';
const WALL = 40, FLOOR = 48;
const main = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')`;
const platformLevel = `${main}\n${block('Floor', 480, 420, 900, 40)}`;

const ANIMATED_PLAYER = PLATFORMER.replace(/\n}\n$/, `

  update(dt) {
    // Walk while moving, idle while still. play() carries on with an animation already playing.
    this.get('Sprite').play(this.velocity.x !== 0 ? 'walk' : 'idle');
  }
}
`);
const animatedSprite = `scene.get('Player/Sprite').delete()
scene.add('AnimatedSprite2D', { name: 'Sprite', parent: 'Player', animation: 'idle', frames: [
  { name: 'idle', fps: 1, loop: true, frames: ['${CHAR}'] },
  { name: 'walk', fps: 8, loop: true, frames: ['${CHAR}', '${WALK2}'] },
] })`;

const door = `${block('Door', 640, 340, 24, 120)}`;
const OPEN: AnimationClip = { name: 'open', length: 1, loop: false, tracks: [{ path: 'Door', property: 'position', keys: [{ time: 0, value: { x: 640, y: 340 } }, { time: 1, value: { x: 640, y: 220 } }] }] };
const SWITCH = `export default class Switch extends Area2D {
  bodyEntered(body) {
    if (body.name === 'Player') scene.get('DoorAnimation').play('open');
  }
}
`;

/** How far up a node went in a run. */
const rose = (start: Pos, now: Pos) => start.y - now.y;

const TOPDOWN_KNIGHT = `export default class Player extends CharacterBody2D {
  speed = 120;

  physicsUpdate(dt) {
    this.velocity = input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed);
    this.moveAndSlide();
  }
}
`;
const tileset = `project.createTileset('tilesets/dungeon.tileset', { image: '${SHEET}', tileWidth: 16, tileHeight: 16 })`;
const floorLayer = `scene.add('TileMapLayer', { name: 'Floor', tileset: 'tilesets/dungeon.tileset' }).fill(0, 0, 20, 12, ${FLOOR})`;
const knight = `scene.add('CharacterBody2D', { name: 'Player', position: { x: 160, y: 96 } })
scene.add('Sprite2D', { name: 'Sprite', parent: 'Player', texture: '${KNIGHT}' })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Player', size: { x: 12, y: 12 } })
project.writeScript('scripts/player.js', ${JSON.stringify(TOPDOWN_KNIGHT)})
scene.get('Player').script = 'scripts/player.js'
scene.add('Camera2D', { name: 'Camera', parent: 'Player', zoom: 3 })`;

export const ANIMATION: GameTask[] = [
  {
    id: 'walk-animation',
    chain: 'Animation',
    title: 'A walking character',
    goal: 'Replace Player’s still picture with an AnimatedSprite2D that walks when it moves.',
    images: [CHAR, WALK2, GROUND],
    start: `${platformLevel}\n${player(300, REST, PLATFORMER)}`,
    steps: [
      { text: 'Delete Player › Sprite and add an AnimatedSprite2D named Sprite under Player. In the Inspector, add an animation called walk with two pictures, characters/tile_0000.png and tile_0001.png, at 8 fps.', hint: 'In the Animated sprite section: + Animation, then + picture… twice. Rename "default" to walk.',
        check: { kind: 'project', test: (v) => { const s = childrenOf(v.byName('Player'), 'AnimatedSprite2D')[0]; if (!s) return 'Player has no AnimatedSprite2D under it.'; const walk = (v.prop(s, 'frames') as SpriteAnimation[]).find((a) => a.name === 'walk'); return (walk && walk.frames.length >= 2) || 'There is no animation called walk with two pictures.'; } } },
      { text: 'Add an animation called idle (just tile_0000.png), and in Player’s script play the right one: this.get(\'Sprite\').play(moving ? \'walk\' : \'idle\'), in update(dt).',
        check: { kind: 'play', test: async (v) => {
          // The AnimatedSprite2D under Player (the floor has a picture called Sprite too).
          const run = async (keys: string[]) => { const r = await v.play({ seconds: 1, keys }); noErrors(r); return named<{ children: unknown[] }>(r.game, 'Player')?.children.find((c): c is AnimatedSprite2D => c instanceof AnimatedSprite2D)?.animation; };
          const moving = await run(['ArrowRight']), still = await run([]);
          return (moving === 'walk' && still === 'idle') || `Moving it plays "${moving}", standing still "${still}": they should be walk and idle.`;
        } } },
    ],
    solution: `${animatedSprite}\nproject.writeScript('scripts/player.js', ${JSON.stringify(ANIMATED_PLAYER)})`,
    done: 'Player walks. Back in the lesson: frames per second, and choosing an animation from what the body is doing.',
  },
  {
    id: 'sliding-door',
    chain: 'Animation',
    title: 'A door that slides open',
    goal: 'Use an AnimationPlayer and the timeline to slide a door up by keyframes.',
    images: [CHAR, GROUND],
    start: `${platformLevel}\n${door}`,
    steps: [
      { text: 'Add an AnimationPlayer named DoorAnimation (beside Door, under Main). Selecting it opens the Animation panel at the bottom.',
        check: { kind: 'project', test: (v) => { need(v, 'DoorAnimation', 'AnimationPlayer'); return true; } } },
      { text: 'Press + New, rename the animation open, length 1 s. Select Door: at 0 s press ◆ beside position; move the playhead to 1 s, set Door’s position y 120 higher (y 220), and press ◆ again.', hint: 'While the Animation panel shows an animation, changing a keyed property at the playhead sets its key there.',
        check: { kind: 'project', test: (v) => { const a = need(v, 'DoorAnimation', 'AnimationPlayer'); const clip = (v.prop(a, 'animations') as AnimationClip[]).find((c) => c.name === 'open'); if (!clip) return 'DoorAnimation has no animation called open.'; const tr = clip.tracks.find((t) => t.path === 'Door' && t.property === 'position'); if (!tr || tr.keys.length < 2) return 'open has no track keying Door’s position at two times.'; const ys = tr.keys.map((k) => (k.value as Pos).y); return Math.max(...ys) - Math.min(...ys) >= 80 || 'The door moves less than 80 px between its keys.'; } } },
      { text: 'Tick autoplay in the Animation panel, and run: the door slides up as the game starts.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1.5 }); noErrors(r); const d = named<Body>(r.game, 'Door')!; return rose({ x: 640, y: 340 }, d.position) >= 80 || 'The door does not move up when the game runs.'; } } },
    ],
    solution: `scene.add('AnimationPlayer', { name: 'DoorAnimation', autoplay: 'open', animations: ${JSON.stringify([OPEN])} })`,
    done: 'The door slides. Back in the lesson: how a value between two keys is worked out (linear interpolation).',
  },
  {
    id: 'door-switch',
    chain: 'Animation',
    title: 'A switch that opens the door',
    goal: 'Play the door’s animation from a script, when the player steps on a switch.',
    images: [CHAR, GROUND],
    start: `${platformLevel}\n${door}\nscene.add('AnimationPlayer', { name: 'DoorAnimation', animations: ${JSON.stringify([OPEN])} })\n${player(200, REST, PLATFORMER)}`,
    steps: [
      { text: 'Add an Area2D named Switch on the floor between Player and the door, with a CollisionShape2D under it.',
        check: { kind: 'project', test: (v) => { const s = need(v, 'Switch', 'Area2D'); return childrenOf(s, 'CollisionShape2D').length > 0 || 'Switch has no CollisionShape2D under it.'; } } },
      { text: 'Give Switch a script: in bodyEntered(body), if the body is Player, call scene.get(\'DoorAnimation\').play(\'open\'). Walk onto it.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1.5, setup: (g) => { const s = named<{ globalPosition: Pos }>(g, 'Switch'), p = named<Body>(g, 'Player'); if (s && p) p.position = s.globalPosition; } }); noErrors(r); const d = named<Body>(r.game, 'Door')!; return rose({ x: 640, y: 340 }, d.position) >= 80 || 'Stepping on the switch does not open the door.'; } } },
    ],
    solution: `scene.add('Area2D', { name: 'Switch', position: { x: 420, y: ${REST} } })
scene.add('CollisionShape2D', { name: 'Shape', parent: 'Switch', size: { x: 24, y: 16 } })
project.writeScript('scripts/switch.js', ${JSON.stringify(SWITCH)})
scene.get('Switch').script = 'scripts/switch.js'`,
    done: 'A switch opens the door. Back in the lesson: an animation as a thing a script starts, and animationFinished.',
  },
];

export const TILEMAPS: GameTask[] = [
  {
    id: 'paint-a-floor',
    chain: 'Tilemaps',
    title: 'A tileset and a floor',
    goal: 'Cut a sheet of tiles into a tileset, and paint a floor with it.',
    images: [SHEET],
    start: main,
    steps: [
      { text: 'Add a TileMapLayer named Floor. Selecting it opens the TileMap panel at the bottom.',
        check: { kind: 'project', test: (v) => { need(v, 'Floor', 'TileMapLayer'); return true; } } },
      { text: 'In the TileMap panel press + New tileset…, choose tiny-dungeon/tilemap/tilemap_packed.png with 16 × 16 tiles, and Create.',
        check: { kind: 'project', test: (v) => { const f = need(v, 'Floor', 'TileMapLayer'); const ts = (v.project.tilesets ?? []).find((t) => t.path === v.prop(f, 'tileset')); if (!ts) return 'Floor has no tileset yet.'; return (ts.image === SHEET && ts.tileWidth === 16 && ts.tileHeight === 16) || 'Floor’s tileset should be tilemap_packed.png in 16 × 16 tiles.'; } } },
      { text: 'Pick a floor tile in the palette and paint at least 20 cells in the viewport (drag to paint, or use Rectangle).',
        check: { kind: 'project', test: (v) => { const n = (v.prop(need(v, 'Floor', 'TileMapLayer'), 'cells') as number[]).length / 3; return n >= 20 || `${n} cells painted: paint at least 20.`; } } },
    ],
    solution: `${tileset}\nscene.add('TileMapLayer', { name: 'Floor', tileset: 'tilesets/dungeon.tileset' }).fill(0, 0, 10, 4, ${FLOOR})`,
    done: 'A painted floor. Back in the lesson: tile numbers, and how margin and spacing find each tile in the sheet.',
  },
  {
    id: 'solid-walls',
    chain: 'Tilemaps',
    title: 'Walls that stop the player',
    goal: 'Paint walls on their own layer and make their tile solid.',
    images: [SHEET, KNIGHT],
    start: `${main}\n${tileset}\n${floorLayer}\n${knight}`,
    steps: [
      { text: 'Add a second TileMapLayer named Walls with the same tileset, and paint walls (tile 40, the brick wall) all round the edge of the floor: 20 × 12 cells.',
        check: { kind: 'project', test: (v) => { const cells = v.prop(need(v, 'Walls', 'TileMapLayer'), 'cells') as number[]; const n = cells.length / 3; return n >= 40 || `Walls has ${n} cells: paint the whole border (60 cells).`; } } },
      { text: 'Make the wall tile solid: TileMap panel › ■ Solid tiles, then click the brick wall in the palette.',
        check: { kind: 'project', test: (v) => { const ts = (v.project.tilesets ?? []).find((t: TilesetData) => t.path === 'tilesets/dungeon.tileset'); const used = new Set((v.prop(need(v, 'Walls', 'TileMapLayer'), 'cells') as number[]).filter((_, i) => i % 3 === 2)); return (ts && [...used].some((t) => ts.solid.includes(t))) || 'None of the tiles in Walls is marked solid yet.'; } } },
      { text: 'Run, and walk right into the wall: Player stops at it.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 4, keys: ['ArrowRight'] }); noErrors(r); const p = named<Body>(r.game, 'Player')!; return (p.isOnWall() && p.position.x < 20 * 16) || 'Player walked through the right-hand wall.'; } } },
    ],
    solution: `const walls = scene.add('TileMapLayer', { name: 'Walls', tileset: 'tilesets/dungeon.tileset' })
walls.fill(0, 0, 20, 1, ${WALL}); walls.fill(0, 11, 20, 1, ${WALL}); walls.fill(0, 1, 1, 10, ${WALL}); walls.fill(19, 1, 1, 10, ${WALL})
project.tileset('tilesets/dungeon.tileset').solid = [${WALL}]`,
    done: 'Walls that stop the player. Back in the lesson: merging solid tiles into rectangles, and why it stops bodies catching on seams.',
  },
  {
    id: 'tiled-map',
    chain: 'Tilemaps',
    title: 'A map from Tiled',
    goal: 'Import Kenney’s sample dungeon, made in the Tiled map editor.',
    images: [],
    start: main,
    steps: [
      { text: 'Open Starter art (beside Files), choose Tiny Dungeon, and press Import beside "Tiled map: sample-map.tmx". It adds the tile sheet and the map’s layers to this scene.',
        check: { kind: 'project', test: (v) => { const layers = v.nodes.filter((n) => n.type === 'TileMapLayer'); const cells = layers.reduce((n, l) => n + (v.prop(l, 'cells') as number[]).length / 3, 0); return (layers.length >= 1 && cells >= 500) || 'There is no imported map in the scene yet.'; } } },
    ],
    solution: `project.importAsset('${SHEET}', { mime: 'image/png', width: 192, height: 176 })\n${tileset}\nscene.add('TileMapLayer', { name: 'Dungeon', tileset: 'tilesets/dungeon.tileset' }).fill(0, 0, 32, 20, ${FLOOR})`,
    done: 'A whole dungeon, from Tiled. Back in the lesson: Tiled’s layers, tilesets and flip flags.',
  },
];
