import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import type { User, Session, AuthResponse } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface AuthContextType {
  user: User | null
  session: Session | null
  loading: boolean
  accessToken: string | null
  todayUsage: number
  signIn: (email: string, password: string) => Promise<AuthResponse>
  signUp: (email: string, password: string) => Promise<AuthResponse>
  signOut: () => Promise<void>
  refreshUsage: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [todayUsage, setTodayUsage] = useState<number>(0)

  const fetchUsage = async (token: string) => {
    try {
      const res = await fetch('http://localhost:10000/api/auth/me', {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      })
      if (res.status === 401) {
        await supabase.auth.signOut()
        setSession(null)
        setUser(null)
        setTodayUsage(0)
        return
      }
      if (res.ok) {
        const data = await res.json()
        if (typeof data.todayUsage === 'number') {
          setTodayUsage(data.todayUsage)
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
      setLoading(false)
      if (currentSession?.access_token) {
        fetchUsage(currentSession.access_token)
      } else {
        setTodayUsage(0)
      }
    })

    return () => {
      isMounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = async (email: string, password: string) => {
    return await supabase.auth.signInWithPassword({ email, password })
  }

  const signUp = async (email: string, password: string) => {
    return await supabase.auth.signUp({ email, password })
  }

  const signOut = async () => {
    await supabase.auth.signOut()
    setSession(null)
    setUser(null)
    setTodayUsage(0)
  }

  const refreshUsage = async () => {
    if (session?.access_token) {
      await fetchUsage(session.access_token)
    }
  }

  const accessToken = session?.access_token ?? null

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      accessToken,
      todayUsage,
      signIn,
      signUp,
      signOut,
      refreshUsage,
    }),
    [user, session, loading, accessToken, todayUsage]
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
