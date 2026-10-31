import type { Token, TokenKind } from "./types";

export interface NormalizedToken {
  value: string;
  token: Token;
}

const PLACEHOLDERS: Partial<Record<TokenKind, string>> = {
  identifier: "ID",
  string: "STR",
  number: "NUM",
};

/** Replaces names and literals with placeholders, so renamed copies compare as equal. */
export function normalize(tokens: Token[]): NormalizedToken[] {
  return tokens.map((token) => ({
    value: PLACEHOLDERS[token.kind] ?? token.text,
    token,
  }));
}
