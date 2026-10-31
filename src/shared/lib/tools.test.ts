import { getTool, tools } from "./tools";

describe("tool registry", () => {
  it("lists the four tools in build order", () => {
    expect(tools.map((tool) => tool.slug)).toEqual([
      "trace",
      "snapshot",
      "fingerprint",
      "blueprint",
    ]);
  });

  it("assigns each tool to its phase", () => {
    expect(tools.map((tool) => tool.phase)).toEqual([2, 3, 4, 5]);
  });

  it("marks Trace as available and the other tools as coming soon", () => {
    expect(tools.map((tool) => tool.status)).toEqual([
      "available",
      "coming-soon",
      "coming-soon",
      "coming-soon",
    ]);
  });

  it("finds a tool by slug", () => {
    expect(getTool("trace")?.name).toBe("Trace");
  });

  it("returns undefined for an unknown slug", () => {
    expect(getTool("nope")).toBeUndefined();
  });

  it("keeps copy short enough to fit the cards", () => {
    for (const tool of tools) {
      expect(tool.tagline.length, tool.slug).toBeLessThanOrEqual(60);
      expect(tool.description.length, tool.slug).toBeLessThanOrEqual(160);
    }
  });
});
