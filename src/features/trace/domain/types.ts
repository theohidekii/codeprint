export const LANGUAGES = [
  "javascript",
  "typescript",
  "python",
  "java",
  "c",
  "cpp",
  "csharp",
  "go",
  "rust",
  "php",
  "ruby",
  "generic",
] as const;

export type Language = (typeof LANGUAGES)[number];

export type TokenKind =
  "keyword" | "identifier" | "string" | "number" | "operator" | "punctuation";

export interface Token {
  kind: TokenKind;
  text: string;
  /** 1-based line where the token starts. */
  line: number;
  /** Offset of the first character in the source. */
  start: number;
  /** Offset just past the last character. */
  end: number;
}
