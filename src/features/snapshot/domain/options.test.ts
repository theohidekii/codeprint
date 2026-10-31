import { DEFAULT_OPTIONS, optionsReducer } from "./options";

describe("snapshot options", () => {
  it("starts from the documented defaults", () => {
    expect(DEFAULT_OPTIONS).toEqual({
      theme: "latent-dark",
      background: "ridges",
      frame: "window",
      title: "",
      lineNumbers: true,
      highlighted: [],
      caption: "",
      size: "auto",
      padding: "comfortable",
    });
  });

  it("merges a patch", () => {
    const next = optionsReducer(DEFAULT_OPTIONS, {
      type: "set",
      patch: { theme: "paper", size: "linkedin" },
    });

    expect(next).toMatchObject({
      theme: "paper",
      size: "linkedin",
      frame: "window",
    });
  });

  it("toggles highlighted lines, kept sorted and unique", () => {
    let state = DEFAULT_OPTIONS;
    for (const line of [5, 2, 9, 2]) {
      state = optionsReducer(state, { type: "toggle-line", line });
    }

    expect(state.highlighted).toEqual([5, 9]);
  });

  it("clears every highlight", () => {
    const state = optionsReducer(
      { ...DEFAULT_OPTIONS, highlighted: [1, 3] },
      { type: "clear-highlights" },
    );

    expect(state.highlighted).toEqual([]);
  });

  it("trims titles to 60 and captions to 120 characters", () => {
    const state = optionsReducer(DEFAULT_OPTIONS, {
      type: "set",
      patch: { title: "t".repeat(80), caption: "c".repeat(200) },
    });

    expect(state.title).toHaveLength(60);
    expect(state.caption).toHaveLength(120);
  });
});
