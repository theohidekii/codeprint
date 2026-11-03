// @vitest-environment node
import { http, HttpResponse } from "msw";

import { blueprintHandlers } from "@/test/msw/blueprint-handlers";
import { server } from "@/test/msw/server";

import { analyzeRepository } from "./analyze";

const API = "https://api.github.com/repos/o/r";
const RAW = "https://raw.githubusercontent.com/o/r/main";

function serveRepo(
  paths: string[],
  content: (path: string) => string | HttpResponse<null> = () => "x;",
  truncated = false,
) {
  server.use(
    http.get(API, () =>
      HttpResponse.json({ full_name: "o/r", default_branch: "main" }),
    ),
    http.get(`${API}/git/trees/main`, () =>
      HttpResponse.json({
        truncated,
        tree: paths.map((path) => ({ type: "blob", path, size: 100 })),
      }),
    ),
    http.get(`${RAW}/*`, ({ request }) => {
      const path = decodeURI(new URL(request.url).pathname.split("/main/")[1]!);
      const body = content(path);
      return typeof body === "string" ? HttpResponse.text(body) : body;
    }),
  );
}

describe("analyzeRepository", () => {
  it("finds modules, dependencies and hotspots", async () => {
    server.use(...blueprintHandlers);

    const analysis = await analyzeRepository("vercel/swr", {});

    expect(analysis).toMatchObject({
      repository: "vercel/swr",
      branch: "main",
      files: 8,
      truncated: false,
      sampled: false,
      topLanguage: "TypeScript",
      unreadLanguages: [],
    });
    expect(analysis.partial).toBeUndefined();
    expect(analysis.modules.map((m) => m.name)).toContain("src/core");
    expect(analysis.modules[0]).not.toHaveProperty("paths");
    expect(analysis.edges).toContainEqual(
      expect.objectContaining({ from: "src/react", to: "src/core" }),
    );
    expect(analysis.hotspots.length).toBeGreaterThan(0);
  });

  it("reads at most 300 files, 10 at a time, from every module", async () => {
    let inFlight = 0;
    let peak = 0;
    const read = new Set<string>();
    const paths = [
      ...Array.from({ length: 500 }, (_, i) => `big/f${i}.ts`),
      "small/only.ts",
    ];
    serveRepo(paths);
    const counting: typeof fetch = async (url, init) => {
      if (!String(url).includes("raw.githubusercontent"))
        return fetch(url, init);
      read.add(String(url));
      inFlight++;
      peak = Math.max(peak, inFlight);
      await new Promise((resolve) => setTimeout(resolve, 1));
      inFlight--;
      return new Response("x;");
    };

    const analysis = await analyzeRepository("o/r", { fetch: counting });

    expect(read.size).toBe(300);
    expect(peak).toBeLessThanOrEqual(10);
    expect([...read].some((url) => url.includes("small/only.ts"))).toBe(true);
    expect(analysis.sampled).toBe(true);
  });

  it("encodes odd paths in file URLs and escapes nothing into them", async () => {
    const asked: string[] = [];
    serveRepo(["a b/c#d.ts"]);
    const spying: typeof fetch = async (url, init) => {
      asked.push(String(url));
      return fetch(url, init);
    };

    await analyzeRepository("o/r", { fetch: spying });

    expect(asked.at(-1)).toBe(`${RAW}/a%20b/c%23d.ts`);
  });

  it("skips binary-looking files", async () => {
    serveRepo(["a/x.ts", "b/y.ts"], (path) =>
      path === "a/x.ts" ? 'import "../b/y";\u0000' : "y;",
    );

    expect((await analyzeRepository("o/r", {})).edges).toEqual([]);
  });

  it("flags a truncated tree", async () => {
    serveRepo(["a/x.ts"], () => "x;", true);

    expect((await analyzeRepository("o/r", {})).truncated).toBe(true);
  });

  it("names languages whose dependencies it can't read", async () => {
    serveRepo(["cmd/main.go", "lib/x.go"]);

    const analysis = await analyzeRepository("o/r", {});

    expect(analysis.unreadLanguages).toEqual(["Go"]);
    expect(analysis.topLanguage).toBe("Go");
    expect(analysis.edges).toEqual([]);
    expect(analysis.modules.length).toBeGreaterThan(0);
  });

  it("gives an empty plan for an empty repository", async () => {
    server.use(
      http.get(API, () =>
        HttpResponse.json({ full_name: "o/r", default_branch: "main" }),
      ),
      http.get(
        `${API}/git/trees/main`,
        () => new HttpResponse(null, { status: 409 }),
      ),
    );

    expect(await analyzeRepository("o/r", {})).toMatchObject({
      modules: [],
      files: 0,
    });
  });

  it("returns what arrived when the time budget ends", async () => {
    serveRepo(["a/x.ts", "b/y.ts"]);
    const hanging: typeof fetch = (url, init) =>
      String(url).includes("raw.githubusercontent")
        ? new Promise((_, reject) =>
            init!.signal!.addEventListener("abort", () =>
              reject(new Error("aborted")),
            ),
          )
        : fetch(url, init);

    const analysis = await analyzeRepository("o/r", {
      fetch: hanging,
      budgetMs: 30,
    });

    expect(analysis.partial).toBe(true);
    expect(analysis.modules.length).toBe(2);
  });

  it("rejects when the caller aborts", async () => {
    serveRepo(["a/x.ts"]);
    const controller = new AbortController();
    const aborting: typeof fetch = async (url, init) => {
      if (String(url).includes("raw.githubusercontent")) {
        controller.abort();
        throw new Error("aborted");
      }
      return fetch(url, init);
    };

    await expect(
      analyzeRepository("o/r", { fetch: aborting, signal: controller.signal }),
    ).rejects.toMatchObject({ name: "ProfileError" });
  });

  it("reports missing repositories and rate limits", async () => {
    server.use(http.get(API, () => new HttpResponse(null, { status: 404 })));
    await expect(analyzeRepository("o/r", {})).rejects.toMatchObject({
      code: "not-found",
    });

    server.use(http.get(API, () => new HttpResponse(null, { status: 429 })));
    await expect(analyzeRepository("o/r", {})).rejects.toMatchObject({
      code: "rate-limited",
    });
  });
});
