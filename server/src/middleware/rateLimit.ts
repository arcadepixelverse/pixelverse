import { Request, Response, NextFunction } from 'express';
import { isOwnerEmail } from '../lib/owner';

interface Bucket {
  count: number;
  resetAt: number;
}

export interface RateLimitOptions {
  /** Time window in milliseconds */
  windowMs: number;
  /** Max requests allowed per key per window */
  max: number;
  /** Namespace prefix so different limiters don't share buckets */
  keyPrefix?: string;
}

function clientKey(req: Request, prefix: string): string {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `${prefix}:${ip}`;
}

/**
 * Fixed-window bucket check. Returns seconds-until-reset when the bucket is
 * exhausted, otherwise null. Expired buckets are lazily reset on access.
 */
function hitBucket(
  buckets: Map<string, Bucket>,
  key: string,
  windowMs: number,
  max: number
): number | null {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    bucket = { count: 0, resetAt: now + windowMs };
    buckets.set(key, bucket);
  }
  bucket.count += 1;
  if (bucket.count > max) {
    return Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  }
  return null;
}

function sweepExpired(buckets: Map<string, Bucket>, windowMs: number) {
  const timer = setInterval(() => {
    const now = Date.now();
    for (const [key, bucket] of buckets.entries()) {
      if (now > bucket.resetAt) buckets.delete(key);
    }
  }, Math.min(windowMs, 60_000));
  timer.unref?.();
}

function tooManyRequests(res: Response, retryAfterSec: number) {
  res.setHeader('Retry-After', String(retryAfterSec));
  return res.status(429).json({
    error: 'RATE_LIMITED',
    message: 'Too many requests. Please slow down and try again shortly.',
    retryAfter: retryAfterSec,
  });
}

/**
 * Lightweight zero-dependency fixed-window in-memory rate limiter.
 * Buckets are keyed by client IP (trust proxy is enabled) and automatically
 * purged on an interval so memory never leaks.
 */
export function rateLimit({ windowMs, max, keyPrefix = 'rl' }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();
  sweepExpired(buckets, windowMs);

  return (req: Request, res: Response, next: NextFunction) => {
    if (isOwnerEmail(req.user?.email)) {
      return next();
    }

    const retryAfter = hitBucket(buckets, clientKey(req, keyPrefix), windowMs, max);
    if (retryAfter !== null) {
      return tooManyRequests(res, retryAfter);
    }
    next();
  };
}

// ── Global abuse throttle ────────────────────────────────────────────────────
// Generous per-IP ceiling across the whole public API surface. Mounted once in
// server.ts before all routes; /api/admin/* and owner requests are exempt.

const ABUSE_WINDOW_MS = 60_000;
const ABUSE_MAX_REQUESTS = 300;
const abuseBuckets = new Map<string, Bucket>();
sweepExpired(abuseBuckets, ABUSE_WINDOW_MS);

export function abuseRateLimit(req: Request, res: Response, next: NextFunction) {
  const path = req.path || '';
  if (!path.startsWith('/api/') || path.startsWith('/api/admin') || isOwnerEmail(req.user?.email)) {
    return next();
  }

  const retryAfter = hitBucket(abuseBuckets, clientKey(req, 'abuse'), ABUSE_WINDOW_MS, ABUSE_MAX_REQUESTS);
  if (retryAfter !== null) {
    return tooManyRequests(res, retryAfter);
  }
  next();
}
