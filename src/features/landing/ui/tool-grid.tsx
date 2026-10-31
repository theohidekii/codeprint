import Link from "next/link";

import type { Tool } from "@/shared/lib/tools";
import { Badge } from "@/shared/ui/badge";
import { Card } from "@/shared/ui/card";

export function ToolGrid({ tools }: { tools: readonly Tool[] }) {
  if (tools.length === 0) return null;

  return (
    <section
      aria-labelledby="tools-heading"
      className="pt-6 pb-14 md:pt-8 md:pb-24"
    >
      <h2 id="tools-heading" className="text-h2 font-black">
        Four ways to read code
      </h2>
      <div className="mt-10 grid gap-4 sm:grid-cols-2">
        {tools.map((tool) => (
          <Card
            key={tool.slug}
            className="group has-[a:focus-visible]:outline-accent hover:border-accent/60 relative p-7 transition-colors has-[a:focus-visible]:outline-2 has-[a:focus-visible]:outline-offset-3"
          >
            <div className="flex items-start justify-between gap-4">
              <h3 className="text-h3 font-bold">
                {/* The heading link covers the card, so the whole card is one click target. */}
                <Link
                  href={`/${tool.slug}`}
                  className="after:absolute after:inset-0 focus-visible:outline-none"
                >
                  {tool.name}
                </Link>
              </h3>
              <Badge>
                {tool.status === "available" ? "Available" : "Coming soon"}
              </Badge>
            </div>
            <p className="text-text mt-3 font-medium">{tool.tagline}</p>
            <p className="text-muted mt-2">{tool.description}</p>
          </Card>
        ))}
      </div>
    </section>
  );
}
