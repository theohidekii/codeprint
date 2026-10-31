import { ToolPlaceholder, toolMetadata } from "@/shared/ui/tool-placeholder";

export const metadata = toolMetadata("trace");

export default function Page() {
  return <ToolPlaceholder slug="trace" />;
}
