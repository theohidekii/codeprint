import type { Metadata } from "next";

export type ToolSlug = "trace" | "snapshot" | "fingerprint" | "blueprint";

export interface Tool {
  slug: ToolSlug;
  name: string;
  tagline: string;
  description: string;
}

/** Single source of truth for the tools: navigation, landing and tool pages all read from here. */
export const tools: readonly Tool[] = [
  {
    slug: "trace",
    name: "Trace",
    tagline: "Find where a snippet came from.",
    description:
      "Paste a snippet and find public repositories with the same code, even when every identifier was renamed, ranked by similarity.",
  },
  {
    slug: "snapshot",
    name: "Snapshot",
    tagline: "Turn a snippet into an image worth sharing.",
    description:
      "Polished images of your code, with themes, frames and annotations. Export to PNG or SVG.",
  },
  {
    slug: "fingerprint",
    name: "Fingerprint",
    tagline: "Generative art from a GitHub profile.",
    description:
      "Enter a GitHub user or repository and get a unique poster drawn from its languages, commit rhythm and active hours.",
  },
  {
    slug: "blueprint",
    name: "Blueprint",
    tagline: "A repository's architecture, drawn as a plan.",
    description:
      "See modules as rooms and dependencies as pipes, with callouts on the largest and most connected parts.",
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}

export function toolMetadata(slug: ToolSlug): Metadata {
  const tool = getTool(slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return { title: `${tool.name} | Codeprint`, description: tool.tagline };
}
