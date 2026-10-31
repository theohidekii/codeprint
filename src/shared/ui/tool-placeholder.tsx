import type { Metadata } from "next";
import Link from "next/link";

import { getTool, type ToolSlug } from "@/shared/lib/tools";

import { Badge } from "./badge";
import { buttonVariants } from "./button";
import { FingerprintMark } from "./fingerprint-mark";

function requireTool(slug: ToolSlug) {
  const tool = getTool(slug);
  if (!tool) throw new Error(`Unknown tool: ${slug}`);
  return tool;
}

export function toolMetadata(slug: ToolSlug): Metadata {
  const tool = requireTool(slug);
  return { title: `${tool.name} | Codeprint`, description: tool.tagline };
}

/** Stand-in page for a tool that has not shipped yet. */
export function ToolPlaceholder({ slug }: { slug: ToolSlug }) {
  const tool = requireTool(slug);

  return (
    <section className="mx-auto grid w-full max-w-[1180px] gap-10 px-4 py-14 sm:px-6 md:grid-cols-[1fr_auto] md:items-center md:py-24">
      <div>
        <h1 className="text-hero font-black">{tool.name}</h1>
        <p className="text-lead text-muted mt-6 max-w-[30em]">
          {tool.description}
        </p>
        <Badge className="mt-6">Coming in Phase {tool.phase}</Badge>
        <div className="mt-10">
          <Link href="/" className={buttonVariants({ variant: "secondary" })}>
            Back to home
          </Link>
        </div>
      </div>
      <FingerprintMark
        className="text-ridge-idle hidden size-64 md:block"
        strokeWidth={0.6}
      />
    </section>
  );
}
