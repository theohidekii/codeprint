import { env } from "@/env";
import {
  type Analysis,
  analyzeRepository,
} from "@/features/blueprint/server/analyze";
import { isValidTarget } from "@/features/fingerprint/domain/target";
import {
  ProfileError,
  type ProfileErrorCode,
} from "@/features/fingerprint/server/github";
import { createCache } from "@/shared/server/cache";
import { createRateLimiter } from "@/shared/server/rate-limit";

const STATUS: Record<ProfileErrorCode, number> = {
  "not-found": 404,
  "rate-limited": 429,
  unavailable: 502,
};

const limiter = createRateLimiter({ limit: 10, windowMs: 60_000 });
const cache = createCache<Analysis>({ max: 50, ttlMs: 600_000 });

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get("target") ?? "";
  if (!target.includes("/") || !isValidTarget(target)) {
    return Response.json(
      {
        error: "invalid-target",
        message: "Enter a repository as owner/repo.",
      },
      { status: 400 },
    );
  }

  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.take(client)) {
    return Response.json(
      {
        error: "rate-limited",
        message: "Too many plans in a minute. Try again shortly.",
      },
      { status: 429 },
    );
  }

  const key = target.toLowerCase();
  const cached = cache.get(key);
  if (cached) return Response.json(cached);

  try {
    const analysis = await analyzeRepository(target, {
      token: env.GITHUB_TOKEN,
      signal: request.signal,
    });
    if (!analysis.partial) cache.set(key, analysis);
    return Response.json(analysis);
  } catch (error) {
    const failure =
      error instanceof ProfileError ? error : new ProfileError("unavailable");
    return Response.json(
      { error: failure.code, message: failure.message },
      { status: STATUS[failure.code] },
    );
  }
}
