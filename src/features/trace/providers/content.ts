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
    const text = await readCapped(response, MAX_FILE_BYTES);
    if (text === null) return null;
    if (text.slice(0, BINARY_SNIFF_LENGTH).includes("\u0000")) return null;
    return text;
  } catch {
    return null;
  }
}

/**
 * Reads a body as text, giving up (and closing the connection) once it passes `maxBytes`.
 * The declared length can be missing or describe the compressed size, so it is not trusted.
 */
async function readCapped(
  response: Response,
  maxBytes: number,
): Promise<string | null> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel().catch(() => {});
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return new TextDecoder().decode(bytes);
}
