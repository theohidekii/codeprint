// @vitest-environment node
import { createHighlighterCore } from "shiki/core";

import { getSnapshotTheme } from "../domain/themes";
import { highlight } from "./highlight";

vi.mock("shiki/core", () => ({ createHighlighterCore: vi.fn() }));

const fakeHighlighter = {
  getLoadedThemes: () => [] as string[],
  loadTheme: async () => {},
  codeToTokensBase: () => [[{ content: "x", color: "#ffffff", fontStyle: 0 }]],
};

describe("highlight after a failed start", () => {
  it("tries again instead of staying broken", async () => {
    vi.mocked(createHighlighterCore)
      .mockRejectedValueOnce(new Error("chunk failed to load"))
      .mockResolvedValueOnce(fakeHighlighter as never);
    const theme = getSnapshotTheme("latent-dark");

    await expect(highlight("x", "javascript", theme)).rejects.toThrow(
      "chunk failed",
    );
    await expect(highlight("x", "javascript", theme)).resolves.toEqual([
      [{ text: "x", color: "#ffffff" }],
    ]);
  });
});
