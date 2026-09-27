const BLOCKED = [
  { pattern: /\b(?:for|while|do)\b/, message: 'Loops are disabled in per-frame scripts. Use api.time, api.delta, and state instead.' },
  { pattern: /\b(?:window|document|globalThis|self|parent|top)\b/, message: 'Browser globals are not available in Game Studio scripts.' },
  { pattern: /\b(?:fetch|XMLHttpRequest|WebSocket|Worker|importScripts)\b/, message: 'Network and worker APIs are not available in Game Studio scripts.' },
  { pattern: /\b(?:eval|Function|constructor|prototype|__proto__)\b/, message: 'Dynamic code construction is not available in Game Studio scripts.' },
  { pattern: /\b(?:import|export|class|function)\b/, message: 'Write the update body directly; declarations and modules are not needed here.' },
];

export function validateLearnerScript(source) {
  const code = String(source || '');
  if (code.length > 8000) return { valid: false, error: 'This script is too long for a per-frame object script.' };
  const blocked = BLOCKED.find(({ pattern }) => pattern.test(code));
  return blocked ? { valid: false, error: blocked.message } : { valid: true, error: '' };
}

export function compileLearnerScript(source) {
  const result = validateLearnerScript(source);
  if (!result.valid) throw new Error(result.error);
  // The narrow API is supplied by PhaserPreview. Blocking browser globals and
  // dynamic constructors keeps this beginner scripting surface local to the
  // selected game object. Long-running loop syntax is rejected above because
  // these scripts execute on the render thread once per frame.
  return new Function('api', `"use strict";\n${String(source || '')}`); // eslint-disable-line no-new-func
}

export const GAME_SCRIPT_API_REFERENCE = [
  ['api.delta', 'Seconds since the previous frame'],
  ['api.time', 'Seconds since this Play run started'],
  ['api.position', 'Current { x, y } position'],
  ['api.start', 'The object’s starting { x, y } position'],
  ['api.velocity', 'Current { x, y } body velocity'],
  ['api.scale', 'Current { x, y } display scale'],
  ['api.body.blockedDown', 'Whether a physics body is standing on something'],
  ['api.keys', 'left, right, up, down, and space booleans'],
  ['api.state', 'Persistent object owned by this script'],
  ['api.setPosition(x, y)', 'Move directly to a position'],
  ['api.setVelocity(x, y)', 'Set physics velocity'],
  ['api.move(dx, dy)', 'Move by an offset'],
  ['api.rotate(degrees)', 'Set rotation in degrees'],
  ['api.setScale(x, y)', 'Set visual scale (one value may be used for both axes)'],
  ['api.setAlpha(value)', 'Set opacity from 0 to 1'],
  ['api.clamp(value, min, max)', 'Keep a number inside a range'],
  ['api.lerp(a, b, amount)', 'Move a value partway toward a target'],
];
