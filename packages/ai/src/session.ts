import type { Language, PendingAction } from "../../shared/types.ts";

export interface SessionState {
  sessionId: string;
  selectedProductId: number | null;
  recentProductIds: number[];
  lastShownProductIds: number[];
  originalProductId: number | null;
  pendingAction: PendingAction | null;
  lastSearch: string | null;
  language: Language;
  storeName: string | null;
  messageIds: string[];
  uncertainActionId: string | null;
}
export interface SessionStore {
  /** Must serialize the entire callback per session, including external tool calls. */
  withSession<T>(sessionId: string, task: (state: SessionState) => Promise<T>): Promise<T>;
}
export class MemorySessionStore implements SessionStore {
  private entries = new Map<string, { state: SessionState; touched: number }>();
  private locks = new Map<string, Promise<void>>();
  private readonly now: () => number;
  private readonly ttlMs: number;
  private readonly maxSessions: number;
  constructor(options: { now?: () => number; ttlMs?: number; maxSessions?: number } = {}) {
    this.now = options.now ?? Date.now;
    this.ttlMs = options.ttlMs ?? 30 * 60_000;
    this.maxSessions = options.maxSessions ?? 1000;
  }
  async withSession<T>(id: string, task: (state: SessionState) => Promise<T>): Promise<T> {
    if (!/^[\w:-]{1,128}$/.test(id)) throw new Error("Invalid session ID");
    const previous = this.locks.get(id) ?? Promise.resolve();
    let release!: () => void;
    const lock = new Promise<void>(resolve => { release = resolve; });
    this.locks.set(id, lock);
    await previous;
    try {
      const now = this.now();
      for (const [key, entry] of this.entries) {
        if (!this.locks.has(key) && !entry.state.uncertainActionId && now - entry.touched > this.ttlMs) this.entries.delete(key);
      }
      let entry = this.entries.get(id);
      if (entry && now - entry.touched > this.ttlMs && !entry.state.uncertainActionId) entry = undefined;
      if (!entry) {
        if (this.entries.size >= this.maxSessions && !this.entries.has(id)) throw new Error("Session capacity exceeded");
        entry = { touched: now, state: {
          sessionId: id, selectedProductId: null, recentProductIds: [], lastShownProductIds: [], originalProductId: null,
          pendingAction: null, lastSearch: null, language: "kk", storeName: null, messageIds: [], uncertainActionId: null,
        } };
        this.entries.set(id, entry);
      }
      const result = await task(entry.state);
      entry.touched = this.now();
      return result;
    } finally {
      release();
      if (this.locks.get(id) === lock) this.locks.delete(id);
    }
  }
}
