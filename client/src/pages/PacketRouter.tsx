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

export type PacketColor = 'cyan' | 'red'
export type SwitchDir = 'left' | 'right'
export type NodeId = 'j0' | 'j1' | 'j2' | 'j3' | 'j4' | 'j5'

interface JunctionCoord {
  x: number
  y: number
  label: string
}

// Coordinates of the 6 junction nodes in the 3-row branching tree
const JUNCTIONS: Record<NodeId, JunctionCoord> = {
  j0: { x: 50, y: 20, label: 'J-0' }, // Row 0 (Center)
  j1: { x: 35, y: 44, label: 'J-1' }, // Row 1 (Left)
  j2: { x: 65, y: 44, label: 'J-2' }, // Row 1 (Right)
  j3: { x: 20, y: 68, label: 'J-3' }, // Row 2 (Left)
  j4: { x: 50, y: 68, label: 'J-4' }, // Row 2 (Center)
  j5: { x: 80, y: 68, label: 'J-5' }, // Row 2 (Right)
}

// Destination Bins at bottom
const BINS: Record<PacketColor, { x: number; y: number; label: string; sub: string }> = {
  cyan: { x: 30, y: 90, label: 'PORT ALPHA', sub: 'CYAN BIN' },
  red: { x: 70, y: 90, label: 'PORT OMEGA', sub: 'RED BIN' },
}

// Top Spawner Emitter coordinate
const SPAWNER = { x: 50, y: 4 }

interface Packet {
  id: string
  color: PacketColor
  leg: number // 0: Spawner -> J0, 1: J0 -> Row 1, 2: Row 1 -> Row 2, 3: Row 2 -> Bin
  currentNode?: NodeId
  targetNode?: NodeId
  targetBin?: PacketColor
  startX: number
  startY: number
  targetX: number
  targetY: number
}

// Timing parameters per difficulty
const DIFFICULTY_CONFIG: Record<
  Difficulty,
  { legDuration: number; spawnInterval: number }
> = {
  easy: { legDuration: 1.6, spawnInterval: 3200 },
  medium: { legDuration: 1.15, spawnInterval: 2200 },
  hard: { legDuration: 0.8, spawnInterval: 1400 },
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
  const [flashingBin, setFlashingBin] = useState<{ bin: PacketColor; success: boolean } | null>(null)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  // Junction switches: all default to 'left'
  const [switches, setSwitches] = useState<Record<NodeId, SwitchDir>>({
    j0: 'left',
    j1: 'left',
    j2: 'right',
    j3: 'left',
    j4: 'left',
    j5: 'right',
  })

  // Mutable refs to prevent stale closure bugs in animation callbacks
  const switchesRef = useRef<Record<NodeId, SwitchDir>>(switches)
  const gameStateRef = useRef<'idle' | 'playing' | 'gameover'>('idle')
  const difficultyRef = useRef<Difficulty>(difficulty)
  const livesRef = useRef<number>(3)
  const scoreRef = useRef<number>(0)
  const streakRef = useRef<number>(0)
  const maxStreakRef = useRef<number>(0)
  const packetIdCounter = useRef<number>(0)
  const spawnTimerRef = useRef<any>(null)

  switchesRef.current = switches
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

  // Spawn new packet at top center
  const spawnPacket = useCallback(() => {
    if (gameStateRef.current !== 'playing') return

    // Pick Cyan or Red
    const color: PacketColor = Math.random() < 0.5 ? 'cyan' : 'red'
    packetIdCounter.current += 1
    const id = `pkt_${Date.now()}_${packetIdCounter.current}`

    playRouterTone('spawn')

    setPackets((prev) => [
      ...prev,
      {
        id,
        color,
        leg: 0,
        startX: SPAWNER.x,
        startY: SPAWNER.y,
        targetX: JUNCTIONS.j0.x,
        targetY: JUNCTIONS.j0.y,
        targetNode: 'j0',
      },
    ])
  }, [])

  // Toggle Junction switch between 'left' and 'right'
  const toggleSwitch = (nodeId: NodeId) => {
    playRouterTone('switch')
    setSwitches((prev) => {
      const nextDir: SwitchDir = prev[nodeId] === 'left' ? 'right' : 'left'
      const updated = { ...prev, [nodeId]: nextDir }
      switchesRef.current = updated
      return updated
    })
  }

  // Handle packet leg completion
  const handleLegComplete = (packetId: string) => {
    if (gameStateRef.current !== 'playing') return

    setPackets((prev) => {
      const pkt = prev.find((p) => p.id === packetId)
      if (!pkt) return prev

      const currentSwitches = switchesRef.current

      if (pkt.leg === 0) {
        // Reached J0 (Row 0) -> decide next node in Row 1
        const dir = currentSwitches.j0
        const nextNode: NodeId = dir === 'left' ? 'j1' : 'j2'
        const targetCoord = JUNCTIONS[nextNode]

        return prev.map((p) =>
          p.id === packetId
            ? {
                ...p,
                leg: 1,
                currentNode: 'j0',
                targetNode: nextNode,
                startX: JUNCTIONS.j0.x,
                startY: JUNCTIONS.j0.y,
                targetX: targetCoord.x,
                targetY: targetCoord.y,
              }
            : p
        )
      }

      if (pkt.leg === 1) {
        // Reached Row 1 node (J1 or J2) -> decide next node in Row 2
        const currentNode = pkt.targetNode || 'j1'
        const dir = currentSwitches[currentNode]

        let nextNode: NodeId
        if (currentNode === 'j1') {
          nextNode = dir === 'left' ? 'j3' : 'j4'
        } else {
          // j2
          nextNode = dir === 'left' ? 'j4' : 'j5'
        }

        const startCoord = JUNCTIONS[currentNode]
        const targetCoord = JUNCTIONS[nextNode]

        return prev.map((p) =>
          p.id === packetId
            ? {
                ...p,
                leg: 2,
                currentNode,
                targetNode: nextNode,
                startX: startCoord.x,
                startY: startCoord.y,
                targetX: targetCoord.x,
                targetY: targetCoord.y,
              }
            : p
        )
      }

      if (pkt.leg === 2) {
        // Reached Row 2 node (J3, J4, or J5) -> decide destination Bin
        const currentNode = pkt.targetNode || 'j4'
        const dir = currentSwitches[currentNode]
        const targetBin: PacketColor = dir === 'left' ? 'cyan' : 'red'

        const startCoord = JUNCTIONS[currentNode]
        const binCoord = BINS[targetBin]

        return prev.map((p) =>
          p.id === packetId
            ? {
                ...p,
                leg: 3,
                currentNode,
                targetNode: undefined,
                targetBin,
                startX: startCoord.x,
                startY: startCoord.y,
                targetX: binCoord.x,
                targetY: binCoord.y,
              }
            : p
        )
      }

      // Leg 3 complete: Arrived in destination bin!
      const destinationBin = pkt.targetBin || 'cyan'
      const isMatch = pkt.color === destinationBin

      setFlashingBin({ bin: destinationBin, success: isMatch })
      setTimeout(() => setFlashingBin(null), 400)

      if (isMatch) {
        // SUCCESSFUL ROUTING
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
        // MISROUTED BUFFER MISMATCH
        playRouterTone('wrong')
        streakRef.current = 0
        setStreak(0)

        const newLives = livesRef.current - 1
        livesRef.current = newLives
        setLives(newLives)
        setFeedback({ text: 'BUFFER MISMATCH! -1 CORE', isCorrect: false })

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

    const initialSwitches: Record<NodeId, SwitchDir> = {
      j0: 'left',
      j1: 'left',
      j2: 'right',
      j3: 'left',
      j4: 'left',
      j5: 'right',
    }
    setSwitches(initialSwitches)
    switchesRef.current = { ...initialSwitches }

    if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)

    // Initial spawn after 400ms
    setTimeout(() => {
      if (gameStateRef.current === 'playing') {
        spawnPacket()
      }
    }, 400)

    const interval = DIFFICULTY_CONFIG[difficulty].spawnInterval
    spawnTimerRef.current = setInterval(spawnPacket, interval)
  }

  // Clean up timer on unmount
  useEffect(() => {
    return () => {
      if (spawnTimerRef.current) clearInterval(spawnTimerRef.current)
    }
  }, [])

  const speedConfig = DIFFICULTY_CONFIG[difficulty]

  return (
    <div
      style={{ touchAction: 'manipulation' }}
      className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 select-none"
    >
      {/* ── Top Header ── */}
      <header className="w-full max-w-xl mx-auto flex items-center justify-between pb-3 mb-3 border-b border-white/10">
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
              Flip junction switches to route Cyan and Red packets into matching ports.
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
            ACTIVE JUNCTION ROUTING GRID
        ═══════════════════════════════════════════════════════════════════ */}
        <div
          className="relative w-full h-[540px] rounded-3xl border border-white/10 backdrop-blur-2xl overflow-hidden flex flex-col justify-between p-4"
          style={{
            background:
              'linear-gradient(180deg, rgba(10, 15, 25, 0.94) 0%, rgba(5, 8, 15, 0.98) 100%)',
            boxShadow:
              '0 20px 50px rgba(0, 0, 0, 0.6), inset 0 0 60px rgba(0, 245, 255, 0.03)',
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

          {/* SVG Connection Conduits */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-0">
            {/* 1. Spawner -> J0 */}
            <line
              x1={`${SPAWNER.x}%`}
              y1={`${SPAWNER.y}%`}
              x2={`${JUNCTIONS.j0.x}%`}
              y2={`${JUNCTIONS.j0.y}%`}
              stroke="rgba(0, 245, 255, 0.4)"
              strokeWidth="3"
              strokeDasharray="4 4"
            />

            {/* 2. J0 -> J1 (Row 0 Left) */}
            <line
              x1={`${JUNCTIONS.j0.x}%`}
              y1={`${JUNCTIONS.j0.y}%`}
              x2={`${JUNCTIONS.j1.x}%`}
              y2={`${JUNCTIONS.j1.y}%`}
              stroke={
                switches.j0 === 'left'
                  ? 'rgba(0, 245, 255, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j0 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j0 === 'left' ? undefined : '3 3'}
            />

            {/* 3. J0 -> J2 (Row 0 Right) */}
            <line
              x1={`${JUNCTIONS.j0.x}%`}
              y1={`${JUNCTIONS.j0.y}%`}
              x2={`${JUNCTIONS.j2.x}%`}
              y2={`${JUNCTIONS.j2.y}%`}
              stroke={
                switches.j0 === 'right'
                  ? 'rgba(255, 55, 95, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j0 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j0 === 'right' ? undefined : '3 3'}
            />

            {/* 4. J1 -> J3 (Row 1 Left -> Row 2 Left) */}
            <line
              x1={`${JUNCTIONS.j1.x}%`}
              y1={`${JUNCTIONS.j1.y}%`}
              x2={`${JUNCTIONS.j3.x}%`}
              y2={`${JUNCTIONS.j3.y}%`}
              stroke={
                switches.j1 === 'left'
                  ? 'rgba(0, 245, 255, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j1 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j1 === 'left' ? undefined : '3 3'}
            />

            {/* 5. J1 -> J4 (Row 1 Left -> Row 2 Center) */}
            <line
              x1={`${JUNCTIONS.j1.x}%`}
              y1={`${JUNCTIONS.j1.y}%`}
              x2={`${JUNCTIONS.j4.x}%`}
              y2={`${JUNCTIONS.j4.y}%`}
              stroke={
                switches.j1 === 'right'
                  ? 'rgba(255, 55, 95, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j1 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j1 === 'right' ? undefined : '3 3'}
            />

            {/* 6. J2 -> J4 (Row 1 Right -> Row 2 Center) */}
            <line
              x1={`${JUNCTIONS.j2.x}%`}
              y1={`${JUNCTIONS.j2.y}%`}
              x2={`${JUNCTIONS.j4.x}%`}
              y2={`${JUNCTIONS.j4.y}%`}
              stroke={
                switches.j2 === 'left'
                  ? 'rgba(0, 245, 255, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j2 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j2 === 'left' ? undefined : '3 3'}
            />

            {/* 7. J2 -> J5 (Row 1 Right -> Row 2 Right) */}
            <line
              x1={`${JUNCTIONS.j2.x}%`}
              y1={`${JUNCTIONS.j2.y}%`}
              x2={`${JUNCTIONS.j5.x}%`}
              y2={`${JUNCTIONS.j5.y}%`}
              stroke={
                switches.j2 === 'right'
                  ? 'rgba(255, 55, 95, 0.75)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j2 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j2 === 'right' ? undefined : '3 3'}
            />

            {/* 8. J3 -> Cyan Bin (Row 2 Left -> Cyan) */}
            <line
              x1={`${JUNCTIONS.j3.x}%`}
              y1={`${JUNCTIONS.j3.y}%`}
              x2={`${BINS.cyan.x}%`}
              y2={`${BINS.cyan.y}%`}
              stroke={
                switches.j3 === 'left'
                  ? 'rgba(0, 245, 255, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j3 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j3 === 'left' ? undefined : '3 3'}
            />

            {/* 9. J3 -> Red Bin (Row 2 Left -> Red cross-conduit) */}
            <line
              x1={`${JUNCTIONS.j3.x}%`}
              y1={`${JUNCTIONS.j3.y}%`}
              x2={`${BINS.red.x}%`}
              y2={`${BINS.red.y}%`}
              stroke={
                switches.j3 === 'right'
                  ? 'rgba(255, 55, 95, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j3 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j3 === 'right' ? undefined : '3 3'}
            />

            {/* 10. J4 -> Cyan Bin (Row 2 Center -> Cyan) */}
            <line
              x1={`${JUNCTIONS.j4.x}%`}
              y1={`${JUNCTIONS.j4.y}%`}
              x2={`${BINS.cyan.x}%`}
              y2={`${BINS.cyan.y}%`}
              stroke={
                switches.j4 === 'left'
                  ? 'rgba(0, 245, 255, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j4 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j4 === 'left' ? undefined : '3 3'}
            />

            {/* 11. J4 -> Red Bin (Row 2 Center -> Red) */}
            <line
              x1={`${JUNCTIONS.j4.x}%`}
              y1={`${JUNCTIONS.j4.y}%`}
              x2={`${BINS.red.x}%`}
              y2={`${BINS.red.y}%`}
              stroke={
                switches.j4 === 'right'
                  ? 'rgba(255, 55, 95, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j4 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j4 === 'right' ? undefined : '3 3'}
            />

            {/* 12. J5 -> Cyan Bin (Row 2 Right -> Cyan cross-conduit) */}
            <line
              x1={`${JUNCTIONS.j5.x}%`}
              y1={`${JUNCTIONS.j5.y}%`}
              x2={`${BINS.cyan.x}%`}
              y2={`${BINS.cyan.y}%`}
              stroke={
                switches.j5 === 'left'
                  ? 'rgba(0, 245, 255, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j5 === 'left' ? '3' : '2'}
              strokeDasharray={switches.j5 === 'left' ? undefined : '3 3'}
            />

            {/* 13. J5 -> Red Bin (Row 2 Right -> Red) */}
            <line
              x1={`${JUNCTIONS.j5.x}%`}
              y1={`${JUNCTIONS.j5.y}%`}
              x2={`${BINS.red.x}%`}
              y2={`${BINS.red.y}%`}
              stroke={
                switches.j5 === 'right'
                  ? 'rgba(255, 55, 95, 0.85)'
                  : 'rgba(255, 255, 255, 0.08)'
              }
              strokeWidth={switches.j5 === 'right' ? '3' : '2'}
              strokeDasharray={switches.j5 === 'right' ? undefined : '3 3'}
            />
          </svg>

          {/* ── Top Center Packet Spawner Emitter ── */}
          <div
            className="absolute z-10 -translate-x-1/2 flex flex-col items-center"
            style={{ left: `${SPAWNER.x}%`, top: `${SPAWNER.y}%` }}
          >
            <div className="w-14 h-4 rounded-full bg-cyan-500/10 border border-cyan-400/40 flex items-center justify-center shadow-[0_0_15px_rgba(0,245,255,0.3)]">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping" />
            </div>
            <span className="text-[8px] font-mono uppercase text-cyan-300/60 mt-0.5">
              EMITTER
            </span>
          </div>

          {/* ── 6 Interactive Junction Switch Nodes ── */}
          {(Object.keys(JUNCTIONS) as NodeId[]).map((nodeId) => {
            const coord = JUNCTIONS[nodeId]
            const dir = switches[nodeId]
            const isLeft = dir === 'left'

            return (
              <div
                key={nodeId}
                className="absolute z-20 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center"
                style={{ left: `${coord.x}%`, top: `${coord.y}%` }}
              >
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.88 }}
                  onClick={() => toggleSwitch(nodeId)}
                  disabled={gameState !== 'playing'}
                  style={{
                    touchAction: 'manipulation',
                    background: isLeft
                      ? 'rgba(0, 245, 255, 0.14)'
                      : 'rgba(255, 55, 95, 0.14)',
                    borderColor: isLeft
                      ? 'rgba(0, 245, 255, 0.8)'
                      : 'rgba(255, 55, 95, 0.8)',
                    boxShadow: isLeft
                      ? '0 0 18px rgba(0, 245, 255, 0.45)'
                      : '0 0 18px rgba(255, 55, 95, 0.45)',
                  }}
                  className="w-12 h-12 rounded-2xl border flex flex-col items-center justify-center cursor-pointer backdrop-blur-xl transition-all shadow-md group"
                >
                  <span
                    className={`text-xl leading-none font-black transition-transform duration-200 ${
                      isLeft ? 'text-cyan-300' : 'text-red-300'
                    }`}
                  >
                    {isLeft ? '↙' : '↘'}
                  </span>
                  <span
                    className={`text-[8px] font-mono font-bold uppercase tracking-tighter ${
                      isLeft ? 'text-cyan-400' : 'text-red-400'
                    }`}
                  >
                    {isLeft ? 'LEFT' : 'RIGHT'}
                  </span>
                </motion.button>
                <span className="text-[8px] font-mono text-white/30 tracking-tight mt-1">
                  {coord.label}
                </span>
              </div>
            )
          })}

          {/* ── Active Packets in Flight ── */}
          <AnimatePresence>
            {packets.map((pkt) => {
              const isCyan = pkt.color === 'cyan'
              const colorHex = isCyan ? '#00F5FF' : '#FF375F'
              const bgClass = isCyan ? 'bg-cyan-400' : 'bg-red-400'
              const glowClass = isCyan
                ? 'shadow-[0_0_20px_rgba(0,245,255,0.9)]'
                : 'shadow-[0_0_20px_rgba(255,55,95,0.9)]'

              return (
                <motion.div
                  key={pkt.id}
                  initial={{
                    left: `${pkt.startX}%`,
                    top: `${pkt.startY}%`,
                    scale: 0.8,
                  }}
                  animate={{
                    left: `${pkt.targetX}%`,
                    top: `${pkt.targetY}%`,
                    scale: [0.95, 1.15, 1],
                  }}
                  transition={{
                    left: { duration: speedConfig.legDuration, ease: 'linear' },
                    top: { duration: speedConfig.legDuration, ease: 'linear' },
                    scale: { duration: 0.35, repeat: Infinity },
                  }}
                  onAnimationComplete={() => handleLegComplete(pkt.id)}
                  style={{
                    transform: 'translate(-50%, -50%)',
                    borderColor: colorHex,
                  }}
                  className={`absolute z-30 w-7 h-7 rounded-full border-2 flex items-center justify-center ${bgClass} ${glowClass}`}
                >
                  <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* ── Destination Bins at Bottom ── */}
          <div className="relative z-10 w-full flex items-center justify-around pb-2 mt-auto">
            {/* CYAN BIN (Port Alpha) */}
            <motion.div
              animate={
                flashingBin?.bin === 'cyan'
                  ? {
                      scale: [1, 1.14, 1],
                      borderColor: flashingBin.success ? '#00F5FF' : '#FF375F',
                    }
                  : {}
              }
              transition={{ duration: 0.3 }}
              style={{
                background:
                  flashingBin?.bin === 'cyan'
                    ? flashingBin.success
                      ? 'rgba(0, 245, 255, 0.35)'
                      : 'rgba(255, 55, 95, 0.35)'
                    : 'rgba(0, 245, 255, 0.08)',
                boxShadow:
                  flashingBin?.bin === 'cyan'
                    ? flashingBin.success
                      ? '0 0 30px rgba(0, 245, 255, 0.8)'
                      : '0 0 30px rgba(255, 55, 95, 0.8)'
                    : '0 0 20px rgba(0, 245, 255, 0.2)',
                borderColor: '#00F5FF',
              }}
              className="w-36 py-2.5 px-2 rounded-2xl border text-center flex flex-col items-center justify-center transition-all"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 shadow-[0_0_8px_#00F5FF]" />
                <span className="text-[11px] font-mono font-bold tracking-wider text-cyan-300">
                  {BINS.cyan.label}
                </span>
              </div>
              <span className="text-[9px] font-mono font-extrabold text-cyan-400/80 tracking-widest uppercase">
                {BINS.cyan.sub}
              </span>
            </motion.div>

            {/* RED BIN (Port Omega) */}
            <motion.div
              animate={
                flashingBin?.bin === 'red'
                  ? {
                      scale: [1, 1.14, 1],
                      borderColor: flashingBin.success ? '#FF375F' : '#00F5FF',
                    }
                  : {}
              }
              transition={{ duration: 0.3 }}
              style={{
                background:
                  flashingBin?.bin === 'red'
                    ? flashingBin.success
                      ? 'rgba(255, 55, 95, 0.35)'
                      : 'rgba(0, 245, 255, 0.35)'
                    : 'rgba(255, 55, 95, 0.08)',
                boxShadow:
                  flashingBin?.bin === 'red'
                    ? flashingBin.success
                      ? '0 0 30px rgba(255, 55, 95, 0.8)'
                      : '0 0 30px rgba(0, 245, 255, 0.8)'
                    : '0 0 20px rgba(255, 55, 95, 0.2)',
                borderColor: '#FF375F',
              }}
              className="w-36 py-2.5 px-2 rounded-2xl border text-center flex flex-col items-center justify-center transition-all"
            >
              <div className="flex items-center gap-1.5 mb-0.5">
                <span className="w-2.5 h-2.5 rounded-full bg-red-400 shadow-[0_0_8px_#FF375F]" />
                <span className="text-[11px] font-mono font-bold tracking-wider text-red-300">
                  {BINS.red.label}
                </span>
              </div>
              <span className="text-[9px] font-mono font-extrabold text-red-400/80 tracking-widest uppercase">
                {BINS.red.sub}
              </span>
            </motion.div>
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
                Packets spawn at top center. Click junction switches (Left or Right) to steer Cyan packets to the Cyan port and Red packets to the Red port!
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
                  <span className="font-bold">
                    {DIFFICULTY_MULTIPLIERS[difficulty]}x ({difficulty.toUpperCase()})
                  </span>
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
