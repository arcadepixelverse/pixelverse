import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'
import { apiFetch } from '../lib/apiClient'

export type WingmanMode = 'roast' | 'convo'
export type WingmanState = 'idle' | 'loading' | 'reveal'

interface ModeTheme {
  primary: string
  secondary: string
  accent: string
  gradient: string
  glowColor: string
  borderColor: string
  tagline: string
  placeholder: string
  buttonText: string
  badgeText: string
  icon: string
  examples: string[]
}

const THEMES: Record<WingmanMode, ModeTheme> = {
  roast: {
    primary: '#FF453A',
    secondary: '#FF9F0A',
    accent: '#FF3B30',
    gradient: 'from-red-600 via-orange-500 to-amber-500',
    glowColor: 'rgba(255, 69, 58, 0.35)',
    borderColor: 'rgba(255, 69, 58, 0.3)',
    tagline: 'Brutal, playful roasts that leave a mark.',
    placeholder: 'Type a bad habit, weird opinion, or recent fail...',
    buttonText: 'ROAST ME',
    badgeText: '🔥 Roast Mode',
    icon: '🔥',
    examples: [
      'I pour milk before cereal and microwave it',
      'I spent 4 hours organizing my desktop folders instead of studying',
      'I bought gym clothes 3 months ago and haven\'t visited once',
    ],
  },
  convo: {
    primary: '#00F5FF',
    secondary: '#007AFF',
    accent: '#38BDF8',
    gradient: 'from-cyan-400 via-sky-500 to-blue-600',
    glowColor: 'rgba(0, 245, 255, 0.35)',
    borderColor: 'rgba(0, 245, 255, 0.3)',
    tagline: 'Charismatic icebreakers for any social situation.',
    placeholder: "Type your awkward situation (e.g., 'Stuck in an elevator with my boss')...",
    buttonText: 'GIVE ME AN ICEBREAKER',
    badgeText: '💬 Convo Mode',
    icon: '💬',
    examples: [
      'Stuck in an elevator with my boss on Monday morning',
      'First date and there is an awkward silence after ordering',
      'Standing by the punch bowl alone at a mutual friend\'s party',
    ],
  },
}

function TypewriterText({ text, speed = 16 }: { text: string; speed?: number }) {
  const [displayedText, setDisplayedText] = useState('')
  const [isFinished, setIsFinished] = useState(false)

  useEffect(() => {
    let index = 0
    setDisplayedText('')
    setIsFinished(false)

    const timer = setInterval(() => {
      index++
      setDisplayedText(text.slice(0, index))
      if (index >= text.length) {
        clearInterval(timer)
        setIsFinished(true)
      }
    }, speed)

    return () => clearInterval(timer)
  }, [text, speed])

  return (
    <div className="whitespace-pre-wrap leading-relaxed font-sans text-base sm:text-lg text-white/95">
      {displayedText}
      {!isFinished && (
        <span className="inline-block w-2 h-5 ml-1 bg-current animate-pulse align-middle" />
      )}
    </div>
  )
}

export function Wingman() {
  const [mode, setMode] = useState<WingmanMode>('roast')
  const [input, setInput] = useState('')
  const [result, setResult] = useState('')
  const [gameState, setGameState] = useState<WingmanState>('idle')
  const [errorMsg, setErrorMsg] = useState('')

  const theme = THEMES[mode]

  const handleModeSwitch = (newMode: WingmanMode) => {
    if (newMode === mode) return
    setMode(newMode)
    setErrorMsg('')
    if (gameState === 'reveal') {
      setGameState('idle')
      setResult('')
    }
  }

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = input.trim()
    if (!trimmed || gameState === 'loading') return

    setErrorMsg('')
    setGameState('loading')

    try {
      const res = await apiFetch('http://localhost:10000/api/games/wingman/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode, input: trimmed }),
      })

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }

      const data = await res.json()
      if (data && typeof data.output === 'string') {
        setResult(data.output.trim())
        setGameState('reveal')
      } else {
        throw new Error('Invalid response structure from server.')
      }
    } catch (err: any) {
      console.warn('[Wingman] API request failed, using emergency fallback:', err)
      if (mode === 'roast') {
        setResult(
          `I've seen dial-up connections with better timing and self-awareness than '${trimmed}'. Even your autocorrect gave up trying to fix that disaster of a situation. But hey, at least you're consistent at making questionable life choices.`
        )
      } else {
        setResult(
          `1. "Well, this definitely beats whatever small talk the weather was going to give us."\n2. "Quick question: on a scale of 1 to 10, how awkward are we contractually obligated to feel right now?"\n3. "If anyone asks, we planned this exact moment for dramatic effect."`
        )
      }
      setGameState('reveal')
    }
  }

  const handleReset = () => {
    setGameState('idle')
    setInput('')
    setResult('')
    setErrorMsg('')
  }

  return (
    <div className="relative min-h-screen w-full bg-[#08080E] text-white flex flex-col font-sans select-none overflow-x-hidden">
      {/* ── Background Ambience ────────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
        <div
          className="absolute -top-[15%] left-1/2 -translate-x-1/2 w-[650px] h-[650px] rounded-full blur-[140px] opacity-25 transition-all duration-700"
          style={{ background: theme.primary }}
        />
        <div
          className="absolute -bottom-[20%] right-[10%] w-[550px] h-[550px] rounded-full blur-[150px] opacity-20 transition-all duration-700"
          style={{ background: theme.secondary }}
        />
        <div
          className="absolute inset-0 opacity-[0.03]"
          style={{
            backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)`,
            backgroundSize: '40px 40px',
          }}
        />
      </div>

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="relative z-20 w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Arcade</span>
          </Link>

          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center text-sm transition-colors duration-500 shadow-md"
              style={{
                background: `${theme.primary}22`,
                borderColor: theme.borderColor,
                borderWidth: '1px',
                color: theme.primary,
              }}
            >
              🕶️
            </div>
            <div>
              <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white">
                THE WINGMAN
              </h1>
              <p className="text-[11px] text-white/40 tracking-wide font-normal">
                {theme.tagline}
              </p>
            </div>
          </div>
        </div>

        {/* Current Mode Badge */}
        <div
          className="px-3 py-1 rounded-full text-xs font-mono font-bold tracking-wider uppercase border transition-all duration-500"
          style={{
            background: `${theme.primary}18`,
            borderColor: theme.borderColor,
            color: theme.primary,
            boxShadow: `0 0 15px ${theme.glowColor}`,
          }}
        >
          {theme.badgeText}
        </div>
      </header>

      {/* ── Main Content Area ──────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 w-full max-w-2xl mx-auto px-4 py-8 sm:px-6 flex flex-col items-center justify-center min-h-[calc(100vh-80px)]">
        {/* Mode Toggle Bar */}
        <div className="w-full max-w-md p-1.5 mb-8 rounded-2xl bg-white/[0.04] border border-white/10 backdrop-blur-xl flex items-center gap-2 shadow-xl">
          <button
            type="button"
            onClick={() => handleModeSwitch('roast')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'roast'
                ? 'bg-gradient-to-r from-red-600 to-orange-500 text-white shadow-lg'
                : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
            }`}
            style={
              mode === 'roast'
                ? { boxShadow: '0 0 20px rgba(255, 69, 58, 0.4)' }
                : {}
            }
          >
            <span>🔥</span>
            <span>Roast Me</span>
          </button>

          <button
            type="button"
            onClick={() => handleModeSwitch('convo')}
            className={`flex-1 py-2.5 px-4 rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer ${
              mode === 'convo'
                ? 'bg-gradient-to-r from-cyan-500 to-blue-600 text-white shadow-lg'
                : 'text-white/50 hover:text-white hover:bg-white/[0.03]'
            }`}
            style={
              mode === 'convo'
                ? { boxShadow: '0 0 20px rgba(0, 245, 255, 0.4)' }
                : {}
            }
          >
            <span>💬</span>
            <span>Convo Starter</span>
          </button>
        </div>

        {/* Dynamic Card Container */}
        <div className="w-full">
          <AnimatePresence mode="wait">
            {/* ── STATE 1: IDLE ────────────────────────────────────────────── */}
            {gameState === 'idle' && (
              <motion.div
                key={`idle-${mode}`}
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.98 }}
                transition={{ duration: 0.3 }}
                className="w-full rounded-3xl border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden transition-all duration-500"
                style={{
                  background: 'rgba(14, 14, 24, 0.65)',
                  borderColor: theme.borderColor,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.6), inset 0 0 40px ${theme.glowColor}22`,
                }}
              >
                {/* Form Input Header */}
                <div className="mb-4">
                  <div className="flex items-center gap-2 mb-1.5">
                    <span className="text-xl">{theme.icon}</span>
                    <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white">
                      {mode === 'roast' ? 'What should we roast you for?' : 'Describe your awkward situation'}
                    </h2>
                  </div>
                  <p className="text-xs text-white/50 leading-relaxed font-normal">
                    {mode === 'roast'
                      ? 'Be honest. The AI insult comic will not hold back.'
                      : 'The Wingman will craft 3 smooth, customized icebreakers for you.'}
                  </p>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                  <div className="relative">
                    <textarea
                      rows={3}
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      placeholder={theme.placeholder}
                      className="w-full rounded-2xl bg-black/40 border border-white/10 px-4 py-3.5 text-sm sm:text-base text-white placeholder-white/25 focus:outline-none transition-all duration-300 resize-none font-normal"
                      style={{
                        borderColor: input.trim() ? theme.borderColor : 'rgba(255, 255, 255, 0.12)',
                        boxShadow: input.trim() ? `0 0 15px ${theme.glowColor}33` : 'none',
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                          handleSubmit()
                        }
                      }}
                    />
                  </div>

                  {/* Suggestion Chips */}
                  <div className="flex flex-col gap-1.5">
                    <span className="text-[11px] font-mono uppercase tracking-wider text-white/40">
                      Or try an example:
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {theme.examples.map((ex, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setInput(ex)}
                          className="text-left text-xs px-3 py-1.5 rounded-xl border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-white/20 text-white/60 hover:text-white transition-all cursor-pointer truncate max-w-full"
                        >
                          "{ex}"
                        </button>
                      ))}
                    </div>
                  </div>

                  {errorMsg && (
                    <p className="text-xs text-red-400 font-mono">{errorMsg}</p>
                  )}

                  {/* Submit Button */}
                  <button
                    type="submit"
                    disabled={!input.trim()}
                    className={`mt-2 py-4 px-6 rounded-2xl font-black text-sm tracking-widest uppercase transition-all duration-300 cursor-pointer flex items-center justify-center gap-2 shadow-xl ${
                      input.trim()
                        ? 'text-white hover:scale-[1.01] active:scale-[0.99]'
                        : 'text-white/30 bg-white/5 border border-white/5 cursor-not-allowed'
                    }`}
                    style={
                      input.trim()
                        ? {
                            background:
                              mode === 'roast'
                                ? 'linear-gradient(135deg, #FF3B30 0%, #FF9F0A 100%)'
                                : 'linear-gradient(135deg, #00F5FF 0%, #007AFF 100%)',
                            boxShadow: `0 10px 30px ${theme.glowColor}`,
                          }
                        : {}
                    }
                  >
                    <span>{theme.icon}</span>
                    <span>{theme.buttonText}</span>
                    <span>→</span>
                  </button>
                </form>
              </motion.div>
            )}

            {/* ── STATE 2: LOADING ─────────────────────────────────────────── */}
            {gameState === 'loading' && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="w-full rounded-3xl border p-12 backdrop-blur-2xl shadow-2xl flex flex-col items-center justify-center text-center"
                style={{
                  background: 'rgba(14, 14, 24, 0.75)',
                  borderColor: theme.borderColor,
                  boxShadow: `0 20px 60px rgba(0,0,0,0.6), 0 0 50px ${theme.glowColor}`,
                }}
              >
                <LoadingOrb size={96} color={theme.primary} />
                <h3 className="mt-6 text-lg sm:text-xl font-bold tracking-wider uppercase text-white font-mono">
                  Analyzing...
                </h3>
                <p className="mt-1 text-xs text-white/50 max-w-xs font-mono">
                  {mode === 'roast'
                    ? 'Synthesizing lethal comeback radiation...'
                    : 'Crafting socially calibrated conversation starters...'}
                </p>
              </motion.div>
            )}

            {/* ── STATE 3: REVEAL ──────────────────────────────────────────── */}
            {gameState === 'reveal' && (
              <motion.div
                key="reveal"
                initial={{ opacity: 0, y: 20, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -20, scale: 0.98 }}
                className="w-full rounded-3xl border p-6 sm:p-8 backdrop-blur-2xl shadow-2xl relative overflow-hidden transition-all duration-500"
                style={{
                  background: 'rgba(16, 16, 28, 0.85)',
                  borderColor: theme.borderColor,
                  boxShadow: `0 25px 70px rgba(0, 0, 0, 0.7), 0 0 50px ${theme.glowColor}`,
                }}
              >
                {/* Reveal Header */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                  <div className="flex items-center gap-2.5">
                    <span className="text-2xl">{theme.icon}</span>
                    <div>
                      <span className="text-xs font-mono font-bold uppercase tracking-wider text-white/50">
                        {mode === 'roast' ? 'Verdict' : 'Icebreaker Formula'}
                      </span>
                      <h3
                        className="text-base sm:text-lg font-black uppercase tracking-wider"
                        style={{ color: theme.primary }}
                      >
                        {mode === 'roast' ? 'Certified Burn' : 'Social Masterclass'}
                      </h3>
                    </div>
                  </div>

                  <span
                    className="px-3 py-1 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border"
                    style={{
                      background: `${theme.primary}18`,
                      borderColor: theme.borderColor,
                      color: theme.primary,
                    }}
                  >
                    AI Generated
                  </span>
                </div>

                {/* Original Prompt Recapped */}
                <div className="mb-5 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-xs text-white/50 flex items-start gap-2">
                  <span className="font-mono text-white/40 uppercase tracking-wider shrink-0">Subject:</span>
                  <span className="text-white/80 italic line-clamp-2">"{input}"</span>
                </div>

                {/* Typewriter Result Box */}
                <div
                  className="p-5 sm:p-6 rounded-2xl bg-black/40 border border-white/10 shadow-inner mb-6 min-h-[120px] flex items-center"
                  style={{
                    borderColor: `${theme.primary}44`,
                    boxShadow: `inset 0 0 30px ${theme.glowColor}22`,
                  }}
                >
                  <TypewriterText text={result} speed={14} />
                </div>

                {/* Reset Action */}
                <div className="flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={handleReset}
                    className="py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 flex items-center gap-2 cursor-pointer text-white shadow-lg"
                    style={{
                      background:
                        mode === 'roast'
                          ? 'linear-gradient(135deg, #FF3B30 0%, #FF9F0A 100%)'
                          : 'linear-gradient(135deg, #00F5FF 0%, #007AFF 100%)',
                      boxShadow: `0 5px 20px ${theme.glowColor}`,
                    }}
                  >
                    <span>↺</span>
                    <span>Go Again</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
    </div>
  )
}

export default Wingman
