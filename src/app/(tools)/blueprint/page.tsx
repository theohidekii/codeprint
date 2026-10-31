import { ToolPlaceholder, toolMetadata } from "@/shared/ui/tool-placeholder";

export const metadata = toolMetadata("blueprint");

export default function Page() {
  return <ToolPlaceholder slug="blueprint" />;
}
