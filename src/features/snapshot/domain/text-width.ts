/**
 * Fragment Mono's advance width divided by its font size: 618 units per 1000-unit em,
 * measured in Chromium with canvas measureText on 100 "M" glyphs at 100px.
 */
export const CHAR_WIDTH_RATIO = 0.618;

export const TAB_WIDTH = 2;

// East Asian wide and fullwidth ranges, plus emoji drawn as pictures: these take two cells.
const WIDE =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]|\p{Emoji_Presentation}|[\u{1F300}-\u{1FAFF}]|[\u{20000}-\u{3FFFD}]/u;

/** Cells one code point occupies in a monospace grid. */
export function cellWidth(char: string): 1 | 2 {
  return WIDE.test(char) ? 2 : 1;
}

/** Width of a text in monospace cells. Tabs count as TAB_WIDTH. */
export function columns(text: string): number {
  let total = 0;
  for (const char of text) {
    total += char === "\t" ? TAB_WIDTH : cellWidth(char);
  }
  return total;
}
