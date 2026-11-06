export interface HistoryOptions<T> {
  limit: number;
  coalesceMs: number;
  fingerprint: (t: T) => string;
}

export interface History<T> {
  readonly canUndo: boolean;
  readonly canRedo: boolean;
  record: (t: T, key: string) => void;
  begin: (t: T) => void;
  end: (t: T) => boolean;
  cancel: () => void;
  undo: (t: T) => T | null;
  redo: (t: T) => T | null;
}

export function createHistory<T>(opts: HistoryOptions<T>): History<T> {
  let past: T[] = [];
  let future: T[] = [];
  let lastKey = "";
  let lastAt = 0;
  let gesture: T | null = null;

  function push(t: T): void {
    past.push(t);
    if (past.length > opts.limit) past.shift();
    future.length = 0;
  }

  return {
    get canUndo() {
      return past.length > 0;
    },
    get canRedo() {
      return future.length > 0;
    },
    record(t, key) {
      const now = Date.now();
      if (key === lastKey && now - lastAt < opts.coalesceMs) {
        lastAt = now;
        return;
      }
      push(t);
      lastKey = key;
      lastAt = now;
    },
    begin(t) {
      gesture = t;
    },
    end(t) {
      if (gesture === null) return false;
      const snap = gesture;
      gesture = null;
      if (opts.fingerprint(snap) === opts.fingerprint(t)) return false;
      push(snap);
      lastKey = "";
      lastAt = 0;
      return true;
    },
    cancel() {
      gesture = null;
    },
    undo(t) {
      if (!past.length) return null;
      const snap = past.pop() as T;
      future.push(t);
      lastKey = "";
      lastAt = 0;
      return snap;
    },
    redo(t) {
      if (!future.length) return null;
      const snap = future.pop() as T;
      past.push(t);
      lastKey = "";
      lastAt = 0;
      return snap;
    }
  };
}
