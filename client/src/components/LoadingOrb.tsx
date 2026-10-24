import { motion } from 'framer-motion'

/**
 * LoadingOrb — a morphing neon orb for use as a loading indicator
 * or decorative element throughout PIXELVERSE.
 *
 * Props:
 *   size    — diameter in px (default 80)
 *   color   — primary glow color (default cyan)
 *   className — optional extra classes
 */
interface LoadingOrbProps {
  size?: number
  color?: string
  className?: string
}

const MORPH_PATHS = [
  '50% 50% 50% 50% / 50% 50% 50% 50%',
  '60% 40% 55% 45% / 45% 55% 60% 40%',
  '40% 60% 45% 55% / 55% 45% 40% 60%',
  '55% 45% 60% 40% / 40% 60% 55% 45%',
  '45% 55% 40% 60% / 60% 40% 45% 55%',
]

export function LoadingOrb({ size = 80, color = '#00F5FF', className = '' }: LoadingOrbProps) {
  return (
    <div
      className={`relative flex items-center justify-center ${className}`}
      style={{ width: size, height: size }}
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        style={{
          background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        }}
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
      />

      {/* Mid ring */}
      <motion.div
        className="absolute"
        style={{
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: '50%',
          border: `1px solid ${color}55`,
        }}
        animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.8, 0.4] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut', delay: 0.3 }}
      />

      {/* Morphing orb core */}
      <motion.div
        style={{
          width: size * 0.55,
          height: size * 0.55,
          background: `radial-gradient(circle at 35% 35%, ${color}EE, ${color}44)`,
          boxShadow: `0 0 ${size * 0.3}px ${color}88, 0 0 ${size * 0.6}px ${color}33`,
        }}
        animate={{
          borderRadius: MORPH_PATHS,
          rotate: [0, 360],
          scale: [1, 1.08, 0.95, 1.05, 1],
        }}
        transition={{
          borderRadius: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          rotate: { duration: 8, repeat: Infinity, ease: 'linear' },
          scale: { duration: 3, repeat: Infinity, ease: 'easeInOut' },
        }}
      />

      {/* Inner spark */}
      <motion.div
        className="absolute"
        style={{
          width: size * 0.2,
          height: size * 0.2,
          borderRadius: '50%',
          background: '#ffffff',
          boxShadow: `0 0 ${size * 0.15}px #ffffff`,
        }}
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.8, 1.2, 0.8] }}
        transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

export default LoadingOrb
