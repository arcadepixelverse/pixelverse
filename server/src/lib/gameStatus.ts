import { supabaseAdmin } from './supabase';

export interface GameStatusMap {
  [gameId: string]: boolean;
}

export const DEFAULT_GAME_STATUS: GameStatusMap = {
  higher_lower: true,
  jailbreak: true,
  mind_reader: true,
  turing_test: true,
  survival: true,
  wingman: true,
  cyber_sprint: true,
  signal_sync: true,
  overclock: true,
  packet_router: true,
  vault: false,
};

/**
 * Retrieves the current game_status mapping from Supabase app_settings.
 * Queries Supabase app_settings directly on every request without in-memory caching.
 */
export async function getGameStatus(): Promise<GameStatusMap> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'game_status')
      .maybeSingle();

    if (error || !data?.value) {
      console.warn('[gameStatus] Error or missing row, using fallback:', error);
      return DEFAULT_GAME_STATUS;
    }

    return { ...DEFAULT_GAME_STATUS, ...data.value };
  } catch (err) {
    console.warn('[gameStatus] Exception fetching app_settings:', err);
    return DEFAULT_GAME_STATUS;
  }
}

/**
 * Updates a single game's status in Supabase.
 */
export async function setGameStatus(gameId: string, status: boolean): Promise<GameStatusMap> {
  const current = await getGameStatus();
  const updated: GameStatusMap = {
    ...current,
    [gameId]: Boolean(status),
  };

  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert(
      {
        key: 'game_status',
        value: updated,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('[gameStatus] Failed to update app_settings:', error);
    throw new Error('Database error updating game_status');
  }

  return updated;
}

export function invalidateGameStatusCache() {
  // No-op since in-memory caching was removed
}
