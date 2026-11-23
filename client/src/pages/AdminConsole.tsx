import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch, getApiErrorMessage } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'

interface GameStatusMap {
  [gameId: string]: boolean
}

interface AdminStats {
  totalUsers: number
  totalAiCallsToday: number
  gameStatus: GameStatusMap
}

interface AdminUser {
  id: string
  email: string
  ai_calls_count: number
  total_plays?: number
  is_banned?: boolean
  last_played_at?: string | null
  created_at?: string
  last_sign_in_at?: string
}

interface GameDefinition {
  id: string
  name: string
  codename: string
  desc: string
  category: string
}

const GAME_DEFINITIONS: GameDefinition[] = [
  {
    id: 'higher_lower',
    name: 'Higher or Lower',
    codename: 'MOD_HL_COMPARE',
    desc: 'Numerical & statistical comparison trivia module',
    category: 'TRIVIA_CORE',
  },
  {
    id: 'jailbreak',
    name: 'The Jailbreak',
    codename: 'MOD_SEC_FIREWALL',
    desc: 'Prompt injection defense & code extraction test',
    category: 'CYBER_SEC',
  },
  {
    id: 'mind_reader',
    name: 'Mind Reader',
    codename: 'MOD_NEURAL_ORACLE',
    desc: 'Binary search telepathic deduction system',
    category: 'COGNITIVE',
  },
  {
    id: 'turing_test',
    name: 'The Turing Test',
    codename: 'MOD_TURING_INTERROG',
    desc: 'Synthetic vs carbon discrimination engine',
    category: 'EVALUATION',
  },
  {
    id: 'survival',
    name: 'Survival Protocol',
    codename: 'MOD_CRISIS_SURVIVAL',
    desc: 'Emergency scenario survival judge',
    category: 'SIMULATION',
  },
  {
    id: 'wingman',
    name: 'The Wingman',
    codename: 'MOD_WINGMAN_SOCIAL',
    desc: 'Algorithmic banter & icebreaker generator',
    category: 'SOCIAL_AI',
  },
  {
    id: 'cyber_sprint',
    name: 'Cyber Sprint',
    codename: 'MOD_CYBER_SPRINT',
    desc: 'Real-time terminal velocity typing arcade',
    category: 'REACTION_CORE',
  },
  {
    id: 'signal_sync',
    name: 'Signal Sync',
    codename: 'MOD_SIGNAL_SYNC',
    desc: 'Oscilloscope harmonic resonance rhythm test',
    category: 'REACTION_CORE',
  },
  {
    id: 'overclock',
    name: 'Overclock',
    codename: 'MOD_CPU_OVERCLOCK',
    desc: 'Quantum thermal limit push & data banking',
    category: 'RISK_SYSTEM',
  },
  {
    id: 'vault',
    name: 'The Vault',
    codename: 'MOD_VAULT_RESERVE',
    desc: 'Classified sanctuary & emotional intelligence core',
    category: 'RESTRICTED',
  },
]

export function AdminConsole() {
  const { user } = useAuth()
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [loading, setLoading] = useState<boolean>(true)
  const [togglingGame, setTogglingGame] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null)
  const [accessDenied, setAccessDenied] = useState<boolean>(false)

  const showToast = (text: string, type: 'success' | 'error' = 'success') => {
    setStatusMessage({ text, type })
    setTimeout(() => {
      setStatusMessage(null)
    }, 4000)
  }

  // Load telemetry data from backend
  const loadAdminData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, usersRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
      ])

      if (statsRes.status === 403 || usersRes.status === 403) {
        setAccessDenied(true)
        setLoading(false)
        return
      }

      if (!statsRes.ok) {
        throw new Error(await getApiErrorMessage(statsRes, 'Failed to fetch admin stats'))
      }
      if (!usersRes.ok) {
        throw new Error(await getApiErrorMessage(usersRes, 'Failed to fetch admin users'))
      }

      const statsData = await statsRes.json()
      const usersData = await usersRes.json()

      setStats(statsData)
      setUsers(Array.isArray(usersData) ? usersData : [])
      setAccessDenied(false)
    } catch (err: any) {
      console.error('[AdminConsole] Fetch error:', err)
      showToast(err?.message || 'Failed to sync with Overlord server', 'error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAdminData()
  }, [loadAdminData])

  // Toggle game kill switch
  const handleToggleGame = async (gameId: string, currentStatus: boolean) => {
    if (togglingGame) return
    setTogglingGame(gameId)
    const nextStatus = !currentStatus

    // Optimistic UI update
    setStats((prev) => {
      if (!prev) return prev
      return {
        ...prev,
        gameStatus: {
          ...prev.gameStatus,
          [gameId]: nextStatus,
        },
      }
    })

    try {
      const res = await apiFetch('/api/admin/games/toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId, status: nextStatus }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, `Failed to toggle ${gameId}`))
      }

      const data = await res.json()
      if (data.gameStatus) {
        setStats((prev) => (prev ? { ...prev, gameStatus: data.gameStatus } : prev))
      }
      showToast(`Protocol [${gameId}] switched to ${nextStatus ? 'ONLINE' : 'OFFLINE'}`, 'success')
    } catch (err: any) {
      console.error('[AdminConsole] Toggle failed:', err)
      // Rollback on error
      setStats((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          gameStatus: {
            ...prev.gameStatus,
            [gameId]: currentStatus,
          },
        }
      })
      showToast(err?.message || `Failed to toggle ${gameId}`, 'error')
    } finally {
      setTogglingGame(null)
    }
  }

  // Ban User
  const handleBanUser = async (userId: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/ban`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to ban user'))
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: true } : u))
      )
      setSelectedUser((prev) => (prev?.id === userId ? { ...prev, is_banned: true } : prev))
      showToast('User has been banned and locked out.', 'success')
    } catch (err: any) {
      console.error('[AdminConsole] Ban failed:', err)
      showToast(err?.message || 'Failed to ban user', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Unban User
  const handleUnbanUser = async (userId: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/unban`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to unban user'))
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: false } : u))
      )
      setSelectedUser((prev) => (prev?.id === userId ? { ...prev, is_banned: false } : prev))
      showToast('User has been unbanned and restored.', 'success')
    } catch (err: any) {
      console.error('[AdminConsole] Unban failed:', err)
      showToast(err?.message || 'Failed to unban user', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete User
  const handleDeleteUser = async (userId: string, email: string) => {
    if (actionLoading) return
    const confirmed = window.confirm(
      `PERMANENT DELETION WARNING: Are you sure you want to completely erase user <${email}>? This action cannot be reversed.`
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
      })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to delete user'))
      }
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setSelectedUser(null)
      showToast(`User <${email}> has been purged from system.`, 'success')
    } catch (err: any) {
      console.error('[AdminConsole] Delete failed:', err)
      showToast(err?.message || 'Failed to delete user', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Grant VIP placeholder
  const handleGrantPremium = async (userId: string, email: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch('/api/admin/users/premium', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to grant VIP'))
      }

      showToast(`VIP Clearance granted to ${email}`, 'success')
    } catch (err: any) {
      console.error('[AdminConsole] Premium error:', err)
      showToast(err?.message || 'VIP upgrade failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Access Denied Screen
  if (accessDenied) {
    return (
      <div className="relative z-10 min-h-screen flex flex-col items-center justify-center p-6 text-center font-mono">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="max-w-md w-full p-8 rounded-2xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_50px_rgba(255,55,95,0.3)] text-red-400"
        >
          <div className="text-4xl mb-4">⛔</div>
          <h1 className="text-xl font-black uppercase tracking-widest text-red-400 mb-2">
            TERMINAL LOCKOUT // 403
          </h1>
          <p className="text-xs text-red-300/70 mb-6 leading-relaxed">
            CRITICAL CLEARANCE FAILURE. Logged in account &lt;{user?.email}&gt; lacks root Overlord permissions. This intrusion attempt has been recorded in the security logs.
          </p>
          <Link
            to="/"
            className="inline-block py-2.5 px-6 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-200 transition-all"
          >
            ← Return to Arcade
          </Link>
        </motion.div>
      </div>
    )
  }

  const activeGamesCount = stats?.gameStatus
    ? Object.values(stats.gameStatus).filter(Boolean).length
    : 0
  const totalGamesCount = GAME_DEFINITIONS.length

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-green-400 font-mono px-4 py-6 md:px-12 md:py-8 selection:bg-green-500/30 selection:text-green-200">
      {/* ── Top Navigation / Terminal Header ── */}
      <header className="w-full max-w-6xl mx-auto flex items-center justify-between pb-6 mb-8 border-b border-green-500/20">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-2 text-xs uppercase tracking-widest text-green-400/60 hover:text-green-300 transition-colors"
          >
            <span className="text-base transition-transform group-hover:-translate-x-1">‹</span>
            <span>ARCADE_ROOT</span>
          </Link>
          <span className="text-green-500/30">/</span>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
            <span className="text-xs font-black tracking-widest uppercase text-red-400">
              OVERLORD CONSOLE
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={loadAdminData}
            disabled={loading}
            className="px-3.5 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 transition-all cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>↻</span>
            <span>SYNC</span>
          </button>
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] px-3 py-1 rounded-lg border border-red-500/30 bg-red-500/10 text-red-300 font-bold">
            <span>ROOT_PRIVILEGES</span>
          </div>
        </div>
      </header>

      {/* ── Toast Notifications ── */}
      <AnimatePresence>
        {statusMessage && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-6 right-6 z-50 px-4 py-3 rounded-xl border text-xs font-mono shadow-2xl backdrop-blur-xl flex items-center gap-2.5 ${
              statusMessage.type === 'success'
                ? 'bg-green-950/90 border-green-500/50 text-green-300 shadow-[0_0_25px_rgba(48,209,88,0.2)]'
                : 'bg-red-950/90 border-red-500/50 text-red-300 shadow-[0_0_25px_rgba(255,55,95,0.2)]'
            }`}
          >
            <span>{statusMessage.type === 'success' ? '⚡' : '⚠️'}</span>
            <span>{statusMessage.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Main Dashboard Body ── */}
      <main className="w-full max-w-6xl mx-auto flex-1 flex flex-col gap-10">
        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 1: SYSTEM TELEMETRY (STATS)
        ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-green-400/70 font-bold flex items-center gap-2">
              <span className="text-sm">📊</span>
              <span>SECTION_01 // CORE_TELEMETRY</span>
            </h2>
            <span className="text-[10px] text-green-500/40">SYSTEM_HEALTH: NOMINAL</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {/* Stat 1: Total Users */}
            <div className="p-5 rounded-2xl border border-green-500/20 bg-black/60 backdrop-blur-xl relative overflow-hidden group hover:border-green-500/40 transition-colors">
              <div className="text-[10px] uppercase tracking-widest text-green-400/50 mb-1">
                REGISTERED_PILOTS
              </div>
              <div className="text-3xl sm:text-4xl font-black text-green-300 tracking-tight flex items-baseline gap-2">
                {loading ? <span className="animate-pulse">--</span> : stats?.totalUsers ?? 0}
                <span className="text-xs text-green-500/60 font-normal">ACCOUNTS</span>
              </div>
              <div className="text-[10px] text-green-400/40 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                <span>Supabase Auth Registry</span>
              </div>
            </div>

            {/* Stat 2: Total AI Calls Today */}
            <div className="p-5 rounded-2xl border border-cyan-500/20 bg-black/60 backdrop-blur-xl relative overflow-hidden group hover:border-cyan-500/40 transition-colors">
              <div className="text-[10px] uppercase tracking-widest text-cyan-400/50 mb-1">
                AI_INCURSIONS_TODAY
              </div>
              <div className="text-3xl sm:text-4xl font-black text-cyan-300 tracking-tight flex items-baseline gap-2">
                {loading ? <span className="animate-pulse">--</span> : stats?.totalAiCallsToday ?? 0}
                <span className="text-xs text-cyan-500/60 font-normal">CALLS</span>
              </div>
              <div className="text-[10px] text-cyan-400/40 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
                <span>Midnight UTC Reset Loop</span>
              </div>
            </div>

            {/* Stat 3: Protocol Health */}
            <div className="p-5 rounded-2xl border border-amber-500/20 bg-black/60 backdrop-blur-xl relative overflow-hidden group hover:border-amber-500/40 transition-colors">
              <div className="text-[10px] uppercase tracking-widest text-amber-400/50 mb-1">
                MODULES_ONLINE
              </div>
              <div className="text-3xl sm:text-4xl font-black text-amber-300 tracking-tight flex items-baseline gap-2">
                {loading ? <span className="animate-pulse">--</span> : `${activeGamesCount}/${totalGamesCount}`}
                <span className="text-xs text-amber-500/60 font-normal">OPERATIONAL</span>
              </div>
              <div className="text-[10px] text-amber-400/40 mt-2 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                <span>Cached In-Memory (60s TTL)</span>
              </div>
            </div>
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 2: PROTOCOL KILL SWITCHES
        ═══════════════════════════════════════════════════════════════════ */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-green-400/70 font-bold flex items-center gap-2">
              <span className="text-sm">⚡</span>
              <span>SECTION_02 // PROTOCOL_KILL_SWITCHES</span>
            </h2>
            <span className="text-[10px] text-green-500/40">DB_SOURCE: app_settings[game_status]</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {GAME_DEFINITIONS.map((game) => {
              const isEnabled = stats?.gameStatus ? stats.gameStatus[game.id] !== false : true
              const isToggling = togglingGame === game.id

              return (
                <div
                  key={game.id}
                  className={`p-5 rounded-2xl border backdrop-blur-xl transition-all relative overflow-hidden flex flex-col justify-between ${
                    isEnabled
                      ? 'border-green-500/25 bg-black/70 hover:border-green-500/45 shadow-[0_0_20px_rgba(48,209,88,0.06)]'
                      : 'border-red-500/30 bg-red-950/20 hover:border-red-500/50 shadow-[0_0_20px_rgba(255,55,95,0.08)]'
                  }`}
                >
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className="text-[10px] px-2 py-0.5 rounded bg-white/5 border border-white/10 text-white/50 tracking-wider">
                        {game.category}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded flex items-center gap-1.5 ${
                          isEnabled
                            ? 'bg-green-500/15 border border-green-500/30 text-green-300'
                            : 'bg-red-500/15 border border-red-500/30 text-red-300'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            isEnabled ? 'bg-green-400' : 'bg-red-400'
                          }`}
                        />
                        <span>{isEnabled ? 'ONLINE' : 'DISABLED'}</span>
                      </span>
                    </div>

                    <h3 className="text-base font-black text-white tracking-wide mb-1">
                      {game.name}
                    </h3>
                    <p className="text-xs text-white/40 mb-4 leading-relaxed font-sans">
                      {game.desc}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[10px] text-green-500/40">{game.codename}</span>
                    <button
                      type="button"
                      disabled={isToggling}
                      onClick={() => handleToggleGame(game.id, isEnabled)}
                      className={`relative inline-flex items-center h-7 w-14 rounded-full transition-colors cursor-pointer border ${
                        isEnabled
                          ? 'bg-green-500/20 border-green-500/60 shadow-[0_0_12px_rgba(48,209,88,0.4)]'
                          : 'bg-red-500/20 border-red-500/60 shadow-[0_0_12px_rgba(255,55,95,0.4)]'
                      } disabled:opacity-50`}
                      title={`Toggle ${game.name} ${isEnabled ? 'OFF' : 'ON'}`}
                    >
                      <motion.span
                        layout
                        transition={{ type: 'spring', stiffness: 700, damping: 30 }}
                        className={`inline-block w-5 h-5 rounded-full shadow-md ${
                          isEnabled
                            ? 'translate-x-7 bg-green-400'
                            : 'translate-x-1 bg-red-400'
                        }`}
                      />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ═══════════════════════════════════════════════════════════════════
            SECTION 3: USER MATRIX (TOP 50 PILOTS)
        ═══════════════════════════════════════════════════════════════════ */}
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs uppercase tracking-widest text-green-400/70 font-bold flex items-center gap-2">
              <span className="text-sm">👥</span>
              <span>SECTION_03 // USER_CLEARANCE_MATRIX</span>
            </h2>
            <span className="text-[10px] text-green-500/40">
              SHOWING_LATEST: {users.length} PILOTS (MAX 50)
            </span>
          </div>

          <div className="w-full rounded-2xl border border-green-500/20 bg-black/60 backdrop-blur-xl overflow-hidden shadow-2xl">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="border-b border-green-500/20 bg-green-500/[0.04] text-green-400/60 text-[11px] uppercase tracking-wider">
                    <th className="py-3 px-4">Pilot Designation</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Plays</th>
                    <th className="py-3 px-4">Today's Incursions</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-green-500/10">
                  {loading && users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-green-500/50">
                        SCANNING NEURAL REGISTRY...
                      </td>
                    </tr>
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-8 text-center text-white/40">
                        NO ACTIVE PILOTS REGISTERED IN ARCHIVE
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => {
                      const isQuotaDepleted = u.ai_calls_count >= 10
                      const isPlayDepleted = (u.total_plays ?? 0) >= 10

                      return (
                        <tr
                          key={u.id}
                          onClick={() => setSelectedUser(u)}
                          className="hover:bg-green-500/[0.08] cursor-pointer transition-colors group"
                        >
                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex flex-col">
                              <span className="text-white font-bold tracking-tight group-hover:text-green-300 transition-colors">
                                {u.email}
                              </span>
                              <span className="text-[10px] text-green-500/40 tracking-wider">
                                ID: {u.id}
                              </span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            {u.is_banned ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 uppercase tracking-wider font-bold">
                                BANNED
                              </span>
                            ) : isPlayDepleted ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/15 border border-red-500/30 text-red-300 uppercase tracking-wider">
                                PLAY LIMIT
                              </span>
                            ) : isQuotaDepleted ? (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/15 border border-amber-500/30 text-amber-300 uppercase tracking-wider">
                                AI LOCKED
                              </span>
                            ) : (
                              <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/15 border border-green-500/30 text-green-300 uppercase tracking-wider">
                                ACTIVE
                              </span>
                            )}
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-sm font-bold ${
                                  isPlayDepleted ? 'text-red-400' : 'text-amber-300'
                                }`}
                              >
                                {u.total_plays ?? 0}
                              </span>
                              <span className="text-white/30 text-[10px]">/ 10</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 font-mono">
                            <div className="flex items-center gap-1.5">
                              <span
                                className={`text-sm font-bold ${
                                  isQuotaDepleted ? 'text-red-400' : 'text-cyan-300'
                                }`}
                              >
                                {u.ai_calls_count}
                              </span>
                              <span className="text-white/30 text-[10px]">/ 10</span>
                            </div>
                          </td>

                          <td className="py-3.5 px-4 text-right">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation()
                                setSelectedUser(u)
                              }}
                              className="px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider border border-green-500/30 bg-green-500/10 hover:bg-green-500/20 text-green-300 hover:border-green-500/50 transition-all cursor-pointer shadow-[0_0_10px_rgba(48,209,88,0.1)]"
                              title="Inspect and manage user profile"
                            >
                              MANAGE ⚙
                            </button>
                          </td>
                        </tr>
                      )
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>

      {/* ── User Detail Modal ── */}
      <AnimatePresence>
        {selectedUser && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="max-w-lg w-full rounded-2xl border border-green-500/30 bg-[#0c0e14]/95 backdrop-blur-2xl p-6 text-green-300 font-mono shadow-[0_0_50px_rgba(48,209,88,0.15)] relative"
            >
              <div className="flex items-center justify-between pb-4 border-b border-green-500/20 mb-6">
                <div className="flex items-center gap-2">
                  <span className="text-lg">👤</span>
                  <h3 className="text-sm font-black uppercase tracking-wider text-white">
                    PILOT_PROFILE_INSPECTION
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedUser(null)}
                  className="w-8 h-8 rounded-full border border-white/10 hover:border-white/30 text-white/50 hover:text-white flex items-center justify-center transition cursor-pointer"
                >
                  ✕
                </button>
              </div>

              <div className="space-y-4 mb-8 text-xs">
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">Email</span>
                  <span className="font-bold text-white select-all">{selectedUser.email}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">User ID</span>
                  <span className="text-[11px] text-green-400/70 select-all font-mono">{selectedUser.id}</span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">Account Status</span>
                  {selectedUser.is_banned ? (
                    <span className="px-2 py-0.5 rounded bg-red-500/20 border border-red-500/40 text-red-400 font-bold uppercase">
                      SUSPENDED / BANNED
                    </span>
                  ) : (
                    <span className="px-2 py-0.5 rounded bg-green-500/20 border border-green-500/40 text-green-300 font-bold uppercase">
                      ACTIVE & CLEAR
                    </span>
                  )}
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">Total Plays</span>
                  <span className="font-bold text-amber-300">
                    {selectedUser.total_plays ?? 0} / 10
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">Today's AI Incursions</span>
                  <span className="font-bold text-cyan-300">
                    {selectedUser.ai_calls_count ?? 0} / 10
                  </span>
                </div>
                <div className="flex justify-between items-center py-2 border-b border-white/5">
                  <span className="text-white/40 uppercase">Last Played At</span>
                  <span className="text-white/70">
                    {selectedUser.last_played_at
                      ? new Date(selectedUser.last_played_at).toLocaleString()
                      : 'Never'}
                  </span>
                </div>
                {selectedUser.created_at && (
                  <div className="flex justify-between items-center py-2 border-b border-white/5">
                    <span className="text-white/40 uppercase">Created At</span>
                    <span className="text-white/70">
                      {new Date(selectedUser.created_at).toLocaleString()}
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="pt-2 border-t border-green-500/20 flex flex-wrap gap-2.5 justify-end">
                {selectedUser.is_banned ? (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleUnbanUser(selectedUser.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-green-500/20 hover:bg-green-500/30 text-green-300 border border-green-500/40 hover:border-green-500/70 transition cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'PROCESSING...' : '✓ UNBAN USER'}
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={actionLoading}
                    onClick={() => handleBanUser(selectedUser.id)}
                    className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/40 hover:border-red-500/70 transition cursor-pointer disabled:opacity-50"
                  >
                    {actionLoading ? 'PROCESSING...' : '⛔ BAN USER'}
                  </button>
                )}

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleGrantPremium(selectedUser.id, selectedUser.email)}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-purple-500/20 hover:bg-purple-500/30 text-purple-300 border border-purple-500/40 hover:border-purple-500/70 transition cursor-pointer disabled:opacity-50"
                >
                  ★ PROMOTE TO VIP
                </button>

                <button
                  type="button"
                  disabled={actionLoading}
                  onClick={() => handleDeleteUser(selectedUser.id, selectedUser.email)}
                  className="px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider bg-rose-950/40 hover:bg-rose-900/60 text-rose-300 border border-rose-600/40 hover:border-rose-500 transition cursor-pointer disabled:opacity-50"
                >
                  🗑 DELETE ACCOUNT
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
