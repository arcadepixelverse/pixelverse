import { Link, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'

export function NotFound() {
  const location = useLocation()

  return (
    <div className="relative z-10 min-h-screen flex items-center justify-center px-4 py-12">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-lg rounded-3xl border p-6 sm:p-10 text-center font-mono"
        style={{
          background: 'rgba(15, 17, 26, 0.75)',
          borderColor: 'rgba(0, 245, 255, 0.25)',
          boxShadow: '0 0 50px rgba(0, 245, 255, 0.12), inset 0 0 20px rgba(0, 245, 255, 0.04)',
          backdropFilter: 'blur(16px)',
        }}
      >
        <div className="text-4xl mb-4">🛰️</div>

        <h1 className="neon-title text-4xl sm:text-5xl font-black tracking-tight mb-3">404</h1>
        <p className="text-sm font-bold uppercase tracking-[0.25em] text-cyan-400 mb-3">
          404 // Sector Not Found
        </p>
        <p className="text-[11px] sm:text-xs text-white/40 leading-relaxed uppercase tracking-wider mb-8">
          The sector you requested does not exist on this grid. Coordinates may be corrupted or the
          module was relocated.
        </p>

        {/* Terminal trace */}
        <div className="p-3 rounded-xl bg-black/40 border border-white/10 text-left text-[11px] leading-relaxed mb-8 break-all">
          <span className="text-cyan-400">root@pixelverse</span>
          <span className="text-white/40">:</span>
          <span className="text-purple-400">~</span>
          <span className="text-white/70">$ locate {location.pathname}</span>
          <br />
          <span className="text-rose-400">error:</span>
          <span className="text-white/40"> sector unreachable</span>
        </div>

        <Link
          to="/"
          className="inline-flex items-center justify-center gap-2 w-full py-3.5 px-6 rounded-xl font-bold text-xs uppercase tracking-widest text-black bg-gradient-to-r from-cyan-400 to-green-400 hover:from-cyan-300 hover:to-green-300 shadow-[0_0_25px_rgba(0,245,255,0.4)] transition-all transform hover:-translate-y-0.5 active:translate-y-0"
        >
          Return to Arcade ↵
        </Link>
      </motion.div>
    </div>
  )
}

export default NotFound
