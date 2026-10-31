import type { Token } from "./types";

export interface SearchQuery {
  kind: "exact" | "structural" | "anchor";
  pattern: string;
  regex: boolean;
}

const MIN_EXACT_LINE = 20;
/** GitHub code search rejects queries over 256 characters. */
const MAX_EXACT_CHARS = 200;
const MAX_STRUCTURAL_TOKENS = 40;
const STRUCTURAL_LINES = 3;
const MIN_ANCHOR_STRING = 6;
const MIN_ANCHOR_MEMBER = 5;
const MAX_ANCHORS_PER_KIND = 2;

const escapeRegex = (text: string) =>
  text.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");

const isWordLike = (token: Token) =>
  token.kind === "keyword" ||
  token.kind === "identifier" ||
  token.kind === "number";

/**
 * Search engines match text, not normalized tokens, so a snippet becomes several queries:
 * an exact line, a structural regex that survives renaming, and rare literal anchors.
 */
export function buildQueries(source: string, tokens: Token[]): SearchQuery[] {
  const queries: SearchQuery[] = [];

  const exact = exactLine(source);
  if (exact) queries.push({ kind: "exact", pattern: exact, regex: false });

  const structural = structuralPattern(tokens);
  if (structural)
    queries.push({ kind: "structural", pattern: structural, regex: true });

  for (const pattern of anchors(tokens)) {
    if (pattern !== exact)
      queries.push({ kind: "anchor", pattern, regex: false });
  }
  return queries;
}

function exactLine(source: string): string | null {
  let best: string | null = null;
  for (const raw of source.split("\n")) {
    const line = raw.trim();
    if (line.length >= MIN_EXACT_LINE && line.length > (best?.length ?? 0))
      best = line;
  }
  return best?.slice(0, MAX_EXACT_CHARS) ?? null;
}

function tokenPattern(token: Token): string {
  switch (token.kind) {
    case "identifier":
      return String.raw`\w+`;
    case "number":
      return String.raw`\d[\w.]*`;
    case "string": {
      const quote = escapeRegex(token.text[0] ?? '"');
      return `${quote}[^${quote}\\n]*${quote}`;
    }
    default:
      return escapeRegex(token.text);
  }
}

function structuralPattern(tokens: Token[]): string | null {
  const lines = new Map<number, Token[]>();
  for (const token of tokens) {
    const group = lines.get(token.line);
    if (group) group.push(token);
    else lines.set(token.line, [token]);
  }
  const groups = [...lines.values()];
  if (groups.length === 0) return null;

  // The window of consecutive lines with the most tokens carries the most structure.
  const size = Math.min(STRUCTURAL_LINES, groups.length);
  let bestStart = 0;
  let bestCount = -1;
  for (let start = 0; start + size <= groups.length; start++) {
    const count = groups
      .slice(start, start + size)
      .reduce((sum, g) => sum + g.length, 0);
    if (count > bestCount) {
      bestStart = start;
      bestCount = count;
    }
  }

  // Long patterns are slow to search and can exceed URL limits; a prefix still matches.
  let budget = MAX_STRUCTURAL_TOKENS;
  return groups
    .slice(bestStart, bestStart + size)
    .map((line) => {
      const group = line.slice(0, Math.max(0, budget));
      budget -= group.length;
      return group;
    })
    .filter((group) => group.length > 0)
    .map((group) =>
      group
        .map((token, i) => {
          const prev = group[i - 1];
          if (!prev) return tokenPattern(token);
          const gap =
            isWordLike(prev) && isWordLike(token)
              ? String.raw`\s+`
              : String.raw`\s*`;
          return gap + tokenPattern(token);
        })
        .join(""),
    )
    .join(String.raw`\s*\n\s*`);
}

/** Rarest first (fewest occurrences in the snippet), then in order of appearance. */
function rarest(values: string[]): string[] {
  const counts = new Map<string, number>();
  for (const value of values) counts.set(value, (counts.get(value) ?? 0) + 1);
  return [...counts.keys()]
    .sort((a, b) => counts.get(a)! - counts.get(b)!)
    .slice(0, MAX_ANCHORS_PER_KIND);
}

function anchors(tokens: Token[]): string[] {
  const strings = tokens
    .filter((t) => t.kind === "string")
    .map((t) => t.text.slice(1, -1))
    .filter((inner) => inner.length >= MIN_ANCHOR_STRING);

  const members = tokens
    .filter((t, i) => {
      const prev = tokens[i - 1];
      return (
        t.kind === "identifier" &&
        t.text.length >= MIN_ANCHOR_MEMBER &&
        (prev?.text === "." || prev?.text === "?.")
      );
    })
    .map((t) => `.${t.text}`);

  return [...rarest(strings), ...rarest(members)];
}
