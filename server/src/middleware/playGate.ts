import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { isOwnerEmail } from '../lib/owner';

export const PLAY_LIMIT = 10;
export const VIP_PLAY_LIMIT = 25;
export const SESSION_TTL_MS = 30 * 60 * 1000; // 30 minutes
export const MIN_PLAY_SESSION_AGE_MS = 2000; // reject score submissions faster than any legitimate round

// Canonical game identifiers that can own a play session / leaderboard board
export const SCOREABLE_GAME_IDS = new Set([
  'higher_lower',
  'turing_test',
  'cyber_sprint',
  'signal_sync',
  'overclock',
  'vault',
]);

// Pure arcade games: 0 Orbs, UNLIMITED plays, no daily play deduction
export const PURE_ARCADE_GAME_IDS = new Set([
  'overclock',
  'cyber_sprint',
  'signal_sync',
  'vault',
]);

const KNOWN_GAME_SEGMENTS = new Set([
  'jailbreak',
  'higher_lower',
  'mind_reader',
  'turing_test',
  'survival',
  'vault',
  'wingman',
  'cyber_sprint',
  'signal_sync',
  'overclock',
]);

function normalizeGameId(raw: string): string {
  return raw.replace(/-/g, '_').toLowerCase();
}

/**
 * Derives the canonical gameId for a request. Route path segments are
 * authoritative — request bodies and params are only fallbacks — so a client
 * cannot rebind a play session to a different game via `body.gameId`.
 */
function deriveGameId(req: Request): string {
  const segments = (req.path || '').split('/').filter(Boolean);
  for (const seg of segments) {
    const norm = normalizeGameId(seg);
    if (KNOWN_GAME_SEGMENTS.has(norm)) {
      return norm;
    }
  }
  const fallback = req.params?.gameId || req.body?.gameId;
  if (typeof fallback === 'string' && fallback.trim()) {
    return normalizeGameId(fallback.trim());
  }
  return 'unknown_game';
}

export interface PlaySession {
  sessionId: string;
  userId: string;
  gameId: string;
  createdAt: number;
  expiresAt: number;
  consumed: boolean;
}

// In-memory store for active, single-use play sessions
export const activePlaySessions = new Map<string, PlaySession>();

// Cleanup expired sessions every 15 minutes
setInterval(() => {
  const now = Date.now();
  for (const [id, session] of activePlaySessions.entries()) {
    if (now > session.expiresAt || session.consumed) {
      activePlaySessions.delete(id);
    }
  }
}, 15 * 60 * 1000);

export type PlaySessionValidation =
  | { valid: true; session: PlaySession }
  | { valid: false; reason: 'INVALID_SESSION' | 'SESSION_TOO_SOON' };

const INVALID_SESSION: PlaySessionValidation = { valid: false, reason: 'INVALID_SESSION' };

/**
 * Validates and atomically consumes a single-use play session for leaderboard score submission.
 * Enforces user binding, game binding, expiry, single-use consumption, and a
 * minimum session age so impossibly fast score submissions are rejected.
 */
export function validateAndConsumeSession(sessionId: string, userId: string, gameId: string): PlaySessionValidation {
  if (!sessionId || !userId || !gameId) {
    return INVALID_SESSION;
  }

  const session = activePlaySessions.get(sessionId);
  if (!session) {
    return INVALID_SESSION;
  }

  if (session.userId !== userId) {
    return INVALID_SESSION;
  }

  // Canonical comparison: normalize hyphens and underscores
  const normSessionGame = normalizeGameId(session.gameId);
  const normTargetGame = normalizeGameId(gameId);
  if (normSessionGame !== normTargetGame) {
    return INVALID_SESSION;
  }

  if (Date.now() > session.expiresAt) {
    activePlaySessions.delete(sessionId);
    return INVALID_SESSION;
  }

  if (session.consumed) {
    return INVALID_SESSION;
  }

  // Reject submissions faster than any legitimate round could produce a score.
  // The session is NOT consumed so a legitimate player can still submit later.
  if (Date.now() - session.createdAt < MIN_PLAY_SESSION_AGE_MS) {
    return { valid: false, reason: 'SESSION_TOO_SOON' };
  }

  // Atomically consume and remove
  session.consumed = true;
  activePlaySessions.delete(sessionId);
  return { valid: true, session };
}

// In-memory per-user FIFO mutex to prevent concurrent multi-tab quota bypasses
const userMutexes = new Map<string, Promise<void>>();

async function withUserLock<T>(userId: string, task: () => Promise<T>): Promise<T> {
  const currentLock = userMutexes.get(userId) || Promise.resolve();
  let release: () => void = () => {};
  const nextLock = new Promise<void>((resolve) => {
    release = resolve;
  });
  userMutexes.set(userId, nextLock);

  try {
    await currentLock;
    return await task();
  } finally {
    release();
    if (userMutexes.get(userId) === nextLock) {
      userMutexes.delete(userId);
    }
  }
}

/**
 * Strict Game Play Gate Middleware
 * 1. Enforces concurrency protection with a per-user lock.
 * 2. Enforces daily limit (10 plays) with automatic UTC calendar day rollover.
 * 3. Atomically increments daily_plays & total_plays (for AI/API games only).
 * 4. Pure Arcade Games (overclock, cyber_sprint, signal_sync, vault) have UNLIMITED plays
 *    with 0 Orbs cost, but still receive a valid single-use 30-minute playSessionId for anti-cheat leaderboard submission.
 */
export async function playGate(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
  }

  // Determine game ID from the route path (authoritative), then params/body fallbacks
  const gameId = deriveGameId(req);
  const isPureArcade = PURE_ARCADE_GAME_IDS.has(gameId);

  // ── Supreme Owner Bypass (Unlimited plays, 0 orb cost, issues valid anti-cheat session) ──
  if (isOwnerEmail(req.user?.email)) {
    const sessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    activePlaySessions.set(sessionId, {
      sessionId,
      userId,
      gameId,
      createdAt: Date.now(),
      expiresAt: Date.now() + SESSION_TTL_MS,
      consumed: false,
    });

    (req as any).playSession = {
      playSessionId: sessionId,
      todayUsage: 0,
      totalPlays: 999999,
      remainingPlays: 999999,
      usedOrbs: 0,
      remainingOrbs: 999999,
      dailyLimit: 999999,
      isArcade: isPureArcade,
      isOwner: true,
    };

    console.log(`[playGate] Issued Supreme Owner unlimited playSession ${sessionId} for user ${userId} on ${gameId}`);
    return next();
  }

  return withUserLock(userId, async () => {
    try {
      // 1. Fetch current user profile
      const { data: profile, error } = await supabaseAdmin
        .from('profiles')
        .select('id, total_plays, daily_plays, last_played_at, is_banned, is_vip')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        console.warn('[playGate] Error querying profiles:', error.message);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const lastPlayedDateStr = profile?.last_played_at
        ? new Date(profile.last_played_at).toISOString().split('T')[0]
        : null;

      // Reset daily_plays if new calendar day
      const isNewDay = lastPlayedDateStr !== todayStr;
      const currentDailyPlays = isNewDay ? 0 : (profile?.daily_plays ?? 0);
      const currentTotalPlays = profile?.total_plays ?? 0;
      const isVip = profile?.is_vip === true;
      const dailyLimit = isVip ? VIP_PLAY_LIMIT : PLAY_LIMIT;

      // ── Pure Arcade Games (0 Orbs, Unlimited Plays) ────────────────────────
      if (isPureArcade) {
        const sessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
        activePlaySessions.set(sessionId, {
          sessionId,
          userId,
          gameId,
          createdAt: Date.now(),
          expiresAt: Date.now() + SESSION_TTL_MS,
          consumed: false,
        });

        const remaining = Math.max(0, dailyLimit - currentDailyPlays);

        (req as any).playSession = {
          playSessionId: sessionId,
          todayUsage: currentDailyPlays,
          totalPlays: currentTotalPlays,
          remainingPlays: remaining,
          usedOrbs: currentDailyPlays,
          remainingOrbs: remaining,
          dailyLimit,
          isArcade: true,
        };

        console.log(`[playGate] Issued arcade playSession ${sessionId} for user ${userId} on ${gameId} (UNLIMITED FREE PLAY)`);
        return next();
      }

      // ── AI / API Games (1 Orb per start) ───────────────────────────────────
      // 2. Daily limit check: if >= limit, block with 429
      if (currentDailyPlays >= dailyLimit) {
        console.warn(`[playGate] User ${userId} reached daily play limit: ${currentDailyPlays}/${dailyLimit}`);
        return res.status(429).json({
          error: 'PLAY_LIMIT_REACHED',
          message: `You have reached your ${dailyLimit} game limit for today. Come back tomorrow!`,
          daily_plays: currentDailyPlays,
          total_plays: currentTotalPlays,
          usedOrbs: currentDailyPlays,
          remainingPlays: 0,
          remainingOrbs: 0,
          max_plays: dailyLimit,
          dailyLimit,
          isVip,
        });
      }

      // 3. Atomically increment daily_plays and total_plays
      const nextDaily = currentDailyPlays + 1;
      const nextTotal = currentTotalPlays + 1;
      const nowIso = new Date().toISOString();

      if (profile) {
        const { error: updateErr } = await supabaseAdmin
          .from('profiles')
          .update({
            daily_plays: nextDaily,
            total_plays: nextTotal,
            last_played_at: nowIso,
          })
          .eq('id', userId);

        if (updateErr) {
          console.error('[playGate] Failed to update profile plays:', updateErr.message);
        }
      } else {
        const { error: insertErr } = await supabaseAdmin
          .from('profiles')
          .insert({
            id: userId,
            daily_plays: nextDaily,
            total_plays: nextTotal,
            last_played_at: nowIso,
            is_banned: false,
          });

        if (insertErr) {
          console.error('[playGate] Failed to insert profile row:', insertErr.message);
        }
      }

      // 4. Issue single-use play session
      const sessionId = `ps_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
      activePlaySessions.set(sessionId, {
        sessionId,
        userId,
        gameId,
        createdAt: Date.now(),
        expiresAt: Date.now() + SESSION_TTL_MS,
        consumed: false,
      });

      const remaining = Math.max(0, dailyLimit - nextDaily);

      // Attach session info to req for downstream route handlers
      (req as any).playSession = {
        playSessionId: sessionId,
        todayUsage: nextDaily,
        totalPlays: nextTotal,
        remainingPlays: remaining,
        usedOrbs: nextDaily,
        remainingOrbs: remaining,
        dailyLimit,
        isArcade: false,
      };

      console.log(`[playGate] Issued playSession ${sessionId} for user ${userId} on ${gameId} (${nextDaily}/${dailyLimit})`);
      return next();
    } catch (err: any) {
      console.error('[playGate] Exception in playGate:', err);
      // Fail closed: never let a quota/play-counting failure grant free plays
      return res.status(503).json({
        error: 'PLAY_GATE_UNAVAILABLE',
        message: 'Unable to verify play quota. Please try again shortly.',
      });
    }
  });
}
