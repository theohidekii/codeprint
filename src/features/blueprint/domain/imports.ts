import { tokenize } from "@/features/trace/domain/tokenize";
import type { Language, Token } from "@/features/trace/domain/types";

/** Package name to folder, for the packages of a monorepo. */
export type Workspace = ReadonlyMap<string, string>;

const JS_SUFFIXES = [
  "",
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  "/index.ts",
  "/index.tsx",
  "/index.js",
  "/index.jsx",
];

const unquote = (token: Token) => token.text.slice(1, -1);

function jsImports(tokens: Token[]): string[] {
  const specs: string[] = [];
  tokens.forEach((token, i) => {
    if (token.kind !== "string" || token.text.includes("${")) return;
    const prev = tokens[i - 1];
    const before = tokens[i - 2];
    const isImport =
      prev?.text === "from" ||
      prev?.text === "import" ||
      (prev?.text === "(" &&
        (before?.text === "require" || before?.text === "import"));
    if (isImport) specs.push(unquote(token));
  });
  return specs;
}

function pythonImports(tokens: Token[]): string[] {
  const specs: string[] = [];
  /** Joins tokens from `start` while they stay on the statement's line. */
  const dotted = (start: number) => {
    let text = "";
    let i = start;
    while (
      tokens[i] &&
      tokens[i]!.line === tokens[start]!.line &&
      tokens[i]!.text !== "import" &&
      tokens[i]!.text !== "as" &&
      tokens[i]!.text !== ","
    ) {
      text += tokens[i]!.text;
      i++;
    }
    return { text, end: i };
  };

  /** The names after `from x import`, which may be in parentheses across lines. */
  const importedNames = (start: number) => {
    const names: string[] = [];
    const open = tokens[start]?.text === "(";
    const line = tokens[start]?.line;
    let i = open ? start + 1 : start;
    while (tokens[i] && (open || tokens[i]!.line === line)) {
      const text = tokens[i]!.text;
      if (text === ")") break;
      if (text === "as") {
        i += 2;
        continue;
      }
      if (text !== "," && text !== "*") names.push(text);
      i++;
    }
    return names;
  };

  tokens.forEach((token, i) => {
    if (token.kind !== "keyword") return;
    if (token.text === "from" && tokens[i + 1]) {
      const { text, end } = dotted(i + 1);
      if (!text) return;
      if (!/^\.+$/.test(text)) specs.push(text);
      // `from pkg import sub` may name a module, so it's a candidate too.
      const prefix = text.endsWith(".") ? text : `${text}.`;
      for (const name of importedNames(end + 1)) specs.push(prefix + name);
    } else if (token.text === "import" && tokens[i - 1]?.line !== token.line) {
      let next = i + 1;
      while (tokens[next]?.line === token.line) {
        const { text, end } = dotted(next);
        if (text) specs.push(text);
        let after = end;
        if (tokens[after]?.text === "as") after += 2;
        if (tokens[after]?.text !== ",") break;
        next = after + 1;
      }
    }
  });
  return specs;
}

/** What a file imports. Reading tokens means comments and strings can't pass for imports. */
export function extractImports(source: string, language: Language): string[] {
  const tokens = tokenize(source, language);
  return language === "python" ? pythonImports(tokens) : jsImports(tokens);
}

/** Joins path segments, or null when `..` would leave the repository. */
function join(base: string[], relative: string): string | null {
  const parts = [...base];
  for (const part of relative.split("/")) {
    if (part === "" || part === ".") continue;
    if (part === "..") {
      if (parts.length === 0) return null;
      parts.pop();
    } else {
      parts.push(part);
    }
  }
  return parts.join("/");
}

/** In a monorepo, packages import each other by the name in their package.json. */
function resolveWorkspacePackage(
  spec: string,
  known: ReadonlySet<string>,
  workspace: Workspace,
): string | null {
  const parts = spec.split("/");
  const name = spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0]!;
  const folder = workspace.get(name);
  if (!folder) return null;
  for (const entry of ["src/index", "index"]) {
    for (const extension of [".ts", ".tsx", ".js", ".jsx"]) {
      const candidate = `${folder}/${entry}${extension}`;
      if (known.has(candidate)) return candidate;
    }
  }
  return null;
}

function resolveJs(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
  workspace: Workspace,
): string | null {
  let target: string | null;
  if (spec.startsWith("@/")) target = join(["src"], spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    target = join(fromPath.split("/").slice(0, -1), spec);
  } else {
    return resolveWorkspacePackage(spec, known, workspace);
  }
  if (target === null) return null;

  // TypeScript sources are often imported by their compiled .js name.
  const bases = [target, target.replace(/\.[cm]?jsx?$/, "")];
  for (const base of bases) {
    for (const suffix of JS_SUFFIXES) {
      if (known.has(base + suffix)) return base + suffix;
    }
  }
  return null;
}

function resolvePython(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
): string | null {
  const dots = /^\.*/.exec(spec)![0].length;
  const rest = spec.slice(dots).replaceAll(".", "/");
  let base: string;
  if (dots > 0) {
    const folders = fromPath.split("/").slice(0, -1);
    if (dots - 1 > folders.length) return null;
    base = [...folders.slice(0, folders.length - (dots - 1)), rest]
      .filter(Boolean)
      .join("/");
  } else {
    base = rest;
  }
  const roots = dots > 0 ? [base] : [base, `src/${base}`];
  for (const root of roots) {
    for (const candidate of [`${root}.py`, `${root}/__init__.py`]) {
      if (known.has(candidate)) return candidate;
    }
  }
  return null;
}

/** The repository file an import points at, or null for packages and anything unknown. */
export function resolveImport(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
  workspace: Workspace = new Map(),
): string | null {
  return fromPath.endsWith(".py")
    ? resolvePython(fromPath, spec, known)
    : resolveJs(fromPath, spec, known, workspace);
}
