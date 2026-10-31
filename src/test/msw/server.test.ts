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
    // Assert on MSW's own error: a DNS failure for the fake host would also reject.
    const error = await fetch("https://api.example.test/unhandled").catch(
      (e: unknown) => e,
    );

    expect(error).toBeInstanceOf(Error);
    expect(String((error as Error).cause)).toContain("[MSW]");
  });
});
