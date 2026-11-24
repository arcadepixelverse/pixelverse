import React from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

interface AdminGuardProps {
  children: React.ReactNode
}

/**
 * Zero-Flash Security Guard for /admin
 * 1. During authentication check: renders ONLY a solid dark terminal screen (zero UI flash).
 * 2. If unauthorized or non-admin: renders an uncloseable hacker-styled 403 block screen.
 * 3. Never mounts the admin component unless clearance is explicitly verified.
 */
export function AdminGuard({ children }: AdminGuardProps) {
  const { user, isAdmin, loading } = useAuth()
  const navigate = useNavigate()

  // 1. Loading state: Pure dark terminal screen (zero admin layout rendered)
  if (loading) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black text-emerald-400 font-mono flex flex-col items-center justify-center p-6 select-none">
        <div className="flex items-center gap-3 text-sm font-black tracking-[0.3em] uppercase">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
          VERIFYING CLEARANCE...
        </div>
        <p className="mt-4 text-[11px] text-emerald-500/40 tracking-widest uppercase">
          SECURE ENCLAVE HANDSHAKE // ENCRYPTED LINK
        </p>
      </div>
    )
  }

  // 2. Unauthorized state: High-security full-screen blocker
  if (!user || !isAdmin) {
    return (
      <div className="fixed inset-0 z-[99999] bg-black/95 backdrop-blur-2xl text-white font-mono flex items-center justify-center p-6 select-none">
        <div
          style={{
            background: 'rgba(15, 5, 8, 0.98)',
            border: '2px solid rgba(255, 55, 95, 0.8)',
            boxShadow: '0 0 90px rgba(255, 55, 95, 0.4)',
          }}
          className="max-w-md w-full rounded-2xl p-8 sm:p-10 text-center relative pointer-events-auto"
        >
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl flex items-center justify-center bg-red-500/20 border-2 border-red-500/60 text-3xl shadow-[0_0_35px_rgba(255,55,95,0.6)] animate-pulse">
            🚫
          </div>

          <h2 className="text-xl sm:text-2xl font-black uppercase text-red-500 tracking-[0.2em] mb-4">
            [ 403 // ACCESS BLOCKED ]
          </h2>

          <div className="p-4 rounded-xl bg-red-950/40 border border-red-500/30 mb-8">
            <p className="text-xs sm:text-sm font-bold text-red-200 uppercase leading-relaxed tracking-wider">
              UNAUTHORIZED ACCESS DETECTED. THIS TERMINAL IS RESTRICTED TO THE PLATFORM OWNER.
            </p>
          </div>

          <button
            onClick={() => navigate('/')}
            className="w-full py-3.5 px-6 rounded-xl font-black tracking-[0.2em] uppercase text-xs text-white transition-all duration-200 cursor-pointer shadow-lg active:scale-95"
            style={{
              background: 'linear-gradient(135deg, rgba(255,55,95,0.3), rgba(255,55,95,0.7))',
              border: '1px solid rgba(255, 55, 95, 0.9)',
              boxShadow: '0 0 25px rgba(255, 55, 95, 0.4)',
            }}
          >
            RETURN TO SAFE ZONE
          </button>

          <p className="mt-6 text-[10px] text-white/30 tracking-widest uppercase">
            SECURITY EVENT LOGGED // IP RECORDED
          </p>
        </div>
      </div>
    )
  }

  // 3. Authorized admin: Mount console
  return <>{children}</>
}
