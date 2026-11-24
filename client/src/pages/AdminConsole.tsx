import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch, getApiErrorMessage } from '../lib/apiClient'
import { useAuth } from '../context/AuthContext'
import { playClick } from '../lib/soundEngine'

// ── Interfaces ─────────────────────────────────────────────────────────────────

export interface GameStatusMap {
  [gameId: string]: boolean
}

export interface AdminStats {
  totalUsers: number
  totalAiCallsToday: number
  totalPlaysToday: number
  maintenance_mode: boolean
  gameStatus: GameStatusMap
}

export interface AdminUser {
  id: string
  email: string
  ai_calls_count: number
  daily_plays?: number
  total_plays?: number
  is_banned?: boolean
  last_played_at?: string | null
  created_at?: string
  last_sign_in_at?: string
}

export interface GameDefinition {
  id: string
  name: string
  codename: string
  desc: string
  category: string
  icon: string
}

export interface DiagnosticsData {
  nodeVersion: string
  platform: string
  arch: string
  processUptimeSeconds: number
  memoryMb: {
    rss: number
    heapUsed: number
    heapTotal: number
    external: number
  }
  eventLoopLagMs: number
  database: {
    status: string
    latencyMs: number
  }
  errorCounters: {
    error4xx: number
    error5xx: number
    rateLimit429: number
  }
  timestamp: string
}

export interface ApiReportData {
  keys: {
    [keyName: string]: {
      status: 'CONFIGURED' | 'MISSING'
      masked: string
    }
  }
  telemetry: {
    serverUptimeSeconds: number
    totalRequests: number
    endpointCounts: Record<string, number>
    aiCallCount: number
    rateLimit429Count: number
    error4xxCount: number
    error5xxCount: number
    averageLatencyMs: number
  }
  configuredLimits: {
    dailyUserPlayLimit: number
    dailyAiCallsLimit: number
    playSessionTtlMinutes: number
  }
  aiFailover?: {
    providers: Array<{
      name: string
      tier: string
      env: string
      key: { status: 'CONFIGURED' | 'MISSING'; masked: string }
      status: 'CONFIGURED' | 'MISSING'
      calls: number
      errors: number
      rateLimit429s: number
    }>
    thresholds: {
      dailyAiCallsPerUser: number
      dailyPlaysPerUser: number
      rateLimits: string
    }
  }
  gamesContent?: {
    gameStatus: GameStatusMap
    hl_questions: { total: number; unused: number }
    turing_scenarios: { total: number }
    survival_scenarios: { total: number }
    leaderboards: Record<string, number>
  }
  traffic?: {
    totalRequests: number
    endpointCounts: Record<string, number>
    aiCallCount: number
    rateLimit429Count: number
    error4xxCount: number
    error5xxCount: number
    averageLatencyMs: number
    cacheControl: string
    cacheControlVerified: boolean
  }
}

export interface LivePingResult {
  provider: string
  status: 'ONLINE' | 'DEGRADED' | 'FAILED'
  statusCode: number
  latencyMs: number
  message: string
}

export interface AuditLogEntry {
  id?: string
  admin_email: string
  action: string
  target: string
  details?: any
  created_at: string
}

export interface ClientDiagnostics {
  host: string
  buildMode: string
  jwtExpiresIn: string
  storageKb: number
  onlineStatus: boolean
  connectionType: string
  rttMs: number
  fps: number
  domNodes: number
  viewport: string
  fontsLoaded: string
  dvhSupported: boolean
}

// ── Canonical Game Catalog ─────────────────────────────────────────────────────

export const GAME_DEFINITIONS: GameDefinition[] = [
  {
    id: 'higher_lower',
    name: 'Higher or Lower',
    codename: 'MOD_HL_COMPARE',
    desc: 'Real-world quantitative metric comparison trivia engine',
    category: 'TRIVIA_CORE',
    icon: '📈',
  },
  {
    id: 'jailbreak',
    name: 'The Jailbreak',
    codename: 'MOD_SEC_FIREWALL',
    desc: 'Adversarial prompt injection & secret passkey extraction test',
    category: 'CYBER_SEC',
    icon: '🔓',
  },
  {
    id: 'mind_reader',
    name: 'Mind Reader',
    codename: 'MOD_NEURAL_ORACLE',
    desc: 'Binary search telepathic question & number deduction system',
    category: 'COGNITIVE',
    icon: '🧠',
  },
  {
    id: 'turing_test',
    name: 'The Turing Test',
    codename: 'MOD_TURING_INTERROG',
    desc: 'Synthetic AI vs organic carbon discrimination engine',
    category: 'EVALUATION',
    icon: '🤖',
  },
  {
    id: 'survival',
    name: 'Survival Protocol',
    codename: 'MOD_CRISIS_SURVIVAL',
    desc: 'High-stakes emergency scenario survival evaluation engine',
    category: 'SIMULATION',
    icon: '☣️',
  },
  {
    id: 'wingman',
    name: 'The Wingman',
    codename: 'MOD_WINGMAN_SOCIAL',
    desc: 'Algorithmic conversational wit & social icebreaker generator',
    category: 'SOCIAL_AI',
    icon: '💬',
  },
  {
    id: 'cyber_sprint',
    name: 'Cyber Sprint',
    codename: 'MOD_CYBER_SPRINT',
    desc: 'Real-time terminal velocity typing arcade (Zero-API)',
    category: 'REACTION_CORE',
    icon: '⌨️',
  },
  {
    id: 'signal_sync',
    name: 'Signal Sync',
    codename: 'MOD_SIGNAL_SYNC',
    desc: 'Oscilloscope harmonic resonance rhythm calibration (Zero-API)',
    category: 'REACTION_CORE',
    icon: '⚡',
  },
  {
    id: 'overclock',
    name: 'Overclock',
    codename: 'MOD_CPU_OVERCLOCK',
    desc: 'Thermal runaway limit push & quantum core data banking (Zero-API)',
    category: 'RISK_SYSTEM',
    icon: '🔥',
  },
  {
    id: 'vault',
    name: 'The Vault',
    codename: 'MOD_VAULT_RESERVE',
    desc: 'Classified sanctuary & emotional intelligence conversational core',
    category: 'RESTRICTED',
    icon: '🔒',
  },
]

// ── Main Component ─────────────────────────────────────────────────────────────

export function AdminConsole() {
  const { user, session } = useAuth()
  const [activeTab, setActiveTab] = useState<'watchdog' | 'diagnostics' | 'users' | 'audit'>('watchdog')

  // Core Data
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [selectedUser, setSelectedUser] = useState<AdminUser | null>(null)
  const [diagnostics, setDiagnostics] = useState<DiagnosticsData | null>(null)
  const [apiReport, setApiReport] = useState<ApiReportData | null>(null)
  const [livePings, setLivePings] = useState<LivePingResult[] | null>(null)
  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>([])
  const [clientDiag, setClientDiag] = useState<ClientDiagnostics | null>(null)

  // Status & Loaders
  const [loading, setLoading] = useState<boolean>(true)
  const [togglingGame, setTogglingGame] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<boolean>(false)
  const [pingingServices, setPingingServices] = useState<boolean>(false)
  const [runningMasterScan, setRunningMasterScan] = useState<boolean>(false)
  const [toast, setToast] = useState<{ text: string; type: 'success' | 'error' | 'info' } | null>(null)

  // Filters & Dialogs
  const [userSearch, setUserSearch] = useState<string>('')
  const [userFilter, setUserFilter] = useState<'all' | 'banned' | 'active'>('all')
  const [auditFilter, setAuditFilter] = useState<string>('ALL')
  const [auditSearch, setAuditSearch] = useState<string>('')
  const [maintenanceConfirmOpen, setMaintenanceConfirmOpen] = useState<boolean>(false)
  const [bulkKillConfirmOpen, setBulkKillConfirmOpen] = useState<boolean>(false)
  const [currentTime, setCurrentTime] = useState<string>(new Date().toISOString())

  const showToast = (text: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ text, type })
    setTimeout(() => setToast(null), 4000)
  }

  // Live clock
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date().toISOString())
    }, 1000)
    return () => clearInterval(timer)
  }, [])

  // Measure Client Diagnostics (FPS, Storage, DOM, Network, Viewport)
  const runClientDiagnostics = useCallback(async (): Promise<ClientDiagnostics> => {
    // 1. Storage Footprint
    let storageBytes = 0
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i)
        if (key) {
          storageBytes += (key.length + (localStorage.getItem(key) || '').length) * 2
        }
      }
    } catch {}

    // 2. JWT Expiry
    let jwtExpiresIn = 'N/A'
    if (session?.expires_at) {
      const diffSec = session.expires_at - Math.floor(Date.now() / 1000)
      if (diffSec > 0) {
        const m = Math.floor(diffSec / 60)
        const s = diffSec % 60
        jwtExpiresIn = `${m}m ${s}s`
      } else {
        jwtExpiresIn = 'EXPIRED'
      }
    }

    // 3. Measure RTT Ping to server
    const startPing = performance.now()
    try {
      await apiFetch('/api/status', { method: 'GET' })
    } catch {}
    const rttMs = Math.round(performance.now() - startPing)

    // 4. Measure Instantaneous FPS over 30 frames
    const fps = await new Promise<number>((resolve) => {
      let frames = 0
      const startTime = performance.now()
      function checkFrame() {
        frames++
        if (frames < 30) {
          requestAnimationFrame(checkFrame)
        } else {
          const elapsed = performance.now() - startTime
          const measured = Math.min(60, Math.round((frames / elapsed) * 1000))
          resolve(measured || 60)
        }
      }
      requestAnimationFrame(checkFrame)
    })

    const diag: ClientDiagnostics = {
      host: window.location.host,
      buildMode: (import.meta.env.MODE || 'production').toUpperCase(),
      jwtExpiresIn,
      storageKb: Math.round(storageBytes / 1024),
      onlineStatus: navigator.onLine,
      connectionType: (navigator as any).connection?.effectiveType?.toUpperCase() || 'BROADBAND',
      rttMs,
      fps,
      domNodes: document.querySelectorAll('*').length,
      viewport: `${window.innerWidth}px × ${window.innerHeight}px`,
      fontsLoaded: (document.fonts as any)?.status?.toUpperCase() || 'READY',
      dvhSupported: CSS.supports('height', '100dvh'),
    }

    setClientDiag(diag)
    return diag
  }, [session])

  // Sync Core Admin Data
  const syncAllData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, usersRes, auditRes] = await Promise.all([
        apiFetch('/api/admin/stats'),
        apiFetch('/api/admin/users'),
        apiFetch('/api/admin/audit-logs'),
      ])

      if (statsRes.ok) {
        const sData = await statsRes.json()
        setStats(sData)
      }
      if (usersRes.ok) {
        const uData = await usersRes.json()
        setUsers(Array.isArray(uData) ? uData : [])
      }
      if (auditRes.ok) {
        const aData = await auditRes.json()
        setAuditLogs(Array.isArray(aData) ? aData : [])
      }

      runClientDiagnostics().catch(() => {})
    } catch (err: any) {
      console.error('[AdminConsole] Sync error:', err)
      showToast(err?.message || 'Failed to sync with Overlord server', 'error')
    } finally {
      setLoading(false)
    }
  }, [runClientDiagnostics])

  useEffect(() => {
    syncAllData()
  }, [syncAllData])

  // Toggle Maintenance Mode
  const handleToggleMaintenance = async () => {
    if (!stats || actionLoading) return
    setActionLoading(true)
    const nextStatus = !stats.maintenance_mode

    try {
      const res = await apiFetch('/api/admin/maintenance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: nextStatus }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to update maintenance state'))
      }

      const data = await res.json()
      setStats((prev) => (prev ? { ...prev, maintenance_mode: data.maintenance_mode } : prev))
      showToast(
        data.maintenance_mode
          ? '⚠ MAINTENANCE MODE ACTIVATED: Non-admin traffic locked out.'
          : '✓ MAINTENANCE MODE CLEARED: Public arcade traffic restored.',
        data.maintenance_mode ? 'info' : 'success'
      )
      setMaintenanceConfirmOpen(false)
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Maintenance toggle failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Toggle Single Game Kill Switch
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
      showToast(
        `Module [${gameId.toUpperCase()}] switched to ${nextStatus ? 'ONLINE' : 'OFFLINE'}`,
        nextStatus ? 'success' : 'info'
      )
    } catch (err: any) {
      console.error('[AdminConsole] Toggle failed:', err)
      // Rollback
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

  // Emergency Bulk Toggle Games
  const handleBulkToggleGames = async (status: boolean) => {
    if (actionLoading) return
    setActionLoading(true)

    try {
      const res = await apiFetch('/api/admin/games/bulk-toggle', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      })

      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Bulk toggle failed'))
      }

      const data = await res.json()
      if (data.gameStatus) {
        setStats((prev) => (prev ? { ...prev, gameStatus: data.gameStatus } : prev))
      }
      showToast(
        status ? '✓ ALL 10 ARCADE MODULES RESTORED ONLINE' : '⚠ EMERGENCY: ALL 10 ARCADE MODULES KILLED',
        status ? 'success' : 'error'
      )
      setBulkKillConfirmOpen(false)
    } catch (err: any) {
      showToast(err?.message || 'Emergency command failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Reset User Daily Quota
  const handleResetQuota = async (userId: string, email: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/reset-quota`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to reset quota'))
      }
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, daily_plays: 0, ai_calls_count: 0 } : u))
      )
      if (selectedUser?.id === userId) {
        setSelectedUser((prev) => (prev ? { ...prev, daily_plays: 0, ai_calls_count: 0 } : prev))
      }
      showToast(`Quota cleared for <${email}> (daily_plays: 0)`, 'success')
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Quota reset failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Force Revoke User Session (Logout)
  const handleRevokeSession = async (userId: string, email: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/revoke-session`, {
        method: 'POST',
      })
      if (!res.ok) {
        throw new Error(await getApiErrorMessage(res, 'Failed to revoke session'))
      }
      showToast(`Session invalidated for <${email}>. Active tokens cancelled.`, 'info')
    } catch (err: any) {
      showToast(err?.message || 'Session revocation failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Ban User
  const handleBanUser = async (userId: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/ban`, { method: 'POST' })
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to ban user'))
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: true } : u)))
      setSelectedUser((prev) => (prev?.id === userId ? { ...prev, is_banned: true } : prev))
      showToast('Account suspended and blacklisted.', 'success')
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Ban failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Unban User
  const handleUnbanUser = async (userId: string) => {
    if (actionLoading) return
    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}/unban`, { method: 'POST' })
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to unban user'))
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, is_banned: false } : u)))
      setSelectedUser((prev) => (prev?.id === userId ? { ...prev, is_banned: false } : prev))
      showToast('Account unbanned and restored.', 'success')
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Unban failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Delete User
  const handleDeleteUser = async (userId: string, email: string) => {
    if (actionLoading) return
    const confirmed = window.confirm(
      `PERMANENT PURGE WARNING: Delete user <${email}> from Supabase Auth & Profiles? This cannot be undone.`
    )
    if (!confirmed) return

    setActionLoading(true)
    try {
      const res = await apiFetch(`/api/admin/users/${userId}`, { method: 'DELETE' })
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Failed to delete user'))
      setUsers((prev) => prev.filter((u) => u.id !== userId))
      setSelectedUser(null)
      showToast(`User <${email}> purged from system.`, 'success')
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Delete failed', 'error')
    } finally {
      setActionLoading(false)
    }
  }

  // Run Master Diagnostics Scan
  const handleRunMasterScan = async () => {
    setRunningMasterScan(true)
    try {
      const [diagRes, reportRes] = await Promise.all([
        apiFetch('/api/admin/diagnostics'),
        apiFetch('/api/admin/api-report'),
        runClientDiagnostics(),
      ])

      if (diagRes.ok) setDiagnostics(await diagRes.json())
      if (reportRes.ok) setApiReport(await reportRes.json())
      showToast('✓ Master diagnostic suite completed successfully.', 'success')
    } catch (err: any) {
      showToast(err?.message || 'Diagnostics scan failed', 'error')
    } finally {
      setRunningMasterScan(false)
    }
  }

  // Live Ping External API Keys
  const handleLivePingKeys = async () => {
    setPingingServices(true)
    try {
      const res = await apiFetch('/api/admin/live-ping', { method: 'POST' })
      if (!res.ok) throw new Error(await getApiErrorMessage(res, 'Live ping failed'))
      const data = await res.json()
      setLivePings(data.results || [])
      showToast(`Ping complete: ${data.results?.length || 0} external endpoints evaluated.`, 'success')
      syncAllData()
    } catch (err: any) {
      showToast(err?.message || 'Live ping failed', 'error')
    } finally {
      setPingingServices(false)
    }
  }

  // Filtered Users
  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.email.toLowerCase().includes(userSearch.toLowerCase()) ||
      u.id.toLowerCase().includes(userSearch.toLowerCase())
    if (!matchesSearch) return false
    if (userFilter === 'banned') return u.is_banned === true
    if (userFilter === 'active') return !u.is_banned
    return true
  })

  // Filtered Audit Logs
  const filteredLogs = auditLogs.filter((log) => {
    const matchesAction = auditFilter === 'ALL' || log.action.toUpperCase().includes(auditFilter)
    const matchesSearch =
      !auditSearch ||
      log.action.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.target.toLowerCase().includes(auditSearch.toLowerCase()) ||
      log.admin_email.toLowerCase().includes(auditSearch.toLowerCase())
    return matchesAction && matchesSearch
  })

  // Total active games count
  const activeGamesCount = stats?.gameStatus
    ? Object.values(stats.gameStatus).filter(Boolean).length
    : 0

  // Safe tab fallback: any unrecognized tab value renders the watchdog view.
  const VALID_TABS = ['watchdog', 'diagnostics', 'users', 'audit'] as const
  const safeTab = (VALID_TABS as readonly string[]).includes(activeTab)
    ? activeTab
    : 'watchdog'

  return (
    <div className="min-h-screen bg-[#070709] text-white font-mono selection:bg-cyan-500/30 selection:text-cyan-200">
      {/* ── Top Hacker Status Banner ────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 bg-[#070709]/95 backdrop-blur-md border-b border-white/10 px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-[0_0_12px_#00F5FF] animate-pulse" />
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs uppercase tracking-[0.25em] text-cyan-400 font-black">
                OVERLORD_CONSOLE // OP_SYSTEM
              </span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300 font-bold">
                v2.4 SECURE
              </span>
            </div>
            <div className="text-[10px] text-white/40 flex items-center gap-2">
              <span>ADMIN: <strong className="text-white/80">{user?.email || 'AUTHENTICATED'}</strong></span>
              <span>•</span>
              <span className="text-emerald-400">{currentTime.split('T')[1].replace('Z', '')} UTC</span>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={syncAllData}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 border border-white/15 text-[11px] font-bold tracking-wider uppercase text-white/80 hover:text-white transition cursor-pointer flex items-center gap-1.5"
          >
            <span className={loading ? 'animate-spin' : ''}>↺</span>
            <span>SYNC TELEMETRY</span>
          </button>

          <Link
            to="/"
            className="px-3 py-1.5 rounded-lg bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-[11px] font-bold tracking-wider uppercase text-cyan-300 transition"
          >
            ‹ ARCADE ROOT
          </Link>
        </div>
      </header>

      {/* ── Toast Notification ──────────────────────────────────────────────── */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className={`fixed top-16 right-4 z-50 px-4 py-2.5 rounded-xl border backdrop-blur-xl text-xs font-bold tracking-wide shadow-2xl flex items-center gap-2 ${
              toast.type === 'error'
                ? 'bg-red-950/80 border-red-500/60 text-red-200 shadow-[0_0_30px_rgba(255,55,95,0.4)]'
                : toast.type === 'info'
                ? 'bg-amber-950/80 border-amber-500/60 text-amber-200 shadow-[0_0_30px_rgba(255,159,10,0.4)]'
                : 'bg-emerald-950/80 border-emerald-500/60 text-emerald-200 shadow-[0_0_30px_rgba(48,209,88,0.4)]'
            }`}
          >
            <span>{toast.type === 'error' ? '⛔' : toast.type === 'info' ? '⚠️' : '✓'}</span>
            <span>{toast.text}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <main className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* ── Live System Pulse Cards (always visible) ──────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            {
              label: 'ACTIVE MODULES',
              value: `${activeGamesCount} / 10`,
              sub: activeGamesCount === 10 ? 'ALL SYSTEMS GO' : `${10 - activeGamesCount} OFFLINE`,
              color: activeGamesCount === 10 ? 'text-emerald-400' : 'text-amber-400',
              border: activeGamesCount === 10 ? 'border-emerald-500/30' : 'border-amber-500/30',
            },
            {
              label: 'TOTAL USERS',
              value: stats?.totalUsers ?? '...',
              sub: 'AUTH.USERS',
              color: 'text-cyan-400',
              border: 'border-cyan-500/30',
            },
            {
              label: 'PLAYS TODAY',
              value: stats?.totalPlaysToday ?? '...',
              sub: 'ROLLOVER @ 00:00 UTC',
              color: 'text-purple-400',
              border: 'border-purple-500/30',
            },
            {
              label: 'AI CALLS TODAY',
              value: stats?.totalAiCallsToday ?? '...',
              sub: '3-TIER FAILOVER',
              color: 'text-emerald-400',
              border: 'border-emerald-500/30',
            },
            {
              label: 'CLIENT RTT',
              value: clientDiag ? `${clientDiag.rttMs}ms` : '...',
              sub: 'DIRECT PING',
              color: 'text-cyan-300',
              border: 'border-cyan-500/30',
            },
            {
              label: 'SERVER MEMORY',
              value: diagnostics?.memoryMb ? `${diagnostics.memoryMb.heapUsed}MB` : 'LIVE',
              sub: diagnostics?.memoryMb ? `RSS ${diagnostics.memoryMb.rss}MB` : 'EXPRESS NODE',
              color: 'text-amber-400',
              border: 'border-amber-500/30',
            },
          ].map((card, i) => (
            <div
              key={i}
              className={`p-4 rounded-xl bg-white/[0.02] border backdrop-blur-md ${card.border}`}
            >
              <div className="text-[10px] text-white/40 tracking-widest uppercase font-semibold mb-1">
                {card.label}
              </div>
              <div className={`text-xl sm:text-2xl font-black font-mono tracking-tight ${card.color}`}>
                {card.value}
              </div>
              <div className="text-[9px] text-white/30 tracking-wider uppercase mt-1">
                {card.sub}
              </div>
            </div>
          ))}
        </div>

        {/* ── Navigation Tabs (OP SYSTEM CONSOLE) ───────────────────────────── */}
        <div className="rounded-2xl border border-cyan-500/25 bg-[#0A0A0F]/90 backdrop-blur-md px-2 sm:px-3 shadow-[0_0_30px_rgba(0,245,255,0.06)]">
          <div className="flex gap-1.5 overflow-x-auto py-2">
            {[
              { id: 'watchdog', label: '01 // WATCHDOG & KILL SWITCHES', badge: stats?.maintenance_mode ? 'MAINTENANCE' : 'NORMAL' },
              { id: 'diagnostics', label: '02 // DEEP SYSTEM DIAGNOSTICS', badge: '5 CHECKS' },
              { id: 'users', label: '03 // USER DATABASE', badge: `${users.length} PROFILES` },
              { id: 'audit', label: '04 // AUDIT LOGS', badge: `${auditLogs.length} LOGS` },
            ].map((tab) => {
              const isActive = safeTab === tab.id
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => {
                    if (!isActive) playClick()
                    setActiveTab(tab.id as any)
                    if (tab.id === 'diagnostics' && !diagnostics) {
                      handleRunMasterScan()
                    }
                  }}
                  className={`px-4 py-2.5 rounded-lg text-xs font-black tracking-widest uppercase transition-all whitespace-nowrap cursor-pointer flex items-center gap-2 ${
                    isActive
                      ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-200 shadow-[0_0_22px_rgba(0,245,255,0.35)]'
                      : 'bg-white/[0.03] border border-white/10 text-white/55 hover:text-white hover:bg-white/[0.07] hover:border-white/20'
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`text-[9px] px-1.5 py-0.5 rounded font-mono ${
                      isActive
                        ? 'bg-cyan-400/20 text-cyan-200 border border-cyan-400/40'
                        : 'bg-white/10 text-white/40'
                    }`}
                  >
                    {tab.badge}
                  </span>
                </button>
              )
            })}
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 1: WATCHDOG // COMMAND                                          */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {safeTab === 'watchdog' && (
          <div className="space-y-6">
            {/* Maintenance Mode Emergency Alert Banner */}
            <div
              className={`p-5 rounded-2xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                stats?.maintenance_mode
                  ? 'bg-red-950/30 border-red-500/60 shadow-[0_0_40px_rgba(255,55,95,0.25)]'
                  : 'bg-emerald-950/20 border-emerald-500/40 shadow-[0_0_30px_rgba(48,209,88,0.1)]'
              }`}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className={`w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0 border ${
                    stats?.maintenance_mode
                      ? 'bg-red-500/20 border-red-500/50 text-red-400 shadow-[0_0_15px_rgba(255,55,95,0.4)] animate-pulse'
                      : 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400'
                  }`}
                >
                  {stats?.maintenance_mode ? '⛔' : '🛡️'}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2
                      className={`text-sm font-black tracking-wider uppercase ${
                        stats?.maintenance_mode ? 'text-red-400' : 'text-emerald-400'
                      }`}
                    >
                      {stats?.maintenance_mode
                        ? 'GLOBAL MAINTENANCE MODE ACTIVE'
                        : 'SYSTEM ONLINE // NORMAL OPERATION'}
                    </h2>
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded font-bold uppercase ${
                        stats?.maintenance_mode
                          ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                          : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                      }`}
                    >
                      {stats?.maintenance_mode ? 'HTTP 503 ENFORCED' : 'ALLOWING TRAFFIC'}
                    </span>
                  </div>
                  <p className="text-xs text-white/50 mt-1 max-w-2xl leading-relaxed">
                    {stats?.maintenance_mode
                      ? 'All non-admin public requests to arcade games and game routes are actively rejected with 503. Only authenticated admin sessions have clearance.'
                      : 'Platform is serving public arcade players globally. Zero bypass blocks detected.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 self-end md:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setMaintenanceConfirmOpen(true)}
                  className={`px-4 py-2.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer border shadow-lg ${
                    stats?.maintenance_mode
                      ? 'bg-emerald-500/20 hover:bg-emerald-500/30 border-emerald-500/50 text-emerald-300 shadow-[0_0_20px_rgba(48,209,88,0.3)]'
                      : 'bg-red-500/20 hover:bg-red-500/30 border-red-500/50 text-red-300 shadow-[0_0_20px_rgba(255,55,95,0.3)]'
                  }`}
                >
                  {stats?.maintenance_mode ? 'DEACTIVATE MAINTENANCE ↻' : 'ENTER MAINTENANCE MODE ⛔'}
                </button>
              </div>
            </div>

            {/* Emergency Controls Header */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-white/[0.02] border border-white/10">
              <div>
                <h3 className="text-xs font-black tracking-widest uppercase text-white/90">
                  KILL SWITCH MATRIX // 10 CANONICAL GAME SUBSYSTEMS
                </h3>
                <p className="text-[11px] text-white/40 mt-0.5">
                  Instant live toggle without server restart. Quotas and game logic verify live status on every request.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBulkKillConfirmOpen(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 border border-red-500/40 text-red-300 text-[10px] font-black tracking-widest uppercase transition cursor-pointer"
                >
                  KILL ALL GAMES ⛔
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleGames(true)}
                  disabled={actionLoading}
                  className="px-3 py-1.5 rounded-lg bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-[10px] font-black tracking-widest uppercase transition cursor-pointer"
                >
                  RESTORE ALL ⚡
                </button>
              </div>
            </div>

            {/* 10-Game Kill Switch Matrix Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {GAME_DEFINITIONS.map((game) => {
                const isOnline = stats?.gameStatus ? stats.gameStatus[game.id] !== false : true
                const isToggling = togglingGame === game.id

                return (
                  <div
                    key={game.id}
                    className={`p-4 rounded-2xl border transition-all duration-300 flex flex-col justify-between ${
                      isOnline
                        ? 'bg-white/[0.02] hover:bg-white/[0.04] border-white/10 shadow-[0_0_20px_rgba(0,0,0,0.4)]'
                        : 'bg-red-950/15 border-red-500/40 shadow-[0_0_25px_rgba(255,55,95,0.15)]'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <span className="text-xl">{game.icon}</span>
                          <div>
                            <h4 className="text-sm font-bold text-white tracking-wide">{game.name}</h4>
                            <span className="text-[9px] text-white/40 tracking-wider">{game.codename}</span>
                          </div>
                        </div>

                        <span
                          className={`px-2 py-0.5 rounded text-[9px] font-mono font-bold tracking-wider uppercase border ${
                            isOnline
                              ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300'
                              : 'bg-red-500/20 border-red-500/50 text-red-300'
                          }`}
                        >
                          {isOnline ? 'ONLINE' : 'KILLED'}
                        </span>
                      </div>

                      <p className="text-[11px] text-white/50 leading-relaxed mb-3">
                        {game.desc}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-white/5 flex items-center justify-between gap-2">
                      <span className="text-[9px] px-2 py-0.5 rounded bg-white/5 text-white/40 font-mono">
                        {game.category}
                      </span>

                      <button
                        type="button"
                        onClick={() => handleToggleGame(game.id, isOnline)}
                        disabled={isToggling}
                        className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-widest uppercase transition-all flex items-center gap-1.5 cursor-pointer border ${
                          isOnline
                            ? 'bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/30'
                            : 'bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 border-emerald-500/40'
                        }`}
                      >
                        {isToggling ? (
                          <span className="animate-spin">⏳</span>
                        ) : isOnline ? (
                          <span>DEACTIVATE ⛔</span>
                        ) : (
                          <span>ENGAGE ONLINE ⚡</span>
                        )}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 2: DIAGNOSTICS // DEEP SCAN                                     */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {safeTab === 'diagnostics' && (
          <div className="space-y-6">
            {/* Master Scan Trigger Banner */}
            <div className="p-5 rounded-2xl bg-gradient-to-r from-cyan-950/30 via-black to-purple-950/30 border border-cyan-500/30 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping" />
                  <h3 className="text-sm font-black tracking-widest uppercase text-cyan-300">
                    DEEP TELEMETRY & SYSTEM INTEGRITY SCAN
                  </h3>
                </div>
                <p className="text-xs text-white/50 mt-1 max-w-xl">
                  Low-overhead diagnostics inspecting frontend rendering performance, server telemetry counters, all 10 game modules, and masked API connectivity.
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleRunMasterScan}
                  disabled={runningMasterScan}
                  className="px-4 py-2.5 rounded-xl bg-cyan-400 text-black hover:bg-cyan-300 text-xs font-black tracking-widest uppercase transition shadow-[0_0_20px_rgba(0,245,255,0.4)] flex items-center gap-2 cursor-pointer"
                >
                  <span className={runningMasterScan ? 'animate-spin' : ''}>⚡</span>
                  <span>{runningMasterScan ? 'SCANNING SYSTEM...' : 'RUN ALL DIAGNOSTICS'}</span>
                </button>
              </div>
            </div>

            {/* 5-Module Diagnostic Matrix */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Module 1: Frontend Checker */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-cyan-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🖥️</span>
                    <h4 className="text-xs font-black tracking-wider uppercase text-cyan-400">
                      MODULE 1: CLIENT & FRONTEND HEALTH
                    </h4>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 font-bold">
                    ACTIVE BROWSER
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">HOST ORIGIN</span>
                    <span className="text-cyan-300 font-bold">{clientDiag?.host || window.location.host}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">VITE BUILD MODE</span>
                    <span className="text-emerald-400 font-bold">{clientDiag?.buildMode || 'PRODUCTION'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">SESSION JWT VALIDITY</span>
                    <span className="text-purple-300 font-bold">{clientDiag?.jwtExpiresIn || 'ACTIVE'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">STORAGE FOOTPRINT</span>
                    <span className="text-white/80 font-bold">{clientDiag?.storageKb ?? 0} KB (localStorage)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">NETWORK DOWNLINK</span>
                    <span className="text-emerald-400 font-bold">
                      {clientDiag?.connectionType} • {clientDiag?.onlineStatus ? 'ONLINE' : 'OFFLINE'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">ROUND-TRIP PING (RTT)</span>
                    <span className="text-cyan-300 font-mono font-bold">{clientDiag?.rttMs ?? 0} ms</span>
                  </div>
                </div>
              </div>

              {/* Module 2: Backend & Server Health */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-purple-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚙️</span>
                    <h4 className="text-xs font-black tracking-wider uppercase text-purple-400">
                      MODULE 2: SERVER ENGINE & RUNTIME
                    </h4>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-300 border border-purple-500/30 font-bold">
                    EXPRESS TELEMETRY
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">NODE RUNTIME</span>
                    <span className="text-white/90 font-bold">
                      {diagnostics?.nodeVersion || 'v20.x'} on {diagnostics?.platform || 'linux'} ({diagnostics?.arch || 'x64'})
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">PROCESS UPTIME</span>
                    <span className="text-emerald-400 font-bold">
                      {diagnostics?.processUptimeSeconds
                        ? `${Math.floor(diagnostics.processUptimeSeconds / 3600)}h ${Math.floor((diagnostics.processUptimeSeconds % 3600) / 60)}m ${diagnostics.processUptimeSeconds % 60}s`
                        : 'CONNECTED'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">EVENT LOOP LAG</span>
                    <span className="text-emerald-400 font-bold">{diagnostics?.eventLoopLagMs ?? 0} ms</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">DATABASE PING</span>
                    <span className="text-cyan-300 font-bold">
                      {diagnostics?.database?.latencyMs ?? 0} ms [{diagnostics?.database?.status || 'ONLINE'}]
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">HTTP ERROR COUNTERS</span>
                    <span className="font-mono text-white/80">
                      4xx: <strong className="text-amber-400">{diagnostics?.errorCounters?.error4xx ?? 0}</strong> • 
                      5xx: <strong className="text-red-400">{diagnostics?.errorCounters?.error5xx ?? 0}</strong> • 
                      429: <strong className="text-cyan-400">{diagnostics?.errorCounters?.rateLimit429 ?? 0}</strong>
                    </span>
                  </div>
                </div>

                {/* Visual Memory Gauge */}
                {diagnostics?.memoryMb && (
                  <div className="mt-3 p-2.5 rounded-xl bg-white/[0.02] border border-white/5">
                    <div className="flex justify-between text-[10px] text-white/40 mb-1">
                      <span>HEAP USAGE: {diagnostics.memoryMb.heapUsed}MB / {diagnostics.memoryMb.heapTotal}MB</span>
                      <span>RSS: {diagnostics.memoryMb.rss}MB</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-cyan-400 to-purple-400"
                        style={{
                          width: `${Math.min(100, (diagnostics.memoryMb.heapUsed / diagnostics.memoryMb.heapTotal) * 100)}%`,
                        }}
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* Module 3: UI / UX & Performance Checker */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-emerald-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">⚡</span>
                    <h4 className="text-xs font-black tracking-wider uppercase text-emerald-400">
                      MODULE 3: UI / UX & FPS PERFORMANCE
                    </h4>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 font-bold">
                    60-FRAME SAMPLER
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">MEASURED FPS</span>
                    <span className="text-emerald-400 font-bold font-mono">
                      {clientDiag?.fps ?? 60}.0 FPS [STABLE]
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">DOM NODE COMPLEXITY</span>
                    <span className="text-white/90 font-bold font-mono">{clientDiag?.domNodes ?? 0} NODES</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">VIEWPORT DIMENSIONS</span>
                    <span className="text-cyan-300 font-mono font-bold">{clientDiag?.viewport}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-white/5">
                    <span className="text-white/40">DYNAMIC DVH SUPPORT</span>
                    <span className="text-emerald-400 font-bold">
                      {clientDiag?.dvhSupported ? 'SUPPORTED [100dvh]' : 'FALLBACK'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-white/40">WEB FONT ENGINE</span>
                    <span className="text-purple-300 font-bold font-mono">{clientDiag?.fontsLoaded}</span>
                  </div>
                </div>
              </div>

              {/* Module 4: API Keys & External Services Telemetry */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-amber-500/20 backdrop-blur-md">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🔑</span>
                    <h4 className="text-xs font-black tracking-wider uppercase text-amber-400">
                      MODULE 4: MASKED KEYS & LIVE PING
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={handleLivePingKeys}
                    disabled={pingingServices}
                    className="text-[10px] px-2.5 py-1 rounded bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 font-bold uppercase transition cursor-pointer flex items-center gap-1"
                  >
                    <span className={pingingServices ? 'animate-spin' : ''}>⚡</span>
                    <span>LIVE PING</span>
                  </button>
                </div>

                <div className="space-y-1.5 text-xs">
                  {apiReport?.keys ? (
                    Object.entries(apiReport.keys).map(([k, val]) => (
                      <div key={k} className="flex justify-between items-center py-1 border-b border-white/5 text-[11px]">
                        <span className="text-white/50 font-mono">{k}</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-white/70">{val.masked}</span>
                          <span
                            className={`text-[9px] px-1.5 py-0.2 rounded font-bold ${
                              val.status === 'CONFIGURED'
                                ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                                : 'bg-red-500/10 text-red-400 border border-red-500/30'
                            }`}
                          >
                            {val.status}
                          </span>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-white/40 text-center py-4">Click "RUN ALL DIAGNOSTICS" to inspect keys</div>
                  )}
                </div>

                {/* 3-Tier AI Failover Telemetry */}
                {apiReport?.aiFailover && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-black tracking-widest uppercase text-amber-300/80 mb-2">
                      3-TIER AI FAILOVER TELEMETRY
                    </div>
                    <div className="space-y-1.5">
                      {apiReport.aiFailover.providers.map((p) => (
                        <div key={p.name} className="flex items-center justify-between gap-2 text-[11px] py-1 border-b border-white/5">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="font-bold text-white/80">{p.name}</span>
                            <span className="text-[9px] text-white/30 font-mono">{p.tier}</span>
                            <span className="font-mono text-white/50 truncate">{p.key.masked}</span>
                          </div>
                          <div className="flex items-center gap-2 shrink-0">
                            <span className="text-[9px] text-white/40 font-mono">
                              {p.calls} calls • {p.errors} err • {p.rateLimit429s}×429
                            </span>
                            <span
                              className={`text-[9px] px-1.5 py-0.5 rounded font-bold border ${
                                p.status === 'CONFIGURED'
                                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                                  : 'bg-red-500/10 text-red-400 border-red-500/30'
                              }`}
                            >
                              {p.status}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="mt-2 text-[10px] text-white/40 leading-relaxed">
                      QUOTA: {apiReport.aiFailover.thresholds.dailyAiCallsPerUser} AI calls/user/day •{' '}
                      {apiReport.aiFailover.thresholds.dailyPlaysPerUser} plays/user/day
                      <br />
                      <span className="text-white/30">{apiReport.aiFailover.thresholds.rateLimits}</span>
                    </div>
                  </div>
                )}

                {/* Endpoint Traffic Breakdown */}
                {apiReport?.traffic && (
                  <div className="mt-4 pt-3 border-t border-white/10">
                    <div className="text-[10px] font-black tracking-widest uppercase text-amber-300/80 mb-2">
                      ENDPOINT TRAFFIC BREAKDOWN
                    </div>
                    <div className="space-y-1 text-[11px]">
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-white/40">TOTAL REQUESTS (SINCE BOOT)</span>
                        <span className="text-white/90 font-bold font-mono">{apiReport.traffic.totalRequests}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-white/40">/API/GAMES HITS</span>
                        <span className="text-cyan-300 font-bold font-mono">{apiReport.traffic.endpointCounts?.games ?? 0}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-white/40">/API/LEADERBOARD HITS</span>
                        <span className="text-cyan-300 font-bold font-mono">{apiReport.traffic.endpointCounts?.leaderboard ?? 0}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-white/40">/API/AUTH HITS</span>
                        <span className="text-cyan-300 font-bold font-mono">{apiReport.traffic.endpointCounts?.auth ?? 0}</span>
                      </div>
                      <div className="flex justify-between py-1 border-b border-white/5">
                        <span className="text-white/40">AVG RESPONSE LATENCY</span>
                        <span className="text-emerald-400 font-bold font-mono">{apiReport.traffic.averageLatencyMs} ms</span>
                      </div>
                      <div className="flex justify-between py-1">
                        <span className="text-white/40">CACHE-CONTROL HEADER</span>
                        <span className={`font-bold font-mono ${apiReport.traffic.cacheControlVerified ? 'text-emerald-400' : 'text-red-400'}`}>
                          {apiReport.traffic.cacheControlVerified ? 'NO-STORE ✓' : 'MISSING'}
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Module 5: All-Games Content & Health Checker */}
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-rose-500/20 backdrop-blur-md lg:col-span-2">
                <div className="flex items-center justify-between pb-3 border-b border-white/10 mb-4">
                  <div className="flex items-center gap-2">
                    <span className="text-base">🎮</span>
                    <h4 className="text-xs font-black tracking-wider uppercase text-rose-400">
                      MODULE 5: ALL-GAMES CONTENT & HEALTH CHECKER
                    </h4>
                  </div>
                  <span className="text-[9px] px-2 py-0.5 rounded bg-rose-500/10 text-rose-300 border border-rose-500/30 font-bold">
                    LIVE DB COUNTS
                  </span>
                </div>

                {apiReport?.gamesContent ? (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-[11px]">
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-white/40 text-[9px] uppercase tracking-wider">HL QUESTIONS</div>
                        <div className="text-cyan-300 font-bold font-mono">{apiReport.gamesContent.hl_questions.total} <span className="text-white/40">({apiReport.gamesContent.hl_questions.unused} fresh)</span></div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-white/40 text-[9px] uppercase tracking-wider">TURING SCENARIOS</div>
                        <div className="text-cyan-300 font-bold font-mono">{apiReport.gamesContent.turing_scenarios.total}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-white/40 text-[9px] uppercase tracking-wider">SURVIVAL SCENARIOS</div>
                        <div className="text-cyan-300 font-bold font-mono">{apiReport.gamesContent.survival_scenarios.total}</div>
                      </div>
                      <div className="p-2.5 rounded-lg bg-white/[0.02] border border-white/5">
                        <div className="text-white/40 text-[9px] uppercase tracking-wider">LEADERBOARD ROWS</div>
                        <div className="text-cyan-300 font-bold font-mono">{Object.values(apiReport.gamesContent.leaderboards).reduce((a, b) => a + b, 0)}</div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      {GAME_DEFINITIONS.map((game) => {
                        const online = apiReport.gamesContent!.gameStatus[game.id] !== false
                        const lb = apiReport.gamesContent!.leaderboards[game.id]
                        const hasContentPool =
                          game.id === 'higher_lower' ? apiReport.gamesContent!.hl_questions.total > 0
                          : game.id === 'turing_test' ? apiReport.gamesContent!.turing_scenarios.total > 0
                          : game.id === 'survival' ? apiReport.gamesContent!.survival_scenarios.total > 0
                          : true
                        return (
                          <div key={game.id} className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-[11px] ${
                            online
                              ? 'bg-emerald-950/15 border-emerald-500/25'
                              : 'bg-red-950/15 border-red-500/40'
                          }`}>
                            <div className="flex items-center gap-2 min-w-0">
                              <span>{game.icon}</span>
                              <span className="text-white/80 font-bold truncate">{game.name}</span>
                            </div>
                            <div className="flex items-center gap-2 shrink-0 font-mono text-[9px]">
                              {lb !== undefined && <span className="text-white/40">LB:{lb}</span>}
                              {game.id === 'higher_lower' && <span className="text-white/40">Q:{apiReport.gamesContent!.hl_questions.total}</span>}
                              {game.id === 'turing_test' && <span className="text-white/40">Q:{apiReport.gamesContent!.turing_scenarios.total}</span>}
                              {game.id === 'survival' && <span className="text-white/40">Q:{apiReport.gamesContent!.survival_scenarios.total}</span>}
                              <span className={online ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                {online ? 'ONLINE' : 'OFFLINE'}
                              </span>
                              {!hasContentPool && <span className="text-amber-400 font-bold">POOL:EMPTY</span>}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="text-white/40 text-center py-4 text-xs">Click "RUN ALL DIAGNOSTICS" to inspect game content health</div>
                )}
              </div>
            </div>

            {/* Live Ping Results Stream */}
            {livePings && livePings.length > 0 && (
              <div className="p-5 rounded-2xl bg-white/[0.02] border border-white/10">
                <h4 className="text-xs font-black tracking-wider uppercase text-cyan-400 mb-3">
                  EXTERNAL CONNECTIVITY RESULTS
                </h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {livePings.map((p, i) => (
                    <div
                      key={i}
                      className={`p-3 rounded-xl border ${
                        p.status === 'ONLINE'
                          ? 'bg-emerald-950/20 border-emerald-500/40'
                          : 'bg-red-950/20 border-red-500/40'
                      }`}
                    >
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-[11px] font-bold text-white">{p.provider}</span>
                        <span
                          className={`text-[9px] font-mono font-bold px-1.5 py-0.5 rounded ${
                            p.status === 'ONLINE' ? 'bg-emerald-400/20 text-emerald-300' : 'bg-red-400/20 text-red-300'
                          }`}
                        >
                          {p.status}
                        </span>
                      </div>
                      <div className="text-xs font-mono font-bold text-white/80">
                        LATENCY: <strong className="text-cyan-300">{p.latencyMs}ms</strong>
                      </div>
                      <p className="text-[10px] text-white/40 mt-1 truncate">{p.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 3: USER DATABASE                                                */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {safeTab === 'users' && (
          <div className="space-y-4">
            {/* Search & Filter Toolbar */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <span className="text-white/40">🔍</span>
                <input
                  type="text"
                  placeholder="SEARCH BY EMAIL OR USER ID..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-1">
                {(['all', 'active', 'banned'] as const).map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setUserFilter(filter)}
                    className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition ${
                      userFilter === filter
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                        : 'bg-white/5 text-white/50 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
                <span className="text-[11px] text-white/40 ml-3">
                  {filteredUsers.length} OF {users.length} PROFILES
                </span>
              </div>
            </div>

            {/* Users Table */}
            <div className="rounded-2xl border border-white/10 overflow-hidden bg-white/[0.01]">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-white/5 text-white/40 text-[10px] uppercase tracking-wider border-b border-white/10">
                    <tr>
                      <th className="p-3.5">USER / EMAIL</th>
                      <th className="p-3.5">STATUS</th>
                      <th className="p-3.5">DAILY PLAYS</th>
                      <th className="p-3.5">TOTAL PLAYS</th>
                      <th className="p-3.5">AI CALLS TODAY</th>
                      <th className="p-3.5">LAST PLAYED</th>
                      <th className="p-3.5 text-right">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 font-mono text-[11px]">
                    {filteredUsers.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="p-8 text-center text-white/40">
                          NO USER PROFILES MATCH SEARCH QUERY.
                        </td>
                      </tr>
                    ) : (
                      filteredUsers.map((u) => {
                        const daily = u.daily_plays ?? 0
                        return (
                          <tr key={u.id} className="hover:bg-white/[0.02] transition">
                            <td className="p-3.5">
                              <div className="font-sans font-bold text-white text-xs">{u.email}</div>
                              <div className="text-[9px] text-white/30 truncate max-w-[200px]">{u.id}</div>
                            </td>
                            <td className="p-3.5">
                              <span
                                className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                                  u.is_banned
                                    ? 'bg-red-500/20 border border-red-500/40 text-red-300'
                                    : 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                                }`}
                              >
                                {u.is_banned ? 'BANNED' : 'ACTIVE'}
                              </span>
                            </td>
                            <td className="p-3.5">
                              <span className={daily >= 10 ? 'text-red-400 font-bold' : 'text-cyan-300'}>
                                {daily} / 10
                              </span>
                            </td>
                            <td className="p-3.5 text-white/80">{u.total_plays ?? 0}</td>
                            <td className="p-3.5 text-emerald-400">{u.ai_calls_count}</td>
                            <td className="p-3.5 text-white/40 text-[10px]">
                              {u.last_played_at ? new Date(u.last_played_at).toLocaleTimeString() : 'NEVER'}
                            </td>
                            <td className="p-3.5 text-right">
                              <div className="flex items-center justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleResetQuota(u.id, u.email)}
                                  title="Reset user's daily plays counter to 0"
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 text-cyan-300 text-[9px] font-bold uppercase transition cursor-pointer"
                                >
                                  RESET QUOTA
                                </button>

                                {u.is_banned ? (
                                  <button
                                    type="button"
                                    onClick={() => handleUnbanUser(u.id)}
                                    disabled={actionLoading}
                                    className="px-2 py-1 rounded bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/30 text-emerald-300 text-[9px] font-bold uppercase transition cursor-pointer"
                                  >
                                    UNBAN
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={() => handleBanUser(u.id)}
                                    disabled={actionLoading}
                                    className="px-2 py-1 rounded bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 text-amber-300 text-[9px] font-bold uppercase transition cursor-pointer"
                                  >
                                    BAN
                                  </button>
                                )}

                                <button
                                  type="button"
                                  onClick={() => handleRevokeSession(u.id, u.email)}
                                  title="Force logout active user tokens"
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded bg-white/5 hover:bg-white/10 border border-white/15 text-white/70 text-[9px] font-bold uppercase transition cursor-pointer"
                                >
                                  LOGOUT
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleDeleteUser(u.id, u.email)}
                                  title="Permanently delete user profile"
                                  disabled={actionLoading}
                                  className="px-2 py-1 rounded bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 text-[9px] font-bold uppercase transition cursor-pointer"
                                >
                                  PURGE
                                </button>
                              </div>
                            </td>
                          </tr>
                        )
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════════ */}
        {/* TAB 4: AUDIT LOGS                                                   */}
        {/* ═══════════════════════════════════════════════════════════════════ */}
        {safeTab === 'audit' && (
          <div className="space-y-4">
            {/* Audit Toolbar */}
            <div className="p-4 rounded-xl bg-white/[0.02] border border-white/10 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <span className="text-white/40">📜</span>
                <input
                  type="text"
                  placeholder="FILTER AUDIT LOGS BY ACTION, TARGET, OR ADMIN..."
                  value={auditSearch}
                  onChange={(e) => setAuditSearch(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400"
                />
              </div>

              <div className="flex items-center gap-1 flex-wrap">
                {['ALL', 'MAINTENANCE', 'GAME', 'USER', 'QUOTA', 'PING'].map((filter) => (
                  <button
                    key={filter}
                    type="button"
                    onClick={() => setAuditFilter(filter)}
                    className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider transition ${
                      auditFilter === filter
                        ? 'bg-cyan-500/20 border border-cyan-400 text-cyan-300'
                        : 'bg-white/5 text-white/50 hover:text-white'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>

            {/* Audit Log Terminal Feed */}
            <div className="rounded-2xl border border-white/10 bg-black/80 p-4 font-mono text-xs overflow-hidden">
              <div className="flex justify-between items-center pb-3 border-b border-white/10 mb-3 text-[10px] text-white/40 uppercase">
                <span>TIMESTAMP // ACTION // TARGET</span>
                <span>ADMIN IDENTITY</span>
              </div>

              <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center text-white/40">
                    <p className="text-sm">NO AUDIT LOGS FOUND.</p>
                    <p className="text-[11px] text-white/30 mt-1">
                      Administrative mutations (Kill switches, Quota resets, Maintenance mode, Bans) are logged here automatically.
                    </p>
                  </div>
                ) : (
                  filteredLogs.map((log, idx) => (
                    <div
                      key={log.id || idx}
                      className="p-3 rounded-xl bg-white/[0.02] hover:bg-white/[0.04] border border-white/5 transition flex flex-col gap-1.5"
                    >
                      <div className="flex justify-between items-start gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] text-white/40">
                            {new Date(log.created_at).toLocaleString()}
                          </span>
                          <span
                            className={`text-[9px] px-2 py-0.5 rounded font-black tracking-wider uppercase border ${
                              log.action.includes('MAINTENANCE')
                                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                                : log.action.includes('RESET_QUOTA')
                                ? 'bg-cyan-500/20 border-cyan-500/40 text-cyan-300'
                                : log.action.includes('BAN')
                                ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                                : 'bg-emerald-500/20 border-emerald-500/40 text-emerald-300'
                            }`}
                          >
                            {log.action}
                          </span>
                          <span className="text-white/80 font-bold">
                            TARGET: <strong className="text-cyan-300">{log.target}</strong>
                          </span>
                        </div>

                        <span className="text-[10px] text-white/40 shrink-0">
                          BY: {log.admin_email}
                        </span>
                      </div>

                      {log.details && Object.keys(log.details).length > 0 && (
                        <pre className="text-[10px] text-white/50 bg-white/[0.02] p-2 rounded-lg overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        )}
      </main>

      {/* ── Maintenance Mode Confirmation Modal ─────────────────────────────── */}
      <AnimatePresence>
        {maintenanceConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full p-6 rounded-2xl bg-[#0D0D14] border-2 border-red-500/60 shadow-[0_0_60px_rgba(255,55,95,0.4)] text-center"
            >
              <div className="text-4xl mb-3">⚠️</div>
              <h3 className="text-lg font-black uppercase tracking-wider text-red-500 mb-2">
                {stats?.maintenance_mode
                  ? 'RESTORE PUBLIC ACCESS?'
                  : 'ENGAGE GLOBAL MAINTENANCE MODE?'}
              </h3>
              <p className="text-xs text-white/60 mb-6 leading-relaxed">
                {stats?.maintenance_mode
                  ? 'This will immediately reopen public access to all arcade games across Pixelverse.'
                  : 'This will lock out ALL non-admin users across Cloudflare Workers. Any active game sessions will be terminated and return HTTP 503 MAINTENANCE_MODE.'}
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMaintenanceConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition cursor-pointer"
                >
                  CANCEL
                </button>
                <button
                  type="button"
                  onClick={handleToggleMaintenance}
                  disabled={actionLoading}
                  className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition cursor-pointer ${
                    stats?.maintenance_mode
                      ? 'bg-emerald-500 text-black hover:bg-emerald-400 shadow-[0_0_20px_rgba(48,209,88,0.4)]'
                      : 'bg-red-500 text-white hover:bg-red-600 shadow-[0_0_20px_rgba(255,55,95,0.4)]'
                  }`}
                >
                  {stats?.maintenance_mode ? 'RESTORE PUBLIC' : 'ENGAGE 503 LOCKOUT'}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ── Emergency Bulk Kill Confirmation Modal ──────────────────────────── */}
      <AnimatePresence>
        {bulkKillConfirmOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="max-w-md w-full p-6 rounded-2xl bg-[#0D0D14] border-2 border-red-500/60 shadow-[0_0_60px_rgba(255,55,95,0.4)] text-center"
            >
              <div className="text-4xl mb-3">⛔</div>
              <h3 className="text-lg font-black uppercase tracking-wider text-red-500 mb-2">
                EMERGENCY: KILL ALL 10 GAMES?
              </h3>
              <p className="text-xs text-white/60 mb-6 leading-relaxed">
                This will immediately set all 10 canonical game modules to OFFLINE in app_settings. All game entrypoints and generation APIs will return 403 GAME_DISABLED.
              </p>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setBulkKillConfirmOpen(false)}
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-bold uppercase tracking-wider text-white/60 hover:text-white transition cursor-pointer"
                >
                  ABORT
                </button>
                <button
                  type="button"
                  onClick={() => handleBulkToggleGames(false)}
                  disabled={actionLoading}
                  className="flex-1 py-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 text-xs font-black uppercase tracking-widest shadow-[0_0_25px_rgba(255,55,95,0.5)] transition cursor-pointer"
                >
                  CONFIRM KILL ALL
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default AdminConsole
