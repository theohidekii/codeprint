"use client";

import { Monitor, Moon, Sun, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useTheme } from "next-themes";

import { cn } from "@/shared/lib/cn";
import { useHydrated } from "@/shared/lib/use-hydrated";

type Mode = "system" | "light" | "dark";

const next: Record<Mode, Mode> = {
  system: "light",
  light: "dark",
  dark: "system",
};
const icons: Record<Mode, LucideIcon> = {
  system: Monitor,
  light: Sun,
  dark: Moon,
};

function toMode(theme: string | undefined): Mode {
  return theme === "light" || theme === "dark" ? theme : "system";
}

export function ThemeToggle({ className }: { className?: string }) {
  const { theme, setTheme } = useTheme();
  const hydrated = useHydrated();
  const reduceMotion = useReducedMotion();
  const mode = hydrated ? toMode(theme) : "system";
  const Icon = icons[mode];

  return (
    <button
      type="button"
      onClick={() => setTheme(next[mode])}
      aria-label={`Theme: ${mode}. Switch to ${next[mode]}`}
      className={cn(
        "border-border text-text hover:bg-surface-raised relative grid size-10 place-items-center overflow-hidden rounded-full border transition-colors",
        className,
      )}
    >
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.span
          key={mode}
          initial={reduceMotion ? false : { y: 14, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={
            reduceMotion
              ? { opacity: 0, transition: { duration: 0 } }
              : { y: -14, opacity: 0 }
          }
          transition={{ duration: 0.16, ease: [0.2, 0, 0, 1] }}
          className="grid place-items-center"
        >
          <Icon aria-hidden className="size-[18px]" strokeWidth={1.8} />
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
