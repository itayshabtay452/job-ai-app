// lib/security/rateLimit.ts

/**
 * Rate limiting פשוט (in-memory, per-process).
 * לא לפרודקשן מרובה אינסטנסים — לשם כך העברו ל-Redis/Upstash.
 */

export type RateLimitOptions = {
  key: string;          // מפתח ייחודי (למשל: `match:<userId>` או `cover:<userId>`)
  limit: number;        // כמה בקשות מותר בתוך החלון
  windowMs: number;     // גודל החלון במילישניות (למשל 60_000 = דקה)
};

type Bucket = { count: number; resetAt: number };
const BUCKETS = new Map<string, Bucket>();

export type RateLimitResult =
  | { ok: true; remaining: number; resetAt: number; retryAfterSec: 0 }
  | { ok: false; remaining: 0; resetAt: number; retryAfterSec: number };

/**
 * נגיעה/רישום בבאקט. מחזיר אם מותר או חסום כרגע.
 */
export function rateLimitTouch(opts: RateLimitOptions): RateLimitResult {
  const now = Date.now();
  const cur = BUCKETS.get(opts.key);

  // חלון חדש
  if (!cur || cur.resetAt <= now) {
    const resetAt = now + opts.windowMs;
    BUCKETS.set(opts.key, { count: 1, resetAt });
    return { ok: true, remaining: opts.limit - 1, resetAt, retryAfterSec: 0 };
  }

  // חלון קיים
  if (cur.count >= opts.limit) {
    const retryAfterSec = Math.max(1, Math.ceil((cur.resetAt - now) / 1000));
    return { ok: false, remaining: 0, resetAt: cur.resetAt, retryAfterSec };
  }

  cur.count += 1;
  BUCKETS.set(opts.key, cur);
  return { ok: true, remaining: opts.limit - cur.count, resetAt: cur.resetAt, retryAfterSec: 0 };
}

/** כותרות עזר לנראות/דיבוג (אופציונלי) */
export function rateLimitHeaders(result: RateLimitResult, limit: number): HeadersInit {
  return {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(result.ok ? result.remaining : 0),
    "X-RateLimit-Reset": String(Math.ceil(result.resetAt / 1000)), // unix seconds
    ...(result.ok ? {} : { "Retry-After": String(result.retryAfterSec) }),
  };
}
