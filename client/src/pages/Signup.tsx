import React, { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { LoadingOrb } from '../components/LoadingOrb'

export function Signup() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const { signUp } = useAuth()
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setNotice(null)

    if (password.length < 6) {
      setError('Password cipher must be at least 6 characters long.')
      return
    }

    if (password !== confirmPassword) {
      setError('Password ciphers do not match.')
      return
    }

    setSubmitting(true)

    try {
      const { data, error: authError } = await signUp(email.trim(), password)
      if (authError) {
        setError(authError.message)
      } else if (data.session) {
        navigate('/', { replace: true })
      } else {
        // Confirmation email sent
        setNotice(
          'Verification transmission dispatched! Please check your email inbox to confirm your account before logging in.'
        )
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to initialize account registration.')
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
          border: '1px solid rgba(191, 90, 242, 0.3)',
          boxShadow: '0 0 40px rgba(191, 90, 242, 0.12), inset 0 0 20px rgba(191, 90, 242, 0.04)',
        }}
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.5, delay: 0.1 }}
      >
        <div className="text-center mb-8">
          <h1 className="text-2xl font-black tracking-wider text-white mb-2 uppercase">
            New Player Registration
          </h1>
          <p className="text-xs uppercase tracking-[0.2em] text-purple-400/80 font-mono">
            Provision your identity & daily quota
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

        {notice && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 rounded-lg text-xs font-mono text-emerald-300 bg-emerald-500/10 border border-emerald-500/30 leading-relaxed"
          >
            <p className="font-bold mb-1 flex items-center gap-1.5">
              <span>✉️</span> Verification Dispatched
            </p>
            <p>{notice}</p>
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
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-mono tracking-wider text-white/60 mb-2">
              Cipher Key (Min 6 Characters)
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
            />
          </div>

          <div>
            <label className="block text-xs uppercase font-mono tracking-wider text-white/60 mb-2">
              Confirm Cipher Key
            </label>
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="••••••••••••"
              className="w-full px-4 py-3 rounded-xl bg-black/40 border border-white/10 text-white placeholder-white/20 text-sm focus:outline-none focus:border-purple-400 focus:ring-1 focus:ring-purple-400 transition-all font-mono"
            />
          </div>

          <button
            type="submit"
            disabled={submitting}
            className="w-full mt-2 py-3.5 px-4 rounded-xl font-bold uppercase tracking-widest text-sm text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50"
            style={{
              background: 'linear-gradient(135deg, #BF5AF2 0%, #7928CA 100%)',
              boxShadow: '0 0 20px rgba(191, 90, 242, 0.4)',
            }}
          >
            {submitting ? (
              <>
                <LoadingOrb size={20} color="#FFFFFF" />
                <span>Creating Account...</span>
              </>
            ) : (
              <span>Create Account</span>
            )}
          </button>
        </form>

        <div className="mt-8 text-center pt-6 border-t border-white/5">
          <p className="text-xs text-white/50 font-mono">
            Already registered?{' '}
            <Link
              to="/login"
              className="text-purple-400 hover:text-purple-300 font-bold underline underline-offset-4 ml-1 transition-colors"
            >
              Sign in here
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
