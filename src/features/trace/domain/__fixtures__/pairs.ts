import type { Language } from "../types";

export interface Pair {
  name: string;
  snippet: string;
  candidate: string;
  language: Language;
  min: number;
  max: number;
}

export const SUM_POSITIVE = `function sumPositive(values) {
  let acc = 0;
  for (const v of values) {
    if (v > 0) {
      acc += v;
    }
  }
  return acc;
}`;

export const SUM_POSITIVE_RENAMED = `function addUp(items) {
  let total = 0;
  for (const n of items) {
    if (n > 0) {
      total += n;
    }
  }
  return total;
}`;

export const CREATE_USER = `function createUser(name, email) {
  const id = generateId();
  const createdAt = Date.now();
  const user = { id, name, email, createdAt };
  validate(user);
  users.set(id, user);
  log("created", id);
  notify(email, "Welcome!");
  return user;
}`;

const CREATE_USER_REORDERED = `function createUser(name, email) {
  const id = generateId();
  const createdAt = Date.now();
  const user = { id, name, email, createdAt };
  notify(email, "Welcome!");
  users.set(id, user);
  log("created", id);
  validate(user);
  return user;
}`;

const CREATE_USER_ONE_LINE_CHANGED = `function createUser(name, email) {
  const id = generateId();
  const createdAt = new Date().toISOString();
  const user = { id, name, email, createdAt };
  validate(user);
  users.set(id, user);
  log("created", id);
  notify(email, "Welcome!");
  return user;
}`;

const UNRELATED = `class Stack {
  #items = [];
  push(item) {
    this.#items.push(item);
    return this;
  }
  get size() {
    return this.#items.length;
  }
  get isEmpty() {
    return this.#items.length === 0;
  }
}`;

/** Unrelated filler, so the embedded snippet starts on line EMBEDDED_AT. */
function filler(lines: number): string {
  return Array.from(
    { length: lines },
    (_, i) => `const setting${i} = config.get("key-${i}") ?? ${i};`,
  ).join("\n");
}

export const EMBEDDED_AT = 50;

export const EMBEDDED_FILE = [
  filler(EMBEDDED_AT - 1),
  SUM_POSITIVE,
  filler(120 - (EMBEDDED_AT - 1) - SUM_POSITIVE.split("\n").length),
].join("\n");

export const PAIRS: Pair[] = [
  {
    name: "identical",
    snippet: SUM_POSITIVE,
    candidate: SUM_POSITIVE,
    language: "javascript",
    min: 1,
    max: 1,
  },
  {
    name: "renamed only",
    snippet: SUM_POSITIVE,
    candidate: SUM_POSITIVE_RENAMED,
    language: "javascript",
    min: 1,
    max: 1,
  },
  {
    name: "embedded in a 120-line file",
    snippet: SUM_POSITIVE,
    candidate: EMBEDDED_FILE,
    language: "javascript",
    min: 0.95,
    max: 1,
  },
  {
    name: "two statements reordered",
    snippet: CREATE_USER,
    candidate: CREATE_USER_REORDERED,
    language: "javascript",
    min: 0.5,
    max: 0.95,
  },
  {
    name: "one line changed in ten",
    snippet: CREATE_USER,
    candidate: CREATE_USER_ONE_LINE_CHANGED,
    language: "javascript",
    min: 0.6,
    max: 0.95,
  },
  {
    name: "unrelated",
    snippet: CREATE_USER,
    candidate: UNRELATED,
    language: "javascript",
    min: 0,
    max: 0.15,
  },
];
