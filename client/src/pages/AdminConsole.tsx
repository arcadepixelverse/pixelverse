import { Component, useState, useEffect, useCallback, type ReactNode, type ErrorInfo } from 'react'
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

/**
 * Scoped fault boundary for the console body. If any console panel throws
 * during render, we surface a loud red terminal panel instead of silently
 * rendering an empty (blank) content area. Keeps the top nav alive so the
 * admin can reload data or navigate away.
 */
class ConsoleSectionBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AdminConsole] Content render fault:', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div className="p-6 rounded-2xl bg-red-950/95 border-2 border-red-500 shadow-[0_0_60px_rgba(255,0,0,0.5)] text-red-100 font-mono space-y-3">
        <div className="text-base sm:text-lg font-black text-red-400 uppercase tracking-widest">
          ⚠️ CONSOLE RENDER FAULT
        </div>
        <p className="text-xs text-red-300/80 break-all leading-relaxed">
          {this.state.error.message || 'Unknown render error'}
        </p>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition"
        >
          RETRY RENDER ↻
        </button>
      </div>
    )
  }
}

export default function AdminConsole() {
  const { user, loading } = useAuth()
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [stats, setStats] = useState<{
    totalUsers: number
    totalAiCallsToday: number
    totalPlaysToday: number
    maintenance_mode: boolean
    gameStatus: Record<string, boolean>
  }>({
    totalUsers: 0,
    totalAiCallsToday: 0,
    totalPlaysToday: 0,
    maintenance_mode: false,
    gameStatus: {},
  })

  const [users, setUsers] = useState<any[]>([])
  const [diagnostics, setDiagnostics] = useState<any>(null)
  const [apiReport, setApiReport] = useState<any>(null)
  const [livePing, setLivePing] = useState<any[] | null>(null)
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [activityFeed, setActivityFeed] = useState<any[]>([])
  const [autoRefreshFeed, setAutoRefreshFeed] = useState(false)
  const [isFeedRefreshing, setIsFeedRefreshing] = useState(false)

  const [qaChecklist, setQaChecklist] = useState<
    Record<
      string,
      {
        routeLoads?: boolean
        gameplayVerified?: boolean
        mobileResponsive?: boolean
        zeroConsoleErrors?: boolean
        lastChecked?: string
        checkedBy?: string
      }
    >
  >(() => {
    try {
      const cached = localStorage.getItem('pv_game_qa_checklist')
      return cached ? JSON.parse(cached) : {}
    } catch {
      return {}
    }
  })
  const [qaLightCheck, setQaLightCheck] = useState<any[] | null>(null)
  const [isRunningLightCheck, setIsRunningLightCheck] = useState(false)

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

  const safeFetchJson = async (endpoint: string) => {
    const res = await apiFetch(endpoint)
    const text = await res.text()
    const trimmed = text.trim()

    // Detect if backend returned an HTML document (e.g. Render waking up, 502/504 Bad Gateway, or Cloudflare Worker fallback)
    if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('<body')) {
      throw new Error(`${endpoint} returned HTML document (${res.status} ${res.statusText || 'OK'}) instead of JSON`)
    }

    if (!res.ok) {
      throw new Error(`${endpoint} failed with HTTP ${res.status}: ${trimmed.slice(0, 100)}`)
    }

    try {
      return JSON.parse(text)
    } catch {
      throw new Error(`${endpoint} returned invalid JSON: ${trimmed.slice(0, 80)}`)
    }
  }

  const loadAllData = useCallback(async () => {
    setIsRefreshing(true)
    setErrorMsg(null)
    const caughtErrors: string[] = []

    try {
      // 1. Stats
      try {
        const statsData = await safeFetchJson('/api/admin/stats')
        if (statsData) setStats(statsData)
      } catch (err: any) {
        caughtErrors.push(err.message || 'Stats fetch failed')
      }

      // 2. Users
      try {
        const usersData = await safeFetchJson('/api/admin/users')
        if (Array.isArray(usersData)) setUsers(usersData)
      } catch (err: any) {
        caughtErrors.push(err.message || 'Users fetch failed')
      }

      // 3. Diagnostics
      try {
        const diagData = await safeFetchJson('/api/admin/diagnostics')
        if (diagData) setDiagnostics(diagData)
      } catch (err: any) {
        caughtErrors.push(err.message || 'Diagnostics fetch failed')
      }

      // 4. API Report
      try {
        const reportData = await safeFetchJson('/api/admin/api-report')
        if (reportData) setApiReport(reportData)
      } catch (err: any) {
        caughtErrors.push(err.message || 'API Report fetch failed')
      }

      // 5. Audit Logs
      try {
        const logsData = await safeFetchJson('/api/admin/audit-logs')
        if (Array.isArray(logsData)) setAuditLogs(logsData)
      } catch (err: any) {
        caughtErrors.push(err.message || 'Audit Logs fetch failed')
      }

      // 6. Activity Feed
      try {
        const feedData = await safeFetchJson('/api/admin/activity-feed')
        if (Array.isArray(feedData)) setActivityFeed(feedData)
      } catch (err: any) {
        console.warn('[AdminConsole] Activity Feed fetch notice:', err)
      }

      // 7. QA Checklist
      try {
        const qaData = await safeFetchJson('/api/admin/qa-checklist')
        if (qaData && typeof qaData === 'object') {
          setQaChecklist((prev) => ({ ...prev, ...qaData }))
          try {
            localStorage.setItem('pv_game_qa_checklist', JSON.stringify(qaData))
          } catch {}
        }
      } catch (err: any) {
        console.warn('[AdminConsole] QA Checklist fetch notice:', err)
      }

      // 8. QA Light Check
      try {
        const lightData = await safeFetchJson('/api/admin/qa-light-check')
        if (lightData?.games) setQaLightCheck(lightData.games)
      } catch (err: any) {
        console.warn('[AdminConsole] QA Light Check fetch notice:', err)
      }

      if (caughtErrors.length > 0) {
        setErrorMsg(caughtErrors.join(' • '))
      }
    } catch (globalErr: any) {
      console.error('[AdminConsole] Global fetch error:', globalErr)
      setErrorMsg(globalErr?.message || 'Critical network error during console data fetch')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    window.scrollTo(0, 0)
    if (window.location.hash) {
      window.history.replaceState(null, '', window.location.pathname)
    }
    loadAllData()
  }, [loadAllData])

  // Live Activity Feed 15s polling (paused by default)
  useEffect(() => {
    if (!autoRefreshFeed) return
    const timer = setInterval(() => {
      safeFetchJson('/api/admin/activity-feed')
        .then((data) => {
          if (Array.isArray(data)) setActivityFeed(data)
        })
        .catch(() => {})
    }, 15000)
    return () => clearInterval(timer)
  }, [autoRefreshFeed])

  const refreshFeedOnly = async () => {
    setIsFeedRefreshing(true)
    try {
      const feedData = await safeFetchJson('/api/admin/activity-feed')
      if (Array.isArray(feedData)) {
        setActivityFeed(feedData)
        showBanner('Live feed refreshed')
      }
    } catch (err: any) {
      showBanner(err.message || 'Failed to refresh feed', true)
    } finally {
      setIsFeedRefreshing(false)
    }
  }

  const runLightCheck = async () => {
    playClick()
    setIsRunningLightCheck(true)
    try {
      const data = await safeFetchJson('/api/admin/qa-light-check')
      if (data?.games) {
        setQaLightCheck(data.games)
        showBanner('Automated light checks verified for all 10 games')
      }
    } catch (err: any) {
      showBanner(err.message || 'Light check failed', true)
    } finally {
      setIsRunningLightCheck(false)
    }
  }

  const toggleChecklistItem = async (
    gameId: string,
    field: 'routeLoads' | 'gameplayVerified' | 'mobileResponsive' | 'zeroConsoleErrors'
  ) => {
    playClick()
    const current = qaChecklist[gameId] || {}
    const updatedEntry = {
      ...current,
      [field]: !current[field],
      lastChecked: new Date().toISOString(),
      checkedBy: user?.email ? user.email.split('@')[0] : 'admin',
    }
    const updatedChecklist = {
      ...qaChecklist,
      [gameId]: updatedEntry,
    }

    setQaChecklist(updatedChecklist)
    try {
      localStorage.setItem('pv_game_qa_checklist', JSON.stringify(updatedChecklist))
    } catch {}

    try {
      await apiFetch('/api/admin/qa-checklist', {
        method: 'POST',
        body: JSON.stringify({ checklist: updatedChecklist }),
      })
    } catch (err: any) {
      console.warn('[AdminConsole] Failed to save QA checklist to server:', err)
    }
  }

  const scrollToSection = (id: string) => {
    playClick()
    const el = document.getElementById(id)
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

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

  const formatDate = (isoString?: string | null) => {
    if (!isoString) return '—'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return '—'
      return d.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      })
    } catch {
      return '—'
    }
  }

  const formatRelativeTime = (isoString?: string | null) => {
    if (!isoString) return 'Never'
    try {
      const d = new Date(isoString)
      if (isNaN(d.getTime())) return 'Never'
      const diffMs = Date.now() - d.getTime()
      const diffSec = Math.floor(diffMs / 1000)
      if (diffSec < 60) return `${Math.max(0, diffSec)}s ago`
      const diffMin = Math.floor(diffSec / 60)
      if (diffMin < 60) return `${diffMin}m ago`
      const diffHr = Math.floor(diffMin / 60)
      if (diffHr < 24) return `${diffHr}h ago`
      const diffDays = Math.floor(diffHr / 24)
      return `${diffDays}d ago`
    } catch {
      return 'Never'
    }
  }

  if (loading) {
    return (
      <div className="relative z-10 min-h-screen bg-black flex flex-col items-center justify-center p-6 text-cyan-500 font-mono text-center select-none">
        <div className="text-xl sm:text-2xl font-black uppercase tracking-[0.25em] animate-pulse">
          INITIALIZING OVERLORD PROTOCOLS...
        </div>
        <p className="mt-4 text-xs text-cyan-500/50 uppercase tracking-widest">
          SECURE ENCLAVE HANDSHAKE // SYNCING AUTH STATE
        </p>
      </div>
    )
  }

  const isOwnerUser = Boolean(
    user?.email &&
      (user.email.toLowerCase().trim() === 'pritisinghmgs@gmail.com' ||
        user.email.toLowerCase().trim() === 'arcade.pixelverse@gmail.com' ||
        isOwner(user.email))
  )

  if (!user || !isOwnerUser) {
    return (
      <div className="relative z-10 min-h-screen bg-black flex flex-col items-center justify-center p-6 text-red-500 font-mono text-center select-none">
        <div className="text-xl sm:text-2xl font-black uppercase tracking-[0.2em]">
          ACCESS DENIED: CLEARANCE LEVEL TOO LOW.
        </div>
        <p className="mt-4 text-xs text-red-400/60 uppercase tracking-wider">
          DETECTED IDENTITY: {user?.email || 'UNAUTHENTICATED SESSION'}
        </p>
        <Link
          to="/"
          className="mt-6 px-6 py-2.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-300 border border-red-500/50 text-xs font-bold uppercase tracking-wider transition"
        >
          ← RETURN TO SAFE ZONE
        </Link>
      </div>
    )
  }

  return (
    <div className="relative z-10 min-h-screen w-full overflow-x-clip bg-black text-zinc-100 font-mono text-xs sm:text-sm selection:bg-rose-500 selection:text-white pb-36">
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

          {/* Jump Buttons (No Hash Mutation) */}
          <div className="flex items-center gap-2 overflow-x-auto text-[11px] scrollbar-none">
            <button
              type="button"
              onClick={() => scrollToSection('switches')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              KILL SWITCHES
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('users')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              USERS & FEED
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('api-keys')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              API & QUOTAS
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('game-qa')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              GAME QA
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('health')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              SYSTEM HEALTH
            </button>
            <button
              type="button"
              onClick={() => scrollToSection('logs')}
              className="px-2.5 py-1 rounded bg-zinc-900 border border-zinc-700/60 text-zinc-300 hover:text-white hover:border-zinc-500 transition cursor-pointer shrink-0"
            >
              AUDIT LOGS
            </button>
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
        <ConsoleSectionBoundary>
        {/* ── Massive System Panic Red Neon Box (if backend fails or returns HTML) ── */}
        {errorMsg && (
          <div className="p-6 rounded-2xl bg-red-950/95 border-2 border-red-500 shadow-[0_0_60px_rgba(255,0,0,0.7)] text-red-100 font-mono space-y-3">
            <div className="flex items-center gap-3 text-base sm:text-lg font-black text-red-400 uppercase tracking-widest">
              <span className="text-2xl animate-pulse">🚨</span>
              <span>SYSTEM PANIC: {errorMsg}</span>
            </div>
            <p className="text-xs text-red-300/80 leading-relaxed">
              API communication fault detected (backend cold start, HTTP failure, or HTML response). The console below is running with default baseline values.
            </p>
            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={loadAllData}
                disabled={isRefreshing}
                className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs uppercase tracking-wider cursor-pointer transition shadow-lg disabled:opacity-50"
              >
                {isRefreshing ? 'RETRYING...' : 'RELOAD OVERLORD LINK ↻'}
              </button>
              <button
                type="button"
                onClick={() => setErrorMsg(null)}
                className="px-3 py-2 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-400 text-xs uppercase tracking-wider cursor-pointer border border-zinc-700"
              >
                DISMISS
              </button>
            </div>
          </div>
        )}

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
        <section id="switches" className="scroll-mt-24 space-y-4">
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

        {/* ── SECTION 2: User Activity & Live Feed ── */}
        <section id="users" className="scroll-mt-24 space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-cyan-400 uppercase flex items-center gap-2">
                <span>👥</span>
                <span>SECTION 2 // USER ACTIVITY & LIVE FEED</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Real-time player action stream, account tiers, signup dates, and moderation controls.
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

          {/* ── Live Activity Feed Card ── */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-2 border-b border-zinc-800/80">
              <div className="flex items-center gap-2">
                <span className="text-amber-400 font-black">⚡</span>
                <span className="text-xs font-black tracking-wider uppercase text-zinc-200">
                  LIVE ACTIVITY FEED
                </span>
                <span className="text-[10px] text-zinc-500 font-mono">
                  ({activityFeed.length} RECENT EVENTS)
                </span>
              </div>

              <div className="flex items-center gap-2">
                {/* Auto-Refresh Toggle */}
                <button
                  type="button"
                  onClick={() => setAutoRefreshFeed((prev) => !prev)}
                  className={`px-2.5 py-1 rounded text-[10px] font-bold border transition cursor-pointer flex items-center gap-1.5 ${
                    autoRefreshFeed
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40 shadow-[0_0_10px_rgba(16,185,129,0.2)]'
                      : 'bg-zinc-900 text-zinc-400 border-zinc-700/60 hover:text-zinc-200'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      autoRefreshFeed ? 'bg-emerald-400 animate-pulse' : 'bg-zinc-600'
                    }`}
                  />
                  <span>AUTO-REFRESH (15s): {autoRefreshFeed ? 'ON' : 'OFF'}</span>
                </button>

                {/* Manual Refresh Button */}
                <button
                  type="button"
                  onClick={refreshFeedOnly}
                  disabled={isFeedRefreshing}
                  className="px-2.5 py-1 rounded bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 text-[10px] font-bold transition cursor-pointer disabled:opacity-50"
                >
                  {isFeedRefreshing ? 'REFRESHING...' : '[ REFRESH FEED ]'}
                </button>
              </div>
            </div>

            {/* Event Stream */}
            <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
              {activityFeed.length === 0 ? (
                <div className="py-6 text-center text-zinc-600 text-xs">
                  No recent game completions, signups, or admin actions recorded.
                </div>
              ) : (
                activityFeed.map((event: any) => {
                  let badgeStyle = 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  let badgeText = 'GAME PLAY'
                  if (event.type === 'ADMIN_ACTION') {
                    badgeStyle = 'bg-amber-400/10 text-amber-300 border-amber-400/30'
                    badgeText = 'ADMIN ACTION'
                  } else if (event.type === 'USER_SIGNUP') {
                    badgeStyle = 'bg-purple-500/10 text-purple-300 border-purple-500/30'
                    badgeText = 'USER SIGNUP'
                  }

                  return (
                    <div
                      key={event.id}
                      className="p-2.5 rounded bg-zinc-900/50 border border-zinc-800/80 flex flex-wrap items-center justify-between gap-2 text-xs font-mono hover:border-zinc-700 transition-colors"
                    >
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold border ${badgeStyle}`}>
                          {badgeText}
                        </span>
                        <span className="font-bold text-zinc-200">{event.title}</span>
                        <span className="text-zinc-600">by</span>
                        <span className="text-cyan-400">{event.actor}</span>
                        {event.details && (
                          <>
                            <span className="text-zinc-600">→</span>
                            <span className="text-zinc-400 text-[11px] truncate max-w-xs">
                              {event.details}
                            </span>
                          </>
                        )}
                      </div>
                      <span className="text-zinc-500 text-[10px] shrink-0">
                        {formatRelativeTime(event.timestamp)}
                      </span>
                    </div>
                  )
                })
              )}
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
                  <th className="py-3 px-4">Signup Date</th>
                  <th className="py-3 px-4">Last Active</th>
                  <th className="py-3 px-4">Orbs Today</th>
                  <th className="py-3 px-4">Total Plays</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {filteredUsers.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-zinc-500">
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
                            {u.username ? `@${u.username}` : '[NO HANDLE]'}
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

                        {/* Signup Date */}
                        <td className="py-3 px-4 text-zinc-400 text-xs font-mono">
                          {formatDate(u.created_at)}
                        </td>

                        {/* Last Active */}
                        <td className="py-3 px-4 text-zinc-400 text-xs font-mono">
                          {formatRelativeTime(u.last_played_at || u.last_sign_in_at)}
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

        {/* ── SECTION 3: API Key & Quota Management ── */}
        <section id="api-keys" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <span>🔑</span>
                <span>SECTION 3 // API KEY & QUOTA MANAGEMENT</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Real-time outward provider telemetry, masked secrets, daily reset counters, and failover limits.
              </p>
            </div>

            <button
              onClick={pingApiKeys}
              disabled={isPinging}
              className="px-3 py-1.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold transition cursor-pointer disabled:opacity-50 text-xs"
            >
              {isPinging ? 'TESTING CONNECTIONS...' : '[ PING API KEYS ]'}
            </button>
          </div>

          {/* Top Summary Bar */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
                KEYS CONFIGURED
              </div>
              <div className="text-xl font-black text-amber-300">
                {apiReport?.serviceQuotas?.summary?.totalConfigured ?? 4} / {apiReport?.serviceQuotas?.summary?.totalServices ?? 5}
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">OUTWARD SERVICE KEYS</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
                ACTIVE KEYS
              </div>
              <div className="text-xl font-black text-emerald-400 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span>{apiReport?.serviceQuotas?.summary?.activeKeys ?? 4} ONLINE</span>
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">PROVIDERS AVAILABLE</div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
                AI CALLS TODAY
              </div>
              <div className="text-xl font-black text-cyan-400">
                {apiReport?.serviceQuotas?.summary?.aggregateAiCallsToday ?? stats.totalAiCallsToday ?? 0}
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">
                CAP: {apiReport?.serviceQuotas?.summary?.aggregateAiDailyCap?.toLocaleString() ?? '16,100'} RPD
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-zinc-950 border border-zinc-800">
              <div className="text-zinc-500 text-[10px] uppercase tracking-wider font-bold mb-1">
                RESET SCHEDULE
              </div>
              <div className="text-xl font-black text-zinc-200">
                00:00 UTC
              </div>
              <div className="text-[10px] text-zinc-600 mt-0.5">DAILY AUTOMATIC FLUSH</div>
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

          {/* Service Quotas Cards */}
          <div className="rounded-xl border border-zinc-800 bg-zinc-950 p-4 space-y-3">
            <div className="text-zinc-500 text-[10px] uppercase font-bold tracking-wider">
              TELEMETRY & USAGE BREAKDOWN BY SERVICE
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {(
                apiReport?.serviceQuotas?.services || [
                  {
                    serviceKey: 'groq',
                    serviceLabel: 'GROQ LPU (TIER 1 - PRIMARY)',
                    envVar: 'GROQ_API_KEY',
                    status: apiReport?.keys?.GROQ_API_KEY?.status || 'CONFIGURED',
                    maskedKey: apiReport?.keys?.GROQ_API_KEY?.masked || '••••••••••••a1b2',
                    dailyLimit: 14400,
                    dailyLimitLabel: '14,400 RPD',
                    minuteLimitLabel: '30 RPM',
                    callsToday: 0,
                    errorsToday: 0,
                    providerType: 'AI',
                  },
                  {
                    serviceKey: 'gemini',
                    serviceLabel: 'GOOGLE GEMINI 2.0 (TIER 2 - FAILOVER)',
                    envVar: 'GEMINI_API_KEY',
                    status: apiReport?.keys?.GEMINI_API_KEY?.status || 'CONFIGURED',
                    maskedKey: apiReport?.keys?.GEMINI_API_KEY?.masked || '••••••••••••c3d4',
                    dailyLimit: 1500,
                    dailyLimitLabel: '1,500 RPD',
                    minuteLimitLabel: '15 RPM',
                    callsToday: 0,
                    errorsToday: 0,
                    providerType: 'AI',
                  },
                  {
                    serviceKey: 'openrouter',
                    serviceLabel: 'OPENROUTER (TIER 3 - EMERGENCY)',
                    envVar: 'OPENROUTER_API_KEY',
                    status: apiReport?.keys?.OPENROUTER_API_KEY?.status || 'CONFIGURED',
                    maskedKey: apiReport?.keys?.OPENROUTER_API_KEY?.masked || '••••••••••••e5f6',
                    dailyLimit: 200,
                    dailyLimitLabel: '200 RPD',
                    minuteLimitLabel: '20 RPM',
                    callsToday: 0,
                    errorsToday: 0,
                    providerType: 'AI',
                  },
                  {
                    serviceKey: 'supabase',
                    serviceLabel: 'SUPABASE DB & AUTH (SERVICE ROLE)',
                    envVar: 'SUPABASE_SERVICE_ROLE_KEY',
                    status: apiReport?.keys?.SUPABASE_SERVICE_ROLE_KEY?.status || 'CONFIGURED',
                    maskedKey: apiReport?.keys?.SUPABASE_SERVICE_ROLE_KEY?.masked || '••••••••••••7890',
                    dailyLimit: 50000,
                    dailyLimitLabel: '50,000 RPD',
                    minuteLimitLabel: '500 RPM',
                    callsToday: 0,
                    errorsToday: 0,
                    providerType: 'DATABASE',
                  },
                  {
                    serviceKey: 'supabase_anon',
                    serviceLabel: 'SUPABASE CLIENT (ANON KEY)',
                    envVar: 'SUPABASE_ANON_KEY',
                    status: apiReport?.keys?.SUPABASE_ANON_KEY?.status || 'CONFIGURED',
                    maskedKey: apiReport?.keys?.SUPABASE_ANON_KEY?.masked || '••••••••••••anon',
                    dailyLimit: 50000,
                    dailyLimitLabel: '50,000 RPD',
                    minuteLimitLabel: '500 RPM',
                    callsToday: 0,
                    errorsToday: 0,
                    providerType: 'DATABASE',
                  },
                ]
              ).map((srv: any) => {
                const isConfigured = srv.status === 'CONFIGURED'
                const pct = srv.dailyLimit > 0 ? Math.min(100, Math.round((srv.callsToday / srv.dailyLimit) * 100)) : 0

                return (
                  <div
                    key={srv.serviceKey}
                    className="p-3.5 rounded-lg bg-zinc-900/60 border border-zinc-800 space-y-2.5 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between gap-1 mb-1">
                        <span className="text-[9px] px-1.5 py-0.5 rounded font-bold border border-zinc-700 bg-zinc-800 text-zinc-400">
                          {srv.providerType}
                        </span>
                        <span
                          className={`text-[9px] px-1.5 py-0.5 rounded font-bold ${
                            isConfigured
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-rose-500/15 text-rose-400 border border-rose-500/30'
                          }`}
                        >
                          {isConfigured ? 'CONFIGURED' : 'MISSING'}
                        </span>
                      </div>

                      <div className="font-bold text-xs text-zinc-200 leading-snug">
                        {srv.serviceLabel}
                      </div>
                      <div className="text-[11px] font-mono text-zinc-400 mt-1">
                        {srv.maskedKey}
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-zinc-800/80 text-[11px]">
                      <div className="flex justify-between text-zinc-400">
                        <span>Configured Limit:</span>
                        <span className="font-mono text-zinc-200">
                          {srv.dailyLimitLabel} • {srv.minuteLimitLabel}
                        </span>
                      </div>
                      <div className="flex justify-between text-zinc-400">
                        <span>Calls Used Today:</span>
                        <span className="font-mono text-amber-400 font-bold">
                          {srv.callsToday.toLocaleString()} / {srv.dailyLimit.toLocaleString()}
                        </span>
                      </div>

                      {/* Usage bar */}
                      <div className="w-full bg-zinc-800 h-1.5 rounded-full overflow-hidden">
                        <div
                          className="bg-amber-400 h-full rounded-full transition-all duration-300"
                          style={{ width: `${Math.max(2, pct)}%` }}
                        />
                      </div>

                      {srv.errorsToday > 0 && (
                        <div className="text-[10px] text-rose-400 font-mono">
                          ⚠️ {srv.errorsToday} failed calls logged today
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </section>

        {/* ── SECTION 4: Game QA & Health Checklist ── */}
        <section id="game-qa" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-purple-400 uppercase flex items-center gap-2">
                <span>🎮</span>
                <span>SECTION 4 // GAME QA & HEALTH CHECKLIST</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Automated route & content verification coupled with persistent manual UI/UX audit checklists.
              </p>
            </div>

            <button
              onClick={runLightCheck}
              disabled={isRunningLightCheck}
              className="px-3 py-1.5 rounded bg-purple-500/10 hover:bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold transition cursor-pointer disabled:opacity-50 text-xs"
            >
              {isRunningLightCheck ? 'CHECKING ALL 10 GAMES...' : '[ RUN AUTOMATED LIGHT CHECK ]'}
            </button>
          </div>

          {/* 10 Games QA Cards Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {ALL_GAMES.map((game) => {
              const isGameOnline = stats?.gameStatus?.[game.id] !== false
              const lightCheckInfo = qaLightCheck?.find((g) => g.gameId === game.id)
              const manualCheck = qaChecklist[game.id] || {}

              const checkedCount = [
                manualCheck.routeLoads,
                manualCheck.gameplayVerified,
                manualCheck.mobileResponsive,
                manualCheck.zeroConsoleErrors,
              ].filter(Boolean).length

              let statusPill = {
                text: 'UNVERIFIED',
                style: 'bg-zinc-800 text-zinc-400 border border-zinc-700',
              }

              if (!isGameOnline) {
                statusPill = {
                  text: 'OFFLINE',
                  style: 'bg-rose-500/15 text-rose-400 border border-rose-500/30',
                }
              } else if (checkedCount === 4) {
                statusPill = {
                  text: 'PASS',
                  style: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 shadow-[0_0_10px_rgba(16,185,129,0.2)]',
                }
              } else if (checkedCount > 0) {
                statusPill = {
                  text: `NEEDS REVIEW (${checkedCount}/4)`,
                  style: 'bg-amber-500/15 text-amber-400 border border-amber-500/30',
                }
              }

              // Determine automated content string
              let contentNote = 'Pure Arcade Engine (Unlimited Plays)'
              if (game.id === 'higher_lower') {
                contentNote = `${apiReport?.gamesContent?.hl_questions?.total ?? 0} questions (${apiReport?.gamesContent?.hl_questions?.unused ?? 0} fresh)`
              } else if (game.id === 'turing_test') {
                contentNote = `${apiReport?.gamesContent?.turing_scenarios?.total ?? 0} scenarios`
              } else if (game.id === 'survival') {
                contentNote = `${apiReport?.gamesContent?.survival_scenarios?.total ?? 0} scenarios`
              } else if (game.type === 'AI') {
                contentNote = 'Dynamic AI Generation (3-Tier Failover)'
              }

              if (lightCheckInfo?.contentCount) {
                contentNote = lightCheckInfo.contentCount
              }

              return (
                <div
                  key={game.id}
                  className={`p-4 rounded-xl border space-y-3 transition-colors ${
                    isGameOnline
                      ? 'bg-zinc-950 border-zinc-800'
                      : 'bg-rose-950/20 border-rose-900/60'
                  }`}
                >
                  {/* Game Header */}
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm text-zinc-100">{game.name}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded font-mono font-bold border border-zinc-700 bg-zinc-900 text-zinc-400">
                          {game.type}
                        </span>
                      </div>
                      <div className="text-[10px] text-zinc-500 font-mono">
                        {game.codename} • Route: /games/{game.id}
                      </div>
                    </div>

                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${statusPill.style}`}>
                      {statusPill.text}
                    </span>
                  </div>

                  {/* Automated Light Check Telemetry */}
                  <div className="p-2.5 rounded bg-zinc-900/60 border border-zinc-800/80 space-y-1 text-xs">
                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Live Kill-Switch:</span>
                      <span
                        className={`font-bold ${
                          isGameOnline ? 'text-emerald-400' : 'text-rose-400'
                        }`}
                      >
                        {isGameOnline ? 'ONLINE' : 'KILL SWITCH ACTIVE'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Content / Questions:</span>
                      <span className="text-cyan-300 font-mono">{contentNote}</span>
                    </div>

                    <div className="flex items-center justify-between text-[11px]">
                      <span className="text-zinc-500">Route Status:</span>
                      <span className="text-emerald-400 font-mono">
                        {lightCheckInfo?.routeStatus || '200 OK'}
                      </span>
                    </div>
                  </div>

                  {/* Manual UI/UX 4-Point Checklist */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider flex items-center justify-between">
                      <span>MANUAL AUDIT CHECKLIST</span>
                      {manualCheck.lastChecked && (
                        <span className="text-zinc-500 font-normal normal-case">
                          Checked {formatRelativeTime(manualCheck.lastChecked)} by @{manualCheck.checkedBy || 'admin'}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <label className="flex items-center gap-2 p-2 rounded bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(manualCheck.routeLoads)}
                          onChange={() => toggleChecklistItem(game.id, 'routeLoads')}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                        <span className={manualCheck.routeLoads ? 'text-zinc-200' : 'text-zinc-500'}>
                          Route loads cleanly
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(manualCheck.gameplayVerified)}
                          onChange={() => toggleChecklistItem(game.id, 'gameplayVerified')}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                        <span className={manualCheck.gameplayVerified ? 'text-zinc-200' : 'text-zinc-500'}>
                          Gameplay loop verified
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(manualCheck.mobileResponsive)}
                          onChange={() => toggleChecklistItem(game.id, 'mobileResponsive')}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                        <span className={manualCheck.mobileResponsive ? 'text-zinc-200' : 'text-zinc-500'}>
                          Mobile 375px responsive
                        </span>
                      </label>

                      <label className="flex items-center gap-2 p-2 rounded bg-zinc-900/40 border border-zinc-800 hover:border-zinc-700 cursor-pointer transition select-none">
                        <input
                          type="checkbox"
                          checked={Boolean(manualCheck.zeroConsoleErrors)}
                          onChange={() => toggleChecklistItem(game.id, 'zeroConsoleErrors')}
                          className="rounded border-zinc-700 text-purple-600 focus:ring-0 focus:outline-none cursor-pointer"
                        />
                        <span className={manualCheck.zeroConsoleErrors ? 'text-zinc-200' : 'text-zinc-500'}>
                          Zero console errors
                        </span>
                      </label>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </section>

        {/* ── SECTION 5: System Health ── */}
        <section id="health" className="scroll-mt-24 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-emerald-400 uppercase flex items-center gap-2">
                <span>🩺</span>
                <span>SECTION 5 // SYSTEM & INFRASTRUCTURE HEALTH</span>
              </h2>
              <p className="text-zinc-500 text-xs">
                Real-time server diagnostics, memory allocation, question bank capacities, and event loop lag.
              </p>
            </div>
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
        </section>

        {/* ── SECTION 6: Audit Logs ── */}
        <section id="logs" className="scroll-mt-24 space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
            <div>
              <h2 className="text-lg font-black tracking-wider text-amber-400 uppercase flex items-center gap-2">
                <span>📋</span>
                <span>SECTION 6 // AUDIT LOGS</span>
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
        </ConsoleSectionBoundary>
      </div>
    </div>
  )
}
