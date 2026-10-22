import { ROUND_CONFIG } from '../../config/roundConfig';

export interface RecordStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Keeps a session fallback when browser storage is blocked or full. */
export class RecordStore {
  private best = 0;
  constructor(private readonly storage: () => RecordStorage | undefined = () => globalThis.localStorage) {
    this.best = this.read();
  }
  private read(): number {
    try {
      const value = Number(this.storage()?.getItem(ROUND_CONFIG.recordKey));
      return Number.isSafeInteger(value) && value >= 0 ? value : 0;
    } catch { return 0; }
  }
  get value(): number { return this.best; }
  refresh(): number { return this.best = Math.max(this.best, this.read()); }
  save(score: number): number {
    this.best = Math.max(this.best, this.read(), Number.isFinite(score) ? Math.max(0, Math.floor(score)) : 0);
    try { this.storage()?.setItem(ROUND_CONFIG.recordKey, String(this.best)); } catch { /* Play remains available. */ }
    return this.best;
  }
}
