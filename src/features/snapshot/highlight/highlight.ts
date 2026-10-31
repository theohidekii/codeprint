import {
  createHighlighterCore,
  type HighlighterCore,
  type ThemeRegistration,
} from "shiki/core";
import { createJavaScriptRegexEngine } from "shiki/engine/javascript";

import type { Language } from "@/features/trace/domain/types";

import type { ColoredLine } from "../domain/layout";
import type { SnapshotTheme } from "../domain/themes";

// Shiki's FontStyle flags.
const ITALIC = 1;
const BOLD = 2;

let instance: Promise<HighlighterCore> | undefined;

/**
 * One shared highlighter with only the languages Codeprint supports and the JavaScript regex
 * engine (no WebAssembly), created on first use.
 */
export function getHighlighter(): Promise<HighlighterCore> {
  instance ??= createHighlighterCore({
    engine: createJavaScriptRegexEngine(),
    langs: [
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/java.mjs"),
      import("shiki/langs/c.mjs"),
      import("shiki/langs/cpp.mjs"),
      import("shiki/langs/csharp.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/php.mjs"),
      import("shiki/langs/ruby.mjs"),
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

  const lines = highlighter.codeToTokensBase(code, {
    lang: language === "generic" ? "text" : language,
    theme: theme.shiki.name,
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
