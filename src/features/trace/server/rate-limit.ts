/** In-memory sliding-window limiter, keyed by client (usually its IP). */
export function createRateLimiter(options: {
  limit: number;
  windowMs: number;
  now?: () => number;
}) {
  const now = options.now ?? Date.now;
  const hits = new Map<string, number[]>();

  return {
    take(key: string): boolean {
      const time = now();
      const recent = (hits.get(key) ?? []).filter(
        (t) => time - t < options.windowMs,
      );
      if (recent.length >= options.limit) {
        hits.set(key, recent);
        return false;
      }
      recent.push(time);
      hits.set(key, recent);
      return true;
    },
  };
}
