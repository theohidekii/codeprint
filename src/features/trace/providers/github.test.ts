import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import type { SearchQuery } from "../domain/queries";
import { createGithubProvider } from "./github";

const ENDPOINT = "https://api.github.com/search/code";
const literal: SearchQuery = {
  kind: "exact",
  pattern: "clearTimeout(timer);",
  regex: false,
};
const regex: SearchQuery = {
  kind: "structural",
  pattern: String.raw`clearTimeout\(\w+\)`,
  regex: true,
};

const ITEMS = {
  items: [
    {
      path: "src/timing.js",
      html_url:
        "https://github.com/acme/utils/blob/0123456789abcdef0123456789abcdef01234567/src/timing.js",
      repository: { full_name: "acme/utils" },
    },
    { path: "broken.js", repository: { full_name: "acme/broken" } },
  ],
};

const search = (query: SearchQuery) =>
  createGithubProvider({ token: "test-token" }).search(query, {
    language: "javascript",
    limit: 10,
    signal: new AbortController().signal,
  });

describe("github provider", () => {
  it("is literal only", () => {
    expect(createGithubProvider({ token: "t" })).toMatchObject({
      name: "github",
      supportsRegex: false,
    });
  });

  it("searches code with the token, language and limit", async () => {
    let seen: Request | undefined;
    server.use(
      http.get(ENDPOINT, ({ request }) => {
        seen = request;
        return HttpResponse.json(ITEMS);
      }),
    );

    await search(literal);

    const url = new URL(seen!.url);
    expect(url.searchParams.get("q")).toBe(
      '"clearTimeout(timer);" language:javascript',
    );
    expect(url.searchParams.get("per_page")).toBe("10");
    expect(seen!.headers.get("authorization")).toBe("Bearer test-token");
  });

  it("maps items to hits, reading the commit from the blob URL and skipping incomplete items", async () => {
    server.use(http.get(ENDPOINT, () => HttpResponse.json(ITEMS)));

    expect(await search(literal)).toEqual([
      {
        provider: "github",
        repository: "acme/utils",
        path: "src/timing.js",
        commit: "0123456789abcdef0123456789abcdef01234567",
        stars: null,
      },
    ]);
  });

  it("never sends regex queries", async () => {
    const calls = vi.fn();
    server.use(
      http.get(ENDPOINT, () => {
        calls();
        return HttpResponse.json(ITEMS);
      }),
    );

    expect(await search(regex)).toEqual([]);
    expect(calls).not.toHaveBeenCalled();
  });

  it.each([
    ["403 with no remaining quota", 403, { "x-ratelimit-remaining": "0" }],
    ["429", 429, {}],
  ])("reports %s as rate limited", async (_, status, headers) => {
    server.use(
      http.get(ENDPOINT, () => new HttpResponse(null, { status, headers })),
    );

    await expect(search(literal)).rejects.toMatchObject({
      status: "rate-limited",
    });
  });
});
