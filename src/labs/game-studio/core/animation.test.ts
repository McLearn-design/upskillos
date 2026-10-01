// The sampling maths the engine and the timeline share.
import { describe, expect, it } from 'vitest';
import { applyClip, clipTime, sampleTrack, setKey, trackPath, withKey } from './animation';
import { Doc } from './doc';
import { newProject } from './project';
import { problems } from './serialize';
import type { AnimationTrack } from './types';

const track = (keys: [number, unknown][]): AnimationTrack => ({ path: 'X', property: 'p', keys: keys.map(([time, value]) => ({ time, value: value as never })) });

describe('sampling a track', () => {
  it('numbers move in a straight line between keys: a + (b − a)·f', () => {
    const t = track([[0, 10], [2, 30]]);
    expect(sampleTrack(t, 0.5, 'linear')).toBe(15);      // f = 0.25
    expect(sampleTrack(t, 1, 'linear')).toBe(20);
  });
  it('before the first key it holds the first value; after the last, the last', () => {
    const t = track([[1, 5], [2, 7]]);
    expect(sampleTrack(t, 0, 'linear')).toBe(5);
    expect(sampleTrack(t, 9, 'linear')).toBe(7);
  });
  it('vectors move in x and y together', () => {
    expect(sampleTrack(track([[0, { x: 0, y: 100 }], [1, { x: 50, y: 0 }]]), 0.2, 'linear')).toEqual({ x: 10, y: 80 });
  });
  it('colours blend in red, green and blue: halfway from black to #ff8000 is #804000', () => {
    expect(sampleTrack(track([[0, '#000000'], [1, '#ff8000']]), 0.5, 'color')).toBe('#804000');
  });
  it('a key is reached when the time adds up to it, even with rounding: thirty steps of 1/60 reach 0.5', () => {
    let t = 0; for (let i = 0; i < 30; i++) t += 1 / 60;
    expect(t).not.toBe(0.5);
    expect(sampleTrack(track([[0, false], [0.5, true]]), t, 'step')).toBe(true);
  });
  it('anything else jumps at each key', () => {
    const t = track([[0, false], [1, true]]);
    expect(sampleTrack(t, 0.99, 'step')).toBe(false);
    expect(sampleTrack(t, 1, 'step')).toBe(true);
  });
  it('a looping clip wraps round; one that does not stops at its end and says so', () => {
    expect(clipTime({ name: 'a', length: 2, loop: true, tracks: [] }, 5)).toEqual({ time: 1, finished: false });
    expect(clipTime({ name: 'a', length: 2, loop: false, tracks: [] }, 5)).toEqual({ time: 2, finished: true });
  });
  it('withKey keeps keys in time order and replaces one at the same time', () => {
    const t = withKey(withKey(track([[0, 1], [2, 3]]), 1, 2), 2, 9);
    expect(t.keys).toEqual([{ time: 0, value: 1 }, { time: 1, value: 2 }, { time: 2, value: 9 }]);
  });
});

describe('the problem report checks every track against the scene', () => {
  function withPlayer(tracks: AnimationTrack[], autoplay = '') {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    const box = d.addNode(s.id, 'Node2D', undefined, { name: 'Box' });
    d.addNode(s.id, 'AnimationPlayer', undefined, { name: 'Anim', props: { autoplay, animations: [{ name: 'go', length: 1, loop: false, tracks }] } });
    return { d, box };
  }
  it('a good track has no problems', () => {
    expect(problems(withPlayer([{ path: 'Box', property: 'position', keys: [{ time: 0, value: { x: 0, y: 0 } }] }], 'go').d.project)).toEqual([]);
  });
  it('names a missing node, a missing property, a wrong value, and an unknown autoplay', () => {
    const { d } = withPlayer([
      { path: 'Lid', property: 'position', keys: [] },
      { path: 'Box', property: 'texture', keys: [] },
      { path: 'Box', property: 'visible', keys: [{ time: 0.5, value: 3 }] },
    ], 'open');
    expect(problems(d.project)).toEqual([
      'scenes/main.scene: Anim: animation "go", track Lid.position: there is no node "Lid" (paths start at the AnimationPlayer\'s parent)',
      'scenes/main.scene: Anim: animation "go", track Box.texture: Node2D has no property "texture"',
      'scenes/main.scene: Anim: animation "go", track Box.visible: the key at 0.5 s: visible must be true or false',
      'scenes/main.scene: Anim: autoplay names "open", but there is no animation by that name',
    ]);
  });
  it('refuses keys out of order or outside the length', () => {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    const a = d.addNode(s.id, 'AnimationPlayer', undefined, { name: 'Anim' });
    const set = (keys: [number, number][]) => () => d.setProp(s.id, a.id, 'animations', [{ name: 'go', length: 1, loop: false, tracks: [{ path: '.', property: 'zIndex', keys: keys.map(([time, value]) => ({ time, value })) }] }]);
    expect(set([[0.5, 1], [0.2, 2]])).toThrow(/in time order/);
    expect(set([[1.5, 1]])).toThrow(/outside 0 to 1 s/);
  });
});

describe('the editor\u2019s preview and keying', () => {
  it('trackPath is the path from the player\u2019s parent; applyClip sets the animated values on a copy', () => {
    const d = new Doc(newProject());
    const s = d.createScene('scenes/main.scene');
    const box = d.addNode(s.id, 'Node2D', undefined, { name: 'Box' });
    const lid = d.addNode(s.id, 'Sprite2D', box.id, { name: 'Lid' });
    const anim = d.addNode(s.id, 'AnimationPlayer', undefined, { name: 'Anim' });
    const scene = d.scene(s.id);
    expect(trackPath(scene, anim.id, lid.id)).toBe('Box/Lid');
    expect(trackPath(scene, anim.id, scene.root.id)).toBe('.');
    const clips = setKey(setKey([{ name: 'open', length: 2, loop: false, tracks: [] }], 'open', 'Box/Lid', 'opacity', 0, 1), 'open', 'Box/Lid', 'opacity', 2, 0);
    const view = applyClip(scene, anim.id, clips[0], 0.5);
    expect(view.root.children[0].children[0].props.opacity).toBe(0.75);
    expect(d.scene(s.id).root.children[0].children[0].props.opacity).toBeUndefined();   // the project is untouched
  });
});
