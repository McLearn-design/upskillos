import { useEffect, useRef } from 'react';
import * as Phaser from 'phaser';
import { compileLearnerScript } from './scriptRuntime';

function numericColor(value) {
  return Number.parseInt(String(value || '#ffffff').slice(1), 16);
}

export default function PhaserPreview({ project, scene }) {
  const hostRef = useRef(null);

  useEffect(() => {
    if (!hostRef.current) return undefined;

    class PreviewScene extends Phaser.Scene {
      create() {
        this.objects = [];
        this.cursors = this.input.keyboard.createCursorKeys();
        this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);
        this.score = 0;
        this.gameEnded = false;
        this.lastHazardAt = 0;
        scene.entities.forEach((entity, index) => {
          const { transform, display } = entity;
          let object;
          if (entity.type === 'text') {
            object = this.add.text(transform.x, transform.y, display.text || entity.name, {
              color: display.color,
              fontFamily: 'Inter, system-ui, sans-serif',
              fontSize: `${display.fontSize}px`,
              align: 'center',
            }).setOrigin(0.5);
          } else if (entity.type === 'circle') {
            object = this.add.circle(transform.x, transform.y, Math.min(display.width, display.height) / 2, numericColor(display.color));
          } else {
            object = this.add.rectangle(transform.x, transform.y, display.width, display.height, numericColor(display.color));
          }
          object.setRotation(Phaser.Math.DegToRad(transform.rotation));
          object.setScale(transform.scaleX, transform.scaleY);
          const gameplayBody = entity.gameplay?.role && entity.gameplay.role !== 'none';
          if ((entity.physics.enabled || gameplayBody) && entity.type !== 'text') {
            const staticBody = entity.physics.body === 'static' || ['collectible', 'goal'].includes(entity.gameplay?.role);
            this.physics.add.existing(object, staticBody);
            object.body.setCollideWorldBounds?.(entity.physics.collideWorldBounds);
            object.body.setBounce?.(entity.physics.bounce);
            if (entity.behavior.type === 'bounce' && entity.physics.body !== 'static') {
              const angle = Phaser.Math.DegToRad(35 + index * 47);
              object.body.setVelocity(Math.cos(angle) * entity.behavior.speed, Math.sin(angle) * entity.behavior.speed);
            }
          }
          let runScript = null;
          let scriptError = '';
          if (entity.script?.enabled && entity.script.source.trim()) {
            try {
              runScript = compileLearnerScript(entity.script.source);
            } catch (error) {
              scriptError = error.message;
            }
          }
          this.objects.push({ entity, object, startX: transform.x, startY: transform.y, direction: 1, runScript, scriptError, scriptState: {}, scriptVelocity: null });
        });
        const players = this.objects.filter(({ entity }) => entity.gameplay?.role === 'player' || ['topDown', 'platformer'].includes(entity.behavior.type));
        const solids = this.objects.filter(({ entity, object }) => object.body && entity.gameplay?.role === 'none' && entity.physics.enabled);
        const staticSolids = solids.filter(({ object }) => object.body.isStatic);
        const dynamicSolids = solids.filter(({ object }) => !object.body.isStatic);
        const collectibles = this.objects.filter(({ entity }) => entity.gameplay?.role === 'collectible');
        const hazards = this.objects.filter(({ entity }) => entity.gameplay?.role === 'hazard');
        const goals = this.objects.filter(({ entity }) => entity.gameplay?.role === 'goal');
        this.lives = players[0]?.entity.gameplay?.lives || 3;
        this.collectibleTarget = collectibles.reduce((sum, item) => sum + Number(item.entity.gameplay?.points || 1), 0);

        players.forEach((player) => staticSolids.forEach((solid) => this.physics.add.collider(player.object, solid.object)));
        hazards.forEach((hazard) => staticSolids.forEach((solid) => this.physics.add.collider(hazard.object, solid.object, () => { hazard.direction *= -1; })));
        dynamicSolids.forEach((mover) => staticSolids.forEach((solid) => this.physics.add.collider(mover.object, solid.object)));
        players.forEach((player) => {
          collectibles.forEach((item) => this.physics.add.overlap(player.object, item.object, () => this.collectItem(item)));
          hazards.forEach((hazard) => this.physics.add.overlap(player.object, hazard.object, () => this.hitHazard(player)));
          goals.forEach((goal) => this.physics.add.overlap(player.object, goal.object, () => this.reachGoal()));
        });

        if (project.settings.showHud && (collectibles.length || hazards.length)) {
          this.hud = this.add.text(18, 16, '', { color: '#f8fafc', fontFamily: 'Inter, system-ui, sans-serif', fontSize: '20px', fontStyle: 'bold' }).setDepth(1000);
          this.updateHud();
        }
        const firstScriptError = this.objects.find((item) => item.scriptError);
        if (firstScriptError) this.showMessage(`SCRIPT ERROR\n${firstScriptError.entity.name}: ${firstScriptError.scriptError}`, '#fb7185');
      }

      updateHud() {
        this.hud?.setText(`SCORE  ${this.score} / ${this.collectibleTarget}     LIVES  ${this.lives}`);
      }

      showMessage(text, color = '#fbbf24') {
        this.message?.destroy();
        this.message = this.add.text(project.settings.width / 2, project.settings.height / 2, text, {
          color,
          fontFamily: 'Inter, system-ui, sans-serif',
          fontSize: '42px',
          fontStyle: 'bold',
          align: 'center',
          backgroundColor: '#020617dd',
          padding: { x: 24, y: 16 },
        }).setOrigin(0.5).setDepth(2000);
      }

      collectItem(item) {
        if (!item.object.active || this.gameEnded) return;
        item.object.disableBody?.(true, true);
        if (!item.object.disableBody) item.object.destroy();
        this.score += Number(item.entity.gameplay?.points || 1);
        this.updateHud();
        if (this.collectibleTarget > 0 && this.score >= this.collectibleTarget) {
          this.gameEnded = true;
          this.showMessage('MAZE CLEARED!\nYou collected every energy dot.', '#34d399');
        }
      }

      hitHazard(player) {
        if (this.gameEnded || this.time.now - this.lastHazardAt < 900) return;
        this.lastHazardAt = this.time.now;
        this.lives -= 1;
        player.object.setPosition(player.startX, player.startY);
        player.object.body?.setVelocity(0, 0);
        this.cameras.main.flash(180, 244, 63, 94);
        this.updateHud();
        if (this.lives <= 0) {
          this.gameEnded = true;
          this.showMessage('GAME OVER\nStop and Play to try again.', '#fb7185');
        }
      }

      reachGoal() {
        if (this.gameEnded) return;
        if (this.collectibleTarget === 0 || this.score >= this.collectibleTarget) {
          this.gameEnded = true;
          this.showMessage('LEVEL COMPLETE!', '#34d399');
        }
      }

      update() {
        if (this.gameEnded) return;
        this.objects.forEach((item) => {
          const { entity, object } = item;
          if (!object.active) return;
          const speed = entity.behavior.speed;
          if (entity.behavior.type === 'topDown') {
            let dx = 0;
            let dy = 0;
            if (this.cursors.left.isDown) dx -= 1;
            if (this.cursors.right.isDown) dx += 1;
            if (this.cursors.up.isDown) dy -= 1;
            if (this.cursors.down.isDown) dy += 1;
            const length = Math.hypot(dx, dy) || 1;
            if (object.body && !object.body.isStatic) object.body.setVelocity((dx / length) * speed, (dy / length) * speed);
            else {
              object.x = Phaser.Math.Clamp(object.x + (dx / length) * speed * (this.game.loop.delta / 1000), 0, project.settings.width);
              object.y = Phaser.Math.Clamp(object.y + (dy / length) * speed * (this.game.loop.delta / 1000), 0, project.settings.height);
            }
          }
          if (entity.behavior.type === 'platformer' && object.body) {
            const dx = (this.cursors.left.isDown ? -1 : 0) + (this.cursors.right.isDown ? 1 : 0);
            object.body.setVelocityX(dx * speed);
            if (Phaser.Input.Keyboard.JustDown(this.spaceKey) && object.body.blocked.down) object.body.setVelocityY(-Math.max(320, speed * 1.7));
          }
          if (entity.behavior.type === 'patrol' && object.body) {
            const axis = entity.behavior.axis === 'y' ? 'y' : 'x';
            const start = axis === 'x' ? item.startX : item.startY;
            const current = axis === 'x' ? object.x : object.y;
            if (current >= start + entity.behavior.range) item.direction = -1;
            if (current <= start - entity.behavior.range) item.direction = 1;
            if (axis === 'x') object.body.setVelocityX(speed * item.direction);
            else object.body.setVelocityY(speed * item.direction);
          }
          if (item.runScript) {
            const delta = this.game.loop.delta / 1000;
            const velocity = object.body?.velocity || item.scriptVelocity || { x: 0, y: 0 };
            const api = {
              delta,
              time: this.time.now / 1000,
              position: { x: object.x, y: object.y },
              start: { x: item.startX, y: item.startY },
              velocity: { x: velocity.x || 0, y: velocity.y || 0 },
              scale: { x: object.scaleX, y: object.scaleY },
              body: { blockedDown: Boolean(object.body?.blocked?.down) },
              keys: {
                left: this.cursors.left.isDown,
                right: this.cursors.right.isDown,
                up: this.cursors.up.isDown,
                down: this.cursors.down.isDown,
                space: this.spaceKey.isDown,
              },
              state: item.scriptState,
              setPosition: (x, y) => object.setPosition(Number(x), Number(y)),
              setVelocity: (x, y) => {
                if (object.body && !object.body.isStatic) object.body.setVelocity(Number(x), Number(y));
                else item.scriptVelocity = { x: Number(x), y: Number(y) };
              },
              move: (dx, dy) => object.setPosition(object.x + Number(dx), object.y + Number(dy)),
              rotate: (degrees) => object.setAngle(Number(degrees)),
              setScale: (x, y = x) => object.setScale(Number(x), Number(y)),
              setAlpha: (value) => object.setAlpha(Phaser.Math.Clamp(Number(value), 0, 1)),
              clamp: Phaser.Math.Clamp,
              lerp: Phaser.Math.Linear,
            };
            try {
              item.runScript(api);
              if (item.scriptVelocity && (!object.body || object.body.isStatic)) object.setPosition(object.x + item.scriptVelocity.x * delta, object.y + item.scriptVelocity.y * delta);
            } catch (error) {
              item.runScript = null;
              this.showMessage(`SCRIPT ERROR\n${entity.name}: ${error.message}`, '#fb7185');
            }
          }
        });
      }
    }

    const game = new Phaser.Game({
      type: Phaser.AUTO,
      parent: hostRef.current,
      width: project.settings.width,
      height: project.settings.height,
      backgroundColor: project.settings.background,
      scene: PreviewScene,
      physics: { default: 'arcade', arcade: { gravity: { y: project.settings.gravityY }, debug: false } },
      scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
      render: { antialias: true, pixelArt: false },
    });
    return () => game.destroy(true);
  }, [project, scene]);

  return <div ref={hostRef} className="h-full min-h-0 w-full overflow-hidden bg-slate-950" aria-label="Running Phaser game preview" />;
}
