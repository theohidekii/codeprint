export const PNG_SCALE = 2;

/**
 * Draws an SVG document onto a canvas and returns it as a PNG. The SVG must embed its fonts:
 * an image loaded from a blob cannot reach the page's fonts. Browser only.
 */
export async function svgToPngBlob(
  svg: string,
  width: number,
  height: number,
  scale = PNG_SCALE,
): Promise<Blob> {
  const url = URL.createObjectURL(new Blob([svg], { type: "image/svg+xml" }));
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();

    const canvas = document.createElement("canvas");
    canvas.width = Math.round(width * scale);
    canvas.height = Math.round(height * scale);
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is not available");
    context.drawImage(image, 0, 0, canvas.width, canvas.height);

    return await new Promise<Blob>((resolve, reject) =>
      canvas.toBlob(
        (blob) =>
          blob ? resolve(blob) : reject(new Error("PNG encoding failed")),
        "image/png",
      ),
    );
  } finally {
    URL.revokeObjectURL(url);
  }
}
