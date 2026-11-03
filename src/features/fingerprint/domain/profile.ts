export interface LanguageShare {
  name: string;
  /** From 0 to 1. Shares in a profile sum to 1. */
  share: number;
}

/** Everything the rest of the feature knows about an account or repository. */
export interface Profile {
  kind: "user" | "repo";
  /** "torvalds" or "vercel/next.js" */
  name: string;
  /** Top languages, plus "Other" when there are more. */
  languages: LanguageShare[];
  /** 24 activity counts, UTC. */
  hours: number[];
  /** 7 activity counts, UTC, Sunday first. */
  weekdays: number[];
  /** Repositories (median in KB) for a user, files (median in bytes) for a repository. */
  sizes: { count: number; median: number };
  stars: number;
  /** How many timestamps the hours and weekdays are based on. */
  sampled: number;
  /** A request failed for a passing reason, so this isn't the whole picture. */
  partial?: true;
}

const TOP_LANGUAGES = 5;

export function summarizeTimestamps(isoDates: readonly string[]): {
  hours: number[];
  weekdays: number[];
  sampled: number;
} {
  const hours = Array<number>(24).fill(0);
  const weekdays = Array<number>(7).fill(0);
  let sampled = 0;
  for (const iso of isoDates) {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) continue;
    hours[date.getUTCHours()]!++;
    weekdays[date.getUTCDay()]!++;
    sampled++;
  }
  return { hours, weekdays, sampled };
}

/** Turns language weights into shares: the top five by weight, then "Other". */
export function topLanguages(
  weights: Readonly<Record<string, number>>,
): LanguageShare[] {
  const entries = Object.entries(weights)
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => b[1] - a[1]);
  const total = entries.reduce((sum, [, weight]) => sum + weight, 0);
  if (total === 0) return [];

  const shares = entries
    .slice(0, TOP_LANGUAGES)
    .map(([name, weight]) => ({ name, share: weight / total }));
  const rest = entries
    .slice(TOP_LANGUAGES)
    .reduce((sum, [, weight]) => sum + weight, 0);
  return rest > 0
    ? [...shares, { name: "Other", share: rest / total }]
    : shares;
}

export function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[middle]!
    : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
