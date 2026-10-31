/**
 * Runs once when the server starts. Only end-to-end runs (CODEPRINT_E2E_MOCKS=1) use it: they
 * swap the real code search providers for offline fixtures, so tests never reach the internet.
 */
export async function register() {
  if (
    process.env.CODEPRINT_E2E_MOCKS !== "1" ||
    process.env.NEXT_RUNTIME !== "nodejs"
  )
    return;

  const { server } = await import("@/test/msw/server");
  const { traceHandlers } = await import("@/test/msw/trace-handlers");
  server.use(...traceHandlers);
  server.listen({ onUnhandledFrame: "bypass" });
}
