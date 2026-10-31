/** Streams values as newline-delimited JSON. Cancelling the stream stops the source. */
export function toNdjsonStream(
  values: AsyncIterable<unknown>,
): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder();
  const iterator = values[Symbol.asyncIterator]();

  return new ReadableStream({
    async pull(controller) {
      const { done, value } = await iterator.next();
      if (done) controller.close();
      else controller.enqueue(encoder.encode(`${JSON.stringify(value)}\n`));
    },
    async cancel() {
      await iterator.return?.();
    },
  });
}
