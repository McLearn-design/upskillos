// The Phaser adapter (ADR 2): the only file that knows the game is drawn by Phaser.
// The engine hands it a list of what to draw each frame; it keeps one Phaser image
// per item, creating, updating and removing them to match.

import * as Phaser from 'phaser';
import type { DrawItem, Renderer } from '../engine/game';

export class PhaserRenderer implements Renderer {
  private images = new Map<number, Phaser.GameObjects.Image>();

  constructor(private scene: Phaser.Scene) {}

  frame(items: DrawItem[]): void {
    const seen = new Set<number>();
    for (const it of items) {
      seen.add(it.id);
      let img = this.images.get(it.id);
      if (!img || img.texture.key !== it.texture) {
        img?.destroy();
        img = this.scene.add.image(0, 0, this.scene.textures.exists(it.texture) ? it.texture : '__MISSING');
        this.images.set(it.id, img);
      }
      img.setPosition(it.x, it.y);
      img.setRotation(it.rotation);
      img.setScale(it.scaleX, it.scaleY);
      img.setFlip(it.flipX, it.flipY);
      img.setAlpha(it.alpha);
      img.setDepth(it.depth);
    }
    for (const [id, img] of this.images) if (!seen.has(id)) { img.destroy(); this.images.delete(id); }
  }
}
