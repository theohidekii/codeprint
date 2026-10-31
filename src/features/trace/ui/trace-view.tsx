"use client";

import { useMemo, useState } from "react";

import { useHydrated } from "@/shared/lib/use-hydrated";
import { Button } from "@/shared/ui/button";
import { Kbd } from "@/shared/ui/kbd";

import { EXAMPLE_SNIPPET } from "../domain/examples";
import { detectLanguage } from "../domain/tokenize";
import { CodeEditor } from "./code-editor";
import { type LanguageChoice, LanguageSelect } from "./language-select";
import { ResultCard } from "./result-card";
import { ScanningPrint } from "./scanning-print";
import { useTrace } from "./use-trace";

const NO_MATCHES =
  "No public matches found. The code may be original, private, or changed beyond recognition.";
const UNAVAILABLE =
  "Sourcegraph didn't respond, so these results may be incomplete.";
const PARTIAL = "Some searches took too long, so results may be incomplete.";

function isMac(): boolean {
  return /Mac|iPhone|iPad/.test(navigator.userAgent);
}

export function TraceView() {
  const [code, setCode] = useState("");
  const [choice, setChoice] = useState<LanguageChoice>("auto");
  // Results describe the code as it was traced, so comparisons use that copy, not live edits.
  const [traced, setTraced] = useState("");
  const { state, results, providers, error, trace } = useTrace();
  const hydrated = useHydrated();

  const detected = useMemo(() => detectLanguage(code), [code]);
  const snippetLines = useMemo(() => traced.split("\n"), [traced]);
  const canTrace = code.trim().length > 0 && state !== "tracing";

  const submit = () => {
    if (!canTrace) return;
    setTraced(code);
    trace(choice === "auto" ? { code } : { code, language: choice });
  };

  const sourcegraph = providers.sourcegraph;
  const warning =
    state !== "done" || sourcegraph === undefined || sourcegraph === "ok"
      ? null
      : sourcegraph === "partial"
        ? PARTIAL
        : UNAVAILABLE;

  const status =
    state === "tracing"
      ? "Tracing…"
      : state === "done"
        ? `${results.length} ${results.length === 1 ? "match" : "matches"} found`
        : "";

  return (
    <div className="space-y-10">
      <div>
        <CodeEditor value={code} onChange={setCode} onSubmit={submit} />
        <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <LanguageSelect
              value={choice}
              detected={detected}
              onChange={setChoice}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setCode(EXAMPLE_SNIPPET.code);
                setChoice("auto");
              }}
            >
              Try an example
            </Button>
          </div>
          <div className="flex items-center gap-3">
            <span
              className="text-muted hidden items-center gap-1 text-sm sm:flex"
              aria-hidden
            >
              <Kbd>{hydrated && isMac() ? "⌘" : "Ctrl"}</Kbd>
              <Kbd>Enter</Kbd>
            </span>
            <Button size="lg" onClick={submit} disabled={!canTrace}>
              Trace
            </Button>
          </div>
        </div>
      </div>

      <section aria-labelledby="results-heading" className="space-y-4">
        <h2 id="results-heading" className="sr-only">
          Results
        </h2>
        <p role="status" className="text-muted text-sm font-medium">
          {status}
        </p>

        {state === "tracing" && results.length === 0 && (
          <div className="flex justify-center py-6">
            <ScanningPrint className="h-48 w-auto" />
          </div>
        )}

        {state === "error" && error && (
          <p
            role="alert"
            className="border-danger/40 text-danger rounded-lg border px-5 py-4"
          >
            {error}
          </p>
        )}

        {warning && (
          <p className="border-border text-muted rounded-lg border px-5 py-4 text-sm">
            {warning}
          </p>
        )}

        {state === "done" && results.length === 0 && (
          <p className="text-muted max-w-[34em]">{NO_MATCHES}</p>
        )}

        <div className="space-y-4">
          {results.map((result) => (
            <ResultCard
              key={result.id}
              result={result}
              snippetLines={snippetLines}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
