import { MutationCtx, QueryCtx } from "./_generated/server";

export interface RateLimitResult {
  allowed: boolean;
  remainingAttempts: number;
  retryAfterSeconds?: number;
  error?: string;
}

/**
 * Server-side rate limiter for critical auth endpoints.
 * Protects against brute-force attacks on signup, login, OTP verify, OTP resend, reset password.
 */
export async function enforceRateLimit(
  ctx: MutationCtx,
  key: string,
  maxAttempts: number,
  windowMs: number,
  lockoutMs: number = windowMs
): Promise<RateLimitResult> {
  const now = Date.now();
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (existing) {
    // Check if currently locked out
    if (existing.lockedUntil && existing.lockedUntil > now) {
      const retryAfterSeconds = Math.ceil((existing.lockedUntil - now) / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        error: `Trop de tentatives. Veuillez patienter ${retryAfterSeconds} secondes.`,
      };
    }

    // Check if window has expired; reset if so
    if (now - existing.windowStart > windowMs) {
      await ctx.db.patch(existing._id, {
        attempts: 1,
        windowStart: now,
        lockedUntil: undefined,
      });
      return { allowed: true, remainingAttempts: maxAttempts - 1 };
    }

    // Increment attempts
    const newAttempts = existing.attempts + 1;
    if (newAttempts > maxAttempts) {
      const lockedUntil = now + lockoutMs;
      await ctx.db.patch(existing._id, {
        attempts: newAttempts,
        lockedUntil,
      });
      const retryAfterSeconds = Math.ceil(lockoutMs / 1000);
      return {
        allowed: false,
        remainingAttempts: 0,
        retryAfterSeconds,
        error: `Trop de tentatives. Compte temporairement bloqué pour ${retryAfterSeconds} secondes.`,
      };
    }

    await ctx.db.patch(existing._id, { attempts: newAttempts });
    return { allowed: true, remainingAttempts: maxAttempts - newAttempts };
  }

  // First attempt
  await ctx.db.insert("rateLimits", {
    key,
    attempts: 1,
    windowStart: now,
  });

  return { allowed: true, remainingAttempts: maxAttempts - 1 };
}

/**
 * Reset rate limit counter upon successful authentication action.
 */
export async function clearRateLimit(ctx: MutationCtx, key: string): Promise<void> {
  const existing = await ctx.db
    .query("rateLimits")
    .withIndex("by_key", (q) => q.eq("key", key))
    .first();

  if (existing) {
    await ctx.db.delete(existing._id);
  }
}
