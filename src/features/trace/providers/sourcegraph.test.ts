import { readFileSync } from "node:fs";
import { join } from "node:path";

import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import type { SearchQuery } from "../domain/queries";
import { createSourcegraphProvider } from "./sourcegraph";
import { ProviderError } from "./types";

const ENDPOINT = "https://sourcegraph.com/.api/search/stream";
const fixture = (name: string) =>
  readFileSync(join(__dirname, "__fixtures__", name), "utf8");

const regexQuery: SearchQuery = {
  kind: "structural",
  pattern: String.raw`clearTimeout\(\w+\)`,
  regex: true,
};
const literalQuery: SearchQuery = {
  kind: "exact",
  pattern: "clearTimeout(timer);",
  regex: false,
};

function serve(body: string, init?: ResponseInit) {
  const requests: URL[] = [];
  server.use(
    http.get(ENDPOINT, ({ request }) => {
      requests.push(new URL(request.url));
      return new HttpResponse(body, {
        headers: { "content-type": "text/event-stream" },
        ...init,
      });
    }),
  );
  return requests;
}

const search = (
  query: SearchQuery,
  language: "javascript" | "generic" = "javascript",
  signal?: AbortSignal,
) =>
  createSourcegraphProvider().search(query, {
    language,
    limit: 5,
    signal: signal ?? new AbortController().signal,
  });

describe("sourcegraph provider", () => {
  it("is regex capable", () => {
    expect(createSourcegraphProvider()).toMatchObject({
      name: "sourcegraph",
      supportsRegex: true,
    });
  });

  it("sends a regex query with language, limit and no forks", async () => {
    const requests = serve(fixture("sourcegraph-matches.txt"));

    await search(regexQuery);

    const q = requests[0]!.searchParams.get("q")!;
    expect(q).toContain("context:global");
    expect(q).toContain(String.raw`clearTimeout\(\w+\)`);
    expect(q).toContain("patterntype:regexp");
    expect(q).toContain("lang:javascript");
    expect(q).toContain("count:5");
    expect(q).toContain("fork:no");
  });

  it("sends literal queries as literal and omits the language for generic code", async () => {
    const requests = serve(fixture("sourcegraph-matches.txt"));

    await search(literalQuery, "generic");

    const q = requests[0]!.searchParams.get("q")!;
    expect(q).toContain("patterntype:literal");
    expect(q).not.toContain("lang:");
  });

  it("parses hits from a recorded response", async () => {
    serve(fixture("sourcegraph-matches.txt"));

    const hits = await search(regexQuery);

    expect(hits).toHaveLength(4);
    expect(hits[0]).toEqual({
      provider: "sourcegraph",
      repository: "odoo/odoo",
      path: "addons/web/static/lib/hoot-dom/helpers/time.js",
      commit: expect.stringMatching(/^[0-9a-f]{40}$/),
      stars: 55443,
    });
  });

  it("skips malformed events, incomplete matches and non-GitHub repositories", async () => {
    serve(fixture("sourcegraph-malformed.txt"));

    const hits = await search(regexQuery);

    expect(hits).toEqual([
      {
        provider: "sourcegraph",
        repository: "acme/utils",
        path: "src/timing.js",
        commit: "abc123",
        stars: 12,
      },
    ]);
  });

  it.each([
    [429, "rate-limited"],
    [500, "error"],
  ] as const)(
    "turns HTTP %i into a %s provider error",
    async (status, expected) => {
      serve("", { status });

      await expect(search(regexQuery)).rejects.toMatchObject({
        name: "ProviderError",
        status: expected,
      });
    },
  );

  it("reports an aborted request as a timeout", async () => {
    serve(fixture("sourcegraph-matches.txt"));
    const controller = new AbortController();
    controller.abort();

    const error = await search(
      regexQuery,
      "javascript",
      controller.signal,
    ).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ProviderError);
    expect(error).toMatchObject({ status: "timeout" });
  });
});
