import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export const PLAY_LIMIT = 10;

/**
 * Strict Game Play Gate Middleware
 * Enforces a strict limit of 10 game plays per user using the profiles table.
 * If total_plays >= 10, returns 429 PLAY_LIMIT_REACHED.
 * Otherwise, increments total_plays by 1, updates last_played_at, and passes through.
 */
export async function playGate(req: Request, res: Response, next: NextFunction) {
  const userId = req.user?.id;
  if (!userId) {
    return res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
  }

  try {
    // 1. Fetch current user profile
    const { data: profile, error } = await supabaseAdmin
      .from('profiles')
      .select('id, total_plays, is_banned')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[playGate] Error querying profiles table:', error.message);
    }

    const currentPlays = profile?.total_plays ?? 0;

    // 2. Strict Limit Check: If total_plays >= 10, block with 429
    if (currentPlays >= PLAY_LIMIT) {
      console.warn(`[playGate] User ${userId} reached play limit: ${currentPlays}/${PLAY_LIMIT}`);
      return res.status(429).json({
        error: 'PLAY_LIMIT_REACHED',
        message: 'You have reached your 10 game limit for today. Come back tomorrow!',
        total_plays: currentPlays,
        max_plays: PLAY_LIMIT,
      });
    }

    // 3. Increment total_plays and record last_played_at
    const nextPlays = currentPlays + 1;
    const nowIso = new Date().toISOString();

    if (profile) {
      const { error: updateErr } = await supabaseAdmin
        .from('profiles')
        .update({
          total_plays: nextPlays,
          last_played_at: nowIso,
        })
        .eq('id', userId);

      if (updateErr) {
        console.error('[playGate] Failed to update total_plays:', updateErr.message);
      }
    } else {
      // First-time record if row does not exist yet
      const { error: insertErr } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: userId,
          total_plays: nextPlays,
          last_played_at: nowIso,
          is_banned: false,
        });

      if (insertErr) {
        console.error('[playGate] Failed to create profile row:', insertErr.message);
      }
    }

    console.log(`[playGate] User ${userId} started game play #${nextPlays}/${PLAY_LIMIT}`);
    return next();
  } catch (err: any) {
    console.error('[playGate] Unexpected error in playGate:', err);
    // On unexpected error, fail-safe: pass through so players aren't stranded by DB glitch
    return next();
  }
}
