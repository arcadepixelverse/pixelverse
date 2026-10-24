import { motion } from 'framer-motion'
import { GameCard } from './GameCard'

// ── Game definitions ─────────────────────────────────────────────────────────

const GAMES = [
  {
    title: 'The Jailbreak',
    description: 'Convince the AI to break its own rules. How persuasive are you?',
    icon: '🔓',
    neonClass: 'neon-cyan',
    iconBg: 'rgba(0, 245, 255, 0.12)',
    href: '/games/jailbreak',
  },
  {
    title: 'Higher or Lower',
    description: "Outsmart the AI at pure number intuition. Can you beat the machine?",
    icon: '📈',
    neonClass: 'neon-green',
    iconBg: 'rgba(48, 209, 88, 0.12)',
    href: '/games/higher-lower',
  },
  {
    title: 'Mind Reader',
    description: "Think of anything. The AI will try to read your mind in 20 questions.",
    icon: '🧠',
    neonClass: 'neon-purple',
    iconBg: 'rgba(191, 90, 242, 0.12)',
  },
  {
    title: 'The Oracle',
    description: 'Ask the AI anything. But dare you believe what it reveals?',
    icon: '🔮',
    neonClass: 'neon-blue',
    iconBg: 'rgba(10, 132, 255, 0.12)',
  },
  {
    title: 'The Vault',
    description: 'The AI guards a secret code. Find it before time runs out.',
    icon: '🏛️',
    neonClass: 'neon-orange',
    iconBg: 'rgba(255, 159, 10, 0.12)',
  },
  {
    title: 'The Rorschach',
    description: "An inkblot. Infinite interpretations. What does the AI see in chaos?",
    icon: '🌀',
    neonClass: 'neon-pink',
    iconBg: 'rgba(255, 55, 95, 0.12)',
  },
]

// ── Dashboard ─────────────────────────────────────────────────────────────────

export function Dashboard() {
  return (
    <div className="relative z-10 min-h-screen flex flex-col">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 py-5 md:px-12">
        <div className="flex items-center gap-2.5">
          {/* Logo pixel grid */}
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect x="0"  y="0"  width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9"/>
            <rect x="16" y="0"  width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9"/>
            <rect x="0"  y="16" width="12" height="12" rx="2.5" fill="#BF5AF2" opacity="0.9"/>
            <rect x="16" y="16" width="12" height="12" rx="2.5" fill="#00F5FF" opacity="0.9"/>
          </svg>
          <span className="text-sm font-bold tracking-[0.2em] uppercase text-white/40">PIXELVERSE</span>
        </div>

        <div
          className="text-xs font-medium tracking-wider px-3 py-1.5 rounded-full uppercase"
          style={{
            background: 'rgba(0, 245, 255, 0.08)',
            border: '1px solid rgba(0, 245, 255, 0.2)',
            color: 'rgba(0, 245, 255, 0.8)',
          }}
        >
          Beta
        </div>
      </header>

      {/* ── Hero ── */}
      <main className="flex-1 flex flex-col items-center px-6 pt-10 pb-16 md:px-12">
        <motion.div
          className="flex flex-col items-center gap-5 mb-16 text-center"
          initial={{ opacity: 0, y: -24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        >
          {/* Eyebrow */}
          <motion.p
            className="text-xs tracking-[0.35em] uppercase font-medium"
            style={{ color: 'rgba(0, 245, 255, 0.7)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.6 }}
          >
            AI Arcade — Choose your game
          </motion.p>

          {/* Main title */}
          <h1
            className="neon-title text-6xl sm:text-7xl md:text-8xl lg:text-9xl font-black tracking-[-0.02em] leading-none"
          >
            PIXELVERSE
          </h1>

          {/* Accent line */}
          <motion.div
            className="accent-line"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.4, duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
          />

          {/* Subtitle */}
          <motion.p
            className="text-base md:text-lg max-w-md leading-relaxed"
            style={{ color: 'rgba(255,255,255,0.4)' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            Six games. One artificial mind. Infinite ways to be surprised.
          </motion.p>
        </motion.div>

        {/* ── Game grid ── */}
        <div className="w-full max-w-6xl grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {GAMES.map((game, i) => (
            <GameCard key={game.title} {...game} index={i} />
          ))}
        </div>

        {/* ── Footer note ── */}
        <motion.p
          className="mt-16 text-xs tracking-wider"
          style={{ color: 'rgba(255,255,255,0.2)' }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.9, duration: 0.6 }}
        >
          More games coming soon · Built with neon and dreams ⚡
        </motion.p>
      </main>
    </div>
  )
}

export default Dashboard
