import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";
import { FingerprintMark } from "@/shared/ui/fingerprint-mark";

export default function NotFound() {
  return (
    <section className="mx-auto w-full max-w-[1180px] px-4 py-24 sm:px-6">
      <FingerprintMark className="text-ridge-idle size-16" strokeWidth={1.2} />
      <h1 className="text-hero mt-8 font-black">No match found</h1>
      <p className="text-lead text-muted mt-6 max-w-[30em]">
        This page left no prints. Check the address, or start again from the
        home page.
      </p>
      <Link href="/" className={buttonVariants({ className: "mt-10" })}>
        Go to the home page
      </Link>
    </section>
  );
}
