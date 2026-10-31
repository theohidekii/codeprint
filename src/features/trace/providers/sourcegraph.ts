import { z } from "zod";

import type { SearchQuery } from "../domain/queries";
import {
  type SearchHit,
  type SearchOptions,
  type SearchProvider,
  quoted,
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
    // Literal text is quoted so words such as `and` or `repo:` are not read as operators.
    // Structural patterns never contain whitespace, so they are safe unquoted.
    query.regex ? query.pattern : `content:${quoted(query.pattern)}`,
    `patterntype:${query.regex ? "regexp" : "literal"}`,
    language === "generic" ? null : `lang:${language}`,
    `count:${limit}`,
    "fork:no",
  ]
    .filter(Boolean)
    .join(" ");
}

/** Turns one server-sent event block into hits. Anything malformed is skipped. */
function hitsFromEvent(block: string): SearchHit[] {
  const lines = block.split(/\r?\n/);
  const event = lines
    .find((l) => l.startsWith("event:"))
    ?.slice(6)
    .trim();
  if (event !== "matches") return [];

  let parsed: unknown;
  try {
    parsed = JSON.parse(
      lines
        .filter((l) => l.startsWith("data:"))
        .map((l) => l.slice(5).trim())
        .join("\n"),
    );
  } catch {
    return []; // A broken event must not sink the whole search.
  }
  if (!Array.isArray(parsed)) return [];

  const hits: SearchHit[] = [];
  for (const raw of parsed) {
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
}

/**
 * Sourcegraph's streaming search. Hits are read as events arrive, so when a slow search is cut
 * off the hits received so far are still returned.
 */
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

      const hits: SearchHit[] = [];
      let reader: ReadableStreamDefaultReader<Uint8Array> | undefined;
      try {
        const response = await fetcher(url, {
          headers: { accept: "text/event-stream" },
          signal: searchOptions.signal,
        });
        const error = statusError(response.status, "sourcegraph");
        if (error) throw error;
        if (!response.body) return hits;

        reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          buffer += done
            ? decoder.decode()
            : decoder.decode(value, { stream: true });
          const blocks = buffer.split(/\r?\n\r?\n/);
          buffer = done ? "" : (blocks.pop() ?? "");
          for (const block of blocks) hits.push(...hitsFromEvent(block));
          if (done) return hits;
        }
      } catch (error) {
        if (searchOptions.signal.aborted && hits.length > 0) return hits;
        throw toProviderError(error, "sourcegraph");
      } finally {
        // Release the connection when we stop early instead of leaving it half-read.
        reader?.cancel().catch(() => {});
      }
    },
  };
}
