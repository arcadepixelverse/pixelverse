import { Router, Request, Response } from 'express';
import { supabaseAdmin } from '../lib/supabase';
import { getGameStatus, setGameStatus } from '../lib/gameStatus';

export const adminRouter = Router();

/**
 * GET /api/admin/stats
 * Returns total registered users, total AI calls executed today, and current game status.
 */
adminRouter.get('/stats', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Total users
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 1000,
    });
    if (usersErr) {
      console.warn('[admin/stats] Error listing users:', usersErr);
    }
    const totalUsers = usersData?.users?.length || 0;

    // 2. Total AI calls today (sum of ai_calls_count from daily_usage where usage_date=today)
    const { data: usageData, error: usageErr } = await supabaseAdmin
      .from('daily_usage')
      .select('ai_calls_count')
      .eq('usage_date', today);

    if (usageErr) {
      console.warn('[admin/stats] Error fetching daily_usage:', usageErr);
    }

    const totalAiCallsToday = (usageData || []).reduce(
      (sum, row) => sum + (Number(row.ai_calls_count) || 0),
      0
    );

    // 3. Current game status JSON
    const gameStatus = await getGameStatus();

    return res.json({
      totalUsers,
      totalAiCallsToday,
      gameStatus,
    });
  } catch (err: any) {
    console.error('[admin/stats] Unexpected error:', err);
    return res.status(500).json({ error: 'Failed to fetch admin stats' });
  }
});

/**
 * POST /api/admin/games/toggle
 * Accepts { gameId: string, status: boolean }
 * Updates the app_settings table in Supabase and invalidates cache.
 */
adminRouter.post('/games/toggle', async (req: Request, res: Response) => {
  try {
    const { gameId, status } = req.body;
    if (!gameId || typeof status !== 'boolean') {
      return res.status(400).json({ error: 'Missing or invalid gameId / status boolean' });
    }

    const updatedStatus = await setGameStatus(gameId, status);
    console.log(`[admin/games/toggle] ${gameId} set to ${status}`);

    return res.json({
      success: true,
      gameId,
      status,
      gameStatus: updatedStatus,
    });
  } catch (err: any) {
    console.error('[admin/games/toggle] Error toggling game status:', err);
    return res.status(500).json({ error: 'Failed to update game status' });
  }
});

/**
 * GET /api/admin/users
 * Returns list of top 50 users with their email and today's AI calls count.
 */
adminRouter.get('/users', async (_req: Request, res: Response) => {
  try {
    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch users from Supabase Auth
    const { data: usersData, error: usersErr } = await supabaseAdmin.auth.admin.listUsers({
      perPage: 50,
    });
    if (usersErr) {
      console.warn('[admin/users] Error listing users:', usersErr);
    }
    const rawUsers = usersData?.users || [];

    // 2. Fetch today's usage for these users
    const { data: usageData, error: usageErr } = await supabaseAdmin
      .from('daily_usage')
      .select('user_id, ai_calls_count')
      .eq('usage_date', today);

    if (usageErr) {
      console.warn('[admin/users] Error querying usage:', usageErr);
    }

    const usageMap = new Map<string, number>(
      (usageData || []).map((row) => [row.user_id, Number(row.ai_calls_count) || 0])
    );

    const users = rawUsers.map((u) => ({
      id: u.id,
      email: u.email || 'Anonymous',
      ai_calls_count: usageMap.get(u.id) || 0,
      created_at: u.created_at,
      last_sign_in_at: u.last_sign_in_at,
    }));

    return res.json(users);
  } catch (err: any) {
    console.error('[admin/users] Unexpected error:', err);
    return res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

/**
 * POST /api/admin/users/premium
 * Placeholder for granting premium status (Stripe wiring later).
 */
adminRouter.post('/users/premium', (req: Request, res: Response) => {
  const { userId } = req.body;
  if (!userId) {
    return res.status(400).json({ error: 'Missing userId' });
  }
  console.log(`[admin/users/premium] Granted premium to user: ${userId}`);
  return res.json({
    success: true,
    userId,
    message: 'Premium clearance granted to user (placeholder)',
  });
});
