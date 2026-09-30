// The Game API reference: every class, property, method and global a script can use,
// what it does, and what it is called in Godot. One source for three things:
//   - the Reference panel in the editor (Help › API reference, F1);
//   - the script editor's completion and hover (engineDts() below);
//   - apiReference.test.ts, which checks this against the real engine both ways: every
//     entry exists, and nothing a script can reach is missing (ADR 5).
//
// Properties shown in the Inspector are not written out here: they come from the node
// registry (registry.ts), with its help text, so the Inspector and the reference agree.

import { nodeTypes, propsOf, type PropDef } from './registry';

export interface ApiMember {
  name: string;
  /** A property holds a value; a method is called by you; a callback is called by the engine, and you write it. */
  kind: 'property' | 'method' | 'callback';
  /** Property: its type. Method or callback: everything after the name, e.g. "(path: string): Node". */
  type: string;
  doc: string;
  /** What Godot calls it, when that helps. */
  godot?: string;
  readonly?: boolean;
  /** A Vec2 property you can set with any { x, y }. */
  vec?: boolean;
  /** Shown in the Inspector too (from the registry). */
  inspector?: boolean;
}

export interface ApiEntry {
  name: string;
  kind: 'class' | 'global';
  extends?: string;
  doc: string;
  godot?: string;
  /** A short script using it, checked by the tests against these declarations. */
  example?: string;
  members: ApiMember[];
  /** JavaScript's own, not the engine's: listed because scripts use it. */
  builtin?: boolean;
}

const p = (name: string, type: string, doc: string, godot?: string, more: Partial<ApiMember> = {}): ApiMember => ({ name, kind: 'property', type, doc, godot, ...more });
const m = (name: string, type: string, doc: string, godot?: string): ApiMember => ({ name, kind: 'method', type, doc, godot });
const cb = (name: string, type: string, doc: string, godot?: string): ApiMember => ({ name, kind: 'callback', type, doc, godot });
const XY = '{ x: number; y: number }';

/** Godot's names for the Inspector properties, where they differ or need a note. */
const GODOT_PROPS: Record<string, string> = {
  'Node2D.position': 'position', 'Node2D.rotation': 'rotation', 'Node2D.scale': 'scale', 'Node2D.visible': 'visible', 'Node2D.zIndex': 'z_index',
  'Sprite2D.texture': 'texture (here a project path, not a loaded resource)', 'Sprite2D.flipX': 'flip_h', 'Sprite2D.flipY': 'flip_v', 'Sprite2D.opacity': 'modulate.a',
  'Camera2D.current': 'enabled, make_current()', 'Camera2D.zoom': 'zoom (a Vector2 in Godot; one number here)', 'Camera2D.smoothing': 'position_smoothing_enabled and position_smoothing_speed',
  'Camera2D.limitTopLeft': 'limit_left, limit_top', 'Camera2D.limitBottomRight': 'limit_right, limit_bottom',
  'Label.text': 'text', 'Label.fontSize': 'theme_override_font_sizes/font_size', 'Label.color': 'theme_override_colors/font_color',
  'CanvasLayer.layer': 'layer',
  'CollisionShape2D.shape': 'shape (a RectangleShape2D or CircleShape2D resource)', 'CollisionShape2D.size': 'RectangleShape2D.size, or CircleShape2D.radius × 2',
  'PhysicsBody2D.collisionLayer': 'collision_layer', 'CharacterBody2D.collisionMask': 'collision_mask', 'RigidBody2D.collisionMask': 'collision_mask',
  'RigidBody2D.gravityScale': 'gravity_scale', 'RigidBody2D.bounce': 'physics_material_override.bounce', 'Area2D.collisionMask': 'collision_mask',
};

/** The classes and globals, in the order the reference lists them. `members` holds what the registry does not. */
const ENTRIES: ApiEntry[] = [
  {
    name: 'Node', kind: 'class', godot: 'Node',
    doc: 'The simplest node: a name in the tree, with children. Every node type extends it. A script is a class that extends the type of the node it is attached to, and the engine calls its ready, update and physicsUpdate.',
    example: `export default class Spawner extends Node {
  ready() {
    console.log('I am', this.path, 'with', this.children.length, 'children');
  }

  update(dt) {
    // Every frame: dt is the seconds since the last one.
  }
}`,
    members: [
      p('name', 'string', 'Its name in the tree. Names under one parent are unique.', 'name'),
      p('parent', 'Node | null', 'The node above it; null for the scene root.', 'get_parent()', { readonly: true }),
      p('children', 'Node[]', 'The nodes directly under it, in order (a copy: adding to it changes nothing).', 'get_children()', { readonly: true }),
      p('path', 'string', 'Its path from the scene root, like "Player/Sprite". The root is ".".', 'get_path() (from the scene root here)', { readonly: true }),
      m('get', '<T extends Node = AnyNode>(path: string): T', 'The node at a path relative to this one: "Sprite", "../Enemy", "HUD/Score". Throws, naming the path, if there is none.', 'get_node(), $Path'),
      m('find', '<T extends Node = AnyNode>(path: string): T | null', 'Like get, but null when there is no such node.', 'get_node_or_null()'),
      m('addChild', '(node: Node): Node', 'Add a node under this one while the game runs (a spawned bullet, say). It gets ready() straight away. A clashing name gets a number.', 'add_child()'),
      m('queueFree', '(): void', 'Remove this node and its children at the end of the frame; destroyed() runs then.', 'queue_free()'),
      cb('ready', '(): void', 'Runs once, when the node and all its children are in the game. Children are ready before their parent.', '_ready()'),
      cb('update', '(dt: number): void', 'Runs every frame. dt is the seconds since the last frame: move by speed × dt.', '_process(delta)'),
      cb('physicsUpdate', '(dt: number): void', 'Runs at a fixed 60 times a second (dt is always 1/60), before physics moves bodies. Move bodies here. In here input’s "just pressed" means since the last physics step.', '_physics_process(delta)'),
      cb('destroyed', '(): void', 'Runs once, when the node is removed by queueFree.', '_exit_tree(), roughly'),
    ],
  },
  {
    name: 'Node2D', kind: 'class', extends: 'Node', godot: 'Node2D',
    doc: 'A node with a place in 2D: position, rotation and scale, relative to its parent. +x is right and +y is down; positive rotation turns clockwise on screen.',
    example: `export default class Spinner extends Node2D {
  update(dt) {
    this.rotationDegrees += 90 * dt;                       // a quarter turn a second
    this.position = { x: this.position.x + 20 * dt, y: this.position.y };
  }
}`,
    members: [
      p('rotationDegrees', 'number', 'rotation in degrees, which is often easier to think in.', 'rotation_degrees'),
      p('globalPosition', 'Vec2', 'Where it is in the world, whatever its parents are. Setting it moves the node there.', 'global_position', { vec: true }),
    ],
  },
  {
    name: 'Sprite2D', kind: 'class', extends: 'Node2D', godot: 'Sprite2D',
    doc: 'Draws an image, centred on its position.',
    example: `export default class Blink extends Sprite2D {
  update(dt) {
    this.opacity = 0.5 + 0.5 * Math.sin(time.now * 6);
  }
}`,
    members: [],
  },
  {
    name: 'Camera2D', kind: 'class', extends: 'Node2D', godot: 'Camera2D',
    doc: 'What the player sees, centred on the camera. Put it under the player and it follows. The first current camera in the tree is the one used.',
    example: `export default class Shake extends Camera2D {
  update(dt) {
    // A small shake: move the camera a little each frame.
    this.position = { x: math.randRange(-2, 2), y: math.randRange(-2, 2) };
  }
}`,
    members: [],
  },
  {
    name: 'Label', kind: 'class', extends: 'Node2D', godot: 'Label (a Control in Godot; a Node2D here)',
    doc: 'Text. Its position is the top-left corner of the text.',
    example: `export default class Clock extends Label {
  update(dt) {
    this.text = \`Time: \${time.now.toFixed(1)}\`;
  }
}`,
    members: [],
  },
  {
    name: 'CanvasLayer', kind: 'class', extends: 'Node', godot: 'CanvasLayer',
    doc: 'Its children are drawn on the screen, not in the world: they stay put while the camera moves and zooms. Use it for a HUD.',
    members: [],
  },
  {
    name: 'CollisionShape2D', kind: 'class', extends: 'Node2D', godot: 'CollisionShape2D',
    doc: 'Gives the body or area directly above it a solid part: a rectangle or a circle. A body can have several. Rectangles do not turn with their body yet.',
    members: [],
  },
  {
    name: 'PhysicsBody2D', kind: 'class', extends: 'Node2D', godot: 'PhysicsBody2D',
    doc: 'What StaticBody2D, CharacterBody2D and RigidBody2D share. Not added on its own. Layers 1 to 16 are bits: layer n is 1 << (n − 1), so layers 1 and 3 are 1 | 4 = 5.',
    members: [],
  },
  {
    name: 'StaticBody2D', kind: 'class', extends: 'PhysicsBody2D', godot: 'StaticBody2D',
    doc: 'Solid and still: walls, floors and platforms. Other bodies stop against its shapes.',
    members: [],
  },
  {
    name: 'CharacterBody2D', kind: 'class', extends: 'PhysicsBody2D', godot: 'CharacterBody2D',
    doc: 'A body your script moves: set velocity, then call moveAndSlide() in physicsUpdate. It stops at solid bodies and slides along them. Nothing moves it otherwise, not even gravity: add gravity to velocity yourself.',
    example: `export default class Player extends CharacterBody2D {
  speed = 120;
  jumpSpeed = 360;

  physicsUpdate(dt) {
    const v = this.velocity;
    v.x = input.axis('move_left', 'move_right') * this.speed;
    v.y += physics.gravity * dt;
    if (input.isJustPressed('jump') && this.isOnFloor()) v.y = -this.jumpSpeed;
    this.velocity = v;
    this.moveAndSlide();
  }
}`,
    members: [
      p('velocity', 'Vec2', 'Pixels per second. moveAndSlide() moves by it, and removes the part going into anything it hits.', 'velocity', { vec: true }),
      m('moveAndSlide', '(): void', 'Move by velocity × 1/60 s, stopping at solid bodies on its mask’s layers and sliding along them. It moves in steps of at most 4 pixels, so it cannot pass through thin walls.', 'move_and_slide()'),
      m('isOnFloor', '(): boolean', 'Whether the last moveAndSlide() stopped it on a surface facing up. The usual test before a jump.', 'is_on_floor()'),
      m('isOnWall', '(): boolean', 'Whether the last moveAndSlide() stopped it against a surface facing sideways.', 'is_on_wall()'),
      m('isOnCeiling', '(): boolean', 'Whether the last moveAndSlide() stopped it on a surface facing down.', 'is_on_ceiling()'),
      m('getSlideCollisions', '(): { body: PhysicsBody2D; normal: Vec2 }[]', 'What the last moveAndSlide() touched, and each surface’s normal (pointing away from it).', 'get_slide_collision(i), get_slide_collision_count()'),
    ],
  },
  {
    name: 'RigidBody2D', kind: 'class', extends: 'PhysicsBody2D', godot: 'RigidBody2D',
    doc: 'A body that moves by itself: gravity pulls it (times gravityScale), it keeps its velocity, and it bounces off solid bodies. Give it a velocity to start it moving.',
    example: `export default class Ball extends RigidBody2D {
  ready() {
    this.velocity = { x: 150, y: -200 };
  }

  onCollision(body, normal) {
    if (body.name.startsWith('Brick')) body.queueFree();
  }
}`,
    members: [
      p('velocity', 'Vec2', 'Pixels per second. Physics changes it: gravity, and bounces.', 'linear_velocity', { vec: true }),
      cb('onCollision', '(body: AnyNode, normal: Vec2): void', 'Runs when it hits a solid body. normal points away from what it hit.', 'body_entered signal, with contact_monitor on'),
    ],
  },
  {
    name: 'Area2D', kind: 'class', extends: 'Node2D', godot: 'Area2D',
    doc: 'A region that notices bodies coming in and going out, without stopping them: pickups, triggers, danger zones. It notices only bodies on its mask’s layers.',
    example: `export default class Coin extends Area2D {
  bodyEntered(body) {
    if (body.name !== 'Player') return;
    body.collect(this);        // a method on the player's own script
    this.queueFree();
  }
}`,
    members: [
      m('getOverlappingBodies', '(): AnyNode[]', 'The bodies inside it now.', 'get_overlapping_bodies()'),
      cb('bodyEntered', '(body: AnyNode): void', 'Runs when a body comes in.', 'body_entered signal'),
      cb('bodyExited', '(body: AnyNode): void', 'Runs when a body goes out, or is freed while inside.', 'body_exited signal'),
    ],
  },
  {
    name: 'Vec2', kind: 'class', godot: 'Vector2',
    doc: 'A 2D vector: a position, a velocity or a direction. Change .x and .y directly; the methods return new vectors and leave this one alone. Anywhere a vector is wanted, a plain { x, y } works too.',
    example: `export default class Chaser extends Node2D {
  update(dt) {
    const target = scene.get('Player').globalPosition;
    const toward = new Vec2(target.x, target.y).sub(this.position).normalized();
    this.position = this.position.add(toward.scale(50 * dt));
  }
}`,
    members: [
      m('constructor', '(x?: number, y?: number)', 'new Vec2(3, 4). Both default to 0.', 'Vector2(x, y)'),
      p('x', 'number', 'Across: + is right.', 'x'),
      p('y', 'number', 'Down: + is down.', 'y'),
      m('add', `(v: ${XY}): Vec2`, 'This plus v.', 'a + b'),
      m('sub', `(v: ${XY}): Vec2`, 'This minus v: the vector from v to this.', 'a - b'),
      m('scale', '(k: number): Vec2', 'This times a number.', 'a * k'),
      m('dot', `(v: ${XY}): number`, 'x·v.x + y·v.y: positive when they point the same way, 0 when square to each other.', 'dot()'),
      m('length', '(): number', 'How long it is: √(x² + y²).', 'length()'),
      m('normalized', '(): Vec2', 'The same direction with length 1. A zero vector stays zero.', 'normalized()'),
      m('distanceTo', `(v: ${XY}): number`, 'The distance between two points.', 'distance_to()'),
      m('angle', '(): number', 'Its direction in radians from +x, clockwise on screen.', 'angle()'),
      m('lerp', `(v: ${XY}, t: number): Vec2`, 'Partway to v: t = 0 is this, 1 is v, 0.5 halfway.', 'lerp()'),
      m('set', '(x: number, y: number): this', 'Change both at once; returns this vector.', 'x = …; y = …'),
      m('copy', '(): Vec2', 'A new vector with the same x and y. Keep a copy of a position before it changes.', '(Vector2 is a value in Godot, copied anyway)'),
    ],
  },
  {
    name: 'input', kind: 'global', godot: 'Input',
    doc: 'The keyboard, as named actions from Project › Input map (move_left, jump…). Ask about actions, not keys, so the keys can change without changing scripts.',
    example: `export default class Mover extends Node2D {
  update(dt) {
    const dir = input.vector('move_left', 'move_right', 'move_up', 'move_down');
    this.position = this.position.add(dir.scale(100 * dt));
    if (input.isJustPressed('jump')) console.log('jump!');
  }
}`,
    members: [
      m('isPressed', '(action: string): boolean', 'Held down now.', 'is_action_pressed()'),
      m('isJustPressed', '(action: string): boolean', 'Went down since the last frame; in physicsUpdate, since the last physics step. True once per press.', 'is_action_just_pressed()'),
      m('isJustReleased', '(action: string): boolean', 'Came up since the last frame (in physicsUpdate, since the last physics step).', 'is_action_just_released()'),
      m('axis', '(negative: string, positive: string): number', '−1, 0 or 1: for example axis("move_left", "move_right").', 'get_axis()'),
      m('vector', '(left: string, right: string, up: string, down: string): Vec2', 'A direction from four actions, with length at most 1, so going diagonally is not faster.', 'get_vector()'),
      p('actionNames', 'string[]', 'The names of every action in the input map.', 'InputMap.get_actions()', { readonly: true }),
    ],
  },
  {
    name: 'scene', kind: 'global', godot: 'get_tree().current_scene',
    doc: 'The running scene. scene.get("HUD/Score") finds a node by its path from the root, from any script.',
    members: [
      p('root', 'Node', 'The scene’s root node.', 'get_tree().current_scene', { readonly: true }),
      m('get', '<T extends Node = AnyNode>(path: string): T', 'The node at a path from the root. Throws if there is none.', 'get_node("/root/…")'),
      m('find', '<T extends Node = AnyNode>(path: string): T | null', 'Like get, but null when there is none.', 'get_node_or_null()'),
    ],
  },
  {
    name: 'time', kind: 'global', godot: 'Time, Engine.get_process_frames()',
    doc: 'The game’s clock.',
    members: [
      p('now', 'number', 'Seconds since the game started. Math.sin(time.now) makes smooth back-and-forth motion.', 'Time.get_ticks_msec() / 1000', { readonly: true }),
      p('frame', 'number', 'How many frames have been drawn.', 'Engine.get_process_frames()', { readonly: true }),
    ],
  },
  {
    name: 'physics', kind: 'global', godot: 'ProjectSettings physics/2d/default_gravity',
    doc: 'The project’s physics settings (Project › Settings).',
    members: [
      p('gravity', 'number', 'Downward pull in pixels per second per second (980 unless changed). RigidBody2D uses it; a CharacterBody2D adds it to its velocity itself.', 'default_gravity', { readonly: true }),
    ],
  },
  {
    name: 'math', kind: 'global', godot: '@GlobalScope functions',
    doc: 'Small maths helpers. JavaScript’s own Math (Math.sin, Math.PI…) works too.',
    members: [
      m('vec', '(x?: number, y?: number): Vec2', 'A new Vec2, like new Vec2(x, y).', 'Vector2(x, y)'),
      m('clamp', '(v: number, lo: number, hi: number): number', 'v kept between lo and hi.', 'clamp()'),
      m('lerp', '(a: number, b: number, t: number): number', 'Partway from a to b: t = 0 is a, 1 is b.', 'lerp()'),
      m('degToRad', '(d: number): number', 'Degrees to radians.', 'deg_to_rad()'),
      m('radToDeg', '(r: number): number', 'Radians to degrees.', 'rad_to_deg()'),
      m('randRange', '(lo: number, hi: number): number', 'A random number from lo up to (not including) hi.', 'randf_range()'),
    ],
  },
  {
    name: 'console', kind: 'global', builtin: true, godot: 'print(), push_warning(), push_error()',
    doc: 'JavaScript’s console. While the game runs, what you log appears in the Output panel below the viewport.',
    members: [
      m('log', '(...values: any[]): void', 'Write a line to Output: console.log("score", score).', 'print()'),
      m('info', '(...values: any[]): void', 'The same as log.', 'print()'),
      m('warn', '(...values: any[]): void', 'A line marked as a warning.', 'push_warning()'),
      m('error', '(...values: any[]): void', 'A line marked as an error.', 'push_error()'),
    ],
  },
];

const PROP_TYPE: Record<PropDef['type'], (d: PropDef) => string> = {
  vec2: () => 'Vec2', number: () => 'number', angle: () => 'number', bool: () => 'boolean', string: () => 'string', color: () => 'string',
  texture: () => 'string | null', enum: (d) => (d.options ?? []).map((o) => `'${o}'`).join(' | '), layers: () => 'number',
};

/** The Inspector properties a class adds: its registry properties not already declared by a class it extends. */
function registryMembers(e: ApiEntry): ApiMember[] {
  if (e.kind !== 'class') return [];
  const inherited = new Set(chain(ENTRIES, e).flatMap((a) => (a === e ? [] : allOwn(a).map((x) => x.name))));
  const type = e.name === 'PhysicsBody2D' ? 'StaticBody2D' : e.name;          // PhysicsBody2D is not addable; its layer is StaticBody2D's
  if (!nodeTypes().some((t) => t.type === type)) return [];
  const own = new Set(e.members.map((x) => x.name));
  return propsOf(type).filter((d) => !inherited.has(d.name) && !own.has(d.name)).map((d) => ({
    name: d.name, kind: 'property' as const, type: PROP_TYPE[d.type](d), doc: d.help, godot: GODOT_PROPS[`${e.name}.${d.name}`], vec: d.type === 'vec2', inspector: true,
  }));
}

const cache = new Map<string, ApiMember[]>();
function allOwn(e: ApiEntry): ApiMember[] {
  let v = cache.get(e.name);
  if (!v) { v = [...registryMembers(e), ...e.members]; cache.set(e.name, v); }
  return v;
}

function chain(list: ApiEntry[], e: ApiEntry): ApiEntry[] {
  const out: ApiEntry[] = [];
  for (let c: ApiEntry | undefined = e; c; c = c.extends ? list.find((x) => x.name === c!.extends) : undefined) out.push(c);
  return out;
}

/** Every entry, with its Inspector properties filled in from the registry. */
export const API_REFERENCE: ApiEntry[] = ENTRIES.map((e) => ({ ...e, members: allOwn(e) }));

/** The class and the classes it extends, nearest first. */
export function ancestors(e: ApiEntry): ApiEntry[] { return chain(API_REFERENCE, API_REFERENCE.find((x) => x.name === e.name) ?? e); }

export function apiEntry(name: string): ApiEntry | undefined { return API_REFERENCE.find((e) => e.name === name); }

/** How a member reads in the reference: "position: Vec2", "get(path: string): T". */
export function signature(x: ApiMember): string {
  const t = x.type.replace(/AnyNode/g, 'Node');
  return x.kind === 'property' ? `${x.readonly ? 'readonly ' : ''}${x.name}: ${t}` : `${x.name === 'constructor' ? 'new Vec2' : x.name}${t}`;
}

function declare(x: ApiMember, indent: string): string {
  const docs = `${indent}/** ${x.doc.replace(/\*\//g, '*\\/')}${x.godot ? ` Godot: ${x.godot}.` : ''} */\n`;
  if (x.kind !== 'property') return `${docs}${indent}${x.name}${x.type};`;
  if (x.vec) return `${docs}${indent}get ${x.name}(): Vec2; set ${x.name}(v: ${XY});`;
  return `${docs}${indent}${x.readonly ? 'readonly ' : ''}${x.name}: ${x.type};`;
}

/** The API as TypeScript declarations, for the script editor's completion and hover. */
export function engineDts(): string {
  const out = [
    '// Generated from core/apiReference.ts: the Game API scripts can use.',
    '/** A node found by path. Its own type is not known until the game runs, so any property can be used. */',
    'type AnyNode = Node & { [name: string]: any };',
  ];
  for (const e of API_REFERENCE) {
    const body = e.members.map((x) => declare(x, '  ')).join('\n');
    const head = `/** ${e.doc}${e.godot ? ` Godot: ${e.godot}.` : ''} */`;
    if (e.kind === 'class') out.push(head, `declare class ${e.name}${e.extends ? ` extends ${e.extends}` : ''} {\n${body}\n}`);
    else out.push(head, `declare const ${e.name}: {\n${body}\n};`);
  }
  return `${out.join('\n')}\n`;
}

/** The first example on the reference's contents page. */
export const FIRST_SCRIPT = `export default class Player extends CharacterBody2D {
  speed = 120;

  physicsUpdate(dt) {
    this.velocity = input.vector('move_left', 'move_right', 'move_up', 'move_down').scale(this.speed);
    this.moveAndSlide();
  }
}`;

// ── the Scene API: the code GUI → code writes, and examples are built with ──────────

export interface SceneApiEntry { name: string; doc: string; members: { name: string; type: string; doc: string }[] }

/** Not for scripts in a running game: this builds and changes the project, in the editor. */
export const SCENE_API: SceneApiEntry[] = [
  {
    name: 'project',
    doc: 'The project being edited. Every editor action writes one of these calls to GUI → code, and running that code rebuilds the project exactly.',
    members: [
      { name: 'name', type: 'string', doc: 'The project’s name.' },
      { name: 'setSettings', type: '({ width?, height?, background?, pixelArt?, gravity? }): void', doc: 'The game’s size in pixels, background colour ("#rrggbb"), hard-edged pixel art, and gravity.' },
      { name: 'createScene', type: '(path: string, rootType?: string, rootName?: string): SceneHandle', doc: 'A new scene file in scenes/, with a root node (Node2D unless you say). The first scene becomes the main scene.' },
      { name: 'scene', type: '(path: string): SceneHandle', doc: 'An existing scene.' },
      { name: 'setMainScene', type: '(path: string): void', doc: 'The scene ▶ Run starts.' },
      { name: 'writeScript', type: '(path: string, source: string): void', doc: 'Create or replace a script in scripts/.' },
      { name: 'addAction', type: '(name: string, keys: string[]): void', doc: 'A new input action, with KeyboardEvent.code key names ("Space", "KeyA", "ArrowLeft").' },
      { name: 'setActionKeys', type: '(name: string, keys: string[]): void', doc: 'Change an action’s keys.' },
      { name: 'removeAction', type: '(name: string): void', doc: 'Remove an action.' },
      { name: 'importAsset', type: '(path: string, info: { mime, width, height }): string', doc: 'Record an imported image. The editor does this when you import or drag in art; the bytes are stored separately.' },
    ],
  },
  {
    name: 'SceneHandle',
    doc: 'A scene, from project.createScene or project.scene. In GUI → code the current one is called scene.',
    members: [
      { name: 'path', type: 'string', doc: 'Its file path, like "scenes/main.scene".' },
      { name: 'root', type: 'NodeHandle', doc: 'Its root node.' },
      { name: 'get', type: '(path: string): NodeHandle', doc: 'A node by its path from the root.' },
      { name: 'add', type: '(type: string, { name?, parent?, index?, script?, ...properties }): NodeHandle', doc: 'Add a node: add("Sprite2D", { parent: "Player", texture: "assets/p.png", position: { x: 0, y: -8 } }). Any Inspector property can be given.' },
    ],
  },
  {
    name: 'NodeHandle',
    doc: 'A node in the project (not in a running game). Every Inspector property can be read and set by name: node.position = { x: 10, y: 20 }.',
    members: [
      { name: 'id', type: 'string', doc: 'Its permanent id.' },
      { name: 'type', type: 'string', doc: 'Its node type, like "Sprite2D".' },
      { name: 'path', type: 'string', doc: 'Its path from the scene root.' },
      { name: 'name', type: 'string', doc: 'Its name; setting it renames it (a clash gets a number).' },
      { name: 'script', type: 'string | null', doc: 'The script attached to it.' },
      { name: 'children', type: 'NodeHandle[]', doc: 'The nodes under it.' },
      { name: 'get', type: '(path: string): NodeHandle', doc: 'A node by a path relative to this one.' },
      { name: 'reparent', type: '(parentPath: string, index?: number): void', doc: 'Move it under another node. The GUI keeps it where it is on screen by also setting its position.' },
      { name: 'delete', type: '(): void', doc: 'Delete it and everything under it.' },
      { name: 'duplicate', type: '(): NodeHandle', doc: 'A copy next to it, with a new name.' },
    ],
  },
];
