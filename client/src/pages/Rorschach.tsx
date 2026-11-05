import { useState, useEffect, type FormEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export function Rorschach() {
  const [gameState, setGameState] = useState<'blot' | 'loading' | 'reveal'>('blot')
  const [userWord, setUserWord] = useState<string>('')
  const [analysis, setAnalysis] = useState<string>('')
  const [displayedAnalysis, setDisplayedAnalysis] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Typewriter effect in reveal state
  useEffect(() => {
    if (gameState === 'reveal' && analysis) {
      setDisplayedAnalysis('')
      let i = 0
      const timer = setInterval(() => {
        i++
        setDisplayedAnalysis(analysis.slice(0, i))
        if (i >= analysis.length) {
          clearInterval(timer)
        }
      }, 22)
      return () => clearInterval(timer)
    }
  }, [gameState, analysis])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    const trimmed = userWord.trim()
    if (!trimmed) {
      setErrorMsg('Give voice to what your eyes discern in the chaos.')
      return
    }

    setErrorMsg(null)
    setGameState('loading')

    try {
      const res = await fetch('http://localhost:10000/api/games/rorschach/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userWord: trimmed.slice(0, 20) }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      setAnalysis(
        data.analysis ||
          `Perceiving '${trimmed}' reveals an inner compass searching for symmetry amidst uncertainty. Your mind molds abstract geometry into familiar sanctuary.`
      )
      setGameState('reveal')
    } catch (err) {
      console.warn('Backend unavailable or rate limited, using introspective fallback:', err)
      setAnalysis(
        `Perceiving '${trimmed}' reveals an inner compass drawn toward structure amidst uncertainty. You project form onto the void as a silent testament to your creative vigilance.`
      )
      setGameState('reveal')
    }
  }

  const handleReset = () => {
    setUserWord('')
    setAnalysis('')
    setDisplayedAnalysis('')
    setErrorMsg(null)
    setGameState('blot')
  }

  // Animation cycle speed based on state
  const morphDuration = gameState === 'loading' ? 2.5 : gameState === 'reveal' ? 4.5 : 7

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-5xl mx-auto overflow-hidden">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-2 border-b border-white/10 z-20">
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
              <span className="w-2 h-2 rounded-full bg-pink-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-pink-300">
                The Rorschach
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-pink-500/15 border border-pink-500/30 text-pink-300">
                Neural Inkblot
              </span>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide hidden sm:block">
              One shape. Boundless subconscious projections.
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
          style={{
            background: 'rgba(255, 55, 95, 0.08)',
            border: '1px solid rgba(255, 55, 95, 0.25)',
            color: '#FF375F',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-pink-400 animate-ping" />
          <span className="hidden sm:inline">SYNAPSE ACTIVE</span>
        </div>
      </header>

      {/* ── Main Canvas Area ── */}
      <main className="flex-1 flex flex-col items-center justify-center relative min-h-[580px]">
        {/* ═══════════════════════════════════════════════════════════════════
            THE MORPHING SYMMETRICAL NEON INKBLOT
        ═══════════════════════════════════════════════════════════════════ */}
        <div
          className={`relative flex items-center justify-center transition-all duration-700 pointer-events-none select-none ${
            gameState === 'reveal'
              ? 'scale-75 md:scale-90 opacity-40 blur-[1px]'
              : 'scale-90 sm:scale-100 md:scale-110 opacity-95'
          }`}
          style={{ width: '380px', height: '360px' }}
        >
          {/* Ambient Glow Aura */}
          <motion.div
            animate={{
              scale: [0.95, 1.15, 0.95],
              opacity: [0.35, 0.65, 0.35],
            }}
            transition={{
              duration: morphDuration,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
            className="absolute inset-0 rounded-full blur-3xl pointer-events-none"
            style={{
              background: 'radial-gradient(circle, rgba(0, 245, 255, 0.3) 0%, rgba(191, 90, 242, 0.35) 45%, rgba(255, 55, 95, 0.2) 80%, transparent 100%)',
            }}
          />

          {/* Central Symmetrical Inkblot Wings */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* ── Left Wing Half ── */}
            <div className="absolute right-1/2 w-44 h-72 flex items-center justify-end origin-right overflow-visible">
              <MorphWing duration={morphDuration} isRight={false} />
            </div>

            {/* ── Right Wing Half (Horizontally Mirrored) ── */}
            <div
              className="absolute left-1/2 w-44 h-72 flex items-center justify-start origin-left overflow-visible"
              style={{ transform: 'scaleX(-1)' }}
            >
              <MorphWing duration={morphDuration} isRight={true} />
            </div>

            {/* Central Vertical Spine / Nucleus */}
            <motion.div
              animate={{
                scaleY: [0.85, 1.1, 0.9, 1.15, 0.85],
                scaleX: [0.9, 1.25, 0.85, 1.2, 0.9],
                borderRadius: [
                  '40% 40% 50% 50% / 60% 60% 40% 40%',
                  '50% 50% 40% 40% / 40% 40% 60% 60%',
                  '40% 40% 50% 50% / 60% 60% 40% 40%',
                ],
              }}
              transition={{
                duration: morphDuration * 0.8,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
              className="absolute z-10 w-9 h-48 rounded-full"
              style={{
                background: 'linear-gradient(180deg, #00F5FF 0%, #BF5AF2 50%, #FF375F 100%)',
                boxShadow: '0 0 25px rgba(0, 245, 255, 0.8), 0 0 45px rgba(191, 90, 242, 0.6)',
              }}
            />
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════════════
            DYNAMIC INTERACTION OVERLAYS (BLOT / LOADING / REVEAL)
        ═══════════════════════════════════════════════════════════════════ */}
        <AnimatePresence mode="wait">
          {/* ── STATE 1: BLOT & INPUT FORM ── */}
          {gameState === 'blot' && (
            <motion.div
              key="blot-form"
              initial={{ opacity: 0, y: 18 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -18 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-md flex flex-col items-center text-center mt-6 z-10 px-4"
            >
              <h2
                className="text-3xl sm:text-4xl md:text-5xl font-black uppercase tracking-tight text-white mb-2"
                style={{
                  textShadow: '0 0 25px rgba(0, 245, 255, 0.6), 0 0 50px rgba(191, 90, 242, 0.4)',
                }}
              >
                THE RORSCHACH
              </h2>

              <p className="text-sm sm:text-base text-white/70 font-mono mb-6 tracking-wide">
                What does your mind construct from the void?
              </p>

              {/* Input Form */}
              <form
                onSubmit={handleSubmit}
                className="w-full p-4 sm:p-6 rounded-3xl border backdrop-blur-2xl flex flex-col items-center gap-4 shadow-2xl relative"
                style={{
                  background: 'rgba(15, 10, 25, 0.75)',
                  borderColor: 'rgba(0, 245, 255, 0.3)',
                  boxShadow: '0 0 45px rgba(0, 245, 255, 0.15)',
                }}
              >
                <div className="w-full relative">
                  <input
                    type="text"
                    value={userWord}
                    onChange={(e) => {
                      setUserWord(e.target.value.slice(0, 20))
                      setErrorMsg(null)
                    }}
                    placeholder="e.g. a butterfly, two masks..."
                    maxLength={20}
                    className="w-full bg-white/[0.04] border border-white/15 focus:border-cyan-400 rounded-2xl px-5 py-3.5 text-base sm:text-lg text-white placeholder-white/25 outline-none transition-all shadow-inner text-center font-mono"
                    autoFocus
                  />
                  <span className="absolute right-3.5 bottom-3 text-[10px] font-mono text-white/30">
                    {userWord.length}/20
                  </span>
                </div>

                {errorMsg && (
                  <p className="text-xs font-mono text-pink-400 text-center animate-shake">
                    {errorMsg}
                  </p>
                )}

                <motion.button
                  whileHover={{ scale: 1.02, y: -2 }}
                  whileTap={{ scale: 0.98 }}
                  type="submit"
                  disabled={!userWord.trim()}
                  className="w-full py-4 px-6 rounded-2xl font-black text-xs uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 hover:from-cyan-300 hover:to-pink-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] disabled:opacity-35 disabled:cursor-not-allowed transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <span>REVEAL SUBCONSCIOUS</span>
                  <span>🔮</span>
                </motion.button>
              </form>
            </motion.div>
          )}

          {/* ── STATE 2: LOADING ORB ── */}
          {gameState === 'loading' && (
            <motion.div
              key="loading-orb"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 flex flex-col items-center justify-center gap-5 z-20"
            >
              <LoadingOrb size={96} color="#00F5FF" />
              <div className="flex flex-col items-center gap-1">
                <p className="text-lg font-black tracking-widest text-cyan-300 uppercase animate-pulse">
                  Probing subconscious projection...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-wider">
                  Deciphering &ldquo;{userWord}&rdquo; through neural psychoanalysis
                </p>
              </div>
            </motion.div>
          )}

          {/* ── STATE 3: REVEAL ANALYSIS ── */}
          {gameState === 'reveal' && (
            <motion.div
              key="reveal-card"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ type: 'spring', damping: 20, stiffness: 180 }}
              className="w-full max-w-xl p-8 sm:p-10 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative z-20 my-4"
              style={{
                background: 'rgba(12, 10, 22, 0.88)',
                borderColor: 'rgba(191, 90, 242, 0.4)',
                boxShadow: '0 0 70px rgba(191, 90, 242, 0.25), inset 0 0 35px rgba(0, 245, 255, 0.1)',
              }}
            >
              {/* Badge */}
              <div className="mb-3">
                <span className="text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full border bg-purple-500/20 text-purple-300 border-purple-500/40">
                  Subconscious Archetype
                </span>
              </div>

              {/* Perceived Anchor */}
              <p className="text-xs uppercase font-mono tracking-wider text-white/40 mb-1">
                You perceived
              </p>
              <h3
                className="text-2xl sm:text-3xl font-black font-mono tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 via-fuchsia-300 to-pink-400 mb-6 drop-shadow-[0_0_20px_rgba(0,245,255,0.6)]"
              >
                &ldquo;{userWord}&rdquo;
              </h3>

              {/* Analysis Text in Glass Card */}
              <div
                className="w-full min-h-[110px] p-6 rounded-2xl mb-8 border flex items-center justify-center text-center shadow-inner"
                style={{
                  background: 'rgba(255, 255, 255, 0.03)',
                  borderColor: 'rgba(255, 255, 255, 0.1)',
                }}
              >
                <p className="text-base sm:text-lg text-white/95 leading-relaxed font-sans font-medium">
                  &ldquo;{displayedAnalysis}&rdquo;
                  {displayedAnalysis.length < analysis.length && (
                    <span className="inline-block w-2 h-4 ml-1.5 bg-cyan-400 animate-pulse" />
                  )}
                </p>
              </div>

              {/* Actions */}
              <div className="w-full flex items-center justify-center gap-4 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={handleReset}
                  className="py-3.5 px-8 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 via-purple-300 to-pink-400 hover:from-cyan-300 hover:to-pink-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] transition-all cursor-pointer"
                >
                  Look Again ↻
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

/**
 * ── Subcomponent: MorphWing ──────────────────────────────────────────────────
 * Creates layered, organic, constantly breathing blobs that morph through fluid
 * border-radius keyframes. Mirrored across the axis to yield authentic Rorschach symmetry.
 */
function MorphWing({ duration }: { duration: number; isRight: boolean }) {
  return (
    <div className="relative w-full h-full flex items-center justify-end">
      {/* Primary Wing Body */}
      <motion.div
        animate={{
          borderRadius: [
            '45% 55% 70% 30% / 40% 65% 35% 60%',
            '65% 35% 35% 65% / 55% 35% 65% 45%',
            '30% 70% 60% 40% / 60% 30% 70% 40%',
            '55% 45% 40% 60% / 35% 70% 30% 65%',
            '45% 55% 70% 30% / 40% 65% 35% 60%',
          ],
          scale: [1, 1.06, 0.96, 1.04, 1],
          rotate: [0, 2.5, -2, 1.5, 0],
        }}
        transition={{
          duration,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-36 h-60 rounded-full"
        style={{
          background: 'radial-gradient(ellipse at 35% 45%, rgba(0, 245, 255, 0.95) 0%, rgba(191, 90, 242, 0.85) 45%, rgba(18, 10, 30, 0.95) 85%, transparent 100%)',
          boxShadow: '0 0 35px rgba(0, 245, 255, 0.65), 0 0 75px rgba(191, 90, 242, 0.45), inset 0 0 30px rgba(0, 245, 255, 0.5)',
        }}
      />

      {/* Secondary Upper Tendril */}
      <motion.div
        animate={{
          borderRadius: [
            '60% 40% 50% 50% / 30% 60% 40% 70%',
            '40% 60% 70% 30% / 70% 30% 60% 40%',
            '50% 50% 40% 60% / 40% 70% 30% 60%',
            '60% 40% 50% 50% / 30% 60% 40% 70%',
          ],
          scale: [0.95, 1.1, 0.92, 1.05, 0.95],
          x: [0, -8, 4, -4, 0],
          y: [-25, -35, -20, -30, -25],
        }}
        transition={{
          duration: duration * 1.15,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-28 h-36 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(191, 90, 242, 0.9) 0%, rgba(255, 55, 95, 0.75) 60%, transparent 100%)',
          boxShadow: '0 0 30px rgba(191, 90, 242, 0.6), 0 0 60px rgba(255, 55, 95, 0.35)',
        }}
      />

      {/* Lower Lateral Flange */}
      <motion.div
        animate={{
          borderRadius: [
            '35% 65% 55% 45% / 55% 35% 65% 45%',
            '55% 45% 35% 65% / 45% 65% 35% 55%',
            '45% 55% 65% 35% / 65% 45% 55% 35%',
            '35% 65% 55% 45% / 55% 35% 65% 45%',
          ],
          scale: [1, 0.92, 1.08, 0.95, 1],
          x: [-10, -18, -6, -14, -10],
          y: [30, 40, 25, 35, 30],
        }}
        transition={{
          duration: duration * 0.9,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute w-28 h-32 rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(0, 245, 255, 0.8) 0%, rgba(191, 90, 242, 0.65) 60%, transparent 100%)',
          boxShadow: '0 0 25px rgba(0, 245, 255, 0.55), 0 0 50px rgba(191, 90, 242, 0.35)',
        }}
      />
    </div>
  )
}

export default Rorschach
