export interface AirplaneConfig {
  /** Constant forward speed in world pixels per second */
  speed: number;
  /** Maximum angular velocity in radians per second (e.g. Math.PI * 1.5 = 270 deg/s) */
  maxAngularVelocity: number;
  /** Deadzone in pixels for touch/pointer steering to prevent jitter */
  touchDeadzone: number;
  /** Camera position lerp factor [0, 1] */
  cameraLerp: number;
  /**
   * Distance in pixels camera looks ahead along airplane heading.
   * Defaulted to 0 to keep the camera strictly centered on the airplane.
   */
  cameraLookaheadDistance: number;
  /** Camera lookahead lerp factor [0, 1] */
  cameraLookaheadLerp: number;
  /** Maximum allowed offset fraction from camera center before hard follow (safe zone) */
  cameraSafeZoneFraction: number;
}

export const DEFAULT_AIRPLANE_CONFIG: AirplaneConfig = {
  speed: 250,
  maxAngularVelocity: Math.PI * 1.5, // 270 deg/s
  touchDeadzone: 24,
  cameraLerp: 0.14, // Responsive yet smooth tracking
  cameraLookaheadDistance: 0, // Centered camera by default (Requirement 3)
  cameraLookaheadLerp: 0.04,
  cameraSafeZoneFraction: 0.18 // Keeps aircraft within the central 18% safe radius
};
