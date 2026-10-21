import Phaser from 'phaser';
import { AirplaneState } from '../core/airplane/AirplaneModel';

interface TrailPoint {
  x: number;
  y: number;
  alpha: number;
}

export class AirplaneRenderer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private planeSprite: Phaser.GameObjects.Sprite;
  private trailGraphics: Phaser.GameObjects.Graphics;
  private touchReticle: Phaser.GameObjects.Graphics;
  private trailPoints: TrailPoint[] = [];
  private maxTrailPoints: number = 24;
  private trailTimer: number = 0;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    // Create airplane texture if not already cached
    this.ensureAirplaneTexture();

    // Graphics for the smoke/contrail behind the plane
    this.trailGraphics = this.scene.add.graphics();
    this.trailGraphics.setDepth(5);

    // Reticle for touch target indicator
    this.touchReticle = this.scene.add.graphics();
    this.touchReticle.setDepth(6);

    // Airplane Sprite
    this.planeSprite = this.scene.add.sprite(0, 0, 'airplane_texture');
    this.planeSprite.setOrigin(0.45, 0.5); // Center slightly towards wing center

    // Outer container
    this.container = this.scene.add.container(0, 0, [this.planeSprite]);
    this.container.setDepth(10);
  }

  private ensureAirplaneTexture(): void {
    if (this.scene.textures.exists('airplane_texture')) {
      return;
    }

    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 56;
    const h = 44;
    const cx = w * 0.45;
    const cy = h * 0.5;

    // 1. Wings (Swept back delta wings)
    g.fillStyle(0xd97706, 1); // Amber/gold primary
    g.beginPath();
    g.moveTo(cx + 8, cy);       // Wing root front
    g.lineTo(cx - 10, cy - 20); // Left wing tip
    g.lineTo(cx - 16, cy - 18); // Left wing back
    g.lineTo(cx - 6, cy);       // Wing root back
    g.lineTo(cx - 16, cy + 18); // Right wing back
    g.lineTo(cx - 10, cy + 20); // Right wing tip
    g.closePath();
    g.fillPath();

    // Wing edge highlights
    g.lineStyle(1.5, 0xfef08a, 0.9);
    g.beginPath();
    g.moveTo(cx + 8, cy);
    g.lineTo(cx - 10, cy - 20);
    g.moveTo(cx + 8, cy);
    g.lineTo(cx - 10, cy + 20);
    g.strokePath();

    // 2. Wingtip aviation navigation lights
    // Left / Port (Red)
    g.fillStyle(0xef4444, 1);
    g.fillCircle(cx - 10, cy - 19, 2);
    // Right / Starboard (Green)
    g.fillStyle(0x10b981, 1);
    g.fillCircle(cx - 10, cy + 19, 2);

    // 3. Tail stabilizers
    g.fillStyle(0xb45309, 1);
    g.beginPath();
    g.moveTo(cx - 14, cy);
    g.lineTo(cx - 24, cy - 10);
    g.lineTo(cx - 26, cy - 8);
    g.lineTo(cx - 20, cy);
    g.lineTo(cx - 26, cy + 8);
    g.lineTo(cx - 24, cy + 10);
    g.closePath();
    g.fillPath();

    // 4. Fuselage (Fusiform body facing Right / +X)
    g.fillStyle(0xf59e0b, 1);
    g.beginPath();
    g.moveTo(cx + 24, cy);       // Sharp nose tip
    g.lineTo(cx + 12, cy - 6);   // Nose top
    g.lineTo(cx - 16, cy - 5);   // Mid body top
    g.lineTo(cx - 22, cy - 2);   // Tail top
    g.lineTo(cx - 22, cy + 2);   // Tail bottom
    g.lineTo(cx - 16, cy + 5);   // Mid body bottom
    g.lineTo(cx + 12, cy + 6);   // Nose bottom
    g.closePath();
    g.fillPath();

    // Fuselage border
    g.lineStyle(1.5, 0x78350f, 0.8);
    g.strokePath();

    // 5. Cockpit canopy (Glass cyan highlight)
    g.fillStyle(0x38bdf8, 1);
    g.beginPath();
    g.moveTo(cx + 14, cy);
    g.lineTo(cx + 4, cy - 3.5);
    g.lineTo(cx - 4, cy - 3.5);
    g.lineTo(cx - 6, cy);
    g.lineTo(cx - 4, cy + 3.5);
    g.lineTo(cx + 4, cy + 3.5);
    g.closePath();
    g.fillPath();

    // Canopy glass glint
    g.fillStyle(0xffffff, 0.8);
    g.fillRect(cx - 1, cy - 2, 4, 1.5);

    // 6. Engine nozzle / exhaust tip
    g.fillStyle(0x334155, 1);
    g.fillRect(cx - 24, cy - 2.5, 3, 5);

    g.generateTexture('airplane_texture', w, h);
    g.destroy();
  }

  public update(state: AirplaneState, dt: number, targetPos: { x: number; y: number } | null): void {
    // 1. Update position and rotation
    this.container.setPosition(state.x, state.y);
    this.container.setRotation(state.angle);

    // 2. Manage smoke contrails behind the jet exhaust
    this.trailTimer += dt;
    if (this.trailTimer >= 0.035) {
      this.trailTimer = 0;
      // Tail position in world coordinates (22px behind plane center)
      const tailX = state.x - Math.cos(state.angle) * 20;
      const tailY = state.y - Math.sin(state.angle) * 20;
      this.trailPoints.unshift({ x: tailX, y: tailY, alpha: 0.65 });
      if (this.trailPoints.length > this.maxTrailPoints) {
        this.trailPoints.pop();
      }
    }

    // 3. Render contrail
    this.trailGraphics.clear();
    for (let i = 0; i < this.trailPoints.length; i++) {
      const pt = this.trailPoints[i];
      pt.alpha -= dt * 0.7;
      if (pt.alpha <= 0) continue;

      const progress = i / this.trailPoints.length;
      const radius = 2.5 + progress * 4.5;
      this.trailGraphics.fillStyle(0xffffff, Math.max(0, pt.alpha * (1 - progress * 0.7)));
      this.trailGraphics.fillCircle(pt.x, pt.y, radius);
    }
    this.trailPoints = this.trailPoints.filter((p) => p.alpha > 0.02);

    // 4. Render touch indicator if active
    this.touchReticle.clear();
    if (targetPos) {
      // Outer ring
      this.touchReticle.lineStyle(1.5, 0x38bdf8, 0.6);
      this.touchReticle.strokeCircle(targetPos.x, targetPos.y, 16);
      // Center dot
      this.touchReticle.fillStyle(0x38bdf8, 0.8);
      this.touchReticle.fillCircle(targetPos.x, targetPos.y, 4);

      // Subtle guide line from plane to target
      this.touchReticle.lineStyle(1, 0x38bdf8, 0.25);
      this.touchReticle.lineBetween(state.x, state.y, targetPos.x, targetPos.y);
    }
  }

  public destroy(): void {
    this.container.destroy();
    this.trailGraphics.destroy();
    this.touchReticle.destroy();
  }
}
