// @vitest-environment node
import { blueprintHandlers } from "@/test/msw/blueprint-handlers";
import { server } from "@/test/msw/server";

vi.mock("server-only", () => ({}));

async function loadRoute() {
  vi.resetModules();
  return import("./route");
}

const get = (target: string, address = "10.1.0.1") =>
  new Request(`http://localhost/api/blueprint?target=${target}`, {
    headers: { "x-forwarded-for": address },
  });

let calls = 0;
beforeEach(() => {
  calls = 0;
  server.use(...blueprintHandlers);
  server.events.on("request:start", () => {
    calls++;
  });
});
afterEach(() => server.events.removeAllListeners());

describe("GET /api/blueprint", () => {
  it.each(["octocat", "a/..", "a/b/c", "../../etc", ""])(
    "rejects %j without calling GitHub",
    async (target) => {
      const { GET } = await loadRoute();

      const response = await GET(get(target));

      expect(response.status).toBe(400);
      expect(await response.json()).toEqual({
        error: "invalid-target",
        message: "Enter a repository as owner/repo.",
      });
      expect(calls).toBe(0);
    },
  );

  it("answers with the analysis, then serves it from the cache", async () => {
    const { GET } = await loadRoute();

    const first = await GET(get("vercel/swr"));
    const after = calls;
    const second = await GET(get("Vercel/SWR"));

    expect(first.status).toBe(200);
    expect(await second.json()).toEqual(await first.json());
    expect(calls).toBe(after);
  });

  it("limits each client to 10 requests a minute", async () => {
    const { GET } = await loadRoute();
    for (let i = 0; i < 10; i++) await GET(get("vercel/swr", "203.0.113.7"));

    expect((await GET(get("vercel/swr", "203.0.113.7"))).status).toBe(429);
  });
});
