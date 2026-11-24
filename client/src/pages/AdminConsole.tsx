import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { apiFetch, getApiErrorMessage } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'
import { playClick } from '../lib/soundEngine'

const OWNER_EMAILS = [
  'pritisinghmgs@gmail.com',
  'arcade.pixelverse@gmail.com',
  (import.meta.env.VITE_ADMIN_EMAIL || '').trim().toLowerCase(),
].filter(Boolean)

function isOwner(email?: string | null): boolean {
  if (!email) return false
  return OWNER_EMAILS.includes(email.trim().toLowerCase())
}

const ALL_GAMES = [
  { id: 'jailbreak', name: 'The Jailbreak', codename: 'AI_JAILBREAK', type: 'AI' },
  { id: 'higher_lower', name: 'Higher or Lower', codename: 'NUM_INTUITION', type: 'AI' },
  { id: 'mind_reader', name: 'Mind Reader', codename: 'BINARY_SEARCH', type: 'AI' },
  { id: 'turing_test', name: 'The Turing Test', codename: 'HUMAN_VS_AI', type: 'AI' },
  { id: 'survival', name: 'Survival Protocol', codename: 'SURVIVAL_SIM', type: 'AI' },
  { id: 'vault', name: 'The Vault', codename: 'AI_SANCTUARY', type: 'ARCADE' },
  { id: 'wingman', name: 'The Wingman', codename: 'WINGMAN_BOT', type: 'AI' },
  { id: 'cyber_sprint', name: 'Cyber Sprint', codename: 'TYPING_REFLEX', type: 'ARCADE' },
  { id: 'signal_sync', name: 'Signal Sync', codename: 'RHYTHM_FREQ', type: 'ARCADE' },
  { id: 'overclock', name: 'Overclock', codename: 'CPU_MELTDOWN', type: 'ARCADE' },
]

export default function AdminConsole() {
  const { user } = useAuth()
  const [stats, setStats] = useState<{
    totalUsers: number
    totalAiCallsToday: number
    totalPlaysToday: number
    maintenance_mode: boolean
    gameStatus: Record<string, boolean>
  } | null>(null)

  const [users, setUsers] = useState<any[]>([])
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [apiReport, setApiReport] = useState<any>(null)
  const [livePing, setLivePing] = useState<any[] | null>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isPinging, setIsPinging] = useState(false)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})
  const [bannerMessage, setBannerMessage] = useState<{ text: string; isError?: boolean } | null>(null)

  const showBanner = (text: string, isError = false) => {
    setBannerMessage({ text, isError })
    setTimeout(() => setBannerMessage(null), 4000)
  }

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true)
    try {
      const [statsRes, usersRes, diagRes, reportRes, logsRes] = await Promise.allSettled([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/diagnostics'),
        apiFetch('/api/admin/api-report'),
        apiFetch('/api/admin/audit-logs'),
      ])

      if (statsRes.status === 'fulfilled' && statsRes.value.ok) {
        setStats(await statsRes.value.json())
      }
      if (usersRes.status === 'fulfilled' && usersRes.value.ok) {
        setUsers(await usersRes.value.json())
      }
      if (diagRes.status === 'fulfilled' && diagRes.value.ok) {
        setDiagnostics(await diagRes.value.json())
      }
      if (reportRes.status === 'fulfilled' && reportRes.value.ok) {
        setApiReport(await reportRes.value.json())
      }
      if (logsRes.status === 'fulfilled' && logsRes.value.ok) {
        setAuditLogs(await logsRes.value.json())
      }
    } catch (err: any) {
      console.error('[AdminConsole] Error loading data:', err)
      showBanner('Failed to refresh data: ' + (err.message || 'Network error'), true)
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    loadAllData()
  }, [loadAllData])

  // ── Maintenance Toggle ──
  const toggleMaintenance = async (nextState: boolean) => {
    playClick()
    setActionLoading((prev) => ({ ...prev, maintenance: true }))
    try {
      const res = await apiFetch('/api/admin/maintenance', {
        method: 'POST',
        body: JSON.stringify({ enabled: nextState }),
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      setStats((prev) => prev ? { ...prev, maintenance_mode: nextState } : prev)
      showBanner(`Maintenance mode turned ${nextState ? 'ON' : 'OFF'}`)
      loadAllData()
    } catch (err: any) {
      showBanner(err.message || 'Failed to toggle maintenance', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, maintenance: false }))
    }
  }

  // ── Single Game Toggle ──
  const toggleGame = async (gameId: string, currentStatus: boolean) => {
    playClick()
    const nextStatus = !currentStatus
    setActionLoading((prev) => ({ ...prev, [gameId]: true }))
    try {
      const res = await apiFetch('/api/admin/games/toggle', {
        method: 'POST',
        body: JSON.stringify({ gameId, status: nextStatus }),
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      setStats((prev) => {
        if (!prev) return prev
        return {
          ...prev,
          gameStatus: { ...prev.gameStatus, [gameId]: nextStatus },
        }
      })
      showBanner(`Game [${gameId}] turned ${nextStatus ? 'ONLINE' : 'OFFLINE'}`)
    } catch (err: any) {
      showBanner(err.message || 'Failed to toggle game', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [gameId]: false }))
    }
  }

  // ── Bulk Game Toggle ──
  const bulkToggleGames = async (status: boolean) => {
    playClick()
    setActionLoading((prev) => ({ ...prev, bulk: true }))
    try {
      const res = await apiFetch('/api/admin/games/bulk-toggle', {
        method: 'POST',
        body: JSON.stringify({ status }),
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      const updatedMap: Record<string, boolean> = {}
      ALL_GAMES.forEach((g) => { updatedMap[g.id] = status })
      setStats((prev) => prev ? { ...prev, gameStatus: updatedMap } : prev)
      showBanner(`All 10 games switched ${status ? 'ONLINE' : 'OFFLINE'}`)
      loadAllData()
    } catch (err: any) {
      showBanner(err.message || 'Failed to bulk toggle games', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, bulk: false }))
    }
  }

  // ── User Management ──
  const toggleVip = async (userId: string, currentVip: boolean) => {
    playClick()
    const nextVip = !currentVip
    setActionLoading((prev) => ({ ...prev, [`vip_${userId}`]: true }))
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/vip`, {
        method: 'POST',
        body: JSON.stringify({ isVip: nextVip }),
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_vip: nextVip } : u))
      )
      showBanner(`VIP status ${nextVip ? 'GRANTED' : 'REVOKED'}`)
    } catch (err: any) {
      showBanner(err.message || 'Failed to update VIP', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [`vip_${userId}`]: false }))
    }
  }

  const toggleBan = async (userId: string, currentBanned: boolean) => {
    playClick()
    const action = currentBanned ? 'unban' : 'ban'
    setActionLoading((prev) => ({ ...prev, [`ban_${userId}`]: true }))
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/${action}`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_banned: !currentBanned } : u))
      )
      showBanner(`User ${currentBanned ? 'UNBANNED' : 'BANNED'}`)
    } catch (err: any) {
      showBanner(err.message || 'Failed to update ban status', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [`ban_${userId}`]: false }))
    }
  }

  const resetQuota = async (userId: string) => {
    playClick()
    setActionLoading((prev) => ({ ...prev, [`quota_${userId}`]: true }))
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/reset-quota`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, daily_plays: 0, ai_calls_count: 0 } : u))
      )
      showBanner('User daily plays and quota reset to 0')
    } catch (err: any) {
      showBanner(err.message || 'Failed to reset quota', true)
    } finally {
      setActionLoading((prev) => ({ ...prev, [`quota_${userId}`]: false }))
    }
  }

  // ── Ping API Keys ──
  const pingApiKeys = async () => {
    playClick()
    setIsPinging(true)
    try {
      const res = await apiFetch('/api/admin/live-ping', { method: 'POST' })
      if (!res.ok) throw new Error(await getApiErrorMessage(res))
      const data = await res.json()
      setLivePing(data.results || [])
      showBanner('API connectivity ping complete')
    } catch (err: any) {
      showBanner(err.message || 'Ping failed', true)
    } finally {
      setIsPinging(false)
    }
  }

  const onlineGamesCount = ALL_GAMES.filter(
    (g) => stats?.gameStatus?.[g.id] !== false
  ).length

  const filteredUsers = users.filter((u) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      u.email?.toLowerCase().includes(q) ||
      u.username?.toLowerCase().includes(q) ||
      u.id?.toLowerCase().includes(q)
    )
  })

  const formatUptime = (seconds: number) => {
    if (!seconds || seconds < 0) return '0s'
    const d = Math.floor(seconds / 86400)
    const h = Math.floor((seconds % 86400) / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)
    if (d > 0) return `${d}d ${h}h ${m}m`
    if (h > 0) return `${h}h ${m}m ${s}s`
    if (m > 0) return `${m}m ${s}s`
    return `${s}s`
  }

  return (
    <div className="min-h-screen bg-black text-zinc-100 font-mono text-xs sm:text-sm selection:bg-rose-500 selection:text-white pb-24">
      {/* ── Fixed Top Navigation & Quick Anchors ── */}
      <nav className="sticky top-0 z-50 bg-zinc-950/95 border-b border-zinc-800 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
          {/* Logo & Console Title */}
          <div className="flex items-center gap-3">
            <span className="w-3 h-3 rounded-full bg-rose-500 animate-ping" />
            <span className="font-black text-sm tracking-widest text-rose-400">
              OVERLORD CONSOLE
            </span>
            <span className="hidden sm:inline text-zinc-600">//</span>
            <span className="hidden sm:inline text-[11px] text-zinc-400 font-bold tracking-wider">
              [ 👑 SUPREME OWNER ]
            </span>
          </div>

          {/* Anchor Buttons */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
            <a
              href="#switches"
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition"
            >
              KILL SWITCHES
            </a>
            <a
              href="#users"
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition"
            >
              USERS
            </a>
            <a
              href="#health"
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition"
            >
              SYSTEM HEALTH
            </a>
            <a
              href="#logs"
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition"
            >
              AUDIT LOGS
            </a>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={loadAllData}
              disabled={isRefreshing}
              className="px-3 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-200 transition disabled:opacity-50 cursor-pointer text-xs"
            >
              {isRefreshing ? 'REFRESHING...' : 'REFRESH DATA'}
            </button>
            <Link
              to="/"
              className="px-3 py-1 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 transition cursor-pointer text-xs font-bold"
            >
              ← BACK TO ARCADE
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Status Toast / Banner ── */}
      {bannerMessage && (
        <div
          className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-lg border font-mono text-xs shadow-2xl flex items-center gap-2 ${
            bannerMessage.isError
              ? 'bg-rose-950/95 border-rose-500 text-rose-200'
              : 'bg-emerald-950/95 border-emerald-500 text-emerald-200'
          }`}
        >
          <span>{bannerMessage.isError ? '⚠️' : '✓'}</span>
          <span>{bannerMessage.text}</span>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-4 sm:px-8 pt-8 space-y-12">
        {/* ── Top Status Bar (4 Key Stat Boxes) ── */}
        <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Online Games */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
              ONLINE GAMES
            </div>
            <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              {isLoading ? '...' : `${onlineGamesCount}/10`}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              {10 - onlineGamesCount === 0 ? 'ALL PROTOCOLS ACTIVE' : `${10 - onlineGamesCount} GAMES OFFLINE`}
            </div>
          </div>

          {/* Total Users */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
              TOTAL USERS
            </div>
            <div className="text-2xl font-black text-cyan-400">
              {isLoading ? '...' : stats?.totalUsers ?? users.length}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">REGISTERED ACCOUNTS</div>
          </div>

          {/* Plays Today */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
              PLAYS TODAY
            </div>
            <div className="text-2xl font-black text-amber-400">
              {isLoading ? '...' : stats?.totalPlaysToday ?? 0}
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">ROUNDS LOGGED TODAY</div>
          </div>

          {/* Server Status */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800">
            <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
              SERVER STATUS
            </div>
            <div className="text-2xl font-black text-emerald-400 flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse" />
              ONLINE
            </div>
            <div className="text-[10px] text-zinc-600 mt-1">
              DB LATENCY: {diagnostics?.database?.latencyMs ?? 0}ms
            </div>
          </div>
        </section>

        {/* ── Maintenance Warning Banner (if active) ── */}
        {stats?.maintenance_mode && (
          <div className="p-4 rounded-xl bg-rose-950/40 border-2 border-rose-500 text-rose-300 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <span className="text-2xl">⚠️</span>
              <div>
                <div className="font-bold text-sm tracking-wide text-rose-200">
                  GLOBAL MAINTENANCE MODE IS CURRENTLY ACTIVE
                </div>
                <div className="text-xs text-rose-400/80">
                  Non-admin players will receive a 503 Maintenance screen upon accessing any game route.
                </div>
              </div>
            </div>
            <button
              onClick={() => toggleMaintenance(false)}
              disabled={actionLoading.maintenance}
              className="px-4 py-2 rounded bg-rose-600 hover:bg-rose-500 text-white font-bold tracking-wider cursor-pointer transition disabled:opacity-50"
            >
              DISABLE MAINTENANCE
            </button>
          </div>
        )}

        {/* ── SECTION 1: Master Kill Switches ── */}
        <section id="switches" className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-rose-400 uppercase flex items-center gap-2">
                <span>⚡</span>
                <span>SECTION 1 // MASTER KILL SWITCHES</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Zero-delay emergency toggles for platform modules and individual games.
              </p>
            </div>

            {/* Bulk Actions & Maintenance Toggle */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => toggleMaintenance(!stats?.maintenance_mode)}
                disabled={actionLoading.maintenance}
                className={`px-3 py-1.5 rounded font-bold transition cursor-pointer border ${
                  stats?.maintenance_mode
                    ? 'bg-rose-500 text-white border-rose-400 shadow-[0_0_15px_rgba(255,55,95,0.4)]'
                    : 'bg-zinc-900 text-zinc-400 border-zinc-700 hover:text-white'
                }`}
              >
                MAINTENANCE: {stats?.maintenance_mode ? 'ON' : 'OFF'}
              </button>

              <button
                onClick={() => bulkToggleGames(true)}
                disabled={actionLoading.bulk}
                className="px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold transition cursor-pointer"
              >
                TURN ALL GAMES ON
              </button>

              <button
                onClick={() => bulkToggleGames(false)}
                disabled={actionLoading.bulk}
                className="px-3 py-1.5 rounded bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/40 font-bold transition cursor-pointer"
              >
                TURN ALL GAMES OFF
              </button>
            </div>
          </div>

          {/* 10 Games Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {ALL_GAMES.map((game) => {
              const isGameOnline = stats?.gameStatus?.[game.id] !== false
              const isToggling = actionLoading[game.id]

              return (
                <div
                  key={game.id}
                  className={`p-4 rounded-xl border flex flex-col justify-between transition-colors ${
                    isGameOnline
                      ? 'bg-zinc-950 border-zinc-800'
                      : 'bg-rose-950/20 border-rose-900/60'
                  }`}
                >
                  <div className="space-y-1 mb-3">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest">
                        {game.type}
                      </span>
                      <span
                        className={`px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider ${
                          isGameOnline
                            ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                            : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                        }`}
                      >
                        {isGameOnline ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>

                    <div className="font-bold text-sm text-zinc-100">{game.name}</div>
                    <div className="text-[10px] text-zinc-600 font-mono">
                      {game.codename}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleGame(game.id, isGameOnline)}
                    disabled={isToggling}
                    className={`w-full py-1.5 rounded font-bold text-xs transition cursor-pointer border ${
                      isGameOnline
                        ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/30'
                        : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                    }`}
                  >
                    {isToggling ? 'UPDATING...' : isGameOnline ? 'TURN OFF' : 'TURN ON'}
                  </button>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── SECTION 2: User Database ── */}
        <section id="users" className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span>👥</span>
                <span>SECTION 2 // USER DATABASE</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Player status, VIP tiers, daily plays, and quota management.
              </p>
            </div>

            {/* User Search Input */}
            <div className="w-full sm:w-72">
              <input
                type="text"
                placeholder="Search username, email, ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full px-3 py-1.5 rounded bg-zinc-900 border border-zinc-700 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-cyan-500 text-xs"
              />
            </div>
          </div>

          {/* User Table */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-zinc-800 bg-zinc-900/60 text-zinc-400 text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-4">Player</th>
                  <th className="py-3 px-4">Role / Tier</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4">Orbs Today</th>
                  <th className="py-3 px-4">Total Plays</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-zinc-500">
                      No users matching "{searchQuery}"
                    </td>
                  </tr>
                ) : (
                  filteredUsers.map((u) => {
                    const userIsOwner = isOwner(u.email)
                    const isSelf = user?.id === u.id

                    return (
                      <tr
                        key={u.id}
                        className={`hover:bg-zinc-900/40 transition-colors ${
                          userIsOwner ? 'bg-amber-950/10' : ''
                        }`}
                      >
                        {/* Player */}
                        <td className="py-3 px-4">
                          <div className="font-bold text-zinc-200">
                            {u.username ? `@${u.username}` : '(no handle)'}
                          </div>
                          <div className="text-[11px] text-zinc-400 font-mono">
                            {u.email}
                          </div>
                          <div className="text-[9px] text-zinc-600 font-mono">
                            ID: {u.id?.slice(0, 8)}...
                          </div>
                        </td>

                        {/* Role / Tier */}
                        <td className="py-3 px-4">
                          {userIsOwner ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-amber-400/50 bg-amber-400/10 text-amber-300">
                              👑 SUPREME OWNER
                            </span>
                          ) : u.is_vip ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-yellow-500/40 bg-yellow-500/10 text-yellow-300">
                              ★ VIP
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold border border-zinc-700 bg-zinc-900 text-zinc-400">
                              FREE
                            </span>
                          )}
                        </td>

                        {/* Status */}
                        <td className="py-3 px-4">
                          {u.is_banned ? (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/15 text-rose-400 border border-rose-500/30">
                              BANNED
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                              ACTIVE
                            </span>
                          )}
                        </td>

                        {/* Orbs Today */}
                        <td className="py-3 px-4 font-mono">
                          {userIsOwner ? (
                            <span className="text-amber-400 font-black">∞ UNLIMITED</span>
                          ) : (
                            <span>
                              {u.daily_plays ?? 0} / {u.is_vip ? 25 : 10}
                            </span>
                          )}
                        </td>

                        {/* Total Plays */}
                        <td className="py-3 px-4 font-mono text-zinc-300">
                          {u.total_plays ?? 0}
                        </td>

                        {/* Actions */}
                        <td className="py-3 px-4 text-right">
                          {userIsOwner || isSelf ? (
                            <span className="text-[10px] text-zinc-600 font-mono italic">
                              [ PROTECTED OWNER ]
                            </span>
                          ) : (
                            <div className="flex items-center justify-end gap-1.5 flex-wrap">
                              <button
                                onClick={() => toggleVip(u.id, u.is_vip)}
                                disabled={actionLoading[`vip_${u.id}`]}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-yellow-300 text-[10px] font-bold cursor-pointer transition disabled:opacity-50"
                              >
                                {u.is_vip ? 'Revoke VIP' : 'Grant VIP'}
                              </button>

                              <button
                                onClick={() => toggleBan(u.id, u.is_banned)}
                                disabled={actionLoading[`ban_${u.id}`]}
                                className={`px-2 py-1 rounded text-[10px] font-bold cursor-pointer transition disabled:opacity-50 ${
                                  u.is_banned
                                    ? 'bg-emerald-500/20 text-emerald-300 hover:bg-emerald-500/30'
                                    : 'bg-rose-500/20 text-rose-300 hover:bg-rose-500/30'
                                }`}
                              >
                                {u.is_banned ? 'Unban' : 'Ban'}
                              </button>

                              <button
                                onClick={() => resetQuota(u.id)}
                                disabled={actionLoading[`quota_${u.id}`]}
                                className="px-2 py-1 rounded bg-zinc-800 hover:bg-zinc-700 text-cyan-300 text-[10px] font-bold cursor-pointer transition disabled:opacity-50"
                              >
                                Reset Orbs
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* ── SECTION 3: System & API Health ── */}
        <section id="health" className="scroll-mt-20 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-emerald-400 uppercase flex items-center gap-2">
                <span>🩺</span>
                <span>SECTION 3 // SYSTEM & API HEALTH</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Real-time diagnostics, memory footprint, question banks, and provider status.
              </p>
            </div>

            <button
              onClick={pingApiKeys}
              disabled={isPinging}
              className="px-3 py-1.5 rounded bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/40 font-bold transition cursor-pointer disabled:opacity-50"
            >
              {isPinging ? 'TESTING CONNECTIONS...' : '[ PING API KEYS ]'}
            </button>
          </div>

          {/* Diagnostics Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Server Specs */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                RUNTIME & ENVIRONMENT
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Node Version:</span>
                  <span className="text-zinc-200">{diagnostics?.nodeVersion ?? 'Node.js'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Process Uptime:</span>
                  <span className="text-emerald-400 font-bold">
                    {formatUptime(diagnostics?.processUptimeSeconds ?? 0)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Platform / Arch:</span>
                  <span className="text-zinc-200">
                    {diagnostics?.platform ?? 'linux'} / {diagnostics?.arch ?? 'x64'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Event Loop Lag:</span>
                  <span className="text-zinc-200">{diagnostics?.eventLoopLagMs ?? 0}ms</span>
                </div>
              </div>
            </div>

            {/* Server Memory */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                MEMORY ALLOCATION (RAM)
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">RSS Memory:</span>
                  <span className="text-cyan-400 font-bold">
                    {diagnostics?.memoryMb?.rss ?? 0} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Heap Used:</span>
                  <span className="text-zinc-200">
                    {diagnostics?.memoryMb?.heapUsed ?? 0} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Heap Total:</span>
                  <span className="text-zinc-200">
                    {diagnostics?.memoryMb?.heapTotal ?? 0} MB
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">External:</span>
                  <span className="text-zinc-200">
                    {diagnostics?.memoryMb?.external ?? 0} MB
                  </span>
                </div>
              </div>
            </div>

            {/* DB Question & Scenario Counts */}
            <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-2">
              <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
                DATABASE QUESTION BANKS
              </div>
              <div className="space-y-1 text-xs">
                <div className="flex justify-between">
                  <span className="text-zinc-500">Higher/Lower Questions:</span>
                  <span className="text-amber-400 font-bold">
                    {apiReport?.gamesContent?.hl_questions?.total ?? 0} total (
                    {apiReport?.gamesContent?.hl_questions?.unused ?? 0} fresh)
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Turing Test Scenarios:</span>
                  <span className="text-cyan-400 font-bold">
                    {apiReport?.gamesContent?.turing_scenarios?.total ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Survival Protocol Scenarios:</span>
                  <span className="text-rose-400 font-bold">
                    {apiReport?.gamesContent?.survival_scenarios?.total ?? 0}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-zinc-500">Database Ping:</span>
                  <span className="text-emerald-400 font-bold">
                    {diagnostics?.database?.latencyMs ?? 0}ms
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Masked API Keys Grid */}
          <div className="p-4 rounded-xl bg-zinc-950 border border-zinc-800 space-y-3">
            <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              CONFIGURED API KEYS & EXTERNAL PROVIDERS
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {[
                {
                  label: 'SUPABASE DB & AUTH',
                  keyData: apiReport?.keys?.SUPABASE_SERVICE_ROLE_KEY,
                },
                {
                  label: 'GROQ (AI TIER 1)',
                  keyData: apiReport?.keys?.GROQ_API_KEY,
                },
                {
                  label: 'GEMINI (AI TIER 2)',
                  keyData: apiReport?.keys?.GEMINI_API_KEY,
                },
                {
                  label: 'OPENROUTER (AI TIER 3)',
                  keyData: apiReport?.keys?.OPENROUTER_API_KEY,
                },
              ].map((item) => {
                const isConfigured = item.keyData?.status === 'CONFIGURED'
                return (
                  <div
                    key={item.label}
                    className="p-3 rounded bg-zinc-900/60 border border-zinc-800 space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-zinc-400 font-bold">{item.label}</span>
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                          isConfigured
                            ? 'bg-emerald-500/15 text-emerald-400'
                            : 'bg-rose-500/15 text-rose-400'
                        }`}
                      >
                        {isConfigured ? 'CONFIGURED' : 'MISSING'}
                      </span>
                    </div>
                    <div className="text-[11px] font-mono text-zinc-400">
                      {item.keyData?.masked || 'NOT SET'}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Live Ping Results (if triggered) */}
          {livePing && livePing.length > 0 && (
            <div className="p-4 rounded-xl bg-zinc-950 border border-emerald-500/40 space-y-3">
              <div className="text-emerald-400 text-xs font-bold uppercase tracking-wider flex items-center gap-2">
                <span>✓</span>
                <span>LIVE PING RESULTS</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {livePing.map((res: any, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded bg-zinc-900 border border-zinc-800 space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs font-bold">
                      <span className="text-zinc-200">{res.provider}</span>
                      <span
                        className={
                          res.status === 'ONLINE' ? 'text-emerald-400' : 'text-rose-400'
                        }
                      >
                        {res.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-zinc-500">Latency: {res.latencyMs}ms</div>
                    <div className="text-[10px] text-zinc-400 truncate">{res.message}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* ── SECTION 4: Audit Logs ── */}
        <section id="logs" className="scroll-mt-20 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <span>📋</span>
                <span>SECTION 4 // AUDIT LOGS</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Immutable record of administrative actions, switches, and user moderation.
              </p>
            </div>
            <span className="text-xs text-zinc-500">{auditLogs.length} events</span>
          </div>

          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 max-h-96 overflow-y-auto space-y-2">
            {auditLogs.length === 0 ? (
              <div className="py-8 text-center text-zinc-600">
                No admin actions logged yet.
              </div>
            ) : (
              auditLogs.map((log: any, idx: number) => (
                <div
                  key={idx}
                  className="p-2.5 rounded bg-zinc-900/40 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono"
                >
                  <div className="flex items-center gap-2.5 flex-wrap">
                    <span className="text-zinc-500 text-[10px]">
                      {new Date(log.created_at || log.timestamp || Date.now()).toLocaleTimeString()}
                    </span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                      {log.action_type || log.action}
                    </span>
                    <span className="text-zinc-300 font-bold">{log.admin_email}</span>
                    <span className="text-zinc-600">→</span>
                    <span className="text-zinc-400">{log.target_resource || log.target}</span>
                  </div>

                  {log.details && (
                    <div className="text-[10px] text-zinc-500 truncate max-w-xs">
                      {typeof log.details === 'string'
                        ? log.details
                        : JSON.stringify(log.details)}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
