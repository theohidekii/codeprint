import "server-only";

import { parseEnv } from "./env.schema";

export type { Env } from "./env.schema";

/** Validated server environment. Importing this from client code fails the build. */
export const env = parseEnv(process.env);
