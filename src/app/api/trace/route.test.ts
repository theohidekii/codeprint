// @vitest-environment node
import { http } from "msw";

import { EXAMPLE_SNIPPET } from "@/features/trace/domain/examples";
import type { TraceEvent } from "@/features/trace/server/run-trace";
import { server } from "@/test/msw/server";
import { traceHandlers } from "@/test/msw/trace-handlers";

vi.mock("server-only", () => ({}));

let ip = 0;
async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

function post(body: unknown, address = `10.0.0.${++ip}`) {
  return new Request("http://localhost/api/trace", {
    method: "POST",
    headers: { "content-type": "application/json", "x-forwarded-for": address },
    body: JSON.stringify(body),
  });
}

async function events(response: Response): Promise<TraceEvent[]> {
  const text = await response.text();
  return text
    .trim()
    .split("\n")
    .map((line) => JSON.parse(line) as TraceEvent);
}

beforeEach(() => server.use(...traceHandlers));

describe("POST /api/trace", () => {
  it.each([
    ["missing code", {}],
    ["unknown language", { code: EXAMPLE_SNIPPET.code, language: "cobol" }],
    ["code over 20,000 characters", { code: "x".repeat(20_001) }],
  ])("rejects %s", async (_, body) => {
    const { POST } = await loadRoute();

    const response = await POST(post(body));

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "invalid-input" });
  });

  it("limits each client to 10 traces a minute", async () => {
    const { POST } = await loadRoute();
    for (let i = 0; i < 10; i++) await POST(post({}, "203.0.113.9"));

    const response = await POST(
      post({ code: EXAMPLE_SNIPPET.code }, "203.0.113.9"),
    );

    expect(response.status).toBe(429);
    expect(await response.json()).toEqual({
      error: "rate-limited",
      message: "Too many traces in a minute. Try again shortly.",
    });
  });

  it("streams trace events as NDJSON", async () => {
    const { POST } = await loadRoute();

    const response = await POST(post({ code: EXAMPLE_SNIPPET.code }));

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("application/x-ndjson");
    const all = await events(response);
    expect(all[0]).toMatchObject({ type: "started", language: "javascript" });
    expect(all.filter((e) => e.type === "result").length).toBeGreaterThan(0);
    expect(all.at(-1)).toMatchObject({ type: "done" });
  });

  it("serves a repeated trace from the cache", async () => {
    let searches = 0;
    server.use(
      http.get("https://sourcegraph.com/.api/search/stream", () => {
        searches++;
        // Fall through to the fixture handler.
        return undefined;
      }),
    );
    const { POST } = await loadRoute();

    const first = await events(
      await POST(post({ code: EXAMPLE_SNIPPET.code })),
    );
    const afterFirst = searches;
    const second = await events(
      await POST(post({ code: EXAMPLE_SNIPPET.code })),
    );

    expect(afterFirst).toBeGreaterThan(0);
    expect(searches).toBe(afterFirst);
    expect(second).toEqual(first);
  });
});
