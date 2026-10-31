import type { TraceEvent } from "./run-trace";

/** Small LRU of finished traces, so repeating a trace doesn't hit providers again. */
export function createTraceCache(options: {
  max: number;
  ttlMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  // Map keeps insertion order, so the first key is the least recently used.
  const entries = new Map<string, { events: TraceEvent[]; expires: number }>();

  return {
    get(key: string): TraceEvent[] | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expires < now()) return undefined;
      entries.set(key, entry);
      return entry.events;
    },
    set(key: string, events: TraceEvent[]): void {
      entries.delete(key);
      entries.set(key, { events, expires: now() + options.ttlMs });
      while (entries.size > options.max) {
        entries.delete(entries.keys().next().value!);
      }
    },
  };
}
