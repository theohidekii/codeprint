export function SimilarityMeter({ value }: { value: number }) {
  const percent = Math.round(value * 100);

  return (
    <div className="flex items-center gap-3">
      <div
        role="meter"
        aria-label="Similarity"
        aria-valuenow={percent}
        aria-valuemin={0}
        aria-valuemax={100}
        className="bg-accent-soft h-1.5 w-24 overflow-hidden rounded-full"
      >
        <div
          className="bg-accent h-full rounded-full"
          style={{ width: `${percent}%` }}
        />
      </div>
      <span className="text-text text-sm font-bold tabular-nums">
        {percent}% similar
      </span>
    </div>
  );
}
