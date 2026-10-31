import { ToolPlaceholder, toolMetadata } from "@/shared/ui/tool-placeholder";

export const metadata = toolMetadata("fingerprint");

export default function Page() {
  return <ToolPlaceholder slug="fingerprint" />;
}
