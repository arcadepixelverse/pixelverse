import { Request, Response, NextFunction } from 'express';
import { supabaseAuth, supabaseAdmin } from '../lib/supabase';

// Express Request declaration merge
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email?: string;
      };
    }
  }
}

export const requireAuth = async (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return res.status(401).json({ error: 'unauthorized' });
  }

  let user: { id: string; email?: string } | null = null;

  try {
    const { data, error } = await supabaseAuth.auth.getUser(token);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'invalid_token' });
    }

    user = { id: data.user.id, email: data.user.email };
  } catch (err: any) {
    console.error('[requireAuth] Unexpected error validating token:', err);
    return res.status(401).json({ error: 'invalid_token' });
  }

  req.user = user;

  // ── Ban Enforcement Check ──
  try {
    const { data: profile, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('is_banned')
      .eq('id', user.id)
      .maybeSingle();

    if (profileErr) {
      console.warn('[requireAuth] Error checking profile ban status:', profileErr.message);
    }

    if (profile?.is_banned === true) {
      return res.status(403).json({
        error: 'USER_BANNED',
        message: 'Your account has been suspended.',
      });
    }
  } catch (banErr: any) {
    console.error('[requireAuth] Unexpected error checking ban status:', banErr);
  }

  return next();
};
