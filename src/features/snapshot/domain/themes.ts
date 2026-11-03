export type SnapshotThemeId =
  "latent-dark" | "latent-light" | "cyanotype" | "paper" | "terminal";

interface TokenColorRule {
  scope: string | string[];
  settings: { foreground?: string; fontStyle?: string };
}

export interface SnapshotTheme {
  id: SnapshotThemeId;
  label: string;
  /** Behind the card. */
  background: string;
  card: string;
  cardBorder: string;
  text: string;
  /** Line numbers, window title and caption. */
  muted: string;
  /** Wash behind highlighted lines. */
  highlight: string;
  /** Window dots and the ridge motif. */
  accent: string;
  /** A Shiki theme for token colors. */
  shiki: {
    name: string;
    type: "dark" | "light";
    colors: Record<string, string>;
    tokenColors: TokenColorRule[];
  };
}

interface Palette {
  keyword: string;
  string: string;
  comment: string;
  fn: string;
  number: string;
  type: string;
}

/** One small palette per theme, mapped onto the TextMate scopes Shiki emits. */
function tokenColors(p: Palette, text: string): TokenColorRule[] {
  return [
    {
      scope: ["comment", "punctuation.definition.comment"],
      settings: { foreground: p.comment, fontStyle: "italic" },
    },
    {
      scope: [
        "keyword",
        "storage",
        "storage.type",
        "storage.modifier",
        "keyword.control",
        "keyword.operator.new",
        "keyword.operator.expression",
      ],
      settings: { foreground: p.keyword },
    },
    {
      scope: ["string", "string.quoted", "punctuation.definition.string"],
      settings: { foreground: p.string },
    },
    {
      scope: ["constant.numeric", "constant.language", "constant.character"],
      settings: { foreground: p.number },
    },
    {
      scope: ["entity.name.function", "support.function", "meta.function-call"],
      settings: { foreground: p.fn },
    },
    {
      scope: [
        "entity.name.type",
        "entity.name.class",
        "support.type",
        "support.class",
      ],
      settings: { foreground: p.type },
    },
    {
      scope: ["variable", "variable.parameter", "meta.definition.variable"],
      settings: { foreground: text },
    },
  ];
}

function theme(
  base: Omit<SnapshotTheme, "shiki">,
  type: "dark" | "light",
  palette: Palette,
): SnapshotTheme {
  return {
    ...base,
    shiki: {
      name: `codeprint-${base.id}`,
      type,
      colors: {
        "editor.background": base.card,
        "editor.foreground": base.text,
      },
      tokenColors: tokenColors(palette, base.text),
    },
  };
}

export const SNAPSHOT_THEMES: readonly SnapshotTheme[] = [
  theme(
    {
      id: "latent-dark",
      label: "Latent Dark",
      background: "#12121c",
      card: "#1b1b28",
      cardBorder: "#2e2d40",
      text: "#eceaf4",
      muted: "#a4a2b8",
      highlight: "#c08be624",
      accent: "#c08be6",
    },
    "dark",
    {
      keyword: "#c08be6",
      string: "#9fd8b0",
      comment: "#8f8da6",
      fn: "#8cc8ff",
      number: "#f0b37e",
      type: "#f2d27a",
    },
  ),
  theme(
    {
      id: "latent-light",
      label: "Latent Light",
      background: "#eef1f4",
      card: "#ffffff",
      cardBorder: "#cdd3dc",
      text: "#161a2e",
      muted: "#535a70",
      highlight: "#6a2c911a",
      accent: "#6a2c91",
    },
    "light",
    {
      keyword: "#6a2c91",
      string: "#1f7a4d",
      comment: "#5f6680",
      fn: "#1d5fae",
      number: "#a14a00",
      type: "#7a5200",
    },
  ),
  theme(
    {
      id: "cyanotype",
      label: "Cyanotype",
      background: "#123a73",
      card: "#0f3263",
      cardBorder: "#3b5f95",
      text: "#f3f6fb",
      muted: "#b9c8e0",
      highlight: "#ffd24a26",
      accent: "#ffd24a",
    },
    "dark",
    {
      keyword: "#ffd24a",
      string: "#a8e6cf",
      comment: "#a9bcd8",
      fn: "#ffffff",
      number: "#ffb38a",
      type: "#c6d8ff",
    },
  ),
  theme(
    {
      id: "paper",
      label: "Paper",
      background: "#ecebe6",
      card: "#fbfaf7",
      cardBorder: "#d9d6cc",
      text: "#1f1d1a",
      muted: "#625d55",
      highlight: "#b3261e14",
      accent: "#b3261e",
    },
    "light",
    {
      keyword: "#b3261e",
      string: "#2f6b3a",
      comment: "#6e6a62",
      fn: "#1f4f8a",
      number: "#8a4b00",
      type: "#5b3f8c",
    },
  ),
  theme(
    {
      id: "terminal",
      label: "Terminal",
      background: "#050806",
      card: "#0b0f0c",
      cardBorder: "#1f2a22",
      text: "#e6f2e9",
      muted: "#9fb5a5",
      highlight: "#4ade8022",
      accent: "#4ade80",
    },
    "dark",
    {
      keyword: "#4ade80",
      string: "#fde68a",
      comment: "#8aa394",
      fn: "#7dd3fc",
      number: "#fca5a5",
      type: "#c4b5fd",
    },
  ),
];

export function getSnapshotTheme(id: SnapshotThemeId): SnapshotTheme {
  const found = SNAPSHOT_THEMES.find((t) => t.id === id);
  if (!found) throw new Error(`Unknown snapshot theme: ${id}`);
  return found;
}
