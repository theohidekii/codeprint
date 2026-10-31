import type { Language } from "./types";

/** Used by "Try an example" and by the end-to-end fixtures. */
export const EXAMPLE_SNIPPET: { language: Language; code: string } = {
  language: "javascript",
  code: `function debounce(fn, ms) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}`,
};
