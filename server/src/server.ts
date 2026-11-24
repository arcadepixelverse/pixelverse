import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { quotaGate } from './middleware/quotaGate';
import { requireAuth } from './middleware/requireAuth';
import { supabaseAdmin } from './lib/supabase';
import { gamesRouter } from './routes/games';
import { leaderboardRouter } from './routes/leaderboard';
import { adminRouter } from './routes/admin';
import { requireAdmin } from './middleware/requireAdmin';
import { getGameStatus, getMaintenanceMode } from './lib/gameStatus';
import { rateLimit } from './middleware/rateLimit';
import { abuseRateLimit } from './middleware/rateLimit';

dotenv.config();

export const serverTelemetry = {
  bootTime: Date.now(),
  totalRequests: 0,
  endpointCounts: {
    games: 0,
    leaderboard: 0,
    admin: 0,
    auth: 0,
    status: 0,
    other: 0,
  },
  aiCallCount: 0,
  rateLimit429Count: 0,
  error4xxCount: 0,
  error5xxCount: 0,
  totalLatencyMs: 0,
  latencyCount: 0,
};

const app = express();
app.set('trust proxy', 1);
const PORT = process.env.PORT || 10000;

// ── Middleware ────────────────────────────────────────────────────────────────
const allowedOrigins = [
  'http://localhost:5173',
  process.env.FRONTEND_URL
].filter(Boolean) as string[];

app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      console.log("Blocked by CORS:", origin);
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Bot/spam throttle — skips /api/admin/* so the overlord console stays unblocked
app.use(abuseRateLimit);

// Global no-cache headers (prevents proxy, CDN, and browser caching)
app.use((_req: Request, res: Response, next: NextFunction) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Telemetry & metrics middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  serverTelemetry.totalRequests++;

  const path = req.path || '';
  if (path.startsWith('/api/games')) serverTelemetry.endpointCounts.games++;
  else if (path.startsWith('/api/leaderboard')) serverTelemetry.endpointCounts.leaderboard++;
  else if (path.startsWith('/api/admin')) serverTelemetry.endpointCounts.admin++;
  else if (path.startsWith('/api/auth')) serverTelemetry.endpointCounts.auth++;
  else if (path.startsWith('/api/status')) serverTelemetry.endpointCounts.status++;
  else serverTelemetry.endpointCounts.other++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    serverTelemetry.totalLatencyMs += duration;
    serverTelemetry.latencyCount++;

    if (res.statusCode === 429) {
      serverTelemetry.rateLimit429Count++;
    } else if (res.statusCode >= 500) {
      serverTelemetry.error5xxCount++;
    } else if (res.statusCode >= 400) {
      serverTelemetry.error4xxCount++;
    }
  });

  next();
});

// ── Routes ────────────────────────────────────────────────────────────────────

/** Health check — used by deploy platforms & load balancers */
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** API root */
app.get('/api', (_req: Request, res: Response) => {
  res.json({
    name: 'PIXELVERSE API',
    version: '1.0.0',
    message: 'Welcome to the arcade. 🕹️',
  });
});

/** Public live system status for dashboard and client state */
app.get('/api/status', async (_req: Request, res: Response) => {
  try {
    const [maintenance_mode, gameStatus] = await Promise.all([
      getMaintenanceMode(),
      getGameStatus(),
    ]);

    return res.json({
      maintenance_mode,
      gameStatus,
      timestamp: new Date().toISOString(),
    });
  } catch (err: any) {
    console.warn('[status] Failed to fetch system status:', err);
    return res.status(500).json({ error: 'failed_to_fetch_status' });
  }
});

/** Authenticated User Profile, Daily Usage, Play Count & Admin Flag */
app.get('/api/auth/me', rateLimit({ windowMs: 60_000, max: 60, keyPrefix: 'auth' }), requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email || '';
    const today = new Date().toISOString().split('T')[0];

    const [dailyRes, profileRes] = await Promise.all([
      supabaseAdmin
        .from('daily_usage')
        .select('ai_calls_count')
        .eq('user_id', userId)
        .eq('usage_date', today)
        .maybeSingle(),
      supabaseAdmin
        .from('profiles')
        .select('total_plays, daily_plays, last_played_at, is_banned, is_vip')
        .eq('id', userId)
        .maybeSingle(),
    ]);

    if (dailyRes.error) {
      console.error('[auth/me] Error querying daily_usage:', dailyRes.error);
    }
    if (profileRes.error) {
      console.error('[auth/me] Error querying profiles:', profileRes.error);
    }

    const rawAdminEnv = process.env.ADMIN_EMAIL || '';
    const adminEmailsFromEnv = rawAdminEnv
      .split(',')
      .map((e) => e.trim().toLowerCase())
      .filter(Boolean);
    const DEFAULT_ADMIN_EMAILS = [
      'pritisinghmgs@gmail.com',
      'arcade.pixelverse@gmail.com',
    ];
    const userEmail = email.trim().toLowerCase();
    const isAdmin =
      adminEmailsFromEnv.includes(userEmail) ||
      DEFAULT_ADMIN_EMAILS.includes(userEmail);

    // Mirror playGate's UTC calendar-day rollover so the client never sees a
    // stale daily_plays count carried over from a previous UTC day.
    const lastPlayedDateStr = profileRes.data?.last_played_at
      ? new Date(profileRes.data.last_played_at).toISOString().split('T')[0]
      : null;
    const effectiveDailyPlays = lastPlayedDateStr === today
      ? (profileRes.data?.daily_plays ?? 0)
      : 0;

    const isVip = profileRes.data?.is_vip === true;
    const dailyLimit = isVip ? 25 : 10;
    const usedOrbs = effectiveDailyPlays;
    const remainingOrbs = Math.max(0, dailyLimit - usedOrbs);

    return res.json({
      id: userId,
      email,
      isAdmin,
      todayUsage: dailyRes.data?.ai_calls_count || 0,
      usedOrbs,
      dailyLimit,
      remainingOrbs,
      isVip,
      daily_plays: effectiveDailyPlays,
      total_plays: profileRes.data?.total_plays ?? 0,
      is_banned: profileRes.data?.is_banned ?? false,
    });
  } catch (err: any) {
    console.error('[auth/me] Unexpected error:', err);
    return res.status(500).json({ error: 'internal_error' });
  }
});

/** Quota gate test route */
app.post('/api/test-quota', requireAuth, quotaGate, (_req: Request, res: Response) => {
  res.json({ message: 'Success! You bypassed the quota gate.' });
});

/** Games routes (Jailbreak, Higher-Lower, etc.) */
app.use('/api/games', gamesRouter);

/** Leaderboards (rate-limited; admin routes are intentionally exempt) */
app.use('/api/leaderboard', rateLimit({ windowMs: 60_000, max: 30, keyPrefix: 'leaderboard' }), leaderboardRouter);

/** Admin Console (Overlord) */
app.use('/api/admin', requireAuth, requireAdmin, adminRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────
app.use((_req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

// ── Global error handler ──────────────────────────────────────────────────────
// eslint-disable-next-line @typescript-eslint/no-unused-vars
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('[ERROR]', err.message);
  res.status(500).json({ error: 'Internal server error' });
});

// ── Start ─────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`🕹️  PIXELVERSE server running on port ${PORT}`);
});

export default app;
