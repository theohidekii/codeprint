import { z } from "zod";

import { env } from "@/env";
import { normalize } from "@/features/trace/domain/normalize";
import { detectLanguage, tokenize } from "@/features/trace/domain/tokenize";
import { LANGUAGES } from "@/features/trace/domain/types";
import { fnv1a } from "@/features/trace/domain/winnow";
import { fetchFileContent } from "@/features/trace/providers/content";
import { createGithubProvider } from "@/features/trace/providers/github";
import { createSourcegraphProvider } from "@/features/trace/providers/sourcegraph";
import type { SearchProvider } from "@/features/trace/providers/types";
import { createTraceCache } from "@/features/trace/server/cache";
import { toNdjsonStream } from "@/features/trace/server/ndjson";
import { createRateLimiter } from "@/features/trace/server/rate-limit";
import { runTrace, type TraceEvent } from "@/features/trace/server/run-trace";

const MAX_CODE_CHARS = 20_000;
const RATE_LIMIT_MESSAGE = "Too many traces in a minute. Try again shortly.";

const bodySchema = z.object({
  code: z.string().min(1).max(MAX_CODE_CHARS),
  language: z.enum(LANGUAGES).optional(),
});

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const cache = createTraceCache({ max: 50, ttlMs: 600_000 });

function providers(): SearchProvider[] {
  const list = [createSourcegraphProvider()];
  if (env.GITHUB_TOKEN)
    list.push(createGithubProvider({ token: env.GITHUB_TOKEN }));
  return list;
}

async function* replay(events: TraceEvent[]) {
  yield* events;
}

/** Records events and caches the trace only if it finished with every provider healthy. */
async function* recording(source: AsyncGenerator<TraceEvent>, key: string) {
  const seen: TraceEvent[] = [];
  for await (const event of source) {
    seen.push(event);
    yield event;
  }
  const healthy = seen.every((e) => e.type !== "provider" || e.status === "ok");
  if (seen.at(-1)?.type === "done" && healthy) cache.set(key, seen);
}

export async function POST(request: Request): Promise<Response> {
  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.take(client)) {
    return Response.json(
      { error: "rate-limited", message: RATE_LIMIT_MESSAGE },
      { status: 429 },
    );
  }

  const body = bodySchema.safeParse(await request.json().catch(() => null));
  if (!body.success) {
    return Response.json({ error: "invalid-input" }, { status: 400 });
  }

  const { code } = body.data;
  const language = body.data.language ?? detectLanguage(code);
  const fingerprint = normalize(tokenize(code, language))
    .map((t) => t.value)
    .join("\u0000");
  const key = `${language}:${fnv1a(fingerprint)}`;

  const cached = cache.get(key);
  const events = cached
    ? replay(cached)
    : recording(
        runTrace(
          { code, language },
          { providers: providers(), fetchContent: fetchFileContent },
          request.signal,
        ),
        key,
      );

  return new Response(toNdjsonStream(events), {
    headers: {
      "content-type": "application/x-ndjson",
      "cache-control": "no-store",
    },
  });
}
