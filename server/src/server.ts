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

dotenv.config();

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

/** Authenticated User Profile & Daily Usage */
app.get('/api/auth/me', requireAuth, async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const email = req.user!.email;
    const today = new Date().toISOString().split('T')[0];

    const { data, error } = await supabaseAdmin
      .from('daily_usage')
      .select('ai_calls_count')
      .eq('user_id', userId)
      .eq('usage_date', today)
      .maybeSingle();

    if (error) {
      console.error('[auth/me] Error querying daily_usage:', error);
      return res.json({ id: userId, email, todayUsage: 0 });
    }

    return res.json({
      id: userId,
      email,
      todayUsage: data?.ai_calls_count || 0,
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

/** Leaderboards */
app.use('/api/leaderboard', leaderboardRouter);

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
