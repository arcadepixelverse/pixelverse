import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { DifficultySelector, type Difficulty, DIFFICULTY_MULTIPLIERS } from '../components/DifficultySelector'

// Retro Web Audio Synthesizer for Overclock
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
      osc.frequency.setValueAtTime(300, now)
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
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'meltdown') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.linearRampToValueAtTime(25, now + 0.8)
      gain.gain.setValueAtTime(0.5, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.8)
      osc.start(now)
      osc.stop(now + 0.8)
    } else if (type === 'extract') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(1320, now + 0.3)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.35)
      osc.start(now)
      osc.stop(now + 0.35)
    } else if (type === 'siren') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(700, now)
      osc.frequency.linearRampToValueAtTime(950, now + 0.1)
      gain.gain.setValueAtTime(0.18, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'start') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(320, now)
      osc.frequency.exponentialRampToValueAtTime(640, now + 0.15)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {}
}

const MULTIPLIER_STAGES = [1.0, 1.2, 1.5, 2.5, 5.0, 10.0]

export function Overclock() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameState, setGameState] = useState<'idle' | 'running' | 'meltdown' | 'extracted'>('idle')
  const [heat, setHeat] = useState<number>(15) // 0 to 100%
  const [multiplierIndex, setMultiplierIndex] = useState<number>(0)
  const [unbankedScore, setUnbankedScore] = useState<number>(0)
  const [bankedScore, setBankedScore] = useState<number>(0)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)
  const [recentBankNotice, setRecentBankNotice] = useState<number | null>(null)

  // Real-time loop refs
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const heatRef = useRef<number>(15)
  const unbankedScoreRef = useRef<number>(0)
  const bankedScoreRef = useRef<number>(0)
  const multiplierIndexRef = useRef<number>(0)
  const elapsedRef = useRef<number>(0)
  const difficultyRef = useRef<Difficulty>(difficulty)
  const gameStateRef = useRef<'idle' | 'running' | 'meltdown' | 'extracted'>('idle')
  const lastSirenTimeRef = useRef<number>(0)

  difficultyRef.current = difficulty
  gameStateRef.current = gameState

  // Submit high score to backend leaderboard
  const submitScore = async (scoreToSubmit: number, currentDiff: Difficulty) => {
    if (scoreToSubmit <= 0) return
    setLeaderboardStatus('Transmitting reactor telemetry to Global Leaderboard...')
    try {
      const res = await apiFetch('/api/leaderboard/overclock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Extracted telemetry logged in Global Leaderboard!')
      } else {
        setLeaderboardStatus('Score recorded locally.')
      }
    } catch {
      setLeaderboardStatus('Score recorded locally.')
    }
  }

  // Trigger Meltdown (100% Heat)
  const triggerMeltdown = useCallback(() => {
    playCpuTone('meltdown')
    gameStateRef.current = 'meltdown'
    setGameState('meltdown')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    // Meltdown wipes all unbanked and banked points
    setFinalScore(0)
    setUnbankedScore(0)
    unbankedScoreRef.current = 0
  }, [])

  // Safely Extract Banked Points and End Run
  const handleExtract = () => {
    if (gameStateRef.current !== 'running') return
    playCpuTone('extract')

    // Automatically bank any remaining points first
    const totalBanked = bankedScoreRef.current + Math.round(unbankedScoreRef.current)
    const tacticalMult = DIFFICULTY_MULTIPLIERS[difficultyRef.current]
    const finalCalculated = Math.round(totalBanked * tacticalMult)

    gameStateRef.current = 'extracted'
    setGameState('extracted')
    setFinalScore(finalCalculated)
    setBankedScore(totalBanked)

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    submitScore(finalCalculated, difficultyRef.current)
  }

  // Start or Reboot Game
  const startGame = () => {
    playCpuTone('start')
    setHeat(15)
    heatRef.current = 15
    setMultiplierIndex(0)
    multiplierIndexRef.current = 0
    setUnbankedScore(0)
    unbankedScoreRef.current = 0
    setBankedScore(0)
    bankedScoreRef.current = 0
    setFinalScore(0)
    setElapsedSeconds(0)
    elapsedRef.current = 0
    setLeaderboardStatus('')
    setRecentBankNotice(null)
    setGameState('running')
    gameStateRef.current = 'running'

    const now = performance.now()
    lastTimeRef.current = now
    lastSirenTimeRef.current = now
  }

  // Continuous Real-Time Thermal Decay & Score Accumulation Loop
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

      // 1. Elapsed Runtime
      elapsedRef.current += dt
      setElapsedSeconds(Math.floor(elapsedRef.current))

      // 2. Score generation per second
      const basePointsPerSec = 40
      const currentMult = MULTIPLIER_STAGES[multiplierIndexRef.current]
      unbankedScoreRef.current += basePointsPerSec * currentMult * dt
      setUnbankedScore(Math.round(unbankedScoreRef.current))

      // 3. Thermal Decay & Ambient Heat Floor
      // The longer you play, the higher the minimum baseline heat gets
      const ambientFloor = Math.min(68, 12 + Math.floor(elapsedRef.current / 4) * 3)
      const decayRate = difficultyRef.current === 'easy' ? 9.5 : difficultyRef.current === 'hard' ? 6.5 : 8.0

      if (heatRef.current > ambientFloor) {
        heatRef.current = Math.max(ambientFloor, heatRef.current - decayRate * dt)
      } else {
        heatRef.current = Math.min(100, heatRef.current + 1.8 * dt)
      }

      setHeat(Math.round(heatRef.current))

      // Warning siren sound at critical heat
      if (heatRef.current >= 75 && currentTime - lastSirenTimeRef.current > 1200) {
        playCpuTone('siren')
        lastSirenTimeRef.current = currentTime
      }

      // 4. Catastrophic Meltdown Check
      if (heatRef.current >= 100) {
        triggerMeltdown()
        return
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
  }, [gameState, triggerMeltdown])

  // Handle Overclock Surge
  const handleOverclock = () => {
    if (gameStateRef.current !== 'running') return
    playCpuTone('boost')

    // Advance multiplier stage
    const nextIdx = Math.min(multiplierIndexRef.current + 1, MULTIPLIER_STAGES.length - 1)
    multiplierIndexRef.current = nextIdx
    setMultiplierIndex(nextIdx)

    // Add Heat surge
    const surge =
      difficultyRef.current === 'easy' ? 12 : difficultyRef.current === 'hard' ? 20 : 16
    const nextHeat = Math.min(100, heatRef.current + surge)
    heatRef.current = nextHeat
    setHeat(nextHeat)

    if (nextHeat >= 100) {
      triggerMeltdown()
    }
  }

  // Handle Bank Data (Saves unbanked points, resets multiplier to 1.0x, DOES NOT reset heat!)
  const handleBank = () => {
    if (gameStateRef.current !== 'running') return
    const pointsToBank = Math.round(unbankedScoreRef.current)
    if (pointsToBank <= 0) return

    playCpuTone('bank')

    const newBanked = bankedScoreRef.current + pointsToBank
    bankedScoreRef.current = newBanked
    setBankedScore(newBanked)

    unbankedScoreRef.current = 0
    setUnbankedScore(0)

    // Reset multiplier to 1.0x (does NOT reset heat)
    multiplierIndexRef.current = 0
    setMultiplierIndex(0)

    setRecentBankNotice(pointsToBank)
    setTimeout(() => setRecentBankNotice(null), 1200)
  }

  const currentMult = MULTIPLIER_STAGES[multiplierIndex]
  const tacticalMult = DIFFICULTY_MULTIPLIERS[difficulty]

  // Color theme according to heat level
  const heatColor =
    heat < 50 ? '#00F5FF' : heat < 75 ? '#30D158' : heat < 88 ? '#FF9F0A' : '#FF375F'

  // Dynamic screen shake intensity
  const shakeAnimation =
    heat >= 88
      ? { x: [-5, 5, -4, 4, 0], y: [4, -4, 3, -3, 0] }
      : heat >= 75
      ? { x: [-2, 2, -1, 1, 0], y: [1, -1, 1, -1, 0] }
      : {}

  return (
    <motion.div
      animate={shakeAnimation}
      transition={{ duration: 0.15, repeat: heat >= 75 ? Infinity : 0 }}
      style={{ touchAction: 'manipulation' }}
      className={`relative z-10 min-h-screen flex flex-col font-mono selection:bg-red-500/30 selection:text-red-200 transition-colors ${
        heat >= 88 ? 'bg-red-950/40' : heat >= 75 ? 'bg-red-950/20' : 'bg-transparent'
      }`}
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
          <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 border border-red-500/30 text-red-300">
            {difficulty.toUpperCase()} {tacticalMult}x
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">SECURED:</span>
            <span className="text-sm tracking-wider font-mono">
              {Math.round(bankedScore * tacticalMult)}
            </span>
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

      {/* ── Main Reactor Arena ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl w-full mx-auto relative">
        {/* Floating Bank Alert */}
        <AnimatePresence>
          {recentBankNotice && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className="absolute top-4 z-40 px-5 py-2 rounded-full text-xs font-mono font-black tracking-widest uppercase bg-emerald-500/20 border border-emerald-400 text-emerald-200 shadow-[0_0_25px_rgba(52,211,153,0.6)] backdrop-blur-md"
            >
              + {recentBankNotice} PTS BANKED! MULTIPLIER RESET TO 1.0x
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── START SCREEN (Idle State) ── */}
        {gameState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-red-500/40 bg-black/85 backdrop-blur-2xl shadow-[0_0_60px_rgba(255,55,95,0.15)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.3)]">
              🔥
            </div>

            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider text-red-400 mb-1">
                OVERCLOCK
              </h1>
              <p className="text-xs text-red-500/70 uppercase tracking-widest">
                THERMAL DECAY REACTOR
              </p>
            </div>

            <DifficultySelector difficulty={difficulty} onChange={setDifficulty} />

            <div className="text-xs text-white/70 leading-relaxed font-sans space-y-2 text-left bg-white/[0.02] p-4 rounded-xl border border-white/5">
              <p>⚡ <strong>Overclock</strong> boosts your points/sec multiplier and injects core heat.</p>
              <p>🧊 <strong>Thermal Decay</strong> constantly dissipates heat over time, but ambient floor rises the longer you play.</p>
              <p>💾 <strong>Bank</strong> secures points and resets multiplier to 1.0x without cooling heat.</p>
              <p>💥 <strong>100% Heat = MELTDOWN</strong>: Destroys all points! Extract before you blow.</p>
            </div>

            <button
              type="button"
              onClick={startGame}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-3.5 rounded-2xl bg-red-500/25 hover:bg-red-500/35 border-2 border-red-500 hover:border-red-400 text-red-200 font-black text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(255,55,95,0.4)] cursor-pointer"
            >
              ENGAGE REACTOR ⚡
            </button>
          </motion.div>
        )}

        {/* ── RUNNING REACTOR SCREEN ── */}
        {gameState === 'running' && (
          <div className="w-full max-w-md flex flex-col items-center gap-6 py-2">
            {/* Core Circular Visualizer */}
            <div
              className="w-60 h-60 rounded-full border-4 relative flex items-center justify-center transition-all duration-300"
              style={{
                borderColor: heatColor,
                boxShadow: `0 0 60px ${heatColor}44, inset 0 0 50px ${heatColor}33`,
                backgroundColor: '#05070c',
              }}
            >
              {/* Spinning Reactor Dash Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{
                  duration: Math.max(0.8, 6 - multiplierIndex * 0.9),
                  repeat: Infinity,
                  ease: 'linear',
                }}
                className="absolute inset-2 rounded-full border-2 border-dashed"
                style={{ borderColor: `${heatColor}77` }}
              />

              {/* Core Telemetry Text */}
              <div className="text-center z-10 flex flex-col items-center">
                <span className="text-[10px] tracking-widest uppercase text-white/40">
                  CORE TEMPERATURE
                </span>
                <span
                  className="text-5xl font-black tracking-tight font-mono my-1"
                  style={{ color: heatColor }}
                >
                  {heat}%
                </span>
                <span
                  className="text-xs font-bold px-3 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${heatColor}22`,
                    color: heatColor,
                    border: `1px solid ${heatColor}66`,
                  }}
                >
                  {currentMult}x MULTIPLIER
                </span>
                <span className="text-[9px] text-white/40 mt-1">
                  Active Runtime: {elapsedSeconds}s
                </span>
              </div>
            </div>

            {/* Heat Gauge Bar with Thermal Decay Notice */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] uppercase tracking-wider text-white/50">
                <span>Thermal Dissipation (-8%/s)</span>
                <span className="font-bold" style={{ color: heatColor }}>
                  {heat >= 88 ? 'CRITICAL MELTDOWN IMMINENT' : `${heat}% / 100%`}
                </span>
              </div>
              <div className="w-full h-3.5 rounded-full bg-black/80 border border-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-150"
                  style={{
                    width: `${heat}%`,
                    backgroundColor: heatColor,
                    boxShadow: `0 0 20px ${heatColor}`,
                  }}
                />
              </div>
            </div>

            {/* Score HUD Display */}
            <div className="w-full p-4 rounded-2xl bg-white/[0.03] border border-white/10 flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase text-white/40 font-mono">
                  UNBANKED ACTIVE POINTS
                </span>
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {Math.round(unbankedScore * tacticalMult)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase text-white/40 font-mono">
                  BANKED TOTAL
                </span>
                <span className="text-2xl font-black text-emerald-400 font-mono">
                  {Math.round(bankedScore * tacticalMult)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={handleOverclock}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl bg-red-500/25 hover:bg-red-500/40 active:scale-95 border-2 border-red-500 text-red-200 font-black text-base tracking-[0.2em] uppercase shadow-[0_0_35px_rgba(255,55,95,0.45)] transition-all cursor-pointer"
              >
                OVERCLOCK (+HEAT / +SPEED)
              </button>

              <button
                type="button"
                disabled={unbankedScore <= 0}
                onClick={handleBank}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-500/50 text-emerald-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                BANK DATA (RESET MULTIPLIER) 💾
              </button>

              <button
                type="button"
                onClick={handleExtract}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3 rounded-2xl bg-cyan-500/15 hover:bg-cyan-500/25 active:scale-95 border border-cyan-500/40 text-cyan-300 font-bold text-xs tracking-widest uppercase transition-all cursor-pointer"
              >
                SAFELY SHUT DOWN & EXTRACT ↵
              </button>
            </div>
          </div>
        )}

        {/* ── MELTDOWN SCREEN (Heat reached 100%) ── */}
        {gameState === 'meltdown' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-red-500 bg-red-950/90 backdrop-blur-2xl shadow-[0_0_80px_rgba(255,55,95,0.6)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/20 border border-red-500 flex items-center justify-center text-4xl shadow-[0_0_35px_rgba(255,55,95,0.6)] animate-bounce">
              💥
            </div>

            <div>
              <h2 className="text-3xl font-black uppercase tracking-wider text-red-500 mb-1">
                REACTOR MELTDOWN
              </h2>
              <p className="text-xs text-red-300 uppercase tracking-widest font-mono">
                Core Reached 100% Thermal Threshold
              </p>
            </div>

            <p className="text-xs text-red-200/90 leading-relaxed font-sans bg-black/60 p-4 rounded-xl border border-red-500/30">
              The reactor core suffered catastrophic thermal runaway. All unbanked data and core cycles were completely incinerated.
            </p>

            <div className="w-full p-4 rounded-2xl bg-black/60 border border-red-500/30 flex justify-between items-center text-xs font-mono">
              <span className="text-white/40">FINAL SCORE:</span>
              <span className="text-2xl font-black text-red-500">0 PTS</span>
            </div>

            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startGame}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-red-500/30 hover:bg-red-500/40 border border-red-400 text-white font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(255,55,95,0.4)] cursor-pointer"
              >
                REBOOT CORE ↻
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

        {/* ── EXTRACTED / SUCCESSFUL SAFE EXIT SCREEN ── */}
        {gameState === 'extracted' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-emerald-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(52,211,153,0.3)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(52,211,153,0.4)]">
              🛡️
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-emerald-400 mb-1">
                CORE SHUTDOWN SECURE
              </h2>
              <p className="text-xs text-emerald-400/70 uppercase tracking-widest">
                Data Safely Extracted Before Meltdown
              </p>
            </div>

            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Secured Bank Score</span>
                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {finalScore}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Difficulty Multiplier</span>
                <span className="font-bold text-cyan-300">
                  {difficulty.toUpperCase()} ({tacticalMult}x)
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Mission Duration</span>
                <span className="font-bold text-white/80">{elapsedSeconds}s</span>
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
                RUN AGAIN ↻
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

      {/* ── Leaderboard Modal ── */}
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </motion.div>
  )
}

export default Overclock
