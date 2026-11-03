import { buildEdges, pickHotspots } from "./edges";
import { extractImports, resolveImport } from "./imports";
import { groupModules, isSourcePath, type Module } from "./modules";

const file = (path: string, size = 100) => ({ path, size });

describe("isSourcePath", () => {
  it.each(["src/a.ts", "main.go", "lib/x.py", "a/b.rs"])("keeps %s", (path) => {
    expect(isSourcePath(path)).toBe(true);
  });

  it.each([
    "node_modules/x/a.js",
    "a/vendor/b.go",
    "dist/a.js",
    "build/a.js",
    ".github/x.js",
    "pnpm-lock.yaml",
    "lib/a.min.js",
    "logo.png",
    "README.md",
  ])("drops %s", (path) => {
    expect(isSourcePath(path)).toBe(false);
  });
});

describe("groupModules", () => {
  it("opens a folder that holds most of the code", () => {
    const names = groupModules([
      file("src/app/a.ts", 500),
      file("src/lib/b.ts", 500),
      file("tests/c.ts", 10),
    ]).map((m) => m.name);

    expect(names).toContain("src/app");
    expect(names).toContain("src/lib");
    expect(names).not.toContain("src");
  });

  it("always opens code folders, even when they aren't the majority", () => {
    const names = groupModules([
      file("src/core/a.ts", 10),
      file("src/ui/b.ts", 10),
      ...["a", "b", "c", "d", "e", "f"].map((d) => file(`${d}/x.ts`, 50)),
    ]).map((m) => m.name);

    expect(names).toContain("src/core");
    expect(names).toContain("src/ui");
  });

  it("keeps tests and examples in one room each", () => {
    const names = groupModules([
      file("test/e2e/a.ts", 900),
      file("test/unit/b.ts", 900),
      file("examples/x/c.ts", 900),
      file("src/d.ts", 10),
    ]).map((m) => m.name);

    expect(names).toContain("test");
    expect(names).toContain("examples");
    expect(names).not.toContain("test/e2e");
  });

  it("puts root files in a (root) room", () => {
    expect(groupModules([file("a.ts")])).toMatchObject([
      { id: "(root)", name: "(root)", files: 1, bytes: 100 },
    ]);
  });

  it("sorts by size and keeps each file's path", () => {
    const modules = groupModules([file("a/x.ts", 1), file("b/y.ts", 9)]);

    expect(modules[0]!.paths.length + modules[1]!.paths.length).toBe(2);
    expect(modules[0]!.bytes).toBeGreaterThanOrEqual(modules[1]!.bytes);
  });

  it("merges the smallest beyond 24 modules into (other)", () => {
    const files = Array.from({ length: 40 }, (_, i) =>
      file(`f${i}/a.ts`, 100 + i),
    );
    const modules = groupModules(files);

    expect(modules).toHaveLength(24);
    expect(modules.map((m) => m.name)).toContain("(other)");
    expect(modules.reduce((sum, m) => sum + m.files, 0)).toBe(40);
  });

  it("gives nothing without source files", () => {
    expect(groupModules([file("README.md")])).toEqual([]);
  });

  it("handles 50,000 paths in under 200ms", () => {
    const files = Array.from({ length: 50_000 }, (_, i) =>
      file(`pkg${i % 50}/sub${i % 7}/f${i}.ts`),
    );
    const started = performance.now();

    groupModules(files);

    expect(performance.now() - started).toBeLessThan(200);
  });
});

describe("extractImports", () => {
  it("finds every JavaScript import form", () => {
    const source = `
      import a from "./a";
      import "./side";
      export { b } from "./b";
      const c = require("./c");
      const d = await import("./d");
    `;

    expect(extractImports(source, "typescript").sort()).toEqual([
      "./a",
      "./b",
      "./c",
      "./d",
      "./side",
    ]);
  });

  it("ignores imports in comments and strings", () => {
    const source = `// import a from "./no"\nconst s = 'import b from "./no2"';`;

    expect(extractImports(source, "typescript")).toEqual([]);
  });

  it("reads every Python import form", () => {
    const source =
      "from . import (\n  a,\n  b as c,\n)\nfrom pkg import sub, other\nimport x, y.z as w";

    expect(extractImports(source, "python").sort()).toEqual([
      ".a",
      ".b",
      "pkg",
      "pkg.other",
      "pkg.sub",
      "x",
      "y.z",
    ]);
  });

  it("finds Python imports", () => {
    const source =
      "from .a import x\nfrom . import y\nimport pkg.mod\n# import no";

    expect(extractImports(source, "python").sort()).toEqual([
      ".a",
      ".a.x",
      ".y",
      "pkg.mod",
    ]);
  });
});

describe("resolveImport", () => {
  const known = new Set([
    "src/a.ts",
    "src/b/index.tsx",
    "src/c.ts",
    "pkg/m.py",
    "pkg/sub/__init__.py",
  ]);

  it.each([
    ["src/x.ts", "./a", "src/a.ts"],
    ["src/x.ts", "./b", "src/b/index.tsx"],
    ["src/b/y.ts", "../c", "src/c.ts"],
    ["src/x.ts", "./c.js", "src/c.ts"],
    ["other/z.ts", "@/a", "src/a.ts"],
    ["pkg/x.py", ".m", "pkg/m.py"],
    ["pkg/x.py", ".sub", "pkg/sub/__init__.py"],
    ["other.py", "pkg.m", "pkg/m.py"],
  ])("from %s, %s is %s", (from, spec, expected) => {
    expect(resolveImport(from, spec, known)).toBe(expected);
  });

  it.each([
    ["apps/web/a.ts", "@acme/core", "packages/core/src/index.ts"],
    ["apps/web/a.ts", "ui", "packages/ui/index.ts"],
  ])("from %s, the workspace package %s is %s", (from, spec, expected) => {
    const files = new Set([
      "packages/core/src/index.ts",
      "packages/ui/index.ts",
    ]);
    const workspace = new Map([
      ["@acme/core", "packages/core"],
      ["ui", "packages/ui"],
    ]);

    expect(resolveImport(from, spec, files, workspace)).toBe(expected);
  });

  it("doesn't mistake a third-party package for a workspace folder", () => {
    const files = new Set(["packages/core/src/index.ts"]);
    const workspace = new Map([["@acme/core", "packages/core"]]);

    expect(resolveImport("a.ts", "@babel/core", files, workspace)).toBeNull();
    expect(resolveImport("a.ts", "core", files, workspace)).toBeNull();
  });

  it("finds Python packages under src", () => {
    expect(
      resolveImport("tests/a.py", "pkg.x", new Set(["src/pkg/x.py"])),
    ).toBe("src/pkg/x.py");
  });

  it.each([
    ["src/x.ts", "react"],
    ["src/x.ts", "../../../etc"],
    ["src/x.ts", "./missing"],
    ["pkg/x.py", "...too.far.up"],
  ])("from %s, %s resolves to nothing", (from, spec) => {
    expect(resolveImport(from, spec, known)).toBeNull();
  });
});

const mod = (id: string, bytes: number, paths: string[]): Module => ({
  id,
  name: id,
  bytes,
  files: paths.length,
  paths,
});

describe("buildEdges", () => {
  const modules = [mod("a", 10, ["a/1.ts", "a/2.ts"]), mod("b", 5, ["b/1.ts"])];

  it("weighs pairs, ignores imports within a module, and notes the main direction", () => {
    const edges = buildEdges(
      [
        { path: "a/1.ts", targets: ["b/1.ts", "a/2.ts"] },
        { path: "a/2.ts", targets: ["b/1.ts"] },
        { path: "b/1.ts", targets: ["a/1.ts"] },
      ],
      modules,
    );

    expect(edges).toEqual([{ from: "a", to: "b", weight: 3 }]);
  });

  it("keeps the 40 heaviest, deterministically", () => {
    const many = Array.from({ length: 12 }, (_, i) =>
      mod(`m${i}`, 1, [`m${i}/a.ts`]),
    );
    const imports = many.map((m) => ({
      path: m.paths[0]!,
      targets: many.filter((o) => o !== m).map((o) => o.paths[0]!),
    }));

    const edges = buildEdges(imports, many);

    expect(edges).toHaveLength(40);
    expect(buildEdges(imports, many)).toEqual(edges);
  });
});

describe("pickHotspots", () => {
  it("names the largest and the most connected", () => {
    const modules = [
      mod("big", 100, []),
      mod("hub", 10, []),
      mod("x", 1, []),
      mod("y", 1, []),
    ];
    const edges = [
      { from: "hub", to: "x", weight: 1 },
      { from: "hub", to: "y", weight: 1 },
    ];

    expect(pickHotspots(modules, edges).slice(0, 2)).toEqual([
      { moduleId: "big", reason: "largest" },
      { moduleId: "hub", reason: "most connected" },
    ]);
  });

  it("names only the largest without dependencies", () => {
    expect(pickHotspots([mod("a", 2, []), mod("b", 1, [])], [])).toEqual([
      { moduleId: "a", reason: "largest" },
    ]);
  });

  it("gives nothing for no modules", () => {
    expect(pickHotspots([], [])).toEqual([]);
  });
});
