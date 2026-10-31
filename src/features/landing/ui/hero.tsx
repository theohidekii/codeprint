import Link from "next/link";

import { buttonVariants } from "@/shared/ui/button";

import { LatentPrint } from "./latent-print";

export function Hero() {
  return (
    <section className="grid items-center gap-12 py-10 md:grid-cols-[1.05fr_1fr] md:py-14 md:pb-24">
      <div>
        <h1 className="text-hero font-black">The fingerprint of code.</h1>
        <p className="text-lead text-muted mt-7 max-w-[30em]">
          Trace a snippet back to its source, even after the variables were
          renamed. Then turn code into something worth sharing.
        </p>
        <div className="mt-9 flex flex-wrap gap-3">
          <Link href="/trace" className={buttonVariants({ size: "lg" })}>
            Trace a snippet
          </Link>
          <a
            href="https://github.com/theohidekii/codeprint"
            target="_blank"
            rel="noopener noreferrer"
            className={buttonVariants({ variant: "secondary", size: "lg" })}
          >
            View on GitHub
          </a>
        </div>
      </div>
      <figure className="mx-auto w-full max-w-[420px] md:max-w-[540px] md:justify-self-end">
        <LatentPrint />
      </figure>
    </section>
  );
}
