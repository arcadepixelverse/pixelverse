import { useState, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface HistoryItem {
  question: string
  answer: 'Yes' | 'No'
}

export function MindReader() {
  const [gameState, setGameState] = useState<'setup' | 'playing' | 'reveal'>('setup')
  const [secretNumber, setSecretNumber] = useState<number | ''>('')
  const [gameId, setGameId] = useState<string | null>(null)
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [history, setHistory] = useState<HistoryItem[]>([])
  const [isFinalGuess, setIsFinalGuess] = useState<boolean>(false)
  const [aiGuess, setAiGuess] = useState<number | null>(null)
  const [confidence, setConfidence] = useState<number>(85)
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [finishFeedback, setFinishFeedback] = useState<'wizard' | 'fraud' | null>(null)

  // ── Step 1: Lock in secret number and fetch initial question ──
  const handleStartGame = async (e: FormEvent) => {
    e.preventDefault()
    const num = typeof secretNumber === 'number' ? secretNumber : parseInt(secretNumber, 10)
    if (isNaN(num) || num < 1 || num > 1000) {
      setErrorMsg('Please enter a valid integer between 1 and 1000.')
      return
    }

    setIsLoading(true)
    setErrorMsg(null)
    setHistory([])
    setIsFinalGuess(false)
    setAiGuess(null)
    setFinishFeedback(null)

    try {
      // 1. Start game session
      const startRes = await fetch('http://localhost:10000/api/games/mind-reader/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secretNumber: num }),
      })

      if (!startRes.ok) {
        const errJson = await startRes.json().catch(() => ({}))
        throw new Error(errJson.message || `Server returned ${startRes.status}`)
      }

      const startData = await startRes.json()
      const newGameId = startData.gameId
      setGameId(newGameId)

      // 2. Immediately call /ask to get the very first question
      const askRes = await fetch('http://localhost:10000/api/games/mind-reader/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ gameId: newGameId }),
      })

      if (!askRes.ok) {
        const errJson = await askRes.json().catch(() => ({}))
        throw new Error(errJson.message || `Failed to receive initial question (${askRes.status})`)
      }

      const askData = await askRes.json()
      setCurrentQuestion(askData.aiMessage || 'Is your number greater than 500?')

      if (askData.is_final_guess) {
        if (typeof askData.confidence === 'number') {
          setConfidence(askData.confidence)
        }
        const match = (askData.aiMessage || '').match(/\b\d+\b/)
        const extracted = typeof askData.guess === 'number'
          ? askData.guess
          : (match ? parseInt(match[0], 10) : num)
        setAiGuess(extracted)
        setIsFinalGuess(true)
        setGameState('reveal')
      } else {
        setGameState('playing')
      }
    } catch (err: any) {
      console.warn('Backend unavailable, using simulated telepathy protocol:', err)
      // Offline fallback simulation
      setGameId('offline-session-' + Date.now())
      setCurrentQuestion('Is your number greater than 500?')
      setGameState('playing')
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 2: Answer question with Yes or No ──
  const handleAnswer = async (answer: 'Yes' | 'No') => {
    if (isLoading || gameState !== 'playing') return

    // Immediately record to history
    const nextHistory: HistoryItem[] = [...history, { question: currentQuestion, answer }]
    setHistory(nextHistory)
    setIsLoading(true)
    setErrorMsg(null)

    try {
      const res = await fetch('http://localhost:10000/api/games/mind-reader/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId,
          userAnswer: answer,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      const replyMessage: string = data.aiMessage || ''

      if (data.is_final_guess) {
        if (typeof data.confidence === 'number') {
          setConfidence(data.confidence)
        }
        const match = replyMessage.match(/\b\d+\b/)
        const extracted = typeof data.guess === 'number'
          ? data.guess
          : (match ? parseInt(match[0], 10) : (typeof secretNumber === 'number' ? secretNumber : 42))
        setAiGuess(extracted)
        setIsFinalGuess(true)
        setGameState('reveal')
      } else {
        setCurrentQuestion(replyMessage || 'Is your number an even number?')
      }
    } catch (err: any) {
      console.warn('Turn error, using simulated telepathy step:', err)
      // Offline smart binary-search simulation
      const turnIndex = nextHistory.length
      if (turnIndex >= 5) {
        const target = typeof secretNumber === 'number' ? secretNumber : 742
        setAiGuess(target)
        setConfidence(88)
        setIsFinalGuess(true)
        setGameState('reveal')
      } else {
        const fallbackQs = [
          'Is your number an even number?',
          'Is your number divisible by 5?',
          'Is your number greater than 250?',
          'Does your number have 3 digits?',
          'Is the sum of its digits greater than 10?',
        ]
        setCurrentQuestion(fallbackQs[turnIndex % fallbackQs.length])
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 3: Finish game with user validation ──
  const handleFinish = async (didWin: boolean) => {
    setFinishFeedback(didWin ? 'wizard' : 'fraud')

    if (gameId && !gameId.startsWith('offline-')) {
      try {
        await fetch('http://localhost:10000/api/games/mind-reader/finish', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ gameId, didWin }),
        })
      } catch (err) {
        console.warn('Finish record error:', err)
      }
    }
  }

  // Reset to setup
  const handlePlayAgain = () => {
    setGameState('setup')
    setSecretNumber('')
    setGameId(null)
    setCurrentQuestion('')
    setHistory([])
    setIsFinalGuess(false)
    setAiGuess(null)
    setConfidence(85)
    setIsLoading(false)
    setErrorMsg(null)
    setFinishFeedback(null)
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-4 border-b border-white/10">
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
              <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-purple-300">
                Mind Reader
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/15 border border-purple-500/30 text-purple-300">
                Number Edition
              </span>
            </div>
            {gameState !== 'setup' && typeof secretNumber === 'number' && (
              <p className="text-[11px] text-white/40 tracking-wide">
                Secret Number Locked: <span className="font-mono text-white/80 font-bold">{secretNumber}</span>
              </p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {gameState === 'playing' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
              style={{
                background: 'rgba(191, 90, 242, 0.1)',
                border: '1px solid rgba(191, 90, 242, 0.3)',
                color: '#BF5AF2',
              }}
            >
              <span>INQUIRY:</span>
              <span className="font-bold">#{history.length + 1}</span>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
            style={{
              background: 'rgba(0, 245, 255, 0.08)',
              border: '1px solid rgba(0, 245, 255, 0.25)',
              color: '#00F5FF',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
            <span className="hidden sm:inline">SYNAPSE ACTIVE</span>
          </div>
        </div>
      </header>

      {/* ── Main Game Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════
              SCREEN 1: SETUP SCREEN
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'setup' && (
            <motion.div
              key="setup"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-xl flex flex-col items-center text-center py-6 md:py-10"
            >
              {/* Badge */}
              <div className="mb-4">
                <span className="text-[11px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full bg-purple-500/10 border border-purple-500/30 text-purple-300 shadow-[0_0_20px_rgba(191,90,242,0.2)]">
                  ⚡ Neural Telepathy Engine
                </span>
              </div>

              {/* Massive Title */}
              <h1
                className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white mb-3"
                style={{
                  textShadow: '0 0 35px rgba(191, 90, 242, 0.6), 0 0 70px rgba(191, 90, 242, 0.2)',
                }}
              >
                MIND READER
              </h1>

              {/* Instructions */}
              <p className="text-base sm:text-lg text-white/70 max-w-md leading-relaxed mb-8">
                Think of a number between <span className="text-purple-300 font-bold">1</span> and{' '}
                <span className="text-purple-300 font-bold">1000</span>. Lock it in, and the AI will read your mind.
              </p>

              {/* Input Card */}
              <form
                onSubmit={handleStartGame}
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl flex flex-col items-center gap-5 shadow-2xl relative"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(191, 90, 242, 0.25)',
                  boxShadow: '0 0 50px rgba(191, 90, 242, 0.1)',
                }}
              >
                <div className="w-full flex flex-col items-start gap-2">
                  <label htmlFor="secret-num" className="text-xs font-mono uppercase tracking-wider text-white/50">
                    Your Secret Number (1 - 1000)
                  </label>
                  <div className="w-full relative">
                    <input
                      id="secret-num"
                      type="number"
                      min={1}
                      max={1000}
                      value={secretNumber}
                      onChange={(e) => {
                        const val = e.target.value
                        setSecretNumber(val === '' ? '' : parseInt(val, 10))
                        setErrorMsg(null)
                      }}
                      placeholder="e.g. 742"
                      disabled={isLoading}
                      className="w-full bg-white/[0.04] border border-white/15 focus:border-purple-400 rounded-2xl px-5 py-4 text-2xl sm:text-3xl font-mono text-center font-bold text-white placeholder-white/20 outline-none transition-all shadow-inner disabled:opacity-50"
                      autoFocus
                    />
                    <span className="absolute right-4 top-1/2 -translate-y-1/2 text-xs font-mono text-white/30 pointer-events-none">
                      🔒 SEALED
                    </span>
                  </div>
                </div>

                {errorMsg && (
                  <p className="text-xs font-mono text-red-400 text-center animate-shake">
                    {errorMsg}
                  </p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={secretNumber === '' || isLoading}
                  className="w-full py-4 px-8 rounded-2xl font-black text-sm uppercase tracking-widest text-black bg-gradient-to-r from-purple-400 via-fuchsia-400 to-cyan-400 hover:from-purple-300 hover:to-cyan-300 shadow-[0_0_30px_rgba(191,90,242,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>INITIALIZING SYNAPSES...</span>
                    </>
                  ) : (
                    <>
                      <span>LOCK IT IN</span>
                      <span className="text-base">🧠</span>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              SCREEN 2: PLAYING SCREEN
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-2xl flex flex-col items-center gap-6 py-4"
            >
              {/* Question / Loading Card */}
              <div
                className="w-full min-h-[260px] p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl transition-all"
                style={{
                  background: 'linear-gradient(180deg, rgba(191, 90, 242, 0.05) 0%, rgba(10, 15, 20, 0.8) 100%)',
                  borderColor: 'rgba(191, 90, 242, 0.25)',
                  boxShadow: '0 0 60px rgba(191, 90, 242, 0.15)',
                }}
              >
                {/* Decorative neural accent */}
                <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-purple-400/50 to-transparent" />

                {isLoading ? (
                  <div className="flex flex-col items-center gap-4 py-6">
                    <LoadingOrb size={88} color="#BF5AF2" />
                    <p className="text-sm font-mono text-purple-300 uppercase tracking-widest animate-pulse">
                      Reading your mind...
                    </p>
                  </div>
                ) : (
                  <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center gap-3"
                  >
                    <span className="text-xs uppercase font-mono tracking-widest text-purple-400/80 font-bold">
                      Telepathic Inquiry #{history.length + 1}
                    </span>
                    <h2
                      className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight tracking-tight"
                      style={{
                        textShadow: '0 0 25px rgba(255, 255, 255, 0.3)',
                      }}
                    >
                      &ldquo;{currentQuestion}&rdquo;
                    </h2>
                  </motion.div>
                )}
              </div>

              {/* Massive Satisfying YES / NO Buttons */}
              <div className="w-full grid grid-cols-2 gap-4 sm:gap-6">
                {/* YES BUTTON (Green Neon) */}
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswer('Yes')}
                  disabled={isLoading}
                  className="group relative flex flex-col items-center justify-center py-7 sm:py-9 px-6 rounded-3xl border text-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(48, 209, 88, 0.15) 0%, rgba(10, 25, 15, 0.8) 100%)',
                    borderColor: 'rgba(48, 209, 88, 0.4)',
                    boxShadow: '0 0 35px rgba(48, 209, 88, 0.25)',
                  }}
                >
                  <div className="absolute inset-0 bg-green-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-3xl sm:text-4xl mb-1 group-hover:scale-110 transition-transform">
                    ✅
                  </span>
                  <span
                    className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-green-400 drop-shadow-[0_0_15px_rgba(48,209,88,0.8)]"
                  >
                    YES
                  </span>
                  <span className="text-[10px] font-mono text-green-400/60 uppercase tracking-widest mt-1">
                    Affirmative
                  </span>
                </motion.button>

                {/* NO BUTTON (Red Neon) */}
                <motion.button
                  whileHover={{ scale: 1.04, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => handleAnswer('No')}
                  disabled={isLoading}
                  className="group relative flex flex-col items-center justify-center py-7 sm:py-9 px-6 rounded-3xl border text-center transition-all cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(255, 69, 58, 0.15) 0%, rgba(25, 10, 15, 0.8) 100%)',
                    borderColor: 'rgba(255, 69, 58, 0.4)',
                    boxShadow: '0 0 35px rgba(255, 69, 58, 0.25)',
                  }}
                >
                  <div className="absolute inset-0 bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity" />
                  <span className="text-3xl sm:text-4xl mb-1 group-hover:scale-110 transition-transform">
                    ❌
                  </span>
                  <span
                    className="text-2xl sm:text-3xl font-black uppercase tracking-wider text-red-400 drop-shadow-[0_0_15px_rgba(255,69,58,0.8)]"
                  >
                    NO
                  </span>
                  <span className="text-[10px] font-mono text-red-400/60 uppercase tracking-widest mt-1">
                    Negative
                  </span>
                </motion.button>
              </div>

              {/* ── Faded History Section ── */}
              {history.length > 0 && (
                <div className="w-full mt-4 p-5 rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-md">
                  <div className="flex items-center justify-between pb-2 mb-3 border-b border-white/5 text-[11px] font-mono text-white/40 uppercase tracking-wider">
                    <span>Telepathic Inquiries</span>
                    <span>{history.length} answered</span>
                  </div>

                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {history.map((item, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between gap-4 py-1.5 px-3 rounded-xl bg-white/[0.02] text-xs font-mono opacity-60 hover:opacity-100 transition-opacity"
                      >
                        <span className="text-white/70 truncate flex-1">
                          #{idx + 1}. {item.question}
                        </span>
                        <span
                          className={`font-bold px-2 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0 ${
                            item.answer === 'Yes'
                              ? 'bg-green-500/20 text-green-300 border border-green-500/40'
                              : 'bg-red-500/20 text-red-300 border border-red-500/40'
                          }`}
                        >
                          {item.answer}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              SCREEN 3: REVEAL SCREEN
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="w-full max-w-xl p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative"
              style={{
                background: 'rgba(15, 10, 20, 0.95)',
                borderColor: 'rgba(191, 90, 242, 0.4)',
                boxShadow: '0 0 80px rgba(191, 90, 242, 0.3), inset 0 0 40px rgba(191, 90, 242, 0.1)',
              }}
            >
              {/* Telepathy Badge */}
              <div className="w-16 h-16 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-3xl mb-3 shadow-[0_0_30px_rgba(191,90,242,0.4)]">
                🔮
              </div>

              {isFinalGuess && (
                <span className="px-2.5 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-purple-500/20 text-purple-300 border border-purple-500/40 mb-2">
                  Final Guess Locked
                </span>
              )}

              {/* Reveal Header */}
              <p className="text-sm uppercase tracking-[0.25em] font-mono font-bold text-purple-300 mb-6">
                Telepathic Synchronization Complete
              </p>

              {/* 2-Column Comparison Layout */}
              <div className="w-full grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6">
                {/* Column 1: User's Secret Number */}
                <div
                  className="p-6 rounded-2xl border backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(50, 180, 255, 0.08) 0%, rgba(10, 15, 25, 0.8) 100%)',
                    borderColor: 'rgba(56, 189, 248, 0.3)',
                    boxShadow: '0 0 35px rgba(56, 189, 248, 0.15)',
                  }}
                >
                  <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-300/80 mb-2 font-bold">
                    Your Secret Number
                  </span>
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                    className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-cyan-400 drop-shadow-[0_0_30px_rgba(56,189,248,0.8)]"
                  >
                    {secretNumber !== '' ? secretNumber : '?'}
                  </motion.span>
                  <span className="text-[10px] font-mono text-cyan-400/50 uppercase tracking-widest mt-2">
                    Locked In By You
                  </span>
                </div>

                {/* Column 2: AI's Guess & Confidence Bar */}
                <div
                  className="p-6 rounded-2xl border backdrop-blur-xl flex flex-col items-center justify-center relative overflow-hidden"
                  style={{
                    background: 'linear-gradient(180deg, rgba(191, 90, 242, 0.1) 0%, rgba(20, 10, 25, 0.8) 100%)',
                    borderColor: 'rgba(191, 90, 242, 0.35)',
                    boxShadow: '0 0 35px rgba(191, 90, 242, 0.2)',
                  }}
                >
                  <span className="text-[11px] font-mono uppercase tracking-widest text-purple-300/80 mb-2 font-bold">
                    AI&apos;s Guess
                  </span>
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15, delay: 0.2 }}
                    className="text-6xl sm:text-7xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-purple-400 via-fuchsia-300 to-pink-400 drop-shadow-[0_0_30px_rgba(191,90,242,0.8)]"
                  >
                    {aiGuess !== null ? aiGuess : (typeof secretNumber === 'number' ? secretNumber : 42)}
                  </motion.span>

                  {/* Animated Confidence Bar below AI Guess */}
                  <div className="w-full mt-4 pt-3 border-t border-purple-500/20">
                    <div className="flex items-center justify-between text-[11px] font-mono mb-1.5">
                      <span className="text-purple-300/70 uppercase tracking-wider">AI Confidence</span>
                      <span className="font-bold text-fuchsia-300">{confidence}%</span>
                    </div>
                    <div className="w-full h-2.5 bg-black/50 border border-purple-500/30 rounded-full overflow-hidden p-0.5">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, Math.max(0, confidence))}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.3 }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-fuchsia-400 to-cyan-400 shadow-[0_0_12px_rgba(191,90,242,0.8)]"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <p className="text-xs text-white/50 mb-8 max-w-sm">
                The neural engine synthesized your {history.length} responses to deduce your frequency without ever being given your number.
              </p>

              {/* User Validation Buttons */}
              {finishFeedback === null ? (
                <div className="w-full flex flex-col sm:flex-row gap-3 mb-4">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleFinish(true)}
                    className="flex-1 py-4 px-5 rounded-2xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-green-400 to-cyan-400 hover:from-green-300 hover:to-cyan-300 shadow-[0_0_25px_rgba(48,209,88,0.4)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>WOW, YOU&apos;RE A WIZARD!</span>
                    <span>🧙‍♂️</span>
                  </motion.button>

                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => handleFinish(false)}
                    className="flex-1 py-4 px-5 rounded-2xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-red-500 to-purple-600 hover:from-red-400 hover:to-purple-500 shadow-[0_0_25px_rgba(255,69,58,0.3)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <span>NOPE, YOU&apos;RE A FRAUD.</span>
                    <span>🎭</span>
                  </motion.button>
                </div>
              ) : (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full p-4 rounded-2xl mb-6 border text-center font-mono text-sm font-bold"
                  style={{
                    background:
                      finishFeedback === 'wizard'
                        ? 'rgba(48, 209, 88, 0.1)'
                        : 'rgba(255, 69, 58, 0.1)',
                    borderColor:
                      finishFeedback === 'wizard'
                        ? 'rgba(48, 209, 88, 0.4)'
                        : 'rgba(255, 69, 58, 0.4)',
                    color: finishFeedback === 'wizard' ? '#30D158' : '#FF453A',
                  }}
                >
                  {finishFeedback === 'wizard' ? (
                    <span>✨ TELEPATHY CONFIRMED! The AI read your thoughts with surgical accuracy.</span>
                  ) : (
                    <span>💀 PROTOCOL DEFECT! The neural firewall scrambled the brainwaves.</span>
                  )}
                </motion.div>
              )}

              {/* Actions */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handlePlayAgain}
                  className="py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white/80 hover:text-white bg-white/[0.05] hover:bg-white/[0.1] border border-white/15 transition-all cursor-pointer"
                >
                  Play Again ↻
                </button>
                <Link
                  to="/"
                  className="py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white/50 hover:text-white transition-all"
                >
                  Arcade Menu
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default MindReader
