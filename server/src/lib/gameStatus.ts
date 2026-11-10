import { supabaseAdmin } from './supabase';

export interface GameStatusMap {
  [gameId: string]: boolean;
}

interface CachedGameStatus {
  data: GameStatusMap;
  timestamp: number;
}

let cachedGameStatus: CachedGameStatus | null = null;
const CACHE_TTL_MS = 60 * 1000; // 1 minute in-memory cache

export const DEFAULT_GAME_STATUS: GameStatusMap = {
  higher_lower: true,
  jailbreak: true,
  mind_reader: true,
  turing_test: true,
  survival: true,
  wingman: true,
  vault: false,
};

/**
 * Retrieves the current game_status mapping from Supabase app_settings.
 * Cached in-memory for 1 minute to respect database quotas.
 */
export async function getGameStatus(): Promise<GameStatusMap> {
  const now = Date.now();
  if (cachedGameStatus && now - cachedGameStatus.timestamp < CACHE_TTL_MS) {
    return cachedGameStatus.data;
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_settings')
      .select('value')
      .eq('key', 'game_status')
      .maybeSingle();

    if (error || !data?.value) {
      console.warn('[gameStatus] Error or missing row, using fallback:', error);
      return cachedGameStatus?.data || DEFAULT_GAME_STATUS;
    }

    cachedGameStatus = {
      data: { ...DEFAULT_GAME_STATUS, ...data.value },
      timestamp: now,
    };
    return cachedGameStatus.data;
  } catch (err) {
    console.warn('[gameStatus] Exception fetching app_settings:', err);
    return cachedGameStatus?.data || DEFAULT_GAME_STATUS;
  }
}

/**
 * Updates a single game's status in Supabase and invalidates in-memory cache immediately.
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

  // Update in-memory cache immediately with the new state
  cachedGameStatus = {
    data: updated,
    timestamp: Date.now(),
  };

  return updated;
}

export function invalidateGameStatusCache() {
  cachedGameStatus = null;
}
