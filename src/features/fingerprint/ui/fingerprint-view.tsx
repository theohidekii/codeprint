"use client";

import { Copy, Download } from "lucide-react";
import { type FormEvent, useEffect, useMemo, useState } from "react";

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
import { FingerprintMark } from "@/shared/ui/fingerprint-mark";
import { RadioGroup } from "@/shared/ui/radio-group";

import { POSTER_THEMES, type PosterThemeId } from "../domain/palettes";
import { layoutPoster, type PosterSize } from "../domain/poster";
import { renderPoster } from "../domain/render-poster";
import { isValidTarget } from "../domain/target";
import { deriveTraits } from "../domain/traits";
import { useFingerprint } from "./use-fingerprint";

const EXAMPLE = "vercel/next.js";
const INVALID = "Enter a GitHub username or owner/repo.";
const COPIED = "Copied";
const COPY_UNSUPPORTED =
  "Copy isn't available in this browser. Download the PNG instead.";
const EXPORT_FAILED = "Couldn't create the image. Try again.";

const SIZE_CHOICES: readonly { value: PosterSize; label: string }[] = [
  { value: "portrait", label: "Portrait 1080×1350" },
  { value: "square", label: "Square 1080×1080" },
  { value: "landscape", label: "Landscape 1200×627" },
];

const HOW_TO_READ = [
  "The pattern and its centre come from the name, so every account has its own.",
  "Ridge colors show the languages, in proportion to how much each is used.",
  "Calm ridges mean steady work across the week; restless ones mean bursts.",
  "The ring is a 24-hour clock in UTC: a longer tick means more activity then.",
  "More ridges mean more repositories or files.",
];

export function FingerprintView() {
  const [target, setTarget] = useState("");
  const [invalid, setInvalid] = useState(false);
  const [theme, setTheme] = useState<PosterThemeId>("latent-dark");
  const [size, setSize] = useState<PosterSize>("portrait");
  const [fonts, setFonts] = useState<EmbeddedFonts | null>(null);
  const [status, setStatus] = useState("");
  const { state, profile, error, generate, reset } = useFingerprint();

  useEffect(() => {
    if (!profile || fonts) return;
    // Without the fonts the poster still works, in the system's sans-serif.
    loadEmbeddedFonts().then(setFonts, () => setFonts({ mono: "", sans: "" }));
  }, [profile, fonts]);

  const poster = useMemo(() => {
    if (!profile || !fonts) return null;
    const model = layoutPoster(profile, deriveTraits(profile), { theme, size });
    return {
      model,
      svg: renderPoster(
        model,
        getSnapshotTheme(theme),
        fonts.sans ? fonts : undefined,
      ),
    };
  }, [profile, fonts, theme, size]);

  const start = (value: string) => {
    const clean = value.trim();
    setStatus("");
    if (!isValidTarget(clean)) {
      reset();
      setInvalid(true);
      return;
    }
    setInvalid(false);
    generate(clean);
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (target.trim()) start(target);
  };

  const png = () =>
    svgToPngBlob(poster!.svg, poster!.model.width, poster!.model.height);
  const filename = (ext: "png" | "svg") =>
    filenameFor(profile?.name ?? "", "codeprint-fingerprint", ext);

  const downloadPng = async () => {
    setStatus("");
    try {
      downloadBlob(await png(), filename("png"));
    } catch {
      setStatus(EXPORT_FAILED);
    }
  };

  const shownError = invalid ? INVALID : error;

  return (
    <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:items-start">
      <div className="space-y-8">
        <form onSubmit={submit} className="space-y-3" noValidate>
          <label
            htmlFor="fingerprint-target"
            className="text-muted block text-sm font-medium"
          >
            GitHub user or repository
          </label>
          <div className="flex flex-wrap gap-2">
            <input
              id="fingerprint-target"
              type="text"
              value={target}
              onChange={(event) => setTarget(event.target.value)}
              placeholder="octocat or owner/repo"
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

        {shownError && (
          <p
            role="alert"
            className="border-danger/40 text-danger rounded-lg border px-5 py-4"
          >
            {shownError}
          </p>
        )}

        {poster && (
          <div className="space-y-6">
            <RadioGroup
              label="Theme"
              value={theme}
              choices={POSTER_THEMES.map((id) => {
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
              choices={SIZE_CHOICES}
              onChange={setSize}
            />
            <div>
              <h2 id="how-to-read" className="text-text text-sm font-bold">
                How to read it
              </h2>
              <ul
                aria-labelledby="how-to-read"
                className="text-muted mt-3 max-w-[34em] space-y-2 text-sm"
              >
                {HOW_TO_READ.map((line) => (
                  <li key={line}>{line}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:sticky lg:top-6">
        <div className="border-border bg-surface-raised overflow-hidden rounded-lg border p-3 sm:p-4">
          {poster ? (
            // eslint-disable-next-line @next/next/no-img-element -- a data URL isolates the SVG's styles
            <img
              alt={`Poster for ${profile!.name}`}
              src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(poster.svg)}`}
              className="block h-auto w-full"
            />
          ) : (
            <div className="text-muted grid aspect-[4/5] place-items-center text-sm">
              {state === "loading" || profile ? (
                <ScanningPrint className="h-64 w-auto" />
              ) : (
                <div className="grid justify-items-center gap-4">
                  <FingerprintMark
                    className="text-ridge-idle size-24"
                    strokeWidth={1}
                  />
                  Your print appears here.
                </div>
              )}
            </div>
          )}
        </div>

        <p role="status" className="text-muted min-h-5 text-sm">
          {state === "loading" ? "Reading public activity…" : status}
        </p>

        {poster && (
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={downloadPng}>
              <Download aria-hidden className="size-4" />
              Download PNG
            </Button>
            <Button
              variant="secondary"
              onClick={() =>
                downloadBlob(
                  new Blob([poster.svg], { type: "image/svg+xml" }),
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
                setStatus(result === "copied" ? COPIED : COPY_UNSUPPORTED);
              }}
            >
              <Copy aria-hidden className="size-4" />
              Copy image
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
