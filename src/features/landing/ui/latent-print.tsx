import { buildRidges, PRINT_CORE } from "../lib/ridges";

// The ridges are written in code: a few lines Trace would recognise even after renaming.
const CODE =
  "function sum(values){let acc=0;for(const v of values)acc+=v;return acc;} const total=items.reduce((a,b)=>a+b,0); if(!cache.has(key)){cache.set(key,compute(key))} export default trace; ";

const ridges = buildRidges();

function RidgeText({ className }: { className: string }) {
  return (
    <g className={className}>
      {ridges.map((ridge, i) => (
        <text key={ridge.id}>
          <textPath href={`#${ridge.id}`}>
            {CODE.repeat(3).slice((i * 37) % CODE.length)}
          </textPath>
        </text>
      ))}
    </g>
  );
}

/**
 * The signature visual: a fingerprint whose ridges are lines of code. On first load it
 * "develops" from the core outward, like a latent print treated with ninhydrin. The effect is a
 * CSS animation, so the server renders the developed print and reduced motion simply skips it.
 */
export function LatentPrint() {
  return (
    <svg
      viewBox="-160 -170 320 340"
      className="h-auto w-full overflow-visible font-mono text-[7.4px]"
      role="img"
      aria-label="A fingerprint whose ridges are lines of code"
    >
      <defs>
        {ridges.map((ridge) => (
          <path key={ridge.id} id={ridge.id} d={ridge.d} />
        ))}
        <clipPath id="fingertip">
          <ellipse cx="0" cy="0" rx="128" ry="160" />
        </clipPath>
        <clipPath id="developed">
          <circle
            cx={PRINT_CORE.x}
            cy={PRINT_CORE.y}
            r="240"
            className="develop"
          />
        </clipPath>
      </defs>
      <g clipPath="url(#fingertip)">
        <RidgeText className="fill-ridge-idle" />
        <g clipPath="url(#developed)">
          <RidgeText className="fill-accent" />
        </g>
      </g>
    </svg>
  );
}
