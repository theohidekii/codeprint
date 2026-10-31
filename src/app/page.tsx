import { HowItWorks } from "@/features/landing/ui/how-it-works";
import { Hero } from "@/features/landing/ui/hero";
import { ToolGrid } from "@/features/landing/ui/tool-grid";
import { tools } from "@/shared/lib/tools";

export default function Home() {
  return (
    <div className="mx-auto w-full max-w-[1180px] px-4 sm:px-6">
      <Hero />
      <ToolGrid tools={tools} />
      <HowItWorks />
    </div>
  );
}
