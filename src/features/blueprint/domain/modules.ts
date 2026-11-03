export interface RepoFile {
  path: string;
  size: number;
}

export interface Module {
  id: string;
  name: string;
  bytes: number;
  files: number;
  paths: string[];
}

const IGNORED_FOLDER =
  /(^|\/)(node_modules|vendor|dist|build|target|coverage|__pycache__|\.[^/]+)\//;
const SOURCE =
  /\.(jsx?|tsx?|mjs|cjs|py|go|rs|java|c|h|cpp|cc|hpp|cs|php|rb|swift|kt|css|scss|vue|svelte)$/;

const MIN_MODULES = 6;
const MAX_MODULES = 24;
const ROOT = "(root)";
const OTHER = "(other)";

/** Code worth drawing: no dependencies, build output, minified files or assets. */
export function isSourcePath(path: string): boolean {
  return (
    SOURCE.test(path) && !IGNORED_FOLDER.test(path) && !path.includes(".min.")
  );
}

const bytesOf = (files: readonly RepoFile[]) =>
  files.reduce((sum, file) => sum + file.size, 0);

function hasSubfolders(prefix: string, files: readonly RepoFile[]): boolean {
  const start = prefix ? prefix.length + 1 : 0;
  return files.some((file) => file.path.indexOf("/", start) !== -1);
}

/** Moves a group's files into one group per subfolder; direct files stay behind. */
function open(groups: Map<string, RepoFile[]>, prefix: string): void {
  const files = groups.get(prefix)!;
  groups.delete(prefix);
  const start = prefix ? prefix.length + 1 : 0;
  for (const file of files) {
    const slash = file.path.indexOf("/", start);
    const key = slash === -1 ? prefix : file.path.slice(0, slash);
    const group = groups.get(key);
    if (group) group.push(file);
    else groups.set(key, [file]);
  }
}

/**
 * Groups files into rooms. It starts from the top-level folders and opens the largest one while
 * there are too few rooms or one folder still holds most of the code.
 */
export function groupModules(files: readonly RepoFile[]): Module[] {
  const source = files.filter((file) => isSourcePath(file.path));
  if (source.length === 0) return [];

  const total = bytesOf(source);
  const groups = new Map<string, RepoFile[]>([["", source]]);
  open(groups, "");

  while (groups.size < MAX_MODULES) {
    let largest: string | null = null;
    let largestBytes = -1;
    for (const [prefix, group] of groups) {
      if (prefix === "" || !hasSubfolders(prefix, group)) continue;
      const bytes = bytesOf(group);
      if (bytes > largestBytes) {
        largest = prefix;
        largestBytes = bytes;
      }
    }
    if (largest === null) break;
    if (groups.size >= MIN_MODULES && largestBytes <= total / 2) break;
    open(groups, largest);
  }

  const modules = [...groups].map(([prefix, group]) => ({
    id: prefix || ROOT,
    name: prefix || ROOT,
    bytes: bytesOf(group),
    files: group.length,
    paths: group.map((file) => file.path),
  }));
  modules.sort((a, b) => b.bytes - a.bytes || a.id.localeCompare(b.id));
  if (modules.length <= MAX_MODULES) return modules;

  const kept = modules.slice(0, MAX_MODULES - 1);
  const rest = modules.slice(MAX_MODULES - 1);
  return [
    ...kept,
    {
      id: OTHER,
      name: OTHER,
      bytes: rest.reduce((sum, m) => sum + m.bytes, 0),
      files: rest.reduce((sum, m) => sum + m.files, 0),
      paths: rest.flatMap((m) => m.paths),
    },
  ];
}
