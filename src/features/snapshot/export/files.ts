import type { Language } from "@/features/trace/domain/types";

/** A file name from the snapshot title, or `codeprint-<language>` without one. */
export function snapshotFilename(
  title: string,
  language: Language,
  ext: "png" | "svg",
): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return `${slug || `codeprint-${language}`}.${ext}`;
}

/** Saves a blob through a temporary download link. */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  // Revoking in the same tick can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 0);
}

/**
 * Puts a PNG on the clipboard where the browser allows it. Never throws. Pass the PNG as a
 * promise while it is still being made: Safari only accepts a write started within the click.
 */
export async function copyPngToClipboard(
  png: Blob | Promise<Blob>,
): Promise<"copied" | "unsupported"> {
  if (typeof ClipboardItem === "undefined" || !navigator.clipboard?.write) {
    return "unsupported";
  }
  try {
    // Start the write now (inside the click), and fail if the image itself couldn't be made.
    await Promise.all([
      navigator.clipboard.write([new ClipboardItem({ "image/png": png })]),
      png,
    ]);
    return "copied";
  } catch {
    return "unsupported";
  }
}
