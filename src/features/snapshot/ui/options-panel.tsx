"use client";

import { useId, type Dispatch, type ReactNode } from "react";

import { cn } from "@/shared/lib/cn";

import {
  MAX_CAPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type OptionsAction,
  type SnapshotOptions,
} from "../domain/options";
import { SNAPSHOT_THEMES } from "../domain/themes";

interface Choice<T extends string> {
  value: T;
  label: string;
  swatch?: [string, string];
}

/** Native radio buttons styled as a segmented control; arrow keys move between them. */
function RadioGroup<T extends string>({
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

function TextField({
  label,
  value,
  maxLength,
  placeholder,
  onChange,
}: {
  label: string;
  value: string;
  maxLength: number;
  placeholder: string;
  onChange: (value: string) => void;
}): ReactNode {
  return (
    <label className="text-muted block space-y-2 text-sm font-medium">
      <span>{label}</span>
      <input
        type="text"
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        className="border-border bg-surface text-text placeholder:text-muted/70 block h-10 w-full rounded-md border px-3 text-sm"
      />
    </label>
  );
}

export function OptionsPanel({
  options,
  dispatch,
}: {
  options: SnapshotOptions;
  dispatch: Dispatch<OptionsAction>;
}) {
  const set = (patch: Extract<OptionsAction, { type: "set" }>["patch"]) =>
    dispatch({ type: "set", patch });

  return (
    <div className="space-y-6">
      <RadioGroup
        label="Theme"
        value={options.theme}
        choices={SNAPSHOT_THEMES.map((t) => ({
          value: t.id,
          label: t.label,
          swatch: [t.card, t.accent],
        }))}
        onChange={(theme) => set({ theme })}
      />
      <RadioGroup
        label="Background"
        value={options.background}
        choices={[
          { value: "ridges", label: "Ridges" },
          { value: "solid", label: "Solid" },
          { value: "none", label: "None" },
        ]}
        onChange={(background) => set({ background })}
      />
      <div className="grid gap-6 sm:grid-cols-2">
        <RadioGroup
          label="Frame"
          value={options.frame}
          choices={[
            { value: "window", label: "Window" },
            { value: "minimal", label: "Minimal" },
          ]}
          onChange={(frame) => set({ frame })}
        />
        <RadioGroup
          label="Padding"
          value={options.padding}
          choices={[
            { value: "compact", label: "Compact" },
            { value: "comfortable", label: "Comfortable" },
            { value: "spacious", label: "Spacious" },
          ]}
          onChange={(padding) => set({ padding })}
        />
      </div>
      <RadioGroup
        label="Size"
        value={options.size}
        choices={[
          { value: "auto", label: "Auto" },
          { value: "linkedin", label: "LinkedIn 1200×627" },
          { value: "square", label: "Square 1080×1080" },
        ]}
        onChange={(size) => set({ size })}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <TextField
          label="Title"
          value={options.title}
          maxLength={MAX_TITLE_LENGTH}
          placeholder="debounce.js"
          onChange={(title) => set({ title })}
        />
        <TextField
          label="Caption"
          value={options.caption}
          maxLength={MAX_CAPTION_LENGTH}
          placeholder="Found in 19 public repos with Codeprint"
          onChange={(caption) => set({ caption })}
        />
      </div>
      <label className="text-text flex items-center gap-3 text-sm font-medium">
        <input
          type="checkbox"
          checked={options.lineNumbers}
          onChange={(event) => set({ lineNumbers: event.target.checked })}
          className="accent-accent size-4"
        />
        Line numbers
      </label>
    </div>
  );
}
