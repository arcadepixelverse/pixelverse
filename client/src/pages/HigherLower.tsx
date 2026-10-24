import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface Question {
  prompt?: string
  factA: string
  factB: string
  answer: 'A' | 'B' | string
  explanation?: string
}

// Fallback questions to guarantee playability if the backend service is offline
const FALLBACK_QUESTIONS: Question[] = [
  {
    prompt: 'Which has the higher elevation / height?',
    factA: 'Burj Khalifa in Dubai (828 meters)',
    factB: 'Empire State Building in New York (381 meters)',
    answer: 'A',
    explanation: 'The Burj Khalifa stands at 828m (2,717 ft), more than double the Empire State Building’s 381m roof height.',
  },
  {
    prompt: 'Which population count is higher?',
    factA: 'Population of Canada (approx. 40 million)',
    factB: 'Tokyo Metropolitan Area population (approx. 37.4 million)',
    answer: 'A',
    explanation: 'Canada officially crossed 40 million residents in 2023, while Greater Tokyo has roughly 37.4 million.',
  },
  {
    prompt: 'Which speed is higher in meters per second?',
    factA: 'Speed of Sound in Air at 20°C (approx. 343 m/s)',
    factB: 'Top speed of a Formula 1 race car (approx. 105 m/s)',
    answer: 'A',
    explanation: 'Sound travels at ~343 m/s (~1,235 km/h), while an F1 car maxes out around 105 m/s (~378 km/h).',
  },
  {
    prompt: 'Which count is higher?',
    factA: 'Number of bones in an adult human body (206)',
    factB: 'Number of keys on a standard full-size piano (88)',
    answer: 'A',
    explanation: 'An adult human skeleton consists of 206 bones, whereas a standard piano has only 88 keys.',
  },
  {
    prompt: 'Which vertical distance is greater?',
    factA: 'Depth of the Mariana Trench (approx. 10,994 meters)',
    factB: 'Height of Mount Everest (approx. 8,849 meters)',
    answer: 'A',
    explanation: 'The Challenger Deep plunges ~10,994m below sea level, which is over 2,000m deeper than Everest is tall.',
  },
  {
    prompt: 'Which calendar year is higher (occurred later)?',
    factA: 'Launch of the first Apple iPhone (2007)',
    factB: 'Public launch of YouTube (2005)',
    answer: 'A',
    explanation: 'The original iPhone was released in June 2007, while YouTube was launched in 2005.',
  },
  {
    prompt: 'Which total count is higher?',
    factA: 'Confirmed chemical elements on the Periodic Table (118)',
    factB: 'Recognized natural moons orbiting Jupiter (95)',
    answer: 'A',
    explanation: 'The Periodic Table contains 118 confirmed elements, while Jupiter has 95 recognized moons.',
  },
  {
    prompt: 'Which distance is greater?',
    factA: 'Average distance from Earth to the Moon (384,400 km)',
    factB: 'Equatorial circumference of the Earth (40,075 km)',
    answer: 'A',
    explanation: 'The Moon is nearly 10 times farther away from Earth than the entire distance around our planet.',
  },
  {
    prompt: 'Which total count in a single 24-hour day is higher?',
    factA: 'Average human heartbeats in 24 hours (approx. 100,000)',
    factB: 'Total seconds in 24 hours (86,400)',
    answer: 'A',
    explanation: 'A resting heart beats roughly 100,000 times a day, easily surpassing the 86,400 seconds in a day.',
  },
  {
    prompt: 'Which total count is higher?',
    factA: 'Episodes of The Simpsons aired (Over 760)',
    factB: 'Original Generation 1 Pokémon (151)',
    answer: 'A',
    explanation: 'The Simpsons has aired over 760 episodes, far outnumbering the 151 Gen 1 Pokémon.',
  },
]

export function HigherLower() {
  const [questions, setQuestions] = useState<Question[]>([])
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [score, setScore] = useState<number>(0)
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'gameover'>('loading')
  const [feedback, setFeedback] = useState<string>('')
  const [selectedCard, setSelectedCard] = useState<'A' | 'B' | null>(null)
  const [cardStatus, setCardStatus] = useState<'correct' | 'wrong' | null>(null)
  const [explanation, setExplanation] = useState<string>('')

  // Fetch 10 questions from the backend API
  const fetchQuestions = useCallback(async () => {
    setGameState('loading')
    setFeedback('')
    setSelectedCard(null)
    setCardStatus(null)
    setScore(0)
    setCurrentIndex(0)
    setExplanation('')

    try {
      const response = await fetch('http://localhost:10000/api/games/higher-lower/generate')
      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`)
      }
      const data = await response.json()
      const rawList = Array.isArray(data) ? data : data.questions || []

      if (rawList.length > 0) {
        // Normalize any variations in field names
        const normalized: Question[] = rawList.slice(0, 10).map((q: any, i: number) => ({
          prompt: q.prompt || q.question || 'Which is higher?',
          factA: q.factA || q.optionA || `Fact A (${i + 1})`,
          factB: q.factB || q.optionB || `Fact B (${i + 1})`,
          answer: (q.answer || q.correctAnswer || 'A').toString().trim().toUpperCase() === 'B' ? 'B' : 'A',
          explanation: q.explanation || q.reason || 'AI comparison completed.',
        }))
        setQuestions(normalized)
        setGameState('playing')
        return
      }
      throw new Error('No questions received from server')
    } catch (err) {
      console.warn('Backend question generation unavailable, using fallback deck:', err)
      // Shuffle fallback deck for variety
      const shuffled = [...FALLBACK_QUESTIONS].sort(() => Math.random() - 0.5)
      setQuestions(shuffled)
      setGameState('playing')
    }
  }, [])

  useEffect(() => {
    fetchQuestions()
  }, [fetchQuestions])

  const handleCardClick = (choice: 'A' | 'B') => {
    if (gameState !== 'playing' || selectedCard !== null) return

    const currentQ = questions[currentIndex]
    if (!currentQ) return

    setSelectedCard(choice)

    // Check if user answer matches
    const answerNormalized = currentQ.answer.toString().trim().toUpperCase()
    const isCorrect = answerNormalized === choice

    if (isCorrect) {
      setCardStatus('correct')
      setScore((prev) => prev + 1)
      setFeedback('Correct! +1')

      // Wait 1 second, then proceed or end game if last question
      setTimeout(() => {
        if (currentIndex + 1 < questions.length) {
          setCurrentIndex((prev) => prev + 1)
          setSelectedCard(null)
          setCardStatus(null)
          setFeedback('')
        } else {
          // Cleared all 10 questions!
          setExplanation(currentQ.explanation || 'Perfect streak! You mastered all challenges.')
          setGameState('gameover')
        }
      }, 1000)
    } else {
      setCardStatus('wrong')
      setFeedback('Incorrect!')
      setExplanation(
        currentQ.explanation ||
          `Option ${currentQ.answer} was the correct answer.`
      )

      // Wait 1.2 seconds, then transition to game over
      setTimeout(() => {
        setGameState('gameover')
      }, 1200)
    }
  }

  const currentQ = questions[currentIndex]

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-6 md:px-12 md:py-8">
      {/* ── Top Navigation Bar ── */}
      <header className="w-full max-w-5xl mx-auto flex items-center justify-between mb-8">
        <Link
          to="/"
          className="group flex items-center gap-2 text-xs uppercase tracking-widest text-white/50 hover:text-cyan-400 transition-colors"
        >
          <span className="text-lg transition-transform group-hover:-translate-x-1">←</span>
          <span>Arcade</span>
        </Link>

        {/* Live Score Counter */}
        <div
          className="flex items-center gap-3 px-4 py-2 rounded-xl backdrop-blur-md"
          style={{
            background: 'rgba(255, 255, 255, 0.04)',
            border: '1px solid rgba(48, 209, 88, 0.3)',
            boxShadow: '0 0 15px rgba(48, 209, 88, 0.15)',
          }}
        >
          <span className="text-xs uppercase tracking-widest text-white/50 font-semibold">Score</span>
          <span className="text-xl font-black text-green-400 tracking-tight font-mono">{score}</span>
        </div>
      </header>

      {/* ── Header Title & Progress ── */}
      <div className="w-full max-w-4xl mx-auto text-center mb-8">
        <motion.h1
          className="neon-title text-4xl sm:text-5xl md:text-6xl font-black tracking-tight mb-3"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          Higher or Lower
        </motion.h1>

        {gameState === 'playing' && (
          <motion.div
            className="flex flex-col items-center gap-2"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <p className="text-sm md:text-base text-cyan-300/80 font-medium tracking-wide">
              {currentQ?.prompt || 'Which is higher? Select the winning card.'}
            </p>
            <div className="flex items-center gap-3 text-xs text-white/40 font-mono">
              <span>Question {currentIndex + 1} of {questions.length}</span>
              <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-400 to-purple-500 transition-all duration-300"
                  style={{ width: `${((currentIndex + 1) / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Main Content Area ── */}
      <main className="w-full max-w-5xl mx-auto flex-1 flex flex-col items-center justify-center">
        {/* State 1: Loading */}
        {gameState === 'loading' && (
          <motion.div
            className="flex flex-col items-center justify-center gap-6 py-20 text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <LoadingOrb size={96} color="#00F5FF" />
            <div className="flex flex-col gap-2">
              <p className="text-lg font-bold tracking-wider text-cyan-300 uppercase">
                Generating Challenges
              </p>
              <p className="text-xs text-white/40 tracking-widest uppercase">
                AI is compiling 10 mind-bending comparisons...
              </p>
            </div>
          </motion.div>
        )}

        {/* State 2: Active Gameplay */}
        {gameState === 'playing' && currentQ && (
          <div className="w-full flex flex-col items-center gap-6">
            {/* Feedback notification */}
            <div className="h-6 flex items-center justify-center">
              <AnimatePresence>
                {feedback && (
                  <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 6 }}
                    className={`text-sm font-bold tracking-widest uppercase px-3 py-1 rounded-full ${
                      cardStatus === 'correct'
                        ? 'text-green-400 bg-green-500/10 border border-green-500/30'
                        : 'text-red-400 bg-red-500/10 border border-red-500/30'
                    }`}
                  >
                    {feedback}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Cards Grid */}
            <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch relative">
              {/* Center VS Badge */}
              <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none hidden md:flex items-center justify-center">
                <div
                  className="w-12 h-12 rounded-full flex items-center justify-center text-xs font-black tracking-widest border border-white/20 backdrop-blur-xl shadow-2xl"
                  style={{
                    background: 'rgba(10, 10, 15, 0.85)',
                    boxShadow: '0 0 25px rgba(0, 245, 255, 0.25)',
                  }}
                >
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-purple-400">
                    VS
                  </span>
                </div>
              </div>

              {/* Card A (Cyan Neon) */}
              <motion.button
                type="button"
                onClick={() => handleCardClick('A')}
                disabled={selectedCard !== null}
                whileHover={
                  !selectedCard
                    ? { scale: 1.025, y: -4 }
                    : undefined
                }
                whileTap={!selectedCard ? { scale: 0.98 } : undefined}
                animate={
                  selectedCard === 'A'
                    ? cardStatus === 'correct'
                      ? {
                          borderColor: 'rgba(48, 209, 88, 1)',
                          boxShadow: '0 0 40px rgba(48, 209, 88, 0.5), inset 0 0 20px rgba(48, 209, 88, 0.2)',
                          scale: 1.03,
                        }
                      : {
                          x: [-12, 12, -8, 8, -4, 4, 0],
                          borderColor: 'rgba(255, 69, 58, 1)',
                          boxShadow: '0 0 40px rgba(255, 69, 58, 0.5), inset 0 0 20px rgba(255, 69, 58, 0.2)',
                          transition: { duration: 0.5 },
                        }
                    : {
                        borderColor: 'rgba(0, 245, 255, 0.35)',
                        boxShadow: '0 0 25px rgba(0, 245, 255, 0.12)',
                      }
                }
                className="group relative flex flex-col justify-between p-8 rounded-2xl text-left border backdrop-blur-xl transition-all duration-300 min-h-[220px] md:min-h-[280px] cursor-pointer"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className="text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full"
                    style={{
                      background: 'rgba(0, 245, 255, 0.12)',
                      color: '#00F5FF',
                      border: '1px solid rgba(0, 245, 255, 0.3)',
                    }}
                  >
                    Choice A
                  </span>
                  <span className="text-xs text-white/30 tracking-widest uppercase group-hover:text-cyan-400 transition-colors">
                    Click to Select ↵
                  </span>
                </div>

                {/* Fact Text */}
                <div className="my-auto py-4">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white leading-snug">
                    {currentQ.factA}
                  </h2>
                </div>

                {/* Footer Glow Line */}
                <div className="w-full h-1 rounded-full bg-cyan-400/20 group-hover:bg-cyan-400/60 transition-colors" />
              </motion.button>

              {/* Card B (Purple Neon) */}
              <motion.button
                type="button"
                onClick={() => handleCardClick('B')}
                disabled={selectedCard !== null}
                whileHover={
                  !selectedCard
                    ? { scale: 1.025, y: -4 }
                    : undefined
                }
                whileTap={!selectedCard ? { scale: 0.98 } : undefined}
                animate={
                  selectedCard === 'B'
                    ? cardStatus === 'correct'
                      ? {
                          borderColor: 'rgba(48, 209, 88, 1)',
                          boxShadow: '0 0 40px rgba(48, 209, 88, 0.5), inset 0 0 20px rgba(48, 209, 88, 0.2)',
                          scale: 1.03,
                        }
                      : {
                          x: [-12, 12, -8, 8, -4, 4, 0],
                          borderColor: 'rgba(255, 69, 58, 1)',
                          boxShadow: '0 0 40px rgba(255, 69, 58, 0.5), inset 0 0 20px rgba(255, 69, 58, 0.2)',
                          transition: { duration: 0.5 },
                        }
                    : {
                        borderColor: 'rgba(191, 90, 242, 0.35)',
                        boxShadow: '0 0 25px rgba(191, 90, 242, 0.12)',
                      }
                }
                className="group relative flex flex-col justify-between p-8 rounded-2xl text-left border backdrop-blur-xl transition-all duration-300 min-h-[220px] md:min-h-[280px] cursor-pointer"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                }}
              >
                {/* Header Tag */}
                <div className="flex items-center justify-between w-full">
                  <span
                    className="text-xs uppercase font-bold tracking-widest px-3 py-1 rounded-full"
                    style={{
                      background: 'rgba(191, 90, 242, 0.12)',
                      color: '#BF5AF2',
                      border: '1px solid rgba(191, 90, 242, 0.3)',
                    }}
                  >
                    Choice B
                  </span>
                  <span className="text-xs text-white/30 tracking-widest uppercase group-hover:text-purple-400 transition-colors">
                    Click to Select ↵
                  </span>
                </div>

                {/* Fact Text */}
                <div className="my-auto py-4">
                  <h2 className="text-xl md:text-2xl font-bold tracking-tight text-white leading-snug">
                    {currentQ.factB}
                  </h2>
                </div>

                {/* Footer Glow Line */}
                <div className="w-full h-1 rounded-full bg-purple-400/20 group-hover:bg-purple-400/60 transition-colors" />
              </motion.button>
            </div>
          </div>
        )}

        {/* State 3: Game Over */}
        {gameState === 'gameover' && (
          <motion.div
            className="w-full max-w-lg flex flex-col items-center text-center p-8 md:p-10 rounded-3xl backdrop-blur-2xl border"
            style={{
              background: 'rgba(255, 255, 255, 0.04)',
              borderColor: 'rgba(255, 255, 255, 0.1)',
              boxShadow: '0 25px 60px rgba(0, 0, 0, 0.6), 0 0 40px rgba(0, 245, 255, 0.1)',
            }}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.4 }}
          >
            {/* Badge */}
            <div className="text-4xl mb-3">
              {score >= 8 ? '🏆' : score >= 5 ? '⚡' : '💀'}
            </div>

            <h2 className="text-3xl md:text-4xl font-black tracking-tight mb-2 text-white">
              {score === questions.length ? 'FLAWLESS VICTORY' : 'GAME OVER'}
            </h2>

            <p className="text-sm text-white/50 mb-6">
              {score === questions.length
                ? 'You conquered every single comparison!'
                : 'The AI challenged your intuition.'}
            </p>

            {/* Final Score Stat */}
            <div
              className="w-full py-4 px-6 rounded-2xl mb-6 flex items-center justify-around"
              style={{
                background: 'rgba(0, 245, 255, 0.06)',
                border: '1px solid rgba(0, 245, 255, 0.2)',
              }}
            >
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-white/40">Final Score</span>
                <span className="text-3xl font-black font-mono text-cyan-400">{score}</span>
              </div>
              <div className="h-8 w-px bg-white/10" />
              <div className="flex flex-col">
                <span className="text-xs uppercase tracking-widest text-white/40">Total Questions</span>
                <span className="text-3xl font-black font-mono text-white/80">{questions.length}</span>
              </div>
            </div>

            {/* AI Explanation / Analysis */}
            {explanation && (
              <div
                className="w-full p-4 rounded-xl mb-8 text-left border"
                style={{
                  background: 'rgba(191, 90, 242, 0.06)',
                  borderColor: 'rgba(191, 90, 242, 0.25)',
                }}
              >
                <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-purple-300 font-bold">
                  <span>🧠</span>
                  <span>AI Breakdown</span>
                </div>
                <p className="text-sm leading-relaxed text-white/80 font-normal">
                  {explanation}
                </p>
              </div>
            )}

            {/* Actions */}
            <div className="w-full flex flex-col sm:flex-row gap-3">
              <button
                type="button"
                onClick={fetchQuestions}
                className="flex-1 py-3.5 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0 cursor-pointer"
              >
                Play Again ↻
              </button>
              <Link
                to="/"
                className="py-3.5 px-6 rounded-xl font-bold text-sm uppercase tracking-wider text-white/70 hover:text-white border border-white/20 hover:border-white/40 backdrop-blur-md transition-all text-center"
              >
                Arcade Menu
              </Link>
            </div>
          </motion.div>
        )}
      </main>
    </div>
  )
}

export default HigherLower
