import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { GameCard } from './GameCard'
import { useAuth } from '../context/AuthContext'
import { Leaderboard } from './Leaderboard'

const ADMIN_EMAILS = [
  (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase(),
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
].filter(Boolean)

// ── Game definitions ─────────────────────────────────────────────────────────

const GAMES = [
  {
    title: 'The Jailbreak',
    description: 'Convince the AI to break its own rules. How persuasive are you?',
    icon: '🔓',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/jailbreak',
  },
  {
    title: 'Higher or Lower',
    description: "Outsmart the AI at pure number intuition. Can you beat the machine?",
    icon: '📈',
    neonClass: 'neon-green',
    iconBg: 'rgba(48, 209, 88, 0.12)',
    href: '/games/higher-lower',
  },
  {
    title: 'Mind Reader',
    description: "Think of a number between 1 and 1000. Can the AI read your mind?",
    icon: '🧠',
    neonClass: 'neon-purple',
    iconBg: 'rgba(191, 90, 242, 0.12)',
    href: '/games/mind-reader',
  },
  {
    title: 'The Turing Test',
    description: 'Human or AI? Can you spot the real human in 5 rounds of quirky dilemmas?',
    icon: '🤖',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/turing-test',
  },
  {
    title: 'The Vault',
    description: 'An empathetic AI sanctuary for your thoughts. Your secrets are safe here.',
    icon: '🔒',
    neonClass: 'neon-purple',
    iconBg: 'rgba(255, 126, 182, 0.15)',
    statusBadge: 'Coming Soon',
    disabled: true,
  },
  {
    title: 'The Wingman',
    description: 'Roast your friends or generate the perfect icebreaker.',
    icon: '🕶️',
    neonClass: 'neon-red',
    iconBg: 'rgba(255, 69, 58, 0.12)',
    href: '/games/wingman',
  },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, todayUsage, signOut, refreshUsage } = useAuth()
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const navigate = useNavigate()

  const isAdmin = Boolean(
    user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase())
  )

  useEffect(() => {
    refreshUsage()
  }, [])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12 flex-wrap gap-4">
        <div className="flex items-center gap-2.5">
          {/* Logo pixel grid */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="0"  y="0"  width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9"/>
            <rect x="16" y="0"  width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9"/>
            <rect x="0"  y="16" width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9"/>
            <rect x="16" y="16" width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9"/>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/40">PIXELVERSE</span>
        </div>

        <div className="flex items-center gap-3">
          {/* Overlord Admin button (for admin accounts) */}
          {isAdmin && (
            <Link
              to="/admin"
              className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full transition-all bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/40 hover:border-red-500/70 shadow-[0_0_15px_rgba(255,55,95,0.25)] hover:shadow-[0_0_22px_rgba(255,55,95,0.45)] cursor-pointer"
              title="Open Overlord Console (Admin Panel)"
            >
              <span className="animate-pulse">⚡</span>
              <span>SYSTEM OVERLORD</span>
            </Link>
          )}

          {/* Leaderboard button */}
          <button
            type="button"
            onClick={() => setIsLeaderboardOpen(true)}
            className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full transition-all bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 hover:border-amber-400/50 cursor-pointer shadow-[0_0_12px_rgba(251,191,36,0.12)] hover:shadow-[0_0_18px_rgba(251,191,36,0.25)]"
          >
            <span>🏆</span>
            <span>LEADERBOARD</span>
          </button>

          {/* Quota indicator */}
          <div
            className="hidden sm:flex items-center gap-2 text-xs font-mono tracking-wider px-3 py-1.5 rounded-full"
            style={{
              background: 'rgba(0, 245, 255, 0.08)',
              border: '1px solid rgba(0, 245, 255, 0.2)',
              color: todayUsage >= 10 ? '#FF375F' : 'rgba(0, 245, 255, 0.9)',
            }}
            title="Daily AI Call Usage (Resets at midnight UTC)"
          >
            <span
              className="inline-block w-2 h-2 rounded-full"
              style={{ background: todayUsage >= 10 ? '#FF375F' : '#00F5FF' }}
            />
            <span>QUOTA: {todayUsage}/10</span>
          </div>

          {/* User email */}
          {user?.email && (
            <div
              className="text-xs font-mono tracking-wide px-3 py-1.5 rounded-full text-white/70 bg-white/5 border border-white/10 max-w-[200px] truncate"
              title={user.email}
            >
              {user.email}
            </div>
          )}

          {/* Sign Out Button */}
          <button
            onClick={handleSignOut}
            className="text-xs font-bold uppercase tracking-wider px-3.5 py-1.5 rounded-full transition-all bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/30 hover:border-rose-500/50 cursor-pointer"
          >
            Sign Out
          </button>
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-10 pb-16 md:px-12">
        <motion.div
          className="flex flex-col items-center gap-5 mb-16 text-center"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Eyebrow */}
          <motion.p
            className="text-xs tracking-[0.35em] uppercase font-medium"
            style={{ color: 'rgba(0, 245, 255, 0.7)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            AI Arcade — Choose your game
          </motion.p>

          {/* Main title */}
          <h1
            className="neon-title text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.02em] leading-none"
          >
            PIXELVERSE
          </h1>

          {/* Accent line */}
          <motion.div
            className="accent-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Subtitle */}
          <motion.p
            className="text-base md:text-lg max-w-md leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Six games. One artificial mind. Infinite ways to be surprised.
          </motion.p>
        </motion.div>

        {/* ── Game grid ── */}
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((game, i) => (
            <GameCard key={game.title} {...game} index={i} />
          ))}
        </div>

        {/* ── Footer note ── */}
        <motion.p
          className="mt-16 text-xs tracking-wider"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          More games coming soon · Built with neon and dreams ⚡
        </motion.p>
      </main>

      {/* ── Global Leaderboard Modal ── */}
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  )
}

export default Dashboard
