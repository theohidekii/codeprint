/** Tokens per k-gram when fingerprinting. */
export const K = 5;
/** Winnowing window, in k-grams. */
export const WINDOW = 4;
/** Shorter snippets match almost everywhere, so they are refused. */
export const MIN_TOKENS = 20;
/** Results below this share of matching fingerprints are dropped. */
export const MIN_SIMILARITY = 0.25;
