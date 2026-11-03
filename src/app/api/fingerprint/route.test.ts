// @vitest-environment node
import { http, HttpResponse } from "msw";

import { githubHandlers } from "@/test/msw/github-handlers";
import { server } from "@/test/msw/server";

vi.mock("server-only", () => ({}));

const API = "https://api.github.com";

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function get(target: string | null, address = "10.0.0.1") {
  const query = target === null ? "" : `?target=${target}`;
  return new Request(`http://localhost/api/fingerprint${query}`, {
    headers: { "x-forwarded-for": address },
  });
}

let calls = 0;
beforeEach(() => {
  calls = 0;
  server.use(...githubHandlers);
  server.events.on("request:start", () => {
    calls++;
  });
});
afterEach(() => server.events.removeAllListeners());

describe("GET /api/fingerprint", () => {
  it.each([
    ["no target", null],
    ["path traversal", "../../etc"],
    ["a dot segment", "a/.."],
    ["too many segments", "a/b/c"],
    ["a query", "user%3Fx=1"],
    ["a very long name", "x".repeat(200)],
  ])("rejects %s without calling GitHub", async (_, target) => {
    const { GET } = await loadRoute();

    const response = await GET(get(target));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-target" });
    expect(calls).toBe(0);
  });

  it("answers with the profile", async () => {
    const { GET } = await loadRoute();

    const response = await GET(get("vercel/next.js"));

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      kind: "repo",
      name: "vercel/next.js",
    });
  });

  it("maps a missing account to 404 with its message", async () => {
    const { GET } = await loadRoute();

    const response = await GET(get("nobody-here"));

    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({
      error: "not-found",
      message: "No public GitHub user or repository with that name.",
    });
  });

  it("maps GitHub's rate limit to 429, and doesn't cache it", async () => {
    server.use(
      http.get(
        `${API}/users/octo-fixture`,
        () => new HttpResponse(null, { status: 429 }),
        {
          once: true,
        },
      ),
    );
    const { GET } = await loadRoute();

    expect((await GET(get("octo-fixture"))).status).toBe(429);
    expect((await GET(get("octo-fixture"))).status).toBe(200);
  });

  it("serves a repeated target from the cache, ignoring letter case", async () => {
    const { GET } = await loadRoute();

    const first = await (await GET(get("octo-fixture"))).json();
    const afterFirst = calls;
    const second = await (await GET(get("OCTO-Fixture"))).json();

    expect(afterFirst).toBeGreaterThan(0);
    expect(calls).toBe(afterFirst);
    expect(second).toEqual(first);
  });

  it("limits each client to 20 requests a minute", async () => {
    const { GET } = await loadRoute();
    for (let i = 0; i < 20; i++) await GET(get("octo-fixture", "203.0.113.5"));

    const response = await GET(get("octo-fixture", "203.0.113.5"));

    expect(response.status).toBe(429);
    expect((await GET(get("octo-fixture", "203.0.113.6"))).status).toBe(200);
  });
});
