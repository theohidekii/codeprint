import type { LanguageShare, Profile } from "./profile";
import { seededRandom } from "./random";

export type PrintPattern = "loop" | "whorl" | "arch";

export interface Traits {
  seed: string;
  pattern: PrintPattern;
  /** Offset of the print's core from its centre. */
  core: { x: number; y: number };
  ridgeCount: number;
  /** How restless the ridges are. */
  wobble: number;
  /** Which languages color the ridges, and how many of them each one gets. */
  bands: LanguageShare[];
  /** Activity per UTC hour, from 0 to 1. */
  ring: number[];
  peakHour: number | null;
  /** Nothing public to draw from but the name. */
  quiet: boolean;
}

const PATTERNS: readonly PrintPattern[] = ["loop", "whorl", "arch"];
const MAX_CORE_OFFSET = 24;
const MIN_RIDGES = 14;
const MAX_RIDGES = 34;
/** Sizes are drawn on a log scale, reaching MAX_RIDGES at 100,000 repositories or files. */
const SIZE_DECADES = 5;
const MIN_WOBBLE = 0.4;
const MAX_WOBBLE = 5;
/** The largest possible spread of seven counts: all activity on a single day. */
const MAX_WEEKDAY_SPREAD = Math.sqrt(6);

/** How uneven the week is: 0 when every day is the same, 1 when it all happens on one day. */
function burstiness(weekdays: readonly number[]): number {
  const total = weekdays.reduce((sum, n) => sum + n, 0);
  if (total === 0) return 0;
  const mean = total / weekdays.length;
  const variance =
    weekdays.reduce((sum, n) => sum + (n - mean) ** 2, 0) / weekdays.length;
  return Math.min(1, Math.sqrt(variance) / mean / MAX_WEEKDAY_SPREAD);
}

/** Maps a profile to the visual choices of its print. Same profile, same traits. */
export function deriveTraits(profile: Profile): Traits {
  const seed = profile.name.toLowerCase();
  const random = seededRandom(seed);

  const pattern = PATTERNS[Math.floor(random() * PATTERNS.length)]!;
  const core = {
    x: (random() * 2 - 1) * MAX_CORE_OFFSET,
    y: (random() * 2 - 1) * MAX_CORE_OFFSET,
  };

  const scale = Math.min(1, Math.log10(profile.sizes.count + 1) / SIZE_DECADES);
  const peak = Math.max(...profile.hours);

  return {
    seed,
    pattern,
    core,
    ridgeCount: Math.round(MIN_RIDGES + scale * (MAX_RIDGES - MIN_RIDGES)),
    wobble:
      MIN_WOBBLE + burstiness(profile.weekdays) * (MAX_WOBBLE - MIN_WOBBLE),
    bands: profile.languages,
    ring: profile.hours.map((count) => (peak > 0 ? count / peak : 0)),
    peakHour: peak > 0 ? profile.hours.indexOf(peak) : null,
    quiet: profile.sampled === 0 && profile.languages.length === 0,
  };
}
