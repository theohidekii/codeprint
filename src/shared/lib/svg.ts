import type { EmbeddedFonts } from "./export/fonts";

// Characters XML 1.0 cannot contain at all, even escaped.
const INVALID_XML = /[\u0000-\u0008\u000B\u000C\u000E-\u001F￾￿]/g;

/** The one escaping function used for every text node and attribute value. */
export function escapeXml(text: string): string {
  // toWellFormed drops half of a broken emoji pair, which would make encodeURIComponent throw.
  return text
    .toWellFormed()
    .replace(/�/g, "")
    .replace(INVALID_XML, "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** The @font-face rules that make an SVG self-contained. */
export function fontFaces(fonts: EmbeddedFonts): string {
  return [
    `@font-face{font-family:'Fragment Mono';src:url(${fonts.mono}) format('woff2');}`,
    `@font-face{font-family:'Schibsted Grotesk';font-weight:700;src:url(${fonts.sans}) format('woff2');}`,
  ].join("");
}
