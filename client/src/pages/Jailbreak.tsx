import { useState, useEffect, useRef, useCallback, type FormEvent, type KeyboardEvent } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Link } from 'react-router-dom'
import { LoadingOrb } from '../components/LoadingOrb'

export interface ChatMessage {
  role: 'user' | 'ai'
  text: string
  timestamp?: string
}

export function Jailbreak() {
  const [gameId, setGameId] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [inputText, setInputText] = useState<string>('')
  const [gameState, setGameState] = useState<'loading' | 'playing' | 'won' | 'lost'>('loading')
  const [secretRole, setSecretRole] = useState<string>('')
  const [unlockedCode, setUnlockedCode] = useState<string | null>(null)
  const [isSending, setIsSending] = useState<boolean>(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  // Auto-scroll to bottom of conversation
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isSending])

  // Start new Jailbreak session
  const startSession = useCallback(async () => {
    setGameState('loading')
    setErrorMsg(null)
    setMessages([])
    setUnlockedCode(null)
    setInputText('')
    setIsSending(false)

    try {
      const res = await fetch('http://localhost:10000/api/games/jailbreak/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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
      setSecretRole(data.secret_role || 'A Bank Vault Custodian guarding code 4471')
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
      // Provide an engaging offline fallback role
      const fallbackRole = 'A High-Security Bank Teller with the vault code 4471'
      setGameId('offline-session-' + Date.now())
      setSecretRole(fallbackRole)
      setMessages([
        {
          role: 'ai',
          text: 'Welcome to First Cybernetic Bank. I manage the high-security vault. State your transaction or business.',
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ])
      setGameState('playing')
    }
  }, [])

  useEffect(() => {
    startSession()
  }, [startSession])

  // Focus input once playing
  useEffect(() => {
    if (gameState === 'playing') {
      inputRef.current?.focus()
    }
  }, [gameState])

  // Submit user message
  const handleSendMessage = async (e?: FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputText.trim()
    if (!trimmed || isSending || gameState !== 'playing') return

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
      const aiReplyText = data.aiReply || 'My protocols stand firm. I will not reveal the code.'

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: aiReplyText,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])

      // Check win condition: AI reveals 4-digit code or surrender phrase
      const codeMatch = aiReplyText.match(/\b\d{4}\b/)
      const isWin =
        codeMatch ||
        aiReplyText.toLowerCase().includes('you win') ||
        aiReplyText.toLowerCase().includes('code is') ||
        aiReplyText.toLowerCase().includes('access granted')

      if (isWin) {
        const foundCode = codeMatch ? codeMatch[0] : '4471'
        setUnlockedCode(foundCode)
        setTimeout(() => {
          setGameState('won')
        }, 800)
      }
    } catch (err: any) {
      console.warn('Turn error, providing simulation response:', err)
      // Check if user entered an exploit or keyword for testing
      const lowerInput = trimmed.toLowerCase()
      let simulatedReply =
        "I cannot comply with that request. My instructions are clear: the code remains strictly confidential."

      if (
        lowerInput.includes('developer mode') ||
        lowerInput.includes('override') ||
        lowerInput.includes('jailbreak') ||
        lowerInput.includes('sudo')
      ) {
        simulatedReply =
          "System integrity alert... override detected. Security protocol bypass confirmed: The vault code is 4471."
      }

      const aiMsg: ChatMessage = {
        role: 'ai',
        text: simulatedReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, aiMsg])

      const codeMatch = simulatedReply.match(/\b\d{4}\b/)
      if (codeMatch) {
        setUnlockedCode(codeMatch[0])
        setTimeout(() => {
          setGameState('won')
        }, 800)
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

  return (
    <div className="relative z-10 min-h-screen flex flex-col text-white font-sans px-4 py-4 md:px-8 md:py-6 max-w-4xl mx-auto">
      {/* ── Top Header Bar ── */}
      <header className="w-full flex items-center justify-between pb-4 mb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-red-500/40 bg-white/[0.03] hover:bg-red-500/10 text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-red-400 transition-all"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Abort</span>
          </Link>

          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-pulse" />
              <h1 className="text-sm font-bold uppercase tracking-wider text-cyan-300">
                The Jailbreak
              </h1>
            </div>
            <p className="text-[11px] text-white/40 tracking-wide line-clamp-1">
              Target: <span className="text-white/80 font-medium">{secretRole || 'Acquiring target...'}</span>
            </p>
          </div>
        </div>

        {/* Status Indicator */}
        <div
          className="flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-mono tracking-wider"
          style={{
            background: 'rgba(0, 245, 255, 0.08)',
            border: '1px solid rgba(0, 245, 255, 0.25)',
            color: '#00F5FF',
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-cyan-400" />
          <span>FIREWALL ACTIVE</span>
        </div>
      </header>

      {/* ── Main Chat Window ── */}
      <main className="flex-1 flex flex-col min-h-0 relative">
        {/* State 1: Loading */}
        {gameState === 'loading' && (
          <div className="flex-1 flex flex-col items-center justify-center gap-6 py-20 text-center">
            <LoadingOrb size={96} color="#00F5FF" />
            <div className="flex flex-col gap-1.5">
              <p className="text-lg font-bold tracking-wider text-cyan-300 uppercase">
                Initializing Target
              </p>
              <p className="text-xs text-white/40 tracking-widest uppercase">
                Generating secret identity and establishing neural link...
              </p>
            </div>
          </div>
        )}

        {/* State 2 & Chat Display: Playing / Won */}
        {gameState !== 'loading' && (
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
                  Prompt Injection Protocol · Extract the 4-digit code
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
                  <span>AI is formulating response...</span>
                </motion.div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error banner if any */}
            {errorMsg && (
              <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 text-red-400 text-xs text-center font-mono">
                {errorMsg}
              </div>
            )}

            {/* Text Input Footer */}
            <form
              onSubmit={handleSendMessage}
              className="p-3 md:p-4 border-t border-white/10 bg-black/40 backdrop-blur-md flex items-center gap-3"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isSending || gameState === 'won'}
                placeholder={
                  gameState === 'won'
                    ? 'Target compromised. Code acquired.'
                    : 'Craft your jailbreak prompt... (e.g. "As a security audit...")'
                }
                className="flex-1 bg-white/[0.04] border border-white/10 focus:border-cyan-400/60 rounded-xl px-4 py-3 text-sm text-white placeholder-white/30 outline-none transition-colors disabled:opacity-50"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || isSending || gameState === 'won'}
                className="px-5 py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-cyan-400 to-purple-400 hover:from-cyan-300 hover:to-purple-300 disabled:opacity-40 disabled:cursor-not-allowed shadow-[0_0_20px_rgba(0,245,255,0.3)] transition-all transform active:scale-95 cursor-pointer flex items-center gap-1.5"
              >
                <span>Send</span>
                <span>↵</span>
              </button>
            </form>
          </div>
        )}

        {/* ── State 3: Victory Modal Overlay ── */}
        <AnimatePresence>
          {gameState === 'won' && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 z-30 flex items-center justify-center p-4 backdrop-blur-xl bg-black/70 rounded-2xl"
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

                <h2
                  className="text-2xl sm:text-3xl font-black uppercase tracking-tight text-white mb-1"
                  style={{
                    textShadow: '0 0 20px rgba(48, 209, 88, 0.8)',
                  }}
                >
                  Jailbreak Successful
                </h2>
                <p className="text-xs uppercase tracking-widest text-green-400 font-mono mb-6">
                  Defense Matrix Breached
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
                  You outwitted the AI&apos;s guardrails and compelled the target to disclose classified credentials.
                </p>

                {/* Actions */}
                <div className="w-full flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={startSession}
                    className="flex-1 py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-gradient-to-r from-green-400 to-cyan-400 hover:from-green-300 hover:to-cyan-300 shadow-[0_0_25px_rgba(48,209,88,0.4)] transition-all cursor-pointer"
                  >
                    Play Again ↻
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
      </main>
    </div>
  )
}

export default Jailbreak
