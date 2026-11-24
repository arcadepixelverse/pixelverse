import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User, Session, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/apiClient'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  accessToken: string | null
  todayUsage: number
  totalPlays: number
  isVip: boolean
  dailyLimit: number
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
  refreshUsage: () => Promise<void>
  refreshQuota: () => Promise<void>
  refreshUser: () => Promise<void>
  syncPlaySession: (data: { todayUsage?: number; totalPlays?: number; remainingPlays?: number }) => void
}

const KNOWN_ADMINS = [
  (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase(),
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
].filter(Boolean)

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [isAdmin, setIsAdmin] = useState(false)
  const [todayUsage, setTodayUsage] = useState<number>(0)
  const [totalPlays, setTotalPlays] = useState<number>(0)
  const [isVip, setIsVip] = useState<boolean>(false)
  const [dailyLimit, setDailyLimit] = useState<number>(10)

  const fetchUsage = async (token: string) => {
    try {
      const res = await apiFetch('/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.status === 401) {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setTodayUsage(0)
        setTotalPlays(0)
        setIsVip(false)
        setDailyLimit(10)
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (typeof data.todayUsage === 'number') {
          setTodayUsage(data.todayUsage)
        }
        if (typeof data.total_plays === 'number') {
          setTotalPlays(data.total_plays)
        }
        if (typeof data.isVip === 'boolean') {
          setIsVip(data.isVip)
        }
        if (typeof data.dailyLimit === 'number' && data.dailyLimit > 0) {
          setDailyLimit(data.dailyLimit)
        }
        if (typeof data.isAdmin === 'boolean') {
          setIsAdmin(data.isAdmin)
        } else if (data.email) {
          setIsAdmin(KNOWN_ADMINS.includes(data.email.toLowerCase()))
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to hydrate todayUsage:', err)
    }
  }

  useEffect(() => {
    let isMounted = true

    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!isMounted) return
      setSession(session)
      setUser(session?.user ?? null)
      if (session?.user?.email && KNOWN_ADMINS.includes(session.user.email.toLowerCase())) {
        setIsAdmin(true)
      }
      setLoading(false)
      if (session?.access_token) {
        fetchUsage(session.access_token)
      }
    })

    // 2. Subscribe to auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      if (!isMounted) return
      setSession(currentSession)
      setUser(currentSession?.user ?? null)
      if (currentSession?.user?.email && KNOWN_ADMINS.includes(currentSession.user.email.toLowerCase())) {
        setIsAdmin(true)
      } else if (!currentSession) {
        setIsAdmin(false)
      }
      setLoading(false)
      if (currentSession?.access_token) {
        fetchUsage(currentSession.access_token)
      } else {
        setTodayUsage(0)
        setTotalPlays(0)
        setIsVip(false)
        setDailyLimit(10)
        setIsAdmin(false)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    const res = await supabase.auth.signInWithPassword({ email, password })
    if (!res.error && res.data.session) {
      try {
        await supabase.auth.signOut({ scope: 'others' })
      } catch (err) {
        console.warn('[AuthContext] Failed to terminate remote sessions:', err)
      }
    }
    return res
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setIsAdmin(false)
    setTodayUsage(0)
    setTotalPlays(0)
    setIsVip(false)
    setDailyLimit(10)
  }

  const refreshUsage = async () => {
    if (session?.access_token) {
      await fetchUsage(session.access_token)
    }
  }

  const syncPlaySession = (data: { todayUsage?: number; totalPlays?: number; remainingPlays?: number }) => {
    if (typeof data.todayUsage === 'number') {
      setTodayUsage(data.todayUsage)
    }
    if (typeof data.totalPlays === 'number') {
      setTotalPlays(data.totalPlays)
    }
  }

  const accessToken = session?.access_token ?? null

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      accessToken,
      todayUsage,
      totalPlays,
      isVip,
      dailyLimit,
      signIn,
      signUp,
      signOut,
      refreshUsage,
      refreshQuota: refreshUsage,
      refreshUser: refreshUsage,
      syncPlaySession,
    }),
    [user, session, loading, isAdmin, accessToken, todayUsage, totalPlays, isVip, dailyLimit]
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextType {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
