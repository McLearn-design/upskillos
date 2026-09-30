// Where every node of a scene is, from the saved data: world transforms and drawing
// order, computed exactly as the engine computes them (engine/game.ts), so the editor
// viewport shows what Run will show.

import type { NodeData, SceneData, Vec2 } from './types';
import { isA, propValue } from './registry';
import { IDENTITY, local, multiply, type Mat2D } from './math2d';

export interface PlacedNode {
  node: NodeData;
  /** Parent's world transform times its local one (identity for non-2D nodes). */
  world: Mat2D;
  /** Its parent's world transform: what its position is relative to. */
  parentWorld: Mat2D;
  /** It and all its ancestors are visible. */
  visible: boolean;
  /** Drawing order, as the engine: the sum of zIndex down the tree (a CanvasLayer starts its layer's band), then tree order. */
  depth: number;
  is2D: boolean;
  /** Under a CanvasLayer: placed on the screen, not in the world. */
  screen: boolean;
}

/** Every node, in tree order, with where it is and whether it is drawn. */
export function placeNodes(scene: SceneData): PlacedNode[] {
  const out: PlacedNode[] = [];
  let order = 0;
  const visit = (n: NodeData, parent: Mat2D, visible: boolean, z: number, screen: boolean) => {
    const is2D = isA(n.type, 'Node2D');
    let world = parent, vis = visible, zz = z, scr = screen;
    // A CanvasLayer's children are placed on the screen: their transforms start again from the origin.
    if (n.type === 'CanvasLayer') { world = IDENTITY; scr = true; zz = 1e6 * (propValue(n.type, n.props, 'layer') as number); }
    if (is2D) {
      world = multiply(parent, local(propValue(n.type, n.props, 'position') as Vec2, propValue(n.type, n.props, 'rotation') as number, propValue(n.type, n.props, 'scale') as Vec2));
      vis = visible && (propValue(n.type, n.props, 'visible') as boolean);
      zz = z + (propValue(n.type, n.props, 'zIndex') as number);
    }
    out.push({ node: n, world, parentWorld: n.type === 'CanvasLayer' ? IDENTITY : parent, visible: vis, depth: zz + (order++) * 1e-6, is2D, screen: scr });
    for (const c of n.children) visit(c, world, vis, zz, scr);
  };
  visit(scene.root, IDENTITY, true, 0, false);
  return out;
}
