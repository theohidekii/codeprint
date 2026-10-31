import { parseEnv } from "./env.schema";

describe("parseEnv", () => {
  it("accepts a minimal environment without a GitHub token", () => {
    const env = parseEnv({ NODE_ENV: "test" });

    expect(env).toEqual({ NODE_ENV: "test" });
    expect(env.GITHUB_TOKEN).toBeUndefined();
  });

  it("treats an empty GitHub token as missing", () => {
    expect(
      parseEnv({ NODE_ENV: "test", GITHUB_TOKEN: "" }).GITHUB_TOKEN,
    ).toBeUndefined();
  });

  it("keeps a provided GitHub token", () => {
    expect(
      parseEnv({ NODE_ENV: "test", GITHUB_TOKEN: "ghp_x" }).GITHUB_TOKEN,
    ).toBe("ghp_x");
  });

  it("rejects an unknown NODE_ENV and names the variable", () => {
    expect(() => parseEnv({ NODE_ENV: "staging" })).toThrow(/NODE_ENV/);
  });
});
