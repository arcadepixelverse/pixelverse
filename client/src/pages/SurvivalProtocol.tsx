import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'
import { apiFetch, getApiErrorMessage, SERVER_OVERLOAD_MESSAGE } from '../lib/apiClient'

export interface SurvivalGameData {
  scenario: string
  mode: 'mcq' | 'typing'
  required_count: number
  allow_multiple: boolean
  options: string[]
  clues: string[]
}

export interface SurvivalResult {
  survived: boolean
  verdict: string
}

const FALLBACK_SCENARIOS: SurvivalGameData[] = [
  {
    scenario: "You are trapped in a locked McDonald's playplace tube slide with three territorial, caffeine-fueled raccoons guarding the only exit.",
    mode: "mcq",
    required_count: 2,
    allow_multiple: true,
    options: [
      "A half-eaten Happy Meal cheeseburger",
      "A squeaky clown horn",
      "A high-powered pocket laser pointer",
      "A bottle of industrial bleach",
    ],
    clues: ["a sticky puddle of Sprite", "a heavy plastic ball-pit sphere", "a loose ceiling air duct grill"],
  },
  {
    scenario: "You are locked overnight in an IKEA display warehouse while an escaped swarm of robotic vacuum cleaners aggressively circles your perimeter.",
    mode: "typing",
    required_count: 3,
    allow_multiple: false,
    options: [],
    clues: ["an unbuilt Billy bookcase flatpack", "an Allen wrench", "a 50-pack of tealight candles"],
  },
  {
    scenario: "You accidentally boarded a high-speed express train car that has been completely commandeered by 14 territorial Canadian geese.",
    mode: "mcq",
    required_count: 1,
    allow_multiple: false,
    options: [
      "An oversized loaf of French bread",
      "An unopened umbrella",
      "A heavy woolen winter coat",
      "A bluetooth speaker playing hawk screeches",
    ],
    clues: ["an emergency luggage strap", "a half-empty seltzer can", "a conductive overhead grab bar"],
  },
  {
    scenario: "You are stuck inside a malfunctioning glass skyscraper elevator between floors 49 and 50 with a violently short-circuiting robotic barista.",
    mode: "typing",
    required_count: 2,
    allow_multiple: false,
    options: [],
    clues: ["a stainless steel milk steaming pitcher", "a puddle of dark roast espresso", "an exposed maintenance phone wire"],
  },
  {
    scenario: "You are stranded on a rogue conveyor belt inside an automated fulfillment center moving steadily toward an industrial cardboard shredder.",
    mode: "mcq",
    required_count: 1,
    allow_multiple: false,
    options: [
      "A heavy metal crowbar",
      "A roll of industrial bubble wrap",
      "An emergency fire axe in a glass box",
      "A pair of heavy-duty insulated gloves",
    ],
    clues: ["a motorized scanner barcode wand", "a heavy wooden pallet edge", "a high-tension packing tape dispenser"],
  },
  {
    scenario: "You are locked inside a Costco cold storage walk-in freezer with a hyperactive animatronic singing snowman that won't stop blaring polka music.",
    mode: "typing",
    required_count: 1,
    allow_multiple: false,
    options: [],
    clues: ["a pallet of industrial frozen pizzas", "a heavy-duty forklift tire wedge", "an extension cord looped around a steel pillar"],
  },
]

export function SurvivalProtocol() {
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'judging' | 'reveal'>('loading')
  const [gameData, setGameData] = useState<SurvivalGameData | null>(null)
  const [userInput, setUserInput] = useState<string[]>([])
  const [timeLeft, setTimeLeft] = useState<number>(60)
  const [timerActive, setTimerActive] = useState<boolean>(false)
  const [result, setResult] = useState<SurvivalResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Refs to prevent stale closures in the timer tick
  const userInputRef = useRef<string[]>(userInput)
  userInputRef.current = userInput

  const gameDataRef = useRef<SurvivalGameData | null>(gameData)
  gameDataRef.current = gameData

  // Submit items to the AI judge (including environmental clues)
  const submitToJudge = async (itemsToSubmit: string[]) => {
    setTimerActive(false)
    setGameState('judging')
    setErrorMsg(null)

    const currentScenario = gameDataRef.current?.scenario || 'Extreme emergency scenario'
    const currentClues = gameDataRef.current?.clues || []

    try {
      const res = await apiFetch('/api/games/survival/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenario: currentScenario,
          clues: currentClues,
          userInput: itemsToSubmit,
        }),
      })

      if (!res.ok) {
        const errMsg = await getApiErrorMessage(res, `Server returned ${res.status}`)
        if (errMsg === SERVER_OVERLOAD_MESSAGE) {
          setErrorMsg(SERVER_OVERLOAD_MESSAGE)
          setGameState('playing')
          setTimerActive(true)
          return
        }
        throw new Error(errMsg)
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
          verdict: `You brandished '${itemsToSubmit.join(', ')}' with immense confidence, but the danger was completely unimpressed. Attempting this improvised maneuver caused an immediate catastrophic backfire. You perished with dramatic flair, leaving future archaeologists thoroughly confused.`,
        })
      }
      setGameState('reveal')
    } catch (err) {
      console.warn('Backend unavailable, using simulated verdict:', err)
      setResult({
        survived: false,
        verdict: `Your improvised strategy with '${itemsToSubmit.join(', ')}' defied both physics and common sense. While your creativity was commendable, the laws of nature remained stubbornly unyielding. You succumbed to the hazard in spectacular fashion.`,
      })
      setGameState('reveal')
    }
  }

  // Handle timer reaching 0
  const handleTimeExpired = () => {
    setTimerActive(false)
    const currentData = gameDataRef.current
    const currentInput = userInputRef.current

    if (!currentData) {
      setResult({ survived: false, verdict: 'You panicked and froze. You died.' })
      setGameState('reveal')
      return
    }

    if (currentData.mode === 'mcq') {
      if (currentInput.length === currentData.required_count) {
        submitToJudge(currentInput)
      } else {
        setResult({ survived: false, verdict: 'You panicked and froze. You died.' })
        setGameState('reveal')
      }
    } else {
      const validInputs = currentInput.map((i) => i.trim()).filter(Boolean)
      if (validInputs.length === currentData.required_count) {
        submitToJudge(validInputs)
      } else {
        setResult({ survived: false, verdict: 'You panicked and froze. You died.' })
        setGameState('reveal')
      }
    }
  }

  // 60-Second Countdown Timer
  useEffect(() => {
    if (gameState !== 'playing' || !timerActive) return

    const interval = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval)
          handleTimeExpired()
          return 0
        }
        return prev - 1
      })
    }, 1000)

    return () => clearInterval(interval)
  }, [gameState, timerActive])

  // Fetch initial scenario and start round
  const fetchScenario = async () => {
    setGameState('loading')
    setTimerActive(false)
    setTimeLeft(60)
    setUserInput([])
    setResult(null)
    setErrorMsg(null)

    try {
      const res = await apiFetch('/api/games/survival/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!res.ok) {
        const errMsg = await getApiErrorMessage(res, `Server returned ${res.status}`)
        if (errMsg === SERVER_OVERLOAD_MESSAGE) {
          setErrorMsg(SERVER_OVERLOAD_MESSAGE)
        }
        throw new Error(errMsg)
      }

      const data = await res.json()
      if (data && typeof data.scenario === 'string' && data.scenario.trim()) {
        const mode = data.mode === 'mcq' ? 'mcq' : 'typing'
        let required_count = Number(data.required_count)
        if (![1, 2, 3].includes(required_count)) {
          required_count = mode === 'mcq' ? (data.allow_multiple ? 2 : 1) : 2
        }
        const allow_multiple = mode === 'mcq' ? Boolean(data.allow_multiple && required_count > 1) : false
        const options =
          mode === 'mcq' && Array.isArray(data.options) && data.options.length >= 4
            ? data.options.slice(0, 4)
            : mode === 'mcq'
            ? ["Emergency fire extinguisher", "Crowbar", "Heavy wool blanket", "Strobe flashlight"]
            : []
        const clues =
          Array.isArray(data.clues) && data.clues.length >= 2
            ? data.clues.slice(0, 3)
            : ["a rusty pipe", "a puddle of oil", "a loose ceiling bracket"]

        const configuredData: SurvivalGameData = {
          scenario: data.scenario.trim(),
          mode,
          required_count,
          allow_multiple,
          options,
          clues,
        }

        setGameData(configuredData)
        setUserInput(mode === 'typing' ? Array(required_count).fill('') : [])
      } else {
        const fallback = FALLBACK_SCENARIOS[Math.floor(Math.random() * FALLBACK_SCENARIOS.length)]
        setGameData(fallback)
        setUserInput(fallback.mode === 'typing' ? Array(fallback.required_count).fill('') : [])
      }
      setTimeLeft(60)
      setTimerActive(true)
      setGameState('playing')
    } catch (err) {
      console.warn('Backend unavailable, using curated fallback scenario:', err)
      const fallback = FALLBACK_SCENARIOS[Math.floor(Math.random() * FALLBACK_SCENARIOS.length)]
      setGameData(fallback)
      setUserInput(fallback.mode === 'typing' ? Array(fallback.required_count).fill('') : [])
      setTimeLeft(60)
      setTimerActive(true)
      setGameState('playing')
    }
  }

  useEffect(() => {
    fetchScenario()
  }, [])

  // Handle typing input change
  const handleTypingChange = (index: number, val: string) => {
    setUserInput((prev) => {
      const next = [...prev]
      next[index] = val
      return next
    })
    if (errorMsg) setErrorMsg(null)
  }

  // Handle single MCQ option selection (auto-submits on click)
  const handleSelectSingleOption = (opt: string) => {
    if (gameState !== 'playing') return
    setUserInput([opt])
    submitToJudge([opt])
  }

  // Handle multiple MCQ toggle selection
  const handleToggleMultipleOption = (opt: string) => {
    if (gameState !== 'playing' || !gameData) return
    setUserInput((prev) => {
      if (prev.includes(opt)) {
        return prev.filter((item) => item !== opt)
      }
      if (prev.length < gameData.required_count) {
        return [...prev, opt]
      }
      return [...prev.slice(1), opt]
    })
    if (errorMsg) setErrorMsg(null)
  }

  // Manual submit for typing or multiple MCQ
  const handleManualSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!gameData) return

    if (gameData.mode === 'typing') {
      const validInputs = userInput.map((i) => i.trim())
      if (validInputs.some((i) => !i)) {
        setErrorMsg(`You must fill all ${gameData.required_count} input fields before confronting the hazard.`)
        return
      }
      submitToJudge(validInputs)
    } else {
      if (userInput.length !== gameData.required_count) {
        setErrorMsg(`You must select exactly ${gameData.required_count} options.`)
        return
      }
      submitToJudge(userInput)
    }
  }

  // Check form completeness
  const isFormComplete =
    gameData?.mode === 'typing'
      ? userInput.length === gameData.required_count && userInput.every((i) => i.trim() !== '')
      : userInput.length === (gameData?.required_count || 1)

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-3 border-b border-red-500/20">
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
                MacGyver Logic
              </span>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide">
              Cached survival engine. Use your environment to outwit the judge.
            </p>
          </div>
        </div>

        {/* Status badges */}
        <div className="flex items-center gap-2 sm:gap-3">
          {gameData && gameState === 'playing' && (
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-bold uppercase"
              style={{
                background: gameData.mode === 'mcq' ? 'rgba(0, 245, 255, 0.1)' : 'rgba(255, 159, 10, 0.1)',
                border: `1px solid ${gameData.mode === 'mcq' ? 'rgba(0, 245, 255, 0.3)' : 'rgba(255, 159, 10, 0.3)'}`,
                color: gameData.mode === 'mcq' ? '#00F5FF' : '#FF9F0A',
              }}
            >
              <span>MODE: {gameData.mode.toUpperCase()}</span>
            </div>
          )}

          <div
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider font-bold uppercase"
            style={{
              background: 'rgba(255, 69, 58, 0.12)',
              border: '1px solid rgba(255, 69, 58, 0.35)',
              color: '#FF453A',
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
            <span className="hidden sm:inline">BIOHAZARD ACTIVE</span>
          </div>
        </div>
      </header>

      {/* ── 60-Second Countdown Timer (Active during gameplay) ── */}
      {gameState === 'playing' && (
        <div className="w-full flex flex-col items-center justify-center mb-4">
          <motion.div
            animate={
              timeLeft <= 10
                ? {
                    scale: [1, 1.09, 1],
                    borderColor: ['rgba(255, 69, 58, 0.4)', 'rgba(255, 69, 58, 1)', 'rgba(255, 69, 58, 0.4)'],
                    boxShadow: [
                      '0 0 25px rgba(255, 69, 58, 0.4)',
                      '0 0 60px rgba(255, 69, 58, 0.9)',
                      '0 0 25px rgba(255, 69, 58, 0.4)',
                    ],
                  }
                : {}
            }
            transition={
              timeLeft <= 10
                ? { duration: 0.5, repeat: Infinity, ease: 'easeInOut' }
                : {}
            }
            className={`px-6 py-2.5 rounded-2xl border flex items-center gap-3 font-mono transition-colors ${
              timeLeft <= 10
                ? 'bg-red-950/80 text-red-400 border-red-500'
                : 'bg-red-950/30 text-red-300 border-red-500/30 shadow-[0_0_25px_rgba(255,69,58,0.2)]'
            }`}
          >
            <span className="text-xs uppercase tracking-widest text-red-400 font-bold flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
              TIME REMAINING:
            </span>
            <span className="text-3xl sm:text-4xl font-black tracking-tight text-white font-mono drop-shadow-[0_0_15px_rgba(255,69,58,0.8)]">
              {String(Math.floor(timeLeft / 60)).padStart(2, '0')}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </motion.div>
        </div>
      )}

      {/* ── Main Content ── */}
      <main className="flex-1 flex flex-col items-center justify-center min-h-0 relative py-2 sm:py-4">
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
                  Synthesizing Survival Protocol...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Fetching scenario and scouting environmental clues
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
                  The MacGyver Judge is Deliberating...
                </p>
                <p className="text-xs text-white/40 font-mono tracking-widest uppercase">
                  Analyzing environmental integration, creative logic, and causality
                </p>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════════════════════
              STATE 3: PLAYING STATE (SCENARIO + CLUES + DYNAMIC MCQ / TYPING)
          ═══════════════════════════════════════════════════════════════════ */}
          {gameState === 'playing' && gameData && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -16 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col items-center gap-6"
            >
              {/* Glowing Hazard Card with Environmental Clues */}
              <div
                className="w-full p-6 sm:p-8 rounded-3xl border backdrop-blur-2xl flex flex-col items-center text-center relative overflow-hidden shadow-2xl"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 69, 58, 0.08) 0%, rgba(20, 10, 12, 0.9) 100%)',
                  borderColor: 'rgba(255, 69, 58, 0.35)',
                  boxShadow: '0 0 50px rgba(255, 69, 58, 0.15)',
                }}
              >
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-base">☣️</span>
                  <span className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-bold">
                    SURVIVAL EMERGENCY • {gameData.mode.toUpperCase()} PROTOCOL
                  </span>
                  <span className="text-base">☣️</span>
                </div>

                <h2 className="text-xl sm:text-2xl md:text-3xl font-black tracking-tight text-white max-w-2xl leading-snug">
                  &ldquo;{gameData.scenario}&rdquo;
                </h2>

                {/* Environmental Clues Banner List */}
                {gameData.clues && gameData.clues.length > 0 && (
                  <div className="w-full mt-5 pt-4 border-t border-red-500/20 flex flex-col items-center">
                    <div className="flex items-center gap-1.5 mb-2.5">
                      <span className="text-amber-400 text-xs">⚠️</span>
                      <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-amber-300 drop-shadow-[0_0_10px_rgba(255,159,10,0.6)]">
                        ENVIRONMENTAL CLUES (USE THESE!)
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center justify-center gap-2 max-w-xl">
                      {gameData.clues.map((clue, idx) => (
                        <div
                          key={idx}
                          className="px-3 py-1 rounded-full text-xs font-mono font-medium text-amber-200 border flex items-center gap-1.5 transition-all"
                          style={{
                            background: 'rgba(255, 159, 10, 0.1)',
                            borderColor: 'rgba(255, 159, 10, 0.35)',
                            boxShadow: '0 0 15px rgba(255, 159, 10, 0.15)',
                          }}
                        >
                          <span className="text-amber-400 font-bold">›</span>
                          <span>{clue}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-2 mt-4 text-[11px] font-mono">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10 text-white/70">
                    REQUIRED: {gameData.required_count} {gameData.required_count === 1 ? 'ITEM' : 'ITEMS'}
                  </span>
                  {gameData.mode === 'mcq' && (
                    <span className="px-3 py-1 rounded-full bg-cyan-500/10 border border-cyan-500/30 text-cyan-300">
                      {gameData.allow_multiple ? 'MULTIPLE CHOICE' : 'SINGLE CHOICE (CLICK TO SUBMIT)'}
                    </span>
                  )}
                </div>
              </div>

              {/* ── MODE 1: MCQ DYNAMIC CARDS ── */}
              {gameData.mode === 'mcq' && (
                <div className="w-full max-w-2xl flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 w-full">
                    {gameData.options.map((option, idx) => {
                      const isSelected = userInput.includes(option)
                      return (
                        <motion.button
                          key={idx}
                          type="button"
                          whileHover={{ scale: 1.015, y: -2 }}
                          whileTap={{ scale: 0.985 }}
                          onClick={() => {
                            if (gameData.allow_multiple) {
                              handleToggleMultipleOption(option)
                            } else {
                              handleSelectSingleOption(option)
                            }
                          }}
                          className={`p-5 rounded-2xl border text-left flex flex-col justify-between transition-all cursor-pointer backdrop-blur-xl ${
                            isSelected
                              ? 'border-red-400 bg-red-950/40 shadow-[0_0_25px_rgba(255,69,58,0.3)]'
                              : 'border-white/10 bg-white/[0.03] hover:border-red-500/40 hover:bg-white/[0.06]'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-red-400">
                              Option {String.fromCharCode(65 + idx)}
                            </span>
                            <span
                              className={`w-4 h-4 rounded-full border flex items-center justify-center text-[10px] font-mono ${
                                isSelected
                                  ? 'border-red-400 bg-red-500 text-black font-black'
                                  : 'border-white/20 bg-transparent'
                              }`}
                            >
                              {isSelected ? '✓' : ''}
                            </span>
                          </div>
                          <p className="text-sm sm:text-base font-semibold text-white/90 leading-snug">
                            {option}
                          </p>
                        </motion.button>
                      )
                    })}
                  </div>

                  {/* Multiple MCQ Submission Button */}
                  {gameData.allow_multiple && (
                    <div className="flex flex-col items-center gap-2 mt-2">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleManualSubmit()}
                        disabled={!isFormComplete}
                        className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                          isFormComplete
                            ? 'text-black bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-400 hover:to-yellow-400 shadow-[0_0_30px_rgba(255,69,58,0.4)]'
                            : 'text-white/30 bg-white/5 border border-white/10 cursor-not-allowed'
                        }`}
                      >
                        <span>Submit Choices ({userInput.length}/{gameData.required_count})</span>
                        <span>⚡</span>
                      </motion.button>
                    </div>
                  )}
                </div>
              )}

              {/* ── MODE 2: TYPING DYNAMIC INPUTS ── */}
              {gameData.mode === 'typing' && (
                <form
                  onSubmit={handleManualSubmit}
                  className="w-full flex flex-col gap-4 max-w-2xl"
                >
                  <div
                    className={`grid gap-3 w-full ${
                      gameData.required_count === 1
                        ? 'grid-cols-1'
                        : gameData.required_count === 2
                        ? 'grid-cols-1 sm:grid-cols-2'
                        : 'grid-cols-1 sm:grid-cols-3'
                    }`}
                  >
                    {Array.from({ length: gameData.required_count }).map((_, idx) => (
                      <div key={idx} className="flex flex-col gap-1.5">
                        <label className="text-[11px] font-mono uppercase tracking-widest text-red-400 font-semibold flex items-center justify-between">
                          <span>Item 0{idx + 1}</span>
                          <span className="text-white/30 text-[10px]">REQUIRED</span>
                        </label>
                        <input
                          type="text"
                          maxLength={60}
                          value={userInput[idx] || ''}
                          onChange={(e) => handleTypingChange(idx, e.target.value)}
                          placeholder={
                            idx === 0
                              ? 'e.g. Crowbar'
                              : idx === 1
                              ? 'e.g. Jar of peanut butter'
                              : 'e.g. Laser pointer'
                          }
                          className="w-full px-4 py-3 rounded-xl border border-red-500/25 bg-red-950/15 focus:bg-red-950/30 focus:border-red-400 text-sm text-white placeholder-white/20 focus:outline-none transition-all shadow-[inset_0_0_15px_rgba(255,69,58,0.05)]"
                        />
                      </div>
                    ))}
                  </div>

                  <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mt-3">
                    <motion.button
                      type="submit"
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      disabled={!isFormComplete}
                      className={`w-full sm:w-auto px-10 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all cursor-pointer flex items-center justify-center gap-2 ${
                        isFormComplete
                          ? 'text-black bg-gradient-to-r from-red-500 via-orange-500 to-yellow-500 hover:from-red-400 hover:to-yellow-400 shadow-[0_0_30px_rgba(255,69,58,0.4)]'
                          : 'text-white/30 bg-white/5 border border-white/10 cursor-not-allowed'
                      }`}
                    >
                      <span>SURVIVE</span>
                      <span>⚡</span>
                    </motion.button>
                  </div>
                </form>
              )}

              {/* Error Banner */}
              {errorMsg && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-3 rounded-xl bg-red-500/15 border border-red-500/30 text-xs text-red-300 text-center font-mono max-w-md w-full"
                >
                  {errorMsg}
                </motion.div>
              )}
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
              {userInput.filter(Boolean).length > 0 && (
                <div className="w-full flex flex-wrap items-center justify-center gap-2 my-3 text-[11px] font-mono text-white/50">
                  <span className="text-white/30">EQUIPPED:</span>
                  {userInput.filter(Boolean).map((item, idx) => (
                    <span key={idx} className="text-white/80 font-medium">
                      {idx > 0 && <span className="text-white/30 mr-2">•</span>}
                      {item}
                    </span>
                  ))}
                </div>
              )}

              {/* Section Header above verdict */}
              <div className="w-full flex items-center justify-center gap-2 mb-3 mt-2">
                {result.survived ? (
                  <>
                    <span className="text-base sm:text-lg">🛡️</span>
                    <h3 className="text-xs sm:text-sm font-black font-mono uppercase tracking-widest text-green-400 drop-shadow-[0_0_12px_rgba(48,209,88,0.7)]">
                      SURVIVAL DEBRIEF
                    </h3>
                  </>
                ) : (
                  <>
                    <span className="text-base sm:text-lg">💀</span>
                    <h3 className="text-xs sm:text-sm font-black font-mono uppercase tracking-widest text-red-500 drop-shadow-[0_0_14px_rgba(255,69,58,0.9)]">
                      AUTOPSY REPORT
                    </h3>
                    <span className="text-base sm:text-lg">💀</span>
                  </>
                )}
              </div>

              {/* Verdict Card */}
              <div
                className={`w-full p-6 sm:p-7 rounded-2xl mb-8 border flex flex-col items-center text-center backdrop-blur-2xl relative overflow-hidden transition-all ${
                  !result.survived
                    ? 'shadow-[0_0_35px_rgba(255,69,58,0.25)] border-red-500/60'
                    : 'shadow-[0_0_30px_rgba(48,209,88,0.15)] border-green-500/35'
                }`}
                style={{
                  background: result.survived
                    ? 'linear-gradient(180deg, rgba(48, 209, 88, 0.1) 0%, rgba(10, 25, 18, 0.85) 100%)'
                    : 'linear-gradient(180deg, rgba(255, 69, 58, 0.18) 0%, rgba(30, 10, 14, 0.9) 100%)',
                }}
              >
                {!result.survived && (
                  <div className="flex items-center gap-2 mb-3 px-3 py-1 rounded-full bg-red-500/20 border border-red-500/40 text-[10px] font-mono font-bold text-red-300 uppercase tracking-widest">
                    <span>💀</span>
                    <span>LOGICAL CAUSE OF DEATH</span>
                  </div>
                )}
                <p className={`text-sm sm:text-base leading-relaxed font-sans font-medium ${
                  !result.survived ? 'text-red-100' : 'text-white/90'
                }`}>
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
