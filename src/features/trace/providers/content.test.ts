import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import { fetchFileContent, MAX_FILE_BYTES } from "./content";
import type { SearchHit } from "./types";

const hit: SearchHit = {
  provider: "sourcegraph",
  repository: "acme/utils",
  path: "src/timing.js",
  commit: "abc123",
  stars: 1,
};
const RAW = "https://raw.githubusercontent.com/acme/utils/abc123/src/timing.js";
const fetchContent = () =>
  fetchFileContent(hit, { signal: new AbortController().signal });

describe("fetchFileContent", () => {
  it("downloads the file at the matched commit", async () => {
    server.use(http.get(RAW, () => HttpResponse.text("const a = 1;")));

    expect(await fetchContent()).toBe("const a = 1;");
  });

  it("returns null when the file is missing", async () => {
    server.use(http.get(RAW, () => new HttpResponse(null, { status: 404 })));

    expect(await fetchContent()).toBeNull();
  });

  it("returns null when the declared size is too large", async () => {
    server.use(
      http.get(RAW, () =>
        HttpResponse.text("x", {
          headers: { "content-length": String(MAX_FILE_BYTES + 1) },
        }),
      ),
    );

    expect(await fetchContent()).toBeNull();
  });

  it("returns null when the body is larger than allowed", async () => {
    server.use(
      http.get(RAW, () => HttpResponse.text("x".repeat(MAX_FILE_BYTES + 1))),
    );

    expect(await fetchContent()).toBeNull();
  });

  it("returns null for binary content", async () => {
    server.use(http.get(RAW, () => HttpResponse.text("PNG\u0000\u0001data")));

    expect(await fetchContent()).toBeNull();
  });

  it("returns null when the request fails", async () => {
    server.use(http.get(RAW, () => HttpResponse.error()));

    expect(await fetchContent()).toBeNull();
  });
});
