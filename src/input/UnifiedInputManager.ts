import Phaser from 'phaser';
import { IInputManager, SteerCommand } from './IInputManager';
import { DesktopKeyboardInput } from './DesktopKeyboardInput';
import { TouchInputManager } from './TouchInputManager';

export class UnifiedInputManager implements IInputManager {
  private keyboard: DesktopKeyboardInput;
  private touch: TouchInputManager;

  constructor(scene: Phaser.Scene, touchDeadzone: number = 24) {
    this.keyboard = new DesktopKeyboardInput(scene);
    this.touch = new TouchInputManager(scene, touchDeadzone);
  }

  public getCommand(currentPlanePosition: { x: number; y: number }): SteerCommand {
    // 1. Check keyboard first
    const keyCommand = this.keyboard.getCommand(currentPlanePosition);
    if (keyCommand.type !== 'none') {
      return keyCommand;
    }

    // 2. Check touch / drag
    const touchCommand = this.touch.getCommand(currentPlanePosition);
    if (touchCommand.type !== 'none') {
      return touchCommand;
    }

    return { type: 'none' };
  }

  public getTouchManager(): TouchInputManager {
    return this.touch;
  }

  public destroy(): void {
    this.keyboard.destroy();
    this.touch.destroy();
  }
}
