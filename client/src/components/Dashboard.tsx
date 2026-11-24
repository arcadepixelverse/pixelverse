import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useNavigate, Link } from 'react-router-dom'
import { GameCard } from './GameCard'
import { OrbConfirmModal } from './OrbConfirmModal'
import { useAuth } from '../context/AuthContext'
import { Leaderboard } from './Leaderboard'
import { SfxToggle } from './SfxToggle'
import { apiFetch } from '../lib/apiClient'
import { playClick, playError } from '../lib/soundEngine'

const ADMIN_EMAILS = [
  (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase(),
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
].filter(Boolean)

// ── Game definitions ─────────────────────────────────────────────────────────

interface GameDef {
  id: string
  title: string
  description: string
  icon: string
  neonClass: string
  iconBg: string
  href?: string
  statusBadge?: string
  disabled?: boolean
  genre?: string
  difficulty?: string
  hotkey?: number
  orbCost?: 'ORB' | 'ARCADE'
}

const GAMES: GameDef[] = [
  {
    id: 'jailbreak',
    title: 'The Jailbreak',
    description: 'Convince the AI to break its own rules. How persuasive are you?',
    icon: '🔓',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/jailbreak',
    genre: 'Social',
    difficulty: 'Medium',
    hotkey: 1,
    orbCost: 'ORB',
  },
  {
    id: 'higher_lower',
    title: 'Higher or Lower',
    description: "Outsmart the AI at pure number intuition. Can you beat the machine?",
    icon: '📈',
    neonClass: 'neon-green',
    iconBg: 'rgba(48, 209, 88, 0.12)',
    href: '/games/higher-lower',
    genre: 'Intuition',
    difficulty: 'Easy',
    hotkey: 2,
    orbCost: 'ORB',
  },
  {
    id: 'mind_reader',
    title: 'Mind Reader',
    description: "Think of a number between 1 and 1000. Can the AI read your mind?",
    icon: '🧠',
    neonClass: 'neon-purple',
    iconBg: 'rgba(191, 90, 242, 0.12)',
    href: '/games/mind-reader',
    genre: 'Logic',
    difficulty: 'Medium',
    hotkey: 3,
    orbCost: 'ORB',
  },
  {
    id: 'turing_test',
    title: 'The Turing Test',
    description: 'Human or AI? Can you spot the real human in 5 rounds of quirky dilemmas?',
    icon: '🤖',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/turing-test',
    genre: 'Deduction',
    difficulty: 'Hard',
    hotkey: 4,
    orbCost: 'ORB',
  },
  {
    id: 'survival',
    title: 'Survival Protocol',
    description: 'Bizarre life-or-death scenarios. Use environmental clues and items to survive.',
    icon: '⚡',
    neonClass: 'neon-red',
    iconBg: 'rgba(255, 69, 58, 0.12)',
    href: '/games/survival',
    genre: 'Survival',
    difficulty: 'Adaptive',
    hotkey: 5,
    orbCost: 'ORB',
  },
  {
    id: 'vault',
    title: 'The Vault',
    description: 'An empathetic AI sanctuary for your thoughts. Your secrets are safe here.',
    icon: '🔒',
    neonClass: 'neon-purple',
    iconBg: 'rgba(255, 126, 182, 0.15)',
    href: '/games/vault',
    genre: 'Sanctuary',
    difficulty: 'Chill',
    orbCost: 'ARCADE',
  },
  {
    id: 'wingman',
    title: 'The Wingman',
    description: 'Roast your friends or generate the perfect icebreaker.',
    icon: '🕶️',
    neonClass: 'neon-red',
    iconBg: 'rgba(255, 69, 58, 0.12)',
    href: '/games/wingman',
    genre: 'Social',
    difficulty: 'Casual',
    hotkey: 6,
    orbCost: 'ORB',
  },
  {
    id: 'cyber_sprint',
    title: 'Cyber Sprint',
    description: 'Type fast. Survive the grid.',
    icon: '⚡',
    neonClass: 'neon-green',
    iconBg: 'rgba(48, 209, 88, 0.12)',
    href: '/games/cyber-sprint',
    genre: 'Reflex',
    difficulty: 'Fast',
    hotkey: 7,
    orbCost: 'ARCADE',
  },
  {
    id: 'signal_sync',
    title: 'Signal Sync',
    description: 'Lock into the neural frequency. Hit the resonance zone.',
    icon: '〰️',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/signal-sync',
    genre: 'Rhythm',
    difficulty: 'Medium',
    hotkey: 8,
    orbCost: 'ARCADE',
  },
  {
    id: 'overclock',
    title: 'Overclock',
    description: 'Push CPU clock speeds to the limit. Bank points before meltdown.',
    icon: '🔥',
    neonClass: 'neon-red',
    iconBg: 'rgba(255, 69, 58, 0.12)',
    href: '/games/overclock',
    genre: 'Reflex',
    difficulty: 'Brutal',
    hotkey: 9,
    orbCost: 'ARCADE',
  },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  const { user, usedOrbs, remainingOrbs, signOut, refreshUsage, isVip, isOwner, dailyLimit, username, setUsername } = useAuth()
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false)
  const [gameStatus, setGameStatus] = useState<Record<string, boolean>>({})
  const [pendingOrbGame, setPendingOrbGame] = useState<GameDef | null>(null)
  const [showVipInfo, setShowVipInfo] = useState(false)
  const [isEditingUsername, setIsEditingUsername] = useState(false)
  const [newUsername, setNewUsername] = useState('')
  const [usernameError, setUsernameError] = useState<string | null>(null)
  const [isSavingUsername, setIsSavingUsername] = useState(false)
  const [goldTheme, setGoldTheme] = useState<boolean>(() => {
    try { return localStorage.getItem('pv_gold_theme') === '1' } catch { return false }
  })
  const navigate = useNavigate()

  const isAdmin = Boolean(
    isOwner || (user?.email && ADMIN_EMAILS.includes(user.email.toLowerCase()))
  )

  useEffect(() => {
    refreshUsage()
    apiFetch('/api/status')
      .then((r) => r.json())
      .then((data) => {
        if (data?.gameStatus) {
          setGameStatus(data.gameStatus)
        }
      })
      .catch((err) => console.warn('Could not fetch live game status:', err))
  }, [])

  // Remaining ORBS for the day (used by the energy bar + hotkeys)
  const remaining = isOwner
    ? 999999
    : (typeof remainingOrbs === 'number' ? remainingOrbs : Math.max(0, dailyLimit - (usedOrbs ?? 0)))
  const quotaColor = isOwner
    ? '#F5C518'
    : (isVip && goldTheme ? '#F5C518' : remaining === 0 ? '#FF375F' : remaining <= 3 ? '#FFD60A' : (isVip ? '#F5C518' : '#00F5FF'))

  const launchGame = (game: GameDef) => {
    const isOffline = gameStatus[game.id] === false
    if (!game.href || game.disabled || isOffline) {
      playError()
      return
    }

    // Supreme Owner gets 1-click instant launch (bypasses typing confirmation)
    if (isOwner) {
      playClick()
      navigate(game.href)
      return
    }

    if (game.orbCost === 'ORB') {
      playClick()
      setPendingOrbGame(game)
      return
    }
    playClick()
    navigate(game.href)
  }

  const handleSaveUsername = async (e?: React.FormEvent) => {
    e?.preventDefault()
    const clean = newUsername.trim()
    if (!clean) {
      setUsernameError('Handle cannot be empty')
      return
    }
    if (!/^[a-zA-Z0-9_]{3,18}$/.test(clean)) {
      setUsernameError('3-18 characters (letters, numbers, underscores only)')
      return
    }

    setIsSavingUsername(true)
    setUsernameError(null)
    try {
      const res = await apiFetch('/api/auth/username', {
        method: 'POST',
        body: JSON.stringify({ username: clean }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data?.message || 'Handle is already taken. Try another.')
      }
      setUsername(clean)
      setIsEditingUsername(false)
      playClick()
    } catch (err: any) {
      setUsernameError(err.message || 'Failed to save handle')
      playError()
    } finally {
      setIsSavingUsername(false)
    }
  }

  // Power-user hotkeys — press 1–9 to launch the matching unlocked cabinet
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return
      const target = e.target as HTMLElement | null
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return
      }
      const num = Number(e.key)
      if (!Number.isInteger(num) || num < 1 || num > 9) return
      const game = GAMES.find((g) => g.hotkey === num)
      if (!game) return
      e.preventDefault()
      launchGame(game)
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameStatus])

  const handleSignOut = async () => {
    await signOut()
    navigate('/login')
  }

  return (
    <div className={`relative z-10 min-h-screen flex flex-col ${isVip && goldTheme ? 'pv-gold-theme' : ''}`}>
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-4 py-5 sm:px-6 md:px-12 flex-wrap gap-3 sm:gap-4">
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

        <div className="flex flex-wrap items-center justify-end gap-2 sm:gap-3">
          {/* Supreme Owner Flex Header Badge */}
          {isOwner && (
            <div
              className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider px-3.5 py-1.5 rounded-full border border-amber-400/70 bg-gradient-to-r from-red-600/30 via-amber-500/25 to-yellow-500/20 text-amber-300 shadow-[0_0_20px_rgba(245,197,24,0.45)] select-none"
              title="Supreme Platform Owner - Infinite Powers"
            >
              <span className="text-sm">👑</span>
              <span>SUPREME OWNER • ∞ ORBS</span>
            </div>
          )}

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

          {/* Custom Username Pill */}
          <button
            type="button"
            onClick={() => {
              setNewUsername(username || '')
              setUsernameError(null)
              setIsEditingUsername(true)
            }}
            className="flex items-center gap-1.5 text-xs font-mono font-bold tracking-wider px-3 py-1.5 rounded-full bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 hover:border-cyan-500/70 transition cursor-pointer shadow-[0_0_12px_rgba(0,245,255,0.15)]"
            title="Set custom arcade handle (shown on leaderboard)"
          >
            <span>👾</span>
            <span>{username ? `@${username}` : '@SET_USERNAME'}</span>
            <span className="text-[10px] text-cyan-400/70">✎</span>
          </button>

          {/* Tier badge — FREE with VIP perks popover, or VIP gold (hidden if Supreme Owner) */}
          {!isOwner && (
            isVip ? (
              <div className="relative flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const next = !goldTheme
                    setGoldTheme(next)
                    try { localStorage.setItem('pv_gold_theme', next ? '1' : '0') } catch {}
                  }}
                  title="Toggle Gold Overdrive theme"
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider px-3 py-1.5 rounded-full border border-amber-400/50 bg-gradient-to-r from-amber-400/20 to-yellow-500/10 text-amber-300 shadow-[0_0_14px_rgba(245,197,24,0.3)] hover:shadow-[0_0_22px_rgba(245,197,24,0.5)] transition cursor-pointer"
                >
                  <span>★</span>
                  <span>VIP ACCESS • {dailyLimit} ORBS/DAY</span>
                  <span className="text-amber-400/70">{goldTheme ? '◉' : '○'}</span>
                </button>
              </div>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowVipInfo((v) => !v)}
                  className="flex items-center gap-1.5 text-[10px] font-mono font-bold tracking-wider px-3 py-1.5 rounded-full border border-white/15 bg-white/[0.04] text-white/60 hover:text-white/90 hover:border-white/30 transition cursor-pointer"
                >
                  <span>FREE TIER • {dailyLimit} ORBS/DAY</span>
                  <span className="text-white/30">?</span>
                </button>
                {showVipInfo && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowVipInfo(false)} />
                    <div className="absolute right-0 top-full mt-2 z-50 w-64 rounded-xl border border-amber-400/25 bg-[#0a0e14]/95 p-4 shadow-[0_0_30px_rgba(245,197,24,0.15)]">
                      <p className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-amber-300 mb-2">★ VIP PERKS</p>
                      <ul className="text-[11px] font-mono text-white/60 space-y-1.5">
                        <li>▸ 25 Orbs/Day daily quota</li>
                        <li>▸ Gold Leaderboard Crown</li>
                        <li>▸ VIP Instant Launch (no typing)</li>
                        <li>▸ Gold Overdrive Theme</li>
                      </ul>
                      <p className="mt-3 text-[9px] font-mono text-white/30 leading-relaxed">
                        VIP is granted exclusively by the Platform Owner.
                      </p>
                    </div>
                  </>
                )}
              </div>
            )
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

          {/* Daily Quota Energy Bar */}
          {isOwner ? (
            <div
              className="hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider px-3.5 py-1.5 rounded-full border border-amber-400/60 bg-amber-400/10 text-amber-300 shadow-[0_0_16px_rgba(245,197,24,0.35)]"
              title="Supreme Owner: Unlimited Daily Orbs"
            >
              <span>👑 ENERGY:</span>
              <span className="font-black tracking-widest text-amber-300">∞ UNLIMITED</span>
            </div>
          ) : (
            <div
              className="hidden sm:flex items-center gap-2 text-[10px] font-mono tracking-wider px-3 py-1.5 rounded-full"
              style={{
                background: 'rgba(0, 245, 255, 0.07)',
                border: `1px solid ${quotaColor}55`,
              }}
              title={`${isVip ? 'VIP' : 'FREE'} tier — ${remaining} of ${dailyLimit} orbs left (resets at 00:00 UTC)`}
            >
              <span className="uppercase text-white/40">{isVip ? '★ ORBS' : 'ORBS'}</span>
              <span className="flex items-center gap-[3px]" aria-hidden="true">
                {Array.from({ length: dailyLimit }).map((_, i) => {
                  const lit = i < remaining
                  return (
                    <span
                      key={i}
                      className="w-1.5 h-3 rounded-[2px] transition-colors"
                      style={{
                        background: lit ? quotaColor : 'rgba(255,255,255,0.08)',
                        boxShadow: lit ? `0 0 6px ${quotaColor}` : 'none',
                      }}
                    />
                  )
                })}
              </span>
              <span style={{ color: quotaColor }}>{remaining} / {dailyLimit} ORBS LEFT</span>
            </div>
          )}

          {/* Sound effects toggle */}
          <SfxToggle />

          {/* User email */}
          {user?.email && (
            <div
              className="text-xs font-mono tracking-wide px-3 py-1.5 rounded-full text-white/70 bg-white/5 border border-white/10 min-w-0 max-w-[130px] sm:max-w-[200px] truncate"
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
      <main className="flex-1 flex flex-col items-center px-4 pt-10 pb-16 sm:px-6 md:px-12">
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
            className="neon-title text-5xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.02em] leading-none"
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
            Ten arcade protocols. Zero latency. Infinite ways to test your speed.
          </motion.p>
        </motion.div>

        {/* ── Game grid ── */}
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {GAMES.map((game, i) => {
            const isOffline = gameStatus[game.id] === false
            return (
              <GameCard
                key={game.id}
                {...game}
                index={i}
                disabled={game.disabled || isOffline}
                statusBadge={game.disabled ? 'Coming Soon' : isOffline ? 'OFFLINE' : undefined}
                costBadge={game.orbCost === 'ORB' ? '1 ORB' : 'UNLIMITED // FREE PLAY'}
                onLaunch={game.orbCost === 'ORB' ? () => setPendingOrbGame(game) : undefined}
              />
            )
          })}
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

      {/* ── Orb spend confirmation gate (API-powered games) ── */}
      {pendingOrbGame && (
        <OrbConfirmModal
          gameTitle={pendingOrbGame.title}
          gameIcon={pendingOrbGame.icon}
          isVip={isVip}
          remainingOrbs={remaining}
          dailyLimit={dailyLimit}
          onClose={() => setPendingOrbGame(null)}
          onConfirm={() => {
            const g = pendingOrbGame
            setPendingOrbGame(null)
            navigate(g.href!)
          }}
        />
      )}

      {/* ── Custom Username Modal ── */}
      {isEditingUsername && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
          <div className="w-full max-w-sm rounded-2xl border border-cyan-500/40 bg-zinc-950 p-6 shadow-[0_0_50px_rgba(0,245,255,0.2)] font-mono text-white">
            <div className="flex items-center justify-between mb-4 pb-2 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <span className="text-lg">👾</span>
                <h3 className="text-sm font-black uppercase tracking-wider text-cyan-400">
                  ARCADE HANDLE // ID
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsEditingUsername(false)}
                className="text-zinc-500 hover:text-white text-xs cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-zinc-400 mb-4 leading-relaxed">
              Your custom handle is displayed on public Leaderboards instead of your email.
            </p>

            <form onSubmit={handleSaveUsername} className="space-y-4">
              <div>
                <label className="block text-[10px] text-zinc-500 uppercase tracking-widest font-bold mb-1">
                  HANDLE (3–18 CHARS, ALPHANUMERIC)
                </label>
                <div className="flex items-center rounded-xl bg-zinc-900 border border-zinc-700 focus-within:border-cyan-400 px-3 py-2 text-sm">
                  <span className="text-cyan-400 font-bold mr-1">@</span>
                  <input
                    type="text"
                    value={newUsername}
                    onChange={(e) => setNewUsername(e.target.value)}
                    placeholder="pixel_pilot"
                    maxLength={18}
                    autoFocus
                    className="w-full bg-transparent focus:outline-none text-white font-mono placeholder-zinc-600"
                  />
                </div>
                {usernameError && (
                  <p className="mt-1 text-xs text-rose-400">{usernameError}</p>
                )}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsEditingUsername(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-zinc-400 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingUsername}
                  className="px-5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-black text-xs font-black uppercase tracking-wider transition cursor-pointer disabled:opacity-50 shadow-[0_0_15px_rgba(0,245,255,0.3)]"
                >
                  {isSavingUsername ? 'SAVING...' : '[ SAVE HANDLE ]'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Global Leaderboard Modal ── */}
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  )
}

export default Dashboard
