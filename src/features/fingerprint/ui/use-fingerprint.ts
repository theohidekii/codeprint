"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import type { Profile } from "../domain/profile";

const INVALID_MESSAGE = "Enter a GitHub username or owner/repo.";
const NETWORK_MESSAGE =
  "Couldn't reach the server. Check your connection and try again.";

export type FingerprintState = "idle" | "loading" | "done" | "error";

interface Snapshot {
  state: FingerprintState;
  profile: Profile | null;
  error: string | null;
}

/** Asks /api/fingerprint for a profile. A new request replaces the one in flight. */
export function useFingerprint() {
  const [snapshot, setSnapshot] = useState<Snapshot>({
    state: "idle",
    profile: null,
    error: null,
  });
  const controllerRef = useRef<AbortController | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const generate = useCallback((target: string) => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setSnapshot({ state: "loading", profile: null, error: null });

    const finish = (next: Snapshot) => {
      if (!controller.signal.aborted) setSnapshot(next);
    };
    const fail = (error: string) =>
      finish({ state: "error", profile: null, error });

    void (async () => {
      try {
        const response = await fetch(
          `/api/fingerprint?target=${encodeURIComponent(target)}`,
          { signal: controller.signal },
        );
        if (!response.ok) {
          const body = (await response.json().catch(() => null)) as {
            message?: string;
          } | null;
          fail(body?.message ?? INVALID_MESSAGE);
          return;
        }
        finish({
          state: "done",
          profile: (await response.json()) as Profile,
          error: null,
        });
      } catch {
        fail(NETWORK_MESSAGE);
      }
    })();
  }, []);

  return { ...snapshot, generate };
}
