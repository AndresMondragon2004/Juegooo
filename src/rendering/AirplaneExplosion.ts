import type Phaser from 'phaser';
import { ROUND_CONFIG } from '../config/roundConfig';

/** One bounded graphics object; red/white double ring distinguishes aircraft loss. */
export class AirplaneExplosion {
  private readonly graphics: Phaser.GameObjects.Graphics;
  private age = 0;
  constructor(scene: Phaser.Scene, private readonly x: number, private readonly y: number) {
    this.graphics = scene.add.graphics().setDepth(30);
    this.update(0);
  }
  update(dt: number): void {
    this.age += dt;
    const progress = Math.min(1, this.age / ROUND_CONFIG.airplaneExplosionDuration);
    const alpha = 1 - progress;
    const g = this.graphics;
    g.clear();
    if (progress >= 1) return;
    g.lineStyle(4, 0xef4444, alpha);
    g.strokeCircle(this.x, this.y, 5 + progress * 65);
    g.lineStyle(2, 0xffffff, alpha * 0.8);
    g.strokeCircle(this.x, this.y, 3 + progress * 43);
    g.fillStyle(0xffffff, Math.max(0, 1 - progress * 5));
    g.fillCircle(this.x, this.y, 18);
    for (let i = 0; i < 12; i++) {
      const angle = i * Math.PI / 6;
      g.fillStyle(i % 2 ? 0xfb7185 : 0xffedd5, alpha);
      g.fillCircle(this.x + Math.cos(angle) * progress * 75,
        this.y + Math.sin(angle) * progress * 75, 3 * alpha);
    }
  }
  destroy(): void { this.graphics.destroy(); }
}
