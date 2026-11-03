"use client";

import { type KeyboardEvent, useRef, useState } from "react";

import type { SnapshotModel } from "../domain/layout";

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

/**
 * The exported image itself, shown as an <img>, with one invisible button per line on top of it
 * so lines can be highlighted by clicking them. The lines share one tab stop, and the arrow keys
 * move between them, so keyboard users don't have to tab through up to 80 buttons.
 */
export function SnapshotPreview({
  svg,
  model,
  highlighted,
  onToggleLine,
}: {
  svg: string;
  model: SnapshotModel;
  highlighted: readonly number[];
  onToggleLine: (line: number) => void;
}) {
  const { card } = model;
  const buttons = useRef(new Map<number, HTMLButtonElement>());
  const [current, setCurrent] = useState(1);
  const lastLine = model.lines.length;
  const tabStop = Math.min(current, lastLine);

  const moveFocus = (event: KeyboardEvent, from: number) => {
    const targets: Record<string, number> = {
      ArrowDown: from + 1,
      ArrowUp: from - 1,
      Home: 1,
      End: lastLine,
    };
    const target = targets[event.key];
    if (target === undefined) return;
    event.preventDefault();
    buttons.current.get(Math.max(1, Math.min(lastLine, target)))?.focus();
  };

  return (
    <div className="relative">
      {/* A data URL keeps the SVG's own styles away from the page. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        alt="Snapshot preview"
        src={`data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`}
        className="block h-auto w-full"
      />
      {model.lines.map((line) => (
        <button
          key={line.number}
          ref={(element) => {
            if (element) buttons.current.set(line.number, element);
            else buttons.current.delete(line.number);
          }}
          type="button"
          tabIndex={line.number === tabStop ? 0 : -1}
          aria-label={`Highlight line ${line.number}`}
          aria-pressed={highlighted.includes(line.number)}
          onClick={() => onToggleLine(line.number)}
          onFocus={() => setCurrent(line.number)}
          onKeyDown={(event) => moveFocus(event, line.number)}
          className="hover:bg-accent/10 focus-visible:outline-accent absolute cursor-pointer rounded-sm focus-visible:outline-2"
          style={{
            left: percent(card.x, model.width),
            width: percent(card.width * card.scale, model.width),
            top: percent(card.y + line.y * card.scale, model.height),
            height: percent(model.lineHeight * card.scale, model.height),
          }}
        />
      ))}
    </div>
  );
}
