import type { ComponentProps } from "react";

/** The Codeprint mark: a few fingerprint ridges. Decorative, so it is hidden from assistive tech. */
export function FingerprintMark(props: ComponentProps<"svg">) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      aria-hidden
      {...props}
    >
      <path d="M12 3a8 8 0 0 0-8 8v2" />
      <path d="M20 13v-2a8 8 0 0 0-4-6.9" />
      <path d="M8 20a10 10 0 0 0 1-5v-4a3 3 0 0 1 6 0v3" />
      <path d="M12 11v4a14 14 0 0 1-1.5 6" />
      <path d="M16 17a17 17 0 0 1-.6 3.6" />
    </svg>
  );
}
