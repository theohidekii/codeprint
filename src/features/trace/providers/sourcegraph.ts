import { z } from "zod";

import type { SearchQuery } from "../domain/queries";
import {
  type SearchHit,
  type SearchOptions,
  type SearchProvider,
  statusError,
  toProviderError,
} from "./types";

const DEFAULT_BASE_URL = "https://sourcegraph.com";
const GITHUB_PREFIX = "github.com/";

const matchSchema = z.object({
  repository: z.string(),
  path: z.string(),
  commit: z.string(),
  repoStars: z.number().optional(),
});

function buildQuery(
  query: SearchQuery,
  { language, limit }: SearchOptions,
): string {
  return [
    "context:global",
    query.pattern,
    `patterntype:${query.regex ? "regexp" : "literal"}`,
    language === "generic" ? null : `lang:${language}`,
    `count:${limit}`,
    "fork:no",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Reads the `matches` events of a server-sent event stream, skipping anything malformed. */
function parseMatches(body: string): unknown[] {
  const matches: unknown[] = [];
  for (const block of body.split(/\r?\n\r?\n/)) {
    const lines = block.split(/\r?\n/);
    const event = lines
      .find((l) => l.startsWith("event:"))
      ?.slice(6)
      .trim();
    if (event !== "matches") continue;
    const data = lines
      .filter((l) => l.startsWith("data:"))
      .map((l) => l.slice(5).trim())
      .join("\n");
    try {
      const parsed: unknown = JSON.parse(data);
      if (Array.isArray(parsed)) matches.push(...parsed);
    } catch {
      // A broken event must not sink the whole search.
    }
  }
  return matches;
}

export function createSourcegraphProvider(
  options: { baseUrl?: string; fetch?: typeof fetch } = {},
): SearchProvider {
  const baseUrl = options.baseUrl ?? DEFAULT_BASE_URL;
  const fetcher = options.fetch ?? fetch;

  return {
    name: "sourcegraph",
    supportsRegex: true,
    async search(query, searchOptions) {
      const url = new URL("/.api/search/stream", baseUrl);
      url.searchParams.set("q", buildQuery(query, searchOptions));

      let body: string;
      try {
        const response = await fetcher(url, {
          headers: { accept: "text/event-stream" },
          signal: searchOptions.signal,
        });
        const error = statusError(response.status, "sourcegraph");
        if (error) throw error;
        body = await response.text();
      } catch (error) {
        throw toProviderError(error, "sourcegraph");
      }

      const hits: SearchHit[] = [];
      for (const raw of parseMatches(body)) {
        const match = matchSchema.safeParse(raw);
        if (!match.success || !match.data.repository.startsWith(GITHUB_PREFIX))
          continue;
        hits.push({
          provider: "sourcegraph",
          repository: match.data.repository.slice(GITHUB_PREFIX.length),
          path: match.data.path,
          commit: match.data.commit,
          stars: match.data.repoStars ?? null,
        });
      }
      return hits;
    },
  };
}
