// Chapter 3 of the course, "Camera and HUD": a camera that follows, its limits, and a HUD that
// stays on the screen (docs/game-studio-course-plan.md).

import type { GameTask } from './types';
import { CHAR, GROUND, PLATFORMER, REST, block, player } from './physics';
import { childrenOf, named, noErrors, type Body } from './helpers';
import { Camera2D, type Node } from '../engine/nodes';
import type { Game } from '../engine/game';

/** A level 3000 pixels long: much wider than the 960-pixel screen. */
const level = `scene = project.createScene('scenes/main.scene', 'Node2D', 'Main')
${block('Floor', 1500, 420, 3000, 40)}
${player(200, REST, PLATFORMER)}`;
const camera = `scene.add('Camera2D', { name: 'Camera', parent: 'Player', smoothing: 5 })`;
const limited = `${camera.replace("smoothing: 5 }", "smoothing: 5, limitTopLeft: { x: 0, y: 0 }, limitBottomRight: { x: 3000, y: 540 } }")}`;

export const CAMERA_HUD: GameTask[] = [
  {
    id: 'follow-camera',
    chain: 'Camera and HUD',
    title: 'A camera that follows',
    goal: 'The level is 3000 pixels long and the screen 960: make the view follow the player.',
    images: [CHAR, GROUND],
    start: level,
    steps: [
      { text: 'Add a Camera2D under Player. A camera under a node goes where it goes.',
        check: { kind: 'project', test: (v) => childrenOf(v.byName('Player'), 'Camera2D').length > 0 || 'There is no Camera2D under Player yet.' } },
      { text: 'Run it and walk right: the camera keeps Player in the middle of the screen.',
        check: { kind: 'play', test: async (v) => {
          // Smoothing off for this check: the camera should be exactly on Player.
          const r = await v.play({ seconds: 3, keys: ['ArrowRight'], setup: (g) => { for (const c of cameras(g)) c.smoothing = 0; } });
          noErrors(r); const p = named<Body>(r.game, 'Player')!;
          return Math.abs(r.view.x - p.position.x) < 2 || `The view is centred at x ${Math.round(r.view.x)}, Player is at ${Math.round(p.position.x)}.`;
        } } },
      { text: 'Smooth it: set the camera’s smoothing to 5. It lags a little behind Player, then catches up.', hint: 'Each frame the camera moves 1 − e^(−smoothing·dt) of the way to Player: a fixed fraction, so it slows as it nears.',
        check: { kind: 'play', test: async (v) => {
          let gap = 0;
          const r = await v.play({ seconds: 3, keys: ['ArrowRight'], watch: (g, view) => { gap = Math.max(gap, Math.abs(named<Body>(g, 'Player')!.position.x - view.x)); } });
          noErrors(r);
          return (gap > 5 && gap < 200) || (gap <= 5 ? 'The camera follows exactly: give it some smoothing.' : 'The camera falls a long way behind: smoothing around 5 keeps up.');
        } } },
    ],
    solution: camera,
    done: 'The view follows. Back in the lesson: smoothing as 1 − e^(−k·dt), and why it does not depend on the frame rate.',
  },
  {
    id: 'camera-limits',
    chain: 'Camera and HUD',
    title: 'Camera limits',
    goal: 'Stop the camera at the level’s edges, so nothing past them ever shows.',
    images: [CHAR, GROUND],
    start: `${level}\n${camera}`,
    steps: [
      { text: 'Player starts near the left end, so the view shows empty space left of x 0. Set the camera’s limitTopLeft x to 0.', hint: 'The screen is 960 wide, so the view’s centre can come no closer than 480 to a limit.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 1 }); noErrors(r); return r.view.x >= 479 || `The view is centred at x ${Math.round(r.view.x)}, so it shows ${Math.round(480 - r.view.x)} px left of the level.`; } } },
      { text: 'And the right end: limitBottomRight x 3000.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 3, setup: (g) => { const p = named<Body>(g, 'Player')!; p.position = { x: 2950, y: p.position.y }; } }); noErrors(r); return r.view.x <= 2521 || `At the right end the view is centred at x ${Math.round(r.view.x)}: it shows past 3000.`; } } },
      { text: 'And the bottom: limitBottomRight y 540, so nothing below the floor shows.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 2 }); noErrors(r); return r.view.y <= 271 || `The view is centred at y ${Math.round(r.view.y)}: it shows ${Math.round(r.view.y + 270 - 540)} px below the level.`; } } },
    ],
    solution: `scene.get('Player/Camera').limitTopLeft = { x: 0, y: 0 }\nscene.get('Player/Camera').limitBottomRight = { x: 3000, y: 540 }`,
    done: 'The camera stays inside the level. Back in the lesson: clamping the centre to half a screen inside each limit.',
  },
  {
    id: 'hud',
    chain: 'Camera and HUD',
    title: 'A HUD that stays put',
    goal: 'A score in the corner of the screen, which does not scroll away with the level.',
    images: [CHAR, GROUND],
    start: `${level}\n${limited}`,
    steps: [
      { text: 'Add a Label named Score with the text "Score: 0", near the top-left corner.',
        check: { kind: 'project', test: (v) => { const l = v.byName('Score'); return (l?.type === 'Label' && /score/i.test(String(v.prop(l, 'text')))) || 'There is no Label called Score showing "Score: 0".'; } } },
      { text: 'Run and walk right: the score scrolls away with the level. Add a CanvasLayer named HUD and drag Score into it: a CanvasLayer’s children are drawn on the screen, not in the world.',
        check: { kind: 'play', test: async (v) => { const r = await v.play({ seconds: 3, keys: ['ArrowRight'] }); noErrors(r); const t = r.drawn.find((i) => i.kind === 'text' && /score/i.test((i as { text: string }).text)); if (!t) return 'The Score label is not drawn.'; return t.screen || 'Score is drawn in the world, so it scrolls: put it under a CanvasLayer.'; } } },
    ],
    solution: `scene.add('CanvasLayer', { name: 'HUD' })\nscene.add('Label', { name: 'Score', parent: 'HUD', position: { x: 16, y: 12 }, fontSize: 24, text: 'Score: 0' })`,
    done: 'The score stays in the corner. Back in the lesson: two cameras, one for the world and one for the screen.',
  },
];

/** Every Camera2D in a running game (a learner may name theirs anything). */
function cameras(g: Game): Camera2D[] {
  const out: Camera2D[] = [];
  const visit = (n: Node) => { if (n instanceof Camera2D) out.push(n); n.children.forEach(visit); };
  visit(g.root);
  return out;
}
