import { createEntity, createProject, createScene } from './projectModel';

const text = (name, value, x, y, options = {}) => createEntity('text', {
  name,
  transform: { x, y },
  display: { text: value, width: options.width || 600, height: 44, color: options.color || '#f8fafc', fontSize: options.fontSize || 26 },
});

const wall = (name, x, y, width, height, color = '#312e81') => createEntity('rectangle', {
  name,
  transform: { x, y },
  display: { width, height, color },
  physics: { enabled: true, body: 'static', bounce: 0, collideWorldBounds: false },
});

const pellet = (x, y, index) => createEntity('circle', {
  name: `Energy Dot ${index + 1}`,
  transform: { x, y },
  display: { width: 14, height: 14, color: '#fde68a' },
  physics: { enabled: true, body: 'static', bounce: 0, collideWorldBounds: false },
  gameplay: { role: 'collectible', points: 10 },
});

function blankProject() {
  const scene = createScene('Main Scene', []);
  return createProject('Blank Game', { scene });
}

function movementProject() {
  const scene = createScene('Movement Playground', [
    createEntity('rectangle', {
      name: 'Player', transform: { x: 480, y: 300 }, display: { width: 72, height: 72, color: '#67e8f9' },
      behavior: { type: 'topDown', speed: 240 }, gameplay: { role: 'player', lives: 3 },
    }),
    text('Instructions', 'Use the arrow keys to move', 480, 90),
  ]);
  return createProject('Move a Player', { scene });
}

function physicsProject() {
  const balls = Array.from({ length: 5 }, (_, index) => createEntity('circle', {
    name: `Bouncing Ball ${index + 1}`,
    transform: { x: 180 + index * 145, y: 130 + index * 45 },
    display: { width: 54 + index * 5, height: 54 + index * 5, color: ['#67e8f9', '#a78bfa', '#f472b6', '#fbbf24', '#34d399'][index] },
    physics: { enabled: true, body: 'dynamic', bounce: 1, collideWorldBounds: true },
    behavior: { type: 'bounce', speed: 150 + index * 25 },
  }));
  const scene = createScene('Physics Playground', [text('Title', 'Arcade physics: velocity + world bounds', 480, 58), ...balls]);
  return createProject('Bouncing Objects', { scene, settings: { gravityY: 120 } });
}

function mazeChaseProject() {
  const dots = [
    [80, 100], [160, 100], [240, 100], [320, 100], [400, 100], [560, 100], [640, 100], [720, 100], [800, 100], [880, 100],
    [80, 190], [160, 190], [320, 190], [400, 190], [560, 190], [640, 190], [800, 190], [880, 190],
    [80, 280], [160, 280], [320, 280], [400, 280], [560, 280], [640, 280], [800, 280], [880, 280],
    [80, 370], [160, 370], [320, 370], [400, 370], [560, 370], [640, 370], [800, 370], [880, 370],
    [160, 470], [240, 470], [320, 470], [400, 470], [560, 470], [640, 470], [720, 470], [800, 470], [880, 470],
  ].map(([x, y], index) => pellet(x, y, index));
  const scene = createScene('Neon Maze', [
    createEntity('circle', {
      name: 'Player', transform: { x: 80, y: 470 }, display: { width: 42, height: 42, color: '#facc15' },
      physics: { enabled: true, body: 'dynamic', bounce: 0, collideWorldBounds: true },
      behavior: { type: 'topDown', speed: 210 }, gameplay: { role: 'player', lives: 3 },
    }),
    wall('North Gate', 480, 145, 250, 28),
    wall('South Gate', 480, 415, 250, 28),
    wall('West Tower', 250, 280, 28, 210),
    wall('East Tower', 710, 280, 28, 210),
    wall('Center Column', 480, 280, 28, 145, '#4c1d95'),
    wall('West Block', 120, 325, 150, 26, '#1e3a8a'),
    wall('East Block', 840, 325, 150, 26, '#1e3a8a'),
    createEntity('circle', {
      name: 'Pink Sentinel', transform: { x: 480, y: 205 }, display: { width: 42, height: 42, color: '#f472b6' },
      physics: { enabled: true, body: 'dynamic', bounce: 1, collideWorldBounds: true },
      behavior: { type: 'patrol', speed: 135, axis: 'x', range: 190 }, gameplay: { role: 'hazard' },
    }),
    createEntity('circle', {
      name: 'Cyan Sentinel', transform: { x: 480, y: 470 }, display: { width: 42, height: 42, color: '#22d3ee' },
      physics: { enabled: true, body: 'dynamic', bounce: 1, collideWorldBounds: true },
      behavior: { type: 'patrol', speed: 165, axis: 'x', range: 300 }, gameplay: { role: 'hazard' },
    }),
    ...dots,
  ]);
  return createProject('Neon Maze Chase', { scene, settings: { background: '#050816', gravityY: 0, showHud: true } });
}

function collectorProject() {
  const crystals = [[180, 150], [780, 140], [250, 420], [700, 390], [480, 270]].map(([x, y], index) => createEntity('circle', {
    name: `Crystal ${index + 1}`, transform: { x, y }, display: { width: 34, height: 34, color: '#a78bfa' },
    physics: { enabled: true, body: 'static' }, gameplay: { role: 'collectible', points: 20 },
  }));
  const scene = createScene('Crystal Field', [
    createEntity('rectangle', {
      name: 'Explorer', transform: { x: 100, y: 270 }, display: { width: 52, height: 52, color: '#34d399' },
      physics: { enabled: true, body: 'dynamic' }, behavior: { type: 'topDown', speed: 230 }, gameplay: { role: 'player', lives: 3 },
    }),
    ...crystals,
  ]);
  return createProject('Crystal Collector', { scene, settings: { background: '#172554' } });
}

function platformerProject() {
  const scene = createScene('Sky Steps', [
    createEntity('rectangle', {
      name: 'Jumper', transform: { x: 120, y: 420 }, display: { width: 46, height: 58, color: '#fbbf24' },
      physics: { enabled: true, body: 'dynamic', bounce: 0, collideWorldBounds: true },
      behavior: { type: 'platformer', speed: 240 }, gameplay: { role: 'player', lives: 3 },
    }),
    wall('Ground', 480, 520, 960, 40, '#334155'),
    wall('Step One', 285, 415, 210, 26, '#475569'),
    wall('Step Two', 560, 325, 190, 26, '#475569'),
    wall('Step Three', 790, 225, 180, 26, '#475569'),
    createEntity('circle', { name: 'Goal', transform: { x: 790, y: 180 }, display: { width: 34, height: 34, color: '#34d399' }, physics: { enabled: true, body: 'static' }, gameplay: { role: 'goal' } }),
    text('Instructions', 'Arrow keys move · Space jumps · Reach the green beacon', 480, 55, { fontSize: 22 }),
  ]);
  return createProject('Sky Steps', { scene, settings: { background: '#0c4a6e', gravityY: 760 } });
}

export const GAME_STUDIO_EXAMPLES = [
  {
    id: 'neon-maze', title: 'Neon Maze Chase', level: 'Complete game', category: 'Arcade classics', featured: true,
    summary: 'Clear a neon maze while two sentinels patrol the corridors. Includes a score, lives, walls, hazards, and a real win state.',
    concepts: ['Game state', 'Collision walls', 'Collectibles', 'Enemy patrols', 'Score and lives', 'Win/lose states'],
    steps: ['Press Play and use the arrow keys.', 'Collect every energy dot while avoiding both sentinels.', 'Stop, inspect the Player, walls, dots, and enemies, then change their values.'],
    challenge: 'Add a third sentinel, make it patrol vertically, and rebalance player speed so the maze stays fair.',
    code: `class NeonMaze extends Phaser.Scene {
  create() {
    this.score = 0;
    this.lives = 3;
    this.player = this.physics.add.circle(80, 470, 21, 0xfacc15);
    this.player.body.setCollideWorldBounds(true);
    this.cursors = this.input.keyboard.createCursorKeys();

    this.walls = this.physics.add.staticGroup();
    addMazeWalls(this.walls);
    this.physics.add.collider(this.player, this.walls);

    this.dots = this.physics.add.staticGroup();
    dotPositions.forEach(([x, y]) => this.dots.add(this.add.circle(x, y, 7, 0xfde68a)));
    this.physics.add.overlap(this.player, this.dots, (_, dot) => {
      dot.destroy();
      this.score += 10;
      this.updateHud();
      if (this.dots.countActive() === 0) this.win();
    });

    this.enemies = createPatrollingSentinels(this.physics);
    this.physics.add.overlap(this.player, this.enemies, () => this.loseLife());
  }

  update() {
    const speed = 210;
    const x = Number(this.cursors.right.isDown) - Number(this.cursors.left.isDown);
    const y = Number(this.cursors.down.isDown) - Number(this.cursors.up.isDown);
    const direction = new Phaser.Math.Vector2(x, y).normalize();
    this.player.body.setVelocity(direction.x * speed, direction.y * speed);
    updateEnemyPatrols(this.enemies);
  }
}`,
    walkthrough: [
      { title: 'Create persistent game state', detail: 'Score and lives belong to the scene because many collisions need to read and update them.', code: 'this.score = 0;\nthis.lives = 3;' },
      { title: 'Separate solid and overlap collisions', detail: 'Walls physically block the player. Dots use overlap so they can trigger an event and disappear instead.', code: 'this.physics.add.collider(this.player, this.walls);\nthis.physics.add.overlap(this.player, this.dots, collectDot);' },
      { title: 'Turn input into a normalized vector', detail: 'Normalizing prevents diagonal movement from being faster than horizontal movement.', code: 'const direction = new Phaser.Math.Vector2(x, y).normalize();\nbody.setVelocity(direction.x * speed, direction.y * speed);' },
      { title: 'Make rules produce an ending', detail: 'A game becomes complete when actions update state and state can reach a clear win or loss condition.', code: 'if (this.dots.countActive() === 0) this.win();' },
    ],
    create: mazeChaseProject,
  },
  {
    id: 'blank', title: 'Blank playground', level: 'Start here', category: 'Foundations',
    summary: 'Begin with an empty scene and add one object at a time.', concepts: ['Scenes', 'Objects', 'Inspector', 'Edit and Play'],
    steps: ['Add a rectangle, circle, or text object.', 'Drag it and adjust exact values in the Inspector.', 'Switch to Play to run the project through Phaser.'],
    challenge: 'Make a simple title screen using only shapes and text.',
    code: `class MainScene extends Phaser.Scene {
  create() {
    // Add game objects here.
  }

  update(time, delta) {
    // Change the game every frame here.
  }
}`,
    walkthrough: [{ title: 'Two essential lifecycle methods', detail: 'create runs once when the scene starts. update runs once per frame.', code: 'create() { }\nupdate(time, delta) { }' }],
    create: blankProject,
  },
  {
    id: 'movement', title: 'Move a player', level: 'Beginner', category: 'Input and motion',
    summary: 'Build smooth eight-direction movement and understand why diagonal input needs normalization.', concepts: ['Input', 'Position', 'Speed', 'Delta time', 'Vectors'],
    steps: ['Select Player and find Behavior.', 'Change Speed and press Play.', 'Hold two arrow keys and compare diagonal motion.'],
    challenge: 'Add a second controllable object with a different speed.',
    code: `const cursors = this.input.keyboard.createCursorKeys();
const x = Number(cursors.right.isDown) - Number(cursors.left.isDown);
const y = Number(cursors.down.isDown) - Number(cursors.up.isDown);
const direction = new Phaser.Math.Vector2(x, y).normalize();
player.body.setVelocity(direction.x * speed, direction.y * speed);`,
    walkthrough: [
      { title: 'Read opposite keys as one axis', detail: 'Right contributes +1 and left contributes −1, producing one signed X value.', code: 'const x = Number(right.isDown) - Number(left.isDown);' },
      { title: 'Normalize before scaling', detail: 'The vector keeps its direction but becomes length 1, so every direction uses the same speed.', code: 'direction.normalize();\nvelocity = direction.scale(speed);' },
    ],
    create: movementProject,
  },
  {
    id: 'physics', title: 'Bouncing objects', level: 'Beginner', category: 'Physics',
    summary: 'See how gravity, velocity, bounce, and world bounds work together.', concepts: ['Velocity', 'Gravity', 'Collision bounds', 'Restitution'],
    steps: ['Each ball has Physics enabled.', 'Gravity changes vertical velocity every frame.', 'Bounce controls how much speed survives a collision.'],
    challenge: 'Give each ball a different bounce value and predict which settles first.',
    code: `this.physics.world.gravity.y = 120;
const ball = this.physics.add.image(x, y, 'ball');
ball.setVelocity(180, 90);
ball.setBounce(1);
ball.setCollideWorldBounds(true);`,
    walkthrough: [{ title: 'Configure the body, not the picture', detail: 'The visible object and its physics body are related but separate. Velocity and bounce belong to the body.', code: 'ball.setVelocity(180, 90);\nball.setBounce(1);' }],
    create: physicsProject,
  },
  {
    id: 'collector', title: 'Crystal Collector', level: 'Beginner game', category: 'Game rules',
    summary: 'A compact playable game that turns movement, overlaps, scoring, and a win state into one loop.', concepts: ['Collectibles', 'Score', 'Overlap events', 'Win condition'],
    steps: ['Move into each crystal.', 'Watch overlap events add points.', 'Collect all five to end the game.'],
    challenge: 'Add hazards and reduce the player to two lives.',
    code: `this.physics.add.overlap(player, crystals, (player, crystal) => {
  crystal.destroy();
  score += 20;
  scoreText.setText('Score: ' + score);
  if (crystals.countActive() === 0) showWinMessage();
});`,
    walkthrough: [{ title: 'An overlap is an event boundary', detail: 'It detects contact without physically pushing the objects apart, which is ideal for pickups.', code: 'this.physics.add.overlap(player, crystals, collectCrystal);' }],
    create: collectorProject,
  },
  {
    id: 'platformer', title: 'Sky Steps', level: 'Intermediate game', category: 'Platform games',
    summary: 'Run, jump, land on static platforms, and reach a goal beacon.', concepts: ['Gravity', 'Ground checks', 'Jump impulse', 'Static platforms', 'Goal triggers'],
    steps: ['Use arrows to move and Space to jump.', 'Notice that jumping only works while grounded.', 'Change gravity and jump speed together.'],
    challenge: 'Add a moving hazard to the second platform.',
    code: `player.body.setVelocityX(horizontal * runSpeed);

const wantsToJump = Phaser.Input.Keyboard.JustDown(spaceKey);
const isGrounded = player.body.blocked.down;
if (wantsToJump && isGrounded) {
  player.body.setVelocityY(-jumpSpeed);
}`,
    walkthrough: [
      { title: 'Horizontal speed is continuous', detail: 'The X velocity is refreshed each frame from the current input.', code: 'body.setVelocityX(horizontal * runSpeed);' },
      { title: 'Jumping is a guarded impulse', detail: 'JustDown fires once per press, and blocked.down prevents mid-air jumping.', code: 'if (JustDown(space) && body.blocked.down) body.setVelocityY(-jumpSpeed);' },
    ],
    create: platformerProject,
  },
];
