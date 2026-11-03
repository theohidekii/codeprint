/** The bundled fonts as data: URLs. */
export interface EmbeddedFonts {
  mono: string;
  sans: string;
}

const FONT_FILES = {
  mono: "/fonts/FragmentMono-Regular.woff2",
  sans: "/fonts/SchibstedGrotesk-Bold.woff2",
} as const;

let cached: Promise<EmbeddedFonts> | undefined;

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

async function dataUrl(path: string, fetcher: typeof fetch): Promise<string> {
  const response = await fetcher(path);
  if (!response.ok) throw new Error(`Could not load ${path}`);
  const bytes = new Uint8Array(await response.arrayBuffer());
  return `data:font/woff2;base64,${toBase64(bytes)}`;
}

/**
 * The bundled fonts as data URLs, so exported images render the same everywhere. A canvas only
 * draws fonts that live inside the SVG itself. Loaded once per page.
 */
export function loadEmbeddedFonts(
  fetcher: typeof fetch = fetch,
): Promise<EmbeddedFonts> {
  cached ??= Promise.all([
    dataUrl(FONT_FILES.mono, fetcher),
    dataUrl(FONT_FILES.sans, fetcher),
  ])
    .then(([mono, sans]) => ({ mono, sans }))
    .catch((error: unknown) => {
      cached = undefined; // let a later export retry
      throw error;
    });
  return cached;
}

/** Forgets the cached fonts. For tests. */
export function resetEmbeddedFonts(): void {
  cached = undefined;
}
