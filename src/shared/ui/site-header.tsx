"use client";

import { Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import { cn } from "@/shared/lib/cn";
import { tools } from "@/shared/lib/tools";

import { FingerprintMark } from "./fingerprint-mark";
import { ThemeToggle } from "./theme-toggle";

function ToolLinks({
  pathname,
  className,
}: {
  pathname: string;
  className?: string;
}) {
  return tools.map((tool) => {
    const href = `/${tool.slug}`;
    const current = pathname === href;
    return (
      <Link
        key={tool.slug}
        href={href}
        aria-current={current ? "page" : undefined}
        className={cn(
          "transition-colors",
          current ? "text-text" : "text-muted hover:text-text",
          className,
        )}
      >
        {tool.name}
      </Link>
    );
  });
}

export function SiteHeader() {
  const pathname = usePathname();
  // The menu belongs to the page it was opened on, so navigating closes it without an effect.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const buttonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      setOpenOn(null);
      buttonRef.current?.focus();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  return (
    <header className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <div className="flex h-[72px] items-center justify-between gap-6">
        <Link
          href="/"
          aria-label="Codeprint home"
          className="flex items-center gap-2.5 text-[19px] font-black tracking-[-0.02em]"
        >
          <FingerprintMark className="text-accent size-[22px]" />
          Codeprint
        </Link>

        <div className="flex items-center gap-7">
          <nav
            aria-label="Primary"
            className="hidden items-center gap-7 text-[15px] md:flex"
          >
            <ToolLinks pathname={pathname} />
          </nav>
          <ThemeToggle />
          <button
            ref={buttonRef}
            type="button"
            aria-expanded={open}
            aria-controls={open ? "site-menu" : undefined}
            aria-label={open ? "Close menu" : "Open menu"}
            onClick={() => setOpenOn(open ? null : pathname)}
            className="border-border hover:bg-surface-raised grid size-10 place-items-center rounded-full border md:hidden"
          >
            {open ? (
              <X aria-hidden className="size-[18px]" />
            ) : (
              <Menu aria-hidden className="size-[18px]" />
            )}
          </button>
        </div>
      </div>

      {open && (
        <nav
          id="site-menu"
          aria-label="Menu"
          className="border-border bg-surface mb-4 flex flex-col rounded-lg border p-2 text-lg md:hidden"
        >
          <ToolLinks
            pathname={pathname}
            className="hover:bg-surface-raised rounded-md px-4 py-3"
          />
        </nav>
      )}
    </header>
  );
}
