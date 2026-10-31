import type { ComponentProps } from "react";

import { cn } from "@/shared/lib/cn";

export function Badge({ className, ...props }: ComponentProps<"span">) {
  return (
    <span
      className={cn(
        "bg-accent-soft text-accent inline-flex items-center rounded-full px-2.5 py-0.5 text-[13px] font-medium",
        className,
      )}
      {...props}
    />
  );
}
