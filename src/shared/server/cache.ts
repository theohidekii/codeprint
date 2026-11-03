/** A small in-memory LRU with expiry, for results worth not fetching twice. */
export function createCache<T>(options: {
  max: number;
  ttlMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  // Map keeps insertion order, so the first key is the least recently used.
  const entries = new Map<string, { value: T; expires: number }>();

  return {
    get(key: string): T | undefined {
      const entry = entries.get(key);
      if (!entry) return undefined;
      entries.delete(key);
      if (entry.expires < now()) return undefined;
      entries.set(key, entry);
      return entry.value;
    },
    set(key: string, value: T): void {
      entries.delete(key);
      entries.set(key, { value, expires: now() + options.ttlMs });
      while (entries.size > options.max) {
        entries.delete(entries.keys().next().value!);
      }
    },
  };
}
