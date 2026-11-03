import { tokenize } from "@/features/trace/domain/tokenize";
import type { Language, Token } from "@/features/trace/domain/types";

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

  tokens.forEach((token, i) => {
    if (token.kind !== "keyword") return;
    if (token.text === "from" && tokens[i + 1]) {
      const { text, end } = dotted(i + 1);
      // `from . import x` names the module after the import.
      if (/^\.+$/.test(text) && tokens[end + 1]) {
        specs.push(text + tokens[end + 1]!.text);
      } else if (text) {
        specs.push(text);
      }
    } else if (token.text === "import" && tokens[i - 1]?.line !== token.line) {
      if (tokens[i + 1]) specs.push(dotted(i + 1).text);
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

/** In a monorepo, packages import each other by name: `@acme/core` lives in packages/core. */
function resolveWorkspacePackage(
  spec: string,
  known: ReadonlySet<string>,
): string | null {
  const name = spec.startsWith("@") ? spec.split("/")[1] : spec.split("/")[0];
  if (!name) return null;
  for (const entry of ["src/index", "index"]) {
    for (const extension of [".ts", ".tsx", ".js", ".jsx"]) {
      const candidate = `packages/${name}/${entry}${extension}`;
      if (known.has(candidate)) return candidate;
    }
  }
  return null;
}

function resolveJs(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
): string | null {
  let target: string | null;
  if (spec.startsWith("@/")) target = join(["src"], spec.slice(2));
  else if (spec.startsWith("./") || spec.startsWith("../")) {
    target = join(fromPath.split("/").slice(0, -1), spec);
  } else {
    return resolveWorkspacePackage(spec, known);
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
  for (const candidate of [`${base}.py`, `${base}/__init__.py`]) {
    if (known.has(candidate)) return candidate;
  }
  return null;
}

/** The repository file an import points at, or null for packages and anything unknown. */
export function resolveImport(
  fromPath: string,
  spec: string,
  known: ReadonlySet<string>,
): string | null {
  return fromPath.endsWith(".py")
    ? resolvePython(fromPath, spec, known)
    : resolveJs(fromPath, spec, known);
}
