export type SteerCommand =
  | { type: 'none' }
  | { type: 'relative'; direction: -1 | 1 }
  | { type: 'targetAngle'; angle: number };

export interface IInputManager {
  /**
   * Retrieves the current steering command for this simulation frame.
   * @param currentPlanePosition World position of the airplane (needed for touch angle calculation).
   */
  getCommand(currentPlanePosition: { x: number; y: number }): SteerCommand;

  /**
   * Cleans up listeners and resources.
   */
  destroy(): void;
}
