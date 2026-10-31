import type { SearchHit } from "./types";

export const MAX_FILE_BYTES = 512 * 1024;
const BINARY_SNIFF_LENGTH = 1024;

/**
 * Downloads a candidate file at the matched commit. Anything unusable (missing, too large,
 * binary, or a failed request) yields null so one bad file never sinks a trace.
 */
export async function fetchFileContent(
  hit: SearchHit,
  options: { signal: AbortSignal; fetch?: typeof fetch },
): Promise<string | null> {
  const fetcher = options.fetch ?? fetch;
  const path = hit.path.split("/").map(encodeURIComponent).join("/");
  const url = `https://raw.githubusercontent.com/${hit.repository}/${hit.commit}/${path}`;

  try {
    const response = await fetcher(url, { signal: options.signal });
    if (!response.ok) return null;
    if (Number(response.headers.get("content-length") ?? 0) > MAX_FILE_BYTES) {
      return null;
    }
    const text = await response.text();
    if (text.length > MAX_FILE_BYTES) return null;
    if (text.slice(0, BINARY_SNIFF_LENGTH).includes("\u0000")) return null;
    return text;
  } catch {
    return null;
  }
}
