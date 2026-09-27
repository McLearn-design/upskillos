export const GAME_CODE_RECIPES = [
  {
    id: 'script-top-down', category: 'Input and movement', level: 'Beginner', title: 'Eight-direction movement',
    summary: 'Turn four arrow keys into a direction vector and keep diagonal speed fair.',
    outcome: 'The selected physics object moves with the arrow keys.', physics: true,
    concepts: ['Input axes', 'Vectors', 'Normalization', 'Velocity'],
    code: `const x = Number(api.keys.right) - Number(api.keys.left);
const y = Number(api.keys.down) - Number(api.keys.up);
const length = Math.hypot(x, y) || 1;
const speed = 220;

api.setVelocity(
  x / length * speed,
  y / length * speed
);`,
    walkthrough: [
      ['Combine opposite keys', 'Subtracting booleans gives −1, 0, or 1 on each axis.', 'const x = Number(right) - Number(left);'],
      ['Normalize the vector', 'Dividing by its length makes horizontal and diagonal input use equal speed.', 'x / length * speed'],
    ],
  },
  {
    id: 'script-platform-jump', category: 'Input and movement', level: 'Beginner', title: 'Grounded jump',
    summary: 'Apply a one-frame upward impulse only while the player is standing on a surface.',
    outcome: 'Space launches a physics object upward when it is grounded.', physics: true, gravityY: 760,
    concepts: ['Impulse', 'Ground check', 'State guard'],
    code: `const run = Number(api.keys.right) - Number(api.keys.left);
api.setVelocity(run * 240, api.velocity.y);

if (api.keys.space && api.body.blockedDown && !api.state.jumpHeld) {
  api.setVelocity(run * 240, -410);
}
api.state.jumpHeld = api.keys.space;`,
    walkthrough: [
      ['Keep vertical physics intact', 'Only X is replaced while the existing Y velocity continues under gravity.', 'api.setVelocity(run * 240, api.velocity.y);'],
      ['Require a new grounded press', 'blockedDown prevents air jumps and jumpHeld prevents repeated impulses from one held key.', 'api.body.blockedDown && !api.state.jumpHeld'],
    ],
  },
  {
    id: 'script-patrol', category: 'Enemies and AI', level: 'Beginner', title: 'Two-point patrol',
    summary: 'Move between two limits and reverse direction at either edge.',
    outcome: 'The object patrols left and right automatically.', physics: true,
    concepts: ['Finite state', 'Bounds', 'Direction'],
    code: `api.state.direction ??= 1;
const range = 140;
const speed = 110;

if (api.position.x >= api.start.x + range) api.state.direction = -1;
if (api.position.x <= api.start.x - range) api.state.direction = 1;

api.setVelocity(speed * api.state.direction, 0);`,
    walkthrough: [
      ['Remember one piece of state', 'direction survives between frames inside api.state.', 'api.state.direction ??= 1;'],
      ['Reverse at symmetric limits', 'The starting position becomes the patrol center, so the script works wherever the object is placed.', 'api.start.x ± range'],
    ],
  },
  {
    id: 'script-bob', category: 'Animation and effects', level: 'Beginner', title: 'Floating sine motion',
    summary: 'Use a sine wave to create smooth, repeating hover motion.',
    outcome: 'The object floats above and below its starting position.',
    concepts: ['Sine waves', 'Amplitude', 'Frequency', 'Animation'],
    code: `const amplitude = 42;
const frequency = 2.2;
const offsetY = Math.sin(api.time * frequency) * amplitude;

api.setPosition(api.start.x, api.start.y + offsetY);`,
    walkthrough: [
      ['Use time as the angle', 'Sine turns steadily increasing time into a repeating value from −1 to 1.', 'Math.sin(api.time * frequency)'],
      ['Separate size and speed', 'Amplitude controls travel distance; frequency controls how quickly the cycle repeats.', '* amplitude'],
    ],
  },
  {
    id: 'script-orbit', category: 'Animation and effects', level: 'Intermediate', title: 'Circular orbit',
    summary: 'Combine cosine and sine as the X and Y coordinates of a circle.',
    outcome: 'The object circles its starting position.',
    concepts: ['Parametric circle', 'Radians', 'Transforms'],
    code: `const radius = 90;
const angle = api.time * 1.8;

api.setPosition(
  api.start.x + Math.cos(angle) * radius,
  api.start.y + Math.sin(angle) * radius
);`,
    walkthrough: [
      ['Share one angle', 'Cosine and sine read the same angle, keeping X and Y synchronized around one circle.', 'x = cos(angle), y = sin(angle)'],
      ['Offset from the start', 'Adding the start position moves the orbit center without rewriting the script.', 'api.start.x + …'],
    ],
  },
  {
    id: 'script-pulse', category: 'Animation and effects', level: 'Beginner', title: 'Pulse attention effect',
    summary: 'Animate scale with a sine wave to highlight a pickup, button, or goal.',
    outcome: 'The object smoothly grows and shrinks.',
    concepts: ['Scale', 'Sine wave', 'Visual feedback'],
    code: `const pulse = 1 + Math.sin(api.time * 4) * 0.14;
api.setScale(pulse);`,
    walkthrough: [['Center the wave on one', 'A scale of 1 is the original size. Adding a small sine wave moves around that baseline.', '1 + sin(time) * 0.14']],
  },
  {
    id: 'script-spin', category: 'Animation and effects', level: 'Beginner', title: 'Frame-rate independent spin',
    summary: 'Accumulate rotation with delta time so the result is stable on fast and slow screens.',
    outcome: 'The object rotates at 90 degrees per second.',
    concepts: ['Delta time', 'Angular speed', 'Frame independence'],
    code: `api.state.angle ??= 0;
api.state.angle += 90 * api.delta;
api.rotate(api.state.angle);`,
    walkthrough: [['Multiply speed by elapsed time', 'Degrees per second times seconds per frame gives the degrees to add this frame.', '90 * api.delta']],
  },
  {
    id: 'script-acceleration', category: 'Physics and feel', level: 'Intermediate', title: 'Acceleration and friction',
    summary: 'Ease velocity toward the requested direction instead of switching instantly.',
    outcome: 'Arrow movement gains weight and slides to a stop.', physics: true,
    concepts: ['Acceleration', 'Friction', 'Interpolation', 'Game feel'],
    code: `const input = Number(api.keys.right) - Number(api.keys.left);
const targetSpeed = input * 260;
const response = input === 0 ? 0.12 : 0.2;

const nextX = api.lerp(api.velocity.x, targetSpeed, response);
api.setVelocity(nextX, api.velocity.y);`,
    walkthrough: [
      ['Choose a target velocity', 'Input decides where velocity should go instead of setting the current value directly.', 'targetSpeed = input * 260'],
      ['Interpolate toward it', 'Lerp closes a fraction of the remaining gap each frame, creating acceleration and friction.', 'api.lerp(current, target, response)'],
    ],
  },
  {
    id: 'script-face-motion', category: 'Physics and feel', level: 'Intermediate', title: 'Face the movement direction',
    summary: 'Convert a velocity vector into an angle using atan2.',
    outcome: 'A moving object rotates to point along its velocity.', physics: true,
    concepts: ['atan2', 'Velocity vector', 'Radians to degrees'],
    code: `const moving = Math.hypot(api.velocity.x, api.velocity.y) > 1;
if (moving) {
  const radians = Math.atan2(api.velocity.y, api.velocity.x);
  api.rotate(radians * 180 / Math.PI);
}`,
    walkthrough: [['Use atan2 for all quadrants', 'atan2 reads both vector components and returns the correct signed angle around the full circle.', 'Math.atan2(y, x)']],
  },
  {
    id: 'script-random-wander', category: 'Enemies and AI', level: 'Intermediate', title: 'Timed random wander',
    summary: 'Choose a new direction at intervals instead of generating noisy randomness every frame.',
    outcome: 'The object wanders in stable random directions.', physics: true,
    concepts: ['Timers', 'Random direction', 'Persistent state'],
    code: `api.state.changeAt ??= 0;

if (api.time >= api.state.changeAt) {
  const angle = Math.random() * Math.PI * 2;
  api.state.vx = Math.cos(angle) * 95;
  api.state.vy = Math.sin(angle) * 95;
  api.state.changeAt = api.time + 1.4;
}

api.setVelocity(api.state.vx, api.state.vy);`,
    walkthrough: [
      ['Gate randomness with a timer', 'The direction changes only after changeAt, which makes the motion readable.', 'if (api.time >= api.state.changeAt)'],
      ['Generate a unit direction', 'A random angle mapped through cosine and sine covers every direction evenly.', 'cos(angle), sin(angle)'],
    ],
  },
  {
    id: 'script-cooldown', category: 'Game rules', level: 'Intermediate', title: 'Reusable cooldown',
    summary: 'Express “this action may happen once every N seconds” with one timestamp.',
    outcome: 'Holding Space triggers a visible pulse at most twice per second.',
    concepts: ['Cooldown', 'Timestamp', 'Input gating'],
    code: `api.state.readyAt ??= 0;

if (api.keys.space && api.time >= api.state.readyAt) {
  api.state.readyAt = api.time + 0.5;
  api.state.flashUntil = api.time + 0.12;
}

const flashing = api.time < (api.state.flashUntil || 0);
api.setAlpha(flashing ? 0.35 : 1);`,
    walkthrough: [['Store the next legal time', 'Comparing the scene clock to readyAt avoids decrementing a separate timer every frame.', 'api.time >= api.state.readyAt']],
  },
  {
    id: 'script-ease-home', category: 'Math for games', level: 'Beginner', title: 'Ease back to a target',
    summary: 'Move a fixed percentage of the remaining distance each frame.',
    outcome: 'Arrow keys push the object; releasing them eases it home.',
    concepts: ['Linear interpolation', 'Asymptotic motion', 'Target following'],
    code: `const pushX = Number(api.keys.right) - Number(api.keys.left);
const pushY = Number(api.keys.down) - Number(api.keys.up);

if (pushX || pushY) api.move(pushX * 3, pushY * 3);
else api.setPosition(
  api.lerp(api.position.x, api.start.x, 0.08),
  api.lerp(api.position.y, api.start.y, 0.08)
);`,
    walkthrough: [['Lerp closes the distance', 'Each frame keeps most of the current value and takes a small step toward the target.', 'lerp(current, target, 0.08)']],
  },
];

