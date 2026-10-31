import { buildRidges } from "@/features/landing/lib/ridges";

const ridges = buildRidges();

/**
 * Shown while a trace runs: the fingerprint outline with a scan line sweeping across it.
 * The sweep is pure CSS, so reduced motion leaves a still print.
 */
export function ScanningPrint({ className }: { className?: string }) {
  return (
    <svg viewBox="-160 -170 320 340" aria-hidden className={className}>
      <defs>
        <clipPath id="scan-tip">
          <ellipse cx="0" cy="0" rx="128" ry="160" />
        </clipPath>
      </defs>
      <g
        clipPath="url(#scan-tip)"
        fill="none"
        strokeWidth="2.4"
        strokeLinecap="round"
      >
        {ridges.map((ridge) => (
          <path key={ridge.id} d={ridge.d} className="stroke-ridge-idle" />
        ))}
        <rect
          x="-160"
          y="-170"
          width="320"
          height="18"
          className="scan-line fill-accent/50"
        />
      </g>
    </svg>
  );
}
