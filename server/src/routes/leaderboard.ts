import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/requireAuth';
import { supabaseAdmin } from '../lib/supabase';
import { maintenanceGate } from '../middleware/maintenanceGate';
import { validateAndConsumeSession, SCOREABLE_GAME_IDS } from '../middleware/playGate';
import { isOwnerEmail } from '../lib/owner';

export const leaderboardRouter = Router();

export interface LeaderboardEntry {
  id?: string;
  rank: number;
  display_name: string;
  email_prefix: string; // compatibility alias
  score: number;
  is_vip?: boolean;
  is_owner?: boolean;
}

interface CachedLeaderboard {
  timestamp: number;
  data: LeaderboardEntry[];
}

// In-memory cache for leaderboard queries: gameId -> { timestamp, data }
export const leaderboardCache = new Map<string, CachedLeaderboard>();
export const LEADERBOARD_CACHE_TTL_MS = 300_000; // 5 minutes

// Generous upper bound — no legitimate round in any game can exceed this
export const MAX_LEADERBOARD_SCORE = 1_000_000;

// In-memory cache for user email prefixes to prevent redundant auth lookups
export const userEmailCache = new Map<string, string>();

/** Helper to mask email for privacy (e.g. alexander -> alex***) */
function maskEmailPrefix(email?: string | null, userId?: string): string {
  if (!email) return `pilot_${(userId || 'user').slice(0, 4)}***`;
  const prefix = email.split('@')[0] || '';
  if (prefix.length > 4) {
    return `${prefix.slice(0, 4)}***`;
  }
  if (prefix.length >= 2) {
    return `${prefix.slice(0, 2)}***`;
  }
  return `${prefix}***`;
}

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
        .select('id, score, user_id, created_at')
        .eq('game_id', gameId)
        .order('score', { ascending: false })
        .limit(10);

      if (error) {
        console.error(`[leaderboard] Supabase query error for ${gameId}:`, error);
        return res.status(500).json({ error: 'failed_to_fetch_leaderboard' });
      }

      // Fetch profiles (VIP + custom username) for ranked users (single batched query)
      const rankedIds = (data || []).map((r: any) => r.user_id).filter(Boolean);
      const profileMap = new Map<string, { is_vip?: boolean; username?: string | null }>();
      if (rankedIds.length > 0) {
        const { data: profs } = await supabaseAdmin
          .from('profiles')
          .select('id, is_vip, username')
          .in('id', rankedIds);
        (profs || []).forEach((p: any) =>
          profileMap.set(p.id, { is_vip: p.is_vip === true, username: p.username || null })
        );
      }

      // Format top scores with custom username or privacy masked handle
      const entries: LeaderboardEntry[] = await Promise.all(
        (data || []).map(async (row, index) => {
          const userId = row.user_id;
          const prof = profileMap.get(userId);
          let rawEmail = '';

          if (userId) {
            if (userEmailCache.has(userId)) {
              rawEmail = userEmailCache.get(userId)!;
            } else {
              try {
                const { data: userData } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (userData?.user?.email) {
                  rawEmail = userData.user.email;
                  userEmailCache.set(userId, rawEmail);
                }
              } catch (err) {
                console.warn(`[leaderboard] Failed to fetch email for user ${userId}:`, err);
              }
            }
          }

          const isOwner = isOwnerEmail(rawEmail);
          const isVip = isOwner || prof?.is_vip === true;

          // Priority: 1. Custom username (if set), 2. Masked email handle (alex***)
          const displayName = prof?.username && prof.username.trim()
            ? prof.username.trim()
            : maskEmailPrefix(rawEmail, userId);

          return {
            id: row.id,
            rank: index + 1,
            display_name: displayName,
            email_prefix: displayName,
            score: Number(row.score) || 0,
            is_vip: isVip,
            is_owner: isOwner,
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
  maintenanceGate,
  async (req: Request, res: Response) => {
    try {
      const { gameId } = req.params;
      const { score, difficulty, playSessionId } = req.body;

      if (!gameId) {
        return res.status(400).json({ error: 'gameId parameter is required' });
      }

      // Only games that actually submit scores may write to the leaderboard
      const normalizedGameId = gameId.replace(/-/g, '_').toLowerCase();
      if (!SCOREABLE_GAME_IDS.has(normalizedGameId)) {
        return res.status(400).json({ error: 'INVALID_GAME', message: 'This game does not support score submission.' });
      }

      const numScore = Number(score);
      if (
        typeof score === 'undefined' ||
        score === null ||
        !Number.isFinite(numScore) ||
        numScore < 0 ||
        numScore > MAX_LEADERBOARD_SCORE
      ) {
        return res.status(400).json({
          error: 'INVALID_SCORE',
          message: `score must be a finite number between 0 and ${MAX_LEADERBOARD_SCORE}`,
        });
      }

      const userId = req.user!.id;

      // Validate single-use play session token
      const token = playSessionId || (req.headers['x-play-session-id'] as string);
      const sessionCheck = token
        ? validateAndConsumeSession(token, userId, normalizedGameId)
        : ({ valid: false, reason: 'INVALID_SESSION' } as const);

      if (!sessionCheck.valid) {
        if (sessionCheck.reason === 'SESSION_TOO_SOON') {
          console.warn(`[leaderboard] Rejected impossibly fast score submission for user ${userId} in ${normalizedGameId}.`);
          return res.status(400).json({
            error: 'SCORE_SUBMITTED_TOO_FAST',
            message: 'Score submitted faster than a legitimate round is possible.',
          });
        }
        console.warn(`[leaderboard] Blocked score submission for user ${userId} in ${normalizedGameId}: invalid or missing playSessionId.`);
        return res.status(403).json({
          error: 'INVALID_PLAY_SESSION',
          message: 'Valid active play session required. Start a fresh game round to submit scores.',
        });
      }

      console.log(`[leaderboard] Validated playSessionId for ${userId} in ${normalizedGameId}, saving score ${numScore}`);

      const userEmail = req.user!.email;
      if (userEmail) {
        userEmailCache.set(userId, userEmail.split('@')[0]);
      }

      // Check if user already has a score record for this game
      const { data: existingRows, error: fetchError } = await supabaseAdmin
        .from('game_scores')
        .select('id, score')
        .eq('user_id', userId)
        .eq('game_id', normalizedGameId)
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
          console.log(`[leaderboard] Updated high score for user ${userId} in ${normalizedGameId}: ${numScore} (was ${existing.score})`);
        } else {
          console.log(`[leaderboard] Score ${numScore} <= existing ${existing.score} for ${userId} in ${normalizedGameId}. No update.`);
        }
      } else {
        // Insert new record
        const { error: insertError } = await supabaseAdmin
          .from('game_scores')
          .insert({
            user_id: userId,
            game_id: normalizedGameId,
            score: numScore,
            created_at: new Date().toISOString(),
          });

        if (insertError) {
          console.error(`[leaderboard] Error inserting score:`, insertError);
          return res.status(500).json({ error: 'failed_to_insert_score' });
        }
        updated = true;
        console.log(`[leaderboard] Inserted new score for user ${userId} in ${normalizedGameId}: ${numScore}`);
      }

      // Invalidate cache for this gameId so next GET fetches fresh data
      leaderboardCache.delete(normalizedGameId);
      console.log(`[leaderboard] Cache invalidated for ${normalizedGameId}`);

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
