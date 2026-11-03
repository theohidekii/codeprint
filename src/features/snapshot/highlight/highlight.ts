import {
  createHighlighterCore,
  type HighlighterCore,
  type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRawEngine } from "shiki/engine/javascript";

import type { Language } from "@/features/trace/domain/types";

import { type ColoredLine, MAX_COLUMNS, MAX_LINES } from "../domain/layout";
import type { SnapshotTheme } from "../domain/themes";

const TOKENIZE_TIME_LIMIT_MS = 5000;

// Shiki's FontStyle flags.
const ITALIC = 1;
const BOLD = 2;

let instance: Promise<HighlighterCore> | undefined;

/**
 * One shared highlighter with only the languages Codeprint supports, using grammars precompiled
 * to JavaScript regexes (no WebAssembly, no slow conversion on first use), created lazily.
 */
export function getHighlighter(): Promise<HighlighterCore> {
  instance ??= createHighlighterCore({
    engine: createJavaScriptRawEngine(),
    langs: [
      import("@shikijs/langs-precompiled/javascript"),
      import("@shikijs/langs-precompiled/typescript"),
      import("@shikijs/langs-precompiled/python"),
      import("@shikijs/langs-precompiled/java"),
      import("@shikijs/langs-precompiled/c"),
      import("@shikijs/langs-precompiled/cpp"),
      import("@shikijs/langs-precompiled/csharp"),
      import("@shikijs/langs-precompiled/go"),
      import("@shikijs/langs-precompiled/rust"),
      import("@shikijs/langs-precompiled/php"),
      import("@shikijs/langs-precompiled/ruby"),
    ],
    themes: [],
  });
  return instance;
}

/** Colors code with a snapshot theme, one array of tokens per source line. */
export async function highlight(
  code: string,
  language: Language,
  theme: SnapshotTheme,
): Promise<ColoredLine[]> {
  const highlighter = await getHighlighter();
  if (!highlighter.getLoadedThemes().includes(theme.shiki.name)) {
    await highlighter.loadTheme(theme.shiki as ThemeRegistration);
  }

  // The image shows at most MAX_LINES × MAX_COLUMNS. One extra line and some extra columns
  // survive so the layout can still tell the code was cut.
  const visible = code
    .split("\n")
    .slice(0, MAX_LINES + 1)
    .map((line) => line.slice(0, MAX_COLUMNS * 4))
    .join("\n");

  const lines = highlighter.codeToTokensBase(visible, {
    lang: language === "generic" ? "text" : language,
    theme: theme.shiki.name,
    // Shiki silently stops coloring a line that takes longer than this. On a cold start the
    // JavaScript regex engine compiles grammars lazily, so the default 500 ms is too tight.
    tokenizeTimeLimit: TOKENIZE_TIME_LIMIT_MS,
  });

  return lines.map((line) =>
    line.map((token) => {
      const style = token.fontStyle ?? 0;
      return {
        text: token.content,
        color: token.color ?? theme.text,
        ...(style & ITALIC
          ? { fontStyle: "italic" as const }
          : style & BOLD
            ? { fontStyle: "bold" as const }
            : {}),
      };
    }),
  );
}
