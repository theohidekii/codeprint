"use client";

import { Copy, Download } from "lucide-react";
import { useMemo, useReducer, useState } from "react";

import { EXAMPLE_SNIPPET } from "@/features/trace/domain/examples";
import { detectLanguage } from "@/features/trace/domain/tokenize";
import { CodeEditor } from "@/features/trace/ui/code-editor";
import {
  type LanguageChoice,
  LanguageSelect,
} from "@/features/trace/ui/language-select";
import { Button } from "@/shared/ui/button";

import { MAX_COLUMNS, MAX_LINES } from "../domain/layout";
import { DEFAULT_OPTIONS, optionsReducer } from "../domain/options";
import {
  copyPngToClipboard,
  downloadBlob,
  snapshotFilename,
} from "../export/files";
import { svgToPngBlob } from "../export/png";
import { OptionsPanel } from "./options-panel";
import { SnapshotPreview } from "./snapshot-preview";
import { useSnapshot } from "./use-snapshot";

const COPIED = "Copied";
const EXPORT_FAILED = "Couldn't create the image. Try again.";
const RENDER_FAILED = "Couldn't render this snippet. Edit it to try again.";
const COPY_UNSUPPORTED =
  "Copy isn't available in this browser. Download the PNG instead.";

export function SnapshotView() {
  const [code, setCode] = useState("");
  const [choice, setChoice] = useState<LanguageChoice>("auto");
  const [options, dispatch] = useReducer(optionsReducer, DEFAULT_OPTIONS);
  const [status, setStatus] = useState("");

  const detected = useMemo(() => detectLanguage(code), [code]);
  const language = choice === "auto" ? detected : choice;
  const { svg, model, pending, failed } = useSnapshot(code, language, options);
  const shown = svg !== null && model !== null;
  // An out-of-date preview stays visible, but exporting it would give the wrong image.
  const ready = shown && !pending;

  const png = () => svgToPngBlob(svg!, model!.width, model!.height);

  const downloadPng = async () => {
    setStatus("");
    try {
      downloadBlob(
        await png(),
        snapshotFilename(options.title, language, "png"),
      );
    } catch {
      setStatus(EXPORT_FAILED);
    }
  };

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-start">
      <div className="order-2 space-y-8 lg:order-1">
        <div>
          <CodeEditor value={code} onChange={setCode} onSubmit={() => {}} />
          <div className="mt-4 flex flex-wrap items-center gap-3">
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
        </div>
        <OptionsPanel options={options} dispatch={dispatch} />
      </div>

      <div className="order-1 space-y-4 lg:sticky lg:top-6 lg:order-2">
        <div className="border-border bg-surface-raised overflow-hidden rounded-lg border p-3 sm:p-4">
          {shown ? (
            <SnapshotPreview
              svg={svg}
              model={model}
              highlighted={options.highlighted}
              onToggleLine={(line) => dispatch({ type: "toggle-line", line })}
            />
          ) : (
            <div className="text-muted grid aspect-[1200/627] place-items-center text-sm">
              {failed ? RENDER_FAILED : "Paste code to see it here."}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button disabled={!ready} onClick={downloadPng}>
            <Download aria-hidden className="size-4" />
            Download PNG
          </Button>
          <Button
            variant="secondary"
            disabled={!ready}
            onClick={() =>
              downloadBlob(
                new Blob([svg!], { type: "image/svg+xml" }),
                snapshotFilename(options.title, language, "svg"),
              )
            }
          >
            Download SVG
          </Button>
          <Button
            variant="secondary"
            disabled={!ready}
            onClick={async () => {
              setStatus("");
              // Not awaited first: Safari only accepts a write started within the click.
              const result = await copyPngToClipboard(png());
              setStatus(result === "copied" ? COPIED : COPY_UNSUPPORTED);
            }}
          >
            <Copy aria-hidden className="size-4" />
            Copy image
          </Button>
          {options.highlighted.length > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => dispatch({ type: "clear-highlights" })}
            >
              Clear highlights
            </Button>
          )}
        </div>

        <p role="status" className="text-muted min-h-5 text-sm">
          {status}
        </p>
        {failed && shown && (
          <p className="text-danger text-sm">{RENDER_FAILED}</p>
        )}
        {model?.truncated.lines && (
          <p className="text-muted text-sm">
            Showing the first {MAX_LINES} lines
          </p>
        )}
        {model?.truncated.columns && (
          <p className="text-muted text-sm">
            Long lines are cut at {MAX_COLUMNS} characters
          </p>
        )}
        {shown && (
          <p className="text-muted text-sm">
            Click a line in the preview to highlight it.
          </p>
        )}
      </div>
    </div>
  );
}
