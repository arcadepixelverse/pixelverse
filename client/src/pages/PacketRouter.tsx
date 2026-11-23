import { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { DifficultySelector, type Difficulty, DIFFICULTY_MULTIPLIERS } from '../components/DifficultySelector'

// Web Audio sound generator
function playRouterTone(type: 'switch' | 'success' | 'wrong' | 'gameover' | 'spawn' | 'start') {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext
    if (!AudioCtx) return
    const ctx = new AudioCtx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)

    const now = ctx.currentTime
    if (type === 'switch') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(600, now)
      osc.frequency.exponentialRampToValueAtTime(320, now + 0.05)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.05)
      osc.start(now)
      osc.stop(now + 0.05)
    } else if (type === 'success') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(523.25, now) // C5
      osc.frequency.setValueAtTime(659.25, now + 0.06) // E5
      osc.frequency.setValueAtTime(783.99, now + 0.12) // G5
      gain.gain.setValueAtTime(0.22, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.22)
      osc.start(now)
      osc.stop(now + 0.22)
    } else if (type === 'wrong') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(140, now)
      osc.frequency.linearRampToValueAtTime(70, now + 0.25)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'gameover') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(260, now)
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.6)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
      osc.start(now)
      osc.stop(now + 0.6)
    } else if (type === 'spawn') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(880, now)
      gain.gain.setValueAtTime(0.08, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.04)
      osc.start(now)
      osc.stop(now + 0.04)
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

export type PacketColor = 'cyan' | 'green' | 'purple'
export type SwitchDirection = 'left' | 'down' | 'right'

interface Packet {
  id: string
  color: PacketColor
  currentLane: number // 0: Left, 1: Center, 2: Right
  prevLane: number // For smooth diagonal animation origin
  leg: number // 0: top -> Row 1; 1: Row 1 -> Row 2; 2: Row 2 -> Bin
}

const COLOR_DEFS: Record<
  PacketColor,
  {
    name: string
    label: string
    hex: string
    bg: string
    border: string
    text: string
    glow: string
    lightBg: string
  }
> = {
  cyan: {
    name: 'CYAN',
    label: 'PORT ALPHA',
    hex: '#00F5FF',
    bg: 'bg-cyan-400',
    border: 'border-cyan-400',
    text: 'text-cyan-400',
    glow: 'shadow-[0_0_20px_rgba(0,245,255,0.6)]',
    lightBg: 'rgba(0, 245, 255, 0.12)',
  },
  green: {
    name: 'GREEN',
    label: 'PORT BETA',
    hex: '#30D158',
    bg: 'bg-green-400',
    border: 'border-green-400',
    text: 'text-green-400',
    glow: 'shadow-[0_0_20px_rgba(48,209,88,0.6)]',
    lightBg: 'rgba(48, 209, 88, 0.12)',
  },
  purple: {
    name: 'PURPLE',
    label: 'PORT GAMMA',
    hex: '#BF5AF2',
    bg: 'bg-purple-400',
    border: 'border-purple-400',
    text: 'text-purple-400',
    glow: 'shadow-[0_0_20px_rgba(191,90,242,0.6)]',
    lightBg: 'rgba(191, 90, 242, 0.12)',
  },
}

// Bins assignment: Lane 0 = Cyan, Lane 1 = Green, Lane 2 = Purple
const BIN_LANE_COLORS: PacketColor[] = ['cyan', 'green', 'purple']

// Horizontal lane percentages
const LANE_X: number[] = [20, 50, 80]

// Allowed switch directions per lane
const ALLOWED_DIRECTIONS: Record<number, SwitchDirection[]> = {
  0: ['down', 'right'],
  1: ['left', 'down', 'right'],
  2: ['down', 'left'],
}

const DIRECTION_ICONS: Record<SwitchDirection, string> = {
  down: '↓',
  left: '↙',
  right: '↘',
}

function getNextLane(lane: number, dir: SwitchDirection): number {
  if (dir === 'left') return Math.max(0, lane - 1)
  if (dir === 'right') return Math.min(2, lane + 1)
  return lane
}

// Timing parameters per difficulty
const DIFFICULTY_SPEEDS: Record<Difficulty, { legDuration: number; spawnInterval: number }> = {
  easy: { legDuration: 2.2, spawnInterval: 3200 },
  medium: { legDuration: 1.4, spawnInterval: 2200 },
  hard: { legDuration: 0.95, spawnInterval: 1500 },
}

export function PacketRouter() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [lives, setLives] = useState<number>(3)
  const [score, setScore] = useState<number>(0)
  const [streak, setStreak] = useState<number>(0)
  const [maxStreak, setMaxStreak] = useState<number>(0)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [packets, setPackets] = useState<Packet[]>([])
  const [feedback, setFeedback] = useState<{ text: string; isCorrect: boolean } | null>(null)
  const [flashingBin, setFlashingBin] = useState<{ lane: number; success: boolean } | null>(null)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  // Junction switch directions
  const [switchesRow1, setSwitchesRow1] = useState<SwitchDirection[]>(['down', 'down', 'down'])
  const [switchesRow2, setSwitchesRow2] = useState<SwitchDirection[]>(['down', 'down', 'down'])

  // Mutable refs to prevent stale closure race conditions in animation callbacks
  const switchesRow1Ref = useRef<SwitchDirection[]>(['down', 'down', 'down'])
  const switchesRow2Ref = useRef<SwitchDirection[]>(['down', 'down', 'down'])
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle')
  const difficultyRef = useRef<Difficulty>(difficulty)
  const livesRef = useRef<number>(3)
  const scoreRef = useRef<number>(0)
  const streakRef = useRef<number>(0)
  const maxStreakRef = useRef<number>(0)
  const packetIdCounter = useRef<number>(0)
  const spawnTimerRef = useRef<any>(null)

  difficultyRef.current = difficulty
  gameStateRef.current = gameState
  livesRef.current = lives
  scoreRef.current = score
  streakRef.current = streak

  // Send score to leaderboard
  const submitScore = async (scoreToSubmit: number, currentDiff: Difficulty) => {
    if (scoreToSubmit <= 0) return
    setLeaderboardStatus('Transmitting packet routing telemetry...')
    try {
      const res = await apiFetch('/api/leaderboard/packet_router', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Telemetry registered in Global Leaderboard!')
      } else {
        setLeaderboardStatus('Score saved locally.')
      }
    } catch {
      setLeaderboardStatus('Score saved locally.')
    }
  }

  // Trigger Game Over
  const triggerGameOver = useCallback(() => {
    if (gameStateRef.current !== 'playing') return
    setGameState('gameover')
    gameStateRef.current = 'gameover'
    playRouterTone('gameover')

    if (spawnTimerRef.current) {
      clearInterval(spawnTimerRef.current)
      spawnTimerRef.current = null
    }

    const mult = DIFFICULTY_MULTIPLIERS[difficultyRef.current]
    const calculated = Math.round(scoreRef.current * mult)
    setFinalScore(calculated)
    submitScore(calculated, difficultyRef.current)
  }, [])

  // Spawn new packet
  const spawnPacket = useCallback(() => {
    if (gameStateRef.current !== 'playing') return

    const colors: PacketColor[] = ['cyan', 'green', 'purple']
    const color = colors[Math.floor(Math.random() * colors.length)]
    const lane = Math.floor(Math.random() * 3)
    packetIdCounter.current += 1
    const id = `pkt_${Date.now()}_${packetIdCounter.current}`

    playRouterTone('spawn')

    setPackets((prev) => [
      ...prev,
      {
        id,
        color,
        currentLane: lane,
        prevLane: lane,
        leg: 0,
      },
    ])
  }, [])

  // Cycle junction switch direction
  const toggleSwitch = (row: 1 | 2, lane: number) => {
    playRouterTone('switch')
    const allowed = ALLOWED_DIRECTIONS[lane]

    if (row === 1) {
      setSwitchesRow1((prev) => {
        const current = prev[lane]
        const nextIdx = (allowed.indexOf(current) + 1) % allowed.length
        const updated = [...prev]
        updated[lane] = allowed[nextIdx]
        switchesRow1Ref.current = updated
        return updated
      })
    } else {
      setSwitchesRow2((prev) => {
        const current = prev[lane]
        const nextIdx = (allowed.indexOf(current) + 1) % allowed.length
        const updated = [...prev]
        updated[lane] = allowed[nextIdx]
        switchesRow2Ref.current = updated
        return updated
      })
    }
  }

  // Handle packet leg completion
  const handleLegComplete = (packetId: string) => {
    if (gameStateRef.current !== 'playing') return

    setPackets((prev) => {
      const pkt = prev.find((p) => p.id === packetId)
      if (!pkt) return prev

      if (pkt.leg === 0) {
        // Leg 0 complete: reached Row 1
        const dir = switchesRow1Ref.current[pkt.currentLane]
        const nextLane = getNextLane(pkt.currentLane, dir)
        return prev.map((p) =>
          p.id === packetId
            ? { ...p, leg: 1, prevLane: pkt.currentLane, currentLane: nextLane }
            : p
        )
      }

      if (pkt.leg === 1) {
        // Leg 1 complete: reached Row 2
        const dir = switchesRow2Ref.current[pkt.currentLane]
        const finalLane = getNextLane(pkt.currentLane, dir)
        return prev.map((p) =>
          p.id === packetId
            ? { ...p, leg: 2, prevLane: pkt.currentLane, currentLane: finalLane }
            : p
        )
      }

      // Leg 2 complete: reached destination bin!
      const targetColor = BIN_LANE_COLORS[pkt.currentLane]
      const isMatch = pkt.color === targetColor

      setFlashingBin({ lane: pkt.currentLane, success: isMatch })
      setTimeout(() => setFlashingBin(null), 400)

      if (isMatch) {
        // SUCCESS
        playRouterTone('success')
        const currentStreak = streakRef.current + 1
        streakRef.current = currentStreak
        setStreak(currentStreak)
        if (currentStreak > maxStreakRef.current) {
          maxStreakRef.current = currentStreak
          setMaxStreak(currentStreak)
        }

        const earned = 100 + currentStreak * 25
        scoreRef.current += earned
        setScore(scoreRef.current)
        setFeedback({ text: `+${earned} ROUTED!`, isCorrect: true })
      } else {
        // MISROUTED
        playRouterTone('wrong')
        streakRef.current = 0
        setStreak(0)

        const newLives = livesRef.current - 1
        livesRef.current = newLives
        setLives(newLives)
        setFeedback({ text: 'BUFFER MISMATCH! -1 LIFE', isCorrect: false })

        if (newLives <= 0) {
          triggerGameOver()
        }
      }

      setTimeout(() => setFeedback(null), 1000)

      // Remove completed packet
      return prev.filter((p) => p.id !== packetId)
    })
  }

  // Start / Reboot Game
  const startGame = () => {
    playRouterTone('start')
    setGameState('playing')
    gameStateRef.current = 'playing'
    setLives(3)
    livesRef.current = 3
    setScore(0)
    scoreRef.current = 0
    setStreak(0)
    streakRef.current = 0
    setMaxStreak(0)
    maxStreakRef.current = 0
    setFinalScore(0)
    setPackets([])
    setFeedback(null)
    setLeaderboardStatus('')

    const initialSwitches: SwitchDirection[] = ['down', 'down', 'down']
    setSwitchesRow1(initialSwitches)
    setSwitchesRow2(initialSwitches)
    switchesRow1Ref.current = [...initialSwitches]
    switchesRow2Ref.current = [...initialSwitches]

    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)

    // Initial spawn after 400ms
    setTimeout(() => {
      if (gameStateRef.current === 'playing') {
        spawnPacket()
      }
    }, 400)

    const interval = DIFFICULTY_SPEEDS[difficulty].spawnInterval
    spawnTimerRef.current = setInterval(spawnPacket, interval)
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    }
  }, [])

  const speedConfig = DIFFICULTY_SPEEDS[difficulty]

  return (
    <div
      style={{ touchAction: 'manipulation' }}
      className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 select-none"
    >
      {/* ── Top Header ── */}
      <header className="w-full max-w-4xl mx-auto flex items-center justify-between pb-3 mb-3 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Arcade</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                Packet Router
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                Zero-API
              </span>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide hidden sm:block">
              Route packets through switches to matching colored destination ports.
            </p>
          </div>
        </div>

        {/* Live Counters */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Lives Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/10 border border-red-500/30">
            <span className="text-xs text-red-400">CORES:</span>
            <div className="flex items-center gap-1">
              {[0, 1, 2].map((i) => (
                <span
                  key={i}
                  className={`w-2.5 h-2.5 rounded-full transition-all ${
                    i < lives
                      ? 'bg-red-400 shadow-[0_0_8px_rgba(255,55,95,0.8)]'
                      : 'bg-white/10 border border-white/20'
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Score Counter */}
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white/[0.03] border border-cyan-400/30">
            <span className="text-[10px] font-mono text-white/40 uppercase">Score</span>
            <span className="text-base font-black font-mono text-cyan-400">{score}</span>
          </div>

          {/* Streak Counter */}
          {streak > 1 && (
            <div className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500/15 border border-purple-500/40 text-purple-300 text-xs font-mono font-bold animate-pulse">
              <span>🔥</span>
              <span>{streak}x COMBO</span>
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsLeaderboardOpen(true)}
            className="px-2.5 py-1.5 rounded-xl border border-white/10 hover:border-cyan-400/50 bg-white/[0.03] text-xs font-mono font-bold text-white/60 hover:text-cyan-300 transition-all cursor-pointer"
          >
            🏆
          </button>
        </div>
      </header>

      {/* ── Main Router Canvas ── */}
      <main className="w-full max-w-xl mx-auto flex-1 flex flex-col items-center justify-center relative min-h-[580px]">
        {/* Floating feedback alert */}
        <AnimatePresence>
          {feedback && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.9 }}
              className={`absolute top-2 z-40 px-4 py-1.5 rounded-full text-xs font-mono font-bold tracking-wider uppercase border backdrop-blur-md ${
                feedback.isCorrect
                  ? 'bg-green-500/20 border-green-500 text-green-300 shadow-[0_0_20px_rgba(48,209,88,0.5)]'
                  : 'bg-red-500/20 border-red-500 text-red-300 shadow-[0_0_20px_rgba(255,55,95,0.5)]'
              }`}
            >
              {feedback.text}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ═══════════════════════════════════════════════════════════════════
            ACTIVE TRACK BOARD (Visible in all states as backdrop or active)
        ═══════════════════════════════════════════════════════════════════ */}
        <div
          className="relative w-full h-[520px] rounded-3xl border border-white/10 backdrop-blur-2xl overflow-hidden flex flex-col justify-between p-4"
          style={{
            background: 'linear-gradient(180deg, rgba(10, 15, 25, 0.92) 0%, rgba(5, 8, 15, 0.98) 100%)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(0, 245, 255, 0.03)',
          }}
        >
          {/* Subtle grid background pattern */}
          <div
            className="absolute inset-0 pointer-events-none opacity-20"
            style={{
              backgroundImage:
                'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.15) 1px, transparent 0)',
              backgroundSize: '24px 24px',
            }}
          />

          {/* SVG Connection Traces */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* 3 Main Vertical Conduit Lines */}
            {LANE_X.map((x, i) => (
              <line
                key={`line-${i}`}
                x1={`${x}%`}
                y1="4%"
                x2={`${x}%`}
                y2="88%"
                stroke="rgba(255, 255, 255, 0.08)"
                strokeWidth="4"
                strokeDasharray="4 6"
              />
            ))}

            {/* Row 1 Crossover Traces (Y: 38% to 68%) */}
            {/* Lane 0 -> Lane 1 */}
            <line
              x1={`${LANE_X[0]}%`}
              y1="38%"
              x2={`${LANE_X[1]}%`}
              y2="68%"
              stroke={
                switchesRow1[0] === 'right'
                  ? 'rgba(0, 245, 255, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow1[0] === 'right' ? '3' : '2'}
              strokeDasharray={switchesRow1[0] === 'right' ? undefined : '3 3'}
            />
            {/* Lane 1 -> Lane 0 */}
            <line
              x1={`${LANE_X[1]}%`}
              y1="38%"
              x2={`${LANE_X[0]}%`}
              y2="68%"
              stroke={
                switchesRow1[1] === 'left'
                  ? 'rgba(48, 209, 88, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow1[1] === 'left' ? '3' : '2'}
              strokeDasharray={switchesRow1[1] === 'left' ? undefined : '3 3'}
            />
            {/* Lane 1 -> Lane 2 */}
            <line
              x1={`${LANE_X[1]}%`}
              y1="38%"
              x2={`${LANE_X[2]}%`}
              y2="68%"
              stroke={
                switchesRow1[1] === 'right'
                  ? 'rgba(48, 209, 88, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow1[1] === 'right' ? '3' : '2'}
              strokeDasharray={switchesRow1[1] === 'right' ? undefined : '3 3'}
            />
            {/* Lane 2 -> Lane 1 */}
            <line
              x1={`${LANE_X[2]}%`}
              y1="38%"
              x2={`${LANE_X[1]}%`}
              y2="68%"
              stroke={
                switchesRow1[2] === 'left'
                  ? 'rgba(191, 90, 242, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow1[2] === 'left' ? '3' : '2'}
              strokeDasharray={switchesRow1[2] === 'left' ? undefined : '3 3'}
            />

            {/* Row 2 Crossover Traces (Y: 68% to 88%) */}
            {/* Lane 0 -> Lane 1 */}
            <line
              x1={`${LANE_X[0]}%`}
              y1="68%"
              x2={`${LANE_X[1]}%`}
              y2="88%"
              stroke={
                switchesRow2[0] === 'right'
                  ? 'rgba(0, 245, 255, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow2[0] === 'right' ? '3' : '2'}
              strokeDasharray={switchesRow2[0] === 'right' ? undefined : '3 3'}
            />
            {/* Lane 1 -> Lane 0 */}
            <line
              x1={`${LANE_X[1]}%`}
              y1="68%"
              x2={`${LANE_X[0]}%`}
              y2="88%"
              stroke={
                switchesRow2[1] === 'left'
                  ? 'rgba(48, 209, 88, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow2[1] === 'left' ? '3' : '2'}
              strokeDasharray={switchesRow2[1] === 'left' ? undefined : '3 3'}
            />
            {/* Lane 1 -> Lane 2 */}
            <line
              x1={`${LANE_X[1]}%`}
              y1="68%"
              x2={`${LANE_X[2]}%`}
              y2="88%"
              stroke={
                switchesRow2[1] === 'right'
                  ? 'rgba(48, 209, 88, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow2[1] === 'right' ? '3' : '2'}
              strokeDasharray={switchesRow2[1] === 'right' ? undefined : '3 3'}
            />
            {/* Lane 2 -> Lane 1 */}
            <line
              x1={`${LANE_X[2]}%`}
              y1="68%"
              x2={`${LANE_X[1]}%`}
              y2="88%"
              stroke={
                switchesRow2[2] === 'left'
                  ? 'rgba(191, 90, 242, 0.6)'
                  : 'rgba(255, 255, 255, 0.06)'
              }
              strokeWidth={switchesRow2[2] === 'left' ? '3' : '2'}
              strokeDasharray={switchesRow2[2] === 'left' ? undefined : '3 3'}
            />
          </svg>

          {/* ── Top Spawner Emitters ── */}
          <div className="relative z-10 w-full flex items-center justify-around pt-2">
            {[0, 1, 2].map((lane) => (
              <div
                key={`spawner-${lane}`}
                className="w-10 h-3 rounded-full bg-white/10 border border-white/20 flex items-center justify-center shadow-inner"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
              </div>
            ))}
          </div>

          {/* ── Junction Switch Row 1 (top: 38%) ── */}
          <div
            className="absolute left-0 right-0 z-20 flex justify-around items-center"
            style={{ top: '38%', transform: 'translateY(-50%)' }}
          >
            {[0, 1, 2].map((lane) => {
              const dir = switchesRow1[lane]
              return (
                <motion.button
                  key={`sw-1-${lane}`}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => toggleSwitch(1, lane)}
                  disabled={gameState !== 'playing'}
                  className="w-12 h-12 rounded-2xl border flex flex-col items-center justify-center text-sm font-black transition-all cursor-pointer backdrop-blur-xl shadow-lg"
                  style={{
                    touchAction: 'manipulation',
                    background:
                      dir === 'down'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 245, 255, 0.15)',
                    borderColor:
                      dir === 'down'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(0, 245, 255, 0.8)',
                    boxShadow:
                      dir !== 'down'
                        ? '0 0 20px rgba(0, 245, 255, 0.4)'
                        : undefined,
                  }}
                >
                  <span className="text-lg leading-none font-bold text-cyan-300">
                    {DIRECTION_ICONS[dir]}
                  </span>
                  <span className="text-[8px] font-mono uppercase text-white/40 tracking-tighter">
                    {dir}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* ── Junction Switch Row 2 (top: 68%) ── */}
          <div
            className="absolute left-0 right-0 z-20 flex justify-around items-center"
            style={{ top: '68%', transform: 'translateY(-50%)' }}
          >
            {[0, 1, 2].map((lane) => {
              const dir = switchesRow2[lane]
              return (
                <motion.button
                  key={`sw-2-${lane}`}
                  whileTap={{ scale: 0.88 }}
                  onClick={() => toggleSwitch(2, lane)}
                  disabled={gameState !== 'playing'}
                  className="w-12 h-12 rounded-2xl border flex flex-col items-center justify-center text-sm font-black transition-all cursor-pointer backdrop-blur-xl shadow-lg"
                  style={{
                    touchAction: 'manipulation',
                    background:
                      dir === 'down'
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(48, 209, 88, 0.15)',
                    borderColor:
                      dir === 'down'
                        ? 'rgba(255, 255, 255, 0.2)'
                        : 'rgba(48, 209, 88, 0.8)',
                    boxShadow:
                      dir !== 'down'
                        ? '0 0 20px rgba(48, 209, 88, 0.4)'
                        : undefined,
                  }}
                >
                  <span className="text-lg leading-none font-bold text-green-300">
                    {DIRECTION_ICONS[dir]}
                  </span>
                  <span className="text-[8px] font-mono uppercase text-white/40 tracking-tighter">
                    {dir}
                  </span>
                </motion.button>
              )
            })}
          </div>

          {/* ── Falling Packets (Rendered via Framer Motion) ── */}
          <AnimatePresence>
            {packets.map((pkt) => {
              const c = COLOR_DEFS[pkt.color]

              // Define waypoints per leg
              let startTop = '4%'
              let targetTop = '38%'
              let startLeft = `${LANE_X[pkt.prevLane]}%`
              let targetLeft = `${LANE_X[pkt.currentLane]}%`

              if (pkt.leg === 1) {
                startTop = '38%'
                targetTop = '68%'
              } else if (pkt.leg === 2) {
                startTop = '68%'
                targetTop = '88%'
              }

              return (
                <motion.div
                  key={pkt.id}
                  initial={{ top: startTop, left: startLeft, scale: 0.8 }}
                  animate={{
                    top: targetTop,
                    left: targetLeft,
                    scale: [0.9, 1.1, 0.95],
                  }}
                  transition={{
                    top: { duration: speedConfig.legDuration, ease: 'linear' },
                    left: { duration: speedConfig.legDuration, ease: 'linear' },
                    scale: { duration: 0.4, repeat: Infinity },
                  }}
                  onAnimationComplete={() => handleLegComplete(pkt.id)}
                  style={{
                    transform: 'translate(-50%, -50%)',
                  }}
                  className={`absolute z-30 w-7 h-7 rounded-full flex items-center justify-center font-black text-[9px] text-black ${c.bg} ${c.glow}`}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* ── Destination Bins (Bottom) ── */}
          <div className="relative z-10 w-full flex items-center justify-around pb-2">
            {[0, 1, 2].map((lane) => {
              const colorKey = BIN_LANE_COLORS[lane]
              const c = COLOR_DEFS[colorKey]
              const isFlashing = flashingBin?.lane === lane

              return (
                <motion.div
                  key={`bin-${lane}`}
                  animate={
                    isFlashing
                      ? {
                          scale: [1, 1.15, 1],
                          borderColor: flashingBin.success ? '#30D158' : '#FF375F',
                        }
                      : {}
                  }
                  transition={{ duration: 0.3 }}
                  className={`w-28 py-2.5 px-1 rounded-2xl border text-center flex flex-col items-center justify-center transition-all ${c.border}`}
                  style={{
                    background: isFlashing
                      ? flashingBin?.success
                        ? 'rgba(48, 209, 88, 0.3)'
                        : 'rgba(255, 55, 95, 0.3)'
                      : c.lightBg,
                    boxShadow: isFlashing
                      ? flashingBin?.success
                        ? '0 0 30px rgba(48,209,88,0.7)'
                        : '0 0 30px rgba(255,55,95,0.7)'
                      : `0 0 15px ${c.hex}33`,
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mb-1"
                    style={{ background: c.hex, boxShadow: `0 0 10px ${c.hex}` }}
                  />
                  <span className={`text-[10px] font-mono font-bold tracking-wider ${c.text}`}>
                    {c.label}
                  </span>
                  <span className="text-[9px] font-mono text-white/50 tracking-tighter">
                    {c.name}
                  </span>
                </motion.div>
              )
            })}
          </div>

          {/* ═════════════════════════════════════════════════════════════════
              OVERLAY 1: START SCREEN (Idle State)
          ═════════════════════════════════════════════════════════════════ */}
          {gameState === 'idle' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/85 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="w-16 h-16 rounded-3xl bg-cyan-500/10 border border-cyan-400/30 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(0,245,255,0.2)]">
                🔀
              </div>

              <h2 className="neon-title text-3xl sm:text-4xl font-black tracking-tight text-white mb-2">
                PACKET ROUTER
              </h2>

              <p className="text-xs text-white/60 max-w-sm mb-6 leading-relaxed">
                Packets drop from top emitters. Tap junction switches to steer them into matching color ports at the bottom.
              </p>

              {/* Difficulty Selector */}
              <div className="w-full max-w-sm mb-6">
                <DifficultySelector difficulty={difficulty} onChange={setDifficulty} />
              </div>

              <button
                type="button"
                onClick={startGame}
                style={{ touchAction: 'manipulation' }}
                className="w-full max-w-sm py-3.5 px-8 rounded-2xl font-black text-sm uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_30px_rgba(0,245,255,0.4)] transition-all cursor-pointer transform hover:-translate-y-0.5"
              >
                INITIALIZE ROUTER ▶
              </button>
            </motion.div>
          )}

          {/* ═════════════════════════════════════════════════════════════════
              OVERLAY 2: GAME OVER SCREEN
          ═════════════════════════════════════════════════════════════════ */}
          {gameState === 'gameover' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-40 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 text-center"
            >
              <div className="text-4xl mb-2">⚡</div>

              <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-red-500 mb-1">
                BUFFER OVERFLOW
              </h2>

              <p className="text-xs font-mono text-red-300/80 uppercase tracking-widest mb-6">
                All 3 Core Buffers Depleted
              </p>

              {/* Score breakdown container */}
              <div className="w-full max-w-xs p-4 rounded-2xl bg-white/[0.03] border border-white/10 mb-5 flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs text-white/50 font-mono">
                  <span>BASE ROUTING PTS:</span>
                  <span className="font-bold text-white">{score}</span>
                </div>
                <div className="flex items-center justify-between text-xs text-cyan-400 font-mono">
                  <span>DIFFICULTY MULTIPLIER:</span>
                  <span className="font-bold">{DIFFICULTY_MULTIPLIERS[difficulty]}x ({difficulty.toUpperCase()})</span>
                </div>
                <div className="flex items-center justify-between text-xs text-purple-400 font-mono">
                  <span>MAX STREAK:</span>
                  <span className="font-bold">{maxStreak}x</span>
                </div>
                <div className="h-px bg-white/10 my-1" />
                <div className="flex items-center justify-between text-sm font-mono font-black">
                  <span className="text-white/60">FINAL TELEMETRY:</span>
                  <span className="text-xl text-green-400">{finalScore}</span>
                </div>
              </div>

              {leaderboardStatus && (
                <p className="text-[11px] font-mono text-cyan-300/80 mb-5 animate-pulse">
                  {leaderboardStatus}
                </p>
              )}

              {/* Action Buttons */}
              <div className="w-full max-w-xs flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={startGame}
                  style={{ touchAction: 'manipulation' }}
                  className="w-full py-3 px-6 rounded-xl font-black text-xs uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_20px_rgba(0,245,255,0.4)] transition-all cursor-pointer"
                >
                  REBOOT ROUTER ↻
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setIsLeaderboardOpen(true)}
                    className="py-2.5 px-3 rounded-xl border border-white/20 text-xs font-mono font-bold text-white/70 hover:text-white transition-all cursor-pointer"
                  >
                    Leaderboard
                  </button>
                  <Link
                    to="/"
                    className="py-2.5 px-3 rounded-xl border border-white/20 text-xs font-mono font-bold text-white/70 hover:text-white transition-all text-center"
                  >
                    Arcade Menu
                  </Link>
                </div>
              </div>
            </motion.div>
          )}
        </div>
      </main>

      {/* Global Leaderboard Modal */}
      <Leaderboard isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} />
    </div>
  )
}

export default PacketRouter
