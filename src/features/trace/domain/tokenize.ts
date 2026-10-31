import { LANGUAGE_SPECS } from "./languages";
import type { Language, Token, TokenKind } from "./types";

// Longest first, so "===" wins over "==" and "=".
const OPERATORS = [
  ">>>=",
  "...",
  "===",
  "!==",
  "**=",
  "<<=",
  ">>=",
  ">>>",
  "&&=",
  "||=",
  "??=",
  "=>",
  "==",
  "!=",
  "<=",
  ">=",
  "&&",
  "||",
  "??",
  "?.",
  "++",
  "--",
  "+=",
  "-=",
  "*=",
  "/=",
  "%=",
  "&=",
  "|=",
  "^=",
  "**",
  "<<",
  ">>",
  "::",
  "->",
  ":=",
];
const PUNCTUATION = new Set(["(", ")", "[", "]", "{", "}", ",", ";"]);
const MULTILINE_QUOTES = new Set(["`", '"""', "'''"]);

const IDENTIFIER = /[\p{L}_$][\p{L}\p{N}_$]*/uy;
const NUMBER =
  /(?:0[xXbBoO][\da-fA-F_]+|(?:\d[\d_]*)?\.?\d[\d_]*(?:[eE][+-]?\d+)?)[a-zA-Z]*/y;
const RUST_CHAR = /'(?:\\.[^'\n]*|[^'\\\n])'/y;

function matchAt(
  pattern: RegExp,
  source: string,
  index: number,
): string | null {
  pattern.lastIndex = index;
  return pattern.exec(source)?.[0] ?? null;
}

/**
 * Splits source code into tokens in a single forward pass. Whitespace and comments are skipped.
 * Malformed input (unterminated strings or comments) never throws: the token runs to the end.
 */
export function tokenize(source: string, language: Language): Token[] {
  const spec = LANGUAGE_SPECS[language];
  const tokens: Token[] = [];
  let i = 0;
  let line = 1;

  const advanceTo = (end: number) => {
    for (let j = i; j < end; j++) if (source[j] === "\n") line++;
    i = end;
  };

  const push = (kind: TokenKind, end: number) => {
    tokens.push({ kind, text: source.slice(i, end), line, start: i, end });
    advanceTo(end);
  };

  while (i < source.length) {
    const ch = source[i]!;

    if (/\s/.test(ch)) {
      advanceTo(i + 1);
      continue;
    }

    if (spec.lineComments.some((prefix) => source.startsWith(prefix, i))) {
      const newline = source.indexOf("\n", i);
      i = newline === -1 ? source.length : newline;
      continue;
    }

    const block = spec.blockComments.find(([open]) =>
      source.startsWith(open, i),
    );
    if (block) {
      const close = source.indexOf(block[1], i + block[0].length);
      advanceTo(close === -1 ? source.length : close + block[1].length);
      continue;
    }

    const quote = spec.stringQuotes.find((q) => source.startsWith(q, i));
    if (quote) {
      push("string", stringEnd(source, i, quote));
      continue;
    }

    if (ch === "'" && language === "rust") {
      const literal = matchAt(RUST_CHAR, source, i);
      push(literal ? "string" : "operator", i + (literal?.length ?? 1)); // otherwise a lifetime such as 'a
      continue;
    }

    if (/\d/.test(ch) || (ch === "." && /\d/.test(source[i + 1] ?? ""))) {
      push("number", i + (matchAt(NUMBER, source, i) ?? ch).length);
      continue;
    }

    const identifier = matchAt(IDENTIFIER, source, i);
    if (identifier) {
      push(
        spec.keywords.has(identifier) ? "keyword" : "identifier",
        i + identifier.length,
      );
      continue;
    }

    if (PUNCTUATION.has(ch)) {
      push("punctuation", i + 1);
      continue;
    }

    const operator = OPERATORS.find((op) => source.startsWith(op, i)) ?? ch;
    push("operator", i + operator.length);
  }

  return tokens;
}

/** Offset just past the closing quote, honouring escapes. Single-line strings stop at a newline. */
function stringEnd(source: string, start: number, quote: string): number {
  const multiline = MULTILINE_QUOTES.has(quote);
  let j = start + quote.length;
  while (j < source.length) {
    const ch = source[j];
    if (ch === "\\") {
      j += 2;
      continue;
    }
    if (source.startsWith(quote, j)) return j + quote.length;
    if (ch === "\n" && !multiline) return j;
    j++;
  }
  return source.length;
}
