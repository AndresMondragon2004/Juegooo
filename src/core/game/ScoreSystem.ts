import { ROUND_CONFIG } from '../../config/roundConfig';
import type { MissilesCollidedEvent } from '../missile/MissileManager';

export class ScoreSystem {
  private elapsed = 0;
  private collisions = 0;
  private readonly destroyedIds = new Set<string>();
  get time(): number { return this.elapsed; }
  // Floor only for display/total; retain fractional simulation time internally.
  get total(): number { return Math.floor(this.elapsed * ROUND_CONFIG.pointsPerSecond + 1e-8) + this.collisions * ROUND_CONFIG.pointsPerCollision; }
  get collisionCount(): number { return this.collisions; }
  get destroyedMissiles(): number { return this.collisions * 2; }
  advanceTo(time: number): void {
    if (Number.isFinite(time)) this.elapsed = Math.max(this.elapsed, time);
  }
  registerCollision(event: MissilesCollidedEvent): boolean {
    const [a, b] = event.missileIds;
    if (event.type !== 'mutual' || a === b || this.destroyedIds.has(a) || this.destroyedIds.has(b)) return false;
    this.destroyedIds.add(a); this.destroyedIds.add(b);
    this.collisions++;
    return true;
  }
}

export function formatSurvivalTime(time: number): string {
  const seconds = Math.max(0, Math.floor(time));
  return `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;
}
