import Phaser from 'phaser';
import { IInputManager, SteerCommand } from './IInputManager';

export class TouchInputManager implements IInputManager {
  private scene: Phaser.Scene;
  private deadzone: number;
  private isPointerDown: boolean = false;
  private pointerScreenX: number = 0;
  private pointerScreenY: number = 0;

  constructor(scene: Phaser.Scene, deadzone: number = 24) {
    this.scene = scene;
    this.deadzone = deadzone;

    // Prevent default context menu or drag gestures on canvas
    const canvas = this.scene.game.canvas;
    if (canvas) {
      canvas.addEventListener('contextmenu', (e) => e.preventDefault());
      canvas.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
      canvas.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
    }

    this.scene.input.on('pointerdown', this.onPointerDown, this);
    this.scene.input.on('pointermove', this.onPointerMove, this);
    this.scene.input.on('pointerup', this.onPointerUp, this);
    this.scene.input.on('pointerupoutside', this.onPointerUp, this);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    // Only capture primary touch/click
    if (pointer.primaryDown || pointer.isDown) {
      this.isPointerDown = true;
      this.pointerScreenX = pointer.x;
      this.pointerScreenY = pointer.y;
    }
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.isPointerDown) {
      this.pointerScreenX = pointer.x;
      this.pointerScreenY = pointer.y;
    }
  }

  private onPointerUp(): void {
    this.isPointerDown = false;
  }

  public getCommand(currentPlanePosition: { x: number; y: number }): SteerCommand {
    if (!this.isPointerDown) {
      return { type: 'none' };
    }

    // Convert pointer screen position to world coordinates using the primary camera
    const camera = this.scene.cameras.main;
    const worldPoint = camera.getWorldPoint(this.pointerScreenX, this.pointerScreenY);

    const dx = worldPoint.x - currentPlanePosition.x;
    const dy = worldPoint.y - currentPlanePosition.y;
    const distSq = dx * dx + dy * dy;

    // Inside deadzone: don't steer to avoid jitter
    if (distSq < this.deadzone * this.deadzone) {
      return { type: 'none' };
    }

    const angle = Math.atan2(dy, dx);
    return { type: 'targetAngle', angle };
  }

  public isActive(): boolean {
    return this.isPointerDown;
  }

  public getTargetWorldPosition(): { x: number; y: number } | null {
    if (!this.isPointerDown) return null;
    return this.scene.cameras.main.getWorldPoint(this.pointerScreenX, this.pointerScreenY);
  }

  public destroy(): void {
    this.scene.input.off('pointerdown', this.onPointerDown, this);
    this.scene.input.off('pointermove', this.onPointerMove, this);
    this.scene.input.off('pointerup', this.onPointerUp, this);
    this.scene.input.off('pointerupoutside', this.onPointerUp, this);
  }
}
