import { Request, Response, NextFunction } from 'express';
import { supabaseAdmin } from '../lib/supabaseAdmin';

export const quotaGate = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userId = (req as any).user?.id || '00000000-0000-0000-0000-000000000000';
    const role = 'free';
    const limit = 10;

    // Call Supabase RPC check_and_increment_usage
    let { data, error } = await supabaseAdmin.rpc('check_and_increment_usage', {
      user_id: userId,
      limit: limit,
    });

    // Fallback if parameter names in the PostgreSQL function use common alternative conventions (e.g. p_ prefix)
    if (error && (error.code === 'PGRST202' || error.message?.includes('schema cache'))) {
      const retry1 = await supabaseAdmin.rpc('check_and_increment_usage', {
        p_user_id: userId,
        p_limit: limit,
      });

      if (!retry1.error) {
        data = retry1.data;
        error = null;
      } else if (retry1.error.code === 'PGRST202') {
        const retry2 = await supabaseAdmin.rpc('check_and_increment_usage', {
          p_user_id: userId,
          p_role: role,
          p_limit: limit,
        });

        if (!retry2.error) {
          data = retry2.data;
          error = null;
        }
      }
    }

    if (error) {
      console.error('[quotaGate] RPC error:', error);
      return res.status(500).json({
        error: 'INTERNAL_SERVER_ERROR',
        message: error.message || 'Failed to verify usage quota',
      });
    }

    // Handle return value (object, array of records, or boolean)
    const result = Array.isArray(data) ? data[0] : data;
    const allowed = result?.allowed ?? (typeof result === 'boolean' ? result : true);
    const current_count = result?.current_count ?? result?.count ?? (allowed ? 1 : limit);

    if (!allowed) {
      return res.status(429).json({
        error: 'DAILY_LIMIT_REACHED',
        message: "You've used all your daily AI actions. Come back tomorrow!",
      });
    }

    res.setHeader('X-Daily-Usage', `${current_count}/${limit}`);
    return next();
  } catch (err: any) {
    console.error('[quotaGate] Unexpected error:', err);
    return res.status(500).json({
      error: 'INTERNAL_SERVER_ERROR',
      message: err.message || 'An unexpected error occurred in quota gate',
    });
  }
};
