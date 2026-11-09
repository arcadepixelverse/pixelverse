import { supabase } from './supabase'

/**
 * Enhanced fetch wrapper that attaches the Supabase JWT Bearer token,
 * automatically handles token refresh on 401, retries once, and on a second
 * 401 signs the user out and performs a hard redirect to /login.
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const url =
    path.startsWith('http://') || path.startsWith('https://')
      ? path
      : `http://localhost:10000${path.startsWith('/') ? path : `/${path}`}`

  const buildHeaders = (token?: string | null): HeadersInit => {
    const headers = new Headers(options.headers || {})
    if (!headers.has('Content-Type') && !(options.body instanceof FormData)) {
      headers.set('Content-Type', 'application/json')
    }
    if (token) {
      headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
  }

  // 1. Get current session
  const { data: sessionData } = await supabase.auth.getSession()
  let token = sessionData.session?.access_token

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
