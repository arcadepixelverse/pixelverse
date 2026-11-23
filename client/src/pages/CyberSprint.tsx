import React, { useState, useEffect, useRef, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'
import { Leaderboard } from '../components/Leaderboard'

// ── 100+ Tech & Cyberpunk Word Dictionary ────────────────────────────────────
const CYBER_WORDS = [
  'mainframe', 'firewall', 'neural', 'glitch', 'matrix', 'protocol', 'cyber', 'daemon',
  'overflow', 'crypto', 'kernel', 'payload', 'sandbox', 'vector', 'binary', 'subroutine',
  'algorithm', 'bandwidth', 'packet', 'trojan', 'compiler', 'proxy', 'firmware', 'exploit',
  'socket', 'quantum', 'docker', 'cluster', 'hashrate', 'latency', 'recursion', 'synapse',
  'backdoor', 'rootkit', 'telemetry', 'overclock', 'cyberdeck', 'netrunner', 'darknet',
  'cyberspace', 'heuristic', 'nanotech', 'biometrics', 'circuit', 'silicon', 'logicgate',
  'bytecode', 'debugger', 'assembler', 'terminal', 'console', 'pipeline', 'lambda', 'thread',
  'mutex', 'deadlock', 'stack', 'pointer', 'variable', 'boolean', 'gateway', 'uplink',
  'downlink', 'firestorm', 'hardwire', 'interface', 'runtime', 'virtual', 'process', 'registry',
  'segment', 'archive', 'entropy', 'teleport', 'checksum', 'patch', 'phantom', 'spectre',
  'meltdown', 'token', 'handshake', 'broadcast', 'datagram', 'endpoint', 'bastion', 'zeroday',
  'cascade', 'hologram', 'nanite', 'nexus', 'override', 'phreak', 'scrambler', 'shodan',
  'subgrid', 'synaptic', 'vortex', 'wiretap', 'cyborg', 'firmware', 'hypervisor', 'keygen'
]

interface FallingWord {
  id: string
  text: string
  x: number // Percentage 5% to 80%
  y: number // Percentage 0% to 100%
  speed: number
  color: string
}

interface Explosion {
  id: string
  x: number
  y: number
  text: string
  points: number
}

// Retro Web Audio Synthesizer (Zero Assets, Instant Latency)
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
      osc.frequency.setValueAtTime(440, now)
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.1)
      gain.gain.setValueAtTime(0.2, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.15)
      osc.start(now)
      osc.stop(now + 0.15)
    } else if (type === 'miss') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(180, now)
      osc.frequency.exponentialRampToValueAtTime(60, now + 0.25)
      gain.gain.setValueAtTime(0.3, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.25)
      osc.start(now)
      osc.stop(now + 0.25)
    } else if (type === 'gameover') {
      osc.type = 'sawtooth'
      osc.frequency.setValueAtTime(220, now)
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.6)
      gain.gain.setValueAtTime(0.4, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.6)
      osc.start(now)
      osc.stop(now + 0.6)
    } else if (type === 'start') {
      osc.type = 'sine'
      osc.frequency.setValueAtTime(330, now)
      osc.frequency.exponentialRampToValueAtTime(660, now + 0.2)
      gain.gain.setValueAtTime(0.25, now)
      gain.gain.exponentialRampToValueAtTime(0.01, now + 0.2)
      osc.start(now)
      osc.stop(now + 0.2)
    }
  } catch {
    // Ignore audio context auto-play limitations
  }
}

export function CyberSprint() {
  const [gameState, setGameState] = useState<'idle' | 'playing' | 'gameover'>('idle')
  const [score, setScore] = useState<number>(0)
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

  // References to keep game loop fresh without recreating loop
  const scoreRef = useRef(score)
  scoreRef.current = score
  const livesRef = useRef(lives)
  livesRef.current = lives
  const wordsRef = useRef(words)
  wordsRef.current = words
  const streakRef = useRef(streak)
  streakRef.current = streak

  // Submit high score to backend leaderboard
  const submitLeaderboardScore = async (finalScore: number) => {
    if (finalScore <= 0) return
    setLeaderboardStatus('Transmitting score to Global Hall of Fame...')
    try {
      const res = await apiFetch('/api/leaderboard/cyber_sprint', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ score: finalScore }),
      })
      if (res.ok) {
        setLeaderboardStatus('✓ Score transmitted to Cyber Sprint Leaderboard!')
      } else {
        setLeaderboardStatus('Score recorded locally.')
      }
    } catch {
      setLeaderboardStatus('Score recorded locally.')
    }
  }

  // Trigger game over
  const triggerGameOver = useCallback((finalScore: number) => {
    playSound('gameover')
    setGameState('gameover')
    if (animationFrameRef.current) {
      cancelAnimationFrame(animationFrameRef.current)
      animationFrameRef.current = null
    }
    submitLeaderboardScore(finalScore)
  }, [])

  // Start or Reboot Game
  const startGame = () => {
    playSound('start')
    setScore(0)
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

    lastTimeRef.current = performance.now()
    lastSpawnTimeRef.current = performance.now()

    setTimeout(() => {
      inputRef.current?.focus()
    }, 50)
  }

  // Spawn a new falling word
  const spawnWord = () => {
    const activeTexts = new Set(wordsRef.current.map((w) => w.text))
    const available = CYBER_WORDS.filter((w) => !activeTexts.has(w))
    const chosenText = available.length > 0
      ? available[Math.floor(Math.random() * available.length)]
      : CYBER_WORDS[Math.floor(Math.random() * CYBER_WORDS.length)]

    // Speed scales with current score
    const speedMultiplier = 1 + Math.min(scoreRef.current / 350, 3.2)
    const baseSpeed = (12 + Math.random() * 8) * speedMultiplier // % per second

    const colors = ['#00F5FF', '#30D158', '#BF5AF2', '#FF9F0A']
    const color = colors[Math.floor(Math.random() * colors.length)]

    const newWord: FallingWord = {
      id: `${Date.now()}-${Math.random()}`,
      text: chosenText,
      x: 8 + Math.random() * 72, // Keep within 8% to 80% to avoid clipping
      y: 0,
      speed: baseSpeed,
      color,
    }

    setWords((prev) => [...prev, newWord])
  }

  // Main 60fps Game Loop
  useEffect(() => {
    if (gameState !== 'playing') {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current)
      }
      return
    }

    const loop = (currentTime: number) => {
      const dt = (currentTime - lastTimeRef.current) / 1000 // Delta in seconds
      lastTimeRef.current = currentTime

      // Dynamic spawn interval based on current score
      const currentScore = scoreRef.current
      const spawnInterval = Math.max(750, 2200 - Math.floor(currentScore / 100) * 110)

      if (currentTime - lastSpawnTimeRef.current > spawnInterval) {
        spawnWord()
        lastSpawnTimeRef.current = currentTime
      }

      // Update positions of falling words
      const updatedWords: FallingWord[] = []
      let breached = false

      for (const w of wordsRef.current) {
        const nextY = w.y + w.speed * dt

        // Check if word hit the laser line (bottom of play area)
        if (nextY >= 88) {
          breached = true
        } else {
          updatedWords.push({ ...w, y: nextY })
        }
      }

      if (breached) {
        playSound('miss')
        setIsGlitching(true)
        setTimeout(() => setIsGlitching(false), 300)

        const remainingLives = livesRef.current - 1
        setLives(remainingLives)
        setStreak(0)

        if (remainingLives <= 0) {
          triggerGameOver(scoreRef.current)
          return
        }
      }

      setWords(updatedWords)
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

    // Find if typed string matches any active word
    const matchedIndex = words.findIndex((w) => w.text.toLowerCase() === typedClean)

    if (matchedIndex !== -1) {
      const matchedWord = words[matchedIndex]
      playSound('hit')

      // Calculate score with streak bonus
      const wordPoints = matchedWord.text.length * 10 + streakRef.current * 5
      const newScore = score + wordPoints
      const newStreak = streak + 1

      setScore(newScore)
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

      // Auto-remove explosion after 600ms
      setTimeout(() => {
        setExplosions((prev) => prev.filter((exp) => exp.id !== explosionId))
      }, 600)

      // Remove destroyed word and reset input
      setWords((prev) => prev.filter((_, idx) => idx !== matchedIndex))
      setInput('')
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault()
      // If user pressed Enter or Space without matching, clear input to help them retype fast
      setInput('')
    }
  }

  return (
    <div
      onClick={() => inputRef.current?.focus()}
      className={`relative z-10 min-h-screen flex flex-col font-mono selection:bg-green-500/30 selection:text-green-200 transition-colors ${
        isGlitching ? 'bg-red-950/40' : 'bg-transparent'
      }`}
    >
      {/* ── Top HUD ── */}
      <header className="px-6 py-4 flex items-center justify-between border-b border-green-500/20 backdrop-blur-md bg-black/40">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="flex items-center gap-1.5 text-xs uppercase tracking-widest text-green-400/60 hover:text-green-300 transition-colors"
          >
            <span>‹ ARCADE_ROOT</span>
          </Link>
          <span className="text-green-500/30">/</span>
          <span className="text-xs font-black tracking-widest uppercase text-green-400">
            CYBER SPRINT
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 border border-green-500/30 text-green-300">
            ZERO_API
          </span>
        </div>

        <div className="flex items-center gap-4">
          {/* Lives Indicator */}
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full border border-red-500/30 bg-red-500/10 text-xs">
            <span className="text-[10px] text-red-400/70 mr-1 uppercase">GRID INTEGRITY:</span>
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
          <div className="flex items-center gap-2 px-3 py-1 rounded-full border border-green-500/30 bg-green-500/10 text-xs text-green-300 font-bold">
            <span className="text-white/40 uppercase text-[10px]">SCORE:</span>
            <span className="text-sm tracking-wider">{score}</span>
          </div>

          {/* Streak Indicator */}
          {streak > 1 && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full border border-amber-400/30 bg-amber-400/10 text-xs text-amber-300 font-bold"
            >
              <span>🔥</span>
              <span>{streak}x STREAK</span>
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
            🏆 RANKS
          </button>
        </div>
      </header>

      {/* ── Main Arcade Playfield ── */}
      <main className="flex-1 flex flex-col items-center justify-between p-4 max-w-5xl w-full mx-auto relative overflow-hidden">
        {/* ── START SCREEN (IDLE) ── */}
        {gameState === 'idle' && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="my-auto max-w-md w-full p-8 rounded-3xl border border-green-500/40 bg-black/80 backdrop-blur-2xl shadow-[0_0_60px_rgba(48,209,88,0.15)] text-center flex flex-col items-center gap-5"
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

            <p className="text-xs text-white/70 leading-relaxed font-sans">
              Words stream down through the memory matrix. Neutralize them by typing before they breach the firewall tripwire at the bottom.
            </p>

            <div className="w-full grid grid-cols-3 gap-2 py-3 border-y border-green-500/20 text-[11px] text-green-400/80">
              <div>
                <span className="block text-white/40 text-[9px]">LIVES</span>
                <span className="font-bold text-red-400">3 CHANCES</span>
              </div>
              <div>
                <span className="block text-white/40 text-[9px]">SPEED</span>
                <span className="font-bold text-cyan-300">SCALING</span>
              </div>
              <div>
                <span className="block text-white/40 text-[9px]">NETWORK</span>
                <span className="font-bold text-green-300">0% LATENCY</span>
              </div>
            </div>

            <button
              type="button"
              onClick={startGame}
              className="w-full py-3.5 rounded-2xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-400 text-green-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_25px_rgba(48,209,88,0.3)] cursor-pointer"
            >
              INITIALIZE SPRINT ⚡
            </button>
          </motion.div>
        )}

        {/* ── ACTIVE GAME FIELD ── */}
        {gameState === 'playing' && (
          <div className="w-full flex-1 relative overflow-hidden rounded-2xl border border-green-500/20 bg-black/60 shadow-inner flex flex-col justify-end">
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
                const matchedPrefix = isTargeted
                  ? word.text.slice(0, cleanInput.length)
                  : ''
                const remainingText = isTargeted
                  ? word.text.slice(cleanInput.length)
                  : word.text

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
                    transition={{ duration: 0.55, ease: 'easeOut' }}
                    className="absolute pointer-events-none flex flex-col items-center"
                    style={{
                      left: `${exp.x}%`,
                      top: `${exp.y}%`,
                      transform: 'translate(-50%, -50%)',
                    }}
                  >
                    {/* Shockwave circle */}
                    <div className="w-12 h-12 rounded-full border-2 border-green-400 shadow-[0_0_30px_rgba(48,209,88,0.9)] animate-ping" />
                    <span className="text-xs font-black text-green-300 tracking-wider mt-1 drop-shadow-[0_0_10px_rgba(48,209,88,1)]">
                      +{exp.points}
                    </span>
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>

            {/* Laser Tripwire Warning Line */}
            <div className="w-full h-1 bg-red-500/60 shadow-[0_0_15px_rgba(255,55,95,0.8)] relative z-10 flex items-center justify-between px-4">
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
            className="my-auto max-w-md w-full p-8 rounded-3xl border border-red-500/50 bg-black/90 backdrop-blur-2xl shadow-[0_0_70px_rgba(255,55,95,0.25)] text-center flex flex-col items-center gap-5"
          >
            <div className="w-16 h-16 rounded-2xl bg-red-500/15 border border-red-500/40 flex items-center justify-center text-3xl shadow-[0_0_30px_rgba(255,55,95,0.3)]">
              💥
            </div>

            <div>
              <h2 className="text-2xl font-black uppercase tracking-wider text-red-400 mb-1">
                GRID BREACHED // SYSTEM DOWN
              </h2>
              <p className="text-xs text-red-400/70 uppercase tracking-widest">
                NEURAL OVERFLOW THRESHOLD EXCEEDED
              </p>
            </div>

            {/* Scorecard */}
            <div className="w-full p-5 rounded-2xl bg-white/[0.03] border border-white/10 flex flex-col gap-3">
              <div className="flex justify-between items-baseline border-b border-white/5 pb-2">
                <span className="text-xs uppercase text-white/50">Final Score</span>
                <span className="text-3xl font-black text-green-300 font-mono tracking-tight">
                  {score}
                </span>
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
                className="w-full py-3.5 rounded-2xl bg-green-500/20 hover:bg-green-500/30 border border-green-500/50 hover:border-green-400 text-green-300 font-bold text-sm tracking-widest uppercase transition-all shadow-[0_0_20px_rgba(48,209,88,0.25)] cursor-pointer"
              >
                REBOOT SPRINT ↻
              </button>

              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsLeaderboardOpen(true)}
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

        {/* ── Glowing Input Bar (Always active during play) ── */}
        {gameState === 'playing' && (
          <div className="w-full pt-4 flex flex-col items-center gap-2 z-20">
            <div className="w-full max-w-lg relative">
              <input
                ref={inputRef}
                type="text"
                autoFocus
                value={input}
                onChange={handleInputChange}
                onKeyDown={handleKeyDown}
                placeholder="TYPE FALLING CODE..."
                className="w-full py-3.5 px-6 rounded-2xl bg-black/90 border-2 border-green-500/60 focus:border-green-400 focus:shadow-[0_0_30px_rgba(48,209,88,0.4)] text-green-300 placeholder:text-green-500/30 text-center text-lg font-mono font-bold tracking-widest outline-none transition-all"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] text-green-500/40 pointer-events-none">
                AUTO_DESTROY
              </span>
            </div>
            <p className="text-[10px] text-white/30 uppercase tracking-widest">
              Type the exact word to neutralize it • Press space or enter to clear
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
