"use client";

import { useEffect, useState } from "react";

import { LANGUAGE_SPECS } from "@/features/trace/domain/languages";
import type { Language } from "@/features/trace/domain/types";

import { layoutSnapshot, type SnapshotModel } from "../domain/layout";
import type { SnapshotOptions } from "../domain/options";
import { renderSvg } from "../domain/render-svg";
import { getSnapshotTheme } from "../domain/themes";
import { loadEmbeddedFonts } from "../export/fonts";
import { highlight } from "../highlight/highlight";

const DEBOUNCE_MS = 120;

interface Rendered {
  key: string;
  svg: string;
  model: SnapshotModel;
}

/**
 * Renders the snapshot for the current code and options, debounced while typing. The SVG embeds
 * its fonts, so the preview is exactly the image that gets exported.
 */
export function useSnapshot(
  code: string,
  language: Language,
  options: SnapshotOptions,
): {
  svg: string | null;
  model: SnapshotModel | null;
  /** The shown image doesn't match the current input yet. */
  pending: boolean;
  /** The current input could not be rendered. */
  failed: boolean;
} {
  const [rendered, setRendered] = useState<Rendered | null>(null);
  const [failedKey, setFailedKey] = useState<string | null>(null);
  const empty = code.trim() === "";
  const key = JSON.stringify([code, language, options]);

  useEffect(() => {
    if (empty) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const theme = getSnapshotTheme(options.theme);
        const [lines, fonts] = await Promise.all([
          highlight(code, language, theme),
          loadEmbeddedFonts(),
        ]);
        if (cancelled) return;
        const model = layoutSnapshot(
          lines,
          options,
          LANGUAGE_SPECS[language].label,
        );
        const svg = renderSvg(model, theme, {
          background: options.background,
          fonts,
        });
        setRendered({ key, svg, model });
      } catch {
        // Keep the last good preview on screen; the next edit tries again.
        if (!cancelled) setFailedKey(key);
      }
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [code, language, options, empty, key]);

  if (empty) return { svg: null, model: null, pending: false, failed: false };
  const failed = failedKey === key;
  if (!rendered) return { svg: null, model: null, pending: !failed, failed };
  return {
    svg: rendered.svg,
    model: rendered.model,
    pending: rendered.key !== key,
    failed,
  };
}
