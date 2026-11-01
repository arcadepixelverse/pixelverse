import { useState, useEffect, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface VerdictData {
  percentage: number
  verdict: string
}

export interface OracleMessage {
  role: 'oracle' | 'user'
  message: string
}

export function Oracle() {
  const [step, setStep] = useState<number>(0) // 0 = Goal Input, 1 = Dynamic Probing Chat, 2 = Verdict Screen
  const [goal, setGoal] = useState<string>('')
  const [currentInput, setCurrentInput] = useState<string>('')
  const [currentQuestion, setCurrentQuestion] = useState<string>('')
  const [history, setHistory] = useState<OracleMessage[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [verdictData, setVerdictData] = useState<VerdictData | null>(null)
  const [displayedVerdict, setDisplayedVerdict] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // ── Typewriter effect for step 2 verdict ──
  useEffect(() => {
    if (step === 2 && verdictData?.verdict) {
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

  // Count how many questions Oracle has asked so far (1 to 3)
  const questionCount = Math.min(
    3,
    Math.max(1, history.filter((h) => h.role === 'oracle').length)
  )

  // ── Step 0: Submit goal and retrieve first dynamic question ──
  const handleStartConsultation = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = currentInput.trim()
    if (!trimmed) {
      setErrorMsg('Ask the Oracle what you seek to achieve.')
      return
    }

    setGoal(trimmed)
    setCurrentInput('')
    setErrorMsg(null)
    setIsLoading(true)

    try {
      const res = await fetch('http://localhost:10000/api/games/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal: trimmed,
          history: [],
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      const firstQ = data.message || 'What tangible sacrifice have you genuinely made in the last seven days to advance this ambition?'
      setCurrentQuestion(firstQ)
      setHistory([{ role: 'oracle', message: firstQ }])
      setStep(1)
    } catch (err: any) {
      console.warn('Backend unavailable, using simulated oracle consultation:', err)
      const offlineQ = 'What tangible sacrifice have you genuinely made in the last seven days to advance this ambition?'
      setCurrentQuestion(offlineQ)
      setHistory([{ role: 'oracle', message: offlineQ }])
      setStep(1)
    } finally {
      setIsLoading(false)
    }
  }

  // ── Step 1: Submit answer to current dynamic question ──
  const handleAnswerStep = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = currentInput.trim()
    if (!trimmed) {
      setErrorMsg('The Oracle demands an answer. Do not remain silent.')
      return
    }

    const updatedHistory: OracleMessage[] = [
      ...history,
      { role: 'user', message: trimmed },
    ]
    setHistory(updatedHistory)
    setCurrentInput('')
    setErrorMsg(null)
    setIsLoading(true)

    try {
      const res = await fetch('http://localhost:10000/api/games/oracle/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          goal,
          history: updatedHistory,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()

      if (data.is_ready) {
        setVerdictData({
          percentage: typeof data.percentage === 'number' ? data.percentage : 50,
          verdict: data.message || 'The threads of fate remain woven in shadow. Your discipline shall determine the outcome.',
        })
        setStep(2)
      } else {
        const nextQ = data.message || 'What is the greatest illusion currently blinding your preparation?'
        setCurrentQuestion(nextQ)
        setHistory([...updatedHistory, { role: 'oracle', message: nextQ }])
      }
    } catch (err: any) {
      console.warn('Backend unavailable, evaluating dynamic fallback:', err)
      const askedCount = updatedHistory.filter((h) => h.role === 'oracle').length
      if (askedCount >= 3) {
        // Fallback to verdict
        const userAnswers = updatedHistory
          .filter((h) => h.role === 'user')
          .map((h) => h.message)
          .join(' ')
          .toLowerCase()

        let simulatedPercentage = 44
        if (userAnswers.includes('many') || userAnswers.includes('yes') || userAnswers.includes('hard') || userAnswers.includes('daily')) {
          simulatedPercentage = 78
        } else if (userAnswers.includes('zero') || userAnswers.includes('phone') || userAnswers.includes('procrastinat') || userAnswers.includes('no')) {
          simulatedPercentage = 23
        }

        setVerdictData({
          percentage: simulatedPercentage,
          verdict:
            simulatedPercentage > 50
              ? 'The nexus of destiny leans toward your triumph, yet complacency will fracture it. Eliminate your final hesitation and claim what you sought.'
              : 'Your conviction is compromised by the distractions you readily harbor. Until discipline replaces your excuses, failure remains your mathematical certainty.',
        })
        setStep(2)
      } else {
        const fallbackQuestions = [
          'What tangible sacrifice have you genuinely made in the last seven days to advance this ambition?',
          'Are you being completely honest with yourself regarding your work ethic, or is this wishful thinking?',
          'When self-doubt and distraction tempt you, what specific defense prevents you from quitting?',
        ]
        const nextQ = fallbackQuestions[askedCount] || 'What is the greatest illusion currently blinding your preparation?'
        setCurrentQuestion(nextQ)
        setHistory([...updatedHistory, { role: 'oracle', message: nextQ }])
      }
    } finally {
      setIsLoading(false)
    }
  }

  // ── Reset consultation ──
  const handleReset = () => {
    setStep(0)
    setGoal('')
    setHistory([])
    setCurrentInput('')
    setCurrentQuestion('')
    setVerdictData(null)
    setDisplayedVerdict('')
    setErrorMsg(null)
    setIsLoading(false)
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
                Dynamic Neural Seer
              </span>
            </div>
            {step > 0 && goal && (
              <p className="text-[11px] text-white/40 tracking-wide line-clamp-1 max-w-sm sm:max-w-md">
                Goal: <span className="font-mono text-white/80 font-medium">&ldquo;{goal}&rdquo;</span>
              </p>
            )}
          </div>
        </div>

        {/* Status indicator */}
        <div className="flex items-center gap-2">
          {step === 1 && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
              style={{
                background: 'rgba(10, 132, 255, 0.1)',
                border: '1px solid rgba(10, 132, 255, 0.3)',
                color: '#0A84FF',
              }}
            >
              <span>PROBING:</span>
              <span className="font-bold">{questionCount}/3</span>
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
              STEP 0: ASK GOAL / INQUIRY
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
                  🔮 Dynamic Neural Divination
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
                Speak your goal. The Oracle will probe your conviction with 3 ruthless questions before passing judgment.
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
                  <label htmlFor="user-goal" className="text-xs font-mono uppercase tracking-wider text-white/50">
                    What is your ambition or goal?
                  </label>
                  <input
                    id="user-goal"
                    type="text"
                    value={currentInput}
                    onChange={(e) => {
                      setCurrentInput(e.target.value)
                      setErrorMsg(null)
                    }}
                    placeholder="e.g. Launch my AI startup this month"
                    maxLength={150}
                    disabled={isLoading}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-400 rounded-2xl px-5 py-4 text-base sm:text-lg text-white placeholder-white/20 outline-none transition-all shadow-inner disabled:opacity-50"
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
                  disabled={!currentInput.trim() || isLoading}
                  className="w-full py-4 px-8 rounded-2xl font-black text-xs uppercase tracking-widest text-black bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 shadow-[0_0_30px_rgba(10,132,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <LoadingOrb size={20} color="#000000" />
                      <span>INITIALIZING NEXUS...</span>
                    </div>
                  ) : (
                    <>
                      <span>CONSULT THE ORACLE</span>
                      <span>✨</span>
                    </>
                  )}
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 1: DYNAMIC PROBING CHAT
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 1 && (
            <motion.div
              key="step-1"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.3 }}
              className="w-full max-w-xl flex flex-col items-center gap-6 py-4"
            >
              {/* Question Card */}
              <div
                className="w-full min-h-[220px] p-8 sm:p-10 rounded-3xl border backdrop-blur-2xl flex flex-col items-center justify-center text-center relative overflow-hidden shadow-2xl transition-all"
                style={{
                  background: 'linear-gradient(180deg, rgba(10, 132, 255, 0.08) 0%, rgba(10, 15, 25, 0.85) 100%)',
                  borderColor: 'rgba(10, 132, 255, 0.35)',
                  boxShadow: '0 0 60px rgba(10, 132, 255, 0.15)',
                }}
              >
                {isLoading ? (
                  <div className="flex flex-col items-center gap-4 py-4">
                    <LoadingOrb size={72} color="#0A84FF" />
                    <p className="text-xs font-mono text-blue-300 uppercase tracking-widest animate-pulse">
                      The Oracle is scrutinizing your soul...
                    </p>
                  </div>
                ) : (
                  <motion.div
                    key={currentQuestion}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="flex flex-col items-center"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-ping" />
                      <span className="text-[11px] font-mono uppercase tracking-widest text-blue-300 font-bold">
                        Probing Query {questionCount} of 3
                      </span>
                    </div>

                    <h2
                      className="text-2xl sm:text-3xl font-black text-white leading-tight mb-3"
                      style={{
                        textShadow: '0 0 20px rgba(10, 132, 255, 0.4)',
                      }}
                    >
                      &ldquo;{currentQuestion}&rdquo;
                    </h2>

                    <p className="text-xs text-white/40 font-mono">
                      Answer with surgical honesty. The Oracle detects rationalization.
                    </p>
                  </motion.div>
                )}
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
                    maxLength={200}
                    disabled={isLoading}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-blue-400 rounded-2xl px-5 py-4 text-base text-white placeholder-white/25 outline-none transition-all shadow-inner disabled:opacity-50"
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
                  disabled={!currentInput.trim() || isLoading}
                  className="w-full py-4 px-6 rounded-2xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-blue-400 via-cyan-400 to-indigo-400 hover:from-blue-300 hover:to-indigo-300 shadow-[0_0_25px_rgba(10,132,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <div className="flex items-center gap-2">
                      <LoadingOrb size={18} color="#000000" />
                      <span>EVALUATING CONVICTION...</span>
                    </div>
                  ) : (
                    <>
                      <span>{questionCount === 3 ? 'DELIVER TO FATE' : 'CONFIRM ANSWER'}</span>
                      <span>{questionCount === 3 ? '⚡' : '→'}</span>
                    </>
                  )}
                </motion.button>
              </form>

              {/* History Preview */}
              {history.length > 1 && (
                <div className="w-full p-4 rounded-2xl border border-white/5 bg-white/[0.015] backdrop-blur-md">
                  <div className="flex items-center justify-between pb-2 mb-2 border-b border-white/5 text-[10px] font-mono text-white/40 uppercase tracking-wider">
                    <span>Prior Exchanges</span>
                    <span>{history.length} events</span>
                  </div>
                  <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                    {history.map((h, i) => (
                      <div
                        key={i}
                        className={`text-xs font-mono py-1 px-2.5 rounded-lg ${
                          h.role === 'oracle'
                            ? 'bg-blue-500/10 text-blue-300 border border-blue-500/20'
                            : 'bg-white/[0.03] text-white/70'
                        }`}
                      >
                        <span className="font-bold mr-1.5 uppercase text-[10px]">
                          {h.role === 'oracle' ? 'Oracle:' : 'You:'}
                        </span>
                        <span>{h.message}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STEP 2: VERDICT
          ═══════════════════════════════════════════════════════════════════ */}
          {step === 2 && verdictData && (
            <motion.div
              key="step-2"
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
