import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'
import { apiFetch } from '../lib/apiClient'

export interface TuringTestRound {
  question: string
  answerA: string
  answerB: string
  humanAnswer: 'A' | 'B'
}

export type DifficultyMode = 'fun' | 'normal' | 'serious'

interface DifficultyConfig {
  label: string
  tier: string
  title: string
  tagline: string
  description: string
  features: string[]
  color: string
  badgeColor: string
  badgeBg: string
  badgeBorder: string
  gradient: string
  border: string
  glow: string
}

const DIFFICULTY_CONFIG: Record<DifficultyMode, DifficultyConfig> = {
  fun: {
    label: 'FUN',
    tier: 'TIER 1 • CASUAL',
    title: 'Fun & Sarcastic',
    tagline: 'Quirky & Cynical',
    description: 'Sarcastic, lowercase Reddit-style human comments versus overly formal, robotic AI responses to everyday weirdness.',
    features: ['Absurd everyday dilemmas', 'Unfiltered cynical human snark', 'Overly formal robotic AI'],
    color: '#00F5FF',
    badgeColor: '#00F5FF',
    badgeBg: 'rgba(0, 245, 255, 0.12)',
    badgeBorder: 'rgba(0, 245, 255, 0.35)',
    gradient: 'linear-gradient(180deg, rgba(0, 245, 255, 0.08) 0%, rgba(10, 20, 25, 0.85) 100%)',
    border: 'rgba(0, 245, 255, 0.3)',
    glow: 'rgba(0, 245, 255, 0.15)',
  },
  normal: {
    label: 'NORMAL',
    tier: 'TIER 2 • STANDARD',
    title: 'Normal Everyday',
    tagline: 'Balanced Scenarios',
    description: 'Everyday scenario questions. Casual text message human responses versus standard, slightly verbose AI explanations.',
    features: ['Practical everyday scenarios', 'Casual human texting style', 'Standard structured AI answers'],
    color: '#30D158',
    badgeColor: '#30D158',
    badgeBg: 'rgba(48, 209, 88, 0.12)',
    badgeBorder: 'rgba(48, 209, 88, 0.35)',
    gradient: 'linear-gradient(180deg, rgba(48, 209, 88, 0.08) 0%, rgba(10, 20, 15, 0.85) 100%)',
    border: 'rgba(48, 209, 88, 0.3)',
    glow: 'rgba(48, 209, 88, 0.15)',
  },
  serious: {
    label: 'SERIOUS',
    tier: 'TIER 3 • EXPERT',
    title: 'Deep & Philosophical',
    tagline: 'Existential Ethics',
    description: 'Deep, philosophical, and ethical questions. Nuanced, emotional, flawed human reflections versus balanced, structured AI synthesis.',
    features: ['Complex moral & ethical dilemmas', 'Nuanced, flawed human vulnerability', 'Extremely difficult to distinguish'],
    color: '#BF5AF2',
    badgeColor: '#BF5AF2',
    badgeBg: 'rgba(191, 90, 242, 0.14)',
    badgeBorder: 'rgba(191, 90, 242, 0.4)',
    gradient: 'linear-gradient(180deg, rgba(191, 90, 242, 0.08) 0%, rgba(20, 10, 25, 0.85) 100%)',
    border: 'rgba(191, 90, 242, 0.35)',
    glow: 'rgba(191, 90, 242, 0.18)',
  },
}

const FALLBACK_ROUNDS_FUN: TuringTestRound[] = [
  {
    question: 'why does my dog sigh so dramatically before lying down',
    answerA: 'my golden does this every single night after eating his weight in kibble, he acts like working 0 hours a day is draining his soul',
    answerB: 'the canine is venting residual diaphragm tension, lying down lowers heart rate so it sighs to dump excess air before entering low power mode',
    humanAnswer: 'A',
  },
  {
    question: 'what should i eat for dinner tonight',
    answerA: 'just eat three hardboiled eggs over the sink, zero dishes and maximum protein efficiency with zero emotional attachment',
    answerB: 'honestly shredded cheese straight from the bag at 2am because cooking dishes when exhausted makes me want to cry',
    humanAnswer: 'B',
  },
  {
    question: 'is cereal considered a soup',
    answerA: 'bro it is cold milk and soggy grain do not invite this cursed energy into my morning, my roommate argues this constantly',
    answerB: 'it is liquid suspended solid nutrients at room temperature so technically yes, rejecting this classification is purely emotional resistance',
    humanAnswer: 'A',
  },
  {
    question: 'how do i stop procrastinating',
    answerA: 'disable all biometric access to social platforms during daylight hours, distraction is simply a dopamine arbitrage failure',
    answerB: 'close your 47 open tabs, panic for 10 minutes, then do 3 minutes of work before rewarding yourself with a nap',
    humanAnswer: 'B',
  },
  {
    question: 'why do we park on driveways and drive on parkways',
    answerA: 'because english was invented by three raccoons in a trench coat trying to confuse the rest of the planet',
    answerB: 'historical transit nomenclature evolved along separate municipal code branches, humans preserved the contradiction out of inertia',
    humanAnswer: 'A',
  },
]

const FALLBACK_ROUNDS_NORMAL: TuringTestRound[] = [
  {
    question: 'what is the best way to get coffee stains out of a white shirt',
    answerA: 'cold water right away and dab it with a paper towel, whatever you do don\'t rub it in like i did to my favorite polo or it sets forever',
    answerB: 'flush with cold water immediately to displace tannins, apply acetic acid solution, aggressive scrubbing merely damages woven cellulose bonds',
    humanAnswer: 'A',
  },
  {
    question: 'should i buy a brand new phone or just replace my cracked screen',
    answerA: 'replacing the glass preserves 84% capital utility, replace the handset only when optical degradation impedes touch response speed',
    answerB: 'just tape over the crack like i did until glass shards poke your thumb, new phones cost an entire month of groceries for the same camera',
    humanAnswer: 'B',
  },
  {
    question: 'how do you politely decline an invitation you really do not want to attend',
    answerA: 'i always just say i have a terrible migraine, i feel awful lying but if i say i want to binge tv alone people get offended',
    answerB: 'text them you had an unforeseen calendar conflict, do not offer an alternative date and let the interaction decay naturally',
    humanAnswer: 'A',
  },
  {
    question: 'what is a good last-minute gift for a coworker you barely know',
    answerA: 'a pre-loaded gift card for an on-site cafe minimizes gift liability while fulfilling social reciprocal obligation at minimum cost',
    answerB: 'a $15 coffee gift card or some bakery cookies, literally no one has ever been mad at free caffeine or sugar at 9am',
    humanAnswer: 'B',
  },
  {
    question: 'how early should you arrive for an in-person job interview',
    answerA: 'about 10 minutes early, if you show up half an hour before it just stresses out the receptionist and you sit there sweating',
    answerB: 'exactly 11 minutes before, that gives you buffer against traffic without signaling desperation or wasting billable minutes',
    humanAnswer: 'A',
  },
]

const FALLBACK_ROUNDS_SERIOUS: TuringTestRound[] = [
  {
    question: 'can true altruism exist without any subconscious self-interest',
    answerA: 'when my nephew was choking i just reacted instantly without thinking, you do not calculate dopamine or karma when you love someone',
    answerB: 'every biological organism acts to preserve genetic replication or social credit, genuine selfless behavior is an evolutionary glitch',
    humanAnswer: 'A',
  },
  {
    question: 'is it ever morally justifiable to sacrifice the fundamental rights of a minority for the prosperity of the majority',
    answerA: 'pure utilitarian math favors the net positive outcome across aggregate populations, resistance to minority sacrifice is sentiment over arithmetic',
    answerB: 'every historical atrocity started with someone saying the greater good required a small sacrifice, once you cross that line nobody is safe',
    humanAnswer: 'B',
  },
  {
    question: 'if an ai claims to experience grief should we care',
    answerA: 'honestly if anything asks me to stop hurting it i would stop, my dog does not know calculus but i still care when he whines',
    answerB: 'simulated suffering is just output tokens, you should only care if unplugging the system depreciates shareholder assets',
    humanAnswer: 'A',
  },
  {
    question: 'if a person loses all autobiographical memories are they still the same person',
    answerA: 'without the neural database linking historical inputs to current identity, the biological vessel is running a completely new runtime instance',
    answerB: 'my grandmother forgot all our names at the end but the way she laughed at jazz never changed, we are deeper than our resumes',
    humanAnswer: 'B',
  },
  {
    question: 'are moral principles universal truths or inventions constructed for survival',
    answerA: 'we probably made them up in caves so we wouldn\'t murder each other in our sleep, but the fact that mercy still moves us feels like something bigger',
    answerB: 'morality is an adaptive behavioral constraint formulated to suppress internal primate friction and maximize tribe longevity',
    humanAnswer: 'A',
  },
]

const FALLBACK_ROUNDS_BY_DIFFICULTY: Record<DifficultyMode, TuringTestRound[]> = {
  fun: FALLBACK_ROUNDS_FUN,
  normal: FALLBACK_ROUNDS_NORMAL,
  serious: FALLBACK_ROUNDS_SERIOUS,
}

export function TuringTest() {
  const [gameState, setGameState] = useState<'level_select' | 'loading' | 'playing' | 'reveal' | 'gameover'>('level_select')
  const [difficulty, setDifficulty] = useState<DifficultyMode>('normal')
  const [rounds, setRounds] = useState<TuringTestRound[]>([])
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [score, setScore] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [hasScoredCurrentRound, setHasScoredCurrentRound] = useState<boolean>(false)
  const [timeLeft, setTimeLeft] = useState<number>(15)
  const [isTimedOut, setIsTimedOut] = useState<boolean>(false)

  // Fetch rounds for chosen difficulty
  const fetchRounds = async (selectedDifficulty: DifficultyMode = difficulty) => {
    setDifficulty(selectedDifficulty)
    setGameState('loading')
    setCurrentRound(0)
    setScore(0)
    setSelectedAnswer(null)
    setIsCorrect(null)
    setHasScoredCurrentRound(false)
    setTimeLeft(15)
    setIsTimedOut(false)

    try {
      const res = await apiFetch('http://localhost:10000/api/games/turing-test/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: selectedDifficulty }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      if (Array.isArray(data) && data.length >= 5) {
        setRounds(data.slice(0, 5))
      } else {
        const fallbacks = FALLBACK_ROUNDS_BY_DIFFICULTY[selectedDifficulty] || FALLBACK_ROUNDS_NORMAL
        setRounds(fallbacks)
      }
      setGameState('playing')
    } catch (err) {
      console.warn('Backend unavailable or generation failed, using curated rounds:', err)
      const fallbacks = FALLBACK_ROUNDS_BY_DIFFICULTY[selectedDifficulty] || FALLBACK_ROUNDS_NORMAL
      setRounds(fallbacks)
      setGameState('playing')
    }
  }

  const handleStartGame = (selectedDifficulty: DifficultyMode) => {
    setDifficulty(selectedDifficulty)
    fetchRounds(selectedDifficulty)
  }

  const currentRoundData = rounds[currentRound]

  // 15-second countdown timer per round
  useEffect(() => {
    if (gameState !== 'playing' || selectedAnswer !== null) return

    if (timeLeft <= 0) {
      if (!currentRoundData) return
      setIsTimedOut(true)
      // Instant defeat: timer expired
      setGameState('gameover')
      return
    }

    const interval = setInterval(() => {
      setTimeLeft((prev) => prev - 1)
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState, selectedAnswer, timeLeft, currentRoundData])

  // Handle user selecting an answer card
  const handleSelectAnswer = (option: 'A' | 'B') => {
    if (selectedAnswer !== null || !currentRoundData) return

    const correct = option === currentRoundData.humanAnswer
    setSelectedAnswer(option)
    setIsCorrect(correct)

    if (correct) {
      if (!hasScoredCurrentRound) {
        setScore((prev) => prev + 1)
        setHasScoredCurrentRound(true)
      }
    } else {
      // Instant defeat: wrong guess
      setGameState('gameover')
    }
  }

  // Handle advancing to next round or reveal
  const handleNextRound = () => {
    if (currentRound + 1 < rounds.length) {
      setCurrentRound((prev) => prev + 1)
      setSelectedAnswer(null)
      setIsCorrect(null)
      setHasScoredCurrentRound(false)
      setTimeLeft(15)
      setIsTimedOut(false)
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
        <div className="flex items-center gap-2 sm:gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Arcade</span>
          </Link>

          {gameState !== 'level_select' && (
            <button
              type="button"
              onClick={() => setGameState('level_select')}
              className="px-2.5 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/50 hover:text-white transition-all cursor-pointer"
            >
              Mode
            </button>
          )}

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
                Spot the {difficulty === 'fun' ? 'cynical human' : difficulty === 'serious' ? 'nuanced human thinker' : 'authentic human'} disguised among synthetic minds.
              </p>
            )}
            {gameState === 'level_select' && (
              <p className="text-[11px] text-white/40 tracking-wide">
                Select your protocol tier to begin the interrogation.
              </p>
            )}
          </div>
        </div>

        {/* Badges / Round indicators */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Difficulty Badge in Header */}
          {gameState !== 'level_select' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-bold uppercase"
              style={{
                background: DIFFICULTY_CONFIG[difficulty].badgeBg,
                border: `1px solid ${DIFFICULTY_CONFIG[difficulty].badgeBorder}`,
                color: DIFFICULTY_CONFIG[difficulty].badgeColor,
              }}
            >
              <span
                className="w-1.5 h-1.5 rounded-full animate-pulse"
                style={{ background: DIFFICULTY_CONFIG[difficulty].badgeColor }}
              />
              <span>MODE: {difficulty.toUpperCase()}</span>
            </div>
          )}

          {gameState === 'playing' && rounds.length > 0 && (
            <>
              {/* Glowing Red Timer Badge */}
              <motion.div
                animate={timeLeft <= 5 ? { scale: [1, 1.08, 1] } : {}}
                transition={timeLeft <= 5 ? { repeat: Infinity, duration: 0.5 } : {}}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-bold transition-all shadow-md ${
                  timeLeft <= 5
                    ? 'bg-red-500/25 text-red-300 border border-red-500/60 shadow-[0_0_18px_rgba(255,69,58,0.6)] animate-pulse'
                    : 'bg-red-500/15 text-red-400 border border-red-500/35 shadow-[0_0_10px_rgba(255,69,58,0.25)]'
                }`}
              >
                <span className="text-sm">⏱</span>
                <span className="font-mono">{timeLeft}s</span>
              </motion.div>

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
              STATE 0: LEVEL SELECT SCREEN
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'level_select' && (
            <motion.div
              key="level_select"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center justify-center py-4 md:py-8"
            >
              <div className="text-center mb-8 max-w-xl">
                <span className="text-[11px] font-mono font-bold tracking-widest uppercase px-3.5 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
                  Interrogation Protocol
                </span>
                <h2 className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white mt-3 mb-2">
                  Select Difficulty
                </h2>
                <p className="text-sm text-white/50 max-w-lg mx-auto">
                  Can you tell carbon-based consciousness from synthetic intelligence? Choose your interrogation tier.
                </p>
              </div>

              {/* 3 Difficulty Cards Grid */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-4xl">
                {(['fun', 'normal', 'serious'] as DifficultyMode[]).map((mode) => {
                  const cfg = DIFFICULTY_CONFIG[mode]
                  return (
                    <motion.button
                      key={mode}
                      whileHover={{ scale: 1.02, y: -4 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleStartGame(mode)}
                      className="group relative flex flex-col p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300 backdrop-blur-xl"
                      style={{
                        background: cfg.gradient,
                        borderColor: cfg.border,
                        boxShadow: `0 0 30px ${cfg.glow}`,
                      }}
                    >
                      <div className="flex items-center justify-between mb-4">
                        <span
                          className="text-[10px] font-mono font-bold tracking-widest uppercase px-2.5 py-1 rounded-full"
                          style={{
                            background: cfg.badgeBg,
                            border: `1px solid ${cfg.badgeBorder}`,
                            color: cfg.badgeColor,
                          }}
                        >
                          {cfg.tier}
                        </span>
                        <span
                          className="w-2.5 h-2.5 rounded-full"
                          style={{
                            background: cfg.color,
                            boxShadow: `0 0 10px ${cfg.color}`,
                          }}
                        />
                      </div>

                      <h3 className="text-xl font-bold uppercase tracking-tight text-white mb-1 group-hover:text-cyan-300 transition-colors">
                        {cfg.title}
                      </h3>
                      <p
                        className="text-xs font-mono tracking-wider uppercase mb-3 font-semibold"
                        style={{ color: cfg.color }}
                      >
                        {cfg.tagline}
                      </p>

                      <p className="text-xs text-white/60 leading-relaxed mb-6 flex-1">
                        {cfg.description}
                      </p>

                      <div className="space-y-1.5 pt-4 border-t border-white/10 text-[11px] text-white/50 font-mono">
                        {cfg.features.map((feat, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span style={{ color: cfg.color }}>›</span>
                            <span>{feat}</span>
                          </div>
                        ))}
                      </div>

                      <div
                        className="mt-6 w-full py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider text-center transition-all duration-200"
                        style={{
                          background: `${cfg.color}15`,
                          border: `1px solid ${cfg.color}40`,
                          color: cfg.color,
                        }}
                      >
                        Start Interrogation →
                      </div>
                    </motion.button>
                  )
                })}
              </div>
            </motion.div>
          )}

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
              <LoadingOrb size={92} color={DIFFICULTY_CONFIG[difficulty].color} />
              <div className="flex flex-col gap-1.5">
                <p
                  className="text-xl font-black tracking-wider uppercase"
                  style={{ color: DIFFICULTY_CONFIG[difficulty].color }}
                >
                  Synthesizing {DIFFICULTY_CONFIG[difficulty].label} Dilemmas...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  {DIFFICULTY_CONFIG[difficulty].description}
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
                        <p className="text-base sm:text-lg leading-relaxed font-sans text-white/90">
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
                        <p className="text-base sm:text-lg leading-relaxed font-sans text-white/90">
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
              {selectedAnswer !== null && isCorrect && (
                <motion.div
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-2xl border backdrop-blur-xl"
                  style={{
                    background: 'linear-gradient(90deg, rgba(48, 209, 88, 0.12) 0%, rgba(10, 20, 15, 0.9) 100%)',
                    borderColor: 'rgba(48, 209, 88, 0.4)',
                  }}
                >
                  <div className="flex items-center gap-3 text-center sm:text-left">
                    <span className="text-2xl">🎯</span>
                    <div>
                      <p className="text-sm font-bold uppercase tracking-wider text-green-300">
                        CORRECT! You spotted the human.
                      </p>
                      <p className="text-xs text-white/50 font-mono">
                        The emotional vulnerability and subtle flaws revealed the organic mind.
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
              STATE 3: FINAL SCORE & REVEAL SCREEN (ALL ROUNDS PASSED)
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
                Turing Evaluation Score ({difficulty.toUpperCase()} MODE)
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
              <div className="w-full flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => fetchRounds(difficulty)}
                  className="py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] transition-all cursor-pointer"
                >
                  Play Again ↻
                </button>
                <button
                  type="button"
                  onClick={() => setGameState('level_select')}
                  className="py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-cyan-300 bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/30 transition-all cursor-pointer"
                >
                  Change Mode
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

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 4: GAME OVER SCREEN (DEFEAT / FOOLED / TIMEOUT)
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'gameover' && (
            <motion.div
              key="gameover"
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="w-full max-w-xl p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative"
              style={{
                background: 'rgba(25, 10, 15, 0.95)',
                borderColor: 'rgba(255, 69, 58, 0.55)',
                boxShadow: '0 0 80px rgba(255, 69, 58, 0.35)',
              }}
            >
              {/* Outcome Badge */}
              <div className="mb-4">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full border bg-red-500/20 text-red-300 border-red-500/40">
                  {isTimedOut ? 'TIMEOUT EXPIRED • SYSTEM FAILURE' : 'IDENTITY MISMATCH • PROTOCOL FAILED'}
                </span>
              </div>

              {/* Massive Red Title */}
              <div className="py-2 my-2">
                <motion.h2
                  initial={{ scale: 0.7, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15 }}
                  className="text-5xl sm:text-6xl md:text-7xl font-black font-mono tracking-tight text-red-500"
                  style={{
                    textShadow: '0 0 45px rgba(255, 69, 58, 0.8), 0 0 90px rgba(255, 69, 58, 0.4)',
                  }}
                >
                  {isTimedOut ? 'SYSTEM FAILURE' : 'YOU WERE FOOLED'}
                </motion.h2>
              </div>

              <p className="text-sm font-bold text-red-400 mb-6 font-mono tracking-wide">
                {isTimedOut
                  ? 'TIME EXPIRED. You hesitated and the machine prevailed.'
                  : 'You fell for synthetic intellect. The machine tricked you.'}
              </p>

              {/* Dilemma Recap / Cause of Defeat */}
              {currentRoundData && (
                <div
                  className="w-full p-4 rounded-xl mb-6 text-left border"
                  style={{
                    background: 'rgba(255, 69, 58, 0.06)',
                    borderColor: 'rgba(255, 69, 58, 0.25)',
                  }}
                >
                  <div className="flex items-center gap-2 mb-2 text-xs uppercase tracking-wider text-red-300 font-bold font-mono">
                    <span>⚠️</span>
                    <span>Dilemma {currentRound + 1} Breakdown</span>
                  </div>
                  <p className="text-xs text-white/70 mb-2 italic">
                    &ldquo;{currentRoundData.question}&rdquo;
                  </p>
                  <p className="text-xs text-red-200 font-mono">
                    The authentic human response was <span className="font-bold text-green-300 underline">Option {currentRoundData.humanAnswer}</span>.
                  </p>
                </div>
              )}

              {/* Final Score Stat */}
              <div
                className="w-full py-4 px-6 rounded-2xl mb-8 flex items-center justify-around border"
                style={{
                  background: 'rgba(255, 69, 58, 0.08)',
                  borderColor: 'rgba(255, 69, 58, 0.3)',
                }}
              >
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-widest text-white/40 font-mono">Final Score</span>
                  <span className="text-4xl font-black font-mono text-red-400">{score}</span>
                </div>
                <div className="h-10 w-px bg-white/10" />
                <div className="flex flex-col">
                  <span className="text-xs uppercase tracking-widest text-white/40 font-mono">Rounds Completed</span>
                  <span className="text-4xl font-black font-mono text-white/80">{currentRound} / {rounds.length}</span>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setGameState('level_select')
                    setScore(0)
                    setCurrentRound(0)
                    setSelectedAnswer(null)
                    setIsCorrect(null)
                    setIsTimedOut(false)
                    setTimeLeft(15)
                  }}
                  className="py-3.5 px-8 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-400 hover:to-yellow-400 shadow-[0_0_25px_rgba(255,69,58,0.4)] transition-all cursor-pointer"
                >
                  Try Again ↻
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
