import { http, HttpResponse } from "msw";

/**
 * Offline stand-ins for api.github.com, used by route tests and by the end-to-end server
 * (CODEPRINT_E2E_MOCKS=1). The data is made up. Anything else answers 404.
 */
const API = "https://api.github.com";

const REPO = "vercel/next.js";

export const githubHandlers = [
  http.get(`${API}/users/octo-fixture`, () =>
    HttpResponse.json({ login: "octo-fixture", public_repos: 3 }),
  ),
  http.get(`${API}/users/octo-fixture/repos`, () =>
    HttpResponse.json([
      {
        language: "TypeScript",
        size: 800,
        stargazers_count: 12000,
        fork: false,
      },
      { language: "Go", size: 200, stargazers_count: 400, fork: false },
      { language: null, size: 50, stargazers_count: 0, fork: false },
      { language: "Rust", size: 9000, stargazers_count: 5, fork: true },
    ]),
  ),
  http.get(`${API}/users/octo-fixture/events/public`, () =>
    HttpResponse.json([
      { created_at: "2026-11-02T14:05:00Z" },
      { created_at: "2026-11-02T14:50:00Z" },
      { created_at: "2026-11-01T23:59:00Z" },
    ]),
  ),
  http.get(`${API}/repos/${REPO}`, () =>
    HttpResponse.json({
      full_name: REPO,
      stargazers_count: 130000,
      default_branch: "canary",
    }),
  ),
  http.get(`${API}/repos/${REPO}/languages`, () =>
    HttpResponse.json({ JavaScript: 3000, TypeScript: 6000, Rust: 1000 }),
  ),
  http.get(`${API}/repos/${REPO}/commits`, () =>
    HttpResponse.json(
      Array.from({ length: 40 }, (_, i) => ({
        commit: {
          author: {
            date: `2026-10-${String(1 + (i % 28)).padStart(2, "0")}T${String(i % 24).padStart(2, "0")}:00:00Z`,
          },
        },
      })),
    ),
  ),
  http.get(`${API}/repos/${REPO}/git/trees/canary`, () =>
    HttpResponse.json({
      tree: [
        { type: "blob", size: 100 },
        { type: "blob", size: 300 },
        { type: "blob", size: 200 },
        { type: "tree" },
      ],
    }),
  ),
  http.get(`${API}/users/:user`, () => new HttpResponse(null, { status: 404 })),
  http.get(
    `${API}/repos/:owner/:repo`,
    () => new HttpResponse(null, { status: 404 }),
  ),
];
