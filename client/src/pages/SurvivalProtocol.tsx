import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface SurvivalResult {
  survived: boolean
  verdict: string
}

const FALLBACK_SCENARIOS = [
  "You are trapped in a locked McDonald's playplace tube slide with three territorial, caffeine-fueled raccoons guarding the only exit.",
  "You are locked overnight in an IKEA display warehouse while an escaped swarm of robotic vacuum cleaners aggressively circles your perimeter.",
  "You are stranded on a rogue conveyor belt inside an automated fulfillment center moving steadily toward an industrial cardboard shredder.",
  "You are stuck inside a malfunctioning glass skyscraper elevator between floors 49 and 50 with a violently short-circuiting robotic barista.",
  "You accidentally boarded a high-speed express train car that has been completely commandeered by 14 territorial Canadian geese.",
  "You are locked inside a Costco cold storage walk-in freezer with a hyperactive animatronic singing snowman that won't stop blaring polka music.",
]

export function SurvivalProtocol() {
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'judging' | 'reveal'>('loading')
  const [scenario, setScenario] = useState<string>('')
  const [items, setItems] = useState<[string, string, string]>(['', '', ''])
  const [result, setResult] = useState<SurvivalResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Fetch initial scenario
  const fetchScenario = async () => {
    setGameState('loading')
    setItems(['', '', ''])
    setResult(null)
    setErrorMsg(null)

    try {
      const res = await fetch('http://localhost:10000/api/games/survival/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      if (data && typeof data.scenario === 'string' && data.scenario.trim()) {
        setScenario(data.scenario.trim())
      } else {
        const fallback = FALLBACK_SCENARIOS[Math.floor(Math.random() * FALLBACK_SCENARIOS.length)]
        setScenario(fallback)
      }
      setGameState('playing')
    } catch (err) {
      console.warn('Backend unavailable or scenario generation failed, using curated scenario:', err)
      const fallback = FALLBACK_SCENARIOS[Math.floor(Math.random() * FALLBACK_SCENARIOS.length)]
      setScenario(fallback)
      setGameState('playing')
    }
  }

  useEffect(() => {
    fetchScenario()
  }, [])

  // Update specific item in array
  const handleItemChange = (index: number, val: string) => {
    setItems((prev) => {
      const next = [...prev] as [string, string, string]
      next[index] = val
      return next
    })
    if (errorMsg) setErrorMsg(null)
  }

  // Submit items to the judge
  const handleSubmitSurvival = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()

    const trimmedItems = items.map((i) => i.trim())
    if (trimmedItems.some((i) => !i)) {
      setErrorMsg('You must equip all 3 survival items before confronting the hazard.')
      return
    }

    setGameState('judging')
    setErrorMsg(null)

    try {
      const res = await fetch('http://localhost:10000/api/games/survival/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario,
          items: trimmedItems,
        }),
      })

      if (!res.ok) {
        throw new Error(`Server returned ${res.status}`)
      }

      const data = await res.json()
      if (data && typeof data.survived === 'boolean' && typeof data.verdict === 'string') {
        setResult({
          survived: data.survived,
          verdict: data.verdict,
        })
      } else {
        setResult({
          survived: false,
          verdict: `You brandished '${trimmedItems[0]}' with immense confidence, but the danger was completely unimpressed. Attempting to combine '${trimmedItems[1]}' and '${trimmedItems[2]}' caused an immediate catastrophic backfire. You perished with dramatic flair, leaving future archaeologists thoroughly confused.`,
        })
      }
      setGameState('reveal')
    } catch (err) {
      console.warn('Backend unavailable, using simulated verdict:', err)
      setResult({
        survived: false,
        verdict: `Your improvised strategy with '${trimmedItems[0]}', '${trimmedItems[1]}', and '${trimmedItems[2]}' defied both physics and common sense. While your creativity was commendable, the laws of nature remained stubbornly unyielding. You succumbed to the hazard in spectacular fashion.`,
      })
      setGameState('reveal')
    }
  }

  const isFormValid = items[0].trim() !== '' && items[1].trim() !== '' && items[2].trim() !== ''

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-4 border-b border-red-500/20">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-red-500/20 hover:border-red-500/40 bg-red-950/20 hover:bg-red-950/40 text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Arcade</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-red-400">
                Survival Protocol
              </h1>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/15 border border-red-500/30 text-red-300">
                Concept Killer
              </span>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide">
              Stateless survival simulation. Outlogic the ruthless AI judge.
            </p>
          </div>
        </div>

        {/* Hazard Level Badge */}
        <div className="flex items-center gap-2 sm:gap-3">
          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-bold uppercase"
            style={{
              background: 'rgba(255, 69, 58, 0.12)',
              border: '1px solid rgba(255, 69, 58, 0.35)',
              color: '#FF453A',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span>BIOHAZARD ACTIVE</span>
          </div>

          <div
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
            style={{
              background: 'rgba(255, 159, 10, 0.08)',
              border: '1px solid rgba(255, 159, 10, 0.25)',
              color: '#FF9F0A',
            }}
          >
            <span>PROTOCOL: 3-ITEMS</span>
          </div>
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-0 relative py-2 sm:py-6">
        <AnimatePresence mode="wait">
          {/* ═══════════════════════════════════════════════════════════════════
              STATE 1: LOADING SCENARIO
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 py-24 text-center"
            >
              <LoadingOrb size={92} color="#FF453A" />
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-black tracking-wider text-red-400 uppercase">
                  Synthesizing Hazard Scenario...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Formulating catastrophic life-or-death environment
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 2: JUDGING EVALUATION
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'judging' && (
            <motion.div
              key="judging"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6 py-24 text-center"
            >
              <LoadingOrb size={92} color="#FF9F0A" />
              <div className="flex flex-col gap-1.5">
                <p className="text-xl font-black tracking-wider text-orange-400 uppercase">
                  The AI Judge is Deliberating...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Calculating physical causality, biological survival odds, and comedy metrics
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 3: PLAYING STATE (SCENARIO & 3 ITEM INPUTS)
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'playing' && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center gap-6"
            >
              {/* Glowing Hazard Card */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 69, 58, 0.08) 0%, rgba(20, 10, 12, 0.9) 100%)',
                  borderColor: 'rgba(255, 69, 58, 0.35)',
                  boxShadow: '0 0 50px rgba(255, 69, 58, 0.15)',
                }}
              >
                {/* Warning Hazard Ribbon */}
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">☣️</span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-bold">
                    SURVIVAL EMERGENCY • LEVEL 5
                  </span>
                  <span className="text-base">☣️</span>
                </div>

                {/* Scenario Text */}
                <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white max-w-2xl leading-snug">
                  &ldquo;{scenario}&rdquo;
                </h2>

                <p className="text-xs text-white/40 uppercase font-mono tracking-wider mt-4">
                  Select exactly 3 everyday items, tools, or concepts. The judge will analyze your survival odds.
                </p>
              </div>

              {/* Items Form */}
              <form
                onSubmit={handleSubmitSurvival}
                className="w-full flex flex-col gap-4 max-w-2xl"
              >
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 w-full">
                  {/* Item 1 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-semibold flex items-center justify-between">
                      <span>Item 01</span>
                      <span className="text-white/30 text-[10px]">REQUIRED</span>
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={items[0]}
                      onChange={(e) => handleItemChange(0, e.target.value)}
                      placeholder="e.g. Crowbar"
                      className="w-full px-4 py-3 rounded-xl border border-red-500/25 bg-red-950/15 focus:bg-red-950/30 focus:border-red-400 text-sm text-white placeholder-white/20 focus:outline-none transition-all shadow-[inset_0_0_15px_rgba(255,69,58,0.05)]"
                    />
                  </div>

                  {/* Item 2 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-orange-400 font-semibold flex items-center justify-between">
                      <span>Item 02</span>
                      <span className="text-white/30 text-[10px]">REQUIRED</span>
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={items[1]}
                      onChange={(e) => handleItemChange(1, e.target.value)}
                      placeholder="e.g. Jar of peanut butter"
                      className="w-full px-4 py-3 rounded-xl border border-orange-500/25 bg-orange-950/15 focus:bg-orange-950/30 focus:border-orange-400 text-sm text-white placeholder-white/20 focus:outline-none transition-all shadow-[inset_0_0_15px_rgba(255,159,10,0.05)]"
                    />
                  </div>

                  {/* Item 3 */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-[11px] font-mono uppercase tracking-widest text-yellow-400 font-semibold flex items-center justify-between">
                      <span>Item 03</span>
                      <span className="text-white/30 text-[10px]">REQUIRED</span>
                    </label>
                    <input
                      type="text"
                      maxLength={60}
                      value={items[2]}
                      onChange={(e) => handleItemChange(2, e.target.value)}
                      placeholder="e.g. Laser pointer"
                      className="w-full px-4 py-3 rounded-xl border border-yellow-500/25 bg-yellow-950/15 focus:bg-yellow-950/30 focus:border-yellow-400 text-sm text-white placeholder-white/20 focus:outline-none transition-all shadow-[inset_0_0_15px_rgba(255,214,10,0.05)]"
                    />
                  </div>
                </div>

                {/* Error Banner */}
                {errorMsg && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 text-center font-mono"
                  >
                    {errorMsg}
                  </motion.div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-3">
                  <motion.button
                    type="submit"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    disabled={!isFormValid}
                    className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                      isFormValid
                        ? 'text-black bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-400 hover:to-yellow-400 shadow-[0_0_30px_rgba(255,69,58,0.4)]'
                        : 'text-white/30 bg-white/5 border border-white/10 cursor-not-allowed'
                    }`}
                  >
                    <span>SURVIVE</span>
                    <span>⚡</span>
                  </motion.button>

                  <button
                    type="button"
                    onClick={fetchScenario}
                    className="w-full sm:w-auto px-5 py-3.5 rounded-xl text-xs font-mono font-bold uppercase tracking-wider text-white/50 hover:text-white bg-white/[0.02] hover:bg-white/[0.06] border border-white/10 transition-all cursor-pointer"
                  >
                    Reroll Scenario ↻
                  </button>
                </div>
              </form>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 4: REVEAL STATE (YOU SURVIVED / YOU DIED)
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'reveal' && result && (
            <motion.div
              key="reveal"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{
                opacity: 1,
                scale: 1,
                x: !result.survived ? [0, -12, 12, -8, 8, -4, 4, 0] : 0,
              }}
              transition={{
                type: 'spring',
                damping: 20,
                stiffness: 180,
                x: { duration: 0.5, ease: 'easeInOut' },
              }}
              className="w-full max-w-xl p-8 sm:p-12 rounded-3xl border backdrop-blur-2xl text-center flex flex-col items-center shadow-2xl relative"
              style={{
                background: result.survived
                  ? 'rgba(10, 25, 18, 0.95)'
                  : 'rgba(25, 10, 12, 0.95)',
                borderColor: result.survived
                  ? 'rgba(48, 209, 88, 0.45)'
                  : 'rgba(255, 69, 58, 0.5)',
                boxShadow: result.survived
                  ? '0 0 80px rgba(48, 209, 88, 0.25)'
                  : '0 0 80px rgba(255, 69, 58, 0.3)',
              }}
            >
              {/* Outcome Badge */}
              <div className="mb-4">
                <span
                  className={`text-[10px] font-mono font-bold tracking-widest uppercase px-3.5 py-1.5 rounded-full border ${
                    result.survived
                      ? 'bg-green-500/20 text-green-300 border-green-500/40'
                      : 'bg-red-500/20 text-red-300 border-red-500/40'
                  }`}
                >
                  {result.survived ? 'PROTOCOL SUCCESS • SURVIVOR' : 'FATALITY CONFIRMED • CASUALTY'}
                </span>
              </div>

              {/* Massive Header Text */}
              <div className="py-2 my-2">
                {result.survived ? (
                  <motion.h2
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-tight text-green-400"
                    style={{
                      textShadow: '0 0 45px rgba(48, 209, 88, 0.8), 0 0 90px rgba(48, 209, 88, 0.4)',
                    }}
                  >
                    YOU SURVIVED
                  </motion.h2>
                ) : (
                  <motion.h2
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', damping: 15 }}
                    className="text-6xl sm:text-7xl md:text-8xl font-black font-mono tracking-tight text-red-500"
                    style={{
                      textShadow: '0 0 45px rgba(255, 69, 58, 0.8), 0 0 90px rgba(255, 69, 58, 0.4)',
                    }}
                  >
                    YOU DIED
                  </motion.h2>
                )}
              </div>

              {/* Equipped Items Summary */}
              <div className="w-full flex items-center justify-center gap-2 my-3 text-[11px] font-mono text-white/50">
                <span className="text-white/30">EQUIPPED:</span>
                <span className="text-white/80">{items[0]}</span> •
                <span className="text-white/80">{items[1]}</span> •
                <span className="text-white/80">{items[2]}</span>
              </div>

              {/* Verdict Card */}
              <div
                className="w-full p-6 rounded-2xl mb-8 border flex items-center justify-center text-center backdrop-blur-xl"
                style={{
                  background: result.survived
                    ? 'rgba(48, 209, 88, 0.08)'
                    : 'rgba(255, 69, 58, 0.08)',
                  borderColor: result.survived
                    ? 'rgba(48, 209, 88, 0.25)'
                    : 'rgba(255, 69, 58, 0.25)',
                }}
              >
                <p className="text-sm sm:text-base text-white/90 leading-relaxed font-sans font-medium">
                  {result.verdict}
                </p>
              </div>

              {/* Action Buttons */}
              <div className="w-full flex flex-wrap items-center justify-center gap-3 pt-4 border-t border-white/10">
                <button
                  type="button"
                  onClick={fetchScenario}
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

export default SurvivalProtocol
