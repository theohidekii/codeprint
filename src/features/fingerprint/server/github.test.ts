// @vitest-environment node
import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";
import { githubHandlers } from "@/test/msw/github-handlers";

import { fetchProfile, isValidTarget, ProfileError } from "./github";

const API = "https://api.github.com";

beforeEach(() => server.use(...githubHandlers));

describe("isValidTarget", () => {
  it.each(["octocat", "a-b-c", "vercel/next.js", "o/repo_name-1.2"])(
    "accepts %s",
    (target) => {
      expect(isValidTarget(target)).toBe(true);
    },
  );

  it.each([
    "",
    "../../etc",
    "a/b/c",
    "user?x=1",
    "a/..",
    "a/.",
    "..",
    "a b",
    "a/",
    "/a",
    "x".repeat(40),
    `a/${"x".repeat(101)}`,
  ])("rejects %j", (target) => {
    expect(isValidTarget(target)).toBe(false);
  });
});

describe("fetchProfile for a user", () => {
  it("summarizes repositories and recent activity", async () => {
    const profile = await fetchProfile("octo-fixture", {});

    expect(profile).toMatchObject({
      kind: "user",
      name: "octo-fixture",
      stars: 12400,
      sampled: 3,
      sizes: { count: 3, median: 200 },
    });
    expect(profile.hours[14]).toBe(2);
    // Weighted by size; the fork and the repository without a language don't count.
    expect(profile.languages).toEqual([
      { name: "TypeScript", share: 0.8 },
      { name: "Go", share: 0.2 },
    ]);
  });

  it("sends the token only when there is one", async () => {
    const seen: (string | null)[] = [];
    server.use(
      http.get(`${API}/users/octo-fixture`, ({ request }) => {
        seen.push(request.headers.get("authorization"));
        return HttpResponse.json({ login: "octo-fixture" });
      }),
    );

    await fetchProfile("octo-fixture", {});
    await fetchProfile("octo-fixture", { token: "tkn" });

    expect(seen).toEqual([null, "Bearer tkn"]);
  });

  it("still makes a profile when activity or repositories fail", async () => {
    server.use(
      http.get(
        `${API}/users/octo-fixture/events/public`,
        () => new HttpResponse(null, { status: 500 }),
      ),
      http.get(`${API}/users/octo-fixture/repos`, () =>
        HttpResponse.json({ not: "a list" }),
      ),
    );

    expect(await fetchProfile("octo-fixture", {})).toMatchObject({
      name: "octo-fixture",
      languages: [],
      sampled: 0,
      stars: 0,
      sizes: { count: 0, median: 0 },
    });
  });

  it("skips malformed items instead of failing", async () => {
    server.use(
      http.get(`${API}/users/octo-fixture/events/public`, () =>
        HttpResponse.json([
          { nope: 1 },
          { created_at: "2026-11-02T10:00:00Z" },
        ]),
      ),
    );

    expect((await fetchProfile("octo-fixture", {})).sampled).toBe(1);
  });
});

describe("fetchProfile for a repository", () => {
  it("summarizes languages, commits and files", async () => {
    const profile = await fetchProfile("vercel/next.js", {});

    expect(profile).toMatchObject({
      kind: "repo",
      name: "vercel/next.js",
      stars: 130000,
      sampled: 40,
      sizes: { count: 3, median: 200 },
    });
    expect(profile.languages.map((l) => l.name)).toEqual([
      "TypeScript",
      "JavaScript",
      "Rust",
    ]);
  });

  it("handles an empty repository, whose commits answer 409", async () => {
    server.use(
      http.get(
        `${API}/repos/vercel/next.js/commits`,
        () => new HttpResponse(null, { status: 409 }),
      ),
      http.get(
        `${API}/repos/vercel/next.js/git/trees/canary`,
        () => new HttpResponse(null, { status: 404 }),
      ),
    );

    expect(await fetchProfile("vercel/next.js", {})).toMatchObject({
      sampled: 0,
      sizes: { count: 0, median: 0 },
    });
  });
});

describe("fetchProfile errors", () => {
  it("reports a missing account", async () => {
    await expect(fetchProfile("nobody-here", {})).rejects.toMatchObject({
      name: "ProfileError",
      code: "not-found",
      message: "No public GitHub user or repository with that name.",
    });
  });

  it.each([
    ["403 with no quota left", 403, { "x-ratelimit-remaining": "0" }],
    ["429", 429, {}],
  ])("reports GitHub's rate limit on %s", async (_, status, headers) => {
    server.use(
      http.get(
        `${API}/users/octo-fixture`,
        () => new HttpResponse(null, { status, headers }),
      ),
    );

    await expect(fetchProfile("octo-fixture", {})).rejects.toMatchObject({
      code: "rate-limited",
      message:
        "GitHub's limit for anonymous requests is used up. Try again in a while, or set GITHUB_TOKEN.",
    });
  });

  it("reports the rate limit even when it hits a later request", async () => {
    server.use(
      http.get(
        `${API}/users/octo-fixture/repos`,
        () => new HttpResponse(null, { status: 429 }),
      ),
    );

    await expect(fetchProfile("octo-fixture", {})).rejects.toMatchObject({
      code: "rate-limited",
    });
  });

  it("treats a secondary rate limit as rate limited", async () => {
    server.use(
      http.get(
        `${API}/users/octo-fixture/repos`,
        () =>
          new HttpResponse(null, {
            status: 403,
            headers: { "retry-after": "60", "x-ratelimit-remaining": "40" },
          }),
      ),
    );

    await expect(fetchProfile("octo-fixture", {})).rejects.toMatchObject({
      code: "rate-limited",
    });
  });

  it("flags a transient failure as partial, but not an empty repository", async () => {
    expect((await fetchProfile("octo-fixture", {})).partial).toBeUndefined();
    server.use(
      http.get(
        `${API}/repos/vercel/next.js/commits`,
        () => new HttpResponse(null, { status: 409 }),
      ),
    );
    expect((await fetchProfile("vercel/next.js", {})).partial).toBeUndefined();
    server.use(
      http.get(
        `${API}/users/octo-fixture/events/public`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );
    expect((await fetchProfile("octo-fixture", {})).partial).toBe(true);
  });

  it("rejects when the caller aborts, instead of returning a hollow profile", async () => {
    const controller = new AbortController();
    const aborting: typeof fetch = async (url) => {
      if (String(url).endsWith("/users/octo-fixture")) {
        controller.abort();
        return HttpResponse.json({ login: "octo-fixture" });
      }
      throw new Error("aborted");
    };

    await expect(
      fetchProfile("octo-fixture", {
        fetch: aborting,
        signal: controller.signal,
      }),
    ).rejects.toBeInstanceOf(ProfileError);
  });

  it("reports an unavailable GitHub when the first request fails", async () => {
    server.use(
      http.get(
        `${API}/users/octo-fixture`,
        () => new HttpResponse(null, { status: 500 }),
      ),
    );

    await expect(fetchProfile("octo-fixture", {})).rejects.toBeInstanceOf(
      ProfileError,
    );
    await expect(fetchProfile("octo-fixture", {})).rejects.toMatchObject({
      code: "unavailable",
      message: "GitHub didn't respond. Try again shortly.",
    });
  });

  it("gives up on a request that takes too long", async () => {
    const hanging: typeof fetch = (_, init) =>
      new Promise((_, reject) => {
        init!.signal!.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      });

    await expect(
      fetchProfile("octo-fixture", { fetch: hanging, timeoutMs: 20 }),
    ).rejects.toMatchObject({ code: "unavailable" });
  });
});
