import { act, renderHook, waitFor } from "@testing-library/react";
import { http, HttpResponse } from "msw";

import { server } from "@/test/msw/server";

import type { TraceResult } from "../domain/types";
import type { TraceEvent } from "../server/run-trace";
import { useTrace } from "./use-trace";

const ENDPOINT = "*/api/trace";

const result = (id: string, similarity: number): TraceResult => ({
  id,
  repository: "acme/utils",
  path: id,
  url: "https://github.com/acme/utils",
  stars: 1,
  similarity,
  regions: [],
  renames: [],
  excerpt: { startLine: 1, lines: [] },
  contentHash: similarity * 100,
  vendored: false,
  copies: 0,
});

const line = (event: TraceEvent) =>
  new TextEncoder().encode(`${JSON.stringify(event)}\n`);

/** Streams the first events, then waits for `release()` before finishing. */
function serveInTwoParts(first: TraceEvent[], rest: TraceEvent[]) {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => (release = resolve));
  server.use(
    http.post(ENDPOINT, () => {
      const stream = new ReadableStream<Uint8Array>({
        async start(controller) {
          for (const event of first) controller.enqueue(line(event));
          await gate;
          for (const event of rest) controller.enqueue(line(event));
          controller.close();
        },
      });
      return new HttpResponse(stream, {
        headers: { "content-type": "application/x-ndjson" },
      });
    }),
  );
  return () => release();
}

describe("useTrace", () => {
  it("starts idle", () => {
    const { result: hook } = renderHook(() => useTrace());

    expect(hook.current).toMatchObject({
      state: "idle",
      results: [],
      error: null,
    });
  });

  it("shows results as they stream in and keeps them ranked", async () => {
    const release = serveInTwoParts(
      [
        { type: "started", language: "javascript", queries: 2 },
        { type: "result", result: result("low.js", 0.5) },
      ],
      [
        { type: "result", result: result("high.js", 0.9) },
        { type: "provider", provider: "sourcegraph", status: "ok" },
        { type: "done", total: 2 },
      ],
    );
    const { result: hook } = renderHook(() => useTrace());

    act(() => hook.current.trace({ code: "x" }));

    await waitFor(() => expect(hook.current.results).toHaveLength(1));
    expect(hook.current.state).toBe("tracing");
    expect(hook.current.language).toBe("javascript");

    act(() => release());

    await waitFor(() => expect(hook.current.state).toBe("done"));
    expect(hook.current.results.map((r) => r.id)).toEqual([
      "high.js",
      "low.js",
    ]);
    expect(hook.current.providers).toEqual({ sourcegraph: "ok" });
  });

  it("reports an interrupted trace when the stream ends without finishing", async () => {
    serveInTwoParts(
      [{ type: "started", language: "javascript", queries: 2 }],
      [],
    )();
    const { result: hook } = renderHook(() => useTrace());

    act(() => hook.current.trace({ code: "x" }));

    await waitFor(() => expect(hook.current.state).toBe("error"));
    expect(hook.current.error).toBe(
      "The trace stopped before it finished. Try again.",
    );
  });

  it("surfaces a too-short error", async () => {
    const message =
      "This snippet is too short to trace. Paste a few lines, at least 20 tokens.";
    serveInTwoParts([{ type: "error", code: "too-short", message }], []);
    const { result: hook } = renderHook(() => useTrace());

    act(() => hook.current.trace({ code: "x" }));

    await waitFor(() => expect(hook.current.state).toBe("error"));
    expect(hook.current.error).toBe(message);
  });

  it("surfaces the rate-limit message", async () => {
    server.use(
      http.post(ENDPOINT, () =>
        HttpResponse.json(
          {
            error: "rate-limited",
            message: "Too many traces in a minute. Try again shortly.",
          },
          { status: 429 },
        ),
      ),
    );
    const { result: hook } = renderHook(() => useTrace());

    act(() => hook.current.trace({ code: "x" }));

    await waitFor(() =>
      expect(hook.current.error).toBe(
        "Too many traces in a minute. Try again shortly.",
      ),
    );
    expect(hook.current.state).toBe("error");
  });

  it("cancels the previous trace when a new one starts", async () => {
    server.use(
      http.post(
        ENDPOINT,
        () =>
          new HttpResponse(new ReadableStream({ start() {} }), {
            headers: { "content-type": "application/x-ndjson" },
          }),
      ),
    );
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    const signals = () => fetchSpy.mock.calls.map(([, init]) => init!.signal!);
    const { result: hook } = renderHook(() => useTrace());

    act(() => hook.current.trace({ code: "first" }));
    act(() => hook.current.trace({ code: "second" }));

    await waitFor(() => expect(signals()).toHaveLength(2));
    expect(signals()[0]!.aborted).toBe(true);
    expect(signals()[1]!.aborted).toBe(false);
    fetchSpy.mockRestore();
  });
});
