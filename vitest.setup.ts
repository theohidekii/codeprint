import "@testing-library/jest-dom/vitest";

import { server } from "@/test/msw/server";

// Any request without a handler fails the test: unit tests never reach the network.
beforeAll(() => server.listen({ onUnhandledFrame: "error" }));
afterEach(() => server.resetHandlers());
afterAll(() => server.close());
