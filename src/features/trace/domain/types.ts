import type { MatchRegion, Rename } from "./compare";

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

export interface TraceResult {
  /** `${repository}/${path}` */
  id: string;
  /** "owner/name" */
  repository: string;
  path: string;
  /** GitHub blob URL pointing at the first matching region. */
  url: string;
  stars: number | null;
  similarity: number;
  regions: MatchRegion[];
  renames: Rename[];
  /** Candidate lines around the first region, for the side-by-side view. */
  excerpt: { startLine: number; lines: string[] };
  /** Hash of the candidate's normalized tokens: equal hashes mean identical code. */
  contentHash: number;
  vendored: boolean;
  /** How many other results with identical content were collapsed into this one. */
  copies: number;
}
