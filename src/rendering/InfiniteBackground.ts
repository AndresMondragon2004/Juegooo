import Phaser from 'phaser';
import {
  getCloudsInArea,
  CellCloudData,
  DEFAULT_NATURAL_CLOUD_CONFIG
} from '../core/environment/cloudLayout';

/**
 * Environmental speed lines feature toggle.
 * Disabled for this prototype as per Phase 0A.2 specifications.
 * Preserved for future speed-boost/nitro visual implementations.
 */
const ENABLE_WIND_STREAKS = false;

interface PooledCloudSprite {
  sprite: Phaser.GameObjects.Sprite;
  currentKey: string | null;
}

export class InfiniteBackground {
  private scene: Phaser.Scene;
  private cloudPool: PooledCloudSprite[] = [];
  private poolSize: number = 22;
  private viewMargin: number = 260;

  // Reusable wind graphics (dormant when ENABLE_WIND_STREAKS is false)
  private windGraphics?: Phaser.GameObjects.Graphics;

  constructor(scene: Phaser.Scene) {
    this.scene = scene;

    this.ensureCloudTextures();

    // 1. Initialize fixed pool of cloud sprites (zero runtime allocations)
    for (let i = 0; i < this.poolSize; i++) {
      const sprite = this.scene.add.sprite(-9999, -9999, 'cloud_cumulus');
      sprite.setDepth(2);
      sprite.setVisible(false);
      this.cloudPool.push({
        sprite,
        currentKey: null
      });
    }

    // 2. Initialize wind graphics only if enabled
    if (ENABLE_WIND_STREAKS) {
      this.windGraphics = this.scene.add.graphics();
      this.windGraphics.setDepth(1);
    }
  }

  /**
   * Generates 3 visually distinct, crisp vector cloud textures.
   */
  private ensureCloudTextures(): void {
    // 1. Variant 'cumulus': Classic soft 3-lobe cloud
    if (!this.scene.textures.exists('cloud_cumulus')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      const w = 120;
      const h = 70;
      g.fillStyle(0xffffff, 0.95);
      g.fillCircle(38, 44, 22);
      g.fillCircle(62, 34, 28);
      g.fillCircle(86, 44, 20);
      g.fillRoundedRect(22, 40, 76, 22, 11);
      g.generateTexture('cloud_cumulus', w, h);
      g.destroy();
    }

    // 2. Variant 'stratus': Elongated, sleeker horizontal cloud
    if (!this.scene.textures.exists('cloud_stratus')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      const w = 160;
      const h = 54;
      g.fillStyle(0xffffff, 0.92);
      g.fillCircle(45, 34, 18);
      g.fillCircle(80, 26, 22);
      g.fillCircle(115, 32, 18);
      g.fillRoundedRect(20, 28, 120, 20, 10);
      g.generateTexture('cloud_stratus', w, h);
      g.destroy();
    }

    // 3. Variant 'wispy': Small, airy high-altitude cloud
    if (!this.scene.textures.exists('cloud_wispy')) {
      const g = this.scene.make.graphics({ x: 0, y: 0 });
      const w = 85;
      const h = 44;
      g.fillStyle(0xffffff, 0.88);
      g.fillCircle(30, 26, 14);
      g.fillCircle(48, 20, 17);
      g.fillCircle(64, 26, 12);
      g.fillRoundedRect(16, 22, 54, 16, 8);
      g.generateTexture('cloud_wispy', w, h);
      g.destroy();
    }
  }

  /**
   * Updates natural cloud visibility and positions based on camera world viewport.
   *
   * @param dt Delta time in seconds.
   * @param _planeAngle Aircraft angle (reserved for future effects).
   * @param _planeSpeed Aircraft speed (reserved for future effects).
   */
  public update(_dt: number, _planeAngle: number, _planeSpeed: number): void {
    const camera = this.scene.cameras.main;
    const camW = camera.width;
    const camH = camera.height;

    // 1. Calculate active camera world bounds with margin
    const minX = camera.worldView.x - this.viewMargin;
    const minY = camera.worldView.y - this.viewMargin;
    const maxX = camera.worldView.right + this.viewMargin;
    const maxY = camera.worldView.bottom + this.viewMargin;

    // 2. Query deterministic sparse clouds in view
    const visibleClouds = getCloudsInArea(minX, minY, maxX, maxY, DEFAULT_NATURAL_CLOUD_CONFIG);

    // 3. Map visible clouds to pooled sprites
    const count = Math.min(visibleClouds.length, this.poolSize);
    for (let i = 0; i < count; i++) {
      const cloudData: CellCloudData = visibleClouds[i];
      const pooled = this.cloudPool[i];
      const sprite = pooled.sprite;

      // Update texture if variant changed
      const textureKey = `cloud_${cloudData.variant}`;
      if (sprite.texture.key !== textureKey) {
        sprite.setTexture(textureKey);
      }

      // Smooth edge alpha vignette to prevent pop-in / pop-out at edges
      const screenX = cloudData.worldX - camera.worldView.x;
      const screenY = cloudData.worldY - camera.worldView.y;
      const edgeDistX = Math.min(screenX, camW - screenX);
      const edgeDistY = Math.min(screenY, camH - screenY);
      const minEdgeDist = Math.min(edgeDistX, edgeDistY);
      const edgeFade = Math.max(0, Math.min(1, (minEdgeDist + 50) / 100));

      sprite.setPosition(cloudData.worldX, cloudData.worldY);
      sprite.setScale(cloudData.scale);
      sprite.setAlpha(cloudData.baseAlpha * edgeFade);
      sprite.setVisible(true);
      pooled.currentKey = cloudData.cellKey;
    }

    // 4. Hide unused pooled sprites
    for (let i = count; i < this.poolSize; i++) {
      const pooled = this.cloudPool[i];
      if (pooled.sprite.visible) {
        pooled.sprite.setVisible(false);
        pooled.currentKey = null;
      }
    }

    // 5. Environmental wind particles (dormant by design in Phase 0A.2)
    if (ENABLE_WIND_STREAKS && this.windGraphics) {
      this.windGraphics.clear();
    }
  }

  public destroy(): void {
    for (const item of this.cloudPool) {
      item.sprite.destroy();
    }
    this.cloudPool = [];
    this.windGraphics?.destroy();
  }
}
