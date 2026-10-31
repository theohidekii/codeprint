import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export function Card({ className, ...props }: ComponentProps<"article">) {
  return (
    <article
      className={cn("border-border bg-surface rounded-lg border", className)}
      {...props}
    />
  );
}
