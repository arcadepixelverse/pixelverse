import { motion } from 'framer-motion'
import { type ReactNode } from 'react'
import { Link } from 'react-router-dom'

export interface GameCardProps {
  title: string
  description: string
  icon: ReactNode
  neonClass: string
  iconBg: string
  index: number
  href?: string
}

export function GameCard({
  title,
  description,
  icon,
  neonClass,
  iconBg,
  index,
  href,
}: GameCardProps) {
  const isPlayable = Boolean(href)

  const cardContent = (
    <motion.div
      className={`glass-card ${neonClass} p-6 flex flex-col gap-4 select-none h-full ${
        isPlayable ? 'cursor-pointer' : 'cursor-default opacity-80'
      }`}
      initial={{ opacity: 0, y: 32 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: 0.5,
        delay: index * 0.08,
        ease: [0.22, 1, 0.36, 1],
      }}
      whileHover={isPlayable ? { y: -4 } : undefined}
    >
      {/* Icon & Status */}
      <div className="flex items-center justify-between">
        <div
          className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
          style={{ background: iconBg }}
        >
          {icon}
        </div>
        {isPlayable ? (
          <span
            className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
            style={{
              background: 'rgba(48, 209, 88, 0.15)',
              color: '#30D158',
              border: '1px solid rgba(48, 209, 88, 0.3)',
            }}
          >
            Live
          </span>
        ) : (
          <span
            className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full text-white/30"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            Soon
          </span>
        )}
      </div>

      {/* Text */}
      <div className="flex flex-col gap-1.5 flex-1">
        <h2 className="text-lg font-bold tracking-tight text-white leading-tight">
          {title}
        </h2>
        <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.5)' }}>
          {description}
        </p>
      </div>

      {/* Action / Hint */}
      <div
        className="mt-auto flex items-center gap-1.5 pt-2"
        style={{
          color: isPlayable ? 'rgba(0, 245, 255, 0.9)' : 'rgba(255,255,255,0.25)',
        }}
      >
        <span className="text-xs uppercase tracking-widest font-semibold">
          {isPlayable ? 'Play Now' : 'Coming Soon'}
        </span>
        {isPlayable && (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6h8M6 2l4 4-4 4"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </div>
    </motion.div>
  )

  if (href) {
    return (
      <Link to={href} className="block no-underline h-full">
        {cardContent}
      </Link>
    )
  }

  return cardContent
}

export default GameCard
