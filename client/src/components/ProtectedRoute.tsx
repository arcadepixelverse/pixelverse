import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { LoadingOrb } from './LoadingOrb'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center relative z-10">
        <LoadingOrb size={90} color="#00F5FF" />
        <p className="mt-6 text-xs uppercase tracking-[0.3em] text-cyan-400 font-mono animate-pulse">
          Authenticating Neural Link...
        </p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <>{children}</>
}
