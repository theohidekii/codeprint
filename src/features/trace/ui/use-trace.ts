"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { rank } from "../domain/rank";
import type { Language, TraceResult } from "../domain/types";
import type { ProviderName, ProviderStatus } from "../providers/types";
import type { TraceEvent } from "../server/run-trace";

export type TraceState = "idle" | "tracing" | "done" | "error";

const INVALID_MESSAGE =
  "This snippet couldn't be traced. Keep it under 20,000 characters and try again.";
const NETWORK_MESSAGE =
  "Trace couldn't reach the server. Check your connection and try again.";

interface Snapshot {
  state: TraceState;
  raw: TraceResult[];
  providers: Partial<Record<ProviderName, ProviderStatus>>;
  language: Language | null;
  error: string | null;
}

const INITIAL: Snapshot = {
  state: "idle",
  raw: [],
  providers: {},
  language: null,
  error: null,
};

function apply(snapshot: Snapshot, event: TraceEvent): Snapshot {
  switch (event.type) {
    case "started":
      return { ...snapshot, language: event.language };
    case "result":
      return { ...snapshot, raw: [...snapshot.raw, event.result] };
    case "provider":
      return {
        ...snapshot,
        providers: { ...snapshot.providers, [event.provider]: event.status },
      };
    case "done":
      return { ...snapshot, state: "done" };
    case "error":
      return { ...snapshot, state: "error", error: event.message };
  }
}

async function* readLines(
  body: ReadableStream<Uint8Array>,
): AsyncGenerator<string> {
  const reader = body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += value;
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";
    yield* lines.filter(Boolean);
  }
  if (buffer.trim()) yield buffer;
}

/** Runs traces against /api/trace and exposes the streamed, ranked results. */
export function useTrace() {
  const [snapshot, setSnapshot] = useState<Snapshot>(INITIAL);
  const controllerRef = useRef<AbortController | null>(null);

  const cancel = useCallback(() => controllerRef.current?.abort(), []);
  useEffect(() => cancel, [cancel]);

  const trace = useCallback((input: { code: string; language?: Language }) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSnapshot({ ...INITIAL, state: "tracing" });

    const update = (fn: (s: Snapshot) => Snapshot) => {
      if (!controller.signal.aborted) setSnapshot(fn);
    };

    void (async () => {
      try {
        const response = await fetch("/api/trace", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify(input),
          signal: controller.signal,
        });
        if (!response.ok || !response.body) {
          const body = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          const message =
            response.status === 429 ? body?.message : INVALID_MESSAGE;
          update((s) => ({
            ...s,
            state: "error",
            error: message ?? INVALID_MESSAGE,
          }));
          return;
        }
        for await (const line of readLines(response.body)) {
          const event = JSON.parse(line) as TraceEvent;
          update((s) => apply(s, event));
        }
      } catch {
        update((s) => ({ ...s, state: "error", error: NETWORK_MESSAGE }));
      }
    })();
  }, []);

  const results = useMemo(() => rank(snapshot.raw), [snapshot.raw]);

  return {
    state: snapshot.state,
    results,
    providers: snapshot.providers,
    language: snapshot.language,
    error: snapshot.error,
    trace,
    cancel,
  };
}
