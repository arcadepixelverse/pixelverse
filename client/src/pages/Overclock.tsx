import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { useAuth } from '../context/AuthContext'

// Web Audio Synthesizer for Overclock
function playCpuTone(type: 'boost' | 'bank' | 'meltdown' | 'extract' | 'siren' | 'start') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'boost') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.14)
      osc.start(now)
      osc.stop(now + 0.14)
    } else if (type === 'bank') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06) // E5
      osc.frequency.setValueAtTime(1046.5, now + 0.12) // C6
      gain.gain.setValueAtTime(0.28, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'meltdown') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.linearRampToValueAtTime(30, now + 0.8)
      gain.gain.setValueAtTime(0.45, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
      osc.start(now)
      osc.stop(now + 0.8)
    } else if (type === 'extract') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (type === 'siren') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(750, now)
      osc.frequency.linearRampToValueAtTime(950, now + 0.12)
      gain.gain.setValueAtTime(0.15, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.16)
      osc.start(now)
      osc.stop(now + 0.16)
    } else if (type === 'start') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.15)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {}
}

export function Overclock() {
  const { refreshQuota } = useAuth()
  const [gameState, setGameState] = useState<'idle' | 'running' | 'meltdown' | 'extracted'>('idle')
  const [heat, setHeat] = useState<number>(0) // 0 to 100%
  const [multiplier, setMultiplier] = useState<number>(1.0)
  const [cycleClicks, setCycleClicks] = useState<number>(0)
  const [unbankedPoints, setUnbankedPoints] = useState<number>(0)
  const [bankedScore, setBankedScore] = useState<number>(0)
  const [lastJump, setLastJump] = useState<number | null>(null)
  const [recentBankNotice, setRecentBankNotice] = useState<number | null>(null)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  // Real-time animation refs to avoid closure stalls
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const heatRef = useRef<number>(0)
  const multiplierRef = useRef<number>(1.0)
  const cycleClicksRef = useRef<number>(0)
  const unbankedPointsRef = useRef<number>(0)
  const bankedScoreRef = useRef<number>(0)
  const gameStateRef = useRef<'idle' | 'running' | 'meltdown' | 'extracted'>('idle')
  const lastSirenTimeRef = useRef<number>(0)

  gameStateRef.current = gameState

  // Submit score to global leaderboard
  const submitScore = async (scoreToSubmit: number) => {
    if (scoreToSubmit <= 0) return
    setLeaderboardStatus('Transmitting reactor telemetry...')
    try {
      const res = await apiFetch('/api/leaderboard/overclock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Telemetry logged in Global Leaderboard!')
      } else {
        setLeaderboardStatus('Score saved locally.')
      }
    } catch {
      setLeaderboardStatus('Score saved locally.')
    } finally {
      refreshQuota().catch(() => {})
    }
  }

  // Trigger Meltdown
  const triggerMeltdown = useCallback(() => {
    playCpuTone('meltdown')
    gameStateRef.current = 'meltdown'
    setGameState('meltdown')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Meltdown wipes all unbanked points
    unbankedPointsRef.current = 0
    setUnbankedPoints(0)

    // Final score is whatever was already secured in bank
    const finalSecured = bankedScoreRef.current
    submitScore(finalSecured)
  }, [])

  // Safely Extract Banked Points and Conclude Run
  const handleExtract = () => {
    if (gameStateRef.current !== 'running') return
    playCpuTone('extract')

    // Bank any remaining unbanked points first
    const finalTotal = bankedScoreRef.current + unbankedPointsRef.current
    bankedScoreRef.current = finalTotal
    setBankedScore(finalTotal)
    unbankedPointsRef.current = 0
    setUnbankedPoints(0)

    gameStateRef.current = 'extracted'
    setGameState('extracted')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    submitScore(finalTotal)
  }

  // Start or Reboot Game
  const startGame = () => {
    playCpuTone('start')
    setHeat(0)
    heatRef.current = 0
    setMultiplier(1.0)
    multiplierRef.current = 1.0
    setCycleClicks(0)
    cycleClicksRef.current = 0
    setUnbankedPoints(0)
    unbankedPointsRef.current = 0
    setBankedScore(0)
    bankedScoreRef.current = 0
    setLastJump(null)
    setRecentBankNotice(null)
    setLeaderboardStatus('')
    setGameState('running')
    gameStateRef.current = 'running'

    const now = performance.now()
    lastTimeRef.current = now
    lastSirenTimeRef.current = now
  }

  // Passive Cooling Loop: Slowly decreases heat over time clamped at 0
  useEffect(() => {
    if (gameState !== 'running') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
      return
    }

    const loop = (currentTime: number) => {
      if (gameStateRef.current !== 'running') return

      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = currentTime

      // Passive dissipation: -5.5% heat per second clamped at 0
      if (heatRef.current > 0) {
        const nextHeat = Math.max(0, heatRef.current - 5.5 * dt)
        heatRef.current = nextHeat
        setHeat(Math.round(nextHeat))
      }

      // Warning tone at critical heat
      if (heatRef.current >= 80 && currentTime - lastSirenTimeRef.current > 1400) {
        playCpuTone('siren')
        lastSirenTimeRef.current = currentTime
      }

      animationFrameRef.current = requestAnimationFrame(loop)
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
        animationFrameRef.current = null
      }
    }
  }, [gameState])

  // Handle Overclock Surge
  const handleOverclock = () => {
    if (gameStateRef.current !== 'running') return
    playCpuTone('boost')

    const currentClicks = cycleClicksRef.current + 1
    cycleClicksRef.current = currentClicks
    setCycleClicks(currentClicks)

    // Calculate random multiplier jump starting between +0.1x and +1.5x, scaling with cycleClicks
    const minJump = 0.1 + currentClicks * 0.05
    const maxJump = 1.5 + currentClicks * 0.25
    const jump = Number((minJump + Math.random() * (maxJump - minJump)).toFixed(2))
    setLastJump(jump)

    // Add jump to multiplier
    const nextMultiplier = Number((multiplierRef.current + jump).toFixed(2))
    multiplierRef.current = nextMultiplier
    setMultiplier(nextMultiplier)

    // Add points to unbankedPoints
    const earned = Math.round(50 * nextMultiplier * (1 + currentClicks * 0.1))
    const nextUnbanked = unbankedPointsRef.current + earned
    unbankedPointsRef.current = nextUnbanked
    setUnbankedPoints(nextUnbanked)

    // Increase heat proportionally to multiplier jump size (bigger jump = significantly higher heat spike)
    const heatSpike = Math.round(jump * 15 + Math.random() * 4)
    const nextHeat = Math.min(100, Math.round(heatRef.current + heatSpike))
    heatRef.current = nextHeat
    setHeat(nextHeat)

    // Meltdown check: if heat >= 100, trigger MELTDOWN immediately
    if (nextHeat >= 100) {
      triggerMeltdown()
    }
  }

  // Handle Bank Data
  const handleBank = () => {
    if (gameStateRef.current !== 'running') return
    const pointsToBank = unbankedPointsRef.current
    if (pointsToBank <= 0) return

    playCpuTone('bank')

    const newBanked = bankedScoreRef.current + pointsToBank
    bankedScoreRef.current = newBanked
    setBankedScore(newBanked)

    // Reset unbankedPoints = 0, multiplier = 1.0, cycleClicks = 0
    unbankedPointsRef.current = 0
    setUnbankedPoints(0)
    multiplierRef.current = 1.0
    setMultiplier(1.0)
    cycleClicksRef.current = 0
    setCycleClicks(0)
    setLastJump(null)

    // CRITICAL: Banking does NOT reduce heat!

    setRecentBankNotice(pointsToBank)
    setTimeout(() => setRecentBankNotice(null), 1200)
  }

  // Clean temperature color (no jitter animations)
  const heatColor =
    heat < 50 ? '#00F5FF' : heat < 75 ? '#30D158' : heat < 90 ? '#FF9F0A' : '#FF375F'

  return (
    <div
      style={{ touchAction: 'manipulation' }}
      className="relative z-10 min-h-screen flex flex-col font-mono selection:bg-red-500/30 selection:text-red-200"
    >
      {/* ── Top HUD ── */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-red-500/20 backdrop-blur-md bg-black/40 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-red-400/60 hover:text-red-300 transition-colors"
          >
            <span>‹ ARCADE</span>
          </Link>
          <span className="text-red-500/30">/</span>
          <span className="text-xs font-black tracking-widest uppercase text-red-400">
            OVERCLOCK
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300 font-bold uppercase">
            ARCADE MODE
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">SECURED:</span>
            <span className="text-sm tracking-wider font-mono">{bankedScore}</span>
          </div>

          <button
            type="button"
            onClick={() => setIsLeaderboardOpen(true)}
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-all cursor-pointer"
          >
            🏆
          </button>
        </div>
      </header>

      {/* ── Main Overclock Core ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-lg w-full mx-auto relative">
        {/* Floating Bank Alert */}
        <AnimatePresence>
          {recentBankNotice !== null && (
            <motion.div
              initial={{ opacity: 0, y: -20, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.9 }}
              className="absolute top-4 z-40 px-5 py-2 rounded-full bg-emerald-500/20 border border-emerald-400 text-emerald-300 font-bold text-xs tracking-widest uppercase shadow-[0_0_25px_rgba(52,211,153,0.5)] backdrop-blur-md"
            >
              +{recentBankNotice} DATA SECURED!
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── IDLE / START SCREEN ── */}
        {gameState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-6 sm:p-8 rounded-3xl border border-red-500/30 bg-black/80 backdrop-blur-2xl shadow-[0_0_50px_rgba(255,55,95,0.15)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_25px_rgba(255,55,95,0.3)]">
              🔥
            </div>

            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider text-red-400 mb-1">
                OVERCLOCK
              </h1>
              <p className="text-xs text-red-500/70 uppercase tracking-widest font-mono">
                QUANTUM FREQUENCY SURGE REACTOR
              </p>
            </div>

            <div className="text-xs text-white/70 leading-relaxed space-y-2 text-left font-sans bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <p>
                • <strong>OVERCLOCK:</strong> Boosts frequency multiplier and awards unbanked points, but spikes core heat.
              </p>
              <p>
                • <strong>BANK DATA:</strong> Secures unbanked points into your permanent score and resets multiplier to 1.0x. <em>Does not cool down heat!</em>
              </p>
              <p>
                • <strong>PASSIVE COOLING:</strong> Core dissipates heat slowly over time while you wait.
              </p>
              <p>
                • <strong>MELTDOWN:</strong> Hitting 100% heat causes immediate catastrophic meltdown and wipes all unbanked points!
              </p>
            </div>

            <button
              type="button"
              onClick={startGame}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-4 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-400 text-red-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(255,55,95,0.3)] cursor-pointer"
            >
              ENGAGE REACTOR CORE ⚡
            </button>
          </motion.div>
        )}

        {/* ── ACTIVE REACTOR ── */}
        {gameState === 'running' && (
          <div className="w-full p-6 sm:p-8 rounded-3xl border border-red-500/25 bg-black/75 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,0,0,0.8)] flex flex-col items-center gap-6">
            {/* Multiplier HUD */}
            <div className="w-full flex justify-between items-center px-2">
              <div className="flex flex-col">
                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                  ACTIVE MULTIPLIER
                </span>
                <span className="text-4xl sm:text-5xl font-black tracking-tight text-white flex items-baseline gap-1">
                  {multiplier.toFixed(2)}
                  <span className="text-xl text-red-400">x</span>
                </span>
              </div>

              <div className="flex flex-col text-right">
                <span className="text-[10px] text-white/40 uppercase tracking-widest">
                  CYCLE STREAK
                </span>
                <span className="text-2xl font-bold text-amber-300">
                  {cycleClicks} {cycleClicks === 1 ? 'SURGE' : 'SURGES'}
                </span>
                {lastJump !== null && (
                  <span className="text-[10px] text-cyan-300 font-bold tracking-wider">
                    +{lastJump.toFixed(2)}x JUMP
                  </span>
                )}
              </div>
            </div>

            {/* Thermal Core Gauge */}
            <div className="w-full flex flex-col gap-2">
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                  <span
                    className="w-2 h-2 rounded-full animate-ping"
                    style={{ background: heatColor }}
                  />
                  <span>THERMAL LOAD:</span>
                </span>
                <span className="font-bold text-base font-mono" style={{ color: heatColor }}>
                  {heat}% / 100%
                </span>
              </div>

              {/* Progress bar */}
              <div className="w-full h-4 rounded-full bg-black/80 border border-white/10 p-0.5 overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${Math.min(100, heat)}%`,
                    backgroundColor: heatColor,
                    boxShadow: `0 0 15px ${heatColor}`,
                  }}
                />
              </div>

              <div className="flex justify-between text-[9px] text-white/30 uppercase tracking-widest mt-0.5">
                <span>0% COOL</span>
                <span>PASSIVE DISSIPATION: -5.5%/S</span>
                <span className="text-red-400 font-bold">100% MELTDOWN</span>
              </div>
            </div>

            {/* Unbanked Points Card */}
            <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase text-white/40 tracking-wider">
                  UNBANKED POINTS
                </span>
                <span className="text-2xl sm:text-3xl font-black text-amber-300 font-mono">
                  {unbankedPoints}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase text-white/40 tracking-wider">
                  SECURED BANK
                </span>
                <span className="text-xl font-bold text-emerald-400 font-mono">
                  {bankedScore}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={handleOverclock}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl bg-red-500/25 hover:bg-red-500/35 active:scale-[0.98] border-2 border-red-500 text-red-200 font-black text-base tracking-[0.2em] uppercase shadow-[0_0_30px_rgba(255,55,95,0.4)] transition-all cursor-pointer"
              >
                OVERCLOCK +SURGE ⚡
              </button>

              <button
                type="button"
                disabled={unbankedPoints <= 0}
                onClick={handleBank}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-[0.98] border border-emerald-500/50 text-emerald-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                BANK DATA (LOCK {unbankedPoints} PTS) 💾
              </button>

              <button
                type="button"
                onClick={handleExtract}
                style={{ touchAction: 'manipulation' }}
                className="text-xs text-white/40 hover:text-white/70 uppercase tracking-widest underline pt-1 cursor-pointer transition-colors"
              >
                Secure Extraction & Conclude Run
              </button>
            </div>
          </div>
        )}

        {/* ── MELTDOWN SCREEN ── */}
        {gameState === 'meltdown' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-6 sm:p-8 rounded-3xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(255,55,95,0.3)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.4)]">
              💥
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-red-400 mb-1">
                REACTOR MELTDOWN
              </h2>
              <p className="text-xs text-red-400/70 uppercase tracking-widest font-mono">
                CORE THERMAL LIMIT EXCEEDED (100% HEAT)
              </p>
            </div>

            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Secured Score</span>
                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {bankedScore}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs text-white/50">
                <span>LOST UNBANKED POINTS:</span>
                <span className="font-bold text-red-400 line-through">0</span>
              </div>
            </div>

            {leaderboardStatus && (
              <p className="text-[11px] text-cyan-300/80 font-mono tracking-wide">
                {leaderboardStatus}
              </p>
            )}

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startGame}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-400 text-red-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(255,55,95,0.3)] cursor-pointer"
              >
                RE-ENGAGE CORE ↻
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  🏆 LEADERBOARD
                </button>
                <Link
                  to="/"
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center"
                >
                  ARCADE ROOT
                </Link>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── EXTRACTED / SUCCESS CONCLUDE SCREEN ── */}
        {gameState === 'extracted' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full p-6 sm:p-8 rounded-3xl border border-emerald-500/40 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(52,211,153,0.2)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(52,211,153,0.3)]">
              🔒
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-400 mb-1">
                EXTRACTION SUCCESSFUL
              </h2>
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest font-mono">
                DATA SAFELY EXTRACTED FROM CORE
              </p>
            </div>

            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Final Score</span>
                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {bankedScore}
                </span>
              </div>
            </div>

            {leaderboardStatus && (
              <p className="text-[11px] text-cyan-300/80 font-mono tracking-wide">
                {leaderboardStatus}
              </p>
            )}

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startGame}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 border border-emerald-500/50 hover:border-emerald-400 text-emerald-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] cursor-pointer"
              >
                INITIALIZE NEW RUN ↻
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
                  style={{ touchAction: 'manipulation' }}
                  className="flex-1 py-2.5 rounded-xl bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 text-xs font-bold uppercase tracking-wider transition-all cursor-pointer"
                >
                  🏆 LEADERBOARD
                </button>
                <Link
                  to="/"
                  className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 text-white/70 border border-white/10 text-xs font-bold uppercase tracking-wider transition-all flex items-center justify-center"
                >
                  ARCADE ROOT
                </Link>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      {/* Global Leaderboard Modal */}
      <Leaderboard isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
    </div>
  )
}

export default Overclock
