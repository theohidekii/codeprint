"use client";

import { type KeyboardEvent, useRef } from "react";

import { cn } from "@/shared/lib/cn";

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  className?: string;
}

/** A plain text area with a line-number gutter. Ctrl/⌘ + Enter submits. */
export function CodeEditor({
  value,
  onChange,
  onSubmit,
  className,
}: CodeEditorProps) {
  const gutterRef = useRef<HTMLDivElement>(null);
  const lineCount = Math.max(1, value.split("\n").length);

  const onKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      onSubmit();
    }
  };

  return (
    <div
      className={cn(
        "border-border bg-surface focus-within:outline-accent flex overflow-hidden rounded-lg border focus-within:outline-2 focus-within:outline-offset-3",
        className,
      )}
    >
      <div
        ref={gutterRef}
        data-testid="gutter"
        aria-hidden
        className="bg-surface-raised text-muted/70 border-border w-12 shrink-0 overflow-hidden border-r py-4 pr-3 text-right font-mono text-sm leading-[1.75] select-none"
      >
        {Array.from({ length: lineCount }, (_, i) => (
          <div key={i}>{i + 1}</div>
        ))}
      </div>
      <textarea
        aria-label="Code snippet"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={onKeyDown}
        onScroll={(event) => {
          if (gutterRef.current)
            gutterRef.current.scrollTop = event.currentTarget.scrollTop;
        }}
        spellCheck={false}
        autoCapitalize="off"
        autoCorrect="off"
        placeholder="Paste a snippet of code…"
        wrap="off"
        className="text-text placeholder:text-muted/70 min-h-72 w-full resize-y bg-transparent px-4 py-4 font-mono text-sm leading-[1.75] outline-none"
      />
    </div>
  );
}
