"use client";

import type { SnapshotModel } from "../domain/layout";

const percent = (part: number, whole: number) => `${(part / whole) * 100}%`;

/**
 * The exported image itself, shown as an <img>, with one invisible button per line on top of it
 * so lines can be highlighted by clicking them.
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
          type="button"
          aria-label={`Line ${line.number}`}
          aria-pressed={highlighted.includes(line.number)}
          onClick={() => onToggleLine(line.number)}
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
