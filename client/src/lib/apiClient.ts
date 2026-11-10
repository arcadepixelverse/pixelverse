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

/**
 * Enhanced fetch wrapper that attaches the Supabase JWT Bearer token,
 * automatically handles token refresh on 401, retries once, and on a second
 * 401 signs the user out and performs a hard redirect to /login.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  // Strip hardcoded localhost prefix if present
  let cleanPath = path
  if (cleanPath.startsWith('http://localhost:10000')) {
    cleanPath = cleanPath.slice('http://localhost:10000'.length)
  }

  const url =
    cleanPath.startsWith('http://') || cleanPath.startsWith('https://')
      ? cleanPath
      : `${BACKEND_URL}${cleanPath.startsWith('/') ? cleanPath : `/${cleanPath}`}`

  const buildHeaders = (token?: string | null): HeadersInit => {
    const headers = new Headers(options.headers || {})
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
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

  // Initial fetch
  let response = await fetch(url, {
    ...options,
    headers: buildHeaders(token),
  })

  // 2. On 401: attempt to refresh session once and retry once
  if (response.status === 401) {
    try {
      const { data: refreshData, error: refreshError } =
        await supabase.auth.refreshSession()
      if (!refreshError && refreshData.session?.access_token) {
        token = refreshData.session.access_token
        response = await fetch(url, {
          ...options,
          headers: buildHeaders(token),
        })
      }
    } catch (err) {
      console.warn('[apiClient] Failed to refresh session on 401:', err)
    }

    // 3. On second 401: signOut and hard redirect to /login
    if (response.status === 401) {
      await supabase.auth.signOut()
      window.location.href = '/login'
    }
  }

  return response
}

export const SERVER_OVERLOAD_MESSAGE = 'Servers are under heavy load. Please try again in a minute.'

/**
 * Parses response error, translating ALL_AI_PROVIDERS_FAILED into the standard heavy load notice.
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
    return data?.message || data?.error || defaultMessage
  } catch {
    return defaultMessage
  }
}
