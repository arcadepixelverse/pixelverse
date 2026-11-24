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

/**
 * Checks whether global maintenance mode is enabled.
 * Queries Supabase app_settings (key: 'maintenance_mode') with no caching.
 */
export async function getMaintenanceMode(): Promise<boolean> {
  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'maintenance_mode')
      .maybeSingle();

    if (error || data?.value === undefined) {
      return false;
    }

    if (typeof data.value === 'boolean') return data.value;
    if (typeof data.value?.enabled === 'boolean') return data.value.enabled;
    return false;
  } catch (err) {
    console.warn('[gameStatus] Exception fetching maintenance_mode:', err);
    return false;
  }
}

/**
 * Sets global maintenance mode in Supabase app_settings.
 */
export async function setMaintenanceMode(enabled: boolean): Promise<boolean> {
  const { error } = await supabaseAdmin
    .from('app_settings')
    .upsert(
      {
        key: 'maintenance_mode',
        value: { enabled: Boolean(enabled) },
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'key' }
    );

  if (error) {
    console.error('[gameStatus] Failed to update maintenance_mode:', error);
    throw new Error('Database error updating maintenance_mode');
  }

  return Boolean(enabled);
}

/**
 * Toggles ALL games to either true or false in one atomic write.
 */
export async function setAllGamesStatus(status: boolean): Promise<GameStatusMap> {
  const current = await getGameStatus();
  const updated: GameStatusMap = {};
  for (const key of Object.keys(current)) {
    updated[key] = Boolean(status);
  }

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
    console.error('[gameStatus] Failed to bulk update game_status:', error);
    throw new Error('Database error bulk updating game_status');
  }

  return updated;
}
