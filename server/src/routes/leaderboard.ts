import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { supabaseAdmin } from '../lib/supabase';

export const leaderboardRouter = Router();

// ── In-memory cache ───────────────────────────────────────────────────────────
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CacheEntry {
  data: LeaderboardEntry[];
  expiresAt: number;
}

interface LeaderboardEntry {
  rank: number;
  email_prefix: string;
  score: number;
}

const cache = new Map<string, CacheEntry>();

function getCached(gameId: string): LeaderboardEntry[] | null {
  const entry = cache.get(gameId);
  if (entry && Date.now() < entry.expiresAt) {
    return entry.data;
  }
  cache.delete(gameId);
  return null;
}

function setCache(gameId: string, data: LeaderboardEntry[]) {
  cache.set(gameId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(gameId: string) {
  cache.delete(gameId);
}

// ── GET /api/leaderboard/:gameId ──────────────────────────────────────────────
leaderboardRouter.get(
  '/:gameId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;

    // 1. Check cache
    const cached = getCached(gameId);
    if (cached) {
      console.log('[leaderboard] Cache HIT for ' + gameId);
      return res.json({ entries: cached, cached: true });
    }

    console.log('[leaderboard] Cache MISS for ' + gameId + ' — querying Supabase');

    try {
      // 2. Query top 10 scores
      const { data: scores, error } = await supabaseAdmin
        .from('game_scores')
        .select('user_id, score, created_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(10);

      if (error) {
        console.error('[leaderboard] DB error:', error);
        return res.status(500).json({ error: 'db_error', message: error.message });
      }

      if (!scores || scores.length === 0) {
        const empty: LeaderboardEntry[] = [];
        setCache(gameId, empty);
        return res.json({ entries: empty, cached: false });
      }

      // 3. Fetch email for each unique user_id via admin API
      const userIds = [...new Set(scores.map((s) => s.user_id as string))];
      const emailMap: Record<string, string> = {};

      await Promise.all(
        userIds.map(async (uid) => {
          try {
            const { data: userData } = await supabaseAdmin.auth.admin.getUserById(uid);
            if (userData?.user?.email) {
              emailMap[uid] = userData.user.email;
            }
          } catch {
            // ignore individual lookup failures
          }
        })
      );

      // 4. Build ranked response
      const entries: LeaderboardEntry[] = scores.map((s, i) => {
        const email = emailMap[s.user_id as string] || '';
        const email_prefix = email
          ? email.split('@')[0]
          : (s.user_id as string).slice(0, 8);
        return { rank: i + 1, email_prefix, score: s.score as number };
      });

      setCache(gameId, entries);
      return res.json({ entries, cached: false });
    } catch (err: any) {
      console.error('[leaderboard] Unexpected error:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  }
);

// ── POST /api/leaderboard/:gameId ─────────────────────────────────────────────
leaderboardRouter.post(
  '/:gameId',
  requireAuth,
  async (req: Request, res: Response) => {
    const { gameId } = req.params;
    const userId = req.user!.id;
    const { score } = req.body;

    if (typeof score !== 'number' || score < 0 || !Number.isInteger(score)) {
      return res.status(400).json({
        error: 'invalid_score',
        message: 'score must be a non-negative integer',
      });
    }

    try {
      // 1. Check if user already has a score for this game
      const { data: existing, error: fetchError } = await supabaseAdmin
        .from('game_scores')
        .select('id, score')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .maybeSingle();

      if (fetchError) {
        console.error('[leaderboard] fetch error:', fetchError);
        return res.status(500).json({ error: 'db_error' });
      }

      if (existing) {
        // Only update if new score is strictly higher
        if (score <= (existing.score as number)) {
          return res.json({
            updated: false,
            message: 'Existing score is equal or higher — not updated.',
          });
        }
        const { error: updateError } = await supabaseAdmin
          .from('game_scores')
          .update({ score, created_at: new Date().toISOString() })
          .eq('id', existing.id);

        if (updateError) {
          console.error('[leaderboard] update error:', updateError);
          return res.status(500).json({ error: 'db_error' });
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseAdmin
          .from('game_scores')
          .insert({ user_id: userId, game_id: gameId, score });

        if (insertError) {
          console.error('[leaderboard] insert error:', insertError);
          return res.status(500).json({ error: 'db_error' });
        }
      }

      // 2. Invalidate cache so next GET is fresh
      invalidateCache(gameId);
      console.log('[leaderboard] Score submitted for ' + gameId + ' by ' + userId + ': ' + score);
      return res.json({ updated: true });
    } catch (err: any) {
      console.error('[leaderboard] Unexpected error:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  }
);
