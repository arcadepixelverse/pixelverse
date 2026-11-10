import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../lib/apiClient'
import { LoadingOrb } from './LoadingOrb'

export interface LeaderboardEntry {
  rank: number
  email_prefix: string
  score: number
}

export type LeaderboardGame = 'higher_lower' | 'turing_test'

interface LeaderboardProps {
  isOpen: boolean
  onClose: () => void
}

const TABS: { id: LeaderboardGame; label: string; icon: string }[] = [
  { id: 'higher_lower', label: 'Higher / Lower', icon: '📈' },
  { id: 'turing_test', label: 'Turing Test', icon: '🤖' },
]

export function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<LeaderboardGame>('higher_lower')
  const [scores, setScores] = useState<LeaderboardEntry[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch only when modal is open and on activeTab change
  useEffect(() => {
    if (!isOpen) return

    let isMounted = true
    const fetchScores = async () => {
      setLoading(true)
      setError(null)
      try {
        const res = await apiFetch(`/api/leaderboard/${activeTab}`)
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`)
        }
        const data = await res.json()
        if (isMounted) {
          setScores(Array.isArray(data) ? data : [])
        }
      } catch (err: any) {
        if (isMounted) {
          console.warn('[Leaderboard] Fetch error:', err)
          setError(err?.message || 'Failed to fetch leaderboard')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchScores()

    return () => {
      isMounted = false
    }
  }, [isOpen, activeTab])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal Container */}
          <motion.div
            role="dialog"
            aria-modal="true"
            className="relative w-full max-w-lg rounded-2xl overflow-hidden border border-cyan-500/30 bg-[#0c0d14]/90 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,245,255,0.18)] z-10 flex flex-col max-h-[85vh]"
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          >
            {/* Header */}
            <div className="px-6 pt-6 pb-4 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-xl shadow-[0_0_15px_rgba(0,245,255,0.2)]">
                  🏆
                </div>
                <div>
                  <h2 className="text-lg font-black tracking-wider uppercase text-white flex items-center gap-2">
                    Global Hall of Fame
                  </h2>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[10px] font-mono tracking-widest uppercase text-white/50">
                      Cached for 5m • Realtime Upserts
                    </span>
                  </div>
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="w-8 h-8 rounded-lg bg-white/5 hover:bg-white/10 border border-white/10 text-white/60 hover:text-white flex items-center justify-center text-sm transition-all cursor-pointer"
                aria-label="Close Leaderboard"
              >
                ✕
              </button>
            </div>

            {/* Game Selector Tabs */}
            <div className="px-6 pt-4 pb-2 flex gap-2 border-b border-white/5 bg-white/[0.02]">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative flex-1 py-2.5 px-4 rounded-xl text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer ${
                      isActive
                        ? 'text-cyan-300 bg-cyan-500/15 border border-cyan-500/40 shadow-[0_0_15px_rgba(0,245,255,0.15)]'
                        : 'text-white/40 hover:text-white/70 bg-transparent border border-transparent'
                    }`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Content List */}
            <div className="p-6 overflow-y-auto flex-1 space-y-2">
              {loading ? (
                <div className="py-16 flex flex-col items-center justify-center gap-3">
                  <LoadingOrb size={48} color="#00F5FF" />
                  <p className="text-xs font-mono tracking-widest text-cyan-400/70 uppercase animate-pulse">
                    Querying Satellite Leaderboard...
                  </p>
                </div>
              ) : error ? (
                <div className="py-12 px-4 text-center">
                  <p className="text-sm text-rose-400 font-mono mb-2">⚠️ {error}</p>
                  <button
                    type="button"
                    onClick={() => setActiveTab(activeTab)}
                    className="text-xs font-mono text-cyan-400 hover:underline uppercase"
                  >
                    Retry Connection
                  </button>
                </div>
              ) : scores.length === 0 ? (
                <div className="py-16 text-center text-white/40">
                  <div className="text-3xl mb-2">🎯</div>
                  <p className="text-sm font-medium text-white/60">No scores recorded yet</p>
                  <p className="text-xs font-mono mt-1 text-white/40">
                    Play a round and claim the rank #1 position!
                  </p>
                </div>
              ) : (
                <motion.div
                  initial="hidden"
                  animate="visible"
                  variants={{
                    visible: { transition: { staggerChildren: 0.04 } },
                    hidden: {},
                  }}
                  className="space-y-2"
                >
                  {scores.map((entry) => {
                    const isTop1 = entry.rank === 1
                    const isTop2 = entry.rank === 2
                    const isTop3 = entry.rank === 3

                    const badgeColor = isTop1
                      ? 'text-amber-400 border-amber-400/40 bg-amber-400/10'
                      : isTop2
                      ? 'text-cyan-300 border-cyan-400/40 bg-cyan-400/10'
                      : isTop3
                      ? 'text-orange-400 border-orange-400/40 bg-orange-400/10'
                      : 'text-white/40 border-white/10 bg-white/5'

                    return (
                      <motion.div
                        key={`${entry.rank}-${entry.email_prefix}`}
                        variants={{
                          hidden: { opacity: 0, y: 10 },
                          visible: { opacity: 1, y: 0 },
                        }}
                        className={`flex items-center justify-between px-4 py-3 rounded-xl border transition-all ${
                          isTop1
                            ? 'bg-amber-400/[0.07] border-amber-400/30 shadow-[0_0_20px_rgba(251,191,36,0.12)]'
                            : isTop2
                            ? 'bg-cyan-400/[0.05] border-cyan-400/25'
                            : isTop3
                            ? 'bg-orange-400/[0.05] border-orange-400/25'
                            : 'bg-white/[0.02] border-white/5 hover:border-white/10'
                        }`}
                      >
                        {/* Rank + User */}
                        <div className="flex items-center gap-3">
                          <span
                            className={`w-7 h-7 rounded-lg border flex items-center justify-center font-mono font-bold text-xs ${badgeColor}`}
                          >
                            {isTop1 ? '🥇' : isTop2 ? '🥈' : isTop3 ? '🥉' : `#${entry.rank}`}
                          </span>
                          <div className="flex flex-col">
                            <span className="text-sm font-semibold tracking-wide text-white">
                              {entry.email_prefix}
                            </span>
                            <span className="text-[10px] font-mono uppercase text-white/30 tracking-wider">
                              Player
                            </span>
                          </div>
                        </div>

                        {/* Score */}
                        <div className="text-right">
                          <span
                            className={`text-base font-black font-mono tracking-tight ${
                              isTop1 ? 'text-amber-300' : 'text-cyan-400'
                            }`}
                          >
                            {entry.score}
                          </span>
                          <span className="block text-[10px] uppercase font-mono text-white/40 tracking-wider">
                            PTS
                          </span>
                        </div>
                      </motion.div>
                    )
                  })}
                </motion.div>
              )}
            </div>

            {/* Footer */}
            <div className="px-6 py-3 border-t border-white/10 bg-black/40 flex items-center justify-between text-[11px] font-mono text-white/40">
              <span>TOP 10 PILOTS</span>
              <span>IN-MEMORY MEMOIZED</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
