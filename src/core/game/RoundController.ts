import { RecordStore } from './RecordStore';
import { ScoreSystem } from './ScoreSystem';
import type { MissilesCollidedEvent } from '../missile/MissileManager';

export type RoundState = 'MENU' | 'PLAYING' | 'PAUSED' | 'GAME_OVER';
export interface RoundStats {
  time: number;
  score: number;
  collisions: number;
  destroyedMissiles: number;
  best: number;
  newRecord: boolean;
}

/** No wall clock: all timestamps come from the missile simulation. */
export class RoundController {
  private currentState: RoundState = 'MENU';
  private score = new ScoreSystem();
  private finalStats?: Readonly<RoundStats>;
  constructor(private readonly records: RecordStore) {}
  get state(): RoundState { return this.currentState; }
  get stats(): Readonly<RoundStats> {
    return this.finalStats ?? {
      time: this.score.time, score: this.score.total, collisions: this.score.collisionCount,
      destroyedMissiles: this.score.destroyedMissiles, best: this.records.value, newRecord: false,
    };
  }
  start(): boolean {
    if (this.state !== 'MENU' && this.state !== 'GAME_OVER') return false;
    this.score = new ScoreSystem(); this.finalStats = undefined;
    this.currentState = 'PLAYING'; return true;
  }
  pause(): boolean {
    if (this.state !== 'PLAYING') return false;
    this.currentState = 'PAUSED'; return true;
  }
  resume(): boolean {
    if (this.state !== 'PAUSED') return false;
    this.currentState = 'PLAYING'; return true;
  }
  visibilityChanged(hidden: boolean): void { if (hidden) this.pause(); }
  advanceTo(time: number): void { if (this.state === 'PLAYING') this.score.advanceTo(time); }
  missilesCollided(event: MissilesCollidedEvent): void {
    if (this.state !== 'PLAYING') return;
    if (this.score.registerCollision(event)) this.score.advanceTo(event.simulationTime);
  }
  finish(time: number): boolean {
    if (this.state !== 'PLAYING') return false;
    this.score.advanceTo(time);
    const previousBest = this.records.refresh();
    this.currentState = 'GAME_OVER';
    this.finalStats = Object.freeze({ ...this.stats,
      best: this.records.save(this.score.total), newRecord: this.score.total > previousBest });
    return true;
  }
}
