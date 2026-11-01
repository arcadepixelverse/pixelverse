import { useState, useEffect, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

const CANNED_QUESTIONS = [
  "How many hours have you genuinely studied for this?",
  "Are you being 100% honest with yourself right now?",
  "What is the biggest distraction standing in your way?",
]

export interface VerdictData {
  percentage: number
  verdict: string
}

export function Oracle() {
  const [step, setStep] = useState<number>(0)
  const [userQuestion, setUserQuestion] = useState<string>('')
  const [answers, setAnswers] = useState<string[]>([])
  const [currentInput, setCurrentInput] = useState<string>('')
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null)
  const [displayedVerdict, setDisplayedVerdict] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Typewriter effect for step 5 ──
  useEffect(() => {
    if (step === 5 && verdictData?.verdict) {
      setDisplayedVerdict('')
      let i = 0
      const fullText = verdictData.verdict
      const timer = setInterval(() => {
        i++
        setDisplayedVerdict(fullText.slice(0, i))
        if (i >= fullText.length) {
          clearInterval(timer)
        }
      }, 25)
      return () => clearInterval(timer)
    }
  }, [step, verdictData])

  // ── Step 0 Submission: Initial user question ──
  const handleStartConsultation = (e: FormEvent) => {
    e.preventDefault()
    const trimmed = currentInput.trim()
    if (!trimmed) {
      setErrorMsg('Ask the Oracle what you seek to know.')
      return
    }

    setUserQuestion(trimmed)
    setAnswers([])
    setCurrentInput('')
    setErrorMsg(null)
    setStep(1)
  }

  // ── Steps 1-3 Submission: Canned probing questions ──
  const handleAnswerStep = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = currentInput.trim()
    if (!trimmed) {
      setErrorMsg('The Oracle demands an answer. Do not remain silent.')
      return
    }

    const updatedAnswers = [...answers, trimmed]
    setAnswers(updatedAnswers)
    setCurrentInput('')
    setErrorMsg(null)

    if (step < 3) {
      setStep(step + 1)
    } else {
      // Step 3 answered -> move to loading step 4 and consult backend
      setStep(4)
      await fetchVerdict(updatedAnswers)
    }
  }

  // ── Step 4: Call backend for the final Oracle verdict ──
  const fetchVerdict = async (completedAnswers: string[]) => {
    try {
      const res = await fetch('http://localhost:10000/api/games/oracle/verdict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: userQuestion,
          answers: completedAnswers,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      setVerdictData({
        percentage: typeof data.percentage === 'number' ? data.percentage : 50,
        verdict: data.verdict || 'The threads of fate remain woven in shadow. Your discipline shall determine the outcome.',
      })
      setStep(5)
    } catch (err: any) {
      console.warn('Backend unavailable, using simulated oracle reading:', err)
      // Simulated offline verdict
      const answersText = completedAnswers.join(' ').toLowerCase()
      let simulatedPercentage = 45
      if (answersText.includes('many') || answersText.includes('yes') || answersText.includes('hard') || answersText.includes('none')) {
        simulatedPercentage = 78
      } else if (answersText.includes('zero') || answersText.includes('phone') || answersText.includes('procrastinat') || answersText.includes('no')) {
        simulatedPercentage = 24
      }

      setVerdictData({
        percentage: simulatedPercentage,
        verdict:
          simulatedPercentage > 50
            ? 'The nexus of destiny leans toward your triumph, yet complacency will fracture it. Eliminate your final hesitation and claim what you sought.'
            : 'Your conviction is compromised by the distractions you readily harbor. Until discipline replaces your excuses, failure remains your mathematical certainty.',
      })
      setStep(5)
    }
  }

  // ── Reset to step 0 ──
  const handleReset = () => {
    setStep(0)
    setUserQuestion('')
    setAnswers([])
    setCurrentInput('')
    setVerdictData(null)
    setDisplayedVerdict('')
    setErrorMsg(null)
  }

  // Percentage color helper
  const getPercentageTheme = (pct: number) => {
    if (pct > 70) {
      return {
        color: '#30D158',
        shadow: 'rgba(48, 209, 88, 0.8)',
        badge: 'bg-green-500/20 text-green-300 border-green-500/40',
        label: 'FAVORABLE DESTINY',
      }
    }
    if (pct < 30) {
      return {
        color: '#FF453A',
        shadow: 'rgba(255, 69, 58, 0.8)',
        badge: 'bg-red-500/20 text-red-300 border-red-500/40',
        label: 'GRIM PROBABILITY',
      }
    }
    return {
      color: '#BF5AF2',
      shadow: 'rgba(191, 90, 242, 0.8)',
      badge: 'bg-purple-500/20 text-purple-300 border-purple-500/40',
      label: 'UNCERTAIN PATH',
    }
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
              <span className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-blue-300">
                The Oracle
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-blue-500/15 border border-blue-500/30 text-blue-300">
                Futuristic Seer
              </span>
            </div>
            {step > 0 && userQuestion && (
              <p className="text-[11px] text-white/40 tracking-wide line-clamp-1 max-w-sm sm:max-w-md">
                Inquiry: <span className="font-mono text-white/80 font-medium">&ldquo;{userQuestion}&rdquo;</span>
              </p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {step >= 1 && step <= 3 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
              style={{
                background: 'rgba(10, 132, 255, 0.1)',
                border: '1px solid rgba(10, 132, 255, 0.3)',
                color: '#0A84FF',
              }}
            >
              <span>PROBING:</span>
              <span className="font-bold">{step}/3</span>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
            style={{
              background: 'rgba(10, 132, 255, 0.08)',
              border: '1px solid rgba(10, 132, 255, 0.25)',
              color: '#0A84FF',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
            <span className="hidden sm:inline">NEXUS ONLINE</span>
          </div>
        </div>
      </header>

      {/* ── Main Content Container ── */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-0 relative">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════
              STEP 0: ASK QUESTION
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 0 && (
            <motion.div
              key="step-0"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-xl flex flex-col items-center text-center py-6 md:py-10"
            >
              <div className="mb-4">
                <span className="text-[11px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full bg-blue-500/10 border border-blue-500/30 text-blue-300 shadow-[0_0_20px_rgba(10,132,255,0.2)]">
                  🔮 Omniscient Neural Divination
                </span>
              </div>

              <h1
                className="text-5xl sm:text-6xl md:text-7xl font-black uppercase tracking-tight text-white mb-3"
                style={{
                  textShadow: '0 0 35px rgba(10, 132, 255, 0.7), 0 0 70px rgba(10, 132, 255, 0.3)',
                }}
              >
                THE ORACLE
              </h1>

              <p className="text-base sm:text-lg text-white/70 max-w-md leading-relaxed mb-8">
                Dare you gaze into the quantum stream? Speak your inquiry and prepare for ruthless, unvarnished truth.
              </p>

              {/* Consultation Form */}
              <form
                onSubmit={handleStartConsultation}
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl flex flex-col items-center gap-5 shadow-2xl relative"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(10, 132, 255, 0.3)',
                  boxShadow: '0 0 50px rgba(10, 132, 255, 0.1)',
                }}
              >
                <div className="w-full flex flex-col items-start gap-2">
                  <label htmlFor="user-q" className="text-xs font-mono uppercase tracking-wider text-white/50">
                    What do you seek to know?
                  </label>
                  <input
                    id="user-q"
                    type="text"
                    value={currentInput}
                    onChange={(e) => {
                      setCurrentInput(e.target.value)
                      setErrorMsg(null)
                    }}
                    placeholder="e.g. Will I pass my exam?"
                    maxLength={150}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-400 rounded-2xl px-5 py-4 text-base sm:text-lg text-white placeholder-white/20 outline-none transition-all shadow-inner"
                    autoFocus
                  />
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
                  disabled={!currentInput.trim()}
                  className="w-full py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest text-black bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 shadow-[0_0_30px_rgba(10,132,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>CONSULT THE ORACLE</span>
                  <span>✨</span>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEPS 1-3: CANNED PROBING QUESTIONS
          ═══════════════════════════════════════════════════════════════════ */}
          {step >= 1 && step <= 3 && (
            <motion.div
              key={`step-${step}`}
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl flex flex-col items-center gap-6 py-4"
            >
              {/* Question Card */}
              <div
                className="w-full p-8 sm:p-10 rounded-3xl border backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(10, 132, 255, 0.08) 0%, rgba(10, 15, 25, 0.85) 100%)',
                  borderColor: 'rgba(10, 132, 255, 0.35)',
                  boxShadow: '0 0 60px rgba(10, 132, 255, 0.15)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                  <span className="text-[11px] font-mono uppercase tracking-widest text-blue-300 font-bold">
                    Probing Query {step} of 3
                  </span>
                </div>

                <h2
                  className="text-2xl sm:text-3xl font-black text-white leading-tight mb-2"
                  style={{
                    textShadow: '0 0 20px rgba(10, 132, 255, 0.4)',
                  }}
                >
                  &ldquo;{CANNED_QUESTIONS[step - 1]}&rdquo;
                </h2>

                <p className="text-xs text-white/40 font-mono">
                  The Oracle requires complete candor to calibrate probabilities.
                </p>
              </div>

              {/* User Answer Form */}
              <form
                onSubmit={handleAnswerStep}
                className="w-full p-6 rounded-3xl border backdrop-blur-2xl flex flex-col items-center gap-4 bg-white/[0.02] border-white/10 shadow-xl"
              >
                <div className="w-full">
                  <input
                    type="text"
                    value={currentInput}
                    onChange={(e) => {
                      setCurrentInput(e.target.value)
                      setErrorMsg(null)
                    }}
                    placeholder="Enter your candid response..."
                    maxLength={150}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-400 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 outline-none transition-all shadow-inner"
                    autoFocus
                  />
                </div>

                {errorMsg && (
                  <p className="text-xs font-mono text-red-400 text-center animate-shake">
                    {errorMsg}
                  </p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={!currentInput.trim()}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 shadow-[0_0_25px_rgba(10,132,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>{step === 3 ? 'DELIVER TO FATE' : 'NEXT'}</span>
                  <span>{step === 3 ? '⚡' : '→'}</span>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 4: LOADING / CONSULTING ORACLE
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 4 && (
            <motion.div
              key="step-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 py-20 text-center"
            >
              <LoadingOrb size={96} color="#0A84FF" />
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-black tracking-wider text-blue-300 uppercase">
                  Reading the threads of fate...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Synthesizing quantum variables &amp; behavioral probabilities
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 5: VERDICT
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 5 && verdictData && (
            <motion.div
              key="step-5"
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="w-full max-w-xl p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative"
              style={{
                background: 'rgba(10, 15, 25, 0.95)',
                borderColor: getPercentageTheme(verdictData.percentage).color + '66',
                boxShadow: `0 0 80px ${getPercentageTheme(verdictData.percentage).shadow}33`,
              }}
            >
              {/* Badge */}
              <div className="mb-4">
                <span
                  className={`text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full border ${
                    getPercentageTheme(verdictData.percentage).badge
                  }`}
                >
                  {getPercentageTheme(verdictData.percentage).label}
                </span>
              </div>

              {/* Inquiry Label */}
              <p className="text-xs uppercase font-mono tracking-wider text-white/40 mb-1">
                Calculated Probability of Success
              </p>

              {/* Massive Neon Percentage */}
              <div className="py-2 my-2">
                <motion.span
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: 'spring', damping: 15, delay: 0.1 }}
                  className="text-8xl sm:text-9xl font-black font-mono tracking-tight"
                  style={{
                    color: getPercentageTheme(verdictData.percentage).color,
                    textShadow: `0 0 45px ${getPercentageTheme(verdictData.percentage).shadow}`,
                  }}
                >
                  {verdictData.percentage}%
                </motion.span>
              </div>

              {/* Typewriter Verdict Container */}
              <div
                className="w-full min-h-[90px] p-5 rounded-2xl mb-8 border flex items-center justify-center text-center"
                style={{
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderColor: 'rgba(255, 255, 255, 0.08)',
                }}
              >
                <p className="text-sm sm:text-base text-white/90 leading-relaxed font-sans font-medium">
                  &ldquo;{displayedVerdict}&rdquo;
                  {displayedVerdict.length < verdictData.verdict.length && (
                    <span className="inline-block w-2 h-4 ml-1 bg-blue-400 animate-pulse" />
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-3.5 px-8 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 shadow-[0_0_25px_rgba(10,132,255,0.4)] transition-all cursor-pointer"
                >
                  Ask Again ↻
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

export default Oracle
