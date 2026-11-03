"use client";

import { useId } from "react";

import { cn } from "@/shared/lib/cn";

export interface Choice<T extends string> {
  value: T;
  label: string;
  swatch?: [string, string];
}

/** Native radio buttons styled as a segmented control; arrow keys move between them. */
export function RadioGroup<T extends string>({
  label,
  value,
  choices,
  onChange,
}: {
  label: string;
  value: T;
  choices: readonly Choice<T>[];
  onChange: (value: T) => void;
}) {
  const id = useId();
  return (
    <div role="radiogroup" aria-labelledby={id} className="space-y-2">
      <span id={id} className="text-muted text-sm font-medium">
        {label}
      </span>
      <div className="flex flex-wrap gap-2">
        {choices.map((choice) => (
          <label
            key={choice.value}
            className={cn(
              "border-border bg-surface text-text hover:bg-surface-raised inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm font-medium transition-colors",
              "has-[:checked]:border-accent has-[:checked]:bg-accent-soft has-[:checked]:text-accent",
              "has-[:focus-visible]:outline-accent has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2",
            )}
          >
            <input
              type="radio"
              name={id}
              value={choice.value}
              checked={value === choice.value}
              onChange={() => onChange(choice.value)}
              className="sr-only"
            />
            {choice.swatch && (
              <span
                aria-hidden
                className="border-border size-3.5 rounded-full border"
                style={{
                  background: `linear-gradient(135deg, ${choice.swatch[0]} 50%, ${choice.swatch[1]} 50%)`,
                }}
              />
            )}
            {choice.label}
          </label>
        ))}
      </div>
    </div>
  );
}
