"use client";

import { type Dispatch, type ReactNode } from "react";

import { RadioGroup } from "@/shared/ui/radio-group";

import {
  MAX_CAPTION_LENGTH,
  MAX_TITLE_LENGTH,
  type OptionsAction,
  type SnapshotOptions,
} from "../domain/options";
import { SNAPSHOT_THEMES } from "../domain/themes";

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
