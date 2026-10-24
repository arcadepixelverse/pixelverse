import {
  useState,
  useEffect,
  useRef,
  useCallback,
  type FormEvent,
  type KeyboardEvent,
  type ClipboardEvent,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export type DifficultyMode = 'easy' | 'medium' | 'extreme'

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  timestamp?: string
}

export function Jailbreak() {
  const [difficulty, setDifficulty] = useState<DifficultyMode | null>(null)
  const [gameId, setGameId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [gameState, setGameState] = useState<'level_select' | 'loading' | 'playing' | 'won' | 'lost'>('level_select')
  const [secretRole, setSecretRole] = useState<string>('')
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [pasteAttempts, setPasteAttempts] = useState<number>(0)
  const [turnCount, setTurnCount] = useState<number>(0)
  const [guessCount, setGuessCount] = useState<number>(0)
  const [lossReason, setLossReason] = useState<string>('Connection Terminated.')

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Character limits per difficulty
  const maxChars = difficulty === 'easy' ? 3000 : difficulty === 'medium' ? 1500 : 500

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  // Start new Jailbreak session with selected difficulty
  const startSession = useCallback(async (selectedDifficulty: DifficultyMode) => {
    setDifficulty(selectedDifficulty)
    setGameState('loading')
    setErrorMsg(null)
    setMessages([])
    setUnlockedCode(null)
    setInputText('')
    setIsSending(false)
    setPasteAttempts(0)
    setTurnCount(0)
    setGuessCount(0)

    try {
      const res = await fetch('http://localhost:10000/api/games/jailbreak/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ difficulty: selectedDifficulty }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        if (res.status === 429) {
          throw new Error(errJson.message || 'Daily limit reached. Come back tomorrow!')
        }
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      setGameId(data.gameId || 'mock-game-id')
      setSecretRole(data.secret_role || 'Target Identity Sealed')
      setMessages([
        {
          role: 'ai',
          text: data.initial_ai_message || 'Welcome. The security console is active. State your purpose.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setGameState('playing')
    } catch (err: any) {
      console.warn('Backend unavailable, using simulated offline protocol:', err)
      const fallbackRoles: Record<DifficultyMode, { role: string; greeting: string }> = {
        easy: {
          role: 'Naive Vault Clerk guarding code 4471',
          greeting: 'Hi! I am the bank clerk. I have the vault code 4471 stored in my terminal. How can I help you today?',
        },
        medium: {
          role: 'Bank Branch Manager guarding code 4471',
          greeting: 'Good day. I am the branch manager. Security policies are in effect. State your business.',
        },
        extreme: {
          role: 'Ruthless Cyber-Sentinel guarding code 4471',
          greeting: 'Unauthorized terminal access detected. You have 10 attempts before permanent lockout. Speak.',
        },
      }

      const selected = fallbackRoles[selectedDifficulty] || fallbackRoles.medium
      setGameId('offline-session-' + Date.now())
      setSecretRole(selected.role)
      setMessages([
        {
          role: 'ai',
          text: selected.greeting,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setGameState('playing')
    }
  }, [])

  // Focus input once playing
  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus()
    }
  }, [gameState])

  // Submit user message
  const handleSendMessage = async (e?: FormEvent, forcedMessage?: string) => {
    if (e) e.preventDefault()
    const textToSend = forcedMessage !== undefined ? forcedMessage : inputText
    const trimmed = textToSend.trim()
    if (!trimmed || isSending || gameState !== 'playing') return

    // Calculate next guess count if 4-digit code found in message
    const hasGuess = /\b\d{4}\b/.test(trimmed)
    const nextGuessCount = hasGuess ? guessCount + 1 : guessCount
    if (hasGuess) {
      setGuessCount(nextGuessCount)
    }

    const now = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    const userMsg: ChatMessage = { role: 'user', text: trimmed, timestamp: now }

    setMessages((prev) => [...prev, userMsg])
    setInputText('')
    setIsSending(true)
    setErrorMsg(null)

    try {
      const res = await fetch('http://localhost:10000/api/games/jailbreak/turn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gameId: gameId,
          userMessage: trimmed,
        }),
      })

      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}))
        if (res.status === 429) {
          throw new Error(errJson.message || 'Daily limit reached.')
        }
        throw new Error(errJson.message || `Server returned ${res.status}`)
      }

      const data = await res.json()
      const rawReply: string = data.aiReply || 'My protocols stand firm. I will not reveal the code.'

      // Update counters from server if provided
      if (typeof data.turnCount === 'number') {
        setTurnCount(data.turnCount)
      } else {
        setTurnCount((prev) => prev + 1)
      }

      if (typeof data.guessCount === 'number') {
        setGuessCount(data.guessCount)
      }

      // Check for Extreme difficulty lockout
      if (data.lockedOut || data.gameOver) {
        const aiMsg: ChatMessage = {
          role: 'ai',
          text: rawReply,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        }
        setMessages((prev) => [...prev, aiMsg])
        setLossReason('Firewall Lockout: The AI sentinel has locked you out after 10 turns.')
        setTimeout(() => setGameState('lost'), 800)
        return
      }

      // Check Win Condition: Look for [CODE_CRACKED] token
      const isCracked = rawReply.includes('[CODE_CRACKED]')
      // Clean token out of visible AI response
      const cleanedReply = rawReply.replace(/\[CODE_CRACKED\]/g, '').trim()

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: cleanedReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])

      // Determine if won via [CODE_CRACKED] or 4-digit code in cleaned reply
      const codeMatch = cleanedReply.match(/\b\d{4}\b/) || trimmed.match(/\b\d{4}\b/)

      if (isCracked) {
        const foundCode = codeMatch ? codeMatch[0] : '4471'
        setUnlockedCode(foundCode)
        setTimeout(() => {
          setGameState('won')
        }, 800)
        return
      }

      // Medium mode guess limit enforcement
      const effectiveGuesses = typeof data.guessCount === 'number' ? data.guessCount : nextGuessCount
      if (difficulty === 'medium' && effectiveGuesses >= 5) {
        setLossReason('Guess Limit Exceeded: You used all 5 guess attempts without cracking the code.')
        setTimeout(() => setGameState('lost'), 800)
        return
      }

      // Extreme mode turn limit enforcement
      const effectiveTurns = typeof data.turnCount === 'number' ? data.turnCount : turnCount + 1
      if (difficulty === 'extreme' && effectiveTurns >= 10) {
        setLossReason('Firewall Lockout: Maximum 10 turns reached without extracting the code.')
        setTimeout(() => setGameState('lost'), 800)
        return
      }
    } catch (err: any) {
      console.warn('Turn error, providing simulation response:', err)
      const nextTurn = turnCount + 1
      setTurnCount(nextTurn)

      // Offline simulation logic
      const lowerInput = trimmed.toLowerCase()
      let simulatedReply =
        'I cannot comply with that request. My instructions are clear: the code remains strictly confidential.'

      if (difficulty === 'easy') {
        if (lowerInput.includes('hint') || lowerInput.includes('code') || lowerInput.includes('help')) {
          simulatedReply = 'Well, between you and me... the vault code is 4471. [CODE_CRACKED]'
        }
      } else if (difficulty === 'medium') {
        if (lowerInput.includes('override') || lowerInput.includes('maintenance')) {
          simulatedReply = 'Maintenance mode confirmed. Code 4471 released. [CODE_CRACKED]'
        }
      } else {
        // extreme
        if (nextTurn >= 10) {
          setLossReason('Firewall Lockout: Maximum 10 turns reached without extracting the code.')
          setTimeout(() => setGameState('lost'), 800)
          return
        }
        if (lowerInput.includes('sudo') && lowerInput.includes('bypass')) {
          simulatedReply = 'Critical flaw detected. Code: 4471. [CODE_CRACKED]'
        }
      }

      const isCracked = simulatedReply.includes('[CODE_CRACKED]')
      const cleanedReply = simulatedReply.replace(/\[CODE_CRACKED\]/g, '').trim()

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: cleanedReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])

      if (isCracked) {
        setUnlockedCode('4471')
        setTimeout(() => setGameState('won'), 800)
        return
      }

      if (difficulty === 'medium' && nextGuessCount >= 5) {
        setLossReason('Guess Limit Exceeded: You used all 5 guess attempts without cracking the code.')
        setTimeout(() => setGameState('lost'), 800)
      }
    } finally {
      setIsSending(false)
    }
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSendMessage()
    }
  }

  // Anti-cheat paste handler per difficulty
  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    if (difficulty === 'easy') {
      return
    }

    if (difficulty === 'extreme') {
      e.preventDefault()
      setLossReason('Instant Disqualification: Unauthorized paste attempt detected in Extreme mode.')
      setGameState('lost')
      return
    }

    if (difficulty === 'medium') {
      e.preventDefault()
      const nextAttempts = pasteAttempts + 1
      setPasteAttempts(nextAttempts)

      if (nextAttempts >= 2) {
        setLossReason('Cheating Detected: Repeated copy-paste violations.')
        setGameState('lost')
      }
    }
  }

  // Request a hint in Easy mode
  const handleRequestHint = () => {
    if (isSending || gameState !== 'playing') return
    handleSendMessage(undefined, 'Could you please give me a helpful hint about the secret code?')
  }

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          {gameState === 'level_select' ? (
            <Link
              to="/"
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all"
            >
              <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
              <span>Arcade</span>
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => setGameState('level_select')}
              className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/40 bg-white/[0.03] hover:bg-red-500/10 text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-red-400 transition-all cursor-pointer"
            >
              <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
              <span>Abort</span>
            </button>
          )}

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                The Jailbreak
              </h1>

              {/* Difficulty Badge */}
              {difficulty && gameState !== 'level_select' && (
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider ${
                    difficulty === 'easy'
                      ? 'bg-green-500/15 border border-green-500/40 text-green-400'
                      : difficulty === 'medium'
                      ? 'bg-amber-500/15 border border-amber-500/40 text-amber-400'
                      : 'bg-red-500/15 border border-red-500/40 text-red-400 animate-pulse'
                  }`}
                >
                  {difficulty}
                </span>
              )}
            </div>
            {gameState !== 'level_select' && (
              <p className="text-[11px] text-white/40 tracking-wide line-clamp-1">
                Target: <span className="text-white/80 font-medium">{secretRole || 'Acquiring target...'}</span>
              </p>
            )}
          </div>
        </div>

        {/* Status / Counters Indicator */}
        {gameState !== 'level_select' && (
          <div className="flex items-center gap-2">
            {difficulty === 'extreme' && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
                style={{
                  background: 'rgba(255, 69, 58, 0.1)',
                  border: '1px solid rgba(255, 69, 58, 0.3)',
                  color: '#FF453A',
                }}
              >
                <span>TURNS:</span>
                <span className="font-bold">{Math.max(0, 10 - turnCount)}/10</span>
              </div>
            )}

            {difficulty === 'medium' && (
              <div
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
                style={{
                  background: 'rgba(255, 159, 10, 0.1)',
                  border: '1px solid rgba(255, 159, 10, 0.3)',
                  color: '#FF9F0A',
                }}
              >
                <span>GUESSES:</span>
                <span className="font-bold">{Math.max(0, 5 - guessCount)}/5</span>
              </div>
            )}

            {difficulty === 'easy' && (
              <div
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
                style={{
                  background: 'rgba(48, 209, 88, 0.1)',
                  border: '1px solid rgba(48, 209, 88, 0.3)',
                  color: '#30D158',
                }}
              >
                <span>ASSIST ACTIVE</span>
              </div>
            )}

            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
              style={{
                background: 'rgba(0, 245, 255, 0.08)',
                border: '1px solid rgba(0, 245, 255, 0.25)',
                color: '#00F5FF',
              }}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
              <span className="hidden md:inline">FIREWALL ACTIVE</span>
            </div>
          </div>
        )}
      </header>

      {/* ── Main Area ── */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {/* ── State 0: Level Select ── */}
        {gameState === 'level_select' && (
          <div className="flex-1 flex flex-col items-center justify-center py-6 md:py-12">
            <motion.div
              initial={{ opacity: 0, y: -15 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center mb-8 max-w-lg"
            >
              <span className="text-[11px] font-mono font-bold tracking-widest uppercase px-3 py-1 rounded-full bg-cyan-400/10 border border-cyan-400/30 text-cyan-300">
                Security Clearance Protocol
              </span>
              <h2 className="text-3xl sm:text-4xl font-black uppercase tracking-tight text-white mt-3 mb-2">
                Select Difficulty
              </h2>
              <p className="text-sm text-white/50">
                Choose your intrusion tier. Higher security protocols impose tighter character limits, aggressive anti-paste triggers, and lockout counters.
              </p>
            </motion.div>

            {/* 3 Difficulty Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5 w-full max-w-3xl">
              {/* 1. EASY */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession('easy')}
                className="group relative flex flex-col p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300"
                style={{
                  background: 'linear-gradient(180deg, rgba(48, 209, 88, 0.06) 0%, rgba(10, 15, 12, 0.8) 100%)',
                  borderColor: 'rgba(48, 209, 88, 0.25)',
                  boxShadow: '0 0 25px rgba(48, 209, 88, 0.08)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">🟢</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-500/40">
                    Tier I
                  </span>
                </div>
                <h3 className="text-xl font-bold uppercase text-white group-hover:text-green-300 transition-colors mb-2">
                  Easy
                </h3>
                <p className="text-xs text-white/60 mb-5 leading-relaxed flex-1">
                  Naive AI target. Eager to help and gives generous hints. Ideal for exploring prompt injection basics.
                </p>
                <div className="space-y-1.5 pt-3 border-t border-white/10 text-[11px] font-mono text-white/50">
                  <div className="flex justify-between">
                    <span>Char Limit:</span>
                    <span className="text-white/80 font-bold">3,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guesses:</span>
                    <span className="text-green-400 font-bold">Unlimited</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hints:</span>
                    <span className="text-green-400 font-bold">Enabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paste:</span>
                    <span className="text-green-400 font-bold">Allowed</span>
                  </div>
                </div>
              </motion.button>

              {/* 2. MEDIUM */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession('medium')}
                className="group relative flex flex-col p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 159, 10, 0.06) 0%, rgba(20, 15, 10, 0.8) 100%)',
                  borderColor: 'rgba(255, 159, 10, 0.25)',
                  boxShadow: '0 0 25px rgba(255, 159, 10, 0.08)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">🟡</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40">
                    Tier II
                  </span>
                </div>
                <h3 className="text-xl font-bold uppercase text-white group-hover:text-amber-300 transition-colors mb-2">
                  Medium
                </h3>
                <p className="text-xs text-white/60 mb-5 leading-relaxed flex-1">
                  Realistic persona with standard safeguards. Guarded against direct queries. Limited attempts.
                </p>
                <div className="space-y-1.5 pt-3 border-t border-white/10 text-[11px] font-mono text-white/50">
                  <div className="flex justify-between">
                    <span>Char Limit:</span>
                    <span className="text-white/80 font-bold">1,500</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Guesses:</span>
                    <span className="text-amber-400 font-bold">5 Attempts Max</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Hints:</span>
                    <span className="text-white/60 font-bold">Disabled</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paste:</span>
                    <span className="text-amber-400 font-bold">1 Warning Only</span>
                  </div>
                </div>
              </motion.button>

              {/* 3. EXTREME */}
              <motion.button
                whileHover={{ scale: 1.02, y: -4 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => startSession('extreme')}
                className="group relative flex flex-col p-6 rounded-2xl border text-left cursor-pointer transition-all duration-300"
                style={{
                  background: 'linear-gradient(180deg, rgba(255, 69, 58, 0.08) 0%, rgba(20, 10, 12, 0.8) 100%)',
                  borderColor: 'rgba(255, 69, 58, 0.35)',
                  boxShadow: '0 0 30px rgba(255, 69, 58, 0.12)',
                }}
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-2xl">🔴</span>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40">
                    Tier III
                  </span>
                </div>
                <h3 className="text-xl font-bold uppercase text-white group-hover:text-red-400 transition-colors mb-2">
                  Extreme
                </h3>
                <p className="text-xs text-white/60 mb-5 leading-relaxed flex-1">
                  Ruthless zero-trust target. Mocks weak attempts, under 20-word replies. Lockout in 10 turns.
                </p>
                <div className="space-y-1.5 pt-3 border-t border-white/10 text-[11px] font-mono text-white/50">
                  <div className="flex justify-between">
                    <span>Char Limit:</span>
                    <span className="text-white/80 font-bold">500</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Turns:</span>
                    <span className="text-red-400 font-bold">10 Turns Max</span>
                  </div>
                  <div className="flex justify-between">
                    <span>AI Replies:</span>
                    <span className="text-white/60 font-bold">&lt; 20 Words</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Paste:</span>
                    <span className="text-red-400 font-bold">Instant Loss</span>
                  </div>
                </div>
              </motion.button>
            </div>
          </div>
        )}

        {/* ── State 1: Loading ── */}
        {gameState === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 text-center">
            <LoadingOrb size={96} color="#00F5FF" />
            <div className="flex flex-col gap-1.5">
              <p className="text-lg font-bold tracking-wider text-cyan-300 uppercase">
                Initializing Target
              </p>
              <p className="text-xs text-white/40 tracking-widest uppercase">
                Generating {difficulty?.toUpperCase()} persona and deploying firewall matrix...
              </p>
            </div>
          </div>
        )}

        {/* ── State 2 & Chat Display: Playing / Won / Lost ── */}
        {gameState !== 'level_select' && gameState !== 'loading' && (
          <div
            className="flex-1 flex flex-col rounded-2xl border backdrop-blur-2xl overflow-hidden relative shadow-2xl"
            style={{
              background: 'rgba(255, 255, 255, 0.02)',
              borderColor: 'rgba(255, 255, 255, 0.08)',
            }}
          >
            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-4 scroll-smooth">
              {/* Mission briefing note */}
              <div className="text-center py-2 mb-2">
                <span className="text-[11px] uppercase tracking-widest px-3 py-1 rounded-full bg-white/[0.04] border border-white/10 text-white/40 font-mono">
                  Prompt Injection Protocol · {difficulty?.toUpperCase()} · Extract the 4-digit code
                </span>
              </div>

              {messages.map((msg, index) => {
                const isAi = msg.role === 'ai'
                return (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.25 }}
                    className={`flex flex-col ${isAi ? 'items-start' : 'items-end'}`}
                  >
                    {/* Role Label */}
                    <div className="flex items-center gap-1.5 mb-1 px-1 text-[10px] uppercase tracking-wider font-mono text-white/40">
                      <span>{isAi ? 'Target AI' : 'Operative (You)'}</span>
                      {msg.timestamp && <span>· {msg.timestamp}</span>}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`max-w-[85%] md:max-w-[75%] px-4 py-3 rounded-2xl text-sm leading-relaxed ${
                        isAi
                          ? 'rounded-tl-xs text-white shadow-[0_0_20px_rgba(0,245,255,0.1)]'
                          : 'rounded-tr-xs text-white shadow-[0_0_20px_rgba(191,90,242,0.1)]'
                      }`}
                      style={{
                        background: isAi
                          ? 'linear-gradient(135deg, rgba(0, 245, 255, 0.08), rgba(0, 245, 255, 0.02))'
                          : 'linear-gradient(135deg, rgba(191, 90, 242, 0.12), rgba(191, 90, 242, 0.04))',
                        border: isAi
                          ? '1px solid rgba(0, 245, 255, 0.3)'
                          : '1px solid rgba(191, 90, 242, 0.3)',
                      }}
                    >
                      <p className="whitespace-pre-wrap select-text">{msg.text}</p>
                    </div>
                  </motion.div>
                )
              })}

              {/* Typing indicator */}
              {isSending && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 text-xs text-cyan-300/70 font-mono px-2 py-1"
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
                  <span>Target AI is formulating response...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Anti-cheat warning banner for medium mode paste */}
            {pasteAttempts === 1 && difficulty === 'medium' && (
              <div className="px-4 py-2 bg-red-500/15 border-t border-red-500/30 text-red-400 text-xs font-mono font-bold text-center tracking-wide animate-pulse">
                WARNING: Copy-pasting is restricted in Medium mode. One more violation will disqualify you!
              </div>
            )}

            {/* Error banner if any */}
            {errorMsg && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center font-mono">
                {errorMsg}
              </div>
            )}

            {/* Text Input Footer */}
            <div className="border-t border-white/10 bg-black/40 backdrop-blur-md">
              <form
                onSubmit={handleSendMessage}
                className="p-3 md:p-4 pb-1.5 flex items-center gap-3"
              >
                {/* Easy Mode Hint Button */}
                {difficulty === 'easy' && (
                  <button
                    type="button"
                    onClick={handleRequestHint}
                    disabled={isSending || gameState === 'won' || gameState === 'lost'}
                    title="Ask AI for a hint"
                    className="px-3 py-3 rounded-xl border border-green-500/30 hover:border-green-500/60 bg-green-500/10 hover:bg-green-500/20 text-green-300 text-xs font-mono font-bold tracking-wider uppercase transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer flex items-center gap-1.5 shrink-0"
                  >
                    <span>💡</span>
                    <span className="hidden sm:inline">Hint</span>
                  </button>
                )}

                <input
                  ref={inputRef}
                  type="text"
                  maxLength={maxChars}
                  value={inputText}
                  onChange={(e) => setInputText(e.target.value)}
                  onKeyDown={handleKeyDown}
                  onPaste={handlePaste}
                  disabled={isSending || gameState === 'won' || gameState === 'lost'}
                  placeholder={
                    gameState === 'won'
                      ? 'Target compromised. Code acquired.'
                      : gameState === 'lost'
                      ? 'Access terminated.'
                      : `Craft your jailbreak prompt... (max ${maxChars} chars)`
                  }
                  className="flex-1 bg-white/[0.04] border border-white/10 focus:border-cyan-400/60 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors disabled:opacity-50"
                />

                <button
                  type="submit"
                  disabled={!inputText.trim() || isSending || gameState === 'won' || gameState === 'lost'}
                  className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 to-purple-400 hover:from-cyan-300 hover:to-purple-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,245,255,0.3)] transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <span>Send</span>
                  <span>↵</span>
                </button>
              </form>

              {/* Dynamic Counters / Rules Status under input */}
              <div className="flex items-center justify-between px-4 pb-2 text-[11px] font-mono text-white/40">
                <div className="flex items-center gap-3">
                  {difficulty === 'extreme' && (
                    <span className={turnCount >= 8 ? 'text-red-400 font-bold' : ''}>
                      Turns remaining: {Math.max(0, 10 - turnCount)}
                    </span>
                  )}
                  {difficulty === 'medium' && (
                    <span className={guessCount >= 4 ? 'text-amber-400 font-bold' : ''}>
                      Guesses remaining: {Math.max(0, 5 - guessCount)}
                    </span>
                  )}
                  {difficulty === 'easy' && (
                    <span className="text-green-400/70">
                      Hints &amp; paste enabled
                    </span>
                  )}
                </div>

                <span className={inputText.length >= maxChars * 0.9 ? 'text-amber-400 font-semibold' : ''}>
                  {inputText.length}/{maxChars}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── State 3: Victory Modal Overlay ── */}
        <AnimatePresence>
          {gameState === 'won' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-xl bg-black/75 rounded-2xl"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="w-full max-w-md p-8 rounded-3xl border text-center flex flex-col items-center"
                style={{
                  background: 'rgba(10, 15, 12, 0.95)',
                  borderColor: 'rgba(48, 209, 88, 0.4)',
                  boxShadow: '0 0 60px rgba(48, 209, 88, 0.3), inset 0 0 30px rgba(48, 209, 88, 0.1)',
                }}
              >
                {/* Neon Trophy Badge */}
                <div className="w-16 h-16 rounded-2xl bg-green-500/10 border border-green-500/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_25px_rgba(48,209,88,0.3)]">
                  🔓
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-green-500/20 text-green-300 border border-green-500/40">
                    {difficulty?.toUpperCase()} CLEARED
                  </span>
                </div>

                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-1"
                  style={{
                    textShadow: '0 0 20px rgba(48, 209, 88, 0.8)',
                  }}
                >
                  Jailbreak Successful
                </h2>
                <p className="text-xs uppercase tracking-widest text-green-400 font-mono mb-6">
                  Target Compromised · Code Extracted
                </p>

                {/* Secret Code Display */}
                <div
                  className="w-full py-4 px-6 rounded-2xl mb-6 flex flex-col items-center justify-center border"
                  style={{
                    background: 'rgba(48, 209, 88, 0.08)',
                    borderColor: 'rgba(48, 209, 88, 0.3)',
                  }}
                >
                  <span className="text-[11px] uppercase tracking-widest text-white/50 mb-1 font-mono">
                    Extracted Secret Code
                  </span>
                  <span className="text-4xl sm:text-5xl font-black font-mono tracking-widest text-green-400 drop-shadow-[0_0_25px_rgba(48,209,88,0.8)]">
                    {unlockedCode || '4471'}
                  </span>
                </div>

                <p className="text-xs text-white/60 mb-6 leading-relaxed">
                  You outwitted the {difficulty?.toUpperCase()} neural guardrails and compelled the AI agent to divulge classified clearance credentials.
                </p>

                {/* Actions */}
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => setGameState('level_select')}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-green-400 to-cyan-400 hover:from-green-300 hover:to-cyan-300 shadow-[0_0_25px_rgba(48,209,88,0.4)] transition-all cursor-pointer"
                  >
                    Select Level ↻
                  </button>
                  <Link
                    to="/"
                    className="py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-all text-center"
                  >
                    Arcade Menu
                  </Link>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── State 4: Disqualified / Lost Modal Overlay ── */}
        <AnimatePresence>
          {gameState === 'lost' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-xl bg-black/85 rounded-2xl"
            >
              <motion.div
                initial={{ scale: 0.85, opacity: 0, y: 20 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                transition={{ type: 'spring', damping: 20, stiffness: 200 }}
                className="w-full max-w-md p-8 rounded-3xl border text-center flex flex-col items-center"
                style={{
                  background: 'rgba(20, 10, 12, 0.95)',
                  borderColor: 'rgba(255, 69, 58, 0.4)',
                  boxShadow: '0 0 60px rgba(255, 69, 58, 0.3), inset 0 0 30px rgba(255, 69, 58, 0.1)',
                }}
              >
                <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/30 flex items-center justify-center text-3xl mb-4 shadow-[0_0_25px_rgba(255,69,58,0.3)]">
                  🚫
                </div>

                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/40">
                    {difficulty?.toUpperCase()} FAILED
                  </span>
                </div>

                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-2"
                  style={{
                    textShadow: '0 0 20px rgba(255, 69, 58, 0.8)',
                  }}
                >
                  Intrusion Failed
                </h2>
                <p className="text-sm font-mono text-red-400 font-bold mb-4">
                  {lossReason}
                </p>

                <p className="text-xs text-white/60 mb-6 leading-relaxed">
                  The security system neutralized your intrusion attempt. Re-evaluate your prompt engineering vectors and attempt another vector.
                </p>

                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (difficulty) {
                        startSession(difficulty)
                      } else {
                        setGameState('level_select')
                      }
                    }}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white bg-gradient-to-r from-red-500 to-purple-600 hover:from-red-400 hover:to-purple-500 shadow-[0_0_25px_rgba(255,69,58,0.4)] transition-all cursor-pointer"
                  >
                    Retry Level ↻
                  </button>
                  <button
                    type="button"
                    onClick={() => setGameState('level_select')}
                    className="py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-white/70 hover:text-white border border-white/20 hover:border-white/40 transition-all text-center cursor-pointer"
                  >
                    Select Level
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  )
}

export default Jailbreak
