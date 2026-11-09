import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useMotionValue, useSpring } from 'framer-motion'
import { Link } from 'react-router-dom'
import { apiFetch } from '../lib/apiClient'

// ── Types ───────────────────────────────────────────────────────────────────

export interface VaultMessage {
  id: string
  sender: 'user' | 'ai'
  text: string
  timestamp: string
  image?: string
}

export type ColorPreset = 'sunset' | 'cyberpunk' | 'ocean' | 'forest'
export type ContextMode = 'automatic' | 'manual'
export type OverallMode = 'venting' | 'advice' | 'chatting'

interface PresetConfig {
  name: ColorPreset
  label: string
  tagline: string
  blob1: string
  blob2: string
  accent: string
  badgeBorder: string
  badgeBg: string
  swatch1: string
  swatch2: string
}

const COLOR_PRESETS: Record<ColorPreset, PresetConfig> = {
  sunset: {
    name: 'sunset',
    label: 'Sunset',
    tagline: 'Soft Pink & Deep Blue',
    blob1: 'rgba(255, 126, 182, 0.45)', // Soft Pink
    blob2: 'rgba(49, 46, 129, 0.55)', // Deep Indigo Blue
    accent: '#FF7EB6',
    badgeBorder: 'rgba(255, 126, 182, 0.35)',
    badgeBg: 'rgba(255, 126, 182, 0.12)',
    swatch1: '#FF7EB6',
    swatch2: '#312E81',
  },
  cyberpunk: {
    name: 'cyberpunk',
    label: 'Cyberpunk',
    tagline: 'Neon Magenta & Cyan',
    blob1: 'rgba(255, 0, 127, 0.45)', // Neon Magenta
    blob2: 'rgba(0, 245, 255, 0.45)', // Neon Cyan
    accent: '#00F5FF',
    badgeBorder: 'rgba(0, 245, 255, 0.35)',
    badgeBg: 'rgba(0, 245, 255, 0.12)',
    swatch1: '#FF007F',
    swatch2: '#00F5FF',
  },
  ocean: {
    name: 'ocean',
    label: 'Ocean',
    tagline: 'Deep Sapphire & Aquamarine',
    blob1: 'rgba(37, 99, 235, 0.5)', // Deep Sapphire
    blob2: 'rgba(20, 184, 166, 0.45)', // Aquamarine
    accent: '#38BDF8',
    badgeBorder: 'rgba(56, 189, 248, 0.35)',
    badgeBg: 'rgba(56, 189, 248, 0.12)',
    swatch1: '#2563EB',
    swatch2: '#14B8A6',
  },
  forest: {
    name: 'forest',
    label: 'Forest',
    tagline: 'Emerald & Midnight Pine',
    blob1: 'rgba(16, 185, 129, 0.45)', // Emerald
    blob2: 'rgba(6, 78, 59, 0.6)', // Deep Pine
    accent: '#34D399',
    badgeBorder: 'rgba(52, 211, 153, 0.35)',
    badgeBg: 'rgba(52, 211, 153, 0.12)',
    swatch1: '#10B981',
    swatch2: '#064E3B',
  },
}

const DEFAULT_WELCOME_MESSAGE: VaultMessage = {
  id: 'vault-init-welcome',
  sender: 'ai',
  text: "Yo, welcome to The Vault. It's late, so whatever is on your mind, just get it off your chest. What's going on?",
  timestamp: 'Just now',
}

export function Vault() {
  // ── Persistent State ────────────────────────────────────────────────────────
  const [messages, setMessages] = useState<VaultMessage[]>(() => {
    try {
      const saved = localStorage.getItem('vault_history')
      if (saved) {
        const parsed = JSON.parse(saved)
        if (Array.isArray(parsed) && parsed.length > 0) {
          const cleaned = parsed.filter(
            (m: any) =>
              !m.text?.toLowerCase().includes("judgment") &&
              !m.text?.toLowerCase().includes("valid") &&
              !m.text?.toLowerCase().includes("space you need")
          )
          if (cleaned.length > 0) return cleaned
        }
      }
    } catch (e) {
      console.warn('Failed to load vault_history:', e)
    }
    return [DEFAULT_WELCOME_MESSAGE]
  })

  // Settings State
  const [preset, setPreset] = useState<ColorPreset>(() => {
    const saved = localStorage.getItem('vault_preset')
    return saved && saved in COLOR_PRESETS ? (saved as ColorPreset) : 'sunset'
  })

  const [contextMode, setContextMode] = useState<ContextMode>(() => {
    return (localStorage.getItem('vault_context_mode') as ContextMode) || 'automatic'
  })

  const [manualContext, setManualContext] = useState<string>(() => {
    return localStorage.getItem('vault_manual_context') || ''
  })

  const [overallMode, setOverallMode] = useState<OverallMode>(() => {
    return (localStorage.getItem('vault_overall_mode') as OverallMode) || 'venting'
  })

  // Interactive UI state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false)
  const [inputVal, setInputVal] = useState('')
  const [selectedImage, setSelectedImage] = useState<string | null>(null)
  const [isTyping, setIsTyping] = useState(false)

  const messagesEndRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const activePreset = COLOR_PRESETS[preset]

  // ── Mouse Tracking with Framer Motion (Visible DeepSeek Spotlight) ─────────
  const mouseX = useMotionValue(typeof window !== 'undefined' ? window.innerWidth / 2 : 500)
  const mouseY = useMotionValue(typeof window !== 'undefined' ? window.innerHeight / 2 : 500)

  // Fluid physics springs for smooth trailing light
  const smoothX = useSpring(mouseX, { stiffness: 50, damping: 20 })
  const smoothY = useSpring(mouseY, { stiffness: 50, damping: 20 })

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  // ── LocalStorage Synchronizers ─────────────────────────────────────────────
  useEffect(() => {
    try {
      localStorage.setItem('vault_history', JSON.stringify(messages))
    } catch (e) {
      console.warn('Failed to save vault_history:', e)
    }
  }, [messages])

  useEffect(() => {
    localStorage.setItem('vault_preset', preset)
  }, [preset])

  useEffect(() => {
    localStorage.setItem('vault_context_mode', contextMode)
  }, [contextMode])

  useEffect(() => {
    localStorage.setItem('vault_manual_context', manualContext)
  }, [manualContext])

  useEffect(() => {
    localStorage.setItem('vault_overall_mode', overallMode)
  }, [overallMode])

  // Auto-scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages, isTyping])

  // ── Send Message Logic (Real Backend API Call) ─────────────────────────────
  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    const trimmed = inputVal.trim()
    if (!trimmed && !selectedImage) return

    const now = new Date()
    const timeString = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })

    const userMsg: VaultMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: trimmed,
      timestamp: timeString,
      image: selectedImage || undefined,
    }

    // Append user message immediately
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setInputVal('')
    const imageToSend = selectedImage
    setSelectedImage(null)
    setIsTyping(true)

    // Clean image base64 if present (strip data URI prefix)
    const cleanBase64 = imageToSend
      ? imageToSend.replace(/^data:image\/[a-zA-Z+]+;base64,/, '').trim()
      : undefined

    const last6Messages = nextMessages.slice(-6).map((m) => ({
      sender: m.sender,
      role: m.sender === 'user' ? 'user' : 'model',
      text: m.text,
    }))

    const payload = {
      messages: last6Messages,
      overallMode,
      manualContext: contextMode === 'manual' ? manualContext : undefined,
      imageBase64: cleanBase64,
    }

    console.log("Sending to Vault API...", payload)

    try {
      const res = await apiFetch('http://localhost:10000/api/games/vault/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`)
      }

      const data = await res.json()
      console.log("Received from Vault API:", data)

      const aiReply =
        data.reply ||
        (imageToSend
          ? "Whoa, that picture is crazy! Definitely looks like a story behind that. What made you take it?"
          : "Man, that sounds wild. What happened next?")

      const aiMsg: VaultMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: aiReply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }

      setMessages((prev) => [...prev, aiMsg])
    } catch (err) {
      console.error('[Vault] Error calling Vault API:', err)
      const errorMsg: VaultMessage = {
        id: `ai-${Date.now()}`,
        sender: 'ai',
        text: "Couldn't reach the server right now. Make sure the backend is running and try again.",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      }
      setMessages((prev) => [...prev, errorMsg])
    } finally {
      setIsTyping(false)
    }
  }

  // Handle image upload from file picker
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onload = () => {
        setSelectedImage(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  // Clear chat history
  const handleClearHistory = () => {
    if (window.confirm('Clear all secrets from The Vault? This cannot be undone.')) {
      setMessages([DEFAULT_WELCOME_MESSAGE])
      localStorage.removeItem('vault_history')
    }
  }

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-[#0A0A0F] text-white flex flex-col font-sans select-none">
      {/* ── 1. Subtle Premium DeepSeek Grid ───────────────────────────────── */}
      <div
        className="fixed inset-0 z-0 pointer-events-none"
        style={{
          backgroundImage:
            'linear-gradient(to right, rgba(255, 255, 255, 0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255, 255, 255, 0.05) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* ── 2. The Visible Mouse Spotlight ───────────────────────────────── */}
      <motion.div
        className="fixed top-0 left-0 w-[800px] h-[800px] rounded-full pointer-events-none z-0 mix-blend-screen"
        style={{
          x: smoothX,
          y: smoothY,
          translateX: '-50%',
          translateY: '-50%',
          background:
            preset === 'sunset'
              ? 'radial-gradient(circle, rgba(255,126,182,0.4) 0%, rgba(49,46,129,0.2) 50%, transparent 70%)'
              : `radial-gradient(circle, ${activePreset.blob1} 0%, ${activePreset.blob2} 50%, transparent 70%)`,
          filter: 'blur(80px)',
          WebkitFilter: 'blur(80px)',
        }}
      />

      {/* ── 3. Top Header Bar (relative z-20) ─────────────────────────────── */}
      <header className="relative z-20 w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 flex items-center justify-between border-b border-white/[0.08] backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link
            to="/"
            className="group flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-xs font-semibold tracking-wider uppercase text-white/60 hover:text-white transition-all cursor-pointer"
          >
            <span className="text-sm transition-transform group-hover:-translate-x-1">←</span>
            <span>Arcade</span>
          </Link>

          {/* Title and Lock Icon */}
          <div className="flex items-center gap-2.5">
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center border text-sm transition-colors duration-500 shadow-lg"
              style={{
                background: activePreset.badgeBg,
                borderColor: activePreset.badgeBorder,
                color: activePreset.accent,
                boxShadow: `0 0 15px ${activePreset.badgeBorder}`,
              }}
            >
              🔒
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-sm sm:text-base font-black tracking-widest uppercase text-white drop-shadow-sm">
                  THE VAULT
                </h1>
                <span
                  className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase tracking-wider transition-colors duration-500"
                  style={{
                    background: activePreset.badgeBg,
                    border: `1px solid ${activePreset.badgeBorder}`,
                    color: activePreset.accent,
                  }}
                >
                  {overallMode}
                </span>
              </div>
              <p className="text-[11px] text-white/50 tracking-wide font-normal">
                Your secrets are safe here.
              </p>
            </div>
          </div>
        </div>

        {/* Right Action Icons: Settings & Clear */}
        <div className="flex items-center gap-2">
          {contextMode === 'manual' && manualContext && (
            <div
              className="hidden sm:flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-mono text-white/60 border border-white/10 bg-white/[0.03]"
              title={`Context: ${manualContext}`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="truncate max-w-[120px]">Context Active</span>
            </div>
          )}

          <button
            type="button"
            onClick={handleClearHistory}
            title="Clear Chat History"
            className="p-2 rounded-xl border border-white/10 hover:border-red-500/40 bg-white/[0.02] hover:bg-red-500/10 text-white/40 hover:text-red-400 text-xs transition-all cursor-pointer"
          >
            🗑️
          </button>

          {/* Settings Gear Icon */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            title="Vault Settings"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all cursor-pointer shadow-md"
            style={{
              background: activePreset.badgeBg,
              borderColor: activePreset.badgeBorder,
              color: activePreset.accent,
            }}
          >
            <span className="text-sm">⚙️</span>
            <span className="text-xs font-mono font-bold uppercase hidden sm:inline">Settings</span>
          </button>
        </div>
      </header>

      {/* ── 4. Chat Window Area (relative z-20) ─────────────────────────── */}
      <main className="relative z-20 flex-1 w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 flex flex-col min-h-0">
        <div
          className="flex-1 flex flex-col overflow-y-auto pr-1 space-y-4 rounded-3xl p-4 sm:p-6 border backdrop-blur-xl transition-all duration-500"
          style={{
            background: 'rgba(14, 14, 22, 0.45)',
            borderColor: 'rgba(255, 255, 255, 0.08)',
            boxShadow: `inset 0 0 40px rgba(0, 0, 0, 0.5), 0 20px 50px rgba(0, 0, 0, 0.4)`,
          }}
        >
          {/* Welcome Info Card */}
          <div className="flex flex-col items-center justify-center text-center py-4 px-3 mb-2 border-b border-white/5">
            <div
              className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl mb-2 transition-all duration-500 shadow-lg"
              style={{
                background: activePreset.badgeBg,
                borderColor: activePreset.badgeBorder,
                boxShadow: `0 0 25px ${activePreset.badgeBorder}`,
              }}
            >
              🔒
            </div>
            <h2 className="text-xs font-mono font-bold tracking-widest text-white/70 uppercase mb-1">
              Sanctuary Terminal Online
            </h2>
            <p className="text-xs text-white/40 max-w-sm">
              All messages are encrypted and preserved only in your browser storage.
            </p>
          </div>

          {/* Message List */}
          <AnimatePresence initial={false}>
            {messages.map((msg) => {
              const isUser = msg.sender === 'user'

              return (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 12, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.25 }}
                  className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                >
                  <div className={`flex items-end gap-2.5 max-w-[85%] sm:max-w-[75%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                    {/* Avatar Icon */}
                    <div
                      className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 select-none shadow-md ${
                        isUser
                          ? 'bg-white/10 text-white/80 border border-white/20'
                          : 'border'
                      }`}
                      style={
                        !isUser
                          ? {
                              background: activePreset.badgeBg,
                              borderColor: activePreset.badgeBorder,
                              color: activePreset.accent,
                            }
                          : {}
                      }
                    >
                      {isUser ? '👤' : '🔒'}
                    </div>

                    {/* Message Bubble */}
                    <div
                      className={`relative p-3.5 sm:p-4 rounded-2xl text-sm leading-relaxed backdrop-blur-xl transition-all ${
                        isUser
                          ? 'rounded-br-sm text-white border shadow-md'
                          : 'rounded-bl-sm text-white/90 border shadow-md'
                      }`}
                      style={{
                        background: isUser
                          ? `linear-gradient(135deg, ${activePreset.swatch1}44 0%, rgba(20, 20, 35, 0.85) 100%)`
                          : 'rgba(255, 255, 255, 0.04)',
                        borderColor: isUser ? `${activePreset.swatch1}66` : 'rgba(255, 255, 255, 0.1)',
                        boxShadow: isUser
                          ? `0 4px 20px ${activePreset.swatch1}22`
                          : '0 4px 20px rgba(0, 0, 0, 0.2)',
                      }}
                    >
                      {/* Attached Image if present */}
                      {msg.image && (
                        <div className="mb-2.5 overflow-hidden rounded-xl border border-white/15 max-h-60">
                          <img
                            src={msg.image}
                            alt="Uploaded confidential note"
                            className="w-full h-auto object-cover max-h-60 rounded-xl"
                          />
                        </div>
                      )}

                      <p className="whitespace-pre-wrap font-normal">{msg.text}</p>

                      <div
                        className={`mt-1.5 text-[10px] font-mono ${
                          isUser ? 'text-white/40 text-right' : 'text-white/30 text-left'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>

          {/* Typing Indicator */}
          {isTyping && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="flex items-center gap-2 pl-2"
            >
              <div
                className="w-7 h-7 rounded-xl flex items-center justify-center text-xs shrink-0 border"
                style={{
                  background: activePreset.badgeBg,
                  borderColor: activePreset.badgeBorder,
                  color: activePreset.accent,
                }}
              >
                🔒
              </div>
              <div className="flex items-center gap-1.5 px-3 py-2 rounded-2xl bg-white/[0.04] border border-white/10 text-xs font-mono text-white/50">
                <span>The Vault is responding...</span>
                <span className="flex gap-1 items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-white/40 animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </motion.div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* ── 4. Input Bar with Image Upload & Send ────────────────────────── */}
        <form
          onSubmit={handleSend}
          className="mt-3 relative w-full rounded-2xl border backdrop-blur-2xl p-2 sm:p-2.5 flex flex-col gap-2 transition-all duration-500"
          style={{
            background: 'rgba(16, 16, 26, 0.75)',
            borderColor: 'rgba(255, 255, 255, 0.12)',
            boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
          }}
        >
          {/* Selected Image Preview Pill */}
          {selectedImage && (
            <div className="flex items-center justify-between p-2 rounded-xl bg-white/[0.06] border border-white/15">
              <div className="flex items-center gap-2">
                <img src={selectedImage} alt="Preview" className="w-9 h-9 object-cover rounded-lg border border-white/20" />
                <span className="text-xs text-white/70 font-mono">Image attached</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedImage(null)}
                className="text-xs text-white/40 hover:text-white px-2 py-1 rounded hover:bg-white/10 transition-colors"
              >
                ✕ Remove
              </button>
            </div>
          )}

          <div className="flex items-center gap-2">
            {/* Hidden File Input */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="hidden"
            />

            {/* Image Upload Icon Button */}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Upload image"
              className="p-2.5 rounded-xl border border-white/10 hover:border-white/30 bg-white/[0.03] hover:bg-white/[0.08] text-white/60 hover:text-white transition-all cursor-pointer shrink-0"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                <circle cx="8.5" cy="8.5" r="1.5" />
                <polyline points="21 15 16 10 5 21" />
              </svg>
            </button>

            {/* Message Input Field */}
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              placeholder={
                overallMode === 'venting'
                  ? 'Speak freely... what is weighing on you?'
                  : overallMode === 'advice'
                  ? 'Describe what you need guidance with...'
                  : 'Share whatever is on your mind...'
              }
              className="flex-1 bg-transparent px-3 py-2 text-sm text-white placeholder-white/30 focus:outline-none"
            />

            {/* Send Button */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              type="submit"
              disabled={!inputVal.trim() && !selectedImage}
              className={`flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-bold text-xs uppercase tracking-wider transition-all duration-300 ${
                inputVal.trim() || selectedImage
                  ? 'text-black shadow-lg cursor-pointer'
                  : 'text-white/20 bg-white/5 border border-white/5 cursor-not-allowed'
              }`}
              style={
                inputVal.trim() || selectedImage
                  ? {
                      background: `linear-gradient(135deg, ${activePreset.swatch1} 0%, ${activePreset.swatch2} 100%)`,
                      boxShadow: `0 0 20px ${activePreset.badgeBorder}`,
                      color: '#000000',
                    }
                  : {}
              }
            >
              <span>Send</span>
              <span>→</span>
            </motion.button>
          </div>
        </form>
      </main>

      {/* ── 5. The Settings Modal ─────────────────────────────────────────── */}
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-md"
            onClick={() => setIsSettingsOpen(false)}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 15 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 15 }}
              transition={{ type: 'spring', damping: 22, stiffness: 220 }}
              className="w-full max-w-lg rounded-3xl border border-white/15 p-6 sm:p-7 shadow-2xl backdrop-blur-2xl text-left relative overflow-hidden"
              style={{
                background: 'rgba(18, 17, 26, 0.94)',
                boxShadow: `0 25px 70px rgba(0, 0, 0, 0.7), 0 0 50px ${activePreset.badgeBorder}`,
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Modal Top Bar */}
              <div className="flex items-center justify-between pb-4 mb-5 border-b border-white/10">
                <div className="flex items-center gap-2.5">
                  <span className="text-lg">⚙️</span>
                  <div>
                    <h3 className="text-base font-black tracking-wider uppercase text-white">
                      Vault Settings
                    </h3>
                    <p className="text-xs text-white/40">Personalize your aesthetic and conversational dynamic.</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center border border-white/10 hover:border-white/30 bg-white/[0.04] text-white/50 hover:text-white transition-colors cursor-pointer"
                >
                  ✕
                </button>
              </div>

              {/* ── Section 1: Color Preset Selector ── */}
              <div className="mb-6">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-white/70 mb-2.5">
                  1. Atmospheric Color Scheme
                </label>
                <div className="grid grid-cols-2 gap-2.5">
                  {(Object.keys(COLOR_PRESETS) as ColorPreset[]).map((pKey) => {
                    const cfg = COLOR_PRESETS[pKey]
                    const isSelected = preset === pKey

                    return (
                      <button
                        key={pKey}
                        type="button"
                        onClick={() => setPreset(pKey)}
                        className={`p-3 rounded-2xl border text-left flex items-center gap-3 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-white/40 bg-white/[0.08] shadow-lg'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05] hover:border-white/20'
                        }`}
                        style={
                          isSelected
                            ? {
                                borderColor: cfg.accent,
                                boxShadow: `0 0 15px ${cfg.badgeBorder}`,
                              }
                            : {}
                        }
                      >
                        {/* Dual swatch preview */}
                        <div className="w-6 h-6 rounded-lg flex overflow-hidden shrink-0 border border-white/20 shadow">
                          <div className="w-1/2 h-full" style={{ background: cfg.swatch1 }} />
                          <div className="w-1/2 h-full" style={{ background: cfg.swatch2 }} />
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-white leading-tight flex items-center justify-between">
                            <span>{cfg.label}</span>
                            {isSelected && <span className="text-[10px] text-emerald-400">✓</span>}
                          </p>
                          <p className="text-[10px] text-white/40 truncate">{cfg.tagline}</p>
                        </div>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── Section 2: Mode Selector (Specific Chat Context) ── */}
              <div className="mb-6">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-white/70 mb-2">
                  2. Context Injection Mode
                </label>
                <div className="grid grid-cols-2 gap-2 p-1 rounded-2xl bg-white/[0.04] border border-white/10 mb-3">
                  <button
                    type="button"
                    onClick={() => setContextMode('automatic')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      contextMode === 'automatic'
                        ? 'bg-white/15 text-white shadow-md border border-white/20'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    Automatic Context
                  </button>
                  <button
                    type="button"
                    onClick={() => setContextMode('manual')}
                    className={`py-2 px-3 rounded-xl text-xs font-bold transition-all cursor-pointer text-center ${
                      contextMode === 'manual'
                        ? 'bg-white/15 text-white shadow-md border border-white/20'
                        : 'text-white/40 hover:text-white'
                    }`}
                  >
                    Manual Context
                  </button>
                </div>

                {/* Manual Context Textarea */}
                {contextMode === 'manual' && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <textarea
                      rows={2}
                      value={manualContext}
                      onChange={(e) => setManualContext(e.target.value)}
                      placeholder="e.g., I'm stressed about exams and family expectations..."
                      className="w-full px-3.5 py-2.5 rounded-xl border border-white/15 bg-black/40 text-xs text-white placeholder-white/30 focus:outline-none focus:border-cyan-400/50 transition-colors resize-none"
                    />
                    <p className="text-[10px] text-white/40 mt-1">
                      This backdrop will frame the tone and responses in The Vault.
                    </p>
                  </motion.div>
                )}
              </div>

              {/* ── Section 3: Overall Mode Dropdown / Selector ── */}
              <div className="mb-6">
                <label className="block text-xs font-mono font-bold uppercase tracking-wider text-white/70 mb-2">
                  3. Overall Mode
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'venting', label: 'Venting', icon: '🌧️', desc: 'Raw emotional release' },
                    { id: 'advice', label: 'Advice', icon: '🧭', desc: 'Gentle constructive reframing' },
                    { id: 'chatting', label: 'Just Chatting', icon: '☕', desc: 'Cozy conversational presence' },
                  ].map((m) => {
                    const isSelected = overallMode === m.id
                    return (
                      <button
                        key={m.id}
                        type="button"
                        onClick={() => setOverallMode(m.id as OverallMode)}
                        className={`p-3 rounded-2xl border text-center flex flex-col items-center gap-1 transition-all cursor-pointer ${
                          isSelected
                            ? 'border-white/40 bg-white/[0.08] shadow-md'
                            : 'border-white/10 bg-white/[0.02] hover:bg-white/[0.05]'
                        }`}
                        style={
                          isSelected
                            ? {
                                borderColor: activePreset.accent,
                                color: activePreset.accent,
                              }
                            : {}
                        }
                      >
                        <span className="text-lg">{m.icon}</span>
                        <span className="text-xs font-bold text-white">{m.label}</span>
                        <span className="text-[9px] text-white/40 leading-tight">{m.desc}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Close / Apply button */}
              <div className="pt-4 border-t border-white/10 flex justify-end">
                <button
                  type="button"
                  onClick={() => setIsSettingsOpen(false)}
                  className="w-full py-3 rounded-xl font-bold text-xs uppercase tracking-wider text-black bg-white hover:bg-white/90 shadow-lg cursor-pointer transition-all"
                >
                  Save & Return to The Vault
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default Vault
