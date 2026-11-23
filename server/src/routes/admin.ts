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
 * Returns list of top 50 users with their email, today's AI calls count, and profile status.
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

    // 3. Fetch profiles (is_banned, total_plays, last_played_at)
    const { data: profilesData, error: profileErr } = await supabaseAdmin
      .from('profiles')
      .select('id, is_banned, total_plays, last_played_at');

    if (profileErr) {
      console.warn('[admin/users] Error querying profiles:', profileErr);
    }

    const profileMap = new Map<string, any>(
      (profilesData || []).map((p) => [p.id, p])
    );

    const users = rawUsers.map((u) => {
      const prof = profileMap.get(u.id);
      return {
        id: u.id,
        email: u.email || 'Anonymous',
        ai_calls_count: usageMap.get(u.id) || 0,
        total_plays: prof?.total_plays ?? 0,
        is_banned: Boolean(prof?.is_banned),
        last_played_at: prof?.last_played_at || null,
        created_at: u.created_at,
        last_sign_in_at: u.last_sign_in_at,
      };
    });

    return res.json(users);
  } catch (err: any) {
    console.error('[admin/users] Unexpected error:', err);
    return res.status(500).json({ error: 'Failed to fetch users list' });
  }
});

/**
 * GET /api/admin/users/:id
 * Return full user details (email, total_plays, last_played_at, is_banned, AI calls today).
 */
adminRouter.get('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // 1. Fetch user from Supabase Auth
    const { data: userData, error: userErr } = await supabaseAdmin.auth.admin.getUserById(id);
    if (userErr || !userData?.user) {
      return res.status(404).json({ error: 'User not found' });
    }
    const user = userData.user;

    // 2. Fetch profile from profiles table
    const { data: profile } = await supabaseAdmin
      .from('profiles')
      .select('id, is_banned, total_plays, last_played_at')
      .eq('id', id)
      .maybeSingle();

    // 3. Fetch today's AI calls
    const today = new Date().toISOString().split('T')[0];
    const { data: usageData } = await supabaseAdmin
      .from('daily_usage')
      .select('ai_calls_count')
      .eq('user_id', id)
      .eq('usage_date', today)
      .maybeSingle();

    return res.json({
      id: user.id,
      email: user.email || 'Anonymous',
      total_plays: profile?.total_plays ?? 0,
      last_played_at: profile?.last_played_at || null,
      is_banned: Boolean(profile?.is_banned),
      ai_calls_count: Number(usageData?.ai_calls_count) || 0,
      created_at: user.created_at,
      last_sign_in_at: user.last_sign_in_at,
    });
  } catch (err: any) {
    console.error('[admin/users/:id] Error:', err);
    return res.status(500).json({ error: 'Failed to fetch user details' });
  }
});

/**
 * POST /api/admin/users/:id/ban
 * Update is_banned = true in profiles table.
 */
adminRouter.post('/users/:id/ban', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ id, is_banned: true }, { onConflict: 'id' });

    if (error) {
      console.error('[admin/users/:id/ban] Error banning user:', error);
      return res.status(500).json({ error: 'Failed to ban user' });
    }

    return res.json({ success: true, message: 'User banned successfully', is_banned: true });
  } catch (err: any) {
    console.error('[admin/users/:id/ban] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * POST /api/admin/users/:id/unban
 * Update is_banned = false in profiles table.
 */
adminRouter.post('/users/:id/unban', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    const { error } = await supabaseAdmin
      .from('profiles')
      .upsert({ id, is_banned: false }, { onConflict: 'id' });

    if (error) {
      console.error('[admin/users/:id/unban] Error unbanning user:', error);
      return res.status(500).json({ error: 'Failed to unban user' });
    }

    return res.json({ success: true, message: 'User unbanned successfully', is_banned: false });
  } catch (err: any) {
    console.error('[admin/users/:id/unban] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
});

/**
 * DELETE /api/admin/users/:id
 * Delete user from Supabase Auth (and profiles table).
 */
adminRouter.delete('/users/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    if (!id) {
      return res.status(400).json({ error: 'Missing userId' });
    }

    // 1. Delete user from Supabase Auth
    const { error: authErr } = await supabaseAdmin.auth.admin.deleteUser(id);
    if (authErr) {
      console.error('[admin/users/:id/delete] Error deleting auth user:', authErr);
      return res.status(500).json({ error: authErr.message || 'Failed to delete user from auth' });
    }

    // 2. Delete user profile
    await supabaseAdmin.from('profiles').delete().eq('id', id);

    return res.json({ success: true, message: 'User deleted successfully' });
  } catch (err: any) {
    console.error('[admin/users/:id/delete] Error:', err);
    return res.status(500).json({ error: 'Internal server error' });
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
