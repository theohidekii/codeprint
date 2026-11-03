"use client";

import { Copy, Download } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { isValidTarget } from "@/features/fingerprint/domain/target";
import type { PosterThemeId } from "@/features/fingerprint/domain/palettes";
import { getSnapshotTheme } from "@/features/snapshot/domain/themes";
import { ScanningPrint } from "@/features/trace/ui/scanning-print";
import {
  copyPngToClipboard,
  downloadBlob,
  filenameFor,
} from "@/shared/lib/export/files";
import {
  type EmbeddedFonts,
  loadEmbeddedFonts,
} from "@/shared/lib/export/fonts";
import { svgToPngBlob } from "@/shared/lib/export/png";
import { Button } from "@/shared/ui/button";
import { RadioGroup } from "@/shared/ui/radio-group";

import { layoutPlan, type PlanSize } from "../domain/plan";
import { renderPlan } from "../domain/render-plan";
import type { Analysis } from "../server/analyze";
import { PlanViewport } from "./plan-viewport";

const EXAMPLE = "vercel/swr";
const INVALID = "Enter a repository as owner/repo.";
const SERVER_FAILED = "GitHub didn't respond. Try again shortly.";
const NETWORK_FAILED =
  "Couldn't reach the server. Check your connection and try again.";
const EXPORT_FAILED = "Couldn't create the image. Try again.";
const COPY_UNSUPPORTED =
  "Copy isn't available in this browser. Download the PNG instead.";

const THEMES: readonly PosterThemeId[] = ["cyanotype", "latent-dark", "paper"];
const SIZES: readonly { value: PlanSize; label: string }[] = [
  { value: "landscape", label: "Landscape 1600×1000" },
  { value: "square", label: "Square 1080×1080" },
  { value: "linkedin", label: "LinkedIn 1200×627" },
];

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function BlueprintView() {
  const [target, setTarget] = useState("");
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [theme, setTheme] = useState<PosterThemeId>("cyanotype");
  const [size, setSize] = useState<PlanSize>("landscape");
  const [selected, setSelected] = useState<string | null>(null);
  const [fonts, setFonts] = useState<EmbeddedFonts | null>(null);
  const request = useRef<AbortController | null>(null);

  useEffect(() => () => request.current?.abort(), []);

  useEffect(() => {
    if (!analysis || fonts) return;
    loadEmbeddedFonts().then(setFonts, () => setFonts({ mono: "", sans: "" }));
  }, [analysis, fonts]);

  const start = useCallback((value: string) => {
    const clean = value.trim();
    request.current?.abort();
    setStatus("");
    setAnalysis(null);
    setSelected(null);
    if (!clean.includes("/") || !isValidTarget(clean)) {
      setLoading(false);
      setError(INVALID);
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    setError(null);
    setLoading(true);

    void (async () => {
      let result: { analysis?: Analysis; error?: string };
      try {
        const response = await fetch(
          `/api/blueprint?target=${encodeURIComponent(clean)}`,
          { signal: controller.signal },
        );
        const body: unknown = await response.json().catch(() => null);
        result = response.ok
          ? { analysis: body as Analysis }
          : {
              error:
                (body as { message?: string } | null)?.message ?? SERVER_FAILED,
            };
      } catch {
        result = { error: NETWORK_FAILED };
      }
      if (controller.signal.aborted) return;
      setLoading(false);
      setAnalysis(result.analysis ?? null);
      setError(result.error ?? null);
    })();
  }, []);

  const plan = useMemo(() => {
    if (!analysis || !fonts || analysis.modules.length === 0) return null;
    const model = layoutPlan(analysis, { size });
    return {
      model,
      svg: renderPlan(model, getSnapshotTheme(theme), {
        fonts: fonts.sans ? fonts : undefined,
        selected,
      }),
    };
  }, [analysis, fonts, size, theme, selected]);

  const connections = useMemo(() => {
    const counts = new Map<string, number>();
    for (const { from, to } of analysis?.edges ?? []) {
      counts.set(from, (counts.get(from) ?? 0) + 1);
      counts.set(to, (counts.get(to) ?? 0) + 1);
    }
    return counts;
  }, [analysis]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (target.trim()) start(target);
  };

  const png = () =>
    svgToPngBlob(plan!.svg, plan!.model.width, plan!.model.height);
  const filename = (ext: "png" | "svg") =>
    filenameFor(analysis?.repository ?? "", "codeprint-blueprint", ext);

  const notices = analysis
    ? [
        analysis.sampled && "Dependencies are based on the 300 largest files.",
        analysis.truncated &&
          "GitHub cut this repository's file list, so the plan may be incomplete.",
        analysis.unreadLanguages.length > 0 &&
          `Dependencies aren't read for this language yet: ${analysis.unreadLanguages.join(", ")}.`,
        analysis.partial &&
          "Some files couldn't be read, so the plan may be incomplete.",
      ].filter((notice): notice is string => Boolean(notice))
    : [];

  return (
    <div className="space-y-8">
      <form onSubmit={submit} className="max-w-2xl space-y-3" noValidate>
        <label
          htmlFor="blueprint-target"
          className="text-muted block text-sm font-medium"
        >
          GitHub repository
        </label>
        <div className="flex flex-wrap gap-2">
          <input
            id="blueprint-target"
            type="text"
            value={target}
            onChange={(event) => setTarget(event.target.value)}
            placeholder="owner/repo"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            className="border-border bg-surface text-text placeholder:text-muted/70 h-12 min-w-0 flex-1 basis-56 rounded-md border px-4"
          />
          <Button type="submit" size="lg" disabled={!target.trim()}>
            Generate
          </Button>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            setTarget(EXAMPLE);
            start(EXAMPLE);
          }}
        >
          Try an example
        </Button>
      </form>

      <p role="status" className="text-muted min-h-5 text-sm">
        {loading ? "Reading the repository…" : status}
      </p>

      {error && (
        <p
          role="alert"
          className="border-danger/40 text-danger rounded-lg border px-5 py-4"
        >
          {error}
        </p>
      )}

      {loading && (
        <div className="flex justify-center py-6">
          <ScanningPrint className="h-48 w-auto" />
        </div>
      )}

      {analysis?.modules.length === 0 && (
        <p className="text-muted">No source code to draw in this repository.</p>
      )}

      {plan && analysis && (
        <div className="space-y-6">
          <PlanViewport
            alt={`Floor plan of ${analysis.repository}`}
            src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(plan.svg)}`}
          />

          {notices.map((notice) => (
            <p key={notice} className="text-muted text-sm">
              {notice}
            </p>
          ))}

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={async () => {
                setStatus("");
                try {
                  downloadBlob(await png(), filename("png"));
                } catch {
                  setStatus(EXPORT_FAILED);
                }
              }}
            >
              <Download aria-hidden className="size-4" />
              Download PNG
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadBlob(
                  new Blob([plan.svg], { type: "image/svg+xml" }),
                  filename("svg"),
                )
              }
            >
              Download SVG
            </Button>
            <Button
              variant="secondary"
              onClick={async () => {
                setStatus("");
                // Not awaited first: Safari only accepts a write started within the click.
                const result = await copyPngToClipboard(png());
                setStatus(result === "copied" ? "Copied" : COPY_UNSUPPORTED);
              }}
            >
              <Copy aria-hidden className="size-4" />
              Copy image
            </Button>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <RadioGroup
              label="Theme"
              value={theme}
              choices={THEMES.map((id) => {
                const option = getSnapshotTheme(id);
                return {
                  value: id,
                  label: option.label,
                  swatch: [option.card, option.accent] as [string, string],
                };
              })}
              onChange={setTheme}
            />
            <RadioGroup
              label="Size"
              value={size}
              choices={SIZES}
              onChange={setSize}
            />
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <caption className="text-text mb-2 text-left font-bold">
                Rooms
              </caption>
              <thead className="text-muted">
                <tr>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Module
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Size
                  </th>
                  <th scope="col" className="py-2 pr-4 font-medium">
                    Files
                  </th>
                  <th scope="col" className="py-2 font-medium">
                    Connections
                  </th>
                </tr>
              </thead>
              <tbody>
                {analysis.modules.map((module_, i) => (
                  <tr key={module_.id} className="border-border border-t">
                    <td className="text-muted py-1.5 pr-4">{i + 1}</td>
                    <td className="py-1.5 pr-4">
                      <button
                        type="button"
                        aria-pressed={selected === module_.id}
                        onClick={() =>
                          setSelected(
                            selected === module_.id ? null : module_.id,
                          )
                        }
                        className="text-text aria-pressed:text-accent hover:text-accent text-left font-mono break-all"
                      >
                        {module_.name}
                      </button>
                    </td>
                    <td className="text-muted py-1.5 pr-4 whitespace-nowrap">
                      {formatBytes(module_.bytes)}
                    </td>
                    <td className="text-muted py-1.5 pr-4">{module_.files}</td>
                    <td className="text-muted py-1.5">
                      {connections.get(module_.id) ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
