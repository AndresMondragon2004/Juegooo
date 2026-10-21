import Phaser from 'phaser';
import { MissileModel } from '../core/missile/MissileModel';

interface SmokeTrailPoint {
  x: number;
  y: number;
  alpha: number;
  radius: number;
  color: number;
}

interface DestructionEffect {
  x: number;
  y: number;
  radius: number;
  maxRadius: number;
  alpha: number;
  color: number;
  active: boolean;
  duration?: number;
  age?: number;
}

export class MissileRenderer {
  private scene: Phaser.Scene;
  private container: Phaser.GameObjects.Container;
  private sprite: Phaser.GameObjects.Sprite;
  private trailGraphics: Phaser.GameObjects.Graphics;
  private effectGraphics: Phaser.GameObjects.Graphics;
  private smokePoints: SmokeTrailPoint[] = [];
  private maxSmokePoints: number = 24;
  private smokeTimer: number = 0;
  private currentEffect: DestructionEffect | null = null;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.ensureMissileTextures();

    // 1. Graphics for rocket exhaust smoke trail
    this.trailGraphics = this.scene.add.graphics();
    this.trailGraphics.setDepth(6);

    // 2. Graphics for discrete collision / disintegration effect
    this.effectGraphics = this.scene.add.graphics();
    this.effectGraphics.setDepth(12);

    // 3. Missile sprite
    this.sprite = this.scene.add.sprite(0, 0, 'missile_homing_texture');
    this.sprite.setOrigin(0.5, 0.5);

    // 4. Missile container
    this.container = this.scene.add.container(-9999, -9999, [this.sprite]);
    this.container.setDepth(9);
    this.container.setVisible(false);
  }

  private ensureMissileTextures(): void {
    // 1. Homing texture (with active thruster flame)
    if (!this.scene.textures.exists('missile_homing_texture')) {
      this.bakeMissileTexture('missile_homing_texture', true);
    }

    // 2. Ballistic texture (engine flameout / empty thruster)
    if (!this.scene.textures.exists('missile_ballistic_texture')) {
      this.bakeMissileTexture('missile_ballistic_texture', false);
    }
  }

  private bakeMissileTexture(key: string, hasThrustFlame: boolean): void {
    const g = this.scene.make.graphics({ x: 0, y: 0 });
    const w = 44;
    const h = 22;
    const cx = w * 0.45;
    const cy = h * 0.5;

    // 1. Stabilizer fins (swept back)
    g.fillStyle(0xdc2626, 1); // Red fins
    g.beginPath();
    g.moveTo(cx - 4, cy - 3.5);
    g.lineTo(cx - 12, cy - 9);
    g.lineTo(cx - 15, cy - 8);
    g.lineTo(cx - 11, cy - 3.5);
    g.closePath();
    g.fillPath();

    g.beginPath();
    g.moveTo(cx - 4, cy + 3.5);
    g.lineTo(cx - 12, cy + 9);
    g.lineTo(cx - 15, cy + 8);
    g.lineTo(cx - 11, cy + 3.5);
    g.closePath();
    g.fillPath();

    // 2. Rocket nozzle
    g.fillStyle(0x334155, 1); // Dark metal
    g.fillRect(cx - 14, cy - 3, 3, 6);

    // 3. Missile cylindrical fuselage
    g.fillStyle(0xf8fafc, 1); // White body
    g.beginPath();
    g.moveTo(cx - 11, cy - 4);
    g.lineTo(cx + 6, cy - 4);
    g.lineTo(cx + 6, cy + 4);
    g.lineTo(cx - 11, cy + 4);
    g.closePath();
    g.fillPath();

    // Fuselage outline
    g.lineStyle(1, 0x64748b, 0.8);
    g.strokeRect(cx - 11, cy - 4, 17, 8);

    // 4. Warhead nosecone (conical sharp front)
    g.fillStyle(0xef4444, 1); // Danger Red nose
    g.beginPath();
    g.moveTo(cx + 6, cy - 4);
    g.lineTo(cx + 17, cy); // Sharp nose tip
    g.lineTo(cx + 6, cy + 4);
    g.closePath();
    g.fillPath();

    // 5. Warning stripe on fuselage
    g.fillStyle(0xf59e0b, 1); // Amber stripe
    g.fillRect(cx - 2, cy - 3.5, 3, 7);

    // 6. Thrust glow at nozzle (only in HOMING state)
    if (hasThrustFlame) {
      g.fillStyle(0xfbbf24, 0.95);
      g.fillCircle(cx - 15, cy, 2.5);
    }

    g.generateTexture(key, w, h);
    g.destroy();
  }

  /**
   * Triggers a discrete impact visual signal at collision coordinates.
   */
  public triggerImpact(x: number, y: number): void {
    this.currentEffect = {
      x,
      y,
      radius: 4,
      maxRadius: 30,
      alpha: 0.95,
      color: 0xf97316,
      active: true
    };
  }

  /**
   * Triggers a discrete burnout/disintegration effect when fuel is exhausted.
   */
  public triggerMutualImpact(x: number, y: number, duration: number): void {
    this.currentEffect = { x, y, radius: 4, maxRadius: 38, alpha: 1,
      color: 0xfbbf24, active: true, duration: Math.max(0.001, duration), age: 0 };
  }

  public triggerBurnout(x: number, y: number): void {
    this.currentEffect = {
      x,
      y,
      radius: 3,
      maxRadius: 22,
      alpha: 0.8,
      color: 0x94a3b8,
      active: true
    };
  }

  /**
   * Updates missile rendering, state visuals, smoke trail, and destruction effects.
   */
  public update(missile: MissileModel, dt: number): void {
    if (missile.isActive) {
      this.container.setVisible(true);
      this.container.setPosition(missile.x, missile.y);
      this.container.setRotation(missile.angle);

      // 1. Visual state handling
      if (missile.isHoming) {
        if (this.sprite.texture.key !== 'missile_homing_texture') {
          this.sprite.setTexture('missile_homing_texture');
        }
        this.sprite.setAlpha(1.0);
        this.sprite.setScale(1.0);
      } else if (missile.isBallistic) {
        // Flameout texture
        if (this.sprite.texture.key !== 'missile_ballistic_texture') {
          this.sprite.setTexture('missile_ballistic_texture');
        }
        this.sprite.setAlpha(0.9);
        this.sprite.setScale(1.0);
      } else if (missile.isDestroying) {
        // Disintegration fade
        const progress = Math.max(0, missile.destroyingRemaining / Math.max(0.001, missile.destructionDuration));
        this.sprite.setAlpha(progress * 0.8);
        this.sprite.setScale(0.4 + progress * 0.6);
      }

      // 2. Smoke trail generation
      this.smokeTimer += dt;
      const smokeInterval = missile.isHoming ? 0.035 : 0.07; // Thinner/slower in ballistic
      if (this.smokeTimer >= smokeInterval && !missile.isDestroying) {
        this.smokeTimer = 0;
        const tailX = missile.x - Math.cos(missile.angle) * 16;
        const tailY = missile.y - Math.sin(missile.angle) * 16;

        this.smokePoints.unshift({
          x: tailX,
          y: tailY,
          alpha: missile.isHoming ? 0.7 : 0.4,
          radius: missile.isHoming ? 2.5 : 2.0,
          color: missile.isHoming ? 0xe2e8f0 : 0x94a3b8 // Darker smoke on burnout
        });

        if (this.smokePoints.length > this.maxSmokePoints) {
          this.smokePoints.pop();
        }
      }
    } else {
      this.container.setVisible(false);
    }

    // 3. Render smoke trail
    this.trailGraphics.clear();
    for (let i = 0; i < this.smokePoints.length; i++) {
      const pt = this.smokePoints[i];
      pt.alpha -= dt * 1.5;
      pt.radius += dt * 4.5;

      if (pt.alpha > 0.01) {
        this.trailGraphics.fillStyle(pt.color, Math.max(0, pt.alpha));
        this.trailGraphics.fillCircle(pt.x, pt.y, pt.radius);
      }
    }
    this.smokePoints = this.smokePoints.filter((p) => p.alpha > 0.01);

    // 4. Render discrete impact / destruction effect
    this.effectGraphics.clear();
    if (this.currentEffect && this.currentEffect.active) {
      const eff = this.currentEffect;
      eff.radius += (eff.maxRadius - eff.radius) * Math.min(1, 14 * dt);
      if (eff.duration !== undefined) {
        eff.age = (eff.age ?? 0) + dt;
        eff.alpha = Math.max(0, 1 - eff.age / eff.duration);
        const progress = Math.min(1, eff.age / eff.duration);
        for (let i = 0; i < 8; i++) {
          const angle = i * Math.PI / 4;
          this.effectGraphics.fillStyle(i % 2 ? 0xf97316 : 0xfde047, eff.alpha);
          this.effectGraphics.fillCircle(eff.x + Math.cos(angle) * 46 * progress,
            eff.y + Math.sin(angle) * 46 * progress, 2 * eff.alpha);
        }
        if (progress < 0.25) {
          this.effectGraphics.fillStyle(0xffffff, 1 - progress * 4);
          this.effectGraphics.fillCircle(eff.x, eff.y, 10);
        }
      } else eff.alpha -= dt * 2.2;

      if (eff.alpha > 0.01) {
        this.effectGraphics.lineStyle(2, eff.color, eff.alpha);
        this.effectGraphics.strokeCircle(eff.x, eff.y, eff.radius);
        this.effectGraphics.fillStyle(0xfef08a, eff.alpha * 0.6);
        this.effectGraphics.fillCircle(eff.x, eff.y, Math.max(2, eff.radius * 0.35));
      } else {
        eff.active = false;
        this.currentEffect = null;
      }
    }
  }

  public destroy(): void {
    this.currentEffect = null;
    this.smokePoints = [];
    this.container.destroy();
    this.trailGraphics.destroy();
    this.effectGraphics.destroy();
  }
}
