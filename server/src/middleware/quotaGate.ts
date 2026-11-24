import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabase';

export const quotaGate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'unauthorized' });
    }

    const limit = 10;

    // Call Supabase RPC check_and_increment_usage with authenticated user ID
    const { data, error } = await supabaseAdmin.rpc('check_and_increment_usage', {
      p_user_id: userId,
      p_limit: limit,
    });

    if (error) {
      console.error('[quotaGate] RPC error:', error);
      return res.status(500).json({
        error: 'quota_check_failed',
        message: 'Failed to verify usage quota',
      });
    }

    // Handle return value (object, array of records, or boolean).
    // Fail CLOSED: an unrecognised RPC payload must never be treated as "allowed".
    const result = Array.isArray(data) ? data[0] : data;
    let allowed: boolean;
    if (typeof result === 'boolean') {
      allowed = result;
    } else if (result && typeof result.allowed === 'boolean') {
      allowed = result.allowed;
    } else {
      console.error('[quotaGate] Unrecognised RPC payload, denying request:', JSON.stringify(data));
      return res.status(500).json({
        error: 'quota_check_failed',
        message: 'Failed to verify usage quota',
      });
    }
    const current_count = result?.current_count ?? result?.count ?? (allowed ? 1 : limit);

    if (!allowed) {
      const now = new Date();
      const resetAt = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)).toISOString();

      return res.status(429).json({
        error: 'quota_exceeded',
        message: "You've used all your daily AI actions. Come back tomorrow!",
        resetAt,
      });
    }

    res.setHeader('X-Daily-Usage', `${current_count}/${limit}`);
    return next();
  } catch (err: any) {
    console.error('[quotaGate] Unexpected error:', err);
    return res.status(500).json({
      error: 'quota_check_failed',
      message: 'An unexpected error occurred in quota gate',
    });
  }
};
