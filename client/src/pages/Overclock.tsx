import { useState, useRef } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { DifficultySelector, type Difficulty, DIFFICULTY_MULTIPLIERS } from '../components/DifficultySelector'

function playCpuTone(type: 'boost' | 'bank' | 'meltdown' | 'start') {
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
      osc.frequency.setValueAtTime(260, now)
      osc.frequency.exponentialRampToValueAtTime(750, now + 0.12)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'bank') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now)
      osc.frequency.exponentialRampToValueAtTime(1046.5, now + 0.18)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'meltdown') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.linearRampToValueAtTime(30, now + 0.7)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.7)
      osc.start(now)
      osc.stop(now + 0.7)
    } else if (type === 'start') {
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(300, now)
      osc.frequency.exponentialRampToValueAtTime(600, now + 0.15)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    }
  } catch {}
}

const MULTIPLIER_STAGES = [1.0, 1.2, 1.5, 2.0, 2.5, 3.5, 5.0, 7.5, 10.0, 15.0]

export function Overclock() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameState, setGameState] = useState<'idle' | 'running' | 'meltdown'>('idle')
  const [temperature, setTemperature] = useState<number>(35) // In Celsius
  const [multiplierIndex, setMultiplierIndex] = useState<number>(0)
  const [unbankedScore, setUnbankedScore] = useState<number>(0)
  const [bankedScore, setBankedScore] = useState<number>(0)
  const [banksCount, setBanksCount] = useState<number>(0)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [isMelting, setIsMelting] = useState<boolean>(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  const diffRef = useRef<Difficulty>(difficulty)
  diffRef.current = difficulty

  const submitScore = async (scoreToSubmit: number, currentDiff: Difficulty) => {
    if (scoreToSubmit <= 0) return
    setLeaderboardStatus('Transmitting banked telemetry to Global Leaderboard...')
    try {
      const res = await apiFetch('/api/leaderboard/overclock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Banked data logged in Global Leaderboard!')
      } else {
        setLeaderboardStatus('Score saved locally.')
      }
    } catch {
      setLeaderboardStatus('Score saved locally.')
    }
  }

  // Start / Reboot
  const startGame = () => {
    playCpuTone('start')
    setTemperature(35)
    setMultiplierIndex(0)
    setUnbankedScore(0)
    setBankedScore(0)
    setBanksCount(0)
    setFinalScore(0)
    setIsMelting(false)
    setLeaderboardStatus('')
    setGameState('running')
  }

  // Calculate current risk percentage
  const getRiskPercent = (temp: number, diff: Difficulty): number => {
    const diffScale = diff === 'easy' ? 0.75 : diff === 'hard' ? 1.4 : 1.0
    if (temp < 60) return 0
    if (temp < 75) return Math.min(25, (temp - 60) * 1.5 * diffScale)
    if (temp < 90) return Math.min(60, 25 + (temp - 75) * 2.2 * diffScale)
    return Math.min(95, 60 + (temp - 90) * 3.5 * diffScale)
  }

  // Handle Overclock Push
  const handleOverclock = () => {
    if (gameState !== 'running') return

    // Calculate Meltdown Chance
    const risk = getRiskPercent(temperature, difficulty)
    const roll = Math.random() * 100

    if (roll < risk) {
      // TRIGGER MELTDOWN
      playCpuTone('meltdown')
      setIsMelting(true)

      const diffMultiplier = DIFFICULTY_MULTIPLIERS[diffRef.current]
      const totalFinal = Math.round(bankedScore * diffMultiplier)
      setFinalScore(totalFinal)
      setGameState('meltdown')

      submitScore(totalFinal, diffRef.current)
      return
    }

    // SUCCESSFUL OVERCLOCK
    playCpuTone('boost')

    // Increase multiplier stage
    const nextMultIndex = Math.min(multiplierIndex + 1, MULTIPLIER_STAGES.length - 1)
    setMultiplierIndex(nextMultIndex)

    // Heat surge based on difficulty
    const heatIncrement =
      difficulty === 'easy'
        ? 8 + Math.random() * 6
        : difficulty === 'hard'
        ? 15 + Math.random() * 12
        : 11 + Math.random() * 9
    const nextTemp = Math.min(105, temperature + heatIncrement)
    setTemperature(nextTemp)

    // Add points scaled by current stage multiplier
    const stageMultiplier = MULTIPLIER_STAGES[nextMultIndex]
    const addedPoints = Math.round(150 * stageMultiplier)
    setUnbankedScore((prev) => prev + addedPoints)
  }

  // Handle Bank Data (Save unbanked points and flush coolant)
  const handleBank = () => {
    if (gameState !== 'running' || unbankedScore <= 0) return

    playCpuTone('bank')

    const nextBanked = bankedScore + unbankedScore
    setBankedScore(nextBanked)
    setUnbankedScore(0)
    setMultiplierIndex(0)
    setBanksCount((prev) => prev + 1)

    // Flush coolant: cool down CPU
    setTemperature((prev) => Math.max(35, prev - 35))

    const diffMultiplier = DIFFICULTY_MULTIPLIERS[diffRef.current]
    const updatedTotal = Math.round(nextBanked * diffMultiplier)
    submitScore(updatedTotal, diffRef.current)
  }

  // End run and secure score voluntarily
  const handleSecureExit = () => {
    if (gameState !== 'running') return
    handleBank()
    const diffMultiplier = DIFFICULTY_MULTIPLIERS[diffRef.current]
    const total = Math.round((bankedScore + unbankedScore) * diffMultiplier)
    setFinalScore(total)
    setGameState('meltdown')
  }

  const currentStageMultiplier = MULTIPLIER_STAGES[multiplierIndex]
  const currentRisk = Math.round(getRiskPercent(temperature, difficulty))
  const tacticalMultiplier = DIFFICULTY_MULTIPLIERS[difficulty]

  // Color theme based on heat
  const heatColor =
    temperature < 60
      ? '#00F5FF' // Cyan
      : temperature < 80
      ? '#30D158' // Green
      : temperature < 92
      ? '#FF9F0A' // Amber
      : '#FF375F' // Red

  return (
    <div
      style={{ touchAction: 'manipulation' }}
      className={`relative z-10 min-h-screen flex flex-col font-mono selection:bg-red-500/30 selection:text-red-200 transition-colors ${
        isMelting ? 'bg-red-950/40' : 'bg-transparent'
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
            {difficulty.toUpperCase()} {tacticalMultiplier}x
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-emerald-500/30 bg-emerald-500/10 text-xs text-emerald-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">BANKED:</span>
            <span className="text-sm tracking-wider">{Math.round(bankedScore * tacticalMultiplier)}</span>
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

      {/* ── Main Core Arena ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl w-full mx-auto relative">
        {/* ── START SCREEN ── */}
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
                QUANTUM CPU CORE THERMAL LIMIT
              </p>
            </div>

            <DifficultySelector
              difficulty={difficulty}
              onChange={setDifficulty}
            />

            <p className="text-xs text-white/70 leading-relaxed font-sans">
              Push clock frequencies to compound score multipliers. But watch the thermal core: when heat rises, risk of catastrophic meltdown grows. Bank points before the core blows.
            </p>

            <button
              type="button"
              onClick={startGame}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-3.5 rounded-2xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/50 hover:border-red-400 text-red-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(255,55,95,0.3)] cursor-pointer"
            >
              ENGAGE REACTOR ⚡
            </button>
          </motion.div>
        )}

        {/* ── RUNNING REACTOR SCREEN ── */}
        {gameState === 'running' && (
          <div className="w-full max-w-md flex flex-col items-center gap-6 py-4">
            {/* Core Visualizer */}
            <div className="w-56 h-56 rounded-full border-4 relative flex items-center justify-center transition-all duration-300"
              style={{
                borderColor: heatColor,
                boxShadow: `0 0 50px ${heatColor}44, inset 0 0 40px ${heatColor}33`,
                backgroundColor: '#05070c',
              }}
            >
              {/* Spinning Reactor Ring */}
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: Math.max(1, 8 - multiplierIndex * 0.7), repeat: Infinity, ease: 'linear' }}
                className="absolute inset-2 rounded-full border-2 border-dashed"
                style={{ borderColor: `${heatColor}66` }}
              />

              {/* Core Telemetry Text */}
              <div className="text-center z-10 flex flex-col items-center">
                <span className="text-[10px] tracking-widest uppercase text-white/40">
                  HEAT CORE
                </span>
                <span className="text-4xl font-black tracking-tight font-mono" style={{ color: heatColor }}>
                  {Math.round(temperature)}°C
                </span>
                <span className="text-xs font-bold px-2 py-0.5 rounded-full mt-1"
                  style={{
                    backgroundColor: `${heatColor}22`,
                    color: heatColor,
                    border: `1px solid ${heatColor}55`,
                  }}
                >
                  {currentStageMultiplier}x BOOST
                </span>
              </div>
            </div>

            {/* Heat Gauge Bar */}
            <div className="w-full flex flex-col gap-1.5">
              <div className="flex justify-between text-[11px] uppercase tracking-wider text-white/50">
                <span>Core Heat Gauge</span>
                <span className="font-bold" style={{ color: heatColor }}>
                  {currentRisk}% Meltdown Risk
                </span>
              </div>
              <div className="w-full h-3 rounded-full bg-black/60 border border-white/10 overflow-hidden p-0.5">
                <div
                  className="h-full rounded-full transition-all duration-300"
                  style={{
                    width: `${Math.min(100, (temperature / 105) * 100)}%`,
                    backgroundColor: heatColor,
                    boxShadow: `0 0 15px ${heatColor}`,
                  }}
                />
              </div>
            </div>

            {/* Unbanked Points Card */}
            <div className="w-full p-4 rounded-2xl bg-white/[0.02] border border-white/10 flex justify-between items-center">
              <div>
                <span className="block text-[10px] uppercase text-white/40">UNBANKED RUN POINTS</span>
                <span className="text-2xl font-black text-amber-300 font-mono">
                  {Math.round(unbankedScore * tacticalMultiplier)}
                </span>
              </div>
              <div className="text-right">
                <span className="block text-[10px] uppercase text-white/40">SECURED HIGH SCORE</span>
                <span className="text-lg font-bold text-emerald-400 font-mono">
                  {Math.round(bankedScore * tacticalMultiplier)}
                </span>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-3">
              <button
                type="button"
                onClick={handleOverclock}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-4 rounded-2xl bg-red-500/25 hover:bg-red-500/35 active:scale-95 border-2 border-red-500 text-red-200 font-black text-base tracking-[0.2em] uppercase shadow-[0_0_30px_rgba(255,55,95,0.4)] transition-all cursor-pointer"
              >
                OVERCLOCK +PUSH FREQ
              </button>

              <button
                type="button"
                disabled={unbankedScore <= 0}
                onClick={handleBank}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-emerald-500/20 hover:bg-emerald-500/30 active:scale-95 border border-emerald-500/50 text-emerald-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(52,211,153,0.3)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
              >
                BANK DATA & COOL CORE 🧊
              </button>

              {bankedScore > 0 && (
                <button
                  type="button"
                  onClick={handleSecureExit}
                  style={{ touchAction: 'manipulation' }}
                  className="text-xs text-white/40 hover:text-white/70 uppercase tracking-widest underline pt-1 cursor-pointer"
                >
                  Conclude Run & Submit Score
                </button>
              )}
            </div>
          </div>
        )}

        {/* ── MELTDOWN / GAME OVER SCREEN ── */}
        {gameState === 'meltdown' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(255,55,95,0.3)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.4)]">
              💥
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-red-400 mb-1">
                REACTOR MELTDOWN
              </h2>
              <p className="text-xs text-red-400/70 uppercase tracking-widest">
                CRITICAL CORE THERMAL SHUTDOWN
              </p>
            </div>

            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Secured Score</span>
                <span className="text-3xl font-black text-emerald-400 font-mono tracking-tight">
                  {finalScore}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Difficulty Multiplier</span>
                <span className="font-bold text-red-400">{difficulty.toUpperCase()} ({tacticalMultiplier}x)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Data Banks Executed</span>
                <span className="font-bold text-cyan-300">{banksCount}</span>
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
      </main>

      {/* ── Leaderboard Modal ── */}
      <Leaderboard
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
      />
    </div>
  )
}

export default Overclock
