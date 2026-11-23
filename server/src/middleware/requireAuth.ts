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

interface CachedToken {
  userId: string;
  email?: string;
  expiresAt: number;
}

// In-memory token cache with 60s TTL
const tokenCache = new Map<string, CachedToken>();
const CACHE_TTL_MS = 60 * 1000;

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

  // Check in-memory cache
  const cached = tokenCache.get(token);
  if (cached && cached.expiresAt > Date.now()) {
    user = { id: cached.userId, email: cached.email };
  } else {
    try {
      const { data, error } = await supabaseAuth.auth.getUser(token);
      if (error || !data?.user) {
        return res.status(401).json({ error: 'invalid_token' });
      }

      user = { id: data.user.id, email: data.user.email };

      // Cache valid token
      tokenCache.set(token, {
        userId: data.user.id,
        email: data.user.email,
        expiresAt: Date.now() + CACHE_TTL_MS,
      });
    } catch (err: any) {
      console.error('[requireAuth] Unexpected error validating token:', err);
      return res.status(401).json({ error: 'invalid_token' });
    }
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
