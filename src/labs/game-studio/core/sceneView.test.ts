// The editor draws the picture the game would show: spriteLook agrees with the engine.
import { describe, expect, it } from 'vitest';
import { Doc } from './doc';
import { newProject } from './project';
import { spriteLook } from './sceneView';
import { Game, type DrawItem } from '../engine/game';

describe('spriteLook', () => {
  it('shows the same picture as the engine, for every frame of an AnimatedSprite2D, flipped and faded alike', () => {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    for (const n of ['a', 'b', 'c']) d.importAsset(`assets/${n}.png`, { mime: 'image/png', width: 8, height: 8 });
    const a = d.addNode(s.id, 'AnimatedSprite2D', undefined, { name: 'A', props: { frames: [{ name: 'run', fps: 4, loop: true, frames: ['assets/a.png', 'assets/b.png', 'assets/c.png'] }], animation: 'run', playing: false, flipX: true, opacity: 0.5 } });
    for (const frame of [0, 1, 2]) {
      d.setProp(s.id, a.id, 'frame', frame);
      let drawn: DrawItem | undefined;
      new Game(d.project, d.scene(s.id), { frame: (items) => { drawn = items[0]; } }).start();
      const look = spriteLook(d.node(s.id, a.id)!)!;
      expect(drawn).toMatchObject({ kind: 'sprite', texture: look.texture, flipX: look.flipX, alpha: look.opacity });
    }
    expect(spriteLook(d.node(s.id, a.id)!)!.texture).toBe('assets/c.png');
  });

  it('is null for nodes that show no picture', () => {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    expect(spriteLook(d.addNode(s.id, 'Label', undefined))).toBe(null);
  });
});

describe('the Animation panel’s preview and the game agree', () => {
  it('at every time, applyClip gives the values the engine’s AnimationPlayer sets: position, rotation, colour and visibility', async () => {
    const { applyClip } = await import('./animation');
    const { AnimationPlayer, Label, Node2D } = await import('../engine/nodes');
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    d.addNode(s.id, 'Node2D', undefined, { name: 'Box' });
    d.addNode(s.id, 'Label', undefined, { name: 'Text' });
    const clip = { name: 'show', length: 2, loop: true, tracks: [
      { path: 'Box', property: 'position', keys: [{ time: 0, value: { x: 0, y: 0 } }, { time: 0.8, value: { x: 40, y: -20 } }, { time: 2, value: { x: 100, y: 0 } }] },
      { path: 'Box', property: 'rotation', keys: [{ time: 0.5, value: 0 }, { time: 1.5, value: 3 }] },
      { path: 'Box', property: 'visible', keys: [{ time: 0, value: true }, { time: 1, value: false }] },
      { path: 'Text', property: 'color', keys: [{ time: 0, value: '#000000' }, { time: 2, value: '#ff8040' }] },
    ] };
    const p = d.addNode(s.id, 'AnimationPlayer', undefined, { name: 'Anim', props: { animations: [clip] } });
    const g = new Game(d.project, d.scene(s.id), { frame: () => undefined });
    g.start();
    const anim = g.root.get<InstanceType<typeof AnimationPlayer>>('Anim');
    anim.play('show');
    for (const t of [0, 0.3, 0.8, 1, 1.37, 1.999, 2.5]) {
      anim.seek(t);
      const view = applyClip(d.scene(s.id), p.id, clip, t);
      const box = view.root.children.find((c) => c.name === 'Box')!, text = view.root.children.find((c) => c.name === 'Text')!;
      const eBox = g.root.get<InstanceType<typeof Node2D>>('Box'), eText = g.root.get<InstanceType<typeof Label>>('Text');
      expect(box.props.position, `position at ${t}`).toEqual({ x: eBox.position.x, y: eBox.position.y });
      expect(box.props.rotation, `rotation at ${t}`).toBe(eBox.rotation);
      expect(box.props.visible, `visible at ${t}`).toBe(eBox.visible);
      expect(text.props.color, `colour at ${t}`).toBe(eText.color);
    }
  });
});
