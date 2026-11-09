import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { apiFetch } from '../lib/apiClient'

type GameTab = 'higher_lower' | 'turing_test'

interface LeaderboardEntry {
  rank: number
  email_prefix: string
  score: number
}

interface LeaderboardProps {
  isOpen: boolean
  onClose: () => void
}

const TABS: { id: GameTab; label: string; icon: string; color: string; borderColor: string }[] = [
  {
    id: 'higher_lower',
    label: 'Higher / Lower',
    icon: '📈',
    color: 'rgba(48, 209, 88, 0.9)',
    borderColor: 'rgba(48, 209, 88, 0.4)',
  },
  {
    id: 'turing_test',
    label: 'Turing Test',
    icon: '🤖',
    color: 'rgba(0, 245, 255, 0.9)',
    borderColor: 'rgba(0, 245, 255, 0.4)',
  },
]

const RANK_BADGES: Record<number, { icon: string; color: string }> = {
  1: { icon: '🥇', color: '#FFD700' },
  2: { icon: '🥈', color: '#C0C0C0' },
  3: { icon: '🥉', color: '#CD7F32' },
}

export function Leaderboard({ isOpen, onClose }: LeaderboardProps) {
  const [activeTab, setActiveTab] = useState<GameTab>('higher_lower')
  const [entries, setEntries] = useState<Record<GameTab, LeaderboardEntry[] | null>>({
    higher_lower: null,
    turing_test: null,
  })
  const [loading, setLoading] = useState<Record<GameTab, boolean>>({
    higher_lower: false,
    turing_test: false,
  })
  const [isCached, setIsCached] = useState<Record<GameTab, boolean>>({
    higher_lower: false,
    turing_test: false,
  })
  const [error, setError] = useState<Record<GameTab, string | null>>({
    higher_lower: null,
    turing_test: null,
  })

  const fetchLeaderboard = useCallback(
    async (gameId: GameTab) => {
      if (entries[gameId] !== null) return // already fetched
      setLoading((prev) => ({ ...prev, [gameId]: true }))
      setError((prev) => ({ ...prev, [gameId]: null }))
      try {
        const res = await apiFetch(`http://localhost:10000/api/leaderboard/${gameId}`)
        if (!res.ok) throw new Error(`Server returned ${res.status}`)
        const data = await res.json()
        setEntries((prev) => ({ ...prev, [gameId]: data.entries || [] }))
        setIsCached((prev) => ({ ...prev, [gameId]: !!data.cached }))
      } catch (err: any) {
        setError((prev) => ({ ...prev, [gameId]: 'Failed to load leaderboard.' }))
      } finally {
        setLoading((prev) => ({ ...prev, [gameId]: false }))
      }
    },
    [entries]
  )

  // Fetch the active tab when modal opens
  useEffect(() => {
    if (isOpen) {
      fetchLeaderboard(activeTab)
    }
  }, [isOpen, activeTab, fetchLeaderboard])

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [isOpen, onClose])

  const currentTab = TABS.find((t) => t.id === activeTab)!
  const currentEntries = entries[activeTab]
  const isLoading = loading[activeTab]
  const currentError = error[activeTab]
  const cached = isCached[activeTab]

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Panel */}
          <motion.div
            className="fixed inset-y-0 right-0 z-50 w-full max-w-sm flex flex-col"
            style={{
              background: 'rgba(10, 10, 20, 0.92)',
              borderLeft: '1px solid rgba(255,255,255,0.08)',
              backdropFilter: 'blur(24px)',
            }}
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 220 }}
          >
            {/* Header */}
            <div
              className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">🏆</span>
                <div>
                  <h2 className="text-sm font-black uppercase tracking-[0.2em] text-white">
                    Leaderboard
                  </h2>
                  <p className="text-[10px] uppercase tracking-wider text-white/40 font-mono">
                    Global Top 10
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="w-8 h-8 flex items-center justify-center rounded-lg text-white/50 hover:text-white hover:bg-white/10 transition-all cursor-pointer text-lg"
              >
                ×
              </button>
            </div>

            {/* Tabs */}
            <div
              className="flex border-b"
              style={{ borderColor: 'rgba(255,255,255,0.07)' }}
            >
              {TABS.map((tab) => {
                const isActive = tab.id === activeTab
                return (
                  <button
                    key={tab.id}
                    onClick={() => {
                      setActiveTab(tab.id)
                    }}
                    className="flex-1 py-3 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer relative"
                    style={{
                      color: isActive ? tab.color : 'rgba(255,255,255,0.35)',
                      background: isActive ? 'rgba(255,255,255,0.03)' : 'transparent',
                    }}
                  >
                    <span className="mr-1.5">{tab.icon}</span>
                    {tab.label}
                    {isActive && (
                      <motion.div
                        className="absolute bottom-0 left-0 right-0 h-[2px]"
                        style={{ background: tab.color }}
                        layoutId="tab-indicator"
                      />
                    )}
                  </button>
                )
              })}
            </div>

            {/* Cache badge */}
            {currentEntries !== null && (
              <div className="px-5 pt-3 pb-0 flex items-center gap-1.5">
                <span
                  className="inline-block w-1.5 h-1.5 rounded-full"
                  style={{ background: cached ? '#FF9F0A' : '#30D158' }}
                />
                <span className="text-[10px] font-mono uppercase tracking-wider text-white/30">
                  {cached ? 'Cached · refreshes in ~5m' : 'Live'}
                </span>
              </div>
            )}

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-4 py-4">
              <AnimatePresence mode="wait">
                {isLoading && (
                  <motion.div
                    key="loading"
                    className="flex flex-col items-center justify-center gap-3 py-16 text-white/40"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                  >
                    <div
                      className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
                      style={{ borderColor: `${currentTab.color} transparent transparent transparent` }}
                    />
                    <p className="text-xs uppercase tracking-wider font-mono">Loading...</p>
                  </motion.div>
                )}

                {currentError && !isLoading && (
                  <motion.div
                    key="error"
                    className="mt-6 p-4 rounded-xl text-xs font-mono text-rose-300 bg-rose-500/10 border border-rose-500/20 text-center"
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    ⚠️ {currentError}
                  </motion.div>
                )}

                {!isLoading && !currentError && currentEntries !== null && (
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="space-y-2"
                  >
                    {currentEntries.length === 0 ? (
                      <div className="py-16 text-center">
                        <p className="text-3xl mb-3">🎮</p>
                        <p className="text-sm text-white/40 font-mono uppercase tracking-wider">
                          No scores yet.
                        </p>
                        <p className="text-xs text-white/25 font-mono mt-1">
                          Be the first on the board!
                        </p>
                      </div>
                    ) : (
                      currentEntries.map((entry, idx) => {
                        const badge = RANK_BADGES[entry.rank]
                        const isTopThree = entry.rank <= 3
                        return (
                          <motion.div
                            key={entry.rank}
                            className="flex items-center gap-3 px-4 py-3 rounded-xl border"
                            style={{
                              background: isTopThree
                                ? `rgba(${entry.rank === 1 ? '255,215,0' : entry.rank === 2 ? '192,192,192' : '205,127,50'}, 0.04)`
                                : 'rgba(255,255,255,0.02)',
                              borderColor: isTopThree
                                ? `rgba(${entry.rank === 1 ? '255,215,0' : entry.rank === 2 ? '192,192,192' : '205,127,50'}, 0.15)`
                                : 'rgba(255,255,255,0.05)',
                            }}
                            initial={{ opacity: 0, x: 12 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: idx * 0.04 }}
                          >
                            {/* Rank */}
                            <div className="w-8 text-center flex-shrink-0">
                              {badge ? (
                                <span className="text-lg">{badge.icon}</span>
                              ) : (
                                <span className="text-xs font-mono font-bold text-white/30">
                                  #{entry.rank}
                                </span>
                              )}
                            </div>

                            {/* Email prefix */}
                            <div className="flex-1 min-w-0">
                              <p
                                className="text-sm font-bold truncate"
                                style={{ color: isTopThree ? badge?.color : 'rgba(255,255,255,0.75)' }}
                              >
                                {entry.email_prefix}
                              </p>
                            </div>

                            {/* Score */}
                            <div
                              className="text-sm font-black font-mono px-2.5 py-0.5 rounded-lg"
                              style={{
                                color: currentTab.color,
                                background: `rgba(${activeTab === 'higher_lower' ? '48,209,88' : '0,245,255'}, 0.1)`,
                              }}
                            >
                              {entry.score}
                            </div>
                          </motion.div>
                        )
                      })
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Footer */}
            <div
              className="px-5 py-3 border-t text-center"
              style={{ borderColor: 'rgba(255,255,255,0.05)' }}
            >
              <p className="text-[10px] font-mono uppercase tracking-wider text-white/20">
                Scores update on game over · Top 10 per game
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
