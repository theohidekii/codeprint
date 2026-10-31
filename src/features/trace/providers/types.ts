import type { SearchQuery } from "../domain/queries";
import type { Language } from "../domain/types";

export type ProviderName = "sourcegraph" | "github";

/** "partial": some of the provider's queries failed, but others answered. */
export type ProviderStatus =
  "ok" | "partial" | "rate-limited" | "timeout" | "error";

export interface SearchHit {
  provider: ProviderName;
  /** "owner/name" on github.com */
  repository: string;
  path: string;
  commit: string;
  stars: number | null;
}

export interface SearchOptions {
  language: Language;
  limit: number;
  signal: AbortSignal;
}

export interface SearchProvider {
  name: ProviderName;
  supportsRegex: boolean;
  search(query: SearchQuery, options: SearchOptions): Promise<SearchHit[]>;
}

export class ProviderError extends Error {
  constructor(
    public readonly status: Exclude<ProviderStatus, "ok" | "partial">,
    message: string,
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

/** Maps a failed fetch to a ProviderError: aborts become timeouts, everything else an error. */
export function toProviderError(
  error: unknown,
  provider: ProviderName,
): ProviderError {
  if (error instanceof ProviderError) return error;
  if (
    error instanceof Error &&
    (error.name === "AbortError" || error.name === "TimeoutError")
  ) {
    return new ProviderError("timeout", `${provider} did not respond in time`);
  }
  return new ProviderError("error", `${provider} request failed`);
}

/** Maps an HTTP status to a ProviderError, or null when the response is usable. */
export function statusError(
  status: number,
  provider: ProviderName,
): ProviderError | null {
  if (status === 429)
    return new ProviderError("rate-limited", `${provider} rate limit reached`);
  if (status >= 400)
    return new ProviderError("error", `${provider} answered ${status}`);
  return null;
}

/** Wraps text in double quotes for a search query, escaping backslashes and quotes. */
export function quoted(text: string): string {
  return `"${text.replace(/[\\"]/g, "\\$&")}"`;
}
