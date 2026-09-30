// The Phaser adapter (ADR 2): the only file that knows the game is drawn by Phaser.
// The engine hands it a list of what to draw and where the camera looks, each frame;
// it keeps one Phaser object per item, creating, updating and removing them to match.
//
// Two Phaser cameras: the main one looks at the world (it moves and zooms with the
// engine's view); a second one draws what is on the screen (under a CanvasLayer), so a
// HUD never moves or zooms. Each object is shown to exactly one of them.

import * as Phaser from 'phaser';
import type { DrawItem, Renderer, View } from '../engine/game';

type Obj = Phaser.GameObjects.Image | Phaser.GameObjects.Text;

export class PhaserRenderer implements Renderer {
  private objects = new Map<number, { obj: Obj; kind: DrawItem['kind']; screen: boolean }>();
  private ui: Phaser.Cameras.Scene2D.Camera;

  constructor(private scene: Phaser.Scene) {
    const { width, height } = scene.scale;
    this.ui = scene.cameras.add(0, 0, width, height, false, 'screen');
  }

  frame(items: DrawItem[], view: View): void {
    const main = this.scene.cameras.main;
    main.setZoom(view.zoom);
    main.centerOn(view.x, view.y);
    const seen = new Set<number>();
    for (const it of items) {
      seen.add(it.id);
      let rec = this.objects.get(it.id);
      const wrongImage = rec && it.kind === 'sprite' && (rec.obj as Phaser.GameObjects.Image).texture.key !== it.texture;
      if (!rec || rec.kind !== it.kind || rec.screen !== it.screen || wrongImage) {
        rec?.obj.destroy();
        const obj: Obj = it.kind === 'sprite'
          ? this.scene.add.image(0, 0, this.scene.textures.exists(it.texture) ? it.texture : '__MISSING')
          : this.scene.add.text(0, 0, '', { fontFamily: 'system-ui, sans-serif' }).setOrigin(0, 0);
        // Each object is drawn by one camera only.
        (it.screen ? main : this.ui).ignore(obj);
        rec = { obj, kind: it.kind, screen: it.screen };
        this.objects.set(it.id, rec);
      }
      const o = rec.obj;
      o.setPosition(it.x, it.y);
      o.setRotation(it.rotation);
      o.setScale(it.scaleX, it.scaleY);
      o.setAlpha(it.alpha);
      o.setDepth(it.depth);
      if (it.kind === 'sprite') (o as Phaser.GameObjects.Image).setFlip(it.flipX, it.flipY);
      else {
        const t = o as Phaser.GameObjects.Text;
        if (t.text !== it.text) t.setText(it.text);
        t.setFontSize(it.fontSize);
        t.setColor(it.color);
      }
    }
    for (const [id, rec] of this.objects) if (!seen.has(id)) { rec.obj.destroy(); this.objects.delete(id); }
  }
}
