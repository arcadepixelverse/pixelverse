import { useState, useEffect, useRef, useCallback } from 'react'
import { motion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { DifficultySelector, type Difficulty, DIFFICULTY_MULTIPLIERS } from '../components/DifficultySelector'
import { useAuth } from '../context/AuthContext'

// Sound synthesizers using AudioContext
function playRhythmTone(type: 'hit' | 'miss' | 'gameover' | 'start') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'hit') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(587.33, now) // D5
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.08) // A5
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.12)
      osc.start(now)
      osc.stop(now + 0.12)
    } else if (type === 'miss') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(150, now)
      osc.frequency.linearRampToValueAtTime(50, now + 0.3)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3)
      osc.start(now)
      osc.stop(now + 0.3)
    } else if (type === 'gameover') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(200, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.5)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.5)
      osc.start(now)
      osc.stop(now + 0.5)
    } else if (type === 'start') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.2)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    }
  } catch {}
}

export function SignalSync() {
  const { refreshQuota, syncPlaySession } = useAuth()
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [isGameDisabled, setIsGameDisabled] = useState<boolean>(false)
  const [isStarting, setIsStarting] = useState<boolean>(false)
  const [hits, setHits] = useState<number>(0)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [maxStreak, setMaxStreak] = useState<number>(0)
  const [hitFeedback, setHitFeedback] = useState<'PERFECT' | 'MISS' | null>(null)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  // Verify live game kill switch status on mount
  useEffect(() => {
    apiFetch('/api/status')
      .then((r) => r.json())
      .then((d) => {
        if (d?.gameStatus?.signal_sync === false) {
          setIsGameDisabled(true)
        }
      })
      .catch(() => {})
  }, [])

  // Oscilloscope Physics State
  const [dotPos, setDotPos] = useState<number>(0) // 0 to 100 percentage
  const [targetCenter, setTargetCenter] = useState<number>(50) // center percentage
  const [targetWidth, setTargetWidth] = useState<number>(20) // width percentage

  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const dotPosRef = useRef<number>(0)
  const directionRef = useRef<number>(1) // 1 = right, -1 = left
  const speedRef = useRef<number>(60) // % per second

  const targetCenterRef = useRef<number>(50)
  const targetWidthRef = useRef<number>(20)
  const hitsRef = useRef<number>(0)
  const difficultyRef = useRef<Difficulty>(difficulty)
  difficultyRef.current = difficulty
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle')
  gameStateRef.current = gameState
  const playSessionIdRef = useRef<string | null>(null)
  const isSubmittingScoreRef = useRef<boolean>(false)

  // Post high score to leaderboard with session refresh retry
  const submitScore = async (scoreToSubmit: number, currentDiff: Difficulty) => {
    if (scoreToSubmit <= 0 || isSubmittingScoreRef.current) return
    isSubmittingScoreRef.current = true
    setLeaderboardStatus('Transmitting resonance data to Leaderboard...')
    try {
      let sessionId = playSessionIdRef.current
      if (!sessionId) {
        // Request a fresh play session first if none currently tracked
        const startRes = await apiFetch('/api/games/signal-sync/start', { method: 'POST' })
        if (startRes.ok) {
          const startData = await startRes.json()
          sessionId = startData.playSessionId || null
          playSessionIdRef.current = sessionId
          syncPlaySession(startData)
        }
      }

      let res = await apiFetch('/api/leaderboard/signal_sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff, playSessionId: sessionId }),
      })

      // If the session was invalid/expired/already consumed, request a fresh session and retry ONCE
      if (res.status === 403) {
        const errJson = await res.json().catch(() => ({}))
        if (errJson?.error === 'INVALID_PLAY_SESSION') {
          const refreshRes = await apiFetch('/api/games/signal-sync/start', { method: 'POST' })
          if (refreshRes.ok) {
            const refreshData = await refreshRes.json()
            const freshSessionId = refreshData.playSessionId || null
            playSessionIdRef.current = freshSessionId
            syncPlaySession(refreshData)

            res = await apiFetch('/api/leaderboard/signal_sync', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff, playSessionId: freshSessionId }),
            })
          }
        }
      }

      if (res.ok) {
        setLeaderboardStatus('✓ Harmonic sync logged in Global Leaderboard!')
        playSessionIdRef.current = null
      } else {
        setLeaderboardStatus('Score saved locally.')
      }
    } catch {
      setLeaderboardStatus('Score saved locally.')
    } finally {
      isSubmittingScoreRef.current = false
      refreshQuota().catch(() => {})
    }
  }

  const submitScoreRef = useRef(submitScore)
  submitScoreRef.current = submitScore

  const triggerGameOver = useCallback(() => {
    if (gameStateRef.current !== 'playing') return
    gameStateRef.current = 'gameover'
    playRhythmTone('gameover')
    setHitFeedback('MISS')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    const multiplier = DIFFICULTY_MULTIPLIERS[difficultyRef.current]
    const calculated = Math.round(hitsRef.current * 100 * multiplier)
    setFinalScore(calculated)
    setGameState('gameover')
    submitScoreRef.current(calculated, difficultyRef.current)
  }, [])

  // Start / Reboot
  const startGame = async () => {
    if (isStarting) return
    setIsStarting(true)
    try {
      const res = await apiFetch('/api/games/signal-sync/start', { method: 'POST' })
      if (!res.ok) {
        if (res.status === 403) {
          const errData = await res.json().catch(() => ({}))
          if (errData?.error === 'GAME_DISABLED') {
            setIsGameDisabled(true)
            return
          }
        }
        return
      }

      const data = await res.json()
      if (data.playSessionId) {
        playSessionIdRef.current = data.playSessionId
      }
      syncPlaySession(data)

      playRhythmTone('start')
      setHits(0)
      hitsRef.current = 0
      setStreak(0)
      setMaxStreak(0)
      setFinalScore(0)
      setHitFeedback(null)
      setLeaderboardStatus('')

      // Initial parameters based on difficulty
      const initialWidth = difficulty === 'easy' ? 26 : difficulty === 'hard' ? 14 : 20
      const initialSpeed = difficulty === 'easy' ? 55 : difficulty === 'hard' ? 85 : 70

      setTargetWidth(initialWidth)
      targetWidthRef.current = initialWidth
      setTargetCenter(50)
      targetCenterRef.current = 50

      dotPosRef.current = 0
      setDotPos(0)
      directionRef.current = 1
      speedRef.current = initialSpeed

      gameStateRef.current = 'playing'
      setGameState('playing')
      lastTimeRef.current = performance.now()
    } catch (err) {
      console.warn('[SignalSync] Start error:', err)
    } finally {
      setIsStarting(false)
    }
  }

  // 60fps Dot Animation Loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const loop = (time: number) => {
      const dt = Math.min((time - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = time

      let nextPos = dotPosRef.current + directionRef.current * speedRef.current * dt

      if (nextPos >= 100) {
        nextPos = 100
        directionRef.current = -1
      } else if (nextPos <= 0) {
        nextPos = 0
        directionRef.current = 1
      }

      dotPosRef.current = nextPos
      setDotPos(nextPos)

      animationFrameRef.current = requestAnimationFrame(loop)
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gameState])

  // Player Trigger (Space / Click / Touch)
  const handleTrigger = useCallback(() => {
    if (gameStateRef.current !== 'playing') return

    const currentPos = dotPosRef.current
    const center = targetCenterRef.current
    const width = targetWidthRef.current
    const minTarget = center - width / 2
    const maxTarget = center + width / 2

    // Check hit condition
    if (currentPos >= minTarget && currentPos <= maxTarget) {
      // SUCCESSFUL HIT
      playRhythmTone('hit')
      setHitFeedback('PERFECT')
      setTimeout(() => setHitFeedback(null), 300)

      const nextHits = hitsRef.current + 1
      hitsRef.current = nextHits
      setHits(nextHits)

      setStreak((prev) => {
        const next = prev + 1
        setMaxStreak((m) => Math.max(m, next))
        return next
      })

      // Difficulty Scaling: Speed up and shrink target zone
      const speedStep = difficultyRef.current === 'hard' ? 7 : difficultyRef.current === 'easy' ? 3.5 : 5
      speedRef.current = Math.min(speedRef.current + speedStep, 280)

      // Shrink target zone (minimum 6%)
      const minZone = difficultyRef.current === 'hard' ? 5 : 8
      const nextWidth = Math.max(minZone, targetWidthRef.current * 0.94)
      targetWidthRef.current = nextWidth
      setTargetWidth(nextWidth)

      // Shift target zone position dynamically after 3 hits
      if (nextHits >= 3) {
        const minCenter = 20 + nextWidth / 2
        const maxCenter = 80 - nextWidth / 2
        const newCenter = minCenter + Math.random() * (maxCenter - minCenter)
        targetCenterRef.current = newCenter
        setTargetCenter(newCenter)
      }
    } else {
      // MISSED OUTSIDE TARGET ZONE -> GAME OVER
      triggerGameOver()
    }
  }, [triggerGameOver])

  // Keyboard Space listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (gameStateRef.current === 'playing') {
          handleTrigger()
        } else if (gameStateRef.current === 'idle' || gameStateRef.current === 'gameover') {
          startGame()
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [handleTrigger])

  const multiplier = DIFFICULTY_MULTIPLIERS[difficulty]

  if (isGameDisabled) {
    return (
      <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-6 select-none relative z-20">
        <div className="max-w-md w-full p-8 rounded-2xl bg-cyan-950/20 border-2 border-cyan-500/60 shadow-[0_0_60px_rgba(0,245,255,0.3)] text-center">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-xl font-black uppercase text-cyan-400 tracking-[0.2em] mb-3">
            MODULE OFFLINE // DISABLED BY ADMIN
          </h2>
          <p className="text-xs text-cyan-200/80 mb-6 uppercase tracking-wider leading-relaxed">
            THIS ARCADE PROTOCOL HAS BEEN SUSPENDED FOR MAINTENANCE. COME BACK LATER.
          </p>
          <Link
            to="/"
            className="inline-block px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/40 transition"
          >
            RETURN TO ARCADE
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div
      onClick={handleTrigger}
      style={{ touchAction: 'manipulation' }}
      className="relative z-10 min-h-screen flex flex-col font-mono selection:bg-cyan-500/30 selection:text-cyan-200 select-none cursor-pointer"
    >
      {/* ── Top HUD ── */}
      <header
        onClick={(e) => e.stopPropagation()}
        className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-cyan-500/20 backdrop-blur-md bg-black/40 cursor-default flex-wrap gap-2"
      >
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-cyan-400/60 hover:text-cyan-300 transition-colors"
          >
            <span>‹ ARCADE</span>
          </Link>
          <span className="text-cyan-500/30">/</span>
          <span className="text-xs font-black tracking-widest uppercase text-cyan-400">
            SIGNAL SYNC
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
            {difficulty.toUpperCase()} {multiplier}x
          </span>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-cyan-500/30 bg-cyan-500/10 text-xs text-cyan-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">HITS:</span>
            <span className="text-sm tracking-wider">{hits}</span>
          </div>

          {streak > 1 && (
            <div className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-xs text-amber-300 font-bold">
              <span>⚡ {streak}x</span>
            </div>
          )}

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation()
              setIsLeaderboardOpen(true)
            }}
            className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-amber-400/10 hover:bg-amber-400/20 text-amber-300 border border-amber-400/30 transition-all cursor-pointer"
          >
            🏆
          </button>
        </div>
      </header>

      {/* ── Main Oscilloscope Arena ── */}
      <main className="flex-1 flex flex-col items-center justify-center p-4 max-w-4xl w-full mx-auto relative">
        {/* ── START SCREEN ── */}
        {gameState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-cyan-500/40 bg-black/85 backdrop-blur-2xl shadow-[0_0_60px_rgba(0,245,255,0.15)] text-center flex flex-col items-center gap-5 cursor-default"
          >
            <div className="w-16 h-16 rounded-2xl bg-cyan-500/15 border border-cyan-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(0,245,255,0.3)]">
              〰️
            </div>

            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider text-cyan-300 mb-1">
                SIGNAL SYNC
              </h1>
              <p className="text-xs text-cyan-500/70 uppercase tracking-widest">
                HARMONIC RESONANCE RHYTHM PROTOCOL
              </p>
            </div>

            <DifficultySelector
              difficulty={difficulty}
              onChange={setDifficulty}
            />

            <p className="text-xs text-white/70 leading-relaxed font-sans">
              A high-frequency photon pulse bounces along the oscilloscope line. Tap when the pulse aligns with the resonance zone. A single miss cuts the link.
            </p>

            <button
              type="button"
              onClick={startGame}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-3.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(0,245,255,0.3)] cursor-pointer"
            >
              INITIALIZE SYNC (SPACE) ⚡
            </button>
          </motion.div>
        )}

        {/* ── ACTIVE PLAYING FIELD ── */}
        {gameState === 'playing' && (
          <div className="w-full max-w-2xl flex flex-col items-center gap-8 py-6">
            {/* Feedback Pop */}
            <div className="h-8 flex items-center justify-center">
              {hitFeedback === 'PERFECT' && (
                <motion.span
                  initial={{ scale: 1.4, opacity: 1 }}
                  animate={{ scale: 1, opacity: 0 }}
                  transition={{ duration: 0.3 }}
                  className="text-lg font-black tracking-widest text-emerald-400 drop-shadow-[0_0_12px_rgba(52,211,153,1)]"
                >
                  HARMONIC LOCK ✓
                </motion.span>
              )}
            </div>

            {/* Oscilloscope Visualizer Box */}
            <div className="w-full h-48 sm:h-56 rounded-3xl border-2 border-cyan-500/40 bg-black/85 backdrop-blur-2xl shadow-[0_0_50px_rgba(0,245,255,0.2)] relative overflow-hidden flex items-center justify-center">
              {/* Retro CRT Scan Grid */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage:
                    'linear-gradient(rgba(0, 245, 255, 0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 255, 0.3) 1px, transparent 1px)',
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Center Oscilloscope Wave Line */}
              <div className="w-full h-0.5 bg-cyan-500/30 shadow-[0_0_10px_rgba(0,245,255,0.5)] relative">
                {/* Target Zone */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 h-14 sm:h-16 rounded-xl border border-emerald-400/80 bg-emerald-500/20 shadow-[0_0_25px_rgba(52,211,153,0.4)] flex items-center justify-center transition-all duration-75"
                  style={{
                    left: `${targetCenter - targetWidth / 2}%`,
                    width: `${targetWidth}%`,
                  }}
                >
                  <span className="text-[9px] font-black tracking-widest text-emerald-300/80 uppercase">
                    ZONE
                  </span>
                </div>

                {/* Moving Neon Dot */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 w-6 h-6 rounded-full bg-cyan-300 border-2 border-white shadow-[0_0_25px_rgba(0,245,255,1),0_0_50px_rgba(0,245,255,0.8)] -translate-x-1/2 z-20 pointer-events-none"
                  style={{ left: `${dotPos}%` }}
                />
              </div>
            </div>

            {/* Tap Action Bar (Large touch target for phones) */}
            <div className="w-full max-w-md flex flex-col items-center gap-3">
              <button
                type="button"
                onClick={handleTrigger}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-5 rounded-2xl bg-cyan-500/25 hover:bg-cyan-500/35 active:scale-95 border-2 border-cyan-400 text-cyan-200 font-black text-lg tracking-[0.25em] uppercase shadow-[0_0_30px_rgba(0,245,255,0.4)] transition-transform cursor-pointer"
              >
                PULSE TRIGGER
              </button>
              <p className="text-xs text-white/40 uppercase tracking-widest text-center">
                Tap anywhere on screen or press SPACE
              </p>
            </div>
          </div>
        )}

        {/* ── GAME OVER SCREEN ── */}
        {gameState === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            onClick={(e) => e.stopPropagation()}
            className="max-w-md w-full p-6 sm:p-8 rounded-3xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(255,55,95,0.25)] text-center flex flex-col items-center gap-5 cursor-default"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.3)]">
              💥
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-red-400 mb-1">
                SIGNAL DE-SYNCHRONIZED
              </h2>
              <p className="text-xs text-red-400/70 uppercase tracking-widest">
                HARMONIC COHERENCE COLLAPSED
              </p>
            </div>

            {/* Scorecard */}
            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Final Score</span>
                <span className="text-3xl font-black text-cyan-300 font-mono tracking-tight">
                  {finalScore}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Sync Hits</span>
                <span className="font-bold text-white/80">{hits}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Difficulty Multiplier</span>
                <span className="font-bold text-cyan-300">{difficulty.toUpperCase()} ({multiplier}x)</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Longest Streak</span>
                <span className="font-bold text-amber-300">{maxStreak}x</span>
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
                className="w-full py-3.5 rounded-2xl bg-cyan-500/20 hover:bg-cyan-500/30 border border-cyan-500/50 hover:border-cyan-400 text-cyan-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(0,245,255,0.25)] cursor-pointer"
              >
                RE-SYNC SIGNAL ↻
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

export default SignalSync
