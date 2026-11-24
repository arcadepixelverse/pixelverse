import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User, Session, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { apiFetch } from '../lib/apiClient'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  isAdmin: boolean
  isOwner: boolean
  username: string | null
  accessToken: string | null
  todayUsage: number
  usedOrbs: number
  remainingOrbs: number
  totalPlays: number
  isVip: boolean
  dailyLimit: number
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
  setUsername: (name: string) => void
  refreshUsage: () => Promise<void>
  refreshQuota: () => Promise<void>
  refreshUser: () => Promise<void>
  syncPlaySession: (data: {
    todayUsage?: number
    totalPlays?: number
    remainingPlays?: number
    usedOrbs?: number
    remainingOrbs?: number
    dailyLimit?: number
  }) => void
  updateQuota: (quota: Partial<{ usedOrbs: number; remainingOrbs: number; dailyLimit: number; todayUsage: number }>) => void
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
  const [isOwner, setIsOwner] = useState(false)
  const [username, setUsername] = useState<string | null>(null)
  const [todayUsage, setTodayUsage] = useState<number>(0)
  const [usedOrbs, setUsedOrbs] = useState<number>(0)
  const [remainingOrbs, setRemainingOrbs] = useState<number>(10)
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
        setUsedOrbs(0)
        setRemainingOrbs(10)
        setTotalPlays(0)
        setIsVip(false)
        setIsOwner(false)
        setUsername(null)
        setDailyLimit(10)
        return
      }
      if (res.ok) {
        const data = await res.json()
        const isOwnerAccount =
          data.isOwner === true ||
          (data.email && KNOWN_ADMINS.includes(data.email.toLowerCase()))
        const vip = isOwnerAccount || data.isVip === true
        const limit = isOwnerAccount
          ? 999999
          : (typeof data.dailyLimit === 'number' && data.dailyLimit > 0 ? data.dailyLimit : (vip ? 25 : 10))
        const used = isOwnerAccount
          ? 0
          : (typeof data.usedOrbs === 'number'
          ? data.usedOrbs
          : typeof data.daily_plays === 'number'
          ? data.daily_plays
          : (typeof data.todayUsage === 'number' ? data.todayUsage : 0))
        const remaining = isOwnerAccount
          ? 999999
          : (typeof data.remainingOrbs === 'number'
          ? data.remainingOrbs
          : Math.max(0, limit - used))

        setIsOwner(isOwnerAccount)
        setIsVip(vip)
        setDailyLimit(limit)
        setUsedOrbs(used)
        setRemainingOrbs(remaining)

        if (typeof data.username === 'string') {
          setUsername(data.username)
        } else if (data.username === null) {
          setUsername(null)
        }

        if (typeof data.todayUsage === 'number') {
          setTodayUsage(isOwnerAccount ? 0 : data.todayUsage)
        }
        if (typeof data.total_plays === 'number') {
          setTotalPlays(data.total_plays)
        }
        if (typeof data.isAdmin === 'boolean') {
          setIsAdmin(data.isAdmin || isOwnerAccount)
        } else if (data.email) {
          setIsAdmin(KNOWN_ADMINS.includes(data.email.toLowerCase()))
        }
      }
    } catch (err) {
      console.warn('[AuthContext] Failed to hydrate user quota:', err)
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
        setIsOwner(false)
        setUsername(null)
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
    setIsOwner(false)
    setUsername(null)
    setTodayUsage(0)
    setUsedOrbs(0)
    setRemainingOrbs(10)
    setTotalPlays(0)
    setIsVip(false)
    setDailyLimit(10)
  }

  const refreshUsage = async () => {
    if (session?.access_token) {
      await fetchUsage(session.access_token)
    }
  }

  const syncPlaySession = (data: {
    todayUsage?: number
    totalPlays?: number
    remainingPlays?: number
    usedOrbs?: number
    remainingOrbs?: number
    dailyLimit?: number
  }) => {
    const used = typeof data.usedOrbs === 'number'
      ? data.usedOrbs
      : (typeof data.todayUsage === 'number' ? data.todayUsage : undefined)
    const remaining = typeof data.remainingOrbs === 'number'
      ? data.remainingOrbs
      : (typeof data.remainingPlays === 'number' ? data.remainingPlays : undefined)

    if (typeof used === 'number') {
      setUsedOrbs(used)
      setTodayUsage(used)
    }
    if (typeof remaining === 'number') {
      setRemainingOrbs(remaining)
    }
    if (typeof data.totalPlays === 'number') {
      setTotalPlays(data.totalPlays)
    }
    if (typeof data.dailyLimit === 'number' && data.dailyLimit > 0) {
      setDailyLimit(data.dailyLimit)
    }
  }

  const updateQuota = (quota: Partial<{ usedOrbs: number; remainingOrbs: number; dailyLimit: number; todayUsage: number }>) => {
    if (typeof quota.usedOrbs === 'number') setUsedOrbs(quota.usedOrbs)
    if (typeof quota.remainingOrbs === 'number') setRemainingOrbs(quota.remainingOrbs)
    if (typeof quota.dailyLimit === 'number' && quota.dailyLimit > 0) setDailyLimit(quota.dailyLimit)
    if (typeof quota.todayUsage === 'number') setTodayUsage(quota.todayUsage)
  }

  const accessToken = session?.access_token ?? null

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      isAdmin,
      isOwner,
      username,
      accessToken,
      todayUsage,
      usedOrbs,
      remainingOrbs,
      totalPlays,
      isVip,
      dailyLimit,
      signIn,
      signUp,
      signOut,
      setUsername,
      refreshUsage,
      refreshQuota: refreshUsage,
      refreshUser: refreshUsage,
      syncPlaySession,
      updateQuota,
    }),
    [user, session, loading, isAdmin, isOwner, username, accessToken, todayUsage, usedOrbs, remainingOrbs, totalPlays, isVip, dailyLimit]
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
