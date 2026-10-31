import { http, HttpResponse } from "msw";

/**
 * Offline stand-ins for Sourcegraph and raw.githubusercontent.com, used by route tests and by
 * the end-to-end server (CODEPRINT_E2E_MOCKS=1). The repositories are fictional.
 */
const COMMIT = "e2e0000000000000000000000000000000000001";

const RENAMED_DEBOUNCE = `import { now } from "./clock";

export function delay(callback, wait) {
  let handle;
  return (...params) => {
    clearTimeout(handle);
    handle = setTimeout(() => callback(...params), wait);
  };
}

export function stamp() {
  return now();
}
`;

const UNRELATED = `export class Queue {
  #items = [];
  enqueue(item) {
    this.#items.push(item);
  }
  get size() {
    return this.#items.length;
  }
}
`;

export const TRACE_FIXTURE_FILES: Record<
  string,
  { stars: number; content: string }
> = {
  "acme/timing-kit/src/delay.js": { stars: 1240, content: RENAMED_DEBOUNCE },
  "acme/storefront/vendor/timing.min.js": {
    stars: 9000,
    content: RENAMED_DEBOUNCE,
  },
  "lab/sandbox/scratch.js": { stars: 3, content: UNRELATED },
};

function sse(): string {
  const matches = Object.entries(TRACE_FIXTURE_FILES).map(
    ([key, { stars }]) => {
      const [owner, repo, ...path] = key.split("/");
      return {
        type: "content",
        repository: `github.com/${owner}/${repo}`,
        path: path.join("/"),
        commit: COMMIT,
        repoStars: stars,
      };
    },
  );
  return `event: matches\ndata: ${JSON.stringify(matches)}\n\nevent: done\ndata: {}\n\n`;
}

export const traceHandlers = [
  http.get(
    "https://sourcegraph.com/.api/search/stream",
    () =>
      new HttpResponse(sse(), {
        headers: { "content-type": "text/event-stream" },
      }),
  ),
  http.get(
    "https://raw.githubusercontent.com/:owner/:repo/:commit/*",
    ({ params }) => {
      const path = (params[0] as string | undefined) ?? "";
      const file =
        TRACE_FIXTURE_FILES[
          `${String(params.owner)}/${String(params.repo)}/${path}`
        ];
      return file
        ? HttpResponse.text(file.content)
        : new HttpResponse(null, { status: 404 });
    },
  ),
];
