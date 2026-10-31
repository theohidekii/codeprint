"use client";

import { ExternalLink, Star } from "lucide-react";
import { useId, useState } from "react";

import { Badge } from "@/shared/ui/badge";
import { Button, buttonVariants } from "@/shared/ui/button";
import { Card } from "@/shared/ui/card";

import type { TraceResult } from "../domain/types";
import { ComparisonView } from "./comparison-view";
import { SimilarityMeter } from "./similarity-meter";

const compact = new Intl.NumberFormat("en", {
  notation: "compact",
  maximumFractionDigits: 1,
});

export function ResultCard({
  result,
  snippetLines,
}: {
  result: TraceResult;
  snippetLines: string[];
}) {
  const [open, setOpen] = useState(false);
  const panelId = useId();

  return (
    <Card className="p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div className="min-w-0">
          <h3 className="text-h3 truncate font-bold">{result.repository}</h3>
          <p className="text-muted mt-1 truncate font-mono text-[13px]">
            {result.path}
          </p>
        </div>
        <SimilarityMeter value={result.similarity} />
      </div>

      <div className="text-muted mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
        {result.stars !== null && (
          <span className="flex items-center gap-1.5">
            <Star aria-hidden className="size-4" />
            <span>{compact.format(result.stars)}</span>
            <span className="sr-only">stars</span>
          </span>
        )}
        {result.copies > 0 && (
          <span>
            Also found in {result.copies} other{" "}
            {result.copies === 1 ? "copy" : "copies"}
          </span>
        )}
        {result.vendored && <Badge>Vendored copy</Badge>}
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button
          variant="secondary"
          size="sm"
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          onClick={() => setOpen((value) => !value)}
        >
          Compare
        </Button>
        <a
          href={result.url}
          target="_blank"
          rel="noopener noreferrer"
          className={buttonVariants({ variant: "ghost", size: "sm" })}
        >
          Open on GitHub
          <ExternalLink aria-hidden className="size-4" />
        </a>
      </div>

      {open && (
        <div id={panelId}>
          <ComparisonView result={result} snippetLines={snippetLines} />
        </div>
      )}
    </Card>
  );
}
