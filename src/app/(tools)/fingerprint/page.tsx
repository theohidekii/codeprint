import { FingerprintView } from "@/features/fingerprint/ui/fingerprint-view";
import { getTool } from "@/shared/lib/tools";
import { toolMetadata } from "@/shared/lib/tools";

export const metadata = toolMetadata("fingerprint");

export default function FingerprintPage() {
  const tool = getTool("fingerprint")!;

  return (
    <section className="mx-auto w-full max-w-[1180px] px-4 py-14 sm:px-6 md:py-20">
      <h1 className="text-hero font-black">{tool.name}</h1>
      <p className="text-lead text-muted mt-6 mb-12 max-w-[30em]">
        {tool.description}
      </p>
      <FingerprintView />
    </section>
  );
}
