import Phaser from 'phaser';
import { IInputManager, SteerCommand } from './IInputManager';

export class DesktopKeyboardInput implements IInputManager {
  private keyboard?: Phaser.Input.Keyboard.KeyboardPlugin;
  private keyA?: Phaser.Input.Keyboard.Key;
  private keyD?: Phaser.Input.Keyboard.Key;
  private keyLeft?: Phaser.Input.Keyboard.Key;
  private keyRight?: Phaser.Input.Keyboard.Key;

  constructor(scene: Phaser.Scene) {
    this.keyboard = scene.input.keyboard ?? undefined;
    if (scene.input.keyboard) {
      this.keyA = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.A);
      this.keyD = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.D);
      this.keyLeft = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.LEFT);
      this.keyRight = scene.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.RIGHT);
    }
  }

  public getCommand(_currentPlanePosition: { x: number; y: number }): SteerCommand {
    const leftDown = Boolean((this.keyA && this.keyA.isDown) || (this.keyLeft && this.keyLeft.isDown));
    const rightDown = Boolean((this.keyD && this.keyD.isDown) || (this.keyRight && this.keyRight.isDown));

    if (leftDown && !rightDown) {
      return { type: 'relative', direction: -1 };
    }
    if (rightDown && !leftDown) {
      return { type: 'relative', direction: 1 };
    }
    return { type: 'none' };
  }

  public destroy(): void {
    for (const key of [this.keyA, this.keyD, this.keyLeft, this.keyRight]) {
      if (key) this.keyboard?.removeKey(key, true, true);
    }
    this.keyA = this.keyD = this.keyLeft = this.keyRight = undefined;
  }
}
