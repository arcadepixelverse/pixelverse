import { Link } from 'react-router-dom'

interface OfflineOverlayProps {
  title?: string
  message?: string
}

export function OfflineOverlay({
  title = 'MODULE OFFLINE // DISABLED BY ADMIN',
  message = 'THIS ARCADE PROTOCOL HAS BEEN SUSPENDED FOR MAINTENANCE. ACCESS IS RESTRICTED UNTIL AN ADMINISTRATOR RE-ENABLES THE NODE.',
}: OfflineOverlayProps) {
  return (
    <div className="min-h-screen bg-black text-white font-mono flex items-center justify-center p-6 select-none relative z-20">
      <div className="max-w-md w-full p-8 rounded-2xl bg-red-950/20 border-2 border-red-500/60 shadow-[0_0_60px_rgba(255,55,95,0.3)] text-center">
        <div className="text-4xl mb-4">⛔</div>
        <h2 className="text-xl font-black uppercase text-red-500 tracking-[0.2em] mb-3">
          {title}
        </h2>
        <p className="text-xs text-red-200/80 mb-6 uppercase tracking-wider leading-relaxed">
          {message}
        </p>
        <Link
          to="/"
          className="inline-block px-6 py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest text-white bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 transition"
        >
          RETURN TO ARCADE
        </Link>
      </div>
    </div>
  )
}

export default OfflineOverlay
