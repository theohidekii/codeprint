// @vitest-environment node
import { toNdjsonStream } from "./ndjson";

describe("toNdjsonStream", () => {
  it("writes one JSON line per event", async () => {
    async function* events() {
      yield { type: "started" };
      yield { type: "done", total: 0 };
    }

    const text = await new Response(toNdjsonStream(events())).text();

    expect(text).toBe('{"type":"started"}\n{"type":"done","total":0}\n');
  });

  it("stops the source when the reader cancels", async () => {
    let finished = false;
    async function* events() {
      try {
        yield { n: 1 };
        yield { n: 2 };
      } finally {
        finished = true;
      }
    }
    const reader = toNdjsonStream(events()).getReader();

    await reader.read();
    await reader.cancel();

    expect(finished).toBe(true);
  });
});
