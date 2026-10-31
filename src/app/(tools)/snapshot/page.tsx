import { ToolPlaceholder, toolMetadata } from "@/shared/ui/tool-placeholder";

export const metadata = toolMetadata("snapshot");

export default function Page() {
  return <ToolPlaceholder slug="snapshot" />;
}
