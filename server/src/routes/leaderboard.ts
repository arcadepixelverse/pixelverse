import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { supabaseAdmin } from '../lib/supabase';

export const leaderboardRouter = Router();

export interface LeaderboardEntry {
  rank: number;
  email_prefix: string;
  score: number;
}

interface CachedLeaderboard {
  timestamp: number;
  data: LeaderboardEntry[];
}

// In-memory cache for leaderboard queries: gameId -> { timestamp, data }
export const leaderboardCache = new Map<string, CachedLeaderboard>();
export const LEADERBOARD_CACHE_TTL_MS = 300_000; // 5 minutes

// In-memory cache for user email prefixes to prevent redundant auth lookups
export const userEmailCache = new Map<string, string>();

/**
 * GET /api/leaderboard/:gameId
 * Returns top 10 scores for a game, cached in memory for 5 minutes.
 */
leaderboardRouter.get(
  '/:gameId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      if (!gameId) {
        return res.status(400).json({ error: 'gameId parameter is required' });
      }

      // Check cache
      const cached = leaderboardCache.get(gameId);
      const now = Date.now();
      if (cached && now - cached.timestamp < LEADERBOARD_CACHE_TTL_MS) {
        console.log(`[leaderboard] Cache HIT for ${gameId}`);
        return res.json(cached.data);
      }

      console.log(`[leaderboard] Cache MISS for ${gameId}, querying Supabase...`);

      // Query top 10 scores for this game
      const { data, error } = await supabaseAdmin
        .from('game_scores')
        .select('score, user_id, created_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(10);

      if (error) {
        console.error(`[leaderboard] Supabase query error for ${gameId}:`, error);
        return res.status(500).json({ error: 'failed_to_fetch_leaderboard' });
      }

      // Format top scores with email prefix
      const entries: LeaderboardEntry[] = await Promise.all(
        (data || []).map(async (row, index) => {
          let emailPrefix = 'Player';
          const userId = row.user_id;

          if (userId) {
            if (userEmailCache.has(userId)) {
              emailPrefix = userEmailCache.get(userId)!;
            } else {
              try {
                const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (userData?.user?.email) {
                  emailPrefix = userData.user.email.split('@')[0];
                  userEmailCache.set(userId, emailPrefix);
                } else {
                  emailPrefix = `pilot_${userId.slice(0, 5)}`;
                }
              } catch (err) {
                console.warn(`[leaderboard] Failed to fetch email for user ${userId}:`, err);
                emailPrefix = `pilot_${userId.slice(0, 5)}`;
              }
            }
          }

          return {
            rank: index + 1,
            email_prefix: emailPrefix,
            score: Number(row.score) || 0,
          };
        })
      );

      // Save to in-memory cache
      leaderboardCache.set(gameId, {
        timestamp: now,
        data: entries,
      });

      return res.json(entries);
    } catch (err: any) {
      console.error('[leaderboard] Unexpected error in GET:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  }
);

/**
 * POST /api/leaderboard/:gameId
 * Submits a score for the authenticated user.
 * If new score > existing score for that game, update it. If lower, do nothing.
 * Invalidates the in-memory cache for gameId.
 */
leaderboardRouter.post(
  '/:gameId',
  requireAuth,
  async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { score } = req.body;

      if (!gameId) {
        return res.status(400).json({ error: 'gameId parameter is required' });
      }

      const numScore = Number(score);
      if (typeof score === 'undefined' || isNaN(numScore) || numScore < 0) {
        return res.status(400).json({ error: 'score must be a non-negative number' });
      }

      const userId = req.user!.id;
      const userEmail = req.user!.email;
      if (userEmail) {
        userEmailCache.set(userId, userEmail.split('@')[0]);
      }

      // Check if user already has a score record for this game
      const { data: existingRows, error: fetchError } = await supabaseAdmin
        .from('game_scores')
        .select('id, score')
        .eq('user_id', userId)
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error(`[leaderboard] Error checking existing score:`, fetchError);
        return res.status(500).json({ error: 'failed_to_check_existing_score' });
      }

      let updated = false;

      if (existingRows && existingRows.length > 0) {
        const existing = existingRows[0];
        if (numScore > Number(existing.score)) {
          const { error: updateError } = await supabaseAdmin
            .from('game_scores')
            .update({
              score: numScore,
              created_at: new Date().toISOString(),
            })
            .eq('id', existing.id);

          if (updateError) {
            console.error(`[leaderboard] Error updating score:`, updateError);
            return res.status(500).json({ error: 'failed_to_update_score' });
          }
          updated = true;
          console.log(`[leaderboard] Updated high score for user ${userId} in ${gameId}: ${numScore} (was ${existing.score})`);
        } else {
          console.log(`[leaderboard] Score ${numScore} <= existing ${existing.score} for ${userId} in ${gameId}. No update.`);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseAdmin
          .from('game_scores')
          .insert({
            user_id: userId,
            game_id: gameId,
            score: numScore,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[leaderboard] Error inserting score:`, insertError);
          return res.status(500).json({ error: 'failed_to_insert_score' });
        }
        updated = true;
        console.log(`[leaderboard] Inserted new score for user ${userId} in ${gameId}: ${numScore}`);
      }

      // Invalidate cache for this gameId so next GET fetches fresh data
      leaderboardCache.delete(gameId);
      console.log(`[leaderboard] Cache invalidated for ${gameId}`);

      return res.json({
        success: true,
        updated,
        score: numScore,
      });
    } catch (err: any) {
      console.error('[leaderboard] Unexpected error in POST:', err);
      return res.status(500).json({ error: 'internal_error' });
    }
  }
);
