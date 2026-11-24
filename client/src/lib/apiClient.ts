import { supabase } from './supabase'

/**
 * Exact backend URL without any trailing slashes.
 * Prioritizes VITE_API_URL / VITE_BACKEND_URL; in production or default falls back to the live Render backend.
 */
const RAW_BACKEND_URL: string =
  (import.meta.env.VITE_API_URL as string | undefined) ||
  (import.meta.env.VITE_BACKEND_URL as string | undefined) ||
  (import.meta.env.PROD
    ? 'https://pixelverse-backend.onrender.com'
    : 'http://localhost:10000')

export const BACKEND_URL: string = RAW_BACKEND_URL.trim().replace(/\/+$/, '')

export const DEFAULT_REQUEST_TIMEOUT_MS = 15_000
export const AI_TURN_TIMEOUT_MS = 25_000

export const SERVER_WAKING_MESSAGE =
  'The arcade is waking up. Please wait a few seconds and try again.'
export const SERVER_UNREACHABLE_MESSAGE =
  'Cannot reach the arcade server. Check your connection and try again.'

export type ApiFetchOptions = RequestInit & {
  timeoutMs?: number
}

export class ApiNetworkError extends Error {
  readonly code: 'TIMEOUT' | 'UNREACHABLE'

  constructor(code: 'TIMEOUT' | 'UNREACHABLE', message: string) {
    super(message)
    this.name = 'ApiNetworkError'
    this.code = code
  }
}

function isAiGameTurnPath(path: string): boolean {
  return /\/api\/games\/.+(?:\/(?:turn|ask|judge|chat|generate|start))(?:\/|$)/i.test(path)
}

function composeTimeoutSignal(
  userSignal: AbortSignal | null | undefined,
  timeoutMs: number
): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController()
  const timer = globalThis.setTimeout(() => {
    controller.abort()
  }, timeoutMs)

  const onUserAbort = () => {
    controller.abort()
  }

  if (userSignal) {
    if (userSignal.aborted) {
      controller.abort()
    } else {
      userSignal.addEventListener('abort', onUserAbort, { once: true })
    }
  }

  return {
    signal: controller.signal,
    clear: () => {
      globalThis.clearTimeout(timer)
      userSignal?.removeEventListener('abort', onUserAbort)
    },
  }
}

function mapFetchFailure(err: unknown, userSignal?: AbortSignal | null): never {
  if (userSignal?.aborted) {
    throw err
  }

  const name = err instanceof DOMException || err instanceof Error ? err.name : ''
  if (name === 'AbortError') {
    showNetworkIssueBanner(SERVER_WAKING_MESSAGE)
    throw new ApiNetworkError('TIMEOUT', SERVER_WAKING_MESSAGE)
  }

  showNetworkIssueBanner(SERVER_UNREACHABLE_MESSAGE)
  throw new ApiNetworkError('UNREACHABLE', SERVER_UNREACHABLE_MESSAGE)
}

async function timedFetch(
  url: string,
  init: RequestInit,
  timeoutMs: number
): Promise<Response> {
  const { signal, clear } = composeTimeoutSignal(init.signal, timeoutMs)
  try {
    return await fetch(url, {
      ...init,
      cache: 'no-store',
      signal,
    })
  } catch (err) {
    mapFetchFailure(err, init.signal)
  } finally {
    clear()
  }
}

/**
 * Enhanced fetch wrapper that attaches the Supabase JWT Bearer token,
 * automatically handles token refresh on 401, retries once, and on a second
 * 401 signs the user out and performs a hard redirect to /login.
 *
 * Times out after 15s (25s for AI game turns) so Render cold starts surface a
 * wake-up message instead of hanging forever.
 */
export async function apiFetch(
  path: string,
  options: ApiFetchOptions = {}
): Promise<Response> {
  const { timeoutMs: timeoutOverride, signal: userSignal, ...fetchOptions } = options

  // Strip hardcoded localhost prefix if present
  let cleanPath = path
  if (cleanPath.startsWith('http://localhost:10000')) {
    cleanPath = cleanPath.slice('http://localhost:10000'.length)
  }

  const url =
    cleanPath.startsWith('http://') || cleanPath.startsWith('https://')
      ? cleanPath
      : `${BACKEND_URL}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`

  const timeoutMs =
    timeoutOverride ??
    (isAiGameTurnPath(cleanPath) || isAiGameTurnPath(url)
      ? AI_TURN_TIMEOUT_MS
      : DEFAULT_REQUEST_TIMEOUT_MS)

  const buildHeaders = (token?: string | null): HeadersInit => {
    const headers = new Headers(fetchOptions.headers || {})
    if (!headers.has('Content-Type') && !(fetchOptions.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (token && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  }

  // 1. Get current session
  const { data: sessionData } = await supabase.auth.getSession()
  let token = sessionData.session?.access_token

  if (!token) {
    try {
      const { data: refreshData } = await supabase.auth.refreshSession()
      token = refreshData.session?.access_token
    } catch {
      // Proceed without token if user is not authenticated
    }
  }

  const run = (accessToken?: string | null) =>
    timedFetch(
      url,
      {
        ...fetchOptions,
        cache: 'no-store',
        headers: buildHeaders(accessToken),
        signal: userSignal,
      },
      timeoutMs
    )

  // Initial fetch with no-store cache to prevent browser caching (cannot be overridden by options)
  let response = await run(token)

  // 2. On 401: attempt to refresh session once and retry once
  if (response.status === 401) {
    try {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession()
      if (!refreshError && refreshData.session?.access_token) {
        token = refreshData.session.access_token
        response = await run(token)
      }
    } catch (err) {
      if (err instanceof ApiNetworkError) {
        throw err
      }
      console.warn('[apiClient] Failed to refresh session on 401:', err)
    }

    // 3. On second 401: signOut and hard redirect to /login
    if (response.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
  }

  // 3. On 403: Intercept USER_BANNED and GAME_DISABLED
  if (response.status === 403) {
    try {
      const cloned = response.clone()
      const data = await cloned.json()
      if (data?.error === 'USER_BANNED') {
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new Event('pixelverse:user-banned'))
        }
        showUserBannedModal()
      }
    } catch {
      // ignore json parse errors
    }
  }

  // 4. On 429: Check for PLAY_LIMIT_REACHED and display modal
  if (response.status === 429) {
    try {
      const cloned = response.clone()
      const data = await cloned.json()
      if (data?.error === 'PLAY_LIMIT_REACHED') {
        showPlayLimitModal()
      }
    } catch {
      // ignore json parse errors
    }
  }

  // 5. On 503: Intercept MAINTENANCE_MODE (exclude /admin so admin can manage system)
  if (response.status === 503) {
    try {
      const cloned = response.clone()
      const data = await cloned.json()
      if (data?.error === 'MAINTENANCE_MODE') {
        if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/admin')) {
          showMaintenanceModal()
        }
      }
    } catch {
      // ignore json parse errors
    }
  }

  return response
}

export const SERVER_OVERLOAD_MESSAGE = 'Servers are under heavy load. Please try again in a minute.'
export const PLAY_LIMIT_MESSAGE = 'You have reached your 10 game limit for today. Come back tomorrow!'

/**
 * Injects a cyberpunk glassmorphic modal notifying the player of their daily limit.
 */
export function showPlayLimitModal() {
  if (typeof document === 'undefined') return
  if (document.getElementById('pixelverse-play-limit-modal')) return

  const modal = document.createElement('div')
  modal.id = 'pixelverse-play-limit-modal'
  modal.className = 'fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-md'
  modal.innerHTML = `
    <div style="background: rgba(15, 17, 26, 0.95); border: 1px solid rgba(255, 69, 58, 0.4); box-shadow: 0 0 50px rgba(255, 69, 58, 0.25);" class="max-w-md w-full rounded-2xl p-6 text-center text-white relative">
      <div class="w-14 h-14 mx-auto mb-4 rounded-full flex items-center justify-center bg-red-500/15 border border-red-500/30 text-2xl shadow-[0_0_20px_rgba(255,69,58,0.3)]">
        ⏳
      </div>
      <h3 style="font-family: monospace; letter-spacing: 0.2em;" class="text-lg font-black uppercase text-red-400 mb-2">
        DAILY LIMIT REACHED
      </h3>
      <p style="font-family: monospace;" class="text-sm text-white/80 leading-relaxed mb-6">
        You have reached your 10 game limit for today. Come back tomorrow!
      </p>
      <div class="flex justify-center gap-3">
        <button id="pixelverse-play-limit-close-btn" style="background: rgba(255, 69, 58, 0.15); border: 1px solid rgba(255, 69, 58, 0.4); font-family: monospace; letter-spacing: 0.15em;" class="px-6 py-2.5 rounded-full text-xs font-bold uppercase text-red-300 hover:bg-red-500/25 transition cursor-pointer">
          RETURN TO ARCADE
        </button>
      </div>
    </div>
  `

  document.body.appendChild(modal)

  const closeBtn = modal.querySelector('#pixelverse-play-limit-close-btn')
  const cleanup = () => {
    modal.remove()
    window.location.href = '/'
  }

  closeBtn?.addEventListener('click', cleanup)
  modal.addEventListener('click', (e) => {
    if (e.target === modal) cleanup()
  })
}

/**
 * Injects an uncloseable full-screen blocking modal when the user is banned.
 */
export function showUserBannedModal() {
  if (typeof document === 'undefined') return
  if (document.getElementById('pixelverse-user-banned-modal')) return

  const modal = document.createElement('div')
  modal.id = 'pixelverse-user-banned-modal'
  modal.className =
    'fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl select-none'
  modal.innerHTML = `
    <div style="background: rgba(18, 5, 8, 0.98); border: 2px solid rgba(255, 55, 95, 0.8); box-shadow: 0 0 80px rgba(255, 55, 95, 0.45);" class="max-w-lg w-full rounded-3xl p-8 sm:p-10 text-center text-white relative">
      <div class="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-red-500/20 border-2 border-red-500/60 text-4xl shadow-[0_0_35px_rgba(255,55,95,0.6)] animate-pulse">
        ⛔
      </div>
      <h2 style="font-family: monospace; letter-spacing: 0.15em;" class="text-xl sm:text-2xl font-black uppercase text-red-500 mb-4 leading-tight">
        TERMINAL LOCKOUT // ACCESS REVOKED
      </h2>
      <div class="p-4 rounded-xl bg-red-950/30 border border-red-500/30 mb-6">
        <p style="font-family: monospace; letter-spacing: 0.05em;" class="text-sm font-bold text-red-200 leading-relaxed uppercase">
          YOUR ID IS SUSPENDED BY THE OWNER DUE TO UNWANTED BEHAVIOR.
        </p>
      </div>
      <p style="font-family: monospace;" class="text-xs text-white/40 tracking-wider">
        SYSTEM STATUS: PERMANENTLY LOCKED • CLEARANCE VOID
      </p>
    </div>
  `

  document.body.appendChild(modal)
}

/**
 * Injects a full-screen cyberpunk modal when platform is under maintenance.
 */
export function showMaintenanceModal() {
  if (typeof document === 'undefined') return
  if (document.getElementById('pixelverse-maintenance-modal')) return

  const modal = document.createElement('div')
  modal.id = 'pixelverse-maintenance-modal'
  modal.className =
    'fixed inset-0 z-[99999] flex items-center justify-center p-6 bg-black/95 backdrop-blur-2xl select-none'
  modal.innerHTML = `
    <div style="background: rgba(12, 16, 28, 0.98); border: 2px solid rgba(0, 245, 255, 0.6); box-shadow: 0 0 80px rgba(0, 245, 255, 0.3);" class="max-w-lg w-full rounded-3xl p-8 sm:p-10 text-center text-white relative font-mono">
      <div class="w-20 h-20 mx-auto mb-6 rounded-3xl flex items-center justify-center bg-cyan-500/20 border-2 border-cyan-500/60 text-4xl shadow-[0_0_35px_rgba(0,245,255,0.6)] animate-pulse">
        🛠️
      </div>
      <h2 style="letter-spacing: 0.15em;" class="text-xl sm:text-2xl font-black uppercase text-cyan-400 mb-4 leading-tight">
        SYSTEM UNDERGOING MAINTENANCE
      </h2>
      <div class="p-4 rounded-xl bg-cyan-950/30 border border-cyan-500/30 mb-6">
        <p style="letter-spacing: 0.05em;" class="text-xs sm:text-sm font-bold text-cyan-200 leading-relaxed uppercase">
          OUR ENGINEERS ARE UPGRADING CORE SYSTEMS. ARCADE MODULES WILL RESTORE AUTOMATICALLY ONCE CALIBRATION COMPLETES.
        </p>
      </div>
      <p class="text-xs text-white/40 tracking-wider">
        OP STATUS: STANDBY // CLEARANCE ADMIN-ONLY
      </p>
    </div>
  `

  document.body.appendChild(modal)
}

/**
 * Parses response error, translating known backend error codes into friendly notices.
 */
export async function getApiErrorMessage(
  response: Response,
  defaultMessage: string = 'An unexpected error occurred.'
): Promise<string> {
  try {
    const data = await response.clone().json()
    if (data?.error === 'ALL_AI_PROVIDERS_FAILED' || data?.message?.includes('heavy load')) {
      return SERVER_OVERLOAD_MESSAGE
    }
    if (data?.error === 'PLAY_LIMIT_REACHED' || data?.message?.includes('10 game limit')) {
      return PLAY_LIMIT_MESSAGE
    }
    if (data?.error === 'USER_BANNED') {
      return 'Your account has been suspended.'
    }
    if (data?.error === 'GAME_DISABLED') {
      return 'This game has been temporarily disabled by the admin.'
    }
    if (data?.error === 'MAINTENANCE_MODE') {
      return 'System is currently undergoing scheduled maintenance.'
    }
    if (data?.error === 'RATE_LIMITED') {
      return data?.message || 'Too many requests. Please slow down and try again shortly.'
    }
    return data?.message || data?.error || defaultMessage
  } catch {
    return defaultMessage
  }
}

/**
 * Lightweight banner when the Render instance is cold or the network is down.
 */
export function showNetworkIssueBanner(message: string) {
  if (typeof document === 'undefined') return

  const existing = document.getElementById('pixelverse-network-banner')
  if (existing) {
    const text = existing.querySelector('[data-network-banner-text]')
    if (text) text.textContent = message
    return
  }

  const banner = document.createElement('div')
  banner.id = 'pixelverse-network-banner'
  banner.className =
    'fixed bottom-4 left-1/2 z-[99998] w-[min(92vw,28rem)] -translate-x-1/2 rounded-2xl border border-cyan-400/40 bg-[rgba(12,16,28,0.96)] px-4 py-3 text-center shadow-[0_0_40px_rgba(0,245,255,0.25)]'
  banner.innerHTML = `
    <p data-network-banner-text style="font-family: monospace;" class="text-xs sm:text-sm text-cyan-100 leading-relaxed">
      ${message}
    </p>
    <button type="button" id="pixelverse-network-banner-close" style="font-family: monospace; letter-spacing: 0.12em;" class="mt-2 text-[10px] uppercase text-cyan-300/80 hover:text-cyan-200 cursor-pointer">
      Dismiss
    </button>
  `

  document.body.appendChild(banner)

  const close = () => banner.remove()
  banner.querySelector('#pixelverse-network-banner-close')?.addEventListener('click', close)
  window.setTimeout(close, 10_000)
}
