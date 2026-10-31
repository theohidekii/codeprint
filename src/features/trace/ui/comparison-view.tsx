import type { LineRange } from "../domain/compare";
import type { TraceResult } from "../domain/types";

const within = (line: number, ranges: LineRange[]) =>
  ranges.some((range) => line >= range.start && line <= range.end);

function CodePane({
  label,
  lines,
  firstLine,
  matched,
}: {
  label: string;
  lines: string[];
  firstLine: number;
  matched: LineRange[];
}) {
  return (
    <section aria-label={label} className="min-w-0">
      <h4 className="text-muted mb-2 truncate text-[13px] font-medium">
        {label}
      </h4>
      <pre className="border-border bg-background overflow-x-auto rounded-md border py-2 font-mono text-[13px] leading-[1.75]">
        {lines.map((text, i) => {
          const line = firstLine + i;
          const isMatch = within(line, matched);
          return (
            <div
              key={line}
              data-line={line}
              data-matched={isMatch}
              className={isMatch ? "bg-accent-soft" : undefined}
            >
              <span
                aria-hidden
                className="text-muted/70 inline-block w-10 pr-3 text-right select-none"
              >
                {line}
              </span>
              {text}
            </div>
          );
        })}
      </pre>
    </section>
  );
}

/** Your snippet next to the matching excerpt, with matched lines highlighted and renames listed. */
export function ComparisonView({
  result,
  snippetLines,
}: {
  result: TraceResult;
  snippetLines: string[];
}) {
  return (
    <div className="mt-5 space-y-4">
      <div className="grid gap-4 lg:grid-cols-2">
        <CodePane
          label="Your snippet"
          lines={snippetLines}
          firstLine={1}
          matched={result.regions.map((r) => r.snippet)}
        />
        <CodePane
          label={result.repository}
          lines={result.excerpt.lines}
          firstLine={result.excerpt.startLine}
          matched={result.regions.map((r) => r.candidate)}
        />
      </div>
      {result.renames.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Renamed</span>
          {result.renames.map(({ from, to }) => (
            <span
              key={from}
              className="bg-accent-soft text-accent rounded-sm px-2 py-0.5 font-mono text-[13px]"
            >
              {from} → {to}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
