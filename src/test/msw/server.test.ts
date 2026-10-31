import { http, HttpResponse } from "msw";

import { server } from "./server";

describe("msw test server", () => {
  it("answers requests with handlers registered in a test", async () => {
    server.use(
      http.get("https://api.example.test/ping", () =>
        HttpResponse.json({ ok: true }),
      ),
    );

    const response = await fetch("https://api.example.test/ping");

    expect(await response.json()).toEqual({ ok: true });
  });

  it("rejects requests that no handler covers, so tests never reach the network", async () => {
    await expect(fetch("https://api.example.test/unhandled")).rejects.toThrow();
  });
});
