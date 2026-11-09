import React, { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { LoadingOrb } from '../components/LoadingOrb'

export function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { signIn } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const from = (location.state as { from?: { pathname?: string } })?.from?.pathname || '/'

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)

    try {
      const { data, error: authError } = await signIn(email.trim(), password)
      if (authError) {
        setError(authError.message)
      } else if (data.session) {
        navigate(from, { replace: true })
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to sign in. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col items-center justify-center px-4 py-12">
      {/* Brand Header */}
      <motion.div
        className="flex items-center gap-2.5 mb-8"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
          <rect x="0" y="0" width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9" />
          <rect x="16" y="0" width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9" />
          <rect x="0" y="16" width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9" />
          <rect x="16" y="16" width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9" />
        </svg>
        <span className="text-base font-bold tracking-[0.25em] uppercase text-white/70">
          PIXELVERSE
        </span>
      </motion.div>

      {/* Card */}
      <motion.div
        className="w-full max-w-md p-8 rounded-2xl relative overflow-hidden backdrop-blur-xl"
        style={{
          background: 'rgba(15, 17, 26, 0.75)',
          border: '1px solid rgba(0, 245, 255, 0.25)',
          boxShadow: '0 0 40px rgba(0, 245, 255, 0.1), inset 0 0 20px rgba(0, 245, 255, 0.04)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-wider text-white mb-2 uppercase">
            Player Access
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-cyan-400/70 font-mono">
            Enter credentials to initialize neural link
          </p>
        </div>

        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-3 rounded-lg text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/30 flex items-center gap-2"
          >
            <span>⚠️</span>
            <span>{error}</span>
          </motion.div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs uppercase font-mono tracking-wider text-white/60 mb-2">
              Email Terminal
            </label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="pilot@pixelverse.io"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-mono tracking-wider text-white/60 mb-2">
              Cipher Key (Password)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-cyan-400 focus:ring-1 focus:ring-cyan-400 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold uppercase tracking-widest text-sm text-black transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #00F5FF 0%, #00B8FF 100%)',
              boxShadow: '0 0 20px rgba(0, 245, 255, 0.4)',
            }}
          >
            {submitting ? (
              <>
                <LoadingOrb size={20} color="#000000" />
                <span>Syncing...</span>
              </>
            ) : (
              <span>Jack In</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/5">
          <p className="text-xs text-white/50 font-mono">
            Need a player registration?{' '}
            <Link
              to="/signup"
              className="text-cyan-400 hover:text-cyan-300 font-bold underline underline-offset-4 ml-1 transition-colors"
            >
              Sign up here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
