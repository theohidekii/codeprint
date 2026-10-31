import { LANGUAGES, type Language } from "./types";

type Signature = readonly [pattern: RegExp, weight: number];

const JS_SIGNATURES: readonly Signature[] = [
  [/\b(const|let|var) \w+\s*=/, 2],
  [/=>/, 2],
  [/\bconsole\./, 2],
  [/\bfunction\b/, 1],
  [/===|!==/, 1],
];

const SIGNATURES: Record<Exclude<Language, "generic">, readonly Signature[]> = {
  javascript: JS_SIGNATURES,
  // TypeScript is JavaScript plus types, so it only wins when type syntax shows up.
  typescript: [
    ...JS_SIGNATURES,
    [/:\s*(number|string|boolean|any|void|unknown|never)\b/, 3],
    [/\binterface \w+/, 2],
    [/\btype \w+\s*=/, 2],
    [/\bas const\b/, 2],
  ],
  python: [
    [/^\s*def \w+\(.*\)\s*(->.*)?:\s*$/m, 3],
    [/^\s*(elif|except|pass)\b/m, 2],
    [/\bself\./, 1],
    [/:\s*$/m, 1],
    [/\b(None|True|False)\b/, 1],
  ],
  java: [
    [/\bpublic (static )?(final )?(class|void|interface)\b/, 3],
    [/\bSystem\.out\./, 3],
    [/\bString\[\]/, 2],
    [/^import java\./m, 3],
  ],
  c: [
    [/#include\s*<\w+\.h>/, 4],
    [/\bprintf\(/, 2],
    [/\bint main\(/, 2],
    [/\bmalloc\(/, 2],
  ],
  cpp: [
    [/#include\s*<\w+>/, 4],
    [/\bstd::/, 3],
    [/\bcout\b/, 2],
    [/\btemplate\s*</, 2],
    [/\bnamespace\b/, 1],
  ],
  csharp: [
    [/^using System/m, 4],
    [/\bnamespace \w+/, 2],
    [/\bConsole\.Write/, 3],
  ],
  go: [
    [/^package \w+/m, 3],
    [/\bfunc\b/, 2],
    [/:=/, 1],
    [/\bfmt\./, 2],
  ],
  rust: [
    [/\bfn \w+/, 3],
    [/\blet mut\b/, 3],
    [/\bimpl\b|\w+!\(/, 2],
  ],
  php: [
    [/<\?php/, 5],
    [/\$\w+/, 2],
    [/\becho\b/, 1],
  ],
  ruby: [
    [/^\s*end\s*$/m, 3],
    [/^\s*def \w+[^:(\n]*$/m, 2],
    [/\bputs\b/, 2],
    [/\b(require|attr_accessor|elsif|unless)\b/, 2],
  ],
};

/** Guesses the language from weighted signatures. Ties go to the earlier language in LANGUAGES. */
export function detectLanguage(source: string): Language {
  let best: Language = "generic";
  let bestScore = 0;
  for (const language of LANGUAGES) {
    if (language === "generic") continue;
    const score = SIGNATURES[language].reduce(
      (sum, [pattern, weight]) => (pattern.test(source) ? sum + weight : sum),
      0,
    );
    if (score > bestScore) {
      best = language;
      bestScore = score;
    }
  }
  return best;
}
