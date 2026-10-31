import { z } from "zod";

import {
  ProviderError,
  quoted,
  type SearchHit,
  type SearchProvider,
  statusError,
  toProviderError,
} from "./types";

const ENDPOINT = "https://api.github.com/search/code";
const BLOB_COMMIT = /\/blob\/([0-9a-f]{7,40})\//;

const itemSchema = z.object({
  path: z.string(),
  html_url: z.string(),
  repository: z.object({ full_name: z.string() }),
});
const responseSchema = z.object({ items: z.array(z.unknown()) });

/** GitHub code search: literal queries only, and only when a token is configured. */
export function createGithubProvider(options: {
  token: string;
  fetch?: typeof fetch;
}): SearchProvider {
  const fetcher = options.fetch ?? fetch;

  return {
    name: "github",
    supportsRegex: false,
    async search(query, { language, limit, signal }) {
      if (query.regex) return [];

      const url = new URL(ENDPOINT);
      url.searchParams.set(
        "q",
        language === "generic"
          ? quoted(query.pattern)
          : `${quoted(query.pattern)} language:${language}`,
      );
      url.searchParams.set("per_page", String(limit));

      let body: unknown;
      try {
        const response = await fetcher(url, {
          headers: {
            accept: "application/vnd.github+json",
            authorization: `Bearer ${options.token}`,
          },
          signal,
        });
        if (
          response.status === 403 &&
          response.headers.get("x-ratelimit-remaining") === "0"
        ) {
          throw new ProviderError("rate-limited", "github rate limit reached");
        }
        const error = statusError(response.status, "github");
        if (error) throw error;
        body = await response.json();
      } catch (error) {
        throw toProviderError(error, "github");
      }

      const parsed = responseSchema.safeParse(body);
      if (!parsed.success) return [];

      const hits: SearchHit[] = [];
      for (const raw of parsed.data.items) {
        const item = itemSchema.safeParse(raw);
        const commit = item.success
          ? BLOB_COMMIT.exec(item.data.html_url)?.[1]
          : undefined;
        if (!item.success || !commit) continue;
        hits.push({
          provider: "github",
          repository: item.data.repository.full_name,
          path: item.data.path,
          commit,
          stars: null,
        });
      }
      return hits;
    },
  };
}
