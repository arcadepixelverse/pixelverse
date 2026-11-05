import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

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

const FALLBACK_ROUNDS_NORMAL: TuringTestRound[] = [
  {
    question: 'What is the best way to get coffee stains out of a white shirt?',
    answerA: 'cold water right away and dab it with a paper towel! whatever you do don\'t rub it in or it sets forever',
    answerB: 'Immediately flush the fabric with cold water, apply a dilute mixture of dish soap and white vinegar, and gently blot the affected area.',
    humanAnswer: 'A',
  },
  {
    question: 'Should I buy a brand new phone or just replace my cracked screen?',
    answerA: 'If the hardware still supports the latest operating system and your battery health is acceptable, repairing the display is the more economically prudent choice.',
    answerB: 'just fix the screen honestly, new phones are basically identical now and cost way too much',
    humanAnswer: 'B',
  },
  {
    question: 'How do you politely decline an invitation you really don\'t want to attend?',
    answerA: 'hey so sorry i won\'t be able to make it this weekend! hope you all have the best time though',
    answerB: 'A respectful message acknowledging the invitation, stating that you have a prior commitment, and wishing them a successful event is standard etiquette.',
    humanAnswer: 'A',
  },
  {
    question: 'What is a good last-minute gift for a coworker you barely know?',
    answerA: 'A neutral and universally appreciated gift such as a cafe voucher or a gourmet hot chocolate set is appropriate for professional acquaintances.',
    answerB: 'a $15 coffee gift card or some nice cookies, literally no one is ever unhappy with free caffeine or snacks',
    humanAnswer: 'B',
  },
  {
    question: 'How early should you arrive for an in-person job interview?',
    answerA: 'about 10 minutes early. if you show up half an hour before it just stresses out the receptionist',
    answerB: 'Arriving approximately 10 to 15 minutes prior to the scheduled interview demonstrates punctuality without creating an inconvenience for your host.',
    humanAnswer: 'A',
  },
]

const FALLBACK_ROUNDS_SERIOUS: TuringTestRound[] = [
  {
    question: 'Can true altruism exist without any subconscious self-interest?',
    answerA: 'When I pulled my sister away from an oncoming car, there was zero thought of feeling good about myself later—just pure terror and reflex. Love sometimes acts before the ego even has time to negotiate.',
    answerB: 'Philosophical debates contrast psychological egoism with genuine altruism; while evolutionary empathy may reward altruistic acts with neurochemical satisfaction, the primary motivation can remain strictly others-oriented.',
    humanAnswer: 'A',
  },
  {
    question: 'Is it ever morally justifiable to sacrifice the fundamental rights of a minority for the prosperity of the majority?',
    answerA: 'This scenario illustrates the classical philosophical tension between utilitarian frameworks seeking maximum aggregate utility and deontological ethics asserting that fundamental rights are inviolable regardless of consequences.',
    answerB: 'Every historical atrocity began with leaders claiming a temporary sacrifice was necessary for the greater good. The second fundamental human rights become conditional, no one is actually safe.',
    humanAnswer: 'B',
  },
  {
    question: 'If artificial intelligence claims to experience grief or suffering, do we have an ethical duty to respect that claim?',
    answerA: 'We can never truly prove what another mind feels—even other humans. But if something asks you to stop hurting it, deciding to ignore that plea says far more about our cruelty than about their programming.',
    answerB: 'Ethical personhood relies on subjective qualia and sentience rather than sophisticated linguistic imitation; nevertheless, precautionary ethical principles advocate prudent restraint when interacting with ambiguous cognitive entities.',
    humanAnswer: 'A',
  },
  {
    question: 'If a person loses all their autobiographical memories, are they still the same person?',
    answerA: 'Lockean psychological continuity posits that identity relies upon reflective autobiographical memory, whereas somatocentric and relational theories assert identity is anchored in bodily continuity and shared interpersonal presence.',
    answerB: 'My grandmother forgot our names in her final years, but the way she laughed at old jazz records and her gentle touch never changed. We are more than the archives stored in our skulls.',
    humanAnswer: 'B',
  },
  {
    question: 'Are moral principles universal truths waiting to be discovered, or inventions constructed for social survival?',
    answerA: 'We probably made them up in the dark so we wouldn\'t destroy each other, but the fact that almost every culture independently arrived at protecting the weak means there is something real beneath the invention.',
    answerB: 'Moral realism maintains that objective ethical truths exist independently of human perspective, while moral constructivism argues that ethical norms are functional adaptations formulated to optimize cooperative human flourishing.',
    humanAnswer: 'A',
  },
]

const FALLBACK_ROUNDS_BY_DIFFICULTY: Record<DifficultyMode, TuringTestRound[]> = {
  fun: FALLBACK_ROUNDS_FUN,
  normal: FALLBACK_ROUNDS_NORMAL,
  serious: FALLBACK_ROUNDS_SERIOUS,
}

export function TuringTest() {
  const [gameState, setGameState] = useState<'level_select' | 'loading' | 'playing' | 'reveal'>('level_select')
  const [difficulty, setDifficulty] = useState<DifficultyMode>('normal')
  const [rounds, setRounds] = useState<TuringTestRound[]>([])
  const [currentRound, setCurrentRound] = useState<number>(0)
  const [score, setScore] = useState<number>(0)
  const [selectedAnswer, setSelectedAnswer] = useState<'A' | 'B' | null>(null)
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null)
  const [hasScoredCurrentRound, setHasScoredCurrentRound] = useState<boolean>(false)

  // Fetch rounds for chosen difficulty
  const fetchRounds = async (selectedDifficulty: DifficultyMode = difficulty) => {
    setDifficulty(selectedDifficulty)
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
        </AnimatePresence>
      </main>
    </div>
  )
}

export default TuringTest
