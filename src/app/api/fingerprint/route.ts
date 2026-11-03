import { env } from "@/env";
import type { Profile } from "@/features/fingerprint/domain/profile";
import {
  fetchProfile,
  isValidTarget,
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

const limiter = createRateLimiter({ limit: 20, windowMs: 60_000 });
const cache = createCache<Profile>({ max: 50, ttlMs: 600_000 });

export async function GET(request: Request): Promise<Response> {
  const target = new URL(request.url).searchParams.get("target") ?? "";
  if (!isValidTarget(target)) {
    return Response.json({ error: "invalid-target" }, { status: 400 });
  }

  const client =
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  if (!limiter.take(client)) {
    return Response.json(
      {
        error: "rate-limited",
        message: "Too many posters in a minute. Try again shortly.",
      },
      { status: 429 },
    );
  }

  const key = target.toLowerCase();
  const cached = cache.get(key);
  if (cached) return Response.json(cached);

  try {
    const profile = await fetchProfile(target, {
      token: env.GITHUB_TOKEN,
      signal: request.signal,
    });
    if (!profile.partial) cache.set(key, profile);
    return Response.json(profile);
  } catch (error) {
    const failure =
      error instanceof ProfileError ? error : new ProfileError("unavailable");
    return Response.json(
      { error: failure.code, message: failure.message },
      { status: STATUS[failure.code] },
    );
  }
}
