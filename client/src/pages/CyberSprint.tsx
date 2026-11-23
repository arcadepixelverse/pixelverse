import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'
import { DifficultySelector, type Difficulty, DIFFICULTY_MULTIPLIERS } from '../components/DifficultySelector'

// ── 200 Unique Cyberpunk & Technical Dictionary ──────────────────────────────
const CYBER_DICTIONARY = {
  easy: [
    'bot', 'hex', 'ram', 'cpu', 'bug', 'bit', 'net', 'log', 'key', 'mod', 'dev', 'opt',
    'arp', 'mac', 'raw', 'hub', 'sub', 'tag', 'dns', 'ip', 'ssh', 'ssl', 'tcp', 'udp',
    'zip', 'tar', 'root', 'node', 'code', 'chip', 'data', 'byte', 'sync', 'loop', 'ping',
    'port', 'hack', 'grid', 'host', 'link', 'core', 'dump', 'pipe', 'lock', 'leak', 'zero',
    'load', 'fork', 'kill', 'null', 'void', 'main', 'bios', 'cron', 'echo', 'grep', 'sudo',
    'unix', 'bash', 'worm', 'warp', 'nano', 'wire', 'scan', 'cyber', 'proxy', 'stack', 'cache',
    'array', 'logic', 'patch', 'token', 'trace', 'flash', 'reset', 'pixel', 'route', 'vault',
    'input', 'pulse', 'laser', 'macro', 'relay', 'spool', 'yield', 'synth', 'drone', 'ghost'
  ],
  medium: [
    'matrix', 'daemon', 'crypto', 'kernel', 'vector', 'binary', 'trojan', 'socket', 'docker',
    'stream', 'buffer', 'thread', 'lambda', 'router', 'packet', 'uplink', 'phreak', 'shodan',
    'subgrid', 'cyborg', 'keygen', 'memory', 'server', 'client', 'neural', 'glitch', 'script',
    'shadow', 'switch', 'beacon', 'filter', 'packet', 'portal', 'sensor', 'shield', 'status',
    'system', 'engine', 'hazard', 'target', 'module', 'device', 'access', 'attack', 'breach',
    'bypass', 'cipher', 'cursor', 'damage', 'defend', 'delete', 'direct', 'domain', 'encode',
    'export', 'finger', 'format', 'freeze', 'impact', 'import', 'insert', 'invoke', 'listen',
    'locate', 'manual', 'notify', 'output', 'reboot', 'record', 'repair', 'replay', 'resume',
    'reveal', 'rewind', 'search', 'secure', 'select', 'signal', 'static', 'string', 'submit',
    'synced', 'unlock', 'update', 'upload', 'verify', 'widget', 'radius', 'payload', 'gateway'
  ],
  hard: [
    'mainframe', 'firewall', 'overflow', 'subroutine', 'algorithm', 'bandwidth', 'compiler',
    'firmware', 'hypervisor', 'telemetry', 'overclock', 'cyberdeck', 'netrunner', 'cyberspace',
    'heuristic', 'biometrics', 'logicgate', 'assembler', 'hardwire', 'interface', 'cryptography',
    'vulnerability', 'infiltrator', 'recursion', 'backdoor', 'datastream', 'encryption', 'decryption',
    'hexadecimal', 'hypertext', 'intercept', 'malfunction', 'nanotech', 'nanoseconds', 'oscillator',
    'penetration', 'permission', 'polyglot', 'protocol', 'quarantine', 'realtime', 'resistance',
    'resolution', 'retrograde', 'sandboxing', 'scrambler', 'simulation', 'stylesheet', 'subroutine',
    'supernova', 'synchrony', 'technician', 'throughput', 'transistor', 'transmission', 'triangulate',
    'ultraviolet', 'wavelength', 'wiretapping', 'rootkit', 'zeroday', 'spectre', 'meltdown'
  ]
}

interface FallingWord {
  id: string
  text: string
  x: number // Horizontal percentage (8% to 78%)
  y: number // Vertical percentage (0% to 100%)
  speed: number // % per second
  color: string
}

interface Explosion {
  id: string
  x: number
  y: number
  text: string
  points: number
}

// Retro Web Audio Synthesizer (0ms latency, zero assets)
function playSound(type: 'hit' | 'miss' | 'gameover' | 'start') {
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
      osc.type = 'triangle'
      osc.frequency.setValueAtTime(480, now)
      osc.frequency.exponentialRampToValueAtTime(960, now + 0.1)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'miss') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(160, now)
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.25)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'gameover') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(35, now + 0.6)
      gain.gain.setValueAtTime(0.35, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
      osc.start(now)
      osc.stop(now + 0.6)
    } else if (type === 'start') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.18)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.18)
      osc.start(now)
      osc.stop(now + 0.18)
    }
  } catch {
    // Ignore audio context auto-play limitations
  }
}

export function CyberSprint() {
  const [difficulty, setDifficulty] = useState<Difficulty>('medium')
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [baseScore, setBaseScore] = useState<number>(0)
  const [finalScore, setFinalScore] = useState<number>(0)
  const [lives, setLives] = useState<number>(3)
  const [words, setWords] = useState<FallingWord[]>([])
  const [input, setInput] = useState<string>('')
  const [streak, setStreak] = useState<number>(0)
  const [maxStreak, setMaxStreak] = useState<number>(0)
  const [wordsDestroyed, setWordsDestroyed] = useState<number>(0)
  const [explosions, setExplosions] = useState<Explosion[]>([])
  const [isGlitching, setIsGlitching] = useState<boolean>(false)
  const [leaderboardStatus, setLeaderboardStatus] = useState<string>('')
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState<boolean>(false)

  const inputRef = useRef<HTMLInputElement | null>(null)
  const animationFrameRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)
  const lastSpawnTimeRef = useRef<number>(0)

  // Mutable refs to ensure 60fps loop access without closures
  const difficultyRef = useRef<Difficulty>(difficulty)
  difficultyRef.current = difficulty
  const baseScoreRef = useRef<number>(baseScore)
  baseScoreRef.current = baseScore
  const livesRef = useRef<number>(lives)
  livesRef.current = lives
  const wordsRef = useRef<FallingWord[]>(words)
  wordsRef.current = words
  const streakRef = useRef<number>(streak)
  streakRef.current = streak

  // Submit high score to backend leaderboard
  const submitScore = async (scoreToSubmit: number, currentDiff: Difficulty) => {
    if (scoreToSubmit <= 0) return
    setLeaderboardStatus('Transmitting score to Global Hall of Fame...')
    try {
      const res = await apiFetch('/api/leaderboard/cyber_sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: scoreToSubmit, difficulty: currentDiff }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Score transmitted to Global Leaderboard!')
      } else {
        setLeaderboardStatus('Score recorded locally.')
      }
    } catch {
      setLeaderboardStatus('Score recorded locally.')
    }
  }

  // Trigger Game Over
  const triggerGameOver = useCallback((rawBaseScore: number, currentDiff: Difficulty) => {
    playSound('gameover')
    const multiplier = DIFFICULTY_MULTIPLIERS[currentDiff]
    const calculatedFinal = Math.round(rawBaseScore * multiplier)

    setFinalScore(calculatedFinal)
    setGameState('gameover')

    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }

    submitScore(calculatedFinal, currentDiff)
  }, [])

  // Start or Reboot Game
  const startGame = () => {
    playSound('start')
    setBaseScore(0)
    setFinalScore(0)
    setLives(3)
    setWords([])
    setInput('')
    setStreak(0)
    setMaxStreak(0)
    setWordsDestroyed(0)
    setExplosions([])
    setIsGlitching(false)
    setLeaderboardStatus('')
    setGameState('playing')

    const now = performance.now()
    lastTimeRef.current = now
    lastSpawnTimeRef.current = now

    setTimeout(() => {
      inputRef.current?.focus()
    }, 60)
  }

  // Spawn a word matching current difficulty
  const spawnWord = () => {
    const activeTexts = new Set(wordsRef.current.map((w) => w.text))
    const wordPool = CYBER_DICTIONARY[difficultyRef.current]
    const available = wordPool.filter((w) => !activeTexts.has(w))
    const text = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : wordPool[Math.floor(Math.random() * wordPool.length)]

    // Speed scaled by difficulty and score
    const diffSpeedMultiplier =
      difficultyRef.current === 'easy' ? 0.85 : difficultyRef.current === 'hard' ? 1.6 : 1.15
    const scoreScaling = 1 + Math.min(baseScoreRef.current / 400, 2.8)
    const baseSpeed = (10 + Math.random() * 5) * diffSpeedMultiplier * scoreScaling

    const colors = ['#00F5FF', '#30D158', '#BF5AF2', '#FF9F0A']
    const color = colors[Math.floor(Math.random() * colors.length)]

    const newWord: FallingWord = {
      id: `${Date.now()}-${Math.random()}`,
      text,
      x: 8 + Math.random() * 70, // Keep comfortably away from borders
      y: 0,
      speed: baseSpeed,
      color,
    }

    setWords((prev) => [...prev, newWord])
  }

  // Robust 60fps Game Loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const loop = (currentTime: number) => {
      // Delta time in seconds, clamped to 0.1 to avoid frame drop teleporting
      const dt = Math.min((currentTime - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = currentTime

      // Dynamic spawn interval based on difficulty and score
      const baseInterval =
        difficultyRef.current === 'easy' ? 2400 : difficultyRef.current === 'hard' ? 1400 : 1850
      const spawnInterval = Math.max(650, baseInterval - Math.floor(baseScoreRef.current / 120) * 110)

      if (currentTime - lastSpawnTimeRef.current > spawnInterval) {
        spawnWord()
        lastSpawnTimeRef.current = currentTime
      }

      // Update positions
      const updated: FallingWord[] = []
      let breached = false

      for (const w of wordsRef.current) {
        const nextY = w.y + w.speed * dt
        if (nextY >= 88) {
          breached = true
        } else {
          updated.push({ ...w, y: nextY })
        }
      }

      if (breached) {
        playSound('miss')
        setIsGlitching(true)
        setTimeout(() => setIsGlitching(false), 280)

        const remaining = livesRef.current - 1
        setLives(remaining)
        setStreak(0)

        if (remaining <= 0) {
          triggerGameOver(baseScoreRef.current, difficultyRef.current)
          return
        }
      }

      setWords(updated)
      animationFrameRef.current = requestAnimationFrame(loop)
    }

    animationFrameRef.current = requestAnimationFrame(loop)

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
    }
  }, [gameState, triggerGameOver])

  // Handle typing input
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value
    setInput(rawVal)

    const typedClean = rawVal.trim().toLowerCase()
    if (!typedClean) return

    // Find if typed string matches any active falling word
    const matchedIndex = words.findIndex((w) => w.text.toLowerCase() === typedClean)

    if (matchedIndex !== -1) {
      const matchedWord = words[matchedIndex]
      playSound('hit')

      // Calculate score with streak bonus
      const wordPoints = matchedWord.text.length * 10 + streakRef.current * 5
      const newScore = baseScore + wordPoints
      const newStreak = streak + 1

      setBaseScore(newScore)
      setStreak(newStreak)
      if (newStreak > maxStreak) {
        setMaxStreak(newStreak)
      }
      setWordsDestroyed((prev) => prev + 1)

      // Add explosion animation
      const explosionId = `${Date.now()}-${Math.random()}`
      setExplosions((prev) => [
        ...prev,
        {
          id: explosionId,
          x: matchedWord.x,
          y: matchedWord.y,
          text: matchedWord.text,
          points: wordPoints,
        },
      ])

      // Auto-remove explosion after 550ms
      setTimeout(() => {
        setExplosions((prev) => prev.filter((exp) => exp.id !== explosionId))
      }, 550)

      // Remove destroyed word and reset input
      setWords((prev) => prev.filter((_, idx) => idx !== matchedIndex))
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      setInput('')
    }
  }

  const currentMultiplier = DIFFICULTY_MULTIPLIERS[difficulty]

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      style={{ touchAction: 'manipulation' }}
      className={`relative z-10 min-h-screen flex flex-col font-mono selection:bg-green-500/30 selection:text-green-200 transition-colors ${
        isGlitching ? 'bg-red-950/40' : 'bg-transparent'
      }`}
    >
      {/* ── Top HUD ── */}
      <header className="px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between border-b border-green-500/20 backdrop-blur-md bg-black/40 flex-wrap gap-2">
        <div className="flex items-center gap-2.5">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-green-400/60 hover:text-green-300 transition-colors"
          >
            <span>‹ ARCADE</span>
          </Link>
          <span className="text-green-500/30">/</span>
          <span className="text-xs font-black tracking-widest uppercase text-green-400">
            CYBER SPRINT
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-300">
            {difficulty.toUpperCase()} {currentMultiplier}x
          </span>
        </div>

        <div className="flex items-center gap-3">
          {/* Lives Indicator */}
          <div className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-xs">
            {[1, 2, 3].map((heartIndex) => (
              <span
                key={heartIndex}
                className={`transition-all ${
                  heartIndex <= lives
                    ? 'text-red-400 scale-110 drop-shadow-[0_0_8px_rgba(255,55,95,0.8)]'
                    : 'text-white/20 scale-90'
                }`}
              >
                ❤️
              </span>
            ))}
          </div>

          {/* Current Score */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-xs text-green-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">PTS:</span>
            <span className="text-sm tracking-wider">{Math.round(baseScore * currentMultiplier)}</span>
          </div>

          {/* Streak Indicator */}
          {streak > 1 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-xs text-amber-300 font-bold"
            >
              <span>🔥 {streak}x</span>
            </motion.div>
          )}

          {/* Leaderboard Button */}
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

      {/* ── Main Arcade Playfield ── */}
      <main className="flex-1 flex flex-col items-center justify-between p-3 sm:p-4 max-w-5xl w-full mx-auto relative overflow-hidden">
        {/* ── START SCREEN (IDLE) ── */}
        {gameState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-auto max-w-md w-full p-6 sm:p-8 rounded-3xl border border-green-500/40 bg-black/85 backdrop-blur-2xl shadow-[0_0_60px_rgba(48,209,88,0.15)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-green-500/15 border border-green-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(48,209,88,0.3)]">
              ⌨️
            </div>

            <div>
              <h1 className="text-3xl font-black uppercase tracking-wider text-green-300 mb-1">
                CYBER SPRINT
              </h1>
              <p className="text-xs text-green-500/70 uppercase tracking-widest">
                ZERO-API NEURAL TYPING ENGINE
              </p>
            </div>

            {/* Tactical Difficulty Selector */}
            <DifficultySelector
              difficulty={difficulty}
              onChange={setDifficulty}
            />

            <p className="text-xs text-white/70 leading-relaxed font-sans">
              Neutralize falling data streams by typing exact matches before they breach the firewall perimeter.
            </p>

            <button
              type="button"
              onClick={startGame}
              style={{ touchAction: 'manipulation' }}
              className="w-full py-3.5 rounded-2xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-400 text-green-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(48,209,88,0.3)] cursor-pointer"
            >
              INITIALIZE SPRINT ⚡
            </button>
          </motion.div>
        )}

        {/* ── ACTIVE GAME FIELD ── */}
        {gameState === 'playing' && (
          <div className="w-full flex-1 relative overflow-hidden rounded-2xl border border-green-500/20 bg-black/60 shadow-inner flex flex-col justify-end min-h-[420px] sm:min-h-[500px]">
            {/* Background Grid Lines */}
            <div
              className="absolute inset-0 opacity-15 pointer-events-none"
              style={{
                backgroundImage:
                  'linear-gradient(rgba(0, 245, 255, 0.2) 1px, transparent 1px), linear-gradient(90deg, rgba(0, 245, 255, 0.2) 1px, transparent 1px)',
                backgroundSize: '40px 40px',
              }}
            />

            {/* Falling Words Container */}
            <div className="absolute inset-0 overflow-hidden">
              {words.map((word) => {
                const cleanInput = input.trim().toLowerCase()
                const isTargeted =
                  cleanInput.length > 0 && word.text.toLowerCase().startsWith(cleanInput)
                const matchedPrefix = isTargeted ? word.text.slice(0, cleanInput.length) : ''
                const remainingText = isTargeted ? word.text.slice(cleanInput.length) : word.text

                return (
                  <div
                    key={word.id}
                    className="absolute transition-transform will-change-transform"
                    style={{
                      left: `${word.x}%`,
                      top: `${word.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div
                      className={`px-3 py-1.5 rounded-lg border text-xs font-bold tracking-widest transition-all ${
                        isTargeted
                          ? 'bg-cyan-500/25 border-cyan-400 text-cyan-200 shadow-[0_0_20px_rgba(0,245,255,0.7)] scale-110 z-20'
                          : 'bg-black/80 border-green-500/30 text-green-300 shadow-[0_0_10px_rgba(48,209,88,0.2)]'
                      }`}
                    >
                      {isTargeted ? (
                        <>
                          <span className="text-yellow-300 underline font-black">{matchedPrefix}</span>
                          <span className="text-white/60">{remainingText}</span>
                        </>
                      ) : (
                        word.text
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Framer-Motion Explosions */}
              <AnimatePresence>
                {explosions.map((exp) => (
                  <motion.div
                    key={exp.id}
                    initial={{ scale: 0.5, opacity: 1 }}
                    animate={{ scale: 1.8, opacity: 0 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5, ease: 'easeOut' }}
                    className="absolute pointer-events-none flex flex-col items-center"
                    style={{
                      left: `${exp.x}%`,
                      top: `${exp.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    <div className="w-12 h-12 rounded-full border-2 border-green-400 shadow-[0_0_30px_rgba(48,209,88,0.9)] animate-ping" />
                    <span className="text-xs font-black text-green-300 tracking-wider mt-1 drop-shadow-[0_0_10px_rgba(48,209,88,1)]">
                      +{exp.points * currentMultiplier}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Laser Tripwire Warning Line */}
            <div className="w-full h-1 bg-red-500/60 shadow-[0_0_15px_rgba(255,55,95,0.8)] relative z-10 flex items-center justify-between px-3 sm:px-4">
              <span className="text-[9px] text-red-400/80 uppercase tracking-widest bg-black px-1.5 py-0.5 rounded -translate-y-3">
                FIREWALL PERIMETER
              </span>
              <span className="text-[9px] text-red-400/80 uppercase tracking-widest bg-black px-1.5 py-0.5 rounded -translate-y-3">
                CRITICAL BREACH ZONE
              </span>
            </div>
          </div>
        )}

        {/* ── GAME OVER SCREEN ── */}
        {gameState === 'gameover' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-auto max-w-md w-full p-6 sm:p-8 rounded-3xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(255,55,95,0.25)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.3)]">
              💥
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-red-400 mb-1">
                GRID BREACHED // SYSTEM DOWN
              </h2>
              <p className="text-xs text-red-400/70 uppercase tracking-widest">
                DIFFICULTY: {difficulty.toUpperCase()} ({currentMultiplier}x MULTIPLIER)
              </p>
            </div>

            {/* Scorecard */}
            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-2.5">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Final Score</span>
                <span className="text-3xl font-black text-green-300 font-mono tracking-tight">
                  {finalScore}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Base Score</span>
                <span className="font-bold text-white/70">{baseScore}</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span className="text-white/50 uppercase">Words Neutralized</span>
                <span className="font-bold text-cyan-300">{wordsDestroyed}</span>
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

            {/* Action Buttons */}
            <div className="w-full flex flex-col gap-2.5">
              <button
                type="button"
                onClick={startGame}
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3.5 rounded-2xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-400 text-green-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(48,209,88,0.25)] cursor-pointer"
              >
                REBOOT SPRINT ↻
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

        {/* ── Glowing Input Bar ── */}
        {gameState === 'playing' && (
          <div className="w-full pt-3 flex flex-col items-center gap-2 z-20">
            <div className="w-full max-w-lg relative">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="TYPE FALLING CODE..."
                style={{ touchAction: 'manipulation' }}
                className="w-full py-3 px-5 sm:py-3.5 sm:px-6 rounded-2xl bg-black/90 border-2 border-green-500/60 focus:border-green-400 focus:shadow-[0_0_30px_rgba(48,209,88,0.4)] text-green-300 placeholder:text-green-500/30 text-center text-base sm:text-lg font-mono font-bold tracking-widest outline-none transition-all"
              />
              <span className="hidden sm:inline absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-green-500/40 pointer-events-none">
                AUTO_DESTROY
              </span>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest text-center">
              Type exact word to neutralize • Space/Enter to clear
            </p>
          </div>
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

export default CyberSprint
