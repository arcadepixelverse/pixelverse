import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { playClick, playHover } from '../lib/soundEngine'

export interface GameCardProps {
  title: string
  description: string
  icon: ReactNode
  neonClass: string
  iconBg: string
  index: number
  href?: string
  statusBadge?: string
  disabled?: boolean
  genre?: string
  difficulty?: string
  hotkey?: number
  costBadge?: string
  onLaunch?: () => void
}

export function GameCard({
  title,
  description,
  icon,
  neonClass,
  iconBg,
  index,
  href,
  statusBadge,
  disabled,
  genre,
  difficulty,
  hotkey,
  costBadge,
  onLaunch,
}: GameCardProps) {
  const isPlayable = Boolean(href) && !disabled
  const isOffline = statusBadge === 'OFFLINE'

  // ── Status beacon (ONLINE pulsing emerald vs OFFLINE/LOCKED) ──────────────
  const beacon = isPlayable
    ? { label: 'ONLINE', color: '#30D158', bg: 'rgba(48,209,88,0.12)', border: 'rgba(48,209,88,0.35)' }
    : isOffline
    ? { label: 'OFFLINE', color: '#FF375F', bg: 'rgba(255,55,95,0.14)', border: 'rgba(255,55,95,0.4)' }
    : { label: 'LOCKED', color: 'rgba(255,255,255,0.55)', bg: 'rgba(255,255,255,0.06)', border: 'rgba(255,255,255,0.15)' }

  const cardContent = (
    <motion.div
      className={`glass-card ${neonClass} p-5 sm:p-6 flex flex-col gap-3.5 select-none h-full ${
        isPlayable ? 'cursor-pointer' : 'cursor-default opacity-50'
      }`}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={isPlayable ? { y: -4 } : undefined}
      onMouseEnter={isPlayable ? playHover : undefined}
    >
      {/* Icon & Status beacon */}
      <div className="flex items-center justify-between gap-2">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>

        <span
          className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border flex-shrink-0"
          style={{ background: beacon.bg, color: beacon.color, borderColor: beacon.border }}
        >
          {isPlayable ? (
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
            </span>
          ) : (
            <span className="text-[9px] leading-none">🔒</span>
          )}
          {beacon.label}
        </span>
      </div>

      {/* Genre / difficulty badges */}
      {(genre || difficulty) && (
        <div className="flex flex-wrap items-center gap-1.5">
          {genre && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-white/10 text-white/45 bg-white/[0.03]">
              {genre}
            </span>
          )}
          {difficulty && (
            <span className="text-[9px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded border border-cyan-500/20 text-cyan-300/70 bg-cyan-500/[0.06]">
              {difficulty}
            </span>
          )}
        </div>
      )}

      {/* Text */}
      <div className="flex flex-col gap-1.5 flex-1">
        <h2 className="text-lg font-bold tracking-tight text-white leading-tight">{title}</h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {description}
        </p>
      </div>

      {/* Action footer */}
      <div className="mt-auto flex items-center justify-between gap-2 pt-2.5 border-t border-white/[0.06]">
        <span
          className="flex items-center gap-1.5 text-xs uppercase tracking-widest font-bold"
          style={{ color: isPlayable ? 'rgba(0, 245, 255, 0.9)' : 'rgba(255,255,255,0.3)' }}
        >
          {isPlayable ? 'PLAY // LAUNCH' : isOffline ? 'MODULE OFFLINE' : 'COMING SOON'}
          {isPlayable && (
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none" aria-hidden="true">
              <path
                d="M2 6h8M6 2l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          )}
        </span>

        {isPlayable && costBadge && (
          <span
            className={`flex-shrink-0 text-[9px] font-mono font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${
              costBadge === '1 ORB'
                ? 'border-amber-400/40 text-amber-300 bg-amber-400/10'
                : 'border-white/15 text-white/50 bg-white/[0.04]'
            }`}
          >
            {costBadge}
          </span>
        )}

        {isPlayable && hotkey != null && (
          <kbd
            className="flex-shrink-0 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-white/15 text-white/40 bg-black/40"
            title={`Press ${hotkey} to launch`}
          >
            {hotkey}
          </kbd>
        )}
      </div>
    </motion.div>
  )

  if (href && isPlayable) {
    return (
      <Link
        to={href}
        onClick={(e) => {
          if (onLaunch) {
            e.preventDefault()
            onLaunch()
            return
          }
          playClick()
        }}
        aria-label={`Launch ${title}`}
        className="block no-underline h-full rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/70 focus-visible:ring-offset-2 focus-visible:ring-offset-transparent"
      >
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

export default GameCard
