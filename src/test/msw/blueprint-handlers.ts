import { http, HttpResponse } from "msw";

/** Offline stand-ins for a small repository, for route tests and the end-to-end server. */
const FILES: Record<string, string> = {
  "src/index.ts": `export * from "./core/store";\nimport "./react/hook";`,
  "src/core/store.ts": `import { log } from "../utils/log";\nexport const store = log;`,
  "src/core/cache.ts": `export const cache = new Map();`,
  "src/react/hook.ts": `import { store } from "../core/store";\nimport { log } from "../utils/log";\nexport { store, log };`,
  "src/utils/log.ts": `export const log = console.log;`,
  "tests/hook.test.ts": `import "../src/react/hook";`,
  "examples/basic/app.tsx": `import "react";`,
  "scripts/build.js": `require("fs");`,
};

const tree = Object.entries(FILES).map(([path, content]) => ({
  type: "blob",
  path,
  size: content.length * 40,
}));

export const blueprintHandlers = [
  http.get("https://api.github.com/repos/vercel/swr", () =>
    HttpResponse.json({ full_name: "vercel/swr", default_branch: "main" }),
  ),
  http.get("https://api.github.com/repos/vercel/swr/git/trees/main", () =>
    HttpResponse.json({ tree, truncated: false }),
  ),
  http.get(
    "https://raw.githubusercontent.com/vercel/swr/main/*",
    ({ params }) => {
      const content = FILES[String(params[0])];
      return content === undefined
        ? new HttpResponse(null, { status: 404 })
        : HttpResponse.text(content);
    },
  ),
];
