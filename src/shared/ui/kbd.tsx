import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export function Kbd({ className, ...props }: ComponentProps<"kbd">) {
  return (
    <kbd
      className={cn(
        "border-border bg-surface-raised text-muted inline-flex h-6 min-w-6 items-center justify-center rounded-sm border px-1.5 font-sans text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}
