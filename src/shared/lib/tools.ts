export type ToolStatus = "available" | "coming-soon";
export type ToolSlug = "trace" | "snapshot" | "fingerprint" | "blueprint";

export interface Tool {
  slug: ToolSlug;
  name: string;
  tagline: string;
  description: string;
  status: ToolStatus;
  phase: 2 | 3 | 4 | 5;
}

/** Single source of truth for the tools: navigation, landing and tool pages all read from here. */
export const tools: readonly Tool[] = [
  {
    slug: "trace",
    name: "Trace",
    tagline: "Find where a snippet came from.",
    description:
      "Paste a snippet and find public repositories with the same code, even when every identifier was renamed, ranked by similarity.",
    status: "available",
    phase: 2,
  },
  {
    slug: "snapshot",
    name: "Snapshot",
    tagline: "Turn a snippet into an image worth sharing.",
    description:
      "Polished images of your code, with themes, frames and annotations. Export to PNG or SVG.",
    status: "coming-soon",
    phase: 3,
  },
  {
    slug: "fingerprint",
    name: "Fingerprint",
    tagline: "Generative art from a GitHub profile.",
    description:
      "Enter a GitHub user or repository and get a unique poster drawn from its languages, commit rhythm and active hours.",
    status: "coming-soon",
    phase: 4,
  },
  {
    slug: "blueprint",
    name: "Blueprint",
    tagline: "A repository's architecture, drawn as a plan.",
    description:
      "See modules and dependencies as a technical blueprint, with hotspots where files grow large or tangled.",
    status: "coming-soon",
    phase: 5,
  },
];

export function getTool(slug: string): Tool | undefined {
  return tools.find((tool) => tool.slug === slug);
}
