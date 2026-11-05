import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface TuringTestRound {
  question: string
  answerA: string
  answerB: string
  humanAnswer: 'A' | 'B'
}

const FALLBACK_ROUNDS: TuringTestRound[] = [
  {
    question: 'Why does my dog sigh so dramatically before lying down?',
    answerA: 'because you made him exist for another day and he still has no job',
    answerB: 'Dogs frequently sigh as a physiological transition into rest, signaling that their autonomic nervous system is settling into relaxation.',
    humanAnswer: 'A',
  },
  {
    question: 'What is the true meaning of life?',
    answerA: 'Philosophically, meaning is self-constructed through purpose, genuine human relationships, and continuous personal growth.',
    answerB: 'finding snacks you forgot you bought and avoiding eye contact on the subway',
    humanAnswer: 'B',
  },
  {
    question: 'Is cereal considered a soup?',
    answerA: "bro it's cold milk and soggy grain do not invite this cursed energy into my morning",
    answerB: 'Culinary taxonomies distinguish cereal as a cold grain breakfast dish, whereas soups are traditionally defined by savory broths and cooking processes.',
    humanAnswer: 'A',
  },
  {
    question: 'How do I stop procrastinating?',
    answerA: 'You can overcome procrastination by using the Pomodoro technique—working in focused 25-minute sprints with scheduled 5-minute pauses.',
    answerB: 'close your 47 open tabs, panic for 10 minutes, then do 3 minutes of work before rewarding yourself with a nap',
    humanAnswer: 'B',
  },
  {
    question: 'Why do we park on driveways and drive on parkways?',
    answerA: 'because language was invented by tired people making stuff up as they went along',
    answerB: "Linguistically, 'parkways' originally referred to scenic roads through landscaped parklands, while 'driveways' denoted the private road leading up to a manor.",
    humanAnswer: 'A',
  },
]

export function TuringTest() {
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'reveal'>('loading')
  const [rounds, setRounds] = useState<TuringTestRound[]>([])
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [score, setScore] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [hasScoredCurrentRound, setHasScoredCurrentRound] = useState<boolean>(false)

  // Fetch rounds on mount
  const fetchRounds = async () => {
    setGameState('loading')
    setCurrentRound(0)
    setScore(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setHasScoredCurrentRound(false)

    try {
      const res = await fetch('http://localhost:10000/api/games/turing-test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      if (Array.isArray(data) && data.length >= 5) {
        setRounds(data.slice(0, 5))
      } else {
        setRounds(FALLBACK_ROUNDS)
      }
      setGameState('playing')
    } catch (err) {
      console.warn('Backend unavailable or generation failed, using curated rounds:', err)
      setRounds(FALLBACK_ROUNDS)
      setGameState('playing')
    }
  }

  useEffect(() => {
    fetchRounds()
  }, [])

  const currentRoundData = rounds[currentRound]

  // Handle user selecting an answer card
  const handleSelectAnswer = (option: 'A' | 'B') => {
    if (selectedAnswer !== null || !currentRoundData) return

    const correct = option === currentRoundData.humanAnswer
    setSelectedAnswer(option)
    setIsCorrect(correct)

    if (correct && !hasScoredCurrentRound) {
      setScore((prev) => prev + 1)
      setHasScoredCurrentRound(true)
    }
  }

  // Handle advancing to next round or reveal
  const handleNextRound = () => {
    if (currentRound + 1 < rounds.length) {
      setCurrentRound((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setHasScoredCurrentRound(false)
    } else {
      setGameState('reveal')
    }
  }

  // Score feedback evaluation
  const getScoreVerdict = (finalScore: number, total: number) => {
    const ratio = finalScore / total
    if (ratio === 1) {
      return {
        badge: 'CERTIFIED HUMAN DETECTIVE 🏆',
        color: '#30D158',
        shadow: 'rgba(48, 209, 88, 0.8)',
        badgeBg: 'bg-green-500/20 text-green-300 border-green-500/40',
        message: 'Flawless perception. You saw right through the synthetic veneer every single round.',
      }
    }
    if (ratio >= 0.6) {
      return {
        badge: 'SHARP INTUITION 🧠',
        color: '#00F5FF',
        shadow: 'rgba(0, 245, 255, 0.8)',
        badgeBg: 'bg-cyan-500/20 text-cyan-300 border-cyan-500/40',
        message: 'Impressive human instincts. The AI managed to trick you only on the subtlest edge cases.',
      }
    }
    if (ratio >= 0.4) {
      return {
        badge: 'PARTIAL CYBORG 🦾',
        color: '#BF5AF2',
        shadow: 'rgba(191, 90, 242, 0.8)',
        badgeBg: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
        message: 'The boundary is blurring. LLMs and organic brains sound dangerously alike to you.',
      }
    }
    return {
      badge: 'SYNTHETIC CONVERT 🤖',
      color: '#FF453A',
      shadow: 'rgba(255, 69, 58, 0.8)',
      badgeBg: 'bg-red-500/20 text-red-300 border-red-500/40',
      message: 'Completely bamboozled by silicon. You might genuinely fail the Turing Test yourself.',
    }
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-5xl mx-auto">
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
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                The Turing Test
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-cyan-500/15 border border-cyan-500/30 text-cyan-300">
                Human or AI?
              </span>
            </div>
            {gameState === 'playing' && (
              <p className="text-[11px] text-white/40 tracking-wide">
                Spot the cynical human disguised among the synthetic minds.
              </p>
            )}
          </div>
        </div>

        {/* Badges / Round indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {gameState === 'playing' && rounds.length > 0 && (
            <>
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
                style={{
                  background: 'rgba(0, 245, 255, 0.08)',
                  border: '1px solid rgba(0, 245, 255, 0.25)',
                  color: '#00F5FF',
                }}
              >
                <span>ROUND:</span>
                <span className="font-bold">{currentRound + 1}/{rounds.length}</span>
              </div>

              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
                style={{
                  background: 'rgba(48, 209, 88, 0.08)',
                  border: '1px solid rgba(48, 209, 88, 0.25)',
                  color: '#30D158',
                }}
              >
                <span>SCORE:</span>
                <span className="font-bold">{score}</span>
              </div>
            </>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              border: '1px solid rgba(255, 255, 255, 0.15)',
              color: 'rgba(255, 255, 255, 0.7)',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            <span className="hidden sm:inline">PROMPT ENGINE ONLINE</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-0 relative py-2 sm:py-6">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════
              STATE 1: LOADING STATE
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 py-24 text-center"
            >
              <LoadingOrb size={92} color="#00F5FF" />
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-black tracking-wider text-cyan-300 uppercase">
                  Synthesizing Turing Dilemmas...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Pit synthetic AI logic against cynical human sarcasm
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 2: ACTIVE GAMEPLAY
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'playing' && currentRoundData && (
            <motion.div
              key={`round-${currentRound}`}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-4xl flex flex-col items-center gap-6"
            >
              {/* Question Card */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(0, 245, 255, 0.06) 0%, rgba(10, 15, 25, 0.85) 100%)',
                  borderColor: 'rgba(0, 245, 255, 0.3)',
                  boxShadow: '0 0 50px rgba(0, 245, 255, 0.12)',
                }}
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span className="text-[11px] font-mono uppercase tracking-widest text-cyan-300 font-bold">
                    Dilemma {currentRound + 1} of {rounds.length}
                  </span>
                </div>

                <h2
                  className="text-2xl sm:text-3xl md:text-4xl font-black text-white leading-tight mb-2 tracking-tight"
                  style={{
                    textShadow: '0 0 25px rgba(0, 245, 255, 0.3)',
                  }}
                >
                  &ldquo;{currentRoundData.question}&rdquo;
                </h2>

                <p className="text-xs font-mono text-white/50 uppercase tracking-wider">
                  Target: Pick the response crafted by a real, imperfect human.
                </p>
              </div>

              {/* Side-by-Side Answers Grid */}
              <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6">
                {/* ── CARD A ── */}
                {(() => {
                  const isHuman = currentRoundData.humanAnswer === 'A'
                  const isSelected = selectedAnswer === 'A'
                  const isRevealed = selectedAnswer !== null

                  let borderColor = 'rgba(255, 255, 255, 0.12)'
                  let bgStyle = 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(15, 20, 30, 0.85) 100%)'
                  let shadowStyle = '0 0 20px rgba(0, 0, 0, 0.3)'

                  if (isRevealed) {
                    if (isHuman) {
                      borderColor = '#30D158'
                      bgStyle = 'linear-gradient(180deg, rgba(48, 209, 88, 0.15) 0%, rgba(10, 25, 15, 0.9) 100%)'
                      shadowStyle = '0 0 35px rgba(48, 209, 88, 0.3)'
                    } else {
                      borderColor = '#FF453A'
                      bgStyle = 'linear-gradient(180deg, rgba(255, 69, 58, 0.15) 0%, rgba(25, 10, 15, 0.9) 100%)'
                      shadowStyle = '0 0 35px rgba(255, 69, 58, 0.25)'
                    }
                  }

                  return (
                    <motion.button
                      type="button"
                      whileHover={!isRevealed ? { scale: 1.02, y: -2 } : {}}
                      whileTap={!isRevealed ? { scale: 0.98 } : {}}
                      onClick={() => handleSelectAnswer('A')}
                      disabled={isRevealed}
                      className={`group relative text-left p-6 sm:p-7 rounded-3xl border backdrop-blur-2xl flex flex-col justify-between transition-all overflow-hidden ${
                        !isRevealed ? 'cursor-pointer hover:border-cyan-400/50' : 'cursor-default'
                      }`}
                      style={{
                        borderColor,
                        background: bgStyle,
                        boxShadow: shadowStyle,
                        minHeight: '220px',
                      }}
                    >
                      {/* Top bar indicator */}
                      <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                        <span className="text-xs font-mono font-black tracking-widest text-cyan-400 uppercase">
                          OPTION A
                        </span>

                        {isRevealed && (
                          <motion.span
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                              isHuman
                                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}
                          >
                            {isHuman ? '🧑 REAL HUMAN' : '🤖 SYNTHETIC AI'}
                          </motion.span>
                        )}
                      </div>

                      {/* Answer Body Text */}
                      <div className="flex-1 flex items-center my-2">
                        <p className={`text-base sm:text-lg leading-relaxed ${isHuman ? 'font-mono lowercase' : 'font-sans'}`}>
                          &ldquo;{currentRoundData.answerA}&rdquo;
                        </p>
                      </div>

                      {/* Footer Badge */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-white/40">
                          {isSelected ? 'Your Selection' : isRevealed ? (isHuman ? 'The Human Response' : 'The AI Response') : 'Click to evaluate'}
                        </span>
                        {isSelected && (
                          <span className="font-bold text-cyan-300">
                            {isHuman ? '✅ SPOT ON' : '❌ TRICKED'}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  )
                })()}

                {/* ── CARD B ── */}
                {(() => {
                  const isHuman = currentRoundData.humanAnswer === 'B'
                  const isSelected = selectedAnswer === 'B'
                  const isRevealed = selectedAnswer !== null

                  let borderColor = 'rgba(255, 255, 255, 0.12)'
                  let bgStyle = 'linear-gradient(180deg, rgba(255, 255, 255, 0.03) 0%, rgba(15, 20, 30, 0.85) 100%)'
                  let shadowStyle = '0 0 20px rgba(0, 0, 0, 0.3)'

                  if (isRevealed) {
                    if (isHuman) {
                      borderColor = '#30D158'
                      bgStyle = 'linear-gradient(180deg, rgba(48, 209, 88, 0.15) 0%, rgba(10, 25, 15, 0.9) 100%)'
                      shadowStyle = '0 0 35px rgba(48, 209, 88, 0.3)'
                    } else {
                      borderColor = '#FF453A'
                      bgStyle = 'linear-gradient(180deg, rgba(255, 69, 58, 0.15) 0%, rgba(25, 10, 15, 0.9) 100%)'
                      shadowStyle = '0 0 35px rgba(255, 69, 58, 0.25)'
                    }
                  }

                  return (
                    <motion.button
                      type="button"
                      whileHover={!isRevealed ? { scale: 1.02, y: -2 } : {}}
                      whileTap={!isRevealed ? { scale: 0.98 } : {}}
                      onClick={() => handleSelectAnswer('B')}
                      disabled={isRevealed}
                      className={`group relative text-left p-6 sm:p-7 rounded-3xl border backdrop-blur-2xl flex flex-col justify-between transition-all overflow-hidden ${
                        !isRevealed ? 'cursor-pointer hover:border-cyan-400/50' : 'cursor-default'
                      }`}
                      style={{
                        borderColor,
                        background: bgStyle,
                        boxShadow: shadowStyle,
                        minHeight: '220px',
                      }}
                    >
                      {/* Top bar indicator */}
                      <div className="w-full flex items-center justify-between pb-3 mb-3 border-b border-white/10">
                        <span className="text-xs font-mono font-black tracking-widest text-cyan-400 uppercase">
                          OPTION B
                        </span>

                        {isRevealed && (
                          <motion.span
                            initial={{ scale: 0.7, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold tracking-wider uppercase border ${
                              isHuman
                                ? 'bg-green-500/20 text-green-300 border-green-500/40'
                                : 'bg-red-500/20 text-red-300 border-red-500/40'
                            }`}
                          >
                            {isHuman ? '🧑 REAL HUMAN' : '🤖 SYNTHETIC AI'}
                          </motion.span>
                        )}
                      </div>

                      {/* Answer Body Text */}
                      <div className="flex-1 flex items-center my-2">
                        <p className={`text-base sm:text-lg leading-relaxed ${isHuman ? 'font-mono lowercase' : 'font-sans'}`}>
                          &ldquo;{currentRoundData.answerB}&rdquo;
                        </p>
                      </div>

                      {/* Footer Badge */}
                      <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between text-[11px] font-mono">
                        <span className="text-white/40">
                          {isSelected ? 'Your Selection' : isRevealed ? (isHuman ? 'The Human Response' : 'The AI Response') : 'Click to evaluate'}
                        </span>
                        {isSelected && (
                          <span className="font-bold text-cyan-300">
                            {isHuman ? '✅ SPOT ON' : '❌ TRICKED'}
                          </span>
                        )}
                      </div>
                    </motion.button>
                  )
                })()}
              </div>

              {/* Feedback Banner & Next Button */}
              {selectedAnswer !== null && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-xl"
                  style={{
                    background: isCorrect
                      ? 'linear-gradient(90deg, rgba(48, 209, 88, 0.12) 0%, rgba(10, 20, 15, 0.9) 100%)'
                      : 'linear-gradient(90deg, rgba(255, 69, 58, 0.12) 0%, rgba(20, 10, 15, 0.9) 100%)',
                    borderColor: isCorrect ? 'rgba(48, 209, 88, 0.4)' : 'rgba(255, 69, 58, 0.4)',
                  }}
                >
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <span className="text-2xl">{isCorrect ? '🎯' : '🤖'}</span>
                    <div>
                      <p className={`text-sm font-bold uppercase tracking-wider ${isCorrect ? 'text-green-300' : 'text-red-300'}`}>
                        {isCorrect ? 'CORRECT! You spotted the human.' : 'DECEIVED! The machine tricked you.'}
                      </p>
                      <p className="text-xs text-white/50 font-mono">
                        {isCorrect
                          ? 'The cynical, lowercase human energy was unmistakable.'
                          : 'You mistook polished neural prose for human thought.'}
                      </p>
                    </div>
                  </div>

                  <motion.button
                    whileHover={{ scale: 1.04 }}
                    whileTap={{ scale: 0.96 }}
                    type="button"
                    onClick={handleNextRound}
                    className="w-full sm:w-auto px-7 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] cursor-pointer transition-all flex items-center justify-center gap-2"
                  >
                    <span>{currentRound + 1 < rounds.length ? 'Next Dilemma' : 'View Final Verdict'}</span>
                    <span>→</span>
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 3: FINAL SCORE & REVEAL SCREEN
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'reveal' && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="w-full max-w-xl p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative"
              style={{
                background: 'rgba(10, 15, 25, 0.95)',
                borderColor: getScoreVerdict(score, rounds.length).color + '66',
                boxShadow: `0 0 80px ${getScoreVerdict(score, rounds.length).shadow}33`,
              }}
            >
              {/* Badge */}
              <div className="mb-4">
                <span
                  className={`text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full border ${
                    getScoreVerdict(score, rounds.length).badgeBg
                  }`}
                >
                  {getScoreVerdict(score, rounds.length).badge}
                </span>
              </div>

              {/* Inquiry Label */}
              <p className="text-xs uppercase font-mono tracking-wider text-white/40 mb-1">
                Turing Evaluation Score
              </p>

              {/* Massive Neon Score */}
              <div className="py-2 my-2">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                  className="text-8xl sm:text-9xl font-black font-mono tracking-tight"
                  style={{
                    color: getScoreVerdict(score, rounds.length).color,
                    textShadow: `0 0 45px ${getScoreVerdict(score, rounds.length).shadow}`,
                  }}
                >
                  {score}/{rounds.length}
                </motion.span>
              </div>

              {/* Verdict Message Box */}
              <div
                className="w-full min-h-[70px] p-5 rounded-2xl mb-8 border flex items-center justify-center text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <p className="text-sm sm:text-base text-white/90 leading-relaxed font-sans font-medium">
                  {getScoreVerdict(score, rounds.length).message}
                </p>
              </div>

              {/* Actions */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={fetchRounds}
                  className="py-3.5 px-8 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] transition-all cursor-pointer"
                >
                  Play Again ↻
                </button>
                <Link
                  to="/"
                  className="py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white/60 hover:text-white transition-all text-center"
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

export default TuringTest
